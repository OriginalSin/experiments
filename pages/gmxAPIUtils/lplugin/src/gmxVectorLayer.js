// Плагин векторного слоя
L.TileLayer.gmxVectorLayer = L.TileLayer.Canvas.extend(
{
    initialize: function(options) {
        options = L.setOptions(this, options);
		if(!options.attribution) options.attribution = '&copy; <a href="http://maps.kosmosnimki.ru/Apikey/License.html">«СканЭкс»</a>'
        
        this._gmx = {
            'hostName': options.hostName || 'maps.kosmosnimki.ru'
            ,'mapName': options.mapName
            ,'layerName': options.layerName
            ,'beginDate': options.beginDate
            ,'endDate': options.endDate
            ,'sortItems': options.sortItems || function(a, b) { return Number(a.id) - Number(b.id); }
        };
        
        var apikeyRequestHost = options.apikeyRequestHost || this._gmx.hostName;
        var myLayer = this;
        
        var getLayer = function(arr) {
            for(var i=0, len=arr.length; i<len; i++) {
                var layer = arr[i];
                if(layer.type === 'layer' && myLayer._gmx.layerName === layer.content.properties.name) {
                    var ph = layer['content'];
                    myLayer._gmx.properties = ph['properties'];
                    myLayer._gmx.geometry = ph['geometry'];
                    myLayer._gmx.attr = myLayer.initLayerData(ph);
                    myLayer._gmx.vectorTilesManager = new gmxVectorTilesManager(myLayer._gmx, ph);
                    myLayer._update();
                    return;
                }
            }
        }
        
        var setSessionKey = function(sk) {
            myLayer._gmx.tileSenderPrefix = "http://" + myLayer._gmx.hostName + "/" + 
                "TileSender.ashx?WrapStyle=None" + 
                "&key=" + encodeURIComponent(sk);
        }
        
        //TODO: move to onAdd()?
        gmxMapManager.getMap(apikeyRequestHost, options.apiKey, this._gmx.mapName).done(
            function(ph) {
                setSessionKey(gmxSessionManager.getSessionKey(apikeyRequestHost)); //should be already received
                getLayer(ph.children);
            },
            function(ph) {
                console.log('Error: ' + myLayer._gmx.mapName + ' - ' + ph.error);
            }
        );
    },
        
    onAdd: function(map) {
        L.TileLayer.Canvas.prototype.onAdd.call(this, map);
                
        map.on('zoomstart', function(e) {
            this._gmx['zoomstart'] = true;
        }, this);
        
        map.on('zoomend', function(e) {
            this._gmx['zoomstart'] = false;
            this._prpZoomData(map._zoom);
            this._update();
        }, this);
    },
    //public interface
	setFilter: function (func) {
		this._gmx.chkVisibility = func;
		//this._reset();
        
        //this._updateDrawnTiles(false);
		this._update(true);
	}
	,
	setDateInterval: function (beginDate, endDate) {
        var gmx = this._gmx;
		var options = this.options;
		gmx.beginDate = beginDate;
		gmx.endDate = endDate;
		if(gmx.attr.itemCount > 1000) {
			for (var key in gmx.attr['tilesNeedLoad']) {
                gmx.attr['tilesAll'][key].tile.clear();
			}
			gmx.attr.itemCount = 0;
		}
		gmx.attr.tilesNeedLoad = gmxAPIutils.getNeedTiles(gmx.attr, gmx.beginDate, gmx.endDate).tilesNeedLoad;
        
        //this._updateDrawnTiles(true);
        //this._reset();
		this._gmx['reloadTiles1'] = true;
		this._update();
	},
    
    addTo: function (map) {
		map.addLayer(this);
		return this;
	},
    
    _updateDrawnTiles: function(reloadTiles) {
        for (var key in this._tiles) {
            var kArr = key.split(':'),
                x = parseInt(kArr[0], 10),
                y = parseInt(kArr[1], 10),
                tilePoint = L.point(x, y),
                gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, this._map._zoom);
                
            var cntToLoad = 0;
            if (reloadTiles) {
				cntToLoad = this._gmx.vectorTilesManager.loadTiles(gmxTilePoint);
            }
            if (cntToLoad === 0) {
                this.gmxDrawTile(tilePoint, this._map._zoom);
            }
        }
    },
    
    _prpZoomData: function(zoom) {
        var gmx = this._gmx,
            map = this._map;
        gmx.tileSize = gmxAPIutils.tileSizes[zoom];
        gmx.mInPixel = 256 / gmx.tileSize;
        gmx._tilesToLoad = 0;
        // Получение сдвига OSM
        var pos = map.getCenter();
        var lat = L.Projection.Mercator.unproject({x: 0, y: gmxAPIutils.y_ex(pos.lat)}).lat;
        var p1 = map.project(new L.LatLng(lat, pos.lng), map._zoom);
        var point = map.project(pos);
        gmx.shiftY = point.y - p1.y;
        //console.log(gmx.shiftY);
    },
    
	_initContainer: function () {
		L.TileLayer.Canvas.prototype._initContainer.call(this);
		this._prpZoomData(this._map._zoom);
	}
	,
	_update: function () {
		if(this._gmx['zoomstart']) return; //TODO: buggy restriction?

		var bounds = this._map.getPixelBounds(),
		    zoom = this._map.getZoom(),
		    tileSize = this.options.tileSize;

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			clearTimeout(this._clearBgBufferTimer);
			this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
			return;
		}

		var shiftY = this._gmx.shiftY || 0;		// Сдвиг к OSM
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
		this._gmx['reloadTiles1'] = false;
	}
	,
	_addTilesFromCenterOut: function (bounds) {
		var queue = [],
		    center = bounds.getCenter();

		var j, i, point;

		for (j = bounds.min.y; j <= bounds.max.y; j++) {
			for (i = bounds.min.x; i <= bounds.max.x; i++) {
				point = new L.Point(i, j);

				if (this._tileShouldBeLoaded(point)) {
					queue.push(point);
/*					
				} else {
					if (this._gmx['reloadTiles1']) {
						var tkey = point.x + ':' + point.y;
						if(tkey in this._tiles) this._removeTile(tkey);
					}
*/
				}
			}
		}

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

this._gmx['needDrawCount'] = 0;
		for (i = 0; i < tilesToLoad; i++) {
			this._addTile(queue[i], fragment);
		}
		this._tileContainer.appendChild(fragment);
	}
	,
	_addTile: function (tilePoint, container) {
		var myLayer = this, 
            zoom = this._map._zoom,
            gmx = this._gmx;
            
		if (!gmx.attr) return;
        
		if (!gmx.attr.tilesNeedLoad) {
			var res = gmxAPIutils.getNeedTiles(gmx.attr, gmx.beginDate, gmx.endDate);
			gmx.attr.tilesNeedLoad = res.tilesNeedLoad;
		}
        
 		var gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom);

		if (gmx.vectorTilesManager.on(gmxTilePoint, function() {
				myLayer.gmxDrawTile(tilePoint, zoom);
			}) ){
this._gmx['needDrawCount']++;

			if(gmx.vectorTilesManager.loadTiles(gmxTilePoint) === 0) {
				this.gmxDrawTile(tilePoint, zoom);
			}
		} else {
			//var tkey = tilePoint.x + ':' + tilePoint.y;
			//if(tkey in this._tiles) this._removeTile(tkey);
		}
	}
	,
	gmxDrawTile: function (tilePoint, zoom) {
		var gmx = this._gmx;
		//gmx._tilesToLoad--;
		if(gmx['zoomstart']) return;

        var screenTile = new gmxScreenVectorTile(gmx, tilePoint, zoom);
        var style = gmx.attr.styles[0];
        screenTile.drawTile(this, style);
	}
	,
	gmxGetCanvasTile: function (tilePoint) {
		var tKey = tilePoint.x + ':' + tilePoint.y;

        if (tKey in this._tiles) {
            return this._tiles[tKey];
        }
        
		var tile = this._getTile();
		tile.id = tKey;
		tile._layer = this;
		tile._tileComplete = true;
		tile._tilePoint = tilePoint;
		this._tiles[tKey] = tile;
		this._tileContainer.appendChild(tile);

		var tilePos = this._getTilePos(tilePoint);
		var shiftY = this._gmx.shiftY || 0;		// Сдвиг к OSM
		tilePos.y -= shiftY;
		L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
		this.tileDrawn(tile);
		return this._tiles[tKey];
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
		if (this._gmx._tilesToLoad < 1) {
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
	},
    initLayerData: function(layerDescription) {					// построение списка тайлов
        var gmx = this._gmx,
            res = {'tilesAll':{}, 'items':{}, 'tileCount':0, 'itemCount':0},
            prop = layerDescription.properties,
            geom = layerDescription.geometry,
            type = prop['type'] + (prop['Temporal'] ? 'Temporal' : '');

		var defaultStyle = {lineWidth: 1, strokeStyle: 'rgba(0, 0, 255, 1)'};
		var styles = [];
		if(prop.styles) {
			for (var i = 0, len = prop['styles'].length; i < len; i++)
			{
				var it = prop['styles'][i];
				var pt = {};
				var renderStyle = it['RenderStyle'];
				if(renderStyle['outline']) {
					var outline = renderStyle['outline'];
					pt['lineWidth'] = outline.thickness || 0;
					var color = outline.color || 255;
					var opacity = ('opacity' in outline ? outline['opacity']/100 : 1);
					pt['strokeStyle'] = gmxAPIutils.dec2rgba(color, opacity);
				}
				if(renderStyle['fill']) {
					var fill = renderStyle.fill;
					var color = fill.color || 255;
					var opacity = ('opacity' in fill ? fill['opacity']/100 : 1);
					pt['fillStyle'] = gmxAPIutils.dec2rgba(color, opacity);
				}
				styles.push(pt);
			}
		} else {
            styles.push(defaultStyle);
        }
		res.styles = styles;

		var addRes = function(z, x, y, v, s, d) {
            var tile = new gmxVectorTile(gmx, x, y, z, v, s, d);
			res.tilesAll[tile.gmxTileKey] = {tile: tile};
		}
		var cnt;
		var arr = prop['tiles'] || [];
		var vers = prop['tilesVers'] || [];
		if(type === 'VectorTemporal') {
			arr = prop['TemporalTiles'];
			vers = prop['TemporalVers'];
			for (var i = 0, len = arr.length; i < len; i++)
			{
				var arr1 = arr[i];
				var z = Number(arr1[4])
					,y = Number(arr1[3])
					,x = Number(arr1[2])
					,s = Number(arr1[1])
					,d = Number(arr1[0])
					,v = Number(vers[i])
				;
				addRes(z, x, y, v, s, d);
			}
            cnt = arr.length;
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
			for (var i = 0, cnt = 0, len = arr.length; i < len; i+=3, cnt++) {
				addRes(Number(arr[i+2]), Number(arr[i]), Number(arr[i+1]), Number(vers[cnt]), -1, -1);
			}
		}
		res['tileCount'] = cnt;
		res['layerType'] = type;						// VectorTemporal Vector
		res['identityField'] = prop['identityField'];	// ogc_fid
		res['GeometryType'] = prop['GeometryType'];		// тип геометрий обьектов в слое
		if(prop['IsRasterCatalog']) {
			res['rasterBGfunc'] = function(x, y, z, idr) {
				return 'http://' + gmx.hostName
					+'/TileSender.ashx?ModeKey=tile'
					+'&x=' + x
					+'&y=' + y
					+'&z=' + z
					+'&idr=' + idr
					+'&MapName=' + gmx.mapName
					+'&LayerName=' + gmx.layerName
					+'&key=' + encodeURIComponent(gmx.sessionKey);
			};
		}
		return res;
	}
});