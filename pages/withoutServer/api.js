/* ======================================================================
    APICore.js
   ====================================================================== */

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
    APILoaded: false							// Флаг возможности использования gmxAPI сторонними модулями
	,
    initParams: null							// Параметры заданные при создании карты 
	,
    buildGUID: ["056100c0dfc911e287e21c7508d3f2e5"][0]		// GUID текущей сборки
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
		var pts = [];
		for (var i in points)
			pts.push([points[i][0], Math.sin(points[i][1]*Math.PI/180)]);
		var area = 0;
		for (var i in pts)
		{
			var ipp = (i == (pts.length - 1) ? 0 : (parseInt(i) + 1));
			area += (pts[i][0]*pts[ipp][1] - pts[ipp][0]*pts[i][1]);
		}
		var out = Math.abs(area*gmxAPI.lambertCoefX*gmxAPI.lambertCoefY/2);
		return out;
	}
	,
	fragmentAreaMercator: function(points)
	{
		var pts = [];
		for (var i in points)
			pts.push([gmxAPI.from_merc_x(points[i][0]), gmxAPI.from_merc_y(points[i][1])]);
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
				//if (script.readyState === 'loaded' || this.readyState === 'complete' )
				if (script.readyState === 'complete')
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
							layer.mercGeometry = layer.geometry;
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
				var mapString = KOSMOSNIMKI_LOCALIZED("Карта", "Map");
				var satelliteString = KOSMOSNIMKI_LOCALIZED("Снимки", "Satellite");
				var hybridString = KOSMOSNIMKI_LOCALIZED("Гибрид", "Hybrid");

				var baseLayerTypes = {
					'map': {
						'onClick': function() { gmxAPI.map.setBaseLayer(mapString); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0xffffff,
						'alias': 'map',
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Карта", "Map")
					}
					,
					'satellite': {
						'onClick': function() { gmxAPI.map.setBaseLayer(satelliteString); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0x000001,
						'alias': 'satellite',
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Снимки", "Satellite")
					}
					,
					'hybrid': {
						'onClick': function() { gmxAPI.map.setBaseLayer(hybridString); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'backgroundColor': 0x000001,
						'alias': 'hybrid',
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Гибрид", "Hybrid")
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
				////
				
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
				/*
				*/
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
;/* ======================================================================
    Layer.js
   ====================================================================== */

//Поддержка addLayer
(function()
{
	// получить minZoom maxZoom для слоя по фильтрам
	function getMinMaxZoom(prop)
	{
		var minZoom = 20, maxZoom = 0;
		for (var i = 0; i < prop.styles.length; i++)
		{
			var style = prop.styles[i];
			minZoom = Math.min(style.MinZoom || 1, minZoom);
			maxZoom = Math.max(style.MaxZoom || 21, maxZoom);
		}
		return {'minZoom': minZoom, 'maxZoom': maxZoom};
	}

	// Подготовка атрибутов фильтра стилей 
	function getFilterAttr(style)
	{
		// Получение стилей фильтра
		var regularStyle = {};
		if (typeof style.StyleJSON != 'undefined')
			regularStyle = style.StyleJSON;
		else if (typeof style.RenderStyle != 'undefined')
			regularStyle = style.RenderStyle;
		else
		{
			// стиль по умолчанию
			if (style.PointSize)
				regularStyle.marker = { size: parseInt(style.PointSize) };
			if (style.Icon)
			{
				var src = (style.Icon.indexOf("http://") != -1) ?
					style.Icon :
					(baseAddress + "/" + style.Icon);
				regularStyle.marker = { image: src, "center": true };
			}
			if (style.BorderColor || style.BorderWidth)
				regularStyle.outline = {
					color: gmxAPI.parseColor(style.BorderColor),
					thickness: parseInt(style.BorderWidth || "1"),
					opacity: (style.BorderWidth == "0" ? 0 : 100)
				};
			if (style.FillColor)
				regularStyle.fill = {
					color: gmxAPI.parseColor(style.FillColor),
					opacity: 100 - parseInt(style.Transparency || "0")
				};

			var label = style.label || style.Label;
			if (label)
			{
				regularStyle.label = {
					field: label.FieldName,
					color: gmxAPI.parseColor(label.FontColor),
					size: parseInt(label.FontSize || "12")
				};
			}
		}

		if (regularStyle.marker)
			regularStyle.marker.center = true;

		//var hoveredStyle = JSON.parse(JSON.stringify(regularStyle));
		var hoveredStyle = null;
		if (typeof style.HoverStyle != 'undefined') hoveredStyle = style.HoverStyle;
		else {
			hoveredStyle = JSON.parse(JSON.stringify(regularStyle));
			if (hoveredStyle.marker && hoveredStyle.marker.size) hoveredStyle.marker.size += 1;
			if (hoveredStyle.outline) hoveredStyle.outline.thickness += 1;
		}

		// Получение sql строки фильтра
		var name = '';
		var sql = '';
		if (style.Filter)
		{
			if (/^\s*\[/.test(style.Filter))
			{
				var a = style.Filter.match(/^\s*\[([a-zA-Z0-9_]+)\]\s*([<>=]=?)\s*(.*)$/);
				if (a && (a.length == 4))
				{
					sql = a[1] + " " + a[2] + " '" + a[3] + "'";
				}
			}
			else
			{
				sql = style.Filter;
			}
			if (style.Filter.Name) name = style.Filter.Name;	// имя фильтра - для map.layers в виде хэша
		}
		var DisableBalloonOnMouseMove = ('DisableBalloonOnMouseMove' in style ? style.DisableBalloonOnMouseMove : true);
		var out = {
			'name': name,
			'BalloonEnable': style.BalloonEnable || true,
			'DisableBalloonOnClick': style.DisableBalloonOnClick || false,
			'DisableBalloonOnMouseMove': DisableBalloonOnMouseMove,
			'regularStyle': regularStyle,
			'hoveredStyle': hoveredStyle,
			'MinZoom': style.MinZoom || 1,
			'MaxZoom': style.MaxZoom || 21,
			'style': style,
			'sql': sql
		};
		if(style.Balloon) out['Balloon'] = style.Balloon;
		if(style.clusters) out['clusters'] = style.clusters;
		return out;
	}

	// Инициализация фильтра
	var initFilter = function(prnt, num)
	{
		var filter = prnt.filters[num];
		var obj_ = prnt.addObject(null, null, {'nodeType': 'filter'});
		filter.objectId = obj_.objectId;

		var attr = filter._attr;
		filter.setFilter(attr['sql'] || '');

		filter.getPatternIcon = function(size)
		{
			var ph = filter.getStyle(true);
			return gmxAPI.getPatternIcon(ph['regular'], size);
		}
			
		filter.setZoomBounds(attr['MinZoom'], attr['MaxZoom']);
		//filter.setStyle(attr['regularStyle'], attr['hoveredStyle']);
		filter['_attr'] = attr;

		gmxAPI._listeners.dispatchEvent('initFilter', gmxAPI.map, {'filter': filter} );	// Проверка map Listeners на reSetStyles - для балунов
		prnt.filters[num] = filter;
		gmxAPI.mapNodes[filter.objectId] = filter;
		return filter;
	}

	// Добавление фильтра
	// Ключи :
	// * Balloon: текст баллуна
	// * BalloonEnable: показывать ли баллун
	// * DisableBalloonOnClick: не показывать при клике
	// * DisableBalloonOnMouseMove: не показывать при наведении
	// * RenderStyle: стиль фильтра
	// * MinZoom: мин.зум
	// * MaxZoom: макс.зум
	// * sql: строка фильтра
	var addFilter = function(prnt, attr)
	{
		if(!attr) attr = {};
		var filter = new gmxAPI._FMO(false, {}, prnt);	// MapObject для фильтра
		var num = prnt.filters.length;					// Номер фильтра в массиве фильтров
		var lastFilter = (num > 0 ? prnt.filters[num - 1] : null);	// Последний существующий фильтр
		if(!attr && lastFilter) {
			attr = gmxAPI.clone(lastFilter['_attr']);
		}
		if(!attr['MinZoom']) attr['MinZoom'] = 1;
		if(!attr['MaxZoom']) attr['MaxZoom'] = 21;

		filter['_attr'] = attr;
		prnt.filters.push(filter);
		if (attr['name'])
			prnt.filters[attr.name] = filter;

		if(!filter.clusters && attr['clusters'] && '_Clusters' in gmxAPI) {
			filter.clusters = new gmxAPI._Clusters(filter);	// атрибуты кластеризации потомков по фильтру
			//filter.clusters.setProperties(attr['clusters']);
			filter.setClusters(attr['clusters']);
		}
		
		gmxAPI._listeners.dispatchEvent('addFilter', prnt, {'filter': filter} );			// Listeners на слое - произошло добавление фильтра
		if(prnt.objectId) filter = initFilter(prnt, num);	// если слой виден - инициализация фильтра
		
		// Удаление фильтра
		filter.remove = function()
		{
			var ret = gmxAPI._FMO.prototype.remove.call(this);
			if(prnt.filters[attr.name]) delete prnt.filters[attr.name];
			for(var i=0; i<prnt.filters.length; i++) {
				if(this == prnt.filters[i]) {
					prnt.filters.splice(i, 1);
					break;
				}
			}
		}
		return filter;
	}

	// Добавление слоя
	var addLayer = function(parentObj, layer, isVisible, isMerc)
	{
		var FlashMapObject = gmxAPI._FMO;
		if (!parentObj.layers)
			parentObj.layers = [];
		
		if (!parentObj.layersParent) {
			parentObj.layersParent = parentObj.addObject(null, null, {'layersParent': true});
		}
		if (!parentObj.overlays)
		{
			parentObj.overlays = parentObj.addObject(null, null, {'overlaysParent': true});
			parentObj.addObject = function(geom, props, propHiden)
			{
				var ret = FlashMapObject.prototype.addObject.call(parentObj, geom, props, propHiden);
				parentObj.overlays.bringToTop();
				return ret;
			}
			
		}

		var getIndexLayer = function(sid)
		{ 
			var myIdx = parentObj.layers.length;
			var n = 0;
			for (var i = 0; i < myIdx; i++)
			{
				var l = parentObj.layers[i];
				if (l.objectId && (l.properties.type != "Overlay")) {
					if (l.objectId == sid) break;
					n += 1;
				}
			}
			return n;
		}
		
		if (isVisible === undefined)
			isVisible = true;
		
		var obj = new gmxAPI._FMO(false, {}, parentObj);					// MapObject слоя

		var zIndex = parentObj.layers.length;
		if(!layer) layer = {};
		if(!layer.properties) layer.properties = {};
		if(!layer.properties.identityField) layer.properties.identityField = "ogc_fid";
		
		//if(gmxAPI.proxyType === 'flash' && isMerc && layer.mercGeometry) {
		if(isMerc && layer.mercGeometry) {
			layer.geometry = gmxAPI.from_merc_geometry(layer.mercGeometry); 
		}
		
		if(layer.geometry && !layer.mercGeometry) {
			layer.mercGeometry = gmxAPI.merc_geometry(layer.geometry); 
		}
		if(!layer.mercGeometry) {
			layer.mercGeometry = {
				'type': "POLYGON"
				,'coordinates': [[
					[-20037500, -21133310]
					,[-20037500, 21133310]
					,[20037500, 21133310]
					,[20037500, -21133310]
					,[-20037500, -21133310]
				]]
			};
			layer.geometry = gmxAPI.from_merc_geometry(layer.mercGeometry); 
		}
		
		var isRaster = (layer.properties.type == "Raster");
		var layerName = layer.properties.name || layer.properties.image || gmxAPI.newFlashMapId();
		obj.geometry = layer.geometry;
		obj.mercGeometry = layer.mercGeometry;

		obj.properties = layer.properties;
		obj.propHiden = { 'isLayer': true, 'isMerc': isMerc };
		var isOverlay = false;
		var overlayLayerID = gmxAPI.getBaseMapParam("overlayLayerID","");
		if(typeof(overlayLayerID) == 'string') {
			var arr = overlayLayerID.split(",");
			for (var i = 0; i < arr.length; i++) {
				if(layerName == arr[i]) {
					isOverlay = true;
					break;
				}
			}
		}

		if (isOverlay)
			layer.properties.type = "Overlay";

		obj.filters = [];
		if (!isRaster)
		{
			if(!layer.properties.styles) {		// стиль-фильтр по умолчанию
				layer.properties.styles = [
					{
						'BalloonEnable': true
						,'DisableBalloonOnClick': false
						,'DisableBalloonOnMouseMove': false
						,'MinZoom': 1
						,'MaxZoom': 21
						,'RenderStyle': {'outline': {'color': 255,'thickness': 1}}
					}
				];
			}
			// Добавление начальных фильтров
			for (var i = 0; i < layer.properties.styles.length; i++)
			{
				var style = layer.properties.styles[i];
				var attr = getFilterAttr(style);
				addFilter(obj, attr);
			}
			obj.addFilter = function(attr) { return addFilter(obj, attr); };
			obj.addItems = function(attr) {		// добавление обьектов векторного слоя
				return gmxAPI._cmdProxy('addItems', { 'obj': obj, 'attr':{'layerId':obj.objectId, 'data': attr} });
			};
			obj.removeItems = function(attr) {		// удаление обьектов векторного слоя 
				return gmxAPI._cmdProxy('removeItems', { 'obj': obj, 'attr':{'layerId':obj.objectId, 'data': attr} });
			};
			obj.setSortItems = function(attr) {		// установка сортировки обьектов векторного слоя 
				return gmxAPI._cmdProxy('setSortItems', { 'obj': obj, 'attr':{'layerId':obj.objectId, 'data': attr} });
			};
			obj.bringToTopItem = function(fid) {	// Добавить обьект к массиву Flips обьектов
				return gmxAPI._cmdProxy('addFlip', { 'obj': obj, 'attr':{'layerId':obj.objectId, 'fid': fid} });
			};
			obj.disableFlip = function() {			// Отменить ротацию обьектов слоя
				return gmxAPI._cmdProxy('disableFlip', { 'obj': obj, 'attr':{'layerId':obj.objectId} });
			};
			obj.enableFlip = function() {			// Установить ротацию обьектов слоя
				return gmxAPI._cmdProxy('enableFlip', { 'obj': obj, 'attr':{'layerId':obj.objectId} });
			};
			obj.setWatcher = function(attr) {		// Установка подглядывателя обьекта под Hover обьектом
				return gmxAPI._cmdProxy('setWatcher', { 'obj': obj, 'attr':attr });
			};
			obj.removeWatcher = function() {		// Удалить подглядыватель
				return gmxAPI._cmdProxy('removeWatcher', { 'obj': obj });
			};
		}

		var hostName = layer.properties.hostName || "maps.kosmosnimki.ru";
		var mapName = layer.properties.mapName || "client_side_layer";
		var baseAddress = "http://" + hostName + "/";
		var sessionKey = isRequiredAPIKey( hostName ) ? window.KOSMOSNIMKI_SESSION_KEY : false;
		var sessionKey2 = ('sessionKeyCache' in window ? window.sessionKeyCache[mapName] : false);
		var isInvalid = (sessionKey == "INVALID");

		var chkCenterX = function(arr)
		{ 
			var centerX = 0;
			for (var i = 0; i < arr.length; i++)
			{
				centerX += parseFloat(arr[i][0]);
			}
			centerX /= arr.length;
			var prevCenter = centerX;
			centerX = gmxAPI.chkPointCenterX(centerX);
			var dx = prevCenter - centerX;
			for (var i = 0; i < arr.length; i++)
			{
				arr[i][0] -= dx;
			}
		}

		var bounds = false;				// в меркаторе
		var boundsLatLgn = false;
		var initBounds = function(geom) {	// geom в меркаторе
			if (geom) {
				bounds = gmxAPI.getBounds(geom.coordinates);
				obj.bounds = boundsLatLgn = {
					minX: gmxAPI.from_merc_x(bounds['minX']),
					minY: gmxAPI.from_merc_y(bounds['minY']),
					maxX: gmxAPI.from_merc_x(bounds['maxX']),
					maxY: gmxAPI.from_merc_y(bounds['maxY'])
				};
			}
		};
		var getBoundsMerc = function() {
			if (!bounds) initBounds(obj.mercGeometry);
			return bounds;
		};
		var getBoundsLatLng = function() {
			if (!bounds) initBounds(obj.mercGeometry);
			return boundsLatLgn;
		};
		obj.addListener('onChangeLayerVersion', function() {
			initBounds(obj.mercGeometry);
		});
		obj.getLayerBounds = function() {			// Получение boundsLatLgn для внешних плагинов
			if (!boundsLatLgn) initBounds(obj.mercGeometry);
			return boundsLatLgn;
		}

		var tileSenderPrefix = baseAddress + 
			"TileSender.ashx?ModeKey=tile" + 
			"&MapName=" + mapName + 
			"&LayerName=" + layerName + 
			(sessionKey ? ("&key=" + encodeURIComponent(sessionKey)) : "") +
			(sessionKey2 ? ("&MapSessionKey=" + sessionKey2) : "");

		var tileFunction = function(i, j, z)
		{
			if (isRaster)
			{
				if (!bounds) initBounds(obj.mercGeometry);
				var tileSize = gmxAPI.getScale(z)*256;
				var minx = i*tileSize;
				var maxx = minx + tileSize;
				if (maxx < bounds.minX) {
					i += Math.pow(2, z);
				}
				else if (minx > bounds.maxX) {
					i -= Math.pow(2, z);
				}
			}

			return tileSenderPrefix + 
				"&z=" + z + 
				"&x=" + i + 
				"&y=" + j;
		}

		var isTemporal = layer.properties.Temporal || false;	// признак мультивременного слоя
		if(isTemporal && '_TemporalTiles' in gmxAPI) {
			obj._temporalTiles = new gmxAPI._TemporalTiles(obj);
		}

		var isLayerVers = obj.properties.tilesVers || obj.properties.TemporalVers || false;
		if(gmxAPI._layersVersion && isLayerVers) {		// Установлен модуль версий слоев + есть версии тайлов слоя
			gmxAPI._layersVersion.chkVersion(obj);
			obj.chkLayerVersion = function(callback) {
				gmxAPI._layersVersion.chkLayerVersion(obj, callback);
			}
		}

		var deferredMethodNames = [
			'getChildren', 'getItemsFromExtent', 'getTileItem', 'setTileItem',
			'getDepth', 'getZoomBounds', 'getVisibility', 'getStyle', 'getIntermediateLength',
			'getCurrentEdgeLength', 'getLength', 'getArea', 'getGeometryType', 'getStat', 'flip',
			'setZoomBounds', 'setBackgroundTiles', 'startLoadTiles', 'setVectorTiles', 'setTiles', 'setTileCaching',
			'setImageExtent', 'setImage', 'bringToTop', 'bringToDepth', 'setDepth', 'bringToBottom',
			'setGeometry', 'setActive',  'setEditable', 'startDrawing', 'stopDrawing', 'isDrawing', 'setLabel', 'setDisplacement',
			'removeHandler', 'clearBackgroundImage', 'addObjects', 'addObjectsFromSWF',
			'setHandler', 'setVisibilityFilter', //'remove', 'addListener', 'removeListener',
			'setClusters', 'addImageProcessingHook',
			'setStyle', 'setBackgroundColor', 'setCopyright', 'addObserver', 'enableTiledQuicklooks', 'enableTiledQuicklooksEx'
		];
		// не используемые команды addChildRoot getFeatureGeometry getFeatureLength getFeatureArea

		var createThisLayer = function()
		{
			var pObj = (isOverlay ? parentObj.overlays : parentObj.layersParent);
			var obj_ = pObj.addObject(obj.geometry, obj.properties, obj.propHiden);
			obj_['backgroundColor'] = obj['backgroundColor'];
			obj_['stateListeners'] = obj['stateListeners'];
			if(obj['isBaseLayer']) obj_['isBaseLayer'] = obj['isBaseLayer'];
			if(obj['_temporalTiles']) obj_['_temporalTiles'] = obj['_temporalTiles'];
			obj.objectId = obj_.objectId;
			if(pObj.isMiniMap) {
				obj.isMiniMap = true;			// Все добавляемые к миникарте ноды имеют этот признак
			}
			obj_.getLayerBoundsLatLgn = function() {			// Получение boundsLatLgn
				if (!boundsLatLgn) initBounds(obj.mercGeometry);
				return boundsLatLgn;
			}
			obj_.getLayerBoundsMerc = function() {				// Получение bounds в меркаторе
				if (!bounds) initBounds(obj.mercGeometry);
				return bounds;
			}
			obj_.getLayerBounds = function() {			// Получение boundsLatLgn для внешних плагинов
				if (!boundsLatLgn) initBounds(obj.mercGeometry);
				return boundsLatLgn;
			}
			obj.addObject = function(geometry, props, propHiden) { return FlashMapObject.prototype.addObject.call(obj, geometry, props, propHiden); }
			obj.tileSenderPrefix = tileSenderPrefix;	// Префикс запросов за тайлами
			
			gmxAPI._listeners.dispatchEvent('onLayerCreated', obj, {'obj': obj });
		
			obj.setVisible = function(flag)
			{
				FlashMapObject.prototype.setVisible.call(obj, flag);
			}

			for (var i = 0; i < deferredMethodNames.length; i++)
				delete obj[deferredMethodNames[i]];
			delete obj["getFeatures"];
			delete obj["getFeatureById"];
			if (!isRaster)
			{
				obj.setHandler = function(eventName, handler)
				{
					FlashMapObject.prototype.setHandler.call(obj, eventName, handler);
					for (var i = 0; i < obj.filters.length; i++)
						obj.filters[i].setHandler(eventName, handler);
				}
				obj.removeHandler = function(eventName)
				{
					FlashMapObject.prototype.removeHandler.call(obj, eventName);
					for (var i = 0; i < obj.filters.length; i++)
						obj.filters[i].removeHandler(eventName);
				}
				obj.addListener = function(eventName, handler, level)
				{
					var pID = FlashMapObject.prototype.addListener.call(obj, eventName, handler, level);
					//var arr = obj.stateListeners[eventName] || [];
					for (var i = 0; i < obj.filters.length; i++) {
						var fID = gmxAPI._listeners.addListener({'level': level, 'pID': pID, 'obj': obj.filters[i], 'eventName': eventName, 'func': handler});
						//var fID = obj.filters[i].addListener(eventName, handler, pID);
						//if(fID) arr.push(fID);
					}
					//obj.stateListeners[eventName] = arr;
					return pID;
				}
				obj.removeListener = function(eventName, eID)
				{
					FlashMapObject.prototype.removeListener.call(obj, eventName, eID);
					for (var i = 0; i < obj.filters.length; i++)
						obj.filters[i].removeListener(eventName, eID);	// Удаляем массив события eventName по id события слоя
				}
				
			}
			obj._observerOnChange = null;
			obj.addObserver = function(o, onChange, attr)
			{
				var observeByLayerZooms = false;
				if(typeof(o) == 'function') { // вызов без доп. mapObject
					attr = onChange;
					onChange = o;
					o = obj.addObject();
					observeByLayerZooms = true;
				}
				var fAttr = {
					'layerId': obj.objectId
					,'asArray': true
					,'ignoreVisibilityFilter': (attr && attr['ignoreVisibilityFilter'] ? true : false)
				};
				var outCallBacks = function(arr) {
					var out = [];
				}
				var func = function(arr) {
					var out = [];
					for (var i = 0; i < arr.length; i++) {
						var item = arr[i];
						var geo = (gmxAPI.proxyType === 'leaflet' ? item.geometry : gmxAPI.from_merc_geometry(item.geometry));
						var mObj = new gmxAPI._FlashMapFeature(geo, item.properties, obj);
						var ph = {'onExtent':item.onExtent, 'item':mObj, 'isVisibleFilter':item['isVisibleFilter'], 'status':item['status']};
						out.push(ph);
					}
					for (var j = 0; j < obj._observerOnChange.length; j++) {
						var ph = obj._observerOnChange[j];
						if(out.length) ph[0](out);
					}
				}
				fAttr['func'] = func;
				
				if(!obj._observerOnChange) {
					gmxAPI._cmdProxy('observeVectorLayer', { 'obj': o, 'attr':fAttr});
					obj._observerOnChange = [];
				}
				obj._observerOnChange.push([onChange, fAttr['ignoreVisibilityFilter']]);
				if(observeByLayerZooms) {
					gmxAPI._cmdProxy('setAPIProperties', { 'obj': obj, 'attr':{'observeByLayerZooms':true} });	// есть новый подписчик события изменения видимости обьектов векторного слоя
				}
			}
			if (isRaster) {
				var ph = {
					'func':tileFunction
					,'projectionCode':0
					,'minZoom': layer.properties['MinZoom']
					,'maxZoom': layer.properties['MaxZoom']
					,'tileSenderPrefix': tileSenderPrefix
					,'bounds': bounds
				};
				gmxAPI._cmdProxy('setBackgroundTiles', {'obj': obj, 'attr':ph });
			} else
			{
				obj.getFeatures = function()
				{
					var callback, geometry, str;
					for (var i = 0; i < 3; i++)
					{
						var arg = arguments[i];
						if (typeof arg == 'function')
							callback = arg;
						else if (typeof arg == 'string')
							str = arg || ' ';
						else if (typeof arg == 'object')
							geometry = arg;
					}
					//if (!str && (obj.properties.GeometryType == "point")) {
					if (!str) {
						gmxAPI._cmdProxy('getFeatures', { 'obj': obj, 'attr':{'geom': geometry, 'func': callback}});
					}
					else
					{
						if (str === ' ') str = '';
						gmxAPI.map.getFeatures(str, geometry, callback, [obj.properties.name]);		// Поиск через JSONP запрос
					}
				}
				obj.getFeaturesByCenter = function(func)
				{
					gmxAPI._cmdProxy('getFeatures', { 'obj': obj, 'attr':{'center':true, 'func': func} });
				}

				obj.getFeatureById = function(fid, func)
				{
					gmxAPI._cmdProxy('getFeatureById', { 'obj': obj, 'attr':{'fid':fid, 'func': func} });
				}
				obj.setStyle = function(style, activeStyle)
				{
					for (var i = 0; i < obj.filters.length; i++)
						obj.filters[i].setStyle(style, activeStyle);
				}

				if(obj._temporalTiles) {	// Для мультивременных слоёв
					obj._temporalTiles.setVectorTiles();
				} else {
					if(!layer.properties.tiles) layer.properties.tiles = [];
					obj.setVectorTiles(tileFunction, layer.properties.identityField, layer.properties.tiles);
				}

				for (var i = 0; i < obj.filters.length; i++) {
					obj.filters[i] = initFilter(obj, i);
				}

				// Изменить атрибуты векторного обьекта из загруженных тайлов
				obj.setTileItem = function(data, flag) {
					var _obj = gmxAPI._cmdProxy('setTileItem', { 'obj': this, 'attr': {'data':data, 'flag':(flag ? true:false)} });
					return _obj;
				}
				// Получить атрибуты векторного обьекта из загруженных тайлов id по identityField
				obj.getTileItem = function(vId) {
					var _obj = gmxAPI._cmdProxy('getTileItem', { 'obj': this, 'attr': vId });
					if(_obj.geometry) _obj.geometry = gmxAPI.from_merc_geometry(_obj.geometry);
					return _obj;
				}
				obj.getStat = function() {
					var _obj = gmxAPI._cmdProxy('getStat', { 'obj': this });
					return _obj;
				}
				obj.setTiles = function(data, flag) {
					var _obj = gmxAPI._cmdProxy('setTiles', { 'obj': obj, 'attr':{'tiles':data, 'flag':(flag ? true:false)} });
					return _obj;
				}

				if (layer.properties.IsRasterCatalog) {
					var RCMinZoomForRasters = layer.properties.RCMinZoomForRasters || 1;
					obj.enableTiledQuicklooks(function(o)
					{
						var qURL = tileSenderPrefix + '&x={x}&y={y}&z={z}&idr=' + o.properties[layer.properties.identityField];
						return qURL;
					}, RCMinZoomForRasters, layer.properties.TiledQuicklookMaxZoom, tileSenderPrefix);
					obj.getRCTileUrl = function(x, y, z, pid) {
						return tileSenderPrefix + '&x='+x+'&y='+y+'&z='+z+'&idr=' + pid;
					};
					obj.addImageProcessingHook = function(func) {
						return gmxAPI._cmdProxy('addImageProcessingHook', { 'obj': obj, 'attr':{'func':func} });
					};
					
				} else {
					if (layer.properties.Quicklook) {
						obj.enableQuicklooks(function(o)
						{
							obj.bringToTop();
							return gmxAPI.applyTemplate(layer.properties.Quicklook, o.properties);
						});
					}
					if (layer.properties.TiledQuicklook) {
						obj.enableTiledQuicklooks(function(o)
						{
							return gmxAPI.applyTemplate(layer.properties.TiledQuicklook, o.properties);
						}, layer.properties.TiledQuicklookMinZoom);
					}
				}
			}

			for (var i = 0; i < obj.filters.length; i++)
			{
				var filter = obj.filters[i];
				filter.setStyle(filter['_attr']['regularStyle'], filter['_attr']['hoveredStyle']);
				if(filter['_attr']['clusters']) filter.setClusters(filter['_attr']['clusters']);
				delete filter["setVisible"];
				delete filter["setStyle"];
				delete filter["setFilter"];
				delete filter["enableHoverBalloon"];
				delete filter["setClusters"];
				filter["setZoomBounds"] = FlashMapObject.prototype.setZoomBounds;
			}

			// Установка видимости по Zoom
			var tmp = getMinMaxZoom(layer.properties);
			obj.setZoomBounds(tmp['minZoom'], tmp['maxZoom']);

			if(!obj.isMiniMap) {					// если это не miniMap
				if (layer.properties.Copyright) {
					obj.setCopyright(layer.properties.Copyright);
				}
			}
			if(obj_['tilesParent']) obj['tilesParent'] = obj_['tilesParent'];
		}

		obj.mercGeometry = layer.mercGeometry;
		if(gmxAPI.proxyType === 'flash') initBounds(obj.mercGeometry);
		obj.isVisible = isVisible;
		//if (isVisible || gmxAPI.proxyType === 'leaflet') {			// В leaflet версии deferredMethod не нужны
		if (isVisible) {
			createThisLayer();
			//var zIndexCur = getIndexLayer(obj.objectId);
			obj.bringToDepth(zIndex);
			gmxAPI._listeners.dispatchEvent('onLayer', obj, obj);	// Вызов Listeners события 'onLayer' - слой теперь инициализирован во Flash
		}
		else
		{
			var deferred = [];
			obj.setVisible = function(flag, notDispatch)
			{
				if (flag)
				{
					createThisLayer();
					if(obj.objectId) FlashMapObject.prototype.setVisible.call(obj, flag, notDispatch);		// без Dispatch события
					for (var i = 0; i < deferred.length; i++) {
						deferred[i]();
					}
					//var zIndexCur = getIndexLayer(obj.objectId);
					gmxAPI._listeners.dispatchEvent('onLayer', obj, obj);	// Вызов Listeners события 'onLayer' - слой теперь инициализирован во Flash
				}
			}

			if (!isRaster) {
				// Изменять атрибуты векторного обьекта при невидимом слое нельзя
				obj.setTileItem = function(data, flag) {
					return false;
				}
				// Получить атрибуты векторного обьекта при невидимом слое нельзя
				obj.getTileItem = function(vId) {
					return null;
				}
			}
			obj.addObject = function(geometry, props, propHiden)
			{
				obj.setVisible(true);
				var newObj = FlashMapObject.prototype.addObject.call(obj, geometry, props, propHiden);
				FlashMapObject.prototype.setVisible.call(obj, false, true);		// без Dispatch события
				//obj.setVisible(false);
				return newObj;
			}
			for (var i = 0; i < deferredMethodNames.length; i++) (function(name)
			{
				obj[name] = function(p1, p2, p3, p4) 
				{ 
					deferred.push(function() { obj[name].call(obj, p1, p2, p3, p4); });
				}
			})(deferredMethodNames[i]);
			if (gmxAPI.proxyType === 'leaflet') obj.bringToDepth(zIndex);
			if (!isRaster)
			{
/*
				obj.setHandler = function(eventName, handler)
				{							
					obj.setVisible(true);
					obj.setHandler(eventName, handler);
					obj.setVisible(false);
				}
*/
				obj.getFeatures = function(arg1, arg2, arg3)
				{							
					obj.setVisible(true, true);
					obj.getFeatures(arg1, arg2, arg3);
					FlashMapObject.prototype.setVisible.call(obj, false, true);		// без Dispatch события
					//obj.setVisible(false);
				}
				obj.getFeatureById = function(arg1, arg2, arg3)
				{							
					obj.setVisible(true);
					obj.getFeatureById(arg1, arg2, arg3);
					FlashMapObject.prototype.setVisible.call(obj, false, true);		// без Dispatch события
					//obj.setVisible(false);
				}
				for (var i = 0; i < layer.properties.styles.length; i++) (function(i)
				{
					obj.filters[i].setZoomBounds = function(minZoom, maxZoom)
					{
						if(!obj.filters[i]['_attr']) obj.filters[i]['_attr'] = {};
						obj.filters[i]['_attr']['MinZoom'] = minZoom;
						obj.filters[i]['_attr']['MaxZoom'] = maxZoom;
						deferred.push(function() {
							obj.filters[i].setZoomBounds(minZoom, maxZoom);
							});
					}
					obj.filters[i].setVisible = function(flag)
					{
						deferred.push(function() {
							obj.filters[i].setVisible(flag);
							});
					}
					obj.filters[i].setStyle = function(style, activeStyle)
					{
						deferred.push(function() {
							obj.filters[i].setStyle(style, activeStyle);
							});
					}
					obj.filters[i].setFilter = function(sql)
					{
						if(!obj.filters[i]['_attr']) obj.filters[i]['_attr'] = {};
						obj.filters[i]['_attr']['sql'] = sql;
						deferred.push(function() { 
							obj.filters[i].setFilter(sql);
							});
						return true;
					}
					obj.filters[i].enableHoverBalloon = function(callback, attr)
					{
						deferred.push(function() {
							obj.filters[i].enableHoverBalloon(callback, attr);
							});
					}
					obj.filters[i].setClusters = function(attr)
					{
						obj.filters[i]._clustersAttr = attr;
						deferred.push(function() {
							obj.filters[i].setClusters(attr);
						});
					}
					
				})(i);
			}
		}
		
//		if (isRaster && (layer.properties.MaxZoom > maxRasterZoom))
//			maxRasterZoom = layer.properties.MaxZoom;
//		var myIdx = parentObj.layers.length;
		parentObj.layers.push(obj);
		parentObj.layers[layerName] = obj;
		if (!layer.properties.title) layer.properties.title = 'layer from client ' + layerName;
		if (!layer.properties.title.match(/^\s*[0-9]+\s*$/))
			parentObj.layers[layer.properties.title] = obj;

		obj.addListener('onChangeVisible', function(flag) {				// Изменилась видимость слоя
			gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {'from':obj.objectId});	// Проверка map Listeners на hideBalloons
		}, -10);
			
		obj.addListener('BeforeLayerRemove', function(layerName) {				// Удаляется слой
			gmxAPI._listeners.dispatchEvent('AfterLayerRemove', obj, obj.properties.name);	// Удален слой
		}, -10);
		obj.addListener('AfterLayerRemove', function(layerName) {			// Удален слой
			for(var i=0; i<gmxAPI.map.layers.length; i++) {			// Удаление слоя из массива
				var prop = gmxAPI.map.layers[i].properties;
				if(prop.name === layerName) {
					gmxAPI.map.layers.splice(i, 1);
					break;
				}
			}
			for(key in gmxAPI.map.layers) {							// Удаление слоя из хэша
				var prop = gmxAPI.map.layers[key].properties;
				if(prop.name === layerName) {
					delete gmxAPI.map.layers[key];
				}
			}
		}, 101);	// Перед всеми пользовательскими Listeners

		if(obj.objectId) gmxAPI.mapNodes[obj.objectId] = obj;
		return obj;
	}

	//расширяем FlashMapObject
	gmxAPI.extendFMO('addLayer', function(layer, isVisible, isMerc) {
		if(layer && layer.geometry && !isMerc) layer.geometry = gmxAPI.merc_geometry(layer.geometry);
		var obj = addLayer(this, layer, isVisible, isMerc);
		gmxAPI._listeners.dispatchEvent('onAddExternalLayer', gmxAPI.map, obj);	// Добавлен внешний слой
		return obj;
	} );

})();
;/* ======================================================================
    LayersVersion.js
   ====================================================================== */

// Поддержка версионности слоев
(function()
{
	var intervalID = 0;
    var chkVersionTimeOut = 20000;
	var versionLayers = {};				// Версии слоев по картам

	// Запрос обновления версий слоев карты mapName
	function sendVersionRequest(host, mapName, arr, callback)
	{
		if(arr.length > 0) {
			gmxAPI.sendCrossDomainPostRequest(
				'http://' + host + '/Layer/CheckVersion.ashx',
				{'WrapStyle': 'window', 'layers':'[' + arr.join(',') + ']'},
				function(response)
				{
					if(response && response['Result'] && response['Result'].length > 0) {
						// Обработка запроса изменения версий слоев
						CheckVersionResponse({'host': host, 'mapName': mapName, 'arr': response['Result']});
					}
					if(callback) callback(response);
				}
			);
		}
	}
	
	// Проверка версий слоев
	function chkVersion(e)
	{
		var layersArr = gmxAPI.map.layers;
		for(var host in versionLayers) {
			var arr = [];
			for(var mapName in versionLayers[host]) {
				for(var layerName in versionLayers[host][mapName]) {
					if(layersArr[layerName] && layersArr[layerName].isVisible) arr.push('{ "Name":"'+ layerName +'","Version":' + layersArr[layerName]['properties']['LayerVersion'] +' }');
				}
			}
			if(arr.length > 0) {
				sendVersionRequest(host, mapName, arr);
				arr = [];
			}
		}
	}

	var setVersionCheck = function(msek) {
		if(intervalID) clearInterval(intervalID);		
		intervalID = setInterval(chkVersion, msek);
	}
	var mapInitID = gmxAPI._listeners.addListener({'eventName': 'mapInit', 'func': function(map) {
		setVersionCheck(chkVersionTimeOut);
		gmxAPI._listeners.removeListener(null, 'mapInit', mapInitID);
		}
	});

	// Обработка ответа запроса CheckVersion
	function CheckVersionResponse(inp)
	{
		var mapHost = inp.host;
		var mapName = inp.mapName;
		var prev = versionLayers[inp.host][inp.mapName];
		var arr = [];
		for (var i = 0; i < inp.arr.length; i++) {
			var ph = inp.arr[i];
			var layerName = ph.properties.name;
			var layer = gmxAPI.map.layers[layerName];
			// обновить версию слоя
			layer.properties['LayerVersion'] = ph.properties['LayerVersion'];
			layer['_Processing'] = chkProcessing(layer, ph.properties);
			var ptOld = prev[layerName] || {};
			var pt = null;
			var attr = {
				'processing': layer['_Processing'],
				'notClear': true,
				'refresh': true
			};
			if('_temporalTiles' in layer) {		// мультивременной слой	- обновить в Temporal.js
				pt = layer._temporalTiles.getTilesHash(ph.properties, ptOld['tilesHash']);
				if(pt['count'] != ptOld['count'] || pt['add'].length > 0 || pt['del'].length > 0) {
					layer.properties['TemporalTiles'] = ph.properties['TemporalTiles'];
					layer.properties['TemporalVers'] = ph.properties['TemporalVers'];
					attr['add'] = pt['add'];
					attr['del'] = pt['del'];

					attr['ut1'] = pt['ut1'];
					attr['ut2'] = pt['ut2'];
					attr['dtiles'] = pt['dtiles'];
				}
			} else {
				pt = getTilesHash(ph.properties, ptOld['tilesHash']);
				if(pt['count'] != ptOld['count'] || pt['add'].length > 0 || pt['del'].length > 0) {
					layer.properties['tiles'] = ph.properties['tiles'];
					layer.properties['tilesVers'] = ph.properties['tilesVers'];
					attr['add'] = pt['add'];
					attr['del'] = pt['del'];

					attr['tiles'] = layer.properties['tiles'];
					attr['tilesVers'] = layer.properties['tilesVers'];
				}
			}
			versionLayers[mapHost][mapName][layerName] = { 'LayerVersion': layer.properties.LayerVersion, 'tilesHash': pt['hash'], 'count': pt['count'] };
			layer.geometry = gmxAPI.from_merc_geometry(ph.geometry);	// Обновить геометрию слоя
			gmxAPI._listeners.dispatchEvent('onChangeLayerVersion', layer, layer.properties['LayerVersion'] );			// Listeners на слое - произошло изменение LayerVersion
			// обновить список тайлов слоя
			if(attr['add'] || attr['del'] || attr['dtiles']) {
				gmxAPI._cmdProxy('startLoadTiles', { 'obj': layer, 'attr':attr });
			}
		}
		return arr;
	}

	// Формирование Hash списка версий тайлов
	function getTilesHash(prop, ph)
	{
		var tiles = prop.tiles || [];
		var tilesVers = prop.tilesVers || [];
		var out = {'hash':{}, 'del': {}, 'add': [], 'res': false };		// в hash - Hash списка версий тайлов, в res = true - есть изменения с ph
		for (var i = 0; i < tiles.length; i+=3) {
			var x = tiles[i];
			var y = tiles[i+1];
			var z = tiles[i+2];
			var v = tilesVers[i / 3];
			var arr = [x, y, z, v];
			var st = arr.join('_');
			out['hash'][st] = true;
			if(ph && !ph[st]) {
				out['add'].push(arr);
				out['del'][z + '_' + x + '_' + y] = true;
			}
		}
		if(ph) {
			for (var key in ph) {
				if(!out['hash'][key]) {
					var arr = key.split('_');
					out['del'][arr[2] + '_' + arr[0] + '_' + arr[1]] = true;
				}
			}
		}
		out['count'] = tiles.length;
		return out;
	}

	// Получить список обьектов слоя добавляемых через addobjects
	function getAddObjects(Processing)
	{
		var arr = [];
		if (Processing.Updated && Processing.Updated.length > 0) {
			arr = arr.concat(Processing.Updated);
		}
		if (Processing.Inserted && Processing.Inserted.length > 0) {
			arr = arr.concat(Processing.Inserted);
		}
		return arr;
	}

	// Обработка списка редактируемых обьектов слоя	//addobjects
	function chkProcessing(obj, prop)
	{
		var flagEditItems = false;
		var removeIDS = {};
		if (prop.Processing.Deleted && prop.Processing.Deleted.length > 0) {		// список удаляемых обьектов слоя
			for (var i = 0; i < prop.Processing.Deleted.length; i++) {			// добавляемые обьекты также необходимо удалить из тайлов
				removeIDS[prop.Processing.Deleted[i]] = true;
				flagEditItems = true;
			}
		}
		var arr = getAddObjects(prop.Processing);		// addobjects
		for (var i = 0; i < arr.length; i++) {			// добавляемые обьекты также необходимо удалить из тайлов
			var pt = arr[i];
			removeIDS[pt['id']] = true;
			flagEditItems = true;
		}
		var out = {
			'removeIDS': removeIDS, 
			'addObjects': arr 
		};
		if(flagEditItems) {
			/*if (prop.Processing.Updated && prop.Processing.Updated.length > 0) {		// список удаляемых обьектов слоя
				var updated = {};
				for (var i = 0; i < prop.Processing.Updated.length; i++) {			// добавляемые обьекты также необходимо удалить из тайлов
					updated[prop.Processing.Updated[i].id] = true;
				}
				out['inUpdate'] = updated;
			}*/
			gmxAPI._cmdProxy('setEditObjects', { 'obj': obj, 'attr':out });
			gmxAPI.addDebugWarnings({'func': 'chkProcessing', 'warning': 'Processing length: ' + arr.length, 'layer': prop.title});
		}
		return out;
	}
	
	var ret = {
		'chkVersionLayers': function (layers, layer) {
			if('LayerVersion' in layer.properties) {
				if(!layer.properties.tilesVers && !layer.properties.TemporalVers) return false;
				var mapHost = layer.properties.hostName || layers.properties.hostName;
				var mapName = layer.properties.mapName || layers.properties.name;
				if(!versionLayers[mapHost]) versionLayers[mapHost] = {};
				if(!versionLayers[mapHost][mapName]) versionLayers[mapHost][mapName] = {};
				var layerObj = ('stateListeners' in layer ? layer : gmxAPI.map.layers[layer.properties.name]);
				var pt = ('_temporalTiles' in layerObj ? layerObj._temporalTiles.getTilesHash(layer.properties) : getTilesHash(layer.properties));
				versionLayers[mapHost][mapName][layer.properties.name] = { 'LayerVersion': layer.properties.LayerVersion, 'tilesHash': pt['hash'], 'count': pt['count'] };
			}
		}
		,'chkVersion': function (layer) {		// Обработка списка редактируемых обьектов слоя
			if(!layer || !('Processing' in layer.properties)) return;
			var onLayerID = layer.addListener('onLayer', function(ph) {
				layer.removeListener('onLayer', onLayerID);
				if(!layer.properties.tilesVers && !layer.properties.TemporalVers) return false;
				gmxAPI._layersVersion.chkVersionLayers(layer.parent, layer);
				ph['_Processing'] = chkProcessing(ph, ph.properties);			// слой инициализирован во Flash
			});
			var BeforeLayerRemoveID = layer.addListener('BeforeLayerRemove', function(layerName) {				// Удаляется слой
				layer.removeListener('BeforeLayerRemove', BeforeLayerRemoveID);
				if(layer.properties.name != layerName) return false;
				var mapHost = layer.properties.hostName;
				if(!versionLayers[mapHost]) return false;
				var mapName = layer.properties.mapName;
				if(!versionLayers[mapHost][mapName]) return false;
				delete versionLayers[mapHost][mapName][layer.properties.name];
				//gmxAPI._listeners.dispatchEvent('AfterLayerRemove', layer, layer.properties.name);	// Удален слой
			}, -9);
		}
		,'chkLayerVersion': function (layer, callback) {		// Запросить проверку версии слоя
			if(!layer.properties.tilesVers && !layer.properties.TemporalVers) return false;
			var host = layer.properties.hostName;
			var mapName = layer.properties.mapName;
			var layerName = layer.properties.name;
			var LayerVersion = layer.properties.LayerVersion;
			sendVersionRequest(host, mapName, ['{ "Name":"'+ layerName +'","Version":' + LayerVersion +' }'], callback);
		}
		,'setVersionCheck': setVersionCheck						// Переустановка задержки запросов проверки версий слоев
	};
	
	//расширяем namespace
    gmxAPI._layersVersion = ret;
})();
;/* ======================================================================
    Map.js
   ====================================================================== */

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
				map.addLayer(layer, visible, true);
				if('LayerVersion' in layer.properties && gmxAPI._layersVersion) {
					gmxAPI._layersVersion.chkVersionLayers(layers, layer);
				}
				if(visible && layer.mercGeometry) mapBounds.update(layer.mercGeometry.coordinates);
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

;/* ======================================================================
    JSON.js
   ====================================================================== */

//Поддержка JSON parser
if (!this.JSON) {
    JSON = {};
	(function () {

		function f(n) {
			// Format integers to have at least two digits.
			return n < 10 ? '0' + n : n;
		}

		if (typeof Date.prototype.toJSON !== 'function') {

			Date.prototype.toJSON = function (key) {

				return this.getUTCFullYear()   + '-' +
					 f(this.getUTCMonth() + 1) + '-' +
					 f(this.getUTCDate())      + 'T' +
					 f(this.getUTCHours())     + ':' +
					 f(this.getUTCMinutes())   + ':' +
					 f(this.getUTCSeconds())   + 'Z';
			};

			String.prototype.toJSON =
			Number.prototype.toJSON =
			Boolean.prototype.toJSON = function (key) {
				return this.valueOf();
			};
		}

		var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
			escapeable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
			gap,
			indent,
			meta = {    // table of character substitutions
				'\b': '\\b',
				'\t': '\\t',
				'\n': '\\n',
				'\f': '\\f',
				'\r': '\\r',
				'"' : '\\"',
				'\\': '\\\\'
			},
			rep;


		function quote(string) {

			escapeable.lastIndex = 0;
			return escapeable.test(string) ?
				'"' + string.replace(escapeable, function (a) {
					var c = meta[a];
					if (typeof c === 'string') {
						return c;
					}
					return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
				}) + '"' :
				'"' + string + '"';
		}


		function str(key, holder) {

			var i,          // The loop counter.
				k,          // The member key.
				v,          // The member value.
				length,
				mind = gap,
				partial,
				value = holder[key];

			if (value && typeof value === 'object' &&
					typeof value.toJSON === 'function') {
				value = value.toJSON(key);
			}

			if (typeof rep === 'function') {
				value = rep.call(holder, key, value);
			}

			switch (typeof value) {
			case 'string':
				return quote(value);

			case 'number':

				return isFinite(value) ? String(value) : 'null';

			case 'boolean':
			case 'null':

				return String(value);

			case 'object':

				if (!value) {
					return 'null';
				}

				gap += indent;
				partial = [];

				if (typeof value.length === 'number' &&
						!value.propertyIsEnumerable('length')) {

					length = value.length;
					for (i = 0; i < length; i += 1) {
						partial[i] = str(i, value) || 'null';
					}

					v = partial.length === 0 ? '[]' :
						gap ? '[\n' + gap +
								partial.join(',\n' + gap) + '\n' +
									mind + ']' :
							  '[' + partial.join(',') + ']';
					gap = mind;
					return v;
				}

				if (rep && typeof rep === 'object') {
					length = rep.length;
					for (i = 0; i < length; i += 1) {
						k = rep[i];
						if (typeof k === 'string') {
							v = str(k, value);
							if (v) {
								partial.push(quote(k) + (gap ? ': ' : ':') + v);
							}
						}
					}
				} else {

					for (k in value) {
						if (Object.hasOwnProperty.call(value, k)) {
							v = str(k, value);
							if (v) {
								partial.push(quote(k) + (gap ? ': ' : ':') + v);
							}
						}
					}
				}

				v = partial.length === 0 ? '{}' :
					gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
							mind + '}' : '{' + partial.join(',') + '}';
				gap = mind;
				return v;
			}
		}

		if (typeof JSON.stringify !== 'function') {
			JSON.stringify = function (value, replacer, space) {

				var i;
				gap = '';
				indent = '';

				if (typeof space === 'number') {
					for (i = 0; i < space; i += 1) {
						indent += ' ';
					}

				} else if (typeof space === 'string') {
					indent = space;
				}

				rep = replacer;
				if (replacer && typeof replacer !== 'function' &&
						(typeof replacer !== 'object' ||
						 typeof replacer.length !== 'number')) {
					throw new Error('JSON.stringify');
				}

				return str('', {'': value});
			};
		}

		if (typeof JSON.parse !== 'function') {
			JSON.parse = function (text, reviver) {

				var j;

				function walk(holder, key) {

					var k, v, value = holder[key];
					if (value && typeof value === 'object') {
						for (k in value) {
							if (Object.hasOwnProperty.call(value, k)) {
								v = walk(value, k);
								if (v !== undefined) {
									value[k] = v;
								} else {
									delete value[k];
								}
							}
						}
					}
					return reviver.call(holder, key, value);
				}

				cx.lastIndex = 0;
				if (cx.test(text)) {
					text = text.replace(cx, function (a) {
						return '\\u' +
							('0000' + a.charCodeAt(0).toString(16)).slice(-4);
					});
				}

				if (/^[\],:{}\s]*$/.
	test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
	replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
	replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

					j = eval('(' + text + ')');

					return typeof reviver === 'function' ?
						walk({'': j}, '') : j;
				}

				throw new SyntaxError('JSON.parse');
			};
		}
	})();
}
;/* ======================================================================
    ACPrintManager.js
   ====================================================================== */

//Поддержка Печати
(function()
{
	/**
	 * Class for working with browser printing
	 * @see http://www.anychart.com/blog/projects/acprintmanagerlibrary/
	 * @version 0.1
	 * @author Alex Batsuev (alex(at)sibental(dot)com)
	 */
	var ACPrintManager = function() {}

	ACPrintManager.isIE = function() {
		return gmxAPI.isIE;
	}

	ACPrintManager.initIE = function(objId) {
		var obj = document.getElementById(objId);
		if (obj == null) return;
		if (obj.onBeforePrint == undefined || obj.onAfterPrint == undefined) return;
		
		window.attachEvent("onbeforeprint",function(e) {
			
			obj.setAttribute("tmpW",obj.width);
			obj.setAttribute("tmpH",obj.height);
			
			var size = ACPrintManager.getContentSize(obj);
			
			obj.width = size.width;
			obj.height = size.height;
			
			obj.onBeforePrint();
			
			if (obj.getAttribute("tmpW").indexOf("%") != -1 ||
				obj.getAttribute("tmpH").indexOf("%") != -1) {
				//ie percent width or height hack
				obj.focus();
			}
		});
		window.attachEvent("onafterprint",function() {
			obj.onAfterPrint();
			obj.width = obj.getAttribute("tmpW");
			obj.height = obj.getAttribute("tmpH");
		});
	} 

	ACPrintManager.initFF = function(objId, imgData) {

		if (gmxAPI.isIE)
			return;

		var obj = document.getElementById(objId);
		if (obj == null && document.embeds != null) obj = document.embeds[objId];
		if (obj == null) return;
		
		//step #1: get parent node
		var parent = obj.parentNode;
		if (parent == null) return;
		
		//step #2: get header
		var head = document.getElementsByTagName('head');
		head = ((head.length != 1) ? null : head[0]);
		
		//step #3: write normal css rule		
		var style = document.createElement('style');
		style.setAttribute('type','text/css');
		style.setAttribute('media','screen');
		
		var size = ACPrintManager.getContentSize(obj);
		
		var imgDescriptor = 'img#'+objId+'_screen';
		var imgRule = "width: "+size.width+";\n"+
					  "height: "+size.height+";\n"+
					  "padding: 0;\n"+
					  "margin: 0;\n"+
					  "border: 0;\n"+
					  "display: none;";
		style.appendChild(document.createTextNode(imgDescriptor + '{' + imgRule + "}\n"));
		//add style to head
		head.appendChild(style);

		//step #4: write print css rule
		style = document.createElement('style');
		style.setAttribute('type','text/css');
		style.setAttribute('media','print');
		
		//write image style
		imgDescriptor = 'img#'+objId+'_screen';
		imgRule = 'display: block;';
		
		style.appendChild(document.createTextNode(imgDescriptor + '{' + imgRule + '}'));
		
		//write object style
		var objDescriptor = 'embed#'+objId;
		var objRule = 'display: none;';
		style.appendChild(document.createTextNode(objDescriptor + '{' + objRule + '}'));
		
		//add style to head
		head.appendChild(style);

		//step #5: get image
		var needAppend = false;
		var img = document.getElementById('img');
		if (img == null) {
			img = document.createElement('img');
			needAppend = true;
		}
		
		img.src = 'data:image/png;base64,'+imgData;
		img.setAttribute('id',objId+"_screen");
		if (needAppend)
			parent.appendChild(img);
	}

	ACPrintManager.getContentSize = function(obj) {
		var size = {};
		size.width = obj.width;
		size.height = obj.height;
		if (obj.getWidth != undefined) size.width = obj.getWidth()+'px';
		if (obj.getHeight != undefined) size.height = obj.getHeight()+'px';
		return size;
	}
    //расширяем namespace
    window.ACPrintManager = 
    gmxAPI.ACPrintManager = ACPrintManager;
})();
;/* ======================================================================
    wms.js
   ====================================================================== */

//Поддержка WMS
(function()
{
    var wmsProjections = ['EPSG:4326','EPSG:3395','EPSG:41001'];	// типы проекций
    
    /**
        Возвращает описание WMS-слоёв от XML, которую вернул сервер на запрос GetCapabilities
        @memberOf gmxAPI
        @returns {Array} - массив объектов с описанием слоёв
    */
    var parseWMSCapabilities = function(response)
	{
		var serviceLayers = [],
			strResp = response.replace(/[\t\n\r]/g, ' '),
			strResp = strResp.replace(/\s+/g, ' '),
			layersXML = gmxAPI.parseXML(response).getElementsByTagName('Layer');
		
		for (var i = 0; i < layersXML.length; i++)
		{
			var layer = {},
				name = layersXML[i].getElementsByTagName('Name'),
				title = layersXML[i].getElementsByTagName('Title'),
				bbox = layersXML[i].getElementsByTagName('LatLonBoundingBox'),
				srs = layersXML[i].getElementsByTagName('SRS');
			
            if (srs.length)
            {
                layer.srs = null; 
                for (var si = 0; si < srs.length; si++)
                {
                    var curSrs = gmxAPI.strip(gmxAPI.getTextContent(srs[si]))
                    
                    if (gmxAPI.valueInArray(wmsProjections, curSrs))
                    {
                        layer.srs = curSrs;
                        break;
                    }
                }
                if (!layer.srs) continue;
            }
			else
                layer.srs = wmsProjections[0];
                
				
			
			if (name.length)
				layer.name = gmxAPI.getTextContent(name[0]);
			
			if (bbox.length)
			{
				layer.bbox = 
				{
					minx: Number(bbox[0].getAttribute('minx')),
					miny: Number(bbox[0].getAttribute('miny')),
					maxx: Number(bbox[0].getAttribute('maxx')),
					maxy: Number(bbox[0].getAttribute('maxy'))
				};
			}
			
			if (title.length)
				layer.title = gmxAPI.getTextContent(title[0]);
			
			if (layer.name)
				serviceLayers.push(layer);
		}
		
		return serviceLayers;
	}
    
    /** Формирует URL картинки, который можно использовать для получения WMS слоя для данного положения карты
        @memberOf gmxAPI
        @returns {object} - {url: String, bounds: {Extent}}. bounds в географических координатах.
    */
    var getWMSMapURL = function(url, props, requestProperties)
    {
        requestProperties = requestProperties || {};

        var extend = gmxAPI.map.getVisibleExtent();

        var miny = Math.max(extend.minY, -90);
        var maxy = Math.min(extend.maxY, 90);
        var minx = Math.max(extend.minX, -180);
        var maxx = Math.min(extend.maxX, 180);
        
        if (props.bbox)
        {
            minx = Math.max(props.bbox.minx, minx);
            miny = Math.max(props.bbox.miny, miny);
            maxx = Math.min(props.bbox.maxx, maxx);
            maxy = Math.min(props.bbox.maxy, maxy);

            if (minx >= maxx || miny >= maxy)
                return;
        }
        
        var scale = gmxAPI.getScale(gmxAPI.map.getZ());
        var w = Math.round((gmxAPI.merc_x(maxx) - gmxAPI.merc_x(minx))/scale);
        var h = Math.round((gmxAPI.merc_y(maxy) - gmxAPI.merc_y(miny))/scale);

        var isMerc = !(props.srs == wmsProjections[0]);

        var st = url;
        var format = requestProperties.format || 'image/jpeg';
        var transparentParam = requestProperties.transparent ? 'TRUE' : 'FALSE';
        
        st += (st.indexOf('?') == -1 ? '?':'&') + 'request=GetMap';
        st += "&layers=" + props.name +
            "&version=1.1.1" + 
            "&srs=" + props.srs + 
            //"&format=" + format + 
            //"&transparent=" + transparentParam + 
            "&styles=" + 
            "&width=" + w + 
            "&height=" + h + 
            "&bbox=" + (isMerc ? gmxAPI.merc_x(minx) : minx) + 
                 "," + (isMerc ? gmxAPI.merc_y(miny) : miny) + 
                 "," + (isMerc ? gmxAPI.merc_x(maxx) : maxx) + 
                 "," + (isMerc ? gmxAPI.merc_y(maxy) : maxy)
        ;
        if (url.indexOf('format=') == -1) st += "&format=" + format;
        if (url.indexOf('transparent=') == -1) st += "&transparent=" + transparentParam;
       
        return {url: st, bounds: {minX: minx, maxX: maxx, minY: miny, maxY: maxy}};
    }
    
    var loadWMS = function(map, container, url, func)
    {
        var urlProxyServer = 'http://' + gmxAPI.serverBase + '/';
        var wmsLayers = [];

		url = url.replace(/Request=GetCapabilities[\&]*/i, '');
		url = url.replace(/\&$/, '');
        var st = url;
        st += (st.indexOf('?') == -1 ? '?':'&') + 'request=GetCapabilities&version=1.1.1';
        var _hostname = urlProxyServer + "ApiSave.ashx?debug=1&get=" + encodeURIComponent(st);
        sendCrossDomainJSONRequest(_hostname, function(response)
        {
            if(typeof(response) != 'object' || response['Status'] != 'ok') {
                gmxAPI.addDebugWarnings({'_hostname': _hostname, 'url': url, 'Error': 'bad response'});
                return;
            }
            var serviceLayers = gmxAPI.parseWMSCapabilities(response['Result']);
            for (var i = 0; i < serviceLayers.length; i++)
            {
                var props = serviceLayers[i];
                var obj = container.addObject(null, props);
                obj.setVisible(false);
				wmsLayers.push(obj);

                (function(obj, props) {
                    var timeout = false;
                    var updateFunc = function() 
                    {
                        if (timeout) clearTimeout(timeout);
                        timeout = setTimeout(function()
                        {
                            var res = getWMSMapURL(url, props);
                            
                            if (res)
                            {
                                var bbox = res.bounds;

                                obj.setImage(
                                    urlProxyServer + "ImgSave.ashx?now=true&get=" + encodeURIComponent(res.url),
                                    bbox.minX, bbox.maxY, bbox.maxX, bbox.maxY, bbox.maxX, bbox.minY, bbox.minX, bbox.minY
                                );
                            }
                        }, 500);
                    }
					// Добавление прослушивателей событий
					obj.addListener('onChangeVisible', function(flag)
						{
							if(flag) updateFunc();
							obj.setHandler("onMove", flag ? updateFunc : null);
						}
					);


                })(obj, props);
            }
            func(wmsLayers);
        })
    }
    
    //расширяем namespace
    gmxAPI.parseWMSCapabilities = parseWMSCapabilities;
    gmxAPI._loadWMS = loadWMS;
    gmxAPI.getWMSMapURL = getWMSMapURL;
})();

;/* ======================================================================
    kml.js
   ====================================================================== */

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
;/* ======================================================================
    balloon.js
   ====================================================================== */

//Поддержка Балунов
(function()
{
	/** Класс управления балунами
	* @function
	* @memberOf api
	* @see <a href="http://kosmosnimki.ru/geomixer/docs/api_examples.html">» Примеры использования</a>.
	* @author <a href="mailto:saleks@scanex.ru">Sergey Alexseev</a>
	*/
	function BalloonClass()
	{
		var map = gmxAPI.map;
		var div = gmxAPI._div;
		var apiBase = gmxAPI.getAPIFolderRoot();
		var balloons = [];
		var curMapObject = null;

		var mapX = 0;
		var mapY = 0;
		var stageZoom = 1;						// Коэф. масштабирования браузера
		var scale = 0;
		//map.getPosition();
		var currPos = null;

		// Обновить информацию текущего состояния карты
		function refreshMapPosition(ph)
		{
			currPos = ph || gmxAPI.currPosition || map.getPosition();
			mapX = currPos['x'];
			mapY = currPos['y'];
			scale = gmxAPI.getScale(currPos['z']);
			stageZoom =  currPos['stageHeight'] / div.clientHeight;	// Коэф. масштабирования браузера
		}
		// Формирование ID балуна
		function setID(o)
		{
			var id = o.objectId + '_balloon';
			if(o.properties) {
				var identityField = gmxAPI.getIdentityField(o);
				if(o.properties[identityField]) id +=  '_' + o.properties[identityField];
			}
			return id;
		}

		/** Проверка возвращенного пользовательским callback значения
		* @function
		* @memberOf BalloonClass private
		* @param {text} возвращенное значение пользовательским callback
		* @param {div} внутренний контейнер для размещения содержимого балуна
		* @return {<String><Bool><Object>}	
		*		если тип <String> то div.innerHTML = text
		*		если тип <Bool> и значение True то div.innerHTML = ''
		*		если тип <Object> никаких дополнительных действий - все действия были произведены в callback
		*/
		function chkBalloonText(text, div)
		{
			var type = typeof(text);
			if(type === 'string') div.innerHTML = '<div style="white-space: nowrap;">' + text + '</div>';
			else if(type === 'boolean' && text) div.innerHTML = ""; // затираем только если true
			// в случае type === 'object' ничего не делаем
		}

		// Текст по умолчанию для балуна (innerHTML)
		function getDefaultBalloonText(o)
		{
			var text = "";
			var identityField = gmxAPI.getIdentityField(o);
			var props = o.properties;
			for (var key in props)
			{
				if (key != identityField)
				{
					var value = "" + props[key];
					if (value.indexOf("http://") == 0)
						value = "<a href='" + value + "'>" + value + "</a>";
					else if (value.indexOf("www.") == 0)
						value = "<a href='http://" + value + "'>" + value + "</a>";
					text += "<b>" + key + ":</b> " + value + "<br />";
				}
			}
			var summary = o.getGeometrySummary();
			if(summary != '') text += "<br />" + summary;
			return text;
		}
		this.getDefaultBalloonText = getDefaultBalloonText;

		// Проверка наличия параметра по ветке родителей
		function chkAttr(name, o)
		{
			var attr = false;
			var hash = o._hoverBalloonAttr;
			if(hash && name in hash) {
				attr = hash[name];
			}
			if(!attr && o.parent) attr = chkAttr(name, o.parent);
			return attr;
		}
/*
		function setDelayHide()
		{
			if(propsBalloon.delayHide) clearTimeout(propsBalloon.delayHide);
			propsBalloon.delayHide = setTimeout(function()
			{
				propsBalloon.chkMouseOut();
				clearTimeout(propsBalloon.delayHide);
				propsBalloon.delayHide = false;
			}, 100);
		}
*/
		function setDelayShow(text)
		{
			if(propsBalloon.delayShow) clearTimeout(propsBalloon.delayShow);
			propsBalloon.delayShow = setTimeout(function()
			{
				propsBalloon.updatePropsBalloon(text);
				clearTimeout(propsBalloon.delayShow);
				propsBalloon.delayShow = false;
			}, 200);
		}

		function disableHoverBalloon(mapObject)
		{
			var listenersID = mapObject._attr['balloonListeners'];
			for (var key in listenersID) {
				mapObject.removeListener(key, listenersID[key]);
			}
			mapObject._attr['balloonListeners'] = {};
		}
		this.disableHoverBalloon = disableHoverBalloon;

		/** Задать пользовательский тип балуна для mapObject
		* @function
		* @memberOf BalloonClass public
		* @param {mapObject<mapObject>} обьект карты для которого устанавливается тип балуна
		* @param {callback<Function>} пользовательский метод формирования содержимого балуна mouseOver
		*		При вызове в callback передаются параметры:
		*		@param {obj<Hash>} properties обьекта карты для балуна
		*		@param {div<DIV>} нода контейнера содержимого балуна
		*		@return {<String><Bool><Object>}	
		*			если тип <String> то div.innerHTML = text
		*			если тип <Bool> и значение True то div.innerHTML = ''
		*			если тип <Object> никаких дополнительных действий - все действия были произведены в callback
		* @param {attr:<Hash>} атрибуты управления балуном
		*		свойства:
		*			'disableOnMouseOver<Bool>'	- по умолчанию False
		*			'disableOnClick'<Bool>		- по умолчанию False
		*			'maxFixedBallons'<Bool>		- по умолчанию 1 (максимальное количество фиксированных балунов)
		*			'clickCallback'<Function>	- пользовательский метод формирования содержимого фиксированного балуна при mouseClick
		*				@param {obj<Hash>} properties обьекта карты для балуна
		*				@param {div<DIV>} нода контейнера содержимого балуна
		*				@return {<String><Bool><Object>}	
		*					если тип <String> то div.innerHTML = text
		*					если тип <Bool> и значение True то div.innerHTML = ''
		*					если тип <Object> никаких дополнительных действий - все действия были произведены в clickCallback
		*			'OnClickSwitcher'<Function>	- по умолчанию null (при событии mouseClick - переключатель на пользовательский метод формирования всего фиксированного балуна)
		*				@param {obj<Hash>} properties обьекта карты для балуна
		*				@param {keyPress<Hash>} аттрибуты нажатых спец.клавиш при mouseClick событии
		*				свойства:
		*					'shiftKey<Bool>'	- по умолчанию False
		*					'ctrlKey<Bool>'		- по умолчанию False
		*				@return {Bool} если true то стандартный фиксированный балун НЕ создавать
		*			'customBalloon'<Function>	- пользовательский метод формирования содержимого фиксированного балуна при mouseClick
		*				@param {obj<Hash>} properties обьекта карты для балуна
		*				@param {div<DIV>} нода контейнера содержимого балуна
		*				@return {Bool} если true то стандартный балун НЕ создавать
		*/
		function enableHoverBalloon(mapObject, callback, attr)
		{
			var _this = this;
			mapObject._hoverBalloonAttr = (attr ? attr : {});				// Атрибуты управления балуном
			if (callback) {													// Пользовательский метод получения текста для балуна
				this.getDefaultBalloonText = mapObject._hoverBalloonAttr['callback'] = callback;
			} else {
				delete mapObject._hoverBalloonAttr['callback'];
			}

			var handlersObj = {
				onMouseOver: function(o, keyPress)
				{
					if('obj' in o) {
						//if('attr' in o && 'textFunc' in o.attr) keyPress = o.attr;
						if('attr' in o) keyPress = o.attr;
						o = o.obj;
					}
					gmxAPI.contDivPos = {
						'x': gmxAPI.getOffsetLeft(div),
						'y': gmxAPI.getOffsetTop(div)
					};
					if(keyPress && (keyPress['shiftKey'] || keyPress['ctrlKey'])) return false;	// При нажатых не показываем балун
					if (map.isDragging())
						return false;

					if(chkAttr('disableOnMouseOver', mapObject)) {			// Проверка наличия параметра disableOnMouseOver по ветке родителей 
						return false;
					}
					var customBalloonObject = chkAttr('customBalloon', mapObject);		// Проверка наличия параметра customBalloon по ветке родителей 
					if(customBalloonObject) {
						currPos = gmxAPI.currPosition || map.getPosition();
						currPos._x = propsBalloon.mouseX || 0;
						currPos._y = propsBalloon.mouseY || 0;
						var flag = customBalloonObject.onMouseOver(o, keyPress, currPos); // Вызов пользовательского метода вместо или перед балуном
						if(flag) return false;										// Если customBalloon возвращает true выходим
					}

					//if(keyPress['objType'] == 'cluster') {}; // Надо придумать как бороться с фикс.двойником

					var textFunc = chkAttr('callback', mapObject);			// Проверка наличия параметра callback по ветке родителей 
					//var text = (textFunc && (!keyPress['objType'] || keyPress['objType'] != 'cluster') ? textFunc(o, propsBalloon.div) : getDefaultBalloonText(o));
					var text = (textFunc ? textFunc(o, propsBalloon.div) : getDefaultBalloonText(o));
					if(typeof(text) == 'string' && text == '') return false;
					var id = setID(o);
					lastHoverBalloonId = o.objectId;
					
					//if(propsBalloon.delayHide) { clearTimeout(propsBalloon.delayHide); propsBalloon.delayHide = false; }
					if (!fixedHoverBalloons[id]) {
						setDelayShow(text);
						//propsBalloon.updatePropsBalloon(text);
					}
					else {
						propsBalloon.updatePropsBalloon(false);
					}

					map.clickBalloonFix = clickBalloonFix;
					return true;
				},
				onMouseOut: function(o) 
				{
					if('obj' in o) {
						o = o.obj;
					}
					var customBalloonObject = chkAttr('customBalloon', mapObject);		// Проверка наличия параметра customBalloon по ветке родителей 
					if(customBalloonObject) {
						var flag = customBalloonObject.onMouseOut(o);
						if(flag) return false;
					}
					if (lastHoverBalloonId == o.objectId) {
						//setDelayHide();
						if(propsBalloon.delayShow) { clearTimeout(propsBalloon.delayShow); propsBalloon.delayShow = false; }
						propsBalloon.updatePropsBalloon(false);
					}
					return true;
				},
				onClick: function(o, keyPress)
				{
					if('obj' in o) {
						if('attr' in o) keyPress = o.attr;
						//if('attr' in o && 'textFunc' in o.attr) keyPress = o.attr;
						o = o.obj;
					}
					refreshMapPosition();
					var customBalloonObject = chkAttr('customBalloon', mapObject);		// Проверка наличия параметра customBalloon по ветке родителей 
					if(customBalloonObject) {
						currPos._x = propsBalloon.x;
						currPos._y = propsBalloon.y;
						var flag = customBalloonObject.onClick(o, keyPress, currPos);
						if(flag) return false;
					}
					if(chkAttr('disableOnClick', mapObject)) {			// Проверка наличия параметра disableOnMouseOver по ветке родителей 
						return false;
					}
					if(!keyPress) keyPress = {};
					if(keyPress['objType'] === 'cluster' && 'clusters' in o) keyPress['textFunc'] = o.clusters.getTextFunc();
					if(!keyPress['textFunc']) keyPress['textFunc'] = chkAttr('callback', mapObject);			// Проверка наличия параметра callback по ветке родителей 
					return clickBalloonFix(o, keyPress);
				}
			};

			if(mapObject == map) return;								// На map Handlers не вешаем
			if(mapObject._hoverBalloonAttr) {							// есть юзерские настройки балунов
				if(mapObject._hoverBalloonAttr['disableOnMouseOver']) {			// для отключения балунов при наведении на обьект
					handlersObj['onMouseOver'] = null;
					handlersObj['onMouseOut'] = null;
				}
				if(mapObject._hoverBalloonAttr['disableOnClick']) {				// для отключения фиксированных балунов
					handlersObj['onClick'] = null;
				}
				//mapObject._hoverBalloonAttr['disableOnMouseOver']
			}
			//mapObject.setHandlers(handlersObj);
			if(!mapObject._attr['balloonListeners']) mapObject._attr['balloonListeners'] = {};
			disableHoverBalloon(mapObject);
			var level = (attr && attr['level'] ? attr['level'] : -10);
			for (var key in handlersObj) {
				if(handlersObj[key]) {
					var eID = mapObject.addListener(key, handlersObj[key], level);
					mapObject._attr['balloonListeners'][key] = eID;
					//gmxAPI._listeners.bringToBottom(mapObject, key, eID);
				}
			}
		}
		this.enableHoverBalloon = enableHoverBalloon;

		var lastHoverBalloonId = false;
		var fixedHoverBalloons = {};

		function showHoverBalloons()
		{
			for (var key in fixedHoverBalloons)
			{
				var balloon = fixedHoverBalloons[key];
				balloon.setVisible(true);
			}
			positionBalloons();
			for (var key in userBalloons)
			{
				var balloon = userBalloons[key];
				if(balloon._needShow) {
					balloon.setVisible(true);
					delete balloon._needShow;
				}
			}
		}
		this.showHoverBalloons = showHoverBalloons;
		
		function removeHoverBalloons()
		{
			for (var key in fixedHoverBalloons)
			{
				fixedHoverBalloons[key].remove();
				delete fixedHoverBalloons[key];
			}
			gmxAPI._mouseOnBalloon = false;
		}
		this.removeHoverBalloons = removeHoverBalloons;
		
		function hideHoverBalloons(flag, attr)
		{
			if(propsBalloon.isVisible()) propsBalloon.setVisible(false);
			var showFlag = false;
			for (var key in fixedHoverBalloons)
			{
				var balloon = fixedHoverBalloons[key];
				if(balloon.objType != 'cluster') {
					if(attr && attr.from && balloon.pID != attr.from) continue;
					balloon.setVisible(false);
					showFlag = true;
				}
				else
				{
					fixedHoverBalloons[key].remove();
					delete fixedHoverBalloons[key];
				}
			}
			gmxAPI._mouseOnBalloon = false;
			
			for (var key in userBalloons)
			{
				var balloon = userBalloons[key];
				if(balloon.isVisible) {
					balloon.setVisible(false);
					balloon._needShow = true;
				}
			}
			
/*
			if(flag && showFlag) {
				var timeoutShowHoverBalloons = setTimeout(function()
				{
					clearTimeout(timeoutShowHoverBalloons);
					showHoverBalloons();
				}, 300);
			}
*/
		}
		this.hideHoverBalloons = hideHoverBalloons;

		// Фиксация балуна
		function clickBalloonFix(o, keyPress)
		{
			var OnClickSwitcher = chkAttr('OnClickSwitcher', o);		// Проверка наличия параметра по ветке родителей 
			if(OnClickSwitcher && typeof(OnClickSwitcher) == 'function') {
				var flag = OnClickSwitcher(o, keyPress);				// Вызов пользовательского метода вместо или перед балуном
				if(flag) return true;										// Если OnClickSwitcher возвращает true выходим
			}

			if(chkAttr('disableOnClick', o))	// Проверка наличия параметра disableOnClick по ветке родителей 
				return false;

			var textFunc = chkAttr('clickCallback', o) || chkAttr('callback', o);	// Проверка наличия параметра callback по ветке родителей 
			if(keyPress) {
				if(keyPress['shiftKey'] || keyPress['ctrlKey']) return false;	// При нажатых не показываем балун
				if(keyPress['nodeFilter'] == o.parent.objectId && o.parent._hoverBalloonAttr.callback) textFunc = o.parent._hoverBalloonAttr.callback; // взять параметры балуна от фильтра родителя
				else if('textFunc' in keyPress) textFunc = keyPress['textFunc'];
			}

			var id = setID(o);
			if (!fixedHoverBalloons[id])
			{
				var maxFixedBallons = chkAttr('maxFixedBallons', o) || 1;	// Проверка наличия параметра maxFixedBallons по ветке родителей
				if(maxFixedBallons > 0 && balloons.length > 0)
				{
					if(maxFixedBallons <= balloons.length) {
						var balloon = null;
						for(var i=0; i<balloons.length; i++) {
							if(balloons[i].notDelFlag) continue;
							balloon = balloons[i];
							break;
						}
						if(balloon) {
							var fixedId = balloon.fixedId;
							balloon.remove();
							delete fixedHoverBalloons[fixedId];
						}
					}
				}
				var balloon = addBalloon();
				balloon.setVisible(false);
				balloon.pID = o.parent.objectId;
				balloon.obj = o;
				balloon.fixedId = id;
				o.balloon = balloon;
				if(keyPress && keyPress['objType']) balloon.objType = keyPress['objType'];

				//var text = (textFunc && (!keyPress['objType'] || keyPress['objType'] != 'cluster') ? textFunc(o, balloon.div) : getDefaultBalloonText(o));
				var text = (textFunc ? textFunc(o, balloon.div) : getDefaultBalloonText(o));
				if(typeof(text) == 'string' && text == '') return false;

				var mx = map.getMouseX();
				var my = map.getMouseY();
				
				if(gmxAPI.proxyType == 'flash') {
					mx = gmxAPI.chkPointCenterX(mx);
				}

				if(o.getGeometryType() == 'POINT') {
					var gObj = o.getGeometry();
					var x = gObj.coordinates[0];
					var y = gObj.coordinates[1];

					//balloon.fixedDeltaX =  (gmxAPI.merc_x(mx) -  gmxAPI.merc_x(x))/scale;
					//balloon.fixedDeltaY =  (gmxAPI.merc_y(my) -  gmxAPI.merc_y(y))/scale;
					mx = x;
					my = y;
					//balloon.fixedDeltaFlag = true;
				}

				balloon.setVisible(true);
				balloon.setPoint(mx, my);
				chkBalloonText(text, balloon.div);

				balloon.resize();
				fixedHoverBalloons[id] = balloon;
			}
			else
			{
				fixedHoverBalloons[id].remove();
				delete fixedHoverBalloons[id];
			}
			propsBalloon.updatePropsBalloon(false);
			if(propsBalloon.delayShow) { clearTimeout(propsBalloon.delayShow); propsBalloon.delayShow = false; }
			return true;
		}
		this.clickBalloonFix = clickBalloonFix;

		// Создание DIV и позиционирование балуна
		function createBalloon(outerFlag)
		{
			var tlw = 14;
			var tlh = 14;
			var blw = 14;
			var blh = 41;
			var trw = 18;
			var trh = 13;
			var brw = 20;
			var brh = 41;
			var th = 2;
			var lw = 2;
			var bh = 2;
			var rw = 2;

			var legWidth = 68;

			var balloon = gmxAPI.newStyledDiv({
				position: "absolute",
				'font-family': 'Times New Roman',
/*
				paddingLeft: lw + "px",
				paddingRight: rw + "px",
				paddingTop: th + "px",
				paddingBottom: bh + "px",
*/
				width: "auto",
				//whiteSpace: "nowrap",
				zIndex: 1000
			});
			//if(outerFlag || gmxAPI.proxyType !== 'leaflet') {
				balloon.className = 'gmx_balloon';
				div.appendChild(balloon);
			//} else {
			//	balloon.className = 'gmx_balloon leaflet-pan-anim leaflet-zoom-animated';
			//	gmxAPI._leaflet.LMap['_mapPane'].appendChild(balloon);
			//}

			var css = {
				'table': 'background-color: transparent; width: auto; margin: 2px; border-collapse: collapse; font-size: 11px; font-family: sans-serif;',
				'bg_top_left': 'background-color: transparent; width: 13px; height: 18px; border: 0px none; padding: 1px; display: block; background-position: 2px 9px; background-image: url(\''+apiBase+'img/tooltip-top-left.png\'); background-repeat: no-repeat;',
				'bg_top': 'background-color: transparent; height: 18px; border: 0px none; padding: 0px; background-position: center 9px; background-image: url(\''+apiBase+'img/tooltip-top.png\'); background-repeat: repeat-x;',
				'bg_top_right': 'background-color: transparent; width: 18px; height: 18px; border: 0px none; padding: 1px; display: block; background-position: -5px 9px; background-image: url(\''+apiBase+'img/tooltip-top-right.png\'); background-repeat: no-repeat;',
				'bg_left': 'background-color: transparent; width: 13px; border: 0px none; padding: 1px; background-position: 2px top; background-image: url(\''+apiBase+'img/tooltip-left.png\'); background-repeat: repeat-y;',
				'bg_center': 'background-color: transparent; width: 50px; min-width: 50px; border: 0px none; background-color: white; padding: 4px; padding-right: 14px;',
				'bg_right': 'background-color: transparent; width: 13px; height: 18px; border: 0px none; padding: 1px; background-position: 0px top; background-image: url(\''+apiBase+'img/tooltip-right.png\'); background-repeat: repeat-y;',
				'bg_bottom_left': 'background-color: transparent; width: 13px; height: 18px; border: 0px none; padding: 1px; background-position: 2px top; background-image: url(\''+apiBase+'img/tooltip-bottom-left.png\'); background-repeat: no-repeat;',
				'bg_bottom': 'background-color: transparent; height: 18px; border: 0px none; padding: 1px; background-position: center top; background-image: url(\''+apiBase+'img/tooltip-bottom.png\'); background-repeat: repeat-x;',
				'bg_bottom_right': 'background-color: transparent; width: 18px; height: 18px; border: 0px none; padding: 1px; background-position: -2px top; background-image: url(\''+apiBase+'img/tooltip-bottom-right.png\'); background-repeat: no-repeat;',
				'leg': 'bottom: 18px; left: 0px; width: 68px; height: 41px; position: relative; background-repeat: no-repeat; background-image: url(\''+apiBase+'img/tooltip-leg.png\');'
			};

			var transp = '';
			if(gmxAPI.isChrome || gmxAPI.isIE) transp =  '<img width="10" height="10" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABBJREFUeNpi+P//PwNAgAEACPwC/tuiTRYAAAAASUVORK5CYII=">';	// Для Chrome добавляем невидимый контент в TD
			var body = 
				'<table cols="3" cellspacing="0" cellpadding="0" border="0" style="'+css['table']+'">'+
					'<tr>'+
						'<td style="'+css['bg_top_left']+'">'+transp+'</td>'+
						'<td style="'+css['bg_top']+'">'+transp+'</td>'+
						'<td style="'+css['bg_top_right']+'">'+transp+'</td>'+
					'</tr>'+
					'<tr>'+
						'<td style="'+css['bg_left']+'">'+transp+'</td>'+
						'<td style="'+css['bg_center']+'">'+
							'<div class="kosmosnimki_balloon">'+
							'</div>'+
						'</td>'+
						'<td style="'+css['bg_right']+'">'+transp+'</td>'+
					'</tr>'+
					'<tr>'+
						'<td style="'+css['bg_bottom_left']+'">'+transp+'</td>'+
						'<td style="'+css['bg_bottom']+'">'+transp+'</td>'+
						'<td style="'+css['bg_bottom_right']+'">'+transp+'</td>'+
					'</tr>'+
				'</table>';
			balloon.innerHTML = body;
			var nodes = balloon.getElementsByTagName("div");
			var balloonText = nodes[0];
			
			var imgStyle =	{
				position: "absolute",
				pointerEvents: "none",
				bottom: "-21px",
				right: "15px"
			};
			if(document.doctype) {
				//if(gmxAPI.isChrome || gmxAPI.isSafari || gmxAPI.isIE) 
				if(!window.opera) imgStyle["bottom"] = "-19px";
			} else if(gmxAPI.isIE && document.documentMode >= 8) imgStyle["bottom"] = "-19px";
			var leg = gmxAPI.newElement("img",
				{
					className: 'gmx_balloon_leg',
					src: apiBase + "img/tooltip-leg.png"
				},
				imgStyle
			);
			balloon.appendChild(leg);

			var x = 0;
			var y = 0;
			var legX = null;
			var bposX = 0;
			var bposY = 0;
			var reposition = function()	
			{
				//if(!wasVisible) return;
				var ww = balloon.clientWidth;
				var hh = balloon.clientHeight;
				balloon.style.visibility = (ww == 0 || hh ==0 ? 'hidden' : 'visible'); 

				var screenWidth = div.clientWidth;
				var yy = div.clientHeight - y + 20;

				var xx = (x + ww < screenWidth) ? x : (ww < screenWidth) ? (screenWidth - ww) : 0;
				xx = Math.max(xx, x - ww + legWidth + brw);
				var dx = x - xx;
				if(legX != dx) leg.style.left = dx + "px";
				legX = dx;
				xx += 2;

				if(bposX != xx || bposY != yy) {
					if(balloon.parentNode != div) gmxAPI.position(balloon, xx, yy);
					else gmxAPI.bottomPosition(balloon, xx, yy);
				}
				bposX = xx;
				bposY = yy;
			}

			var updateVisible = function(flag)	
			{
				gmxAPI.setVisible(balloon, flag);
				if (flag && !wasVisible) {
					ret.resize();
				}
				wasVisible = flag;
			}
			var isVisible = function()	
			{
				return wasVisible;
			}

			var wasVisible = true;
			var setMousePos = function(x_, y_)	
			{
				x = this.mouseX = x_;
				y = this.mouseY = y_;
			}

			var ret = {						// Возвращаемый обьект
				outerDiv: balloon,
				div: balloonText,
				leg: leg,
				mouseX: 0,
				mouseY: 0,
				//delayHide: false,
				delayShow: false,
				isVisible: isVisible,
				setVisible: updateVisible,
				setMousePos: setMousePos,
				setScreenPosition: function(x_, y_)
				{
					setMousePos(x_, y_);
					if(wasVisible) reposition();
				},
				resize: function()
				{
					reposition();
				},
				updatePropsBalloon: function(text)
				{
					updateVisible((text && !buttons ? true : false));
					chkBalloonText(text, balloonText);
					reposition();
				},
				chkMouseOut: function()
				{
					if(propsBalloon.delayHide) updateVisible(false);
				}
				,
				stateListeners: {},
				addListener: function(eventName, func) { return gmxAPI._listeners.addListener({'obj': this, 'eventName': eventName, 'func': func}); },
				removeListener: function(eventName, id)	{ return gmxAPI._listeners.removeListener(this, eventName, id); }
			};
			return ret;
		}

		var propsBalloon = createBalloon(true);		// Balloon для mouseOver
		this.propsBalloon = propsBalloon;
		propsBalloon.setVisible(false);
		propsBalloon.outerDiv.style.zIndex = 10000;
		propsBalloon.outerDiv.style.display = "none";

/*
		document.onmouseover = function(ev)
		{
			var event = gmxAPI.compatEvent(ev);
			if(event && event.target != propsBalloon.leg) setDelayHide();
		}
		document.onmouseout = function(event)
		{
			if(!gmxAPI.contDivPos) return;
			var minx = gmxAPI.contDivPos['x'];
			var maxx = minx + gmxAPI._div.clientWidth;
			var eventX = gmxAPI.eventX(event);
			var miny = gmxAPI.contDivPos['y'];
			var maxy = miny + gmxAPI._div.clientHeight;
			var eventY = gmxAPI.eventY(event);
			if(eventX >= minx && eventX <= maxx && eventY >= miny && eventY <= maxy) return;
			propsBalloon.outerDiv.style.display = "none";
		}
*/
		div.onmouseout = function(ev)		// скрыть балун по наведению если мышь ушла
		{
			if(gmxAPI.proxyType === 'leaflet') return;
			if(propsBalloon.isVisible()) {
				var event = gmxAPI.compatEvent(ev);
				var tg = gmxAPI.compatTarget(event);
				var reltg = event.toElement || event.relatedTarget;
				while (reltg && (reltg != document.documentElement))
				{
					if (reltg == propsBalloon.outerDiv) {
						return;
					}
					reltg = reltg.offsetParent;
				}
				while (tg && (tg != document.documentElement))
				{
					if (tg == propsBalloon.outerDiv)
						return;
					tg = tg.offsetParent;
				}
				propsBalloon.outerDiv.style.display = "none";
			}
		}

		var positionBalloons = function(ph)	
		{
			if(balloons.length < 1) return;
			refreshMapPosition(ph);
			balloons.sort(function(b1, b2)
			{
				return b1.isHovered ? 1 : b2.isHovered ? -1 : (b2.geoY - b1.geoY);
			});
			for (var i = 0; i < balloons.length; i++)
			{
				var bal = balloons[i];
				bal.reposition();
				if(bal.outerDiv.style.zIndex != 1000 + i) bal.outerDiv.style.zIndex = 1000 + i;
			}
		}

		//map.addObject().setHandler("onMove", positionBalloons);
		gmxAPI.contDivPos = null;
		var eventXprev = 0; 
		var eventYprev = 0;
		var buttons = false;
		var mouseMoveTimer = null;
		var onmousemove = function(ev)
		{
			//if(!propsBalloon.isVisible()) return;
			var event = gmxAPI.compatEvent(ev);
			if(!event) return;
			buttons = event.buttons;
			var eventX = gmxAPI.eventX(event); 
			var eventY = gmxAPI.eventY(event);
			if(eventX == eventXprev && eventY == eventYprev) return;
			eventXprev = eventX; 
			eventYprev = eventY;
			var px = eventX; 
			var py = eventY;
			if(gmxAPI.proxyType == 'flash') {
				//if(!gmxAPI.contDivPos) {
					gmxAPI.contDivPos = {
						'x': gmxAPI.getOffsetLeft(div),
						'y': gmxAPI.getOffsetTop(div)
					};
				//}
			} else {
				/*if(gmxAPI.isChrome) {
					gmxAPI.contDivPos = {
						'x': div.offsetLeft,
						'y': div.offsetTop
					};
					//px -= event.layerX; 
					//py -= event.layerY;
				} else {*/
					gmxAPI.contDivPos = {
						'x': gmxAPI.getOffsetLeft(div),
						'y': gmxAPI.getOffsetTop(div)
					};
				//}
			}
			px -= gmxAPI.contDivPos['x']; 
			py -= gmxAPI.contDivPos['y'];
/*
*/
			propsBalloon.setScreenPosition(px, py);
/*
			if(gmxAPI.proxyType == 'flash') {
event.stopImmediatePropagation();
				if (event.preventDefault)
				{
					event.stopPropagation();
				}
				else 
				{
					event.cancelBubble = true;
				}
			}
*/
		}

		gmxAPI._div.onmousemove = function(ev)
		{
			onmousemove(ev);
/*
			if(mouseMoveTimer) clearTimeout(mouseMoveTimer);
			mouseMoveTimer = setTimeout(function() {
				onmousemove(ev);
				mouseMoveTimer = null;
			}, 0);
*/
		};
		
		//gmxAPI._div.onmousemove = onmousemove;
		//new gmxAPI.GlobalHandlerMode("mousemove", onmousemove).set();
		
		gmxAPI.map.addListener('positionChanged', function(ph)
			{
				if(ph && ph.currZ != Math.floor(ph.currZ)) return;
				positionBalloons();
			}
		, -10);
		
		gmxAPI.map.addListener('onResizeMap', function()
			{
/*			
				gmxAPI.contDivPos = {
					'x': gmxAPI.getOffsetLeft(div),
					'y': gmxAPI.getOffsetTop(div)
				};
*/
				gmxAPI.contDivPos = {
					'x': div.offsetLeft,
					'y': div.offsetTop
				};
				positionBalloons();
			}
		, -10);
		
		function addBalloon(_notDelFlag)
		{
			var balloon = createBalloon();
			balloon.notDelFlag = _notDelFlag;
			balloon.geoX = 0;
			balloon.geoY = 0;
			balloon.isDraging = false;
			balloon.isRemoved = false;
			
			var oldSetVisible = balloon.setVisible;
			balloon.outerDiv.onmouseover = function(ev)
			{
				balloon.isHovered = true;
				positionBalloons();
				gmxAPI._mouseOnBalloon = true;
				if(propsBalloon.isVisible()) {
					propsBalloon.setVisible(false);
					gmxAPI._listeners.dispatchEvent('hideHoverBalloon', gmxAPI.map, {});
				}
			}
			balloon.outerDiv.onmouseout = function()
			{
				balloon.isHovered = false;
				positionBalloons();
				gmxAPI._mouseOnBalloon = false;
			}
			balloon.outerDiv.appendChild(gmxAPI.newElement(
				"img",
				{
					src: apiBase + "img/close.png",
					title: gmxAPI.KOSMOSNIMKI_LOCALIZED("Закрыть", "Close"),
					onclick: function(ev) 
					{ 
						if(balloon.notDelFlag) {
							balloon.setVisible(false);
						}
						else
						{
							balloon.remove();
							balloon.isVisible = false;
						}
						gmxAPI.stopEvent(ev);
						gmxAPI._mouseOnBalloon = false;
						gmxAPI._listeners.dispatchEvent('onClose', balloon, false);
					},
					onmouseover: function()
					{
						this.src = apiBase + "img/close_orange.png";
					},
					onmouseout: function()
					{
						this.src = apiBase + "img/close.png";
					}
				},
				{
					position: "absolute",
					top: "15px",
					right: "15px",
					cursor: "pointer"
				}
			));
			balloon.isVisible = true;
			balloon.reposition = function()
			{
				if (balloon.isVisible)
				{
					refreshMapPosition();

					var sc = scale * stageZoom;
					
					// Смещение Балуна к центру
					var deltaX = 0;
					if(!balloon.isDraging && gmxAPI.proxyType === 'flash') {
						var pos = gmxAPI.chkPointCenterX(this.geoX);
						var centrGEO = gmxAPI.from_merc_x(mapX);
						
						var mind = Math.abs(pos - centrGEO);
						for(var i = 1; i<4; i++) {
							var d1 = Math.abs(pos - centrGEO + i * 360);
							if (d1 < mind) { mind = d1; deltaX = i * 360; }
							d1 = Math.abs(pos - centrGEO - i * 360);
							if (d1 < mind) { mind = d1; deltaX = -i * 360; }
						}
						deltaX = gmxAPI.merc_x(deltaX) / sc;
					}

					var px = (mapX - gmxAPI.merc_x(balloon.geoX))/sc;
					var py = (mapY - gmxAPI.merc_y(balloon.geoY))/sc;
					var x = div.clientWidth/2 - px + deltaX;
					var y = div.clientHeight/2 + py;

					/*if(balloon.fixedDeltaFlag) {
						x += balloon.fixedDeltaX;
						y -= balloon.fixedDeltaY;
					}*/
					var flag = (y < 0 || y > div.clientHeight ? false : true);
					if (flag) {
						if (x < 0 || x > div.clientWidth) flag = false;
					}

					if (flag)
					{
						this.setScreenPosition(x, y);
						oldSetVisible(true);
					}
					else
						oldSetVisible(false);
				}
				else
				{
					oldSetVisible(false);
				}
			}
			balloon.setVisible = function(flag)
			{
				balloon.isVisible = flag;
				this.reposition();
				if(!flag) setTimeout(function() { gmxAPI._mouseOnBalloon = false; }, 20);
			}
			balloon.setPoint = function(x_, y_, isDraging_)
			{
				this.geoX = x_;
				this.geoY = y_;
				this.isDraging = isDraging_;
				positionBalloons();
			}
			balloon.remove = function()
			{
				gmxAPI._mouseOnBalloon = false;
				if(balloon.isRemoved) return false;
				if(balloon.fixedId) delete fixedHoverBalloons[balloon.fixedId];
				for(var i=0; i<balloons.length; i++) {
					if(balloons[i] == balloon) {
						balloons.splice(i, 1);
						break;
					}
				}
				if(this.outerDiv.parentNode) this.outerDiv.parentNode.removeChild(this.outerDiv);
				//div.removeChild(this.outerDiv);
				var gmxNode = gmxAPI.mapNodes[balloon.pID];		// Нода gmxAPI
				gmxAPI._listeners.dispatchEvent('onBalloonRemove', gmxNode, {'obj': balloon.obj});		// balloon удален
				balloon.isRemoved = true;
			}
			balloon.getX = function() { return this.geoX; }
			balloon.getY = function() { return this.geoY; }
			balloons.push(balloon);
			return balloon;
		}
		this.addBalloon = addBalloon;


		//Параметры:
		// * Balloon: текст баллуна
		// * BalloonEnable: показывать ли баллун
		// * DisableBalloonOnClick: не показывать при клике
		// * DisableBalloonOnMouseMove: не показывать при наведении
		var setBalloonFromParams = function(filter, balloonParams)
		{
/*			
			//по умолчанию балуны показываются
			if ( typeof balloonParams.BalloonEnable !== 'undefined' && !balloonParams.BalloonEnable )
			{
				disableHoverBalloon(filter);
				//return;
			}
*/			
			var balloonAttrs = {
				disableOnClick: balloonParams.DisableBalloonOnClick,
				disableOnMouseOver: balloonParams.DisableBalloonOnMouseMove
			}
			
			if ( balloonParams.Balloon )
			{
				filter['_balloonTemplate'] = balloonParams.Balloon;
				enableHoverBalloon(filter, function(o)
					{
						var text = gmxAPI.applyTemplate(balloonParams.Balloon, o.properties);
						var summary = o.getGeometrySummary();
						text = gmxAPI.applyTemplate(text, { SUMMARY: summary });
						text = text.replace(/\[SUMMARY\]/g, '');
						return text;
					}
					,
					balloonAttrs);
			}
			else
			{
				enableHoverBalloon(filter, null, balloonAttrs);
			}
		}
		this.setBalloonFromParams = setBalloonFromParams;
		
		//явно прописывает все свойства балунов в стиле.
		var applyBalloonDefaultStyle = function(balloonStyle)
		{
			var out = gmxAPI.clone(balloonStyle);
			//слой только что создали - всё по умолчанию!
			if (typeof out.BalloonEnable === 'undefined')
			{
				out.BalloonEnable = true;
				out.DisableBalloonOnClick = false;
				out.DisableBalloonOnMouseMove = true;
			} 
			else
			{
				//поддержка совместимости - если слой уже был, но новых параметров нет 
				if (typeof out.DisableBalloonOnClick === 'undefined')
					out.DisableBalloonOnClick = false;
					
				if (typeof out.DisableBalloonOnMouseMove === 'undefined')
					out.DisableBalloonOnMouseMove = false;
			}
			return out;
		}
		this.applyBalloonDefaultStyle = applyBalloonDefaultStyle;
	}

	var userBalloons = {};
	// Добавление прослушивателей событий
	gmxAPI._listeners.addListener({'level': -10, 'eventName': 'mapInit', 'func': function(map) {
			if(!gmxAPI.map || gmxAPI.map.balloonClassObject) return;
			gmxAPI.map.balloonClassObject = new BalloonClass();
			gmxAPI.map.addListener('zoomBy', function()	{ gmxAPI.map.balloonClassObject.hideHoverBalloons(true); });
			gmxAPI.map.addListener('hideBalloons', function(attr) { gmxAPI.map.balloonClassObject.hideHoverBalloons(null, attr); });
			gmxAPI.map.addListener('onMoveEnd', function() { gmxAPI.map.balloonClassObject.showHoverBalloons(); });

			gmxAPI.map.addListener('clickBalloonFix', function(o) { gmxAPI.map.balloonClassObject.clickBalloonFix(o); });
			gmxAPI.map.addListener('initFilter', function(data)
				{
					var fullStyle = gmxAPI.map.balloonClassObject.applyBalloonDefaultStyle(data['filter']['_attr']);
					gmxAPI.map.balloonClassObject.setBalloonFromParams(data['filter'], fullStyle);
				}
			);
			
			//расширяем FlashMapObject
			gmxAPI.extendFMO('addBalloon', function() {
				var balloon = map.balloonClassObject.addBalloon();
				var id = gmxAPI.newFlashMapId();
				balloon.fixedId = id;
				userBalloons[id] = balloon;
				return balloon;
			});
			gmxAPI.extendFMO('enableHoverBalloon', function(callback, attr) { map.balloonClassObject.enableHoverBalloon(this, callback, attr); });
			gmxAPI.extendFMO('disableHoverBalloon', function() { map.balloonClassObject.disableHoverBalloon(this); });
		}
	});
	//gmxAPI.BalloonClass = BalloonClass;
})();
;/* ======================================================================
    drawingLeaflet.js
   ====================================================================== */

//Управление drawFunctions
(function()
{
	var outlineColor = 0x0000ff;
	var fillColor = 0xffffff;
	var currentDOMObject = null;		// текущий обьект рисования
	var pSize = 8;
	var pointSize = pSize / 2;
	var lineWidth = 3;
	var mouseOverFlag = false;
	var mousePressed = false;

	var chkStyle = function(drawAttr, regularStyle, hoveredStyle) {
		if(drawAttr['regularStyle']) {
			var opacity = ('opacity' in drawAttr['regularStyle'] ? drawAttr['regularStyle']['opacity']/100 : 1);
			var color = ('color' in drawAttr['regularStyle'] ? drawAttr['regularStyle']['color'] : 0xff);
			drawAttr['strokeStyle']['color'] = gmxAPI._leaflet['utils'].dec2rgba(color, opacity);
			var weight = ('weight' in drawAttr['regularStyle'] ? drawAttr['regularStyle']['weight'] : lineWidth);
			drawAttr['stylePolygon'] = {
				'color': gmxAPI._leaflet['utils'].dec2rgba(color, opacity)
				,'weight': weight
				,'opacity': opacity
				
			};
			drawAttr['stylePoint'] = gmxAPI.clone(stylePoint);
			drawAttr['stylePoint']['pointSize'] = pointSize;
			drawAttr['stylePoint']['color'] = drawAttr['stylePolygon']['color'];
			drawAttr['stylePoint']['weight'] = drawAttr['stylePolygon']['weight'];
			drawAttr['stylePoint']['fillOpacity'] = 
			drawAttr['stylePoint']['opacity'] = drawAttr['stylePolygon']['opacity'];
		}
	}
	
	var getLongLatLng = function(lat, lng)
	{
		var point = new L.LatLng(lat, lng);
		if(lng > 180) point.lng = lng;
		else if(lng < -180) point.lng = lng;
		return point;
	}
	var getDownType = function(ph, coords)
	{
		var out = {};
		var dBounds = new L.Bounds();
		for (var i = 0; i < coords.length; i++)
		{
			var pArr = coords[i];
			dBounds.extend(new L.Point(pArr[0],  pArr[1]));
		}
		var dx = getDeltaX(dBounds);
		var point = getLongLatLng(ph.latlng.lat, ph.latlng.lng);
		var p1 = gmxAPI._leaflet['LMap'].project(point);
		var len = coords.length;
		for (var i = 0; i < len; i++)
		{
			var pArr = coords[i];
			var pBounds = getBoundsPoint(pArr[0] + dx, pArr[1]);
			if(pBounds.contains(point)) {
				out = {'type': 'node', 'num':i};
				break;
			} else {
				var x = pArr[0] + dx;
				var p2 = gmxAPI._leaflet['LMap'].project(getLongLatLng(pArr[1], x));
				var jj = i + 1;
				if(jj >= len) jj = 0;
				var x = coords[jj][0] + dx;
				var point1 = gmxAPI._leaflet['LMap'].project(getLongLatLng(coords[jj][1], x));
				var x1 = p2.x - p1.x; 			var y1 = p2.y - p1.y;
				var x2 = point1.x - p1.x;		var y2 = point1.y - p1.y;
				var dist = L.LineUtil.pointToSegmentDistance(p1, p2, point1);
				if (dist < lineWidth)
				{
					out = {'type': 'edge', 'num':jj};
				}
			}
		}
		return out;
	}

	var getBoundsPoint = function(x, y)
	{
		var point = new L.LatLng(y, x);
		point.lng = x;
		point.lat = y;
		var pix = gmxAPI._leaflet['LMap'].project(point);
		var p1 = gmxAPI._leaflet['LMap'].unproject(new L.Point(pix['x'] - pointSize, pix['y'] + pointSize));
		var p2 = gmxAPI._leaflet['LMap'].unproject(new L.Point(pix['x'] + pointSize, pix['y'] - pointSize));
		return bounds = new L.LatLngBounds(p1, p2);
	}

	var getDeltaX = function(bounds)
	{
		var dx = 0;
		var centerObj = (bounds.max.x + bounds.min.x)/2;
		var latlng = new L.LatLng(0, centerObj);
		if(centerObj > 180) latlng.lng = centerObj;
		//else if(centerObj < -180) latlng.lng -= 180;
		var pixelCenterObj = gmxAPI._leaflet['LMap'].project(latlng);
		
		var point = gmxAPI._leaflet['LMap'].project(new L.LatLng(0, -180));
		var p180 = gmxAPI._leaflet['LMap'].project(new L.LatLng(0, 180));
		var worldSize = p180.x - point.x;
		
		var pixelBounds = gmxAPI._leaflet['LMap'].getPixelBounds();
		var centerViewport = (pixelBounds.max.x + pixelBounds.min.x)/2;
		
		var dist = pixelCenterObj.x - centerViewport;
		var delta = Math.abs(dist);
		var delta1 = Math.abs(dist + worldSize);
		var delta2 = Math.abs(dist - worldSize);
		if(delta1 < delta) dx = 360;
		if(delta2 < delta && delta2 < delta1) dx = -360;
		return dx;
	}

	var tmpPoint = null;
	var styleStroke = {color: "#0000ff", weight: lineWidth , opacity: 1};
	var stylePoint = {color: "#0000ff", fill: true, fillColor: "#ffffff", weight: lineWidth, opacity: 1, fillOpacity: 1, 'pointSize': pointSize, skipLastPoint: true, skipSimplifyPoint: true, clickable: true};
	var stylePolygon = {color: "#0000ff", fillColor: "#ff0000", weight: lineWidth, opacity: 1, fillOpacity: 0.5, clickable: true};

	var drawSVG = function(attr)
	{
		var layerGroup = attr['layerGroup'];
		if(!layerGroup._map) return;
		var layerItems = attr['layerItems'];
		//console.log('drawSVG:  ', attr['coords'].length);
		var dBounds = new L.Bounds();
		for (var i = 0; i < attr['coords'].length; i++)
		{
			var pArr = attr['coords'][i];
			dBounds.extend(new L.Point(pArr[0],  pArr[1]));
		}

		var dx = getDeltaX(dBounds);

		if(layerItems.length == 0) {
			var tstyle = attr['stylePolygon'] || stylePolygon;
			layerItems.push(new L.Polyline([], tstyle));
			var pstyle = attr['stylePoint'] || stylePoint;
			//pstyle['skipLastPoint'] = (attr['editType'] !== 'LINESTRING');
			layerItems.push(new L.GMXPointsMarkers([], pstyle));
			if(attr['setEditEnd']) {
				layerItems[1].options['skipLastPoint'] = false;
			}

			layerGroup.addLayer(layerItems[0]);
			layerGroup.addLayer(layerItems[1]);

			layerItems[1]._container.style.pointerEvents = 'painted';
			layerItems[0]._container.style.pointerEvents = (!attr['isExternal'] && attr['editType'] !== 'FRAME' ? 'none':'painted');

			layerItems[0].on('mousedown', function(e) {
				var downType = getDownType(e, attr['coords'], dBounds);
				downType['id'] = attr['node'].id;
				attr['mousedown'](e, downType);
				L.DomEvent.stop(e.originalEvent);
				gmxAPI._leaflet['mousePressed'] = true;
			}, this);

			var downArr = [];
			layerItems[1].on('mousedown', function(e) {
				downArr.push(new Date().getTime());
				if(downArr.length > 2) {	// имитация dblclick
					downArr.shift();
					var delta = downArr[1] - downArr[0];
					if(delta < 400 && attr['dblclick']) {
						attr['dblclick'](e, this);
						if(attr['mouseUp']) attr['mouseUp']();
						return;
					}
				}
				attr['mousedown'](e, {'num':0, 'type':'node', 'id':attr['node'].id});
				L.DomEvent.stop(e.originalEvent);
				gmxAPI._leaflet['mousePressed'] = true;
			}, this);
		}
		layerGroup.bringToFront();
		
		//if(layerItems[1].options.skipSimplifyPoint == mousePressed) { layerItems[1].options.skipSimplifyPoint = !mousePressed; }
		
		/*
		if(attr['editType'] == 'LINESTRING' && layerItems[0].options.fill) {
		}*/
		var latLngs = [];
		var len = attr['coords'].length - 1;
		var latLngsPoints = [];
		for (var i = 0; i < attr['coords'].length; i++)
		{
			var pArr = attr['coords'][i];
			var latLng = new L.LatLng(pArr[1], pArr[0] + dx);
			latLngs.push(latLng);
		}
		if(attr['lastPoint']) {
			var latLng = new L.LatLng(attr['lastPoint']['y'], attr['lastPoint']['x'] + dx);
			latLngs.push(latLng);
		}
		//layerItems[1].options['skipLastPoint'] = (attr['editType'] !== 'LINESTRING');
		layerItems[0].setLatLngs(latLngs);
		layerItems[1].setLatLngs(latLngs);
	}

	function getGeometryTitle(geom)
	{
		var geomType = geom['type'];
		if (geomType.indexOf("POINT") != -1)
		{
			var c = geom.coordinates;
			return "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Координаты:", "Coordinates:") + "</b> " + gmxAPI.LatLon_formatCoordinates(c[0], c[1]);
		}
		else if (geomType.indexOf("LINESTRING") != -1)
			return "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Длина:", "Length:") + "</b> " + gmxAPI.prettifyDistance(gmxAPI.geoLength(geom));
		else if (geomType.indexOf("POLYGON") != -1)
			return "<b>" + gmxAPI.KOSMOSNIMKI_LOCALIZED("Площадь:", "Area:") + "</b> " + gmxAPI.prettifyArea(gmxAPI.geoArea(geom));
		else
			return "?";
	}
	
	var regularDrawingStyle = {
		marker: { size: 3 },
		outline: { color: outlineColor, thickness: 3, opacity: 80 },
		fill: { color: fillColor }
	};
	var hoveredDrawingStyle = { 
		marker: { size: 4 },
		outline: { color: outlineColor, thickness: 4 },
		fill: { color: fillColor }
	};

	var getStyle = function(removeDefaults, mObj){
		var out = mObj.getStyle( removeDefaults );
		if(out && !removeDefaults) {
			if(!out.regular) out.regular = regularDrawingStyle;
			if(!out.hovered) out.hovered = hoveredDrawingStyle;
		}
		return out;
	};
	
	var objects = {};
	//var multiObjects = {};
	var drawFunctions = {};

	var chkDrawingObjects = function() {
		for (var id in objects) {
			var cObj = objects[id];
			if(!cObj.geometry) cObj.remove();
		}
	};
	var endDrawing = function() {			// Вызывается при выходе из режима редактирования
		chkDrawingObjects();
		currentDOMObject = null;
		gmxAPI._drawing['activeState'] = false;
	};

	var createDOMObject = function(ret, properties, propHiden)
	{
		var myId = gmxAPI.newFlashMapId();
		var myContents;
		var callHandler = function(eventName)
		{
			var handlers = gmxAPI.map.drawing.handlers[eventName] || [];
			for (var i = 0; i < handlers.length; i++)
				handlers[i](objects[myId]);

			gmxAPI._listeners.dispatchEvent(eventName, gmxAPI.map.drawing, objects[myId]);
		}
		var addHandlerCalled = false;
		objects[myId] = {
			properties: properties || {},
			propHiden: propHiden || {},
			setText: ret.setText,
			setVisible: function(flag)
			{
				ret.setVisible(flag);
				this.properties.isVisible = flag;
			},
/*			updateCoordinates: function(coords)
			{
				if(coords.type) coords = coords.coordinates;	// Если это geometry берем только координаты
				if(!coords) return;				// Если нет coords ничего не делаем
				ret.updateCoordinates(coords);
			},
*/
			update: function(geometry, text)
			{
				if(!geometry) return;				// Если нет geometry ничего не делаем
				this.properties.text = text;
				this.properties.isVisible = ret.isVisible;
				this.geometry = geometry;
				this.balloon = ret.balloon;
				callHandler(addHandlerCalled ? "onEdit" : "onAdd");
				addHandlerCalled = true;
			},
			remove: function() { ret.remove(); },
			removeInternal: function()
			{
				callHandler("onRemove");
				delete objects[myId];
			},
			chkZindex: function()
			{
				if('chkZindex' in ret) ret.chkZindex();
			},
			triggerInternal: function( callbackName ){ callHandler(callbackName); },
			getGeometry: function() { return gmxAPI.clone(this.geometry); },
			getLength: function() { return gmxAPI.geoLength(this.geometry); },
			getArea: function() { return gmxAPI.geoArea(this.geometry); },
			getCenter: function() { return gmxAPI.geoCenter(this.geometry); },
			setStyle: function(regularStyle, hoveredStyle) { ret.setStyle(regularStyle, hoveredStyle); },
			getVisibleStyle: function() { return ret.getVisibleStyle(); },
			getStyle: function(removeDefaults) { return ret.getStyle(removeDefaults); },
			stateListeners: {},
			addListener: function(eventName, func) { return gmxAPI._listeners.addListener({'obj': this, 'eventName': eventName, 'func': func}); },
			removeListener: function(eventName, id)	{ return gmxAPI._listeners.removeListener(this, eventName, id); }
		}
		if('chkMouse' in ret) objects[myId]['chkMouse'] = ret.chkMouse;
		if('getItemDownType' in ret) objects[myId]['getItemDownType'] = ret.getItemDownType;
		if('itemMouseDown' in ret) objects[myId]['itemMouseDown'] = ret.itemMouseDown;

		currentDOMObject = ret.domObj = objects[myId];
		return objects[myId];
	}

	drawFunctions.POINT = function(coords, props, propHiden)
	{
		if (!props)
			props = {};

		var text = props.text;
		if (!text)
			text = "";
		var x, y;
		var obj = false;
		var balloon = false;
		var domObj;
		var isDrawing = true;
		var ret = {};
		var toolsContainer = null;
		if('_tools' in gmxAPI && 'standart' in gmxAPI._tools) {
			toolsContainer = gmxAPI._tools['standart'];
			toolsContainer.currentlyDrawnObject = ret;
		}

		// Проверка пользовательских Listeners POLYGON
		var chkEvent = function(eType, out)
		{
			//if(!mousePressed && gmxAPI.map.drawing.enabledHoverBalloon) {
			//	var st = (out ? out : false);
			//	propsBalloon.updatePropsBalloon(st);
			//}
			var flag = gmxAPI._listeners.dispatchEvent(eType, domObj, domObj);
			if(!flag) flag = gmxAPI._listeners.dispatchEvent(eType, gmxAPI.map.drawing, domObj);
/*			
			var eObj = (domObj.propHiden['multiObj'] ? domObj.propHiden['multiObj'] : domObj);
			var flag = gmxAPI._listeners.dispatchEvent(eType, eObj, eObj);
			if(!flag) flag = gmxAPI._listeners.dispatchEvent(eType, gmxAPI.map.drawing, eObj);
			//console.log('chkEvent:  ', eType, flag);
*/
			return flag;
		}

		ret.isVisible = (props.isVisible == undefined) ? true : props.isVisible;
		ret.stopDrawing = function()
		{
			//gmxAPI._cmdProxy('stopDrawing');
			if (!isDrawing)
				return;
			isDrawing = false;
			if (!coords)
			{
				if(addItemListenerID) gmxAPI.map.removeListener('onClick', addItemListenerID);
				addItemListenerID = null;
			/*
				gmxAPI.map.unfreeze();
				gmxAPI._sunscreen.setVisible(false);
				gmxAPI._setToolHandler("onClick", null);
				gmxAPI._setToolHandler("onMouseDown", null);
			*/
				//gmxAPI.map.clearCursor();
			}
		}

		ret.remove = function()
		{
			if (obj)
			{
				chkEvent('onRemove');
				obj.remove();
				if(balloon) balloon.remove();
				domObj.removeInternal();
			}
		}

		ret.setStyle = function(regularStyle, hoveredStyle) {}

		var done = function(xx, yy)
		{
			obj = gmxAPI.map.addObject(null, null, {'subType': 'drawing'});
			balloon = null;
			if(gmxAPI.map.balloonClassObject) {
				balloon = gmxAPI.map.balloonClassObject.addBalloon(true);	// Редактируемый балун (только скрывать)
			}

			gmxAPI.map.addListener('zoomBy', function() {
				if(balloon.isVisible) gmxAPI.setVisible(balloon.outerDiv, false);
			});
			gmxAPI.map.addListener('onMoveEnd', function() {
				if(balloon.isVisible) {
					gmxAPI.setVisible(balloon.outerDiv, true);
					balloon.reposition();
				}
				upCallback();
			});

			var updateDOM = function()
			{
				xx = gmxAPI.chkPointCenterX(xx);
				domObj.update({ type: "POINT", coordinates: [xx, yy] }, text);
			}

			ret.setText = function(newText)
			{
				if(!balloon) return;
				text = newText;
				input.value = newText;
				balloon.updatePropsBalloon(newText);
				updateText();
			}

			ret.setVisible = function(flag)
			{
				ret.isVisible = flag;
				obj.setVisible(ret.isVisible);
				if(balloon) balloon.setVisible(ret.isVisible && balloonVisible);
			}
			ret.balloon = balloon;
			ret.getVisibleStyle = function() { return obj.getVisibleStyle(); };
			ret.getStyle = function(removeDefaults) { return getStyle(removeDefaults, obj); };

			var position = function(x, y)
			{
				xx = x;
				yy = y;
				//gmxAPI._cmdProxy('setAPIProperties', { 'obj': obj, 'attr':{'type':'POINT', 'isDraging': isDragged} });
				obj.setPoint(xx, yy);
				if(balloon) balloon.setPoint(xx, yy, isDragged);
				updateDOM();
			}
/*			ret.updateCoordinates = function(newCoords)
			{
				position(newCoords[0], newCoords[1]);
			}
*/
			var apiBase = gmxAPI.getAPIFolderRoot();

			obj.setStyle(
				{ 
					marker: { image: apiBase + "img/flag_blau1.png", dx: -6, dy: -36 },
					label: { size: 12, color: 0xffffc0 }
				},
				{ 
					marker: { image: apiBase + "img/flag_blau1_a.png", dx: -6, dy: -36 },
					label: { size: 12, color: 0xffffc0 }
				}
			);

			var startDx = 0, startDy = 0, isDragged = false;
			var clickTimeout = false;
			var needMouseOver = true;

			obj.setHandlers({
				"onClick": function()
				{
					if(domObj.stateListeners['onClick'] && chkEvent('onClick')) return;	// если установлен пользовательский onClick возвращающий true выходим
					if (clickTimeout)
					{
						clearTimeout(clickTimeout);
						clickTimeout = false;
						ret.remove();
					}
					else
					{
						clickTimeout = setTimeout(function() { clickTimeout = false; }, 500);
						if(balloon) {
							balloonVisible = !balloon.isVisible;
							balloon.setVisible(balloonVisible);
							if (balloonVisible)
								setHTMLVisible(true);
							else
							{
								gmxAPI.hide(input);
								gmxAPI.hide(htmlDiv);
							}
						}
					}
					return true;
				}
				,"onMouseOver": function()
				{
					if(!isDragged && needMouseOver) {
						chkEvent('onMouseOver');
						needMouseOver = false;
					}
				}
				,"onMouseOut": function()
				{
					if(!isDragged && !needMouseOver) {
						chkEvent('onMouseOut');
						needMouseOver = true;
					}
				}
			});

			var dragCallback = function(x, y)
			{
				position(x, y);
				chkEvent('onEdit');
			}
			var downCallback = function(x, y)
			{
				x = gmxAPI.chkPointCenterX(x);
				isDragged = true;
				if(balloon) {
					if(balloon.outerDiv.style.pointerEvents != 'none') {
						balloon.outerDiv.style.pointerEvents = 'none';
					}
				}
			};
			var upCallback = function()
			{
				if(balloon) {
					if(balloon.outerDiv.style.pointerEvents != 'auto') {
						balloon.outerDiv.style.pointerEvents = 'auto';
					}
				}
				isDragged = false;
				chkEvent('onFinish');
			}
			
			gmxAPI._listeners.addListener({'eventName': 'onZoomend', 'func': upCallback });
			obj.enableDragging(function(x, y, o, data)
			{
				dragCallback(x, y);
				gmxAPI._drawing['activeState'] = true;
			}
			, function(x, y, o, data)
			{
				downCallback(x, y);
			}
			, function(o)
			{
				//chkEvent('onFinish');
				gmxAPI._drawing['activeState'] = false;
				upCallback();
			});

			if(balloon) {	// Это все касается балуна для маркера
				var htmlDiv = document.createElement("div");
				htmlDiv.onclick = function(event)
				{
					event = event || window.event;
					var e = gmxAPI.compatTarget(event);
					if (e == htmlDiv)
					{
						setHTMLVisible(false);
						input.focus();
					}
				}
				balloon.div.appendChild(htmlDiv);
				var input = document.createElement("textarea");
				input.style.backgroundColor = "transparent";
				input.style.border = 0;
				input.style.overflow = "hidden";
				var fontSize = 16;
				input.style.fontSize = fontSize + 'px';
				input.setAttribute("wrap", "off");
				input.value = text ? text : "";

				var updateText = function() 
				{ 
					var newText = input.value;
					var rows = 1;
					for (var i = 0; i < newText.length; i++) {
						if (newText.charAt(i) == '\n'.charAt(0)) rows += 1;
						var tt = 1;
					}
					input.rows = rows;
					var lines = newText.split("\n");
					var cols = 2;
					for (var i in lines)
						cols = Math.max(cols, lines[i].length + 3);
					input.cols = cols;
					input.style.width = cols * (fontSize - (gmxAPI.isIE ? 5: 6));
					text = newText;
					if(balloon) balloon.resize();
					updateDOM();
				};
				input.onkeyup = updateText;
				input.onblur = function()
				{
					setHTMLVisible(true);
				}
				input.onmousedown = function(e)
				{
					if (!e)
						e = window.event;
					if (e.stopPropagation)
						e.stopPropagation();
					else
						e.cancelBubble = true;
				}
				if(balloon) balloon.div.appendChild(input);

				var setHTMLVisible = function(flag)
				{
					gmxAPI.setVisible(input, !flag);
					gmxAPI.setVisible(htmlDiv, flag);
					if (flag)
						htmlDiv.innerHTML = (gmxAPI.strip(input.value) == "") ? "&nbsp;" : input.value;
					if(balloon) balloon.resize();
				}

				var balloonVisible = (text && (text != "")) ? true : false;
				setHTMLVisible(balloonVisible);

				/*
				var getEventPoint = function(event)
				{
					//var currPos = gmxAPI.currPosition || gmxAPI.map.getPosition();
					var currPos = gmxAPI.map.getPosition();
					var mapX = currPos['x'];
					var mapY = currPos['y'];
					var scale = gmxAPI.getScale(currPos['z']);
					var px = gmxAPI.eventX(event) - gmxAPI.contDivPos['x']; 
					var py = gmxAPI.eventY(event) - gmxAPI.contDivPos['y'];
					return {
						'x': gmxAPI.from_merc_x(mapX + (px - gmxAPI._div.clientWidth/2)*scale)
						,
						'y': gmxAPI.from_merc_y(mapY - (py - gmxAPI._div.clientHeight/2)*scale)
					};
				}
				balloon.outerDiv.onmousedown = function(event)
				{
					//gmxAPI._cmdProxy('startDrawing');
					//gmxAPI._cmdProxy('setAPIProperties', { 'obj': obj, 'attr':{'type':'POINT', 'isDraging': true} });
					var eventPoint = getEventPoint(event);
					downCallback(eventPoint['x'], eventPoint['y']);
					gmxAPI._startDrag(obj, dragCallback, upCallback);
					return false;
				}
				balloon.outerDiv.onmouseup = function(event)
				{
					//gmxAPI._cmdProxy('stopDrawing');
					//gmxAPI._cmdProxy('setAPIProperties', { 'obj': obj, 'attr':{'type':'POINT', 'isDraging': false} });
					gmxAPI._stopDrag();
					upCallback();
				}
				balloon.outerDiv.onmousemove = function(event)
				{
					if (!mousePressed) isDragged = false;
					if (isDragged)
					{
						var eventPoint = getEventPoint(event);
						position(startDx + eventPoint['x'], startDy + eventPoint['y']);
						gmxAPI.deselect();
						return false;
					}
				}*/
				var showFlag = false;
				gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomstart', 'func': function(attr) {
					showFlag = balloon.isVisible;
					balloon.setVisible(false);
				}});
				gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomend', 'func': function(attr) {
					balloon.setVisible(showFlag);
				}});
			}
			domObj = createDOMObject(ret, null, propHiden);
			domObj.objectId = obj.objectId;
			position(xx, yy);
			if(balloon) {
				balloon.setVisible(balloonVisible);
				updateText();
			}
			chkEvent('onAdd');

			ret.setVisible(ret.isVisible);
			chkEvent('onFinish');
		}

		var addItemListenerID = null;
		if (!coords)
		{
			gmxAPI._sunscreen.bringToTop();
			gmxAPI._sunscreen.setVisible(true);
			var apiBase = gmxAPI.getAPIFolderRoot();
			//gmxAPI.map.setCursor(apiBase + "img/flag_blau1.png", -6, -36);

			//gmxAPI._setToolHandler("onClick", function() 
			addItemListenerID = gmxAPI.map.addListener('onClick', function()
			{
				done(gmxAPI.map.getMouseX(), gmxAPI.map.getMouseY());
				if(toolsContainer) {
					toolsContainer.selectTool("move");
					if (gmxAPI.map.isKeyDown(16)) {
						toolsContainer.selectTool("POINT");
					}
				}
				ret.stopDrawing();
				return true;
			});
		}
		else
			done(coords[0], coords[1]);

		return ret;
	}

	var editObject = function(coords, props, editType, propHiden)
	{
		if (!props)
			props = {};

		var text = props.text;
		if (!text)
			text = "";

		var mapNodes = gmxAPI._leaflet['mapNodes'];					// Хэш нод обьектов карты - аналог MapNodes.hx
		var drawAttr = {
			'editType': editType
			,
			'strokeStyle': {
				'color': 'rgba(0, 0, 255, 1)'
			}
			,
			'fillStyle': {
				'color': 'rgba(255, 255, 255, 0.8)'
			}
			,
			'fillStylePolygon': {
				'color': 'rgba(255, 255, 255, 0.3)'
			}
		};

		var ret = {};
		var domObj = false;
		var toolsContainer = null;
		if('_tools' in gmxAPI && 'standart' in gmxAPI._tools) {
			toolsContainer = gmxAPI._tools['standart'];
			toolsContainer.currentlyDrawnObject = ret;
		}
		
		var propsBalloon = (gmxAPI.map.balloonClassObject ? gmxAPI.map.balloonClassObject.propsBalloon : null);
		var node = null;
		var oBounds = null;
		var addItemListenerID = null;
		var onMouseMoveID = null;
		var onMouseUpID = null;
		//var pCanvas = null;
		var pSize = 8;
		var lineWidth = 3;
		var pointSize = pSize / 2;
		var lastPoint = null;
		var needInitNodeEvents = true;
		var editIndex = -1;
		var finishTime = 0;
		var downTime = 0;
		
		mouseOverFlag = false;
		
		var mouseUp = function()
		{
			mousePressed = false;
			if(onMouseUpID) gmxAPI.map.removeListener('onMouseUp', onMouseUpID);
			onMouseUpID = null;
			gmxAPI._cmdProxy('stopDrawing');
			if(onMouseMoveID) gmxAPI.map.removeListener('onMouseMove', onMouseMoveID);
			onMouseMoveID = null;
			gmxAPI._drawing['activeState'] = false;
			
			isDraging = false;
			if(propsBalloon) propsBalloon.updatePropsBalloon(false);
			if(toolsContainer) toolsContainer.selectTool("move");
			eventType = 'onEdit';
			chkEvent(eventType);
			drawMe();
			return true;
		};
		//LMap.on('mouseout', mouseUp);

		var getItemDownType = function(ph)
		{
			var downType = getDownType(ph, coords, oBounds);
			return ('type' in downType ? downType : null);
		}
		ret.getItemDownType = getItemDownType;
		ret.itemMouseDown = itemMouseDown;
		
		var chkNodeEvents = function()
		{
			if(node['leaflet']) {
				needInitNodeEvents = false;
				layerGroup.on('mouseover', function(e) {
					mouseOverFlag = true;
				});
				layerGroup.on('mouseout', function(e) {
					if(propsBalloon) propsBalloon.updatePropsBalloon(false);
					if(!needMouseOver) {
						chkEvent('onMouseOut'); 
						needMouseOver = true;
					}
					mouseOverFlag = false;
				});
				layerGroup.on('click', function(e) {
					if(new Date().getTime() - downTime > 500) return;
					gmxAPI._listeners.dispatchEvent('onClick', domObj, domObj);
					gmxAPI._listeners.dispatchEvent('onClick', gmxAPI.map.drawing, domObj);
/*					var eObj = (domObj.propHiden['multiObj'] ? domObj.propHiden['multiObj'] : domObj);
					gmxAPI._listeners.dispatchEvent('onClick', eObj, eObj);
					gmxAPI._listeners.dispatchEvent('onClick', gmxAPI.map.drawing, eObj);
*/
				});
			}
		}
		var getPos = function()
		{ 
			return {'x': oBounds.minX - pointSize, 'y': oBounds.maxY - pointSize};
		}
		
		var layerGroup = null;
		var layerItems = [];
		var drawTimerID = null;
		var drawMe = function()
		{
//console.log('drawMe:  ', gmxAPI.currPosition);	// repaint vbounds
			if(!node.leaflet) {
				if(drawTimerID) clearTimeout(drawTimerID);
				drawTimerID = setTimeout(drawMe, 200);
				return;
			}
			//coords = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
			if(!layerGroup) {
				layerGroup = node.leaflet;
			}
			if(needInitNodeEvents) chkNodeEvents();
			drawAttr['mousedown'] = function(e, attr)
			{
				//if(currentDOMObject && currentDOMObject.objectId != attr['id']) return;
				if(lastPoint) addDrawingItem(e);		// Добавление точки
				else itemMouseDown(e);					// Изменение точки
			};
			drawAttr['dblclick'] = function(e, attr)		// Удаление точки
			{
				if(mouseDownTimerID) clearTimeout(mouseDownTimerID);
				var downType = getDownType(e, coords, oBounds);
				if(downType.type !== 'node') return;
				var len = coords.length - 1;
				if(editType === 'POLYGON') {
					if(downType.num == 0 && len > 0) {
						coords[len][0] = coords[1][0];
						coords[len][1] = coords[1][1];
					}
					if(len == 2) len = 0;
				} else if(editType === 'LINESTRING') {
					if(len == 1) len = 0;
				}
				if(len == 0) {
					domObj.remove();
				} else {
					coords.splice(downType.num, 1);
					drawAttr['coords'] = coords;
					drawSVG(drawAttr);
				}
			};
			drawAttr['layerGroup'] = layerGroup;
			drawAttr['layerItems'] = layerItems;
			drawAttr['lastPoint'] = lastPoint
			drawAttr['oBounds'] = oBounds, drawAttr['coords'] = coords;
			drawAttr['node'] = node;
			drawAttr['clickMe'] = addDrawingItem;
			drawAttr['mouseUp'] = mouseUp;
			drawSVG(drawAttr);
		}

		var obj = gmxAPI.map.addObject(null, null, {'subType': 'drawingFrame', 'getPos': getPos, 'drawMe': drawMe});
		node = mapNodes[obj.objectId];
		obj.setStyle(regularDrawingStyle, hoveredDrawingStyle);

		// Проверка пользовательских Listeners
		var chkEvent = function(eType, out)
		{
			if(!mousePressed && gmxAPI.map.drawing.enabledHoverBalloon) {
				var st = (out ? out : false);
				propsBalloon.updatePropsBalloon(st);
			}
			gmxAPI._listeners.dispatchEvent(eType, domObj, domObj);
			gmxAPI._listeners.dispatchEvent(eType, gmxAPI.map.drawing, domObj);
/*			var eObj = (domObj.propHiden['multiObj'] ? domObj.propHiden['multiObj'] : domObj);
			gmxAPI._listeners.dispatchEvent(eType, eObj, eObj);
			gmxAPI._listeners.dispatchEvent(eType, gmxAPI.map.drawing, eObj);
*/
		}

		ret.isVisible = (props.isVisible == undefined) ? true : props.isVisible;
		ret.setVisible = function(flag) 
		{ 
			obj.setVisible(flag); 
			ret.isVisible = flag;
		}
		ret.setVisible(ret.isVisible);

		ret.setText = function(newText)
		{
			text = props.text = newText;
			this.properties.text = text;
			//callOnChange();
		}
/*		ret.updateCoordinates = function(newCoords)
		{
			coords = newCoords;
			if(coords.length == 1) coords = coords[0];	// todo нужно дырки обрабатывать
			drawMe();
		}
*/
		ret.setStyle = function(regularStyle, hoveredStyle) {
			obj.setStyle(regularStyle, hoveredStyle);
			drawAttr['regularStyle'] = gmxAPI._leaflet['utils'].parseStyle(regularStyle, obj.objectId);
			drawAttr['hoveredStyle'] = gmxAPI._leaflet['utils'].parseStyle(hoveredStyle, obj.objectId);
			chkStyle(drawAttr, regularStyle, hoveredStyle);
			if(layerGroup) {
				layerGroup.setStyle(drawAttr['stylePolygon']);
				layerItems[1].setStyle(drawAttr['stylePoint']);
			}
		}
		ret.getVisibleStyle = function() { return obj.getVisibleStyle(); };
		ret.getStyle = function(removeDefaults) {
			return getStyle(removeDefaults, obj);
		};
		ret.stopDrawing = function() {
			if(onMouseMoveID) gmxAPI.map.removeListener('onMouseMove', onMouseMoveID); onMouseMoveID = null;
			if(onMouseUpID) gmxAPI.map.removeListener('onMouseUp', onMouseUpID); onMouseUpID = null;
			if(addItemListenerID) gmxAPI.map.removeListener('onClick', addItemListenerID); addItemListenerID = null;
			//if(itemMouseDownID) obj.removeListener('onMouseDown', itemMouseDownID); itemMouseDownID = null;
			obj.stopDrawing();
		}
	
		// Добавление точки
		var addDrawingItem = function(ph)
		{
			if(ph.attr) ph = ph.attr;
			var latlng = ph.latlng;
			var x = latlng.lng;
			if(x < -180) x += 360;
			var y = latlng.lat;
			eventType = 'onEdit';
			if (!coords) {				// Если нет coords создаем
				coords = [];
				createDrawingItem();
				gmxAPI._drawing['activeState'] = true;
				if(!onMouseMoveID) onMouseMoveID = gmxAPI.map.addListener('onMouseMove', mouseMove);
			}
			if (coords.length) {
				var point = gmxAPI._leaflet['LMap'].project(latlng);
				var pointBegin = gmxAPI._leaflet['LMap'].project(new L.LatLng(coords[0][1], coords[0][0]));
				var flag = (Math.abs(pointBegin.x - point.x) < pointSize && Math.abs(pointBegin.y - point.y) < pointSize);
				if (flag && editType === 'LINESTRING') editType = drawAttr['editType'] = 'POLYGON';

				if(!flag) {
					var tp = coords[coords.length - 1];
					pointBegin = gmxAPI._leaflet['LMap'].project(new L.LatLng(tp[1], tp[0]));
					flag = (Math.abs(pointBegin.x - point.x) < pointSize && Math.abs(pointBegin.y - point.y) < pointSize);
				}
				if (flag) {
					if(!layerItems[0]) return;
					gmxAPI.map.removeListener('onMouseMove', onMouseMoveID); onMouseMoveID = null;
					gmxAPI.map.removeListener('onClick', addItemListenerID); addItemListenerID = null;
					gmxAPI._cmdProxy('stopDrawing');
					if(editType === 'POLYGON') coords.push([coords[0][0], coords[0][1]]);
					oBounds = gmxAPI.getBounds(coords);
					lastPoint = null;
					layerItems[0]._container.style.pointerEvents = 'visibleStroke';	// после onFinish без drag карты
					if(editType === 'LINESTRING') {
						layerItems[1].options['skipLastPoint'] = false;
						//drawMe();
					}
					repaint();
					
					if(toolsContainer) toolsContainer.selectTool("move");
					eventType = 'onFinish';
					chkEvent(eventType);
//					mouseOverFlag = true;
					gmxAPI._drawing['activeState'] = false;
					finishTime = new Date().getTime();
					return true;
				}
			}
			coords.push([x, y]);
			oBounds = gmxAPI.getBounds(coords);
			repaint();
			chkEvent(eventType);
			return true;
		};
		
		// Изменение точки
		var setEditItem = function(ph)
		{
			if(!drawing.isEditable) return;
			downTime = new Date().getTime();
			if(ph.attr) ph = ph.attr;
			var x = ph.latlng.lng;
			var y = ph.latlng.lat;
			if(x < -180) x += 360;
			var downType = getDownType(ph, coords, oBounds);
			//console.log('itemMouseDown:  ', ph.latlng.lng, x);
			if('type' in downType) {
				editIndex = downType['num'];
				if(downType['type'] === 'node') {
					if(coords[editIndex][0] > 0 && x < 0) x += 360;
					coords[editIndex] = [x, y];
				} else if(downType['type'] === 'edge') {
					if(editIndex == 0 && editType === 'LINESTRING') editIndex++;
					coords.splice(editIndex, 0, [x, y]);
					if(!onMouseUpID) onMouseUpID = gmxAPI.map.addListener('onMouseUp', mouseUp);
				}
				mousePressed = true;
				repaint();
				gmxAPI._cmdProxy('startDrawing');
				gmxAPI._drawing['activeState'] = true;
				if(!onMouseMoveID) onMouseMoveID = gmxAPI.map.addListener('onMouseMove', mouseMove);
				if(propsBalloon) propsBalloon.updatePropsBalloon(false);
				return true;
			}
			return false;
		};
		var mouseDownTimerID = null;
		var itemMouseDown = function(ph)
		{
			if(mousePressed) {
				mouseUp();
				return;
			}
			//if(mouseDownTimerID) clearTimeout(mouseDownTimerID);
			//mouseDownTimerID = setTimeout(function() { setEditItem(ph);	}, 10);
			setEditItem(ph);
		}
		
		var mouseMove = function(ph)
		{
			if(ph.attr) ph = ph.attr;
			var latlng = ph.latlng;
			var x = latlng.lng;
			if(x < -180) x += 360;
			if(editIndex != -1) {
				if(!gmxAPI._leaflet['mousePressed']) { return; }
				if(!onMouseUpID) onMouseUpID = gmxAPI.map.addListener('onMouseUp', mouseUp);
				lastPoint = null;
				coords[editIndex] = [x, latlng.lat];
				if(editType === 'POLYGON') {
					if(editIndex == 0) coords[coords.length - 1] = coords[editIndex];
					else if(editIndex == coords.length - 1) coords[0] = coords[editIndex];
				}
				oBounds = gmxAPI.getBounds(coords);
			} else {
				lastPoint = {'x': x, 'y': latlng.lat};
			}
			repaint();
		}
		var repaint = function()
		{
			drawMe();
			if(domObj) {
				var type = editType;
				var geom = { 'type': type, 'coordinates': (editType === 'LINESTRING' ? coords : [coords]) };
				domObj.update(geom, text);
			}
			return false;
		}
		var zoomListenerID = gmxAPI._listeners.addListener({'eventName': 'onZoomend', 'func': repaint });
//		var positionChangedID = gmxAPI.map.addListener('positionChanged', repaint);

		ret.chkZindex = function()
		{
			if(layerGroup) layerGroup.bringToFront();
		}
		ret.remove = function()
		{
			chkEvent('onRemove');
			obj.remove();
			domObj.removeInternal();
			if(zoomListenerID) gmxAPI._listeners.removeListener(null, 'onZoomend', zoomListenerID); zoomListenerID = null;
//			if(positionChangedID) gmxAPI.map.removeListener('positionChanged', positionChangedID); positionChangedID = null;
		}
		var needMouseOver = true;
		//var itemMouseDownID = null;
		ret.chkMouse = function(ph)
		{
//console.log('chkMouse:  ', obj.objectId, mouseOverFlag);
			if(!mouseOverFlag) return false;
//console.log('chkMouse:  ', obj.objectId, mouseOverFlag);
			var downType = getDownType(ph, coords, oBounds);
			var flag = ('type' in downType ? true : false);
			//console.log('chkMouse:  ', obj.objectId, flag, ph);
			if(flag) {
				//gmxAPI._cmdProxy('startDrawing');
				//if(!itemMouseDownID) itemMouseDownID = obj.addListener('onMouseDown', itemMouseDown);
				var title = '';
				if(!mousePressed) {
					var ii = downType['num'];
					if(downType['type'] === 'node') {
						if(editType === 'LINESTRING') {
							title = gmxAPI.prettifyDistance(gmxAPI.geoLength({ type: "LINESTRING", coordinates: [coords.slice(0,ii+1)] }));
						} else if(editType === 'POLYGON') {
							title = getGeometryTitle({ type: "POLYGON", coordinates: [coords] });
						}
					} else if(downType['type'] === 'edge') {
						if(ii == 0 && editType === 'LINESTRING') return false;
						var p1 = coords[ii];
						var p2 = coords[(ii == 0 ? coords.length - 1 : ii - 1)];
						title = getGeometryTitle({ type: "LINESTRING", coordinates: [[[p1[0], p1[1]], [p2[0], p2[1]]]] });
					}
				}
				chkEvent('onMouseOver', title);
				needMouseOver = false;
			} else {
				//gmxAPI._cmdProxy('stopDrawing');
				//if(itemMouseDownID) obj.removeListener('onMouseDown', itemMouseDownID); itemMouseDownID = null;
				if(propsBalloon) propsBalloon.updatePropsBalloon(false);
				if(!needMouseOver) {
					chkEvent('onMouseOut'); 
					needMouseOver = true;
				}
			}
			return flag;
		}
		var createDrawingItem = function()
		{
			domObj = createDOMObject(ret, props, propHiden);
			domObj.objectId = obj.objectId;
			domObj['stateListeners'] = obj['stateListeners'];
			node = mapNodes[obj.objectId];
			eventType = 'onAdd';
			obj.setStyle(regularDrawingStyle, hoveredDrawingStyle);
			if(editType === 'LINESTRING') obj.setLine([[0, 0], [0, 0]]);
			else obj.setRectangle(0, 0, 0, 0);
			repaint();
		}
		
		if (coords)
		{
			if(coords.length == 1) coords = coords[0];
			if(editType === 'POLYGON') {
				if(coords.length && coords[0].length != 2) coords = coords[0];
			} else if(editType === 'LINESTRING') {
				drawAttr['setEditEnd'] = true;
			}
			drawAttr['isExternal'] = true;
			lastPoint = null;
			oBounds = gmxAPI.getBounds(coords);
			createDrawingItem();
			//mouseOverFlag = true;
			setTimeout(repaint, 10);
		} else {
			addItemListenerID = gmxAPI.map.addListener('onClick', addDrawingItem);
		}

		return ret;
	}
	drawFunctions.LINESTRING = function(coords, props, propHiden)
	{
		return editObject(coords, props, 'LINESTRING', propHiden)
	}
	drawFunctions.POLYGON = function(coords, props, propHiden)
	{
		if (gmxAPI.isRectangle(coords)) return drawFunctions.FRAME(coords, props);
		return editObject(coords, props, 'POLYGON', propHiden)
	}
	drawFunctions.FRAME = function(coords, props, propHiden)
	{
		if (!props)
			props = {};

		var text = props.text;
		if (!text)
			text = "";

		var mapNodes = gmxAPI._leaflet['mapNodes'];					// Хэш нод обьектов карты - аналог MapNodes.hx
		var drawAttr = {
			'editType': 'FRAME'
			,
			'strokeStyle': {
				'color': 'rgba(0, 0, 255, 1)'
			}
			,
			'fillStyle': {
				'color': 'rgba(255, 255, 255, 0.8)'
			}
			,
			'fillStylePolygon': {
				'color': 'rgba(255, 255, 255, 0.3)'
			}
		};
		
		var ret = {};
		var domObj;
		var propsBalloon = (gmxAPI.map.balloonClassObject ? gmxAPI.map.balloonClassObject.propsBalloon : null);
		var toolsContainer = null;
		if('_tools' in gmxAPI && 'standart' in gmxAPI._tools) {
			toolsContainer = gmxAPI._tools['standart'];
			toolsContainer.currentlyDrawnObject = ret;
		}

		var x1, y1, x2, y2;
		var deltaX = 0;
		var deltaY = 0;
		var oBounds = null;
		var isDraging = false;
		var eventType = '';

		var itemDownType = 'BottomRight';		// угол на котором мышь
		var pSize = 8;
		var lineWidth = 3;
		var pointSize = pSize / 2;
		var pCanvas = null;
		var needInitNodeEvents = true;
		
		var chkNodeEvents = function()
		{
			if(node['leaflet']) {
				needInitNodeEvents = false;
				//obj.addListener('onMouseDown', itemMouseDown);
				layerGroup.on('mouseover', function(e) {
					mouseOverFlag = true;
				});
				layerGroup.on('mouseout', function(e) {
					if(propsBalloon) propsBalloon.updatePropsBalloon(false);
					if(!needMouseOver) {
						chkEvent('onMouseOut'); 
						needMouseOver = true;
					}
					mouseOverFlag = false;
				});
				layerGroup.on('click', function(e) {
					if(new Date().getTime() - downTime > 500) return;
					gmxAPI._listeners.dispatchEvent('onClick', domObj, domObj);
					gmxAPI._listeners.dispatchEvent('onClick', gmxAPI.map.drawing, domObj);
				});
			}
		}

		var layerGroup = null;
		var layerItems = [];
		var isMouseOver = false;
		var drawTimerID = null;
		
		var drawMe = function()
		{ 
			if(!node.leaflet) {
				if(drawTimerID) clearTimeout(drawTimerID);
				drawTimerID = setTimeout(drawMe, 200);
				return;
			}
			//if(!node.leaflet) return;
			coords = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
			if(!layerGroup) {
				layerGroup = node.leaflet;
				//layerGroup.on('mouseover', function(e) { isMouseOver = true; });
			}
			if(needInitNodeEvents) chkNodeEvents();
			drawAttr['mousedown'] = itemMouseDown;
			drawAttr['layerGroup'] = layerGroup;
			drawAttr['layerItems'] = layerItems;
			drawAttr['oBounds'] = oBounds, drawAttr['coords'] = coords;
			drawAttr['node'] = node;
			drawAttr['dblclick'] = function(e, attr)		// Удаление обьекта
			{
				ret.remove();
			};
			
			drawSVG(drawAttr);
		}
		
		var getPos = function() { return {'x': x1, 'y': y1}; }
		var obj = null;
		var node = null;
		
		var created = false;
		var addItemListenerID = null;
		var onMouseMoveID = null;
		var onMouseUpID = null;
		var downTime = 0;

		var getItemDownType = function(ph)
		{
			var downType = getDownType(ph, [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]], oBounds);
			return ('type' in downType ? downType : null);
		}
		var itemMouseDown = function(e, attr)
		{
			if(currentDOMObject && currentDOMObject.objectId != attr['id']) return;
			downTime = new Date().getTime();
			if(propsBalloon) propsBalloon.updatePropsBalloon(false);
			coords = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
			var downType = getDownType(e, coords);
			if('type' in downType) {
				mousePressed = true;
				gmxAPI._cmdProxy('startDrawing');
				gmxAPI._drawing['activeState'] = true;
				if(!onMouseMoveID) onMouseMoveID = gmxAPI.map.addListener('onMouseMove', mouseMove);
				if(!onMouseUpID) onMouseUpID = gmxAPI.map.addListener('onMouseUp', mouseUp);
				var cnt = downType['num'];
				if(downType['type'] == 'edge') {
					if(cnt == 4) itemDownType = 'Left';
					else if(cnt == 2) itemDownType = 'Right';
					else if(cnt == 1) itemDownType = 'Top';
					else if(cnt == 3) itemDownType = 'Bottom';
				} else {
					if(cnt == 0) itemDownType = 'TopLeft';
					else if(cnt == 2) itemDownType = 'BottomRight';
					else if(cnt == 1) itemDownType = 'TopRight';
					else if(cnt == 3) itemDownType = 'BottomLeft';
				}
				return true;
			} else {
				return false;
			}
			return true;
		};
		
		var updatePos = function(x, y)
		{
			if(itemDownType === 'BottomRight') {
				if(y2 > y1) 		y = y1, y1 = y2, y2 = y, itemDownType = 'TopRight';
				else if(x1 > x2)	x = x1, x1 = x2, x2 = x, itemDownType = 'BottomLeft';
				else	x2 = x, y2 = y;
			}
			else if(itemDownType === 'TopRight') {
				if(y2 > y1) 		y = y1, y1 = y2, y2 = y, itemDownType = 'BottomRight';
				else if(x1 > x2) 	x = x1, x1 = x2, x2 = x, itemDownType = 'TopLeft';
				else	x2 = x, y1 = y;
			}
			else if(itemDownType === 'TopLeft') {
				if(y2 > y1) 		y = y1, y1 = y2, y2 = y, itemDownType = 'BottomLeft';
				else if(x1 > x2)	x = x1, x1 = x2, x2 = x, itemDownType = 'TopRight';
				else	x1 = x, y1 = y;
			}
			else if(itemDownType === 'BottomLeft') {
				if(y2 > y1)			y = y1, y1 = y2, y2 = y, itemDownType = 'TopLeft';
				else if(x1 > x2)	x = x1, x1 = x2, x2 = x, itemDownType = 'BottomRight';
				else	x1 = x, y2 = y;
			}
			else if(itemDownType === 'Top') {
				if(y2 > y1)			y = y1, y1 = y2, y2 = y, itemDownType = 'Bottom';
				else	y1 = y;
			}
			else if(itemDownType === 'Bottom') {
				if(y2 > y1)			y = y1, y1 = y2, y2 = y, itemDownType = 'Top';
				else	y2 = y;
			}
			else if(itemDownType === 'Right') {
				if(x1 > x2)			x = x1, x1 = x2, x2 = x, itemDownType = 'Left';
				else	x2 = x;
			}
			else if(itemDownType === 'Left') {
				if(x1 > x2)			x = x1, x1 = x2, x2 = x, itemDownType = 'Right';
				else	x1 = x;
			}
		};

		var createDrawingItem = function()
		{
			obj = gmxAPI.map.addObject(null, null, {'subType': 'drawingFrame', 'getPos': getPos, 'drawMe': drawMe});
			obj.setStyle(regularDrawingStyle, hoveredDrawingStyle);
			domObj = createDOMObject(ret, props, propHiden);
			domObj.objectId = obj.objectId;
			domObj['stateListeners'] = obj['stateListeners'];
			node = mapNodes[obj.objectId];

			eventType = 'onAdd';
			obj.setStyle(regularDrawingStyle, hoveredDrawingStyle);
			obj.setRectangle(0, 0, 0, 0);
			repaint();
			obj.addListener('onMouseDown', itemMouseDown);
			created = true;
		}
		
		var mouseMove = function(ph)
		{
			if (!mousePressed) {
				mouseUp(ph);
				return true;
			}
		
			var x = ph.attr.latlng.lng;
			var y = ph.attr.latlng.lat;
			isDraging = true;
			updatePos(x, y);
			eventType = 'onEdit';
			//console.log('mouseMove ', itemDownType, x1, y1, x2, y2);
			if (!created) createDrawingItem();
			chkEvent(eventType);
			repaint();
			return true;
		};
		
		var mouseUp = function(ph)
		{
			mousePressed = false;
			gmxAPI.map.removeListener('onMouseUp', onMouseUpID);
			onMouseUpID = null;
			gmxAPI._cmdProxy('stopDrawing');
			if(onMouseMoveID) gmxAPI.map.removeListener('onMouseMove', onMouseMoveID);
			//console.log('onMouseUp: onMouseMoveID ', x1, y1, x2, y2);
			onMouseMoveID = null;
			gmxAPI._drawing['activeState'] = false;
			
			isDraging = false;
			if(propsBalloon) propsBalloon.updatePropsBalloon(false);
			gmxAPI._setToolHandler("onMouseDown", null);
			if(toolsContainer) toolsContainer.selectTool("move");
			if(domObj) domObj.triggerInternal("onMouseUp");
			chkEvent('onFinish');
			return true;
		};
		
		// Проверка пользовательских Listeners FRAME
		var chkEvent = function(eType, out)
		{
			if(gmxAPI.map.drawing.enabledHoverBalloon && propsBalloon) {
				var st = (out ? out : false);
				propsBalloon.updatePropsBalloon(st);
			}
			gmxAPI._listeners.dispatchEvent(eType, domObj, domObj);
			gmxAPI._listeners.dispatchEvent(eType, gmxAPI.map.drawing, domObj);
			//console.log('chkEvent:  ', eType);
		}
	
		// Получить текст балуна в зависимости от типа geometry
		var getBalloonText = function(downType)
		{
			var out = '';
			if(!isDraging && propsBalloon) {
				if(gmxAPI.map.drawing.enabledHoverBalloon) {
					var geom = { type: "POLYGON", coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]] };
					if(downType['type'] == 'edge') {
						var cnt = downType['num'];
						if(cnt == 4) geom = { type: "LINESTRING", coordinates: [[[x1, y1], [x1, y2]]] };		// Left
						else if(cnt == 2) geom = { type: "LINESTRING", coordinates: [[[x2, y1], [x2, y2]]] };	// Right
						else if(cnt == 1) geom = { type: "LINESTRING", coordinates: [[[x1, y1], [x2, y1]]] };	// Top
						else if(cnt == 3) geom = { type: "LINESTRING", coordinates: [[[x1, y2], [x2, y2]]] };	// Bottom
					}
					out = getGeometryTitle(geom);
				}
			}
			return out;
		}

		var repaint = function()
		{
			//console.log('repaint:  ', domObj);
			if(domObj) {
				var geom = { type: "POLYGON", coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]] };
				domObj.update(geom, text);
			}
			drawMe();
		}
		var zoomListenerID = gmxAPI._listeners.addListener({'eventName': 'onZoomend', 'func': repaint });
		var positionChangedID = gmxAPI.map.addListener('positionChanged', repaint);
		ret.chkZindex = function()
		{
			if(layerGroup) layerGroup.bringToFront();
		}
		ret.remove = function()
		{
			//eventType = 'onRemove';
			chkEvent('onRemove');
			obj.remove();
			domObj.removeInternal();
			if(zoomListenerID) gmxAPI._listeners.removeListener(null, 'onZoomend', zoomListenerID); zoomListenerID = null;
			if(positionChangedID) gmxAPI.map.removeListener('positionChanged', positionChangedID); positionChangedID = null;
		}
		ret.stopDrawing = function() {
			if(onMouseMoveID) gmxAPI.map.removeListener('onMouseMove', onMouseMoveID); onMouseMoveID = null;
			if(onMouseUpID) gmxAPI.map.removeListener('onMouseUp', onMouseUpID); onMouseUpID = null;
			if(addItemListenerID) gmxAPI.map.removeListener('onMouseDown', addItemListenerID); addItemListenerID = null;
			gmxAPI._cmdProxy('stopDrawing');
		}

		ret.getItemDownType = getItemDownType;
		ret.isVisible = (props.isVisible == undefined) ? true : props.isVisible;
		ret.setVisible = function(flag)
		{ 
			obj.setVisible(flag); 
			ret.isVisible = flag;
		}
		ret.getStyle = function(removeDefaults) { return getStyle(removeDefaults, obj); };
		ret.setStyle = function(regularStyle, hoveredStyle) {
			obj.setStyle(regularStyle, hoveredStyle);
			drawAttr['regularStyle'] = gmxAPI._leaflet['utils'].parseStyle(regularStyle, obj.objectId);
			drawAttr['hoveredStyle'] = gmxAPI._leaflet['utils'].parseStyle(hoveredStyle, obj.objectId);
			chkStyle(drawAttr, regularStyle, hoveredStyle);
			if(layerGroup) {
				layerGroup.setStyle(drawAttr['stylePolygon']);
				layerItems[1].setStyle(drawAttr['stylePoint']);
			} else {
				drawMe();
			}
		}
		
		var needMouseOver = true;
		ret.chkMouse = function(ph)
		{
			if(!mouseOverFlag) return false;
			coords = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
			oBounds = gmxAPI.getBounds(coords);
			//console.log('chkMouse:  ', isMouseOver, ph.latlng);
			var downType = getDownType(ph, coords, oBounds);
			var flag = ('type' in downType ? true : false);
			if(flag) {
				//if(isMouseOver) {
				var txt = (mousePressed ? '' : getBalloonText(downType));
				chkEvent('onMouseOver', txt);
				//}
				needMouseOver = false;
			} else {
				if(!needMouseOver) {
					chkEvent('onMouseOut'); needMouseOver = true;
				}
			}	
			return flag;
		}
/*		ret.updateCoordinates = function(newCoords)
		{
			coords = newCoords;
			oBounds = gmxAPI.getBounds(coords);
			x1 = oBounds.minX; y1 = oBounds.maxY;	x2 = oBounds.maxX; y2 = oBounds.minY;
			repaint(10);
		}
*/
		gmxAPI._cmdProxy('startDrawing');
		if (coords)
		{
			oBounds = gmxAPI.getBounds(coords);
			x1 = oBounds.minX; y1 = oBounds.maxY;	x2 = oBounds.maxX; y2 = oBounds.minY;
			createDrawingItem();
			mouseUp();
			setTimeout(repaint, 10);
			//mouseOverFlag = true;
		} else {
			var setMouseDown = function(ph)
			{
				mousePressed = true;
				x1 = ph.attr.latlng.lng;
				y1 = ph.attr.latlng.lat;
				gmxAPI._cmdProxy('startDrawing');
				gmxAPI._drawing['activeState'] = true;
				onMouseMoveID = gmxAPI.map.addListener('onMouseMove', mouseMove);
				gmxAPI.map.removeListener('onMouseDown', addItemListenerID);
				addItemListenerID = null;
				//console.log('onMouseDown: onMouseMoveID ', x1, y1, x2, y2);
				return true;
			};
			addItemListenerID = gmxAPI.map.addListener('onMouseDown', setMouseDown);
			
			onMouseUpID = gmxAPI.map.addListener('onMouseUp', mouseUp);
		}
		return ret;
	}

	var activeListener = false;
	var zoomActive = false;
	drawFunctions.zoom = function()
	{
		gmxAPI._drawing['activeState'] = true;
		gmxAPI._drawing['BoxZoom'] = true;
		var toolsContainer = null;
		if('_tools' in gmxAPI && 'standart' in gmxAPI._tools) {
			toolsContainer = gmxAPI._tools['standart'];
		}
		gmxAPI._drawing['setMove'] = function() {
			gmxAPI._drawing['activeState'] = false;
			gmxAPI._drawing['BoxZoom'] = false;
			if(toolsContainer) toolsContainer.selectTool("move");
		}
/*
		return;
		var x1, y1, x2, y2;
		var rect;

		zoomActive = true;
		var onClick = function(attr) {
			if(!zoomActive) return false;
		
			var d = 10*gmxAPI.getScale(gmxAPI.map.getZ());
			if (!x1 || !x2 || !y1 || !y2 || ((Math.abs(gmxAPI.merc_x(x1) - gmxAPI.merc_x(x2)) < d) && (Math.abs(gmxAPI.merc_y(y1) - gmxAPI.merc_y(y2)) < d)))
				gmxAPI.map.zoomBy(1, true);
			else
				gmxAPI.map.slideToExtent(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
			//rect.remove();
			gmxAPI._listeners.dispatchEvent('onFinish', gmxAPI.map.drawing, null);
			if(toolsContainer) toolsContainer.selectTool("move");
			return true;
		};
		
		if(!activeListener) {
			gmxAPI.map.addListener('onClick', onClick);
			activeListener = true;
		}
*/		
		var ret = {
			stopDrawing: function()
			{
				//gmxAPI._setToolHandler("onMouseDown", null);
				//zoomActive = false;
				gmxAPI._drawing['activeState'] = false;
				gmxAPI._drawing['BoxZoom'] = false;
			}
		}
		return ret;
	}

	drawFunctions["move"] = function()
	{
		//gmxAPI._drawing['BoxZoom'] = false;
	}

	var chkZindexTimer = null
	var drawing = {
		handlers: { onAdd: [], onEdit: [], onRemove: [] },
		mouseState: 'up',
		activeState: false,
		isEditable: true,
		endDrawing: endDrawing,
		stateListeners: {},
		setEditable: function(flag) { drawing.isEditable = flag; },
		addListener: function(eventName, func) { return gmxAPI._listeners.addListener({'obj': this, 'eventName': eventName, 'func': func}); },
		removeListener: function(eventName, id)	{ return gmxAPI._listeners.removeListener(this, eventName, id); },
		enabledHoverBalloon: true,
		enableHoverBalloon: function()
			{
				this.enabledHoverBalloon = true;
			}
		,
		disableHoverBalloon: function()
			{
				this.enabledHoverBalloon = false;
			}
		,				
		//props опционально
		addObject: function(geom, props, propHiden)
		{
			if(!propHiden) propHiden = {};
			if(!props) props = {};
			if (geom.type.indexOf("MULTI") != -1)
			{
				if(!propHiden) propHiden = {};
				propHiden['multiFlag'] = true;
				for (var i = 0; i < geom.coordinates.length; i++)
					this.addObject(
						{ 
							type: geom.type.replace("MULTI", ""),
							coordinates: geom.coordinates[i]
						},
						props
					);
/*				
				var myId = gmxAPI.newFlashMapId();
				var fObj = {
					'geometry': geom
					,'objectId': myId
					,'properties': props
					,'propHiden':propHiden
					,'members': []
					,'forEachObject': function(callback) {
						if(!callback) return;
						for (var i = 0; i < this.members.length; i++) callback(this.members[i].domObj);
					}
					,'setStyle': function(regularStyle, hoveredStyle) {
						this.forEachObject(function(context) { context.setStyle(regularStyle, hoveredStyle); });
					}
					,'remove': function() {
						this.forEachObject(function(context) { context.remove(); });
						delete multiObjects[myId];
					}
					,'setVisible': function(flag) {
						this.forEachObject(function(context) { context.setVisible(flag); });
					}
					,'getStyle': function(flag) {
						return (this.members.length ? this.members[0].domObj.getStyle(flag) : null);
					}
					,'getGeometry': function() {
						var coords = [];
						this.forEachObject(function(context) { coords.push(context.getGeometry().coordinates); });
						this.geometry.coordinates = coords;
						return gmxAPI.clone(this.geometry);
					}
					,'updateCoordinates': function(newCoords) {
						if(newCoords.type) newCoords = newCoords.coordinates;	// Если это geometry берем только координаты
						var type = geom.type.replace("MULTI", "");
						this.geometry.coordinates = newCoords;
						var oldLen = fObj['members'].length;
						for (var i = newCoords.length; i < oldLen; i++)
						{
							fObj['members'][i].remove();
							fObj['members'].pop();
						}
						for (var i = 0; i < newCoords.length; i++)
						{
							if(i >= this['members'].length) {
								var o = drawFunctions[type](newCoords[i][0], props, propHiden);		// нужна обработка дырок в polygon обьекте
								fObj['members'].push(o);
							} else {
								fObj['members'][i].updateCoordinates(newCoords[i][0]);
							}
						}
					}
					,'getArea': function() {
						var res = 0;
						this.forEachObject(function(context) { res += context.getArea(); });
						return res;
					}
					,'getLength': function() {
						var res = 0;
						this.forEachObject(function(context) { res += context.getLength(); });
						return res;
					}
					,'getCenter': function() {
						var centers = [];
						this.forEachObject(function(context) {
							centers.push(context.getCenter());
						});
						var res = null;
						if(centers.length) {
							res = [0, 0];
							for (var i = 0; i < centers.length; i++) {
								res[0] += centers[i][0];
								res[1] += centers[i][1];
							}
							res[0] /= centers.length;
							res[1] /= centers.length;
						}
						return res;
					}
					,stateListeners: {}
					,addListener: function(eventName, func) {
						return gmxAPI._listeners.addListener({'obj': this, 'eventName': eventName, 'func': func});
					}
					,removeListener: function(eventName, id) {
						return gmxAPI._listeners.removeListener(this, eventName, id);
					}
				};
				multiObjects[myId] = fObj;
				propHiden['multiObj'] = fObj;
				var type = geom.type.replace("MULTI", "");
				for (var i = 0; i < geom.coordinates.length; i++)
				{
					var o = drawFunctions[type](geom.coordinates[i], props, propHiden);
					fObj['members'].push(o);
				}
				return fObj;
				*/
			}
			else
			{
				var o = drawFunctions[geom.type](geom.coordinates, props, propHiden);
				//gmxAPI._tools['standart'].selectTool("move");
				return o.domObj;
			}
		},
		
		//поддерживаются events: onAdd, onRemove, onEdit
		//onRemove вызывается непосредственно ПЕРЕД удалением объекта
		//для FRAME поддерживается event onMouseUp - завершение изменения формы рамки
		setHandler: function(eventName, callback)
		{
			if (!(eventName in this.handlers)) 
				this.handlers[eventName] = [];
				
			this.handlers[eventName].push(callback);
		},
		setHandlers: function(handlers)
		{
			for (var eventName in handlers)
				this.setHandler(eventName, handlers[eventName]);
		},
		forEachObject: function(callback)
		{
			if(!callback) return;
			for (var id in objects) {
				var cObj = objects[id];
				if(cObj.geometry) callback(cObj);
			}
/*			
			for (var id in objects) {
				var cObj = objects[id];
				if(cObj.geometry && !cObj.propHiden['multiFlag']) callback(cObj);
			}
			for (var id in multiObjects) {
				var cObj = multiObjects[id];
				if(cObj.geometry) callback(cObj);
			}*/
		}
		,
		tools: { 
			setVisible: function(flag) 
			{ 
				if('toolsAll' in gmxAPI.map && 'standartTools' in gmxAPI.map.toolsAll) gmxAPI.map.toolsAll.standartTools.setVisible(flag);
			}
		}
		,
		addTool: function(tn, hint, regularImageUrl, activeImageUrl, onClick, onCancel)
		{
			var ret = gmxAPI.map.toolsAll.standartTools.addTool(tn, {
				'key': tn,
				'activeStyle': {},
				'regularStyle': {},
				'regularImageUrl': regularImageUrl,
				'activeImageUrl': activeImageUrl,
				'onClick': onClick,
				'onCancel': onCancel,
				'hint': hint
			});
			return ret;
		}
		, 
		removeTool: function(tn)
		{
			if(this.tools[tn]) {
				gmxAPI.map.toolsAll.standartTools.removeTool(tn);
			}
		}
		,
		selectTool: function(toolName)
		{
			gmxAPI._tools['standart'].selectTool(toolName);
		}
		,
		getHoverItem: function(attr)
		{
			//console.log('chkMouseHover ' );
			for (var id in objects) {
				var cObj = objects[id];
				if('getItemDownType' in cObj && cObj['getItemDownType'].call(cObj, attr, cObj.getGeometry())) {
					return cObj;
				}
			}
			return null;
		}
		,
		chkMouseHover: function(attr, fName)
		{
//console.log('chkMouseHover:  ', fName, mouseOverFlag);
			if(!mouseOverFlag) return;
			if(!fName) fName = 'chkMouse';
			if(!mousePressed || attr['evName'] == 'onMouseDown') {
				for (var id in objects) {
					var cObj = objects[id];
					if(fName in cObj && cObj[fName].call(cObj, attr)) return true;
				}
			}
			return false;
		}
		,
		chkZindex: function(pid)
		{
			if(chkZindexTimer) clearTimeout(chkZindexTimer);
			chkZindexTimer = setTimeout(function()
			{
				chkZindexTimer = null;
				for (var id in objects) {
					var cObj = objects[id];
					if('chkZindex' in cObj) cObj.chkZindex();
				}
			}, 10);
		}
	}

	//расширяем namespace
    gmxAPI._drawFunctions = drawFunctions;
    gmxAPI._drawing = drawing;

})();
;/* ======================================================================
    ToolsContainer.js
   ====================================================================== */

//Управление tools контейнерами
(function()
{
	/** Класс управления tools контейнерами
	* @function
	* @memberOf api
	* @param {name} ID контейнера
	* @param {attr} Hash дополнительных атрибутов
	*		ключи:
	*			contType: Int - тип контейнера (по умолчанию 0)
	*					0 - стандартный пользовательский тип контейнера 
	*					1 - тип для drawing вкладки
	*					2 - тип для вкладки базовых подложек
	*           notSticky: 0 - по умолчанию, инструмент выключается только после повторного нажатия или выбора другого инструмента.
						   1 - автоматически выключать инструмент полсе активации
	*			properties: Hash - properties DIV контейнера (по умолчанию { 'className': 'tools_' + name })
	*			style: Hash - стили DIV контейнера (по умолчанию { 'position': "absolute", 'top': 40 })
	*			regularStyle: Hash - регулярного стиля DIV элементов в контейнере (по умолчанию { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold",	textAlign: "center", cursor: "pointer", opacity: 1, color: "wheat" })
	*			activeStyle: Hash - активного стиля DIV элементов в контейнере (по умолчанию { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold",	textAlign: "center", cursor: "pointer", opacity: 1, color: "orange" })
	*/
	function ToolsContainer(name, attr)
	{
		if(!attr) attr = {};
		var aliasNames = {};		// Hash алиасов основных подложек для map.setMode
		var toolNames = [];
		var toolHash = {};
		var activeToolName = '';
		var my = this;

		var notSticky = (attr['notSticky'] ? attr['notSticky'] : 0);
		var contType = (attr['contType'] ? attr['contType'] : 0);
		var independentFlag = (contType == 0 ? true : false);
		var notSelectedFlag = (contType != 1 ? true : false);
		var currentlyDrawnObject = false;

		if(!name) name = 'testTool';

		var properties = (attr['properties'] ? attr['properties'] : {});
		if(!properties['className']) {			// className по умолчанию tools_ИмяВкладки
			properties['className'] = 'tools_' + name;
		}

		var style = { "display": 'block', 'marginLeft': '4px', 'padding': '4px 0' };

		// Установка backgroundColor c alpha
		if(gmxAPI.isIE && document['documentMode'] < 10) {
			style['filter'] = "progid:DXImageTransform.Microsoft.gradient(startColorstr=#7F016A8A,endColorstr=#7F016A8A)";
			style['styleFloat'] = 'left';
		}
		else 
		{
			style['backgroundColor'] = "rgba(1, 106, 138, 0.5)";
			style['cssFloat'] = 'left';
		}

		if(attr['style']) {
			for(key in attr['style']) style[key] = attr['style'][key];
		}

		var toolsContHash = gmxAPI._toolsContHash;

		var gmxTools = gmxAPI.newElement('div', properties, style);
		gmxAPI._allToolsDIV.appendChild(gmxTools);
		toolsContHash[name] = gmxTools;

		// стили добавляемых юзером элементов tool
		var regularStyle = { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center", cursor: "pointer", opacity: 1, color: "wheat"	};
		if(attr['regularStyle']) {		// дополнение и переопределение стилей
			for(key in attr['regularStyle']) regularStyle[key] = attr['regularStyle'][key];
		}
		var activeStyle = { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center", cursor: "pointer", opacity: 1, color: "orange"	};
		if(attr['activeStyle']) {
			for(key in attr['activeStyle']) activeStyle[key] = attr['activeStyle'][key];
		}

		var toolsContainer = gmxAPI.newElement("table", {}, {'borderCollapse': 'collapse'});
		gmxTools.appendChild(toolsContainer);
		var tBody = gmxAPI.newElement("tbody", {}, {});
		toolsContainer.appendChild(tBody);

		var setActiveTool = function(toolName)
		{
			for (var id in toolHash) {
				var tool = toolHash[id];
				if (tool)  {
					tool.isActive = (id == toolName ? true : false);
				}
			}
			my.activeToolName = activeToolName = toolName;
			this.repaint();			
		}
		this.setActiveTool = setActiveTool;
		
		var selectTool = function(toolName)
		{
			if (name == 'standart') {	// только для колонки 'standart'
				if (toolName == activeToolName) toolName = (toolNames.length > 0 ? toolNames[0] : '');	// если toolName совпадает с активным tool переключаем на 1 tool

				// При draw обьектов
				if (currentlyDrawnObject && 'stopDrawing' in currentlyDrawnObject) {
					currentlyDrawnObject.stopDrawing();
				}
				currentlyDrawnObject = false;
			}

			var oldToolName = activeToolName;
			var tool = toolHash[oldToolName];


			if (tool && contType != 0) {
				if ('onCancel' in tool) tool.onCancel();
				tool.repaint();
			}

			activeToolName = (notSelectedFlag && toolName == oldToolName ? '' : toolName);

			tool = toolHash[toolName];
			if(tool) {
				if (contType == 0) {								// для добавляемых юзером меню
					if (tool.isActive) {
						if ('onCancel' in tool) tool.onCancel();
					} else {
						if ('onClick' in tool) tool.onClick();
					}
					tool.repaint();
				} else if (contType == 1) {							// тип для drawing
					if ('onClick' in tool) {
						currentlyDrawnObject = tool.onClick();
						tool.repaint();
					} else {
						currentlyDrawnObject = false;
					}
				} else if (contType == 2) {							// тип для подложек
					if ('onClick' in tool && toolName != oldToolName) {
						tool.onClick();
						tool.repaint();
					}
				}
				
				if (notSticky == 1){
					// Если интструмент включен, сразу же выключите его.
					if (tool.isActive) {
						if ('onCancel' in tool) tool.onCancel();
						tool.isActive = false;
					}
				}
			}
		}
		this.selectTool = selectTool;
		
		function forEachObject(callback)
		{
			for (var id in toolHash)
				callback(toolHash[id]);
		}
		this.forEachObject = forEachObject;

		function getToolByName(tn)
		{
			if(!toolHash[tn]) return false;
			
			return toolHash[tn];
		}
		this.getToolByName = getToolByName;
		
		function setVisible(flag)
		{
			gmxAPI.setVisible(gmxTools, flag);
			this.isVisible = flag;
		}
		this.setVisible = setVisible;

		function repaint()
		{
			for (var id in toolHash) {
				var tool = toolHash[id];
				if (tool)  {
					tool.repaint();
				}
			}
		}
		this.repaint = repaint;
		function updateVisibility()
		{
		}
		this.updateVisibility = updateVisibility;

		function remove()
		{
			gmxAPI._allToolsDIV.removeChild(gmxTools);
		}
		this.remove = remove;

		function chkBaseLayerTool(tn, attr)
		{
			if (toolHash[tn]) return false;
			else {
				if(!attr)  {
					attr = {
						'onClick': function() { gmxAPI.map.setBaseLayer(tn); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'hint': tn
					};
				}
				return addTool(tn, attr);
			}

		}
		this.chkBaseLayerTool = chkBaseLayerTool;

		function getAlias(tn)
		{
			return aliasNames[tn] || tn;
		}
		this.getAlias = getAlias;

		function addTool(tn, attr)
		{
			var tr = gmxAPI.newElement("tr", {	"className": 'tools_tr_' + name + '_' + tn	});
			tBody.appendChild(tr);
			var td = gmxAPI.newElement("td", null, { padding: "4px", cursor: "pointer" });		// { padding: "4px", textAlign: "center" }
			tr.appendChild(td);

			var elType = 'img';
			var elAttr = {
				title: attr['hint'],
				onclick: function() { selectTool(tn); }
			};
			if(attr['alias']) {
				aliasNames[attr['alias']] = tn;
			}
			
			var setStyle = function(elem, style) {
				for (var key in style)
				{
					var value = style[key];
					elem.style[key] = value;
					if (key == "opacity") elem.style.filter = "alpha(opacity=" + Math.round(value*100) + ")";
				}
			}

			var myActiveStyle = (attr.activeStyle ? attr.activeStyle : activeStyle);
			var myRegularStyle = (attr.regularStyle ? attr.regularStyle : regularStyle);
			var repaintFunc = null;
			if('regularImageUrl' in attr) {
				elAttr['onmouseover'] = function()	{ this.src = attr['activeImageUrl']; };
				repaintFunc = function(obj) { obj.src = (tn == activeToolName) ? attr['activeImageUrl'] : attr['regularImageUrl'];	};
				elAttr['src'] = attr['regularImageUrl'];
			} else {
				elType = 'div';
				repaintFunc = function(obj) {
					setStyle(obj, (toolHash[tn].isActive ? myActiveStyle : myRegularStyle));
					};
				elAttr['onmouseover'] = function()	{
					setStyle(this, (toolHash[tn].isActive ? myActiveStyle : myRegularStyle));
				};
				elAttr['innerHTML'] = attr['hint'];
			}
			elAttr['onmouseout'] = function()	{
				repaintFunc(this);
			};
			var control = gmxAPI.newElement( elType, elAttr, myRegularStyle);	// tool элемент 

			toolHash[tn] = {
				key: tn,
				backgroundColor: attr['backgroundColor'],
				isActive: false,
				isVisible: true,
				control: control,
				line: tr,
				setVisible: function(flag) {
					this.isVisible = flag;
					var st = 'visible';
					if(flag) {
						tr.style.display = '';
						tr.style.visibility = 'visible';
					} else {
						tr.style.display = 'none';
						tr.style.visibility = 'hidden';
					}
				},
				setToolImage: function(a1, a2) {},
				repaint: function()	{
					repaintFunc(this.control);
					},
				onClick: function()	{
					this.isActive = true;
					my.activeToolName = activeToolName = tn;
					return attr['onClick'].call();
					},
				onCancel: function()	{
					this.isActive = false;
					my.activeToolName = activeToolName = '';
					attr['onCancel'].call();
					},
				select: function() { selectTool(tn); }
			}
			
			td.appendChild(control);

			var pos = (attr['pos'] > 0 ? attr['pos'] : toolNames.length);
			toolNames.splice(pos, 0, tn);
			//positionTools();
			if(!gmxAPI._drawing.tools[tn]) gmxAPI._drawing.tools[tn] = toolHash[tn];
			return toolHash[tn];
		}
		this.addTool = addTool;

		function getToolIndex(tn)
		{
			for (var i = 0; i<toolNames.length; i++)
			{
				if(tn === toolNames[i]) return i;
			}
			return -1;
		}
		this.getToolIndex = getToolIndex;

		function removeTool(tn)
		{
			var num = getToolIndex(tn);
			if(num === -1 || !toolHash[tn]) return false;
			toolNames.splice(num, 1);
			tBody.removeChild(toolHash[tn]['line']);
			delete toolHash[tn];
			if(gmxAPI._drawing.tools[tn]) delete gmxAPI._drawing.tools[tn];
			return true;
		}
		this.removeTool = removeTool;

		function setToolIndex(tn, ind)
		{
			var num = getToolIndex(tn);
			if(num === -1 || !toolHash[tn]) return false;
			toolNames.splice(num, 1);

			var hash = toolHash[tn];
			var obj = tBody.removeChild(hash['line']);

			var len = tBody.children.length;
			if(ind >= len) ind = len - 1;
			
			toolHash[tn]['line'] = tBody.insertBefore(obj, tBody.children[ind]);
			toolNames.splice(i, 0, tn);
			return true;
		}
		this.setToolIndex = setToolIndex;

		
		this.currentlyDrawnObject = currentlyDrawnObject;
		this.activeToolName = activeToolName;
		this.isVisible = true;

		if(!gmxAPI._tools) gmxAPI._tools = {};
		gmxAPI._tools[name] = this;
	}
	//расширяем namespace
    gmxAPI._ToolsContainer = ToolsContainer;
})();
;/* ======================================================================
    ToolsAll.js
   ====================================================================== */

//Управление ToolsAll
(function()
{
	/** Класс управления ToolsAll
	* @function
	* @memberOf api
	* @param {cont} HTML контейнер для tools
	*/
	function ToolsAll(cont)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var toolsContHash = {};
		var objects = {};
		var currentlyDrawnObject = false;
		var activeToolName = false;
		var toolControls = {};

		var toolPlaqueX = 355;
		var toolPlaqueY = 40;
		var toolSize = 24;
		var toolPadding = 4;
		var toolSpacing = 8;

		var toolsAllCont = gmxAPI.newStyledDiv({ position: "absolute", top: '40px', left: 0, height: '1px', marginLeft: '1px' });
		cont.appendChild(toolsAllCont);
		gmxAPI._allToolsDIV = toolsAllCont;

		this.toolsAllCont = toolsAllCont;
		gmxAPI._toolsContHash = toolsContHash;

		var toolsMinimized;
		var toolPlaqueControl = gmxAPI.newElement(
			"img",
			{
				onclick: function()
				{
					if (toolsMinimized)
						gmxAPI.map.maximizeTools();
					else
						gmxAPI.map.minimizeTools();
				},
				onmouseover: function()
				{
					if (toolsMinimized)
						this.src = apiBase + "img/tools_off_a.png";
					else
						this.src = apiBase + "img/tools_on_a.png";
				},
				onmouseout: function()
				{
					if (toolsMinimized)
						this.src = apiBase + "img/tools_off.png";
					else
						this.src = apiBase + "img/tools_on.png";
				}
			},
			{
				position: "absolute",
				left: "8px",
				top: "8px",
				cursor: "pointer"
			}
		);
		
		var toolPlaqueBackground = gmxAPI.newStyledDiv({
			position: "absolute",
			left: "5px",
			top: "5px",
			width: "32px",
			height: "32px",
			backgroundColor: "#016a8a",
			opacity: 0.5
		});
		gmxAPI._div.appendChild(toolPlaqueBackground);
		gmxAPI._div.appendChild(toolPlaqueControl);

		gmxAPI.map.isToolsMinimized = function()
		{
			return toolsMinimized;
		}
		gmxAPI.map.minimizeTools = function()
		{
			toolsMinimized = true;
			toolPlaqueControl.src = apiBase + "img/tools_off.png";
			toolPlaqueControl.title = gmxAPI.KOSMOSNIMKI_LOCALIZED("Показать инструменты", "Show tools");
			gmxAPI.setVisible(toolsAllCont, false);
			gmxAPI._listeners.dispatchEvent('onToolsMinimized', gmxAPI.map, toolsMinimized);
		}
		gmxAPI.map.maximizeTools = function()
		{
			toolsMinimized = false;
			toolPlaqueControl.src = apiBase + "img/tools_on.png";
			toolPlaqueControl.title = gmxAPI.KOSMOSNIMKI_LOCALIZED("Скрыть инструменты", "Hide tools");
			gmxAPI.setVisible(toolsAllCont, true);
			gmxAPI._listeners.dispatchEvent('onToolsMinimized', gmxAPI.map, toolsMinimized);
		}
		gmxAPI.map.maximizeTools();

		gmxAPI.map.allControls = {
			div: toolsAllCont,
			setVisible: function(flag)
			{
				gmxAPI.setVisible(toolPlaqueBackground, flag);
				gmxAPI.setVisible(toolPlaqueControl, flag);
				gmxAPI.setVisible(gmxAPI._allToolsDIV, flag);
			},
			minimize: gmxAPI.map.minimizeTools,
			maximize: gmxAPI.map.maximizeTools
		}

		if('_ToolsContainer' in gmxAPI) {
			if(gmxAPI._drawFunctions) {
				var attr = {
					'properties': { 'className': 'gmxTools' }
					,
					'style': { }
					,
					'regularStyle': {
						paddingTop: "0px", 
						paddingBottom: "0px", 
						paddingLeft: "0px", 
						paddingRight: "0px", 
						fontSize: "12px",
						fontFamily: "sans-serif",
						fontWeight: "bold",
						textAlign: "center",
						cursor: "pointer", 
						opacity: 1, 
						color: "wheat"
					}
					,
					'activeStyle': {
						paddingTop: "0px", 
						paddingBottom: "0px", 
						paddingLeft: "0px", 
						paddingRight: "0px", 
						fontSize: "12px",
						fontFamily: "sans-serif",
						fontWeight: "bold",
						textAlign: "center",
						cursor: "pointer", 
						opacity: 1, 
						color: 'orange'
					}
					,
					'contType': 1	// режим для drawing tools
				};
				var standartTools = new gmxAPI._ToolsContainer('standart', attr);
				var arr = [
					{
						'key': "move",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/move_tool.png",
						'activeImageUrl': apiBase + "img/move_tool_a.png",
						'onClick': gmxAPI._drawFunctions['move'],
						'onCancel': function() {},
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Перемещение", "Move")
					}
					,
					{
						'key': "zoom",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/select_tool.png",
						'activeImageUrl': apiBase + "img/select_tool_a.png",
						'onClick': gmxAPI._drawFunctions['zoom'],
						'onCancel': function() {},
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Увеличение", "Zoom")
					}
					,
					{
						'key': "POINT",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/marker_tool.png",
						'activeImageUrl': apiBase + "img/marker_tool_a.png",
						'onClick': gmxAPI._drawFunctions['POINT'],
						'onCancel': gmxAPI._drawing.endDrawing,
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Маркер", "Marker")
					}
					,
					{
						'key': "LINESTRING",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/line_tool.png",
						'activeImageUrl': apiBase + "img/line_tool_a.png",
						'onClick': gmxAPI._drawFunctions['LINESTRING'],
						'onCancel': gmxAPI._drawing.endDrawing,
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Линия", "Line")
					}
					,
					{
						'key': "POLYGON",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/polygon_tool.png",
						'activeImageUrl': apiBase + "img/polygon_tool_a.png",
						'onClick': gmxAPI._drawFunctions['POLYGON'],
						'onCancel': gmxAPI._drawing.endDrawing,
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Полигон", "Polygon")
					}
					,
					{
						'key': "FRAME",
						'activeStyle': {},
						'regularStyle': {},
						'regularImageUrl': apiBase + "img/frame_tool.png",
						'activeImageUrl': apiBase + "img/frame_tool_a.png",
						'onClick': gmxAPI._drawFunctions['FRAME'],
						'onCancel': gmxAPI._drawing.endDrawing,
						'hint': gmxAPI.KOSMOSNIMKI_LOCALIZED("Рамка", "Rectangle")
					}
				];
				for(var i=0; i<arr.length; i++) {
					var ph = arr[i]['key']
					standartTools.addTool(arr[i]['key'], arr[i]);
				}
				standartTools.selectTool("move");
				this.standartTools = standartTools;
			}

			var regularStyle = {
				paddingTop: "4px", 
				paddingBottom: "4px", 
				paddingLeft: "10px", 
				paddingRight: "10px", 
				fontSize: "12px",
				fontFamily: "sans-serif",
				fontWeight: "bold",
				textAlign: "center",
				cursor: "pointer", 
				opacity: 1, 
				color: "white"
			};
			var activeStyle = {
				paddingTop: "4px", 
				paddingBottom: "4px", 
				paddingLeft: "10px", 
				paddingRight: "10px", 
				fontSize: "12px",
				fontFamily: "sans-serif",
				fontWeight: "bold",
				textAlign: "center",
				cursor: "pointer", 
				opacity: 1, 
				color: 'orange'
			};
			var attr = {
				'properties': { 'className': 'gmxTools' }
				,
				'style': { }
				,
				'regularStyle': regularStyle
				,
				'activeStyle': activeStyle
				,
				'contType': 2	// режим отключения выбора item
			};

			var baseLayersTools = new gmxAPI._ToolsContainer('baseLayers', attr);
			gmxAPI.baseLayersTools = baseLayersTools;
			gmxAPI.map.addListener('baseLayerSelected', function(ph)
				{
					baseLayersTools.setActiveTool(ph);
				}
			);

			this.baseLayersTools = baseLayersTools;
			gmxAPI.map.baseLayersTools = baseLayersTools;
			gmxAPI.map.standartTools = standartTools;
		}
	}
    gmxAPI._ToolsAll = ToolsAll;
})();
;/* ======================================================================
    Temporal.js
   ====================================================================== */

//Управление временными тайлами
(function()
{
	var TemporalTiles =	function(obj_)		// атрибуты временных тайлов
	{
		var mapObj = obj_;	// Мультивременной слой
		var prop = mapObj.properties;	// Свойства слоя от сервера
		var TimeTemporal = true;		// Добавлять время в фильтры - пока только для поля layer.properties.TemporalColumnName == 'DateTime'

		var oneDay = 1000*60*60*24;	// один день
		var temporalData = null;
		var currentData = {};		// список тайлов для текущего daysDelta
		var ZeroDateString = prop.ZeroDate || '01.01.2008';	// нулевая дата
		var arr = ZeroDateString.split('.');
		var zn = new Date(					// Начальная дата
			(arr.length > 2 ? arr[2] : 2008),
			(arr.length > 1 ? arr[1] - 1 : 0),
			(arr.length > 0 ? arr[0] : 1)
			);
		var ZeroDate = new Date(zn.getTime()  - zn.getTimezoneOffset()*60000);	// UTC начальная дата шкалы

		var hostName = prop.hostName || 'maps.kosmosnimki.ru';
		var baseAddress = "http://" + hostName + "/";
		var layerName = prop.name || prop.image;
		var sessionKey = isRequiredAPIKey( hostName ) ? window.KOSMOSNIMKI_SESSION_KEY : false;
		var sessionKey2 = ('sessionKeyCache' in window ? window.sessionKeyCache[prop.mapName] : false);
		var prefix = baseAddress + 
				"TileSender.ashx?ModeKey=tile" + 
				"&MapName=" + prop.mapName + 
				"&LayerName=" + layerName + 
				(sessionKey ? ("&key=" + encodeURIComponent(sessionKey)) : "") +
				(sessionKey2 ? ("&MapSessionKey=" + sessionKey2) : "");
		if(prop._TemporalDebugPath) {
			prefix = prop._TemporalDebugPath;
			//temporalData['_TemporalDebugPath'] = prop._TemporalDebugPath;
		}
		var identityField = prop.identityField;
		var TemporalColumnName = prop.TemporalColumnName || 'Date';
		
		// Начальный интервал дат
		var DateEnd = new Date();
		if(prop.DateEnd) {
			var arr = prop.DateEnd.split('.');
			if(arr.length > 2) DateEnd = new Date(arr[2], arr[1] - 1, arr[0]);
		}
		var DateBegin = new Date(DateEnd - oneDay);
			
			
		// Формирование Hash списка версий тайлов мультивременного слоя
		function getTilesHash(prop, ph)
		{
			var tdata = prpTemporalTiles(prop.TemporalTiles, prop.TemporalVers, ph);
			var currentData = this.temporalData.currentData;
			var data = getDateIntervalTiles(currentData['dt1'], currentData['dt2'], tdata);

			var out = {'hash':{}, 'del': {}, 'add': [], 'count': 0 };
			var ptAdd = {};
			for (var key in data['TilesVersionHash']) {
				if(!currentData['TilesVersionHash'][key]) {
					var arr = key.split('_');
					var st = arr[0] + '_' + arr[1] + '_' + arr[2];
					ptAdd[st] = true;
					out['del'][arr[2] + '_' + arr[0] + '_' + arr[1]] = true;
				}
			}
			for (var key in currentData['TilesVersionHash']) {
				if(!data['TilesVersionHash'][key]) {
					var arr = key.split('_');
					out['del'][arr[2] + '_' + arr[0] + '_' + arr[1]] = true;
				}
			}
			for (var key in ptAdd) {
				var arr = key.split('_');
				out['add'].push([arr[0], arr[1], arr[2]]);
			}
			out['count'] = data['dtiles'].length / 3;
			out['dtiles'] = data['dtiles'];
			out['ut1'] = data['ut1'];
			out['ut2'] = data['ut2'];
			this.temporalData = tdata;						// Обновление temporalData
			this.temporalData['currentData'] = data;
			return out;
		}
		this.getTilesHash = getTilesHash;

		function prpTemporalTiles(data, vers) {
			var deltaArr = [];			// интервалы временных тайлов [8, 16, 32, 64, 128, 256]
			var deltaHash = {};
			var ph = {};
			var arr = [];
			if(!vers) vers = [];
			if(!data) data = [];
			for (var nm=0; nm<data.length; nm++)
			{
				arr = data[nm];
				if(!arr || !arr.length || arr.length < 5) {
					gmxAPI.addDebugWarnings({'func': 'prpTemporalTiles', 'layer': prop.title, 'alert': 'Error in TemporalTiles array - line: '+nm+''});
					continue;
				}
				var v = vers[nm] || 0;
				var z = arr[4];
				if(z < 1) continue;
				var i = arr[2];
				var j = arr[3];
				if(!ph[z]) ph[z] = {};
				if(!ph[z][i]) ph[z][i] = {};
				if(!ph[z][i][j]) ph[z][i][j] = [];
				ph[z][i][j].push(arr);

				if(!deltaHash[arr[0]]) deltaHash[arr[0]] = {};
				if(!deltaHash[arr[0]][arr[1]]) deltaHash[arr[0]][arr[1]] = [];
				deltaHash[arr[0]][arr[1]].push([i, j, z, v]);
			}
			var arr = [];
			for (var z in ph)
				for (var i in ph[z])
					for (var j in ph[z][i])
						arr.push(i, j, z);
			
			for (var delta in deltaHash) deltaArr.push(parseInt(delta));
			deltaArr = deltaArr.sort(function (a,b) { return a - b;});
			return {'dateTiles': arr, 'hash': ph, 'deltaHash': deltaHash, 'deltaArr': deltaArr};
		}

		temporalData = prpTemporalTiles(prop.TemporalTiles, prop.TemporalVers);

		this.temporalData = temporalData;


		var prpTemporalFilter = function(DateBegin, DateEnd, columnName)	// Подготовка строки фильтра
		{
			var dt1 = DateBegin;		// начало периода
			var dt2 = DateEnd;			// конец периода
			return {
				'dt1': dt1
				,'dt2': dt2
				,'ut1': Math.floor(dt1.getTime() / 1000)
				,'ut2': Math.floor(dt2.getTime() / 1000)
			};
		}

		var getDateIntervalTiles = function(dt1, dt2, tdata) {			// Расчет вариантов от begDate до endDate
			var days = parseInt(1 + (dt2 - dt1)/oneDay);
			var minFiles = 1000;
			var outHash = {};

			//var _TemporalDebugPath = tdata['_TemporalDebugPath'];

			function getFiles(daysDelta) {
				var ph = {'files': [], 'dtiles': [], 'tiles': {}, 'TilesVersionHash': {}, 'out': ''};
				var mn = oneDay * daysDelta;
				var zn = parseInt((dt1 - ZeroDate)/mn);
				ph['beg'] = zn;
				ph['begDate'] = new Date(ZeroDate.getTime() + daysDelta * zn * oneDay);
				zn = parseInt(zn);
				var zn1 = Math.floor((dt2 - ZeroDate)/mn);
				ph['end'] = zn1;
				ph['endDate'] = new Date(ZeroDate.getTime() + daysDelta * oneDay * (zn1 + 1) - 1000);
				zn1 = parseInt(zn1);
				
				var dHash = tdata['deltaHash'][daysDelta] || {};
				for (var dz in dHash) {
					if(dz < zn || dz > zn1) continue;
					var arr = dHash[dz] || [];
					for (var i=0; i<arr.length; i++)
					{
						var pt = arr[i];
						var x = pt[0];
						var y = pt[1];
						var z = pt[2];
						var v = pt[3];
						var file = prefix + "&Level=" + daysDelta + "&Span=" + dz + "&z=" + z + "&x=" + x + "&y=" + y + "&v=" + v;
						//if(_TemporalDebugPath) file = _prefix + daysDelta + '/' + dz + '/' + z + '/' + x + '/' + z + '_' + x + '_' + y + '.swf'; // тайлы расположены в WEB папке
						if(!ph['tiles'][z]) ph['tiles'][z] = {};
						if(!ph['tiles'][z][x]) ph['tiles'][z][x] = {};
						if(!ph['tiles'][z][x][y]) ph['tiles'][z][x][y] = [];
						ph['tiles'][z][x][y].push(file);
						ph['files'].push(file);
						var st = x + '_' + y + '_' + z + '_' + daysDelta + '_' + dz + '_' + v;
						ph['TilesVersionHash'][st] = true;
					}
				}
				
				var arr = [];
				for (var z in ph['tiles'])
					for (var i in ph['tiles'][z])
						for (var j in ph['tiles'][z][i])
							arr.push(i, j, z);
				ph['dtiles'] = arr;
				return ph;
			}

			var deltaArr = tdata['deltaArr'];
			var i = deltaArr.length - 1;
			var curDaysDelta = deltaArr[i];
			while (i>=0)
			{
				curDaysDelta = deltaArr[i];
				if(days >= deltaArr[i]) {
					break;
				}
				i--;
			}
			var ph = getFiles(curDaysDelta);
			minFiles = ph['files'].length;

			var hash = prpTemporalFilter(dt1, dt2, TemporalColumnName);
			
			var tileDateFunction = function(i, j, z)
			{ 
				var filesHash = ph['tiles'] || {};
				var outArr = [];
				if(filesHash[z] && filesHash[z][i] && filesHash[z][i][j]) {
					outArr = filesHash[z][i][j];
				}
				return outArr;
			}

			var out = {
					'daysDelta': curDaysDelta
					,'files': ph['files']
					,'tiles': ph['tiles']
					,'dtiles': ph['dtiles'] || []		// список тайлов для daysDelta
					,'out': ph['out']
					,'beg': ph['beg']
					,'end': ph['end']
					,'begDate': ph['begDate']
					,'endDate': ph['endDate']
					,'ut1': hash['ut1']
					,'ut2': hash['ut2']
					,'dt1': dt1
					,'dt2': dt2
					,'tileDateFunction': tileDateFunction
					,'TilesVersionHash': ph['TilesVersionHash']
				};

			return out;
		}
		this.getDateIntervalTiles = getDateIntervalTiles;

		var ddt1 = new Date(); ddt1.setHours(0, 0, 0, 0);		// начало текущих суток
		ddt1 = new Date(ddt1.getTime() - ddt1.getTimezoneOffset()*60000);	// UTC начальная дата
		var ddt2 = new Date(); ddt2.setHours(23, 59, 59, 999);	// конец текущих суток
		ddt2 = new Date(ddt2.getTime() - ddt2.getTimezoneOffset()*60000);	// UTC
		temporalData['currentData'] = getDateIntervalTiles(ddt1, ddt2, temporalData);	// По умолчанию за текущие сутки

		// 
		var me = this;
		
		var setDateInterval = function(dt1, dt2, tdata)
		{
			if(!tdata) tdata = mapObj._temporalTiles.temporalData;
			var currentData = tdata['currentData'];
			if(!dt1) {
				dt1 = currentData['dt1'];
			} else {
				currentData['dt1'] = dt1; 
			}
			if(!dt2) {
				dt2 = currentData['dt2'];
			} else {
				currentData['dt2'] = dt2; 
			}

			var oldDt1 = currentData['begDate'];
			var oldDt2 = currentData['endDate'];
			var oldDaysDelta = currentData['daysDelta'];

			var hash = prpTemporalFilter(dt1, dt2, TemporalColumnName);
			var ddt1 = hash['dt1'];
			var ddt2 = hash['dt2'];
			var data = getDateIntervalTiles(ddt1, ddt2, tdata);
			tdata['currentData'] = data;
			//mapObj._temporalTiles.temporalData['currentData'] = data;
			if(!mapObj.isVisible) return;

			var attr = {
				'dtiles': (data['dtiles'] ? data['dtiles'] : []),
				'ut1': data['ut1'],
				'ut2': data['ut2']
			};
			if(oldDaysDelta == data['daysDelta'] && data['dt1'] >= oldDt1 && data['dt2'] <= oldDt2) {
						// если интервал временных тайлов не изменился и интервал дат не расширяется - только добавление новых тайлов 
				attr['notClear'] = true;
			} else {
				if(mapObj.tilesParent) {
					mapObj.tilesParent.clearItems();
				}
			}

			resetTiles(attr, mapObj);
			gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {'from':mapObj.objectId});	// Проверка map Listeners на hideBalloons
			return data['daysDelta'];
		}
		this.setDateInterval = setDateInterval;
		
		var tileDateFunction = function(i, j, z)
		{ 
			var tdata = mapObj._temporalTiles.temporalData;
			var currentData = tdata['currentData']
			var filesHash = currentData['tiles'] || {};
			var outArr = [];
			if(filesHash[z] && filesHash[z][i] && filesHash[z][i][j]) {
				outArr = filesHash[z][i][j];
			}
			return outArr;
		}
		var setVectorTiles = function()
		{
			var tdata = mapObj._temporalTiles.temporalData;
			var currentData = tdata['currentData']
			var ph = {
				'tileDateFunction': tileDateFunction,
				'dtiles': (currentData['dtiles'] ? currentData['dtiles'] : []),
				'temporal': {
					'TemporalColumnName': TemporalColumnName
					,'ut1': currentData['ut1']
					,'ut2': currentData['ut2']
				}
			};
			mapObj.setVectorTiles(ph['tileDateFunction'], identityField, ph['dtiles'], ph['temporal']);
		}
		this.setVectorTiles = setVectorTiles;

		startLoadTiles = function(attr, obj) {
			var ret = gmxAPI._cmdProxy('startLoadTiles', { 'obj': obj, 'attr':attr });
			return ret;
		}

		this.ut1Prev = 0;
		this.ut2Prev = 0;
		resetTiles = function(attr, obj) {
			if(attr) {
				startLoadTiles(attr, obj);
				if(attr.ut1 == obj._temporalTiles.ut1Prev && attr.ut2 == obj._temporalTiles.ut2Prev) return;
				obj._temporalTiles.ut1Prev = attr.ut1;
				obj._temporalTiles.ut2Prev = attr.ut2;
			}
			for (var i=0; i<obj.filters.length; i++)	{ // переустановка фильтров
				var filt = obj.filters[i];
				if(filt && 'setFilter' in filt) filt.setFilter(filt._sql, true);
			}
		}

		//расширяем FlashMapObject
		gmxAPI.extendFMO('setDateInterval', function(dt1, dt2) {
//console.log('setDateInterval : ' , dt1 , ' : ' , dt2);
			if(!this._temporalTiles) return false;
			var tdata = this._temporalTiles.temporalData;
			this._temporalTiles.setDateInterval(dt1, dt2, tdata);
			if(!this.isVisible) {
				delete tdata.currentData['begDate'];
				delete tdata.currentData['endDate'];
			}
			gmxAPI._listeners.dispatchEvent('onChangeDateInterval', this, {'ut1':dt1, 'ut2':dt2});	// Изменился календарик
		});

		gmxAPI.extendFMO('getTileCounts', function(dt1, dt2) {
			if(this.properties.type !== 'Vector') return 0;
			var tdata = this.properties.tiles;
			var thash = null;
			if(this._temporalTiles) {
				var pt = this._temporalTiles.getDateIntervalTiles(dt1, dt2, this._temporalTiles.temporalData);
				tdata = pt['dtiles'];
				thash = pt['tiles'];
			}
			return gmxAPI.filterVisibleTiles(tdata, thash);
		});
		
		// Добавление прослушивателей событий
		mapObj.addListener('onChangeVisible', function(flag)
			{
				if(flag) me.setDateInterval();
				//gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {'from':mapObj.objectId});	// Проверка map Listeners на hideBalloons
			}
		);
		mapObj.addListener('onLayer', function(obj)
			{
				var currentData = obj._temporalTiles.temporalData.currentData;
				obj.setDateInterval(currentData.dt1, currentData.dt2);
			}
		);
		
	}
	//расширяем namespace
    gmxAPI._TemporalTiles = TemporalTiles;
})();
;/* ======================================================================
    Clusters.js
   ====================================================================== */

//Управление клиентской кластеризацией 
(function()
{
	var countKeyName = gmxAPI.KOSMOSNIMKI_LOCALIZED("Количество", "Count");
	var RenderStyle = {		// стили кластеров
		marker: { image: 'http://images.kosmosnimki.ru/clusters/cluster_circ.png', center: true, minScale: 0.5, maxScale: 2, scale: '['+countKeyName+']/50' },
		label: { size: 12, align:'center', color: 0xff00ff, haloColor: 0xffffff, value:'[Метка]', field: countKeyName }
	};
	var HoverStyle = {		// стили кластеров при наведении
		marker: { image: 'http://images.kosmosnimki.ru/clusters/cluster_circ_hov.png', center: true, minScale: 0.5, maxScale: 2, scale: '['+countKeyName+']/50' },
		label: { size: 12, align:'center', color: 0xff0000, haloColor: 0xffffff, value:'[Метка]', field: countKeyName }
	};

	var newProperties = {						// Заполняемые поля properties кластеров
	};
	newProperties[countKeyName] = '[objectInCluster]';	// objectInCluster - количество обьектов попавших в кластер (по умолчанию 'Количество')

	var defaultAttr = {
		'radius': 20,
		'iterationCount': 1,
		'newProperties': newProperties,			// Заполняемые поля properties кластеров
		'RenderStyle': RenderStyle,				// стили кластеров
		'HoverStyle': HoverStyle,				// стили кластеров при наведении
		'clusterView': {},						// Атрибуты отображения членов кластера (при null не отображать)
		'visible': false
	};
	
	var _chkAttr = function(data)
	{
		if(data['radius'] < 1) data['radius'] = 20;
		if(!data['RenderStyle']) data['RenderStyle'] = RenderStyle;
		if(!data['HoverStyle']) data['HoverStyle'] = HoverStyle;
		if(!data['clusterView']) data['clusterView'] = {};
		if(!data['newProperties']) data['newProperties'] = newProperties;
		return data;
	}

	var Clusters =	function(parent)		// атрибуты кластеризации потомков
	{
		this._parent = parent;
		this._attr = gmxAPI.clone(defaultAttr);

		// Добавление прослушивателей событий
		var me = this;
		var evID = null;
		var chkFilter = function(data)
		{
			if(evID) parent.parent.removeListener('onLayer', evID);
			var filter = me._parent;
			if(!filter['clusters'] || !filter['clusters']['attr']) return;	// Кластеризация не устанавливалась
			filter.setClusters(filter['clusters']['attr']);
		}
		evID = parent.parent.addListener('onLayer', chkFilter); // Отложенная установка кластеризации

	};
	Clusters.prototype = {
		'_chkToFlash':	function() {
			if(this._attr.visible && this._parent) gmxAPI._cmdProxy('setClusters', { 'obj': this._parent, 'attr': this._attr });
		},
		'getTextFunc':	function() {
			var me = this;
			return function(o)
			{
				var text = "";
				var nProp = me.getProperties();
				var props = o.properties;
				for (var key in nProp)
				{
					var value = "" + props[key];
					if (value.indexOf("http://") == 0)
						value = "<a href='" + value + "'>" + value + "</a>";
					else if (value.indexOf("www.") == 0)
						value = "<a href='http://" + value + "'>" + value + "</a>";
					text += "<b>" + key + ":</b> " + value + "<br />";
				}
				return text;
			}
		},
		'setProperties':function(prop) { var out = {}; for(key in prop) out[key] = prop[key]; this._attr.newProperties = out; this._chkToFlash(); },
		'getProperties':function() { var out = {}; for(key in this._attr.newProperties) out[key] = this._attr.newProperties[key]; return out; },
		'setStyle':		function(style, hoverStyle) { this._attr.RenderStyle = style; this._attr.HoverStyle = (hoverStyle ? hoverStyle : style); this._chkToFlash(); },
		'getStyle':		function() { var out = {}; if(this._attr.RenderStyle) out.RenderStyle = this._attr.RenderStyle; if(this._attr.HoverStyle) out.HoverStyle = this._attr.HoverStyle; return out; },
		'setRadius':	function(radius) { this._attr.radius = radius; this._chkToFlash(); },
		'getRadius':	function() { return this._attr.radius; },
		'setIterationCount':	function(iterationCount) { this._attr.iterationCount = iterationCount; this._chkToFlash(); },
		'getIterationCount':	function() { return this._attr.iterationCount; },
		'getVisible':	function() { return this._attr.visible; },
		'setVisible':	function(flag) { this._attr.visible = (flag ? true : false); if(this._attr.visible) this._chkToFlash(); else gmxAPI._cmdProxy('delClusters', { 'obj': this._parent }); },
		'setClusterView':	function(hash) { this._attr.clusterView = hash; this._chkToFlash(); },
		'getClusterView':	function() { if(!this._attr.clusterView) return null; var out = {}; for(key in this._attr.clusterView) out[key] = this._attr.clusterView[key]; return out; }
	};

	//расширяем namespace
    gmxAPI._Clusters = Clusters;
    gmxAPI._getDefaultClustersAttr = function() { return defaultAttr; }
	
	//расширяем FlashMapObject
	gmxAPI.extendFMO('setClusters', function(attr) { var ph = (attr ? _chkAttr(attr) : this._attr); return gmxAPI._cmdProxy('setClusters', { 'obj': this, 'attr': ph }); });
	gmxAPI.extendFMO('delClusters', function() { 	if(this.clusters && this.clusters.attr) delete this.clusters.attr; return gmxAPI._cmdProxy('delClusters', { 'obj': this }); });
})();
;/* ======================================================================
    zoomControl.js
   ====================================================================== */

//Поддержка zoomControl
(function()
{

	var addZoomControl = function(cont)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var zoomParent = gmxAPI.newStyledDiv({
			position: "absolute",
			left: "40px",
			top: "-35px"
		});
		cont.appendChild(zoomParent);
		var zoomPlaque = gmxAPI.newStyledDiv({
			backgroundColor: "#016a8a",
			opacity: 0.5,
			position: "absolute",
			left: 0,
			top: 0
		});
		zoomParent.appendChild(zoomPlaque);

		zoomParent.appendChild(gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/zoom_minus.png",
				onclick: function()
				{
					gmxAPI.map.zoomBy(-1);
				},
				onmouseover: function()
				{
					this.src = apiBase + "img/zoom_minus_a.png";
				},
				onmouseout: function()
				{
					this.src = apiBase + "img/zoom_minus.png"
				}
			},
			{
				position: "absolute",
				left: "5px",
				top: "7px",
				cursor: "pointer"
			}
		));
		var zoomPlus = gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/zoom_plus.png",
				onclick: function()
				{
					gmxAPI.map.zoomBy(1);
				},
				onmouseover: function()
				{
					this.src = apiBase + "img/zoom_plus_a.png";
				},
				onmouseout: function()
				{
					this.src = apiBase + "img/zoom_plus.png"
				}
			},
			{
				position: "absolute",
				cursor: "pointer"
			}
		)
		zoomParent.appendChild(zoomPlus);

		var addZoomItem = function(i)
		{
			var zoomObj_ = gmxAPI.newElement(
				"img",
				{
					src: apiBase + "img/zoom_raw.png",
					title: "" + (i + 1),
					onclick: function()
					{
						gmxAPI.map.zoomBy(i + minZoom - gmxAPI.map.getZ());
					},
					onmouseover: function()
					{
						this.src = apiBase + "img/zoom_active.png";
						this.title = "" + (i + minZoom);
					},
					onmouseout: function()
					{
						this.src = (this == zoomObj) ? (apiBase + "img/zoom_active.png") : (apiBase + "img/zoom_raw.png");
					}
				},
				{
					position: "absolute",
					left: (22 + 12*i) + "px",
					top: "12px",
					width: "12px",
					height: "8px",
					border: 0,
					cursor: "pointer"
				}
			);
			zoomParent.appendChild(zoomObj_);
			zoomArr.push(zoomObj_);
		};

		var zoomArr = [];
		var zoomObj = null;
		for (var i = 0; i < 20; i++)
		{
			addZoomItem(i);
		}

		var minZoom = 1, maxZoom;
		gmxAPI.map.zoomControl = {
			isVisible: true,
			isMinimized: false,
			setVisible: function(flag)
			{
				gmxAPI.setVisible(zoomParent, flag);
				this.isVisible = flag;
				if('_timeBarPosition' in gmxAPI) gmxAPI._timeBarPosition();
			},
			setZoom: function(z)
			{
				var newZoomObj = zoomArr[Math.round(z) - minZoom];
				if (newZoomObj != zoomObj)
				{
					if (zoomObj) zoomObj.src = apiBase + "img/zoom_raw.png";
					zoomObj = newZoomObj;
					if (zoomObj) zoomObj.src = apiBase + "img/zoom_active.png";
				}
			},
			repaint: function()
			{
				var dz = maxZoom - minZoom + 1;
				var gap = this.isMinimized ? 8 : 12*dz;
				gmxAPI.position(zoomPlus, 20 + gap, 7);
				gmxAPI.size(zoomPlaque, 43 + gap, 32);
				gmxAPI.map.zoomControl.width = 43 + gap;
				for (var i = 0; i < dz; i++) {
					if(i == zoomArr.length) addZoomItem(i);
					gmxAPI.setVisible(zoomArr[i], !this.isMinimized && (i < dz));
				}
				if(dz < zoomArr.length) for (var i = dz; i < zoomArr.length; i++) gmxAPI.setVisible(zoomArr[i], false);
				if('_timeBarPosition' in gmxAPI) gmxAPI._timeBarPosition();
			},
			setMinMaxZoom: function(z1, z2)
			{
				minZoom = z1;
				maxZoom = z2;
				this.repaint();
			},
			getMinZoom: function()
			{
				return minZoom;
			},
			getMaxZoom: function()
			{
				return maxZoom;
			},
			minimize: function()
			{
				this.isMinimized = true;
				this.repaint();
			},
			maximize: function()
			{
				this.isMinimized = false;
				this.repaint();
			}
		}
		var cz = (gmxAPI.map.needMove ? gmxAPI.map.needMove.z || 1 : 4);
		gmxAPI.map.zoomControl.setZoom(cz);
		// Добавление прослушивателей событий
		gmxAPI.map.addListener('positionChanged', function(ph)
			{
				gmxAPI.map.zoomControl.setZoom(ph.currZ);
			}
		);
	}
	gmxAPI._addZoomControl = addZoomControl;
})();
;/* ======================================================================
    miniMap.js
   ====================================================================== */

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
;/* ======================================================================
    copyright.js
   ====================================================================== */

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
;/* ======================================================================
    geomixerLink.js
   ====================================================================== */

//Поддержка geomixerLink
(function()
{
	var addGeomixerLink = function(cont)
	{
		var apiBase = gmxAPI.getAPIFolderRoot();
		var geomixerLink = gmxAPI.newElement(
			"a",
			{
				href: "http://geomixer.ru",
				target: "_blank",
				className: "gmx_geomixerLink"
			},
			{
				position: "absolute",
				left: "8px",
				bottom: "8px"
			}
		);
		geomixerLink.appendChild(gmxAPI.newElement(
			"img",
			{
				src: apiBase + "img/geomixer_logo_api.png",
				title: gmxAPI.KOSMOSNIMKI_LOCALIZED("© 2007-2011 ИТЦ «СканЭкс»", "(c) 2007-2011 RDC ScanEx"),
				width: 130,
				height: 34
			},
			{
				border: 0
			}
		));
		cont.appendChild(geomixerLink);
		gmxAPI.map.setGeomixerLinkAlign = function(attr) {				// Изменить позицию ссылки на Geomixer
			var align = attr['align'];
			if(align === 'br') {			// Позиция br(BottomRight)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '', 'bottom': '8px', 'right': '8px', 'left': '' });
			} else if(align === 'bl') {		// Позиция bl(BottomLeft)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '', 'bottom': '8px', 'right': '', 'left': '8px' });
			} else if(align === 'tr') {		// Позиция tr(TopRight)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '8px', 'bottom': '', 'right': '8px', 'left': '' });
			} else if(align === 'tl') {		// Позиция tl(TopLeft)
				gmxAPI.setPositionStyle(geomixerLink, { 'top': '8px', 'bottom': '', 'right': '', 'left': '8px' });
			}
		}
	}
	gmxAPI._addGeomixerLink = addGeomixerLink;
})();
;/* ======================================================================
    locationDIV.js
   ====================================================================== */

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
;/* ======================================================================
    Parsers.js
   ====================================================================== */

//gmxAPI = {};
/* 
   Single-pass recursive descent PEG parser library:
      http://en.wikipedia.org/wiki/Parsing_expression_grammar
   Inspired by Chris Double's parser combinator library in JavaScript:
      http://www.bluishcoder.co.nz/2007/10/javascript-packrat-parser.html
	+ Добавлены функции: Math.floor, Math.round
*/
(function()
{
	var Parsers = {};						// Парсеры

	var Pair = function(t1, t2)
	{
		var head = t1;
		var tail = t2;
		return { 'head': t1, 'tail': t2};
	}

// C-style linked list via recursive typedef. 
//   Used purely functionally to get shareable sublists.
//typedef LinkedList = Pair<Dynamic, LinkedList>;
	var LinkedList = function(t1, t2)
	{
		return Pair(t1, t2);
	}

// Parser state contains position in string and some accumulated data.
//typedef ParserState = Pair<Int, LinkedList>;
	var ParserState = function(t1, t2)
	{
		return Pair(t1, t2);
	}

// Parser accepts string and state, returns another state.
//typedef Parser = String->ParserState->ParserState;
	
	
	// A parser state that indicates failure.
	var fail = new ParserState(-1, null);

	// Check for failure.
	var failed = function(state)
	{
		return (state.head == -1);
	}

	// Advance a parser state by n characters.
	var advance = function(state, n)
	{
		return new ParserState(state.head + n, state.tail);
	}
	
	// Match a specified string.
	var token = function(tok)
	{
		var len = tok.length;
		return function(s, state)
		{
			return (s.substr(state.head, len) == tok) ? advance(state, len) : fail;
		}
	}

	// Match a string without regard to case.
	var caseInsensitiveToken = function(tok)
	{
		var len = tok.length;
		tok = tok.toLowerCase();
		return function(s, state)
		{
			return (s.substr(state.head, len).toLowerCase() == tok) ? advance(state, len) : fail;
		}
	}

	// Match a single character in a specified range.
	var range = function(startChar, endChar)
	{
		var startCode = startChar.charCodeAt(0);
		var endCode = endChar.charCodeAt(0);
		return function(s, state)
		{
			var code = s.charCodeAt(state.head);
			return ((code >= startCode) && (code <= endCode)) ? advance(state, 1) : fail;
		}
	}

	// Match any character outside a certain set.
	//   This combinator is intended only for single character parsers.
	var anythingExcept = function(parser)
	{
		return function(s, state)
		{
			return ((s.length > state.head) && failed(parser(s, state))) ? advance(state, 1) : fail;
		}
	}

	// Match thing1, then thing2, ..., then thingN.
	var sequence = function(parsers)
	{
		return function(s, state)
		{
			for (var i=0; i < parsers.length; i++)
			{
				state = parsers[i](s, state);
				if (failed(state))
					return fail;
			}
			return state;
		}
	}
	
	// Match thing1, or thing2, ..., or thingN.
	var choice = function(parsers)
	{
		return function(s, state)
		{
			for (var i=0; i < parsers.length; i++)
			{
				var newState = parsers[i](s, state);
				if (!failed(newState))
					return newState;
			}
			return fail;
		}
	}

	// Match immediately, without regard to what's in the string.
	var nothing = function(s, state) 
	{ 
		return state; 
	}

	// Match this thing or nothing.
	var maybe = function(parser)
	{
		return choice([parser, nothing]);
	}
	
	// Match minCount or more repetitions of this thing.
	var repeat = function(minCount, parser)
	{
		return function(s, state)
		{
			var count = 0;
			while (true)
			{
				var newState = parser(s, state);
				if (failed(newState))
					return (count >= minCount) ? state : fail;
				else
				{
					count += 1;
					state = newState;
				}
			}
			return fail;
		}
	}

	// Match a list of minCount or more instances of thing1, separated by thing2.
	var separatedList = function(minCount, parser, separator)
	{
		var parser1 = sequence([parser, repeat(minCount - 1, sequence([separator, parser]))]);
		return (minCount > 0) ? parser1 : choice([parser1, nothing]);
	}
	
	var whitespace = repeat(0, choice([
		token(" "),
		token("\t"),
		token("\n")
	]));

	// Same as separatedList, but can have whitespace between items and separators.
	var whitespaceSeparatedList = function(minCount, parser, separator)
	{
		return separatedList(minCount, parser, sequence([whitespace, separator, whitespace]));
	}

	// Same as sequence, but can have whitespace between items.
	var whitespaceSeparatedSequence = function(parsers)
	{
		var newParsers = new Array();
		for (var i = 0; i < parsers.length; i++)
		{
			if (newParsers.length > 0)
				newParsers.push(whitespace);
			newParsers.push(parsers[i]);
		}
		return sequence(newParsers);
	}

	// This combinator captures the string that the parser matched
	//   and adds it to the current parser state, consing a new state.
	var capture = function(parser)
	{
		return function(s, state)
		{
			var newState = parser(s, state);
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(s.substr(state.head, newState.head - state.head), newState.tail));
		}
	}

	// This combinator passes the accumulated parser state to a given 
	//  function for processing. The result goes into the new state.
	var action = function(parser, func)
	{
		return function(s, state)
		{
			var oldState = state;
			var newState = parser(s, new ParserState(oldState.head, null));
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(func(newState.tail), oldState.tail));
		}
	}

	// Define a syntactic subset of SQL WHERE clauses.
	var fieldName = capture(repeat(1, choice([
		range("a", "z"),
		range("A", "Z"),
		range("а", "я"),
		range("А", "Я"),
		range("0", "9"),
		token("_")
	])));

	var fieldNameWithSpaces = capture(repeat(1, choice([
		range("a", "z"),
		range("A", "Z"),
		range("а", "я"),
		range("А", "Я"),
		range("0", "9"),
		token("_"),
		token(" ")
	])));

	var quotedFieldName = choice([
		fieldName,
		sequence([token('"'), fieldNameWithSpaces, token('"')]),
		sequence([token('`'), fieldNameWithSpaces, token('`')])
	]);

	var stringLiteral = sequence([
		token("'"),
		capture(repeat(0, anythingExcept(token("'")))),
		token("'")
	]);

	var digits = repeat(1, range("0", "9"));

	var numberLiteral = capture(sequence([
		maybe(token("-")),
		digits,
		maybe(sequence([token("."), digits]))
	]));

	var literal = choice([numberLiteral, stringLiteral]);

	var applyParser = function(s, parser)
	{
		return parser(s, new ParserState(0, null));
	}

	// Order is important here: longer ops should be tried first.
	var opTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			capture(choice([
				token("=="),
				token("!="),
				token("<>"),
				token("<="),
				token(">="),
				token("="),
				token("<"),
				token(">"),
				caseInsensitiveToken("LIKE")
			])),
			literal
		]),
		function(state)
		{
			// Linked list contains fieldname, operation, value
			// (in reverse order).

			var fieldName = state.tail.tail.head;
			var op = state.tail.head;
			var referenceValue = state.head;

			var matchPattern = null;
			if (op.toUpperCase() == "LIKE")
			{
				matchPattern = function(fieldValue)
				{
					var matchFrom = null;
					matchFrom = function(referenceIdx, fieldIdx)
					{
						var referenceChar = referenceValue.charAt(referenceIdx);
						var fieldChar = fieldValue.charAt(fieldIdx);
						if (referenceChar == "")
							return (fieldChar == "");
						else if (referenceChar == "%")
							return matchFrom(referenceIdx + 1, fieldIdx) || ((fieldChar != "") && matchFrom(referenceIdx, fieldIdx + 1));
						else 
							return (referenceChar == fieldChar) && matchFrom(referenceIdx + 1, fieldIdx + 1);
					}
					return matchFrom(0, 0);
				}
			}

			return function(props)
			{
				var fieldValue = props[fieldName];
				if (fieldValue == null)
					return false;
				if (matchPattern != null)
					return matchPattern(fieldValue);
				else if ((op == "=") || (op == "=="))
					return (fieldValue == referenceValue);
				else if ((op == "!=") || (op == "<>"))
					return (fieldValue != referenceValue);
				else
				{
					if (applyParser(referenceValue, numberLiteral).head == referenceValue.length)
					{
						var f1 = parseFloat(fieldValue);
						var f2 = parseFloat(referenceValue);
						if (op == "<")
							return (f1 < f2);
						else if (op == ">")
							return (f1 > f2);
						else if (op == "<=")
							return (f1 <= f2);
						else if (op == ">=")
							return (f1 >= f2);
						else
							return false;
					}
					else
					{
						var f1 = fieldValue;
						var f2 = referenceValue;
						if (op == "<")
							return (f1 < f2);
						else if (op == ">")
							return (f1 > f2);
						else if (op == "<=")
							return (f1 <= f2);
						else if (op == ">=")
							return (f1 >= f2);
						else
							return false;
					}
				}
			}
		}
	);

	var inTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			caseInsensitiveToken("IN"),
			token("("),
			whitespaceSeparatedList(0, literal, token(",")),
			token(")")
		]),
		function(state)
		{
			// Linked list contains fieldname and multiple values
			//   (in reverse order).

			var node = state;
			while (node.tail != null)
				node = node.tail;
			var fieldName = node.head;

			return function(props)
			{
				var value = props[fieldName];
				if (value == null)
					return false;
				var node = state;
				while (node.tail != null)
				{
					if (node.head == value)
						return true;
					node = node.tail;
				}
				return false;
			}
		}
	);

	// Forward declarations to allow mutually recursive grammar definitions.
	var term = null;
	term = function(s, state) { return term(s, state); }
	var expression = null;
	expression = function(s, state) { return expression(s, state); }

	var notTerm = action(
		whitespaceSeparatedSequence([caseInsensitiveToken("NOT"), term]),
		function(state)
		{
			// Linked list contains only processed inner term.
			var innerTerm = state.head;
			return function(props)
			{
				return !innerTerm(props);
			}
		}
	);

	term = choice([
		notTerm,
		opTerm,
		inTerm,
		whitespaceSeparatedSequence([token("("), expression, token(")")])
	]);

	// AND and OR expressions must have at least 2 terms,
	//   to disambiguate them from a single term.

	var andExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken("AND")),
		function(state)
		{
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props)
			{
				var flag = true;
				var node = state;
				while (node != null)
				{
					flag = flag && node.head(props);
					node = node.tail;
				}
				return flag;
			}
		}
	);
	
	var orExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken("OR")),
		function(state)
		{
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props)
			{
				var flag = false;
				var node = state;
				while (node != null)
				{
					flag = flag || node.head(props);
					node = node.tail;
				}
				return flag;
			}
		}
	);

	// Order is important here: term should be tried last, 
	//   because andExpression and orExpression start with it.
	expression = choice([
		andExpression, 
		orExpression,
		term
	]);
	
	var whereClause = sequence([whitespace, expression, whitespace]);
	
	Parsers.parseSQL = function(str)
	{
		var result = applyParser(str, whereClause);
		if (result.head == str.length) 
			return result.tail.head;
		else
			return (applyParser(str, whitespace).head == str.length) ?
				function(props) { return true; } :
				null;
	}

	var additiveExpression = null;
	additiveExpression = function(s, state) { return additiveExpression(s, state); }
	var multiplicativeExpression = null;
	multiplicativeExpression = function(s, state) { return multiplicativeExpression(s, state); }
	additiveExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeExpression,
			capture(choice([token("+"), token("-")]))
		),
		function(state)
		{
			return function(props)
			{
				var pos = state;
				var term = 0.0;
				while (pos != null)
				{
					term += pos.head(props);
					if (pos.tail == null)
						return term;
					else
					{
						if (pos.tail.head == "-")
							term = -term;
						pos = pos.tail.tail;
					}
				}
				return term;
			}
		}
	);

	var multiplicativeTerm = choice([
		action(
			numberLiteral,
			function(state)
			{
				return function(props)
				{
					return parseFloat(state.head);
				}
			}
		),
/*		
		action(
			sequence([token("round("), additiveExpression, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.round(res);
				}
			}
		),
*/		
		action(
			//whitespaceSeparatedSequence([token("floor("), additiveExpression, token(")")]),
			//sequence([token("floor("), maybe(whitespace), additiveExpression, maybe(whitespace), token(")")]),
			sequence([token("floor("), additiveExpression, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.floor(res);
				}
			}
		),
		action(
			sequence([token("["), fieldName, token("]")]),
			function(state)
			{
				return function(props)
				{
					return parseFloat(props[state.head]);
				}
			}
		),
		whitespaceSeparatedSequence([
			token("("),
			additiveExpression,
			token(")")
		])
	]);
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token("-"), multiplicativeTerm]),
			function(state)
			{
				return function(props)
				{
					return -state.head(props);
				}
			}
		)
	]);
	multiplicativeExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeTerm,
			capture(choice([token("*"), token("/")]))
		),
		function(state)
		{
			return function(props)
			{
				var pos = state;
				var term = 1.0;
				while (pos != null)
				{
					term *= pos.head(props);
					if (pos.tail == null)
						return term;
					else
					{
						if (pos.tail.head == "/")
							term = 1.0/term;
						pos = pos.tail.tail;
					}
				}
				return term;
			}
		}
	);

	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token("-"), multiplicativeTerm]),
			function(state)
			{
				return function(props)
				{
					return -state.head(props);
				}
			}
		)
	]);
/*	
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			sequence([token("floor"), token("("), multiplicativeTerm, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.floor(res);
				}
			}
		)
	]);
*/	
	var arithmeticExpression = sequence([whitespace, additiveExpression, whitespace]);		
	Parsers.parseExpression = function(s)
	{
		var result = applyParser(s, arithmeticExpression);
		if (result.head == s.length) 
			return result.tail.head;
		else
			return null;
	}

	var svgPath = action(
		repeat(0, choice([
			numberLiteral,
			token(","),
			token("M"),
			token("C"),
			repeat(1, choice([
				token(" "),
				token("\t"),
				token("\r"),
				token("\n")
			]))
		])),
		function(state)
		{
			var coords = new Array();
			while (state != null)
			{
				coords.push(Std.parseFloat(state.head));
				state = state.tail;
			}
			coords.reverse();
			return coords;
		}
	);

	Parsers.parseSVGPath = function(s)
	{
		var result = applyParser(s, svgPath);
		if (result.head == s.length) 
			return result.tail.head;
		else
			return [];
	}

	//расширяем namespace
	gmxAPI.Parsers = Parsers;
})();
/*
//var str = '[test] + 23.45';
//var str = '1 + Math.floor([test] + 23.45)';
//var str = '1 + floor([_unixTimeStamp] + 23.4)*2 + round([_unixTimeStamp]/2 + 2.5)';
var str = 'floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)*256*256 + floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)*256 + floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)';
//var str = 'floor(255*( [_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ( [_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) )*0)*256*256';
//var str = 'floor(([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))';
//var str = 'floor((10.1))';
//var str = 'floor([_unixTimeStamp] - 1339099200/1339185599 - 1339099200)';
try {
var colorFunction = gmxAPI.Parsers.parseExpression(str);
} catch(e) {
var tt = e;
var tt = e;
}
var res = colorFunction({'_unixTimeStamp':1339185500, 'fdfdf': 'fff'});
var res = '[test] + 23';
*/
;/* ======================================================================
    ProjectiveImage.js
   ====================================================================== */

// ProjectiveImage - projective transform that maps [0,1]x[0,1] onto the given set of points.
(function()
{
	var Matrix = function (w, h, values) {
	  this.w = w;
	  this.h = h;
	  this.values = values || allocate(h);
	};

	var allocate = function (w, h) {
	  var values = [];
	  for (var i = 0; i < h; ++i) {
		values[i] = [];
		for (var j = 0; j < w; ++j) {
		  values[i][j] = 0;
		}
	  }
	  return values;
	}

	var cloneValues = function (values) {
		var clone = [];
		for (var i = 0; i < values.length; ++i) {
			clone[i] = [].concat(values[i]);
		}
		return clone;
	}
	Matrix.prototype = {
		add : function (operand) {
			if (operand.w != this.w || operand.h != this.h) {
				throw new Error("Matrix add size mismatch");
			}

			var values = allocate(this.w, this.h);
			for (var y = 0; y < this.h; ++y) {
				for (var x = 0; x < this.w; ++x) {
				  values[y][x] = this.values[y][x] + operand.values[y][x];
				}
			}
			return new Matrix(this.w, this.h, values);
		},
		transformProjectiveVector : function (operand) {
			var out = [], x, y;
			for (y = 0; y < this.h; ++y) {
				out[y] = 0;
				for (x = 0; x < this.w; ++x) {
					out[y] += this.values[y][x] * operand[x];
				}
			}
			var zn = out[out.length - 1];
			if(zn) {
				var iz = 1 / (out[out.length - 1]);
				for (y = 0; y < this.h; ++y) {
					out[y] *= iz;
				}
			}
			return out;
		},
		multiply : function (operand) {
			var values, x, y;
			if (+operand !== operand) {
				// Matrix mult
				if (operand.h != this.w) {
					throw new Error("Matrix mult size mismatch");
				}
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < operand.w; ++x) {
						var accum = 0;
						for (var s = 0; s < this.w; s++) {
							accum += this.values[y][s] * operand.values[s][x];
						}
						values[y][x] = accum;
					}
				}
				return new Matrix(operand.w, this.h, values);
			}
			else {
				// Scalar mult
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < this.w; ++x) {
						values[y][x] = this.values[y][x] * operand;
					}
				}
				return new Matrix(this.w, this.h, values);
			}
		},
		rowEchelon : function () {
			if (this.w <= this.h) {
				throw new Error("Matrix rowEchelon size mismatch");
			}

			var temp = cloneValues(this.values);

			// Do Gauss-Jordan algorithm.
			for (var yp = 0; yp < this.h; ++yp) {
				// Look up pivot value.
				var pivot = temp[yp][yp];
				while (pivot == 0) {
					// If pivot is zero, find non-zero pivot below.
					for (var ys = yp + 1; ys < this.h; ++ys) {
						if (temp[ys][yp] != 0) {
							// Swap rows.
							var tmpRow = temp[ys];
							temp[ys] = temp[yp];
							temp[yp] = tmpRow;
							break;
						}
					}
					if (ys == this.h) {
						// No suitable pivot found. Abort.
						return new Matrix(this.w, this.h, temp);
					}
					else {
						pivot = temp[yp][yp];
					}
				}
				// Normalize this row.
				var scale = 1 / pivot;
				for (var x = yp; x < this.w; ++x) {
					temp[yp][x] *= scale;
				}
				// Subtract this row from all other rows (scaled).
				for (var y = 0; y < this.h; ++y) {
					if (y == yp) continue;
					var factor = temp[y][yp];
					temp[y][yp] = 0;
					for (x = yp + 1; x < this.w; ++x) {
						temp[y][x] -= factor * temp[yp][x];
					}
				}
			}

			return new Matrix(this.w, this.h, temp);
		},
		invert : function () {
			var x, y;

			if (this.w != this.h) {
				throw new Error("Matrix invert size mismatch");
			}

			var temp = allocate(this.w * 2, this.h);

			// Initialize augmented matrix
			for (y = 0; y < this.h; ++y) {
				for (x = 0; x < this.w; ++x) {
					temp[y][x] = this.values[y][x];
					temp[y][x + this.w] = (x == y) ? 1 : 0;
				}
			}

			temp = new Matrix(this.w * 2, this.h, temp);
			temp = temp.rowEchelon();

			// Extract right block matrix.
			var values = allocate(this.w, this.h);
			for (y = 0; y < this.w; ++y) {
				// @todo check if "x < this.w;" is mistake
				for (x = 0; x < this.w; ++x) {
					values[y][x] = temp.values[y][x + this.w];
				}
			}
			return new Matrix(this.w, this.h, values);
		}
	};

	var getProjectiveTransform = function (points) {
	  var eqMatrix = new Matrix(9, 8, [
		[ 1, 1, 1,   0, 0, 0, -points[3][0],-points[3][0],-points[3][0] ],
		[ 0, 1, 1,   0, 0, 0,  0,-points[2][0],-points[2][0] ],
		[ 1, 0, 1,   0, 0, 0, -points[1][0], 0,-points[1][0] ],
		[ 0, 0, 1,   0, 0, 0,  0, 0,-points[0][0] ],

		[ 0, 0, 0,  -1,-1,-1,  points[3][1], points[3][1], points[3][1] ],
		[ 0, 0, 0,   0,-1,-1,  0, points[2][1], points[2][1] ],
		[ 0, 0, 0,  -1, 0,-1,  points[1][1], 0, points[1][1] ],
		[ 0, 0, 0,   0, 0,-1,  0, 0, points[0][1] ]

	  ]);

	  var kernel = eqMatrix.rowEchelon().values;
	  var transform = new Matrix(3, 3, [
		[-kernel[0][8], -kernel[1][8], -kernel[2][8]],
		[-kernel[3][8], -kernel[4][8], -kernel[5][8]],
		[-kernel[6][8], -kernel[7][8],             1]
	  ]);
	  return transform;
	}

	var divide = function (u1, v1, u4, v4, p1, p2, p3, p4, attr) {
		 // See if we can still divide.
		if (attr.limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 == 0 && u4 == 1) || ((.25 + r * 5) * area > (attr.patchSize * attr.patchSize))) {
				// Calculate subdivision points (middle, top, bottom, left, right).
				var umid = (u1 + u4) / 2;
				var vmid = (v1 + v4) / 2;
				var tr   = attr.transform;
				var pmid = tr.transformProjectiveVector([umid, vmid, 1]);
				var pt   = tr.transformProjectiveVector([umid, v1, 1]);
				var pb   = tr.transformProjectiveVector([umid, v4, 1]);
				var pl   = tr.transformProjectiveVector([u1, vmid, 1]);
				var pr   = tr.transformProjectiveVector([u4, vmid, 1]);
				
				// Subdivide.
				attr.limit--;
				divide.call(this, u1,   v1, umid, vmid,   p1,   pt,   pl, pmid, attr);
				divide.call(this, umid,   v1,   u4, vmid,   pt,   p2, pmid,   pr, attr);
				divide.call(this, u1,  vmid, umid,   v4,   pl, pmid,   p3,   pb, attr);
				divide.call(this, umid, vmid,   u4,   v4, pmid,   pr,   pb,   p4, attr);

				return;
			}
		}
		
		var ctx = attr.ctx;

		// Render this patch.
		ctx.save();
//ctx.clearRect(0, 0, attr['canvas'].width, attr['canvas'].height);
		// Set clipping path.
		ctx.beginPath();
	
		ctx.moveTo(p1[0], p1[1]);
		ctx.lineTo(p2[0], p2[1]);
		ctx.lineTo(p4[0], p4[1]);
		ctx.lineTo(p3[0], p3[1]);

/*

		ctx.moveTo(p1[0] - attr['deltaX'], p1[1] - attr['deltaY']);
		ctx.lineTo(p2[0] - attr['deltaX'], p2[1] - attr['deltaY']);
		ctx.lineTo(p4[0] - attr['deltaX'], p4[1] - attr['deltaY']);
		ctx.lineTo(p3[0] - attr['deltaX'], p3[1] - attr['deltaY']);
*/		
		ctx.closePath();
		//ctx.clip();
		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		switch (amax) {
			case a1:
				ctx.transform(d12[0], d12[1], -d31[0], -d31[1], p1[0] + attr['deltaX'], p1[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				break;
			case a2:
				ctx.transform(d12[0], d12[1],  d24[0],  d24[1], p2[0] + attr['deltaX'], p2[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				break;
			case a4:
				ctx.transform(-d43[0], -d43[1], d24[0], d24[1], p4[0] + attr['deltaX'], p4[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				dy = -1;
				break;
			case a3:
				// Calculate 1.05 pixel padding on vector basis.
				ctx.transform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0] + attr['deltaX'], p3[1] + attr['deltaY']);
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				dy = -1;
				break;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		var padu = padx * du;
		var padv = pady * dv;


		var iw = attr.imageObj.width;
		var ih = attr.imageObj.height;

		ctx.drawImage(
			attr.imageObj,
			u1 * iw,
			v1 * ih,
			Math.min(u4 - u1 + padu, 1) * iw,
			Math.min(v4 - v1 + padv, 1) * ih,
			dx, dy,
			1 + padx, 1 + pady
		);
		ctx.restore();
	}

	var ProjectiveImage = function (attr) {
		var transform = getProjectiveTransform(attr.points);
		// Begin subdivision process.

		var ptl = transform.transformProjectiveVector([0, 0, 1]);
		var ptr = transform.transformProjectiveVector([1, 0, 1]);
		var pbl = transform.transformProjectiveVector([0, 1, 1]);
		var pbr = transform.transformProjectiveVector([1, 1, 1]);
		var	boundsP = new L.Bounds();
		boundsP.extend(new L.Point(ptl[0], ptl[1]));
		boundsP.extend(new L.Point(ptr[0], ptr[1]));
		boundsP.extend(new L.Point(pbr[0], pbr[1]));
		boundsP.extend(new L.Point(pbl[0], pbl[1]));
		var ww = boundsP.max.x - boundsP.min.x;
		var hh = boundsP.max.y - boundsP.min.y;
		if(attr.wView < ww || attr.hView < hh) {
			ww = attr.wView;
			hh = attr.hView;
		}
		var canvas = document.createElement("canvas");
		var w = attr.imageObj.width;
		var h = attr.imageObj.height;
		attr['canvas'] = canvas;
		attr['ctx'] = canvas.getContext('2d');
		attr['ctx'].setTransform(1, 0, 0, 1, 0, 0);
		attr['transform'] = transform;
		canvas.width = ww;
		canvas.height = hh;
		if(!attr['patchSize']) attr['patchSize'] = 4;
		if(!attr['limit']) attr['limit'] = 5;

		try {
			divide( 0, 0, 1, 1, ptl, ptr, pbl, pbr, attr );
		} catch(e) {
			gmxAPI.addDebugWarnings({'func': 'ProjectiveImage', 'event': e});
			canvas = null;
		}
		return {
			'canvas': canvas
			,'ptl': ptl
			,'ptr': ptr
			,'pbl': pbl
			,'pbr': pbr
		};
	}
	
	//расширяем namespace
	if(!gmxAPI) gmxAPI = {};
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['ProjectiveImage'] = ProjectiveImage;
})();

;/* ======================================================================
    VectorTileLoader.js
   ====================================================================== */

// VectorTileLoader - менеджер загрузки векторных тайлов
(function()
{
	var maxCount = 48;						// макс.кол. запросов
	var curCount = 0;						// номер текущего запроса
	var timer = null;						// таймер
	var items = [];							// массив текущих запросов
	var itemsHash = {};						// Хэш отправленных запросов
	//var falseFn = function () {	return false; };

	var loadTile = function(item)	{		// загрузка тайла
		//var layerID = item['layerID'];			// id слоя
		var node = item['node'];				// node слоя
		var tID = item['tID'];					// id тайла
		var srcArr = item['srcArr'];			// массив URL тайла
		var callback = item['callback'];		// callback обработки данных
		var onerror = item['onerror'];			// onerror обработка
		
		if(!item['badTiles']) item['badTiles'] = {};
		var counts = srcArr.length;
		var len = counts;
		var needParse = [];
		for (var i = 0; i < len; i++)		// подгрузка векторных тайлов
		{
			var src = srcArr[i] + '&r=t';
			itemsHash[src] = item;
			(function() {						
				var psrc = src;
				gmxAPI.sendCrossDomainJSONRequest(psrc, function(response)
				{
					//delete node['tilesLoadProgress'][psrc];
					counts--;
					if(itemsHash[psrc]) {
						if(itemsHash[psrc]['skip']) {
							delete itemsHash[psrc];
							return;
						}
						delete itemsHash[psrc];
					}

					if(typeof(response) != 'object' || response['Status'] != 'ok') {
						onerror({'url': psrc, 'Error': 'bad vector tile response'})
						//return;
					}
					if(response['Result'] && response['Result'].length)	needParse = needParse.concat(response['Result']);
					if(counts < 1) {
						callback(needParse);
//console.log('needParse ', tID, needParse.length);
						needParse = [];
						response = null;
						item = null;
					}
				});
			})();
		}
	}
		
	var nextLoad = function()	{		// загрузка image
		if(curCount > maxCount) return;
		if(items.length < 1) return false;
		var item = items.shift();
		loadTile(item);
	}
	
	var chkTimer = function() {				// установка таймера
		if(!timer) timer = setInterval(nextLoad, 50);
	}
	
	var vectorTileLoader = {
		'push': function(item)	{					// добавить запрос в конец очереди
			items.push(item);
			chkTimer();
			return items.length;
		}
		,'unshift': function(item)	{				// добавить запрос в начало очереди
			items.unshift(item);
			chkTimer();
			return items.length;
		}
		,'clearLayer': function(id)	{				// Удалить все запросы по слою id
			for (var key in itemsHash) {
				var item = itemsHash[key];
				if(item['layer'] == id) itemsHash[key]['skip'] = true;
			}
			var arr = [];
			for(var i=0; i<items.length; i++) {
				var item = items[i];
				if(item['layer'] != id) arr.push(item);
			}
			items = arr;
			return items.length;
		}
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['vectorTileLoader'] = vectorTileLoader;	// менеджер загрузки тайлов
})();
;/* ======================================================================
    ImageLoader.js
   ====================================================================== */

// imageLoader - менеджер загрузки image
(function()
{
	var maxCount = 32;						// макс.кол. запросов
	var curCount = 0;						// номер текущего запроса
	var timer = null;						// таймер
	var items = [];							// массив текущих запросов
	var itemsHash = {};						// Хэш по image.src
	var itemsCache = {};					// Кэш загруженных image по image.src
	var emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
	var falseFn = function () {	return false; };

	var parseSVG = function(item, str)	{		// парсинг SVG файла
		var out = {};
		var xml = gmxAPI.parseXML(str);
		
		var svg = xml.getElementsByTagName("svg");
		out['width'] = parseFloat(svg[0].getAttribute("width"));
		out['height'] = parseFloat(svg[0].getAttribute("height"));
		
		var polygons = svg[0].getElementsByTagName("polygon");
		var poly = [];
		for (var i = 0; i < polygons.length; i++)
		{
			var pt = {};
			var it = polygons[i];
			var hexString = it.getAttribute("fill"); hexString = hexString.replace(/^#/, '');
			pt['fill'] = parseInt(hexString, 16);
			pt['fill_rgba'] = gmxAPI._leaflet['utils'].dec2rgba(pt['fill'], 1);
			
			pt['stroke-width'] = parseFloat(it.getAttribute("stroke-width"));
			var points = it.getAttribute("points");
			if(points) {
				var arr = [];
				var pp = points.split(' ');
				for (var j = 0; j < pp.length; j++)
				{
					var t = pp[j];
					var xy = t.split(',');
					arr.push({'x': parseFloat(xy[0]), 'y': parseFloat(xy[1])});
				}
				if(arr.length) arr.push(arr[0]);
			}
			pt['points'] = arr;
			poly.push(pt);
		}
		out['polygons'] = poly;
		
//console.log('vvvvv ', item['src'], out);
		return out;
	}
	
	var callCacheItems = function(item)	{		// загрузка image
		if(itemsCache[item.src]) {
			var arr = itemsCache[item.src];
			var first = arr[0];
			for (var i = 0; i < arr.length; i++)
			{
				var it = arr[i];
				if(first.isError) {
					if(it.onerror) it.onerror(null);
				} else if(first.imageObj) {
					if(it.callback) it.callback(first.imageObj);
				} else if(first.svgPattern) {
					if(it.callback) it.callback(first.svgPattern, true);
				}
			}
			//itemsCache[item.src] = [first];
			delete itemsCache[item.src];
		}
		nextLoad();
	}
	
	var setImage = function(item)	{		// загрузка image
		if(item['src'].match(/\.svg$/)) {
			var xmlhttp = gmxAPI._leaflet['utils'].getXmlHttp();
			xmlhttp.open('GET', item['src'], false);
			xmlhttp.send(null);
			if(xmlhttp.status == 200) {
				item.svgPattern = parseSVG(item, xmlhttp.responseText);
				callCacheItems(item);
			}
			/*
			xmlhttp.open('GET', item['src'], true);
			xmlhttp.onreadystatechange = function() {
			  if (xmlhttp.readyState == 4) {
				 if(xmlhttp.status == 200) {
				   alert(xmlhttp.responseText);
					 }
			  }
			};*/
			
			return;
		}

		var imageObj = new Image();
		item['loaderObj'] = imageObj;
		//var cancelTimerID = null;
		var chkLoadedImage = function() {
			//if (!imageObj.complete) {
				//setTimeout(function() { chkLoadedImage(); }, 1);
			//} else {
				//curCount--;
				item.imageObj = imageObj;
				delete item['loaderObj'];
				callCacheItems(item);
			//}
		}
		if(item['crossOrigin']) imageObj.crossOrigin = item['crossOrigin'];
		imageObj.onload = function() {
			curCount--;
			chkLoadedImage();
			//setTimeout(function() { chkLoadedImage(); } , 25); //IE9 bug - black tiles appear randomly if call setPattern() without timeout
		};
		imageObj.onerror = function() {
			curCount--;
			item.isError = true;
			callCacheItems(item);
		};
		curCount++;
		imageObj.src = item.src;
	}
		
	var nextLoad = function()	{		// загрузка image
		if(curCount > maxCount) return;
		if(items.length < 1) {
			curCount = 0;
			return false;
		}
		var item = items.shift();

		if(itemsCache[item.src]) {
			var pitem = itemsCache[item.src][0];
			if(pitem.isError) {
				if(item.onerror) item.onerror(null);
			} else if(pitem.imageObj) {
				if(item.callback) item.callback(pitem.imageObj);
			} else {
				itemsCache[item.src].push(item);
			}
		} else {
			itemsCache[item.src] = [item];
			setImage(item);
		}
	}

	var removeItemsByZoom = function(zoom)	{			// остановить и удалить из очереди запросы по zoom
		if (!L.Browser.android) {
			for (var key in itemsCache)
			{
				var q = itemsCache[key][0];
				if('zoom' in q && q['zoom'] != zoom && q['loaderObj']) {
					q['loaderObj'].src = emptyImageUrl;
				}
			}
		}
		var arr = [];
		for (var i = 0; i < items.length; i++)
		{
			var q = items[i];
			if(!q['zoom'] || q['zoom'] == zoom) arr.push(q);
		}
		items = arr;
		return items.length;
	}
	
	var chkTimer = function() {				// установка таймера
		if(!timer) {
			timer = setInterval(nextLoad, 50);
			//gmxAPI._leaflet['LMap'].on('zoomstart', function(e) {
			gmxAPI._leaflet['LMap'].on('zoomend', function(e) {
				var zoom = gmxAPI._leaflet['LMap'].getZoom();
				removeItemsByZoom(zoom);
			});
		}
	}
	
	var imageLoader = {						// менеджер загрузки image
		'push': function(item)	{					// добавить запрос в конец очереди
			items.push(item);
			chkTimer();
			return items.length;
		}
		,'unshift': function(item)	{				// добавить запрос в начало очереди
			items.unshift(item);
			chkTimer();
			return items.length;
		}
		,'getCounts': function()	{				// получить размер очереди + колич.выполняющихся запросов
//console.log('getCounts' , curCount, items.length); 
			return items.length + (curCount > 0 ? curCount : 0);
		}
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['imageLoader'] = imageLoader;	// менеджер загрузки image
})();
;/* ======================================================================
    DrawManager.js
   ====================================================================== */

// drawManager - менеджер отрисовки
(function()
{
	var nextId = 0;							// следующий ID mapNode
	var timerID = null;						// таймер
	var items = [];							// массив ID нод очереди отрисовки
	var itemsHash = {};						// Хэш нод требующих отрисовки

	var repaintItems = function()	{			// отрисовка ноды
		if(items.length < 1) {
			if(timerID) clearInterval(timerID);
			timerID = null;
			nextId = 0;
			return false;
		}
		var len = (items.length < 100 ? items.length : 100);	// по 100 обьектов за раз
		for (var i = 0; i < len; i++)
		{
			var id = items.shift();
			delete itemsHash[id];
			var node = gmxAPI._leaflet['mapNodes'][id];
			if(!node) return false;
			gmxAPI._leaflet['utils'].repaintNode(node, true);
		}
		//setTimeout(repaintItems, 10);
		//repaintItems();
		return true;
	}
	
	var chkTimer = function() {				// установка таймера
		if(!timerID) timerID = setInterval(repaintItems, 20);
	}
	
	var drawManager = {						// менеджер отрисовки
		'add': function(id)	{					// добавить ноду для отрисовки
			var node = gmxAPI._leaflet['mapNodes'][id];
			if(!node) return false;
			if(itemsHash[id]) drawManager.remove(id);
			if(!itemsHash[id]) {
				itemsHash[id] = items.length;
				items.push(id);
			}
			chkTimer();
			//setTimeout(repaintItems, 10);
			return items.length;
		}
		,'remove': function(id)	{				// удалить ноду
			if(itemsHash[id]) {
				var num = itemsHash[id];
				if(num == 0) items.shift();
				else {
					var arr = items.slice(0, num - 1);
					arr = arr.concat(items.slice(num));
					items = arr;
				}
				delete itemsHash[id];
				return true;
			}
			return false;
		}
		,'repaint': function()	{				// отрисовка нод
			repaintItems();
		}
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['drawManager'] = drawManager;	// менеджер отрисовки
	//gmxAPI._leaflet['test'] = {'itemsHash': itemsHash, 'items': items};	// test
})();
;/* ======================================================================
    RasterLayer.js
   ====================================================================== */

// растровый слой
(function()
{
	var LMap = null;						// leafLet карта
	var utils = null;						// утилиты для leaflet
	var mapNodes = null;					// Хэш нод обьектов карты - аналог MapNodes.hx

	// Добавить растровый слой
	function setBackgroundTiles(ph)	{
		if(!LMap) init();
		var out = {};
		var layer = ph.obj;
		var id = layer.objectId;
		var node = mapNodes[id];
		if(!node) return;						// Нода не определена
		var gmxNode = null;						// Нода gmxAPI
		node['type'] = 'RasterLayer';
		node['isOverlay'] = false;
		node['failedTiles'] = {};				// Hash тайлов 404
		node['zIndexOffset'] = 0;				// Сдвиг zIndex
		node['listenerIDS'] = {};				// id прослушивателей событий
		node['leaflet'] = null;					// Нода leaflet
		var myLayer = null;

		var inpAttr = ph.attr;
		node['subType'] = ('subType' in inpAttr ? inpAttr['subType'] : (inpAttr['projectionCode'] === 1 ? 'OSM' : ''));
		var attr = {};

		attr['mercGeom'] = layer.mercGeometry || {				// граница слоя в merc
			'type': "POLYGON"
			,'coordinates': [[
				[-20037500, -21133310]
				,[-20037500, 21133310]
				,[20037500, 21133310]
				,[20037500, -21133310]
				,[-20037500, -21133310]
			]]
		};
		
		if(node.propHiden) {
			if(node.propHiden.geom) {
				attr['geom'] = node.propHiden['geom'];					// Геометрия от обьекта векторного слоя
				attr['bounds'] = attr['geom']['bounds'];				// Bounds слоя
			}
			if(node.propHiden.zIndexOffset) node['zIndexOffset'] = node.propHiden['zIndexOffset'];
		}
		var pNode = mapNodes[node.parentId];					// Нода родителя
		if(pNode && pNode.propHiden && pNode.propHiden.subType === 'tilesParent') {
			attr['minZoom'] = pNode.minZ || 1;
			attr['maxZoom'] = pNode.maxZ || 30;
										// pNode.parentId нода векторного слоя по обьекту которого создан растровый слой 
		} else {
			if(pNode && pNode.zIndexOffset) {
				node['zIndexOffset'] = pNode.zIndexOffset;
			}
		}
		if(!'zIndex' in node) node['zIndex'] = utils.getIndexLayer(id);
		node['zIndex'] += node['zIndexOffset'];

		node['setGeometry'] = function() {			// Установка геометрии
			attr['mercGeom'] = gmxAPI.merc_geometry(node['geometry']);
			if(waitRedraw) {
				myLayer.options.attr = attr;
				waitRedraw();
			}
		}

		node['getLayerBounds'] = function() {				// Проверка границ растрового слоя
			if(!gmxNode || !attr['mercGeom']) return;
			var ext = null;
			if('getLayerBounds' in gmxNode) ext = gmxNode.getLayerBounds();
			else {
				var geo = gmxNode.getGeometry();
				if(!geo || !geo.type) {
					geo = attr['mercGeom'];
					var boundsMerc = gmxAPI.getBounds(geo.coordinates);
					ext = {
						minX: gmxAPI.from_merc_x(boundsMerc['minX']),
						minY: gmxAPI.from_merc_y(boundsMerc['minY']),
						maxX: gmxAPI.from_merc_x(boundsMerc['maxX']),
						maxY: gmxAPI.from_merc_y(boundsMerc['maxY'])
					};
				} else {
					ext = gmxAPI.getBounds(geo.coordinates);
					attr['mercGeom'] = gmxAPI.merc_geometry(geo);
				}
			}
			
			var	bounds = new L.Bounds();
			bounds.extend(new L.Point(ext.minX, ext.minY ));
			bounds.extend(new L.Point(ext.maxX, ext.maxY ));
			attr['bounds'] = bounds;
		}

		var chkVisible = function() {
			if(!gmxNode) return;
			if(node.isVisible != false) {
				var notOnScene = true;
				var continuousWorld = false;
				if(node['leaflet']) {
					if(node['leaflet']._map) notOnScene = false;
					continuousWorld = node['leaflet'].options.continuousWorld;
				}
				if(!continuousWorld && !attr['bounds']) {
					node['getLayerBounds']();
				}

				var notOnScene = (node['leaflet'] && node['leaflet']._map ? false : true);
				var notViewFlag = (!utils.chkVisibilityByZoom(id)
					|| (!continuousWorld && !utils.chkBoundsVisible(attr['bounds']))
					);
				
				if(notOnScene != notViewFlag) {
					utils.setVisibleNode({'obj': node, 'attr': !notViewFlag});
					if(notViewFlag)	delete gmxAPI._leaflet['renderingObjects'][node.id];
				}
			}
		}

		node['remove'] = function() {				// Удалить растровый слой
			if(myLayer) LMap.removeLayer(myLayer);
		}

		node['setStyle'] = function() {
			var newOpacity = node.regularStyle.fillOpacity;
			if(newOpacity != myLayer.options.opacity) {			// Изменить opacity растрового слоя
				myLayer.options.opacity = newOpacity;
				myLayer.setOpacity(newOpacity);
			}
		}
		node.onZoomend = function()	{				// Проверка видимости по Zoom
//console.log('_onZoomend: ', node.id);
			chkVisible();
		}

		var redrawTimer = null;										// Таймер
		var waitRedraw = function()	{								// Требуется перерисовка с задержкой
			if(redrawTimer) clearTimeout(redrawTimer);
			redrawTimer = setTimeout(function()
			{
				chkVisible();
				if(!node.isVisible || !node['leaflet'] || !node['leaflet']._map) return;
				redrawTimer = null;
				myLayer._update();
				//node['leaflet'].redraw();
			}, 10);
			return false;
		}
		node['waitRedraw'] = waitRedraw;
		//if(layer.properties && layer.properties.visible != false) node.isVisible = true;
		node.isVisible = (layer.properties && 'visible' in layer.properties ? layer.properties.visible : true);

		var chkInitListeners = function()	{								// Требуется перерисовка с задержкой
			var func = function(flag) {	// Изменилась видимость слоя
				if(flag) {
					if('nodeInit' in node) node['nodeInit']();
					chkVisible();
				}
			};
			var key = 'onChangeVisible';
			if(!node['listenerIDS'][key]) {
				node['listenerIDS'][key] = {'obj': gmxNode, 'evID': gmxNode.addListener(key, func, -10)};
			}
			if(node.isVisible) {
				func(node.isVisible);
			}
		}
		node['nodeInit'] =	function() {
			delete node['nodeInit'];

			var initCallback = function(obj) {			// инициализация leaflet слоя
				if(obj._container) {
					if(obj._container.id != id) obj._container.id = id;
					if(obj._container.style.position != 'absolute') obj._container.style.position = 'absolute';
					
					if(!'zIndex' in node) node['zIndex'] = utils.getIndexLayer(id) + node['zIndexOffset'];
					utils.bringToDepth(node, node['zIndex']);
					if(node['shiftY']) node['shiftY']();
					if(!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -85 && attr.bounds.max.x > 179 && attr.bounds.max.y > 85)) {
						delete obj.options['bounds'];
						obj.options.continuousWorld = true;
					}
					else {
						obj.options['bounds'] = new L.LatLngBounds([new L.LatLng(attr['bounds'].min.y, attr['bounds'].min.x), new L.LatLng(attr['bounds'].max.y, attr['bounds'].max.x)]);
					}
				}
			};
			var createLayer = function() {			// инициализация leaflet слоя
				if(!gmxNode) {
					gmxNode = gmxAPI.mapNodes[id];
					chkInitListeners();
				}
				var option = {
					'minZoom': 1
					,'maxZoom': 23
					,'minZ': inpAttr['minZoom'] || attr['minZoom'] || 1
					,'maxZ': inpAttr['maxZoom'] || attr['maxZoom'] || 21
					,'zIndex': node['zIndex']
					,'initCallback': initCallback
					,'tileFunc': inpAttr['func']
					,'attr': attr
					,'_needLoadTile': 0
					,'nodeID': id
					,'async': true
					,'unloadInvisibleTiles': true
					,'countInvisibleTiles': (L.Browser.mobile ? 0 : 2)
				};
				if(gmxNode.properties.type === 'Overlay') {
					node['isOverlay'] = true;
				} else {
					if(gmxNode.isBaseLayer) node['zIndexOffset'] = -100000;
				}
				if(!gmxNode.isBaseLayer && attr['bounds']) {
					option['bounds'] = new L.LatLngBounds([new L.LatLng(attr['bounds'].min.y, attr['bounds'].min.x), new L.LatLng(attr['bounds'].max.y, attr['bounds'].max.x)]);
				} else {
					option['continuousWorld'] = true;
				}

				if(node['subType'] === 'OSM') {
					node['shiftY'] = function() {
						myLayer.options.shiftY = utils.getOSMShift();
					}
					myLayer = new L.TileLayer.OSMcanvas(option);
				} else {
					myLayer = new L.TileLayer.ScanExCanvas(option);
				}
				node['leaflet'] = myLayer;
				var chkPosition = function() {
					chkVisible();
				}
				LMap.on('move', chkPosition);
				LMap.on('zoomend', chkPosition);
				chkVisible();
			}

			var createLayerTimer = null;										// Таймер
			var waitCreateLayer = function()	{								// Требуется перерисовка слоя с задержкой
				if(createLayerTimer) clearTimeout(createLayerTimer);
				createLayerTimer = setTimeout(function()
				{
					createLayerTimer = null;
					if(gmxAPI.map.needMove) {
						waitCreateLayer();
						return;
					}
					createLayer();
				}, 200);
			}
			if(gmxAPI.map.needMove) {
				waitCreateLayer();
			} else {
				createLayer();
			}
		}

		var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI
		var onLayerEventID = gmxNode.addListener('onLayer', function(obj) {	// Слой инициализирован
			gmxNode.removeListener('onLayer', onLayerEventID);
			gmxNode = obj;
			chkInitListeners();
		});
		if(node.isVisible && gmxNode && gmxNode.isVisible) chkInitListeners();
		
		return out;
	}
	// инициализация
	function init(arr)	{
		LMap = gmxAPI._leaflet['LMap'];
		utils = gmxAPI._leaflet['utils'];
		mapNodes = gmxAPI._leaflet['mapNodes'];

		function drawCanvasPolygon( ctx, x, y, lgeo, shiftY) {
			if(!lgeo) return;
			var tileSize = gmxAPI._leaflet['zoomCurrent']['tileSize'];
			//ctx.strokeStyle = 'rgba(0, 0, 255, 1)';
			ctx.beginPath();
			if(!shiftY) shiftY = 0;
			var drawPolygon = function(arr) {
				for (var j = 0; j < arr.length; j++)
				{
					var xx = (arr[j][0] / tileSize - x);
					var yy = (arr[j][1] / tileSize - y);
					var px = 256 * xx;						px = (0.5 + px) << 0;
					var py = 256 * (1 - yy) - shiftY;		py = (0.5 + py) << 0;
					if(j == 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
			}
			for(var i=0; i<lgeo.coordinates.length; i++) {
				var tarr = lgeo.coordinates[i];
				if(lgeo.type === 'MULTIPOLYGON') {
					for (var j = 0, len1 = lgeo.coordinates[i].length; j < len1; j++) {
						drawPolygon(lgeo.coordinates[i][j]);
					}
				} else {
					drawPolygon(lgeo.coordinates[i]);
				}
			}
			ctx.closePath();
			//ctx.stroke();
		}

		var drawTile = function (tile, tilePoint, zoom) {
			var node = mapNodes[tile._layer.options.nodeID];
			if(!zoom) zoom = LMap.getZoom();
			if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
			var pz = Math.pow(2, zoom);
			var tx = tilePoint.x;
			if(tx < 0) tx += pz;
			var scanexTilePoint = {
				'x': (tx % pz - pz/2) % pz
				,'y': -tilePoint.y - 1 + pz/2
			};
			var tileKey = tilePoint.x + ':' + tilePoint.y;
			var drawTileID = zoom + '_' + scanexTilePoint.x + '_' + scanexTilePoint.y;
			var layer = this;
			var chkDrawn = function() {
				if(layer.options._needLoadTile < 1) {
					delete gmxAPI._leaflet['renderingObjects'][layer.options.nodeID];
					utils.waitChkIdle(0, 'RasterLayer ' + layer._animating);					// Проверка отрисовки карты
				}
			}
			var deleteTile = function () {
				if('_resetLoad' in tile) tile._resetLoad();
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;
				layer._removeTile(tileKey);
				chkDrawn();
			}
			if(node['failedTiles'][drawTileID]) {
				if(this.options.bounds) {
					deleteTile();
				}
				return;		// второй раз 404 тайл не запрашиваем
			}
			tile.id = 't' + drawTileID;
			var attr = this.options.attr;
			var ctx = null;
			var flagAll = false;
			var flagAllCanvas = false;
			var shiftY = (this.options.shiftY ? this.options.shiftY : 0);		// Сдвиг для OSM
			if(shiftY !== 0) {
				// сдвиг для OSM
				var tilePos = tile._leaflet_pos;
				tilePos.y += shiftY;
				L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
			}

			if(!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -85 && attr.bounds.max.x > 179 && attr.bounds.max.y > 85)) {
				flagAll = true;
			}
			if(gmxAPI.isMobile) tile.style.webkitTransform += ' scale3d(1.003, 1.003, 1)';
			//		ctx.webkitImageSmoothingEnabled = false;
			var src = this.options.tileFunc(scanexTilePoint.x, scanexTilePoint.y, zoom);
			gmxAPI._leaflet['renderingObjects'][this.options.nodeID] = 1;
			layer.options._needLoadTile++;
			if(flagAll) {
				tile.onload = function() {
					tile.id = drawTileID;
					layer.tileDrawn(tile);
					layer.options._needLoadTile--;
					chkDrawn();
				};
				tile.onerror = function() {
					node['failedTiles'][drawTileID] = true;
					layer.options._needLoadTile--;
					chkDrawn();
				};
				tile.src = src;
			} else {
				var pResArr = null;				// точки границ растрового слоя
				pResArr = attr.mercGeom;

				var me = this;
				(function(points, sTilePoint, pTile) {
					var tID = drawTileID;
					var item = {
						'src': src
						,'zoom': zoom
						,'callback': function(imageObj) {
							pTile.id = tID;
							pTile.width = pTile.height = layer.options.tileSize;
							ctx = pTile.getContext('2d');
							var pattern = ctx.createPattern(imageObj, "no-repeat");
							ctx.fillStyle = pattern;
							if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
							if(pResArr) drawCanvasPolygon( ctx, sTilePoint.x, sTilePoint.y, pResArr, layer.options.shiftY);
							else ctx.fillRect(0, 0, 256, 256);
							ctx.fill();
							imageObj = null;
							layer.tileDrawn(pTile, 1);
							layer.options._needLoadTile--;
							chkDrawn();
						}
						,'onerror': function(){
							node['failedTiles'][tID] = true;
							pTile.id = tID + '_bad';
							layer.options._needLoadTile--;
							chkDrawn();
						}
					};
					pTile._resetLoad = function() {
						item.callback = L.Util.falseFn;
						item.onerror = L.Util.falseFn;
					};
					var gmxNode = gmxAPI.mapNodes[layer.options.nodeID];
					if(gmxNode && gmxNode.isBaseLayer) gmxAPI._leaflet['imageLoader'].unshift(item);	// базовые подложки вне очереди
					else gmxAPI._leaflet['imageLoader'].push(item);
				})(pResArr, scanexTilePoint, tile);
			}
		}
		var update = function () {
			if (!this._map) {
				var node = mapNodes[this.options.nodeID];
				node.waitRedraw();
				return;
			}

			var zoom = this._map.getZoom();
			if (zoom > this.options.maxZ || zoom < this.options.minZ) {
				delete gmxAPI._leaflet['renderingObjects'][this.options.nodeID];
				return;
			}
			if('initCallback' in this.options) this.options.initCallback(this);
			var bounds   = this._map.getPixelBounds(),
				tileSize = this.options.tileSize;

			var shiftY = (this.options.shiftY ? this.options.shiftY : 0);		// Сдвиг для OSM
			bounds.min.y -= shiftY;
			bounds.max.y -= shiftY;

			var nwTilePoint = new L.Point(
					Math.floor(bounds.min.x / tileSize),
					Math.floor(bounds.min.y / tileSize)),
				seTilePoint = new L.Point(
					Math.floor(bounds.max.x / tileSize),
					Math.floor(bounds.max.y / tileSize)),
				tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

			this._addTilesFromCenterOut(tileBounds);
			var countInvisibleTiles = this.options.countInvisibleTiles;
			tileBounds.min.x -= countInvisibleTiles; tileBounds.max.x += countInvisibleTiles;
			tileBounds.min.y -= countInvisibleTiles; tileBounds.max.y += countInvisibleTiles;

			if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
				this._removeOtherTiles(tileBounds);
			}
			if(this.options._needLoadTile < 1) delete gmxAPI._leaflet['renderingObjects'][this.options.nodeID];
		}

		// Растровый слой с маской
		L.TileLayer.ScanExCanvas = L.TileLayer.Canvas.extend(
		{
			_initContainer: function () {
				L.TileLayer.Canvas.prototype._initContainer.call(this);
			}
			,
			_createTileProto: function () {
				var attr = this.options.attr;
				if(!attr['bounds']) {
					var node = mapNodes[this.options.nodeID];
					node['getLayerBounds']();
				}
				var imgFlag = (!attr.bounds || (attr.bounds.min.x < -179 && attr.bounds.min.y < -85 && attr.bounds.max.x > 179 && attr.bounds.max.y > 85));
				if(imgFlag) {
					var img = this._canvasProto = L.DomUtil.create('img', 'leaflet-tile');
					//img.style.width = img.style.height = this.options.tileSize + 'px';
					//img.galleryimg = 'no';
				} else {
					var proto = this._canvasProto = L.DomUtil.create('canvas', 'leaflet-tile');
					proto.width = proto.height = 0;
				}
			}
			,'_update': update
			,'drawTile': drawTile
			,
			_clearBgBuffer: function () {
				if(!this._map || !this._bgBuffer) return;	// OriginalSin
				L.TileLayer.Canvas.prototype._clearBgBuffer.call(this);
			}
			,
			_getLoadedTilesPercentage: function (container) {
				// Added by OriginalSin
				if(!container) return 0;
				var len = 0, count = 0;
				var arr = ['img', 'canvas'];
				for (var key in arr) {
					var tiles = container.getElementsByTagName(arr[key]);
					if(tiles && tiles.length > 0) {
						len += tiles.length;
						for (var i = 0; i < tiles.length; i++) {
							if (tiles[i]._tileComplete) {
								count++;
							}
						}
					}
				}
				if(len < 1) return 0;
				return count / len;	
			}
			,
			tileDrawn: function (tile, cnt) {				// cnt = количество отрисованных обьектов в тайле
				this._tileOnLoad.call(tile);
				tile._tileComplete = true;					// Added by OriginalSin
				tile._needRemove = (cnt > 0 ? false : true);
			}
			,
			_reset: function (e) {
				var tiles = this._tiles;

				for (var key in tiles) {
					var tile = tiles[key];
					if('_resetLoad' in tile) tile._resetLoad();
					tile.onload = L.Util.falseFn;
					tile.onerror = L.Util.falseFn;
					this.fire('tileunload', {tile: tile});
				}

				this._tiles = {};
				this._tilesToLoad = 0;
				this.options._needLoadTile = 0;
				if (this.options.reuseTiles) {
					this._unusedTiles = [];
				}

				this._tileContainer.innerHTML = "";

				if (this._animated && e && e.hard) {
					this._clearBgBuffer();
				}

				this._initContainer();
			}
			,
			_removeTile: function (key) {
				var tile = this._tiles[key];

				this.fire("tileunload", {tile: tile, url: tile.src});

				if (this.options.reuseTiles) {
					L.DomUtil.removeClass(tile, 'leaflet-tile-loaded');
					this._unusedTiles.push(tile);

				} else if (tile.parentNode === this._tileContainer) {
					this._tileContainer.removeChild(tile);
				}

				// for https://github.com/CloudMade/Leaflet/issues/137
				if (!L.Browser.android) {
					if('_resetLoad' in tile) tile._resetLoad();
					tile.onload = L.Util.falseFn;
					tile.onerror = L.Util.falseFn;
					tile.src = L.Util.emptyImageUrl;
				}

				delete this._tiles[key];
			}
		});

		// Растровый для OSM
		L.TileLayer.OSMcanvas = L.TileLayer.ScanExCanvas;
	}
		
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['setBackgroundTiles'] = setBackgroundTiles;				// Добавить растровый слой
})();
;/* ======================================================================
    VectorLayer.js
   ====================================================================== */

// векторный слой
(function()
{
	var LMap = null;						// leafLet карта
	var utils = null;						// утилиты для leaflet
	var mapNodes = null;					// Хэш нод обьектов карты - аналог MapNodes.hx

	// Добавить векторный слой
	function setVectorTiles(ph)	{
		if(!LMap) init();
		var out = {};
		var layer = ph.obj;
		var id = layer.objectId;
		var node = mapNodes[id];
		if(!node) return;						// Нода не определена
		//var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI

		node['type'] = 'VectorLayer';
		node['minZ'] = 1;
		node['maxZ'] = 21;
		node['flipEnabled'] = true;				// По умолчанию ротация обьектов слоя установлена

		node['tilesVers'] = {};
		node['tiles'] = null;
		//node['observeVectorLayer'] = null;
		node['observerNode'] = null;
		
		node['needParse'] = [];
		node['parseTimer'] = 0;
		node['filters'] = [];
		//node['dataTiles'] = {};
		
		node['propHiden'] = {};					// Свойства внутренние
		//node['tilesRedrawTimers'] = {};			// Таймеры отрисовки тайлов
		node['tilesRedrawImages'] = {};			// Отложенные отрисовки растров по тайлам
		node['tilesKeys'] = {};					// Соответсвие текущих ключей тайлов
		node['waitStyle'] = true;				// Ожидание инициализации стилей слоя

		node['tilesNeedRepaint'] = [];			// Отложенные отрисовки тайлов
		node['hoverItem'] = null;				// Обьект hover
		node['listenerIDS'] = {};				// id прослушивателей событий
		node['tilesLoaded'] = {};
		node['tilesLoadProgress'] = {};
		node['loaderFlag'] = true;
		node['badTiles'] = {};
		node['tilesGeometry'] = {};				// Геометрии загруженных тайлов по z_x_y
		node['addedItems'] = []					// Геометрии обьектов добавленных в векторный слой
		node['objectsData'] = {};				// Обьекты из тайлов по identityField
		node['objectCounts'] = 0;				// Текущее колич.обьектов
		//node['clustersFlag'] = false;			// Признак кластеризации на слое
		node['clustersData'] = null;			// Данные кластеризации

		node['zIndexOffset'] = 100000;
		node['editedObjects'] = {};
		node['mousePos'] = {};					// позиция мыши в тайле
//		node['tilesDrawing'] = {};				// список отрисованных тайлов в текущем Frame
		node['zIndex'] = utils.getIndexLayer(id);
		node['quicklookZoomBounds'] = {			//ограничение по зуум квиклуков
			'minZ': 1
			,'maxZ': 21
		};
		
		node['propHiden']['rasterView'] = '';		// Показывать растры в КР только по Click	// setAPIProperties
		//gmxAPI._cmdProxy('setAPIProperties', { 'obj': obj, 'attr':{'rasterView': 'onCtrlClick'} });
		
		if(!layer['properties']) layer['properties'] = {};
		if(layer.properties['rasterView']) {
			node['propHiden']['rasterView'] = layer.properties['rasterView'];
		}
		layer.properties['visible'] = ('visible' in layer.properties ? layer.properties['visible'] : true);
		node['tileRasterFunc'] = null;			// tileFunc для квиклуков
		
		node['flipIDS'] = [];					// Массив обьектов flip сортировки
		node['flipedIDS'] = [];					// Массив обьектов вне сортировки
		node['flipHash'] = {};					// Hash обьектов flip сортировки
		
		node['flipNum'] = 0;					// Порядковый номер flip
		
		// накладываемое изображения с трансформацией
		if(layer.properties['Quicklook']) {
			//node['quicklook'] = layer.properties['Quicklook'];
		}
		//node['labels'] = {};					// Хэш label слоя
		//node['labelsBounds'] = [];				// Массив отрисованных label

		// Получить properties обьекта векторного слоя
		function getPropItem(item)	{
			return (item['properties'] ? item['properties']
				: (node['objectsData'][item.id] ? node['objectsData'][item.id]['properties']
				: {}
				));
		}
		node['getPropItem'] = getPropItem;

		var chkBoundsDelta = function(tb, b) {		// пересечение bounds с тайлом c delta
			if(!tb || !b) return false;
			var delta = tb.delta;
			return (
				   tb.min.x - delta > b.max.x
				|| tb.max.x + delta < b.min.x
				|| tb.min.y - delta > b.max.y
				|| tb.max.y + delta < b.min.y
			? false : true);
		}

		var chkPointDelta = function(tb, p) {		// пересечение point с тайлом c delta
			if(!tb || !p) return false;
			var delta = tb.delta;
			return (
				   tb.min.x - delta > p.x
				|| tb.max.x + delta < p.x
				|| tb.min.y - delta > p.y
				|| tb.max.y + delta < p.y
			? false : true);
		}

		// Проверка фильтра видимости
		var chkSqlFuncVisibility = function(item)	{
			var flag = true;
			if('_isSQLVisibility' in item.propHiden) {
				flag = item.propHiden['_isSQLVisibility'];
			} else {
				if(node['_sqlFuncVisibility']) {
					var prop = getPropItem(item);
					if(!node['_sqlFuncVisibility'](prop) && !node['_sqlFuncVisibility'](item.propHiden)) flag = false;
				}
				item.propHiden['_isSQLVisibility'] = flag;
			}
			return flag;
		}
		node['chkSqlFuncVisibility'] = chkSqlFuncVisibility;

		node['getMinzIndex'] = function() {
			var zIndexMin = 1000000;
			var pNode = mapNodes[node.parentId];
			for (var i = 0; i < pNode.children.length; i++) {
				var tNode = mapNodes[pNode.children[i]];
				if(tNode && tNode['type'] === 'VectorLayer' && tNode.zIndex < zIndexMin) zIndexMin = tNode.zIndex;
			}
			zIndexMin--;
			return zIndexMin;
		}

		node['getMaxzIndex'] = function() {
			var zIndexMax = 0;
			var pNode = mapNodes[node.parentId];
			for (var i = 0; i < pNode.children.length; i++) {
				var tNode = mapNodes[pNode.children[i]];
				if(tNode && tNode.zIndex > zIndexMax) zIndexMax = tNode.zIndex;
			}
			zIndexMax++;
			return zIndexMax;
		}
		node['setVisibilityFilter'] = function() {
			//var currZ = LMap.getZoom();
			//delete node['tilesRedrawImages'][currZ];
			
			reCheckFilters();
			//upDateLayer();
			node.redrawTilesList(40);
		}

		var inpAttr = ph.attr;
		node['subType'] = (inpAttr['filesHash'] ? 'Temporal' : '');
		
		if(layer.properties['IsRasterCatalog']) {
			node['IsRasterCatalog'] = true;
			node['rasterCatalogTilePrefix'] = layer['tileSenderPrefix'];
		}

		node['setSortItems'] = function(func) {
			node['sortItems'] = func;
			waitRedraw();
		}

		node['getGeometryType'] = function (itemId) {				// Получить geometry.type обьекта векторного слоя
			var item = node['objectsData'][itemId];
			return (item ? item.type : null);
		}
		node['getItemGeometry'] = function (itemId) {				// Получить geometry обьекта векторного слоя
			var item = node['objectsData'][itemId];
			if(!item) return null;
			var geom = null;
			for(var tileID in item.propHiden['fromTiles']) {
				var arr = (tileID == 'addItem' ? node['addedItems'] : node['tilesGeometry'][tileID]);	// Обьекты тайла
				if(arr && arr.length) {
					for (var i = 0; i < arr.length; i++) {
						var it = arr[i];
						if(it.id == itemId) {
							var vgeo = it.exportGeo();
							if(!geom) geom = gmxAPI.clone(vgeo);
							else {
								if(geom.type.indexOf('MULTI') == -1) {
									geom.type = 'MULTI' + geom.type;
									geom.coordinates = [geom.coordinates];
								}
								if(vgeo.type.indexOf('MULTI') == -1) {
									geom.coordinates.push(vgeo.coordinates);
								} else {
									for (var j = 0; j < vgeo.coordinates.length; j++) geom.coordinates.push(vgeo.coordinates[j]);
								}
							}
							break;
						}
					}
				}
			}
			if(geom) geom = gmxAPI.from_merc_geometry(geom);
			return geom;
		}
		node['getFeatureById'] = function (attr) {					// Получить Feature обьекта векторного слоя
			var itemId = attr['fid'];
			var item = node['objectsData'][itemId];
			var resOut = function () {					// Получить Feature обьекта векторного слоя
				var geom = node['getItemGeometry'](itemId);
				item = node['objectsData'][itemId];
				var ret = new gmxAPI._FlashMapFeature(geom, getPropItem(item), gmxNode);
				if(attr.func) attr.func(ret);
			}
			if(item) {
				resOut();
			} else {
				var currListenerID = gmxAPI._listeners.addListener({'level': 10, 'eventName': 'onTileLoaded', 'obj': gmxNode, 'func': function(ph) {
					if(node.getLoaderFlag()) return;
					gmxNode.removeListener('onTileLoaded', currListenerID); currListenerID = null;
					resOut();
				}});
				var ext = {	minX: -Number.MAX_VALUE, minY: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, maxY: Number.MAX_VALUE };
				node['loadTilesByExtent'](ext);
			}
		}
/*		
		var getItemsFromTileByBounds = function(items, bounds) {			// получить обьекты из тайла по bounds(Mercator)
			var arr = [];
			if(items && items.length > 0) {
				for (var i = 0; i < items.length; i++)
				{
					var item = items[i];
					if(!item.bounds.intersects(bounds)) continue;					// обьект не пересекает границы тайла
					arr.push(item);
				}
			}
			return arr;
		}
		var getItemsByBounds = function(bounds) {			// получить обьекты из тайлов векторного слоя по bounds(Mercator)
			var arr = [];
			arr = getItemsFromTileByBounds(node['addedItems'], bounds);
			var tiles = node.getTilesBoundsArr();
			for (var tileID in tiles)
			{
				var tileBound = tiles[tileID];
				if(tileBound.intersects(bounds)) {
					var iarr = node['tilesGeometry'][tileID];
					if(iarr && iarr.length > 0) {
						var items = getItemsFromTileByBounds(iarr, bounds);
						if(items.length) arr = arr.concat(items);
					}
				}
			}
			return arr;
		}
*/
		node['getMaxTilesList'] = function () {					// Получить максимальный список тайлов
			var out = [];
			if(gmxNode._temporalTiles) {
				var temporalTiles = gmxNode._temporalTiles;
				var pt = temporalTiles.getDateIntervalTiles(new Date('01/01/1980'), new Date(), temporalTiles.temporalData);
				out = pt['files'];
			} else {
				var arr = gmxNode.properties.tiles;
				var tilesVers = gmxNode.properties.tilesVers;
				var cnt = 0;
				for (var i = 0, len = arr.length; i < len; i+=3) {
					var st = option.tileFunc(Number(arr[i]), Number(arr[i+1]), Number(arr[i+2]));
					out.push(st + '&v=' + tilesVers[cnt++]);
				}
			}
			return out;
		};
		
		node['getFeatures'] = function (attr) {					// Получить данные векторного слоя по bounds геометрии
			var extent = null;		// По умолчанию нет ограничения по bounds
			if(attr.geom) {
				var geoMerc = gmxAPI.merc_geometry(attr.geom ? attr.geom : { type: "POLYGON", coordinates: [[-180, -89, -180, 89, 180, 89, 180, -89]] });
				extent = gmxAPI.getBounds(geoMerc.coordinates);
			}
			var resOut = function (arr) {					// Получить Feature обьекта векторного слоя
				var pt = {};
				for (var i = 0, len = arr.length; i < len; i++) {
					var item = arr[i];
					var id = item.id;
					var prop = item.properties;
					var geom = item.geometry;
					var ritem = {'properties': prop, 'geometry': geom};
					if(pt[id]) {							// повтор ogc_fid
						ritem = pt[id];
						if(ritem.geometry['type'].indexOf('MULTI') == -1) {
							ritem.geometry['type'] = 'MULTI' + ritem.geometry['type'];
							ritem.geometry.coordinates = [ritem.geometry.coordinates];
						}
						var coords = geom.coordinates;
						if(geom['type'].indexOf('MULTI') == -1) {
							coords = [geom.coordinates];
						}
						for (var j = 0, len = coords.length; j < len; j++) ritem.geometry.coordinates.push(coords[j]);
					}
					pt[id] = ritem;
				}
				var ret = [];
				for (var id in pt) {
					var item = pt[id];
					if(extent) {
						var itemExtent = gmxAPI.getBounds(item.geometry.coordinates);
						if(!gmxAPI.extIntersect(itemExtent, extent)) continue;
					}
					ret.push(new gmxAPI._FlashMapFeature(gmxAPI.from_merc_geometry(item.geometry), item.properties, gmxNode));
				}
				pt = arr = null;
				attr.func(ret);
			}
			var arr = node['getMaxTilesList']();
			node['loadTiles'](arr, {'callback': resOut});
		}
		node['loadTiles'] = function (arr, attr) {				// Загрузка списка тайлов
			var item = {
				'srcArr': arr
				,'layer': node.id
				,'callback': attr['callback']
				,'onerror': function(err){						// ошибка при загрузке тайла
					attr['callback']([]);
				}
			};
			gmxAPI._leaflet['vectorTileLoader'].push(item);
		}
		
		//node['shiftY'] = 0;						// Сдвиг для ОСМ вкладок
		node['setObserver'] = function (pt) {				// Установка получателя видимых обьектов векторного слоя
			node['observerNode'] = pt.obj.objectId;
			var ignoreVisibilityFilter = pt.attr.ignoreVisibilityFilter || false;		// отменить контроль фильтра видимости
			var callback = pt.attr.func;
//console.log('setObserver ', ignoreVisibilityFilter, node.id, node['observerNode']);

			var observerTiles = {};
			var observerObj = {};
			node['chkRemovedTiles'] = function(dKey) {		// проверка при удалении тайлов
				var out = [];
				var items = node['tilesGeometry'][dKey];
				if(items && items.length > 0) {
					for (var i = 0; i < items.length; i++)
					{
						var item = items[i];
						var pid = item['id'];
						if(observerObj[pid]) {
							var ph = {'layerID': node.id, 'properties': getPropItem(item) };
							ph.onExtent = false;
							ph.geometry = node['getItemGeometry'](pid);
							//ph.geometry = item.exportGeo();
							out.push(ph);
							delete observerObj[pid];
						}
					}
				}
				delete observerTiles[dKey];
				if(out.length) {
					callback(out);
				}
			}
			node['chkObserver'] = function () {				// проверка изменений видимости обьектов векторного слоя
				var currPosition = gmxAPI.currPosition;
				if(!currPosition || !currPosition.extent) return;
				var ext = currPosition.extent;
				var out = [];

				var tiles = node.getTilesBoundsArr();
				for (var key in tiles)
				{
					var tb = tiles[key];
					var tvFlag = (tb.max.x < ext.minX || tb.min.x > ext.maxX || tb.max.y < ext.minY || tb.min.y > ext.maxY);
					if(tvFlag) {								// Тайл за границами видимости
						if(!observerTiles[key]) continue;
						delete observerTiles[key];
					} else {
						observerTiles[key] = true;
					}
					var items = node['tilesGeometry'][key];
					if(items && items.length > 0) {
						for (var i = 0; i < items.length; i++)
						{
							var item = items[i];
							if(TemporalColumnName && !node.chkTemporalFilter(item)) continue;														// не прошел по мультивременному фильтру
							if(!item['propHiden'] || !item['propHiden']['toFilters'] || item['propHiden']['toFilters'].length == 0) continue;	// обьект не виден по стилевым фильтрам
							
							var prop = getPropItem(item);
							if(!ignoreVisibilityFilter && !chkSqlFuncVisibility(item)) continue; 	// если фильтр видимости на слое не отменен
							
							var pid = item.id;
							var vFlag = (item.bounds.max.x < ext.minX || item.bounds.min.x > ext.maxX || item.bounds.max.y < ext.minY || item.bounds.min.y > ext.maxY);
							var ph = {'layerID': node.id, 'properties': prop };
							if(vFlag) {					// Обьект за границами видимости
								if(observerObj[pid]) {
									ph.onExtent = false;
									ph.geometry = node['getItemGeometry'](pid);
									//ph.geometry = item.exportGeo();
									out.push(ph);
									delete observerObj[pid];
								}
							} else {
								if(!observerObj[pid]) {
									ph.onExtent = true;
									//ph.geometry = item.exportGeo();
									ph.geometry = node['getItemGeometry'](pid);
									out.push(ph);
									var tilesKeys = {};
									tilesKeys[key] = true;
									observerObj[pid] = { 'tiles': tilesKeys , 'item': item };
								}
							}
						}
					}
				}
				if(out.length) {
					//callback(gmxAPI.clone(out));
					callback(out);
				}
			}
			var key = 'onMoveEnd';
			node['listenerIDS'][key] = {'obj': gmxNode.map, 'evID': gmxAPI.map.addListener(key, node['chkObserver'], 11)};
			//gmxAPI._listeners.addListener({'level': 11, 'eventName': 'onMoveEnd', 'obj': gmxAPI.map, 'func': node['chkObserver']});
		};

		node.getLoaderFlag = function()	{							// Проверка необходимости загрузки тайлов
			node['loaderFlag'] = false;
			for (var pkey in node['tilesLoadProgress'])
			{
				node['loaderFlag'] = true;
				break;
			}
			return node['loaderFlag'];
		};

		node.addTilesNeedRepaint = function(drawTileID)	{			// Добавить тайл в список отрисовки
			if(!node['tilesNeedRepaint'][drawTileID]) {
				node['tilesNeedRepaint'].push(drawTileID);
				node['tilesNeedRepaint'][drawTileID] = true;
			}
			//node.repaintTilesNeed(10);
		};

		node.chkLoadTile = function(tilePoint, zoom)	{							// Проверка необходимости загрузки тайлов
			if(node['isVisible'] === false) return true;								// Слой не видим
			if(gmxAPI._leaflet['zoomstart']) {
				//myLayer._markTile(tilePoint, 1);
				node.reloadTilesList(100);
				return true;
			}

			var currZ = LMap.getZoom();
			if(currZ < node['minZ'] || currZ > node['maxZ'])  return true;				// Неподходящий zoom

			if(!zoom) zoom = currZ;

			var flag = node['loadTilesByExtent'](null, tilePoint);
			if(!flag) {
				var attr = getTileAttr(tilePoint, zoom);
				node.addTilesNeedRepaint(attr.drawTileID);
				node.repaintTilesNeed(20);
				//node.repaintTile(tilePoint, true);
			}
			return flag;
		};

		var chkBorders_old = function(tb, scanexTilePoint)	{		// Проверка соседних тайлов
			for (var i = -1; i < 2; i++)
			{
				var xx = scanexTilePoint.x + i;
				for (var j = -1; j < 2; j++)
				{
					var yy = scanexTilePoint.y + j;
					if(utils.getTileBoundsMerc({ 'x': xx ,'y': yy }).intersects(tb)) return i + '_' + j;
				}
			}
			return '';
		};

		var chkBorders = function(tb, attr)	{		// Проверка соседних тайлов
			var tileSize = attr.tileSize, tminx = attr.bounds.min.x - tileSize, tminy = attr.bounds.min.y - tileSize,
				tmaxx = attr.bounds.max.x + tileSize, tmaxy = attr.bounds.max.y + tileSize;
			if(tb.min.x > tmaxx || tb.max.x < tminx || tb.min.y > tmaxy || tb.max.y < tminy) return false;
			return true;
		};

		node['loaderDrawFlags'] = {};

		node['loadTilesByExtent'] = function(ext, tilePoint)	{		// Загрузка векторных тайлов по extent
			var flag = false;
			var attr = (ext ? null : getTileAttr(tilePoint));

			var tiles = node.getTilesBoundsArr();
			for (var tID in tiles)
			{
				if(node['tilesGeometry'][tID] || node['badTiles'][tID]) continue;

				var tb = tiles[tID];
				if(ext) {
					var tvFlag = (tb.max.x < ext.minX || tb.min.x > ext.maxX || tb.max.y < ext.minY || tb.min.y > ext.maxY);
					if(tvFlag) continue;								// Тайл за границами видимости
				} else {
					if(typeGeo === 'point') {
						//if(!chkBorders_old(tb, attr.scanexTilePoint)) continue;		// Тайл не пересекает drawTileID + соседние тайлы
						if(!chkBorders(tb, attr)) continue;		// Тайл не пересекает drawTileID + соседние тайлы
					} else {
						if(!attr['bounds'].intersects(tb)) continue;		// Тайл не пересекает drawTileID
					}
					if(!node['loaderDrawFlags'][tID]) node['loaderDrawFlags'][tID] = [];
					node['loaderDrawFlags'][tID].push(attr['drawTileID']);
				}

				flag = true;
				if(node['tilesLoadProgress'][tID]) continue;
				(function(stID, drawFlag) {
					var drawMe = null;
					if(drawFlag) {
						drawMe = function() {
							var tarr = node['loaderDrawFlags'][stID];
if(!tarr) {		// список тайлов был обновлен - без перерисовки
	//node.reloadTilesList(200);
	return;
}
							//var queueFlags = {};
							for (var i = 0; i < tarr.length; i++)
							{
								var drawTileID = tarr[i];
								node.addTilesNeedRepaint(drawTileID);
								//node['tilesNeedRepaint'].push(drawTileID);
								/*
								var ptt = node['tilesKeys'][drawTileID];
								for(var tKey in ptt) {
									//if(!queueFlags[tKey]) node.repaintTile(ptt[tKey], true);
									queueFlags[tKey] = true;
								}*/
							}
							//queueFlags = null;
							delete node['loaderDrawFlags'][stID];
							node.repaintTilesNeed(200);
						}
					}
					var arr = stID.split('_');
					var srcArr = option.tileFunc(Number(arr[1]), Number(arr[2]), Number(arr[0]));
					if(typeof(srcArr) === 'string') {
						if(stID in node['tilesVers']) srcArr += '&v=' + node['tilesVers'][stID];
						srcArr = [srcArr];
					}
					node['loaderFlag'] = true;
					var item = {
						'srcArr': srcArr
						,'layer': node.id
						,'callback': function(data) {
							delete node['tilesLoadProgress'][stID];
							gmxAPI._listeners.dispatchEvent('onTileLoaded', gmxNode, {'obj':gmxNode, 'attr':{'data':{'tileID':stID, 'data':data}}});		// tile загружен
							data = null;
							if(drawMe) drawMe();
						}
						,'onerror': function(err){						// ошибка при загрузке тайла
							delete node['tilesLoadProgress'][stID];
							node['badTiles'][stID] = true;
							gmxAPI.addDebugWarnings(err);
							if(drawMe) drawMe();
							//else waitRedraw(100);
							//node.waitRedrawTile(node['loaderDrawFlags'][tkey], 200);
						}
					};
					gmxAPI._leaflet['vectorTileLoader'].push(item);
					node['tilesLoadProgress'][stID] = true;
				})(tID, (ext ? false : true));
			}
			return flag;
		};

		var getTilesByVisibleExtent = function() {			// Получить тайлы векторного слоя по видимому extent
			var currPos = gmxAPI.currPosition || map.getPosition();
			var ext = {	minX: -Number.MAX_VALUE, minY: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, maxY: Number.MAX_VALUE };
			node['loadTilesByExtent'](ext);
		}

		node['chkTemporalFilter'] = function (item) {				// проверка мультивременного фильтра
			if(TemporalColumnName && item['propHiden']) {
				if(!node['temporal'] || node['temporal']['ut1'] > item['propHiden']['unixTimeStamp'] || node['temporal']['ut2'] < item['propHiden']['unixTimeStamp']) {
					return false;
				}
			}
			return true;
		}
/*
		node['osmRasterFunc'] = function(x, y, z) {			// Получение URL для OSM растров
            var size = Math.pow(2, z - 1);
            return "http://tile2.maps.2gis.com/tiles?x="  + (x+ size) + "&y=" + (size - y - 1) + "&z=" + z + "&v=4";
		}
*/		
		node['setTiledQuicklooks'] = function(callback, minZoom, maxZoom, tileSenderPrefix) {			// установка тайловых квиклуков
			if(callback) node['tileRasterFunc'] = callback;
			if(minZoom) node['quicklookZoomBounds']['minZ'] = minZoom;
			if(maxZoom) node['quicklookZoomBounds']['maxZ'] = maxZoom;
			if(tileSenderPrefix) node['rasterCatalogTilePrefix'] = layer['tileSenderPrefix'];
		}
		
		node['setZoomBoundsQuicklook'] = function(minZ, maxZ) {			//ограничение по зуум квиклуков
			node['quicklookZoomBounds']['minZ'] = minZ;
			node['quicklookZoomBounds']['maxZ'] = maxZ;
		}
		var getItemsFromTile = function(items, mPoint) {			// получить обьекты из тайла
			var arr = [];
			if(items && items.length > 0) {
				for (var i = 0; i < items.length; i++)
				{
					var item = items[i];
					var pid = '_' + item.id;
					if(!item.propHiden['toFilters'] || !item.propHiden['toFilters'].length) continue;		// обьект не попал в фильтр
					if(!chkSqlFuncVisibility(item)) continue; 	// если фильтр видимости на слое не отменен
					
					if(node.chkTemporalFilter(item)) {
						if('contains' in item) {
							if(item['contains'](mPoint)) arr.push(item), arr[pid] = true;
						}
						else if(item.bounds.contains(mPoint)) arr.push(item), arr[pid] = true;
					}
				}
			}
			return arr;
		}
		var getItemsByPoint = function(latlng) {			// получить обьекты по пересечению с точкой
			var arr = [];
			var mPoint = new L.Point(gmxAPI.merc_x(latlng['lng']), gmxAPI.merc_y(latlng['lat']));
			arr = getItemsFromTile(node['addedItems'], mPoint);
			var tiles = node.getTilesBoundsArr();
			for (var tileID in tiles)
			{
				var tileBound = tiles[tileID];
				if(chkPointDelta(tileBound, mPoint)) {
					var iarr = node['tilesGeometry'][tileID];
					if(iarr && iarr.length > 0) {
						var items = getItemsFromTile(iarr, mPoint);
						if(items.length) arr = arr.concat(items);
					}
				}
			}
			return arr;
		}

		var getTKeysFromGmxTileID = function(tkeys, gmxTiles) {			// событие mouseOut
			for (var gmxTileID in gmxTiles) {
				for(var tKey in node['tilesKeys'][gmxTileID]) {
					tkeys[tKey] = true;
				}
			}
		}

		var mouseOut = function() {			// событие mouseOut
			if(node['hoverItem']) {
				gmxAPI._leaflet['LabelsManager'].remove(node.id, node['hoverItem'].geom.id);
				var zoom = LMap.getZoom();
				var drawInTiles = node['hoverItem'].geom.propHiden['drawInTiles'];
				if(drawInTiles && drawInTiles[zoom]) {
					var tilesNeed = {};
					getTKeysFromGmxTileID(tilesNeed, drawInTiles[zoom]);
					redrawTilesHash(tilesNeed, true);
				}
				gmxAPI._div.style.cursor = '';
				callHandler('onMouseOut', node['hoverItem'].geom, gmxNode);
				var filter = getItemFilter(node['hoverItem']);
				if(filter) callHandler('onMouseOut', node['hoverItem'].geom, filter);
				node['hoverItem'] = null;
			}
		}
		//gmxAPI.map.addListener('hideHoverBalloon', mouseOut);

		node['mouseMoveCheck'] = function(evName, ph) {			// проверка событий векторного слоя
			var onScene = (node['leaflet'] && node['leaflet']._map ? true : false);
			if(!node.isVisible 
				|| gmxAPI._drawing['activeState']
				|| !onScene
				|| gmxAPI._leaflet['moveInProgress']
				|| gmxAPI._leaflet['mousePressed']
				|| gmxAPI._leaflet['curDragState']
				|| gmxAPI._mouseOnBalloon) return false;
			//if(!node.isVisible || gmxAPI._drawing['activeState'] || !node['leaflet'] || node['leaflet']._isVisible == false || gmxAPI._leaflet['mousePressed'] || gmxAPI._leaflet['curDragState'] || gmxAPI._mouseOnBalloon) return false;
			var latlng = ph.attr['latlng'];
			var zoom = LMap.getZoom();
			var x = latlng['lng'] % 360;
			if(x < -180) x += 360;
			else if(x > 180) x -= 360;

			var tNums = gmxAPI.getTileFromPoint(x, latlng['lat'], zoom);
			var gmxTileID = tNums.z + '_' + tNums.x + '_' + tNums.y;
			var mPoint = new L.Point(gmxAPI.merc_x(x), gmxAPI.merc_y(latlng['lat']));
			var arr = tilesRedrawImages.getHoverItemsByPoint(gmxTileID, mPoint);
			
			if(arr && arr.length) {
				var item = getTopFromArrItem(arr);
				if(item) {
					hoverItem(item);
					return true;
				}
			}
			mouseOut();
			return false;
		};

		var callHandler = function(evName, geom, gNode, attr) {				// Вызов Handler для item
			var res = false;
			var rNode = mapNodes[gNode.objectId || gNode.id];
			if(rNode && rNode['handlers'][evName]) {			// Есть handlers на слое
				if(!attr) attr = {};
				attr['geom'] = node['getItemGeometry'](geom.id);
				attr[evName] = true;
				var prop = getPropItem(geom);
				res = rNode['handlers'][evName].call(gNode, geom.id, prop, attr);
			}
			return res;
		}
		node['watcherActive'] = false;
		node['watcherKey'] = '';						// Спец.клавиша включения подглядывателя
		node['watcherRadius'] = 40;						// Спец.клавиша включения подглядывателя
		node['setWatcher'] = function(ph) {				// Установка подглядывателя обьекта под Hover обьектом
			if(!ph) ph = {};
			node['watcherKey'] = ph['key'] || 'ctrlKey';
			node['watcherRadius'] = ph['radius'] || 40;
		}
		node['removeWatcher'] = function() {			// Удалить подглядыватель
			node['watcherKey'] = '';
		}

		var hoverItem = function(item) {				// Отрисовка hoveredStyle для item
			if(!item) return;
			if(!item.geom) {
				item = {'id': item.id, 'geom': item};
			}
			var itemId = item.geom.id;
			var propHiden = item.geom.propHiden;
			var zoom = LMap.getZoom();
			var hoveredStyle = null;
			var regularStyle = null;
			var filter = getItemFilter(item.geom);
			if(propHiden['subType'] != 'cluster') {
				if(filter) {
					hoveredStyle = (filter.hoveredStyle ? filter.hoveredStyle : null);
					regularStyle = (filter.regularStyle ? filter.regularStyle : null);
				}
			} else {
				//hoveredStyle = node['clustersData']['hoveredStyle'];
				regularStyle = node['clustersData']['regularStyle'];
				hoveredStyle = regularStyle;
			}
			if(hoveredStyle) {	// todo - изменить drawInTiles с учетом Z
				var isWatcher = (gmxAPI._leaflet['mouseMoveAttr'] && node['watcherKey'] && gmxAPI._leaflet['mouseMoveAttr'][node['watcherKey']]);
				var flagRedraw = (
					(!node['hoverItem'] || node['hoverItem'].geom.id != itemId) ?
					true :
					isWatcher || node['watcherActive']
					);
				node['watcherActive'] = isWatcher;
				if(flagRedraw) {
					var tilesNeed = {};
					if(node['hoverItem']) {
						var drawInTiles = node['hoverItem'].geom.propHiden['drawInTiles'];
						if(drawInTiles && drawInTiles[zoom]) {
							getTKeysFromGmxTileID(tilesNeed, drawInTiles[zoom]);
						}
						delete node['hoverItem'].geom['_cache'];
					}
					//delete item.geom['_cache'];
					node['hoverItem'] = item;
					item.geom.propHiden.curStyle = utils.evalStyle(hoveredStyle, item.geom.properties);
					
					var drawInTiles = propHiden['drawInTiles'];
					if(drawInTiles && drawInTiles[zoom]) {
						getTKeysFromGmxTileID(tilesNeed, drawInTiles[zoom]);
					}
					redrawTilesHash(tilesNeed, true);
					item.geom.propHiden.curStyle = utils.evalStyle(regularStyle, item.geom.properties);
					delete item.geom['_cache'];
					
					gmxAPI._div.style.cursor = 'pointer';
					if(gmxAPI._leaflet['isMouseOut']) return false;
					if(filter && callHandler('onMouseOver', item.geom, filter)) return true;
					if(callHandler('onMouseOver', item.geom, gmxNode)) return true;
				}
				return true;
			}
		}

		var getTopFromArrItem = function(arr) {				// Получить верхний item из массива с учетом flip
			if(!arr || !arr.length) return null;
			var ph = {};
			for (var i = 0; i < arr.length; i++) ph[arr[i].id || arr[i].geom.id] = i;
			var out = null;
			for (var i = node['flipedIDS'].length - 1; i >= 0; i--)
			{
				var tid = node['flipedIDS'][i];
				if(tid in ph) return arr[ph[tid]];
			}
			return arr[arr.length - 1];
		}

		var chkFlip = function(fid) {				// убираем дубли flip
			if(node['flipHash'][fid]) {
				for (var i = 0; i < node['flipedIDS'].length; i++)
				{
					if(fid == node['flipedIDS'][i]) {
						node['flipedIDS'].splice(i, 1);
						break;
					}
				}
			}
			node['flipedIDS'].push(fid);
			node['flipHash'][fid] = true;
		}
		
		node['addFlip'] = function(fid) {			// добавить обьект flip сортировки
			chkFlip(fid);
			node.redrawFlips(true);
			return node['flipedIDS'].length;
		}
		
		node['setFlip'] = function() {				// переместить обьект flip сортировки
			if(!node['flipIDS'] || !node['flipIDS'].length) return false;
			var vid = node['flipIDS'].shift();
			node['flipIDS'].push(vid);
			chkFlip(vid);

			if(node['tileRasterFunc']) {
				node.waitRedrawFlips(0);
			}
			var item = node['objectsData'][vid];
			if(!item) return null;
			var geom = node['getItemGeometry'](vid);
			var mObj = new gmxAPI._FlashMapFeature(geom, getPropItem(item), gmxNode);
			gmxAPI._listeners.dispatchEvent('onFlip', gmxNode, mObj);
			return item;
		}

		var getHandler = function(fid, evName) {			// Получить gmx обьект на котором установлен Handler
			var out = null;
			var item = node['objectsData'][fid];
			if(!item) return out;
			var itemPropHiden = item.propHiden;
			if(!itemPropHiden['toFilters'] || !itemPropHiden['toFilters'].length) return out;		// обьект не попал в фильтр
			var fID = itemPropHiden['toFilters'][0];
			var filter = gmxAPI.mapNodes[fID];
			if(filter && mapNodes[fID]['handlers'][evName]) {						// не найден фильтр
				out = filter;
			} else if(evName in node['handlers']) {						// Есть handlers на слое
				out = gmxNode;
			}
			return out;
		}

		var sortFlipIDS = function(arr) {			// Получить gmx обьект на котором установлен Handler
			var out = [];
			var pk = {};
			for (var i = 0; i < arr.length; i++) {
				var tid = arr[i].id || arr[i].geom.id;
				if(node['flipHash'][tid]) pk[tid] = true;
				else out.push(tid);
			}
			for (var i = 0; i < node['flipedIDS'].length; i++) {
				var tid = node['flipedIDS'][i];
				if(pk[tid]) out.push(tid);
			}
			return out;
		}
		
		var prevID = 0;
		var prevPoint = null;
		node['eventsCheck'] = function(evName, attr) {			// проверка событий векторного слоя
			var onScene = (node['leaflet'] && node['leaflet']._map ? true : false);
			if(evName !== 'onClick'
				|| gmxAPI._drawing['activeState']
				|| !onScene
				|| gmxAPI._leaflet['curDragState']) return false;

			//console.log('eventsCheck ' , evName, node.id, gmxAPI._leaflet['curDragState'], gmxAPI._drawing.tools['move'].isActive);

			//if(node['observerNode']) return false;
			if(!attr) attr = gmxAPI._leaflet['clickAttr'];
			if(!attr.latlng) return false;
			var latlng = attr.latlng;
			var arr = null;
			var zoom = LMap.getZoom();

			var x = latlng['lng'] % 360;
			if(x < -180) x += 360;
			else if(x > 180) x -= 360;
			var tNums = gmxAPI.getTileFromPoint(x, latlng['lat'], zoom);
			var gmxTileID = tNums.z + '_' + tNums.x + '_' + tNums.y;
			var mPoint = new L.Point(gmxAPI.merc_x(x), gmxAPI.merc_y(latlng['lat']));
			var arr = tilesRedrawImages.getHoverItemsByPoint(gmxTileID, mPoint);
			if(arr && arr.length) {
				//var toolsActive = (gmxAPI._drawing && !gmxAPI._drawing.tools['move'].isActive ? true : false);	// установлен режим рисования (не move)
				var needCheck = (!prevPoint || !attr.containerPoint || attr.containerPoint.x != prevPoint.x || attr.containerPoint.y != prevPoint.y);
				prevPoint = attr.containerPoint;
				if(needCheck) {
					node['flipIDS'] = sortFlipIDS(arr);
				}
				if(!node['flipIDS'].length) return false;
				var vid = node['flipIDS'][0];
				var item = arr[0];
				var oper = 'setFlip';
				var isCluster = (item.geom && item.geom.propHiden['subType'] == 'cluster' ? true : false);
				var itemPropHiden = null;
				var handlerObj = null;
				if(!isCluster) {
					var operView = false;
					if(attr.shiftKey && node['propHiden']['rasterView'] === 'onShiftClick') operView = true;
					else if(attr.ctrlKey && node['propHiden']['rasterView'] === 'onCtrlClick') operView = true;
					else if(node['propHiden']['rasterView'] === 'onClick') operView = true;
					
					vid = node['flipIDS'][node['flipIDS'].length - 1];
					handlerObj = getHandler(vid, evName);
					item = node['objectsData'][vid];
					if(node['flipEnabled'] && oper === 'setFlip') {
						item = node['setFlip']();
						if(!handlerObj && item.id === prevID) item = node['setFlip']();
					}
					if(!item) return true;
					vid = item.id;
					prevID = vid;
					itemPropHiden = item.propHiden;

					//console.log('flipIDS' , item.id);
					if(node['flipEnabled']) chkFlip(item.id);
					if(operView) {
						itemPropHiden['rasterView'] = !itemPropHiden['rasterView'];
						if(node['propHiden']['showOnlyTop']) {
							for (var i = 0; i < arr.length; i++) {
								if(arr[i].geom.id != item.id) {
									arr[i].geom.propHiden['rasterView'] = false;
									chkNeedImage(arr[i].geom);
								}
							}
						}
						chkNeedImage(item);
						
						if(node['propHiden']['stopFlag']) return true;
					}
				} else {
					itemPropHiden = item.geom.propHiden;
				}
				if(node['flipEnabled'] && oper === 'setFlip') {
					var hItem = getTopFromArrItem(arr);
					delete node['hoverItem'];
					if(hItem) hoverItem(hItem);
				}
				
				var eventPos = {
					'latlng': { 'x': latlng.lng, 'y': latlng.lat }
					,'pixelInTile': attr.pixelInTile
					,'tID': gmxTileID
				};
				var gmxAttr = attr;
				gmxAttr['layer'] = gmxNode;
				gmxAttr['eventPos'] = eventPos;
				
				if(!isCluster) {
					if(handlerObj) {
						callHandler('onClick', item, handlerObj, gmxAttr);
						return true;
					}
				} else {
					gmxAttr['objType'] = 'cluster';
					if(callHandler('onClick', item.geom, gmxNode, gmxAttr)) return true;
					var fID = itemPropHiden['toFilters'][0];
					var filter = gmxAPI.mapNodes[fID];
					gmxAttr['textFunc'] = filter.clusters.getTextFunc();
					if(filter && callHandler('onClick', item.geom, filter, gmxAttr)) return true;
				}
				return true;
			}
		}

		var getLatLngBounds = function(lb) {			// установка bounds leaflet слоя
			return new L.LatLngBounds([new L.LatLng(lb.min.y, lb.min.x), new L.LatLng(lb.max.y, lb.max.x)]);
		};

		var initCallback = function(obj) {			// инициализация leaflet слоя
			if(obj._container) {
				if(obj._container.id != id) obj._container.id = id;
				if(obj._container.style.position != 'absolute') obj._container.style.position = 'absolute';
				utils.bringToDepth(node, node['zIndex']);
			}
		};

		var attr = utils.prpLayerAttr(layer, node);
		if(attr['bounds']) node['bounds'] = attr['bounds'];
		node['minZ'] = inpAttr['minZoom'] || attr['minZoom'] || 1;
		node['maxZ'] = inpAttr['maxZoom'] || attr['maxZoom'] || 21
		var identityField = attr['identityField'] || 'ogc_fid';
		node['identityField'] = identityField;
		var typeGeo = attr['typeGeo'] || 'polygon';
		if(attr['typeGeo'] === 'polygon') {
			node['sortItems'] = function(a, b) {
				return Number(a.properties[identityField]) - Number(b.properties[identityField]);
			}
		}
		
		var TemporalColumnName = attr['TemporalColumnName'] || '';
		var option = {
			'minZoom': 1
			,'maxZoom': 23
			,'minZ': node['minZ']
			,'maxZ': node['maxZ']
			,'id': id
			,'identityField': identityField
			,'initCallback': initCallback
			,'async': true
			//,'reuseTiles': true
			//,'updateWhenIdle': true
			,'unloadInvisibleTiles': true
			,'countInvisibleTiles': 0
			//,'countInvisibleTiles': (L.Browser.mobile ? 0 : 2)
		};
		//if(!gmxAPI.mapNodes[id].isBaseLayer && node['bounds']) {
		//	option['bounds'] = getLatLngBounds(node['bounds']);
		//}

		if(node['parentId']) option['parentId'] = node['parentId'];

		// получить bounds списка тайлов слоя
		node.getTilesBounds = function(arr, vers) {
			if(!node['tiles']) node['tiles'] = {};
			var cnt = 0;
			for (var i = 0; i < arr.length; i+=3)
			{
				var x = Number(arr[i]) , y = Number(arr[i+1]) , z = Number(arr[i+2]);
				var st = z + '_' + x + '_' + y;
				var pz = Math.round(Math.pow(2, z - 1));
				var bounds = utils.getTileBounds({'x':x + pz, 'y':pz - 1 - y}, z);
				bounds.min.x = gmxAPI.merc_x(bounds.min.x);
				bounds.max.x = gmxAPI.merc_x(bounds.max.x);
				bounds.min.y = gmxAPI.merc_y(bounds.min.y);
				bounds.max.y = gmxAPI.merc_y(bounds.max.y);

				bounds.delta = 0;
				node['tiles'][st] = bounds;
			
				if(vers) {
					node['tilesVers'][st] = vers[cnt];
					cnt++;
				}
			}
			//return hash;
		}

		var versTiles = (node['subType'] === 'Temporal' ? null : layer.properties.tilesVers);
		option['attr'] = attr;
		option['tileFunc'] = inpAttr['tileFunction'];
	
		// получить массив bounds тайлов слоя
		node.getTilesBoundsArr = function() {
			if(!node['tiles']) node.getTilesBounds(inpAttr.dataTiles, versTiles);
			return node['tiles'];
		}
		
		var myLayer = null;

		var getItemFilter = function(item) {			// Получить фильтр в который попал обьект
			var filter = null;
			if(item) {
				var geom = item.geom || item;
				var propHiden = geom.propHiden;
				//if(!propHiden && item.geom && item.geom.propHiden) propHiden = item.geom.propHiden;
				var filters = propHiden['toFilters'];
				if(filters.length == 0) filters = chkObjectFilters(geom);
				filter = (filters && filters.length ? mapNodes[filters[0]] : null);
			}
			return filter;
		}
		
		function chkObjectFilters(geo, tileSize)	{				// Получить фильтры для обьекта
			var zoom = LMap.getZoom();
			var toFilters = [];

			delete geo.curStyle;
			delete geo['_cache'];
			for (var z in geo.propHiden['drawInTiles'])
			{
				if(z != zoom) delete geo.propHiden['drawInTiles'][z];
			}
			var curStyle = null;
			//var size = 4;
			var isViewPoint = (geo['type'] == 'Point' ? true : false);

			for(var j=0; j<node.filters.length; j++) {
				var filterID = node.filters[j];
				var filter = mapNodes[node.filters[j]];
				if(zoom > filter.maxZ || zoom < filter.minZ) continue;
				var prop = getPropItem(geo);

				var flag = (filter && filter.sqlFunction ? filter.sqlFunction(prop) : true);
				if(flag) {
					toFilters.push(filterID);
					//curStyle = (filter.regularStyle ? filter.regularStyle : null);
					if(filter.regularStyle) {
						curStyle = (filter.regularStyleIsAttr ? utils.evalStyle(filter.regularStyle, prop) : filter.regularStyle);
						//if(curStyle.size) size = curStyle.size + 2 * curStyle.weight;
						var scale = curStyle['scale'] || 1;
						if(curStyle.marker) {
							if(curStyle.imageWidth && curStyle.imageHeight) {
								geo['sx'] = curStyle.imageWidth;
								geo['sy'] = curStyle.imageHeight;
								//size = Math.sqrt(geo['sx']*geo['sx'] + geo['sy']*geo['sy']);
								isViewPoint = true;
							}
						}
						if(typeof(scale) == 'string') {
							scale = (curStyle['scaleFunction'] ? curStyle['scaleFunction'](prop) : 1);
						}
						if('minScale' in curStyle && scale < curStyle['minScale']) scale = curStyle['minScale'];
						else if('maxScale' in curStyle && scale > curStyle['maxScale']) scale = curStyle['maxScale'];
						//size *= scale;
						geo.propHiden.curStyle = curStyle;
						if('chkSize' in geo && !node['waitStyle']) geo['chkSize'](node, curStyle);
					}
					break;						// Один обьект в один фильтр 
				}
			}
			/*if(tileSize && isViewPoint) {
				var coord = geo['getPoint']();
				var xx = coord.x/tileSize;
				var yy = coord.y/tileSize;
				var tile = {
					'x':	Math.floor(xx)
					,'y':	Math.floor(yy)
					,'z':	zoom
					,'size': size
					,'posInTile': {
						'x': (xx < 0 ? 256 : 0) + 256 * (coord.x % tileSize) / tileSize
						,'y': (yy < 0 ? 256 : 0) + 256 * (coord.y % tileSize) / tileSize
					}
				};
				chkBorderTiles(geo, tile);
				//chkBorderTiles(geo, tile.x, tile.y);
			}*/
			geo.propHiden['toFilters'] = toFilters;
			geo.propHiden['_isFilters'] = (toFilters.length ? true : false);
			return toFilters;
		}

		function objectsToFilters(arr, tileID)	{				// Разложить массив обьектов по фильтрам
			var outArr = [];
			var zoom = LMap.getZoom();
			var tileSize = Math.pow(2, 8 - zoom) * 156543.033928041;
			var tiles = node.getTilesBoundsArr();

			for (var i = 0; i < arr.length; i++)
			{
				var ph = arr[i];
				if(!ph) return;
				var prop = ph['properties'];

				var id = ph['id'] || prop[identityField];
//if(id != 6797740) continue;	

				var propHiden = {};
				propHiden['fromTiles'] = {};
				propHiden['subType'] = 'fromVectorTile';
				var _notVisible = false;
				if(TemporalColumnName) {
					var zn = prop[TemporalColumnName] || '';
					zn = zn.replace(/(\d+)\.(\d+)\.(\d+)/g, '$2/$3/$1');
					var vDate = new Date(zn);
					var offset = vDate.getTimezoneOffset();
					var dt = Math.floor(vDate.getTime() / 1000  - offset*60);
					propHiden['unixTimeStamp'] = dt;
				}
				var tileBounds = null;
				if(tileID) {
					propHiden['tileID'] = tileID;
					propHiden['fromTiles'][tileID] = true;
					tileBounds = (tileID === 'addItem' ? utils.maxBounds() : tiles[tileID]);
				}
				//console.log('objectsData ' , ph, node['objectsData']);
			
				var geo = {};
				if(ph['geometry']) {
					if(!ph['geometry']['type']) ph['geometry']['type'] = typeGeo;
					geo = utils.fromTileGeometry(ph['geometry'], tileBounds);
					if(!geo) {
						gmxAPI._debugWarnings.push({'tileID': tileID, 'badObject': ph['geometry']});
						continue;
					}
					geo['id'] = id;
					outArr.push(geo);
					if(tileID === 'addItem') {
						node['bounds'].extend(new L.Point(gmxAPI.from_merc_x(geo.bounds.min.x), gmxAPI.from_merc_y(geo.bounds.min.y)));
						node['bounds'].extend(new L.Point(gmxAPI.from_merc_x(geo.bounds.max.x), gmxAPI.from_merc_y(geo.bounds.max.y)));
					}
				}
				var objData = {
					'id': id
					,'type': geo['type'].toUpperCase()
					,'properties': prop
					,'propHiden': propHiden
				};
				geo['propHiden'] = objData['propHiden'];
				geo['properties'] = objData['properties'];
				propHiden['toFilters'] = chkObjectFilters(geo, tileSize);

				if(node['objectsData'][id]) {		// Обьект уже имеется - нужна??? склейка геометрий
					var pt = node['objectsData'][id];
					if(objData['type'] != 'POINT' && objData['type'].indexOf('MULTI') == -1) pt['type'] = 'MULTI' + objData['type'];
					pt['propHiden']['fromTiles'][tileID] = true;
					geo['propHiden'] = pt['propHiden'];
				} else {
					node['objectsData'][id] = objData;
				}
			}
			arr = [];
			if(node['clustersData']) node['clustersData'].clear();
			return outArr;
		}

		var removeItems = function(data, inUpdate) {		// удаление обьектов векторного слоя 
			var needRemove = {};
			for (var index in data)
			{
				var pid = data[index];
				if(typeof(pid) === "object") pid = pid['id'];
				else if(pid === true) pid = index;
				needRemove[pid] = true;
				gmxAPI._leaflet['LabelsManager'].remove(node.id, pid);	// Переформировать Labels
				delete node['objectsData'][pid];
			}

			var arr = [];
			for (var i = 0; i < node['addedItems'].length; i++)
			{
				var item = node['addedItems'][i]; 
				if(!needRemove[item['id']]) arr.push(item);
			}
			node['addedItems'] = arr;

			for(var tileID in node['tilesGeometry']) {
				var arr = node['tilesGeometry'][tileID];	// Обьекты тайла
				if(arr && arr.length) {
					var arr1 = [];
					for (var i = 0; i < arr.length; i++) {
						var item = arr[i]; 
						if(!needRemove[item['id']]) arr1.push(item);
					}
					node['tilesGeometry'][tileID] = arr1;
				}
			}

			tilesRedrawImages.removeItems(needRemove);
			needRemove = {};
		}

		node['removeItems'] = function(data) {		// удаление обьектов векторного слоя 
			removeItems(data)
			if(node['clustersData']) node['clustersData'].clear();
			node.redrawTilesList(100)
		}
		node['addItems'] = function(data) {			// добавление обьектов векторного слоя
			removeItems(data)
			node['addedItems'] = node['addedItems'].concat(objectsToFilters(data, 'addItem'));
			if(node['clustersData']) node['clustersData'].clear();

			node.redrawTilesList(100)
			return true;
		}
		node['setEditObjects'] = function(attr) {	// Установка редактируемых обьектов векторного слоя
			if(attr.removeIDS) {
				var arr = [];
				for (var key in attr.removeIDS)
				{
					arr.push(key);
				}
				node['removeItems'](arr);
			}
			if(attr.addObjects) {
				node['removeItems'](attr.addObjects);
				node['addItems'](attr.addObjects);
				for (var i = 0; i < attr.addObjects.length; i++)
				{
					var item = attr.addObjects[i]; 
					node['editedObjects'][item.id] = true;
				}
			}
			return true;
		}

		var tilesRedrawImages = {						// Управление отрисовкой растров векторного тайла
			'getHoverItemsByPoint': function(gmxTileID, mPoint)	{				// Получить обьекты под мышкой
				var zoom = LMap.getZoom();
				var tKeys = node['tilesKeys'][gmxTileID];
				var out = [];
				for(var tKey in tKeys) {
					if(!node['tilesRedrawImages'][zoom] || !node['tilesRedrawImages'][zoom][tKey]) return [];
					var minDist = Number.MAX_VALUE;
					var mInPixel = gmxAPI._leaflet['mInPixel'];
					mInPixel *= mInPixel;

					var thash = node['tilesRedrawImages'][zoom][tKey];
					for (var i = 0; i < thash['arr'].length; i++)
					{
						var item = thash['arr'][i];
						var propHiden = item.geom['propHiden'];
						if(!propHiden['_isFilters']) continue;
						var drawInTiles = propHiden['drawInTiles'][zoom];
						var flag = false;
						for (var key in drawInTiles)
						{
							if(key == gmxTileID) {
								flag = true;
								break;
							}
						}
						if(!flag) continue;
						if('contains' in item.geom) {
							if(!item.geom['contains'](mPoint, null, item.src)) continue;
						}
						else if(!item.geom.bounds.contains(mPoint)) continue;

						var dist = minDist;
						if('distance2' in item.geom) {
							dist = item.geom['distance2'](mPoint);
							if(item.geom['isCircle'] && dist * mInPixel > item.geom['sx']*item.geom['sy']) continue;
						}
						if(dist < minDist) { out.unshift(item); minDist = dist; }
						else out.push(item);
					}
					return out;
				}
				return out;
			}
			,
			'getItemsByPoint': function(tID, mPoint)	{				// Получить обьекты под мышкой
				var zoom = LMap.getZoom();
				if(!node['tilesRedrawImages'][zoom] || !node['tilesRedrawImages'][zoom][tID]) return [];
				var minDist = Number.MAX_VALUE;
				var mInPixel = gmxAPI._leaflet['mInPixel'];
				mInPixel *= mInPixel;

				var thash = node['tilesRedrawImages'][zoom][tID];
				var out = [];
				for (var i = 0; i < thash['arr'].length; i++)
				{
					var item = thash['arr'][i];
					if('contains' in item.geom) {
						if(!item.geom['contains'](mPoint, null, item.src)) continue;
					}
					else if(!item.geom.bounds.contains(mPoint)) continue;

					var dist = minDist;
					if('distance2' in item.geom) {
						dist = item.geom['distance2'](mPoint);
						if(item.geom['isCircle'] && dist * mInPixel > item.geom['sx']*item.geom['sy']) continue;
					}
					if(dist < minDist) { out.unshift(item); minDist = dist; }
					else out.push(item);
				}
				return out;
			}
			,
			'getTileItems': function(zoom, tileID)	{				// Получить обьекты попавшие в тайл отрисовки
				if(node['tilesRedrawImages'][zoom] && node['tilesRedrawImages'][zoom][tileID]) return node['tilesRedrawImages'][zoom][tileID];
				return [];
			}
			,
			'clear': function(zoom, tileID)	{						// Удалить обьекты попавшие в тайл отрисовки
				if(zoom && node['tilesRedrawImages'][zoom] && tileID && node['tilesRedrawImages'][zoom][tileID]) delete node['tilesRedrawImages'][zoom][tileID];
				else if(zoom && node['tilesRedrawImages'][zoom] && !tileID) delete node['tilesRedrawImages'][zoom];
				else if(!zoom && !tileID) node['tilesRedrawImages'] = {};
				return true;
			}
			,
			'removeImage': function(vID)	{						// Удалить Image обьекта
				for (var z in node['tilesRedrawImages']) {
					for (var tileID in node['tilesRedrawImages'][z]) {
						var thash = node['tilesRedrawImages'][z][tileID];
						for (var i = 0; i < thash['arr'].length; i++)
						{
							var it = thash['arr'][i];
							if(it.geom.id === vID) delete node['tilesRedrawImages'][z][tileID]['arr'][i]['imageObj'];
						}
					}
				}
				return true;
			}
			,
			'removeItems': function(needRemove)	{						// Удалить обьекта по Hash
				for (var z in node['tilesRedrawImages']) {
					for (var tileID in node['tilesRedrawImages'][z]) {
						var thash = node['tilesRedrawImages'][z][tileID];
						var out = [];
						for (var i = 0; i < thash['arr'].length; i++)
						{
							var it = thash['arr'][i];
							if(!needRemove[it.geom.id]) out.push(it);
						}
						thash['arr'] = out;
					}
				}
				return true;
			}
		}

		var drawRasters = function(tileID)	{						// отрисовка растров векторного тайла
			//console.log('drawRasters ', tileID);
			var zoom = LMap.getZoom();
			node.redrawTile(tileID, zoom);
			return true;
		}

		var prepareQuicklookImage = function(rItem, content)	{			// получить трансформированное изображение
			//console.log('drawRasters ', tileID);
			var gID = rItem['geom'].id
			var out = content;
			var w = content.width;
			var h = content.height;
			var LatLngToPixel = function(y, x) {
				var point = new L.LatLng(y, x);
				return LMap.project(point);
			}
			var geo = node['getItemGeometry'](gID);
			var coord = geo.coordinates;
			var d1 = 100000000;
			var d2 = 100000000;
			var d3 = 100000000;
			var d4 = 100000000;
			var x1, y1, x2, y2, x3, y3, x4, y4;
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
			var geom = rItem['geom'];
			var propHiden = geom['propHiden'];
			var ptl = new L.Point(x1, y1);
			var ptr = new L.Point(x2, y2);
			var pbl = new L.Point(x4, y4);
			var pbr = new L.Point(x3, y3);
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			var begx = mInPixel * geom.bounds.min.x;
			var begy = mInPixel * geom.bounds.max.y;
			var dx = begx - rItem['attr'].x;
			var dy = 256 - begy + rItem['attr'].y;
			if(!propHiden['_imgQuicklook']) {
				var pix = LatLngToPixel(ptl.y, ptl.x); x1 = Math.floor(pix.x); y1 = Math.floor(pix.y);
				pix = LatLngToPixel(ptr.y, ptr.x); x2 = Math.floor(pix.x); y2 = Math.floor(pix.y);
				pix = LatLngToPixel(pbr.y, pbr.x); x3 = Math.floor(pix.x); y3 = Math.floor(pix.y);
				pix = LatLngToPixel(pbl.y, pbl.x); x4 = Math.floor(pix.x); y4 = Math.floor(pix.y);
				var	boundsP = new L.Bounds();
				boundsP.extend(new L.Point(x1, y1));
				boundsP.extend(new L.Point(x2, y2));
				boundsP.extend(new L.Point(x3, y3));
				boundsP.extend(new L.Point(x4, y4));
				x1 -= boundsP.min.x; y1 -= boundsP.min.y;
				x2 -= boundsP.min.x; y2 -= boundsP.min.y;
				x3 -= boundsP.min.x; y3 -= boundsP.min.y;
				x4 -= boundsP.min.x; y4 -= boundsP.min.y;

				var ww = Math.round(boundsP.max.x - boundsP.min.x);
				var hh = Math.round(boundsP.max.y - boundsP.min.y);
				
				var pt = gmxAPI._leaflet['ProjectiveImage']({
					'imageObj': content
					,'points': [[x1, y1], [x2, y2], [x4, y4], [x3, y3]]
					,'wView': ww
					,'hView': hh
					,'deltaX': 0
					,'deltaY': 0
					,'patchSize': 1
					,'limit': 2
				});
				propHiden['_imgQuicklook'] = pt['canvas'];
			}

			var out = document.createElement('canvas');
			out.width = out.height = 256;
			var ptx = out.getContext('2d');
			ptx.drawImage(propHiden['_imgQuicklook'], dx, dy);
			return out;
		}
		
		// получить растр обьекта рекурсивно от начального zoom
		var badRastersURL = {};
		node.loadRasterRecursion = function(z, x, y, ogc_fid, rItem, callback) {
			var objData = node['objectsData'][ogc_fid];
			if(!objData) {
			//console.log('objData ', node.id, ogc_fid, z, rItem.attr.zoom, node['objectsData'][String(ogc_fid)]);
				return;
			}
			node['lastDrawTime'] = 1;		// старт отрисовки
			node.isIdle(-1);		// обнуление проверок окончания отрисовки
			var rUrl = '';
			if(node['tileRasterFunc']) rUrl = node['tileRasterFunc'](x, y, z, objData);
			else if(node['quicklook']) rUrl = utils.chkPropsInString(node['quicklook'], objData['properties'], 3);

			var onError = function() {
				badRastersURL[rUrl] = true;
				if (node['tileRasterFunc'] && z > 1) {
					// запрос по раззумливанию растрового тайла
					node.loadRasterRecursion(z - 1, Math.floor(x/2), Math.floor(y/2), ogc_fid, rItem, callback);
				} else {
					callback(null);
					return;
				}
			};
			if(badRastersURL[rUrl]) {
				onError();
				return;
			}
			var zoomFrom = rItem.attr.zoom;
			var item = {
				'src': rUrl
				,'zoom': zoomFrom
				,'callback': function(imageObj) {
					// раззумливание растров
					if(zoomFrom > z) {
						var pos = gmxAPI.getTilePosZoomDelta(rItem.attr.scanexTilePoint, zoomFrom, z);
						var canvas = document.createElement('canvas');
						canvas.width = canvas.height = 256;
						//canvas.id = zoomFrom+'_'+pos.x+'_'+pos.y;
						var ptx = canvas.getContext('2d');
						ptx.drawImage(imageObj, pos.x, pos.y, pos.size, pos.size, 0, 0, 256, 256);
						imageObj = canvas;
					} else if(node['quicklook']) {
						imageObj = prepareQuicklookImage(rItem, imageObj);
					}
					var pt = {'idr': ogc_fid, 'properties': objData['properties'], 'callback': function(content) {
						rItem['imageObj'] = content;
						callback(rItem['imageObj']);
					}};
					rItem['imageObj'] = (node['imageProcessingHook'] ? node['imageProcessingHook'](imageObj, pt) : imageObj);
					if(rItem['imageObj']) callback(rItem['imageObj']);
				}
				,'onerror': onError
			};
			if(node['imageProcessingHook'] || zoomFrom != z) item['crossOrigin'] = 'anonymous';	// если требуется преобразование image
			gmxAPI._leaflet['imageLoader'].push(item);
		}

		node.getRaster = function(rItem, ogc_fid, callback)	{	// получить растр обьекта векторного тайла
			if(!node['tileRasterFunc'] && !node['quicklook']) return false;

			var attr = rItem.attr;
			var zoom = LMap.getZoom();
			var drawTileID = attr.drawTileID;

			if(node['tilesRedrawImages'][zoom] && node['tilesRedrawImages'][zoom][drawTileID]) {
				var thash = node['tilesRedrawImages'][zoom][drawTileID];
				for (var i = 0; i < thash['arr'].length; i++)
				{
					var it = thash['arr'][i];
					if(it['src'] == rItem['src'] && it['imageObj']) {
						rItem['imageObj'] = it['imageObj'];
						callback(rItem['imageObj']);
						return true;
					}
				}
			}

			node.loadRasterRecursion(zoom, attr.scanexTilePoint['x'], attr.scanexTilePoint['y'], ogc_fid, rItem, callback);
		}

		var isInTile = function(geom, attr) {		// попал обьект в тайл или нет
			var flag = false;
			if(geom['intersects']) {										// если geom имеет свой метод intersects
				if(geom['intersects'](attr.bounds)) flag = true;
			}
			else if(attr.bounds.intersects(geom.bounds)) flag = true;					// обьект не пересекает границы тайла
			return flag;
		}

		var getObjectsByTile = function(attr) {		// получить список обьектов попавших в тайл
			var arr = [];
			var arrTop = [];
			var zoom = attr['zoom'];
			if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
			attr['tileSize'] = gmxAPI._leaflet['zoomCurrent']['tileSize'];

			var tiles = node.getTilesBoundsArr();
			var drawTileID = attr['drawTileID'];
			var tKey = attr['tKey'];
			//node['objectCounts'] = 0;
			var chkArr = function(parr) {		// проверка массива обьектов
				for (var i1 = 0; i1 < parr.length; i1++)
				{
					var geom = parr[i1];
					//if(!geom.propHiden['_isFilters']) continue;		// если нет фильтра пропускаем
					if(!isInTile(geom, attr)) continue;	// обьект не пересекает границы тайла
					if(!geom.propHiden['_isFilters']) chkObjectFilters(geom, attr['tileSize']);

					//if(!chkSqlFuncVisibility(geom)) continue;	// если фильтр видимости на слое
					if(!node.chkTemporalFilter(geom)) continue;	// не прошел по мультивременному фильтру

					if(geom.type !== 'Point' && geom.type !== 'Polygon' && geom.type !== 'MultiPolygon' && geom.type !== 'Polyline' && geom.type !== 'MultiPolyline') continue;
					

					if(node['flipHash'][geom['id']]) arrTop.push(geom); 	// Нарисовать поверх
					else arr.push(geom);
				}
			}
			for (var key in node['tilesGeometry'])						// Перебрать все загруженные тайлы
			{
				//node['objectCounts'] += node['tilesGeometry'][key].length;
				var tb = tiles[key];
				if(typeGeo === 'point') {
					//if(chkBorders(tb, attr.scanexTilePoint) === '') continue;		// Тайл не пересекает drawTileID + соседние тайлы
					if(!chkBorders(tb, attr)) continue;		// Тайл не пересекает drawTileID + соседние тайлы
				} else {
					if(!attr['bounds'].intersects(tb)) continue;		// Тайл не пересекает drawTileID
				}
				chkArr(node['tilesGeometry'][key]);
			}
			if(node['addedItems'].length) {
				//node['objectCounts'] += node['addedItems'].length;
				chkArr(node['addedItems']);
			}
			
			if('sortItems' in node) {
				arr = arr.sort(node['sortItems']);
			}
			arr = arr.concat(arrTop);
			return arr;
		}

		var getTileAttr = function(tilePoint, zoom)	{		// получить атрибуты тайла
			var tKey = tilePoint.x + ':' + tilePoint.y;
			
			if(!zoom) zoom = LMap.getZoom();
			if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
			var zoomCurrent = gmxAPI._leaflet['zoomCurrent'];
			var pz = zoomCurrent['pz'];
			var tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0);
			var ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
			var scanexTilePoint = {
				'x': tx % pz - pz/2
				,'y': pz/2 - 1 - ty % pz
			};

			var drawTileID = zoom + '_' + scanexTilePoint.x + '_' + scanexTilePoint.y;
			var bounds = utils.getTileBoundsMerc(scanexTilePoint, zoom);
			var attr = {
				'node': node
				,'x': 256 * scanexTilePoint.x
				,'y': 256 * scanexTilePoint.y
				,'zoom': zoom
				,'bounds': bounds
				,'drawTileID': drawTileID
				,'scanexTilePoint': scanexTilePoint
				,'tilePoint': tilePoint
				,'tKey': tilePoint.x + ':' + tilePoint.y
				,'tileSize': zoomCurrent['tileSize']
			};
			return attr;
		}
		
		var observerTimer = null;										// Таймер
		node.repaintTile = function(tilePoint, clearFlag)	{				// перерисовать векторный тайл слоя
			if(!myLayer._map || gmxAPI._leaflet['moveInProgress']) return;
			
			var zoom = LMap.getZoom();
			var attr = getTileAttr(tilePoint, zoom);

			if(tilePoint.y < 0 || tilePoint.y >= gmxAPI._leaflet['zoomCurrent']['pz']) {	// За пределами вертикального мира
				myLayer._markTile(tilePoint, 1);
				return true;
			}
			
			var tKey = attr['tKey'];
			var drawTileID = attr['drawTileID'];
			
			var tile = null;
			var ctx = null;

			var out = false;
			if(node['observerNode']) {
				if(observerTimer) clearTimeout(observerTimer);
				observerTimer = setTimeout(node['chkObserver'], 0);
			}

			var cnt = 0;
			var rasterNums = 0;
			var ritemsArr = [];
			var drawGeoArr = function(arr, flag) {							// Отрисовка массива геометрий
				var res = [];
				for (var i1 = 0; i1 < arr.length; i1++)
				{
					var geom = arr[i1];
					if(geom.type !== 'Point' && geom.type !== 'Polygon' && geom.type !== 'MultiPolygon' && geom.type !== 'Polyline' && geom.type !== 'MultiPolyline') continue;

					var objData = node['objectsData'][geom['id']] || geom;
					var propHiden = objData['propHiden'];
					if(!propHiden['drawInTiles']) propHiden['drawInTiles'] = {};
					if(!propHiden['drawInTiles'][zoom]) propHiden['drawInTiles'][zoom] = {};

					if(propHiden['subType'] != 'cluster') {						// для кластеров без проверки
						if(!chkSqlFuncVisibility(objData)) {	 // если фильтр видимости на слое
							continue;
						}
					}
					
					propHiden['drawInTiles'][zoom][drawTileID] = true;
					var style = geom.propHiden.curStyle || null;
					attr['style'] = style;
					cnt++;

					var showRaster = (
						(!node['tileRasterFunc'] && !node['quicklook'])
						||
						(
							(zoom < node['quicklookZoomBounds']['minZ'] || zoom > node['quicklookZoomBounds']['maxZ'])
							&&
							(node['propHiden']['rasterView'] == '' || !propHiden['rasterView'])
						)
						? false
						: true
					);
						
					var rUrl = '';
					if(node['tileRasterFunc']) rUrl = node['tileRasterFunc'](attr.scanexTilePoint['x'], attr.scanexTilePoint['y'], zoom, objData);
					else if(node['quicklook']) rUrl = utils.chkPropsInString(node['quicklook'], objData['properties'], 3);

					var rItem = {
						'geom': geom
						,'attr': attr
						,'src': rUrl
						,'showRaster': showRaster
					};
					ritemsArr.push(rItem);
					
					if(showRaster) {
						rasterNums++;
						(function(pItem, pid) {
							node.getRaster(pItem, pid, function(img) {
								rasterNums--;
								pItem['imageObj'] = img;
								if(!node['tilesRedrawImages'][zoom]) return;
								if(!node['tilesRedrawImages'][zoom][tKey]) return;
//console.log(' showRaster: ' + drawTileID + pItem.attr.drawTileID + ' : ', tKey, rasterNums + ' : ' + node['tilesRedrawImages'][zoom][tKey]['rasterNums']);
								if(rasterNums === 0) {
									node['tilesRedrawImages'][zoom][tKey]['rasterNums'] = 0;
									var zd = 50 * gmxAPI._leaflet['imageLoader'].getCounts();
									node.waitRedrawFlips(zd, true);
									myLayer._markTile(pItem.attr['tilePoint'], cnt);
								}
							});
						})(rItem, geom['id']);
					} else {
						if(!tile) {
							tile = node['leaflet'].getCanvasTile(tilePoint);
							tile.id = drawTileID;
						}
						objectToCanvas(rItem, tile, clearFlag);
						clearFlag = false;
						//if(geom.type === 'Point') {
							//node.upDateLayer(200);
						//}
					}

					res.push(geom['id']);
				}
				if(!node['tilesRedrawImages'][zoom]) node['tilesRedrawImages'][zoom] = {};
				node['tilesRedrawImages'][zoom][tKey]	= {'rasterNums':rasterNums, 'arr':ritemsArr, 'tilePoint': tilePoint, 'drawTileID': drawTileID};
				ritemsArr = null;
				return res;
			}

			//var needDraw = [];
			var arr = getObjectsByTile(attr, clearFlag);
			if(node['clustersData']) {						// Получить кластеры
				arr = node['clustersData'].getTileClusterArray(arr, attr);
				gmxAPI._leaflet['LabelsManager'].remove(node.id);	// Переформировать Labels
				//removeFromBorderTiles(tKey);
				node.waitRedrawFlips(100);							// требуется отложенная перерисовка
			}
			drawGeoArr(arr);
			arr = null;
			if(rasterNums === 0) {
				myLayer._markTile(tilePoint, cnt);
				if(cnt == 0) myLayer.removeTile(tilePoint);		// Удаление ставшего пустым тайла
			}
			//chkBorders(200);
			return out;
		}
		node['labelBounds'] = {'add': {}, 'skip': {}};			// Добавленные и пропущенные labels обьектов слоя
		node['chkTilesParentStyle'] = function() {				// перерисовка при изменении fillOpacity - rasterView
			reCheckFilters();
			node.redrawFlips();
		};
		var chkGlobalAlpha = function(ctx) {					// проверка fillOpacity стиля заполнения обьектов векторного слоя - rasterView
			var tilesParent = gmxNode['tilesParent'];
			if(!tilesParent) return;
			var tpNode = mapNodes[tilesParent.objectId];
			if(!tpNode || !tpNode.regularStyle || !tpNode.regularStyle.fill) return;
			ctx.globalAlpha = tpNode.regularStyle.fillOpacity;
			
			//ctx.globalCompositeOperation = 'destination-over'; // 'source-over'
			return true;
		};

		var setCanvasStyle = function(tile, ctx, style)	{							// указать стиль Canvas
			if(style) {
				//if(style['stroke'] && style['weight'] > 0) {
				var strokeStyle = '';
				if(style['stroke']) {
					var lineWidth = style['weight'] || 0;
					if(ctx.lineWidth != lineWidth) ctx.lineWidth = lineWidth;
					var opacity = ('opacity' in style ? style['opacity'] : 0);
					if(style['weight'] == 0) opacity = 0; // если 0 ширина линии скрываем через opacity
					//strokeStyle = style['color_rgba'] || 'rgba(0, 0, 255, 1)';
					//strokeStyle = strokeStyle.replace(/1\)/, opacity + ')');
					strokeStyle = utils.dec2rgba(style['color_dec'], opacity);
				} else {
					strokeStyle = 'rgba(0, 0, 255, 0)';
				}
				if(tile._strokeStyle != strokeStyle) ctx.strokeStyle = strokeStyle;
				tile._strokeStyle = strokeStyle;
				
				if(style['fill']) {
					var fillOpacity = style['fillOpacity'] || 0;
					//var fillStyle = style['fillColor_rgba'] || 'rgba(0, 0, 255, 1)';
					//fillStyle = fillStyle.replace(/1\)/, fillOpacity + ')');
					var fillStyle = utils.dec2rgba(style['fillColor_dec'], fillOpacity);
					if(tile._fillStyle != fillStyle) ctx.fillStyle = fillStyle;
					tile._fillStyle = fillStyle;
				}
			}
			//ctx.save();
		}

		// отрисовка векторного обьекта тайла
		var objectToCanvas = function(pt, tile, flagClear) {
			var ctx = tile.getContext('2d');
			var attr = pt['attr'];
			var geom = pt['geom'];
			var imageObj = pt['imageObj'];
			//ctx.save();
			if(flagClear) {
				ctx.clearRect(0, 0, 256, 256);
				attr['labelBounds'] = [];
			}
			if(!geom.propHiden.curStyle) {
				var filter = getItemFilter(geom);
				if(!filter || filter.isVisible === false) return;		// если нет фильтра или он невидим пропускаем
				if(filter) {
					geom.propHiden.curStyle = (filter.regularStyle ? filter.regularStyle : null);
				}
			}			
			if(!geom.propHiden.curStyle) return;
			
			var itemStyle = geom.propHiden.curStyle;
			setCanvasStyle(tile, ctx, itemStyle);
			//ctx.restore();
			if(imageObj) {
				ctx.save();
				var pImage = imageObj;
				var isWatcher = (node['watcherKey']
					&& node['hoverItem']
					&& node['hoverItem'].geom.id == geom.id
					//&& node['watcherActive'] ? true : false);
					&& gmxAPI._leaflet['mouseMoveAttr']
					&& gmxAPI._leaflet['mouseMoveAttr'][node['watcherKey']] ? true : false);
				if(isWatcher) {
					pImage = document.createElement('canvas');
					pImage.width = imageObj.width; pImage.height = imageObj.height;
					var ptx = pImage.getContext('2d');
							
					var mousePos = tile._layer._map.latLngToLayerPoint(gmxAPI._leaflet['mousePos']);
					var cx = mousePos.x - tile._leaflet_pos.x;
					var cy = mousePos.y - tile._leaflet_pos.y;

					ptx.drawImage(imageObj, 0, 0);
					ptx.globalCompositeOperation = 'destination-out';
					ptx.beginPath();
					ptx.arc(cx, cy, node['watcherRadius'], 0, 2 * Math.PI, false);
					ptx.fill();
				}
				if('rasterOpacity' in itemStyle) {					// для растров в КР
					ctx.globalAlpha = itemStyle.rasterOpacity;
				} else {
					chkGlobalAlpha(ctx);
				}
				var pattern = ctx.createPattern(pImage, "no-repeat");
				ctx.fillStyle = pattern;
				//ctx.fillRect(0, 0, 256, 256);
				geom['paintFill'](attr, itemStyle, ctx, false);
				ctx.fill();
				ctx.clip();
				ctx.restore();
			}
			geom['paint'](attr, itemStyle, ctx);
		}

		function chkItemFiltersVisible(geo)	{				// Проверить видимость фильтров для обьекта
			var filters = geo.propHiden.toFilters;
			for (var i = 0; i < filters.length; i++) {
				var fId = filters[i];
				var mapNodeFilter = mapNodes[fId];
				if(mapNodeFilter.isVisible != false) return true;
			}
			return false;
		}

		node.redrawTile = function(tKey, zoom, redrawFlag)	{			// перерисовка 1 тайла
			if(!myLayer._map || gmxAPI._leaflet['moveInProgress']) return;
			if(!node['tilesRedrawImages'][zoom]) return;		// ждем начала загрузки

			var thash = node['tilesRedrawImages'][zoom][tKey];
			if(!thash || thash['rasterNums'] > 0) return;		// ждем загрузки растров
			if(!redrawFlag && thash['drawDone']) return;		// тайл уже полностью отрисован
			
			var tile = null;
			var ctx = null;

			//var borders = needRedrawTiles[tKey] || null;

			var flagClear = true;
			var out = {};
			var item = null;
			var arr = thash['arr'];
			for (var i = 0; i < arr.length; i++) {
				item = arr[i];
				//if(item['showRaster'] && !item['imageObj']) continue;	// обьект имеет растр который еще не загружен
				//if(node['_sqlFuncVisibility'] && !node['_sqlFuncVisibility'](getPropItem(item.geom))) continue; // если фильтр видимости на слое
				if(!chkSqlFuncVisibility(item.geom)) continue; // если фильтр видимости на слое
				if(!chkItemFiltersVisible(item.geom)) continue;
				if(!node.chkTemporalFilter(item.geom)) {	// не прошел по мультивременному фильтру
					continue;
				}
				var itemId = item.geom.id;
				/*if(borders && borders[itemId]) {
					continue;
				} else */
				if(node['flipHash'][itemId]) {
					if(!out[itemId]) out[itemId] = [];
					out[itemId].push(item);
				} else {
					if(!tile) {
						tile = node['leaflet'].getCanvasTile(thash.tilePoint);
						//ctx = tile.getContext('2d');
					}

					objectToCanvas(item, tile, flagClear);
					flagClear = false;
				}

			}
			for (var i = 0; i < node['flipedIDS'].length; i++) {	// перерисовка fliped обьектов
				var id = node['flipedIDS'][i];
				if(out[id]) {
					if(!tile) {
						tile = node['leaflet'].getCanvasTile(thash.tilePoint);
						//ctx = tile.getContext('2d');
					}
					for (var j = 0; j < out[id].length; j++) {
						objectToCanvas(out[id][j], tile, flagClear);
						flagClear = false;
					}
				}
			}
			if(tile && flagClear) {
				tile.getContext('2d').clearRect(0, 0, 256, 256);
			}
			out = null;
			arr = null;
			if(tile) tile._needRemove = flagClear;
			thash['drawDone'] = true;
			return true;
		}
		
		var redrawTilesHash = function(hash, redrawFlag)	{					// перерисовка тайлов по hash
			node['lastDrawTime'] = 1;		// старт отрисовки
			var zoom = LMap.getZoom();
			for (var tileID in hash)
			{
				node.redrawTile(tileID, zoom, redrawFlag);
			}
			node.isIdle();		// запуск проверки окончания отрисовки
		}
		node.redrawFlips = function(redrawFlag)	{						// перерисовка (растров) обьектов под мышкой
			var zoom = LMap.getZoom();
			redrawTilesHash(node['tilesRedrawImages'][zoom], redrawFlag);
			return true;
		}

		// проверка необходимости загрузки растра для обьекта векторного слоя при действиях мыши
		var chkNeedImage = function(item) {
			//console.log('chkNeedImage ', item);
			var zoom = LMap.getZoom();
			var itemId = item.id;
			
			var rasterNums = 0;
			for (var tKey in node['tilesRedrawImages'][zoom]) {
				var thash = tilesRedrawImages.getTileItems(zoom, tKey);
				for (var i = 0; i < thash['arr'].length; i++) {
					var pt = thash['arr'][i];
					if(pt.geom['id'] != itemId) continue;
					if(item.propHiden['rasterView']) {
						if(pt['imageObj'] || !pt['src']) continue;		// imageObj уже загружен либо нечего загружать
						rasterNums++;
						(function(pItem, pid) {
							node.getRaster(pItem, pid, function(img) {
								pItem['imageObj'] = img;
								rasterNums--;
								if(rasterNums === 0) node.waitRedrawFlips(100, true);
							});
						})(pt, itemId);
					} else {
						tilesRedrawImages.removeImage(itemId);
						node.waitRedrawFlips(100, true);
					}
				}
			}
			if(rasterNums === 0) {
				node.waitRedrawFlips(100, true);
			}
		}
		node.parseVectorTile = function(data, tileID, dAttr)	{		// парсинг векторного тайла
			node['tilesGeometry'][tileID] = objectsToFilters(data, tileID, dAttr);
			data = null;
			//waitRedrawFlips();
			//upDateLayer();
			return true;
		}

		node.delClusters = function(key)	{			// Удалить кластеризацию
			node['clustersData'] = null;
			waitRedraw();
			return true;
		}

		var isIdleTimer = null;									// Таймер
		node.isIdle = function(zd)	{							// проверка все ли нарисовано что было потребовано
			if(isIdleTimer) clearTimeout(isIdleTimer);
			if(zd === -1) return;
			if(arguments.length == 0) zd = 200;
			isIdleTimer = setTimeout(function()
			{
				if(node.getLoaderFlag()) return;				// загрузка данных еще не закончена
				delete node['lastDrawTime'];					// обнуление старта последней отрисовки
				utils.chkIdle(true, 'VectorLayer');				// Проверка закончены или нет все команды отрисовки карты
			}, zd);
		}

		var redrawTimer = null;										// Таймер
		var waitRedraw = function()	{								// Требуется перерисовка слоя с задержкой
//console.log('waitRedraw ', node.id, myLayer._isVisible);
			node['lastDrawTime'] = 1;		// старт отрисовки
			if(redrawTimer) clearTimeout(redrawTimer);
			redrawTimer = setTimeout(function()
			{
				var onScene = (myLayer && myLayer._map ? true : false);
				if(!node.isVisible || !onScene) return;
				redrawTimer = null;
				//node['labelsBounds'] = [];
				myLayer.redraw();
				//gmxAPI._leaflet['lastZoom'] = LMap.getZoom();
			}, 10);
			return false;
		}
		node.waitRedraw = waitRedraw;				// перерисовать существующие тайлы слоя

		var upDateLayerTimer = null;								// Таймер
		node.upDateLayer = function(zd)	{						// пересоздание тайлов слоя с задержкой
			if(upDateLayerTimer) clearTimeout(upDateLayerTimer);
			//var onScene = (myLayer && myLayer._map ? true : false);
			if(!myLayer) return false;
			if(arguments.length == 0) zd = 10;

			node['lastDrawTime'] = 1;		// старт отрисовки
			node.isIdle(-1);		// обнуление проверок окончания отрисовки
			upDateLayerTimer = setTimeout(function()
			{
				myLayer._tilesKeysCurrent = {};
				myLayer._update();
				node.isIdle();		// запуск проверки окончания отрисовки
			}, zd);
			return true;
		}

		var reloadTilesListTimer = null;							// Таймер
		node.reloadTilesList = function(zd)	{						// перезагрузка тайлов слоя с задержкой
			var onScene = (myLayer && myLayer._map ? true : false);
			if(!onScene) return;
			if(reloadTilesListTimer) clearTimeout(reloadTilesListTimer);
			if(arguments.length == 0) zd = 0;
			node['lastDrawTime'] = 1;		// старт отрисовки
			node.isIdle(-1);		// обнуление проверок окончания отрисовки
			reloadTilesListTimer = setTimeout(function()
			{
				myLayer.removeAllTiles();
				var queueFlags = {};
				for(var gmxTileID in node['tilesKeys']) {
					var tKeys = node['tilesKeys'][gmxTileID];
					for(var tKey in tKeys) {
						if(!queueFlags[tKey]) {
							node.chkLoadTile(tKeys[tKey]);
						}
						queueFlags[tKey] = true;
					}
				}
				queueFlags = null;
				node.isIdle();		// запуск проверки окончания отрисовки
			}, zd);
			return false;
		}
		var redrawTilesListTimer = null;								// Таймер
		node.redrawTilesList = function(zd)	{						// пересоздание тайлов слоя с задержкой
			if(redrawTilesListTimer) clearTimeout(redrawTilesListTimer);
			if(node['waitStyle']) return false;
			if(arguments.length == 0) zd = 0;
			node['lastDrawTime'] = 1;		// старт отрисовки
			node.isIdle(-1);		// обнуление проверок окончания отрисовки
			redrawTilesListTimer = setTimeout(function()
			{
				var onScene = (myLayer && myLayer._map ? true : false);
				if(!onScene) {
					delete node['lastDrawTime'];
					return;
				}
				for(var gmxTileID in node['tilesKeys']) {
					var tKeys = node['tilesKeys'][gmxTileID];
					for(var tKey in tKeys) {
						var tilePoint = tKeys[tKey];
						node.repaintTile(tilePoint, true);
					}
				}
				node.isIdle();		// запуск проверки окончания отрисовки
			}, zd);
			return false;
		}
		
		var tilesNeedRepaintTimer = null;					// Таймер
		node.repaintTilesNeed = function(zd)	{			// пересоздание тайлов слоя с задержкой
			if(tilesNeedRepaintTimer) clearTimeout(tilesNeedRepaintTimer);
			if(arguments.length == 0) zd = 0;
			node['lastDrawTime'] = 1;		// старт отрисовки
			node.isIdle(-1);		// обнуление проверок окончания отрисовки
			if(node['tilesNeedRepaint'].length) {
				checkWaitStyle();
				if(!node['waitStyle'] && !gmxAPI._leaflet['moveInProgress']) {
					var drawTileID = node['tilesNeedRepaint'].shift();
					delete node['tilesNeedRepaint'][drawTileID];
					
					var ptt = node['tilesKeys'][drawTileID];
					var queueFlags = {};
					for(var tKey in ptt) {
						if(!queueFlags[tKey]) node.repaintTile(ptt[tKey], true);
						queueFlags[tKey] = true;
					}
					queueFlags = null;
				}
				if(node['tilesNeedRepaint'].length > 0) {
					tilesNeedRepaintTimer = setTimeout(function()
					{
						node.repaintTilesNeed(zd);
					}, zd);
				} else {
					node.isIdle();		// запуск проверки окончания отрисовки
				}
			}
			return false;
		}

		var removeTiles = function(zd)	{						// удалить тайлы которые уже на сцене
			if(myLayer) {
				for (var key in myLayer._tiles) {
					var tile = myLayer._tiles[key];
					tile._needRemove = true;
				}
				//myLayer.removeEmptyTiles();
			}
		}

		var redrawFlipsTimer = null;								// Таймер
		node.waitRedrawFlips = function(zd, redrawFlag)	{			// Требуется перерисовка уже отрисованных тайлов с задержкой
			if(redrawFlipsTimer) clearTimeout(redrawFlipsTimer);
			if(node['waitStyle']) return false;

			if(arguments.length == 0) zd = 100;
			node['lastDrawTime'] = 1;		// старт отрисовки
			redrawFlipsTimer = setTimeout(function()
			{
				node.redrawFlips(redrawFlag);
			}, zd);
			return false;
		}
		
		var clearDrawDone = function()	{								// переустановка обьектов по фильтрам
			var zoom = LMap.getZoom();
			if(node['tilesRedrawImages'][zoom]) {
				for (var tID in node['tilesRedrawImages'][zoom])
				{
					delete node['tilesRedrawImages'][zoom][tID]['drawDone'];
				}
			}
		}
		
		var checkWaitStyle = function()	{							// проверка ожидания обработки стилей по фильтрам
			for(var j=0; j<node.filters.length; j++) {
				var filter = mapNodes[node.filters[j]];
				if(!filter.regularStyle || filter.regularStyle['waitStyle']) {
					node['waitStyle'] = true;
					return;
				}
				if(filter.hoveredStyle && filter.hoveredStyle['waitStyle']) {
					node['waitStyle'] = true;
					return;
				}
			}
			node['waitStyle'] = false;
		}
		
		var reCheckFilters = function(tileSize)	{							// переустановка обьектов по фильтрам
			if(!gmxNode.isVisible) return;
			//needRedrawTiles = {};
			for (var tileID in node['tilesGeometry'])						// Перебрать все загруженные тайлы
			{
				var arr = node['tilesGeometry'][tileID];
				for (var i = 0; i < arr.length; i++) {
					var geom = arr[i];
					delete geom.propHiden['curStyle'];
					delete geom.propHiden['_isSQLVisibility'];
					delete geom.propHiden['_isFilters'];
					delete geom.propHiden['_imgQuicklook'];
					
					delete geom.propHiden['toFilters'];
					delete geom.propHiden['_isFilters'];
					delete geom.propHiden['drawInTiles'];
					delete geom['_cache'];
					delete geom['curStyle'];
					//geom.propHiden['toFilters'] = chkObjectFilters(geom, tileSize);
				}
			}
			for (var i = 0; i < node['addedItems'].length; i++) {
				delete node['addedItems'][i].propHiden['curStyle'];
				delete node['addedItems'][i].propHiden['_isSQLVisibility'];
				delete node['addedItems'][i].propHiden['_isFilters'];
				delete node['addedItems'][i].propHiden['_imgQuicklook'];
				
				delete node['addedItems'][i].propHiden['toFilters'];
				delete node['addedItems'][i].propHiden['_isFilters'];
				delete node['addedItems'][i].propHiden['drawInTiles'];
				delete node['addedItems'][i]['_cache'];
				delete node['addedItems'][i]['curStyle'];
				//node['addedItems'][i].propHiden['toFilters'] = chkObjectFilters(node['addedItems'][i], tileSize);
			}
			clearDrawDone();
			checkWaitStyle();
			node.redrawTilesList();
		}

		var checkFiltersTimer = null;								// Таймер
		node.checkFilters = function(zd)	{			// Требуется перепроверка фильтров с задержкой
			if(checkFiltersTimer) clearTimeout(checkFiltersTimer);
			if(arguments.length == 0) zd = 100;
			checkFiltersTimer = setTimeout(function()
			{
				var zoom = LMap.getZoom();
				if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
				reCheckFilters(gmxAPI._leaflet['zoomCurrent']['tileSize']);
			}, zd);
			return false;
		}

		var chkVisible = function() {
			if(!gmxNode) return;
			if(node.isVisible != false) {
				var notOnScene = true;
				var continuousWorld = false;
				if(node['leaflet']) {
					if(node['leaflet']._map) notOnScene = false;
				}
				var notOnScene = (node['leaflet'] && node['leaflet']._map ? false : true);
				//var notViewFlag = (!utils.chkVisibilityByZoom(id) || !utils.chkBoundsVisible(node['bounds']) ? true : false);
				var notViewFlag = (!utils.chkVisibilityByZoom(id) ? true : false);
				
				if(notOnScene != notViewFlag) {
					utils.setVisibleNode({'obj': node, 'attr': !notViewFlag});
					if(!notViewFlag) {
						node.upDateLayer(20);
					} else {
						gmxAPI._leaflet['LabelsManager'].onChangeVisible(node.id, !notViewFlag);
						if(gmxNode && 'removeQuicklooks' in gmxNode) gmxNode.removeQuicklooks();
						gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Проверка map Listeners на hideBalloons
					}
				}
			}
		}

		node.chkLayerVisible = function()	{	// Проверка видимости слоя
			chkVisible();
		}

		node.chkZoomBoundsFilters = function()	{	// Проверка видимости по Zoom фильтров
			//var minZ = node.minZ;
			//var maxZ = node.maxZ;
			var minZ = 100;
			var maxZ = 1;
			for(var j=0; j<node.filters.length; j++) {
				var filter = mapNodes[node.filters[j]];
				if(maxZ < filter.maxZ) maxZ = filter.maxZ;
				if(minZ > filter.minZ) minZ = filter.minZ;
			}
			if(maxZ != node.maxZ) node.maxZ = maxZ;
			if(minZ != node.minZ) node.minZ = minZ;
			
			if(node.isVisible && myLayer) {
				if(myLayer.options.minZ != node['minZ'] || myLayer.options.maxZ != node['maxZ']) {
					myLayer.options.minZ = node['minZ'];
					myLayer.options.maxZ = node['maxZ'];
					node.chkLayerVisible();
				}
			}
		}

		node.onZoomend = function()	{				// Проверка видимости по Zoom
			if(!node.isVisible || !myLayer) return false;
			if(node['clustersData']) node['clustersData'].clear();
			node['labelBounds'] = {'add': {}, 'skip': {}};
			var currZ = LMap.getZoom();
			for (var z in node['tilesRedrawImages']) {
				if(z != currZ) delete node['tilesRedrawImages'][z];
			}
			
			reCheckFilters(gmxAPI._leaflet['zoomCurrent']['tileSize']);
			node.chkLayerVisible();
		}

		node.refreshFilter = function(fid)	{		// обновить фильтр
			var filterNode = mapNodes[fid];
			if(!filterNode) return;						// Нода не была создана через addObject
			reCheckFilters();
			if(node.isVisible) node.waitRedrawFlips(0);
			gmxAPI._leaflet['lastZoom'] = -1;
			return true;
		}

		var chkStyleFilter = function(fnode) {
			if(fnode._regularStyle) {
				fnode.regularStyle = utils.parseStyle(fnode._regularStyle, fnode.id, function() {
					node.checkFilters(20);
				});
				fnode.regularStyleIsAttr = utils.isPropsInStyle(fnode.regularStyle);
				if(!fnode.regularStyleIsAttr) fnode.regularStyle = utils.evalStyle(fnode.regularStyle)
				if(!fnode._hoveredStyle) fnode._hoveredStyle = gmxAPI.clone(fnode._regularStyle);
			}
			if(fnode._hoveredStyle) {
				fnode.hoveredStyle = utils.parseStyle(fnode._hoveredStyle, fnode.id, function() {
					node.checkFilters(20);
				});
				fnode.hoveredStyleIsAttr = utils.isPropsInStyle(fnode.hoveredStyle);
				if(!fnode.hoveredStyleIsAttr) fnode.hoveredStyle = utils.evalStyle(fnode.hoveredStyle)
			}
		}
		
		node.setStyleFilter = function(fid, attr)	{		// обновить стиль фильтра
			if(!gmxNode.isVisible) return;
			var fnode = mapNodes[fid];
			chkStyleFilter(fnode);
			
			node.refreshFilter(fid);
			return true;
		}

		node.removeFilter = function(fid)	{		// Удаление фильтра векторного слоя
			var arr = [];
			for (var i = 0; i < node['filters'].length; i++)
			{
				if(node['filters'][i] != fid) arr.push(node['filters'][i]);
			}
			node['filters'] = arr;
			//reCheckFilters();
		}

		//var redrawAllTilesTimer = null;								// Таймер
		node.setFilter = function(fid)	{			// Добавить фильтр к векторному слою
			var flag = true;
			for (var i = 0; i < node['filters'].length; i++)
			{
				if(node['filters'][i] == fid) {
					flag = false;
					break;
				}
			}
			if(flag) node['filters'].push(fid);
			//node.refreshFilter(fid);

			if(node.isVisible) {
				var filter = mapNodes[fid];
				if(filter) {
					if(!filter.maxZ) filter.maxZ = 21;
					if(!filter.minZ) filter.minZ = 1;
				}
				reCheckFilters();
				node.redrawTilesList();
			}
			//mapNodes[fid]['setClusters'] = node.setClusters;
		}

		node.removeTile = function(key)	{			// Удалить тайл
			if('chkRemovedTiles' in node) node['chkRemovedTiles'](key);
			delete node['tilesGeometry'][key];
			delete node['tiles'][key];
			return true;
		}

		node.addTile = function(arr)	{			// Добавить тайл
			//var st:String =arr[i+2] + '_' + attr['dtiles'][i] + '_' + attr['dtiles'][i+1];
			return true;
		}

		var refreshBounds = function() {	// Обновление лефлет слоя
			var pt = utils.prpLayerAttr(gmxNode, node);
			if(pt['bounds']) node['bounds'] = pt['bounds'];
			if(node.leaflet) {
				//node.leaflet.options['bounds'] = getLatLngBounds(node['bounds']);
				node.leaflet._update();
			}
		};

		node['inUpdate'] = {}		// Обьекты векторного слоя находяшииеся в режиме редактирования
		node['startLoadTiles'] = function(attr)	{		// Перезагрузка тайлов векторного слоя
			var redrawFlag = false;
			gmxAPI._leaflet['LabelsManager'].remove(node.id);
			if(node['clustersData']) node['clustersData'].clear();
			tilesRedrawImages.clear();
			gmxAPI._leaflet['vectorTileLoader'].clearLayer(node.id);
			node.isIdle(-1);		// обнуление проверок окончания отрисовки

			node['tilesLoadProgress'] = {};
			node['tilesNeedRepaint'] = [];
			node['loaderDrawFlags'] = {};
			badRastersURL = {};
			if (!attr.notClear) {
				for(var key in node['tilesGeometry']) {
					node.removeTile(key);	// Полная перезагрузка тайлов
				}
				node['addedItems'] = [];
				node['objectsData'] = {};
				redrawFlag = true;
			}
			
			if (attr.processing) {						// Для обычных слоев
				//removeEditedObjects();
				node['editedObjects'] = {};
				node['addedItems'] = [];
				
				node['inUpdate'] = attr.processing.inUpdate || {};
				if (attr.processing.removeIDS) {
					removeItems(attr.processing.removeIDS, node['inUpdate']);
				}
				if (attr.processing.addObjects) {
					node['addedItems'] = node['addedItems'].concat(objectsToFilters(attr.processing.addObjects, 'addItem'));
				}
			}
			
			if (attr.add || attr.del) {			// Для обычных слоев
				if (attr.del) {
					for(var key in attr.del) node.removeTile(key);	// удаление тайлов
				}
				if (attr.add) {
					var vers = [];
					var arr = [];
					for (var i = 0; i < attr.add.length; i++)
					{
						var pt = attr.add[i];
						arr.push(pt[0], pt[1], pt[2]);
						vers.push(pt[3]);
					}
					node.getTilesBounds(arr, vers);
					arr = [];
					vers = [];
					redrawFlag = true;
				}
			}

			if('dtiles' in attr) {		// Для мультивременных слоев
				node.getTilesBounds(attr['dtiles']);
				node.temporal = attr;
			}
			if(node.leaflet) {	// Обновление лефлет слоя
				node.reloadTilesList();
			}
			return true;
		}

		var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI
		var onLayerEventID = gmxNode.addListener('onLayer', function(obj) {	// Слой инициализирован
			gmxNode.removeListener('onLayer', onLayerEventID);
			gmxNode = obj;
			
			if(gmxNode.isVisible && node.needInit) nodeInit();
			var key = 'onChangeVisible';
			node['listenerIDS'][key] = {'obj': gmxNode, 'evID': gmxNode.addListener(key, function(flag) {	// Изменилась видимость слоя
				if(flag) {
					if(node.needInit) nodeInit();
					chkVisible();
					node.upDateLayer();
				} else {
					gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Проверка map Listeners на hideBalloons
				}
				gmxAPI._leaflet['LabelsManager'].onChangeVisible(id, flag);
			}, -10)};
		});
		node.needInit = true;
		function nodeInit()	{
			if(node['notView']) {											// Слой не видим но временно включен АПИ
				delete node['notView'];
				return;
			}
			node.needInit = false;
			node.checkFilters(0);
			// Обработчик события - onTileLoaded
			var key = 'onTileLoaded';
			var evID = gmxAPI._listeners.addListener({'level': 11, 'eventName': key, 'obj': gmxNode, 'func': function(ph) {
					var nodeLayer = mapNodes[id];
					if(ph.attr) {
						nodeLayer.parseVectorTile(ph.attr['data']['data'], ph.attr['data']['tileID'], ph.attr['data']['dAttr']);
						ph = null;
					}
				}
			});
			key = 'onChangeLayerVersion';
			node['listenerIDS'][key] = {'obj': gmxNode, 'evID': gmxNode.addListener(key, refreshBounds)};
			node.setClusters = gmxAPI._leaflet['ClustersLeaflet'].setClusters;

			node['listenerIDS'][key] = {'evID': evID, 'obj': gmxNode};
			key = 'onZoomend'; node['listenerIDS'][key] = { 'evID': gmxAPI._listeners.addListener({'level': -10, 'eventName': key, 'func': node.onZoomend}) };
/*			// image загружен
			key = 'onIconLoaded';
			node['listenerIDS'][key] = {'evID': gmxAPI._listeners.addListener({'level': 11, 'eventName': key, 'func': function(eID) {
				var filter = mapNodes[eID];
console.log('ssssss ', eID, filter);
				if(!filter || !filter.regularStyle) return;
				delete filter.regularStyle['waitStyle'];
				for(var j=0; j<node.filters.length; j++) {
					var filter = mapNodes[node.filters[j]];
					if(filter.regularStyle['waitStyle']) return;
				}
				node['waitStyle'] = false;
				if(gmxNode.isVisible) node.checkFilters();
				}})
			};
*/
			key = 'hideHoverBalloon';
			node['listenerIDS'][key] = {'evID': gmxAPI.map.addListener(key, mouseOut), 'obj': gmxAPI.map};
			
			var createLayerTimer = null;										// Таймер
			var createLayer = function() {										// Создание leaflet слоя
				myLayer = new L.TileLayer.VectorTiles(option);
				node['leaflet'] = myLayer;
				node.chkZoomBoundsFilters();
				if(node.isVisible || layer.properties['visible']) {
					if(node.isVisible != false) {
						utils.setVisibleNode({'obj': node, 'attr': true});
						node.isVisible = true;
					}
				} else {
					node.isVisible = false;
				}
			}
			var waitCreateLayer = function()	{								// Требуется перерисовка слоя с задержкой
				if(createLayerTimer) clearTimeout(createLayerTimer);
				createLayerTimer = setTimeout(function()
				{
					createLayerTimer = null;
					if(gmxAPI.map.needMove) {
						waitCreateLayer();
						return;
					}
					createLayer();
				}, 200);
			}
			if(gmxAPI.map.needMove) {
				waitCreateLayer();
			} else {
				createLayer();
			}
		}
		node['remove'] = function()	{		// Удалить векторный слой
			if(!node['leaflet']) return;
			mouseOut();
			if(observerTimer) clearTimeout(observerTimer);
			if(redrawTimer) clearTimeout(redrawTimer);
			if(redrawFlipsTimer) clearTimeout(redrawFlipsTimer);

			for(var key in node['listenerIDS']) {
				var item = node['listenerIDS'][key];
				if(item.obj) item.obj.removeListener(key, item.evID);
				else gmxAPI._listeners.removeListener(null, 'onZoomend', item.evID);
			}

			utils.removeLeafletNode(node);
			delete node['leaflet'];
			delete node['listenerIDS'];
		}
	}

	// инициализация
	function init(arr)	{
		LMap = gmxAPI._leaflet['LMap'];
		utils = gmxAPI._leaflet['utils'];
		mapNodes = gmxAPI._leaflet['mapNodes'];
		
		// Векторный слой
		L.TileLayer.VectorTiles = L.TileLayer.Canvas.extend(
		{
			_initContainer: function () {
				L.TileLayer.Canvas.prototype._initContainer.call(this);
				if('initCallback' in this.options) this.options.initCallback(this);
			}
			,
			_clearBgBuffer: function () {
				if (!this._map) {
					//console.log('_clearBgBuffer: ', this.id);
					return;
				}
				L.TileLayer.Canvas.prototype._clearBgBuffer.call(this);
			}
			,
			_reset: function (e) {
				this._tilesKeysCurrent = {};
				L.TileLayer.Canvas.prototype._reset.call(this, e);
			}
			,
			_update: function () {
				if (!this._map) {
					//console.log('_update: ', this.id);
					return;
				}

				var bounds = this._map.getPixelBounds(),
					zoom = this._map.getZoom(),
					tileSize = this.options.tileSize;

				if (zoom > this.options.maxZ || zoom < this.options.minZ) {
					this._clearBgBuffer();
					return;
				}

				var nwTilePoint = new L.Point(
						Math.floor(bounds.min.x / tileSize),
						Math.floor(bounds.min.y / tileSize)),

					seTilePoint = new L.Point(
						Math.floor(bounds.max.x / tileSize),
						Math.floor(bounds.max.y / tileSize)),

					tileBounds = new L.Bounds(nwTilePoint, seTilePoint);

				this._addTilesFromCenterOut(tileBounds);
			var countInvisibleTiles = this.options.countInvisibleTiles;
			tileBounds.min.x -= countInvisibleTiles; tileBounds.max.x += countInvisibleTiles;
			tileBounds.min.y -= countInvisibleTiles; tileBounds.max.y += countInvisibleTiles;

				if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
					this._removeOtherTiles(tileBounds);
				}
			}
			,
			_getGMXtileNum: function (tilePoint, zoom) {
				var pz = Math.pow(2, zoom);
				var tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0);
				var ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
				var gmxTilePoint = {
					'x': tx % pz - pz/2
					,'y': pz/2 - 1 - ty % pz
				};
				gmxTilePoint['gmxTileID'] = zoom + '_' + gmxTilePoint.x + '_' + gmxTilePoint.y
				return gmxTilePoint;
			}
			,
			_addTilesFromCenterOut: function (bounds) {
				var queue = [],
					center = bounds.getCenter();

				var j, i, point;
				var zoom = this._map.getZoom();
				var node = mapNodes[this.options['id']];
				node['tilesKeys'] = {};
				if(!this._tilesKeysCurrent) this._tilesKeysCurrent = {};
				var curKeys = {};

				for (j = bounds.min.y; j <= bounds.max.y; j++) {
					for (i = bounds.min.x; i <= bounds.max.x; i++) {
						point = new L.Point(i, j);
						var gmxTilePoint = this._getGMXtileNum(point, zoom);
						var gmxTileID = gmxTilePoint['gmxTileID'];
						if(!node['tilesKeys'][gmxTileID]) node['tilesKeys'][gmxTileID] = {};
						var tKey = point.x + ':' + point.y;
						node['tilesKeys'][gmxTileID][tKey] = point;

						if (!this._tilesKeysCurrent.hasOwnProperty(tKey) && this._tileShouldBeLoaded(point)) {
							queue.push(point);
						}
						curKeys[tKey] = gmxTilePoint;
					}
				}
				this._tilesKeysCurrent = curKeys;

				var tilesToLoad = queue.length;

				if (tilesToLoad === 0) { return; }

				// load tiles in order of their distance to center
				queue.sort(function (a, b) {
					return a.distanceTo(center) - b.distanceTo(center);
				});

				var fragment = document.createDocumentFragment();

				// if its the first batch of tiles to load
				if (!this._tilesToLoad) {
					this.fire('loading');
				}

				this._tilesToLoad += tilesToLoad;

				this._tileContainer.appendChild(fragment);

				for (i = 0; i < tilesToLoad; i++) {
					this._addTile(queue[i], fragment);
				}
			}
			,
			getCanvasTile: function (tilePoint) {
				var tKey = tilePoint.x + ':' + tilePoint.y;
				for(var key in this._tiles) {
					if(key == tKey) return this._tiles[key];
				}
				if (!this._map) {
					//console.log('getCanvasTile: ', this.id);
				}
				var tile = this._getTile();
				tile.id = tKey;
				tile._layer = this;
				tile._tilePoint = tilePoint;

				this._tiles[tKey] = tile;
				this._tileContainer.appendChild(tile);

				var tilePos = this._getTilePos(tilePoint);
				L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
				this._markTile(tilePoint, 1);

				return this._tiles[tKey];
			}
			,
			_markTile: function (tilePoint, cnt) {					// cnt = количество отрисованных обьектов в тайле
				var tKey = tilePoint.x + ':' + tilePoint.y;
				var tile = this._tiles[tKey] || null;
				if (cnt > 0) {
					if(!tile) tile = this.getCanvasTile(tilePoint);
					this._tileOnLoad.call(tile);
					tile._tileComplete = true;					// Added by OriginalSin
					tile._needRemove = false;
					tile._cnt = cnt;
				} else {
					if(tile) tile._needRemove = true;
				}
				this._tileLoaded();
			}
			,
			tileDrawn: function (tile, cnt) {				// cnt = количество отрисованных обьектов в тайле
				if(tile) {
					if (cnt > 0) {
						this._tileOnLoad.call(tile);
						tile._tileComplete = true;					// Added by OriginalSin
						tile._needRemove = false;
					} else {
						tile._needRemove = true;
					}
				}
				this._tileLoaded();
				
			}
			,
			removeTile: function (tilePoint) {
				var tKey = tilePoint.x + ':' + tilePoint.y;
				if(this._tiles[tKey]) this._removeTile(tKey);
			}
			/*,
			removeEmptyTiles: function () {
				for(var key in this._tiles) {
					var tile = this._tiles[key];
					if (tile._needRemove) {
						this._removeTile(key);
					}
				}
			}*/
			,
			removeAllTiles: function () {
				for(var key in this._tiles) {
					this._removeTile(key);
				}
			}
			,
			_addTile: function (tilePoint, container) {
				this.drawTile(null, tilePoint, this._map._zoom);
			}
			,
			_getLoadedTilesPercentage: function (container) {
				// Added by OriginalSin
				if(!container) return 0;
				var len = 0, count = 0;
				var arr = ['img', 'canvas'];
				for (var key in arr) {
					var tiles = container.getElementsByTagName(arr[key]);
					if(tiles && tiles.length > 0) {
						len += tiles.length;
						for (var i = 0; i < tiles.length; i++) {
							if (tiles[i]._tileComplete) {
								count++;
							}
						}
					}
				}
				if(len < 1) return 0;
				return count / len;	
			}
			,
			drawTile: function (tile, tilePoint, zoom) {
				// override with rendering code
				var opt = this.options;
				var node = mapNodes[opt['id']];
				if(!node) return;								// Слой пропал
				node['chkLoadTile'](tilePoint, zoom);
			}
		});
	}

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['setVectorTiles'] = setVectorTiles;				// Добавить векторный слой
})();
;/* ======================================================================
    ContextMenu.js
   ====================================================================== */

// ContextMenu
(function()
{
	var LMap = null;						// leafLet карта
	var utils = null;						// утилиты для leaflet
	var menuItems = {};						// Хэш наборов ContextMenu по ID нод обьектов карты
	var marker = null;
	var currMenuID = null;					// Текущее меню
	var lastLatLng = null;					// Текущее положение

	// Показать меню
	function hideMenu() {
		if(marker) LMap.removeLayer(marker);
		marker = null
		gmxAPI._leaflet['contextMenu']['isActive'] = false;
	}
	
	// Показать меню
	function showMenu(ph) {
		if(!LMap) init();
		var gmxNode = ph.obj || gmxAPI.map;
		var id = gmxNode.objectId;
		if(!menuItems[id]) return false;
		currMenuID = id;
		var attr = ph.attr || {};
		var latlng = attr.latlng;
		if(!latlng) return false;
		lastLatLng = latlng;
		if(marker) LMap.removeLayer(marker);
		marker = createMenu(id, lastLatLng);
		marker.addTo(LMap);
	}
	// Click на Item меню
	var itemClick = function(nm)	{
		if(!marker || !menuItems[currMenuID]) return false;
		var items = menuItems[currMenuID]['items'];
		if(nm >= items.length) return false;
		if(items[nm].func) {
			items[nm].func(lastLatLng['lng'], lastLatLng['lat']);
			hideMenu();
		}
	}
	function createMenu(id, latlng)	{
		if(!menuItems[id]) return false;
		var out = '<ul class="context-menu-list context-menu-root">';
		var items = menuItems[id]['items'];
		for(var i=0; i<items.length; i++) {	// Итерации K-means
			var item = items[i];
			out += '<li class="context-menu-item" onClick="gmxAPI._leaflet.contextMenu.itemClick('+i+'); return false;" onmouseOver="gmxAPI._leaflet.contextMenu.onmouseOver(this);" onmouseOut="gmxAPI._leaflet.contextMenu.onmouseOut(this);">';
			out += '<span>'+item['txt']+'</span>';
			out += '</li>';
		}
		out += '</ul>';
		
		var myIcon = new L.DivIcon({
			html: out,
			iconSize: new L.Point(0, 0),
			className: ''
		});
		return new L.GMXMarker(latlng, {icon: myIcon, 'toPaneName': 'overlayPane', clickable: false, _isHandlers: true});
	}
	// Добавить в меню Item
	function addMenuItem(ph)	{
		if(!LMap) init();
		var gmxNode = ph.obj || gmxAPI.map;
		var id = gmxNode.objectId;
		var attr = ph.attr || {};
		if(!menuItems[id]) {
			menuItems[id] = { 'items': [] };
		}
		var out = {
			'txt': attr['text']
			,'func': attr['func']
		};
		menuItems[id]['items'].push(out);
		return out;
	}
	// инициализация
	function init(arr)	{
		LMap = gmxAPI._leaflet['LMap'];
		utils = gmxAPI._leaflet['utils'];
		mapNodes = gmxAPI._leaflet['mapNodes'];
		setTimeout(function() {
			var css = document.createElement("link");
			css.setAttribute("type", "text/css");
			css.setAttribute("rel", "stylesheet");
			css.setAttribute("media", "screen");
			var apiHost = gmxAPI.getAPIFolderRoot();
			css.setAttribute("href", apiHost + "leaflet/jquery.contextMenu.css?" + gmxAPI.buildGUID);
			document.getElementsByTagName("head").item(0).appendChild(css);
		}, 1000);
		LMap.on('mousemove', function(e) {
			if(!marker) return;
			var target = gmxAPI.compatTarget(e.originalEvent);
			if(!gmxAPI.isInNode(marker._icon, target)) {
				hideMenu();
			}
		});
	}
	// onmouseOver на Item меню
	var onmouseOver = function(hNode)	{
		hNode.className = 'context-menu-item hover';
		gmxAPI._leaflet['contextMenu']['isActive'] = true;
	}
	// onmouseOut на Item меню
	var onmouseOut = function(hNode)	{
		hNode.className = 'context-menu-item';
		gmxAPI._leaflet['contextMenu']['isActive'] = false;
	}
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['contextMenu'] = {				// ContextMenu
		'addMenuItem': addMenuItem					// Добавить Item ContextMenu
		,'showMenu': showMenu						// Добавить Item ContextMenu
		,'itemClick': itemClick						// Выбор пункта меню
		,'onmouseOver': onmouseOver					// mouseOver пункта меню
		,'onmouseOut': onmouseOut					// mouseOut пункта меню
		,'isActive': false							// мышка над пунктом меню
	}
})();
;/* ======================================================================
    QuicklooksLeaflet.js
   ====================================================================== */

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
;/* ======================================================================
    LabelsManager.js
   ====================================================================== */

// LabelsManager - менеджер отрисовки Labels
(function()
{
	var nextId = 0;							// следующий ID mapNode
	var timer = null;						// таймер
	var utils = null;						// следующий ID mapNode
	var LMap = null;
	var marker = null;
	var canvas = null;

	var items = [];							// массив ID нод очереди отрисовки
	var itemsHash = {};						// Хэш нод требующих отрисовки

	var repaintItems = function()	{			// отложенная перерисовка
		if(timer) clearTimeout(timer);
		timer = setTimeout(repaint, 200);
	}
	var prepareStyle = function(style)	{		// подготовка стиля
		var size = style['label']['size'] || 12;
		var fillStyle = style['label']['color'] || 0;
		var haloColor = style['label']['haloColor'] || 0;
		var out = {
			'size': size
			,'align': style['label']['align'] || 'left'
			,'font': size + 'px "Arial"'
			,'strokeStyle': gmxAPI._leaflet['utils'].dec2rgba(haloColor, 1)
			,'fillStyle': gmxAPI._leaflet['utils'].dec2rgba(fillStyle, 1)
		};
		if(style['iconSize']) out['iconSize'] = style['iconSize'];
		return out;
	}
	var prepareObject = function(node)	{				// подготовка Label от addObject
		var regularStyle = utils.getNodeProp(node, 'regularStyle', true);
		var style = prepareStyle(regularStyle);
		var geom = gmxAPI.merc_geometry(node['geometry']);
		var point = null;
		if(geom.type == 'Point') point = new L.Point(geom['coordinates'][0], geom['coordinates'][1]);

		if(!point) return null;
		var txt = node['label'] || '';
		var out = {
			'txt': txt
			,'point': point
			,'sx': 12
			,'sy': 6
			,'extent': gmxAPI._leaflet['utils'].getLabelSize(txt, style)
			,'style': style
			,'isVisible': true
			,'node': node
		};
		if(style['iconSize']) {
			out['sx'] = style['iconSize'].x;
			out['sy'] = style['iconSize'].y;
		}
		return out;
	}
	var prepareItem = function(txt, geom, inpStyle) {			// подготовка Label от векторного слоя
		var style = prepareStyle(inpStyle);
		var bounds = new L.Bounds();
		bounds.extend(new L.Point(geom['bounds'].min.x, geom['bounds'].min.y));
		bounds.extend(new L.Point(geom['bounds'].max.x, geom['bounds'].max.y));
		var x = (bounds.max.x + bounds.min.x) /2;
		var y = (bounds.max.y + bounds.min.y) /2;
		
		var extentLabel = null;
		if(geom['_cache'] && geom['_cache']['extentLabel']) {
			extentLabel = geom['_cache']['extentLabel'];
		} else {
			extentLabel = gmxAPI._leaflet['utils'].getLabelSize(txt, style);
			if(geom['_cache']) geom['_cache']['extentLabel'] = extentLabel;
		}
		var out = {
			'txt': txt
			,'point': new L.Point(x, y)
			,'bounds': bounds
			,'sx': geom['sx'] || 0
			,'sy': geom['sy'] || 0
			,'extent': extentLabel
			,'style': style
			,'isVisible': true
		};
		return out;
//console.log('addItem' ,  out);
	}
	
	var repaint = function() {				// перерисовка
		if(!canvas || gmxAPI._leaflet['mousePressed'] || gmxAPI._leaflet['zoomstart']) return false;
		if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent(zoom);
		var zoom = LMap.getZoom();
		//gmxAPI._leaflet['mInPixel'] = Math.pow(2, zoom)/156543.033928041;
		var mInPixel = gmxAPI._leaflet['mInPixel'];

		var vBounds = LMap.getBounds();
		var vpNorthWest = vBounds.getNorthWest();
		var mx = gmxAPI.merc_x(vpNorthWest.lng);
		var my = gmxAPI.merc_y(vpNorthWest.lat);
		var vpSouthEast = vBounds.getSouthEast();
		var vBoundsMerc = new L.Bounds();
		if(vpSouthEast.lng - vpNorthWest.lng > 360) {
			vBoundsMerc.extend(new L.Point(-gmxAPI.worldWidthMerc, gmxAPI.worldWidthMerc));
			vBoundsMerc.extend(new L.Point(gmxAPI.worldWidthMerc, -gmxAPI.worldWidthMerc));
		} else {
			vBoundsMerc.extend(new L.Point(gmxAPI.merc_x(vpNorthWest.lng), gmxAPI.merc_y(vpNorthWest.lat)));
			vBoundsMerc.extend(new L.Point(gmxAPI.merc_x(vpSouthEast.lng), gmxAPI.merc_y(vpSouthEast.lat)));
		}

		var contPoint = LMap.latLngToContainerPoint(vpNorthWest);

		var vp1 = LMap.project(vpNorthWest, zoom);
		var vp2 = LMap.project(vpSouthEast, zoom);
		var wView = vp2.x - vp1.x;
		var hView = vp2.y - vp1.y;
		canvas.width = wView;
		canvas.height = hView;
		marker.setLatLng(vpNorthWest);
		var ctx = canvas.getContext('2d');
		var labelBounds = [];
		for(var id in itemsHash) {
			var item = itemsHash[id];
			if(!item['isVisible']) continue;
			if(item['bounds'] && !item['bounds'].intersects(vBoundsMerc)) continue;		// обьект за пределами видимости
			var align = item['style']['align'];
			var dx = item['sx']/2 + 1;
			var dy = item['sy']/2 - 1 - contPoint.y;
			//if(!align) align = 'center';
			if(align === 'right') {
				dx -= (item.extent.x + item['style']['size']);
			} else if(align === 'center') {
				dx = -item.extent.x/2 + 1;
				dy = item.extent.y/2;
				//if(item['style']['iconSize']) {
					//dx += item['style']['iconSize'].x/2 + 1;
					//dy += item['style']['iconSize'].y/2;
				//}
			}

			var lx = (item.point.x - mx) * mInPixel + dx - 1; 		lx = (0.5 + lx) << 0;
			var ly = (my - item.point.y) * mInPixel + dy - 1;		ly = (0.5 + ly) << 0;
			var flag = true;			// проверка пересечения уже нарисованных labels
			var lxx = lx + item.extent.x;
			var lyy = ly + item.extent.y;
			for (var i = 0; i < labelBounds.length; i++)
			{
				var prev = labelBounds[i];
				if(lx > prev.max.x) continue;
				if(lxx < prev.min.x) continue;
				if(ly > prev.max.y) continue;
				if(lyy < prev.min.y) continue;
				flag = false;
				break;
			}
			if(flag) {
				labelBounds.push({
					'min':{'x': lx, 'y': ly}
					,'max':{'x': lxx, 'y': lyy}
				});
				if(ctx.font != item['style']['font']) ctx.font = item['style']['font'];
				if(ctx.strokeStyle != item['style']['strokeStyle']) ctx.strokeStyle = item['style']['strokeStyle'];
				if(ctx.fillStyle != item['style']['fillStyle']) ctx.fillStyle = item['style']['fillStyle'];
				if(ctx.shadowColor != item['style']['strokeStyle']) ctx.shadowColor = item['style']['strokeStyle'];
				if(ctx.shadowBlur != 4) ctx.shadowBlur = 4;
				//ctx.shadowOffsetX = 0;
				//ctx.shadowOffsetY = 0;
				ctx.strokeText(item['txt'], lx, ly);
				ctx.fillText(item['txt'], lx, ly);
			}
		}
		labelBounds = null;
	}
	var drawMe = function(pt) {				// установка таймера
		canvas = pt;
		repaintItems();
	}
	var init = function() {					// инициализация
		if(!utils && gmxAPI._leaflet['utils']) {
			utils = gmxAPI._leaflet['utils'];
			LMap = gmxAPI._leaflet['LMap'];				// Внешняя ссылка на карту
			if(marker) {
				LMap.removeLayer(node['leaflet']);
			}
			var canvasIcon = L.canvasIcon({
				className: 'my-canvas-icon'
				,'drawMe': drawMe
			});
			marker =  new L.GMXMarker([0,0], {icon: canvasIcon, 'toPaneName': 'popupPane', 'clickable': false, 'draggable': false, 'zIndexOffset': -1000});
				
			LMap.addLayer(marker);
			gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomend', 'func': repaintItems});
			gmxAPI.map.addListener('onMoveEnd', repaintItems);
			var onZoomstart = function() {				// скрыть при onZoomstart
				if(!canvas) return false;
				canvas.width = canvas.height = 0;
			}
			gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomstart', 'func': onZoomstart});
		}
	}
	var setVisibleRecursive = function(id, flag) {			// установка видимости рекурсивно
		if(itemsHash[id]) itemsHash[id].isVisible = flag;
		else {
			var node = gmxAPI._leaflet['mapNodes'][id];
			if(!node) return;
			for (var i = 0; i < node['children'].length; i++) {
				setVisibleRecursive(node['children'][i], flag);
			}
		}
	}
	var removeRecursive = function(node) {					// удаление от mapObject рекурсивно
		if(itemsHash[node.id]) delete itemsHash[node.id];
		for (var i = 0; i < node['children'].length; i++) {
			var child = gmxAPI._leaflet['mapNodes'][node['children'][i]];
			if(child) removeRecursive(child);
		}
	}

	var LabelsManager = {						// менеджер отрисовки
		'add': function(id)	{					// добавить Label для отрисовки
			var node = gmxAPI._leaflet['mapNodes'][id];
			if(!node) return false;
			if(!utils) init();
			itemsHash[id] = prepareObject(node);
			repaintItems();
		}
		,'addItem': function(txt, geom, attr, style)	{	// добавить Label от векторного слоя
			if(!utils) init();
			var node = attr['node'];
			var id = node['id'] + '_' + geom.id;
			var item = prepareItem(txt, geom, style);
			if(itemsHash[id]) {
				var bounds = new L.Bounds();
				item.bounds.extend(itemsHash[id]['bounds'].min);
				item.bounds.extend(itemsHash[id]['bounds'].max);
				item.point.x = (item.bounds.max.x + item.bounds.min.x)/2;
				item.point.y = (item.bounds.max.y + item.bounds.min.y)/2;
			}
			itemsHash[id] = item;
			repaintItems();
		}
		,'remove': function(id, vid)	{				// удалить ноду
			if(itemsHash[id]) delete itemsHash[id];
			else {
				var node = gmxAPI._leaflet['mapNodes'][id];
				if(!node) return false;
				if(node.type === 'VectorLayer') {
					var st = id + '_';
					if(vid) st += vid;
					for(var pid in itemsHash) {
						if(vid) {
							if(pid == st) { delete itemsHash[pid]; break; }
						} else {
							if(pid.indexOf(st) != -1) delete itemsHash[pid];
						}
					}
				} else if(node.type === 'mapObject') {
					removeRecursive(node);
				}
			}
			repaintItems();
			return true;
		}
		,'onChangeVisible': function(id, flag)	{		// изменение видимости ноды
			var node = gmxAPI._leaflet['mapNodes'][id];
			if(node['type'] == 'mapObject') {
				setVisibleRecursive(id, flag);
			} else {
				if(!flag) {
					LabelsManager.remove(id);
					return;
				}
			}
			repaintItems();
		}
		,'repaint': function()	{				// отрисовка нод
			repaintItems();
		}
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['LabelsManager'] = LabelsManager;	// менеджер отрисовки
})();
;/* ======================================================================
    ClustersLeaflet.js
   ====================================================================== */

// ClustersLeaflet - менеджер кластеризации
(function()
{
	var LMap = null;						// leafLet карта
	var utils = null;						// утилиты для leaflet
	var mapNodes = null;					// Хэш нод обьектов карты - аналог MapNodes.hx

	var init = function()	{				// инициализация кластеризации слоя
		LMap = gmxAPI._leaflet['LMap'];
		utils = gmxAPI._leaflet['utils'];
		mapNodes = gmxAPI._leaflet['mapNodes'];
	}

	var ClustersLeaflet = {
		'reRun': function(obj)	{			// Получить кластеры слоя
			var attr = obj;
			var node = attr.node;
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			var identityField = node['identityField'];
			var iterCount = (attr.iterationCount != null ? attr.iterationCount : 1);	// количество итераций K-means
			var radius = (attr.radius != null ? attr.radius : 20);						// радиус кластеризации в пикселах
			var radiusMerc = radius / mInPixel;											// радиус кластеризации в Меркаторе

			var grpHash = {};
			var cnt = 0;
			var arr = [];
			var getItems = function(inp) {			// Перебрать все обьекты из массива
				for (var i = 0, len = inp.length; i < len; i++)
				{
					var geom = inp[i];
					if(geom.type !== 'Point') continue;
					if(!geom.propHiden['_isFilters']) continue;				// если нет фильтра пропускаем
					if(!node['chkSqlFuncVisibility'](geom)) continue;		// если фильтр видимости на слое

					var p = geom.coordinates;
					var px1 = p.x;
					var py1 = p.y;

					var dx = Math.floor(px1 / radiusMerc);		// Координаты квадранта разбивки тайла
					var dy = Math.floor(py1 / radiusMerc);
					var key = dx + '_' + dy;
					var ph = grpHash[key] || {'arr':[]};
					var parr = ph['arr'];
					ph['arr'].push(geom);
					grpHash[key] = ph;
					arr.push(geom);
				}
			}
			for (var key in node['tilesGeometry'])						// Перебрать все загруженные тайлы
			{
				getItems(node['tilesGeometry'][key]);
			}
			if(node['addedItems'].length) {								// Перебрать все добавленные на клиенте обьекты
				getItems(node['addedItems']);
			}
			
			function getCenterGeometry(parr)
			{
				if (parr.length < 1) return null;
				var xx = 0; var yy = 0;
				var lastID = null;
				var members = [];
				var len = parr.length;
				for(var i=0; i<len; i++) {
					var item = parr[i];
					if (len == 1) return item;
					lastID = item.id;
					var p = item.coordinates;
					xx += p.x;
					yy += p.y;
					members.push(item);
				}
				xx /= len;
				yy /= len;

				var rPoint = new L.Point(xx, yy)
				var bounds = new L.Bounds();
				bounds.extend(rPoint);
				
				var res = {
					'id': lastID
					,'type': 'Point'
					,'bounds': bounds
					,'coordinates': rPoint
					,'properties': {
					}
					,'propHiden': {
						'subType': 'cluster'
						,'_members': members
					}
				};
				return res;
			}
			// find the nearest group
			function findGroup(point) {
				var min = Number.MAX_VALUE; //10000000000000;
				var group = -1;
				for(var i=0; i<centersGeometry.length; i++) {
					var item = centersGeometry[i];
					var center = item.coordinates;
					var x = point.x - center.x,
						y = point.y - center.y;
					var d = x * x + y * y;
					if(d < min){
						min = d;
						group = i;
					}
				}
				return group;
			}
			
			
			var centersGeometry = [];
			var objIndexes =  [];
			// преобразование grpHash в массив центроидов и MultiGeometry
			var clusterNum =  0;
			for (var key in grpHash)
			{
				var ph = grpHash[key];
				if (ph == null || ph.arr.length < 1) continue;
				objIndexes.push(ph.arr);
				var pt = getCenterGeometry(ph.arr);
				var prop = {};
				var first = ph.arr[0];
				if (ph.arr.length == 1) {
					prop = gmxAPI.clone(node.getPropItem(first));
				}
				else
				{
					clusterNum++;
					pt['id'] = 'cl_' + clusterNum;
					pt['subType'] = 'cluster';
					pt.propHiden.curStyle = attr.regularStyle;
					pt.propHiden.toFilters = node.filters;
					prop[identityField] = pt['id'];
				}

				if(first.propTemporal != null) pt.propTemporal = first.propTemporal;
				pt.properties = prop;
				centersGeometry.push(pt);
			}

			// Итерация K-means
			function kmeansGroups()
			{
				var newObjIndexes =  [];
				for(var i=0; i<arr.length; i++) {
					var item = arr[i];
					var point = item.coordinates;
					var group = findGroup(point);
					if (!newObjIndexes[group]) newObjIndexes[group] = [];
					newObjIndexes[group].push(item);
				}
				centersGeometry = [];
				objIndexes =  [];

				var clusterNum =  0;
				for(var i=0; i<newObjIndexes.length; i++) {
					var parr = newObjIndexes[i];
					if (!parr || parr.length == 0) continue;
					var pt = getCenterGeometry(parr);
					var prop = {};
					if (parr.length == 1) {
						prop = gmxAPI.clone(node.getPropItem(parr[0]));
					}
					else
					{
						clusterNum++;
						pt['id'] = 'cl_' + clusterNum;
						pt['subType'] = 'cluster';
						pt.propHiden.curStyle = attr.regularStyle;
						pt.propHiden.toFilters = node.filters;
						prop[identityField] = pt['id'];
					}
					pt.properties = prop;
					if(parr[0].propTemporal != null) pt.propTemporal = parr[0].propTemporal;
					
					centersGeometry.push(pt);
					objIndexes.push(parr);
				}
			}

			for(var i=0; i<iterCount; i++) {	// Итерации K-means
				kmeansGroups();
			}

			attr['centersGeometry'] = centersGeometry;
		}
		,'getTileClusterArray': function(iarr, tileAttr)	{			// Получить кластеры тайла
			if(!this.centersGeometry) ClustersLeaflet.reRun(this);
			return ClustersLeaflet.getTileClusters(this, iarr, tileAttr);
		}
		,'getTileClusters': function(obj, iarr, tileAttr)	{		// Получить кластеры тайла
			var attr = obj;
			var node = obj.node;
			var input = attr['input'] || {};

			var regObjectInCluster = /\[objectInCluster\]/g;
			var newProperties = input['newProperties'] || {'Количество': '[objectInCluster]'};	// properties кластеров

			var x = tileAttr['x'];
			var y = 256 + tileAttr['y'];
			var tileSize = tileAttr['tileSize'];
			var tbounds = tileAttr['bounds'];
			var tminx = tbounds.min.x - tileSize, tminy = tbounds.min.y - tileSize,
				tmaxx = tbounds.max.x + tileSize, tmaxy = tbounds.max.y + tileSize;

			var res = [];
			for(var i=0; i<attr['centersGeometry'].length; i++) {	// Подготовка геометрий
 				var item = attr['centersGeometry'][i];
				var p = item.coordinates;
				if(p.x < tminx || p.x > tmaxx || p.y < tminy || p.y > tmaxy) continue;
				if(item['subType'] === 'cluster') {
					var geo = gmxAPI._leaflet['PointGeometry']({'coordinates': [p.x, p.y]});
					geo.id = item.id + '_' + tileAttr['drawTileID'];
					geo.properties = item.properties;
					for (var key in newProperties)
					{
						var zn = newProperties[key];
						if(zn.match(regObjectInCluster)) zn = zn.replace(regObjectInCluster, item.propHiden._members.length);
						geo.properties[key] = zn;
					}

					geo.propHiden = item.propHiden;
					geo.propHiden['tileID'] = tileAttr['drawTileID'];
					geo.propHiden['fromTiles'] = {};

					if(!item['_cache'] || !item['_cache']['extentLabel']) {
						var style = item.propHiden.curStyle;
						if(style && style['label']) {
							var labelStyle = style['label'];
							var txt = (labelStyle['field'] ? item.properties[labelStyle['field']] : labelStyle['value']) || '';
							if(txt) {
								var runStyle = gmxAPI._leaflet['utils'].prepareLabelStyle(style);
								if(!item['_cache']) item['_cache'] = {};
								item['_cache']['extentLabel'] = gmxAPI._leaflet['utils'].getLabelSize(txt, runStyle);
							}
						}
					}
					if(item['_cache']) geo['_cache'] = item['_cache'];
					
					res.push(geo);
				} else {
					res.push(item);
				}
			}
			return res;
		}
		,'setClusters': function(ph, id)	{			// Добавить кластеризацию к векторному слою
			//console.log('setClustersLayer ', id , ph);
			if(!mapNodes) init()						// инициализация
			var node = mapNodes[id];						// лефлет нода слоя
			if(node['type'] == 'filter') {				// через фильтр
				node = mapNodes[node.parentId];
			}
			var layerID = node.id;
			var gmxNode = gmxAPI.mapNodes[layerID];				// mapNode слоя
			var out = {
				'input': ph
				,'centersGeometry': null
				,'node': node
				,'getTileClusterArray': ClustersLeaflet.getTileClusterArray
				,'clear': function() {
					this.centersGeometry = null;
				}
			};
			if(ph.iterationCount) out['iterationCount'] = ph.iterationCount;	// количество итераций K-means
			if(ph.radius) out['radius'] = ph.radius;							// радиус кластеризации в пикселах
			
			gmxAPI._listeners.addListener({'level': 11, 'eventName': 'onIconLoaded', 'func': function(eID) {	// проверка загрузки иконок
				if(eID.indexOf('_clusters')) {
					if(eID == layerID + '_regularStyle_clusters') {
						out.regularStyle['ready'] = true;
					} else if(eID == layerID + '_hoveredStyle_clusters') {
						out.hoveredStyle['ready'] = true;
					}
				}
			}});
			if(ph.RenderStyle) {
				out.regularStyle = utils.parseStyle(ph.RenderStyle, layerID + '_regularStyle_clusters');
				out.regularStyleIsAttr = utils.isPropsInStyle(out.regularStyle);
				if(!out.regularStyleIsAttr) out.regularStyle = utils.evalStyle(out.regularStyle)
				if(ph.HoverStyle && ph.RenderStyle.label && !ph.HoverStyle.label) ph.HoverStyle.label = ph.RenderStyle.label;
			}
			if(ph.HoverStyle) {
				out.hoveredStyle = utils.parseStyle(ph.HoverStyle, layerID + '_hoveredStyle_clusters');
				out.hoveredStyleIsAttr = utils.isPropsInStyle(out.hoveredStyle);
				if(!out.hoveredStyleIsAttr) out.hoveredStyle = utils.evalStyle(out.hoveredStyle)
			}
			gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Проверка map Listeners на hideBalloons
			this.clustersData = out;
			node.waitRedraw();
			return out;
		}
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['ClustersLeaflet'] = ClustersLeaflet;	// менеджер отрисовки
})();
;/* ======================================================================
    WorkersManager.js
   ====================================================================== */

// WorkersManager - менеджер Workers
(function()
{
	var addWorker = function(url, onError) {		// добавить worker
		if(!url) return null;
		var worker = new Worker(url);
		if(!worker) return null;
		var workerItem = {
			'currCommand': {}
			,'send': function(ph, onMsg, attr) {
				var cmdId = gmxAPI.newFlashMapId();
				workerItem['currCommand'][cmdId] = {'onMsg': onMsg, 'attr': attr};
				//console.log('message to worker ' , ph);
				var pt = {'id': cmdId, 'cmd': 'inCmd', 'msg': ph};
				worker.postMessage(pt);
			}
			,'terminate': function() {			// Прекратить работу объекта Worker
				worker.terminate();
			}
			//,'worker': worker
			,'onMsg': function(e) {
				var data = e.data;
				//console.log(data);
				if(data.log) {
					console.log(data.log);
					return;
				}
				var inId = data.id;
				var it = workerItem['currCommand'][inId];
				if(it) {
					if(it.onMsg) it.onMsg(data.msg);
					if(!it.attr || !it.attr.notRemove) delete workerItem['currCommand'][inId];
				}
			}
			,'onError': function(e) {
				onError(e);
				//console.log('onError from worker ' , e);
			}
		};
		worker.addEventListener('message', workerItem.onMsg, false);
		worker.addEventListener('error', onError, false);
		return {'send': workerItem['send'], 'terminate': workerItem['terminate']};
	};

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['addWorker'] = addWorker;	// менеджер worker
})();
;/* ======================================================================
    leafletProxy.js
   ====================================================================== */

//Поддержка leaflet
(function()
{
	var nextId = 0;							// следующий ID mapNode
	var LMap = null;						// leafLet карта
	var imagesSize = {};					// Размеры загруженных Images
	var mapNodes = {						// Хэш нод обьектов карты - аналог MapNodes.hx
		//	Ключ - id ноды
		//		'type': String - тип ноды ('mapObject')
		//		'parentId': String - id родительской ноды
		//		'properties': Hash - свойства ноды
		//		'geometry': Hash - геометрия ноды
		//		'leaflet': ссылка на leaflet обьект
		//		'zIndex': текущий zIndex ноды
	};
	var regProps = [			// массив регулярных выражений атрибутов обьекта  свойств 
		/\[([^\]]+)\]/i,
		/\"([^\"]+)\"/i,
		/\b([^\b]+)\b/i
	];
	var skipToolNames = {					// Хэш наименований tools при которых не проверяем события векторных слоев
		'POINT': true
		,'LINESTRING': true
		,'POLYGON': true
		,'FRAME': true
	};
	var patternDefaults = {					// настройки для pattern стилей
		'min_width': 1
		,'max_width': 1000
		,'min_step': 0
		,'max_step': 1000
	};

	var moveToTimer = null;
	var utils = {							// Утилиты leafletProxy
		'DEFAULT_REPLACEMENT_COLOR': 0xff00ff		// marker.color который не приводит к замене цветов иконки
		,
		'prepareLabelStyle': function(style) {		// подготовка Label стиля
			var size = style['label']['size'] || 12;
			var fillStyle = style['label']['color'] || 0;
			var haloColor = style['label']['haloColor'] || 0;
			var out = {
				'size': size
				,'align': style['label']['align'] || 'left'
				,'font': size + 'px "Arial"'
				,'strokeStyle': gmxAPI._leaflet['utils'].dec2rgba(haloColor, 1)
				,'fillStyle': gmxAPI._leaflet['utils'].dec2rgba(fillStyle, 1)
			};
			if(style['iconSize']) out['iconSize'] = style['iconSize'];
			return out;
		}
		,
		'chkIdle': function(flag, from)	{			// Проверка закончены или нет все команды отрисовки карты
			var out = false;
			if(gmxAPI._leaflet['moveInProgress']) return out;
			for (var id in gmxAPI._leaflet['renderingObjects']) {
				return out;
			}
			
			if(gmxAPI._leaflet['lastDrawTime']) return out;
			var cnt = gmxAPI._leaflet['imageLoader'].getCounts();	// колич.выполняющихся запросов загрузки img
			if(cnt <= 0) {
				out = true;
				for (var i = 0, to = gmxAPI.map.layers.length; i < to; i++)
				{
					var child = gmxAPI.map.layers[i];
					if(!child.isVisible) continue;
					var mapNode = mapNodes[child.objectId];
					if(mapNode['lastDrawTime']) {	// слой находится в процессе отрисовки
						out = false;
						break;
					}
				}
				//out = {'out':out, 'from':from};
				if(flag && out) {
					gmxAPI._listeners.dispatchEvent('mapDrawDone', gmxAPI.map, out);	// map отрисована
				}
			}
			return out;
		}
		,
		'chkKeys': function(out, ev)	{		// Проверка нажатия спец.символов
			if(ev.buttons || ev.button) out['buttons'] = ev.buttons || ev.button;
			if(ev.ctrlKey)	out['ctrlKey'] = ev.ctrlKey;
			if(ev.altKey)	out['altKey'] = ev.altKey;
			if(ev.shiftKey)	out['shiftKey'] = ev.shiftKey;
			if(ev.metaKey)	out['metaKey'] = ev.metaKey;
		}
		,
		'getCurrentBounds': function(zoom)	{		// Вычисление размеров тайла по zoom
			if(!zoom) zoom = LMap.getZoom();
			var vBounds = LMap.getBounds();
			var vpNorthWest = vBounds.getNorthWest();
			var vpSouthEast = vBounds.getSouthEast();
			var vp1 = LMap.project(vpNorthWest, zoom);
			var vp2 = LMap.project(vpSouthEast, zoom);
			var vPixelBounds = new L.Bounds();
			vPixelBounds.extend(vp1);
			vPixelBounds.extend(vp2);
			var vBoundsMerc = new L.Bounds();
			if(vpSouthEast.lng - vpNorthWest.lng > 360) {
				vBoundsMerc.extend(new L.Point(-gmxAPI.worldWidthMerc, gmxAPI.worldWidthMerc));
				vBoundsMerc.extend(new L.Point(gmxAPI.worldWidthMerc, -gmxAPI.worldWidthMerc));
			} else {
				vBoundsMerc.extend(new L.Point(gmxAPI.merc_x(vpNorthWest.lng), gmxAPI.merc_y(vpNorthWest.lat)));
				vBoundsMerc.extend(new L.Point(gmxAPI.merc_x(vpSouthEast.lng), gmxAPI.merc_y(vpSouthEast.lat)));
			}
			
			return {
				'vPixelBounds': vPixelBounds
				,'vBounds': vBounds
				,'vBoundsMerc': vBoundsMerc
			};
		}
		,
		'chkZoomCurrent': function(zoom)	{		// Вычисление размеров тайла по zoom
			if(!zoom) zoom = LMap.getZoom();
			var pz = Math.pow(2, zoom);
			var mInPixel =  pz/156543.033928041;
			gmxAPI._leaflet['mInPixel'] = mInPixel;
			gmxAPI._leaflet['zoomCurrent'] = {
				'pz': pz
				,'tileSize': 256 / mInPixel
				,'mInPixel': mInPixel
				,'gmxTileBounds': {}
			};
		}
		,
		'getXmlHttp': function() {			// Получить XMLHttpRequest
		  var xmlhttp;
		  if (typeof XMLHttpRequest != 'undefined') {
			xmlhttp = new XMLHttpRequest();
		  } else {
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
		'chkMapObjectsView': function() {		// Проверка zoomBounds на mapObjects
			var zoom = LMap.getZoom();
			for (var id in mapNodes) {
				var node = mapNodes[id];
				if(node['type'] !== 'mapObject' || (!node['minZ'] && !node['maxZ'])) continue;
				//var flag = (utils.chkVisibleObject(node.id) && utils.chkVisibilityByZoom(node.id) ? true : false);
				var flag = (utils.chkVisibilityByZoom(node.id) ? true : false);
				if(!node['leaflet']) gmxAPI._leaflet['drawManager'].add(id);
				utils.setVisibleNode({'obj': node, 'attr': flag});
				gmxAPI._leaflet['LabelsManager'].onChangeVisible(id, (!utils.chkVisibleObject(node.id) ? false : flag));
			}
		}
		,
		'rotatePoints': function(arr, angle, scale, center) {			// rotate - массива точек
			var out = [];
			angle *= Math.PI / 180.0
			var sin = Math.sin(angle);
			var cos = Math.cos(angle);
			for (var i = 0; i < arr.length; i++)
			{
				var x = scale * arr[i].x - center.x;
				var y = scale * arr[i].y - center.y;
				out.push({
					'x': cos * x - sin * y + center.x
					,'y': sin * x + cos * y + center.y
				});
			}
			return out;
		}
		, 
		'getPatternIcon': function(item, style) {			// получить bitmap стиля pattern
			if(!style['pattern']) return null;
			var pattern = style['pattern'];
			var prop = (item ? item['properties'] : {});

			var notFunc = true;
			var step = (pattern.step > 0 ? pattern.step : 0);		// шаг между линиями
			if (pattern.patternStepFunction != null && prop != null) {
				step = pattern.patternStepFunction(prop);
				notFunc = false;
			}
			if (step > patternDefaults['max_step']) step = patternDefaults['max_step'];
			else if (step < patternDefaults['min_step']) step = patternDefaults['min_step'];
			
			var size = (pattern.width > 0 ? pattern.width : 8);		// толщина линий
			if (pattern.patternWidthFunction != null && prop != null) {
				size = pattern.patternWidthFunction(prop);
				notFunc = false;
			}
			if (size > patternDefaults['max_width']) size = patternDefaults['max_width'];
			else if (size < patternDefaults['min_width']) size = patternDefaults['min_width'];

			var op = style['fillOpacity'];
			if (style['opacityFunction'] != null && prop != null) {
				op = style['opacityFunction'](prop) / 100;
				notFunc = false;
			}
			
			var arr = (pattern.colors != null ? pattern.colors : []);
			var count = arr.length;
			var resColors = []
			var rgb = [0xff0000, 0x00ff00, 0x0000ff];
			for (var i = 0; i < arr.length; i++) {
				var col = arr[i];
				if(pattern['patternColorsFunction'][i] != null) {
					col =  (prop != null ? pattern['patternColorsFunction'][i](prop): rgb[i%3]);
					notFunc = false;
				}
				resColors.push(col);
			}

			var delta = size + step;
			var allSize = delta * count;
			var center = 0,	radius = 0,	rad = 0; 

			var hh = allSize;				// высота битмапа
			var ww = allSize;				// ширина битмапа
			var type = pattern.style; 
			var flagRotate = false; 
			if (type == 'diagonal1' || type == 'diagonal2' || type == 'cross' || type == 'cross1') {
				flagRotate = true;
			} else if (type == 'circle') {
				ww = hh = 2 * delta;
				center = Math.floor(ww / 2);	// центр круга
				radius = Math.floor(size / 2);	// радиус
				rad = 2 * Math.PI / count;		// угол в рад.
			}
			if (ww * hh > patternDefaults['max_width']) {
				//gmxAPI.addDebugWarnings({'func': 'getPatternIcon', 'Error': 'MAX_PATTERN_SIZE', 'alert': 'Bitmap from pattern is too big'});
				//return null;
			}

			var canvas = document.createElement('canvas');
			canvas.width = ww; canvas.height = hh;
			var ptx = canvas.getContext('2d');
			ptx.clearRect(0, 0, canvas.width , canvas.height);
			if (type === 'diagonal2' || type === 'vertical') {
				ptx.translate(ww, 0);
				ptx.rotate(Math.PI/2);
			}

			for (var i = 0; i < count; i++) {
				ptx.beginPath();
				var col = resColors[i];
				var fillStyle = gmxAPI._leaflet['utils'].dec2rgba(col, 1);
				fillStyle = fillStyle.replace(/1\)/, op + ')');
				ptx.fillStyle = fillStyle;

				if (flagRotate) {
					var x1 = i * delta; var xx1 = x1 + size;
					ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);

					x1 += allSize; xx1 = x1 + size;
					ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);
					if (type === 'cross' || type === 'cross1') {
						x1 = i * delta; xx1 = x1 + size;
						ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);

						x1 += allSize; xx1 = x1 + size;
						ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);
					}
				} else if (type == 'circle') {
					ptx.arc(center, center, size, i*rad, (i+1)*rad);
					ptx.lineTo(center, center);
				} else {
					ptx.fillRect(0, i * delta, ww, size);
				}
				ptx.closePath();
				ptx.fill();
			}
			var imgData = ptx.getImageData(0, 0, ww, hh);
			var canvas1 = document.createElement('canvas');
			canvas1.width = ww
			canvas1.height = hh;
			var ptx1 = canvas1.getContext('2d');
			ptx1.drawImage(canvas, 0, 0, ww, hh);
			return { 'notFunc': notFunc, 'canvas': canvas1 };
		}
		,
		'replaceColorAndRotate': function(img, style, size) {		// заменить цвет пикселов в иконке + rotate - результат canvas
			var canvas = document.createElement('canvas');
			var ww = style.imageWidth;
			var hh = style.imageHeight;
			if(style['rotateRes']) {
				ww = size;
				hh = ww;
			}
			canvas.width = ww;
			canvas.height = hh;
			var ptx = canvas.getContext('2d');
			ptx.clearRect(0, 0, ww , hh);
			//ptx.fillRect(0, 0, ww , hh);
			var tx = ty = 0;
			if(style['rotateRes']) {
				tx = style.imageWidth/2;
				ty = style.imageHeight/2;
				ptx.translate(ww/2, hh/2);
				ptx.rotate(Math.PI * style['rotateRes']/180);
			}
			ptx.drawImage(img, -tx, -ty);
			if('color' in style) {
				var color = style.color;
				if(typeof(style.color) == 'string') color = parseInt('0x' + style.color.replace(/#/, ''));
				if (color != gmxAPI._leaflet['utils'].DEFAULT_REPLACEMENT_COLOR) {
					var r = (color >> 16) & 255;
					var g = (color >> 8) & 255;
					var b = color & 255;
					var flag = false;

					var imageData = ptx.getImageData(0, 0, ww, hh);
					for (var i = 0; i < imageData.data.length; i+=4)
					{
						if (imageData.data[i] == 0xff
							&& imageData.data[i+1] == 0
							&& imageData.data[i+2] == 0xff
							) {
							imageData.data[i] = r;
							imageData.data[i+1] = g;
							imageData.data[i+2] = b;
							flag = true;
						}
					}
					if(flag) ptx.putImageData(imageData, 0, 0);
				}
			}
			return canvas;
		}
		,
		'getMapImage': function(attr)	{			//получить PNG карты
		}
		,
		'startDrag': function(node)	{			// Начать Drag
			if(!node || !node['dragging']) return false;
			var layer = node['leaflet'];
			if(!layer && node['type'] != 'map') return false;
			var chkDrag = function(eType, e) {
				if(!node['dragging']) return;
				var gmxNode = gmxAPI.mapNodes[node.id];		// Нода gmxAPI
				var latlng = (layer && layer._latlng ? layer._latlng : e.latlng || gmxAPI._leaflet['mousePos']);
				var ph = {
					'obj':gmxNode
					,'attr': {
						'id': e.target.options.from
						,'x': latlng.lng
						,'y': latlng.lat
						,'e': e
					}
				};
				gmxAPI._listeners.dispatchEvent(eType, gmxNode, ph);
			};
			// todo drag без лефлета
			if(layer && layer.dragging) {
				layer.on('dragstart', function(e){
					if(!node['dragging']) return;
					node['onDrag'] = true;
					chkDrag('dragstart', e);
				});	// dragstart на обьекте
				layer.on('drag', function(e){
					if(!node['dragging']) return;
					chkDrag('drag', e);
				});			// Drag на обьекте
				layer.on('dragend', function(e){		// dragend на обьекте
					//if(!node['dragging']) return;
					node['onDrag'] = false;
					chkDrag('dragend', e);
					//layer.off('drag');
					//layer.off('dragstart');
					//layer.off('dragend');
				});
				layer.dragging.enable();
				layer.options['_isHandlers'] = true;
				layer.options['dragging'] = true;
				layer.update();
			}
			else
			{
				if(!layer) layer = LMap;
				layer.on('mouseover', function(e) {
					commands.freeze();
				});
				layer.on('mouseout', function(e) {
					if(!gmxAPI._leaflet['mousePressed']) commands.unfreeze();
				});
				node['dragMe'] = function(e) {		// dragstart на обьекте
					chkDrag('dragstart', e);
					commands.freeze();
					//L.DomEvent.stop(e.originalEvent);
					if(!node['_dragInitOn']) {
						LMap.on('mousemove', function(e) {		// drag на обьекте
							if(gmxAPI._leaflet['curDragState']) {
								chkDrag('drag', e);
							}
						});
						LMap.on('mouseup', function(e) {			// dragend на обьекте
							commands.unfreeze();
							chkDrag('dragend', e);
							node['_dragInitOn'] = false;
						});
					}
					node['_dragInitOn'] = true;		// drag инициализирован
				};
			}
		}
		,
		'chkClassName': function(node, className, stopNode)	{			//проверить есть заданный className по ветке родителей до ноды
			if(!node || node == stopNode) return false;
			try {
				var pName = node['className'] || '';
				if(typeof(pName) == 'string' && pName.indexOf(className) != -1) return true;
				if(node.parentNode) return utils.chkClassName(node.parentNode, className, stopNode);
			} catch(e) {
				return true;
			}
		}
		,
		'getScaleImage': function(img, sx, sy)	{			//получить img отскалированный в Canvas
			var canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			var ctx = canvas.getContext('2d');
			if(!sy) sy = sx;
			ctx.scale(sx * img.width, sy * img.height);
			var divOut = gmxAPI._div;
			ctx.drawImage(img, 0, 0);
			return canvas;
		}
		,
		'prpLayerBounds': function(geom)	{			// Подготовка атрибута границ слоя
			var out = {};
			var type = geom.type;
			out['type'] = type;
			var arr = null;
			if(geom.coordinates) {						// Формируем MULTIPOLYGON
				if(type == 'POLYGON' || type == 'Polygon') {
					arr = [geom.coordinates];
				} else if(type == 'MULTIPOLYGON' || type == 'MultiPolygon') {
					arr = geom.coordinates;
				}
				if(arr) {
					var	bounds = new L.Bounds();
					var pointsArr = [];
					for (var i = 0; i < arr.length; i++)
					{
						for (var j = 0; j < arr[i].length; j++)
						{
							var pArr = [];
							var pol = arr[i][j];
							for (var j1 = 0; j1 < pol.length; j1++)
							{
								var p = (typeof(pol[j1]) === 'object' ? new L.Point( pol[j1][0], pol[j1][1] ) : new L.Point( pol[j1++], pol[j1] ));
								pArr.push(p);
								bounds.extend(p);
							}
							pointsArr.push(pArr);
						}
					}
					out['geom'] = pointsArr;						// Массив Point границ слоя
					out['bounds'] = bounds;							// Bounds слоя
				}
			}
			return out;
		}
		,
		'prpLayerAttr': function(layer, node)	{				// Подготовка атрибутов слоя
			var out = {};
			if(layer) {
				if(layer.properties) {
					var prop = layer.properties;
					if(node['type'] == 'RasterLayer') {			// растровый слой
						out['minZoom'] = (prop.MinZoom ? prop.MinZoom : 1);
						out['maxZoom'] = (prop.MaxZoom ? prop.MaxZoom : 20);
						if(prop.type == 'Overlay') out['isOverlay'] = true;
					}
					else if(node['type'] == 'VectorLayer') {	// векторный слой
						out['identityField'] = (prop.identityField ? prop.identityField : 'ogc_fid');
						out['typeGeo'] = (prop.GeometryType ? prop.GeometryType : 'Polygon');
						out['TemporalColumnName'] = (prop.TemporalColumnName ? prop.TemporalColumnName : '');
						//out['tilesVers'] = (prop.tilesVers ? prop.tilesVers : []);
						
						out['minZoom'] = 22;
						out['maxZoom'] = 1;
						for (var i = 0; i < prop.styles.length; i++)
						{
							var style = prop.styles[i];
							out['minZoom'] = Math.min(out['minZoom'], style['MinZoom']);
							out['maxZoom'] = Math.max(out['maxZoom'], style['MaxZoom']);
							//if(style['clusters']) out['clustersFlag'] = true;	// Признак кластеризации на слое
						}
					}
				}
				if(layer.geometry) {
					var pt = utils.prpLayerBounds(layer.geometry);
					if(pt['geom']) out['geom'] = pt['geom'];					// Массив Point границ слоя
					if(pt['bounds']) out['bounds'] = pt['bounds'];				// Bounds слоя
					if(layer.mercGeometry) {
						var pt = utils.prpLayerBounds(layer.mercGeometry);
						if(pt['geom']) {
							out['mercGeom'] = pt['geom'];				// Массив Point границ слоя в merc
							//out['mercGeom'] = [L.LineUtil.simplify(pt['geom'][0], 120)];
						}
					}
				}
			}
			return out;
		}
		,
		'getLabelSize': function(txt, style)	{			// Получить размер Label
			var out = {'x': 0, 'y': 0};
			if(style) {
				var ptx = gmxAPI._leaflet['labelCanvas'].getContext('2d');
				ptx.clearRect(0, 0, 512, 512);
				ptx.font = style['font'];
				ptx.fillStyle = style['fillStyle'];
				ptx.fillText(txt, 0, 0);
				
				var sizeLabel = style['size'] || 12;
				out.x = ptx.measureText(txt).width;
				out.y = sizeLabel + 2;
			}
			return out;
		}
		,
		'chkPointWithDelta': function(chkBounds, point, attr)	{			// Проверка точки(с учетом размеров) на принадлежность Bounds
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			return (
				(chkBounds.min.x - point.x)*mInPixel > attr.sx + (attr.sxLabelLeft || 0)
				|| (point.x - chkBounds.max.x)*mInPixel > attr.sx + (attr.sxLabelRight || 0)
				|| (chkBounds.min.y - point.y)*mInPixel > attr.sy + (attr.syLabelBottom || 0)
				|| (point.y - chkBounds.max.y)*mInPixel > attr.sy + (attr.syLabelTop || 0)
				? false : true);
		}
		,
		'chkPointInPolyLine': function(chkPoint, lineHeight, coords) {	// Проверка точки(с учетом размеров) на принадлежность линии
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			var chkLineHeight = lineHeight / mInPixel;
			chkLineHeight *= chkLineHeight;
			
			var p1 = coords[0];
			for (var i = 1; i < coords.length; i++)
			{
				var p2 = coords[i];
				var sqDist = L.LineUtil._sqClosestPointOnSegment(chkPoint, p1, p2, true);
				if(sqDist < chkLineHeight) return true;
				p1 = p2;
			}
			return false;
		}
		,
		'isPointInPolygon': function(chkPoint, poly)	{			// Проверка точки на принадлежность полигону
			var isIn = false;
			var p1 = poly[0];
			for (var i = 1; i < poly.length; i++)
			{
				var p2 = poly[i];
				if (chkPoint.x > Math.min(p1.x, p2.x)) 
				{
					if (chkPoint.x <= Math.max(p1.x, p2.x)) 
					{
						if (chkPoint.y <= Math.max(p1.y, p2.y)) 
						{
							if (p1.x != p2.x) 
							{
								var xinters = (chkPoint.x - p1.x)*(p2.y - p1.y)/(p2.x - p1.x) + p1.y;
								if (p1.y == p2.y || chkPoint.y <= xinters) isIn = !isIn;
							}
						}
					}
				}
				p1 = p2;
			}
			return isIn;
		}
		,
		'isPointInPolygonArr': function(chkPoint, poly)	{			// Проверка точки на принадлежность полигону в виде массива
			var isIn = false;
			var x = chkPoint[0];
			var y = chkPoint[1];
			var p1 = poly[0];
			for (var i = 1; i < poly.length; i++)
			{
				var p2 = poly[i];
				var xmin = Math.min(p1[0], p2[0]);
				var xmax = Math.max(p1[0], p2[0]);
				var ymax = Math.max(p1[1], p2[1]);
				if (x > xmin) 
				{
					if (x <= xmax) 
					{
						if (y <= ymax) 
						{
							if (p1[0] != p2[0]) 
							{
								var xinters = (x - p1[0])*(p2[1] - p1[1])/(p2[0] - p1[0]) + p1[1];
								if (p1[1] == p2[1] || y <= xinters) isIn = !isIn;
							}
						}
					}
				}
				p1 = p2;
			}
			return isIn;
		}
		,
		'getMapPosition': function()	{			// Получить позицию карты
			var zoom = LMap.getZoom();
			if(!zoom) {
				return;
			}
			var pos = LMap.getCenter();
			var size = LMap.getSize();
			var vbounds = LMap.getBounds();
			var nw = vbounds.getNorthWest();
			var se = vbounds.getSouthEast();
			var dx = (nw['lng'] < -360 ? 360 : 0);
			var ext = {
				'minX': nw['lng'] + dx
				,'minY': se['lat']
				,'maxX': se['lng'] + dx
				,'maxY': nw['lat']
			};
			var currPosition = {
				'z': zoom
				,'stageHeight': size['y']
				,'x': gmxAPI.merc_x(pos['lng'])
				,'y': gmxAPI.merc_y(pos['lat'])
				,'latlng': {
					'x': pos['lng']
					,'y': pos['lat']
					,'mouseX': utils.getMouseX()
					,'mouseY': utils.getMouseY()
					,'extent': ext
				}
			};
			currPosition['mouseX'] = gmxAPI.merc_x(currPosition['latlng']['mouseX']);
			currPosition['mouseY'] = gmxAPI.merc_x(currPosition['latlng']['mouseY']);
			currPosition['extent'] = {
				'minX': gmxAPI.merc_x(ext['minX']),
				'minY': gmxAPI.merc_y(ext['minY']),
				'maxX': gmxAPI.merc_x(ext['maxX']),
				'maxY': gmxAPI.merc_y(ext['maxY'])
			};
			return currPosition;
		}
		,
		'runMoveTo': function(attr, zd)	{				//позиционирует карту по координатам
			if(moveToTimer) clearTimeout(moveToTimer);
			if(!zd) zd = 200;
			moveToTimer = setTimeout(function() {
				if(!attr && !gmxAPI.map.needMove) return;
				var flagInit = (gmxAPI.map.needMove ? true : false);
				var px = (attr ? attr['x'] : (flagInit ? gmxAPI.map.needMove.x : 0));
				var py = (attr ? attr['y'] : (flagInit ? gmxAPI.map.needMove.y : 0));
				var z = (attr ? attr['z'] : (flagInit ? gmxAPI.map.needMove.z : 1));
				var pos = new L.LatLng(py, px);
				gmxAPI.map.needMove = null;
				LMap.setView(pos, z, flagInit);
			}, zd);
		}
		,
		'getPixelMap': function()	{				// Получение текущий размер карты в pixels
			var vBounds = LMap.getBounds();
			var vpNorthWest = vBounds.getNorthWest();
			var vpSouthEast = vBounds.getSouthEast();
			var vp1 = LMap.project(vpNorthWest);
			var vp2 = LMap.project(vpSouthEast);
			return new L.Point(vp2.x - vp1.x, vp2.y - vp1.y);
		}
		,
		'chkBoundsVisible': function(b)	{					// проверить видимость Bounds с учетом сдвигов по X
			var vbounds = LMap.getBounds();
			var nw = vbounds.getNorthWest();
			var se = vbounds.getSouthEast();
			var vb = new L.Bounds(new L.Point(nw['lng'], nw['lat']), new L.Point(se['lng'], se['lat']));
			if(vb.intersects(b)) return true;
			var tb = new L.Bounds(new L.Point(b.min.x + 360, b.min.y), new L.Point(b.max.x + 360, b.max.y));
			if(vb.intersects(tb)) return true;
			tb = new L.Bounds(new L.Point(b.min.x - 360, b.min.y), new L.Point(b.max.x - 360, b.max.y));
			if(vb.intersects(tb)) return true;
			return false;
		}
		,
		'getOSMShift': function()	{				// Получение сдвига OSM
			var pos = LMap.getCenter();
			var z = LMap.getZoom();
			var point = LMap.project(pos);
			var p1 = LMap.project(new L.LatLng(gmxAPI.from_merc_y(utils.y_ex(pos.lat)), pos.lng), z);
			return point.y - p1.y;
		}
		,
		'chkMouseHover': function(attr, fName)	{					// проверка Hover мыши
			//if(attr['tID'] && attr['tID'].indexOf('_drawing') > 0 && gmxAPI.map.drawing.chkMouseHover(attr, fName)) return true;
			if(gmxAPI.map.drawing.chkMouseHover(attr, fName)) return true;
			return false;
		}
		,
		'chkGlobalEvent': function(attr)	{					// проверка Click на перекрытых нодах
			if(!attr || !attr['evName']) return;
			var evName = attr['evName'];

			var standartTools = gmxAPI.map.standartTools;
			if(standartTools && !skipToolNames[standartTools.activeToolName]) {
				var from = gmxAPI.map.layers.length - 1;
				var arr = [];
				for (var i = from; i >= 0; i--)
				{
					var child = gmxAPI.map.layers[i];
					if(!child.isVisible) continue;
					var mapNode = mapNodes[child.objectId];
					if(mapNode['eventsCheck']) {
						arr.push({'zIndex': mapNode['zIndex'], 'id': child.objectId});
					}
				}
				arr = arr.sort(function(a, b) { return b['zIndex'] - a['zIndex']; });
				for (var i = 0, to = arr.length; i < to; i++)
				{
					var it = arr[i];
					var mapNode = mapNodes[it['id']];
					if(mapNode['eventsCheck'](evName, attr)) {
						return true;
					}
				}
			}
			if(attr['tID']) {
				var gmxNode = null;
				if(attr['tID'].indexOf('_drawing') > 0) {
					gmxNode = gmxAPI.map.drawing.getHoverItem(attr);
				}
				if(gmxNode && gmxNode['stateListeners'][evName]) {
					if(gmxAPI._listeners.dispatchEvent(evName, gmxNode, {'attr':attr})) return true;
				}
			}
			if(attr['node'] && attr['hNode'] && attr['hNode']['handlers'][evName]) {
				if(attr['hNode']['handlers'][evName](attr['node']['id'], attr['node'].geometry.properties, {'ev':attr['ev']})) return true;
			}

			var mapID = gmxAPI.map['objectId'];
			var node = mapNodes[mapID];
			if(node['handlers'][evName]) {
				if(node['handlers'][evName](mapID, gmxAPI.map.properties, attr)) return true;
			} else if(gmxAPI.map['stateListeners'][evName] && gmxAPI.map['stateListeners'][evName].length) {
				if(gmxAPI._listeners.dispatchEvent(evName, gmxAPI.map, {'attr':attr})) return true;
			}
		}
		,
		'chkVisibilityByZoom': function(id)	{				// проверка видимости обьекта - по minZ maxZ
			var node = mapNodes[id];
			if(!node || node['type'] === 'map') return true;
			var pNode = mapNodes[node['parentId']];
			var zoom = LMap.getZoom();
			var flag = ((node['minZ'] && zoom < node['minZ']) || (node['maxZ'] && zoom > node['maxZ']) ? false 
				: (pNode ? utils.chkVisibilityByZoom(pNode.id) : true));
			return flag;
		}
		,
		'chkVisibleObject': function(id)	{				// проверка видимости обьекта - по isVisible
			var node = mapNodes[id];
			if(!node || node['type'] === 'map') return true;
			if(node.isVisible === false) return false;
			return utils.chkVisibleObject(node['parentId']);
		}
		,
		'getTileBoundsMerc': function(point, zoom)	{			// определение границ тайла
			if(!gmxAPI._leaflet['zoomCurrent']) utils.chkZoomCurrent();
			if(!zoom) zoom = LMap.getZoom();
			var drawTileID = zoom + '_' + point.x + '_' + point.y;
			//var tileSize = Math.pow(2, 8 - zoom) * 156543.033928041;
			if(gmxAPI._leaflet['zoomCurrent']['gmxTileBounds'][drawTileID]) {
				return gmxAPI._leaflet['zoomCurrent']['gmxTileBounds'][drawTileID];
			}
			
			var tileSize = gmxAPI._leaflet['zoomCurrent']['tileSize'];
			var minx = point.x * tileSize;
			var miny = point.y * tileSize;
			var p = new L.Point(minx, miny);
			var bounds = new L.Bounds(p);
			bounds.extend(p);
			var maxx = minx + tileSize;
			var maxy = miny + tileSize;
			bounds.extend(new L.Point(maxx, maxy));
			gmxAPI._leaflet['zoomCurrent']['gmxTileBounds'][drawTileID] = bounds;
			return bounds;
		}
		,
		'getTileListByBounds': function(bounds, zoom)	{		// получить список тайлов по extent на определенном zoom
			var res = [];
			var southWest = bounds._southWest,
				northEast = bounds._northEast;
			var tileSize = Math.pow(2, 8 - zoom) * 156543.033928041;
			var minx = Math.floor(gmxAPI.merc_x(southWest.lat)/tileSize);
			var miny = Math.floor(gmxAPI.merc_y(southWest.lng)/tileSize);
			var maxx = Math.ceil(gmxAPI.merc_x(northEast.lat)/tileSize);
			var maxy = Math.ceil(gmxAPI.merc_y(northEast.lng)/tileSize);
			for (var x = minx; x < maxx; x++)
			{
				for (var y = miny; y < maxy; y++)
				{
					res.push({'x': x, 'y': y, 'z': zoom});
				}
			}
			return res;
		}
		,
		'getImageSize': function(pt, flag, id)	{				// определение размеров image
			var url = pt['iconUrl'];
			if(imagesSize[url]) {
				pt['imageWidth'] = imagesSize[url]['imageWidth'];
				pt['imageHeight'] = imagesSize[url]['imageHeight'];
				if(flag) {
					pt['image'] = imagesSize[url]['image'];
					if(imagesSize[url]['polygons']) pt['polygons'] = imagesSize[url]['polygons'];
				}
				if(pt['waitStyle']) {
					pt['waitStyle'](id);
				}
				delete pt['waitStyle'];
				return;
			}
			var ph = {
				'src': url
				,'callback': function(it, svgFlag) {
					pt['imageWidth'] = it.width;
					pt['imageHeight'] = it.height;
					if(svgFlag) {
						pt['polygons'] = it.polygons;
					} else {
						if(flag) pt['image'] = it;
					}
					imagesSize[url] = pt;
					if(pt['waitStyle']) {
						pt['waitStyle'](id);
					}
					delete pt['waitStyle'];
					gmxAPI._listeners.dispatchEvent('onIconLoaded', null, id);		// image загружен
				}
				,'onerror': function(){
					pt['imageWidth'] = 1;
					pt['imageHeight'] = 0;
					pt['image'] = null;
					imagesSize[url] = pt;
					gmxAPI.addDebugWarnings({'url': url, 'func': 'getImageSize', 'Error': 'image not found'});
				}
			};
			if(('color' in pt && pt['color'] != utils.DEFAULT_REPLACEMENT_COLOR)
				|| 'rotate' in pt
			) ph['crossOrigin'] = 'anonymous';
			gmxAPI._leaflet['imageLoader'].unshift(ph);
		}
		,'getMouseX':	function()	{ return (gmxAPI._leaflet['mousePos'] ? gmxAPI._leaflet['mousePos'].lng : 0); }			// Позиция мыши X
		,'getMouseY':	function()	{ return (gmxAPI._leaflet['mousePos'] ? gmxAPI._leaflet['mousePos'].lat : 0);	}		// Позиция мыши Y
		,
		'parseStyle': function(st, id, callback)	{			// перевод Style Scanex->leaflet
			var pt =  {
			};
			if(!st) return null;
			
			pt['label'] = false;
			if(typeof(st['label']) === 'object') {											//	Есть стиль label
				pt['label'] = {};
				var ph = st['label'];
				if('color' in ph) pt['label']['color'] = ph['color'];
				if('haloColor' in ph) pt['label']['haloColor'] = ph['haloColor'];
				if('size' in ph) pt['label']['size'] = ph['size'];
				if('spacing' in ph) pt['label']['spacing'] = ph['spacing'];
				if('align' in ph) pt['label']['align'] = ph['align'];
				if('dx' in ph) pt['label']['dx'] = ph['dx'];
				if('dy' in ph) pt['label']['dy'] = ph['dy'];
				if('field' in ph) pt['label']['field'] = ph['field'];
			}
			pt['marker'] = false;
			var isMarker = (typeof(st['marker']) === 'object' ? true : false);
			
			if(isMarker) {				//	Есть стиль marker
				if('size' in st['marker']) pt['size'] = st['marker']['size'];
				if('circle' in st['marker']) pt['circle'] = st['marker']['circle'];
				if('center' in st['marker']) pt['center'] = st['marker']['center'];
				if('scale' in st['marker']) pt['scale'] = st['marker']['scale'];
			}
			if(isMarker && 'image' in st['marker']) {				//	Есть image у стиля marker
				pt['marker'] = true;
				var ph = st['marker'];
				if('color' in ph) pt['color'] = ph['color'];
				pt['opacity'] = ('opacity' in ph ? ph['opacity'] : 100);
				if('size' in ph) pt['size'] = ph['size'];
				if('scale' in ph) pt['scale'] = ph['scale'];
				if('minScale' in ph) pt['minScale'] = ph['minScale'];
				if('maxScale' in ph) pt['maxScale'] = ph['maxScale'];
				if('angle' in ph) pt['rotate'] = ph['angle'];
				if('image' in ph) {
					pt['iconUrl'] = ph['image'];
					try {
						pt['waitStyle'] = callback;
						utils.getImageSize(pt, true, id);
					} catch(ev) {
						gmxAPI.addDebugWarnings({'url': pt['iconUrl'], 'func': 'getImageSize', 'alert': 'getImageSize error ' + pt['iconUrl']});
					}
				}
				
				if('center' in ph) pt['center'] = ph['center'];
				if('dx' in ph) pt['dx'] = ph['dx'];
				if('dy' in ph) pt['dy'] = ph['dy'];
				
			} else {
				pt['fill'] = false;
				if(typeof(st['fill']) === 'object') {					//	Есть стиль заполнения
					pt['fill'] = true;
					var ph = st['fill'];
					if('color' in ph) pt['fillColor'] = ph['color'];
					pt['fillOpacity'] = ('opacity' in ph ? ph['opacity'] : 100);
					if('pattern' in ph) {
						var pattern = ph['pattern'];
						delete pattern['_res'];
						pt['pattern'] = pattern;
						if('step' in pattern && typeof(pattern['step']) === 'string') {
							pattern['patternStepFunction'] = gmxAPI.Parsers.parseExpression(pattern['step']);
						}
						if('width' in pattern && typeof(pattern['width']) === 'string') {
							pattern['patternWidthFunction'] = gmxAPI.Parsers.parseExpression(pattern['width']);
						}
						if('colors' in pattern) {
							var arr = [];
							for (var i = 0; i < pattern.colors.length; i++)
							{
								var rt = pattern.colors[i];
								arr.push(typeof(rt) === 'string' ? gmxAPI.Parsers.parseExpression(rt) : null);
							}
							pattern['patternColorsFunction'] = arr;
						}
					} else if(typeof(ph['radialGradient']) === 'object') {
						pt['radialGradient'] = ph['radialGradient'];
						//	x1,y1,r1 — координаты центра и радиус первой окружности;
						//	x2,y2,r2 — координаты центра и радиус второй окружности.
						//	addColorStop - стоп цвета объекта градиента [[position, color]...]
						//		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
						//		color — код цвета или формула.
						//		opacity — прозрачность
						var arr = ['r1', 'x1', 'y1', 'r2', 'x2', 'y2'];
						for (var i = 0; i < arr.length; i++)
						{
							var it = arr[i];
							pt['radialGradient'][it] = (it in ph['radialGradient'] ? ph['radialGradient'][it] : 0);
							if(typeof(pt['radialGradient'][it]) === 'string') {
								pt['radialGradient'][it+'Function'] = gmxAPI.Parsers.parseExpression(pt['radialGradient'][it]);
							}
						}
						
						pt['radialGradient']['addColorStop'] = ph['radialGradient']['addColorStop'] || [[0, 0xFF0000], [1, 0xFFFFFF]];
						pt['radialGradient']['addColorStopFunctions'] = [];
						for (var i = 0; i < pt['radialGradient']['addColorStop'].length; i++)
						{
							var arr = pt['radialGradient']['addColorStop'][i];
							pt['radialGradient']['addColorStopFunctions'].push([
								(typeof(arr[0]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[0]) : null)
								,(typeof(arr[1]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[1]) : null)
								,(typeof(arr[2]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[2]) : null)
							]);
						}
					} else if(typeof(ph['linearGradient']) === 'object') {
						pt['linearGradient'] = ph['linearGradient'];
						//	x1,y1 — координаты начальной точки
						//	x2,y2 — координаты конечной точки
						//	addColorStop - стоп цвета объекта градиента [[position, color]...]
						//		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
						//		color — код цвета или формула.
						//		opacity — прозрачность
						var arr = ['x1', 'y1', 'x2', 'y2'];
						for (var i = 0; i < arr.length; i++)
						{
							var it = arr[i];
							pt['linearGradient'][it] = (it in ph['linearGradient'] ? ph['linearGradient'][it] : 0);
							if(typeof(pt['linearGradient'][it]) === 'string') {
								pt['linearGradient'][it+'Function'] = gmxAPI.Parsers.parseExpression(pt['linearGradient'][it]);
							}
						}
						
						pt['linearGradient']['addColorStop'] = ph['linearGradient']['addColorStop'] || [[0, 0xFF0000], [1, 0xFFFFFF]];
						pt['linearGradient']['addColorStopFunctions'] = [];
						for (var i = 0; i < pt['linearGradient']['addColorStop'].length; i++)
						{
							var arr = pt['linearGradient']['addColorStop'][i];
							pt['linearGradient']['addColorStopFunctions'].push([
								(typeof(arr[0]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[0]) : null)
								,(typeof(arr[1]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[1]) : null)
								,(typeof(arr[2]) === 'string' ? gmxAPI.Parsers.parseExpression(arr[2]) : null)
							]);
						}
					}
				}
				pt['stroke'] = false;
				if(typeof(st['outline']) === 'object') {				//	Есть стиль контура
					pt['stroke'] = true;
					var ph = st['outline'];
					if('color' in ph) pt['color'] = ph['color'];
					pt['opacity'] = ('opacity' in ph ? ph['opacity'] : 100);
					if('thickness' in ph) pt['weight'] = ph['thickness'];
					if('dashes' in ph) pt['dashArray'] = ph['dashes'];
				}
			}
			if('rotate' in pt && typeof(pt['rotate']) === 'string') {
				pt['rotateFunction'] = gmxAPI.Parsers.parseExpression(pt['rotate']);
			}
			if('scale' in pt && typeof(pt['scale']) === 'string') {
				pt['scaleFunction'] = gmxAPI.Parsers.parseExpression(pt['scale']);
			}
			if('color' in pt && typeof(pt['color']) === 'string') {
				pt['colorFunction'] = gmxAPI.Parsers.parseExpression(pt['color']);
			}
			if('fillColor' in pt && typeof(pt['fillColor']) === 'string') {
				pt['fillColorFunction'] = gmxAPI.Parsers.parseExpression(pt['fillColor']);
			}

			return pt;
		}
/*		
		,
		'parseSQL': function(sql)	{							// парсинг SQL строки
			var zn = sql;
			if(typeof(zn) === 'string') {
				zn = zn.replace(/ AND /g, ' && ');
			}
			return zn
		}
*/
		,
		'isPropsInString': function(st)	{				// парсинг значений свойств в строке
			if(typeof(st) === 'string') {
				for(var i in regProps) {
					var matches = regProps[i].exec(st);
					if(matches && matches.length > 0) return true;
				}
			}
			return false;
		}
		,
		'isPropsInStyle': function(style)	{				// парсинг значений свойств в строке
			for(var key in style) {
				if(utils.isPropsInString(style[key])) return true;
			}
			return false;
		}
		,
		'chkPropsInString': function(str, prop, type)	{				// парсинг значений свойств в строке
			var zn = str;
			if(typeof(zn) === 'string') {
				if(zn.length === 0) return true;
				var zn1 = zn.replace(/\'([^\']+)\'/g, '');
				var reg = /\b([^\b]+?)\b/gm;
				var arr = zn.match(reg);
				var reg = /\[([^\]]+)\]/i;
				if(type == 1) reg = /\"([^\"]+)\"/i;
				else if(type == 2) reg = /\b([^\b]+)\b/i;
				
				var matches = reg.exec(zn);
				while(matches && matches.length > 0) {
					zn = zn.replace(matches[0], prop[matches[1]]);
					matches = reg.exec(zn);
				}
				if(type !== 3) zn = eval(zn);
			}
			return zn
		}
		,
		'evalStyle': function(style, prop)	{								// парсинг стиля лефлета
			var out = { };
			for(var key in style) {
				var zn = style[key];
				if(key + 'Function' in style && typeof(zn) === 'string') {
					zn = (style[key + 'Function'] ? style[key + 'Function'](prop) : 1);
				}
				//if(key + 'Function' in style && style[key + 'Function']) zn = style[key + 'Function'](prop);
				if(!style['ready']) {
					if(key === 'fillColor' || key === 'color') {
						out[key + '_dec'] = zn;
						out[key + '_rgba'] = utils.dec2rgba(zn, 1);
						zn = utils.dec2hex(zn);
						if(zn.substr(0,1) != '#') zn = '#' + zn;
					} else if(key === 'scale') {
						if(typeof(zn) === 'string') zn = 1;
					} else if(key === 'fillOpacity' || key === 'opacity') {
						if(zn >= 0) zn = zn / 100;
					}
				}
				out[key] = zn;
			}
			out['ready'] = true;
			return out;
		}
		,
		'getNodeProp': function(node, type, recursion)	{					// получить свойство ноды - рекурсивно
			if(!node) return null;
			if(type in node) return node[type];
			if(recursion) return (node.parentId in mapNodes ? utils.getNodeProp(mapNodes[node.parentId], type, recursion) : null);
		}
		,
		'removeLeafletNode': function(node)	{								// Удалить Leaflet ноду - рекурсивно
			if(!node['parentId']) return;
			var pNode = mapNodes[node['parentId']];
			var pGroup = (pNode ? pNode['group'] : LMap);
			if(node['group']) {
				if(node['marker']) {
					if(node['group']['_layers'][node['marker']['_leaflet_id']]) node['group'].removeLayer(node['marker']);
				}
				pGroup.removeLayer(node['group']);
			}
			if(node['leaflet'] && pGroup['_layers'][node['leaflet']['_leaflet_id']]) pGroup.removeLayer(node['leaflet']);
		}
		,
		'addCanvasIcon': function(node, regularStyle)	{				// создать Canvas иконку 
			if(!node.propHiden || !node.propHiden['getPos'] || !node.propHiden['drawMe']) return null;
			var point = node.propHiden['getPos']();
			var canvasIcon = L.canvasIcon({
				className: 'my-canvas-icon'
				,'node': node
				,'drawMe': node.propHiden['drawMe']
				//,iconAnchor: new L.Point(12, 12) // also can be set through CSS
			});
			return L.marker([point['y'], point['x']], {icon: canvasIcon, clickable: false});
		}
		,
		'setVisibleNode': setVisibleNode									// Рекурсивное изменение видимости
		,
		'repaintNode': function(node, recursion, type)	{					// перерисовать ноду - рекурсивно
			if(!node) {
				return null;
			}
			if(!type) type = 'regularStyle';
			var regularStyle = utils.getNodeProp(node, type, true);
			if(regularStyle) {				// Стиль определен
				var pNode = mapNodes[node['parentId']];
				if(node['type'] == 'filter') {				// отрисовка фильтра
					//utils.drawFilter(node);
					//node.leaflet = utils.drawNode(node, regularStyle);
					pNode.refreshFilter(node.id);
				} else if(node['isSetImage']) {
					if('refreshMe' in node) node['refreshMe']();				// свой отрисовщик
				} else if(node.geometry && node.geometry.type) {
					utils.removeLeafletNode(node);

					if(!utils.chkVisibleObject(node.id) || !utils.chkVisibilityByZoom(node.id)) {		// если обьект невидим пропускаем
						utils.setVisibleNode({'obj': node, 'attr': false});
						return;
					}

					node.geometry.id = node.id;
					if(regularStyle['iconUrl'] && !regularStyle['imageWidth']) {		// нарисовать после загрузки onIconLoaded
						gmxAPI._leaflet['drawManager'].add(node.id);					// добавим в менеджер отрисовки
						return;
					} else {
						if(node['subType'] === 'drawingFrame') {
							node.leaflet = new L.FeatureGroup([]);
							if(node['leaflet']) {
								utils.setVisibleNode({'obj': node, 'attr': true});
							}
						} else if(node['refreshMe']) { 
							node['refreshMe']();
							return;
						} else {
							node.leaflet = utils.drawNode(node, regularStyle);
							//node['leaflet']._isVisible = false;
							if(node['leaflet']) {
								utils.setVisibleNode({'obj': node, 'attr': true});
								if(node['dragging']) {	// todo drag без лефлета
									//if(node['geometry']&& node['geometry']['type'] == 'Point') {
										//node['leaflet']['options']['_isHandlers'] = true;
									//}
									utils.startDrag(node);
								}
								setNodeHandlers(node.id);
							}
						}
					}
				}
			}
			if(recursion) {
				for (var i = 0; i < node['children'].length; i++)
				{
					var child = mapNodes[node['children'][i]];
					utils.repaintNode(child, recursion, type);
				}
			}
		}
		,
		'drawPoint': function(node, style)	{			// отрисовка POINT геометрии
			var out = null;
			var styleType = (style['iconUrl'] ? 'marker' : (style['stroke'] || style['fill'] ? 'rectangle' : ''));
			if(style['circle']) styleType = 'circle';
			var geo = node.geometry;
			var pos = geo.coordinates;
			var prop = geo.properties;
			if(styleType === 'circle') {							// стиль окружность
				if('size' in style) style['radius'] = style['size'];
				if(!('weight' in style)) style['weight'] = 0;
				out = new L.CircleMarker(new L.LatLng(pos[1], pos[0]), style);
			} else if(styleType === 'marker') {						// стиль маркер
				var opt = {
					iconUrl: style['iconUrl']
					//,clickable: false
					//,shadowUrl: null
					,'from': node.id
					,iconAnchor: new L.Point(0, 0)
					//,'zIndexOffset': -1000
				};
				if(!style['scale']) style['scale'] = 1;
				var scale = style['scale'];
				if(typeof(scale) == 'string') {
					scale = (style['scaleFunction'] ? style['scaleFunction'](prop) : 1);
				}
				var ww = Math.floor(style['imageWidth'] * scale);
				var hh = Math.floor(style['imageHeight'] * scale);
				opt['iconSize'] = new L.Point(ww, hh);
				style['iconSize'] = opt['iconSize'];
				if(style['center']) opt['iconAnchor'] = new L.Point(ww/2, hh/2);
				else {
					if(style['dx']) opt['iconAnchor'].x -= style['dx'];
					if(style['dy']) opt['iconAnchor'].y -= style['dy'];
				}
				if(style['rotate']) {
					opt['rotate'] = style['rotate'];
					if(typeof(opt['rotate']) == 'string') {
						opt['rotate'] = (style['rotateFunction'] ? style['rotateFunction'](prop) : 0);
					}
				}
				style['iconAnchor'] = opt['iconAnchor'];
				
				var nIcon = L.Icon.extend({
					'options': opt
				});
				var optMarker = {
					icon: new nIcon()
					,'from': node.id
					,'rotate': opt['rotate']
					,'toPaneName': 'overlayPane'
				};
				if(node['subType'] === 'drawing') {
					optMarker['draggable'] = true;
					//optMarker['zIndexOffset'] = 10000;
				}
				
				out = new L.GMXMarker(new L.LatLng(pos[1], pos[0]), optMarker);
			} else if(styleType === 'rectangle') {					// стиль rectangle
				// create rectangle from a LatLngBounds
				var size = style['size'] || 0;
				var point = new L.LatLng(pos[1], pos[0]);
				style['skipSimplifyPoint'] = true;
				style['skipLastPoint'] = true;
				style['pointSize'] = size;
				style['shiftWeight'] = true;
				out = new L.GMXPointsMarkers([point, point], style);
			}
			if(style['label'] && node['label']) {
				setLabel(node.id, null);
			}
			
			if(out && node['subType'] === 'drawing') {
				var chkDrag = function(e) {		// Drag на drawing обьекте
					var eType = e.type;
					var gmxNode = gmxAPI.mapNodes[node.id];		// Нода gmxAPI
					var ph = {
						'obj':gmxNode
						,'attr': {
							'id': e.target.options.from
							,'x': e.target._latlng.lng
							,'y': e.target._latlng.lat
							,'e': e
						}
					};
					gmxAPI._listeners.dispatchEvent(eType, gmxNode, ph);		// tile загружен
				};
				out.on('drag', chkDrag);		// Drag на drawing обьекте
				//out.on('dragstart', chkDrag);
				out.on('dragend', chkDrag);
			}
			return out;
		}
		,
		'drawPolygon': function(node, style)	{			// отрисовка Polygon геометрии
			var prop = node.properties || {};
			var geojsonFeature = {
				"type": "Feature",
				"properties": prop,
				"geometry": node.geometry
			};
			var opt = {
				style: ('ready' in style ? style : utils.evalStyle(style, prop))
			};
			var out = L.geoJson(geojsonFeature, opt);
			return out;
		}
		,
		'drawMultiPolygon': function(node, style)	{			// отрисовка Polygon геометрии
			var prop = node.properties || {};
			var geojsonFeature = {
				"type": "Feature",
				"properties": prop,
				"geometry": node.geometry
			};
			var out = L.geoJson(geojsonFeature, {
				style: ('ready' in style ? style : utils.evalStyle(style, prop))
			});
			return out;
		}
		,
		'drawNode': function(node, style)	{			// отрисовка геометрии node
			if(!node.geometry || !node.geometry.type) return null;
			var geo = node.geometry;
			var type = geo.type;
			var prop = geo.properties;
			var geom = {'type': type, 'coordinates': geo.coordinates};
			var pt = {};
			//if(type === 'MULTIPOLYGON') 			pt['type'] = 'MultiPolygon';
			if(type === 'Point') 					return utils.drawPoint(node, style);
			else if(type === 'Polygon')				return utils.drawPolygon(node, style);
			else if(type === 'Polyline')			return utils.drawPolygon({'geometry': {'type': 'LineString', 'coordinates': geo.coordinates}, 'properties': prop}, style);
			else if(type === 'MultiPolyline')		return utils.drawPolygon({'geometry': {'type': 'MultiLineString', 'coordinates': geo.coordinates}, 'properties': prop}, style);
			else if(type === 'MultiPolygon')		return utils.drawMultiPolygon(node, style);
			else if(type === 'MultiPoint')			pt['type'] = 'MultiPoint';
			else if(type === 'POINT')				pt['type'] = 'Point';
			else if(type === 'MULTILINESTRING')		pt['type'] = 'MultiLineString';
			else if(type === 'LINESTRING')			pt['type'] = 'LineString';
			else if(type === 'GeometryCollection')	pt['type'] = 'GeometryCollection';
			return null;
		}
		,
		'chkPolygon': function(geo)	{			// перевод геометрии Scanex->leaflet
			if(geo.type === 'Polygon') {
				for (var i = 0; i < geo['coordinates'].length; i++)
				{
					var coords = geo['coordinates'][i];
					var len = coords.length - 1;
					if(coords[0][0] != coords[len][0] || coords[0][1] != coords[len][1]) coords.push(coords[0]);
				}
			}
		}
		,
		'fromLeafletTypeGeo': function(type)	{			// перевод геометрии type leaflet->Scanex
			if(type === 'MultiPolygon') 			type = 'MULTIPOLYGON';
			else if(type === 'Polygon')				type = 'POLYGON';
			else if(type === 'Point')				type = 'POINT';
			else if(type === 'MultiPolyline')		type = 'MULTILINESTRING';
			else if(type === 'Polyline')			type = 'LINESTRING';
			return type;
		}
		,
		'fromScanexTypeGeo': function(type)	{			// перевод геометрии type Scanex->leaflet
			if(type === 'MULTIPOLYGON') 			type = 'MultiPolygon';
			else if(type === 'POLYGON')				type = 'Polygon';
			else if(type === 'MultiPoint')			type = 'MultiPoint';
			else if(type === 'POINT')				type = 'Point';
			else if(type === 'MULTILINESTRING')		type = 'MultiPolyline';
			else if(type === 'LINESTRING')			type = 'Polyline';
			else if(type === 'GeometryCollection')	type = 'GeometryCollection';
			return type;
		}
		,
		'parseGeometry': function(geo, boundsFlag)	{			// перевод геометрии Scanex->leaflet
			var geom = gmxAPI.clone(geo);
			/*if(geom['type'] === 'LINESTRING' && geom['coordinates'].length === 2) {
				geom['coordinates'] = [geom['coordinates']];
			}*/
			var pt = gmxAPI.transformGeometry(geom, function(it){return it;}, function(it){return it;});
			pt.type = utils.fromScanexTypeGeo(pt.type);
			var b = gmxAPI.getBounds(geom.coordinates);
			pt.bounds = new L.Bounds(new L.Point(b.minX, b.minY), new L.Point(b.maxX, b.maxY));
			return pt;
		}
		,
		transformPolygon: function(geom)				// получить Scanex Polygon
		{
			var out = {
				'type': 'POLYGON'
			}
			var coords = [];
			for (var i = 0; i < geom['coordinates'].length; i++)
			{
				var coords1 = [];
				for (var j = 0; j < geom['coordinates'][i].length; j++)
				{
					var point = geom['coordinates'][i][j];
					//coords1.push([point.x, point.y]);
					coords1.push([gmxAPI.from_merc_x(point.x), gmxAPI.from_merc_y(point.y)]);
				}
				coords.push(coords1);
			}
			out['coordinates'] = coords;
			return out;
		}
		,
		transformGeometry: function(geom)			// трансформация геометрии leaflet->Scanex
		{
			if(!geom) return geom;
			if(geom.type === 'Polygon')	return utils.transformPolygon(geom);
		}
		,
		fromTileGeometry: function(geom, tileBounds)				// преобразование геометрий из тайлов
		{
			var out = null;
			if(geom) {
				if(geom['type'] === 'POINT') {
					out = gmxAPI._leaflet['PointGeometry'](geom, tileBounds);
				} else if(geom['type'] === 'MULTILINESTRING') {
					out = gmxAPI._leaflet['MultiPolyline'](geom, tileBounds);
				} else if(geom['type'] === 'LINESTRING') {
					out = gmxAPI._leaflet['LineGeometry'](geom, tileBounds);
				} else if(geom['type'] === 'POLYGON') {
					out = gmxAPI._leaflet['PolygonGeometry'](geom, tileBounds);
				} else if(geom['type'] === 'MULTIPOLYGON') {
					out = gmxAPI._leaflet['MultiPolygonGeometry'](geom, tileBounds);
				}
			}
			return out;
		}
		,
		'unionGeometry': function(bounds, geo, geo1)	{		// Обьединение 2 геометрий по границам тайла	need TODO
			if(geo.type === 'Polygon')
			{
				var multi = gmxAPI._leaflet['MultiPolygonGeometry'](null, geo['tileBounds']);
				multi.addMember(geo);
				geo = multi;
			}
			var res = geo;
			var type = geo.type;

			if(type === 'Point') 					{}
			else if(type === 'MultiPolygon')
			{
				if(geo1.type === 'Polygon')
				{
					geo.addMember(geo1);
				}
				else if(geo1.type === 'MultiPolygon')
				{
					geo.addMembers(geo1);
				}
			}
/*			
			else if(type === 'Polygon')
			{
				var type1 = geo1.type;
				for (var i = 0; i < geo1['coordinates'].length; i++)
				{
					res['coordinates'].push(geo1['coordinates'][i]);
				}
			}
*/
			return res;
		}
		,
		'drawGeometry': function(geo, featureparse)	{			// отрисовка GeoJSON геометрии
/*			
			var geojsonFeature = {
				"type": "Feature",
				"properties": geo.properties,
				"geometry": geo.geometry
			};
			var geojson = L.geoJson(myLines, {
				//style: myStyle
			});
*/
			var geojson = new L.GeoJSON();
			if(featureparse) {
				geojson.on('featureparse', featureparse);
			}
			geojson.addGeoJSON(geo);
			return geojson;
		}
		,'getTileUrl': function(obj, tilePoint, zoom)	{			// Получение URL тайла
			var res = '';
			if(!('tileFunc' in obj.options)) return res;
			if(zoom < obj.options.minZoom || zoom > obj.options.maxZoom) return res;

			var pz = Math.round(Math.pow(2, zoom - 1));
			var pz1 = Math.pow(2, zoom);
			res = obj.options.tileFunc(
				tilePoint.x%pz1 - pz
				,-tilePoint.y - 1 + pz
				,zoom + obj.options.zoomOffset
			);
			return res;
		}
		,'getTileUrlVector': function(obj, tilePoint, zoom)	{			// Получение URL тайла
			var res = '';
			if(!('tileFunc' in obj.options)) return res;

			res = obj.options.tileFunc(
				tilePoint.x
				,tilePoint.y
				,zoom
			);
			return res;
		}
		,'r_major': 6378137.000	
		,'y_ex': function(lat)	{				// Вычисление y_ex 
			if (lat > 89.5)		lat = 89.5;
			if (lat < -89.5) 	lat = -89.5;
			var phi = gmxAPI.deg_rad(lat);
			var ts = Math.tan(0.5*((Math.PI*0.5) - phi));
			var y = -utils.r_major * Math.log(ts);
			return y;
		}
		,'bringToDepth': function(obj, zIndex)	{				// Перемещение ноды на глубину zIndex
			if(!obj) return;
//console.log('11111111111 bringToDepth ' , obj.id, obj['zIndex'], zIndex); 
			//obj['zIndex'] = zIndex;
			if(!obj['leaflet']) return;
			var lObj = obj['leaflet'];
			zIndex += obj['zIndexOffset'] ;
			if(lObj._container && lObj._container.style.zIndex != zIndex) lObj._container.style.zIndex = zIndex;
		}
		,
		'getLastIndex': function(pNode)	{			// Получить следующий zIndex в mapNode
			var n = 1;
			if(pNode) {
				n = pNode.children.length + 1;
/*				
				if(pNode['hidenAttr'] && pNode['hidenAttr']['zIdnexSkip']) {
					//var tNode = mapNodes[pNode.parentId];
					if(pNode.parentId == mapDivID) n = pNode.children.length;
					else n = utils.getLastIndex(mapNodes[pNode.parentId]);
					//if(!tNode && pNode.parentId != mapDivID) n = pNode.children.length;
					
					//return utils.getLastIndex(tNode);
				}
*/				
			}
//console.log('getLastIndex ' , pNode, n); 
			return n;
		}
		,
		'getIndexLayer': function(sid)
		{ 
			var myIdx = gmxAPI.map.layers.length;
			var n = 0;
			for (var i = 0; i < myIdx; i++)
			{
				var l = gmxAPI.map.layers[i];
				//if (l.objectId && (l.properties.type != "Overlay")) {
					if (l.objectId == sid) break;
					n += 1;
				//}
			}
			return n;
		}
		,'dec2hex': function(i)	{					// convert decimal to hex
			return (i+0x1000000).toString(16).substr(-6).toUpperCase();
		}
		,'dec2rgba': function(i, a)	{				// convert decimal to rgb
			var r = (i >> 16) & 255;
			var g = (i >> 8) & 255;
			var b = i & 255;
			return 'rgba('+r+', '+g+', '+b+', '+a+')';
		}
		,
		'maxBounds': function()	{					// Получение сдвига OSM
			var bounds = new L.Bounds(new L.Point(-1e9, -1e9), new L.Point(1e9, 1e9));
			return bounds;
		}
		,'getTileBounds': function(tilePoint, zoom)	{			// получить Bounds тайла
			var tileX = 256 * tilePoint.x;						// позиция тайла в stage
			var tileY = 256 * tilePoint.y;

			var p1 = new L.Point(tileX, tileY);
			var pp1 = LMap.unproject(p1, zoom);					// Перевод экранных координат тайла в latlng
			//pp1 = new L.LatLng(pp1.lat, pp1.lng);
			p1.x = pp1.lng; p1.y = pp1.lat;
			var	p2 = new L.Point(tileX + 256, tileY + 256);
			var pp2 = LMap.unproject(p2, zoom);
			//pp2 = new L.LatLng(pp2.lat, pp2.lng);
			p2.x = pp2.lng; p2.y = pp2.lat;
			var bounds = new L.Bounds(p1, p2);
			//bounds.min.x %= 360;
			if(bounds.max.x > 180) {
				var cnt = Math.floor(bounds.max.x / 360);
				if(cnt == 0) cnt = 1;
				bounds.max.x -= cnt*360;
				bounds.min.x -= cnt*360
			}
			else if(bounds.min.x < -180) {
				var cnt = Math.floor(bounds.min.x / 360);
				if(cnt == 0) cnt = 1;
				bounds.max.x -= cnt*360; bounds.min.x -= cnt*360
			}
			return bounds;
		}
		,
		'freeze': function()	{					// Режим рисования
			gmxAPI._leaflet['curDragState'] = true;
			LMap.dragging.disable();
			LMap.touchZoom.addHooks();
			return true;
		}
		,'unfreeze': function()	{						// Отмена режима рисования
			gmxAPI._leaflet['curDragState'] = false;
			LMap.dragging.enable();
			LMap.touchZoom.removeHooks();
			return true;
		}
	};
	// setLabel для mapObject
	function setLabel(id, iconAnchor)	{
		var node = mapNodes[id];
		if(!node) return false;
		gmxAPI._leaflet['LabelsManager'].add(id);			// добавим в менеджер отрисовки
	}

	// setStyle для mapObject
	function setStyle(id, attr)	{
		var node = mapNodes[id];
		if(!node || !attr) return false;

		if(attr.regularStyle) {
			node._regularStyle = gmxAPI.clone(attr.regularStyle);
		}
		if(attr.hoveredStyle) {
			node._hoveredStyle = gmxAPI.clone(attr.hoveredStyle);
		}
		
		var chkStyle = function() {
			if(node._regularStyle) {
				node.regularStyle = utils.parseStyle(node._regularStyle, id);
				node.regularStyleIsAttr = utils.isPropsInStyle(node.regularStyle);
				if(!node.regularStyleIsAttr) node.regularStyle = utils.evalStyle(node.regularStyle)
				if(!attr.hoveredStyle) attr.hoveredStyle = gmxAPI.clone(attr.regularStyle);
			}
			if(node._hoveredStyle) {
				node.hoveredStyle = utils.parseStyle(node._hoveredStyle, id);
				node.hoveredStyleIsAttr = utils.isPropsInStyle(node.hoveredStyle);
				if(!node.hoveredStyleIsAttr) node.hoveredStyle = utils.evalStyle(node.hoveredStyle)
			}
		}
		
		if(node['type'] === 'filter') {					// Установка стиля фильтра векторного слоя
			var pNode = mapNodes[node['parentId']];
			pNode.setStyleFilter(id, attr);
		} else if(node['subType'] === 'tilesParent') {		// стиль заполнения обьектов векторного слоя
			var pNode = mapNodes[node['parentId']];
			pNode.chkTilesParentStyle();
		} else if(node['type'] == 'RasterLayer') {
			chkStyle();
			node.setStyle();
		} else if(node['subType'] !== 'drawingFrame') {
			chkStyle();
			if(node.isVisible != false) {
				if(node.leaflet && node.leaflet.setStyle) node.leaflet.setStyle(node.regularStyle);
				else gmxAPI._leaflet['drawManager'].add(id);			// добавим в менеджер отрисовки
			}
		} else {
			chkStyle();
		}
	}

	// Найти Handler ноды рекусивно
	function getNodeHandler(id, evName)	{
		var node = mapNodes[id];
		if(!node) return null;
		if(evName in node['handlers']) return node;
		return getNodeHandler(node['parentId'], evName);
	}

	// добавить Handlers для leaflet нод
	function setNodeHandlers(id)	{
		var node = mapNodes[id];
		if(!node || !node['handlers']) return false;
		node['isHandlers'] = false;
		for(var evName in scanexEventNames) {
			setHandlerObject(id, evName);
		}
	}

	var scanexEventNames = {
		'onClick': 'click'
		,'onMouseDown': 'mousedown'
		,'onMouseOver': 'mouseover'
		,'onMouseOut': 'mouseout'
		,'onMouseMove': 'mousemove'
	};
	// добавить Handler для mapObject
	function setHandlerObject(id, evName)	{
		var node = mapNodes[id];
		if(!node) return false;
		if(node['leaflet']) {
			node['leaflet']['options']['resID'] = id;
			var hNode = getNodeHandler(id, evName);
			if(hNode && hNode['type'] == 'map') return false;
			if(!hNode) {
				if(scanexEventNames[evName]) {
					node['leaflet'].off(scanexEventNames[evName]);
					if(node['marker']) node['marker'].off(scanexEventNames[evName]);
				}
				return false;
			}

			var func = function(e) {
				if(node.hoveredStyle && 'setStyle' in node['leaflet']) {
					if(evName == 'onMouseOver') {
						node['leaflet'].setStyle(node.hoveredStyle);
					} else if(evName == 'onMouseOut') {
						node['leaflet'].setStyle(node.regularStyle);
					}
				}
				var out = {'ev':e};
				utils.chkKeys(out, e.originalEvent);
				gmxAPI._leaflet['activeObject'] = (evName == 'onMouseOut' ? null : id);
				if(hNode['handlers'][evName]) hNode['handlers'][evName](node['id'], node.geometry.properties, out);
			};
			if(scanexEventNames[evName]) {
				node['leaflet'].on(scanexEventNames[evName], func);
				if(node['marker']) node['marker'].on(scanexEventNames[evName], func);
			}
			node['isHandlers'] = node['leaflet']['options']['_isHandlers'] = true;
			
			if('update' in node['leaflet']) node['leaflet'].update();
			return true;
		}
	}
	function removeNodeRecursive(key, parentFlag)	{		// Удалить ноду	- рекурсивно
		var node = mapNodes[key];
		if(!node) return;
		for (var i = 0; i < node['children'].length; i++) {
			removeNodeRecursive(node['children'][i], true);
		}
		if(!parentFlag) {
			var pGroup = LMap;
			if(node['parentId'] && mapNodes[node['parentId']]) {
				var pNode = mapNodes[node['parentId']];
				for (var i = 0; i < pNode['children'].length; i++) {
					if(pNode['children'][i] == node.id) {
						pNode['children'].splice(i, 1);
						break;
					}
				}
			}
		}
		utils.removeLeafletNode(node);
		delete mapNodes[key];
	}
	// Удалить mapObject
	function removeNode(key)	{				// Удалить ноду	children
		removeNodeRecursive(key);
/*
		var node = mapNodes[key];
		if(!node) return;
		var pGroup = LMap;
		if(node['parentId'] && mapNodes[node['parentId']]) {
			var pNode = mapNodes[node['parentId']];
			pGroup = pNode['group'];
			pGroup.removeLayer(node['group']);
			for (var i = 0; i < pNode['children'].length; i++) {
				if(pNode['children'][i] == node.id) {
					pNode['children'].splice(i, 1);
					break;
				}
			}
		}
		if(node['leaflet']) {
			pGroup.removeLayer(node['leaflet']);
		}
		delete mapNodes[key];
*/
	}
	
	// добавить mapObject
	function addObject(ph)	{
		nextId++;
		var id = 'id' + nextId;
		var pt = {
			'type': 'mapObject'
			,'handlers': {}
			,'children': []
			,'id': id
			,'zIndexOffset': 0
			,'parentId': ph.obj['objectId']
			//,'eventsCheck': 
			//subType
		};
		//if(ph.attr['hidenAttr']) pt['hidenAttr'] = ph.attr['hidenAttr'];

		var pNode = mapNodes[pt['parentId']];
		if(!pNode) {
			pNode = {'type': 'map', 'children':[], 'group':LMap};
		}
		pNode.children.push(id);

		pt['group'] = new L.LayerGroup();
		pNode['group'].addLayer(pt['group']);
		
		if(ph.attr) {
			pt['propHiden'] = ph.attr['propHiden'] || {};
			if(pt['propHiden']['nodeType']) pt['type'] = pt['propHiden']['nodeType'];
			var geo = {};
			if(ph.attr['geometry']) {
				if(pt['propHiden']['isLayer']) {
					geo = ph.attr['geometry'];
					geo.type = utils.fromScanexTypeGeo(geo.type);
				} else {
					geo = utils.parseGeometry(ph.attr['geometry']);
				}
				if(ph.attr['geometry']['properties']) geo['properties'] = ph.attr['geometry']['properties'];
			}
			if(ph.attr['properties']) geo['properties'] = ph.attr['properties'];
			pt['geometry'] = geo;
			if(pt['propHiden']['subType']) pt['subType'] = pt['propHiden']['subType'];
			if(pt['propHiden']['refreshMe']) pt['refreshMe'] = pt['propHiden']['refreshMe'];
			if(pt['propHiden']['layersParent']) pt['zIndexOffset'] = 0;
			if(pt['propHiden']['overlaysParent']) pt['zIndexOffset'] = 250000;
		}
		mapNodes[id] = pt;
		if(pt['geometry']['type']) {
			gmxAPI._leaflet['drawManager'].add(id);				// добавим в менеджер отрисовки
			if(pt['leaflet']) {
				setHandlerObject(id);							// добавить Handler для mapObject
			}
		}
		pt['zIndex'] = utils.getLastIndex(pNode);
		return id;
	}
	// Добавление набора статических объектов на карту
	function addObjects(parentId, attr) {
		var out = [];
		var sql = attr['sql'] || null;
		var data = attr['arr'];
		var fmt = (attr['format'] ? attr['format'] : 'LatLng');
		for (var i=0; i<data.length; i++)	// Подготовка массива обьектов
		{
			var ph = data[i];
			var prop = ph['properties'] || null;
			if(ph['geometry'] && ph['geometry']['properties']) prop = ph['geometry']['properties'];
			if(sql) {
				var flag = utils.chkPropsInString(sql, prop, 1);
				if(!flag) continue;
			}
			var tmp = {
				'obj': {
					'objectId': parentId
				}
				,
				'attr': {
					"geometry": (fmt == 'LatLng' ? ph['geometry'] : gmxAPI.from_merc_geometry(ph['geometry']))
					,
					"properties": prop
				}
			};
			var id = addObject(tmp);
			if(ph['setLabel']) {
				mapNodes[id]['label'] = ph['setLabel'];
			}
			if(ph['setZoomBounds']) {	// формат {'minZ':1, 'maxZ':21}
				tmp['attr'] = ph['setZoomBounds'];
				commands.setZoomBounds(tmp);
			}
			if(ph['setFilter']) {
				tmp['attr'] = {'sql':ph['setFilter']};
				commands.setFilter(tmp);
			}
			if(ph['setHandlers']) {
				for(var key in ph['setHandlers']) {
					var item = ph['setHandlers'][key];
					commands.setHandler(item);
				}
			}
			setStyle(id, ph['setStyle']);

			var aObj = new gmxAPI._FMO(id, prop, gmxAPI.mapNodes[parentId]);	// обычный MapObject
			aObj.isVisible = true;
			out.push(aObj);
			// пополнение mapNodes
			var currID = (aObj.objectId ? aObj.objectId : gmxAPI.newFlashMapId() + '_gen1');
			gmxAPI.mapNodes[currID] = aObj;
			if(aObj.parent) aObj.parent.childsID[currID] = true; 
			if(ph['enableHoverBalloon']) {
				aObj.enableHoverBalloon(ph['enableHoverBalloon']);
			}
		}
		return out;
	}
	// Изменение видимости
	function setVisibleNode(ph) {
		var id = ph.obj.objectId || ph.obj.id;
		var node = mapNodes[id];
		if(node) {							// нода имеется
			if(node['type'] === 'map') {							// нода map ничего не делаем
				return;
			}
			//node.isVisible = ph.attr;
			var pNode = mapNodes[node['parentId']] || null;
			var pGroup = (pNode ? pNode['group'] : LMap);
			if(node['type'] === 'filter') {							// нода filter
				if(pNode) pNode.refreshFilter(id);
				return;
			} else {							// нода имеет вид в leaflet
				if(ph.attr) {
					var flag = utils.chkVisibilityByZoom(id);
					//if(flag && node['geometry'] && node['geometry']['bounds']) flag = utils.chkBoundsVisible(node['geometry']['bounds']);

					if(!flag) return;
					if(node['leaflet'] && node['leaflet']._map) return;
					//if(node['leaflet'] && node['leaflet']._isVisible) return;
					if(node['type'] === 'RasterLayer') {
						gmxAPI._leaflet['renderingObjects'][node.id] = 1;					
						if(node['leaflet']) {
							//node['leaflet']._isVisible = true;
							LMap.addLayer(node['leaflet']);
							utils.bringToDepth(node, node['zIndex']);
						} else if('nodeInit' in node) {
							node['nodeInit']();
						}
					}
					else
					{
						var isOnScene = ('isOnScene' in node ? node['isOnScene'] : true);
						if(node['parentId']) {
							if(isOnScene) pGroup.addLayer(node['group']);
						}
						
						if(node['leaflet']) {
							//node['leaflet']._isVisible = true;
							if(isOnScene) pGroup.addLayer(node['leaflet']);
						} else if(node.geometry['type']) {
							gmxAPI._leaflet['drawManager'].add(id);				// добавим в менеджер отрисовки
						}
					}
				}
				else
				{
					//if(node['leaflet'] && node['leaflet']._isVisible === false) return;
					if(node['type'] === 'RasterLayer') {
						delete gmxAPI._leaflet['renderingObjects'][node.id];
						if(node['leaflet']) {
							//if(node['leaflet']._isVisible) 
							LMap.removeLayer(node['leaflet']);
							//node['leaflet']._isVisible = false;
						}
					}
					else {
						if(node['parentId']) {
							pGroup.removeLayer(node['group']);
						}
						if(node['leaflet']) {
							//node['leaflet']._isVisible = false;
							if(pGroup['_layers'][node['leaflet']['_leaflet_id']]) pGroup.removeLayer(node['leaflet']);
						}
						if(node['mask']) {
							if(pGroup['_layers'][node['mask']['_leaflet_id']]) pGroup.removeLayer(node['mask']);
						}
					}
				}
			}
			for (var i = 0; i < node['children'].length; i++) {
				setVisibleRecursive(mapNodes[node['children'][i]], ph.attr);
			}
		}
	}

	// Рекурсивное изменение видимости
	function setVisibleRecursive(pNode, flag) {
		if(!pNode) return;
		if(pNode['leaflet']) {
			utils.setVisibleNode({'obj': pNode, 'attr': flag});
		} else {
			for (var i = 0; i < pNode['children'].length; i++) {
				var key = pNode['children'][i];
				var node = mapNodes[key];
				setVisibleRecursive(node, flag);
			}
		}
	}

	// Рекурсивное изменение видимости
	function setVisibilityFilterRecursive(pNode, sqlFunc) {
		var prop = ('getPropItem' in pNode ? pNode.getPropItem(pNode) : (pNode.geometry && pNode.geometry['properties'] ? pNode.geometry['properties'] : null));
		if(pNode['leaflet'] && prop) {
			var flag = sqlFunc(prop);
			utils.setVisibleNode({'obj': pNode, 'attr': flag});
			gmxAPI._leaflet['LabelsManager'].onChangeVisible(pNode.id, flag);
		} else {
			for (var i = 0; i < pNode['children'].length; i++) {
				var key = pNode['children'][i];
				var gmxNode = mapNodes[key];
				setVisibilityFilterRecursive(gmxNode, sqlFunc);
			}
		}
	}
	// Изменение видимости ноды
	function setVisibilityFilter(ph) {
		var obj = ph['obj'];
		var id = obj['objectId'];
		var node = mapNodes[id];
		node['_sqlVisibility'] = ph.attr['sql'].replace(/[\[\]]/g, '"');
		node['_sqlFuncVisibility'] = gmxAPI.Parsers.parseSQL(node['_sqlVisibility']);
		if(node['type'] === 'VectorLayer') node.setVisibilityFilter();
		else setVisibilityFilterRecursive(node, node['_sqlFuncVisibility']);
		return ( node['_sqlFuncVisibility'] ? true : false);
	}

	// Проверка видимости mapObjects
	function chkVisibilityObjects() {
		var zoom = LMap.getZoom();
		for(var id in mapNodes) {
			var node = mapNodes[id];
			var flag = ((node['minZ'] && zoom < node['minZ']) || (node['maxZ'] && zoom > node['maxZ']) ? false : true);
			setVisibleRecursive(node, flag);
		}
	}

	// Проверка отрисовки карты с задержкой
	var chkIdleTimer = null;								// Таймер
	function waitChkIdle(zd, st) {
		if(chkIdleTimer) clearTimeout(chkIdleTimer);
		if(arguments.length == 0) zd = 100;
		chkIdleTimer = setTimeout(function()
		{
			utils.chkIdle(true, st || 'waitChkIdle');					// Проверка отрисовки карты
		}, zd);
		return false;
	}
	utils['waitChkIdle'] = waitChkIdle;

	var grid = {
		'isVisible': false							// видимость grid
		,
		'isOneDegree': false						// признак сетки через 1 градус
		,
		'lealfetObj': null							// lealfet обьект
		,
		'gridSteps': [0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 30, 60, 120, 180]
		,
		'setOneDegree': function (flag)
		{
			this.isOneDegree = flag;
		}
		,
		'formatFloat': function (f)
		{
			f %= 360;
			if (f > 180) f -= 360;
			else if (f < -180) f += 360;
			return Math.round(f*1000.0)/1000.0;
		}
		,
		'setGridVisible': function(flag) {			// Установка видимости grid
			if(flag) {
				grid.redrawGrid();
			} else {
				if(grid.positionChangedListenerID) gmxAPI.map.removeListener('positionChanged', grid.positionChangedListenerID); grid.positionChangedListenerID = null;
				if(grid.baseLayerListenerID) gmxAPI.map.removeListener('baseLayerSelected', grid.baseLayerListenerID); grid.baseLayerListenerID = null;
				if(grid.zoomListenerID) gmxAPI._listeners.removeListener(null, 'onZoomend', grid.zoomListenerID); grid.zoomListenerID = null;
				LMap.removeLayer(grid.lealfetObj);
				grid.lealfetObj = null;
			}
			grid.isVisible = (grid.lealfetObj ? true : false);
		}
		,
		'getGridVisibility': function() {			// Получить видимость grid
			return grid.isVisible;
		}
		,
		'redrawGrid': function() {					// перерисовать grid
			var zoom = LMap.getZoom();
			var gridStep = grid.getGridStep();
			
			return false;
		}
		,
		'getGridStep': function() {					// получить шаг сетки
			var zoom = LMap.getZoom();
			var vBounds = LMap.getBounds();
			var vpNorthWest = vBounds.getNorthWest();
			var vpSouthEast = vBounds.getSouthEast();

			var w = LMap._size.x;
			var h = LMap._size.y;

			var x1 = vpNorthWest.lng;
			var x2 = vpSouthEast.lng;
			var y1 = vpSouthEast.lat;
			var y2 = vpNorthWest.lat;
			var xStep = 0;
			var yStep = 0;
			if(this.isOneDegree) {
				xStep = yStep = 1;
			} else {
				for (var i = 0; i < grid['gridSteps'].length; i++) {
					var step = grid['gridSteps'][i];
					if (xStep == 0 && (x2 - x1)/step < w/80) xStep = step;
					if (yStep == 0 && (y2 - y1)/step < h/80) yStep = step;
					if (xStep > 0 && yStep > 0) break;
				}
			}
			
			var baseLayersTools = gmxAPI.map.baseLayersTools;
			var currTool = baseLayersTools.getToolByName(baseLayersTools.activeToolName);
			var color = (currTool.backgroundColor === 1 ? 'white' : 'black');
			var haloColor = (color === 'black' ? 'white' : 'black');

			var divStyle = {'width': 'auto', 'height': 'auto', 'color': color, 'haloColor': haloColor, 'wordBreak': 'keep-all'};
			var opt = {'className': 'my-div-icon', 'html': '0', 'divStyle': divStyle };
			var optm = {'zIndexOffset': 1, 'title': ''}; // , clickable: false
		
			var latlngArr = [];
			var textMarkers = [];
			
			for (var i = Math.floor(x1/xStep), len1 = Math.ceil(x2/xStep); i < len1; i++) {
				var x = i * xStep;
				var p1 = new L.LatLng(y1, x);
				var p2 = new L.LatLng(y2, x);
				latlngArr.push(p2, p1);
				if(this.isOneDegree && zoom < 6) continue;
				textMarkers.push(grid.formatFloat(x) + "°", '');
			}
			for (var i = Math.floor(y1/yStep), len1 = Math.ceil(y2/yStep); i < len1; i++) {
				var y = i * yStep;
				var p1 = new L.LatLng(y, x1);
				var p2 = new L.LatLng(y, x2);
				latlngArr.push(p1, p2);
				if(this.isOneDegree && zoom < 6) continue;
				textMarkers.push(grid.formatFloat(y) + "°", '');
			}

			if(!grid.lealfetObj) {
				grid.lealfetObj = new L.GMXgrid(latlngArr, {noClip: true, clickable: false});
				LMap.addLayer(grid.lealfetObj);
				if(!grid.positionChangedListenerID) grid.positionChangedListenerID = gmxAPI.map.addListener('positionChanged', grid.redrawGrid, -10);
				if(!grid.baseLayerListenerID) grid.baseLayerListenerID = gmxAPI.map.addListener('baseLayerSelected', grid.redrawGrid, -10);
				if(!grid.zoomListenerID) grid.zoomListenerID = gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomend', 'func': grid.redrawGrid});
			}
			grid.lealfetObj.setStyle({'stroke': true, 'weight': 1, 'color': color});
			grid.lealfetObj.options['textMarkers'] = textMarkers;
			grid.lealfetObj.setLatLngs(latlngArr);
			return false;
		}
	};

	// Команды в leaflet
	var commands = {				// Тип команды
		'setVisibilityFilter': setVisibilityFilter			// добавить фильтр видимости
		,
		'getPatternIcon':	function(hash)	{				// получить иконку pattern
			var style = utils.parseStyle(hash['attr']['style']);
			var pt = utils.getPatternIcon(null, style);
			var canv = (pt ? pt['canvas'] : null);
			if(canv) {
				var size = hash['attr']['size'];
				var canvas1 = document.createElement('canvas');
				canvas1.width = canvas1.height = size;
				var ptx1 = canvas1.getContext('2d');
				ptx1.drawImage(canv, 0, 0, size, size);
				canv = canvas1.toDataURL();
				canv = canv.replace(/^data:image\/png;base64,/, '');
			}
			return canv;
		}
		,
		'setBackgroundTiles': gmxAPI._leaflet['setBackgroundTiles']			// добавить растровый тайловый слой
		,
		'addContextMenuItem': gmxAPI._leaflet['contextMenu']['addMenuItem']			// Добавить Item ContextMenu
		,
		'setGridVisible':	function(hash)	{							// Изменить видимость сетки
			return grid.setGridVisible(hash['attr']);
		}
		,
		'setOneDegree':	function(hash)	{								// Установить шаги grid
			return grid.setOneDegree(hash['attr']);
		}
		,
		'getGridVisibility':	function(hash)	{						// получить видимость сетки
			return grid.getGridVisibility();
		}
		,
		'addObjects':	function(attr)	{					// Добавление набора статических объектов на карту
			var out = addObjects(attr.obj['objectId'], attr['attr']);
			return out;
		}
		,
		'addObject': addObject								// добавить mapObject
		,
		'freeze': function()	{					// Режим рисования
			utils.freeze();
			return true;
		}
		,
		'unfreeze': function()	{						// Отмена режима рисования
			utils.unfreeze();
			return true;
		}
		,
		'startDrawing': function(ph)	{					// Режим рисования
			return commands.freeze();
		}
		,
		'stopDrawing': function(ph)	{						// Отмена режима рисования
			return commands.unfreeze();
		}
		,
		'enableDragging': function(ph)	{					// Разрешить Drag
			var layer = ph.obj;
			var id = layer.objectId;
			var node = mapNodes[id];
			var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI
			if(!node || !gmxNode) return;						// Нода не определена
			if(ph.attr && ph.attr['drag'] && ph.attr['dragend']) {
				node['dragging'] = true;
				utils.startDrag(node);
				node['dragendListenerID'] = gmxNode.addListener('dragend', function(ev) // dragend на обьекте
				{
					var attr = ev.attr;
					ph.attr['dragend'](gmxNode, attr);
				});
				node['dragListenerID'] = gmxNode.addListener('drag', function(ev)		// Drag на обьекте
				{
					var attr = ev.attr;
					ph.attr['drag'](attr.x, attr.y, gmxNode, attr);
				});
				node['dragstartListenerID'] = gmxNode.addListener('dragstart', function(ev)	// dragstart на обьекте
				{
					var attr = ev.attr;
					ph.attr['dragstart'](attr.x, attr.y, gmxNode, attr);
				});
			}
		}
		,
		'disableDragging': function(ph)	{					// Запретить Drag
			var layer = ph.obj;
			var id = layer.objectId;
			var node = mapNodes[id];
			var gmxNode = gmxAPI.mapNodes[id];		// Нода gmxAPI
			if(!node || !gmxNode) return;						// Нода не определена
			node['dragging'] = false;
			delete node['dragMe'];
			if(node['dragendListenerID']) gmxNode.removeListener('dragend', node['dragendListenerID']);
			if(node['dragListenerID']) gmxNode.removeListener('drag', node['dragListenerID']);
			if(node['dragstartListenerID']) gmxNode.removeListener('dragstart', node['dragstartListenerID']);
			if(node['leaflet']) node['leaflet'].off('mousedown');
			commands.unfreeze();
		}
		,
		'isDragging': function()	{						// Текущий режим Drag
			return gmxAPI._leaflet['curDragState'];
		}
		,
		'isKeyDown': function(ph)	{						// Проверка нажатых клавиш
			var flag = false;
			if(ph.attr && ph.attr.code) {
				var code = ph.attr.code;
				var clickAttr = gmxAPI._leaflet['clickAttr'];
				if(clickAttr) {
					if(code === 16 && clickAttr['shiftKey']) flag = true;
				}
			}
			return flag;
		}
		,
		'setGeometry': function(ph)	{						// установка geometry
			var layer = ph.obj;
			var id = layer.objectId;
			var node = mapNodes[id];
			if(!node) return;						// Нода не определена
			if(ph.attr) {
				var geo = utils.parseGeometry(ph.attr);
				if(!geo.properties) geo.properties = (node['geometry'].properties ? node['geometry'].properties : (layer.properties ? layer.properties : {}));
				node['geometry'] = geo;
				if(node['type'] === 'RasterLayer') node['setGeometry']();
				if(node['geometry']['type']) {
					if(node['onDrag'] && node['leaflet'] && node['leaflet'].dragging) {
						// dragging лефлетовский
						return;
					}
					gmxAPI._leaflet['drawManager'].add(id);			// добавим в менеджер отрисовки
					if(node['leaflet']) setHandlerObject(id);
				}
			}
		}
		,
		'bringToTop': function(ph)	{						// установка zIndex - вверх
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			var zIndex = 1;
			if('getMaxzIndex' in node) zIndex = node['getMaxzIndex']();
			else zIndex = utils.getLastIndex(node.parent);
			node['zIndex'] = zIndex;
			utils.bringToDepth(node, zIndex);
			if(!gmxAPI.map.needMove) {
				if('bringToFront' in node) node.bringToFront();
				else if(node['leaflet'] && node['leaflet']._map && 'bringToFront' in node['leaflet']) node['leaflet'].bringToFront();
				gmxAPI.map.drawing.chkZindex(id);
			}
			return zIndex;
		}
		,
		'bringToBottom': function(ph)	{					// установка zIndex - вниз
			var obj = ph.obj;
			var id = obj.objectId;
			var node = mapNodes[id];
			node['zIndex'] = ('getMinzIndex' in node ? node.getMinzIndex() : 0);
			utils.bringToDepth(node, node['zIndex']);
			if(!gmxAPI.map.needMove && node['type'] !== 'VectorLayer') {
				if('bringToBack' in node) node.bringToBack();
				else if(node['leaflet'] && node['leaflet']._map && 'bringToBack' in node['leaflet']) node['leaflet'].bringToBack();
				gmxAPI.map.drawing.chkZindex(id);
			}
			return 0;
		}
		,
		'bringToDepth': function(ph)	{					// установка z-index
			var id = ph.obj.objectId;
			var zIndex = ph.attr.zIndex;
			var node = mapNodes[id];
			if(node) {
				node['zIndex'] = zIndex;
				utils.bringToDepth(node, zIndex);
			}
			return zIndex;
		}
		,
		'getVisibility': function(ph)	{					// получить видимость mapObject
			return ph.obj.isVisible;
		}
		,
		'setVisible': function(ph)	{						// установить видимость mapObject
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			node.isVisible = ph.attr;
			node.notView = ph.notView || false;
			gmxAPI._leaflet['LabelsManager'].onChangeVisible(id, ph.attr);
			return utils.setVisibleNode(ph);
		}
		,
		'setExtent':	function(ph)	{		//Задать географический extent - за пределы которого нельзя выйти. - todo
			var attr = ph.attr;
			if(!attr) {
				LMap.options.maxBounds = null;
			} else {
				var southWest = new L.LatLng(attr.y2, attr.x2),
					northEast = new L.LatLng(attr.y1, attr.x1),
					bounds = new L.LatLngBounds(southWest, northEast);			
				LMap.setMaxBounds(bounds);		// После установки надо сбрасывать
			}
		}
		,
		'setMinMaxZoom':	function(ph)	{				// установка minZoom maxZoom карты
			//return;
			if(LMap.options.minZoom == ph.attr.z1 && LMap.options.maxZoom == ph.attr.z2) return;
			LMap.options.minZoom = ph.attr.z1;
			LMap.options.maxZoom = ph.attr.z2;
			var currZ = (gmxAPI.map.needMove ? gmxAPI.map.needMove.z : LMap.getZoom() || 4);
			var minz = LMap.getMinZoom();
			var maxz = LMap.getMaxZoom();
			if(currZ > maxz) currZ = maxz;
			else if(currZ < minz) currZ = minz;
			gmxAPI.map.zoomControl.setZoom(currZ);
			
			var centr = LMap.getCenter();
			var px = centr.lng;
			var py = centr.lat;
			if(gmxAPI.map.needMove) {
				px = gmxAPI.map.needMove.x;
				py = gmxAPI.map.needMove.y;
			}
			utils.runMoveTo({'x': px, 'y': py, 'z': currZ})
		}
		,
		'checkMapSize':	function()	{				// Проверка изменения размеров карты
			if(LMap) {
				LMap._onResize();
				return true;
			}
			return false;
		}
		,
		'addImageProcessingHook':	function(ph)	{		// Установка предобработчика растрового тайла
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			node['imageProcessingHook'] = ph['attr']['func'];
		}
		,
		'zoomBy':	function(ph)	{				// установка Zoom карты
			var toz = Math.abs(ph.attr.dz);
			if(ph.attr.dz > 0) LMap.zoomOut(toz);
			else LMap.zoomIn(toz);
/*
			var currZ = (gmxAPI.map.needMove ? gmxAPI.map.needMove.z : LMap.getZoom() || 4);
			currZ -= ph.attr.dz;
			if(currZ > LMap.getMaxZoom() || currZ < LMap.getMinZoom()) return;
			var pos = LMap.getCenter();
			if(gmxAPI.map.needMove) {
				pos.lng = gmxAPI.map.needMove.x;
				pos.lat = gmxAPI.map.needMove.y;
			}
			if (ph.attr.useMouse && gmxAPI._leaflet['mousePos'])
			{
				var z = (gmxAPI.map.needMove ? gmxAPI.map.needMove.z : LMap.getZoom() || 4);
				var k = Math.pow(2, z - currZ);
				
				var lat = utils.getMouseY();
				var lng = utils.getMouseX();
				pos.lat = lat + k*(pos.lat - lat);
				pos.lng = lng + k*(pos.lng - lng);
			}
			utils.runMoveTo({'x': pos.lng, 'y': pos.lat, 'z': currZ})
			//LMap.setView(pos, currZ);
*/
		}
		,
		'moveTo':	function(ph)	{				//позиционирует карту по координатам центра и выбирает масштаб
			var zoom = ph.attr['z'] || (gmxAPI.map.needMove ? gmxAPI.map.needMove.z : LMap.getZoom() || 4);
			if(zoom > LMap.getMaxZoom() || zoom < LMap.getMinZoom()) return;
			var pos = new L.LatLng(ph.attr['y'], ph.attr['x']);
			//LMap.setView(pos, zoom);
			utils.runMoveTo({'x': pos.lng, 'y': pos.lat, 'z': zoom})
//			setTimeout(function() { LMap._onResize(); }, 50);
		}
		,
		'slideTo':	function(ph)	{				//позиционирует карту по координатам центра и выбирает масштаб
			if(ph.attr['z'] > LMap.getMaxZoom() || ph.attr['z'] < LMap.getMinZoom()) return;
			var pos = new L.LatLng(ph.attr['y'], ph.attr['x']);
			//LMap.setView(pos, ph.attr['z']);
			utils.runMoveTo({'x': pos.lng, 'y': pos.lat, 'z': ph.attr['z']})
		}
		,
		'setLabel':	function(ph)	{				// Установка содержимого label
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			node['label'] = ph['attr']['label'];
			gmxAPI._leaflet['drawManager'].add(id);
			if(node['type'] === 'mapObject') setLabel(id);
		}
		,
		'getStyle':	function(ph)	{				// Установка стилей обьекта
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;						// Нода не была создана через addObject
			var out = {	};
			if(node._regularStyle) out.regular = node._regularStyle;
			if(node._hoveredStyle) out.hovered = node._hoveredStyle;
			return out;
		}
		,
		'setStyle':	function(ph)	{				// Установка стилей обьекта
			var id = ph.obj.objectId;
			setStyle(id, ph.attr);
		}
		,
		'remove':	function(ph)	{				// Удаление ноды
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;						// Нода не была создана через addObject
			//commands.disableDragging(ph);
			gmxAPI._leaflet['LabelsManager'].remove(id);
			if('remove' in node) {							// Имеется свой remove
				node.remove(id);
				removeNode(id);
			} else if(node['type'] === 'filter') {			// Удаление фильтра векторного слоя
				var pNode = mapNodes[node['parentId']];
				pNode.removeFilter(id);
			} else if(node['type'] === 'mapObject') {	// Удаление mapObject
				removeNode(id);
			}
			delete mapNodes[id];
		}
		,
		'setVectorTiles': gmxAPI._leaflet['setVectorTiles']			// Установка векторный тайловый слой
		,
		'setWatcher':	function(ph)	{			// Установка подглядывателя обьекта под Hover обьектом
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return null;
			if('setWatcher' in node) node['setWatcher'](ph.attr);
		}
		,
		'removeWatcher': function(ph)	{				// Удалить подглядыватель
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return null;
			if('removeWatcher' in node) node['removeWatcher']();
		}
		,
		'setFilter':	function(ph)	{			// Установка фильтра
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return null;					// Нода не была создана через addObject
			node['type'] = 'filter';
			node['sql'] = ph.attr['sql'];
			node['sqlFunction'] = (node['sql'] ? gmxAPI.Parsers.parseSQL(ph.attr['sql']) : null);

			var pNode = mapNodes[node['parentId']];
			//pNode.addFilter(id);
			pNode.setFilter(id);
			
			return (!node['sql'] || node['sqlFunction'] ? true : false);
		}
		,
		'startLoadTiles':	function(ph)	{		// Перезагрузка тайлов векторного слоя
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node || !'startLoadTiles' in node) return;						// Нода не была создана через addObject
			node.startLoadTiles(ph.attr);
			//node.temporal = ph.attr;
			//var attr = ph.attr; toFilters
		}
		,
		'setDateInterval':	function(ph)	{		// Установка временного интервала
			var id = ph.obj.objectId;
		}
		,
		'removeHandler':	function(ph)	{			// Установка Handler
			var id = ph.obj.objectId;
			var attr = ph.attr;
			var node = mapNodes[id];
			if(!attr || !node || !'handlers' in node) return;						// Нода не была создана через addObject
			delete node['handlers'][attr.eventName];
			if(node['type'] == 'mapObject' && scanexEventNames[attr.eventName]) {
				if(node['leaflet']) node['leaflet'].off(scanexEventNames[attr.eventName]);
				if(node['marker']) node['marker'].off(scanexEventNames[attr.eventName]);
			}
		}
		,
		'setHandler':	function(ph)	{			// Установка Handler
			var id = ph.obj.objectId;
			var attr = ph.attr;
			var node = mapNodes[id];
			if(!attr || !node || !'handlers' in node) return;						// Нода не была создана через addObject
			node['handlers'][attr.eventName] = attr.callbackName;
			setHandlerObject(id, attr.eventName);
		}
		,
		'getGeometry':	function(ph)	{			//	Получить геометрию обьекта
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) {						// Нода не была создана через addObject
				if(ph.obj.parent && mapNodes[ph.obj.parent.objectId]) {
					node = mapNodes[ph.obj.parent.objectId];
					if(node) {
						if(node['type'] == 'filter') node = mapNodes[node.parentId];
						if(node && 'getItemGeometry' in node) return node.getItemGeometry(id);
					}
				}
				return null;
			}
			//if(!node || !'resIDLast' in node) return null;						// Нода не была создана через addObject
			//var rnode = mapNodes[node['resIDLast']];

			var geo = gmxAPI.clone(node.geometry);
			var type = geo.type;
			if(type === 'MultiPolygon') 			geo['type'] = 'MULTIPOLYGON';
			else if(type === 'Polygon')				geo['type'] = 'POLYGON';
			else if(type === 'MultiPoint')			geo['type'] = 'MultiPoint';
			else if(type === 'Point')				geo['type'] = 'POINT';
			else if(type === 'MultiLineString')		geo['type'] = 'MULTILINESTRING';
			else if(type === 'LineString')			geo['type'] = 'LINESTRING';
			else if(type === 'GeometryCollection')	geo['type'] = 'GeometryCollection';
			return geo;
		}
		,
		'getGeometryType':	function(ph)	{		// Получить тип геометрии
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) {						// Нода не была создана через addObject
				if(ph.obj.parent && mapNodes[ph.obj.parent.objectId]) {
					node = mapNodes[ph.obj.parent.objectId];
					if(node && node['type'] == 'filter') {
						node = mapNodes[node.parentId];
						if(node && 'getGeometryType' in node) return node.getGeometryType(id);
					}
				}
			}
			var geo = commands.getGeometry(ph);
			return (!geo ? null : geo.type);
		}
		,
		'getCenter': function(ph)	{			//	Получить центр Geometry mapObject
			var geo = commands.getGeometry(ph);
			return gmxAPI.geoCenter(geo);
		}
		,
		'getLength': function(ph)	{			//	Получить площадь обьекта
			var geo = commands.getGeometry(ph);
			var len = gmxAPI.geoLength(geo);
			return (!len ? null : len);
		}
		,
		'getArea':	function(ph)	{			//	Получить площадь обьекта
			var geo = commands.getGeometry(ph);
			var area = gmxAPI.geoArea(geo);
			return (!area ? null : area);
		}
		,
		'getFeatureById':	function(ph)	{
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(node) {						
				var attr = ph['attr'];
				if('getFeatureById' in node) node.getFeatureById(attr);
			}
		}
		,
		'getFeatures': function(ph) {					// получить данные векторного слоя по bounds геометрии
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(node) {						
				var attr = ph['attr'];
				if(attr['center']) {
					var pos = LMap.getCenter()
					attr['geom'] = { type: "POINT", coordinates: [pos['lng'], pos['lat']] };
				}
				if('getFeatures' in node) node.getFeatures(attr);
			}
		}
		,
		'setCursor': function(ph)	{						// изменить курсор
			var attr = ph['attr'];
			if(attr['url']) {
				var st = "url('"+attr['url']+"')";
				var dx = String('dx' in attr ? -attr['dx'] : 0);
				var dy = String('dy' in attr ? -attr['dy'] : 0);
				st += ' ' + dx + ' ' + dy;
				st += ', auto';
				var dom = document.getElementsByTagName("body")[0];
				dom.style.cursor = st;
			}
		}
		,
		'clearCursor': function()	{						// убрать url курсор
			var dom = document.getElementsByTagName("body")[0];
			dom.style.cursor = '';
		}
		,
		'getPosition': function()	{						// получить текущее положение map
			var res = utils.getMapPosition();
			return res;
		}
		,'getX':	function()	{ var pos = LMap.getCenter(); return pos['lng']; }	// получить X карты
		,'getY':	function()	{ var pos = LMap.getCenter(); return pos['lat']; }	// получить Y карты
		,'getZ':	function()	{ return LMap.getZoom(); }							// получить Zoom карты
		,'getMouseX':	function()	{ return utils.getMouseX(); }		// Позиция мыши X
		,'getMouseY':	function()	{ return utils.getMouseY();	}		// Позиция мыши Y
		,
		'flip':	function(ph)	{					// Пролистывание в квиклуках
			var id = ph.obj.objectId;
			if(typeof(id) == 'string') id = id.replace(/id_/, '');
			var lObj = ph.obj.parent.parent;
			if(lObj) {
				var node = mapNodes[lObj.objectId];
				if(node && node.setFlip) node.setFlip(id);
			}
			return id;
		}
		,
		'addFlip':	function(ph)	{				// Добавить обьект к массиву Flips обьектов
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node || !ph.attr.fid) return false;
			if(node.addFlip) return node.addFlip(ph.attr.fid);
			return false;
		}
		,
		'enableFlip':	function(ph)	{			// Установить ротацию обьектов слоя
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			node['flipEnabled'] = true;
			return true;
		}
		,
		'disableFlip':	function(ph)	{			// Отменить ротацию обьектов слоя
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			node['flipEnabled'] = false;
			return true;
		}
		,
		'getZoomBounds':	function(ph)	{		// Установка границ по zoom
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;
			var out = {
				'MinZoom': node['minZ']
				,'MaxZoom': node['maxZ']
			}
			return out;
		}
		,
		'setZoomBounds':	function(ph)	{		// Установка границ по zoom
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;
			node['minZ'] = ph.attr['minZ'] || 1;
			node['maxZ'] = ph.attr['maxZ'] || 21;
			var pnode = mapNodes[node.parentId];
			if(node.propHiden && node.propHiden['subType'] == 'tilesParent') {			//ограничение по zoom квиклуков
				if(pnode) {
					if(pnode['setZoomBoundsQuicklook']) pnode['setZoomBoundsQuicklook'](node['minZ'], node['maxZ']);
				}
			} else if(node['type'] == 'map') {			//ограничение по zoom map
				commands.setMinMaxZoom({'attr':{'z1':node['minZ'], 'z2':node['maxZ']}})
			} else if('onZoomend' in node) {					// есть проверка по Zoom
				node.onZoomend();
			} else if(pnode && pnode['type'] == 'VectorLayer') {	// изменения для одного из фильтров
				if('chkZoomBoundsFilters' in pnode) {
					pnode.chkZoomBoundsFilters();
				}
			} else if(node['type'] == 'mapObject') {			//ограничение по zoom mapObject
				/*gmxAPI._listeners.addListener({'level': -10, 'eventName': 'onZoomend', 'func': function() {
						gmxAPI._leaflet['drawManager'].add(id);
						
						if(utils.chkVisibleObject(node.id) && utils.chkVisibilityByZoom(node.id)) {
							utils.setVisibleNode({'obj': node, 'attr': true});
						}
						return false;
					}
				});*/
			}
			return true;
		}
		,
		'observeVectorLayer':	function(ph)	{		// Установка получателя видимых обьектов векторного слоя
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;
			var layerId = ph.attr.layerId;
			var nodeLayer = mapNodes[layerId];
			if(!nodeLayer) return;
			nodeLayer.setObserver(ph);
			//node['observeVectorLayer'] = ph.attr.func;
			return true;
		}
		,
		'setImage':	function(ph)	{					// Установка изображения
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;
			setTimeout(function() { setImage(node, ph); }, 2);
			return true;
		}
		,
		'setImageExtent':	function(ph)	{			// Установка изображения без трансформации
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return;
			ph['setImageExtent'] = true;
			setTimeout(function() { setImage(node, ph); }, 2);
			return true;
		}
		,
		'addItems':	function(ph)	{
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node || !node.addItems) return false;
			var arr = [];
			for (var i=0; i<ph.attr.data.length; i++)	// Подготовка массива обьектов
			{
				var item = ph.attr.data[i];
				arr.push({
					'id': item['id']
					,'properties': item['properties']
					,'geometry': gmxAPI.merc_geometry(item['geometry'])
				});
			}
			node.addItems(arr);
			return true;
		}
		,
		'removeItems':	function(ph)	{
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node || !node.removeItems) return false;
			node.removeItems(ph.attr.data);
			return true;
		}
		,
		'setSortItems':	function(ph)	{
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(node && 'setSortItems' in node) {
				node.setSortItems(ph.attr.data);
				return true;
			}
			return false;
		}
		,		
		'setAPIProperties':	function(ph)	{
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			if(!node['propHiden']) node['propHiden'] = {};
			for(var key in ph['attr']) {
				node['propHiden'][key] = ph['attr'][key];
			}
			if(node['type'] === 'VectorLayer') node.waitRedraw();
			return true;
		}
		,
		'delClusters':	function(ph) {
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node) return false;
			if(node['type'] == 'filter') {					// для фильтра id
				var pGmxNode = ph.obj.parent;
				var pid = pGmxNode.objectId;
				node = mapNodes[pid];
				node.delClusters();
				return true;
			} else if(node['type'] == 'VectorLayer') {	// для всех фильтров
				node.delClusters();
				return true;
			}
			return false;
		}
		,
		'setClusters':	function(ph) {
			setTimeout(function()
			{
				var id = ph.obj.objectId;
				var node = mapNodes[id];
				if(!node) return false;
				if(node['type'] == 'filter') {					// для фильтра id
					var pGmxNode = ph.obj.parent;
					var pid = pGmxNode.objectId;
					node = mapNodes[pid];
					node.setClusters(ph.attr, id);
					return true;
				} else if(node['type'] == 'VectorLayer') {	// для всех фильтров
					node.setClusters(ph.attr, id);
					return true;
				}
				return false;
			}, 0);
		}
		,
		'getChildren':	function(ph)	{								// Получить потомков обьекта
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			var out = [];
			for (var i = 0; i < node.children.length; i++)
			{
				var itemId = node.children[i];
				var item = mapNodes[itemId];
				if(item) {
					var prop = ('getPropItem' in item ? item.getPropItem(item) : (item.geometry && item.geometry['properties'] ? item.geometry['properties'] : null));
					out.push({
						id: item.id,
						properties: prop
					});
				}
			}
			return out;
		}
		,
		'setEditObjects':	function(ph)	{							// Установка редактируемых обьектов слоя
			var id = ph.obj.objectId;
			var node = mapNodes[id];
			if(!node || !node.setEditObjects) return false;
			node.setEditObjects(ph.attr);
			return true;
		}
		,
		'setBackgroundColor':	function(hash)	{						// Установка BackgroundColor
		}
		,
		'sendPNG':	function(hash)	{									// Сохранение изображения карты на сервер
			var miniMapFlag = gmxAPI.miniMapAvailable;
			var attr = hash['attr'];
			var flag = (attr.miniMapSetVisible ? true : false);
			if(miniMapFlag != flag) gmxAPI.map.miniMap.setVisible(flag);
			if(attr.func) attr.func = gmxAPI.uniqueGlobalName(attr.func);
			var ret = {'base64': utils.getMapImage(attr)};
			if(miniMapFlag) gmxAPI.map.miniMap.setVisible(miniMapFlag);
			return ret;
		}
	}

	// Передача команды в leaflet
	function leafletCMD(cmd, hash)
	{
		if(!LMap) LMap = gmxAPI._leaflet['LMap'];				// Внешняя ссылка на карту
		
		var ret = {};
		if(!hash) hash = {};
		var obj = hash['obj'] || null;	// Целевой обьект команды
		var attr = hash['attr'] || '';
		ret = (cmd in commands ? commands[cmd].call(commands, hash) : {});
		if(!commands[cmd]) gmxAPI.addDebugWarnings({'func': 'leafletCMD', 'cmd': cmd, 'hash': hash});
		//waitChkIdle();
//console.log(cmd + ' : ' , hash , ' : ' , ret);
		return ret;
	}

	// 
	function setImage(node, ph)	{
		var attr = ph.attr;
		node['setImageExtent'] = (ph['setImageExtent'] ? true : false);

		var LatLngToPixel = function(y, x) {
			var point = new L.LatLng(y, x);
			return LMap.project(point);
		}

		var	bounds = null;
		var posLatLng = null;
		
		var pNode = mapNodes[node['parentId']] || null;
		var pGroup = (pNode ? pNode['group'] : LMap);

		var getPixelPoints = function(ph, w, h) {
			var out = {};
			if('extent' in attr) {
				attr['x1'] = attr.extent['minX'];
				attr['y1'] = attr.extent['maxY'];
				attr['x2'] = attr.extent['minX'];
				attr['y2'] = attr.extent['minY'];
				attr['x3'] = attr.extent['maxX'];
				attr['y3'] = attr.extent['minY'];
				attr['x4'] = attr.extent['minX'];
				attr['y4'] = attr.extent['maxY'];
				if('sx' in attr) {
					attr['x4'] = attr['x1'];
					attr['x2'] = attr['x3'] = Number(attr['x1']) + w * attr['sx'];
					attr['y2'] = attr['y1'];
					attr['y3'] = attr['y4'] = Number(attr['y1']) + h * attr['sy'];
				}
			}
			var ptl = new L.Point(attr['x1'], attr['y1']);
			var ptr = new L.Point(attr['x2'], attr['y2']);
			var pbl = new L.Point(attr['x4'], attr['y4']);
			var pbr = new L.Point(attr['x3'], attr['y3']);
			
			bounds = new L.Bounds();
			bounds.extend(ptl); bounds.extend(ptr); bounds.extend(pbl); bounds.extend(pbr);
			
			var pix = LatLngToPixel(ptl.y, ptl.x); out['x1'] = Math.floor(pix.x); out['y1'] = Math.floor(pix.y);
			pix = LatLngToPixel(ptr.y, ptr.x); out['x2'] = Math.floor(pix.x); out['y2'] = Math.floor(pix.y);
			pix = LatLngToPixel(pbr.y, pbr.x); out['x3'] = Math.floor(pix.x); out['y3'] = Math.floor(pix.y);
			pix = LatLngToPixel(pbl.y, pbl.x); out['x4'] = Math.floor(pix.x); out['y4'] = Math.floor(pix.y);

			var	boundsP = new L.Bounds();
			boundsP.extend(new L.Point(out['x1'], out['y1']));
			boundsP.extend(new L.Point(out['x2'], out['y2']));
			boundsP.extend(new L.Point(out['x3'], out['y3']));
			boundsP.extend(new L.Point(out['x4'], out['y4']));
			//minP = boundsP.min;
			out['boundsP'] = boundsP;
			
			out['x1'] -= boundsP.min.x; out['y1'] -= boundsP.min.y;
			out['x2'] -= boundsP.min.x; out['y2'] -= boundsP.min.y;
			out['x3'] -= boundsP.min.x; out['y3'] -= boundsP.min.y;
			out['x4'] -= boundsP.min.x; out['y4'] -= boundsP.min.y;

			out.ww = Math.round(boundsP.max.x - boundsP.min.x);
			out.hh = Math.round(boundsP.max.y - boundsP.min.y);
			return out;
		}

		var repaint = function(imageObj, canvas, zoom) {
			if(node.isVisible == false) return;
			var w = imageObj.width;
			var h = imageObj.height;
			var ph = getPixelPoints(attr, w, h);

			if(!canvas) return;
			var isOnScene = (bounds ? gmxAPI._leaflet['utils'].chkBoundsVisible(bounds) : false);
			node['isOnScene'] = isOnScene;
			if(!isOnScene) return;

			if(imageObj.src.indexOf(node['imageURL']) == -1) return;
			if(!zoom) zoom = LMap.getZoom();
			if(gmxAPI._leaflet['waitSetImage'] > 5) { waitRedraw(); return; }
			gmxAPI._leaflet['waitSetImage']++;

			posLatLng = new L.LatLng(bounds.max.y, bounds.min.x);
			var data = { 'canvas': imageObj	};
			var ww = ph.ww;
			var hh = ph.hh;
			//if(!node['setImageExtent']) {
				var point = LMap.project(new L.LatLng(0, -180), zoom);
				var p180 = LMap.project(new L.LatLng(0, 180), zoom);
				var worldSize = p180.x - point.x;
				
				var vBounds = LMap.getBounds();
				var vpNorthWest = vBounds.getNorthWest();
				var vpSouthEast = vBounds.getSouthEast();

				var vp1 = LMap.project(vpNorthWest, zoom);
				var vp2 = LMap.project(vpSouthEast, zoom);
				var wView = vp2.x - vp1.x;
				var hView = vp2.y - vp1.y;
				
				var dx = 0;
				var deltaX = 0;
				var deltaY = 0;
				node['isLargeImage'] = false;
				if(wView < ww || hView < hh) {
					deltaX = ph['boundsP'].min.x - vp1.x + (dx === 360 ? worldSize : (dx === -360 ? -worldSize : 0));
					deltaY = ph['boundsP'].min.y - vp1.y;
					posLatLng = vpNorthWest;
					ww = wView;
					hh = hView;
					node['isLargeImage'] = true;
				}
				//attr['reposition']();
				var rx = w/ph.ww;
				var ry = h/ph.hh;
				
				var points = [[ph['x1'], ph['y1']], [ph['x2'], ph['y2']], [ph['x4'], ph['y4']], [ph['x3'], ph['y3']]];
				if(rx != 1 || ry != 1) {
					data = gmxAPI._leaflet['ProjectiveImage']({
						'imageObj': imageObj
						,'points': points
						,'wView': wView
						,'hView': hView
						,'deltaX': deltaX
						,'deltaY': deltaY
						,'patchSize': 1
						,'limit': 2
					});
				}
			//}

			var paintPolygon = function (ph, content) {
				if(!content) return;
				var arr = [];
				var coords = ph['coordinates'];
				var minPoint = ph['boundsP'].min;
				if(coords) {
					for (var i = 0; i < coords.length; i++)
					{
						var coords1 = coords[i];
						for (var i1 = 0; i1 < coords1.length; i1++)
						{
							var pArr = coords1[i1];
							for (var j = 0; j < pArr.length; j++)
							{
								var pix = LatLngToPixel(pArr[j][1], pArr[j][0]);
								var px1 = pix.x - minPoint.x; 		px1 = (0.5 + px1) << 0;
								var py1 = pix.y - minPoint.y;		py1 = (0.5 + py1) << 0;
								arr.push({'x': px1, 'y': py1});
							}
						}
					}
				}

				canvas.width = ww;
				canvas.height = hh;
				var ctx = canvas.getContext('2d');
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				var pattern = ctx.createPattern(content, "no-repeat");
				ctx.fillStyle = pattern;
				if(node['regularStyle'] && node['regularStyle']['fill']) ctx.globalAlpha = node['regularStyle']['fillOpacity'] || 1;					
				if(arr.length) {
					ctx.beginPath();
					for (var i = 0; i < arr.length; i++)
					{
						if(i == 0)	ctx.moveTo(arr[i]['x'] + deltaX, arr[i]['y'] + deltaY);
						else		ctx.lineTo(arr[i]['x'] + deltaX, arr[i]['y'] + deltaY);
					}
					ctx.closePath();
				} else {
					ctx.fillRect(0, 0, canvas.width, canvas.height);
				}
				ctx.fill();
			}
			var multiArr = node.geometry.coordinates;
			if(node.geometry['type'] == 'Polygon') multiArr = [multiArr];
			
			paintPolygon({'coordinates': multiArr, 'boundsP': ph['boundsP']}, data['canvas']);
			attr['reposition']();
			data = null;
			imageObj = null;
			--gmxAPI._leaflet['waitSetImage'];
		}

		var imageObj = null;
		var canvas = node['imageCanvas'] || null;
		var drawMe = function(canvas_) {
			canvas = canvas_;
			node['imageCanvas'] = canvas;
			redrawMe();
		}

		attr['reposition'] = function() {
			if(node['leaflet']) node['leaflet'].setLatLng(posLatLng);
		}

		var redrawTimer = null;
		var waitRedraw = function()	{						// Требуется перерисовка с задержкой
			if(redrawTimer) clearTimeout(redrawTimer);
			redrawTimer = setTimeout(function()
			{
				redrawMe();
			}, 10);
		}

		var redrawMe = function(e) {
			if(gmxAPI._leaflet['zoomstart']) return;
			if(!imageObj) {
				var src = attr['url'];
				//var src = '1.jpg';
				node['imageURL'] = src.replace(/\.\.\//g, '');
				var ph = {
					'src': src
					,'crossOrigin': 'anonymous'
					,'callback': function(img) {
						imageObj = img;
						node['refreshMe'] = function() {
							if(canvas) repaint(imageObj, canvas);
						}
						node['refreshMe']();
					}
					,'onerror': function(){
					}
				};
				gmxAPI._leaflet['imageLoader'].push(ph);
			}
			if(node['refreshMe'] && imageObj && canvas) {
				repaint(imageObj, canvas);
			}
		}
		
		var createIcon = function() {
			if(node['leaflet']) {
				pGroup.removeLayer(node['leaflet']);
			}
			var canvasIcon = L.canvasIcon({
				className: 'my-canvas-icon'
				,'node': node
				,'drawMe': drawMe
				//,iconAnchor: new L.Point(12, 12) // also can be set through CSS
			});
			var vBounds = LMap.getBounds();
			var vpNorthWest = vBounds.getNorthWest();
			var marker =  new L.GMXMarker(vpNorthWest, {icon: canvasIcon, 'toPaneName': 'shadowPane', 'zIndexOffset': -1000});
				
			node['leaflet'] = marker;
			pGroup.addLayer(marker);
			if(pNode) utils.setVisibleNode({'obj': pNode, 'attr': true});
			setNodeHandlers(node.id);

			LMap.on('zoomend', function(e) { waitRedraw();});
			LMap.on('moveend', function(e) {
				//if(!node['isLargeImage']) return;
				waitRedraw();
			});
			
			LMap.on('zoomstart', function(e) {
				if(canvas) canvas.width = canvas.height = 0;
			});
			node['isSetImage'] = true;
		}
		if(!node['isSetImage']) {
			createIcon();
		} else {
			if(attr['url'] != node['imageURL']) drawMe(node['imageCanvas']);
		}
	}


	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['cmdProxy'] = leafletCMD;				// посылка команд отрисовщику
	gmxAPI._leaflet['utils'] = utils;						// утилиты для leaflet
	gmxAPI._leaflet['mapNodes'] = mapNodes;					// Хэш нод обьектов карты - аналог MapNodes.hx
    
	//gmxAPI._cmdProxy = leafletCMD;				// посылка команд отрисовщику
	//gmxAPI._leafletUtils = utils;
//	var mapNodes = {						// Хэш нод обьектов карты - аналог MapNodes.hx
	
})();

// Geometry
(function()
{
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['Geometry'] = function() {						// класс Geometry
		var out = {
			'type': 'unknown'
			,'geoID': gmxAPI.newFlashMapId()
			,'bounds': null
			//,'curStyle': null
		};
		return out;
	};
})();

// PointGeometry
(function()
{
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['PointGeometry'] = function(geo_, tileBounds_) {				// класс PointGeometry
		var out = gmxAPI._leaflet['Geometry']();
		out['type'] = 'Point';

		var p = geo_['coordinates'];
		var point = new L.Point(p[0], p[1]);
		var bounds = new L.Bounds(point);
		bounds.extend(point);

		out['coordinates'] = point;
		out['bounds'] = bounds;
		out['sx'] = out['sy'] = 4;
		out['dx'] = out['dy'] = 0;		// смещение по стилю
		out['sxLabelLeft'] = out['sxLabelRight'] = out['syLabelTop'] = out['syLabelBottom'] = 0;
		
		out['getPoint'] = function () { return point; };
		// Экспорт точки в АПИ
		out['exportGeo'] = function (chkPoint) {
			var res = {'type': 'POINT'};
			res['coordinates'] = p;
			return res;
		}
		// Проверка совпадения с другой точкой
		out['contains'] = function (chkPoint) {
			return gmxAPI._leaflet['utils'].chkPointWithDelta(bounds, chkPoint, out);
		}
		// Проверка пересечения точки с bounds
		out['intersects'] = function (chkBounds) {
			return gmxAPI._leaflet['utils'].chkPointWithDelta(chkBounds, point, out);
		}
		// Квадрат растояния до точки
		out['distance2'] = function (chkPoint) {
			var x = point.x - chkPoint.x,
				y = point.y - chkPoint.y;
			return x * x + y * y;
		}

		var chkLabelBounds = function(labelBounds, ph)	{							// проверка пересечений labels
			var p = new L.Point(ph['lx'], ph['ly']);
			var b = new L.Bounds(p);
			b.extend(p);
			p = new L.Point(ph['lx'] + ph.labelExtent['x'], ph['ly'] + ph.labelExtent['y']);
			b.extend(p);
			for (var i = 0; i < labelBounds.length; i++)
			{
				if(b.intersects(labelBounds[i])) {					// проверка пересечения уже нарисованных в тайле labels
					return false;
				}
			}
			labelBounds.push(b);
			return true;
		}

		// Проверка размера точки по стилю
		out['chkSize'] = function (node, style) {
			var prop = ('getPropItem' in node ? node.getPropItem(out) : (out.geometry && out['properties'] ? out['properties'] : null));

			var size = style['size'] || 4;
			var scale = style['scale'] || 1;
			if(!out['_cache']) out['_cache'] = {};
			if('_scale' in out['_cache']) scale = out['_cache']['_scale'];
			else {
				if(typeof(scale) == 'string') {
					scale = (style['scaleFunction'] ? style['scaleFunction'](prop) : 1);
				}
				if(scale < style['minScale']) scale = style['minScale'];
				else if(scale > style['maxScale']) scale = style['maxScale'];
				out['_cache']['_scale'] = scale;
			}
			out['sx'] = scale * (style['imageWidth'] ? style['imageWidth']/2 : size);
			out['sy'] = scale * (style['imageHeight'] ? style['imageHeight']/2 : size);
			if(style['dx']) out['dx'] = style['dx'];
			if(style['dy']) out['dy'] = style['dy'];
			out['weight'] = style['weight'] || 0;

			if(style['marker']) {
				if(style['image']) {
					var canv = out['_cache']['canv'];
					if(!canv) {
						canv = style['image'];
						var rotateRes = style['rotate'] || 0;
						if(rotateRes && typeof(rotateRes) == 'string') {
							rotateRes = (style['rotateFunction'] ? style['rotateFunction'](prop) : 0);
						}
						style['rotateRes'] = rotateRes;
						if(style['rotateRes'] || 'color' in style) {
							if(style['rotateRes']) {
								size = Math.ceil(Math.sqrt(style.imageWidth*style.imageWidth + style.imageHeight*style.imageHeight));
								out['sx'] = out['sy'] = Math.ceil(scale * size/2);
								out['isCircle'] = true;
							}
							canv = gmxAPI._leaflet['utils'].replaceColorAndRotate(style['image'], style, size);
						}
						out['_cache']['canv'] = canv;
					} else {
						out['sx'] = scale * canv.width/2;
						out['sy'] = scale * canv.height/2;
					}
				} else if(style['polygons']) {
					var rotateRes = style['rotate'] || 0;
					if(rotateRes && typeof(rotateRes) == 'string') {
						rotateRes = (style['rotateFunction'] ? style['rotateFunction'](prop) : 0);
						if(rotateRes) out['isCircle'] = true;
					}
					style['rotateRes'] = rotateRes || 0;
				}
			} else {
				if(style['fill']) {
					if(style['radialGradient']) {
						var rgr = style['radialGradient'];
						var r1 = (rgr['r1Function'] ? rgr['r1Function'](prop) : rgr['r1']);
						var r2 = (rgr['r2Function'] ? rgr['r2Function'](prop) : rgr['r2']);
						size = scale * Math.max(r1, r2);
						out['sx'] = out['sy'] = size;
						out['isCircle'] = true;
					} else if(style['circle']) {
						out['sx'] = out['sy'] = size;
						out['isCircle'] = true;
					}
				}
			}
			out['_cache']['chkSize'] = true;
		}

		// Отрисовка точки
		out['paint'] = function (attr, style, ctx) {
			if(!attr || !style) return;
			var zoom = attr['zoom'];
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			var node = attr['node'];

			if(!out['_cache']) out['_cache'] = {};
			if(!out['_cache']['chkSize']) out['chkSize'](node, style);
			var prop = ('getPropItem' in node ? node.getPropItem(out) : (out.geometry && out['properties'] ? out['properties'] : null));

			var x = attr['x'];
			var y = 256 + attr['y'];
			var px1 = point.x * mInPixel - x - out['sx'] - 1; 		px1 = (0.5 + px1) << 0;
			var py1 = y - point.y * mInPixel - out['sy'] - 1;		py1 = (0.5 + py1) << 0;
			if(style['dx']) px1 += out['dx'];
			if(style['dy']) py1 += out['dy'];
			if('center' in style && !style['center']) {
				px1 += out['sx'];
				py1 += out['sy'];
			}

			if(style['marker']) {
				if(style['image']) {
					var canv = out['_cache']['canv'];
					if('opacity' in style) ctx.globalAlpha = style['opacity'];
					ctx.drawImage(canv, px1, py1, 2*out['sx'], 2*out['sy']);
					if('opacity' in style) ctx.globalAlpha = 1;
				} else if(style['polygons']) {
					var rotateRes = style['rotate'] || 0;
					if(rotateRes && typeof(rotateRes) == 'string') {
						rotateRes = (style['rotateFunction'] ? style['rotateFunction'](prop) : 0);
					}
					style['rotateRes'] = rotateRes || 0;

					for (var i = 0; i < style['polygons'].length; i++)
					{
						var p = style['polygons'][i];
						ctx.save();
						ctx.lineWidth = p['stroke-width'] || 0;
						ctx.fillStyle = p['fill_rgba'] || 'rgba(0, 0, 255, 1)';
						
						ctx.beginPath();
						var arr = gmxAPI._leaflet['utils'].rotatePoints(p['points'], style['rotateRes'], out['_cache']['_scale'], {'x': out['sx'], 'y': out['sy']});
						for (var j = 0; j < arr.length; j++)
						{
							var t = arr[j];
							if(j == 0)
								ctx.moveTo(px1 + t['x'], py1 + t['y']);
							else
								ctx.lineTo(px1 + t['x'], py1 + t['y']);
						}
						ctx.fill();
						ctx.restore();
					}
				}
			} else {
				if(style['stroke'] && style['weight'] > 0) {
					ctx.beginPath();
					if(style['circle']) {
						ctx.arc(px1, py1, out['sx'], 0, 2*Math.PI);
					} else {
						ctx.strokeRect(px1, py1, 2*out['sx'], 2*out['sy']);
					}
					ctx.stroke();
					//sx = sy = size;
				}
				if(style['fill']) {
					ctx.beginPath();
					if(style['radialGradient']) {
						var rgr = style['radialGradient'];
						var r1 = (rgr['r1Function'] ? rgr['r1Function'](prop) : rgr['r1']);
						var r2 = (rgr['r2Function'] ? rgr['r2Function'](prop) : rgr['r2']);
						var x1 = (rgr['x1Function'] ? rgr['x1Function'](prop) : rgr['x1']);
						var y1 = (rgr['y1Function'] ? rgr['y1Function'](prop) : rgr['y1']);
						var x2 = (rgr['x2Function'] ? rgr['x2Function'](prop) : rgr['x2']);
						var y2 = (rgr['y2Function'] ? rgr['y2Function'](prop) : rgr['y2']);
						//size = scale * Math.max(r1, r2);
						//out['sx'] = out['sy'] = size;
						px1 = point.x * mInPixel - x - 1; 		px1 = (0.5 + px1) << 0;
						py1 = y - point.y * mInPixel - 1;		py1 = (0.5 + py1) << 0;

						var radgrad = ctx.createRadialGradient(px1+x1, py1+y1, r1, px1+x2, py1+y2,r2);  
						for (var i = 0; i < style['radialGradient']['addColorStop'].length; i++)
						{
							var arr = style['radialGradient']['addColorStop'][i];
							var arrFunc = style['radialGradient']['addColorStopFunctions'][i];
							var p0 = (arrFunc[0] ? arrFunc[0](prop) : arr[0]);
							var p2 = (arr.length < 3 ? 100 : (arrFunc[2] ? arrFunc[2](prop) : arr[2]));
							var p1 = gmxAPI._leaflet['utils'].dec2rgba(arrFunc[1] ? arrFunc[1](prop) : arr[1], p2/100);
							radgrad.addColorStop(p0, p1);
						}
						ctx.fillStyle = radgrad;

						ctx.arc(px1, py1, out['sx'], 0, 2*Math.PI);
					} else {
						if(style['circle']) {
							px1 = point.x * mInPixel - x - 1; 		px1 = (0.5 + px1) << 0;
							py1 = y - point.y * mInPixel - 1;		py1 = (0.5 + py1) << 0;
							ctx.arc(px1, py1, out['sx'], 0, 2*Math.PI);
						} else {
							ctx.fillRect(px1, py1, 2*out['sx'], 2*out['sy']);
						}
					}
					ctx.fill();
					//sx = sy = size;
				}
			}

			if(style['label']) {
				var labelStyle = style['label'];
				var txt = (labelStyle['field'] ? prop[labelStyle['field']] : labelStyle['value']) || '';
				if(txt) {
					gmxAPI._leaflet['LabelsManager'].addItem(txt, out, attr, style);	// добавим label от векторного слоя
				}
			}
		}
		
		return out;
	};
})();

// LineGeometry LINESTRING
(function()
{
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['LineGeometry'] = function(geo_, tileBounds_) {				// класс PolygonGeometry
		var out = gmxAPI._leaflet['Geometry']();
		out['type'] = 'Polyline';
		var tileBounds = tileBounds_;					// границы тайла в котором пришел обьект
		var lastZoom = null;
		var bounds = null;
		out['sx'] = out['sy'] = 0;
		out['sxLabelLeft'] = out['sxLabelRight'] = out['syLabelTop'] = out['syLabelBottom'] = 0;
		var coords = [];
		var cnt = 0;
		var lineHeight = 2;
		for (var i = 0; i < geo_['coordinates'].length; i++)
		{
			var p = geo_['coordinates'][i];
			var point = new L.Point(p[0], p[1]);
			if(!bounds) bounds = new L.Bounds(point);
			bounds.extend(point);
			coords.push(point);
			cnt++;
		}
		out['bounds'] = bounds;
		// Экспорт в АПИ
		out['exportGeo'] = function (chkPoint) {
			var res = {'type': 'LINESTRING'};
			res['coordinates'] = geo_['coordinates'];
			return res;
		}

		// Отрисовка геометрии LineGeometry
		var paintStroke = function (attr, style, ctx) {
//console.log(bounds , ' paintStroke: ' , attr.bounds);
			//if(!chkNeedDraw(attr)) return false;				// проверка необходимости отрисовки
//console.log(' ok: ' , attr.bounds);
			
			//var ctx = attr['ctx'];
			var x = attr['x'];
			var y = 256 + attr['y'];
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			ctx.beginPath();
			for (var i = 0; i < coords.length; i++)
			{
				var p1 = coords[i];
				var px1 = p1.x * mInPixel - x; 		px1 = (0.5 + px1) << 0;
				var py1 = y - p1.y * mInPixel;		py1 = (0.5 + py1) << 0;
				if(i == 0)
					ctx.moveTo(px1, py1);
				else
					ctx.lineTo(px1, py1);
			}
			ctx.stroke();
			return true;		// отрисована геометрия

		}

		// Получить точку маркера геометрии LineGeometry
		var getPoint = function () {
			var point = {'x':0,'y':0};
			for (var i = 0; i < coords.length; i++)
			{
				var p1 = coords[i];
				point.x += p1.x;
				point.y += p1.y;
			}
			point.x /= coords.length;
			point.y /= coords.length;
			return point;
		}
		out['getPoint'] = getPoint;

		// Отрисовка LineGeometry
		out['paint'] = function(attr, style, ctx) {
			if(!attr) return;
			if(style && style['marker']) {
				if(style['image']) {
					//var ctx = attr['ctx'];
					var point = getPoint();
					var x = attr['x'];
					var y = 256 + attr['y'];
					var mInPixel = gmxAPI._leaflet['mInPixel'];
					if(style['imageWidth']) out['sx'] = style['imageWidth']/2;
					if(style['imageHeight']) out['sy'] = style['imageHeight']/2;
					var px1 = point.x * mInPixel - x - out['sx']; 		px1 = (0.5 + px1) << 0;
					var py1 = y - point.y * mInPixel - out['sy'];		py1 = (0.5 + py1) << 0;
					ctx.drawImage(style['image'], px1, py1);
					return false;
				}
			} else {
				out['sx'] = out['sy'] = 0;
				paintStroke(attr, style, ctx);
			}
			if(style) lineHeight = style.weight;
			return true;
		}
		// Квадрат растояния до линии
		out['distance2'] = function (chkPoint) {
			if(out['sx']) {
				var point = getPoint();
				var x = point.x - chkPoint.x,
					y = point.y - chkPoint.y;
				return x * x + y * y;
			}
			return 0;
		}

		// Проверка принадлежности точки LineGeometry
		out['contains'] = function (chkPoint) {
			if(out['sx']) {
				var point = getPoint();
				var bounds1 = new L.Bounds();
				bounds1.extend(new L.Point(point.x, point.y));
				return gmxAPI._leaflet['utils'].chkPointWithDelta(bounds1, chkPoint, out);
			}
			if(bounds.contains(chkPoint)) {
				if(gmxAPI._leaflet['utils'].chkPointInPolyLine(chkPoint, lineHeight, coords)) return true;
			}
			return false;
		}
		// Проверка пересечения LineGeometry с bounds
		out['intersects'] = function (chkBounds) {
			var flag = false;
			if(out['sx']) {
				flag = gmxAPI._leaflet['utils'].chkPointWithDelta(chkBounds, getPoint(), out);
			} else {
				flag = bounds.intersects(chkBounds);
			}
			return flag;
		}
		
		return out;
	}
})();

// MULTILINESTRING MultiPolyline
(function()
{
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['MultiPolyline'] = function(geo, tileBounds_) {				// класс MultiPolyline
		var out = gmxAPI._leaflet['Geometry']();
		out['type'] = 'MultiPolyline';
		out['tileBounds'] = tileBounds_;

		var members = [];
		var bounds = null;
		var cnt = 0;
		var addMember = function (item) {
			cnt += item.cnt;
			var p = new L.Point( item.bounds.min.x, item.bounds.min.y );
			if(!bounds) bounds = new L.Bounds(p);
			bounds.extend(p);
			p = new L.Point( item.bounds.max.x, item.bounds.max.y );
			bounds.extend(p);
			members.push(item);
		}
		var addMembers = function (arr) {
			for (var i = 0; i < arr.length; i++)
			{
				addMember(arr[i]);
			}
		}
		
		if(geo && geo['coordinates'] && geo['coordinates'].length) {
			var arr = [];
			for (var i = 0; i < geo['coordinates'].length; i++)
			{
				var item = gmxAPI._leaflet['LineGeometry']({'coordinates': geo['coordinates'][i]}, tileBounds_);
				addMember(item);
			}
		}
		// Экспорт в АПИ
		out['exportGeo'] = function (chkPoint) {
			var res = {'type': 'MULTILINESTRING'};
			res['coordinates'] = geo['coordinates'];
			return res;
		}
		// Получить точку маркера геометрии
		var getPoint = function () {
			var point = {
				'x': (bounds.min.x + bounds.max.x)/2,
				'y': (bounds.min.y + bounds.max.y)/2
			};
			return point;
		}
		out['getPoint'] = getPoint;
		
		out['addMembers'] = addMembers;
		out['addMember'] = addMember;
		out['bounds'] = bounds;
		out['cnt'] = cnt;
		out['paint'] = function (attr, style, ctx) {
			if(!attr) return;
			var cnt = 0;
			if(bounds.intersects(attr['bounds'])) {				// проверка пересечения мультиполигона с отображаемым тайлом
				for (var i = 0; i < members.length; i++)
				{
					if(!members[i].paint(attr, style, ctx)) break;
				}
			}
			return cnt;		// количество отрисованных точек в геометрии
		}
		// Квадрат растояния до MultiPolyline
		out['distance2'] = function (chkPoint) {
			var d = Number.MAX_VALUE;
			for (var i = 0; i < members.length; i++)
			{
				var d1 = members[i]['distance2'](chkPoint);
				if(d1 < d) d = d1;
			}
			return d;
		}
		
		// Проверка принадлежности точки MultiPolyline
		out['contains'] = function (chkPoint) {
			for (var i = 0; i < members.length; i++)
			{
				if(members[i]['contains'](chkPoint)) return true;
			}
			return false;
		}
		
		// Проверка пересечения MultiPolyline с bounds
		out['intersects'] = function (chkBounds) {
			for (var i = 0; i < members.length; i++)
			{
				if(members[i]['intersects'](chkBounds)) return true;
			}
			return false;
		}
		
		return out;
	};
})();

// PolygonGeometry
(function()
{
	var chkOnEdge = function(p1, p2, ext) {				// отрезок на границе
		if ((p1[0] < ext.minX && p2[0] < ext.minX) || (p1[0] > ext.maxX && p2[0] > ext.maxX)) return true;
		if ((p1[1] < ext.minY && p2[1] < ext.minY) || (p1[1] > ext.maxY && p2[1] > ext.maxY)) return true;
		return false;
	}

	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['PolygonGeometry'] = function(geo_, tileBounds_) {				// класс PolygonGeometry
		if(!tileBounds_) return;
		var out = gmxAPI._leaflet['Geometry']();
		out['type'] = 'Polygon';
		var tileBounds = tileBounds_;					// границы тайла в котором пришел обьект
		var lastZoom = null;
		var bounds = null;
		var hideLines = [];								// индексы точек лежащих на границе тайла
		var cnt = 0;
		var coords = [];
		var d = (tileBounds.max.x - tileBounds.min.x)/10000;
		var tbDelta = {									// границы тайла для определения onEdge отрезков
			'minX': tileBounds.min.x + d
			,'maxX': tileBounds.max.x - d
			,'minY': tileBounds.min.y + d
			,'maxY': tileBounds.max.y - d
		};
		for (var i = 0; i < geo_['coordinates'].length; i++)
		{
			var hideLines1 = [];
			var prev = null;
			var coords1 = [];
			for (var j = 0; j < geo_['coordinates'][i].length; j++)
			{
				var p = geo_['coordinates'][i][j];
				var point = new L.Point(p[0], p[1]);
				if(!bounds) bounds = new L.Bounds(point);
				bounds.extend(point);
				if(prev && chkOnEdge(p, prev, tbDelta)) {
					hideLines1.push(cnt);
				}
				prev = p;
				coords1.push(point);
				cnt++;
			}
			hideLines.push(hideLines1);
			coords.push(coords1);
		}
		out['coordinates'] = coords;
		out['bounds'] = bounds;
		// Экспорт в АПИ
		out['exportGeo'] = function (chkPoint) {
			var res = {'type': 'POLYGON'};
			res['coordinates'] = geo_['coordinates'];
			return res;
		}

		var bMinX = gmxAPI.from_merc_x(bounds.min.x);
		var bMaxX = gmxAPI.from_merc_x(bounds.max.x);
		out['boundsType'] = (bMinX < -179.999 && bMaxX > 179.999 ? true : false);

		out['cnt'] = cnt;
		out['propHiden'] = {};					// служебные свойства
		
		// Получить точку маркера геометрии полигона
		var getPoint = function () {
			var point = {
				'x': (bounds.min.x + bounds.max.x)/2,
				'y': (bounds.min.y + bounds.max.y)/2
			};
			return point;
		}
		out['getPoint'] = getPoint;
		// проверка необходимости отрисовки геометрии
		var chkNeedDraw = function (attr) {
			//if(!bounds.intersects(attr['bounds'])) return false;				// проверка пересечения полигона с отображаемым тайлом
			var shiftX = getShiftX(attr['bounds']);
			if(shiftX === null) return false;
			var node = attr['node'];
			if(!node.chkTemporalFilter(out)) return false;
			return shiftX;
		}
		// Отрисовка заполнения полигона
		var paintFill = function (attr, style, ctx, fillFlag) {
			if(!attr) return false;
			//var shiftX = chkNeedDraw(attr);				// проверка необходимости отрисовки
			//if(shiftX === false) return false
			//var ctx = attr['ctx'];
			var x = attr['x'];
			var y = 256 + attr['y'];
			var mInPixel = gmxAPI._leaflet['mInPixel'];
			/*if(style && style['marker']) {
				if(style['image']) {
					var point = getPoint();
					if(style['imageWidth']) out['sx'] = style['imageWidth']/2;
					if(style['imageHeight']) out['sy'] = style['imageHeight']/2;
					var px1 = point.x * mInPixel - x - out['sx']; 		px1 = (0.5 + px1) << 0;
					var py1 = y - point.y * mInPixel - out['sy'];		py1 = (0.5 + py1) << 0;
					ctx.drawImage(style['image'], px1, py1);
					return false;
				}
			} else {*/
				ctx.beginPath();
				if(style) {
					if(style['pattern']) {
						var canvasPattern = attr['canvasPattern'] || null;
						if(!canvasPattern) {
							var pt = gmxAPI._leaflet['utils'].getPatternIcon(out, style);
							canvasPattern = (pt ? pt['canvas'] : null);
						}
						if(canvasPattern) {
							var pattern = ctx.createPattern(canvasPattern, "repeat");
							ctx.fillStyle = pattern;
						}
					} else if(style['linearGradient']) {
						var rgr = style['linearGradient'];
						var x1 = (rgr['x1Function'] ? rgr['x1Function'](prop) : rgr['x1']);
						var y1 = (rgr['y1Function'] ? rgr['y1Function'](prop) : rgr['y1']);
						var x2 = (rgr['x2Function'] ? rgr['x2Function'](prop) : rgr['x2']);
						var y2 = (rgr['y2Function'] ? rgr['y2Function'](prop) : rgr['y2']);
						var lineargrad = ctx.createLinearGradient(x1,y1, x2, y2);  
						for (var i = 0; i < style['linearGradient']['addColorStop'].length; i++)
						{
							var arr = style['linearGradient']['addColorStop'][i];
							var arrFunc = style['linearGradient']['addColorStopFunctions'][i];
							var p0 = (arrFunc[0] ? arrFunc[0](prop) : arr[0]);
							var p2 = (arr.length < 3 ? 100 : (arrFunc[2] ? arrFunc[2](prop) : arr[2]));
							var p1 = gmxAPI._leaflet['utils'].dec2rgba(arrFunc[1] ? arrFunc[1](prop) : arr[1], p2/100);
							lineargrad.addColorStop(p0, p1);
						}
						ctx.fillStyle = lineargrad; 
						//ctx.fillRect(0, 0, 255, 255);
					}
				}

				//console.log('nnn ' ,  ' : ' , coords);
				for (var i = 0; i < coords.length; i++)
				{
					//var pArr = coords[i];
					var lastX = null, lastY = null;
					//var pArr = L.PolyUtil.clipPolygon(coords[i], attr['bounds']);
					for (var j = 0; j < coords[i].length; j++)
					{
						var p1 = coords[i][j];
						var px1 = p1.x * mInPixel - x; 		px1 = (0.5 + px1) << 0;
						var py1 = y - p1.y * mInPixel;		py1 = (0.5 + py1) << 0;
						if(lastX !== px1 || lastY !== py1) {
							if(j == 0)
								ctx.moveTo(px1, py1);
							else
								ctx.lineTo(px1, py1);
							lastX = px1, lastY = py1;
						}
					}
				}
				ctx.closePath();
				if(fillFlag) ctx.fill();
			//}
		}
		// Отрисовка заполнения полигона
		out['paintFill'] = function (attr, style, ctx, fillFlag) {
			paintFill(attr, style, ctx, fillFlag);
		}
		// Отрисовка геометрии полигона
		var paintStroke = function (attr, style, ctx) {
			if(!attr) return false;
			//var shiftX = chkNeedDraw(attr);				// проверка необходимости отрисовки
			//if(shiftX === false) return false

			//var ctx = attr['ctx'];
			var x = attr['x'];
			var y = 256 + attr['y'];
			var mInPixel = gmxAPI._leaflet['mInPixel'];

			ctx.beginPath();
			for (var i = 0; i < coords.length; i++)
			{
				var hArr = hideLines[i];
				var cntHide = 0;
				//var pArr = coords[i];
				//var pArr = L.PolyUtil.clipPolygon(coords[i], attr['bounds']);
				var lastX = null, lastY = null;
				for (var j = 0; j < coords[i].length; j++)
				{
					var lineIsOnEdge = false;
					if(j == hArr[cntHide]) {
						lineIsOnEdge = true;
						cntHide++;
					}
					var p1 = coords[i][j];
					var px1 = p1.x * mInPixel - x; 		px1 = (0.5 + px1) << 0;
					var py1 = y - p1.y * mInPixel;		py1 = (0.5 + py1) << 0;
					if(lastX !== px1 || lastY !== py1) {
						if(lineIsOnEdge || j == 0) {
							ctx.moveTo(px1, py1);
						}
						else {
							ctx.lineTo(px1, py1);
						}
						lastX = px1, lastY = py1;
					}
				}
			}
			//ctx.closePath();
			ctx.stroke();
			//if(attr.style.fill) ctx.fill();

			//var style = attr['style'];
			if(style && style['label']) {
				var node = attr['node'];
				var prop = ('getPropItem' in node ? node.getPropItem(out) : (out.geometry && out['properties'] ? out['properties'] : null));
				var labelStyle = style['label'];
				var txt = (labelStyle['field'] ? prop[labelStyle['field']] : labelStyle['value']) || '';
				if(txt) {
					gmxAPI._leaflet['LabelsManager'].addItem(txt, out, attr, style);	// добавим label от векторного слоя
				}
			}
			
			return true;		// отрисована геометрия
		}
		// Отрисовка геометрии полигона
		out['paintStroke'] = function (attr, style, ctx) {
			if(!attr) return;
			paintStroke(attr, style, ctx);
		}
		// Отрисовка полигона
		out['paint'] = function(attr, style, ctx) {
			if(!attr || !style) return;
			if(style && style['marker']) {
				if(style['image']) {
					var point = getPoint();
					var x = attr['x'];
					var y = 256 + attr['y'];
					var mInPixel = gmxAPI._leaflet['mInPixel'];
					if(style['imageWidth']) out['sx'] = style['imageWidth']/2;
					if(style['imageHeight']) out['sy'] = style['imageHeight']/2;
					var px1 = point.x * mInPixel - x - out['sx']; 		px1 = (0.5 + px1) << 0;
					var py1 = y - point.y * mInPixel - out['sy'];		py1 = (0.5 + py1) << 0;
					ctx.drawImage(style['image'], px1, py1);
					return 1;
				}
			} else {
				out['sx'] = out['sy'] = 0;
				if(style.fill) paintFill(attr, style, ctx, true);
				var res = paintStroke(attr, style, ctx);
				return res;
			}
		}
		// Проверка принадлежности точки полигону
		out['contains'] = function (chkPoint, curStyle, fillPattern) {
			if(!curStyle) curStyle = out.propHiden.curStyle;
			if(curStyle && curStyle['marker']) {
				var point = getPoint();
				var bounds1 = new L.Bounds();
				bounds1.extend(new L.Point(point.x, point.y));
				return gmxAPI._leaflet['utils'].chkPointWithDelta(bounds1, chkPoint, out);
			}
			if(bounds.contains(chkPoint)) {
				var fill = (fillPattern ? true : (curStyle ? curStyle.fill : false));
				for (var i = 0; i < coords.length; i++)
				{
					if(fill) {
						if(gmxAPI._leaflet['utils'].isPointInPolygon(chkPoint, coords[i])) return true;
					} else {
						var weight = (curStyle ? curStyle.weight : 1);
						if(gmxAPI._leaflet['utils'].chkPointInPolyLine(chkPoint, weight, coords[i])) return true;
					}
				}
			}
			return false;
		}
		// Проверка смещения
		var getShiftX = function (chkBounds) {
		    if(chkBounds.max.x < bounds.min.x || chkBounds.min.x > bounds.max.x) return null;
			if(chkBounds.max.y < bounds.min.y || chkBounds.min.y > bounds.max.y) return null;
			return 0;
/*			
			var yFlag = (chkBounds.max.y >= bounds.min.y && chkBounds.min.y <= bounds.max.y);
			if(!yFlag) return null;
		    if(chkBounds.max.x >= bounds.min.x && chkBounds.min.x <= bounds.max.x) return 0;
			return null;*/
		}
		// Проверка пересечения полигона с bounds
		out['intersects'] = function (chkBounds) {
			var flag = false;
			if(out['sx']) {
				flag = gmxAPI._leaflet['utils'].chkPointWithDelta(chkBounds, getPoint(), out);
			} else {
				var pt = getShiftX(chkBounds);
				flag = (pt === null ? false : true);
			}
			return flag;
		}
		
		// Квадрат растояния до полигона
		out['distance2'] = function (chkPoint) {
			if(out['sx']) {
				var point = getPoint();
				var x = point.x - chkPoint.x,
					y = point.y - chkPoint.y;
				return x * x + y * y;
			}
			return 0;
		}
		return out;
	};
})();

// MultiPolygonGeometry
(function()
{
	//расширяем namespace
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['MultiPolygonGeometry'] = function(geo, tileBounds_) {				// класс MultiPolygonGeometry
		var out = gmxAPI._leaflet['Geometry']();
		out['type'] = 'MultiPolygon';
		out['tileBounds'] = tileBounds_;

		var members = [];
		var bounds = null;
		var cnt = 0;
		var addMember = function (item) {
			cnt += item.cnt;
			var p = new L.Point( item.bounds.min.x, item.bounds.min.y );
			if(!bounds) bounds = new L.Bounds(p);
			bounds.extend(p);
			p = new L.Point( item.bounds.max.x, item.bounds.max.y );
			bounds.extend(p);
			members.push(item);
		}
		var addMembers = function (arr) {
			for (var i = 0; i < arr.length; i++)
			{
				addMember(arr[i]);
			}
		}
		
		if(geo && geo['coordinates'] && geo['coordinates'].length) {
			var arr = [];
			for (var i = 0; i < geo['coordinates'].length; i++)
			{
				var item = gmxAPI._leaflet['PolygonGeometry']({'coordinates': geo['coordinates'][i]}, tileBounds_);
				addMember(item);
			}
		}
		out['exportGeo'] = function (chkPoint) {
			var res = {'type': 'MULTIPOLYGON'};
			res['coordinates'] = geo['coordinates'];
			return res;
		}
		// Получить точку маркера геометрии
		var getPoint = function () {
			var point = {
				'x': (bounds.min.x + bounds.max.x)/2,
				'y': (bounds.min.y + bounds.max.y)/2
			};
			return point;
		}
		out['getPoint'] = getPoint;
		
		out['addMembers'] = addMembers;
		out['addMember'] = addMember;
		out['bounds'] = bounds;
		//out['members'] = members;
		out['cnt'] = cnt;
		out['paint'] = function (attr, style, ctx) {
			var count = 0;
			if(style && style['marker']) {
				if(style['image']) {
					var point = getPoint();
					var x = attr['x'];
					var y = 256 + attr['y'];
					var mInPixel = gmxAPI._leaflet['mInPixel'];
					if(style['imageWidth']) out['sx'] = style['imageWidth']/2;
					if(style['imageHeight']) out['sy'] = style['imageHeight']/2;
					var px1 = point.x * mInPixel - x - out['sx']; 		px1 = (0.5 + px1) << 0;
					var py1 = y - point.y * mInPixel - out['sy'];		py1 = (0.5 + py1) << 0;
					ctx.drawImage(style['image'], px1, py1);
					count = 1;
				}
			} else {
				var drawFlag = bounds.intersects(attr['bounds']);
				if(drawFlag) {				// проверка пересечения мультиполигона с отображаемым тайлом
					for (var i = 0; i < members.length; i++)
					{
						count += members[i].paint(attr, style, ctx);
					}
				}
			}
			if(style && style['label']) {
				var node = attr['node'];
				var prop = ('getPropItem' in node ? node.getPropItem(out) : (out.geometry && out['properties'] ? out['properties'] : null));
				var labelStyle = style['label'];
				var txt = (labelStyle['field'] ? prop[labelStyle['field']] : labelStyle['value']) || '';
				if(txt) {
					gmxAPI._leaflet['LabelsManager'].addItem(txt, out, attr, style);	// добавим label от векторного слоя
				}
			}

			return count;		// количество отрисованных точек в геометрии
		}
		// Отрисовка заполнения
		out['paintFill'] = function (attr, style, ctx) {
			var count = 0;
			if(bounds.intersects(attr['bounds'])) {				// проверка пересечения мультиполигона с отображаемым тайлом
				for (var i = 0; i < members.length; i++)
				{
					count += members[i].paintFill(attr, style, ctx, false);
				}
			}
			return count;		// количество отрисованных точек в геометрии
		}

		// Проверка принадлежности точки MultiPolygonGeometry
		out['contains'] = function (chkPoint, curStyle, fillPattern) {
			if(!curStyle) curStyle = out.propHiden.curStyle;
			if(curStyle && curStyle['marker']) {
				var point = getPoint();
				var bounds1 = new L.Bounds();
				bounds1.extend(new L.Point(point.x, point.y));
				return gmxAPI._leaflet['utils'].chkPointWithDelta(bounds1, chkPoint, out);
			}
			for (var i = 0; i < members.length; i++)
			{
				if(members[i]['contains'](chkPoint, curStyle, fillPattern)) return true;
			}
			return false;
		}
		// Проверка пересечения мультиполигона с bounds
		out['intersects'] = function (chkBounds) {
			if(out['sx']) {
				return gmxAPI._leaflet['utils'].chkPointWithDelta(chkBounds, getPoint(), out);
			} else {
				for (var i = 0; i < members.length; i++)
				{
					if(members[i]['intersects'](chkBounds)) return true;
				}
			}
			return false;
		}
		// Квадрат растояния до мультиполигона
		out['distance2'] = function (chkPoint) {
			if(out['sx']) {
				var point = getPoint();
				var x = point.x - chkPoint.x,
					y = point.y - chkPoint.y;
				return x * x + y * y;
			}
			var d = Number.MAX_VALUE;
			for (var i = 0; i < members.length; i++)
			{
				var d1 = members[i]['distance2'](chkPoint);
				if(d1 < d) d = d1;
			}
			return d;
		}
		return out;
	};
})();

////////////////////////////

//Плагины для leaflet
(function()
{
	// Обработчик события - mapInit
	function onMapInit(ph) {
		var mapID = ph['objectId'];
		mapNodes[mapID] = {
			'type': 'map'
			,'handlers': {}
			,'children': []
			,'id': mapID
			,'group': gmxAPI._leaflet['LMap']
			,'parentId': false
		};
	}
	
	var utils = null;							// Утилиты leafletProxy
	var mapNodes = null;						// Хэш нод обьектов карты - аналог MapNodes.hx
	var leafLetCont_ = null;
	var mapDivID = '';
	var initFunc = null;
	var intervalID = 0;
	
	// Инициализация LeafLet карты
	function waitMe(e)
	{
		if('L' in window) {
			clearInterval(intervalID);
			if(!utils) utils = gmxAPI._leaflet['utils'];
			if(!mapNodes) {
				mapNodes = gmxAPI._leaflet['mapNodes'];
				gmxAPI._cmdProxy = gmxAPI._leaflet['cmdProxy'];			// Установка прокси для leaflet
			}

			/*
			 * L.Handler.DoubleClickZoom is used internally by L.Map to add double-click zooming.
			 */

			gmxAPI.isMobile = (L.Browser.mobile ? true : false);

			L.Map.mergeOptions({
				doubleClickZoomGMX: true
			});

			L.Map.DoubleClickZoomGMX = L.Handler.extend({
				addHooks: function () {
					this._map.on('dblclick', this._onDoubleClick);
				},

				removeHooks: function () {
					this._map.off('dblclick', this._onDoubleClick);
				},

				_onDoubleClick: function (e) {
					if(clickDone) return;
					this.setView(e.latlng, this._zoom + 1);
				}
			});

			L.Map.addInitHook('addHandler', 'doubleClickZoomGMX', L.Map.DoubleClickZoomGMX);
			//window.LMap = new L.Map(leafLetCont_,
			var LMap = new L.Map(leafLetCont_,
				{
				    center: [55.7574, 37.5952]
					,zoom: 5
					,zoomControl: false
					,doubleClickZoom: false
					,doubleClickZoomGMX: true
					,attributionControl: false
					,trackResize: true
					//,zoomAnimation: false
					//,fadeAnimation: false
					//,boxZoom: false
					//,zoomAnimation: (gmxAPI.isChrome ? false : true)
					//,worldCopyJump: false
					
					//,inertia: false
					//,keyboard: false
					//,markerZoomAnimation: true
					//,dragging: false
					,crs: L.CRS.EPSG3395
					//,'crs': L.CRS.EPSG3857 // L.CRS.EPSG4326 // L.CRS.EPSG3395 L.CRS.EPSG3857
				}
			);
			gmxAPI._leaflet['LMap'] = LMap;			// Внешняя ссылка на карту

			LMap.on('mouseout', function(e) {
				var propsBalloon = (gmxAPI.map.balloonClassObject ? gmxAPI.map.balloonClassObject.propsBalloon : null);
				if(propsBalloon) propsBalloon.setVisible(false);
				gmxAPI._leaflet['isMouseOut'] = true;			// мышь покинула карту
			});
			LMap.on('movestart', function(e) {					// старт анимации
				gmxAPI._leaflet['moveInProgress'] = true;
			});
			LMap.on('moveend', function(e) {
				gmxAPI._leaflet['moveInProgress'] = false;
				if(gmxAPI.map.needMove) return;
				//if(LMap._size) prevSize = {'x': LMap._size.x, 'y': LMap._size.y};
				gmxAPI._listeners.dispatchEvent('onMoveEnd', gmxAPI.map, {'obj': gmxAPI.map, 'attr': gmxAPI.currPosition });
				//gmxAPI._leaflet['utils'].chkMapObjectsView();
				utils.waitChkIdle(500, 'moveend');					// Проверка отрисовки карты
			});
			LMap.on('move', function(e) {
				var currPosition = utils.getMapPosition();
				if(!currPosition) return;
				var attr = {
					'currPosition': currPosition
				};
				gmxAPI._updatePosition(e, attr);
				if(setCenterPoint) setCenterPoint();
				if(gmxAPI.map.handlers['onMove']) {
					var mapID = gmxAPI.map['objectId'];
					var node = mapNodes[mapID];
					if(node['handlers']['onMove']) node['handlers']['onMove'](mapID, gmxAPI.map.properties, attr);
				}
			
				if(currPosition.latlng && Math.abs(currPosition.latlng.x) > 720) {
					var xx = currPosition.latlng.x % 360;
					//utils.runMoveTo({'x': xx, 'y': currPosition.latlng.y, 'z': currPosition.z});
					LMap.setView(new L.LatLng(currPosition.latlng.y, xx), currPosition.z, true);
				}
			
			});
			var parseEvent = function(e) {		// Парсинг события мыши
				if(!e.originalEvent || gmxAPI._mouseOnBalloon) return null;
				var target = e.originalEvent.originalTarget || e.originalEvent.target;
				var out = {
					'latlng': e.latlng
					,'containerPoint': e.containerPoint
					//,'buttons': e.originalEvent.buttons || e.originalEvent.button
					//,'ctrlKey': e.originalEvent.ctrlKey
					//,'altKey': e.originalEvent.altKey
					//,'shiftKey': e.originalEvent.shiftKey
					//,'metaKey': e.originalEvent.metaKey
					,'e': e
				};
				utils.chkKeys(out, e.originalEvent);
				if(target && e.containerPoint) {
					try {
						//out['tID'] = target['id'];
						out['_layer'] = target['_layer'];
						out['tilePoint'] = target['tilePoint'];
						if(target['_leaflet_pos']) {
							out['pixelInTile'] = {
								'x': e.containerPoint.x - target['_leaflet_pos'].x
								,'y': e.containerPoint.y - target['_leaflet_pos'].y
							};
						}
					} catch(ev) {
						return null;
					}
				}
				return out;
				
			}

			var clickDone = false;
			var timeDown = 0;
			var chkClick = function(e) {		// Проверка click карты
				if(gmxAPI._leaflet['contextMenu']['isActive']) return;	// мышка над пунктом contextMenu
				var timeClick = new Date().getTime() - timeDown;
				if(timeClick > 1000) return;
				var attr = parseEvent(e);
				if(!attr) return;					// пропускаем при контекстном меню
				//if(utils.chkClassName(e.originalEvent.originalTarget, 'gmx_balloon', LMap._container)) return;	// click на балуне
				attr['evName'] = 'onClick';
				gmxAPI._leaflet['clickAttr'] = attr;
				clickDone = gmxAPI._leaflet['utils'].chkGlobalEvent(attr);
			};
			LMap.on('click', chkClick);
			LMap.on('mouseup', function(e) {
				gmxAPI._leaflet['utils'].unfreeze();
				var curTimeDown = new Date().getTime();
				var timeClick = curTimeDown - timeDown;
				if(!gmxAPI._drawing['activeState'] && timeClick < 200) { chkClick(e); timeDown = 0; }
				gmxAPI._leaflet['mousePressed'] = false;
				gmxAPI._listeners.dispatchEvent('onMouseUp', gmxAPI.map, {'attr':{'latlng':e.latlng}});
				//setTimeout(function() { skipClick = false;	}, 10);
			});
			var setMouseDown = function(e) {
				//console.log('setMouseDown ', gmxAPI._leaflet['activeObject']);
				gmxAPI._leaflet['mousePressed'] = true;
				timeDown = new Date().getTime();
/*				var standartTools = gmxAPI.map.standartTools;
				if(standartTools && standartTools['activeToolName'] != 'move'
					&& standartTools['activeToolName'] != 'FRAME'
					//&& standartTools['activeToolName'] != 'circle'
					) return;
*/			
				gmxAPI._leaflet['mousedown'] = true;
				var node = mapNodes[gmxAPI._leaflet['activeObject'] || gmxAPI.map['objectId']];
				if(node && node['dragMe']) {
					node['dragMe'](e);
					return;
				}
				var attr = parseEvent(e);
				if(!attr) return;				// пропускаем
				attr['evName'] = 'onMouseDown';
				gmxAPI._leaflet['mousedownAttr'] = attr;
				gmxAPI._leaflet['utils'].chkGlobalEvent(attr);
				//gmxAPI._listeners.dispatchEvent('onMouseDown', null, {});
			};
			LMap.on('mousedown', setMouseDown);
			var setTouchStart = function(e) {
				gmxAPI._leaflet['mousePressed'] = true;
				timeDown = new Date().getTime();

				var parseTouchEvent = function(e) {		// Парсинг события мыши
					var target = e.target;
					var out = {
						'latlng': e.latlng
						,'containerPoint': e.containerPoint
						,'buttons': e.buttons || e.button
						,'ctrlKey': e.ctrlKey
						,'altKey': e.altKey
						,'shiftKey': e.shiftKey
						,'metaKey': e.metaKey
						,'e': e
					};
					if(target) {
						out['_layer'] = target['_layer'];
						out['latlng'] = target['_layer']._map.mouseEventToLatLng(e);
						out['tID'] = target['id'];
						out['tilePoint'] = target['tilePoint'];
					}
//console.log(e.containerPoint);
					return out;
				}
				var attr = parseTouchEvent(e);
				attr['evName'] = 'onClick';
				gmxAPI._leaflet['clickAttr'] = attr;
				gmxAPI._leaflet['utils'].chkGlobalEvent(attr);

//var st = e.target.style['-webkit-transform'];
//var st = '';
//for (var key in attr['_layer']._map) { if(typeof(attr['_layer']._map[key]) == 'function') st += "\n " + key + ': '; }
//for (var key in e.target.style) { st += key + ': ' + e.target.style[key]; }
//alert(st);
//alert(JSON.stringify(out));
			};
			//if(L.Browser.touch) L.DomEvent.on(LMap._container, 'touchstart', setTouchStart, this);
/*
			L.DomEvent.on(LMap._container, 'step', function(e) {
console.log('Transition', e);
var tt = 1;
			}, this);
*/
			var onMouseMoveTimer = null;
			LMap.on('mousemove', function(e) {
				gmxAPI._leaflet['isMouseOut'] = false;			// мышь на карте
				if(LMap._pathRoot && !gmxAPI.isIE) {
					if(!LMap._pathRoot.style.pointerEvents) {
						LMap._pathRoot.style.pointerEvents = 'none';
					}
				}
//return;
				if(gmxAPI._mouseOnBalloon) {
					if(LMap.scrollWheelZoom.enabled()) LMap.scrollWheelZoom.disable();
					return null;
				} else {
					if(!LMap.scrollWheelZoom.enabled()) LMap.scrollWheelZoom.enable();
				}
				if(gmxAPI._leaflet['mousedown']) timeDown -= 900;
				gmxAPI._leaflet['mousePos'] = e.latlng;
				var attr = parseEvent(e);
				if(!attr) return;				// пропускаем
				attr['evName'] = 'onMouseMove';
				gmxAPI._leaflet['mouseMoveAttr'] = attr;
				if(gmxAPI._drawing['activeState']) {
					gmxAPI._listeners.dispatchEvent('onMouseMove', gmxAPI.map, {'attr':attr});
				} else {
					if(onMouseMoveTimer) clearTimeout(onMouseMoveTimer);
					onMouseMoveTimer = setTimeout(function() {
						onMouseMoveTimer = null;
						//if(gmxAPI._mouseOnBalloon) return null;
						var from = gmxAPI.map.layers.length - 1;
						for (var i = from; i >= 0; i--)
						{
							var child = gmxAPI.map.layers[i];
							if(!child.isVisible) continue;
							var mapNode = mapNodes[child.objectId];
							if(mapNode['mouseMoveCheck']) {
								if(mapNode['mouseMoveCheck']('onMouseMove', {'attr':attr})) return true;
							}
						}
						gmxAPI._listeners.dispatchEvent('onMouseMove', gmxAPI.map, {'attr':attr});
					}, 10);
				}
				if(!gmxAPI._leaflet['mousePressed']) {
					gmxAPI._leaflet['utils'].chkMouseHover(attr)
				}
			});

			LMap.on('zoomstart', function(e) {
				gmxAPI._leaflet['zoomCurrent'] = null;
				gmxAPI._leaflet['zoomstart'] = true;
				gmxAPI._listeners.dispatchEvent('onZoomstart', null, {});
				gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Проверка map Listeners на hideBalloons
			});
			LMap.on('zoomend', function(e) {
				gmxAPI._leaflet['zoomstart'] = false;
				gmxAPI._leaflet['utils'].chkZoomCurrent();
				gmxAPI._listeners.dispatchEvent('onZoomend', null, {});
				gmxAPI._listeners.dispatchEvent('showBalloons', gmxAPI.map, {});	// Проверка map Listeners на showBalloons
				gmxAPI._leaflet['utils'].chkMapObjectsView();
			});
			LMap.on('contextmenu', function(e) {
				var attr = parseEvent(e);
				gmxAPI._leaflet['contextMenu']['showMenu']({'obj':gmxAPI.map, 'attr': attr});	// Показать меню
			});

			// Обработчик события - mapInit
			gmxAPI._listeners.addListener({'level': -10, 'eventName': 'mapInit', 'func': onMapInit});

			L.GMXIcon = L.Icon.extend({
				options: {
					iconSize: new L.Point(12, 12) // also can be set through CSS
					/*
					iconAnchor: (Point)
					popupAnchor: (Point)
					html: (String)
					bgPos: (Point)
					,divStyle: {}
					*/
					,className: 'leaflet-canvas-icon'
				},

				createIcon: function () {
					var	options = this.options;
					var div = document.createElement('div');
					this.options.div = div;

					if (options.html) {
						div.innerHTML = options.html;
					}

					if (options.bgPos) {
						div.style.backgroundPosition =
								(-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
					}

					this._setIconStyles(div, 'icon');
					if (options.divStyle) {
						gmxAPI.setStyleHTML(div, options.divStyle, false);
					}
					return div;
				},
				createShadow: function () {
					return null;
				}
				,
				setStyle: function (style, setBorder) {
					if (this.options.div) {
						gmxAPI.setStyleHTML(this.options.div, style, setBorder);
						this.options.divStyle = style;
					}
				}
			});
			L.gmxIcon = function (options) {
				return new L.GMXIcon(options);
			};

			L.CanvasIcon = L.Icon.extend({
				options: {
					iconSize: new L.Point(12, 12) // also can be set through CSS
					//shadowSize: new L.Point(1, 1),
					//iconAnchor: new L.Point(12, 12), // also can be set through CSS
					,className: 'leaflet-canvas-icon'
				},

				createIcon: function () {
					var canvas = document.createElement('canvas');
					gmxAPI.setStyleHTML(canvas, {'position': 'absolute'}, false);
					var options = this.options;
					if(options.drawMe) options.drawMe(canvas);
					//this._setIconStyles(canvas, 'icon');
					return canvas;
				},

				createShadow: function () {
					return null;
				}
			});
			L.canvasIcon = function (options) {
				return new L.CanvasIcon(options);
			};
			
			L.RectangleIcon = L.Icon.extend({
				options: {
					iconSize: new L.Point(12, 12), // also can be set through CSS
					//iconAnchor: new L.Point(12, 12), // also can be set through CSS
					className: 'leaflet-canvas-icon'
				},
				createIcon: function () {
					var options = this.options;
					var res = L.rectangle(options.bounds, options)
					return res;
				},

				createShadow: function () {
					return null;
				}
			});
			L.rectangleIcon = function (options) {
				return new L.RectangleIcon(options);
			};
			
			L.RectangleMarker = L.Rectangle.extend({
				projectLatlngs: function () {
					var tt = this;
					L.Polyline.prototype.projectLatlngs.call(this);

					// project polygon holes points
					// TODO move this logic to Polyline to get rid of duplication
					this._holePoints = [];

					if (!this._holes) {
						return;
					}

					for (var i = 0, len = this._holes.length, hole; i < len; i++) {
						this._holePoints[i] = [];

						for (var j = 0, len2 = this._holes[i].length; j < len2; j++) {
							this._holePoints[i][j] = this._map.latLngToLayerPoint(this._holes[i][j]);
						}
					}

					var tt = this;
				}
			/*	
				,
				projectLatlngs: function () {
					this._originalPoints = [];

					for (var i = 0, len = this._latlngs.length; i < len; i++) {
						this._originalPoints[i] = this._map.latLngToLayerPoint(this._latlngs[i]);
					}
				}
			*/	
				,
				_boundsToLatLngs: function (latLngBounds) {
					var p1 = latLngBounds.getSouthWest();
					var p1 = latLngBounds.getSouthWest();
					return [
						latLngBounds.getSouthWest(),
						latLngBounds.getNorthWest(),
						latLngBounds.getNorthEast(),
						latLngBounds.getSouthEast(),
						latLngBounds.getSouthWest()
					];
				}
			});

			L.GMXMarker = L.Marker.extend({
				_initIcon: function () {
					var options = this.options,
						map = this._map,
						animation = (map.options.zoomAnimation && map.options.markerZoomAnimation),
						classToAdd = animation ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide',
						needOpacityUpdate = false;

					if (!this._icon) {
						this._icon = options.icon.createIcon();

						if (options.title) {
							this._icon.title = options.title;
						}

						this._initInteraction();
						needOpacityUpdate = (this.options.opacity < 1);

						L.DomUtil.addClass(this._icon, classToAdd);

						if (options.riseOnHover) {
							L.DomEvent
								.on(this._icon, 'mouseover', this._bringToFront, this)
								.on(this._icon, 'mouseout', this._resetZIndex, this);
						}
					}

					if (!this._shadow) {
						this._shadow = options.icon.createShadow();

						if (this._shadow) {
							L.DomUtil.addClass(this._shadow, classToAdd);
							needOpacityUpdate = (this.options.opacity < 1);
						}
					}

					if (needOpacityUpdate) {
						this._updateOpacity();
					}

					var panes = this._map._panes;

					var toPaneName = options.toPaneName || 'markerPane';			// Added by OriginalSin
					panes[toPaneName].appendChild(this._icon);
					//panes.markerPane.appendChild(this._icon);

					if (this._shadow) {
						panes.shadowPane.appendChild(this._shadow);
					}
				}
				,
				_removeIcon: function () {
					var panes = this._map._panes;

					if (this.options.riseOnHover) {
						L.DomEvent
							.off(this._icon, 'mouseover', this._bringToFront)
							.off(this._icon, 'mouseout', this._resetZIndex);
					}

					if(this._icon && this._icon.parentNode) this._icon.parentNode.removeChild(this._icon);	// Added by OriginalSin
					//panes.markerPane.removeChild(this._icon);

					if (this._shadow) {
						panes.shadowPane.removeChild(this._shadow);
					}

					this._icon = this._shadow = null;
				}
				,
				update: function () {
					L.Marker.prototype.update.call(this);
					if (this._icon) {
						var options = this.options;
						if(options['rotate']) {
							this._icon.style[L.DomUtil.TRANSFORM] += ' rotate('+options['rotate']+'deg)';
						}
						this._icon.style.pointerEvents = (options['_isHandlers'] ? '' : 'none');
					}
					return this;
				}
				,
				_setPos: function (pos) {
					L.DomUtil.setPosition(this._icon, pos);

					if (this._shadow) {
						L.DomUtil.setPosition(this._shadow, pos);
					}
					//this._zIndex = pos.y + this.options.zIndexOffset;
					//this._resetZIndex();
				}

			});

			L.GMXPointsMarkers = L.Polyline.extend({
				_getPathPartStr: function (points) {
					var round = L.Path.VML;
					var pointSize = this.options.pointSize || 5;
					var weight = (this.options.shiftWeight ? this.options.weight || 1 : 0);

					for (var j = 0, len2 = points.length - (this.options.skipLastPoint ? 1 : 0), str = '', p; j < len2; j++) {
						p = points[j];
						if (round) {
							p._round();
						}
						var px = p.x - 0;
						var px1 = px - pointSize;
						var px2 = px + pointSize;
						var py = p.y + weight;
						var py1 = py - pointSize;
						var py2 = py + pointSize;
						str += 'M' + px1 + ' ' + py1 + 'L' + px2 + ' ' + py1 + 'L' + px2 + ' ' + py2 + 'L' + px1 + ' ' + py2 + 'L' + px1 + ' ' + py1;
						}
					return str;
				}
				,
				_updatePath: function () {
					if (!this._map) { return; }

					this._clipPoints();
					if(!this.options.skipSimplifyPoint) this._simplifyPoints();

					L.Path.prototype._updatePath.call(this);
				}
			});

			L.GMXgrid = L.Polyline.extend({
				_getPathPartStr: function (points) {
					var round = L.Path.VML;
					if(this._containerText) this._container.removeChild(this._containerText);
					this._containerText = this._createElement('g');
					this._containerText.setAttribute("stroke-width", 0);

					var color = this._path.getAttribute("stroke");
					this._containerText.setAttribute("stroke", color);
					this._containerText.setAttribute("fill", color);
					this._containerText.setAttribute("opacity", 1);
					this._container.appendChild(this._containerText);

					for (var j = 0, len2 = points.length, str = '', p, p1; j < len2; j+=2) {
						p = points[j];
						p1 = points[j+1];
						if (round) {
							p._round();
							p1._round();
						}
						str += 'M' + p.x + ' ' + p.y;
						str += 'L' + p1.x + ' ' + p1.y;
						if(this.options.textMarkers && this.options.textMarkers[j]) {
							var text = this._createElement('text');
							text.textContent = this.options.textMarkers[j];
							var dx = 0;
							var dy = 3;
							if(p.y == p1.y) dx = 20;
							if(p.x == p1.x) {
								text.setAttribute("text-anchor", "middle");
								dy = 20;
							}
							text.setAttribute('x', p.x + dx);
							text.setAttribute('y', p.y + dy);
							this._containerText.appendChild(text);
						}
					}
					return str;
				}
				,
				_updatePath: function () {
					if (!this._map) { return; }
					this._clipPoints();
					L.Path.prototype._updatePath.call(this);
				}
			});

			L.GMXLabels = L.Polyline.extend({
				_getPathPartStr: function (points) {
					var round = L.Path.VML;
					if(this._containerText) this._container.removeChild(this._containerText);
					this._containerText = this._createElement('g');
					this._containerText.setAttribute("stroke", this._path.getAttribute("stroke"));
					this._containerText.setAttribute("stroke-width", 0);
					if(this.options.color) this._containerText.setAttribute("fill", this.options.color);

					var opacity = this.options.opacity;
					this._containerText.setAttribute("opacity", opacity);
					this._container.appendChild(this._containerText);
					this._containerText.style.pointerEvents = 'none';
					this._container.style.pointerEvents = 'none';

					for (var j = 0, len2 = points.length, str = '', p, p1; j < len2; j++) {
						p = points[j];
						if(this.options.textMarkers && this.options.textMarkers[j]) {
							var text = this._createElement('text');
							text.textContent = this.options.textMarkers[j];
							//text.setAttribute("class", "leaflet-clickable");
							var dx = -1;
							var dy = 3;
							var align = this.options['align'] || 'right';
							if(align === 'center') {
								text.setAttribute("text-anchor", "middle");
							} else if(align === 'left') {
								text.setAttribute("text-anchor", "left");
							} else if(align === 'right') {
								text.setAttribute("text-anchor", "right");
							} else { //if(this.options['right'] === 'right') {
								text.setAttribute("text-anchor", "right");
								dx = 10;
							}
							text.setAttribute('x', p.x + dx);
							text.setAttribute('y', p.y + dy);
							this._containerText.appendChild(text);
						}
					}
					return str;
				}
				,
				_updatePath: function () {
					if (!this._map) { return; }
					this._clipPoints();
					L.Path.prototype._updatePath.call(this);
				}
			});

			L.GMXImageOverlay = L.ImageOverlay.extend({
				_reset: function () {
					var image   = this._image,
						topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
						size = this._map.latLngToLayerPoint(this._bounds.getSouthEast())._subtract(topLeft);
//console.log('sdsdsdddsssss ' , topLeft);
					L.DomUtil.setPosition(image, topLeft);

					image.style.width  = size.x + 'px';
					image.style.height = size.y + 'px';
				}
			});
			
			initFunc(mapDivID, 'leaflet');
			
			var centerControlDIV = gmxAPI.newStyledDiv({ position: "absolute", top: '-6px', left: '-6px', opacity: 0.8, 'pointerEvents': 'none' });
			var div = document.getElementById(mapDivID);
			div.parentNode.appendChild(centerControlDIV);
			var setCenterPoint = function ()
			{
					var vBounds = LMap.getPixelBounds();
					var y = (vBounds.max.y - vBounds.min.y)/2;
					var x = (vBounds.max.x - vBounds.min.x)/2;
					centerControlDIV.style.top = (y - 6) + 'px';
					centerControlDIV.style.left = (x - 6) + 'px';
			};
			var setControlDIVInnerHTML = function ()
			{
				var baseLayersTools = gmxAPI.map.baseLayersTools;
				var currTool = baseLayersTools.getToolByName(baseLayersTools.activeToolName);
				div.style.backgroundColor = utils.dec2hex(currTool.backgroundColor);
				var color = (currTool.backgroundColor === 1 ? 'white' : '#216b9c');
				centerControlDIV.innerHTML = '<svg viewBox="0 0 12 12" height="12" width="12" style=""><g><path d="M6 0L6 12" stroke-width="1" stroke-opacity="1" stroke="' + color + '"></path></g><g><path d="M0 6L12 6" stroke-width="1" stroke-opacity="1" stroke="' + color + '"></path></g></svg>';
				return false;
			};
			setTimeout(setControlDIVInnerHTML, 1);
			setTimeout(setCenterPoint, 1);
			gmxAPI.map.addListener('baseLayerSelected', setControlDIVInnerHTML, 100);
			if(gmxAPI.map.needMove) {
				utils.runMoveTo();
			}
			if(gmxAPI.map.needSetMode) {
				gmxAPI.map.setMode(gmxAPI.map.needSetMode);
				gmxAPI.map.needSetMode = null;
			}
			if(gmxAPI.map.standartTools && gmxAPI.isMobile) {
				gmxAPI.map.standartTools.remove();
			}
			//gmxAPI.map.standartTools.setVisible(false);
		}
	}

	// Загрузка leaflet.js
	function addLeafLetScripts()
	{
		var apiHost = gmxAPI.getAPIFolderRoot();

		var script = document.createElement("script");
		script.setAttribute("charset", "windows-1251");
		script.setAttribute("src", apiHost + "leaflet/leaflet.js?" + gmxAPI.buildGUID);
		document.getElementsByTagName("head").item(0).appendChild(script);

		var css = document.createElement("link");
		css.setAttribute("type", "text/css");
		css.setAttribute("rel", "stylesheet");
		css.setAttribute("media", "screen");
		css.setAttribute("href", apiHost + "leaflet/leaflet.css?" + gmxAPI.buildGUID);
		document.getElementsByTagName("head").item(0).appendChild(css);
		
		css = document.createElement("link");
		css.setAttribute("type", "text/css");
		css.setAttribute("rel", "stylesheet");
		css.setAttribute("media", "screen");
		css.setAttribute("href", apiHost + "leaflet/leafletGMX.css?" + gmxAPI.buildGUID);
		document.getElementsByTagName("head").item(0).appendChild(css);
		
		if(gmxAPI.isIE) {
			css = document.createElement("link");
			css.setAttribute("type", "text/css");
			css.setAttribute("rel", "stylesheet");
			css.setAttribute("media", "screen");
			css.setAttribute("href", apiHost + "leaflet/leaflet.ie.css?" + gmxAPI.buildGUID);
			document.getElementsByTagName("head").item(0).appendChild(css);
		}
	}

	// Добавить leaflet в DOM
	function addLeafLetObject(apiBase, flashId, ww, hh, v, bg, loadCallback, FlagFlashLSO)
	{
		mapDivID = flashId;
		initFunc = loadCallback;

		leafLetCont_ = gmxAPI.newElement(
			"div",
			{
				id: mapDivID
			},
			{
				width: "100%",
				height: "100%",
				zIndex: 0,
				border: 0
			}
		);
		window.leafletLoaded = waitMe;
		addLeafLetScripts();
		//intervalID = setInterval(waitMe, 50);
		//gmxAPI._leaflet['LMapContainer'] = leafLetCont_;				// Контейнер лефлет карты

		return leafLetCont_;
	}
	
	//расширяем namespace
	var canvas = document.createElement('canvas');
	canvas.width = canvas.height = 512;
	if('getContext' in canvas) {
		gmxAPI._leaflet['labelCanvas'] = canvas;		// для расчета размеров label
		gmxAPI._addProxyObject = addLeafLetObject;		// Добавить в DOM
	} else {
		var str = '<br>Ваш браузер не поддерживает Canvas. Обновите версию браузера или установите новый. Рекомендуемые браузеры: ';
		var href = 'http://windows.microsoft.com/ru-RU/internet-explorer/download-ie';
		str += '<a href="'+href+'" target="_blank">IE9-10</a>';
		href = 'http://www.google.com/chrome'; str += ', <a href="'+href+'" target="_blank">Chrome</a>';
		href = 'http://www.opera.com/browser/'; str += ', <a href="'+href+'" target="_blank">Opera 12.x</a>';
		href = 'http://www.mozilla.org/en-US/'; str += ', <a href="'+href+'" target="_blank">Mozilla Firefox</a>';
		href = 'http://support.apple.com/kb/DL1531'; str += ', <a href="'+href+'" target="_blank">Safari</a>';
		href = 'http://browser.yandex.ru'; str += ', <a href="'+href+'" target="_blank">Yandex</a>';
		var res = gmxAPI.newElement(
			"div",
			{
				id: 'warning'
				,innerHTML: str
			});
		
		gmxAPI._addProxyObject = function() { return res; };		// Нет поддержки canvas
	}
	
	gmxAPI.proxyType = 'leaflet';
    gmxAPI.APILoaded = true;					// Флаг возможности использования gmxAPI сторонними модулями
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['lastDrawTime'] = null;			// карта находится в процессе отрисовки
	gmxAPI._leaflet['zoomCurrent'] = null;			// параметры от текущего zoom
	gmxAPI._leaflet['lastZoom'] = -1;				// zoom нарисованный
	gmxAPI._leaflet['mInPixel'] = 0;				// текущее кол.метров в 1px
	gmxAPI._leaflet['waitSetImage'] = 0;			// текущее число загружаемых SetImage
	gmxAPI._leaflet['curDragState'] = false;		// текущий режим dragging карты
	gmxAPI._leaflet['mousePressed'] = false;		// признак нажатой мыши
	gmxAPI._leaflet['mouseMoveAttr'] = null;		// атрибуты mouseOver
	gmxAPI._leaflet['activeObject'] = null;			// Нода последнего mouseOver

	gmxAPI._leaflet['renderingObjects'] = {};		// Список объектов находящихся в Rendering режиме
	gmxAPI._leaflet['onRenderingStart'] = function(id)
	{
		//if(!lObj || !lObj.layer) return false;
		//var id = lObj.layer._leaflet_id;
		gmxAPI._leaflet['renderingObjects'][id] = gmxAPI._leaflet['renderingObjects'][id] || 0;
        gmxAPI._leaflet['renderingObjects'][id] += 1;
	};
	gmxAPI._leaflet['onRenderingEnd'] = function(id, flag)
	{
		//if(!lObj || !lObj.layer) return false;
		//var id = lObj.layer._leaflet_id;
        
        if (id in gmxAPI._leaflet['renderingObjects']) {
            gmxAPI._leaflet['renderingObjects'][id] -= 1;
            if (gmxAPI._leaflet['renderingObjects'][id] === 0) {
                delete gmxAPI._leaflet['renderingObjects'][id];
            }
        }
        
		if(!flag) gmxAPI._leaflet['utils'].chkIdle(true, 'onRenderingEnd: ' + id);					// Проверка отрисовки карты
	};
})();
;