// Плагин векторного слоя
L.TileLayer.gmxVectorLayer = L.TileLayer.Canvas.extend(
{
	_initContainer: function () {
		L.TileLayer.Canvas.prototype._initContainer.call(this);
		var myLayer = this;
		var options = this.options;
		if(!('gmx' in options)) {
			options.gmx = {
				'hostName': options.hostName
				,'apikeyRequestHost': options.apikeyRequestHost || options.hostName
				,'apiKey': options.apiKey
				,'mapName': options.mapName
				,'layerName': options.layerName
			};
			this._map.on('zoomstart', function(e) {
				options.gmx['zoomstart'] = true;
			});
			this._map.on('zoomend', function(e) {
				options.gmx['zoomstart'] = false;
			});
			
			gmxAPIutils.getSessionKey(
				{
					'url': "http://" + options.gmx.apikeyRequestHost + "/ApiKey.ashx?WrapStyle=None&Key=" + options.gmx.apiKey
				}, function(ph) {
					if(ph && ph['Status'] === 'ok') {
						options.gmx.sessionKey = ph['Result']['Key'];
						options.gmx.tileSenderPrefix = "http://" + options.gmx.hostName + "/" + 
							"TileSender.ashx?WrapStyle=None" + 
							"&key=" + encodeURIComponent(options.gmx.sessionKey)
							;
						//console.log('getSessionKey: ' , options.gmx);
						gmxAPIutils.getLayerPropreties(
							{
								'tileSenderPrefix': options.gmx.tileSenderPrefix
								,'mapName': options.gmx.mapName
								,'layerName': options.gmx.layerName
							}, function(ph) {
								options.gmx.properties = ph['properties'];
								options.gmx.geometry = ph['geometry'];
								options.gmx.attr = gmxAPIutils.prepareLayerBounds(ph);
								//console.log('getLayerPropreties: ' , options.gmx);
								myLayer._update();
						});
					} else {
						console.log('Error in getSessionKey: ' , ph);
					}
			});
			
		}
		options.gmx.tileSize = gmxAPIutils.getTileSize(this._map._zoom);
		options.gmx.mInPixel = 256 / options.gmx.tileSize;
		options.gmx._tilesToLoad = 0;
		// Получение сдвига OSM
		var pos = this._map.getCenter();
		var p1 = this._map.project(new L.LatLng(gmxAPIutils.from_merc_y(gmxAPIutils.y_ex(pos.lat)), pos.lng), this._map._zoom);
		var point = this._map.project(pos);
		options.gmx.shiftY = point.y - p1.y;
		//console.log('_initContainer: ', options.gmx.shiftY);
	}
	,
	_update: function () {

		if (!this._map) { return; }

		var bounds = this._map.getPixelBounds(),
		    zoom = this._map.getZoom(),
		    tileSize = this.options.tileSize;

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			clearTimeout(this._clearBgBufferTimer);
			this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
			return;
		}

		var shiftY = (this.options.gmx.shiftY ? this.options.gmx.shiftY : 0);		// Сдвиг к OSM
		bounds.min.y += shiftY;
		bounds.max.y += shiftY;

		var nwTilePoint = new L.Point(
		        Math.floor(bounds.min.x / tileSize),
		        Math.floor(bounds.min.y / tileSize)),

		    seTilePoint = new L.Point(
		        Math.floor(bounds.max.x / tileSize),
		        Math.floor(bounds.max.y / tileSize)),

		    tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

		this._addTilesFromCenterOut(tileBounds);

		if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
			this._removeOtherTiles(tileBounds);
		}
	}
	,
	_addTile: function (tilePoint, container) {
		var myLayer = this, zoom = myLayer._map._zoom;
		var gmx = this.options.gmx;
		if(!gmx.attr) return;
		if(!gmx.attr.tilesNeedLoad) {
			var res = gmxAPIutils.getNeedTiles(gmx.attr);
			gmx.attr.tilesNeedLoadCounts = res.tilesNeedLoadCounts;
			gmx.attr.tilesNeedLoad = res.tilesNeedLoad;
			gmx.attr.cntItems = 0;
			//console.log('getNeedTiles: ' , gmx);
		}
		this.options.gmx._tilesToLoad++;
		
		var gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom);
		var cnt = gmxAPIutils.loadTile(gmx, gmxTilePoint, function(ph) {
			var gmxTileKey = ph.gmxTileKey;
			delete gmx.attr.tilesNeedLoad[gmxTileKey];
			var cntItems = gmxAPIutils.parseTile(gmx, ph);
			gmx.attr.cntItems += cntItems;
			if(ph.cnt === 0) {
				myLayer.gmxDrawTile(null, tilePoint, zoom);
				//console.log('loadTile: ' , gmxTileKey, cntItems, ph.cnt);
			}
		});
		if(cnt === 0) myLayer.gmxDrawTile(null, tilePoint, zoom);
		//console.log('loadTile cnt: ' , gmxTilePoint, cnt);
	}
	,
	gmxDrawTile: function (tile, tilePoint, zoom) {
		var options = this.options;
		var gmx = options.gmx;
		//if(gmx['zoomstart']) return;
		var gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom);
		var arr = gmxAPIutils.getTileKeysIntersects(gmxTilePoint, gmx.attr['tilesAll']);
		for (var i = 0, len = arr.length; i < len; i++) {
			var key = arr[i];
			var pt = gmx.attr['tilesAll'][key];
			var data = pt['data'] || [];
			if(data.length === 0) continue;
			if(!tile) {
				tile = this.gmxGetCanvasTile(tilePoint);
			}
			this.gmxPaintTile(tile, key, zoom);
		}
		this.tileDrawn(tile);
//console.log('_tilesToLoad: ', this.options.gmx._tilesToLoad);
	}
	,
	gmxGetCanvasTile: function (tilePoint) {
		var tKey = tilePoint.x + ':' + tilePoint.y;
//console.log('gmxGetCanvasTile: ', tKey);
		for(var key in this._tiles) {
			if(key == tKey) return this._tiles[key];
		}
		var tile = this._getTile();
		tile.id = tKey;
		tile._layer = this;
		tile._tilePoint = tilePoint;
/*var ctx = tile.getContext('2d');
ctx.lineWidth = 2;
ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
ctx.fillStyle = 'rgba(0, 0, 255, 1)';
ctx.fillRect(22, 22, 220, 220);
ctx.strokeRect(2, 2, 250, 250);
	ctx.stroke();
	ctx.fill();*/

		this._tiles[tKey] = tile;
		this._tileContainer.appendChild(tile);

		var tilePos = this._getTilePos(tilePoint);
		var shiftY = (this.options.gmx.shiftY ? this.options.gmx.shiftY : 0);		// Сдвиг к OSM
		if(shiftY !== 0) tilePos.y -= shiftY;
		L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
		//this._markTile(tilePoint, 1);
		return this._tiles[tKey];
	}
	,
	gmxPaintTile: function (tile, key, zoom) {
		var options = this.options;
		var gmx = options.gmx;
		var style = gmx.attr['styles'][0];
//console.log('gmxPaintTile: ', zoom, pt['data']);
		var gmxTilePoint = this.gmxGetTileNum(tile._tilePoint, zoom);
		gmxAPIutils.paintTilePolygons({
			'gmx': gmx
			,'gmxTileKey': key
			,'x': 256 * gmxTilePoint.x
			,'y': 256 * gmxTilePoint.y
			,'ctx': tile.getContext('2d')
		}, style);
		tile._tileComplete = true;
	}
	,
	gmxGetTileNum: function (tilePoint, zoom) {
		var pz = Math.pow(2, zoom);
		var tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0);
		var ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
		var gmxTilePoint = {
			'x': tx % pz - pz/2
			,'y': pz/2 - 1 - ty % pz
		};
		gmxTilePoint['gmxTileID'] = zoom + '_' + gmxTilePoint.x + '_' + gmxTilePoint.y
		return gmxTilePoint;
	}
	,
	_getLoadedTilesPercentage: function (container) {
		if(!container) return 0;
		var len = 0, count = 0;
		var arr = ['img', 'canvas'];
		for (var key in arr) {
			var tiles = container.getElementsByTagName(arr[key]);
			if(tiles && tiles.length > 0) {
				len += tiles.length;
				for (var i = 0; i < tiles.length; i++) {
					if (tiles[i]._tileComplete) {
						count++;
					}
				}
			}
		}
		if(len < 1) return 0;
		return count / len;	
	}
	,
	_tileLoaded: function () {
		this.options.gmx._tilesToLoad--;
		
		if (!this.options.gmx._tilesToLoad) {
			this.fire('load');

			if (this._animated) {
				// clear scaled tiles after all new tiles are loaded (for performance)
				clearTimeout(this._clearBgBufferTimer);
				this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
			}
		}
	}
	,
	_tileOnLoad: function (tile) {
		if (tile) L.DomUtil.addClass(tile, 'leaflet-tile-loaded');
		this._tileLoaded();
	}
	,
	tileDrawn: function (tile) {
		this._tileOnLoad(tile);
	}
});

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
	getTileNumFromLeaflet: function (tilePoint, zoom) {
		var pz = Math.pow(2, zoom);
		var tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0);
		var ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
		var gmxTilePoint = {
			'z': zoom
			,'x': tx % pz - pz/2
			,'y': pz/2 - 1 - ty % pz
		};
		gmxTilePoint['gmxTileID'] = zoom + '_' + gmxTilePoint.x + '_' + gmxTilePoint.y
		return gmxTilePoint;
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
	,'dec2rgba': function(i, a)	{				// convert decimal to rgb
		var r = (i >> 16) & 255;
		var g = (i >> 8) & 255;
		var b = i & 255;
		return 'rgba('+r+', '+g+', '+b+', '+a+')';
	}
	,
	'prepareLayerBounds': function(layer) {					// построение списков тайлов
		var res = {'tilesAll':{}, 'items':{}, 'tileCounts':0};
		var prop = layer.properties;
		var geom = layer.geometry;
		var type = prop['type'] + (prop['Temporal'] ? 'Temporal' : '');

		var defaultStyle = {'lineWidth': 1, 'strokeStyle': 'rgba(0, 0, 255, 1)'};
		var styles = [defaultStyle];
		if(prop['styles']) {
			styles.shift();
			for (var i = 0, len = prop['styles'].length; i < len; i++)
			{
				var it = prop['styles'][i];
				var pt = {};
				var renderStyle = it['RenderStyle'];
				if(renderStyle['outline']) {
					var outline = renderStyle['outline'];
					if(outline['thickness']) pt['lineWidth'] = outline['thickness'];
					pt['strokeStyle'] = gmxAPIutils.dec2rgba(outline['color'] || 255, outline['opacity']/100 || 1);
				}
				if(renderStyle['fill']) {
					var fill = renderStyle['fill'];
					pt['fillStyle'] = gmxAPIutils.dec2rgba(fill['color'] || 255, fill['opacity']/100 || 1);
				}
				styles.push(pt);
			}
		}
		res['styles'] = styles;

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
			/*if(maxDelta > 1) {
				zn1 = parseInt(zn1) + 1;
				var ut11 = ph['ZeroUT'] + zn1 * mn;
				gmxAPIutils.getTilesByPeriods(ph, ph['ut1'], ut11, res);
			} else {*/
				zn1 = parseInt(zn1);
			//}
		}
		if(parseInt(zn2) < zn2) {
			/*if(maxDelta > 1) {
				zn2 = parseInt(zn2);
				var ut21 = ph['ZeroUT'] + zn2 * mn;
				gmxAPIutils.getTilesByPeriods(ph, ut21, ph['ut2'], res);
			} else {*/
				zn2 = parseInt(zn2) + 1;
			//}
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
	'isTileKeysIntersects': function(tk1, tk2) { // пересечение по номерам 2 тайлов
		var pz = Math.pow(2, tk1.z - tk2.z);
		var x2 = Math.floor(tk2.x * pz);
		if(x2 - 1 >= tk1.x) return false;
		if(x2 + pz <= tk1.x) return false;
		var y2 = Math.floor(tk2.y * pz);
		if(y2 - 1 >= tk1.y) return false;
		if(y2 + pz <= tk1.y) return false;
//console.log('isTileKeysIntersects: ' , tk1.x, x2 , tk1.y, y2);
		return true;
	}
	,
	'getTileKeysIntersects': function(gmxTilePoint, tilesAll) {	// получить список тайлов сервера пересекающих gmxTilePoint
		var out = [];
		for (var key in tilesAll) {
			if(gmxAPIutils.isTileKeysIntersects(gmxTilePoint, tilesAll[key]['gmxTilePoint'])) {
				out.push(key);
			}
		}
		return out;
	}
	,
	'loadTile': function(ph, gmxTilePoint, callback) {	// загрузить тайлы по отображаемому gmxTilePoint
		var prefix = '';
		var cnt = 0;
		var arr = gmxAPIutils.getTileKeysIntersects(gmxTilePoint, ph.attr['tilesAll']);
		for (var i = 0, len = arr.length; i < len; i++) {
			var key = arr[i];
			if(key in ph.attr['tilesNeedLoad']) {
				var it = ph.attr['tilesAll'][key];
				var tp = it['gmxTilePoint'];
				if(gmxAPIutils.isTileKeysIntersects(gmxTilePoint, tp)) {
					if(!prefix) {
						prefix = ph['tileSenderPrefix'] + '&ModeKey=tile&r=t';
						prefix += "&MapName=" + ph['mapName'];
						prefix += "&LayerName=" + ph['layerName'];
					}
					var url = prefix + "&z=" + tp['z'];
					url += "&x=" + tp['x'];
					url += "&y=" + tp['y'];
					url += "&v=" + tp['v'];
					if(tp['d'] !== -1) url += "&Level=" + tp['d'] + "&Span=" + tp['s'];
					cnt++;
					(function() {
						var gmxTileKey = key;
						gmxAPIutils.request({
							'url': url
							,'callback': function(st) {
								cnt--;
								callback({'cnt': cnt, 'gmxTileKey': gmxTileKey, 'data': JSON.parse(st)});
								//console.log('drawTileID: ' , data);
							}
						});
					})();
				}
			}
		}
		return cnt;
	}
	,
	'parseTile': function(gmx, ph) {	// парсинг загруженного тайла
		var gmxTileKey = ph.gmxTileKey;
		var tHash = gmx.attr['tilesAll'][gmxTileKey];
		var items = gmx.attr.items;
		var layerProp = gmx.properties;
		var identityField = layerProp.identityField || 'ogc_fid';
		var data = ph.data;
		for (var i = 0, len = ph.data.length; i < len; i++) {
			var it = ph.data[i];
			var prop = it['properties'];
			delete it['properties'];
			var geom = it['geometry'];
			
			var id = it['id'] || prop[identityField];
			var propHiden = null;
			var item = items[id];
			if(item) {
				if(item['type'].indexOf('MULTI') == -1) item['type'] = 'MULTI' + item['type'];
			} else {
				item = {
					'id': id
					,'type': geom['type']
					,'properties': prop
					,'propHiden': {
						'fromTiles': {}
					}
				};
				items[id] = item;
			}
			item['propHiden']['fromTiles'][gmxTileKey] = true;
			if(prop.TemporalColumnName) {
				var zn = prop[prop.TemporalColumnName] || '';
				zn = zn.replace(/(\d+)\.(\d+)\.(\d+)/g, '$2/$3/$1');
				var vDate = new Date(zn);
				var offset = vDate.getTimezoneOffset();
				var dt = Math.floor(vDate.getTime() / 1000  - offset*60);
				item['propHiden']['unixTimeStamp'] = dt;
			}
		}
		tHash['data'] = ph.data;
		return ph.data.length;
	}
	,
	'chkHiddenPoints': function(attr) {	// массив точек (мульти)полигона на границах тайлов
		var gmx = attr.gmx;
		var gmxTileKey = attr.gmxTileKey;
		var tHash = gmx.attr['tilesAll'][gmxTileKey];
		var tileBounds = tHash.bounds;
		var d = (tileBounds.max.x - tileBounds.min.x)/10000;
		var tbDelta = {									// границы тайла для определения onEdge отрезков
			'minX': tileBounds.min.x + d
			,'maxX': tileBounds.max.x - d
			,'minY': tileBounds.min.y + d
			,'maxY': tileBounds.max.y - d
		};
		var chkOnEdge = function(p1, p2, ext) {				// отрезок на границе
			if ((p1[0] < ext.minX && p2[0] < ext.minX) || (p1[0] > ext.maxX && p2[0] > ext.maxX)) return true;
			if ((p1[1] < ext.minY && p2[1] < ext.minY) || (p1[1] > ext.maxY && p2[1] > ext.maxY)) return true;
			return false;
		}
		var getHidden = function(coords, tb) {			// массив точек на границах тайлов
			var hideLines = [];
			var prev = null;
			for (var i = 0, len = coords.length; i < len; i++) {
				var p = coords[i];
				if(prev && chkOnEdge(p, prev, tb)) {
					hideLines.push(i);
				}
				prev = p;
			}
			return hideLines;
		}
		for (var i = 0, len = tHash['data'].length; i < len; i++) {
			var it = tHash['data'][i];
			var geom = it['geometry'];
			if(geom['type'].indexOf('POLYGON') !== -1) {
				var hideLines = [];								// индексы точек лежащих на границе тайла
				var coords = geom['coordinates'];
				var cnt = 0;
				for (var j = 0, len1 = coords.length; j < len1; j++) {
					var coords1 = coords[j];
					if(geom['type'].indexOf('MULTI') !== -1) {
						for (var j1 = 0, len2 = coords1.length; j1 < len2; j1++) {
							hideLines.push(getHidden(coords1[j1], tbDelta));
						}
					} else {
						hideLines.push(getHidden(coords1, tbDelta));
					}
				}
				it['hideLines'] = hideLines;
			}
		}
	}
	,
	'paintTilePolygons': function(attr, style) {	// Отрисовка геометрии полигона
		var gmx = attr.gmx;
		var gmxTileKey = attr.gmxTileKey;
		var tHash = gmx.attr['tilesAll'][gmxTileKey];

		var mInPixel = gmx['mInPixel'];

		var drawPolygon = function(coords, hideLines, pattr, pstyle) {	// массив точек на границах тайлов
			var ctx = pattr['ctx'];
//delete style['strokeStyle'];
			for (var key in pstyle) ctx[key] = pstyle[key];

			var x = pattr['x'];
			var y = 256 + pattr['y'];
			var toPixels = function(p) {				// получить координату в px
				var px1 = p[0] * mInPixel - x; 	px1 = (0.5 + px1) << 0;
				var py1 = y - p[1] * mInPixel;	py1 = (0.5 + py1) << 0;
				return [px1, py1];
			}
			var arr = [];
			var lastX = null, lastY = null, prev = null, cntHide = 0;
			if(style.strokeStyle) {
				ctx.beginPath();
				for (var i = 0, len = coords.length; i < len; i++) {
					var lineIsOnEdge = false;
					if(i == hideLines[cntHide]) {
						lineIsOnEdge = true;
						cntHide++;
					}
					var p1 = toPixels(coords[i]);
					if(lastX !== p1[0] || lastY !== p1[1]) {
						if(lineIsOnEdge || i == 0)	ctx.moveTo(p1[0], p1[1]);
						else 						ctx.lineTo(p1[0], p1[1]);
						lastX = p1[0], lastY = p1[1];
						if(ctx.fillStyle) arr.push(p1);
					}
				}
				ctx.stroke();
			} else {
				arr = coords;
			}
			if(style.fillStyle) {
				ctx.beginPath();
				ctx.globalAlpha = 0;
				for (var i = 0, len = arr.length; i < len; i++) {
					var p1 = arr[i];
					if(!style.strokeStyle) p1 = toPixels(p1);
					if(i == 0)	ctx.moveTo(p1[0], p1[1]);
					else		ctx.lineTo(p1[0], p1[1]);
				}
				ctx.globalAlpha = 1;
				ctx.fill();
			}
		}
		
		for (var i = 0, len = tHash['data'].length; i < len; i++) {
			var it = tHash['data'][i];
			if(!it['hideLines']) gmxAPIutils.chkHiddenPoints(attr);
			var geom = it['geometry'];
			if(geom['type'].indexOf('POLYGON') !== -1) {
				(function() {
					var it = tHash['data'][i];
					var pattr = attr;
					var pstyle = style;
					var doneFunc = function() {
						var geom = it['geometry'];
						var coords = geom['coordinates'];
						for (var j = 0, len1 = coords.length; j < len1; j++) {
							var coords1 = coords[j];
							if(geom['type'].indexOf('MULTI') !== -1) {
								for (var j1 = 0, len2 = coords1.length; j1 < len2; j1++) {
									drawPolygon(coords1[j1], it['hideLines'][j], pattr, pstyle);
								}
							} else {
								drawPolygon(coords1, it['hideLines'][j], pattr, pstyle);
							}
						}
					};
					setTimeout(doneFunc, 0);
				})();
			}
		}
	}
	,'r_major': 6378137.000
	,'r_minor': 6356752.3142
	,'y_ex': function(lat)	{				// Вычисление y_ex 
		if (lat > 89.5)		lat = 89.5;
		if (lat < -89.5) 	lat = -89.5;
		var phi = gmxAPIutils.deg_rad(lat);
		var ts = Math.tan(0.5*((Math.PI*0.5) - phi));
		var y = -gmxAPIutils.r_major * Math.log(ts);
		return y;
	}
	,
	from_merc_y: function(y)
	{
		var temp = gmxAPIutils.r_minor / gmxAPIutils.r_major;
		var es = 1.0 - (temp * temp);
		var eccent = Math.sqrt(es);
		var ts = Math.exp(-y/gmxAPIutils.r_major);
		var HALFPI = 1.5707963267948966;

		var eccnth, Phi, con, dphi;
		eccnth = 0.5 * eccent;

		Phi = HALFPI - 2.0 * Math.atan(ts);

		var N_ITER = 15;
		var TOL = 1e-7;
		var i = N_ITER;
		dphi = 0.1;
		while ((Math.abs(dphi)>TOL)&&(--i>0))
		{
			con = eccent * Math.sin (Phi);
			dphi = HALFPI - 2.0 * Math.atan(ts * Math.pow((1.0 - con)/(1.0 + con), eccnth)) - Phi;
			Phi += dphi;
		}

		return this.deg_decimal(Phi);
	}
	,
	deg_rad: function(ang)
	{
		return ang * (Math.PI/180.0);
	}
	,
	deg_decimal: function(rad)
	{
		return (rad/Math.PI) * 180.0;
	}
}
