//Поддержка copyright
(function()
{
	var addCopyrightControl = function(cont)
	{
		var map = gmxAPI.map;
		// Begin: Блок управления копирайтами
		var copyrightAttr = {
			'x': '26px'					// отступ по горизонтали
			,'y': '7px'					// отступ по вертикали
		};
		var copyright = gmxAPI.newElement(
			"span",
			{
				className: "gmx_copyright"
			},
			{
				position: "absolute",
				right: copyrightAttr['x'],
				bottom: copyrightAttr['y']
			}
		);
		gmxAPI._setCopyrightColor = function(color)
		{
			copyright.style.fontSize = "11px";
			copyright.style.color = color;
		};

		var copyrightAlign = '';
		cont.appendChild(copyright);
		// Изменить позицию контейнера копирайтов
		map.setCopyrightAlign = function(attr) {
			if(attr['align']) {
				copyrightAlign = attr['align'];
			}
			copyrightPosition();
		}
		var copyrightedObjects = [];
		map.addCopyrightedObject = function(obj)
		{
			var exists = false;
			for (var i = 0; i < copyrightedObjects.length; i++)
				if (copyrightedObjects[i] == obj)
				{
					exists = true;
					break;
				}
				
			if (!exists)
			{
				copyrightedObjects.push(obj);
				map.updateCopyright();
			}
			
		}
		map.removeCopyrightedObject = function(obj)
		{
			var foundID = -1;
			for (var i = 0; i < copyrightedObjects.length; i++)
				if (copyrightedObjects[i] == obj)
				{
					foundID = i;
					break;
				}
				
			if ( foundID >= 0 )
			{
				copyrightedObjects.splice(foundID, 1);
				map.updateCopyright();
			}
				
			
		}
		
		var copyrightLastAlign = null;

		// Изменить координаты HTML элемента
		function copyrightPosition()
		{
			var center = (cont.clientWidth - copyright.clientWidth) / 2;
			if(copyrightLastAlign != copyrightAlign) {
				copyrightLastAlign = copyrightAlign;
				if(copyrightAlign === 'bc') {				// Позиция bc(BottomCenter)
					gmxAPI.setPositionStyle(copyright, { 'top': '', 'bottom': copyrightAttr['y'], 'right': '', 'left': center + 'px' });
				} else if(copyrightAlign === 'br') {		// Позиция br(BottomRight)
					gmxAPI.setPositionStyle(copyright, { 'top': '', 'bottom': copyrightAttr['y'], 'right': copyrightAttr['x'], 'left': '' });
				} else if(copyrightAlign === 'bl') {		// Позиция bl(BottomLeft)
					gmxAPI.setPositionStyle(copyright, { 'top': '', 'bottom': copyrightAttr['y'], 'right': '', 'left': copyrightAttr['x'] });
				} else if(copyrightAlign === 'tc') {		// Позиция tc(TopCenter)
					gmxAPI.setPositionStyle(copyright, { 'top': '0px', 'bottom': '', 'right': '', 'left': center + 'px' });
				} else if(copyrightAlign === 'tr') {		// Позиция tr(TopRight)
					gmxAPI.setPositionStyle(copyright, { 'top': '0px', 'bottom': '', 'right': copyrightAttr['x'], 'left': '' });
				} else if(copyrightAlign === 'tl') {		// Позиция tl(TopLeft)
					gmxAPI.setPositionStyle(copyright, { 'top': '0px', 'bottom': '', 'right': '', 'left': copyrightAttr['x'] });
				}
			}
		}

		map.updateCopyright = function()
		{
			var currPos = gmxAPI.currPosition || map.getPosition();
			if(!currPos['latlng']) return;
			var x = currPos['latlng']['x'];
			var y = currPos['latlng']['y'];
			var texts = {};
			for (var i = 0; i < copyrightedObjects.length; i++)
			{
				var obj = copyrightedObjects[i];
				if (obj.copyright && obj.objectId && obj.getVisibility())
				{
					if (obj.geometry)
					{
						var bounds = obj.bounds || gmxAPI.getBounds(obj.geometry.coordinates);
						if ((x < bounds.minX) || (x > bounds.maxX) || (y < bounds.minY) || (y > bounds.maxY))
							continue;
					}
					texts[obj.copyright] = true;
				}
			}
			
			//первым всегда будет располагаться копирайт СканЭкс. 
			//Если реализовать возможность задавать порядок отображения копирайтов, можно тоже самое сделать более культурно...
			var text = "<a target='_blank' style='color: inherit;' href='http://maps.kosmosnimki.ru/Apikey/License.html'>&copy; 2007-2013 " + gmxAPI.KOSMOSNIMKI_LOCALIZED("&laquo;СканЭкс&raquo;", "RDC ScanEx") + "</a>";
			
			for (var key in texts)
			{
				if (text != "")
					text += " ";
				text += key.split("<a").join("<a target='_blank' style='color: inherit;'");
			}
			if(gmxAPI.proxyType == 'leaflet') text += " <a target='_blank' style='color: inherit;' href='http://leafletjs.com'>&copy; Leaflet</a>";

			copyright.innerHTML = text;
			if(copyrightAlign) {
				copyrightPosition();
			}
		}

		var copyrightUpdateTimeout = false;
		// Добавление прослушивателей событий
		gmxAPI.map.addListener('positionChanged', function(ph)
			{
				if (copyrightUpdateTimeout) return;
				copyrightUpdateTimeout = setTimeout(function()
				{
					map.updateCopyright();
					clearTimeout(copyrightUpdateTimeout);
					copyrightUpdateTimeout = false;
				}, 250);
			}
		);

		// End: Блок управления копирайтами
	}
	gmxAPI._addCopyrightControl = addCopyrightControl;
})();
