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
