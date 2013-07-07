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