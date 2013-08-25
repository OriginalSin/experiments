var gmxAPIutils = {
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
    tileSizes: [] // Размеры тайла по zoom
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
		return gmxTilePoint;
	}
	,
    //TODO: use L.Bounds? test performance?
	'bounds': function(arr) {							// получить bounds массива точек
		var res = {
			min: {
				x: Number.MAX_VALUE,
                y: Number.MAX_VALUE
			},
			max: {
				x: -Number.MAX_VALUE,
                y: -Number.MAX_VALUE
			},
			extend: function(x, y) {
				if (x < this.min.x) this.min.x = x;
				if (x > this.max.x) this.max.x = x;
				if (y < this.min.y) this.min.y = y;
				if (y > this.max.y) this.max.y = y;
			},
			extendArray: function(arr) {
                if (!arr) { return this };
				for(var i=0, len=arr.length; i<len; i++) {
					this.extend(arr[i][0], arr[i][1]);
				}
                return this;
			},
			intersects: function (bounds) { // (Bounds) -> Boolean
				var min = this.min,
					max = this.max,
					min2 = bounds.min,
					max2 = bounds.max;
				return max2.x >= min.x && min2.x <= max.x && max2.y >= min.y && min2.y <= max.y;
			}
		};
        
		return res.extendArray(arr);
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
		return gmxAPIutils.bounds(arr);
	}
	,'dec2rgba': function(i, a)	{				// convert decimal to rgb
		var r = (i >> 16) & 255;
		var g = (i >> 8) & 255;
		var b = i & 255;
		return 'rgba('+r+', '+g+', '+b+', '+a+')';
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
				var tile = ph['tilesAll'][key].tile;
				var d = tile.d;
				var s = tile.s;
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
		return res;
	}
	,
    'isTileKeysIntersects': function(tk1, tk2) { // пересечение по номерам двух тайлов
        if (tk1.z < tk2.z) {
            var t = tk1; tk1 = tk2; tk2 = t;
        }
        
        var dz = tk1.z - tk2.z
        return tk1.x >> dz === tk2.x && tk1.y >> dz === tk2.y;
	}
	,
	'updateItemsFromTile': function(gmx, tile) { // парсинг загруженного тайла
		var gmxTileKey = tile.gmxTileKey;
		var items = gmx.attr.items;
		var layerProp = gmx.properties;
		var identityField = layerProp.identityField || 'ogc_fid';
		var data = tile.data;
		for (var i = 0, len = data.length; i < len; i++) {
			var it = data[i];
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
					,'type': geom.type
					,'properties': prop
					,'propHiden': {
						'fromTiles': {}
					}
				};
				items[id] = item;
			}
			item['propHiden']['fromTiles'][gmxTileKey] = true;
			if(layerProp.TemporalColumnName) {
				var zn = prop[layerProp.TemporalColumnName] || '';
				zn = zn.replace(/(\d+)\.(\d+)\.(\d+)/g, '$2/$3/$1');
				var vDate = new Date(zn);
				var offset = vDate.getTimezoneOffset();
				var dt = Math.floor(vDate.getTime() / 1000  - offset*60);
				item['propHiden']['unixTimeStamp'] = dt;
			}
		}
		
		return data.length;
	}
	,
	'polygonToCanvas': function(attr) {				// Полигон в canvas
		var gmx = attr['gmx'];
		var coords = attr['coords'];
		var hiddenLines = attr['hiddenLines'];
		var bgImage = attr['bgImage'];
		var ctx = attr['ctx'];
		var style = attr['style'];
		for (var key in style) ctx[key] = style[key];
        
		var mInPixel = gmx['mInPixel'];
		var tpx = attr['tpx'];
		var tpy = attr['tpy'];
		var toPixels = function(p) {				// получить координату в px
			var px1 = p[0] * mInPixel - tpx; 	px1 = (0.5 + px1) << 0;
			var py1 = tpy - p[1] * mInPixel;	py1 = (0.5 + py1) << 0;
			return [px1, py1];
		}
		var arr = [];
		var lastX = null, lastY = null, prev = null, cntHide = 0;
		if(style.strokeStyle) {
			ctx.beginPath();
			for (var i = 0, len = coords.length; i < len; i++) {
				var lineIsOnEdge = false;
				if(i == hiddenLines[cntHide]) {
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

		if(style.fillStyle || bgImage) {
			if(bgImage) {
				var pattern = ctx.createPattern(bgImage, "no-repeat");
				ctx.fillStyle = pattern;
			}
			ctx.beginPath();
			//ctx.globalAlpha = 0;
			for (var i = 0, len = arr.length; i < len; i++) {
				var p1 = arr[i];
				if(!style.strokeStyle) p1 = toPixels(p1);
				if(i == 0)	ctx.moveTo(p1[0], p1[1]);
				else		ctx.lineTo(p1[0], p1[1]);
			}
			//ctx.globalAlpha = 1;
			ctx.fill();
			//ctx.clip();
		}
	}
	,
	'getTileRasters': function(attr, callback) {	// Получить растры КР для тайла
		var gmx = attr.gmx;
		var gmxTilePoint = attr['gmxTilePoint'];
		var needLoadRasters = 0;
		var chkReadyRasters = function() {
			needLoadRasters--;
			if(needLoadRasters === 0) {
				callback(attr, needLoadRasters);
			}
		}
		for (var i = 0, len = gmxTilePoint['items'].length; i < len; i++) {
			var it = gmxTilePoint['items'][i];
			if(!gmxTilePoint['rasters']) gmxTilePoint['rasters'] = {};
			needLoadRasters++;
			(function() {
				var idr = it.id;
				var rasters = gmxTilePoint['rasters'];
				gmxImageLoader.push({
					'callback' : function(img) {
						rasters[idr] = img;
						chkReadyRasters();
					}
					,'onerror' : function() {
						chkReadyRasters();
					}
					,'src': gmx.attr['rasterBGfunc'](gmxTilePoint['x'], gmxTilePoint['y'], attr['zoom'], idr)
				});
			})();
		}
	}
	,'r_major': 6378137.000
	,'y_ex': function(lat)	{				// Вычисление y_ex 
		if (lat > 89.5)		lat = 89.5;
		if (lat < -89.5) 	lat = -89.5;
		var phi = gmxAPIutils.deg_rad(lat);
		var ts = Math.tan(0.5*((Math.PI*0.5) - phi));
		var y = -gmxAPIutils.r_major * Math.log(ts);
		return y;
	}	
	,
	deg_rad: function(ang)
	{
		return ang * (Math.PI/180.0);
	},
    
    //x, y, z - GeoMixer tile coordinates
    getTileBounds: function(x, y, z) {
        var tileSize = gmxAPIutils.tileSizes[z],
            minx = x * tileSize, 
            miny = y * tileSize;
            
        return gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]]);
    }
}

!function() {
    //pre-calculate tile sizes
    for (var z = 0; z < 30; z++) {
        gmxAPIutils.tileSizes[z] = 40075016.685578496 / Math.pow(2, z);
    }
}()