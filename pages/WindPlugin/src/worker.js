self.onmessage = function (e) {
    //console.log('onmessage', e);
	//importScripts('http://mourner.github.com/worker-data-load/test.js');
	//self.postMessage(e.data.style.icon.data);
	self.postMessage(e.data);
};
