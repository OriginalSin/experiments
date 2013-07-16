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
					if(!geom.propHiden['_isFilters']) node['chkObjectFilters'](geom);
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
					//pt.propHiden.curStyle = attr.regularStyle;
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
						//pt.propHiden.curStyle = attr.regularStyle;
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
					var style = utils.evalStyle(attr.regularStyle, geo.properties);
					geo.propHiden['curStyle'] = style;
					geo['chkSize'](node, style);

					if(!item['_cache'] || !item['_cache']['extentLabel']) {
						//var style = item.propHiden.curStyle;
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
		,'viewClusterItem': function(item)	{			// Показать содержимое кластера
			var geom = item['geom'];					// геометрия кластера
			var node = item.attr['node'];				// лефлет нода слоя
			
			var point = geom.coordinates;
			var center = [gmxAPI.from_merc_y(point.y), gmxAPI.from_merc_x(point.x)];
			var members = geom.propHiden._members;
			
			var vattr = node.clustersData.input.clusterView;
			var rad = vattr.radius;
			var rad2 = rad * rad;
			var pr = 5;
			var pr2 = pr * pr;
			var rad1 = rad - pr - 5;
			var deltaAlpha = 2*Math.PI/members.length;
			var points = [];
			for(var i=0, len = members.length; i<len; i++) {	// Подготовка геометрий
 				var idelta = i * deltaAlpha;
				var coord = [Math.floor(rad1 * Math.cos(idelta)), Math.floor(rad1 * Math.sin(idelta))];
				points.push(coord);
			}
			var opt = {
				clickable: true
				,'radius': pr
				,'points': points
				,'fillOpacity': 0.8
			};
			var onMouseOut = function() {
				if(itemBalloon) node['itemBalloon'](itemBalloon, {'evName':'onMouseOut', 'objType':'cluster'});
				itemBalloon = null;
			}
			var chkRemove = function() {
				if(node['GMXClusterPoints']) {
					LMap.removeLayer(node['GMXClusterPoints']);
					node['GMXClusterPoints'] = null;
					gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Скрыть балуны
				}
				onMouseOut();
			}
			chkRemove();
			LMap.on('zoomstart', function(e) {
				chkRemove();
			});
			var GMXClusterPoints = new L.FeatureGroup([]);
			var bgItem = new L.CircleMarker(center, {'radius': rad,'fillColor': 'red','opacity': 0,'fillOpacity': 0.2, clickable: true});
			GMXClusterPoints.addLayer(bgItem);
			var GMXClusterLines = new L.GMXClusterLines(center, {'points': points, 'radius': rad, 'dashArray': '3,3','color': 'red','opacity': 1, clickable: false});
			GMXClusterPoints.addLayer(GMXClusterLines);
			
			var items = new L.GMXClusterPoints(center, opt);
			GMXClusterPoints.addLayer(items);
			
			node['GMXClusterPoints'] = GMXClusterPoints;
			LMap.addLayer(GMXClusterPoints);

			var itemBalloon = null;
			bgItem.on('mouseout', function(e) {
				var p1 = e.layerPoint;
				var p2 = e.layer._point;
				var dx = (p1.x - p2.x);
				var dy = (p1.y - p2.y);
				var delta = dx * dx + dy * dy;
				if(delta > rad2) {
					chkRemove();
					//gmxAPI._listeners.dispatchEvent('hideBalloons', gmxAPI.map, {});	// Скрыть балуны
					itemBalloon = null;
				}
			});
			GMXClusterPoints.on('mousemove', function(e) {
				var p1 = e.layerPoint;
				var p2 = e.layer._point;
				var p3 = [p1.x - p2.x, p1.y - p2.y];
				var cursor = 'default';
				for(var i=0, len = points.length; i<len; i++) {
					var p4 = points[i];
					var dx = (p3[0] - p4[0]);
					var dy = (p3[1] - p4[1]);
					var delta = dx * dx + dy * dy;
					if(delta < pr2) {
						cursor = 'pointer';
						if(!itemBalloon) chkBalloon(p1, p2, 'onMouseOver');
						itemBalloon = members[i];
						break;
					}
				}
				var cont = e.layer._path;
				if(cursor != cont.style.cursor) cont.style.cursor = cursor;
			});
			var chkBalloon = function(p1, p2, evName) {
				var p3 = [p1.x - p2.x, p1.y - p2.y];
				if(!evName) evName = 'onMouseOver';
				for(var i=0, len = points.length; i<len; i++) {
					var p4 = points[i];
					var dx = (p3[0] - p4[0]);
					var dy = (p3[1] - p4[1]);
					var delta = dx * dx + dy * dy;
					if(delta < pr2) {
						itemBalloon = members[i];
						node['itemBalloon'](itemBalloon, {'evName':evName, 'objType':'cluster', 'dx': p3[0], 'dy': p3[1]});
						break;
					}
				}
			};

			items.on('mouseout', function(e) {
				onMouseOut();
			});
			items.on('click', function(e) {
				var p1 = e.layerPoint;
				var p2 = e.layer._point;
				chkBalloon(p1, p2, 'onClick');
			});
			//console.log('setClustersLayer ', item);
		}
		,'setClusters': function(ph, id)	{			// Добавить кластеризацию к векторному слою
			//console.log('setClustersLayer ', id , ph);
			if(!mapNodes) init()						// инициализация
			var node = mapNodes[id];					// лефлет нода слоя
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
				,'clusterView': function(item) {
					var clusterView = out['input']['clusterView'];
					var propHiden = item.geom.propHiden;
					
					if(propHiden['_members'].length < clusterView['maxMembers']) {
						ClustersLeaflet.viewClusterItem(item);
						return true;
					}
					return false;
				}

			};
			if(ph.iterationCount) out['iterationCount'] = ph.iterationCount;	// количество итераций K-means
			if(ph.radius) out['radius'] = ph.radius;							// радиус кластеризации в пикселах
			
			gmxAPI._listeners.addListener({'level': 11, 'eventName': 'onIconLoaded', 'func': function(eID) {	// проверка загрузки иконок
				if(eID.indexOf('_clusters')) {
					if(eID == layerID + '_regularStyle_clusters') {
						out.regularStyle['iconLoaded'] = true;
					} else if(eID == layerID + '_hoveredStyle_clusters') {
						out.hoveredStyle['iconLoaded'] = true;
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
