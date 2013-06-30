var gmxAPIutils = {
	'cloneLevel': 10				// уровень клонирования обьектов
	,
	'clone': function (o, level)
	{
		if(!level) level = 0;
		var type = typeof(o);
		if(!o || type !== 'object')  {
			return (type === 'function' ? 'function' : o);
		}
		var c = 'function' === typeof(o.pop) ? [] : {};
		var p, v;
		for(p in o) {
			if(o.hasOwnProperty(p)) {
				v = o[p];
				var type = typeof(v);
				if(v && type === 'object') {
					c[p] = (level < gmxAPIutils.cloneLevel ? gmxAPIutils.clone(v, level + 1) : 'object');
				}
				else {
					c[p] = (type === 'function' ? 'function' : v);
				}
			}
		}
		return c;
	}
	,
	'getXmlHttp': function() {
		var xmlhttp;
		try {
			xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
		} catch (e) {
			try {
				xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
			} catch (E) {
				xmlhttp = false;
			}
		}
		if (!xmlhttp && typeof XMLHttpRequest!='undefined') {
			xmlhttp = new XMLHttpRequest();
		}
		return xmlhttp;
	}
	,
	'request': function(ph) {	// {'type': 'GET|POST', 'url': 'string', 'callback': 'func'}
	  try {
		var xhr = gmxAPIutils.getXmlHttp();
		xhr.withCredentials = true;
		xhr.open((ph['type'] ? ph['type'] : 'GET'), ph['url'], true);
		//if(ph['type'] === 'POST') xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

		/*var arr = [];
		if(ph['params']) {
			for(var key in ph['params']) {
				arr.push(key + '=' + ph['params'][key]);
			}
		}
		xhr.send((arr.length ? arr.join('&') : null));
		*/
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				//self.log('xhr.status ' + xhr.status);
				if(xhr.status == 200) {
					ph['callback'](xhr.responseText);
					xhr = null;
				}
			}
		};
		xhr.send((ph['params'] ? ph['params'] : null));
		return xhr.status;
	  } catch (e) {
		if(ph['onError']) ph['onError'](xhr.responseText);
		return e.description; // turn all errors into empty results
	  }
	}
	,
	'getSessionKey': function(ph, callback)	{		// Получение ключа сессии
		gmxAPIutils.request({
			'url': ph['url']
			,'callback': function(st) {
				callback(JSON.parse(st));
			}
		});
	}
	,
	'getMapPropreties': function(ph, callback)	{		// Получение описания карты
		gmxAPIutils.request({
			'url': ph['tileSenderPrefix'] + "&MapName=" + ph['mapName'] + '&ModeKey=map'
			,'callback': function(st) {
				callback(JSON.parse(st));
			}
		});
	}
	,
	'getLayerPropreties': function(ph, callback)	{		// Получение описания слоя из описания карты
		var layerName = ph['layerName'];
		//var mapName = ph['mapName'];
		gmxAPIutils.getMapPropreties(ph, function(json) {
			if(json && json['Status'] === 'ok') {
				var arr = json['Result'].children;
				//var propMap = json['Result'].properties;
				for(var i=0, len=arr.length; i<len; i++) {
					var layer = arr[i];
					if(layer['type'] === 'layer') {
						if(layerName === layer['content']['properties']['name']) {
							callback(layer['content']);
							return;
						}
					}
				}
				callback({'error': 'layer not found'});
			} else {
				callback({'error': 'map not found'});
			}
		});
	}
	,
	'getTileSize': function(zoom)	{		// Вычисление размеров тайла по zoom
		var pz = Math.pow(2, zoom);
		var mInPixel =  pz/156543.033928041;
		return 256 / mInPixel;
	}
	,
	'bounds': function(arr) {							// получить bounds массива точек
		var res = {
			'min': {
				'x': Number.MAX_VALUE
				,'y': Number.MAX_VALUE
			}
			,
			'max': {
				'x': -Number.MAX_VALUE
				,'y': -Number.MAX_VALUE
			}
			,
			'extend': function(x, y) {
				if(x < res.min.x) res.min.x = x;
				if(x > res.max.x) res.max.x = x;
				if(y < res.min.y) res.min.y = y;
				if(y > res.max.y) res.max.y = y;
			}
			,
			'extendArray': function(arr) {
				for(var i=0, len=arr.length; i<len; i++) {
					res.extend(arr[i][0], arr[i][1]);
				}
			}
			,
			'intersects': function (bounds) { // (Bounds) -> Boolean
				var min = this.min,
					max = this.max,
					min2 = bounds.min,
					max2 = bounds.max;
					return (max2.x < min.x || min2.x > max.x || max2.y < min.y || min2.y > max.y ? false : true);
				/*var min = this.min,
					max = this.max,
					min2 = bounds.min,
					max2 = bounds.max,
					xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
					yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

				return xIntersects && yIntersects;*/
			}
		};
		if(arr) res.extendArray(arr);
		return res;
	}
	,
	'itemBounds': function(item) {							// получить bounds векторного обьекта
		var geo = item['geometry'];
		var type = geo['type'];
		var coords = geo['coordinates'];
		var arr = [];
		var addToArr = function(pol) {
			for (var i = 0, len = pol.length; i < len; i++)	arr.push(pol[i]);
		}
		if(type === 'POINT') {
			arr.push(coords);
		} else if(type === 'POLYGON') {
			addToArr(coords[0]);			// дырки пропускаем
		} else if(type === 'MULTIPOLYGON') {
			for (var i = 0, len = coords.length; i < len; i++) addToArr(coords[i][0]);
		} else if(type === 'MULTIPOINT') {
			addToArr(coords);
		}
		item.bounds = gmxAPIutils.bounds(arr);
		arr = null;
	}
	,
	'prepareLayerBounds': function(layer) {					// построение списков тайлов
		var res = {'tilesAll':{}, 'tileCounts':0};
		var prop = layer.properties;
		var geom = layer.geometry;
		var type = prop['type'] + (prop['Temporal'] ? 'Temporal' : '');

		var addRes = function(z, x, y, v, s, d) {
			var gmxTileKey = z + '_' + x + '_' + y + '_' + v + '_' + s + '_' + d;
			var tileSize = gmxAPIutils.getTileSize(z);
			var minx = x * tileSize, miny = y * tileSize;
			res['tilesAll'][gmxTileKey] = {
				'gmxTileKey': gmxTileKey
				,'gmxTilePoint': {'z': z, 'x': x, 'y': y, 's': s, 'd': d, 'v': v}
				,'bounds': gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]])
			};
		}
		var cnt = 0;
		var arr = prop['tiles'] || [];
		var vers = prop['tilesVers'] || [];
		if(type === 'VectorTemporal') {
			arr = prop['TemporalTiles'];
			vers = prop['TemporalVers'];
			for (var i = 0, len = arr.length; i < len; i++)
			{
				var arr1 = arr[i];
				var z = Number(arr1.pop())
					,y = Number(arr1.pop())
					,x = Number(arr1.pop())
					,s = Number(arr1.pop())
					,d = Number(arr1.pop())
					,v = Number(vers[i])
				;
				addRes(z, x, y, v, s, d);
				cnt++;
			}
			res['TemporalColumnName'] = prop['TemporalColumnName'];
			res['TemporalPeriods'] = prop['TemporalPeriods'];
			
			var ZeroDateString = prop.ZeroDate || '01.01.2008';	// нулевая дата
			var arr = ZeroDateString.split('.');
			var zn = new Date(					// Начальная дата
				(arr.length > 2 ? arr[2] : 2008),
				(arr.length > 1 ? arr[1] - 1 : 0),
				(arr.length > 0 ? arr[0] : 1)
				);
			res['ZeroDate'] = new Date(zn.getTime()  - zn.getTimezoneOffset()*60000);	// UTC начальная дата шкалы
			res['ZeroUT'] = res['ZeroDate'].getTime() / 1000;
			
		} else if(type === 'Vector') {
			for (var i = 0, len = arr.length; i < len; i+=3)
			{
				addRes(Number(arr[i+2]), Number(arr[i]), Number(arr[i+1]), Number(vers[cnt]), -1, -1);
				cnt++;
			}
		}
		res['tileCounts'] = cnt;
		res['layerType'] = type;						// VectorTemporal Vector
		res['identityField'] = prop['identityField'];	// ogc_fid
		res['GeometryType'] = prop['GeometryType'];		// point
		return res;
	}
	,
	'oneDay': 60*60*24			// один день
	,
	'getTilesByPeriods': function(ph, ut1, ut2, res) {	// получить список тайлов по разбивке и периоду
		if(!res) res = {};
		var deltaUT = ut2 - ut1;
		var days = deltaUT / gmxAPIutils.oneDay;
		var deltaArr = ph['TemporalPeriods'];
		var maxDelta = deltaArr[0];
		for(var i = deltaArr.length - 1; i >= 0; i--) {
			maxDelta = deltaArr[i];
			if(days >= maxDelta) break;
		}
		var mn = gmxAPIutils.oneDay * maxDelta;
		var zn1 = (ut1 - ph['ZeroUT'])/mn;
		var zn2 = (ut2 - ph['ZeroUT'])/mn;
		if(parseInt(zn1) < zn1) {
			if(maxDelta > 1) {
				zn1 = parseInt(zn1) + 1;
				var ut11 = ph['ZeroUT'] + zn1 * mn;
				gmxAPIutils.getTilesByPeriods(ph, ph['ut1'], ut11, res);
			} else {
				zn1 = parseInt(zn1);
			}
		}
		if(parseInt(zn2) < zn2) {
			if(maxDelta > 1) {
				zn2 = parseInt(zn2);
				var ut21 = ph['ZeroUT'] + zn2 * mn;
				gmxAPIutils.getTilesByPeriods(ph, ut21, ph['ut2'], res);
			} else {
				zn2 = parseInt(zn2) + 1;
			}
		}
		if(!res[maxDelta]) res[maxDelta] = [];
		res[maxDelta].push([zn1, zn2,
			new Date(1000 * (ph['ZeroUT'] + mn *zn1) ),
			new Date(1000 * (ph['ZeroUT'] + mn *zn2) ),
			new Date(1000 * (ph['ZeroUT'] + mn *zn1 + 256*gmxAPIutils.oneDay) ),
			new Date(1000 * (ph['ZeroUT'] + mn *zn2 + 256*gmxAPIutils.oneDay) )
			]);
		//res[maxDelta].push([zn1, zn2]);
		return res;
	}
	,
	'getNeedTiles': function(ph, dt1, dt2, res) {			// получить список тайлов по временному интервалу
		var _needPeriods = null;
		if(ph['layerType'] === 'VectorTemporal') {
			var ut1 = Math.floor(dt1.getTime() / 1000);
			var ut2 = Math.floor(dt2.getTime() / 1000);
			ph['ut1'] = ut1;
			ph['ut2'] = ut2;
			_needPeriods = gmxAPIutils.getTilesByPeriods(ph, ut1, ut2);
		}
		var cnt = 0;
		var tilesNeedLoad = {};
		for (var key in ph['tilesAll']) {
			if(_needPeriods) {
				var it = ph['tilesAll'][key];
				var gmxTilePoint = it['gmxTilePoint'];
				var d = gmxTilePoint.d;
				var s = gmxTilePoint.s;
				if(_needPeriods[d]) {
					var needArr = _needPeriods[d];
					for (var i = 0, len = needArr.length; i < len; i++)
					{
						var sp = needArr[i];
						if(s >= sp[0] && s <= sp[1]) {
							tilesNeedLoad[key] = true;
							cnt++;
						}
					}
				}
			} else {
				tilesNeedLoad[key] = true;
				cnt++;
			}
		}
		if(!res) res = {};
		res['tilesNeedLoad'] = tilesNeedLoad;
		res['tilesNeedLoadCounts'] = cnt;
		return res;
	}
	,
	'isTileKeysIntersects': function(tk1, tk2) {	// пересечение по номерам 2 тайлов
		var pz = Math.pow(2, tk1.z - tk2.z);
		var x2 = Math.floor(tk2.x * pz);
		if(x2 != tk1.x) return false;
		var y2 = Math.floor(tk2.y * pz);
		if(y2 != tk1.y) return false;
console.log('isTileKeysIntersects: ' , tk1.x, x2 , tk1.y, y2);
		return true;
	
	
	
	
		var x1 = tk1.x + (tk1.x < 0 ? 1 : 0);
		var x2 = tk2.x + (tk2.x < 0 ? 1 : 0);
		var pz = Math.pow(2, tk1.z - tk2.z);
		var xx = parseInt(x2 * pz);
		if(parseInt(x2 * pz) != x1) return false;
		var y1 = tk1.y + (tk1.y < 0 ? 1 : 0);
		var y2 = tk2.y + (tk2.y < 0 ? 1 : 0);
		if(parseInt(y2 * pz) != y1) return false
		return true;
//console.log('drawTileID: ' , data);
	}
	,
	'loadTile': function(ph, gmxTilePoint, callback) {	// загрузить тайлы по отображаемому gmxTilePoint
		//var drawTileID = gmxTilePoint.z + '_' + gmxTilePoint.x + '_' + gmxTilePoint.y;
		var prefix = ph['tileSenderPrefix'] + '&ModeKey=tile&r=t';
		prefix += "&MapName=" + ph['mapName'];
		prefix += "&LayerName=" + ph['layerName'];

		var cnt = 0;
		for (var key in ph['tilesNeedLoad']) {
			var it = ph['tilesAll'][key];
//var flag = gmxAPIutils.isTileKeysIntersects({'z': 2, 'x': -2, 'y': 1}, {'z': 4, 'x': -5, 'y': 3});
			var tp = it['gmxTilePoint'];
			if(gmxAPIutils.isTileKeysIntersects(gmxTilePoint, tp)) {
			//if(key.indexOf(drawTileID) === 0) {
				var url = prefix + "&z=" + tp['z'];
				url += "&x=" + tp['x'];
				url += "&y=" + tp['y'];
				url += "&v=" + tp['v'];
				if(tp['d'] !== -1) url += "&Level=" + tp['d'] + "&Span=" + tp['s'];
				cnt++;
				gmxAPIutils.request({
					'url': url
					,'callback': function(st) {
						cnt--;
						callback({'cnt': cnt, 'data': JSON.parse(st)});
						//console.log('drawTileID: ' , data);
					}
				});
			}
		}
		return cnt;
	}
}
