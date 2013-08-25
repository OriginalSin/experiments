//Single vector tile, received from GeoMixer server
var gmxVectorTilesManager = function(gmx, layerDescription) {
    var subscriptions = {},
        freeSubscrID = 0,
        tiles = {},
        tilesToUse = {};
        
    //init tiles
    var props = layerDescription.properties,
        arr, vers;
        
    if (props.Temporal) {
        arr = props.TemporalTiles;
        vers = props.TemporalVers;
        
        for (var i = 0, len = arr.length; i < len; i++) {
            var arr1 = arr[i];
            var z = Number(arr1[4]),
                y = Number(arr1[3]),
                x = Number(arr1[2]),
                s = Number(arr1[1]),
                d = Number(arr1[0]),
                v = Number(vers[i]),
                tile = new gmxVectorTile(gmx, x, y, z, v, s, d);
                
            tiles[tile.gmxTileKey] = tile;
        }
    } else {
        arr = props.tiles;
		vers = props.tilesVers;
        for (var i = 0, cnt = 0, len = arr.length; i < len; i+=3, cnt++) {
            var tile = new gmxVectorTile(gmx, Number(arr[i]), Number(arr[i+1]), Number(arr[i+2]), Number(vers[cnt]), -1, -1);
            tiles[tile.gmxTileKey] = tile;
        }
    }
/*
    this.getNotLoadedTileCount = function(gmxTilePoint) {
        var count = 0;
        for (var key in gmx.attr.tilesNeedLoad) {
            var tile = tiles[key];
            if (tile.isIntersects(gmxTilePoint) && tile.state !== 'loaded') {
                count++;
            }
        }
        return count;
    }
*/    

    this.loadTiles = function(gmxTilePoint) {
        var cnt = 0;
        for (var key in gmx.attr['tilesNeedLoad']) (function(tile) {
        
			if (!tile.isIntersects(gmxTilePoint)) return;
            if (tile.state !== 'loaded') cnt++;
         
            if (tile.state === 'notLoaded') {
				tile.load().done(function() {
                    gmx.attr.itemCount += gmxAPIutils.updateItemsFromTile(gmx, tile);
                    for (var key in subscriptions) {
                        if (tile.isIntersects(subscriptions[key].tilePoint)) {
                            subscriptions[key].callback(cnt);
                        }
                    }
                })
            }
		})(tiles[key]);
        
        return cnt;
    }

    var isExistsIntersectsTiles = function(gmxTilePoint) {
        for (var key in gmx.attr.tilesNeedLoad) {
            if (tiles[key].isIntersects(gmxTilePoint)) return true;
        }
        return false;
    }

    this.on = function(gmxTilePoint, callback) {
        var id = null;
		if(isExistsIntersectsTiles(gmxTilePoint)) {
			id = 's'+(freeSubscrID++);
			subscriptions[id] = {tilePoint: gmxTilePoint, callback: callback};
		}
        return id;
    }

    this.off = function(id) {
        delete subscriptions[id];
    }

    this.getTile = function(tileKey) {
        return tiles[tileKey];
    }
}