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
