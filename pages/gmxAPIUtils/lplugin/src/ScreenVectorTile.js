//Single tile on screen with vector data
var gmxScreenVectorTile = function(gmx, tilePoint, zoom) {
    
    var showRaster = 'rasterBGfunc' in gmx.attr &&
        (zoom >= gmx.properties.RCMinZoomForRasters || gmx.properties.quicklook);

    var rasters = {},
        gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom),
        bounds = gmxAPIutils.getTileBounds(gmxTilePoint.x, gmxTilePoint.y, gmxTilePoint.z);
    
    //get all items from global item collection, that should be rendered in this tile
    var getTileItems = function() {
        var items = [];
        for (var key in gmx.attr.tilesNeedLoad) {
			//var tile = gmx.attr.tilesAll[key].tile;
            var tile = gmx.vectorTilesManager.getTile(key);
			if (!tile.isIntersects(gmxTilePoint)) {
                continue;
            }
			var data = tile.data || [];
			for (var j = 0, len1 = data.length; j < len1; j++) {
				var it = data[j];
				var item = gmx.attr.items[it.id];
				if(gmx.chkVisibility && !gmx.chkVisibility(item)) {
					continue;
				}
				if(gmx.attr.layerType === 'VectorTemporal') {
					var unixTimeStamp = item.propHiden.unixTimeStamp;
					if(unixTimeStamp < gmx.attr.ut1 || unixTimeStamp > gmx.attr.ut2) {
                        continue;
                    }
				}
                
				if(!it.bounds) {
                    it.bounds = gmxAPIutils.itemBounds(it);
                }
                
				if (!bounds.intersects(it.bounds)) {
                    continue;
                }
                
				tile.calcHiddenPoints();
				items.push(it);
			}
		}
        return items;
    }
    
    //load all missing rasters for items we are going to render
    var getTileRasters = function(items) {	// Получить растры КР для тайла
        var def = new gmxDeferred();
		var needLoadRasters = 0;
		var chkReadyRasters = function() {
			if(needLoadRasters < 1) {
				def.resolve();
			}
		}
        items.forEach(function(it) {
            var idr = it.id;
            if (idr in rasters) return;
			needLoadRasters++;
            gmxImageLoader.push({
                'callback' : function(img) {
                    rasters[idr] = img;
                    needLoadRasters--;
                    chkReadyRasters();
                }
                ,'onerror' : function() {
                    needLoadRasters--;
                    chkReadyRasters();
                }
                ,'src': gmx.attr['rasterBGfunc'](gmxTilePoint.x, gmxTilePoint.y, gmxTilePoint.z, idr)
            });
		})
        chkReadyRasters();
        return def;
	}

    this.drawTile = function(layer, style) {
        var items = getTileItems(); //call each time because of possible items updates
        if(items.length === 0) {
layer._gmx['needDrawCount']--;
console.log(zoom, ' needDrawCount1: ', layer._gmx['needDrawCount'], ' layer: ', layer._leaflet_id);
			return;
		}
		var ctx = layer.gmxGetCanvasTile(tilePoint).getContext('2d'),
            dattr = {
                gmx: gmx,
                style: style,
                tpx: 256 * gmxTilePoint.x,
                tpy: 256 *(1 + gmxTilePoint.y),
                ctx: ctx
            };
            
        items = items.sort(gmx.sortItems);
        
        var doDraw = function() {
            ctx.clearRect(0, 0, 256, 256);
            for (var i = 0, len = items.length; i < len; i++) {
                var it = items[i],
                    idr = it.id;
                    
                if (rasters[idr]) {
                    dattr.bgImage = rasters[idr];
                }

                var geom = it.geometry;
                if (geom.type.indexOf('POLYGON') !== -1) {	// Отрисовка геометрии полигона
                    var coords = geom.coordinates;
                    for (var j = 0, len1 = coords.length; j < len1; j++) {
                        var coords1 = coords[j];
                        dattr.hiddenLines = it.hiddenLines[j];
                        if(geom.type.indexOf('MULTI') !== -1) {
                            for (var j1 = 0, len2 = coords1.length; j1 < len2; j1++) {
                                dattr.coords = coords1[j1];
                                gmxAPIutils.polygonToCanvas(dattr);
                            }
                        } else {
                            dattr.coords = coords1;
                            gmxAPIutils.polygonToCanvas(dattr);
                        }
                    }
                }
            }
layer._gmx['needDrawCount']--;
console.log(zoom, ' needDrawCount: ', layer._gmx['needDrawCount'], ' layer: ', layer._leaflet_id);
        }
        
        if (showRaster) {
            getTileRasters(items).done(doDraw); //first load all raster images, then render all of them at once
        } else {
            doDraw();
        }
    }
}