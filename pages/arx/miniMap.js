//Поддержка miniMap
(function()
{
	var miniMapInit = function(div)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var map = gmxAPI.map;

		var miniMapBorderWidth = 5;
		var miniMapLeftBorder = gmxAPI.newStyledDiv({
			position: "absolute",
			top: 0,
			width: miniMapBorderWidth + "px",
			backgroundColor: "#216B9C",
			opacity: 0.5
		});
		var miniMapBottomBorder = gmxAPI.newStyledDiv({
			position: "absolute",
			right: 0,
			height: miniMapBorderWidth + "px",
			backgroundColor: "#216B9C",
			opacity: 0.5,
			fontSize: 0
		});
		div.appendChild(miniMapLeftBorder);
		div.appendChild(miniMapBottomBorder);
		var repaintMiniMapBorders = function()
		{
			gmxAPI.setVisible(miniMapLeftBorder, gmxAPI.miniMapAvailable && miniMapShown);
			gmxAPI.setVisible(miniMapBottomBorder, gmxAPI.miniMapAvailable && miniMapShown);
		}
		var miniMapFrame = gmxAPI.newStyledDiv({
			position: "absolute",
			backgroundColor: "#216b9c",
			opacity: 0.2
		});
		miniMapFrame.onmousedown = function(event)
		{
			var startMouseX = gmxAPI.eventX(event);
			var startMouseY = gmxAPI.eventY(event);
			
			var currPos = gmxAPI.currPosition || map.getPosition();
			var startMapX = currPos['x'];
			var startMapY = currPos['y'];

			var scale = gmxAPI.getScale(miniMapZ);
			
			var mouseMoveMode = new gmxAPI._HandlerMode(document.documentElement, "mousemove", function(event)
			{
				map.moveTo(
					gmxAPI.from_merc_x(startMapX - (gmxAPI.eventX(event) - startMouseX)*scale), 
					gmxAPI.from_merc_y(startMapY + (gmxAPI.eventY(event) - startMouseY)*scale), 
					map.getZ()
				);
				return false;
			});
			var mouseUpMode = new gmxAPI._HandlerMode(document.documentElement, "mouseup", function(event)
			{
				mouseMoveMode.clear();
				mouseUpMode.clear();
			});
			mouseMoveMode.set();
			mouseUpMode.set();
			return false;
		}
		div.appendChild(miniMapFrame);
		var repaintMiniMapFrame = function()
		{
			gmxAPI.setVisible(miniMapFrame, gmxAPI.miniMapAvailable && miniMapShown);
			var scaleFactor = Math.pow(2, map.getZ() - miniMapZ);
			var w = div.clientWidth/scaleFactor;
			var h = div.clientHeight/scaleFactor;
			if ((w >= miniMapSize) || (h >= miniMapSize))
				gmxAPI.setVisible(miniMapFrame, false);
			else
			{
				var ww = (miniMapSize/2 - w/2);
				var hh = (miniMapSize/2 - h/2);
				var ph = { 'top': hh + 'px', 'bottom': '', 'right': ww + 'px', 'left': '' };	// Позиция миникарты по умолчанию tr(TopRight)
				if(miniMapAlign === 'br') {		// Позиция миникарты br(BottomRight)
					ph['left'] = ''; ph['right'] = ww + 'px';
					ph['bottom'] = hh + 'px';	ph['top'] = '';
				} else if(miniMapAlign === 'bl') {	// Позиция миникарты по умолчанию bl(BottomLeft)
					ph['left'] = ww + 'px';		ph['right'] = '';
					ph['bottom'] = hh + 'px';	ph['top'] = '';
				} else if(miniMapAlign === 'tl') {	// Позиция миникарты по умолчанию tl(TopLeft)
					ph['left'] = (miniMapSize/2 - w/2) + 'px'; ph['right'] = '';
				}
				gmxAPI.setPositionStyle(miniMapFrame, ph);
				gmxAPI.size(miniMapFrame, w, h);
			}
		}
		var miniMapZ = 0;
		//var miniMapAvailable = false;
		var miniMapSize = 0;
		var miniMap = map.addMapWindow(function(z) 
		{ 
			var minZoom = ('zoomControl' in gmxAPI.map ? gmxAPI.map.zoomControl.getMinZoom() : 1);
			miniMapZ = Math.max(minZoom, Math.min(gmxAPI.maxRasterZoom, z + gmxAPI.miniMapZoomDelta));
			try { repaintMiniMapFrame(); } catch (e) {
				gmxAPI.addDebugWarnings({'func': 'repaintMiniMapFrame', 'event': e});
			}
			return miniMapZ;
		});
		var miniMapShown = true;
		miniMap.setOpen = function(flag) 
		{
			miniMapShown = flag;
			miniMapToggler.src = apiBase + (miniMapShown ? "img/close_map_a.png" : "img/open_map_a.png");
			resizeMiniMap();
			gmxAPI._FMO.prototype.setVisible.call(map.miniMap, miniMapShown);
		}
		
		var miniMapToggler = gmxAPI.newElement(
			"img",
			{ 
				className: "gmx_miniMapToggler",
				src: apiBase + "img/close_map.png",
				title: gmxAPI.KOSMOSNIMKI_LOCALIZED("Показать/скрыть мини-карту", "Show/hide minimap"),
				onclick: function()
				{
					miniMapShown = !miniMapShown;
					miniMap.setOpen(miniMapShown);
				},
				onmouseover: function()
				{
					miniMapToggler.src = apiBase + (miniMapShown ? "img/close_map_a.png" : "img/open_map_a.png");
				},
				onmouseout: function()
				{
					miniMapToggler.src = apiBase + (miniMapShown ? "img/close_map.png" : "img/open_map.png");
				}
			},
			{
				position: "absolute",
				right: 0,
				top: 0,
				cursor: "pointer"
			}
		);
		div.appendChild(miniMapToggler);

		var resizeMiniMap = function()
		{
			var w = div.clientWidth;
			var h = div.clientHeight;
			miniMapSize = (gmxAPI.miniMapAvailable && miniMapShown) ? Math.round(w/7) : 0;
			miniMapLeftBorder.style.height = (miniMapSize + miniMapBorderWidth) + "px";
			miniMapBottomBorder.style.width = miniMapSize + "px";
			if(miniMapAlign === 'br') {			// Позиция миникарты br(BottomRight)
				miniMap.positionWindow((w - miniMapSize)/w, (h - miniMapSize)/h, 1, 1);
				gmxAPI.setPositionStyle(miniMapLeftBorder, { 'top': '', 'bottom': '0px', 'right': miniMapSize + 'px', 'left': '' });
				gmxAPI.setPositionStyle(miniMapBottomBorder, { 'top': '', 'bottom': miniMapSize + 'px', 'right': '0px', 'left': '' });
				gmxAPI.setPositionStyle(miniMapToggler, { 'top': '', 'bottom': '0px', 'right': '0px', 'left': '' });
			} else if(miniMapAlign === 'bl') {	// Позиция миникарты по умолчанию bl(BottomLeft)
				miniMap.positionWindow(0, (h - miniMapSize)/h, miniMapSize/w, 1);
				gmxAPI.setPositionStyle(miniMapLeftBorder, { 'top': '', 'bottom': '0px', 'right': '', 'left': miniMapSize + 'px' });
				gmxAPI.setPositionStyle(miniMapBottomBorder, { 'top': '', 'bottom': miniMapSize + 'px', 'right': '', 'left': '0px' });
				gmxAPI.setPositionStyle(miniMapToggler, { 'top': '', 'bottom': '0px', 'right': '', 'left': '0px' });
			} else if(miniMapAlign === 'tl') {	// Позиция миникарты по умолчанию tl(TopLeft)
				miniMap.positionWindow(0, 0, miniMapSize/w, miniMapSize/h);
				gmxAPI.setPositionStyle(miniMapLeftBorder, { 'top': '0px', 'bottom': '', 'right': '', 'left': miniMapSize + 'px' });
				gmxAPI.setPositionStyle(miniMapBottomBorder, { 'top': miniMapSize + 'px', 'bottom': '', 'right': '', 'left': '0px' });
				gmxAPI.setPositionStyle(miniMapToggler, { 'top': '0px', 'bottom': '', 'right': '', 'left': '0px' });
			} else {							// Позиция миникарты по умолчанию tr(TopRight)
				miniMap.positionWindow((w - miniMapSize)/w, 0, 1, miniMapSize/h);
				gmxAPI.setPositionStyle(miniMapLeftBorder, { 'top': '0px', 'bottom': '', 'right': miniMapSize + 'px', 'left': '' });
				gmxAPI.setPositionStyle(miniMapBottomBorder, { 'top': miniMapSize + 'px', 'bottom': '', 'right': '0px', 'left': '' });
				gmxAPI.setPositionStyle(miniMapToggler, { 'top': '0px', 'bottom': '', 'right': '0px', 'left': '' });
			}
			repaintMiniMapBorders();
			repaintMiniMapFrame();
		}
		gmxAPI._resizeMiniMap = resizeMiniMap;

		miniMap.setVisible = function(flag) 
		{ 
			gmxAPI._FMO.prototype.setVisible.call(map.miniMap, flag);
			//FlashMapObject.prototype.setVisible.call(map.miniMap, flag);
			gmxAPI.miniMapAvailable = flag;
			gmxAPI.setVisible(miniMapFrame, flag);
			gmxAPI.setVisible(miniMapToggler, flag);
			resizeMiniMap();
		}
		map.miniMap = miniMap;
		map.miniMap.isMiniMap = true;
		map.miniMap.setBackgroundColor(0xffffff);
		//miniMap.setVisible(false);
		var miniMapAlign = 'tr';
		// Изменить позицию miniMap
		map.setMiniMapAlign = function(attr) {
			if(attr['align']) miniMapAlign = attr['align'];
			resizeMiniMap();
		}
		map.addListener('onResizeMap', resizeMiniMap, -12);
		miniMap.setVisible(false);
	}

	gmxAPI._miniMapInit = miniMapInit;

})();
