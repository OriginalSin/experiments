// Quicklooks
(function()
{
	//FlashMapObject.prototype.enableQuicklooks = function(callback)
	var enableQuicklooks = function(callback)
	{
		var flag = true;

		if (this.shownQuicklooks)
			for (var url in this.shownQuicklooks)
				this.shownQuicklooks[url].remove();
		var shownQuicklooks = {};
		this.shownQuicklooks = shownQuicklooks;

		this.addLook = function(o)
		{
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
				var geom = o.obj.getGeometry();
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
				q.setStyle({ fill: { opacity: 100 } });
				q.setImage(url, x1, y1, x2, y2, x3, y3, x4, y4);
			}
			else
			{
				shownQuicklooks[id].remove();
				delete shownQuicklooks[id];
			}
		};

		this.addListener('onClick', this.addLook, -5);
	}

	var enableTiledQuicklooks = function(callback, minZoom, maxZoom, tileSenderPrefix)
	{
		var IsRasterCatalog = this.properties.IsRasterCatalog;
		var identityField = this.properties.identityField;
		this.enableTiledQuicklooksEx(function(o, image)
		{
			var path = callback(o);
			var oBounds = gmxAPI.getBounds(o.geometry.coordinates);
			var boundsType = (oBounds && oBounds.minX < -179.999 && oBounds.maxX > 179.999 ? true : false);
			var func = function(i, j, z) {
				if (boundsType && i < 0) i = -i;
				if (path.indexOf("{") >= 0){
                    return path.replace(new RegExp("{x}", "gi"), i).replace(new RegExp("{y}", "gi"), j).replace(new RegExp("{z}", "gi"), z).replace(new RegExp("{key}", "gi"), encodeURIComponent(window.KOSMOSNIMKI_SESSION_KEY));
				}
				else{
					return path + z + "/" + i + "/" + z + "_" + i + "_" + j + ".jpg";
				}
			};
			if(tileSenderPrefix) {
				var ph = {
					'func': func
					,'projectionCode': 0
					,'minZoom': minZoom
					,'maxZoom': maxZoom
					,'tileSenderPrefix': tileSenderPrefix + (IsRasterCatalog ? '&idr=' + o.properties[identityField] : '')
					,'boundsType': boundsType
					,'quicklooks': true
				};
				gmxAPI._cmdProxy('setBackgroundTiles', {'obj': image, 'attr':ph });
			} else 
			{
				image.setTiles(func);
			}
		}, minZoom, maxZoom);
	}

	var enableTiledQuicklooksEx = function(callback, minZoom, maxZoom)
	{
		if(!minZoom) minZoom = 1;
		if(!maxZoom) maxZoom = 18;
		var images = {};
		if (this.tilesParent)
			this.tilesParent.remove();
		var tilesParent = this.addObject();
		this.tilesParent = tilesParent;
		//gmxAPI._cmdProxy('setAPIProperties', { 'obj': this, 'attr':{'addHiddenFill':true} });	// при отсутствии style.fill дополнить невидимым заполнением - ломает старые проекты
		tilesParent.setZoomBounds(minZoom, maxZoom);
		var propsArray = [];
		tilesParent.clearItems  = function()
		{
			for(id in images) {
				images[id].remove();
			}
			images = {};
			propsArray = [];
		}
			
		tilesParent.setZoomBounds(minZoom, maxZoom);
		tilesParent.observeVectorLayer(this, function(arr)
		{
			var identityField = gmxAPI.getIdentityField(tilesParent);
			for (var j = 0; j < arr.length; j++)
			{
				var o = arr[j].item;
				var flag = (!arr[j].isVisibleFilter ? arr[j].onExtent : false);
				var id = 'id_' + o.properties[identityField];
				if (flag && !images[id])
				{
					var image = tilesParent.addObject(o.geometry, o.properties, {'notRedrawOnDrag':true});
					callback(o, image);
					images[id] = image;
					propsArray.push(o.properties);
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
				}
			}
			return true;
		});
		var me = this;
		this.addListener('onClick', function(o)
		{
			if('obj' in o)  o = o.obj;
			var idt = 'id_' + o.flip();
			var currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
			var curZ = currPos['z'];
			if(images[idt] && curZ >= minZoom && curZ <= maxZoom) images[idt].bringToTop();		// только для zoom со снимками
			gmxAPI._listeners.dispatchEvent('onFlip', me, images[idt]);
			return false;
		}, -5);

		this.bringToTopImage = function(id)			// обьект растрового слоя переместить вверх
		{
			var idt = 'id_' + id;
			if(images[idt]) {
				images[idt].bringToTop();
				return true;
			}
			return false;
		};
	}

	//расширяем FlashMapObject
	gmxAPI._listeners.addListener({'eventName': 'mapInit', 'func': function(map) {
			gmxAPI.extendFMO('observeVectorLayer', function(obj, onChange, attr) { obj.addObserver(this, onChange, attr); } );
			gmxAPI.extendFMO('enableTiledQuicklooksEx', enableTiledQuicklooksEx);
			gmxAPI.extendFMO('enableTiledQuicklooks', enableTiledQuicklooks);
			gmxAPI.extendFMO('enableQuicklooks', enableQuicklooks);
		}
	});
})();
