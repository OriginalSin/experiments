//Поддержка map
(function()
{
	var addNewMap = function(rootObjectId, layers, callback)
	{
		var map = new gmxAPI._FMO(rootObjectId, {}, null);	// MapObject основной карты
		gmxAPI.map = map;
		gmxAPI.mapNodes[rootObjectId] = map;	// основная карта

		if(!layers.properties) layers.properties = {};
		map.properties = layers.properties;
		if(!layers.children) layers.children = [];
		//map.onSetVisible = {};
		map.isVisible = true;
		map.layers = [];
		map.rasters = map;
		map.tiledQuicklooks = map;
		map.vectors = map;
		map.needMove = {
			'x':	parseFloat(layers.properties.DefaultLong) || 35
			,'y':	parseFloat(layers.properties.DefaultLat) || 50
			,'z':	parseFloat(layers.properties.DefaultZoom) || 4
		};
		map.DistanceUnit = map.properties['DistanceUnit'] || 'auto';
		map.SquareUnit = map.properties['SquareUnit'] || 'auto';
		
		//map.needSetMode = 'Map';
		map.needSetMode = null;

		// Методы присущие только Map
		map.setDistanceUnit = function(attr) { map.DistanceUnit = attr; return true; }
		map.setSquareUnit = function(attr) { map.SquareUnit = attr; return true; }
		map.getDistanceUnit = function() { return map.DistanceUnit; }
		map.getSquareUnit = function() { return map.SquareUnit; }
		map.sendPNG = function(attr) { var ret = gmxAPI._cmdProxy('sendPNG', { 'attr': attr }); return ret; }
		map.savePNG = function(fileName) { gmxAPI._cmdProxy('savePNG', { 'attr': fileName }); }
		map.trace = function(val) { gmxAPI._cmdProxy('trace', { 'attr': val }); }
		map.setQuality = function(val) { gmxAPI._cmdProxy('setQuality', { 'attr': val }); }
		map.disableCaching = function() { gmxAPI._cmdProxy('disableCaching', {}); }
		map.print = function() { gmxAPI._cmdProxy('print', {}); }
		map.repaint = function() { gmxAPI._cmdProxy('repaint', {}); }
		map.moveTo = function(x, y, z) {
			var pos = {'x':x, 'y':y, 'z':z};
			if(gmxAPI.proxyType == 'leaflet' && map.needMove) {
				if(!pos.z) pos.z =  map.needMove.z || map.getZ();
				map.needMove = pos;
			}
			else {
				//setCurrPosition(null, {'currPosition': {'x':gmxAPI.merc_x(x), 'y':gmxAPI.merc_y(y), 'z':z}});
				map.needMove = null;
				gmxAPI._cmdProxy('moveTo', { 'attr': pos });
			}
		}
		map.slideTo = function(x, y, z) { gmxAPI._cmdProxy('slideTo', { 'attr': {'x':x, 'y':y, 'z':z} }); }
		map.freeze = function() { gmxAPI._cmdProxy('freeze', {}); }
		map.unfreeze = function() { gmxAPI._cmdProxy('unfreeze', {}); }
		map.setCursor = function(url, dx, dy) { gmxAPI._cmdProxy('setCursor', { 'attr': {'url':url, 'dx':dx, 'dy':dy} }); }
		map.clearCursor = function() { gmxAPI._cmdProxy('clearCursor', {}); }
		map.zoomBy = function(dz, useMouse) {
			gmxAPI._cmdProxy('zoomBy', { 'attr': {'dz':-dz, 'useMouse':useMouse} });
			gmxAPI._listeners.dispatchEvent('zoomBy', gmxAPI.map);			// Проверка map Listeners на zoomBy
		}
		map.getBestZ = function(minX, minY, maxX, maxY)
		{
			if ((minX == maxX) && (minY == maxY))
				return 17;
			return Math.max(0, 17 - Math.ceil(Math.log(Math.max(
				Math.abs(gmxAPI.merc_x(maxX) - gmxAPI.merc_x(minX))/gmxAPI.flashDiv.clientWidth,
				Math.abs(gmxAPI.merc_y(maxY) - gmxAPI.merc_y(minY))/gmxAPI.flashDiv.clientHeight
			))/Math.log(2)));
		}

		var gplForm = false;
		map.loadObjects = function(url, callback)
		{
			var _hostname = gmxAPI.getAPIHostRoot() + "ApiSave.ashx?get=" + encodeURIComponent(url);
			sendCrossDomainJSONRequest(_hostname, function(response)
			{
				if(typeof(response) != 'object' || response['Status'] != 'ok') {
					gmxAPI.addDebugWarnings({'_hostname': _hostname, 'url': url, 'Error': 'bad response'});
					return;
				}
				var geometries = gmxAPI.parseGML(response['Result']);
				callback(geometries);
			})
		}
		map.saveObjects = function(geometries, fileName, format)
		{
			var inputName, inputText;
			if (!gplForm)
			{
				gplForm = document.createElement('<form>'),
				inputName = document.createElement('<input>'),
				inputText = document.createElement('<input>');
			}
			else
			{
				gplForm = document.getElementById('download_gpl_form'),
				inputName = gplForm.firstChild,
				inputText = gplForm.lastChild;
			}

			gplForm.setAttribute('method', 'post');
			var _hostname = gmxAPI.getAPIHostRoot();
			gplForm.setAttribute('action', _hostname + 'ApiSave.ashx');
			gplForm.style.display = 'none';
			inputName.value = fileName;
			inputName.setAttribute('name', 'name')
			if (!format)
				format = "gml";
			inputText.value = gmxAPI.createGML(geometries, format.toLowerCase());
			inputText.setAttribute('name', 'text')

			gplForm.appendChild(inputName);
			gplForm.appendChild(inputText);

			document.body.appendChild(gplForm);

			gplForm.submit();
		}

		map.moveToCoordinates = function(text, z)
		{
			return gmxAPI.parseCoordinates(text, function(x, y)
			{
				map.moveTo(x, y, z ? z : map.getZ());
			});
		}
		map.zoomToExtent = function(minx, miny, maxx, maxy)
		{
			var x = gmxAPI.from_merc_x((gmxAPI.merc_x(minx) + gmxAPI.merc_x(maxx))/2),
				y = gmxAPI.from_merc_y((gmxAPI.merc_y(miny) + gmxAPI.merc_y(maxy))/2);
			var z = map.getBestZ(minx, miny, maxx, maxy);
			var maxZ = map.zoomControl.getMaxZoom();
			map.moveTo(x, y, (z > maxZ ? maxZ : z));
		}
		map.slideToExtent = function(minx, miny, maxx, maxy)
		{
			var x = gmxAPI.from_merc_x((gmxAPI.merc_x(minx) + gmxAPI.merc_x(maxx))/2),
				y = gmxAPI.from_merc_y((gmxAPI.merc_y(miny) + gmxAPI.merc_y(maxy))/2);
			var z = map.getBestZ(minx, miny, maxx, maxy);
			var maxZ = map.zoomControl.getMaxZoom();
			map.slideTo(x, y, (z > maxZ ? maxZ : z));
		}
		
		var tmp = [			// Для обратной совместимости - методы ранее были в MapObject
			'saveObjects', 'loadObjects', 'getBestZ', 'zoomBy', 'clearCursor', 'setCursor', 'unfreeze', 'freeze', 'slideTo', 'moveTo',
			'repaint', 'print', 'disableCaching', 'setQuality', 'trace', 'savePNG', 'sendPNG', 'moveToCoordinates', 'zoomToExtent', 'slideToExtent'
		];
		for (var i=0; i<tmp.length; i++) gmxAPI.extendFMO(tmp[i], map[tmp[i]]);
		
		map.stopDragging = function() {	gmxAPI._cmdProxy('stopDragging', { }); }
		map.isDragging = function() { return gmxAPI._cmdProxy('isDragging', { }); }
		map.resumeDragging = function() { gmxAPI._cmdProxy('resumeDragging', { }); }
		map.setCursorVisible = function(flag) { gmxAPI._cmdProxy('setCursorVisible', { 'attr': {'flag':flag} }); }
		map.getPosition = function() { gmxAPI.currPosition = gmxAPI._cmdProxy('getPosition', { }); return gmxAPI.currPosition; }
		map.getX = function() { return (map.needMove ? map.needMove['x'] : gmxAPI._cmdProxy('getX', {})); }
		map.getY = function() { return (map.needMove ? map.needMove['y'] : gmxAPI._cmdProxy('getY', {})); }
		map.getZ = function() { return (map.needMove ? map.needMove['z'] : (gmxAPI.currPosition ? gmxAPI.currPosition.z : gmxAPI._cmdProxy('getZ', {}))); }
		map.getMouseX = function() { return gmxAPI._cmdProxy('getMouseX', {}); }
		map.getMouseY = function() { return gmxAPI._cmdProxy('getMouseY', {}); }
		map.isKeyDown = function(code) { return gmxAPI._cmdProxy('isKeyDown', {'attr':{'code':code} }); }
		map.setExtent = function(x1, x2, y1, y2) { return gmxAPI._cmdProxy('setExtent', {'attr':{'x1':x1, 'x2':x2, 'y1':y1, 'y2':y2} }); }
		map.addMapWindow = function(callback) {
			var oID = gmxAPI._cmdProxy('addMapWindow', { 'attr': {'callbackName':function(z) { return callback(z); }} });
			return new gmxAPI._FMO(oID, {}, null);		// MapObject миникарты
		}
		
		map.width  = function() { return gmxAPI._div.clientWidth;  }
		map.height = function() { return gmxAPI._div.clientHeight; }

		map.getItemsFromExtent = function(x1, x2, y1, y2) {
			var arr = [];
			for (var i = 0; i < map.layers.length; i++) arr.push(map.layers[i].objectId);
			return gmxAPI._cmdProxy('getItemsFromExtent', { 'obj': this, 'attr':{'layers':arr, 'extent':{'x1':gmxAPI.merc_x(x1), 'x2':gmxAPI.merc_x(x2), 'y1':gmxAPI.merc_y(y1), 'y2':gmxAPI.merc_y(y2)}} });
		}

		map.getItemsFromPosition = function() {
			var arr = [];
			for (var i = 0; i < map.layers.length; i++) arr.push(map.layers[i].objectId);
			return gmxAPI._cmdProxy('getItemsFromExtent', { 'obj': this, 'attr':{'layers':arr} });
		}
		// Использование SharedObject
		map.setFlashLSO = function(data) { return gmxAPI._cmdProxy('setFlashLSO', {'obj': this, 'attr':data }); }

		gmxAPI._listeners.dispatchEvent('mapInit', null, map);	// Глобальный Listeners

		var toolHandlers = {};
		var userHandlers = {};
		var updateMapHandler = function(eventName)
		{
			var h1 = toolHandlers[eventName];
			var h2 = userHandlers[eventName];
			gmxAPI._FMO.prototype.setHandler.call(map, eventName, h1 ? h1 : h2 ? h2 : null);
		}
		map.setHandler = function(eventName, callback)
		{
			userHandlers[eventName] = callback;
			updateMapHandler(eventName);
		}
		var setToolHandler = function(eventName, callback)
		{
			toolHandlers[eventName] = callback;
			updateMapHandler(eventName);
		}
		gmxAPI._setToolHandler = setToolHandler;

		var setToolHandlers = function(handlers)
		{
			for (var eventName in handlers)
				setToolHandler(eventName, handlers[eventName]);
		}

		map.getFeatures = function()
		{
			var callback, geometry, str = null;
			for (var i = 0; i < 3; i++)
			{
				var arg = arguments[i];
				if (typeof arg == 'function')
					callback = arg;
				else if (typeof arg == 'string')
					str = arg;
				else if (typeof arg == 'object')
					geometry = arg;
			}
			var layerNames = arguments[3];
			if (!layerNames)
			{
				layerNames = [];
				for (var i = 0; i < map.layers.length; i++)
				{
					var layer = map.layers[i];
					if ((layer.properties.type == 'Vector') && layer.AllowSearch)
						layerNames.push(layer.properties.name);
				}
			}
			if (layerNames.length == 0)
			{
				callback([]);
				return;
			}

			//var searchScript = "/SearchObject/SearchVector.ashx";
			var searchScript = "/VectorLayer/Search.ashx";
			var url = "http://" + map.layers[layerNames[0]].properties.hostName + searchScript;

			var attr, func;
			if(searchScript === "/VectorLayer/Search.ashx") {
				attr = {
					'WrapStyle': 'window'
					,'page': 0
					,'pagesize': 100000
					,'geometry': true
					,'layer': layerNames.join(",")
					,'query': (str != null ? str : '')
				};
				
				func = function(searchReq) {
					var ret = [];
					if (searchReq.Status == 'ok')
					{
						var fields = searchReq.Result.fields;
						var arr = searchReq.Result.values;
						for (var i = 0, len = arr.length; i < len; i++)
						{
							var req = arr[i];
							var item = {};
							var prop = {};
							for (var j = 0, len1 = req.length; j < len1; j++)
							{
								var fname = fields[j];
								var it = req[j];
								if (fname === 'geomixergeojson') {
									item.geometry = gmxAPI.from_merc_geometry(it);
								} else {
									prop[fname] = it;
								}
							}
							item.properties = prop;
							ret.push(new gmxAPI._FlashMapFeature( 
								item.geometry,
								item.properties,
								map.layers[layerNames]
							));
						}
					}						
					callback(ret);
				};
				if (geometry) {
					attr['border'] = JSON.stringify(gmxAPI.merc_geometry(geometry));
				}
			} else if(searchScript === "/SearchObject/SearchVector.ashx") {
				func = function(searchReq) {
					var ret = [];
					if (searchReq.Status == 'ok')
					{
						for (var i = 0; i < searchReq.Result.length; i++)
						{
							var req = searchReq.Result[i];
							if (!ret[req.name])
								ret[req.name] = [];
							for (var j = 0; j < req.SearchResult.length; j++)
							{
								var item = req.SearchResult[j];
								ret.push(new gmxAPI._FlashMapFeature( 
									gmxAPI.from_merc_geometry(item.geometry),
									item.properties,
									map.layers[req.name]
								));
							}
						}
					}						
					callback(ret);
				};
				attr = {
					'WrapStyle': 'window'
					,'MapName': map.layers[layerNames[0]].properties.mapName
					,'LayerNames': layerNames.join(",")
					,'SearchString': (str != null ? encodeURIComponent(str) : '')
				};
				if (geometry) {
					attr['Border'] = JSON.stringify(gmxAPI.merc_geometry(geometry));
				}
			}
			gmxAPI.sendCrossDomainPostRequest(url, attr, func);
		}

		map.geoSearchAPIRoot = typeof window.searchAddressHost !== 'undefined' ? window.searchAddressHost : gmxAPI.getAPIHostRoot();
		map.sendSearchRequest = function(str, callback)
		{
			sendCrossDomainJSONRequest(
				map.geoSearchAPIRoot + "SearchObject/SearchAddress.ashx?SearchString=" + escape(str),
				function(res)
				{
					var ret = {};
					if (res.Status == 'ok')
					{
						for (var i = 0; i < res.Result.length; i++)
						{
							var name = res.Result[i].name;
							if (!ret[name])
								ret[name] = res.Result[i].SearchResult;
						}
					}								
					callback(ret);
				}
			);
		}
		map.setMinMaxZoom = function(z1, z2) {
			if(gmxAPI.map.zoomControl) gmxAPI.map.zoomControl.setMinMaxZoom(z1, z2);
			return gmxAPI._cmdProxy('setMinMaxZoom', {'attr':{'z1':z1, 'z2':z2} });
		}
		map.setZoomBounds = map.setMinMaxZoom;

		map.grid = {
			setVisible: function(flag) { gmxAPI._cmdProxy('setGridVisible', { 'attr': flag }) }
			,getVisibility: function() { return gmxAPI._cmdProxy('getGridVisibility', {}) }
			,setOneDegree: function(flag) { gmxAPI._cmdProxy('setOneDegree', { 'attr': flag }) }
		};

		//Begin: tools
		if('_ToolsAll' in gmxAPI) {
			map.toolsAll = new gmxAPI._ToolsAll(gmxAPI._div);
		}
		if('_addZoomControl' in gmxAPI) {
			gmxAPI._addZoomControl(gmxAPI._allToolsDIV);
			map.setMinMaxZoom(1, 17);
		}

		if (gmxAPI._drawing) {
			map.drawing = gmxAPI._drawing;
		} else {
			map.drawing = {
				'setHandlers': function() { return false; }
				,'forEachObject': function() { return false; }
			};
		}

		map.addContextMenuItem = function(text, callback)
		{
			gmxAPI._cmdProxy('addContextMenuItem', { 'attr': {
				'text': text,
				'func': function(x, y)
					{
						if(gmxAPI.proxyType === 'flash') {
							x = gmxAPI.from_merc_x(x);
							y = gmxAPI.from_merc_y(y);
						}
						callback(x, y);
					}
				}
			});
		}

		if (gmxAPI._drawing) {
			map.addContextMenuItem(
				gmxAPI.KOSMOSNIMKI_LOCALIZED("Поставить маркер", "Add marker"),
				function(x, y)
				{
					map.drawing.addObject({type: "POINT", coordinates: [x, y]});
				}
			);
		}

		// Управление базовыми подложками
		var baseLayers = {};
		var currentBaseLayerName = '';
		//расширяем FlashMapObject
		gmxAPI.extendFMO('setAsBaseLayer', function(name, attr)
		{
			if (!baseLayers[name])
				baseLayers[name] = [];
			baseLayers[name].push(this);
/*
			if(!this.objectId) {	// Подложки должны быть в SWF
				this.setVisible(true);
				this.setVisible(false);
			}
*/
			this.isBaseLayer = true;
			if(gmxAPI.baseLayersTools)
				gmxAPI.baseLayersTools.chkBaseLayerTool(name, attr);
		});

		var unSetBaseLayer = function()
		{
			for (var oldName in baseLayers) {
				for (var i = 0; i < baseLayers[oldName].length; i++) {
					baseLayers[oldName][i].setVisible(false);
				}
			}
			currentBaseLayerName = '';
		}
		map.unSetBaseLayer = unSetBaseLayer;
		
		map.setBaseLayer = function(name)
		{
			map.needSetMode = name;
			//if(map.needSetMode) map.needSetMode = name;
			//else {
				unSetBaseLayer();
				currentBaseLayerName = name;
				var newBaseLayers = baseLayers[currentBaseLayerName];
				if (newBaseLayers) {
					for (var i = 0; i < newBaseLayers.length; i++) {
						newBaseLayers[i].setVisible(true);
					}
					var backgroundColor = (newBaseLayers.length && newBaseLayers[0].backgroundColor ? newBaseLayers[0].backgroundColor : 0xffffff);
					map.setBackgroundColor(backgroundColor);
				}
				gmxAPI._listeners.dispatchEvent('baseLayerSelected', map, currentBaseLayerName);
			//}
		}

		map.setMode = function(mode) 
		{
			var name = (gmxAPI.baseLayersTools ? gmxAPI.baseLayersTools.getAlias(mode) : mode);
			map.setBaseLayer(name);
		}

		map.getBaseLayer = function()
		{
			return currentBaseLayerName;
		}

		map.isModeSelected = function(name)
		{
			var test = (gmxAPI.baseLayersTools ? gmxAPI.baseLayersTools.getAlias(name) : name);
			return (test == currentBaseLayerName ? true : false);
		}
		map.getCurrentBaseLayerName = map.getBaseLayer;
		map.getMode = map.getBaseLayer;

		map.baseLayerControl = {
			isVisible: true,
			setVisible: function(flag)
			{
				if(gmxAPI.baseLayersTools) gmxAPI.baseLayersTools.setVisible(flag);
			},
			updateVisibility: function()
			{
				if(gmxAPI.baseLayersTools) gmxAPI.baseLayersTools.updateVisibility();
			},
			repaint: function()
			{
				if(gmxAPI.baseLayersTools) gmxAPI.baseLayersTools.repaint();
			}, 

			getBaseLayerNames: function()
			{
				var res = [];
				for (var k in baseLayers) res.push(k);
				return res;
			},
			getBaseLayerLayers: function(name)
			{
				return baseLayers[name];
			}
		}

		// Поддержка устаревшего map.baseLayerControl.onChange 
		map.addListener('baseLayerSelected', function(name)	{
			if('onChange' in map.baseLayerControl) map.baseLayerControl.onChange(name);
		});

		var haveOSM = false;

		//var maxRasterZoom = 1;
		//var miniMapZoomDelta = -4;
		map.addLayers = function(layers, notMoveFlag, notVisible)
		{
			var mapBounds = gmxAPI.getBounds();
			var minLayerZoom = 20;
			forEachLayer(layers, function(layer, isVisible) 
			{
				var visible = (layer.properties.visible ? true : isVisible);
				var lObj = map.addLayer(layer, visible, true);
				if('LayerVersion' in layer.properties && gmxAPI._layersVersion) {
					gmxAPI._layersVersion.chkVersionLayers(layers, layer);
				}
				if(visible && lObj.mercGeometry) mapBounds.update(lObj.mercGeometry.coordinates);
				var arr = layer.properties.styles || [];
				for (var i = 0; i < arr.length; i++) {
					var mm = arr[i].MinZoom;
					minLayerZoom = Math.min(minLayerZoom, mm);
				}
				if (layer.properties.type == "Raster" && layer.properties.MaxZoom > gmxAPI.maxRasterZoom)
					gmxAPI.maxRasterZoom = layer.properties.MaxZoom;
			}, notVisible);
			if (layers.properties.UseOpenStreetMap && !haveOSM)
			{
				var o = map.addObject();
				o.setVisible(false);
				o.bringToBottom();
				o.setAsBaseLayer("OSM");
				o.setOSMTiles();
				haveOSM = true;

				if('miniMap' in map) {
					var miniOSM = map.miniMap.addObject();
					miniOSM.setVisible(false);
					miniOSM.setOSMTiles();
					miniOSM.setAsBaseLayer("OSM");
				}
			}

			if(gmxAPI.initParams && gmxAPI.initParams['center']) {			// есть переопределение центра карты
				if('x' in gmxAPI.initParams['center']) map.needMove['x'] = gmxAPI.initParams['center']['x'];
				if('y' in gmxAPI.initParams['center']) map.needMove['y'] = gmxAPI.initParams['center']['y'];
				if('z' in gmxAPI.initParams['center']) map.needMove['z'] = gmxAPI.initParams['center']['z'];
				//delete gmxAPI.initParams['center'];
			} else {
				if (layers.properties.DefaultLat && layers.properties.DefaultLong && layers.properties.DefaultZoom) {
					var pos = {
						'x': parseFloat(layers.properties.DefaultLong),
						'y': parseFloat(layers.properties.DefaultLat),
						'z': parseInt(layers.properties.DefaultZoom)
					};
					map.needMove = pos;
					setCurrPosition(null, {'currPosition': {
						'x': gmxAPI.merc_x(pos['x']),
						'y': gmxAPI.merc_y(pos['y']),
						'z': pos['z']
					}});
				} else if(!notMoveFlag && mapBounds)
				{
					var z = map.getBestZ(gmxAPI.from_merc_x(mapBounds.minX), gmxAPI.from_merc_y(mapBounds.minY), gmxAPI.from_merc_x(mapBounds.maxX), gmxAPI.from_merc_y(mapBounds.maxY));
					if (minLayerZoom != 20)
						z = Math.max(z, minLayerZoom);
					if(z > 0)  {
						var pos = {
							'x': (mapBounds.minX + mapBounds.maxX)/2,
							'y': (mapBounds.minY + mapBounds.maxY)/2,
							'z': z
						};
						map.needMove = {
							'x': gmxAPI.from_merc_x(pos['x']),
							'y': gmxAPI.from_merc_y(pos['y']),
							'z': z
						};
						setCurrPosition(null, {'currPosition': pos});
					}
				}
			}
			if (layers.properties.ViewUrl && !window.suppressDefaultPermalink)
			{
				var result = (/permalink=([a-zA-Z0-9]+)/g).exec(layers.properties.ViewUrl);
				if (result)
				{
					var permalink = result[1];
					var callbackName = gmxAPI.uniqueGlobalName(function(obj)
					{
						if (obj.position) {
							var pos = {
								'x': obj.position.x,
								'y': obj.position.y,
								'z': 17 - obj.position.z
							};
							map.needMove = {
								'x': gmxAPI.from_merc_x(pos['x']),
								'y': gmxAPI.from_merc_y(pos['y']),
								'z': pos['z']
							};
							setCurrPosition(null, {'currPosition': pos});
						}
						if (obj.drawnObjects && gmxAPI._drawing)
							for (var i =0; i < obj.drawnObjects.length; i++)
							{
								var o = obj.drawnObjects[i];
								map.drawing.addObject(gmxAPI.from_merc_geometry(o.geometry), o.properties);
							}
					});
					var script = document.createElement("script");
					script.setAttribute("charset", "UTF-8");
					script.setAttribute("src", "http://" + layers.properties.hostName + "/TinyReference.ashx?id=" + permalink + "&CallbackName=" + callbackName + "&" + Math.random());
					document.getElementsByTagName("head").item(0).appendChild(script);
				}
			}
			if (layers.properties.MinViewX)
			{
				if(gmxAPI.proxyType === 'flash') {
					map.setExtent(
						layers.properties.MinViewX,
						layers.properties.MaxViewX,
						layers.properties.MinViewY,
						layers.properties.MaxViewY
					);
				}
			}
			if (gmxAPI.maxRasterZoom > 17)
				map.setMinMaxZoom(1, gmxAPI.maxRasterZoom);
			if (layers.properties.Copyright)
			{
				var obj = map.addObject();
				obj.setCopyright(layers.properties.Copyright);
			}
			if (layers.properties.MiniMapZoomDelta)
				gmxAPI.miniMapZoomDelta = layers.properties.MiniMapZoomDelta;
			if (layers.properties.OnLoad && layers.properties.name !== kosmosnimki_API)	//  Обработка маплета карты - mapplet для базовой карты уже вызывали
			{
				try { eval("_kosmosnimki_temp=(" + layers.properties.OnLoad + ")")(map); }
				catch (e) {
					gmxAPI.addDebugWarnings({'func': 'addLayers', 'handler': 'OnLoad', 'event': e, 'alert': e+'\n---------------------------------'+'\n' + layers.properties.OnLoad});
				}
			}
		}

		map.getCenter = function(mgeo)
		{
			if(!mgeo) mgeo = map.getScreenGeometry();
			return gmxAPI.geoCenter(mgeo);
		}

		map.getScreenGeometry = function()
		{
			var e = map.getVisibleExtent();
			return {
				type: "POLYGON",
				coordinates: [[[e.minX, e.minY], [e.minX, e.maxY], [e.maxX, e.maxY], [e.maxX, e.minY], [e.minX, e.minY]]]
			};
		}
		map.getVisibleExtent = function()
		{
			var currPos = gmxAPI.currPosition || map.getPosition();
			if(currPos['latlng'] && currPos['latlng']['extent']) {
				return currPos['latlng']['extent'];
			}

			var ww = 2 * gmxAPI.worldWidthMerc;
			var x = currPos['x'] + ww;
			x = x % ww;
			if(x > gmxAPI.worldWidthMerc) x -= ww;
			if(x < -gmxAPI.worldWidthMerc) x += ww;

			var y = currPos['y'];
			var scale = gmxAPI.getScale(currPos['z']);

			var w2 = scale * gmxAPI._div.clientWidth/2;
			var h2 = scale * gmxAPI._div.clientHeight/2;
			var out = {
				minX: gmxAPI.from_merc_x(x - w2),
				minY: gmxAPI.from_merc_y(y - h2),
				maxX: gmxAPI.from_merc_x(x + w2),
				maxY: gmxAPI.from_merc_y(y + h2)
			};
			return out;
		}

		if('_addLocationTitleDiv' in gmxAPI) gmxAPI._addLocationTitleDiv(gmxAPI._div);
		if('_addGeomixerLink' in gmxAPI) gmxAPI._addGeomixerLink(gmxAPI._div);
		if('_addCopyrightControl' in gmxAPI) gmxAPI._addCopyrightControl(gmxAPI._div);

		var sunscreen = map.addObject();
		gmxAPI._sunscreen = sunscreen;

		var checkMapSize = function()
		{
			gmxAPI._updatePosition();
			gmxAPI._listeners.dispatchEvent('onResizeMap', map);
		};
		if(gmxAPI.proxyType === 'flash') {
			sunscreen.setStyle({ fill: { color: 0xffffff, opacity: 1 } });
			sunscreen.setRectangle(-180, -85, 180, 85);
			sunscreen.setVisible(false);
			sunscreen.addListener("onResize", function()
			{
				checkMapSize();
				//gmxAPI._updatePosition();
				//gmxAPI._listeners.dispatchEvent('onResizeMap', map);
			});
		
			if('_miniMapInit' in gmxAPI) {
				gmxAPI._miniMapInit(gmxAPI._div);
			}
			
		} else if(gmxAPI.proxyType === 'leaflet') {
			checkMapSize = function()
			{
				return gmxAPI._cmdProxy('checkMapSize');
			}
		}
		map.checkMapSize = checkMapSize;

		var setCurrPosition = function(ev, attr)
		{
			var currPos = (attr && attr.currPosition ? attr.currPosition : map.getPosition());
			
			var eventFlag = (gmxAPI.currPosition && currPos['x'] == gmxAPI.currPosition['x']
				&& currPos['y'] == gmxAPI.currPosition['y']
				&& currPos['z'] == gmxAPI.currPosition['z']
				? false : true);

			currPos['latlng'] = {
				'x': gmxAPI.from_merc_x(currPos['x']),
				'y': gmxAPI.from_merc_y(currPos['y']),
				'mouseX': gmxAPI.from_merc_x(currPos['mouseX']),
				'mouseY': gmxAPI.from_merc_y(currPos['mouseY'])
			};
			if(currPos['extent']) {
				if(currPos['extent']['minx'] != 0 || currPos['extent']['maxx'] != 0) {
					currPos['latlng']['extent'] = {
						minX: gmxAPI.from_merc_x(currPos['extent']['minX'] || currPos['extent']['minx']),
						minY: gmxAPI.from_merc_y(currPos['extent']['minY'] || currPos['extent']['miny']),
						maxX: gmxAPI.from_merc_x(currPos['extent']['maxX'] || currPos['extent']['maxx']),
						maxY: gmxAPI.from_merc_y(currPos['extent']['maxY'] || currPos['extent']['maxy'])
					};
				}
			}

			gmxAPI.currPosition = currPos;
			return eventFlag;
		}

		var updatePosition = function(ev, attr)
		{
			var eventFlag = setCurrPosition(ev, attr);
			if(eventFlag) {						// Если позиция карты изменилась - формируем событие positionChanged
				var currPos = gmxAPI.currPosition;
				var z = currPos['z'];

				/** Пользовательское событие positionChanged
				* @function callback
				* @param {object} атрибуты прослушивателя
				*/
				if ('stateListeners' in map && 'positionChanged' in map.stateListeners) {
					var pattr = {
						'currZ': z,
						'currX': currPos['latlng']['x'],
						'currY': currPos['latlng']['y'],
						'div': gmxAPI._locationTitleDiv,
						'screenGeometry': map.getScreenGeometry(),
						'properties': map.properties
					};
					gmxAPI._listeners.dispatchEvent('positionChanged', map, pattr);
				}
			}
		}
		gmxAPI._updatePosition = updatePosition;

		var eventMapObject = map.addObject();
		eventMapObject.setHandler("onMove", updatePosition);
		// onMoveBegin	- перед onMove
		// onMoveEnd	- после onMove

		//updatePosition();
		setCurrPosition();

		map.setBackgroundColor = function(color)
		{
			map.backgroundColor = color;
			gmxAPI._cmdProxy('setBackgroundColor', { 'obj': map, 'attr':color });
			var isWhite = (0xff & (color >> 16)) > 80;
			var htmlColor = isWhite ? "black" : "white";
			if(gmxAPI._setCoordinatesColor) gmxAPI._setCoordinatesColor(htmlColor, gmxAPI.getAPIFolderRoot() + "img/" + (isWhite ? "coord_reload.png" : "coord_reload_orange.png"), true);
			if(gmxAPI._setCopyrightColor) gmxAPI._setCopyrightColor(htmlColor);
		}
		
		map.setBackgroundColor(gmxAPI.proxyType === 'leaflet' ? 0xffffff : 0x000001);
		//map.setBackgroundColor(0x000001);
//			map.miniMap.setBackgroundColor(0xffffff);

		map.defaultHostName = (layers && layers.properties ? layers.properties.hostName : '');
		map.addLayers(layers, false, true);
		
		if(!layers.properties.UseKosmosnimkiAPI) map.moveTo(map.needMove.x, map.needMove.y, map.needMove.z);
		
		if(!map.needSetMode && haveOSM) {			// если нигде не устанавливалась текущая подложка и есть OSM
			map.setMode('OSM');
		}

		var startDrag = function(object, dragCallback, upCallback)
		{
			map.freeze();
			sunscreen.setVisible(true);
			setToolHandlers({
				onMouseMove: function(o)
				{
					var currPosition = map.getPosition();
					var mouseX = gmxAPI.from_merc_x(currPosition['mouseX']);
					var mouseY = gmxAPI.from_merc_y(currPosition['mouseY']);
					dragCallback(mouseX, mouseY, o);
				},
				onMouseUp: function()
				{
					updatePosition();
					gmxAPI._stopDrag();
					if (upCallback)
						upCallback();
				}
			});
		}
		gmxAPI._startDrag = startDrag;

		var stopDrag = function()
		{
			setToolHandlers({ onMouseMove: null, onMouseUp: null });
			map.unfreeze();
			sunscreen.setVisible(false);
		}
		gmxAPI._stopDrag = stopDrag;

		gmxAPI.extendFMO('startDrag', function(dragCallback, upCallback)
		{
			gmxAPI._startDrag(this, dragCallback, upCallback);
		});

		gmxAPI.extendFMO('disableDragging', function(dragCallback, downCallback, upCallback)
		{
			gmxAPI._FMO.prototype.removeHandler.call(map, 'onMouseMove');
			gmxAPI._FMO.prototype.removeHandler.call(map, 'onMouseUp');
			gmxAPI._FMO.prototype.removeHandler.call(map, 'onMouseDown');
		});

		gmxAPI.extendFMO('enableDragging', function(dragCallback, downCallback, upCallback)
		{
			var object = this;
			var mouseDownHandler = function(o)
			{
				if (downCallback) {
					var currPosition = map.getPosition();
					var mouseX = null;
					var mouseY = null;
					if(currPosition['latlng'] && 'mouseX' in currPosition['latlng']) {
						mouseX = currPosition['latlng']['mouseX'];
						mouseY = currPosition['latlng']['mouseY'];
					} else {
						mouseX = gmxAPI.from_merc_x(currPosition['mouseX']);
						mouseY = gmxAPI.from_merc_y(currPosition['mouseY']);
					}
					downCallback(mouseX, mouseY, o);
				}
				gmxAPI._startDrag(object, dragCallback, upCallback);
			}
			if (object == map) {
				setToolHandler("onMouseDown", mouseDownHandler);
			} else {
				object.setHandler("onMouseDown", mouseDownHandler);
			}
		});
		if(gmxAPI.proxyType === 'leaflet') {
			gmxAPI.extendFMO('enableDragging', function(dragCallback, downCallback, upCallback)
			{
				var attr = { 'drag': dragCallback, 'dragstart':downCallback, 'dragend':upCallback };
				gmxAPI._cmdProxy('enableDragging', { 'obj': this, 'attr':attr });
			});
			gmxAPI.extendFMO('disableDragging', function()
			{
				gmxAPI._cmdProxy('disableDragging', { 'obj': this });
			});
		}

		window.kosmosnimkiBeginZoom = function() 
		{
			if (gmxAPI._drawing && !gmxAPI._drawing.tools['move'].isActive)
				return false;
			gmxAPI.map.freeze();
			sunscreen.setVisible(true);
			var x1 = gmxAPI.map.getMouseX();
			var y1 = gmxAPI.map.getMouseY();
			var x2, y2;
			var rect = gmxAPI.map.addObject();
			rect.setStyle({ outline: { color: 0xa0a0a0, thickness: 1, opacity: 70 } });
			setToolHandlers({
				onMouseMove: function()
				{
					x2 = gmxAPI.map.getMouseX();
					y2 = gmxAPI.map.getMouseY();
					rect.setRectangle(x1, y1, x2, y2);
				},
				onMouseUp: function()
				{
					setToolHandlers({ onMouseMove: null, onMouseUp: null });
					gmxAPI.map.unfreeze();
					sunscreen.setVisible(false);
					var d = 10*gmxAPI.getScale(gmxAPI.map.getZ());
					if (!x1 || !x2 || !y1 || !y2 || ((Math.abs(gmxAPI.merc_x(x1) - gmxAPI.merc_x(x2)) < d) && (Math.abs(gmxAPI.merc_y(y1) - gmxAPI.merc_y(y2)) < d)))
						gmxAPI.map.zoomBy(1, true);
					else
						gmxAPI.map.zoomToExtent(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
					rect.remove();
				}
			});
			return true;
		}

		if(gmxAPI.proxyType === 'flash') {
			var onWheel = function(e)
			{
				if (!e)
					e = window.event;

				var inMap = false;
				var elem = gmxAPI.compatTarget(e);
				while(elem != null) 
				{
					if (elem == gmxAPI._div)
					{
								inMap = true;
								break;
					}
					elem = elem.parentNode;
				}
		
				if (!inMap)
					return;

				var delta = 0;
				if (e.wheelDelta) 
					delta = e.wheelDelta/120; 
				else if (e.detail) 
					delta = -e.detail/3;

				if (delta)
					gmxAPI.map.zoomBy(delta > 0 ? 1 : -1, true);

				if (e.preventDefault)
				{
					e.stopPropagation();
					e.preventDefault();
				}
				else 
				{
					e.returnValue = false;
					e.cancelBubble = true;
				}
			}

			var addHandler = function(div, eventName, handler)
			{
				if (div.attachEvent) 
					div.attachEvent("on" + eventName, handler); 
				if (div.addEventListener) 
					div.addEventListener(eventName, handler, false);
			}

			addHandler(window, "mousewheel", onWheel);
			addHandler(document, "mousewheel", onWheel);
			if (window.addEventListener) window.addEventListener('DOMMouseScroll', onWheel, false);
		}
		map.ToolsContainer = gmxAPI._ToolsContainer;
		return map;
	}
	//расширяем namespace
    gmxAPI._addNewMap = addNewMap;	// Создать map обьект
})();

