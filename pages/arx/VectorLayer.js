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
			node.checkFilters(10);			
			/*
			reCheckFilters();
			//upDateLayer();
			node.redrawTilesList(40);
			*/
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
		node['getMaxTilesList'] = function (extent) {					// Получить максимальный список тайлов
			var out = [];
			if(gmxNode._temporalTiles) {
				var temporalTiles = gmxNode._temporalTiles;
				var pt = temporalTiles.getDateIntervalTiles(new Date('01/01/1980'), new Date(), temporalTiles.temporalData);
				for (var i = 0, len = pt['dtiles'].length; i < len; i+=3) {
					var x = pt['dtiles'][i], y = pt['dtiles'][i+1], z = pt['dtiles'][i+2];
					if(extent) {
						var ext = gmxAPI.getTileExtent(x, y, z);
						if(!gmxAPI.extIntersect(ext, extent)) continue;
					}
					if(pt['tiles'][z][x][y]) {
						for (var j = 0, len1 = pt['tiles'][z][x][y].length; j < len1; j++) out.push(pt['tiles'][z][x][y][j]);
					}
				}
			} else {
				var arr = gmxNode.properties.tiles;
				var tilesVers = gmxNode.properties.tilesVers;
				var cnt = 0;
				for (var i = 0, len = arr.length; i < len; i+=3) {
					var x = Number(arr[i]), y = Number(arr[i][i+1]), z = Number(arr[i][i+2]);
					if(extent) {
						var ext = gmxAPI.getTileExtent(x, y, z);
						if(!gmxAPI.extIntersect(ext, extent)) continue;
					}
					var st = option.tileFunc(x, y, z);
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
			var resOut = function (pt) {				// Получить Feature обьектов векторного слоя
				var ret = [];
				for (var id in pt) {
					var item = pt[id];
					if(extent) {
						var itemExtent = gmxAPI.getBounds(item.geometry.coordinates);
						if(!gmxAPI.extIntersect(itemExtent, extent)) continue;
					}
					ret.push(new gmxAPI._FlashMapFeature(gmxAPI.from_merc_geometry(item.geometry), item.properties, gmxNode));
				}
				pt = null;
				attr.func(ret);
			}
			
			var currTiles = {};
			var resTiles = {};
			var chkResTiles = function () {				// Парсинг тайлов векторного слоя
				gmxNode.removeListener('onChangeLayerVersion', onChangeLayerID);
				var pt = {};
				for (var src in resTiles) {
					var arr = resTiles[src];
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
				}
				resOut(pt);
			}
			var cnt = 0;
			var addTileToLoad = function (src) {	//	Добавить тайл на загрузку
				currTiles[src] = true;
				node['loadTiles']([src], {
					'callback': function (data, psrc) {
						cnt--;
						resTiles[psrc] = data;
						if(cnt < 1) chkResTiles();
					}
					,
					'onerror': function (err) {
						cnt--;
						var psrc = err['url'];		// необходимо перепроверить версии тайлов
						//console.log('getFeatures - onerror: ', psrc);
						//chkVerTiles(psrc);
					}
				});
			}
			var chkVerTiles = function () {				// Проверка списка тайлов для загрузки
				var arrSrc = node['getMaxTilesList'](extent);
				for (var i = 0, len = arrSrc.length; i < len; cnt++, i++) {
					var src = arrSrc[i];
					if(currTiles[src]) {
						continue;
					}
					addTileToLoad(src);
					//console.log('getFeatures - chkVerTiles: ', src);
				}
			}
			var onChangeLayerID = gmxNode.addListener('onChangeLayerVersion', function (arg) {
				chkVerTiles();
				//console.log('getFeatures - onChangeLayerVersion: ', arg);
			}, 100000);
			chkVerTiles();
		}
		node['loadTiles'] = function (arr, attr) {				// Загрузка списка тайлов
			var item = {
				'srcArr': arr
				,'layer': node.id
				,'callback': attr['callback']
				,'onerror': function(err){						// ошибка при загрузке тайла
					attr['onerror'](err);
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
				node.reloadTilesList(0);
				return true;
			}

			var currZ = LMap.getZoom();
			if(currZ < node['minZ'] || currZ > node['maxZ'])  return true;				// Неподходящий zoom

			if(!zoom) zoom = currZ;

			var flag = node['loadTilesByExtent'](null, tilePoint);
			if(!flag) {
				var attr = getTileAttr(tilePoint, zoom);
				node.addTilesNeedRepaint(attr.drawTileID);
				node.repaintTilesNeed(10);
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
							node.repaintTilesNeed(10);
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
			var gmxAttr = {};
			if(propHiden['subType'] != 'cluster') {
				if(filter) {
					hoveredStyle = (filter.hoveredStyle ? filter.hoveredStyle : null);
					regularStyle = (filter.regularStyle ? filter.regularStyle : null);
				}
			} else {
				//hoveredStyle = node['clustersData']['hoveredStyle'];
				regularStyle = node['clustersData']['regularStyle'];
				hoveredStyle = regularStyle;
				gmxAttr['objType'] = 'cluster';
				var fID = propHiden['toFilters'][0];
				var gmxFilter = gmxAPI.mapNodes[fID];
				if(gmxFilter) gmxAttr['textFunc'] = gmxFilter.clusters.getTextFunc();
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
					if(filter && callHandler('onMouseOver', item.geom, filter, gmxAttr)) return true;
					if(callHandler('onMouseOver', item.geom, gmxNode, gmxAttr)) return true;
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
					gmxAttr['members'] = itemPropHiden['_members'];
					if(node['clustersData']['clusterView'](item)) return true;
					if(callHandler('onClick', item.geom, gmxNode, gmxAttr)) return true;
					var fID = itemPropHiden['toFilters'][0];
					var filter = gmxAPI.mapNodes[fID];
					gmxAttr['textFunc'] = filter.clusters.getTextFunc();
					if(filter && callHandler('onClick', item.geom, filter, gmxAttr)) return true;
				}
				return true;
			}
		}
		node['itemBalloon'] = function(geom, gmxAttr) {			// проверка событий векторного слоя
			var evName = (gmxAttr && gmxAttr.evName ? gmxAttr.evName : 'onMouseOver');
			if(callHandler(evName, geom, gmxNode, gmxAttr)) return true;
			var fID = geom.propHiden['toFilters'][0];
			var filter = gmxAPI.mapNodes[fID];
			if(filter && callHandler(evName, geom, filter, gmxAttr)) return true;
			return false;
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
				if(!filters || filters.length == 0) filters = chkObjectFilters(geom);
				filter = (filters && filters.length ? mapNodes[filters[0]] : null);
			}
			return filter;
		}
		//node.getItemFilter = getItemFilter;
		
		function chkObjectFilters(geo, tileSize)	{				// Получить фильтры для обьекта
			var zoom = LMap.getZoom();
			var toFilters = [];

			//delete geo.curStyle;
			delete geo['_cache'];
			for (var z in geo.propHiden['drawInTiles'])
			{
				if(z != zoom) delete geo.propHiden['drawInTiles'][z];
			}

			var isViewPoint = (geo['type'] == 'Point' ? true : false);

			var prpStyle = function(style) {
				var scale = style['scale'] || 1;
				if(style.marker) {
					if(style.imageWidth && style.imageHeight) {
						geo['sx'] = style.imageWidth;
						geo['sy'] = style.imageHeight;
						//size = Math.sqrt(geo['sx']*geo['sx'] + geo['sy']*geo['sy']);
						isViewPoint = true;
					}
				}
				if(typeof(scale) == 'string') {
					scale = (style['scaleFunction'] ? style['scaleFunction'](geo['properties']) : 1);
				}
				if('minScale' in style && scale < style['minScale']) scale = style['minScale'];
				else if('maxScale' in style && scale > style['maxScale']) scale = style['maxScale'];
				//size *= scale;
				geo.propHiden.curStyle = style;
				if('chkSize' in geo && !node['waitStyle']) geo['chkSize'](node, style);
			};
			var curStyle = null;
			if(geo.propHiden['subType'] === 'cluster') {
				toFilters = node.filters;
			} else {
				//var size = 4;
				for(var j=0; j<node.filters.length; j++) {
					var filterID = node.filters[j];
					var filter = mapNodes[node.filters[j]];
					if(zoom > filter.maxZ || zoom < filter.minZ || filter.isVisible === false) continue;
					var prop = getPropItem(geo);

					var flag = (filter && filter.sqlFunction ? filter.sqlFunction(prop) : true);
					if(flag) {
						toFilters.push(filterID);
						//curStyle = (filter.regularStyle ? filter.regularStyle : null);
						if(filter.regularStyle) {
							curStyle = (filter.regularStyleIsAttr ? utils.evalStyle(filter.regularStyle, prop) : filter.regularStyle);
							prpStyle(curStyle);
							/*
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
							*/
						}
						break;						// Один обьект в один фильтр 
					}
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
		node.chkObjectFilters = chkObjectFilters;

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
						if(propHiden['subType'] != 'cluster' && !propHiden['_isFilters']) continue;
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
					if(!isInTile(geom, attr)) continue;	// обьект не пересекает границы тайла
					if(!('_isFilters' in geom.propHiden)) chkObjectFilters(geom, attr['tileSize']);
					if(!geom.propHiden['_isFilters']) continue;		// если нет фильтра пропускаем

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
			//reCheckFilters();
			node.redrawFlips(true);
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
			if(!('_isFilters' in geo.propHiden)) chkObjectFilters(geo);
			if(!geo.propHiden['_isFilters']) return false;
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
				if(node['tilesNeedRepaint'].length > 0) return;	// есть очередь отрисовки
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
					delete geom.propHiden['drawInTiles'];
					delete geom['_cache'];
					//delete geom['curStyle'];
					//geom.propHiden['toFilters'] = chkObjectFilters(geom, tileSize);
				}
			}
			for (var i = 0; i < node['addedItems'].length; i++) {
				delete node['addedItems'][i].propHiden['curStyle'];
				delete node['addedItems'][i].propHiden['_isSQLVisibility'];
				delete node['addedItems'][i].propHiden['_isFilters'];
				delete node['addedItems'][i].propHiden['_imgQuicklook'];
				
				delete node['addedItems'][i].propHiden['toFilters'];
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
