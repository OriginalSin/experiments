//Поддержка Flash
(function()
{
	var addObjects = function(parentId, attr) {
		var out = [];
		var data = attr['arr'];
		var fmt = (attr['format'] ? attr['format'] : 'LatLng');
		for (var i=0; i<data.length; i++)	// Подготовка массива обьектов
		{
			var ph = data[i];
			var props = ph['properties'] || null;
			var tmp = {
				"parentId": parentId,
				"geometry": (fmt == 'LatLng' ? gmxAPI.merc_geometry(ph['geometry']) : ph['geometry']),
				"properties": props
			};
			if(ph['setStyle']) tmp['setStyle'] = ph['setStyle'];
			if(ph['setLabel']) tmp['setLabel'] = ph['setLabel'];
			out.push(tmp);
		}
		var _obj = gmxAPI.flashDiv.cmdFromJS('addObjects', out); // Отправить команду в SWF

		out = [];
		var pObj = gmxAPI.mapNodes[parentId];	// обычный MapObject
		for (var i=0; i<_obj.length; i++)	// Отражение обьектов в JS
		{
			var aObj = new gmxAPI._FMO(_obj[i], data[i].properties, pObj);	// обычный MapObject
			out.push(aObj);
			// пополнение mapNodes
			var currID = (aObj.objectId ? aObj.objectId : gmxAPI.newFlashMapId() + '_gen1');
			gmxAPI.mapNodes[currID] = aObj;
			if(aObj.parent) aObj.parent.childsID[currID] = true; 
		}
		return out;
	}

	// Команды в SWF
	var commands = {				// Тип команды
		'setEditObjects':	function(hash)	{							// Установка редактируемых обьектов слоя
			return gmxAPI.flashDiv.cmdFromJS('setEditObjects', { 'objectId':hash.obj.objectId, 'processing':hash['attr'] } );
		}
		,
		'setVisible':	function(hash)	{								// Изменить видимость обьекта
			if(hash['obj']) {
				gmxAPI.flashDiv.cmdFromJS('setVisible', { 'objectId':hash.obj.objectId, 'flag':hash['attr'] } );
			}
		}
		,
		'sendPNG':	function(hash)	{									// Сохранение изображения карты на сервер
			var miniMapFlag = gmxAPI.miniMapAvailable;
			var attr = hash['attr'];
			var flag = (attr.miniMapSetVisible ? true : false);
			if(miniMapFlag != flag) gmxAPI.map.miniMap.setVisible(flag);
			if(attr.func) attr.func = gmxAPI.uniqueGlobalName(attr.func);
			var ret = {'base64': gmxAPI.flashDiv.cmdFromJS('sendPNG', attr)};
			if(miniMapFlag) gmxAPI.map.miniMap.setVisible(miniMapFlag);
			return ret;
		}
		,
		'savePNG':	function(hash)	{									// Сохранить PNG файл экрана
			return gmxAPI.flashDiv.cmdFromJS('savePNG', { 'fileName':hash['attr'] });
		}
		,
		'setZoomBounds':	function(hash)	{							// Установить ограничения по Zoom
			return gmxAPI.flashDiv.cmdFromJS('setZoomBounds', { 'objectId':hash.obj.objectId, 'minZ':hash['attr']['minZ'], 'maxZ':hash['attr']['maxZ'] });
		}
		,
		'setClusters':	function(hash)	{								// Установить кластеризацию потомков
			var obj = hash['obj'];
			var attr = hash['attr'];
			var ret = {};
			if(attr && 'newProperties' in attr) {
				var keyArray = [];
				var valArray = [];
				for(key in attr['newProperties'])
				{
					keyArray.push(key);
					valArray.push(attr['newProperties'][key]);
				}
				attr['propFields'] = [keyArray, valArray];
				attr['hideFixedBalloons'] = gmxAPI.uniqueGlobalName(function() { gmxAPI.map.balloonClassObject.hideHoverBalloons(false); });
			}
			var flag = ('clusters' in obj);	// видимость кластеров
			if(!flag)
				obj['clusters'] = new gmxAPI._Clusters(obj);
			else
				ret = gmxAPI.flashDiv.cmdFromJS('setClusters', { 'objectId':obj.objectId, 'data':attr });
			attr['visible'] = flag;
			obj['clusters']['attr'] = attr;		// признак наличия кластеризации в SWF
			//if(!obj.parent._hoverBalloonAttr) obj.parent.enableHoverBalloon();	// если балунов не установлено
			return ret;
		}
		,
		'delClusters':	function(hash)	{								// Удалить кластеризацию потомков
			var obj = hash['obj'];
			var ret = gmxAPI.flashDiv.cmdFromJS('delClusters', { 'objectId':obj.objectId });
			if('clusters' in obj && obj['clusters']['attr']) obj['clusters']['attr']['visible'] = false;
			return ret;
		}
		,
		'setGridVisible':	function(hash)	{							// Изменить видимость сетки
			return gmxAPI.flashDiv.cmdFromJS('setGridVisible', { 'flag':hash['attr'] } );
		}
		,
		'getGridVisibility':	function(hash)	{						// получить видимость сетки
			return gmxAPI.flashDiv.cmdFromJS('getGridVisibility', { } );
		}
		,
		'getZoomBounds':	function(hash)	{							// Получить ограничения по Zoom
			return gmxAPI.flashDiv.cmdFromJS('getZoomBounds', { 'objectId':hash.obj.objectId });
		}
		,
		'getDepth':	function(hash)	{									// Получить индекс обьекта
			return gmxAPI.flashDiv.cmdFromJS('getDepth', { 'objectId':hash.obj.objectId });
		}
		,
		'getVisibility':	function(hash)	{							// Получить видимость
			return gmxAPI.flashDiv.cmdFromJS('getVisibility', { 'objectId':hash.obj.objectId });
		}
		,
		'trace':	function(hash)	{									// Сообщение в SWF
			return gmxAPI.flashDiv.cmdFromJS('trace', { 'data':hash['attr'] });
		}
		,
		'setQuality':	function(hash)	{								// Установка Quality
			return gmxAPI.flashDiv.cmdFromJS('setQuality', { 'data':hash['attr'] });
		}
		,
		'disableCaching':	function(hash)	{	// ????
			return gmxAPI.flashDiv.cmdFromJS('disableCaching', { });
		}
		,
		'print':	function(hash)	{									// Печать
			return gmxAPI.flashDiv.cmdFromJS('print', { });
		}
		,
		'repaint':	function(hash)	{		// ????
			return gmxAPI.flashDiv.cmdFromJS('repaint', { });
		}
		,
		'addContextMenuItem':	function(hash)	{						// Добавить пункт в контекстное меню SWF
			if(hash['attr'].func) hash['attr'].func = gmxAPI.uniqueGlobalName(hash['attr'].func);
			return gmxAPI.flashDiv.cmdFromJS('addContextMenuItem', hash['attr']);
		}
		,
		'moveTo':	function(hash)	{									//позиционирует карту по координатам центра и выбирает масштаб
			var attr = hash['attr'];
			attr['x'] = gmxAPI.merc_x(attr['x']);
			attr['y'] = gmxAPI.merc_y(attr['y']);
			return gmxAPI.flashDiv.cmdFromJS('moveTo', attr);
		}
		,
		'slideTo':	function(hash)	{									//плавно позиционирует карту по координатам центра и выбирает масштаб
			var attr = hash['attr'];
			attr['x'] = gmxAPI.merc_x(attr['x']);
			attr['y'] = gmxAPI.merc_y(attr['y']);
			return gmxAPI.flashDiv.cmdFromJS('slideTo', attr);
		}
		,
		'zoomBy':	function(hash)	{									//выбирает масштаб
			return gmxAPI.flashDiv.cmdFromJS('zoomBy', hash['attr']);
		}
		,
		'freeze':	function(hash)	{									// заморозить
			return gmxAPI.flashDiv.cmdFromJS('freeze', { });
		}
		,
		'unfreeze':	function(hash)	{									// разморозить
			return gmxAPI.flashDiv.cmdFromJS('unfreeze', { });
		}
		,
		'setCursor':	function(hash)	{								//установка курсора
			return gmxAPI.flashDiv.cmdFromJS('setCursor', hash['attr']);
		}
		,
		'clearCursor':	function(hash)	{								//убрать курсор
			return gmxAPI.flashDiv.cmdFromJS('clearCursor', { });
		}
		,
		'setCursorVisible':	function(hash)	{							//видимость курсора
			return gmxAPI.flashDiv.cmdFromJS('setCursorVisible', hash['attr']);
		}
		,
		'stopDragging':	function(hash)	{								//убрать флаг Drag
			return gmxAPI.flashDiv.cmdFromJS('stopDragging', { });
		}
		,
		'isDragging':	function(hash)	{								//получить флаг Drag
			return gmxAPI.flashDiv.cmdFromJS('isDragging', { });
		}
		,
		'resumeDragging':	function(hash)	{							//возобновить Drag
			return gmxAPI.flashDiv.cmdFromJS('resumeDragging', { });
		}
		,
		'getPosition':	function(hash)	{								//получить текущие атрибуты SWF
			return gmxAPI.flashDiv.cmdFromJS('getPosition', { });
		}
		,
		'getX':	function(hash)	{										//получить позицию Х центра SWF
			return gmxAPI.from_merc_x(gmxAPI.flashDiv.cmdFromJS('getX', { }));
		}
		,
		'getY':	function(hash)	{										//получить позицию Y центра SWF
			return gmxAPI.from_merc_y(gmxAPI.flashDiv.cmdFromJS('getY', { }));
		}
		,
		'getZ':	function(hash)	{										//получить текущий Z
			return gmxAPI.flashDiv.cmdFromJS('getZ', { });
		}
		,
		'getMouseX':	function(hash)	{								//получить позицию Х MouseX
			return gmxAPI.from_merc_x(gmxAPI.flashDiv.cmdFromJS('getMouseX', { }));
		}
		,
		'getMouseY':	function(hash)	{								//получить позицию Y MouseY
			return gmxAPI.from_merc_y(gmxAPI.flashDiv.cmdFromJS('getMouseY', { }));
		}
		,
		'isKeyDown':	function(hash)	{								//проверить нажатие клавиши в SWF
			return gmxAPI.flashDiv.cmdFromJS('isKeyDown', hash['attr']);
		}
		,
		'setExtent':	function(hash)	{								//установить Extent в SWF
			var attr = {'x1':gmxAPI.merc_x(hash['attr']['x1']), 'x2':gmxAPI.merc_x(hash['attr']['x2']), 'y1':gmxAPI.merc_y(hash['attr']['y1']), 'y2':gmxAPI.merc_y(hash['attr']['y2']) };
			return gmxAPI.flashDiv.cmdFromJS('setExtent', attr);
		}
		,
		'setMinMaxZoom':	function(hash)	{							//установить Zoom ограничения
			return gmxAPI.flashDiv.cmdFromJS('setMinMaxZoom', hash['attr']);
		}
		,
		'addMapWindow':	function(hash)	{								//Создание окна карты
			var attr = hash['attr'];
			if(attr.callbackName) attr.callbackName = gmxAPI.uniqueGlobalName(attr.callbackName);
			return gmxAPI.flashDiv.cmdFromJS('addMapWindow', attr);
		}
		,
		'setStyle':	function(hash)	{									// установить Style обьекта
			gmxAPI.flashDiv.cmdFromJS('setStyle', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'getStyle':	function(hash)	{									//получить Style обьекта
			return gmxAPI.flashDiv.cmdFromJS('getStyle', { 'objectId':hash.obj.objectId, 'removeDefaults':hash['attr'] });
		}
		,
		'getVisibleStyle':	function(hash)	{							//получить Style обьекта с учетом родителей
			return gmxAPI.flashDiv.cmdFromJS('getVisibleStyle', { 'objectId':hash.obj.objectId });
		}
		,
		'positionWindow':	function(hash)	{							// 
			gmxAPI.flashDiv.cmdFromJS('positionWindow', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'setBackgroundColor':	function(hash)	{// 
			gmxAPI.flashDiv.cmdFromJS('setBackgroundColor', { 'objectId':hash.obj.objectId, 'color':hash['attr'] } );
		}
		,
		'getChildren':	function(hash)	{							// получить список потомков
			return gmxAPI.flashDiv.cmdFromJS('getChildren', { 'objectId':hash.obj.objectId } );
		}
		,
		'setHandler':	function(hash)	{							// установка обработчика события
			var attr = hash['attr'];
			if(attr.callbackName) attr.callbackName = gmxAPI.uniqueGlobalName(attr.callbackName);
			return gmxAPI.flashDiv.cmdFromJS('setHandler', { 'objectId':hash.obj.objectId, 'eventName':attr['eventName'], 'callbackName':attr['callbackName'] } );
		}
		,
		'removeHandler':	function(hash)	{						// удаление обработчика события
			return gmxAPI.flashDiv.cmdFromJS('removeHandler', { 'objectId':hash.obj.objectId, 'eventName':hash['attr']['eventName'] } );
		}
		,
		'addObject':	function(hash)	{							// добавить обьект
			var attr = gmxAPI.clone(hash['attr']);
			var geo = gmxAPI.merc_geometry(attr['geometry']) || null;
			var ph = { 'objectId':hash.obj.objectId, 'geometry':geo, 'properties':attr['properties'] };
			if(attr['propHiden']) ph['propHiden'] = attr['propHiden'];
			return gmxAPI.flashDiv.cmdFromJS('addObject', ph );
		}
		,
		'addObjects':	function(hash)	{							// добавить обьекты
			return addObjects(hash.obj.objectId, hash['attr']);
		}
		,
		'addObjectsFromSWF':	function(hash)	{					// добавить обьекты из SWF файла
			return gmxAPI.flashDiv.cmdFromJS('addObjectsFromSWF', { 'objectId':hash.obj.objectId, 'attr':hash['attr'] });
		}
		,
		'setVisibilityFilter':	function(hash)	{	// добавить фильтр видимости к обьекту
			return gmxAPI.flashDiv.cmdFromJS('setVisibilityFilter', { 'objectId':hash.obj.objectId, 'sql':hash['attr']['sql'] } );
		}
		,
		'setFilter':	function(hash)	{							// добавить фильтр к обьекту
			return gmxAPI.flashDiv.cmdFromJS('setFilter', { 'objectId':hash.obj.objectId, 'sql':hash['attr']['sql'] } );
		}
		,
		'remove':	function(hash)	{		// удалить обьект
			gmxAPI.flashDiv.cmdFromJS('remove', { 'objectId':hash.obj.objectId } );
		}
		,
		'bringToTop':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('bringToTop', { 'objectId':hash.obj.objectId } );
		}
		,
		'bringToDepth':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('bringToDepth', { 'objectId':hash.obj.objectId, 'zIndex':hash['attr']['zIndex'] } );
		}
		,
		'bringToBottom':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('bringToBottom', { 'objectId':hash.obj.objectId } );
		}
		,
		'setActive':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setActive', { 'objectId':hash.obj.objectId, 'flag':hash['attr']['flag'] } );
		}
		,
		'setEditable':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setEditable', { 'objectId':hash.obj.objectId } );
		}
		,
		'startDrawing':	function(hash)	{
			var attr = (hash ? { 'objectId':hash.obj.objectId, 'type':hash['attr']['type'] } : null);
			gmxAPI.flashDiv.cmdFromJS('startDrawing', attr );
		}
		,
		'stopDrawing':	function(hash)	{
			var attr = (hash ? { 'objectId':hash.obj.objectId } : null);
			gmxAPI.flashDiv.cmdFromJS('stopDrawing', attr );
		}
		,
		'isDrawing':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('isDrawing', { 'objectId':hash.obj.objectId } );
		}
		,
		'getIntermediateLength':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getIntermediateLength', { 'objectId':hash.obj.objectId } );
		}
		,
		'getCurrentEdgeLength':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getCurrentEdgeLength', { 'objectId':hash.obj.objectId } );
		}
		,
		'setLabel':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setLabel', { 'objectId':hash.obj.objectId, 'label':hash['attr']['label'] } );
		}
		,
		'setBackgroundTiles':	function(hash)	{
			var attr = gmxAPI.clone(hash['attr']);
			if(hash['attr'].func) attr.func = gmxAPI.uniqueGlobalName(hash['attr'].func);
			attr.objectId = hash.obj.objectId;
			gmxAPI.flashDiv.cmdFromJS('setBackgroundTiles', attr );
		}
		,
		'setDisplacement':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setDisplacement', { 'objectId':hash.obj.objectId, 'dx':hash['attr']['dx'], 'dy':hash['attr']['dy'] } );
		}
		,
		'setTileCaching':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setTileCaching', { 'objectId':hash.obj.objectId, 'flag':hash['attr']['flag'] } );
		}
		,
		'clearBackgroundImage':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('clearBackgroundImage', { 'objectId':hash.obj.objectId } );
		}
		,
		'setGeometry':	function(hash)	{
			var geo = gmxAPI.merc_geometry(hash['attr']);
			gmxAPI.flashDiv.cmdFromJS('setGeometry', { 'objectId':hash.obj.objectId, 'data':geo } );
		}
		,
		'getGeometry':	function(hash)	{
			var geom = gmxAPI.flashDiv.cmdFromJS('getGeometry', { 'objectId':hash.obj.objectId } );
			if(!geom) return null;
			var out = { "type": geom.type };
			var coords =  gmxAPI.forEachPoint(geom.coordinates, function(c) {
					return [gmxAPI.from_merc_x(c[0]), gmxAPI.from_merc_y(c[1])];
					}
				);
			out["coordinates"] = coords;
			return out;
		}
		,
		'getLength':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getLength', { 'objectId':hash.obj.objectId } );
		}
		,
		'getArea':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getArea', { 'objectId':hash.obj.objectId } );
		}
		,
		'getGeometryType':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getGeometryType', { 'objectId':hash.obj.objectId } );
		}
		,
		'getCenter':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getCenter', { 'objectId':hash.obj.objectId } );
		}
		,
		'addChildRoot':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('addChildRoot', { 'objectId':hash.obj.objectId } );
		}
		,
		'setVectorTiles':	function(hash)	{
			var attr = hash['attr'];
			if(attr.tileFunction) attr.tileFunction = gmxAPI.uniqueGlobalName(attr.tileFunction);
			return gmxAPI.flashDiv.cmdFromJS('setVectorTiles', { 'objectId':hash.obj.objectId, 'tilesVers':attr['tilesVers'], 'tileFunction':attr['tileFunction'], 'identityField':attr['cacheFieldName'], 'tiles':attr['dataTiles'], 'filesHash':attr['filesHash'] } );
		}
		,
		'setTiles':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('setTiles', { 'objectId':hash.obj.objectId, 'tiles':attr['tiles'], 'flag':attr['flag'] } );
		}
		,
		'startLoadTiles':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('startLoadTiles', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'getStat':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getStat', { 'objectId':hash.obj.objectId } );
		}
		,
		'observeVectorLayer':	function(hash)	{
			var attr = gmxAPI.clone(hash['attr']);
			if(hash['attr'].func) attr.func = gmxAPI.uniqueGlobalName(hash['attr'].func);
			attr.objectId = hash.obj.objectId;
			gmxAPI.flashDiv.cmdFromJS('observeVectorLayer', attr );
		}
		,
		'setImageExtent':	function(hash)	{
			gmxAPI.flashDiv.cmdFromJS('setImageExtent', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'setImage':	function(hash)	{
			var attr = hash['attr'];
			gmxAPI.flashDiv.cmdFromJS('setImage', { 'objectId':hash.obj.objectId, 'url':attr['url'],
				'x1': gmxAPI.merc_x(attr['x1']), 'y1': gmxAPI.merc_y(attr['y1']),
				'x2': gmxAPI.merc_x(attr['x2']), 'y2': gmxAPI.merc_y(attr['y2']),
				'x3': gmxAPI.merc_x(attr['x3']), 'y3': gmxAPI.merc_y(attr['y3']),
				'x4': gmxAPI.merc_x(attr['x4']), 'y4': gmxAPI.merc_y(attr['y4']),
				'tx1':attr['tx1'], 'ty1':attr['ty1'], 'tx2':attr['tx2'], 'ty2':attr['ty2'], 'tx3':attr['tx3'], 'ty3':attr['ty3'], 'tx4':attr['tx4'], 'ty4':attr['ty4']
			} );
		}
		,
		'flip':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('flip', { 'objectId':hash.obj.objectId } );
		}
		,
		'getFeatureById':	function(hash)	{
			var attr = hash['attr'];
			if(attr.func) {
				var func = function(geom, props)
				{
					var ret = null;
					if(geom && geom['type'] != 'unknown') {
						if(typeof(props) === 'object' && props.length > 0) { props = gmxAPI.arrayToHash(props); }
						ret = new gmxAPI._FlashMapFeature(gmxAPI.from_merc_geometry(geom), props, hash.obj);
					} else if(hash.obj._Processing && hash.obj._Processing.addObjects) {
						var arr = hash.obj._Processing.addObjects;
						var identityField = hash.obj.properties.identityField;
						for (var i = 0; i < arr.length; i++) {
							var prop = arr[i].properties;
							if(prop[identityField] == attr['fid']) {
								ret = new gmxAPI._FlashMapFeature(gmxAPI.from_merc_geometry(arr[i].geometry), arr[i].properties, hash.obj);
								break;
							}
						}
					}

					if(ret) {
						attr.func(ret);
					} else {
						gmxAPI.addDebugWarnings({'alert':'Object: ' + attr['fid'] + ' not found in layer: ' + hash.obj.objectId});
					}
				}
				gmxAPI.flashDiv.cmdFromJS('getFeatureById', { 'objectId':hash.obj.objectId, 'fid':attr['fid'], 'func':gmxAPI.uniqueGlobalName(func) } );
			}
		}
		,
		'getFeatures':	function(hash)	{
			var attr = hash['attr'];
			if(attr.func) {
				var geo = (attr.geom ? attr.geom : { type: "POLYGON", coordinates: [[-180, -89, -180, 89, 180, 89, 180, -89]] });
				var bound = gmxAPI.getBounds(geo.coordinates);
				var func = function(geoms, props)
				{
					var ret = [];
					for (var i = 0; i < geoms.length; i++) {
						var cProp = props[i];
						if(typeof(cProp) === 'object' && cProp.length > 0) {
							cProp = gmxAPI.arrayToHash(cProp);
						}
						ret.push(new gmxAPI._FlashMapFeature(
							gmxAPI.from_merc_geometry(geoms[i]),
							cProp,
							hash.obj
						));
					}
					if(hash.obj._Processing && hash.obj._Processing.addObjects) {
						var arr = hash.obj._Processing.addObjects;
						for (var i = 0; i < arr.length; i++) {
							var geom = gmxAPI.from_merc_geometry(arr[i].geometry);
							var bounds = gmxAPI.getBounds(geom.coordinates);
							if(gmxAPI.boundsIntersect(bound, bounds)) {
								ret.push(new gmxAPI._FlashMapFeature(
									geom,
									arr[i].properties,
									hash.obj
								));
							}
						}
					}
					
					attr.func(ret);
				}
				gmxAPI.flashDiv.cmdFromJS('getFeatures', { 'objectId':hash.obj.objectId, 'geom':gmxAPI.merc_geometry(geo), 'func':gmxAPI.uniqueGlobalName(func) } );
			}
		}
		,
		'getTileItem':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getTileItem', { 'objectId':hash.obj.objectId, 'vId':hash['attr'] } );
		}
		,
		'setTileItem':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('setTileItem', { 'objectId':hash.obj.objectId, 'data':hash['attr']['data'], 'flag':hash['attr']['flag'] } );
		}
		,
		'getItemsFromExtent':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getItemsFromExtent', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'setFlashLSO':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('setFlashLSO', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'setAPIProperties':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('setAPIProperties', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
		,
		'getPatternIcon':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('getPatternIcon', { 'data':hash['attr'] } );
		}
		,
		'addItems':	function(hash)	{
			return gmxAPI.flashDiv.cmdFromJS('addItems', { 'objectId':hash.obj.objectId, 'data':hash['attr'] } );
		}
	};

	// Передача команды в SWF
	function FlashCMD(cmd, hash)
	{
		var ret = {};
		if(!gmxAPI.flashDiv) return ret;
//var startTime = (new Date()).getTime();
		var flashDomTest = typeof(gmxAPI.flashDiv);
		ret = (cmd in commands ? commands[cmd].call(commands, hash) : {});
/*
console.log(cmd + ' : ' , hash);
if(!window._debugTimes) window._debugTimes = { 'jsToFlash': { 'timeSum':0, 'callCount':0, 'callFunc':{} } };
var delta = (new Date()).getTime() - startTime;
window._debugTimes.jsToFlash.timeSum += delta;
window._debugTimes.jsToFlash.callCount += 1;
if(!window._debugTimes.jsToFlash.callFunc[cmd]) window._debugTimes.jsToFlash.callFunc[cmd] = { 'timeSum':0, 'callCount':0 };
window._debugTimes.jsToFlash.callFunc[cmd]['timeSum'] += delta;
window._debugTimes.jsToFlash.callFunc[cmd]['callCount'] += 1;
*/
		return ret;
	}
	
	if(typeof deconcept=="undefined"){var deconcept=new Object();}if(typeof deconcept.util=="undefined"){deconcept.util=new Object();}if(typeof deconcept.SWFObjectUtil=="undefined"){deconcept.SWFObjectUtil=new Object();}deconcept.SWFObject=function(_1,id,w,h,_5,c,_7,_8,_9,_a){if(!document.getElementById){return;}this.DETECT_KEY=_a?_a:"detectflash";this.skipDetect=deconcept.util.getRequestParameter(this.DETECT_KEY);this.params=new Object();this.variables=new Object();this.attributes=new Array();if(_1){this.setAttribute("swf",_1);}if(id){this.setAttribute("id",id);}if(w){this.setAttribute("width",w);}if(h){this.setAttribute("height",h);}if(_5){this.setAttribute("version",new deconcept.PlayerVersion(_5.toString().split(".")));}this.installedVer=deconcept.SWFObjectUtil.getPlayerVersion();if(!window.opera&&document.all&&this.installedVer.major>7){deconcept.SWFObject.doPrepUnload=true;}if(c){this.addParam("bgcolor",c);}var q=_7?_7:"high";this.addParam("quality",q);this.setAttribute("useExpressInstall",false);this.setAttribute("doExpressInstall",false);var _c=(_8)?_8:window.location;this.setAttribute("xiRedirectUrl",_c);this.setAttribute("redirectUrl","");if(_9){this.setAttribute("redirectUrl",_9);}};deconcept.SWFObject.prototype={useExpressInstall:function(_d){this.xiSWFPath=!_d?"expressinstall.swf":_d;this.setAttribute("useExpressInstall",true);},setAttribute:function(_e,_f){this.attributes[_e]=_f;},getAttribute:function(_10){return this.attributes[_10];},addParam:function(_11,_12){this.params[_11]=_12;},getParams:function(){return this.params;},addVariable:function(_13,_14){this.variables[_13]=_14;},getVariable:function(_15){return this.variables[_15];},getVariables:function(){return this.variables;},getVariablePairs:function(){var _16=new Array();var key;var _18=this.getVariables();for(key in _18){_16[_16.length]=key+"="+_18[key];}return _16;},getSWFHTML:function(){var _19="";if(navigator.plugins&&navigator.mimeTypes&&navigator.mimeTypes.length){if(this.getAttribute("doExpressInstall")){this.addVariable("MMplayerType","PlugIn");this.setAttribute("swf",this.xiSWFPath);}_19="<embed type=\"application/x-shockwave-flash\" src=\""+this.getAttribute("swf")+"\" width=\""+this.getAttribute("width")+"\" height=\""+this.getAttribute("height")+"\" style=\""+this.getAttribute("style")+"\"";_19+=" id=\""+this.getAttribute("id")+"\" name=\""+this.getAttribute("id")+"\" ";var _1a=this.getParams();for(var key in _1a){_19+=[key]+"=\""+_1a[key]+"\" ";}var _1c=this.getVariablePairs().join("&");if(_1c.length>0){_19+="flashvars=\""+_1c+"\"";}_19+="/>";}else{if(this.getAttribute("doExpressInstall")){this.addVariable("MMplayerType","ActiveX");this.setAttribute("swf",this.xiSWFPath);}_19="<object id=\""+this.getAttribute("id")+"\" classid=\"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000\" width=\""+this.getAttribute("width")+"\" height=\""+this.getAttribute("height")+"\" style=\""+this.getAttribute("style")+"\">";_19+="<param name=\"movie\" value=\""+this.getAttribute("swf")+"\" />";var _1d=this.getParams();for(var key in _1d){_19+="<param name=\""+key+"\" value=\""+_1d[key]+"\" />";}var _1f=this.getVariablePairs().join("&");if(_1f.length>0){_19+="<param name=\"flashvars\" value=\""+_1f+"\" />";}_19+="</object>";}return _19;},write:function(_20){if(this.getAttribute("useExpressInstall")){var _21=new deconcept.PlayerVersion([6,0,65]);if(this.installedVer.versionIsValid(_21)&&!this.installedVer.versionIsValid(this.getAttribute("version"))){this.setAttribute("doExpressInstall",true);this.addVariable("MMredirectURL",escape(this.getAttribute("xiRedirectUrl")));document.title=document.title.slice(0,47)+" - Flash Player Installation";this.addVariable("MMdoctitle",document.title);}}if(this.skipDetect||this.getAttribute("doExpressInstall")||this.installedVer.versionIsValid(this.getAttribute("version"))){var n=(typeof _20=="string")?document.getElementById(_20):_20;n.innerHTML=this.getSWFHTML();return true;}else{if(this.getAttribute("redirectUrl")!=""){document.location.replace(this.getAttribute("redirectUrl"));}}return false;}};deconcept.SWFObjectUtil.getPlayerVersion=function(){var _23=new deconcept.PlayerVersion([0,0,0]);if(navigator.plugins&&navigator.mimeTypes.length){var x=navigator.plugins["Shockwave Flash"];if(x&&x.description){_23=new deconcept.PlayerVersion(x.description.replace(/([a-zA-Z]|\s)+/,"").replace(/(\s+r|\s+b[0-9]+)/,".").split("."));}}else{if(navigator.userAgent&&navigator.userAgent.indexOf("Windows CE")>=0){var axo=1;var _26=3;while(axo){try{_26++;axo=new ActiveXObject("ShockwaveFlash.ShockwaveFlash."+_26);_23=new deconcept.PlayerVersion([_26,0,0]);}catch(e){axo=null;}}}else{try{var axo=new ActiveXObject("ShockwaveFlash.ShockwaveFlash.7");}catch(e){try{var axo=new ActiveXObject("ShockwaveFlash.ShockwaveFlash.6");_23=new deconcept.PlayerVersion([6,0,21]);axo.AllowScriptAccess="always";}catch(e){if(_23.major==6){return _23;}}try{axo=new ActiveXObject("ShockwaveFlash.ShockwaveFlash");}catch(e){}}if(axo!=null){_23=new deconcept.PlayerVersion(axo.GetVariable("$version").split(" ")[1].split(","));}}}return _23;};deconcept.PlayerVersion=function(_29){this.major=_29[0]!=null?parseInt(_29[0]):0;this.minor=_29[1]!=null?parseInt(_29[1]):0;this.rev=_29[2]!=null?parseInt(_29[2]):0;};deconcept.PlayerVersion.prototype.versionIsValid=function(fv){if(this.major<fv.major){return false;}if(this.major>fv.major){return true;}if(this.minor<fv.minor){return false;}if(this.minor>fv.minor){return true;}if(this.rev<fv.rev){return false;}return true;};deconcept.util={getRequestParameter:function(_2b){var q=document.location.search||document.location.hash;if(_2b==null){return q;}if(q){var _2d=q.substring(1).split("&");for(var i=0;i<_2d.length;i++){if(_2d[i].substring(0,_2d[i].indexOf("="))==_2b){return _2d[i].substring((_2d[i].indexOf("=")+1));}}}return "";}};deconcept.SWFObjectUtil.cleanupSWFs=function(){var _2f=document.getElementsByTagName("OBJECT");for(var i=_2f.length-1;i>=0;i--){_2f[i].style.display="none";for(var x in _2f[i]){if(typeof _2f[i][x]=="function"){_2f[i][x]=function(){};}}}};if(deconcept.SWFObject.doPrepUnload){if(!deconcept.unloadSet){deconcept.SWFObjectUtil.prepUnload=function(){__flash_unloadHandler=function(){};__flash_savedUnloadHandler=function(){};window.attachEvent("onunload",deconcept.SWFObjectUtil.cleanupSWFs);};window.attachEvent("onbeforeunload",deconcept.SWFObjectUtil.prepUnload);deconcept.unloadSet=true;}}if(!document.getElementById&&document.all){document.getElementById=function(id){return document.all[id];};}

	// Добавить SWF в DOM
	function addSWFObject(apiBase, flashId, ww, hh, v, bg, loadCallback, FlagFlashLSO)
	{
		// Проверка версии FlashPlayer
		if (deconcept.SWFObjectUtil.getPlayerVersion().major < 10) 
			return '';	

		//var url = apiBase + "api.swf?" + Math.random()
		var url = apiBase + "api.swf";
		var o = new deconcept.SWFObject(url, flashId, ww, hh, v, bg);
		o.addParam('allowScriptAccess', 'always');
		o.addParam('wmode', 'opaque');
		o.addVariable("clearCallback", gmxAPI.uniqueGlobalName(function(name) { delete window[name]; }));
		o.addVariable("loadCallback", gmxAPI.uniqueGlobalName(loadCallback));
		if(FlagFlashLSO) {
			o.addVariable("useFlashLSO", true);
			if(FlagFlashLSO.multiSession) o.addVariable("multiSessionLSO", true);
			if(FlagFlashLSO.compress) o.addVariable("compressLSO", true);
		}
		return o;
	}
	
	//расширяем namespace
    gmxAPI._cmdProxy = FlashCMD;			// посылка команд отрисовщику
    gmxAPI._addProxyObject = addSWFObject;	// Добавить SWF в DOM
    gmxAPI.APILoaded = true;				// Флаг возможности использования gmxAPI сторонними модулями
    
})();