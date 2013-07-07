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
