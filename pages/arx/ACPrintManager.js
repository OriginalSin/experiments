//Поддержка Печати
(function()
{
	/**
	 * Class for working with browser printing
	 * @see http://www.anychart.com/blog/projects/acprintmanagerlibrary/
	 * @version 0.1
	 * @author Alex Batsuev (alex(at)sibental(dot)com)
	 */
	var ACPrintManager = function() {}

	ACPrintManager.isIE = function() {
		return gmxAPI.isIE;
	}

	ACPrintManager.initIE = function(objId) {
		var obj = document.getElementById(objId);
		if (obj == null) return;
		if (obj.onBeforePrint == undefined || obj.onAfterPrint == undefined) return;
		
		window.attachEvent("onbeforeprint",function(e) {
			
			obj.setAttribute("tmpW",obj.width);
			obj.setAttribute("tmpH",obj.height);
			
			var size = ACPrintManager.getContentSize(obj);
			
			obj.width = size.width;
			obj.height = size.height;
			
			obj.onBeforePrint();
			
			if (obj.getAttribute("tmpW").indexOf("%") != -1 ||
				obj.getAttribute("tmpH").indexOf("%") != -1) {
				//ie percent width or height hack
				obj.focus();
			}
		});
		window.attachEvent("onafterprint",function() {
			obj.onAfterPrint();
			obj.width = obj.getAttribute("tmpW");
			obj.height = obj.getAttribute("tmpH");
		});
	} 

	ACPrintManager.initFF = function(objId, imgData) {

		if (gmxAPI.isIE)
			return;

		var obj = document.getElementById(objId);
		if (obj == null && document.embeds != null) obj = document.embeds[objId];
		if (obj == null) return;
		
		//step #1: get parent node
		var parent = obj.parentNode;
		if (parent == null) return;
		
		//step #2: get header
		var head = document.getElementsByTagName('head');
		head = ((head.length != 1) ? null : head[0]);
		
		//step #3: write normal css rule		
		var style = document.createElement('style');
		style.setAttribute('type','text/css');
		style.setAttribute('media','screen');
		
		var size = ACPrintManager.getContentSize(obj);
		
		var imgDescriptor = 'img#'+objId+'_screen';
		var imgRule = "width: "+size.width+";\n"+
					  "height: "+size.height+";\n"+
					  "padding: 0;\n"+
					  "margin: 0;\n"+
					  "border: 0;\n"+
					  "display: none;";
		style.appendChild(document.createTextNode(imgDescriptor + '{' + imgRule + "}\n"));
		//add style to head
		head.appendChild(style);

		//step #4: write print css rule
		style = document.createElement('style');
		style.setAttribute('type','text/css');
		style.setAttribute('media','print');
		
		//write image style
		imgDescriptor = 'img#'+objId+'_screen';
		imgRule = 'display: block;';
		
		style.appendChild(document.createTextNode(imgDescriptor + '{' + imgRule + '}'));
		
		//write object style
		var objDescriptor = 'embed#'+objId;
		var objRule = 'display: none;';
		style.appendChild(document.createTextNode(objDescriptor + '{' + objRule + '}'));
		
		//add style to head
		head.appendChild(style);

		//step #5: get image
		var needAppend = false;
		var img = document.getElementById('img');
		if (img == null) {
			img = document.createElement('img');
			needAppend = true;
		}
		
		img.src = 'data:image/png;base64,'+imgData;
		img.setAttribute('id',objId+"_screen");
		if (needAppend)
			parent.appendChild(img);
	}

	ACPrintManager.getContentSize = function(obj) {
		var size = {};
		size.width = obj.width;
		size.height = obj.height;
		if (obj.getWidth != undefined) size.width = obj.getWidth()+'px';
		if (obj.getHeight != undefined) size.height = obj.getHeight()+'px';
		return size;
	}
    //расширяем namespace
    window.ACPrintManager = 
    gmxAPI.ACPrintManager = ACPrintManager;
})();
