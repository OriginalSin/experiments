importScripts('WorkerUtils.js');

// тело worker-а
// 	ph - входные данные формат любой
// 	callback - для отправки результата
// 		Доступные команды
// 		self.close(); // Terminates the worker.
self.commands = function(ph, callback) {
	if(ph.cmd === 'onMoveEnd') vectorData.onMoveEnd(ph);
	else if(ph.cmd === 'vectorData') vectorData.init(ph, callback);
}

var vectorData = {
	'callback': null
	,'observerTiles': {}
	,'observerObj': {}
	,'observerTimer': null
	,'tiles': null
	,'tilesVers': {}
	,'needLoad': {}
	,'tilesGeometry': {}
	,'properties': {}
	,'propHiden': {}
	,'currPosition': null
	,'currBounds': null
	,'observeType': 'onVisible'
	,'geomType': 'latlng'
	,'hostName': null
	,'mapName': null
	,'layerName': null
	,'key': null
	,'mapSessionKey': null
	,'tileSenderPrefix': null
	,'init': function(ph, callback) {
		vectorData.callback = callback;
		vectorData.currPosition = ph['currPosition'];
		vectorData.hostName = ph['hostName'];
		vectorData.mapName = ph['mapName'];
		vectorData.layerName = ph['layerName'];
		vectorData.key = ph['key'];
		vectorData.mapSessionKey = ph['mapSessionKey'];
		vectorData.tileSenderPrefix = "http://" + vectorData.hostName + "/" + 
			"TileSender.ashx?WrapStyle=None" + 
			"&MapName=" + vectorData.mapName + 
			"&LayerName=" + vectorData.layerName + 
			(vectorData.key ? ("&key=" + encodeURIComponent(vectorData.key)) : "") +
			(vectorData.mapSessionKey ? ("&MapSessionKey=" + vectorData.mapSessionKey) : "");
		if(ph['observeType']) vectorData.observeType = ph['observeType'];
		if(ph['geomType']) vectorData.geomType = ph['geomType'];
		self.utils.getLayerPropreties(vectorData, function(layer) {
			var prop = layer.properties;
			if(prop) {
				vectorData.properties = prop;
				var pt = gmxAPIutils.getTilesBounds(prop.tiles, prop.tilesVers);
				vectorData['tiles'] = pt['tiles'];
				vectorData['tilesVers'] = pt['tilesVers'];
				vectorData['needLoad'] = pt['tilesVers'];
				vectorData.onMoveEnd();
//vectorData.callback(layer);
//vectorData.callback(gmxAPIutils.clone(vectorData['tiles']));
			} else {
				vectorData.callback(layer);
			}
		});
	}
	,'onMoveEnd': function(ph) {					// Изменился видимый extent
		if(ph) vectorData.currPosition = ph;
		var extent = vectorData.currPosition.extent;
		var arr = [[extent.minX, extent.minY], [extent.maxX, extent.maxY]];
		//if(vectorData['observeType'] == 'onCentre') arr = [[extent.x - delta, extent.y - delta], [extent.x + delta, extent.y + delta]];
//vectorData.callback(arr);

		vectorData.currBounds = gmxAPIutils.bounds(arr);
		vectorData.chkLoadTiles();
	}
	,'chkLoadTiles': function() {					// Проверка необходимости загрузки тайлов
		var inLoad = false;
		for (var key in vectorData['needLoad'])
		{
			var tb = vectorData['tiles'][key];
			if(tb.intersects(vectorData.currBounds)) {
				vectorData.loadTile(tb);
				inLoad = true;
			}
		}
		if(!inLoad) vectorData.chkTilesData();
	}
	,'loadTile': function(tb) {						// загрузка тайла
		var gmxTileKey = tb['gmxTileKey'];
		var tver = vectorData['tilesVers'][gmxTileKey];
		var url = vectorData['tileSenderPrefix'];
		url += '&ModeKey=tile&r=t';
		url += '&z=' + tb.gmxTilePoint['z'];
		url += '&x=' + tb.gmxTilePoint['x'];
		url += '&y=' + tb.gmxTilePoint['y'];
		url += '&v=' + tver;
		var pt = {
			'url': url
			,'callback': function(st) {
				vectorData['tilesGeometry'][gmxTileKey] = JSON.parse(st);
				vectorData.observerTiles[gmxTileKey] = true;
				vectorData.chkTilesData();
			}
			,'onError': function(st) {
				vectorData.callback({'error': st, 'gmxTileKey': gmxTileKey});
			}
		};
		delete vectorData['needLoad'][gmxTileKey];
		self.utils.request(pt);
	}
	,'chkItem': function(item) {					// подготовка обьекта векторного
		gmxAPIutils.itemBounds(item);
		//vectorData.callback(gmxAPIutils.clone(item.bounds));
	}
	,'chkTilesData': function() {					// Проверка необходимости загрузки тайлов
		if(vectorData.observerTimer) clearTimeout(vectorData.observerTimer);
		vectorData.observerTimer = setTimeout(vectorData.chkOutData, 50);
	}
	,'removeTile': function(key, out) {				// тайл убран из области видимости
		var items = vectorData['tilesGeometry'][key];
		if(items) {
			for (var i = 0, len = items.length; i < len; i++)
			{
				var item = items[i];
				var id = item['id'];
				var oid = id + '_' + key;
				if(vectorData['observerObj'][oid]) out.push({
					'onExtent': false
					,'id': id
					,'tid': oid
					,'LayerName': vectorData.layerName
				});
				delete vectorData['observerObj'][oid];
			}
		}
	}
	,'chkOutData': function() {						// Вывод обьектов изменивших видимость 
		var out = {'timeStamp': new Date().getTime() };
		var arr = [];
		var chkTilesList = {};
		for (var key in vectorData['tiles'])
		{
			var tb = vectorData['tiles'][key];
			if(tb.intersects(vectorData.currBounds)) {		// тайл в области видимости
				chkTilesList[key] = true;
			} else if(vectorData['observerTiles'][key]) {	// тайл был в области видимости
				vectorData.removeTile(key, arr);
			}
		}
		vectorData['observerTiles'] = chkTilesList;

		for (var key in vectorData['observerTiles'])
		{
			var tb = vectorData['tiles'][key];
			if(tb.intersects(vectorData.currBounds)) {
				var items = vectorData['tilesGeometry'][key];
				if(!items) continue;
				for (var i = 0, len = items.length; i < len; i++)
				{
					var item = items[i];
					var id = item['id'];
					var oid = id + '_' + key;
					var flag = (vectorData['observerObj'][oid] ? true : false);
					if(!item.bounds) vectorData.chkItem(item); // подготовка bounds векторного обьекта
					if(item.bounds.intersects(vectorData.currBounds)) {
						if(flag) continue;
						arr.push({
							'onExtent': true
							,'id': id
							,'tid': oid
							,'properties': item['properties']
							,'geometry': item['geometry']
							,'LayerName': vectorData.layerName
						});
						vectorData['observerObj'][oid] = true;
					} else {
						if(!flag) continue;
						arr.push({
							'onExtent': false
							,'id': id
							,'tid': oid
							,'LayerName': vectorData.layerName
						});
						delete vectorData['observerObj'][oid];
					}
				}
			}
		}
		out['timeStamp1'] = new Date().getTime();
		out['arr'] = arr;
		if(arr.length) vectorData.callback(out);
		arr = null;
		out = null;
	}
}
