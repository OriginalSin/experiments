//Поддержка KML
(function()
{
	var kmlParser = function()
	{
		this.hrefs = {};
		
		this.oldBalloon = false,
		this.oldBalloonIndex = -1;
		
		this.globalStyles = {};
		this.globalStylesMap = {};
		
		this.defaultStyles = 
		{
			'point':{outline:{color:0x0000FF, thickness:1},fill:{color:0xFFFFFF, opacity:20},marker:{size:3}},
			'linestring':{outline:{color:0x0000FF, thickness:1}},
			'polygon':{outline:{color:0x0000FF, thickness:1}}
		}
		
		this.counter = 0;
	}


	kmlParser.prototype.value = function(a) 
	{
		if (!a) {
			return "";
		}
		var b = "";
		if (a.nodeType == 3 || a.nodeType == 4 || a.nodeType == 2) {
			b += a.nodeValue;
		} else if (a.nodeType == 1 || a.nodeType == 9 || a.nodeType == 11) {
			for (var c = 0; c < a.childNodes.length; ++c) {
				b += arguments.callee(a.childNodes[c]);
			}
		}
		
		b = b.replace(/^\s*/,"");
		b = b.replace(/\s*$/,"");
		
		return b;
	}

	kmlParser.prototype.get = function(url, callback, map)
	{
		var _this = this;
		this.globalFlashMap = map;
		var urlProxyServer = 'http://' + gmxAPI.serverBase + '/';
		var _hostname = urlProxyServer + "ApiSave.ashx?debug=1&get=" + encodeURIComponent(url);
		sendCrossDomainJSONRequest(_hostname, function(response)
		{
			if(typeof(response) != 'object' || response['Status'] != 'ok') {
				callback(null);
				gmxAPI.addDebugWarnings({'_hostname': _hostname, 'url': url, 'Error': 'bad response'});
				return;
			}
			var parsed = _this.parse(response['Result']);
			parsed.url = url;
			callback(parsed);
		})
	}

	kmlParser.prototype.parse = function(response)
	{
		var strResp = response.replace(/[\t\n\r]/g, ' '),
			strResp = strResp.replace(/\s+/g, ' '),
			xml = gmxAPI.parseXML(strResp),
			vals = [];

		
		this.globalStyles = {};
		this.globalStylesMap = {};
		
		var styles = xml.getElementsByTagName("Style");
		for (var i = 0; i < styles.length; i++) 
		{
			var styleID = styles[i].getAttribute("id");
			
			if (styleID)
				this.globalStyles['#' + styleID] = this.parseStyle(styles[i]);
		}
		
		var stylesMap = xml.getElementsByTagName("StyleMap");
		for (var i = 0; i < stylesMap.length; i++) 
		{
			var styleID = stylesMap[i].getAttribute("id");
			
			if (styleID)
				this.globalStylesMap['#' + styleID] = this.parseStyleMap(stylesMap[i]);
		}
		
		var placemarks = xml.getElementsByTagName("Placemark");
		for (var i = 0; i < placemarks.length; i++) 
		{
			var val = this.parsePlacemark(placemarks[i])
			
			if (val)
				vals.push(val)
		}
		
		var firstNode = xml.getElementsByTagName('Document')[0];
		var name = false,
			documentChilds = (firstNode ? firstNode.childNodes : []);
		
		for (var i = 0; i < documentChilds.length; ++i)
		{
			if (documentChilds[i].nodeName == 'name')
			{
				name = this.value(documentChilds[i]);
				
				break;
			}
		}
		
		if (!name)
			name = 'KML' + (++this.counter);
		
		var res = {vals: vals, name: name}
		
		return res;
	}

	kmlParser.prototype.parseStyle = function(elem)
	{
		var style = false,
			icons = elem.getElementsByTagName("Icon");
				
		if (icons.length > 0) 
		{
			var href = this.value(icons[0].getElementsByTagName("href")[0]);

			if (!!href) {
				var urlProxyServer = 'http://' + gmxAPI.serverBase + '/';
				href = urlProxyServer + "ImgSave.ashx?now=true&get=" + encodeURIComponent(href);

				style = {marker: {image: href, center: true}}
			}
			else
				style = {marker: {size: 3}, outline:{color:0x0000FF, thickness:1}, fill:{color:0xFFFFFF, opacity:20}}
		}

		var linestyles = elem.getElementsByTagName("LineStyle");
		if (linestyles.length > 0) 
		{
			var width = parseInt(this.value(linestyles[0].getElementsByTagName("width")[0]));
			
			if (width < 1 || isNaN(width)) 
				width = 5;
			
			var color = this.value(linestyles[0].getElementsByTagName("color")[0]),
				aa = color.substr(0,2),
				bb = color.substr(2,2),
				gg = color.substr(4,2),
				rr = color.substr(6,2);
			
			if (!style)
				style = {};
			
			style.outline = {color: isNaN(parseInt('0x' + rr + gg + bb)) ? 0 : parseInt('0x' + rr + gg + bb), thickness: width, opacity: isNaN(parseInt(aa,16)) ? 0 : parseInt(aa,16) / 256};
		}
		
		var polystyles = elem.getElementsByTagName("PolyStyle");
		if (polystyles.length > 0) 
		{
			var fill = parseInt(this.value(polystyles[0].getElementsByTagName("fill")[0])),
				outline = parseInt(this.value(polystyles[0].getElementsByTagName("outline")[0])),
				color = this.value(polystyles[0].getElementsByTagName("color")[0]),
				aa = color.substr(0,2),
				bb = color.substr(2,2),
				gg = color.substr(4,2),
				rr = color.substr(6,2);

			if (polystyles[0].getElementsByTagName("fill").length == 0) 
				fill = 1;
			
			if (polystyles[0].getElementsByTagName("outline").length == 0)
				outline = 1;
			
			if (!style)
				style = {};
			
			style.fill = {color: isNaN(parseInt('0x' + rr + gg + bb)) ? 0 : parseInt('0x' + rr + gg + bb), opacity: isNaN(parseInt(aa,16)) ? 0 : parseInt(aa,16) / 256}

			if (!fill)
				style.fill.opacity = 0;
			
			if (!outline)
				style.outline.opacity = 0;
		}
		
		return style;
	}

	kmlParser.prototype.parseStyleMap = function(elem)
	{
		var pairs = elem.getElementsByTagName('Pair'),
			res = {};
		
		for (var i = 0; i < pairs.length; ++i)
		{
			var key = this.value(pairs[i].getElementsByTagName('key')[0]),
				styleID = this.value(pairs[i].getElementsByTagName('styleUrl')[0]);
			
			if (this.globalStyles[styleID])
				res[key] = this.globalStyles[styleID];
		}
		
		return res;
	}

	kmlParser.prototype.convertCoords = function(coordsStr)
	{
		var res = [],
			coordsPairs = gmxAPI.strip(coordsStr).replace(/[\t\n\r\s]/g,' ').replace(/\s+/g, ' ').replace(/,\s/g, ',').split(' ');
		
		if (coordsStr.indexOf(',') == -1)
		{
			for (var j = 0; j < Math.floor(coordsPairs.length / 2); j++)
				res.push([Number(coordsPairs[2 * j]), Number(coordsPairs[2 * j + 1])])
		}
		else
		{
			for (var j = 0; j < coordsPairs.length; j++)
			{
				var parsedCoords = coordsPairs[j].split(',');
				
				res.push([Number(parsedCoords[0]), Number(parsedCoords[1])])
			}
		}
		
		return res;
	}

	kmlParser.prototype.parsePlacemark = function(elem)
	{
		var placemark = {items:[]},
			name = this.value(elem.getElementsByTagName("name")[0]),
			desc = this.value(elem.getElementsByTagName("description")[0]);
		
		if (desc == "") 
		{
			var desc = this.value(elem.getElementsByTagName("text")[0]);
			desc = desc.replace(/\$\[name\]/,name);
			desc = desc.replace(/\$\[geDirections\]/,"");
		}
		
		if (desc.match(/^http:\/\//i) || desc.match(/^https:\/\//i))
			desc = '<a href="' + desc + '">' + desc + '</a>';
		
		placemark.name = name;
		placemark.desc = desc;
		
		var style = this.value(elem.getElementsByTagName("styleUrl")[0]),
			points = elem.getElementsByTagName('Point'),
			lines = elem.getElementsByTagName('LineString'),
			polygones = elem.getElementsByTagName('Polygon');
		
		for (var i = 0; i < points.length; i++)
		{
			var coords = this.value(points[i].getElementsByTagName('coordinates')[0]),
				convertedCoords = this.convertCoords(coords),
				item = {};
			
			item.geometry = {type: 'POINT', coordinates: convertedCoords[0]}
			
			if (this.globalStyles[style])
				item.style = {normal:this.globalStyles[style]}
			else if (this.globalStylesMap[style])
				item.style = this.globalStylesMap[style]
			else
				item.style = {normal:this.defaultStyles['point']}
			
			placemark.items.push(item);
		}
		
		for (var i = 0; i < lines.length; i++)
		{
			var coords = this.value(lines[i].getElementsByTagName('coordinates')[0]),
				convertedCoords = this.convertCoords(coords),
				item = {};
			
			item.geometry = {type: 'LINESTRING', coordinates: convertedCoords}
			
			if (this.globalStyles[style])
				item.style = {normal:this.globalStyles[style]}
			else if (this.globalStylesMap[style])
				item.style = this.globalStylesMap[style]
			else
				item.style = {normal:this.defaultStyles['linestring']}
			
			placemark.items.push(item);
		}
		
		for (var i = 0; i < polygones.length; i++)
		{
			var coords = [],
				outerCoords = polygones[i].getElementsByTagName('outerBoundaryIs'),
				innerCoords = polygones[i].getElementsByTagName('innerBoundaryIs'),
				resultCoords = [],
				item = {};
			
			if (outerCoords.length)
				coords.push(this.value(outerCoords[0].getElementsByTagName('coordinates')[0]));
			
			if (innerCoords.length)
				coords.push(this.value(innerCoords[0].getElementsByTagName('coordinates')[0]));
			
			for (var index = 0; index < coords.length; index++)
				resultCoords.push(this.convertCoords(coords[index]))
			
			item.geometry = {type: 'POLYGON', coordinates: resultCoords}
			
			if (this.globalStyles[style])
				item.style = {normal:this.globalStyles[style]}
			else if (this.globalStylesMap[style])
				item.style = this.globalStylesMap[style]
			else
				item.style = {normal:this.defaultStyles['polygon']}
			
			placemark.items.push(item);
		}
		
		return placemark;
	}

	kmlParser.prototype.draw = function(vals, parent)
	{
		var bounds = gmxAPI.getBounds(),
			loadingIcons = {},
			_this = this;
		var needBalloonsArray = [];
		var needHandlersArray = [];

		function getItem(parent, item, flag, name, desc) {
			var props = {};
			if(name) props['name'] = name;
			if(desc) props['desc'] = desc;
			var tmp = {
				"geometry": item['geometry'],
				"properties": props
			};
			if (item.style.normal)
			{
				var style = ''; 
				if (item.geometry.type == 'POINT')
				{
					style = item.style.normal;
				}
				else
					style = _this.removeMarkerStyle(item.style.normal);


				tmp['setStyle'] = {'regularStyle': style};
			}
			return tmp;
		}

		function getItems(vals) {
			var out = [];
			for (var i = 0; i < vals.length; ++i)
			{
				if (vals[i].items.length == 1)
				{
					var item = vals[i].items[0];
					out.push(getItem(parent, item, true, vals[i].name, vals[i].desc));
					bounds.update(item.geometry.coordinates);
				}
				else
				{
					var point = false;
					for (var j = 0; j < vals[i].items.length; ++j)
					{
						if (!point && vals[i].items[j].geometry.type == 'POINT') {
							point = vals[i].items[j];
						}
						else {
							var item = vals[i].items[j];
							out.push(getItem(parent, item, false, vals[i].name, vals[i].desc));
							bounds.update(item.geometry.coordinates);
							if (item.geometry.type != 'POINT')
							{
								out.push(getItem(parent, item, false, vals[i].name, vals[i].desc));
							}
						}
					}
					if(point) {
						out.push(getItem(parent, point, false, vals[i].name, vals[i].desc));
						bounds.update(point.geometry.coordinates);
					}
				}
			}
			return out;
		}
		var out = getItems(vals);
		var fobjArray = parent.addObjects(out);

		for (var j = 0; j < fobjArray.length; ++j)
		{
			var elem = fobjArray[j];
			var item = out[j];
			if (item.properties['name']) {
				elem.enableHoverBalloon(function(o)
				{
					var st = "<div style=\"margin-bottom: 10px;font-size:12px;color:#000;\" >" + o.properties['name'] + "</div>";
					if(o.properties['desc']) st += '<br>' + o.properties['desc'];
					return st;
				});
			}
		}
		return {parent: parent, bounds: bounds};
	}

	kmlParser.prototype.removeMarkerStyle = function(style)
	{
		var newStyle = {};
		
		if (style.outline)
			newStyle.outline = style.outline;
		
		if (style.fill)
			newStyle.fill = style.fill;

		return newStyle;
	}

	kmlParser.prototype.createBalloon = function(obj, htmlContent)
	{
		if (this.oldBalloon)
			this.oldBalloon.remove();
		
		if (this.oldBalloonIndex == obj.objectId)
		{
			this.oldBalloonIndex = -1;
			this.oldBalloon = false;
			return false;
		}
		
		var coords = obj.getGeometry().coordinates,
			_this = this;
			
		this.oldBalloon = this.globalFlashMap.addBalloon();
		this.oldBalloon.setPoint(coords[0], coords[1]);
		this.oldBalloon.div.appendChild(htmlContent);
		
		var remove = gmxAPI.makeImageButton("img/close.png", "img/close_orange.png");
		remove.onclick = function()
		{
			_this.oldBalloon.remove();
			_this.oldBalloonIndex = -1;
			_this.oldBalloon = false;
		}
		
		remove.style.position = 'absolute';
		remove.style.right = '9px';
		remove.style.top = '5px';
		remove.style.cursor = 'pointer';
		
		this.oldBalloon.div.appendChild(remove);
		this.oldBalloon.resize();
		this.oldBalloonIndex = obj.objectId;
		return true;
	}

	kmlParser.prototype.drawItem = function(parent, item, flag, name, desc)
	{
		var elem = parent.addObject();
		elem.setGeometry(item.geometry);
		
		if (item.style.normal)
		{
			if (item.geometry.type == 'POINT')
			{
				if (typeof item.style.normal.marker.image != 'undefined' &&
					typeof this.hrefs[item.style.normal.marker.image] == 'undefined')
					elem.setStyle(this.defaultStyles['point']);
				else
				{
					item.style.normal.marker.image = this.hrefs[item.style.normal.marker.image];
					
					if (item.style.normal.marker.fill)
						delete item.style.normal.marker.fill;
		
					if (item.style.normal.marker.outline)
						delete item.style.normal.marker.outline;
					
					elem.setStyle(item.style.normal);
				}
			}
			else
				elem.setStyle(this.removeMarkerStyle(item.style.normal));
		}

		if (flag)
		{
			elem.enableHoverBalloon(function(o)
			{
				return "<div style=\"margin-bottom: 10px;font-size:12px;color:#000;\" >" + name + "</div>" + desc;
			});
		}
		
		return elem;
	}

    //расширяем namespace
    gmxAPI._kmlParser = new kmlParser();

    //расширяем FlashMapObject
	gmxAPI.extendFMO('loadKML', function(url, func)
		{
			var me = this;
			gmxAPI._kmlParser.get(url, function(result)
			{
				if(result) gmxAPI._kmlParser.draw(result.vals, me);
				if (func)
					func(result);
			}, gmxAPI.map);
		}
	);

})();