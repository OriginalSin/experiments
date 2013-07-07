// Quicklooks
(function()
{
	//FlashMapObject.prototype.enableQuicklooks = function(callback)
	var enableQuicklooks = function(callback)
	{
		var flag = true;

		var shownQuicklooks = {};
		var removeQuicklooks = function()
		{
			for (var id in shownQuicklooks) {
				shownQuicklooks[id].remove();
				delete shownQuicklooks[id];
			}
		}
		if (this.shownQuicklooks) removeQuicklooks();

		this.removeQuicklooks = removeQuicklooks;
		this.shownQuicklooks = shownQuicklooks;

		this.addListener('onClick', function(o)
		{
			try {
				var identityField = gmxAPI.getIdentityField(o.obj);
				var id = 'id_' + o.obj.properties[identityField];
				if (!shownQuicklooks[id])
				{
					var url = callback(o.obj);
					var d1 = 100000000;
					var d2 = 100000000;
					var d3 = 100000000;
					var d4 = 100000000;
					var x1, y1, x2, y2, x3, y3, x4, y4;
					var geom = o.attr.geom;
					var coord = geom.coordinates;
					gmxAPI.forEachPoint(coord, function(p)
					{
						var x = gmxAPI.merc_x(p[0]);
						var y = gmxAPI.merc_y(p[1]);
						if ((x - y) < d1)
						{
							d1 = x - y;
							x1 = p[0];
							y1 = p[1];
						}
						if ((-x - y) < d2)
						{
							d2 = -x - y;
							x2 = p[0];
							y2 = p[1];
						}
						if ((-x + y) < d3)
						{
							d3 = -x + y;
							x3 = p[0];
							y3 = p[1];
						}
						if ((x + y) < d4)
						{
							d4 = x + y;
							x4 = p[0];
							y4 = p[1];
						}
					});

					var q = o.obj.addObject(null, o.obj.properties);
					shownQuicklooks[id] = q;
					q.setStyle({ fill: { opacity: 10 } });
					q.setImage(url, x1, y1, x2, y2, x3, y3, x4, y4);
				}
				else
				{
					shownQuicklooks[id].remove();
					delete shownQuicklooks[id];
				}
			} catch (e) {
				gmxAPI.addDebugWarnings({'func': 'enableQuicklooks', 'handler': 'onClick', 'event': e, 'alert': e});
			}
		}, -5);
	}

	var enableTiledQuicklooks = function(callback, minZoom, maxZoom, tileSenderPrefix)
	{
		var id = this.objectId || this.id;
		var node = gmxAPI._leaflet['mapNodes'][id];
		var gmxNode = gmxAPI['mapNodes'][id];
		
		var func = function(i, j, z, geom)
		{
			var path = callback(geom);
			if (geom.boundsType && i < 0) i = -i;
			if (path.indexOf("{") >= 0){
				return path.replace(new RegExp("{x}", "gi"), i).replace(new RegExp("{y}", "gi"), j).replace(new RegExp("{z}", "gi"), z).replace(new RegExp("{key}", "gi"), encodeURIComponent(window.KOSMOSNIMKI_SESSION_KEY));
			}
			else{
				return path + z + "/" + i + "/" + z + "_" + i + "_" + j + ".jpg";
			}
		};

		node.setTiledQuicklooks(func, minZoom, maxZoom, tileSenderPrefix);
		gmxNode.tilesParent = gmxNode.addObject(null, null, {'subType': 'tilesParent'});
		gmxNode.tilesParent.clearItems  = function()
		{
		}
		return;
	}

	var enableTiledQuicklooksEx = function(callback, minZoom, maxZoom)
	{
		var node = gmxAPI._leaflet['mapNodes'][this.objectId];
		var gmxNode = gmxAPI['mapNodes'][this.objectId];

		if(!minZoom) minZoom = 1;
		if(!maxZoom) maxZoom = 18;
		
		var images = {};	// mapObject по обьектам векторного слоя
		var propsArray = [];

		var tilesParent = gmxNode.addObject(null, null, {'subType': 'tilesParent'});
		//node['minZ'] = minZoom;
		//node['maxZ'] = maxZoom;
		tilesParent.setZoomBounds(minZoom, maxZoom);
		gmxNode.tilesParent = tilesParent;
		tilesParent.clearItems  = function()
		{
			for(id in images) {
				images[id].remove();
			}
			images = {};
		}
		
		tilesParent.observeVectorLayer(this, function(arr)
		{
			for (var j = 0; j < arr.length; j++)
			{
				var o = arr[j].item;
				var flag = arr[j].onExtent;
				var identityField = gmxAPI.getIdentityField(tilesParent);
				var id = 'id_' + o.properties[identityField];
				var ret = false;
				if (flag && !images[id])
				{
					var image = tilesParent.addObject(o.geometry, o.properties);
					callback(o, image);
					images[id] = image;
					propsArray.push(o.properties);
					ret = true;
				}
				else if (!flag && images[id])
				{
					images[id].remove();
					delete images[id];
					for (var i = 0; i < propsArray.length; i++)
					{
						if (propsArray[i][identityField] == o.properties[identityField])
						{
							propsArray.splice(i, 1);
							break;
						}
					}
					ret = true;
				}
			}
			return ret;
		});
		return;
	}

	//расширяем FlashMapObject
	gmxAPI._listeners.addListener({'eventName': 'mapInit', 'func': function(map) {
			gmxAPI.extendFMO('observeVectorLayer', function(obj, onChange, asArray, ignoreVisibilityFilter) { obj.addObserver(this, onChange, asArray, ignoreVisibilityFilter); } );
			gmxAPI.extendFMO('enableTiledQuicklooksEx', enableTiledQuicklooksEx);
			gmxAPI.extendFMO('enableTiledQuicklooks', enableTiledQuicklooks);
			gmxAPI.extendFMO('enableQuicklooks', enableQuicklooks);
		}
	});
})();
