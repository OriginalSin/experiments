gmxAPIutils = {
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
					c[p] = (level < 10 ? gmxAPIutils.clone(v, level + 1) : 'object');
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
	'getMapPropreties': function(ph, callback)	{		// Получение описания карты
		gmxAPIutils.request({
			'url': ph['tileSenderPrefix'] + '&ModeKey=map'
			,'callback': function(st) {
				callback(JSON.parse(st));
			}
		});
	}
	,
	'getLayerPropreties': function(ph, callback)	{		// Получение описания слоя из описания карты
		var layerName = ph['layerName'];
		gmxAPIutils.getMapPropreties(ph, function(json) {
			if(json) {
				for(var i=0, len=json.children.length; i<len; i++) {
					var layer = json.children[i];
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
				'x': Number.MIN_VALUE
				,'y': Number.MIN_VALUE
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
					max2 = bounds.max,
					xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
					yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

				return xIntersects && yIntersects;
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
	'getTilesBounds': function(arr, vers) {					// получить bounds списка тайлов слоя
		var res = {'tiles':{}, 'tilesVers':{}};
		var cnt = 0;
		for (var i = 0; i < arr.length; i+=3)
		{
			var x = Number(arr[i]) , y = Number(arr[i+1]) , z = Number(arr[i+2]);
			var st = z + '_' + x + '_' + y;
			var tileSize = gmxAPIutils.getTileSize(z);
			var minx = x * tileSize;
			var miny = y * tileSize;
			var bounds = gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]]);
			bounds.gmxTileKey = st;
			bounds.gmxTilePoint = {'z': z, 'x': x, 'y': y};
			res['tiles'][st] = bounds;
		
			if(vers) {
				res['tilesVers'][st] = vers[cnt];
				cnt++;
			}
		}
		return res;
	}
	
}
