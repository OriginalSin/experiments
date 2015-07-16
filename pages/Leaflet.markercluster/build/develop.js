(function() {
    var depsFilename = 'deps.js';

	function getScriptPath() {
		var scripts = document.getElementsByTagName('script');
		for (var i = 0; i < scripts.length; i++) {
			var src = scripts[i].src;
			if (src) {
				var res = src.match(/^(.*)develop\.js/);
				if (res) {
					return res[1];
				}
			}
		}
	}

	var basePath = getScriptPath();
    
    window.devOnLoad = function(depsJS) {
        var srcPath = basePath + '../src/';
        for (var key in depsJS) {
            var h = depsJS[key];
            for (var i = 0; i < h.src.length; i++) {
                document.writeln("<script src='" + srcPath + h.src[i] + "'></script>");
            }
        }
    }
    
    document.writeln("<script src='" + basePath + depsFilename + "'></script>");
})();