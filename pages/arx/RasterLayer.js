// растровый слой
(function()
{
	var LMap = null;						// leafLet карта
	var utils = null;						// утилиты для leaflet
	var mapNodes = null;					// Хэш нод обьектов карты - аналог MapNodes.hx

	// Добавить растровый слой
	function setBackgroundTiles(ph)	{
		if(!LMap) init();
		var out = {};
		var layer = ph.obj;
		var id = layer.objectId;
		var node = mapNodes[id];
		if(!node) return;						// Нода не определена
		var gmxNode = null;						// Нода gmxAPI
		node['type'] = 'RasterLayer';
		node['isOverlay'] = false;
		node['failedTiles'] = {};				// Hash тайлов 404
		node['zIndexOffset'] = 0;				// Сдвиг zIndex
		node['listenerIDS'] = {};				// id прослушивателей событий
		node['leaflet'] = null;					// Нода leaflet
		var myLayer = null;

		var inpAttr = ph.attr;
		node['subType'] = ('subType' in inpAttr ? inpAttr['subType'] : (inpAttr['projectionCode'] === 1 ? 'OSM' : ''));
		var attr = {};

		attr['mercGeom'] = layer.mercGeometry || {				// граница слоя в merc
			'type': "POLYGON"
			,'coordinates': [[
				[-20037500, -21133310]
				,[-20037500, 21133310]
				,[20037500, 21133310]
				,[20037500, -21133310]
				,[-20037500, -21133310]
			]]
		};
		
		if(node.propHiden) {
			if(node.propHiden.geom) {
				attr['geom'] = node.propHiden['geom'];					// Геометрия от обьекта векторного слоя
				attr['bounds'] = attr['geom']['bounds'];				// Bounds слоя
			}
			if(node.propHiden.zIndexOffset) node['zIndexOffset'] = node.propHiden['zIndexOffset'];
		}
		var pNode = mapNodes[node.parentId];					// Нода родителя
		if(pNode && pNode.propHiden && pNode.propHiden.subType === 'tilesParent') {
			attr['minZoom'] = pNode.minZ || 1;
			attr['maxZoom'] = pNode.maxZ || 30;
										// pNode.parentId нода векторного слоя по обьекту которого создан растровый слой 
		} else {
			if(pNode && pNode.zIndexOffset) {
				node['zIndexOffset'] = pNode.zIndexOffset;
			}
		}
		if(!'zIndex' in node) node['zIndex'] = utils.getIndexLayer(id);
		node['zIndex'] += node['zIndexOffset'];

		node['setGeometry'] = function() {			// Установка геометрии
			attr['mercGeom'] = gmxAPI.merc_geometry(node['geometry']);
			if(waitRedraw) {
				if(myLayer) myLayer.options.attr = attr;
				waitRedraw();
			}
		}

		node['getLayerBounds'] = function() {				// Проверка границ растрового слоя
			if(!gmxNode || !attr['mercGeom']) return;
			var ext = null;
			if('getLayerBounds' in gmxNode) ext = gmxNode.getLayerBounds();
			else {
				var geo = gmxNode.getGeometry();
				if(!geo || !geo.type) {
					geo = attr['mercGeom'];
					var boundsMerc = gmxAPI.getBounds(geo.coordinates);
					ext = {
						minX: gmxAPI.from_merc_x(boundsMerc['minX']),
						minY: gmxAPI.from_merc_y(boundsMerc['minY']),
						maxX: gmxAPI.from_merc_x(boundsMerc['maxX']),
						maxY: gmxAPI.from_merc_y(boundsMerc['maxY'])
					};
				} else {
					ext = gmxAPI.getBounds(geo.coordinates);
					attr['mercGeom'] = gmxAPI.merc_geometry(geo);
				}
			}
			
			var	bounds = new L.Bounds();
			bounds.extend(new L.Point(ext.minX, ext.minY ));
			bounds.extend(new L.Point(ext.maxX, ext.maxY ));
			attr['bounds'] = bounds;
		}

		var chkVisible = function() {
			if(!gmxNode) return;
			if(node.isVisible != false) {
				var notOnScene = true;
				var continuousWorld = false;
				if(node['leaflet']) {
					if(node['leaflet']._map) notOnScene = false;
					continuousWorld = node['leaflet'].options.continuousWorld;
				}
				if(!continuousWorld && !attr['bounds']) {
					node['getLayerBounds']();
				}

				var notOnScene = (node['leaflet'] && node['leaflet']._map ? false : true);
				var notViewFlag = (!utils.chkVisibilityByZoom(id)
					|| (!continuousWorld && !utils.chkBoundsVisible(attr['bounds']))
					);
				
				if(notOnScene != notViewFlag) {
					utils.setVisibleNode({'obj': node, 'attr': !notViewFlag});
					if(notViewFlag)	delete gmxAPI._leaflet['renderingObjects'][node.id];
				}
			}
		}

		node['remove'] = function() {				// Удалить растровый слой
			if(myLayer) LMap.removeLayer(myLayer);
		}

		node['setStyle'] = function() {
			var newOpacity = node.regularStyle.fillOpacity;
			if(newOpacity != myLayer.options.opacity) {			// Изменить opacity растрового слоя
				myLayer.options.opacity = newOpacity;
				myLayer.setOpacity(newOpacity);
			}
		}
		node.onZoomend = function()	{				// Проверка видимости по Zoom
//console.log('_onZoomend: ', node.id);
			chkVisible();
		}

		var redrawTimer = null;										// Таймер
		var waitRedraw = function()	{								// Требуется перерисовка с задержкой
			if(redrawTimer) clearTimeout(redrawTimer);
			redrawTimer = setTimeout(function()
			{
				chkVisible();
				if(!node.isVisible || !node['leaflet'] || !node['leaflet']._map) return;
				redrawTimer = null;
				myLayer._update();
				//node['leaflet'].redraw();
			}, 10);
			return false;
		}
		node['waitRedraw'] = waitRedraw;
		//if(layer.properties && layer.properties.visible != false) node.isVisible = true;
		node.isVisible = (layer.properties && 'visible' in layer.properties ? layer.properties.visible : true);

		var chkInitListeners = function()	{								// Требуется перерисовка с задержкой
			var func = function(flag) {	// Изменилась видимость слоя
				if(flag) {
					if('nodeInit' in node) node['nodeInit']();
					chkVisible();
				}
			};
			var key = 'onChangeVisible';
			if(!node['listenerIDS'][key]) {
				node['listenerIDS'][key] = {'obj': gmxNode, 'evID': gmxNode.addListener(key, func, -10)};
			}
			if(node.isVisible) {
				func(node.isVisible);
			}
		}
		node['nodeInit'] =	function() {
			delete node['nodeInit'];

			var initCallback = function(obj) {			// инициализация leaflet слоя
				if(obj._container) {
					if(obj._container.id != id) obj._container.id = id;
					if(obj._container.style.position != 'absolute') obj._container.style.position = 'absolute';
					
					if(!'zIndex' in node) node['zIndex'] = utils.getIndexLayer(id) + node['zIndexOffset'];
					utils.bringToDepth(node, node['zIndex']);
					if(node['shiftY']) node['shiftY']();
					if(!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -84 && attr.bounds.max.x > 179 && attr.bounds.max.y > 84)) {
						delete obj.options['bounds'];
						obj.options.continuousWorld = true;
					}
					else {
						obj.options['bounds'] = new L.LatLngBounds([new L.LatLng(attr['bounds'].min.y, attr['bounds'].min.x), new L.LatLng(attr['bounds'].max.y, attr['bounds'].max.x)]);
					}
				}
			};
			var createLayer = function() {			// инициализация leaflet слоя
				if(!gmxNode) {
					gmxNode = gmxAPI.mapNodes[id];
					chkInitListeners();
				}
				var option = {
					'minZoom': 1
					,'maxZoom': 23
					,'minZ': inpAttr['minZoom'] || attr['minZoom'] || 1
					,'maxZ': inpAttr['maxZoom'] || attr['maxZoom'] || 21
					,'zIndex': node['zIndex']
					,'initCallback': initCallback
					,'tileFunc': inpAttr['func']
					,'attr': attr
					,'_needLoadTile': 0
					,'nodeID': id
					,'async': true
					,'unloadInvisibleTiles': true
					,'countInvisibleTiles': (L.Browser.mobile ? 0 : 2)
				};
				if(gmxNode.properties.type === 'Overlay') {
					node['isOverlay'] = true;
				} else {
					if(gmxNode.isBaseLayer) node['zIndexOffset'] = -100000;
				}
				if(!gmxNode.isBaseLayer && attr['bounds']) {
					option['bounds'] = new L.LatLngBounds([new L.LatLng(attr['bounds'].min.y, attr['bounds'].min.x), new L.LatLng(attr['bounds'].max.y, attr['bounds'].max.x)]);
				} else {
					option['continuousWorld'] = true;
				}

				if(node['subType'] === 'OSM') {
					node['shiftY'] = function() {
						myLayer.options.shiftY = utils.getOSMShift();
					}
					myLayer = new L.TileLayer.OSMcanvas(option);
				} else {
					myLayer = new L.TileLayer.ScanExCanvas(option);
				}
				node['leaflet'] = myLayer;
				var chkPosition = function() {
					chkVisible();
				}
				LMap.on('move', chkPosition);
				LMap.on('zoomend', chkPosition);
				chkVisible();
			}

			var createLayerTimer = null;										// Таймер
			var waitCreateLayer = function()	{								// Требуется перерисовка слоя с задержкой
				if(createLayerTimer) clearTimeout(createLayerTimer);
				createLayerTimer = setTimeout(function()
				{
					createLayerTimer = null;
					if(gmxAPI.map.needMove) {
						waitCreateLayer();
						return;
					}
					createLayer();
				}, 200);
			}
			if(gmxAPI.map.needMove) {
				waitCreateLayer();
			} else {
				createLayer();
			}
		}

		var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI
		var onLayerEventID = gmxNode.addListener('onLayer', function(obj) {	// Слой инициализирован
			gmxNode.removeListener('onLayer', onLayerEventID);
			gmxNode = obj;
			chkInitListeners();
		});
		if(node.isVisible && gmxNode && gmxNode.isVisible) chkInitListeners();
		
		return out;
	}
	// инициализация
	function init(arr)	{
		LMap = gmxAPI._leaflet['LMap'];
		utils = gmxAPI._leaflet['utils'];
		mapNodes = gmxAPI._leaflet['mapNodes'];

		function drawCanvasPolygon( ctx, x, y, lgeo, shiftY) {
			if(!lgeo) return;
			var tileSize = gmxAPI._leaflet['zoomCurrent']['tileSize'];
			//ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
			ctx.beginPath();
			if(!shiftY) shiftY = 0;
			var drawPolygon = function(arr) {
				for (var j = 0; j < arr.length; j++)
				{
					var xx = (arr[j][0] / tileSize - x);
					var yy = (arr[j][1] / tileSize - y);
					var px = 256 * xx;						px = (0.5 + px) << 0;
					var py = 256 * (1 - yy) - shiftY;		py = (0.5 + py) << 0;
					if(j == 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
			}
			for(var i=0; i<lgeo.coordinates.length; i++) {
				var tarr = lgeo.coordinates[i];
				if(lgeo.type === 'MULTIPOLYGON') {
					for (var j = 0, len1 = lgeo.coordinates[i].length; j < len1; j++) {
						drawPolygon(lgeo.coordinates[i][j]);
					}
				} else {
					drawPolygon(lgeo.coordinates[i]);
				}
			}
			ctx.closePath();
			//ctx.stroke();
		}

		var drawTile = function (tile, tilePoint, zoom) {
			var node = mapNodes[tile._layer.options.nodeID];
			if(!zoom) zoom = LMap.getZoom();
			if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
			var pz = Math.pow(2, zoom);
			var tx = tilePoint.x;
			if(tx < 0) tx += pz;
			var scanexTilePoint = {
				'x': (tx % pz - pz/2) % pz
				,'y': -tilePoint.y - 1 + pz/2
			};
			var tileKey = tilePoint.x + ':' + tilePoint.y;
			var drawTileID = zoom + '_' + scanexTilePoint.x + '_' + scanexTilePoint.y;
			var layer = this;
			var chkDrawn = function() {
				if(layer.options._needLoadTile < 1) {
					delete gmxAPI._leaflet['renderingObjects'][layer.options.nodeID];
					utils.waitChkIdle(0, 'RasterLayer ' + layer._animating);					// Проверка отрисовки карты
				}
			}
			var deleteTile = function () {
				if('_resetLoad' in tile) tile._resetLoad();
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;
				layer._removeTile(tileKey);
				chkDrawn();
			}
			if(node['failedTiles'][drawTileID]) {
				if(this.options.bounds) {
					deleteTile();
				}
				return;		// второй раз 404 тайл не запрашиваем
			}
			tile.id = 't' + drawTileID;
			var attr = this.options.attr;
			var ctx = null;
			var flagAll = false;
			var flagAllCanvas = false;
			var shiftY = (this.options.shiftY ? this.options.shiftY : 0);		// Сдвиг для OSM
			if(shiftY !== 0) {
				// сдвиг для OSM
				var tilePos = tile._leaflet_pos;
				tilePos.y += shiftY;
				L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
			}

			if(!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -85 && attr.bounds.max.x > 179 && attr.bounds.max.y > 85)) {
				flagAll = true;
			}
			if(gmxAPI.isMobile) tile.style.webkitTransform += ' scale3d(1.003, 1.003, 1)';
			//		ctx.webkitImageSmoothingEnabled = false;
			var src = this.options.tileFunc(scanexTilePoint.x, scanexTilePoint.y, zoom);
			gmxAPI._leaflet['renderingObjects'][this.options.nodeID] = 1;
			layer.options._needLoadTile++;
			if(flagAll) {
				tile.onload = function() {
					tile.id = drawTileID;
					layer.tileDrawn(tile);
					layer.options._needLoadTile--;
					chkDrawn();
				};
				tile.onerror = function() {
					node['failedTiles'][drawTileID] = true;
					layer.options._needLoadTile--;
					chkDrawn();
				};
				tile.src = src;
			} else {
				var pResArr = null;				// точки границ растрового слоя
				pResArr = attr.mercGeom;

				var me = this;
				(function(points, sTilePoint, pTile) {
					var tID = drawTileID;
					var item = {
						'src': src
						,'zoom': zoom
						,'callback': function(imageObj) {
							pTile.id = tID;
							pTile.width = pTile.height = layer.options.tileSize;
							ctx = pTile.getContext('2d');
							var pattern = ctx.createPattern(imageObj, "no-repeat");
							ctx.fillStyle = pattern;
							if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
							if(pResArr) drawCanvasPolygon( ctx, sTilePoint.x, sTilePoint.y, pResArr, layer.options.shiftY);
							else ctx.fillRect(0, 0, 256, 256);
							ctx.fill();
							imageObj = null;
							layer.tileDrawn(pTile, 1);
							layer.options._needLoadTile--;
							chkDrawn();
						}
						,'onerror': function(){
							node['failedTiles'][tID] = true;
							pTile.id = tID + '_bad';
							layer.options._needLoadTile--;
							chkDrawn();
						}
					};
					pTile._resetLoad = function() {
						item.callback = L.Util.falseFn;
						item.onerror = L.Util.falseFn;
					};
					var gmxNode = gmxAPI.mapNodes[layer.options.nodeID];
					if(gmxNode && gmxNode.isBaseLayer) gmxAPI._leaflet['imageLoader'].unshift(item);	// базовые подложки вне очереди
					else gmxAPI._leaflet['imageLoader'].push(item);
				})(pResArr, scanexTilePoint, tile);
			}
		}
		var update = function () {
			if (!this._map) {
				var node = mapNodes[this.options.nodeID];
				node.waitRedraw();
				return;
			}

			var zoom = this._map.getZoom();
			if (zoom > this.options.maxZ || zoom < this.options.minZ) {
				delete gmxAPI._leaflet['renderingObjects'][this.options.nodeID];
				return;
			}
			if('initCallback' in this.options) this.options.initCallback(this);
			var bounds   = this._map.getPixelBounds(),
				tileSize = this.options.tileSize;

			var shiftY = (this.options.shiftY ? this.options.shiftY : 0);		// Сдвиг для OSM
			bounds.min.y -= shiftY;
			bounds.max.y -= shiftY;

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
			if(this.options._needLoadTile < 1) delete gmxAPI._leaflet['renderingObjects'][this.options.nodeID];
		}

		// Растровый слой с маской
		L.TileLayer.ScanExCanvas = L.TileLayer.Canvas.extend(
		{
			_initContainer: function () {
				L.TileLayer.Canvas.prototype._initContainer.call(this);
			}
			,
			_createTileProto: function () {
				var attr = this.options.attr;
				if(!attr['bounds']) {
					var node = mapNodes[this.options.nodeID];
					node['getLayerBounds']();
				}
				var imgFlag = (!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -85 && attr.bounds.max.x > 179 && attr.bounds.max.y > 85));
				if(imgFlag) {
					var img = this._canvasProto = L.DomUtil.create('img', 'leaflet-tile');
					//img.style.width = img.style.height = this.options.tileSize + 'px';
					//img.galleryimg = 'no';
				} else {
					var proto = this._canvasProto = L.DomUtil.create('canvas', 'leaflet-tile');
					proto.width = proto.height = 0;
				}
			}
			,'_update': update
			,'drawTile': drawTile
			,
			_clearBgBuffer: function () {
				if(!this._map || !this._bgBuffer) return;	// OriginalSin
				L.TileLayer.Canvas.prototype._clearBgBuffer.call(this);
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
			,
			tileDrawn: function (tile, cnt) {				// cnt = количество отрисованных обьектов в тайле
				this._tileOnLoad.call(tile);
				tile._tileComplete = true;					// Added by OriginalSin
				tile._needRemove = (cnt > 0 ? false : true);
			}
			,
			_reset: function (e) {
				var tiles = this._tiles;

				for (var key in tiles) {
					var tile = tiles[key];
					if('_resetLoad' in tile) tile._resetLoad();
					tile.onload = L.Util.falseFn;
					tile.onerror = L.Util.falseFn;
					this.fire('tileunload', {tile: tile});
				}

				this._tiles = {};
				this._tilesToLoad = 0;
				this.options._needLoadTile = 0;
				if (this.options.reuseTiles) {
					this._unusedTiles = [];
				}

				this._tileContainer.innerHTML = "";

				if (this._animated && e && e.hard) {
					this._clearBgBuffer();
				}

				this._initContainer();
			}
			,
			_removeTile: function (key) {
				var tile = this._tiles[key];

				this.fire("tileunload", {tile: tile, url: tile.src});

				if (this.options.reuseTiles) {
					L.DomUtil.removeClass(tile, 'leaflet-tile-loaded');
					this._unusedTiles.push(tile);

				} else if (tile.parentNode === this._tileContainer) {
					this._tileContainer.removeChild(tile);
				}

				// for https://github.com/CloudMade/Leaflet/issues/137
				if (!L.Browser.android) {
					if('_resetLoad' in tile) tile._resetLoad();
					tile.onload = L.Util.falseFn;
					tile.onerror = L.Util.falseFn;
					tile.src = L.Util.emptyImageUrl;
				}

				delete this._tiles[key];
			}
		});

		// Растровый для OSM
		L.TileLayer.OSMcanvas = L.TileLayer.ScanExCanvas;
	}
		
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['setBackgroundTiles'] = setBackgroundTiles;				// Добавить растровый слой
})();
