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
		timer = setTimeout(repaint, 20);
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
