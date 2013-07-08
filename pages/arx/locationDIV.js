//Поддержка - отображения строки текущего положения карты
(function()
{
	var addLocationTitleDiv = function(cont)
	{
		/** Добавить строку текущего положения карты
		* @function
		* @param {cont} контейнер в DOM модели для отображения строки, где будет показываться текущее положение карты
		*/
		var apiBase = gmxAPI.getAPIFolderRoot();
		gmxAPI.map.setLocationTitleDiv = null;
		var locationTitleDiv = gmxAPI.newElement(
			"div",
			{
			},
			{
			}
		);
		cont.appendChild(locationTitleDiv);
		gmxAPI._locationTitleDiv = locationTitleDiv;

		var coordinatesAttr = {
			'x': '27px'						// отступ по горизонтали
			,'y': '25px'					// по вертикали
			,'x1': '5px'					// отступ по горизонтали иконки смены формата координат
			,'scaleBar': {
				'bottom': {
					'x': '27px'				// отступ по горизонтали для scaleBar
					,'y': '47px'			// по вертикали
				}
				,'top': {
					'x': '27px'				// отступ по горизонтали для scaleBar
					,'y': '3px'				// по вертикали
				}
			}
		};

		var scaleBar = gmxAPI.newStyledDiv({
			position: "absolute",
			right: coordinatesAttr['scaleBar']['bottom']['x'],
			bottom: coordinatesAttr['scaleBar']['bottom']['y'],
			textAlign: "center"
		});
		scaleBar.className = "gmx_scaleBar";
		cont.appendChild(scaleBar);
		
		gmxAPI.map.scaleBar = { setVisible: function(flag) { gmxAPI.setVisible(scaleBar, flag); } };
		var scaleBarText, scaleBarWidth, oldZ;
		var repaintScaleBar = function()
		{
			if (scaleBarText)
			{
				gmxAPI.size(scaleBar, scaleBarWidth, 16);
				scaleBar.innerHTML = scaleBarText;
			}
		}
		var coordinates = gmxAPI.newElement(
			"div",
			{
				className: "gmx_coordinates",
				onclick: function()
				{
					if (coordFormat > 2) return; //выдаем окошко с координатами только для стандартных форматов.
					var oldText = getCoordinatesText();
					var text = window.prompt(gmxAPI.KOSMOSNIMKI_LOCALIZED("Текущие координаты центра карты:", "Current center coordinates:"), oldText);
					if (text && (text != oldText))
						gmxAPI.map.moveToCoordinates(text);
				}
			},
			{
				position: "absolute",
				right: coordinatesAttr['x'],
				bottom: coordinatesAttr['y'],
				cursor: "pointer"
			}
		);
		cont.appendChild(coordinates);

		var getCoordinatesText = function(currPos)
		{
			if(!currPos) currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
			var x = (currPos['latlng'] ? currPos['latlng']['x'] : gmxAPI.from_merc_x(currPos['x']));
			var y = (currPos['latlng'] ? currPos['latlng']['y'] : gmxAPI.from_merc_y(currPos['y']));
			if (x > 180) x -= 360;
			if (x < -180) x += 360;
			if (coordFormat%3 == 0)
				return gmxAPI.LatLon_formatCoordinates(x, y);
			else if (coordFormat%3 == 1)
				return gmxAPI.LatLon_formatCoordinates2(x, y);
			else
				return Math.round(gmxAPI.merc_x(x)) + ", " + Math.round(gmxAPI.merc_y(y));
		}

		var clearCoordinates = function()
		{
			for (var i = 0; i < coordinates.childNodes.length; i++)
				coordinates.removeChild(coordinates.childNodes[i]);
		}

		var coordFormatCallbacks = [		// методы формирования форматов координат
			function() { return getCoordinatesText(); },
			function() { return getCoordinatesText(); },
			function() { return getCoordinatesText(); },
		];

		var coordFormat = 0;
		var prevCoordinates = '';
		var setCoordinatesFormat = function(num, screenGeometry)
		{
			if(!num) num = coordFormat;
			if(num < 0) num = coordFormatCallbacks.length - 1;
			else if(num >= coordFormatCallbacks.length) num = 0;
			coordFormat = num;
			if(!screenGeometry) screenGeometry = gmxAPI.map.getScreenGeometry();
			var attr = {'screenGeometry': screenGeometry, 'properties': gmxAPI.map.properties };
			var res = coordFormatCallbacks[coordFormat](coordinates, attr);		// если есть res значит запомним ответ
			if(res && prevCoordinates != res) coordinates.innerHTML = res;
			prevCoordinates = res;
			gmxAPI._listeners.dispatchEvent('onSetCoordinatesFormat', gmxAPI.map, coordFormat);
		}

		var changeCoords = gmxAPI.newElement(
			"div", 
			{ 
				className: "gmx_changeCoords",
				title: gmxAPI.KOSMOSNIMKI_LOCALIZED("Сменить формат координат", "Toggle coordinates format"),
				onclick: function()
				{
					coordFormat += 1;
					setCoordinatesFormat(coordFormat);
				}
			},
			{
				position: "absolute",
				backgroundImage: 'url("'+apiBase + 'img/coord_reload.png")',
				width: '19px',
				height: '19px',
				right: coordinatesAttr['x1'],
				bottom: coordinatesAttr['y'],
				cursor: "pointer"
			}
		);
		cont.appendChild(changeCoords);

		gmxAPI.map.coordinates = {
			setVisible: function(flag) 
			{ 
				gmxAPI.setVisible(coordinates, flag); 
				gmxAPI.setVisible(changeCoords, flag); 
			}
			,
			addCoordinatesFormat: function(func) 
			{ 
				coordFormatCallbacks.push(func);
				return coordFormatCallbacks.length - 1;
			}
			,
			removeCoordinatesFormat: function(num) 
			{ 
				coordFormatCallbacks.splice(num, 1);
				return coordFormatCallbacks.length - 1;
			}
			,
			setFormat: setCoordinatesFormat
		}

		gmxAPI.map.setCoordinatesAlign = function(attr) {			// Изменить позицию контейнера координат
			var align = attr['align'];
			if(align === 'br') {		// Позиция br(BottomRight)
				gmxAPI.setPositionStyle(coordinates, { 'top': '', 'bottom': coordinatesAttr['y'], 'right': coordinatesAttr['x'], 'left': '' });
				gmxAPI.setPositionStyle(changeCoords, { 'top': '', 'bottom': coordinatesAttr['y'], 'right': coordinatesAttr['x1'], 'left': '' });
				gmxAPI.setPositionStyle(scaleBar, { 'top': '', 'bottom': coordinatesAttr['scaleBar']['bottom']['y'], 'right': coordinatesAttr['scaleBar']['bottom']['x'], 'left': '' });
			} else if(align === 'bl') {		// Позиция bl(BottomLeft)
				gmxAPI.setPositionStyle(coordinates, { 'top': '', 'bottom': coordinatesAttr['y'], 'right': '', 'left': coordinatesAttr['x'] });
				gmxAPI.setPositionStyle(changeCoords, { 'top': '', 'bottom': coordinatesAttr['y'], 'right': '', 'left': coordinatesAttr['x1'] });
				gmxAPI.setPositionStyle(scaleBar, { 'top': '', 'bottom': coordinatesAttr['scaleBar']['bottom']['y'], 'right': '', 'left': coordinatesAttr['scaleBar']['bottom']['x'] });
			} else if(align === 'tr') {		// Позиция tr(TopRight)
				gmxAPI.setPositionStyle(coordinates, { 'top': coordinatesAttr['y'], 'bottom': '', 'right': coordinatesAttr['x'], 'left': '' });
				gmxAPI.setPositionStyle(changeCoords, { 'top': coordinatesAttr['y'], 'bottom': '', 'right': coordinatesAttr['x1'], 'left': '' });
				gmxAPI.setPositionStyle(scaleBar, { 'top': coordinatesAttr['scaleBar']['top']['y'], 'bottom': '', 'right': coordinatesAttr['scaleBar']['top']['x'], 'left': '' });
			} else if(align === 'tl') {		// Позиция tl(TopLeft)
				gmxAPI.setPositionStyle(coordinates, { 'top': coordinatesAttr['y'], 'bottom': '', 'right': '', 'left': coordinatesAttr['x'] });
				gmxAPI.setPositionStyle(changeCoords, { 'top': coordinatesAttr['y'], 'bottom': '', 'right': '', 'left': coordinatesAttr['x1'] });
				gmxAPI.setPositionStyle(scaleBar, { 'top': coordinatesAttr['scaleBar']['top']['y'], 'bottom': '', 'right': '', 'left': coordinatesAttr['scaleBar']['top']['x'] });
			}
		}
		var getLocalScale = function(x, y)
		{
			return gmxAPI.distVincenty(x, y, gmxAPI.from_merc_x(gmxAPI.merc_x(x) + 40), gmxAPI.from_merc_y(gmxAPI.merc_y(y) + 30))/50;
		}

		var setCoordinatesFormatTimeout = false;
		// Добавление прослушивателей событий
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

			if (oldZ != z)
			{
				oldZ = z;
				var metersPerPixel = getLocalScale(x, y)*gmxAPI.getScale(z);
				for (var i = 0; i < 30; i++)
				{
					var distance = [1, 2, 5][i%3]*Math.pow(10, Math.floor(i/3));
					var w = distance/metersPerPixel;
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
			}
			if (setCoordinatesFormatTimeout) return;
			setCoordinatesFormatTimeout = setTimeout(function()
			{
				setCoordinatesFormat();
				clearTimeout(setCoordinatesFormatTimeout);
				setCoordinatesFormatTimeout = false;
			}, 250);
		}
		gmxAPI.map.addListener('positionChanged', checkPositionChanged);
		gmxAPI.map.addListener('onResizeMap', checkPositionChanged);

		gmxAPI._setCoordinatesColor = function(color, url, flag)
		{
			coordinates.style.fontSize = "14px";
			coordinates.style.color = color;
			scaleBar.style.border = "1px solid " + color;
			scaleBar.style.fontSize = "11px";
			scaleBar.style.color = color;
			changeCoords.style.backgroundImage = 'url("'+url+'")';
			if(flag) {
				checkPositionChanged();
			}
		}

	}
	gmxAPI._addLocationTitleDiv = addLocationTitleDiv;
})();
