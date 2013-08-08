(function(){
	"use strict";
	var css = document.createElement("link");
	css.setAttribute("type", "text/css");
	css.setAttribute("rel", "stylesheet");
	css.setAttribute("media", "screen");
	css.setAttribute("href", "api_controls/apiControls.css");
	document.getElementsByTagName("head").item(0).appendChild(css);
	var control = {
		'initControls': function(st) {
			gmxAPI.map.allControls.setVisible(false);
		
			control.drawing.initControlsDrawing();
			control.zoom.initControlsZoom();
			control.baseLayers.initControlsBaseLayers();
			control.copyright.initControlsCopyright();
			control.location.initControlsLocation();
			control.print.initControlsPrint();
			gmxAPI.map.geomixerLinkSetVisible(false);
		}
		,
		'print': {
			'initControlsPrint': function(mode) {
				document.getElementById("Print").onclick = function(e) {
					function getWindowHeight()
					{
						var myHeight = 0;
						if (typeof (window.innerWidth) == 'number' )
							myHeight = window.innerHeight;
						else if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight))
							myHeight = document.documentElement.clientHeight;
						else if (document.body && (document.body.clientWidth || document.body.clientHeight))
							myHeight = document.body.clientHeight;
						
						return myHeight;
					}
					var printPage = window.open("print-iframe_leaflet.html", "_blank", "width=" + String(640) + ",height=" + String(getWindowHeight()) + ",resizable=yes,scrollbars=yes");
				}
			}
		}
		,
		'baseLayers': {
			'mapControl': null
			,
			'satelliteControl': null
			,
			'currMode': null
			,
			'types': null
			,
			'setMapType': function(mode) {
				control.baseLayers.satelliteControl.style.display = (mode === 'satellite' ? 'block' : 'none');
				control.baseLayers.mapControl.style.display = (mode === 'map' ? 'block' : 'none');
				control.baseLayers.currMode = mode;
				//document.getElementById("control7").className = (mode === 'map' ? 'whiteColor' : '');
				//console.log('setMapType ', mode);
			}
			,
			'initControlsBaseLayers': function() {
				control.baseLayers.mapControl = document.getElementById("control5");
				control.baseLayers.satelliteControl = document.getElementById("control6");

				document.getElementById("hideMap").onclick = function(e) {
					gmxAPI.map.setMode('');
				}
				document.getElementById("hideMap1").onclick = function(e) {
					gmxAPI.map.setMode('');
				}
				var cont = document.getElementById("map_control");
				cont.onclick = function(e) {
					gmxAPI.map.setMode('map');
				}

				var map1 = document.getElementById("map1");
				var mapItemsShowID = null;
				var map_items = document.getElementById("map_items");
				cont.onmouseover = function(e) {
					map_items.style.visibility = 'hidden';
					if(mapItemsShowID) {
						clearTimeout(mapItemsShowID);
						mapItemsShowID = null;
					}
					mapItemsShowID = setTimeout(function()
					{
						map_items.style.visibility = 'visible';
						mapItemsShowID = null;
					}, 1000);
				}
/*
				cont = document.getElementById("relief");
				cont.onclick = function(e) {
					gmxAPI.map.setMode('Рельеф');
				}
*/
				cont = document.getElementById("OSM");
				cont.onclick = function(e) {
					gmxAPI.map.setMode('OSM');
				}

				cont = document.getElementById("satellite_control");
				cont.onclick = function(e) {
					gmxAPI.map.setMode('satellite');
				}
				
				//var satellite = document.getElementById("satellite");
				var satelliteItemsShowID = null;
				var satellite_items = document.getElementById("satellite_items");
				cont.onmouseover = function(e) {
					//gmxAPI.stopEvent(e);
					//e.stopImmediatePropagation();
					
					satellite_items.style.visibility = 'hidden';
					if(satelliteItemsShowID) {
						clearTimeout(satelliteItemsShowID);
						satelliteItemsShowID = null;
					}
					satelliteItemsShowID = setTimeout(function()
					{
						satellite_items.style.visibility = 'visible';
						satelliteItemsShowID = null;
					}, 1000);
				}

				cont = document.getElementById("hybrid");
				cont.onclick = function(e) {
					gmxAPI.map.setMode('hybrid');
				}
				
				control.baseLayers.currMode = gmxAPI.map.getModeID();
				gmxAPI.map.addListener('baseLayerSelected', function(mode) {
					var alias = gmxAPI.map.getModeID(mode);
					//console.log('alias ', alias, mode);
					var type = (alias === 'map' || alias === 'OSM' ? 'satellite' : 'map');
					control.baseLayers.setMapType(type);
					
					if(!control.baseLayers.types) {
						control.baseLayers['types'] = {
							'map': []
							,'satellite': []
						};
					
						var arr = gmxAPI.map.baseLayerControl.getBaseLayerNames();
						for(var i=0, len = arr.length; i<len; i++) {
							var alias = gmxAPI.map.getModeID(arr[i]);
							if(alias === 'map' || alias === 'OSM') control.baseLayers['types']['map'].push(alias);
							else control.baseLayers['types']['satellite'].push(alias);
						}
					}
				}, 101);
			}
		}
		,
		'location': {
			'initControlsLocation': function() {
				gmxAPI.map.coordinates.setVisible(false);
				gmxAPI.map.scaleBar.setVisible(false);
			
				var locationTxt = document.getElementById("locationTxt");
				var scaleBar = document.getElementById("scaleBar");
				var scaleBarTxt = document.getElementById("scaleBarTxt");

				var coordFormat = 0;
				var prevCoordinates = '';
				var scaleBarText, scaleBarWidth;

				scaleBar.onclick = function()
				{
					coordFormat += 1;
					if (coordFormat > 2) coordFormat = 0;
					setCoordinatesFormat(coordFormat);
				}

				locationTxt.onclick = function()
				{
					if (coordFormat > 2) return; //выдаем окошко с координатами только для стандартных форматов.
					var oldText = getCoordinatesText();
					var text = window.prompt(gmxAPI.KOSMOSNIMKI_LOCALIZED("Текущие координаты центра карты:", "Current center coordinates:"), oldText);
					if (text && (text != oldText))
						gmxAPI.map.moveToCoordinates(text);
				}

				var repaintScaleBar = function()
				{
					if (scaleBarText)
					{
						scaleBar.style.width = scaleBarWidth + "px";
						scaleBarTxt.innerHTML = scaleBarText;
					}
				}
				
				var getCoordinatesText = function(currPos)
				{
					if(!currPos) currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
					var x = (currPos['latlng'] ? currPos['latlng']['x'] : gmxAPI.from_merc_x(currPos['x']));
					var y = (currPos['latlng'] ? currPos['latlng']['y'] : gmxAPI.from_merc_y(currPos['y']));
					if (x > 180) x -= 360;
					if (x < -180) x += 360;
					if (coordFormat % 3 == 0)
						return gmxAPI.LatLon_formatCoordinates(x, y);
					else if (coordFormat % 3 == 1)
						return gmxAPI.LatLon_formatCoordinates2(x, y);
					else
						return 'x: ' + Math.round(gmxAPI.merc_x(x)) + ', y: ' + Math.round(gmxAPI.merc_y(y));
				}

				var setCoordinatesFormat = function(num)
				{
					if(!num) num = coordFormat;
					//if(num < 0) num = coordFormatCallbacks.length - 1;
					//else if(num >= coordFormatCallbacks.length) num = 0;
					coordFormat = num;
					//if(!screenGeometry) screenGeometry = gmxAPI.map.getScreenGeometry();
					//var attr = {'screenGeometry': screenGeometry, 'properties': gmxAPI.map.properties };
					var res = getCoordinatesText();		// если есть res значит запомним ответ
					if(res && prevCoordinates != res) locationTxt.innerHTML = res;
					prevCoordinates = res;
					gmxAPI._listeners.dispatchEvent('onSetCoordinatesFormat', gmxAPI.map, coordFormat);
				}
				var getLocalScale = function(x, y)
				{
					return gmxAPI.distVincenty(x, y, gmxAPI.from_merc_x(gmxAPI.merc_x(x) + 40), gmxAPI.from_merc_y(gmxAPI.merc_y(y) + 30))/50;
				}
				var checkPositionChanged = function() {
					var currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
					var z = Math.round(currPos['z']);
					var x = (currPos['latlng'] ? currPos['latlng']['x'] : 0);
					var y = (currPos['latlng'] ? currPos['latlng']['y'] : 0);
					if(gmxAPI.map.needMove) {
						z = gmxAPI.map.needMove['z'];
						x = gmxAPI.map.needMove['x'];
						y = gmxAPI.map.needMove['y'];
					}

					var metersPerPixel = getLocalScale(x, y)*gmxAPI.getScale(z);
					for (var i = 0; i < 30; i++)
					{
						var distance = [1, 2, 5][i%3]*Math.pow(10, Math.floor(i/3));
						var w = Math.floor(distance/metersPerPixel);
						if (w > 100)
						{
							var name = gmxAPI.prettifyDistance(distance);
							if ((name != scaleBarText) || (w != scaleBarWidth))
							{
								scaleBarText = name;
								scaleBarWidth = w;
								repaintScaleBar();
							}
							break;
						}
					}
					//setCoordinatesFormat();
				}

				var setCoordinatesFormatTimeout = false;
				var prpPosition = function() {
					if (setCoordinatesFormatTimeout) return;
					setCoordinatesFormatTimeout = setTimeout(function()
					{
						clearTimeout(setCoordinatesFormatTimeout);
						setCoordinatesFormatTimeout = false;
						//if(gmxAPI.proxyType === 'flash') checkPositionChanged();
						setCoordinatesFormat();
					}, 150);
				}

				gmxAPI.map.addListener('positionChanged', prpPosition);
				if(gmxAPI.proxyType === 'flash') {
					gmxAPI.map.addListener('onResizeMap', prpPosition);
				} else {
					gmxAPI.map.addListener('onMoveEnd', checkPositionChanged);
				}
			}
		}
		,
		'copyright': {
			'copyrightDIV': null
			,
			'initControlsCopyright': function() {
				gmxAPI.map.setCopyrightVisibility(false);
				control.copyright.copyrightDIV = document.getElementById("control_copyright");
				gmxAPI.map.addListener('copyrightRepainted', function(text) {
					control.copyright.copyrightDIV.innerHTML = text;
				});
			}
		}
		,
		'zoom': {
			'currZoom': null
			,'rulerHeight': 7
			,'rHeight': 0
			,
			'setRulerSize': function() {
				var minZ = gmxAPI.map.zoomControl.getMinZoom();
				var maxZ = gmxAPI.map.zoomControl.getMaxZoom();
				control.zoom.rHeight = control.zoom.rulerHeight * (maxZ - minZ + 1);
				control.zoom.Rulers.style.height = control.zoom.rHeight + 'px';
				control.zoom.RulersBG.style.height = (control.zoom.rHeight + 13) + 'px';
			}
			,
			'setZoom': function(z) {
				var minZ = gmxAPI.map.zoomControl.getMinZoom();
				var maxZ = gmxAPI.map.zoomControl.getMaxZoom();
				var currZoom = control.zoom.currZoom = z;
				if(currZoom < minZ) currZoom = minZ;
				else if(currZoom > maxZ) currZoom = maxZ;
				var py = Math.floor((currZoom - minZ) * control.zoom.rulerHeight);
				control.zoom.pointerCurrent.style.bottom = (py - control.zoom.rHeight + 3) + 'px';
				control.zoom.zoomVal.innerHTML = currZoom;
			}
			,
			'getRulersZoom': function(y) {
				var minZ = gmxAPI.map.zoomControl.getMinZoom();
				var maxZ = gmxAPI.map.zoomControl.getMaxZoom();
				var py = control.zoom.rHeight + control.zoom.rulerHeight * minZ - y;
				var z = Math.floor(py / control.zoom.rulerHeight) + 1;
				if(minZ > z) z = minZ;
				else if(maxZ < z) z = maxZ;
				return z;
			}
			,
			'setRulersPos': function(y) {
				var z = control.zoom.getRulersZoom(y);
				gmxAPI.map.zoomBy(z - control.zoom.currZoom);
				control.zoom.setZoom(z);
			}
			,
			'initControlsZoom': function() {
				this.control = document.getElementById("control3");
				this.Rulers = document.getElementById("Rulers");
				this.RulersClick = document.getElementById("RulersClick");
				this.RulersBG = document.getElementById("RulersBG");
				this.zoomMinus = document.getElementById("zoomMinus");
				this.zoomPlus = document.getElementById("zoomPlus");
				this.RulersCont = document.getElementById("RulersCont");
				this.pointerCurrent = document.getElementById("pointerCurrent");
				this.zoomVal = document.getElementById("zoomVal");

				RulersBG.onclick = function(e) {
					control.zoom.setRulersPos(e.layerY);
				}

				zoomMinus.onclick = function(e) {
					gmxAPI.map.zoomBy(-1);
				}
				
				zoomPlus.onclick = function(e) {
					gmxAPI.map.zoomBy(1);
				}
				// drag бегунка
				control.zoom.pointerCurrent.onmousedown = function(e) {
					var layerPos = e.clientY - e.layerY;
					control.zoom.pointerCurrent.style.pointerEvents = 'none';
					control.zoom.RulersClick.onmousemove = function(e) {
						var z = control.zoom.getRulersZoom(e.layerY);
						var dz = control.zoom.currZoom - z;
						if(dz == 0 || Math.abs(dz) > 2) return;
						control.zoom.setZoom(z);
					}
				}
				document.onmouseup = function(e) {
					if(control.zoom.RulersClick.onmousemove) {
						control.zoom.RulersCont.style.display = '';
						var mz = gmxAPI.map.getZ();
						var dz = control.zoom.currZoom - gmxAPI.map.getZ();
						if(dz != 0) gmxAPI.map.zoomBy(dz);
						//control.zoom.setZoom(z);
					}
					control.zoom.RulersClick.onmousemove = null;
					control.zoom.pointerCurrent.style.pointerEvents = 'auto';
				}
				var chkZoom = function() {
					control.zoom.currZoom = gmxAPI.map.getZ();
					control.zoom.setRulerSize();
					control.zoom.setZoom(control.zoom.currZoom);
				};
				gmxAPI._listeners.addListener({'eventName': 'onZoomend', 'func': chkZoom});

				control.zoom.control.onmouseover = function(e) {
					control.zoom.RulersCont.style.display = 'block';
				}
				control.zoom.control.onmouseout = function(e) {
					if(!control.zoom.RulersClick.onmousemove) control.zoom.RulersCont.style.display = '';
				}
				chkZoom();
			}
		}
		,
		'skipClassNames': {
			'icon': true
			//,'Hover': true
			,'Select': true
		}
		,
		'getClassNamesHash': function(st) {
			var out = {'hash':{}, 'type':'', 'select': false, 'hover': false};
			var matches = st.split(' ');
			for(var i=0, len = matches.length; i<len; i++) {
				var key = matches[i];
				out['hash'][key] = true;
				if(key === 'Hover') out['hover'] = true;
				else if(!this.skipClassNames[key]) {
					if(key.indexOf('Select') !== -1) {
						out['select'] = true;
						key = key.replace(/Select/, '');
					}
					out['type'] = key;
				}
			}
			return out;
		}
		/*,
		'getItemName': function(hash) {
			for(var key in hash) if(!control.skipClassNames[key]) return key;
			return '';
		}*/
		,
		'setClassNamesFromHash': function(tnode, hash) {
			var arr = [];
			for(var key in hash) arr.push(key);
			tnode.className = arr.join(' ');
		}
		,
		'select': function(dnode) {
			var source = control.getClassNamesHash(dnode.className);
			if(source['type']) {
				var isMult = (source['select'] ? 'Select':'');
				var key = source['type'];
				var keyOrig = key + isMult + (source['hover'] ? 'Hover':'');
				delete source['hash'][keyOrig];
				if(!source['hover']) {									// Переключение режима
					var pnode = dnode.parentNode.parentNode;
					var target = control.getClassNamesHash(pnode.className);
					var key = target['type'];
					if(key) {
						if(target['select']) isMult = 'Select';
						var keyOrig = key + (target['select'] ? 'Select':'') + (target['hover'] ? 'Hover':'');
						delete target['hash'][keyOrig];
						target['hash'][key + isMult + 'Hover'] = true;
					}
					control.setClassNamesFromHash(dnode, target['hash']);
					source['hash'][source['type'] + isMult + 'Hover'] = true;
					control.setClassNamesFromHash(pnode, source['hash']);
				} else {													// Отключение режима
					var key = source['type'];
					key = key.replace(/Hover/, '');
					source['hash'][key] = true;
					control.setClassNamesFromHash(dnode, source['hash']);
				}
			}
		}
		,
		'drawing': {
			'initControlsDrawing': function() {
				var currentlyDrawnObject = null;
				
				var drawCurrent = document.getElementById("drawCurrent");
				var deselectDrawCurrent = function(node) {
					if(!node) node = drawCurrent;
					var source = control.getClassNamesHash(drawCurrent.className);
					if(currentlyDrawnObject && 'stopDrawing' in currentlyDrawnObject) currentlyDrawnObject.stopDrawing();
					currentlyDrawnObject = null;
					gmxAPI._drawing.endDrawing();
					delete source['hash']['Hover'];
					control.setClassNamesFromHash(drawCurrent, source['hash']);
				}
				gmxAPI.map.drawing.addListener('onFinish', function(it) {
					if(it.geometry && it.geometry.type === 'POINT') {
						var source = control.getClassNamesHash(drawPoint.className);
						if(currentlyDrawnObject && 'stopDrawing' in currentlyDrawnObject) currentlyDrawnObject.stopDrawing();
						currentlyDrawnObject = null;
						gmxAPI._drawing.endDrawing();
						delete source['hash']['Hover'];
						control.setClassNamesFromHash(drawPoint, source['hash']);
					} else {
						deselectDrawCurrent();
					}
				});

				var drawPoint = document.getElementById("drawPoint");
				drawPoint.onclick = function(e) {
					var source = control.getClassNamesHash(drawPoint.className);
					if(source['hover']) {
						if(currentlyDrawnObject && 'stopDrawing' in currentlyDrawnObject) currentlyDrawnObject.stopDrawing();
						currentlyDrawnObject = null;
						gmxAPI._drawing.endDrawing();
						delete source['hash']['Hover'];
						control.setClassNamesFromHash(drawPoint, source['hash']);
					} else {
						source['hash']['Hover'] = true;
						control.setClassNamesFromHash(drawPoint, source['hash']);
						currentlyDrawnObject = gmxAPI._drawFunctions['POINT']();
					}
				};
				
				drawCurrent.onclick = function(e) {
					var source = control.getClassNamesHash(drawCurrent.className);
					if(source['hover']) {
						deselectDrawCurrent();
					} else {
						source['hash']['Hover'] = true;
						control.setClassNamesFromHash(drawCurrent, source['hash']);
						var type = source['type'];
						if(type === 'Line') {
							currentlyDrawnObject = gmxAPI._drawFunctions['LINESTRING']();
						} else if(type === 'Allocate') {
							currentlyDrawnObject = gmxAPI._drawFunctions['FRAME']();
							//currentlyDrawnObject = gmxAPI._drawFunctions['POLYGON']();
						}
					}
				}

				var draw1 = document.getElementById("draw1");
				draw1.onclick = function(e) {
					var sourceDraw1 = control.getClassNamesHash(draw1.className);
					var sourceCurrent = control.getClassNamesHash(drawCurrent.className);
					var type = sourceDraw1['type'];

					sourceDraw1['hash']['Hover'] = true;
					delete sourceDraw1['hash'][type];
					sourceDraw1['hash'][type + 'Select'] = true;
					control.setClassNamesFromHash(drawCurrent, sourceDraw1['hash']);

					var type1 = sourceCurrent['type'];
					delete sourceCurrent['hash']['Hover'];
					sourceCurrent['hash'][type1] = true;
					control.setClassNamesFromHash(draw1, sourceCurrent['hash']);
					if(type === 'Line') {
						currentlyDrawnObject = gmxAPI._drawFunctions['LINESTRING']();
					} else if(type === 'Allocate') {
						currentlyDrawnObject = gmxAPI._drawFunctions['FRAME']();
					}
				}
			}
		}
	};
	if(!window.gmxAPI) window.gmxAPI = {};
	window.gmxAPI.control = control;
})();
