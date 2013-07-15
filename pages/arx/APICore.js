/** Пространство имён GeoMixer API
* @name gmxAPI
* @namespace
*/

/** Описание API JS 
* @name api
* @namespace
*/

(function()
{

var memoize = function(func)
	{
		var called = false;
		var result;
		return function()
		{
			if (!called)
			{
				result = func();
				called = true;
			}
			return result;
		}
	};

window.PI = 3.14159265358979; //устарело - обратная совместимость
window.gmxAPI = {
    mousePressed: false							// Флаг мышь нажата
	,
    APILoaded: false							// Флаг возможности использования gmxAPI сторонними модулями
	,
    initParams: null							// Параметры заданные при создании карты 
	,
    buildGUID: [/*#buildinclude<__buildGUID__>*/][0]		// GUID текущей сборки
	,
	'getXmlHttp': function() {
		var xmlhttp;
		if (typeof XMLHttpRequest != 'undefined') {
			xmlhttp = new XMLHttpRequest();
		}
		if (!xmlhttp) {
			try {
				xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
			} catch (e) {
				try {
					xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
				} catch (E) {
					xmlhttp = false;
				}
			}
		}
		return xmlhttp;
	}
	,
	'request': function(ph) {	// {'type': 'GET|POST', 'url': 'string', 'callback': 'func'}
	  try {
		var xhr = gmxAPI.getXmlHttp();
		xhr.withCredentials = true;
		xhr.open((ph['type'] ? ph['type'] : 'GET'), ph['url'], true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
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
	'createMap': function(div, ph)
	{
		var hostName = ph['hostName'] || getAPIHost();
		var mapName = ph['mapName'] || 'DefaultMap';
		var callback = ph['callback'] || function(){};
		gmxAPI.initParams = ph;
		createFlashMap(div, hostName, mapName, callback);
		return true;
	}
	,
	'getSQLFunction':	function(sql)	{					// Получить функцию по SQL выражению
		return (gmxAPI.Parsers ? gmxAPI.Parsers.parseSQL(sql) : null);
	}
	,
	'parseSQL': function(sql)	{							// парсинг SQL строки
		var zn = sql;
		if(typeof(zn) === 'string') {
			zn = zn.replace(/ AND /g, ' && ');
		}
		return zn
	}
	,
	'chkPropsInString': function(str, prop, type)	{							// парсинг значений свойств в строке
		var zn = str;
		if(typeof(zn) === 'string') {
			var reg = (type ? /\"([^\"]+)\"/i : /\[([^\]]+)\]/i);
			var matches = reg.exec(zn);
			while(matches && matches.length > 1) {
				zn = zn.replace(matches[0], prop[matches[1]]);
				matches = reg.exec(zn);
			}
			zn = eval(zn);
		}
		return zn
	}
	,
	clone: function (o, level)
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
					c[p] = (level < 100 ? gmxAPI.clone(v, level + 1) : 'object');
				}
				else {
					c[p] = (type === 'function' ? 'function' : v);
				}
			}
		}
		return c;
	}
	,
	KOSMOSNIMKI_LOCALIZED: function (rus, eng)
	{
		return (window.KOSMOSNIMKI_LANGUAGE == "English") ? eng : rus;
	}
	,
	setStyleHTML: function(elem, style, setBorder)
	{
		if(!elem) return false;
		if(setBorder) {
			elem.style.border = 0;
			elem.style.margin = 0;
			elem.style.padding = 0;
		}
		if (style)
		{
			for (var key in style)
			{
				var value = style[key];
				elem.style[key] = value;
				if (key == "opacity") elem.style.filter = "alpha(opacity=" + Math.round(value*100) + ")";
			}
		}
		return true;
	}
	,
	newElement: function(tagName, props, style, setBorder)
	{
		var elem = document.createElement(tagName);
		if (props)
		{
			for (var key in props) elem[key] = props[key];
		}
		gmxAPI.setStyleHTML(elem, style, setBorder);
		return elem;
	},
	newStyledDiv: function(style)
	{
		return gmxAPI.newElement("div", false, style, true);
	},
	newSpan: function(innerHTML)
	{
		return gmxAPI.newElement("span", { innerHTML: innerHTML }, null, true);
	},
	newDiv: function(className, innerHTML)
	{
		return gmxAPI.newElement("div", { className: className, innerHTML: innerHTML }, null, true);
	},
	makeImageButton: function(url, urlHover)
	{
		var btn = document.createElement("img");
		btn.setAttribute('src',url)
		btn.style.cursor = 'pointer';
		btn.style.border = 'none';
		
		if (urlHover)
		{
			btn.onmouseover = function()
			{
				this.setAttribute('src', urlHover);
			}
			btn.onmouseout = function()
			{
				this.setAttribute('src', url);
			}
		}
		
		return btn;
	},
	applyTemplate: function(template, properties)
	{
		return template.replace(/\[([a-zA-Z0-9_а-яА-Я ]+)\]/g, function()
		{
			var value = properties[arguments[1]];
			if (value != undefined)
				return "" + value;
			else
				return "[" + arguments[1] + "]";
		});
	},
	getIdentityField: function(obj)
	{
		if(!obj || !obj.parent) return 'ogc_fid';
		if(obj.properties && obj.properties.identityField) return obj.properties.identityField;
		return gmxAPI.getIdentityField(obj.parent);
	},
	swfWarning: function(attr)
	{
		if(typeof(attr) == 'object') {				// отложенные команды от отрисовщика
			if(attr.length > 0) {					// массив команд
				for (var i = 0; i < attr.length; i++) {
					var ph = attr[i];
					if(!ph.func || !window[ph.func]) continue;
					if(ph.eventType === 'observeVectorLayer') {
						window[ph.func](ph.geometry, ph.properties, ph.flag);
					}
				}
			} else if(attr.eventType === 'chkLayerVersion') {		// сигнал о необходимости проверки версии слоя
				var chkLayer = gmxAPI.mapNodes[attr.layerID] || false;
				if(chkLayer && gmxAPI._layersVersion) {
					gmxAPI._layersVersion.chkLayerVersion(chkLayer);
				}
			}	
		} else {
			gmxAPI._debugWarnings.push(attr);
		}
	},
	addDebugWarnings: function(attr)
	{
		if(!window.gmxAPIdebugLevel) return;
		if(!attr['script']) attr['script'] = 'api.js';
		if(attr['event'] && attr['event']['lineNumber']) attr['lineNumber'] = attr['event']['lineNumber'];
		gmxAPI._debugWarnings.push(attr);
		if(window.gmxAPIdebugLevel < 10) return;
		if(attr['alert']) alert(attr['alert']);
	},
	_debugWarnings: [],
	isIE: (navigator.appName.indexOf("Microsoft") != -1),
	isChrome: (navigator.userAgent.toLowerCase().indexOf("chrome") != -1),
	isSafari: (navigator.userAgent.toLowerCase().indexOf("safari") != -1),
	show: function(div)
	{
		div.style.visibility = "visible";
		div.style.display = "block";
	}
	,
	hide: function(div)
	{
		div.style.visibility = "hidden";
		div.style.display = "none";
	},
    getTextContent: function(node)
    {
        if (typeof node.textContent != 'undefined')
            return node.textContent;
        
        var data = '';
        for (var i = 0; i < node.childNodes.length; i++)
            data += node.childNodes[i].data;
        
        return data;
    }
	,
	parseXML: function(str)
	{
		var xmlDoc;
		try
		{
			if (window.DOMParser)
			{
				parser = new DOMParser();
				xmlDoc = parser.parseFromString(str,"text/xml");
			}
			else // Internet Explorer
			{
				xmlDoc = new ActiveXObject("MSXML2.DOMDocument.3.0");
				xmlDoc.validateOnParse = false;
				xmlDoc.async = false;
				xmlDoc.loadXML(str);
			}
		}
		catch(e)
		{
			gmxAPI.addDebugWarnings({'func': 'parseXML', 'str': str, 'event': e, 'alert': e});
		}
		
		return xmlDoc;
	}
	,
	setPositionStyle: function(div, attr)
	{
		for(var key in attr) div.style[key] = attr[key];
	}
	,
	position: function(div, x, y)
	{
		div.style.left = x + "px";
		div.style.top = y + "px";
	}
	,
	bottomPosition: function(div, x, y)
	{
		div.style.left = x + "px";
		div.style.bottom = y + "px";
	}
	,
	size: function(div, w, h)
	{
		div.style.width = w + "px";
		div.style.height = h + "px";
	}
	,
	positionSize: function(div, x, y, w, h)
	{
		gmxAPI.position(div, x, y);
		gmxAPI.size(div, w, h);
	}
	,
	setVisible: function(div, flag)
	{
		(flag ? gmxAPI.show : gmxAPI.hide)(div);
	}
	,
	setBg: function(t, imageName)
	{
		if (gmxAPI.isIE)
			t.style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" + imageName + "',sizingMethod='scale')";
		else
			t.style.backgroundImage = "url('" + imageName + "')";
	}
	,
	deselect: function()
	{
		if (window.disableDeselect)
			return;
		if(document.selection && document.selection.empty) 
			try { document.selection.empty(); } catch (e) {
				gmxAPI.addDebugWarnings({'func': 'deselect', 'event': e, 'alert': e});
			}
	}
	,
	compatEvent: function(event)
	{
		return event || window.event;
	}
	,
	stopEvent: function(ev)
	{
		var event = gmxAPI.compatEvent(ev);
		if(!event) return false;
		
		if (event.stopPropagation) event.stopPropagation();
		else if (event.preventDefault) event.preventDefault(); 
		event.cancelBubble = true;
		event.cancel = true;
		event.returnValue = false;
		return true;
	}
	,
	compatTarget: function(event)
	{
		if (!event) event = window.event;
		return (event.srcElement != null) ? event.srcElement : event.target;
	}
	,
	isInNode: function(prntNode, node)
	{
		var i = 0;
		var chkNode = node;
		while (i < 1000 && chkNode)
		{
			if(chkNode.tagName === 'HTML') return false;
			if(chkNode === prntNode) return true;
			i++;
			chkNode = chkNode.parentNode;
		}
		return false;
	}
	,
	eventX: function(event)
	{
		var theLeft = (document.documentElement && document.documentElement.scrollLeft ?
			document.documentElement.scrollLeft :
			document.body.scrollLeft);
		return gmxAPI.compatEvent(event).clientX + theLeft;
	}
	,
	eventY: function(event)
	{
		var theTop = (document.documentElement && document.documentElement.scrollTop ?
			document.documentElement.scrollTop :
			document.body.scrollTop);
		return gmxAPI.compatEvent(event).clientY + theTop;
	}
	,
	contDivPos: null		// позиция основного контейнера
	,
	getOffsetLeft: function(div)
	{
		var ret = 0;
		while (div && div.tagName != 'HTML')
		{
		ret += div.offsetLeft;
		div = div.offsetParent;
		}
		return ret;
	}
	,
	getOffsetTop: function(div)
	{
		var ret = 0;
		while (div && div.tagName != 'HTML')
		{
		ret += div.offsetTop;
		div = div.offsetParent;
		}
		return ret;
	}
	,
	strip: function(s)
	{
		return s.replace(/^\s*/, "").replace(/\s*$/, "");
	}
	,
	parseColor: function(str)
	{
		var res = 0xffffff;
		if (!str)
			return res;
		else
		{
			var components = str.split(" ");
			if (components.length == 1)
				return parseInt("0x" + str);
			else if (components.length == 3)
				return parseInt(components[0])*0x10000 + parseInt(components[1])*0x100 + parseInt(components[2]);
			else
				return res;
		}
	}
	,
	forEachPoint: function(coords, callback)
	{
		if (!coords || coords.length == 0) return [];
		if (!coords[0].length)
		{
			if (coords.length == 2)
				return callback(coords);
			else
			{
				var ret = [];
				for (var i = 0; i < coords.length/2; i++)
					ret.push(callback([coords[i*2], coords[i*2 + 1]]));
				return ret;
			}
		}
		else
		{
			var ret = [];
			for (var i = 0; i < coords.length; i++) {
				if(typeof(coords[i]) != 'string') ret.push(gmxAPI.forEachPoint(coords[i], callback));
			}
			return ret;
		}
	}
	,
	transformGeometry: function(geom, callbackX, callbackY)
	{
		return !geom ? geom : { 
			type: geom.type, 
			coordinates: gmxAPI.forEachPoint(geom.coordinates, function(p) 
			{ 
				return [callbackX(p[0]), callbackY(p[1])];
			})
		}
	}
	,
	merc_geometry: function(geom)
	{
		return (geom ? gmxAPI.transformGeometry(geom, gmxAPI.merc_x, gmxAPI.merc_y) : null);
	}
	,
	from_merc_geometry: function(geom)
	{
		return (geom ? gmxAPI.transformGeometry(geom, gmxAPI.from_merc_x, gmxAPI.from_merc_y) : null);
	}
	,
	getBounds: function(coords)
	{
		var ret = { 
			minX: 100000000, 
			minY: 100000000, 
			maxX: -100000000, 
			maxY: -100000000,
			update: function(data)
			{
				gmxAPI.forEachPoint(data, function(p)
				{
					ret.minX = Math.min(p[0], ret.minX);
					ret.minY = Math.min(p[1], ret.minY);
					ret.maxX = Math.max(p[0], ret.maxX);
					ret.maxY = Math.max(p[1], ret.maxY);
				});
			}
		}
		if (coords)
			ret.update(coords);
		return ret;
	}
	,
	boundsIntersect: function(b1, b2)	// в api.js не используется
	{
		return ((b1.minX < b2.maxX) && (b1.minY < b2.maxY) && (b2.minX < b1.maxX) && (b2.minY < b1.maxY));
	}
	,
	extIntersect: function(ext1, ext2)
	{
		return (ext1.maxX < ext2.minX || ext1.minX > ext2.maxX || ext1.maxY < ext2.minY || ext1.minY > ext2.maxY ? false : true);
	}
	,
	isRectangle: function(coords)
	{
		return (coords && coords[0] && coords[0].length == 5
			&& coords[0][4][0] == coords[0][0][0] && coords[0][4][1] == coords[0][0][1]
			&& ((coords[0][0][0] == coords[0][1][0]) || (coords[0][0][1] == coords[0][1][1]))
			&& ((coords[0][1][0] == coords[0][2][0]) || (coords[0][1][1] == coords[0][2][1]))
			&& ((coords[0][2][0] == coords[0][3][0]) || (coords[0][2][1] == coords[0][3][1]))
			&& ((coords[0][3][0] == coords[0][4][0]) || (coords[0][3][1] == coords[0][4][1]))
		);
	}
	,
	getScale: function(z)
	{
		return Math.pow(2, -z)*156543.033928041;
	}
	,
	deg_rad: function(ang)
	{
		return ang * (Math.PI/180.0);
	}
	,
	deg_decimal: function(rad)
	{
		return (rad/Math.PI) * 180.0;
	}
	,
	merc_x: function(lon)
	{
		var r_major = 6378137.000;
		return r_major * gmxAPI.deg_rad(lon);
	}
	,
	from_merc_x: function(x)
	{
		var r_major = 6378137.000;
		return gmxAPI.deg_decimal(x/r_major);
	}
	,
	merc_y: function(lat)
	{
		if (lat > 89.5)
			lat = 89.5;
		if (lat < -89.5)
			lat = -89.5;
		var r_major = 6378137.000;
		var r_minor = 6356752.3142;
		var temp = r_minor / r_major;
		var es = 1.0 - (temp * temp);
		var eccent = Math.sqrt(es);
		var phi = gmxAPI.deg_rad(lat);
		var sinphi = Math.sin(phi);
		var con = eccent * sinphi;
		var com = .5 * eccent;
		con = Math.pow(((1.0-con)/(1.0+con)), com);
		var ts = Math.tan(.5 * ((Math.PI*0.5) - phi))/con;
		var y = 0 - r_major * Math.log(ts);
		return y;
	}
	,
	from_merc_y: function(y)
	{
		var r_major = 6378137.000;
		var r_minor = 6356752.3142;
		var temp = r_minor / r_major;
		var es = 1.0 - (temp * temp);
		var eccent = Math.sqrt(es);
		var ts = Math.exp(-y/r_major);
		var HALFPI = 1.5707963267948966;

		var eccnth, Phi, con, dphi;
		eccnth = 0.5 * eccent;

		Phi = HALFPI - 2.0 * Math.atan(ts);

		var N_ITER = 15;
		var TOL = 1e-7;
		var i = N_ITER;
		dphi = 0.1;
		while ((Math.abs(dphi)>TOL)&&(--i>0))
		{
			con = eccent * Math.sin (Phi);
			dphi = HALFPI - 2.0 * Math.atan(ts * Math.pow((1.0 - con)/(1.0 + con), eccnth)) - Phi;
			Phi += dphi;
		}

		return gmxAPI.deg_decimal(Phi);
	}
	,
	merc: function(lon,lat)
	{
		return [gmxAPI.merc_x(lon), gmxAPI.merc_y(lat)];
	}
	,
	from_merc: function(x,y)
	{
		return [gmxAPI.from_merc_x(x), gmxAPI.from_merc_y(y)];
	}
	,
	distVincenty: function(lon1,lat1,lon2,lat2)
	{
		var p1 = new Object();
		var p2 = new Object();

		p1.lon =  gmxAPI.deg_rad(lon1);
		p1.lat =  gmxAPI.deg_rad(lat1);
		p2.lon =  gmxAPI.deg_rad(lon2);
		p2.lat =  gmxAPI.deg_rad(lat2);

		var a = 6378137, b = 6356752.3142,  f = 1/298.257223563;  // WGS-84 ellipsiod
		var L = p2.lon - p1.lon;
		var U1 = Math.atan((1-f) * Math.tan(p1.lat));
		var U2 = Math.atan((1-f) * Math.tan(p2.lat));
		var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
		var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

		var lambda = L, lambdaP = 2*Math.PI;
		var iterLimit = 20;
		while (Math.abs(lambda-lambdaP) > 1e-12 && --iterLimit>0) {
				var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
				var sinSigma = Math.sqrt((cosU2*sinLambda) * (cosU2*sinLambda) + 
					(cosU1*sinU2-sinU1*cosU2*cosLambda) * (cosU1*sinU2-sinU1*cosU2*cosLambda));
				if (sinSigma==0) return 0;
				var cosSigma = sinU1*sinU2 + cosU1*cosU2*cosLambda;
				var sigma = Math.atan2(sinSigma, cosSigma);
				var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
				var cosSqAlpha = 1 - sinAlpha*sinAlpha;
				var cos2SigmaM = cosSigma - 2*sinU1*sinU2/cosSqAlpha;
				if (isNaN(cos2SigmaM)) cos2SigmaM = 0;
				var C = f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
				lambdaP = lambda;
				lambda = L + (1-C) * f * sinAlpha *
					(sigma + C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));
		}
		if (iterLimit==0) return NaN

		var uSq = cosSqAlpha * (a*a - b*b) / (b*b);
		var A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
		var B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
		var deltaSigma = B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-
				B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));
		var s = b*A*(sigma-deltaSigma);

		s = s.toFixed(3);
		return s;
	}

	,
	DegToRad: function(deg)
	{
        return (deg / 180.0 * Math.PI)
	}
	,
	RadToDeg: function(rad)
	{
		return (rad / Math.PI * 180.0)
	}
	,
	worldWidthMerc: 20037508,
	sm_a: 6378137.0,
    sm_b: 6356752.314,
    //sm_EccSquared: 6.69437999013e-03,
    UTMScaleFactor: 0.9996
	,
	ArcLengthOfMeridian: function(rad)
	{
		var alpha, beta, gamma, delta, epsilon, n;
		var result;
		n = (gmxAPI.sm_a - gmxAPI.sm_b) / (gmxAPI.sm_a + gmxAPI.sm_b);
		alpha = ((gmxAPI.sm_a + gmxAPI.sm_b) / 2.0)
		   * (1.0 + (Math.pow (n, 2.0) / 4.0) + (Math.pow (n, 4.0) / 64.0));
		beta = (-3.0 * n / 2.0) + (9.0 * Math.pow (n, 3.0) / 16.0)
		   + (-3.0 * Math.pow (n, 5.0) / 32.0);
		gamma = (15.0 * Math.pow (n, 2.0) / 16.0)
			+ (-15.0 * Math.pow (n, 4.0) / 32.0);
		delta = (-35.0 * Math.pow (n, 3.0) / 48.0)
			+ (105.0 * Math.pow (n, 5.0) / 256.0);
		epsilon = (315.0 * Math.pow (n, 4.0) / 512.0);

		result = alpha
			* (phi + (beta * Math.sin (2.0 * phi))
				+ (gamma * Math.sin (4.0 * phi))
				+ (delta * Math.sin (6.0 * phi))
				+ (epsilon * Math.sin (8.0 * phi)));

		return result;
	}
	,
	UTMCentralMeridian: function(zone)
	{
        var cmeridian = gmxAPI.DegToRad (-183.0 + (zone * 6.0));
        return cmeridian;
	}
	,
	FootpointLatitude: function(y)
	{
		var y_, alpha_, beta_, gamma_, delta_, epsilon_, n;
		var result;

		n = (gmxAPI.sm_a - gmxAPI.sm_b) / (gmxAPI.sm_a + gmxAPI.sm_b);
		alpha_ = ((gmxAPI.sm_a + gmxAPI.sm_b) / 2.0)
			* (1 + (Math.pow (n, 2.0) / 4) + (Math.pow (n, 4.0) / 64));
		y_ = y / alpha_;
		beta_ = (3.0 * n / 2.0) + (-27.0 * Math.pow (n, 3.0) / 32.0)
			+ (269.0 * Math.pow (n, 5.0) / 512.0);
		gamma_ = (21.0 * Math.pow (n, 2.0) / 16.0)
			+ (-55.0 * Math.pow (n, 4.0) / 32.0);
		delta_ = (151.0 * Math.pow (n, 3.0) / 96.0)
			+ (-417.0 * Math.pow (n, 5.0) / 128.0);
		epsilon_ = (1097.0 * Math.pow (n, 4.0) / 512.0);
		result = y_ + (beta_ * Math.sin (2.0 * y_))
			+ (gamma_ * Math.sin (4.0 * y_))
			+ (delta_ * Math.sin (6.0 * y_))
			+ (epsilon_ * Math.sin (8.0 * y_));

		return result;
	}
	,
	MapLatLonToXY: function(phi, lambda, lambda0, xy)
	{
		var N, nu2, ep2, t, t2, l;
		var l3coef, l4coef, l5coef, l6coef, l7coef, l8coef;
		var tmp;

		ep2 = (Math.pow (gmxAPI.sm_a, 2.0) - Math.pow (gmxAPI.sm_b, 2.0)) / Math.pow (gmxAPI.sm_b, 2.0);
		nu2 = ep2 * Math.pow (Math.cos (phi), 2.0);
		N = Math.pow (gmxAPI.sm_a, 2.0) / (gmxAPI.sm_b * Math.sqrt (1 + nu2));
		t = Math.tan (phi);
		t2 = t * t;
		tmp = (t2 * t2 * t2) - Math.pow (t, 6.0);
		l = lambda - lambda0;
		l3coef = 1.0 - t2 + nu2;

		l4coef = 5.0 - t2 + 9 * nu2 + 4.0 * (nu2 * nu2);

		l5coef = 5.0 - 18.0 * t2 + (t2 * t2) + 14.0 * nu2
			- 58.0 * t2 * nu2;

		l6coef = 61.0 - 58.0 * t2 + (t2 * t2) + 270.0 * nu2
			- 330.0 * t2 * nu2;

		l7coef = 61.0 - 479.0 * t2 + 179.0 * (t2 * t2) - (t2 * t2 * t2);

		l8coef = 1385.0 - 3111.0 * t2 + 543.0 * (t2 * t2) - (t2 * t2 * t2);

		xy[0] = N * Math.cos (phi) * l
			+ (N / 6.0 * Math.pow (Math.cos (phi), 3.0) * l3coef * Math.pow (l, 3.0))
			+ (N / 120.0 * Math.pow (Math.cos (phi), 5.0) * l5coef * Math.pow (l, 5.0))
			+ (N / 5040.0 * Math.pow (Math.cos (phi), 7.0) * l7coef * Math.pow (l, 7.0));

		xy[1] = ArcLengthOfMeridian (phi)
			+ (t / 2.0 * N * Math.pow (Math.cos (phi), 2.0) * Math.pow (l, 2.0))
			+ (t / 24.0 * N * Math.pow (Math.cos (phi), 4.0) * l4coef * Math.pow (l, 4.0))
			+ (t / 720.0 * N * Math.pow (Math.cos (phi), 6.0) * l6coef * Math.pow (l, 6.0))
			+ (t / 40320.0 * N * Math.pow (Math.cos (phi), 8.0) * l8coef * Math.pow (l, 8.0));

		return;
	}
	,
	MapXYToLatLon: function(x, y, lambda0, philambda)
	{
		var phif, Nf, Nfpow, nuf2, ep2, tf, tf2, tf4, cf;
		var x1frac, x2frac, x3frac, x4frac, x5frac, x6frac, x7frac, x8frac;
		var x2poly, x3poly, x4poly, x5poly, x6poly, x7poly, x8poly;

		phif = FootpointLatitude (y);
		ep2 = (Math.pow (gmxAPI.sm_a, 2.0) - Math.pow (gmxAPI.sm_b, 2.0))
			  / Math.pow (gmxAPI.sm_b, 2.0);
		cf = Math.cos (phif);
		nuf2 = ep2 * Math.pow (cf, 2.0);
		Nf = Math.pow (gmxAPI.sm_a, 2.0) / (gmxAPI.sm_b * Math.sqrt (1 + nuf2));
		Nfpow = Nf;
		tf = Math.tan (phif);
		tf2 = tf * tf;
		tf4 = tf2 * tf2;
		x1frac = 1.0 / (Nfpow * cf);

		Nfpow *= Nf;
		x2frac = tf / (2.0 * Nfpow);

		Nfpow *= Nf;
		x3frac = 1.0 / (6.0 * Nfpow * cf);

		Nfpow *= Nf;
		x4frac = tf / (24.0 * Nfpow);

		Nfpow *= Nf;
		x5frac = 1.0 / (120.0 * Nfpow * cf);

		Nfpow *= Nf;
		x6frac = tf / (720.0 * Nfpow);

		Nfpow *= Nf;
		x7frac = 1.0 / (5040.0 * Nfpow * cf);

		Nfpow *= Nf;
		x8frac = tf / (40320.0 * Nfpow);

		x2poly = -1.0 - nuf2;

		x3poly = -1.0 - 2 * tf2 - nuf2;

		x4poly = 5.0 + 3.0 * tf2 + 6.0 * nuf2 - 6.0 * tf2 * nuf2
			- 3.0 * (nuf2 *nuf2) - 9.0 * tf2 * (nuf2 * nuf2);

		x5poly = 5.0 + 28.0 * tf2 + 24.0 * tf4 + 6.0 * nuf2 + 8.0 * tf2 * nuf2;

		x6poly = -61.0 - 90.0 * tf2 - 45.0 * tf4 - 107.0 * nuf2
			+ 162.0 * tf2 * nuf2;

		x7poly = -61.0 - 662.0 * tf2 - 1320.0 * tf4 - 720.0 * (tf4 * tf2);

		x8poly = 1385.0 + 3633.0 * tf2 + 4095.0 * tf4 + 1575 * (tf4 * tf2);
			
		philambda[0] = phif + x2frac * x2poly * (x * x)
			+ x4frac * x4poly * Math.pow (x, 4.0)
			+ x6frac * x6poly * Math.pow (x, 6.0)
			+ x8frac * x8poly * Math.pow (x, 8.0);
			
		philambda[1] = lambda0 + x1frac * x
			+ x3frac * x3poly * Math.pow (x, 3.0)
			+ x5frac * x5poly * Math.pow (x, 5.0)
			+ x7frac * x7poly * Math.pow (x, 7.0);
			
		return;
	}
	,
	LatLonToUTMXY: function(lat, lon, zone, xy)
	{
		gmxAPI.MapLatLonToXY (lat, lon, gmxAPI.UTMCentralMeridian (zone), xy);

		xy[0] = xy[0] * gmxAPI.UTMScaleFactor + 500000.0;
		xy[1] = xy[1] * gmxAPI.UTMScaleFactor;
		if (xy[1] < 0.0)
			xy[1] = xy[1] + 10000000.0;

		return zone;
	}
	,
	UTMXYToLatLon: function(x, y, zone, southhemi, latlon)
	{
		var cmeridian;
			
		x -= 500000.0;
		x /= gmxAPI.UTMScaleFactor;
			
		if (southhemi)
		y -= 10000000.0;
				
		y /= gmxAPI.UTMScaleFactor;

		cmeridian = gmxAPI.UTMCentralMeridian (zone);
		gmxAPI.MapXYToLatLon (x, y, cmeridian, latlon);
			
		return;
	}
	,
	truncate9: function(x)
	{
        return ("" + x).substring(0, 9);
	}
	,
	prettifyDistance: function(length)
	{
		var type = gmxAPI.map.DistanceUnit
		if (type === 'km')
			return (Math.round(length)/1000) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" км", " km");

		if (length < 2000 || type === 'm')
			return Math.round(length) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" м", " m");
		if (length < 200000)
			return (Math.round(length/10)/100) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" км", " km");
		return Math.round(length/1000) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" км", " km");
	}
	,
	prettifyArea: function(area)
	{
		var type = gmxAPI.map.SquareUnit

		if (type === 'km2')
			return ("" + (Math.round(area/100)/10000)) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. км", " sq.km");
		if (type === 'ha')
			return ("" + (Math.round(area/1000)/100)) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" га", " ha");

		if (area < 100000 || type === 'm2')
			return Math.round(area) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. м", " sq. m");
		if (area < 3000000)
			return ("" + (Math.round(area/1000)/1000)).replace(".", ",") + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. км", " sq.km");
		if (area < 30000000)
			return ("" + (Math.round(area/10000)/100)).replace(".", ",") + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. км", " sq.km");
		if (area < 300000000)
			return ("" + (Math.round(area/100000)/10)).replace(".", ",") + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. км", " sq.km");
		return (Math.round(area/1000000)) + gmxAPI.KOSMOSNIMKI_LOCALIZED(" кв. км", " sq. km");
	}
	,
	fragmentArea: function(points)
	{
		var area = 0;
		var rad = Math.PI/180;
		for(var i=0, len = points.length; i<len; i++) {
			var ipp = (i == (len - 1) ? 0 : i + 1);
			area += points[i][0] * Math.sin(points[ipp][1]*rad) - points[ipp][0] * Math.sin(points[i][1]*rad);
		}
		var out = Math.abs(area*gmxAPI.lambertCoefX*gmxAPI.lambertCoefY/2);
		return out;
	}
	,
	fragmentAreaMercator: function(points)
	{
		var pts = [];
		for(var i=0, len = points.length; i<len; i++) {
			pts.push([gmxAPI.from_merc_x(points[i][0]), gmxAPI.from_merc_y(points[i][1])]);
		}
		return gmxAPI.fragmentArea(pts);
	}
	,
	pad2: function(t)
	{
		return (t < 10) ? ("0" + t) : ("" + t);
	}
	,
	strToDate: function(str)
	{
		var arr = str.split(' ');
		var arr1 = arr[0].split('.');
		var d = arr1[0];
		var m = arr1[1] - 1;
		var y = arr1[2];
		if(d > 99) d = arr1[2], y = arr1[0];
		var ret = new Date(y, m, d);
		if(arr.length > 1) {
			arr1 = arr[1].split(':');
			ret.setHours((arr1.length > 0 ? arr1[0] : 0), (arr1.length > 1 ? arr1[1] : 0), (arr1.length > 2 ? arr1[2] : 0), (arr1.length > 3 ? arr1[3] : 0));
		}
		return ret;
	}
	,
	trunc: function(x)
	{
		return ("" + (Math.round(10000000*x)/10000000 + 0.00000001)).substring(0, 9);
	}
	,
	formatDegreesSimple: function(angle)
	{
		if (angle > 180)
			angle -= 360;
		var str = "" + Math.round(angle*100000)/100000;
		if (str.indexOf(".") == -1)
			str += ".";
		for (var i = str.length; i < 8; i++)
			str += "0";
		return str;
	}
	,
	formatDegrees: function(angle)
	{
		angle = Math.round(10000000*angle)/10000000 + 0.00000001;
		var a1 = Math.floor(angle);
		var a2 = Math.floor(60*(angle - a1));
		var a3 = gmxAPI.pad2(3600*(angle - a1 - a2/60)).substring(0, 2);
		return gmxAPI.pad2(a1) + "°" + gmxAPI.pad2(a2) + "'" + a3 + '"';
	}
	,
	LatLon_formatCoordinates: function(x, y)
	{
		return  gmxAPI.formatDegrees(Math.abs(y)) + (y > 0 ? " N, " : " S, ") + 
			gmxAPI.formatDegrees(Math.abs(x)) + (x > 0 ? " E" : " W");
	}
	,
	formatCoordinates: function(x, y)
	{
		return  gmxAPI.LatLon_formatCoordinates(gmxAPI.from_merc_x(x), gmxAPI.from_merc_y(y));
	}
	,
	LatLon_formatCoordinates2: function(x, y)
	{
		return  gmxAPI.trunc(Math.abs(y)) + (y > 0 ? " N, " : " S, ") + 
			gmxAPI.trunc(Math.abs(x)) + (x > 0 ? " E" : " W");
	}
	,
	formatCoordinates2: function(x, y)
	{
		return  gmxAPI.LatLon_formatCoordinates2(gmxAPI.from_merc_x(x), gmxAPI.from_merc_y(y));
	}	
	,
	forEachPointAmb: function(arg, callback)
	{
		gmxAPI.forEachPoint(arg.length ? arg : arg.coordinates, callback);
	}
	,
	geoLength: function(arg1, arg2, arg3, arg4)
	{
		if (arg4)
			return gmxAPI.distVincenty(arg1, arg2, arg3, arg4);
		var currentX = false, currentY = false, length = 0;
		gmxAPI.forEachPointAmb(arg1, function(p)
		{
			if (currentX && currentY)
				length += parseFloat(gmxAPI.distVincenty(currentX, currentY, p[0], p[1]));
			currentX = p[0];
			currentY = p[1];
		});
		return length;
	}
	,
	geoArea: function(arg)
	{
		if (arg.type == "MULTIPOLYGON")
		{
			var ret = 0;
			for (var i = 0; i < arg.coordinates.length; i++)
				ret += gmxAPI.geoArea({ type: "POLYGON", coordinates: arg.coordinates[i] });
			return ret;
		}
		else if (arg.type == "POLYGON")
		{
			var ret = gmxAPI.geoArea(arg.coordinates[0]);
			for (var i = 1; i < arg.coordinates.length; i++)
				ret -= gmxAPI.geoArea(arg.coordinates[i]);
			return ret;
		}
		else if (arg.length)
		{
			var pts = [];
			gmxAPI.forEachPoint(arg, function(p) { pts.push(p); });
			return gmxAPI.fragmentArea(pts);
		}
		else
			return 0;
	}
	,
	geoCenter: function(arg1, arg2, arg3, arg4)
	{
		var minX, minY, maxX, maxY;
		if (arg4)
		{
			minX = Math.min(arg1, arg3);
			minY = Math.min(arg2, arg4);
			maxX = Math.max(arg1, arg3);
			maxY = Math.max(arg2, arg4);
		}
		else
		{
			minX = 1000;
			minY = 1000;
			maxX = -1000;
			maxY = -1000;
			gmxAPI.forEachPointAmb(arg1, function(p)
			{
				minX = Math.min(minX, p[0]);
				minY = Math.min(minY, p[1]);
				maxX = Math.max(maxX, p[0]);
				maxY = Math.max(maxY, p[1]);
			});
		}
		return [
			gmxAPI.from_merc_x((gmxAPI.merc_x(minX) + gmxAPI.merc_x(maxX))/2),
			gmxAPI.from_merc_y((gmxAPI.merc_y(minY) + gmxAPI.merc_y(maxY))/2)
		];
	}
	,
	chkPointCenterX: function(centerX) {
		if(typeof(centerX) != 'number') centerX = 0;
		else {
			centerX = centerX % 360;
			if(centerX < -180) centerX += 360;
			if(centerX > 180) centerX -= 360;
		}
		return centerX;
	}
	,
	convertCoords: function(coordsStr)
	{
		var res = [],
			coordsPairs = gmxAPI.strip(coordsStr).replace(/\s+/,' ').split(' ');

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
	,
	parseGML: function(response)
	{
		var geometries = [],
			strResp = response.replace(/[\t\n\r]/g, ' '),
			strResp = strResp.replace(/\s+/g, ' '),
			coordsTag = /<gml:coordinates>([-0-9.,\s]*)<\/gml:coordinates>/,
			pointTag = /<gml:Point>[\s]*<gml:coordinates>[-0-9.,\s]*<\/gml:coordinates>[\s]*<\/gml:Point>/g,
			lineTag = /<gml:LineString>[\s]*<gml:coordinates>[-0-9.,\s]*<\/gml:coordinates>[\s]*<\/gml:LineString>/g,
			polyTag = /<gml:Polygon>[\s]*(<gml:outerBoundaryIs>[\s]*<gml:LinearRing>[\s]*<gml:coordinates>[-0-9.,\s]*<\/gml:coordinates>[\s]*<\/gml:LinearRing>[\s]*<\/gml:outerBoundaryIs>){0,1}[\s]*(<gml:innerBoundaryIs>[\s]*<gml:LinearRing>[\s]*<gml:coordinates>[-0-9.,\s]*<\/gml:coordinates>[\s]*<\/gml:LinearRing>[\s]*<\/gml:innerBoundaryIs>){0,1}[\s]*<\/gml:Polygon>/g,
			outerTag = /<gml:outerBoundaryIs>(.*)<\/gml:outerBoundaryIs>/,
			innerTag = /<gml:innerBoundaryIs>(.*)<\/gml:innerBoundaryIs>/;

		if (strResp.indexOf('gml:posList') > -1)
		{
			coordsTag = /<gml:posList>([-0-9.,\s]*)<\/gml:posList>/,
			pointTag = /<gml:Point>[\s]*<gml:posList>[-0-9.,\s]*<\/gml:posList>[\s]*<\/gml:Point>/g,
			lineTag = /<gml:LineString>[\s]*<gml:posList>[-0-9.,\s]*<\/gml:posList>[\s]*<\/gml:LineString>/g,
			polyTag = /<gml:Polygon>[\s]*(<gml:exterior>[\s]*<gml:LinearRing>[\s]*<gml:posList>[-0-9.,\s]*<\/gml:posList>[\s]*<\/gml:LinearRing>[\s]*<\/gml:exterior>){0,1}[\s]*(<gml:interior>[\s]*<gml:LinearRing>[\s]*<gml:posList>[-0-9.,\s]*<\/gml:posList>[\s]*<\/gml:LinearRing>[\s]*<\/gml:interior>){0,1}[\s]*<\/gml:Polygon>/g,
			outerTag = /<gml:exterior>(.*)<\/gml:exterior>/,
			innerTag = /<gml:interior>(.*)<\/gml:interior>/;
		}
		else if (strResp.indexOf('<kml') > -1)
		{
			coordsTag = /<coordinates>([-0-9.,\s]*)<\/coordinates>/,
			pointTag = /<Point>[^P]*<\/Point>/g,
			lineTag = /<LineString>[^L]*<\/LineString>/g,
			polyTag = /<Polygon>[^P]*<\/Polygon>/g,
			outerTag = /<outerBoundaryIs>(.*)<\/outerBoundaryIs>/,
			innerTag = /<innerBoundaryIs>(.*)<\/innerBoundaryIs>/;
		}

		strResp = strResp.replace(pointTag, function(str)
		{
			var coords = gmxAPI.getTagValue(str, coordsTag),
				parsedCoords = gmxAPI.convertCoords(coords);
			
			geometries.push({type: 'POINT', coordinates:parsedCoords[0]})
			
			return '';
		})

		strResp = strResp.replace(lineTag, function(str)
		{
			var coords = gmxAPI.getTagValue(str, coordsTag),
				parsedCoords = gmxAPI.convertCoords(coords)

			geometries.push({type: 'LINESTRING', coordinates: parsedCoords});
			
			return '';
		})

		strResp = strResp.replace(polyTag, function(str)
		{
			var coords = [],
				outerCoords = gmxAPI.getTagValue(str, outerTag),
				innerCoords = gmxAPI.getTagValue(str, innerTag),
				resultCoords = [];
			
			if (outerCoords)
				coords.push(gmxAPI.getTagValue(outerCoords, coordsTag));
			
			if (innerCoords)
				coords.push(gmxAPI.getTagValue(innerCoords, coordsTag));
			
			for (var index = 0; index < coords.length; index++)
				resultCoords.push(gmxAPI.convertCoords(coords[index]))
			
			geometries.push({type: 'POLYGON', coordinates: resultCoords});
			
			return '';
		})

		return geometries;
	}
	,
	createGML: function(geometries, format)
	{
		if (typeof geometries == 'undefined' || geometries == null || geometries.length == 0)
			return '';

		var coordsSeparator = ',',
			coordsTag = '<gml:coordinates>_REPLACE_<\/gml:coordinates>',
			pointTag = '<gml:Point><gml:coordinates>_REPLACE_<\/gml:coordinates><\/gml:Point>',
			lineTag = '<gml:LineString><gml:coordinates>_REPLACE_<\/gml:coordinates><\/gml:LineString>',
			polyTag = '<gml:Polygon>_REPLACE_<\/gml:Polygon>',
			outerTag = '<gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>_REPLACE_<\/gml:coordinates><\/gml:LinearRing><\/gml:outerBoundaryIs>',
			innerTag = '<gml:innererBoundaryIs><gml:LinearRing><gml:coordinates>_REPLACE_<\/gml:coordinates><\/gml:LinearRing><\/gml:innerBoundaryIs>',
			elementTag = '<gml:featureMember>_REPLACE_<\/gml:featureMember>',
			headerTag = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<wfs:FeatureCollection xmlns:ogc=\"http://www.opengis.net/ogc\" xmlns:gml=\"http://www.opengis.net/gml\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:ows=\"http://www.opengis.net/ows\" xmlns:wfs=\"http://www.opengis.net/wfs\">\n_REPLACE_\n</wfs:FeatureCollection>';

		if (typeof format != 'undefined' && format == 'gml3')
		{
			coordsSeparator = ' ',
			coordsTag = '<gml:posList>_REPLACE_<\/gml:posList>',
			pointTag = '<gml:Point><gml:posList>_REPLACE_<\/gml:posList><\/gml:Point>',
			lineTag = '<gml:LineString><gml:posList>_REPLACE_<\/gml:posList><\/gml:LineString>',
			polyTag = '<gml:Polygon>_REPLACE_<\/gml:Polygon>',
			outerTag = '<gml:exterior><gml:LinearRing><gml:posList>_REPLACE_<\/gml:posList><\/gml:LinearRing><\/gml:exterior>',
			innerTag = '<gml:interior><gml:LinearRing><gml:posList>_REPLACE_<\/gml:posList><\/gml:LinearRing><\/gml:interior>',
			elementTag = '<gml:featureMember>_REPLACE_<\/gml:featureMember>',
			headerTag = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<wfs:FeatureCollection xmlns:ogc=\"http://www.opengis.net/ogc\" xmlns:gml=\"http://www.opengis.net/gml\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:ows=\"http://www.opengis.net/ows\" xmlns:wfs=\"http://www.opengis.net/wfs\">\n_REPLACE_\n</wfs:FeatureCollection>';
		}
		else if (typeof format != 'undefined' && format == 'kml')
		{
			coordsTag = '<coordinates>_REPLACE_<\/coordinates>',
			pointTag = '<Point><coordinates>_REPLACE_<\/coordinates><\/Point>',
			lineTag = '<LineString><coordinates>_REPLACE_<\/coordinates><\/LineString>',
			polyTag = '<Polygon>_REPLACE_<\/Polygon>',
			outerTag = '<outerBoundaryIs><LinearRing><coordinates>_REPLACE_<\/coordinates><\/LinearRing><\/outerBoundaryIs>',
			innerTag = '<innererBoundaryIs><LinearRing><coordinates>_REPLACE_<\/coordinates><\/LinearRing><\/innerBoundaryIs>',
			elementTag = '<Placemark>_REPLACE_<\/Placemark>',
			headerTag = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?> <kml xmlns=\"http://earth.google.com/kml/2.0\"> <Document>\n_REPLACE_\n</Document>';
		}

		var elementsStr = '';

		for (var i = 0; i < geometries.length; i++)
		{
			var geometriesStr = '';
			
			if (geometries[i].type == 'POINT')
			{
				var coordsStr = geometries[i].coordinates.join(coordsSeparator);
				
				geometriesStr = pointTag.replace('_REPLACE_', coordsStr);
			}
			else if (geometries[i].type == 'LINESTRING')
			{
				var coordsStr = '';
				
				for (var j = 0; j < geometries[i].coordinates.length; j++)
				{
					if (j == 0)
						coordsStr += geometries[i].coordinates[j].join(coordsSeparator)
					else
						coordsStr += ' ' + geometries[i].coordinates[j].join(coordsSeparator)
				}
				
				geometriesStr = lineTag.replace('_REPLACE_', coordsStr);
			}
			else if (geometries[i].type == 'POLYGON')
			{
				var bounds = [outerTag, innerTag];
				
				for (var k = 0; k < geometries[i].coordinates.length; k++)
				{
					var coordsStr = '';
					
					for (var j = 0; j < geometries[i].coordinates[k].length; j++)
					{
						if (j == 0)
							coordsStr += geometries[i].coordinates[k][j].join(coordsSeparator)
						else
							coordsStr += ' ' + geometries[i].coordinates[k][j].join(coordsSeparator)
					}
					
					geometriesStr = bounds[k].replace('_REPLACE_', coordsStr);
				}
				
				geometriesStr = polyTag.replace('_REPLACE_', geometriesStr);
			}
			
			elementsStr += elementTag.replace('_REPLACE_', geometriesStr);
		}

		var xmlStr = headerTag.replace('_REPLACE_', elementsStr);

		return xmlStr;
	}
	,
	getTagValue: function(str, tag)
	{
		var res = null;
		str.replace(tag, function()
		{
			res = arguments[1];
		})
		return res;
	}
	,
	parseCoordinates: function(text, callback)
	{
		// should understand the following formats:
		// 55.74312, 37.61558
		// 55°44'35" N, 37°36'56" E
		// 4187347, 7472103

		if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/))
			return false;
		if (text.indexOf(" ") != -1)
			text = text.replace(/,/g, ".");
		var regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g;
		var results = [];
		while (t = regex.exec(text))
			results.push(t[1]);
		if (results.length < 2)
			return false;
		var ii = Math.floor(results.length/2);
		var x = 0;
		var mul = 1;
		for (var i = 0; i < ii; i++)
		{
			x += parseFloat(results[i])*mul;
			mul /= 60;
		}
		var y = 0;
		mul = 1;
		for (var i = ii; i < results.length; i++)
		{
			y += parseFloat(results[i])*mul;
			mul /= 60;
		}
		if ((Math.abs(x) < 180) && (Math.abs(y) < 180))
		{	
			var tx = x, ty = y;
			x = gmxAPI.merc_x(ty);
			y = gmxAPI.merc_y(tx);
		}
		if (Math.max(text.indexOf("N"), text.indexOf("S")) > Math.max(text.indexOf("E"), text.indexOf("W")))
		{
			var t = gmxAPI.merc_y(gmxAPI.from_merc_x(x));
			x = gmxAPI.merc_x(gmxAPI.from_merc_y(y));
			y = t;
		}
		if (text.indexOf("W") != -1)
			x = -x;
		if (text.indexOf("S") != -1)
			y = -y;
		callback(gmxAPI.from_merc_x(x), gmxAPI.from_merc_y(y));
		return true;
	}
	,
	parseUri: function(str)
	{
		var	o   = {
				strictMode: false,
				key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
				q:   {
					name:   "queryKey",
					parser: /(?:^|&)([^&=]*)=?([^&]*)/g
				},
				parser: {
					strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
					loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
				}
			},
			m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
			uri = {},
			i   = 14;

		while (i--) uri[o.key[i]] = m[i] || "";

		uri[o.q.name] = {};
		uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
			if ($1) uri[o.q.name][$1] = $2;
		});

		uri.hostOnly = uri.host;
		uri.host = uri.authority; // HACK

		return uri;
	}
	,
	memoize : memoize
	,
	getScriptURL: function(scriptName)
	{
		var scripts1 = document.getElementsByTagName("script");
		for (var i = 0; i < scripts1.length; i++)
		{
			var src = scripts1[i].getAttribute("src");
			if (src && (src.indexOf(scriptName) != -1))
				return src;
		}
		return false;
	}
	,
	getScriptBase: function(scriptName)
	{
		var url = gmxAPI.getScriptURL(scriptName);
		return url.substring(0, url.indexOf(scriptName));
	}
	,
	getBaseMapParam: function(paramName, defaultValue)
	{
		if (typeof window.baseMap !== 'object') window.baseMap = {};
		if (!window.baseMap[paramName]) window.baseMap[paramName] = defaultValue;
		return window.baseMap[paramName];
		//return (window.baseMap && window.baseMap[paramName]) ? window.baseMap[paramName] : defaultValue;
	}
	,
	getHostAndPath: function(url)
	{
		var u = gmxAPI.parseUri(url);
		if (u.host == "")
			return "";
		var s = u.host + u.directory;
		if (s.charAt(s.length - 1) == "/")
			s = s.substring(0, s.length - 1);
		return s;
	},
	getAPIUri: memoize(function()
	{
		var scripts1 = document.getElementsByTagName("script");
		for (var i = 0; i < scripts1.length; i++)
		{
			var src = scripts1[i].getAttribute("src");
			var u = gmxAPI.parseUri(src);
			if(u && /\bapi\w*\.js\b/.exec(src)) {
				return u;
			}
		}
		return {};
	})
	,
	getAPIKey: memoize(function()
	{
		var u = gmxAPI.getAPIUri();
		return (u.source ? (/key=([a-zA-Z0-9]+)/).exec(u.source) : '');
	})
	,
	getAPIFolderRoot: memoize(function()
	{
		var u = gmxAPI.getAPIUri();
		return (u.source ? u.source.substring(0, u.source.indexOf(u.file)) : '');
	})
	,
	getAPIHost: memoize(function()
	{
		var apiHost = gmxAPI.getHostAndPath(gmxAPI.getAPIFolderRoot());
		if(apiHost == "") {
			apiHost = gmxAPI.getHostAndPath(window.location.href);
		}
		var arr = /(.*)\/[^\/]*/.exec(apiHost);
		res = (arr && arr.length > 1 ? arr[1] : '');	 //удаляем последний каталог в адресе
		return res;
	})
	,
	getAPIHostRoot: memoize(function()
	{
		return "http://" + gmxAPI.getAPIHost() + "/";
	})
	,
	isArray: function(obj)
	{
		return Object.prototype.toString.apply(obj) === '[object Array]';
	}
	,
	valueInArray: function(arr, value)
	{
		for (var i = 0; i < arr.length; i++)
			if (arr[i] == value)
				return true;
		
		return false;
	}
	,
	arrayToHash: function(arr)
	{
		var ret = {};
		for (var i = 0; i < arr.length; i++)
			ret[arr[i][0]] = arr[i][1];
		return ret;
	}
	,
	propertiesFromArray: function(a)
	{
		a.sort(function(e1, e2)
		{
			var f1 = e1[0], f2 = e2[0];
			return (f1 < f2) ? -1 : (f1 == f2) ? 0 : 1;
		});
		var p_ = {};
		for (var i = 0; i < a.length; i++)
			p_[a[i][0]] = a[i][1];
		return p_;
	}
	,
	lastFlashMapId: 0
	,
	newFlashMapId: function()
	{
		gmxAPI.lastFlashMapId += 1;
		return "random_" + gmxAPI.lastFlashMapId;
	}
	,
	uniqueGlobalName: function(thing)
	{
		var id = gmxAPI.newFlashMapId();
		window[id] = thing;
		return id;
	}
	,
	loadVariableFromScript: function(url, name, callback, onError, useTimeout)
	{
		window[name] = undefined;
		var script = document.createElement("script");
		var done = false;
		//var count = 0;		// Попытки загрузки
		
		script.onerror = function()
		{
			if (!done)
			{
				clearInterval(intervalError);
				if (onError) onError();
				done = true;
			}
		}
		
		script.onload = function()
		{
			if (!done)
			{
				clearInterval(intervalError);
				if ( window[name] !== undefined )
					callback(window[name]);
				else if (onError) onError();
				done = true;
			}
		}
		
		script.onreadystatechange = function()
		{
			if (!done)
			{
				if (script.readyState === 'loaded' || this.readyState === 'complete' )
				{
					var ready = function() {
						clearInterval(intervalError);
						if ( window[name] !== undefined )
							callback(window[name]);
						else if (onError) onError();
						done = true;
					};
					if(gmxAPI.isIE) setTimeout(ready, 100);
					else 	ready();
				}
			}
		}
		
		var intervalError = setInterval(function()
		{
//			count++;
			if (!done)
			{
				if (script.readyState === 'loaded' || this.readyState === 'complete')
				{
					clearInterval(intervalError);
					if (typeof window[name] === 'undefined')
					{
						if (onError) onError();
					}
					done = true;
/*
				} else if (count > 100)
				{
					clearInterval(intervalError);
					if (onError) onError();
*/
				}
			}
		}, 50);
		
		script.setAttribute("charset", "UTF-8");
		document.getElementsByTagName("head").item(0).appendChild(script);
		script.setAttribute("src", url);
	}
	,
    getPatternIcon: function(ph, size)
    {
        return gmxAPI._cmdProxy('getPatternIcon', { 'attr':{'size': size || 32, 'style':ph} });
    }
	,
	mapNodes: {}	// ноды mapObjects
	,
    chkNodeVisibility: function(id)		// рекурсивная проверка видимости обьекта по mapNodes
    {
		var pObj = gmxAPI.mapNodes[id];
		var ret = (!pObj || ('isVisible' in pObj && !pObj['isVisible']) ? false : (pObj.parent ? gmxAPI.chkNodeVisibility(pObj.parent.objectId) : true));
		return ret;
	}
	,
    isProxyReady: function()
    {
		var chkObj = null;
		if (gmxAPI.proxyType === 'leaflet') {			// Это leaflet версия
			chkObj = (gmxAPI._leaflet && gmxAPI._leaflet['LMap'] ? true : false);
		} else {										// Это Flash версия
			chkObj = window.__flash__toXML;
		}
		return (chkObj ? true : false);
    }
	,
    getTileBounds: function(z, x, y)					// Определение границ тайла
    {
		var tileSize = gmxAPI.getScale(z)*256;
		var minX = x*tileSize;
		var minY = y*tileSize;
		return {
			minX: gmxAPI.from_merc_x(minX),
			minY: gmxAPI.from_merc_y(minY),
			maxX: gmxAPI.from_merc_x(minX + tileSize),
			maxY: gmxAPI.from_merc_y(minY + tileSize)
		};
    }
	,
	'getTilePosZoomDelta': function(tilePoint, zoomFrom, zoomTo) {		// получить смещение тайла на меньшем zoom
		var dz = Math.pow(2, zoomFrom - zoomTo);
		var size = 256 / dz;
		return {
			'size': size
			,'zDelta': dz
			,'x': Math.abs(size * (tilePoint.x % dz))
			,'y': size * (dz - 1 - tilePoint.y % dz)
		};
    }
	,
	'filterVisibleTiles': function(arr, tiles, z) {				// отфильтровать список тайлов по видимому extent
		var count = 0;
		var currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
		if(currPos['latlng']) {
			if(!z) z = currPos['z'];
			var bounds = gmxAPI.map.getVisibleExtent();
			var pz = Math.pow(2, -z);
			var tileSize = 256 * pz * 156543.033928041;
			var xSize = 360 * pz;
			var minx = Math.floor(bounds.minX/xSize);
			var maxx = Math.ceil(bounds.maxX/xSize);
			var miny = Math.floor(gmxAPI.merc_y(bounds.minY)/tileSize);
			var maxy = Math.ceil(gmxAPI.merc_y(bounds.maxY)/tileSize);
			//var arr = ph['dtiles'];
			for (var i = 0, len = arr.length; i < len; i+=3)
			{
				var tx = Number(arr[i]), ty = Number(arr[i+1]), tz = Number(arr[i+2]);
				var dz = Math.pow(2, z - tz);
				var tx1 = Number(tx*dz), ty1 = Number(ty*dz);
				if((tx1 + dz) < minx || tx1 > maxx || (ty1 + dz) < miny || ty1 > maxy) {
					continue;
				}
				count += (tiles ? tiles[tz][tx][ty].length : 1);
			}
		}
		return count;
    }
	,
	'chkTileList': function(attr)	{		// получить список тайлов по bounds на определенном zoom
		var z = attr.z;
		var pz = Math.pow(2, -z);
		var tileSize = 256 * pz * 156543.033928041;
		var xSize = 360 * pz;
		if(attr.bounds) {
			var bounds = attr.bounds;
			var minx = Math.floor(bounds.minX/xSize);
			var maxx = Math.ceil(bounds.maxX/xSize);
			var miny = Math.floor(gmxAPI.merc_y(bounds.minY)/tileSize);
			var maxy = Math.ceil(gmxAPI.merc_y(bounds.maxY)/tileSize);
			var res = [];
			for (var j = miny; j <= maxy; j++)
			{
				for (var i = minx; i <= maxx; i++)
				{
					res.push({'x': i, 'y': j, 'z': z});
				}
			}
			return res;
		} else {
			var x = gmxAPI.merc_x(attr.x);
			var y = gmxAPI.merc_y(attr.y);
			var tile = {
				'x':	Math.floor(x/tileSize)
				,'y':	Math.floor(y/tileSize)
				,'z':	z
				,'posInTile': {
					'x': Math.round(256 * ((x % tileSize) / tileSize))
					,'y': Math.round(256 * ( 1 - (y % tileSize) / tileSize))
				}
			};
			return tile;						// получить атрибуты тайла по POINT
		}
	}
	,
	'getTileFromPoint': function(x, y, z)	{			// получить атрибуты тайла по POINT на определенном zoom
		return gmxAPI.chkTileList({'x':	x, 'y': y, 'z': z});
	}
	,
	'getTileListByGeometry': function(geom, zoom)	{		// получить список тайлов по Geometry для zoom
		var bounds = gmxAPI.getBounds(geom.coordinates);
		return gmxAPI.getTileListByBounds(bounds, zoom);
	}
	,
	'getTileListByBounds': function(bounds, z)	{		// получить список тайлов по bounds на определенном zoom
		return gmxAPI.chkTileList({'bounds': bounds, 'z': z});
	}
}

window.gmxAPI.lambertCoefX = 100*gmxAPI.distVincenty(0, 0, 0.01, 0);				// 111319.5;
window.gmxAPI.lambertCoefY = 100*gmxAPI.distVincenty(0, 0, 0, 0.01)*180/Math.PI;	// 6335440.712613423;
window.gmxAPI.serverBase = 'maps.kosmosnimki.ru';		// HostName основной карты по умолчанию
window.gmxAPI.proxyType = 'flash';						// Тип отображения
window.gmxAPI.miniMapAvailable = false;
window.gmxAPI.maxRasterZoom = 1;
window.gmxAPI.miniMapZoomDelta = -4;

	(function()
	{
		var FlashMapFeature = function(geometry, properties, layer)
		{
			this.geometry = geometry;
			this.properties = properties;
			this.layer = layer;
		}
		FlashMapFeature.prototype.getGeometry = function() { return this.geometry; }
		FlashMapFeature.prototype.getLength = function() { return gmxAPI.geoLength(this.geometry); }
		FlashMapFeature.prototype.getArea = function() { return gmxAPI.geoArea(this.geometry); }
		gmxAPI._FlashMapFeature = FlashMapFeature;
	})();

	(function()
	{
		function HandlerMode(div, event, handler)
		{
			this.div = div;
			this.event = event;
			this.handler = handler;
		}
		HandlerMode.prototype.set = function()   
		{
			if(this.div.attachEvent) this.div.attachEvent("on"+this.event, this.handler); 
			if(this.div.addEventListener) this.div.addEventListener(this.event, this.handler, false);
		}
		HandlerMode.prototype.clear = function() 
		{
			if(this.div.detachEvent) this.div.detachEvent("on"+this.event, this.handler); 
			if(this.div.removeEventListener) this.div.removeEventListener(this.event, this.handler, false);
		}

		gmxAPI._HandlerMode = HandlerMode;
	})();

	window.gmxAPI.GlobalHandlerMode = function(event, handler) { return new gmxAPI._HandlerMode(document.documentElement, event, handler); }
	
})();

// Блок методов глобальной области видимости
var kosmosnimki_API = "1D30C72D02914C5FB90D1D448159CAB6";		// ID базовой карты подложек
var tmp = [
	'isIE', 'parseCoordinates', 'setBg', 'deselect', 'compatEvent', 'compatTarget', 'eventX', 'eventY', 'getOffsetLeft', 'getOffsetTop',
	'newStyledDiv', 'show', 'hide', 'setPositionStyle', 'position', 'bottomPosition', 'size',
	'makeImageButton', 'setVisible', 'getTextContent', 'parseXML', 'GlobalHandlerMode',
	'getScriptURL', 'getScriptBase', 'getHostAndPath', 'getBaseMapParam', 'strip', 'parseUri', 'parseColor',
	'forEachPoint',
	'merc_geometry', 'from_merc_geometry', 'getBounds', 'isRectangle', 'getScale', 'geoLength', 'geoArea', 'geoCenter',
	'parseGML', 'createGML', 'merc_x', 'from_merc_x', 'merc_y', 'from_merc_y',
	'distVincenty', 'KOSMOSNIMKI_LOCALIZED',
	'prettifyDistance', 'prettifyArea',
	'pad2', 'formatCoordinates', 'formatCoordinates2',
	'lastFlashMapId', 'newFlashMapId', 'uniqueGlobalName', 'loadVariableFromScript',
	// Не используемые в api.js
	'newDiv', 'newSpan', 'positionSize', 'merc', 'from_merc', 'formatDegrees', 'memoize', 
	'DegToRad', 'RadToDeg', 'ArcLengthOfMeridian', 'UTMCentralMeridian', 'FootpointLatitude', 'MapLatLonToXY', 'MapXYToLatLon',
	'LatLonToUTMXY', 'UTMXYToLatLon', 'trunc', 'truncate9', 'lambertCoefX', 'lambertCoefY', 'fragmentArea', 'fragmentAreaMercator', 'formatDegreesSimple',
	'convertCoords', 'transformGeometry', 'boundsIntersect', 'getTagValue', 
	'forEachPointAmb', 'deg_rad', 'deg_decimal'
];
for (var i=0; i<tmp.length; i++) window[tmp[i]] = gmxAPI[tmp[i]];

function newElement(tagName, props, style) { return gmxAPI.newElement(tagName, props, style, true); }
var getAPIFolderRoot = gmxAPI.memoize(function() { return gmxAPI.getAPIFolderRoot(); });
var getAPIHost = gmxAPI.memoize(function() { return gmxAPI.getAPIHost(); });
var getAPIHostRoot = gmxAPI.memoize(function() { return gmxAPI.getAPIHostRoot(); });

// Поддержка setHandler и Listeners
(function()
{

	var flashEvents = {		// События передающиеся в SWF
		'onClick': true
		,'onMouseDown': true
		,'onMouseUp': true
		,'onMouseOver': true
		,'onMouseOut': true
		,'onMove': true
		,'onMoveBegin': true
		,'onMoveEnd': true
		,'onResize': true
		,'onEdit': true
		,'onNodeMouseOver': true
		,'onNodeMouseOut': true
		,'onEdgeMouseOver': true
		,'onEdgeMouseOut': true
		,'onFinish': true
		,'onRemove': true
		,'onTileLoaded': true
		,'onTileLoadedURL': true
	};

	function setHandler(obj, eventName, handler) {
		var func = function(subObjectId, a, attr)
		{
			var pObj = (gmxAPI.mapNodes[subObjectId] ? gmxAPI.mapNodes[subObjectId] : new gmxAPI._FMO(subObjectId, {}, obj));		// если MapObject отсутствует создаем
			if(typeof(a) === 'object') pObj.properties = ('sort' in a ? gmxAPI.propertiesFromArray(a) : a);
			if('filters' in pObj) attr['layer'] = pObj;
			else if(pObj.parent && 'filters' in pObj.parent) attr['layer'] = pObj.parent;
			if(!attr.latlng && 'mouseX' in attr) {
				attr.latlng = {
					'lng': gmxAPI.from_merc_x(attr.mouseX)
					,'lat': gmxAPI.from_merc_y(attr.mouseY)
				};
			}
			var flag = false;
			if(obj.handlers[eventName]) flag = handler(pObj, attr);
			if(!flag) flag = gmxAPI._listeners.dispatchEvent(eventName, obj, {'obj': pObj, 'attr': attr });
			return flag;
		};

		var callback = (handler ? func : null);
		if(callback || !obj.stateListeners[eventName]) { 	// Если есть callback или нет Listeners на обьекте
			gmxAPI._cmdProxy('setHandler', { 'obj': obj, 'attr': {
				'eventName':eventName
				,'callbackName':callback
				}
			});
		}
	}

	// Begin: Блок Listeners
	var stateListeners = {};	// Глобальные события
	
	function getArr(eventName, obj)
	{
		var arr = (obj ? 
			('stateListeners' in obj && eventName in obj.stateListeners ? obj.stateListeners[eventName] : [])
			: ( eventName in stateListeners ? stateListeners[eventName] : [])
		);
		return arr;
		//return arr.sort(function(a, b) {return (b['level'] > a['level'] ? 1 : -1);});
	}
	// Обработка пользовательских Listeners на obj
	function dispatchEvent(eventName, obj, attr)
	{
		var out = false;
		var arr = getArr(eventName, obj);
		for (var i=0; i<arr.length; i++)	// Вызываем по убыванию 'level'
		{
			if(typeof(arr[i].func) === 'function') {
				try {
					out = arr[i].func(attr);
					if(out) break;				// если callback возвращает true заканчиваем цепочку вызова
				} catch(e) {
					gmxAPI.addDebugWarnings({'func': 'dispatchEvent', 'handler': eventName, 'event': e, 'alert': e});
				}
			}
		}
		return out;
	}

	/** Пользовательские Listeners изменений состояния карты
	* @function addListener
	* @memberOf api - добавление прослушивателя
	* @param {eventName} название события
	* @param {func} вызываемый метод
	* @param {pID} Listener унаследован от родительского обьекта
	* @return {id} присвоенный id прослушивателя
	* @see <a href="http://mapstest.kosmosnimki.ru/api/ex_locationTitleDiv.html">» Пример использования</a>.
	* @author <a href="mailto:saleks@scanex.ru">Sergey Alexseev</a>
	*/
	function addListener(ph)
	{
		var eventName = ph['eventName'];
		var pID = ph['pID'];
		if(pID && !flashEvents[eventName]) return false;		// Если есть наследование от родительского Listener и событие не передается в SWF то выходим

		var obj = ph['obj'];
		var func = ph['func'];
		var level = ph['level'] || 0;
		var arr = getArr(eventName, obj);
		var id = gmxAPI.newFlashMapId();
		var pt = {"id": id, "func": func, "level": level };
		if(pID) pt['pID'] = pID;
		arr.push(pt);
		arr = arr.sort(function(a, b) {return (b['level'] > a['level'] ? 1 : -1);});
		
		if(obj) {	// Это Listener на mapObject
			obj.stateListeners[eventName] = arr;
			if('setHandler' in obj && flashEvents[eventName] && (!obj.handlers || !obj.handlers[eventName])) {
				obj.setHandler(eventName, function(){});
				delete obj.handlers[eventName];		// для установленных через addListener событий убираем handler
			}
		}
		else {		// Это глобальный Listener
			stateListeners[eventName] = arr;
		}
		return id;
	}

	/** Пользовательские Listeners изменений состояния карты
	* @function removeListener
	* @memberOf api - удаление прослушивателя
	* @param {eventName} название события
	* @param {id} вызываемый метод
	* @return {Bool} true - удален false - не найден
	* @see <a href="http://mapstest.kosmosnimki.ru/api/ex_locationTitleDiv.html">» Пример использования</a>.
	* @author <a href="mailto:saleks@scanex.ru">Sergey Alexseev</a>
	*/
	function removeListener(obj, eventName, id)
	{
		var arr = getArr(eventName, obj);
		var out = [];
		for (var i=0; i<arr.length; i++)
		{
			if(id && id != arr[i]["id"] && id != arr[i]["pID"]) out.push(arr[i]);
		}
		if(obj) {
			obj.stateListeners[eventName] = out;
			if('removeHandler' in obj && (!obj.handlers || !obj.handlers[eventName]) && out.length == 0) obj.removeHandler(eventName);
			
		}
		else stateListeners[eventName] = out;
		return true;
	}
	gmxAPI._listeners = {
		'dispatchEvent': dispatchEvent,
		'addListener': addListener,
		'removeListener': removeListener
	};
	// End: Блок Listeners

	var InitHandlersFunc = function() {
		gmxAPI.extendFMO('setHandler', function(eventName, handler) {
			setHandler(this, eventName, handler);
			this.handlers[eventName] = true;		// true если установлено через setHandler
			flashEvents[eventName] = true;
		});

		gmxAPI.extendFMO('removeHandler', function(eventName) {
			if(!(eventName in this.stateListeners) || this.stateListeners[eventName].length == 0) { 	// Если нет Listeners на обьекте
				gmxAPI._cmdProxy('removeHandler', { 'obj': this, 'attr':{ 'eventName':eventName }});
			}
			delete this.handlers[eventName];
		});

		gmxAPI.extendFMO('setHandlers', function(handlers) {
			for (var key in handlers)
				this.setHandler(key, handlers[key]);
		});

		gmxAPI.extendFMO('addListener', function(eventName, func, level) {
			var ph = {'obj':this, 'eventName': eventName, 'func': func, 'level': level};
			return addListener(ph);
		});
		//gmxAPI.extendFMO('addListener', function(eventName, func, id) {	return addListener(this, eventName, func, id); });
		//gmxAPI.extendFMO('addMapStateListener', function(eventName, func, id) {	return addListener(this, eventName, func, id); });
		gmxAPI.extendFMO('removeListener', function(eventName, id) { return removeListener(this, eventName, id); });
		gmxAPI.extendFMO('removeMapStateListener', function(eventName, id) { return removeListener(this, eventName, id); });
	};
	
	var ret = {
		'Init': InitHandlersFunc
	};
	
	//расширяем namespace
	gmxAPI._handlers = ret;
})();

// кроссдоменный POST запрос
(function()
{
	function loadFunc(iframe, callback)
	{
		var win = iframe.contentWindow;
		var userAgent = navigator.userAgent.toLowerCase();
        
    //skip first onload in safari
    if (/safari/.test(userAgent) && !iframe.safariSkipped)
    {
        iframe.safariSkipped = true;
        return;
    }
		
		if (iframe.loaded)
		{
			var data = decodeURIComponent(win.name.replace(/\n/g,'\n\\'));
			iframe.parentNode && iframe.parentNode.removeChild(iframe);
			
			var parsedData;
			try
			{
				parsedData = JSON.parse(data)
			}
			catch(e)
			{
				parsedData = {Status:"error",ErrorInfo: {ErrorMessage: "JSON.parse exeption", ExceptionType:"JSON.parse", StackTrace: data}}
			}
			
			callback && callback(parsedData);
		}
		else
		{
			win.location = 'about:blank';
			iframe.loaded = true;
		}
	}

	function createPostIframe(id, callback)
	{
		var userAgent = navigator.userAgent.toLowerCase(),
			callbackName = gmxAPI.uniqueGlobalName(function()
			{
				loadFunc(iframe, callback);
			}),
			iframe;

		try{
			iframe = document.createElement('<iframe style="display:none" onload="' + callbackName + '()" src="javascript:true" id="' + id + '" name="' + id + '"></iframe>');
        }
		catch (e)
		{
			iframe = document.createElement("iframe");
			iframe.style.display = 'none';
			iframe.setAttribute('id', id);
			iframe.setAttribute('name', id);
			//iframe.charset = 'UTF-8';
			iframe.src = 'javascript:true';
			iframe.onload = window[callbackName];
		}	

		return iframe;
	}

	/** Посылает кроссдоменный POST запрос
	* @namespace utilities
	* @function
	* 
	* @param url {string} - URL запроса
	* @param params {object} - хэш параметров-запросов
	* @param callback {function} - callback, который вызывается при приходе ответа с сервера. Единственный параметр ф-ции - собственно данные
	* @param baseForm {DOMElement} - базовая форма запроса. Используется, когда нужно отправить на сервер файл. 
	*                                В функции эта форма будет модифицироваться, но после отправления запроса будет приведена к исходному виду.
	*/
	function sendCrossDomainPostRequest(url, params, callback, baseForm)
	{
		var form,
			rnd = String(Math.random()),
			id = '$$iframe_' + url + rnd;

		var userAgent = navigator.userAgent.toLowerCase(),
			iframe = createPostIframe(id, callback),
			originalFormAction;
			
		if (baseForm)
		{
			form = baseForm;
			originalFormAction = form.getAttribute('action');
			form.setAttribute('action', url);
			form.target = id;
			
		}
		else
		{
            try {
				form = document.createElement('<form id=' + id + '" enctype="multipart/form-data" style="display:none" target="' + id + '" action="' + url + '" method="post" accept-charset="UTF-8"></form>');
            }
			catch (e)
			{
				form = document.createElement("form");
				form.acceptCharset = 'UTF-8';
				form.style.display = 'none';
				form.setAttribute('enctype', 'multipart/form-data');
				form.target = id;
				form.setAttribute('method', 'POST');
				form.setAttribute('action', url);
				form.id = id;
			}
		}
		
		var hiddenParamsDiv = document.createElement("div");
		hiddenParamsDiv.style.display = 'none';
		
		for (var paramName in params)
		{
			var input = document.createElement("input");
			
			input.setAttribute('type', 'hidden');
			input.setAttribute('name', paramName);
			input.setAttribute('value', params[paramName]);
			
			hiddenParamsDiv.appendChild(input)
		}
		
		form.appendChild(hiddenParamsDiv);
		
		if (!baseForm)
			document.body.appendChild(form);
			
		document.body.appendChild(iframe);
		
		form.submit();
		
		if (baseForm)
		{
			form.removeChild(hiddenParamsDiv);
			if (originalFormAction !== null)
				form.setAttribute('action', originalFormAction);
			else
				form.removeAttribute('action');
		}
		else
		{
			form.parentNode.removeChild(form);
		}
	}
	//расширяем namespace
	gmxAPI.sendCrossDomainPostRequest = sendCrossDomainPostRequest;
})();

////
var flashMapAlreadyLoading = false;

function sendCrossDomainJSONRequest(url, callback, callbackParamName, callbackError)
{
    callbackParamName = callbackParamName || 'CallbackName';
    
	var script = document.createElement("script");
	script.setAttribute("charset", "UTF-8");
	var callbackName = gmxAPI.uniqueGlobalName(function(obj)
	{
		callback && callback(obj);
		window[callbackName] = false;
		document.getElementsByTagName("head").item(0).removeChild(script);
	});
    
    var sepSym = url.indexOf('?') == -1 ? '?' : '&';
    
	script.setAttribute("src", url + sepSym + callbackParamName + "=" + callbackName + "&" + Math.random());
	if(callbackError) script.onerror = function(e) {
		callbackError(e);
	};
	document.getElementsByTagName("head").item(0).appendChild(script);
}
gmxAPI.sendCrossDomainJSONRequest = sendCrossDomainJSONRequest;

function isRequiredAPIKey( hostName )
{
	if(!hostName) hostName = '';
	if ( hostName.indexOf("maps.kosmosnimki.ru") != -1 ) 
		return true;
		
	if (!window.apikeySendHosts) return false;
	
	for (var k = 0; k < window.apikeySendHosts.length; k++)
	{
		if (hostName.indexOf(window.apikeySendHosts[k]) != -1)
			return true;
	}
			
	return false;
}

function forEachLayer(layers, callback, notVisible)
{
	var forEachLayerRec = function(o, isVisible)
	{
		isVisible = isVisible && o.content.properties.visible;
		if (o.type == "layer")
			callback(o.content, isVisible);
		else if (o.type == "group")
		{
			var a = o.content.children;
			for (var k = a.length - 1; k >= 0; k--)
				forEachLayerRec(a[k], isVisible);
		}
	}
	forEachLayerRec({type: "group", content: { children: layers.children, properties: { visible: (notVisible ? false : true) } } }, true);
}

var APIKeyResponseCache = {};
var sessionKeyCache = {};
var KOSMOSNIMKI_SESSION_KEY = false;
var alertedAboutAPIKey = false;

function loadMapJSON(hostName, mapName, callback, onError)
{
	if(typeof(callback) !== 'function') {
		gmxAPI.addDebugWarnings({'hostName': hostName, 'mapName': mapName, 'alert': 'loadMapJSON: bad callback function'});
		if(typeof(onError) === 'function') onError();
		return false;
	}
	//if(window.apikeyRequestHost) hostName = window.apikeyRequestHost;
	if (hostName.indexOf("http://") == 0)
		hostName = hostName.slice(7);
	if (hostName.charAt(hostName.length-1) == '/')
		hostName = hostName.slice(0, -1);
		
	//относительный путь в загружаемой карте
	if (hostName.charAt(0) == '/')
		hostName = getAPIHost() + hostName;

	var configFlag = false;
	if (!gmxAPI.getScriptURL("config.js")) {
		gmxAPI.loadVariableFromScript(
			gmxAPI.getAPIFolderRoot() + "config.js",
			"apiKey",
			function(key) { configFlag = true; }
			,
			function() { configFlag = true; }	// Нет config.js
		);
	} else {
		configFlag = true;	
	}
		
	if (flashMapAlreadyLoading || !configFlag)
	{
		setTimeout(function() { loadMapJSON(hostName, mapName, callback, onError); }, 200);
		return;
	}

	var alertAboutAPIKey = function(message)
	{
		if (!alertedAboutAPIKey)
		{
			alert(message);
			alertedAboutAPIKey = true;
		}
	}

	flashMapAlreadyLoading = true;

	var finish = function()
	{
		var key = window.KOSMOSNIMKI_SESSION_KEY;
		if (key == "INVALID")
			key = false;

		sendCrossDomainJSONRequest(
			"http://" + hostName + "/TileSender.ashx?ModeKey=map&MapName=" + mapName + (key ? ("&key=" + encodeURIComponent(key)) : "") + "&" + Math.random(),
			function(response)
			{
				if(response && response['Status'] === 'ok' && response['Result']) {
					var layers = response['Result'];
					if (layers)
					{
						layers.properties.hostName = hostName;
						window.sessionKeyCache[mapName] = layers.properties.MapSessionKey;
						forEachLayer(layers, function(layer)
						{ 
							layer.properties.mapName = layers.properties.name;
							layer.properties.hostName = hostName;
							//layer.mercGeometry = layer.geometry;
							//delete layer.geometry;
							//layer.mercGeometry = gmxAPI.clone(layer.geometry);
							//layer.geometry = gmxAPI.from_merc_geometry(layer.geometry);
						});
					}
					callback(layers);
					flashMapAlreadyLoading = false;
				} else {
					flashMapAlreadyLoading = false;
					if (onError) onError();
					else callback(layers);
				}
			}
		);
	}

	if ( isRequiredAPIKey( hostName ) )
	{
		var haveNoAPIKey = function()
		{
			alertAboutAPIKey(gmxAPI.KOSMOSNIMKI_LOCALIZED("Не указан API-ключ!", "API key not specified!"));
			window.KOSMOSNIMKI_SESSION_KEY = "INVALID";
			finish();
		}

		var useAPIKey = function(key)
		{
			var processResponse = function(response)
			{
				if (response.Result.Status)
					window.KOSMOSNIMKI_SESSION_KEY = response.Result.Key;
				else {
					var txt = gmxAPI.KOSMOSNIMKI_LOCALIZED("Указан неверный API-ключ!", "Incorrect API key specified!");
					gmxAPI.addDebugWarnings({'func': 'useAPIKey', 'handler': 'processResponse', 'alert': txt});
					//alertAboutAPIKey(gmxAPI.KOSMOSNIMKI_LOCALIZED("Указан неверный API-ключ!", "Incorrect API key specified!"));
				}
				finish();
			}
			if (APIKeyResponseCache[key])
				processResponse(APIKeyResponseCache[key]);
			else
			{
				var apikeyRequestHost = window.apikeyRequestHost  ? window.apikeyRequestHost  : "maps.kosmosnimki.ru";
//finish();
//return;
				sendCrossDomainJSONRequest(
					"http://" + apikeyRequestHost + "/ApiKey.ashx?WrapStyle=func&Key=" + key,
					function(response)
					{
						APIKeyResponseCache[key] = response;
						processResponse(response);
					}
					,null
					,function(ev)
					{
						var txt = gmxAPI.KOSMOSNIMKI_LOCALIZED("Сбой при получении API-ключа!", "Error in API key request!");
						gmxAPI.addDebugWarnings({'func': 'useAPIKey', 'handler': 'sendCrossDomainJSONRequest', 'alert': txt});
						//alertAboutAPIKey(gmxAPI.KOSMOSNIMKI_LOCALIZED("Указан неверный API-ключ!", "Incorrect API key specified!"));
						finish();
					}
					
				);
			}
		}
		var apiHost = gmxAPI.parseUri(window.location.href).hostOnly;
		if (apiHost == '') 
			apiHost = 'localhost';
		var apiKeyResult = gmxAPI.getAPIKey();

		if ((apiHost == "localhost") || apiHost.match(/127\.\d+\.\d+\.\d+/))
			useAPIKey("localhost");
		else if (apiKeyResult)
			useAPIKey(apiKeyResult[1]);
		else if (window.apiKey)
			useAPIKey(window.apiKey);
		else if (!gmxAPI.getScriptURL("config.js"))
			gmxAPI.loadVariableFromScript(
				gmxAPI.getAPIFolderRoot() + "config.js",
				"apiKey",
				function(key)
				{
					if (key)
						useAPIKey(key);
					else
						haveNoAPIKey();			// Нет apiKey в config.js
				}
				,
				function() { haveNoAPIKey(); }	// Нет config.js
			);
		else
			haveNoAPIKey();
	}
	else
		finish();
}
function createFlashMap(div, arg1, arg2, arg3)
{
	if (!arg2 && !arg3 && typeof(arg1) === 'function')
		createKosmosnimkiMapInternal(div, false, arg1);
	else
	{
		var hostName, mapName, callback;
		if (arg3)
		{
			hostName = arg1;
			mapName = arg2;
			callback = arg3;
		}
		else
		{
			hostName = getAPIHost();
			mapName = arg1;
			callback = arg2;
		}
		//hostName = 'maps.kosmosnimki.ru';
		var uri = gmxAPI.parseUri(hostName);
		if(uri.host) gmxAPI.serverBase = uri.host;						// HostName основной карты переопределен
		loadMapJSON(hostName, mapName, function(layers)
		{
			if (layers != null) {
                window.KOSMOSNIMKI_LANGUAGE = window.KOSMOSNIMKI_LANGUAGE || {'eng': 'English', 'rus': 'Russian'}[layers.properties.DefaultLanguage];
				(layers.properties.UseKosmosnimkiAPI ? createKosmosnimkiMapInternal : createFlashMapInternal)(div, layers, callback);
            }
			else
				callback(null);
		});
	}
	return true;
}

window.createKosmosnimkiMap = createFlashMap;
window.makeFlashMap = createFlashMap;

(function(){
var flashId = gmxAPI.newFlashMapId();
var FlashMapObject = function(objectId_, properties_, parent_)
{
	this.objectId = objectId_;
	if (!properties_) properties_ = {};
	for (var key in properties_)
		if (properties_[key] == "null")
			properties_[key] = "";
	this.properties = properties_;
	this.parent = parent_;
	this.isRemoved = false;
	this.flashId = flashId;
	this._attr = {};			// Дополнительные атрибуты
	this.stateListeners = {};	// Пользовательские события
	this.handlers = {};			// Пользовательские события во Flash
	//this.maxRasterZoom = 1;		// Максимальный зум растровых слоев
	this.childsID = {};			// Хэш ID потомков
}
// расширение FlashMapObject
gmxAPI.extendFMO = function(name, func) {	FlashMapObject.prototype[name] = func;	}
gmxAPI._FMO = FlashMapObject;

// Для MapObject
FlashMapObject.prototype.bringToTop = function() { return gmxAPI._cmdProxy('bringToTop', { 'obj': this }); }
FlashMapObject.prototype.bringToBottom = function() { return gmxAPI._cmdProxy('bringToBottom', { 'obj': this }); }
FlashMapObject.prototype.bringToDepth = function(n) { return gmxAPI._cmdProxy('bringToDepth', { 'obj': this, 'attr':{'zIndex':n} }); }
FlashMapObject.prototype.setDepth = FlashMapObject.prototype.bringToDepth;
FlashMapObject.prototype.startDrawing = function(type) { gmxAPI._cmdProxy('startDrawing', { 'obj': this, 'attr':{'type':type} }); }
FlashMapObject.prototype.stopDrawing = function(type) { gmxAPI._cmdProxy('stopDrawing', { 'obj': this }); }
FlashMapObject.prototype.isDrawing = function() { return gmxAPI._cmdProxy('isDrawing', { 'obj': this }); }
FlashMapObject.prototype.setLabel = function(label) { gmxAPI._cmdProxy('setLabel', { 'obj': this, 'attr':{'label':label} }); }

FlashMapObject.prototype.setStyle = function(style, activeStyle) { var attr = {'regularStyle':style, 'hoveredStyle':activeStyle}; gmxAPI._cmdProxy('setStyle', { 'obj': this, 'attr':attr }); gmxAPI._listeners.dispatchEvent('onSetStyle', this, attr); }
FlashMapObject.prototype.getStyle = function( removeDefaults ) { var flag = (typeof removeDefaults == 'undefined' ? false : removeDefaults); return gmxAPI._cmdProxy('getStyle', { 'obj': this, 'attr':flag }); }
FlashMapObject.prototype.getVisibleStyle = function() { return gmxAPI._cmdProxy('getVisibleStyle', { 'obj': this }); }

FlashMapObject.prototype.getVisibility = function() {
	var val = true;
	if('isVisible' in this) {
		var currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
		var curZ = currPos['z'];
		if (this.minZoom && this.minZoom > curZ) val = false;
		else if(this.maxZoom && this.maxZoom < curZ) val = false;
		else val = this.isVisible;
		if(val && this.parent) val = this.parent.getVisibility();
	} else {
		val = gmxAPI._cmdProxy('getVisibility', { 'obj': this })
	}
	return val;
}
FlashMapObject.prototype.setVisible = function(flag, notDispatch) {
	gmxAPI._cmdProxy('setVisible', { 'obj': this, 'attr': flag, 'notView': notDispatch });
	var val = (flag ? true : false);
	if (val && 'backgroundColor' in this && this != gmxAPI.map.miniMap)
		gmxAPI.map.setBackgroundColor(this.backgroundColor);

	var prev = this.isVisible;
	this.isVisible = val;
	if(prev != val && !notDispatch) gmxAPI._listeners.dispatchEvent('onChangeVisible', this, val);	// Вызов Listeners события 'onChangeVisible'
	if (this.copyright && 'updateCopyright' in gmxAPI.map)
		gmxAPI.map.updateCopyright();
}

FlashMapObject.prototype.getChildren = function()
{
	var arr = gmxAPI._cmdProxy('getChildren', { 'obj': this });
	var ret = [];
	for (var i = 0; i < arr.length; i++) {
		var id = arr[i].id;
		var pObj = (gmxAPI.mapNodes[id] ? gmxAPI.mapNodes[id] : new FlashMapObject(id, {}, this));		// если MapObject отсутствует создаем
		//pObj.properties = gmxAPI.propertiesFromArray(arr[i].properties);
		var a = arr[i].properties;
		if(typeof(a) === 'object') pObj.properties = ('sort' in a ? gmxAPI.propertiesFromArray(a) : a);
		ret.push(pObj);
	}
	return ret;
}

if(gmxAPI._handlers) gmxAPI._handlers.Init();		// Инициализация handlers

/** Добавление объектов из SWF файла
* @function
* @memberOf api
* @param {String} url SWF файла содержащего массив добавляемых обьектов
* @see api.FlashMapObject#addObjects
* @see <a href="http://kosmosnimki.ru/geomixer/docs/api_samples/ex_static_multi.html">» Пример использования</a>.
* @author <a href="mailto:saleks@scanex.ru">Sergey Alexseev</a>
*/
FlashMapObject.prototype.addObjectsFromSWF = function(url) {
	gmxAPI._cmdProxy('addObjectsFromSWF', {'obj': this, 'attr':{'url':url}}); // Отправить команду в SWF
}
/** Добавление набора статических объектов на карту
* @function
* @memberOf api
* @param {array} data массив добавляемых обьектов
* @return {array} массив добавленных обьектов
* @see api.FlashMapObject#addObject
* @see <a href="http://kosmosnimki.ru/geomixer/docs/api_samples/ex_static_multi.html">» Пример использования</a>.
* @author <a href="mailto:saleks@scanex.ru">Sergey Alexseev</a>
*/
FlashMapObject.prototype.addObjects = function(data, format) {
	return gmxAPI._cmdProxy('addObjects', {'obj': this, 'attr':{'arr': data, 'format': format}}); // Отправить команду в SWF
}
FlashMapObject.prototype.addObject = function(geometry, props, propHiden) {
	var objID = gmxAPI._cmdProxy('addObject', { 'obj': this, 'attr':{ 'geometry':geometry, 'properties':props, 'propHiden':propHiden }});
	if(!objID) objID = false;
	var pObj = new FlashMapObject(objID, props, this);	// обычный MapObject
	// пополнение mapNodes
	var currID = (pObj.objectId ? pObj.objectId : gmxAPI.newFlashMapId() + '_gen1');
	gmxAPI.mapNodes[currID] = pObj;
	if(pObj.parent) {
		pObj.parent.childsID[currID] = true;
		if(pObj.parent.isMiniMap) {
			pObj.isMiniMap = true;			// Все добавляемые к миникарте ноды имеют этот признак
		}
	}
	if(propHiden) pObj.propHiden = propHiden;
	pObj.isVisible = true;
	return pObj;
}

FlashMapObject.prototype.remove = function()
{
	if(this.isRemoved) return false;									// Обьект уже был удален
	if(this.copyright && 'removeCopyrightedObject' in gmxAPI.map)
		gmxAPI.map.removeCopyrightedObject(this);
		
	if(this.objectId) {
		gmxAPI._cmdProxy('remove', { 'obj': this}); // Удалять в SWF только если там есть обьект
		// чистка mapNodes
		for(id in this.childsID) {
			delete gmxAPI.mapNodes[id];
		}
		if(this.parent) delete this.parent.childsID[this.objectId];
		delete gmxAPI.mapNodes[this.objectId];
	}

	if(this.properties) {
		var layerID = this.properties.LayerID || this.properties.MultiLayerID;
		if(layerID) {		// Это слой
			gmxAPI._listeners.dispatchEvent('BeforeLayerRemove', this, this.properties.name);	// Удаляется слой
		}
	}
	this.isRemoved = true;
}
FlashMapObject.prototype.setGeometry = function(geometry) {
	gmxAPI._cmdProxy('setGeometry', { 'obj': this, 'attr':geometry });
}
FlashMapObject.prototype.getGeometry = function() 
{ 
	var geom = gmxAPI._cmdProxy('getGeometry', { 'obj': this });
	if(!geom) return null;
	return geom;
}
FlashMapObject.prototype.getLength = function(arg1, arg2, arg3, arg4)
{
	var out = 0;
	if(arg1) out = gmxAPI.geoLength(arg1, arg2, arg3, arg4);
	else out = gmxAPI._cmdProxy('getLength', { 'obj': this });
	return out;
}
FlashMapObject.prototype.getArea = function(arg)
{
	var out = 0;
	if(arg) out = gmxAPI.geoArea(arg);
	else out = gmxAPI._cmdProxy('getArea', { 'obj': this });
	return out;
}
FlashMapObject.prototype.getGeometryType = function()
{
	return gmxAPI._cmdProxy('getGeometryType', { 'obj': this });
}
FlashMapObject.prototype.setPoint = function(x, y) { this.setGeometry({ type: "POINT", coordinates: [x, y] }); }
FlashMapObject.prototype.setLine = function(coords) { this.setGeometry({ type: "LINESTRING", coordinates: coords }); }
FlashMapObject.prototype.setPolygon = function(coords) { this.setGeometry({ type: "POLYGON", coordinates: [coords] }); }
FlashMapObject.prototype.setRectangle = function(x1, y1, x2, y2) { this.setPolygon([[x1, y1], [x1, y2], [x2, y2], [x2, y1]]); }
FlashMapObject.prototype.setCircle = function(x, y, r)
{
	function v_fi (fi, a, b)
	{
		return [
			-Math.cos(fi)*Math.sin(a)+Math.sin(fi)*Math.sin(b)*Math.cos(a),
			Math.cos(fi)*Math.cos(a)+Math.sin(fi)*Math.sin(b)*Math.sin(a),
			-Math.sin(fi)*Math.cos(b)
		];
	}

	var n = 360;            //кол-во точек
	var a = Math.PI*x/180;  //долгота центра окружности в радианах
	var b = Math.PI*y/180;  //широта центра окружности в радианах

	var R = 6372795; // Радиус Земли
	//      6378137 - Некоторые источники дают такое число.

	var d = R * Math.sin(r / R);
	var Rd = R * Math.cos(r / R);
	var VR = [];
	VR[0] = Rd * Math.cos(b) * Math.cos(a);
	VR[1] = Rd * Math.cos(b) * Math.sin(a);
	VR[2] = Rd * Math.sin(b);

	var circle = [];
	var coordinates = [];

	for (var fi = 0; fi < 2*Math.PI + 0.000001; fi += (2*Math.PI/n))
	{
		var v = v_fi(fi, a, b);
		for (var i=0; i<3; i++)
			circle[i] = VR[i] + d*v[i];

		var t1 = (180*Math.asin(circle[2]/R)/Math.PI);
		var r = Math.sqrt(circle[0]*circle[0]+circle[1]*circle[1]);
		var t2 = circle[1]<0 ? -180*Math.acos(circle[0]/r)/Math.PI :
			180*Math.acos(circle[0]/r)/Math.PI;

		if (t2 < x - 180)
			t2 += 360;
		else if (t2 > x + 180)
			t2 -= 360;

		coordinates.push([t2, t1]);
	}

	this.setPolygon(coordinates);
}
FlashMapObject.prototype.clearBackgroundImage = function() { gmxAPI._cmdProxy('clearBackgroundImage', { 'obj': this}); }
FlashMapObject.prototype.setImageExtent = function(attr)
{
	this.setStyle({ fill: { color: 0x000000, opacity: 100 } });
	if (attr.notSetPolygon)
	{
		this.setPolygon([
			[attr.extent.minX, attr.extent.maxY],
			[attr.extent.maxX, attr.extent.maxY],
			[attr.extent.maxX, attr.extent.minY],
			[attr.extent.minX, attr.extent.minY],
			[attr.extent.minX, attr.extent.maxY]
		]);
	}
	gmxAPI._cmdProxy('setImageExtent', { 'obj': this, 'attr':attr});
}
FlashMapObject.prototype.setImage = function(url, x1, y1, x2, y2, x3, y3, x4, y4, tx1, ty1, tx2, ty2, tx3, ty3, tx4, ty4)
{
	this.setStyle({ fill: { color: 0x000000, opacity: 100 } });
	var attr = {};
	if (tx1) {
		attr = {
			'x1': tx1, 'y1': ty1, 'x2': tx2, 'y2': ty2, 'x3': tx3, 'y3': ty3, 'x4': tx4, 'y4': ty4
			,'tx1': x1, 'ty1': y1, 'tx2': x2, 'ty2': y2, 'tx3': x3, 'ty3': y3, 'tx4': x4, 'ty4': y4
		};
	}
	else
	{
		if(gmxAPI.proxyType === 'flash') this.setPolygon([[x1, y1], [x2, y2], [x3, y3], [x4, y4], [x1, y1]]);
		attr = {
			'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'x3': x3, 'y3': y3, 'x4': x4, 'y4': y4
		};
	}
	attr['url'] = url;
	gmxAPI._cmdProxy('setImage', { 'obj': this, 'attr':attr});
}

FlashMapObject.prototype.getGeometrySummary = function()
{
	var out = '';
	var geom = this.getGeometry();
	var geomType = (geom ? geom.type : '');
	if(geom) {
		if (geomType.indexOf("POINT") != -1)
		{
			var c = geom.coordinates;
			out = "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Координаты:", "Coordinates:") + "</b> ";
			out += gmxAPI.formatCoordinates(gmxAPI.merc_x(c[0]), gmxAPI.merc_y(c[1]));
		}
		else if (geomType.indexOf("LINESTRING") != -1) {
			out = "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Длина:", "Length:") + "</b> ";
			out += gmxAPI.prettifyDistance(this.getLength(geom));
		}
		else if (geomType.indexOf("POLYGON") != -1) {
			out = "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Площадь:", "Area:") + "</b> ";
			//var area = this.getArea();
			var area = this.getArea(geom);
			out += gmxAPI.prettifyArea(area);
		}
	}
	return out;
}

FlashMapObject.prototype.getCenter = function(arg1, arg2, arg3, arg4)
{
	var out = 0;
	if(arg1) out = gmxAPI.geoCenter(arg1, arg2, arg3, arg4);
	else out = gmxAPI._cmdProxy('getCenter', { 'obj': this });
	return out;
}

FlashMapObject.prototype.setToolImage = function(imageName, activeImageName)
{
	var apiBase = gmxAPI.getAPIFolderRoot();
	this.setStyle(
		{ marker: { image: apiBase + "img/" + imageName } },
		activeImageName ? { marker: { image: apiBase + "img/" + activeImageName } } : null
	);
}

// Для Filter
FlashMapObject.prototype.flip = function() { return gmxAPI._cmdProxy('flip', { 'obj': this }); }

FlashMapObject.prototype.setFilter = function(sql) {
	var ret = false;
	if(this.parent && 'filters' in this.parent) {
		if(!sql) sql ='';
		this._sql = sql;			// атрибуты фильтра установленные юзером
		ret = gmxAPI._cmdProxy('setFilter', { 'obj': this, 'attr':{ 'sql':sql }});

		if(!this.clusters && '_Clusters' in gmxAPI) {
			this.clusters = new gmxAPI._Clusters(this);	// атрибуты кластеризации потомков по фильтру
		}
		if(this.clusters && this.clusters.attr) {
			this.setClusters(this.clusters.attr);
		}
	} else {
		return this.setVisibilityFilter(sql);
	}
	return ret;
}

FlashMapObject.prototype.setVisibilityFilter = function(sql) {
	if(!sql) sql ='';
	this._sqlVisibility = sql;			// атрибуты фильтра видимости mapObject установленные юзером
	var ret = gmxAPI._cmdProxy('setVisibilityFilter', { 'obj': this, 'attr':{ 'sql':sql }});
	return ret;
}

// Для minimap
FlashMapObject.prototype.positionWindow = function(x1, y1, x2, y2) { gmxAPI._cmdProxy('positionWindow', { 'obj': this, 'attr':{'x1':x1, 'y1':y1, 'x2':x2, 'y2':y2} }); }

// Возможно только для Layer
FlashMapObject.prototype.getIntermediateLength = function() { return gmxAPI._cmdProxy('getIntermediateLength', { 'obj': this }); }
FlashMapObject.prototype.getCurrentEdgeLength = function() { return gmxAPI._cmdProxy('getCurrentEdgeLength', { 'obj': this }); }
FlashMapObject.prototype.setEditable = function() { gmxAPI._cmdProxy('setEditable', { 'obj': this }); }
FlashMapObject.prototype.setTileCaching = function(flag) { gmxAPI._cmdProxy('setTileCaching', { 'obj': this, 'attr':{'flag':flag} }); }
FlashMapObject.prototype.setDisplacement = function(dx, dy) { gmxAPI._cmdProxy('setDisplacement', { 'obj': this, 'attr':{'dx':dx, 'dy':dy} }); }
FlashMapObject.prototype.setBackgroundTiles = function(imageUrlFunction, projectionCode, minZoom, maxZoom, minZoomView, maxZoomView, attr) {
	var ph = {
		'func':imageUrlFunction
		,'projectionCode':projectionCode
		,'minZoom':minZoom
		,'maxZoom':maxZoom
		,'minZoomView':minZoomView
		,'maxZoomView':maxZoomView
	};
	if(attr) {
		if('subType' in attr) ph['subType'] = attr['subType'];
	}
	gmxAPI._cmdProxy('setBackgroundTiles', {'obj': this, 'attr':ph });
}
FlashMapObject.prototype.setTiles = FlashMapObject.prototype.setBackgroundTiles;

FlashMapObject.prototype.setActive = function(flag) { gmxAPI._cmdProxy('setActive', { 'obj': this, 'attr':{'flag':flag} }); }
FlashMapObject.prototype.setVectorTiles = function(dataUrlFunction, cacheFieldName, dataTiles, filesHash) 
{
	var ph = {'tileFunction': dataUrlFunction, 'cacheFieldName':cacheFieldName, 'filesHash':filesHash, 'dataTiles':dataTiles};
	if(this.properties && this.properties['tilesVers']) ph['tilesVers'] = this.properties['tilesVers'];
	gmxAPI._cmdProxy('setVectorTiles', { 'obj': this, 'attr':ph });
}

// Для Layer
FlashMapObject.prototype.getDepth = function(attr) { return gmxAPI._cmdProxy('getDepth', { 'obj': this }); }
FlashMapObject.prototype.getZoomBounds = function() { return gmxAPI._cmdProxy('getZoomBounds', { 'obj': this }); }
FlashMapObject.prototype.setZoomBounds = function(minZoom, maxZoom) {
	this.minZoom = minZoom;
	this.maxZoom = maxZoom;
	return gmxAPI._cmdProxy('setZoomBounds', { 'obj': this, 'attr':{'minZ':minZoom, 'maxZ':maxZoom} });
}

FlashMapObject.prototype.setCopyright = function(copyright)
{
	if('addCopyrightedObject' in gmxAPI.map) {
		this.copyright = copyright;
		gmxAPI.map.addCopyrightedObject(this);
	}
}
FlashMapObject.prototype.setBackgroundColor = function(color)
{
	this.backgroundColor = color;
	gmxAPI._cmdProxy('setBackgroundColor', { 'obj': this, 'attr':color });
}
FlashMapObject.prototype.addOSM = function() { var osm = this.addObject(); osm.setOSMTiles(); return osm; }

// keepGeometry - если не указан или false, объект будет превращён в полигон размером во весь мир (показывать OSM везде), 
//                иначе геометрия не будет изменяться (например, чтобы делать вклейки из OSM в другие тайлы)
FlashMapObject.prototype.setOSMTiles = function( keepGeometry)
{
	if (!keepGeometry)
		this.setPolygon([-180, -85, -180, 85, 180, 85, 180, -85, -180, -85]);
		
	var func = window.OSMTileFunction ? window.OSMTileFunction : function(i, j, z)
	{
		//return "http://b.tile.openstreetmap.org/" + z + "/" + i + "/" + j + ".png";
		var letter = ["a", "b", "c", "d"][((i + j)%4 + 4)%4];
		//return "http://" + letter + ".tile.osmosnimki.ru/kosmo" + gmxAPI.KOSMOSNIMKI_LOCALIZED("", "-en") + "/" + z + "/" + i + "/" + j + ".png";
		return "http://" + letter + ".tile.osm.kosmosnimki.ru/kosmo" + gmxAPI.KOSMOSNIMKI_LOCALIZED("", "-en") + "/" + z + "/" + i + "/" + j + ".png";
	}

	var urlOSM = "http://{s}.tile.osmosnimki.ru/kosmo" + gmxAPI.KOSMOSNIMKI_LOCALIZED("", "-en") + "/{z}/{x}/{y}.png";
	this._subdomains = 'abcd';
	this._urlOSM = urlOSM;
	if (gmxAPI.proxyType === 'leaflet' && window.OSMhash) {			// Это leaflet версия
		this._subdomains = window.OSMhash.subdomains;
		this._urlOSM = window.OSMhash.urlOSM;
	}

	this.setBackgroundTiles(function(i, j, z)
	{
		var size = Math.pow(2, z - 1);
		return func(i + size, size - j - 1, z);
	}, 1);
	
	this.setCopyright("&copy; участники OpenStreetMap, <a href='http://www.opendatacommons.org/licenses/odbl/'>ODbL</a>");
	this.setBackgroundColor(0xffffff);
	this.setTileCaching(false);
}

/* не используется
FlashMapObject.prototype.loadJSON = function(url)
{
	flashDiv.loadJSON(this.objectId, url);
}
*/

// Будут внешние
FlashMapObject.prototype.loadGML = function(url, func)
{
	var me = this;
	var _hostname = gmxAPI.getAPIHostRoot() + "ApiSave.ashx?get=" + encodeURIComponent(url);
	sendCrossDomainJSONRequest(_hostname, function(response)
	{
		if(typeof(response) != 'object' || response['Status'] != 'ok') {
			gmxAPI.addDebugWarnings({'_hostname': _hostname, 'url': url, 'Error': 'bad response'});
			return;
		}
		var geometries = gmxAPI.parseGML(response['Result']);
		for (var i = 0; i < geometries.length; i++)
			me.addObject(geometries[i], null);
		if (func)
			func();
	})
}
FlashMapObject.prototype.loadWFS = FlashMapObject.prototype.loadGML;

/** Заружает WMS слои как подъобъекты данного объекта. Слои добавляются невидимыми
	@param url {string} - URL WMS сервера
	@param func {function} - ф-ция, которая будет вызвана когда WMS слои добавятся на карту.
*/
FlashMapObject.prototype.loadWMS = function(url, func)
{
	gmxAPI._loadWMS(gmxAPI.map, this, url, func);
}

FlashMapObject.prototype.loadMap = function(arg1, arg2, arg3)
{
	var hostName = gmxAPI.map.defaultHostName;
	var mapName = null;
	var callback = null;
	if (arg3)
	{
		hostName = arg1;
		mapName = arg2;
		callback = arg3;
	}
	else if (arg2)
	{
		if (typeof(arg2) == 'function')
		{
			mapName = arg1;
			callback = arg2;
		}
		else
		{
			hostName = arg1;
			mapName = arg2;
		}
	}
	else
		mapName = arg1;
	var me = this;
	loadMapJSON(hostName, mapName, function(layers)
	{
		me.addLayers(layers, true);
		if (callback)
			callback();
	});
}

function createFlashMapInternal(div, layers, callback)
{
	if(layers.properties && layers.properties.name == kosmosnimki_API) {
		if (layers.properties.OnLoad)		//  Обработка маплета базовой карты
		{
			try { eval("_kosmosnimki_temp=(" + layers.properties.OnLoad + ")")(); }
			catch (e) {
				gmxAPI.addDebugWarnings({'func': 'createKosmosnimkiMapInternal', 'handler': 'маплет карты', 'event': e, 'alert': 'Error in "'+layers.properties.title+'" mapplet: ' + e});
			}
		}
	}

	gmxAPI._div = div;	// DOM элемент - контейнер карты
	if (div.style.position != "absolute")
		div.style.position = "relative";

	history.navigationMode = 'compatible';
	var body = document.getElementsByTagName("body").item(0);
	if (body && !body.onunload)
		body.onunload = function() {};
	if (!window.onunload)
		window.onunload = function() {};

	var apiBase = gmxAPI.getAPIFolderRoot();

	//var focusLink = document.createElement("a");

	//gmxAPI._dispatchEvent = gmxAPI._listeners.dispatchEvent;
	//addListener = gmxAPI._listeners.addListener;
	//removeListener = gmxAPI._listeners.removeListener;

	var loadCallback = function(rootObjectId)
	{
		if (!gmxAPI.isProxyReady())
		{
			setTimeout(function() { loadCallback(rootObjectId); }, 100);
			return;
		}

		var flashDiv = document.getElementById(flashId);
		gmxAPI.flashDiv = flashDiv;
		flashDiv.style.MozUserSelect = "none";

		var map = gmxAPI._addNewMap(rootObjectId, layers, callback);
		if (callback) {
			try {
				callback(gmxAPI.map, layers);		// Вызов createFlashMapInternal
			} catch(e) {
				gmxAPI.addDebugWarnings({'func': 'createFlashMapInternal', 'event': e, 'alert': 'Error in:\n "'+layers.properties.OnLoad+'"\n Error: ' + e});
			}
		}
		if('miniMap' in gmxAPI.map && !gmxAPI.miniMapAvailable) {
			gmxAPI.map.miniMap.setVisible(true);
		}

		var propsBalloon = (gmxAPI.map.balloonClassObject ? gmxAPI.map.balloonClassObject.propsBalloon : null);
		if (gmxAPI.proxyType === 'flash') {			// Это flash версия
			var needToStopDragging = false;
			gmxAPI.flashDiv.onmouseout = function(ev) 
			{
				var event = gmxAPI.compatEvent(ev);
				if(!event || (propsBalloon && propsBalloon.leg == event.relatedTarget)) return;
				if (!needToStopDragging) {
					gmxAPI.map.setCursorVisible(false);
					needToStopDragging = true;
				}
			}
			gmxAPI.flashDiv.onmouseover = function(ev)
			{
				var event = gmxAPI.compatEvent(ev);
				if(!event || (propsBalloon && propsBalloon.leg == event.relatedTarget)) return;
				if (needToStopDragging) {
					gmxAPI.map.stopDragging();
					gmxAPI.map.setCursorVisible(true);
					needToStopDragging = false;
				}
			}
		}
	}

	if('_addProxyObject' in gmxAPI) {	// Добавление обьекта отображения в DOM
		var o = gmxAPI._addProxyObject(gmxAPI.getAPIFolderRoot(), flashId, "100%", "100%", "10", "#ffffff", loadCallback, window.gmxFlashLSO);
		if(o === '') {
			var warnDiv = document.getElementById('noflash');
			if(warnDiv) warnDiv.style.display = 'block';
		} else {
			if(o.nodeName === 'DIV') {
				gmxAPI._div.innerHTML = '';
				gmxAPI._div.appendChild(o);
				//gmxAPI._div.appendChild(div);
			}
			else 
			{
				o.write(div);
			}
		}
	}

	return true;
}

window.createFlashMapInternal = createFlashMapInternal;

})();

function createKosmosnimkiMapInternal(div, layers, callback)
{
	var finish = function()
	{
		var parseBaseMap = function(kosmoLayers) {
			createFlashMapInternal(div, kosmoLayers, function(map)
			{
				for (var i = 0; i < map.layers.length; i++) {
					var obj = map.layers[i];
					obj.setVisible(false);
				}
				var mapString = gmxAPI.KOSMOSNIMKI_LOCALIZED("Карта", "Map");
				var satelliteString = gmxAPI.KOSMOSNIMKI_LOCALIZED("Снимки", "Satellite");
				var hybridString = gmxAPI.KOSMOSNIMKI_LOCALIZED("Гибрид", "Hybrid");

				var baseLayerTypes = {
					'map': {
						'onClick': function() { gmxAPI.map.setMode('map'); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0xffffff,
						'alias': 'map',
						'lang': { 'ru': 'Карта', 'en': 'Map' },
						'hint': mapString
					}
					,
					'satellite': {
						'onClick': function() { gmxAPI.map.setMode('satellite'); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0x000001,
						'alias': 'satellite',
						'lang': { 'ru': 'Снимки', 'en': 'Satellite' },
						'hint': satelliteString
					}
					,
					'hybrid': {
						'onClick': function() { gmxAPI.map.setMode('hybrid'); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0x000001,
						'alias': 'hybrid',
						'lang': { 'ru': 'Гибрид', 'en': 'Hybrid' },
						'hint': hybridString
					}
				};
				
				var mapLayers = [];
				var mapLayerID = gmxAPI.getBaseMapParam("mapLayerID", "");
				if(typeof(mapLayerID) == 'string') {
					var mapLayerNames = mapLayerID.split(',');
					for (var i = 0; i < mapLayerNames.length; i++)
						if (mapLayerNames[i] in map.layers)
						{
							var mapLayer = map.layers[mapLayerNames[i]];
							//mapLayer.setVisible(true);						// Слои BaseMap должны быть видимыми
							mapLayer.setAsBaseLayer(mapString, baseLayerTypes['map']);
							mapLayer.setBackgroundColor(baseLayerTypes['map']['backgroundColor']);
							mapLayers.push(mapLayer);
						}
				}
				var satelliteLayers = [];
				var satelliteLayerID = gmxAPI.getBaseMapParam("satelliteLayerID", "");
				if(typeof(satelliteLayerID) == 'string') {
					var satelliteLayerNames = satelliteLayerID.split(",");
					
					for (var i = 0; i < satelliteLayerNames.length; i++)
						if (satelliteLayerNames[i] in map.layers)
							satelliteLayers.push(map.layers[satelliteLayerNames[i]]);
							
					for (var i = 0; i < satelliteLayers.length; i++)
					{
						satelliteLayers[i].setAsBaseLayer(satelliteString, baseLayerTypes['satellite'])
						satelliteLayers[i].setBackgroundColor(baseLayerTypes['satellite']['backgroundColor']);
					}
				}
				
				var isAnyExists = false;
				var overlayLayers = [];
				var overlayLayerID = gmxAPI.getBaseMapParam("overlayLayerID", "");
				if(typeof(overlayLayerID) == 'string') {
					var overlayLayerNames = overlayLayerID.split(',');
					for (var i = 0; i < overlayLayerNames.length; i++)
						if (overlayLayerNames[i] in map.layers)
						{
							isAnyExists = true;
							var overlayLayer = map.layers[overlayLayerNames[i]];
							overlayLayer.setAsBaseLayer(hybridString, baseLayerTypes['hybrid']);
							overlayLayer.setBackgroundColor(baseLayerTypes['hybrid']['backgroundColor']);
							overlayLayers.push(overlayLayer);
						}
					
					if (isAnyExists)
					{
						for (var i = 0; i < satelliteLayers.length; i++) {
							satelliteLayers[i].setAsBaseLayer(hybridString, baseLayerTypes['hybrid']);						
							satelliteLayers[i].setBackgroundColor(baseLayerTypes['hybrid']['backgroundColor']);
						}
					}
				}
				
				var setOSMEmbed = function(layer)
				{
					layer.enableTiledQuicklooksEx(function(o, image)
					{
						image.setOSMTiles(true);
						//image.setCopyright("<a href='http://openstreetmap.org'>&copy; OpenStreetMap</a>, <a href='http://creativecommons.org/licenses/by-sa/2.0/'>CC-BY-SA</a>");
						image.setZoomBounds(parseInt(o.properties["text"]), 18);
					}, 10, 18);
				}
				
				var osmEmbedID = gmxAPI.getBaseMapParam("osmEmbedID", "");
				if(typeof(osmEmbedID) != 'string') osmEmbedID = "06666F91C6A2419594F41BDF2B80170F";
				var osmEmbed = map.layers[osmEmbedID];
				if (osmEmbed)
				{
					osmEmbed.setAsBaseLayer(mapString);
					setOSMEmbed(osmEmbed);
				}

				if('miniMap' in map) {
					//map.miniMap.setVisible(true);
					for (var m = 0; m < mapLayers.length; m++) {
						map.miniMap.addLayer(mapLayers[m], true, true);
					}
					if (osmEmbed)
					{
						map.miniMap.addLayer(osmEmbed, null, true);
						setOSMEmbed(map.miniMap.layers[osmEmbed.properties.name]);
					}
				}
					
				if (!window.baseMap || !window.baseMap.hostName || (window.baseMap.hostName == "maps.kosmosnimki.ru"))
					map.geoSearchAPIRoot = typeof window.searchAddressHost !== 'undefined' ? window.searchAddressHost : "http://maps.kosmosnimki.ru/";
	
				map.needSetMode = (mapLayers.length > 0 ? mapString : satelliteString);
				if (layers)
				{
					map.defaultHostName = layers.properties.hostName;
					map.addLayers(layers, false);
					map.properties = layers.properties;
				}
				if(gmxAPI.proxyType === 'flash' && map.needSetMode) map.setMode(map.needSetMode);

				// копирайты
				var setCopyright = function(o, z1, z2, text)
				{
					var c = o.addObject();
					c.setZoomBounds(z1, z2);
					c.setCopyright(text);
					return c;
				}

				if (mapLayers.length > 0)
				{
					setCopyright(mapLayers[0], 1, 9, "<a href='http://www.bartholomewmaps.com/'>&copy; Collins Bartholomew</a>");
					var obj = setCopyright(mapLayers[0], 10, 20, "<a href='http://www.geocenter-consulting.ru/'>&copy; " + gmxAPI.KOSMOSNIMKI_LOCALIZED("ЗАО &laquo;Геоцентр-Консалтинг&raquo;", "Geocentre Consulting") + "</a>");
					obj.geometry = { type: "LINESTRING", coordinates: [29, 40, 180, 80] };
				}
				
				//те же копирайты, что и для карт
				if (overlayLayers.length > 0)
				{
					setCopyright(overlayLayers[0], 1, 9, "<a href='http://www.bartholomewmaps.com/'>&copy; Collins Bartholomew</a>");
					var obj = setCopyright(overlayLayers[0], 10, 20, "<a href='http://www.geocenter-consulting.ru/'>&copy; " + gmxAPI.KOSMOSNIMKI_LOCALIZED("ЗАО &laquo;Геоцентр-Консалтинг&raquo;", "Geocentre Consulting") + "</a>");
					obj.geometry = { type: "LINESTRING", coordinates: [29, 40, 180, 80] };
				}

				if ( satelliteLayers.length > 0 )
				{
					setCopyright(satelliteLayers[0], 1, 5, "<a href='http://www.nasa.gov'>&copy; NASA</a>");
					setCopyright(satelliteLayers[0], 6, 13,	"<a href='http://www.es-geo.com'>&copy; Earthstar Geographics</a>");
					var obj = setCopyright(satelliteLayers[0], 6, 14, "<a href='http://www.antrix.gov.in/'>&copy; ANTRIX</a>");
					obj.geometry = gmxAPI.from_merc_geometry({ type: "LINESTRING", coordinates: [1107542, 2054627, 5048513, 8649003] });
					setCopyright(satelliteLayers[0], 9,	17,	"<a href='http://www.geoeye.com'>&copy; GeoEye Inc.</a>");
				}
				
				try {
					callback(map, layers);		// Передача управления
				} catch(e) {
					gmxAPI.addDebugWarnings({'func': 'createKosmosnimkiMapInternal', 'event': e, 'alert': 'Ошибка в callback:\n'+e});
				}
				if(map.needMove) {
					gmxAPI.currPosition = null;
					var x = map.needMove['x'];
					var y = map.needMove['y'];
					var z = map.needMove['z'];
					if(gmxAPI.proxyType === 'flash') map.needMove = null;
					map.moveTo(x, y, z);
				}
				if(map.needSetMode) {
					var needSetMode = map.needSetMode;
					map.needSetMode = null;
					map.setMode(needSetMode);
				}
			});
		};
		var getBaseMap = function()
		{
			var mapProp = (typeof window.gmxNullMap === 'object' ? window.gmxNullMap : null);
			if(mapProp) {
				window.KOSMOSNIMKI_LANGUAGE = window.KOSMOSNIMKI_LANGUAGE || {'eng': 'English', 'rus': 'Russian'}[mapProp.properties.DefaultLanguage];
				createFlashMapInternal(div, mapProp, callback);
			} else {
				loadMapJSON(
					gmxAPI.getBaseMapParam("hostName", "maps.kosmosnimki.ru"), 
					gmxAPI.getBaseMapParam("id", kosmosnimki_API),
					parseBaseMap,
					function()
					{
						createFlashMapInternal(div, layers, callback);
					}
				);
			}
		}
		if (!gmxAPI.getScriptURL("config.js"))
		{
			gmxAPI.loadVariableFromScript(
				gmxAPI.getAPIFolderRoot() + "config.js",
				"gmxNullMap",
				getBaseMap,
				getBaseMap
			);
		}
		else
			getBaseMap();
	}
	var errorConfig = function()
	{
		createFlashMapInternal(div, {}, callback);
	}
	if (!gmxAPI.getScriptURL("config.js"))
	{
		gmxAPI.loadVariableFromScript(
			gmxAPI.getAPIFolderRoot() + "config.js",
			"baseMap",
			finish,
			//errorConfig	// Нет config.js
			finish			// Есть config.js
		);
	}
	else
		finish();
};
