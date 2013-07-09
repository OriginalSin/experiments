// Векторный слой
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
						console.log('getSessionKey: ' , options.gmx);
						gmxAPIutils.getLayerPropreties(
							{
								'tileSenderPrefix': options.gmx.tileSenderPrefix
								,'mapName': options.gmx.mapName
								,'layerName': options.gmx.layerName
							}, function(ph) {
								options.gmx.properties = ph['properties'];
								options.gmx.geometry = ph['geometry'];
								options.gmx.attr = gmxAPIutils.prepareLayerBounds(ph);
								console.log('getLayerPropreties: ' , options.gmx);
								myLayer._update();
/*
								console.log('getLayerPropreties: ' , ph);
								console.log('prepareLayerBounds: ' , res);
								var oneDay = 1000*60*60*24;	// один день
								var dt2 = new Date(new Date().getTime() + 3 * oneDay)
								var dt1 = new Date(dt2.getTime() - 701 * oneDay)
								var res1 = gmxAPIutils.getNeedTiles(res, dt1, dt2, res);
								console.log('getNeedTiles: ' , res1);
								var gmxTilePoint = {'z': 1, 'x': 0, 'y': 0};
								//var gmxTilePoint = {'z': 17, 'x': 13670, 'y': 24422};
								var cnt = gmxAPIutils.loadTile(res, gmxTilePoint, function(ph) {
									console.log('loadTile: ' , ph);
								});
								console.log('loadTile cnt: ' , cnt);*/
						});
						
					} else {
						console.log('Error in getSessionKey: ' , ph);
					}
			});
			
		}
console.log('_initContainer: ', this);
	}
	,
	_addTile: function (tilePoint, container) {
		//this.drawTile(null, tilePoint, this._map._zoom);
		var gmx = this.options.gmx;
		if(!gmx.attr) return;
		if(!gmx.attr.tilesNeedLoad) {
			var res = gmxAPIutils.getNeedTiles(gmx.attr);
			gmx.attr.tilesNeedLoadCounts = res.tilesNeedLoadCounts;
			gmx.attr.tilesNeedLoad = res.tilesNeedLoad;
			console.log('getNeedTiles: ' , gmx);
		}
		
		var gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, this._map.getZoom());
		var cnt = gmxAPIutils.loadTile(gmx, gmxTilePoint, function(ph) {
			console.log('loadTile: ' , ph);
		});
		console.log('loadTile cnt: ' , cnt);
		
						
console.log('_addTile: ', gmxTilePoint, tilePoint);
	}
	,
	drawTile: function (tile, tilePoint, zoom) {
		// override with rendering code
		var opt = this.options;
console.log('drawTile: ', tilePoint);
		//var node = mapNodes[opt['id']];
		//if(!node) return;								// Слой пропал
		//node['chkLoadTile'](tilePoint, zoom);
	}
/*
	,
	_getGMXtileNum: function (tilePoint, zoom) {
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
	_update: function () {
console.log('_update: ', this.id);
		if (!this._map) {
			//console.log('_update: ', this.id);
			return;
		}

		var bounds = this._map.getPixelBounds(),
			zoom = this._map.getZoom(),
			tileSize = this.options.tileSize;

		if (zoom > this.options.maxZ || zoom < this.options.minZ) {
			this._clearBgBuffer();
			return;
		}

		var nwTilePoint = new L.Point(
				Math.floor(bounds.min.x / tileSize),
				Math.floor(bounds.min.y / tileSize)),

			seTilePoint = new L.Point(
				Math.floor(bounds.max.x / tileSize),
				Math.floor(bounds.max.y / tileSize)),

			tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

		this._addTilesFromCenterOut(tileBounds);
	var countInvisibleTiles = this.options.countInvisibleTiles;
	tileBounds.min.x -= countInvisibleTiles; tileBounds.max.x += countInvisibleTiles;
	tileBounds.min.y -= countInvisibleTiles; tileBounds.max.y += countInvisibleTiles;

		if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
			this._removeOtherTiles(tileBounds);
		}
	}
	,
	_clearBgBuffer: function () {
		if (!this._map) {
			//console.log('_clearBgBuffer: ', this.id);
			return;
		}
		L.TileLayer.Canvas.prototype._clearBgBuffer.call(this);
	}
	,
	_reset: function (e) {
		this._tilesKeysCurrent = {};
		L.TileLayer.Canvas.prototype._reset.call(this, e);
	}
	,
	_addTilesFromCenterOut: function (bounds) {
		var queue = [],
			center = bounds.getCenter();

		var j, i, point;
		var zoom = this._map.getZoom();
		var node = mapNodes[this.options['id']];
		node['tilesKeys'] = {};
		if(!this._tilesKeysCurrent) this._tilesKeysCurrent = {};
		var curKeys = {};

		for (j = bounds.min.y; j <= bounds.max.y; j++) {
			for (i = bounds.min.x; i <= bounds.max.x; i++) {
				point = new L.Point(i, j);
				var gmxTilePoint = this._getGMXtileNum(point, zoom);
				var gmxTileID = gmxTilePoint['gmxTileID'];
				if(!node['tilesKeys'][gmxTileID]) node['tilesKeys'][gmxTileID] = {};
				var tKey = point.x + ':' + point.y;
				node['tilesKeys'][gmxTileID][tKey] = point;

				if (!this._tilesKeysCurrent.hasOwnProperty(tKey) && this._tileShouldBeLoaded(point)) {
					queue.push(point);
				}
				curKeys[tKey] = gmxTilePoint;
			}
		}
		this._tilesKeysCurrent = curKeys;

		var tilesToLoad = queue.length;

		if (tilesToLoad === 0) { return; }

		// load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(center) - b.distanceTo(center);
		});

		var fragment = document.createDocumentFragment();

		// if its the first batch of tiles to load
		if (!this._tilesToLoad) {
			this.fire('loading');
		}

		this._tilesToLoad += tilesToLoad;

		this._tileContainer.appendChild(fragment);

		for (i = 0; i < tilesToLoad; i++) {
			this._addTile(queue[i], fragment);
		}
	}
	,
	getCanvasTile: function (tilePoint) {
		var tKey = tilePoint.x + ':' + tilePoint.y;
		for(var key in this._tiles) {
			if(key == tKey) return this._tiles[key];
		}
		if (!this._map) {
			//console.log('getCanvasTile: ', this.id);
		}
		var tile = this._getTile();
		tile.id = tKey;
		tile._layer = this;
		tile._tilePoint = tilePoint;

		this._tiles[tKey] = tile;
		this._tileContainer.appendChild(tile);

		var tilePos = this._getTilePos(tilePoint);
		L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
		this._markTile(tilePoint, 1);

		return this._tiles[tKey];
	}
	,
	_markTile: function (tilePoint, cnt) {					// cnt = количество отрисованных обьектов в тайле
		var tKey = tilePoint.x + ':' + tilePoint.y;
		var tile = this._tiles[tKey] || null;
		if (cnt > 0) {
			if(!tile) tile = this.getCanvasTile(tilePoint);
			this._tileOnLoad.call(tile);
			tile._tileComplete = true;					// Added by OriginalSin
			tile._needRemove = false;
			tile._cnt = cnt;
		} else {
			if(tile) tile._needRemove = true;
		}
		this._tileLoaded();
	}
	,
	tileDrawn: function (tile, cnt) {				// cnt = количество отрисованных обьектов в тайле
		if(tile) {
			if (cnt > 0) {
				this._tileOnLoad.call(tile);
				tile._tileComplete = true;					// Added by OriginalSin
				tile._needRemove = false;
			} else {
				tile._needRemove = true;
			}
		}
		this._tileLoaded();
		
	}
	,
	removeTile: function (tilePoint) {
		var tKey = tilePoint.x + ':' + tilePoint.y;
		if(this._tiles[tKey]) this._removeTile(tKey);
	}
	,
	removeAllTiles: function () {
		for(var key in this._tiles) {
			this._removeTile(key);
		}
	}
	,
	_addTile: function (tilePoint, container) {
		this.drawTile(null, tilePoint, this._map._zoom);
	}
	,
	_getLoadedTilesPercentage: function (container) {
		// Added by OriginalSin
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
*/
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
		for (var key in ph.attr['tilesNeedLoad']) {
			var it = ph.attr['tilesAll'][key];
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
