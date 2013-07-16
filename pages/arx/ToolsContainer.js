//Управление tools контейнерами
(function()
{
	/** Класс управления tools контейнерами
	* @function
	* @memberOf api
	* @param {name} ID контейнера
	* @param {attr} Hash дополнительных атрибутов
	*		ключи:
	*			contType: Int - тип контейнера (по умолчанию 0)
	*					0 - стандартный пользовательский тип контейнера 
	*					1 - тип для drawing вкладки
	*					2 - тип для вкладки базовых подложек
	*           notSticky: 0 - по умолчанию, инструмент выключается только после повторного нажатия или выбора другого инструмента.
						   1 - автоматически выключать инструмент полсе активации
	*			properties: Hash - properties DIV контейнера (по умолчанию { 'className': 'tools_' + name })
	*			style: Hash - стили DIV контейнера (по умолчанию { 'position': "absolute", 'top': 40 })
	*			regularStyle: Hash - регулярного стиля DIV элементов в контейнере (по умолчанию { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold",	textAlign: "center", cursor: "pointer", opacity: 1, color: "wheat" })
	*			activeStyle: Hash - активного стиля DIV элементов в контейнере (по умолчанию { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold",	textAlign: "center", cursor: "pointer", opacity: 1, color: "orange" })
	*/
	function ToolsContainer(name, attr)
	{
		if(!attr) attr = {};
		var aliasNames = {};		// Hash алиасов основных подложек для map.setMode
		var toolNames = [];
		var toolHash = {};
		var activeToolName = '';
		var my = this;

		var notSticky = (attr['notSticky'] ? attr['notSticky'] : 0);
		var contType = (attr['contType'] ? attr['contType'] : 0);
		var independentFlag = (contType == 0 ? true : false);
		var notSelectedFlag = (contType != 1 ? true : false);
		var currentlyDrawnObject = false;

		if(!name) name = 'testTool';

		var properties = (attr['properties'] ? attr['properties'] : {});
		if(!properties['className']) {			// className по умолчанию tools_ИмяВкладки
			properties['className'] = 'tools_' + name;
		}

		var style = { "display": 'block', 'marginLeft': '4px', 'padding': '4px 0' };

		// Установка backgroundColor c alpha
		if(gmxAPI.isIE && document['documentMode'] < 10) {
			style['filter'] = "progid:DXImageTransform.Microsoft.gradient(startColorstr=#7F016A8A,endColorstr=#7F016A8A)";
			style['styleFloat'] = 'left';
		}
		else 
		{
			style['backgroundColor'] = "rgba(1, 106, 138, 0.5)";
			style['cssFloat'] = 'left';
		}

		if(attr['style']) {
			for(key in attr['style']) style[key] = attr['style'][key];
		}

		var toolsContHash = gmxAPI._toolsContHash;

		var gmxTools = gmxAPI.newElement('div', properties, style);
		gmxAPI._allToolsDIV.appendChild(gmxTools);
		toolsContHash[name] = gmxTools;

		// стили добавляемых юзером элементов tool
		var regularStyle = { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center", cursor: "pointer", opacity: 1, color: "wheat"	};
		if(attr['regularStyle']) {		// дополнение и переопределение стилей
			for(key in attr['regularStyle']) regularStyle[key] = attr['regularStyle'][key];
		}
		var activeStyle = { paddingTop: "4px", paddingBottom: "4px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", fontFamily: "sans-serif", fontWeight: "bold", textAlign: "center", cursor: "pointer", opacity: 1, color: "orange"	};
		if(attr['activeStyle']) {
			for(key in attr['activeStyle']) activeStyle[key] = attr['activeStyle'][key];
		}

		var toolsContainer = gmxAPI.newElement("table", {}, {'borderCollapse': 'collapse'});
		gmxTools.appendChild(toolsContainer);
		var tBody = gmxAPI.newElement("tbody", {}, {});
		toolsContainer.appendChild(tBody);

		var setActiveTool = function(toolName)
		{
			for (var id in toolHash) {
				var tool = toolHash[id];
				if (tool)  {
					tool.isActive = (id == toolName ? true : false);
				}
			}
			my.activeToolName = activeToolName = toolName;
			this.repaint();			
		}
		this.setActiveTool = setActiveTool;
		
		var selectTool = function(toolName)
		{
			if (name == 'standart') {	// только для колонки 'standart'
				if (toolName == activeToolName) toolName = (toolNames.length > 0 ? toolNames[0] : '');	// если toolName совпадает с активным tool переключаем на 1 tool

				// При draw обьектов
				if (currentlyDrawnObject && 'stopDrawing' in currentlyDrawnObject) {
					currentlyDrawnObject.stopDrawing();
				}
				currentlyDrawnObject = false;
			}

			var oldToolName = activeToolName;
			var tool = toolHash[oldToolName];


			if (tool && contType != 0) {
				if ('onCancel' in tool) tool.onCancel();
				tool.repaint();
			}

			activeToolName = (notSelectedFlag && toolName == oldToolName ? '' : toolName);

			tool = toolHash[toolName];
			if(tool) {
				if (contType == 0) {								// для добавляемых юзером меню
					if (tool.isActive) {
						if ('onCancel' in tool) tool.onCancel();
					} else {
						if ('onClick' in tool) tool.onClick();
					}
					tool.repaint();
				} else if (contType == 1) {							// тип для drawing
					if ('onClick' in tool) {
						currentlyDrawnObject = tool.onClick();
						tool.repaint();
					} else {
						currentlyDrawnObject = false;
					}
				} else if (contType == 2) {							// тип для подложек
					if ('onClick' in tool && toolName != oldToolName) {
						tool.onClick();
						tool.repaint();
					}
				}
				
				if (notSticky == 1){
					// Если интструмент включен, сразу же выключите его.
					if (tool.isActive) {
						if ('onCancel' in tool) tool.onCancel();
						tool.isActive = false;
					}
				}
			}
		}
		this.selectTool = selectTool;
		
		function forEachObject(callback)
		{
			for (var id in toolHash)
				callback(toolHash[id]);
		}
		this.forEachObject = forEachObject;

		function getToolByName(tn)
		{
			if(!toolHash[tn]) return false;
			
			return toolHash[tn];
		}
		this.getToolByName = getToolByName;

		function getAliasByName(tn)
		{
			for (var key in toolHash) {
				var tool = toolHash[key];
				var alias = tool['alias'] || key;
				if(alias === tn) return alias;
				else if(tool['lang']) {
					for (var lang in tool['lang']) {
						if(tool['lang'][lang] === tn) return alias;
					}
				}
			}
			return null;
		}
		this.getAliasByName = getAliasByName;
		
		function setVisible(flag)
		{
			gmxAPI.setVisible(gmxTools, flag);
			this.isVisible = flag;
		}
		this.setVisible = setVisible;

		function repaint()
		{
			for (var id in toolHash) {
				var tool = toolHash[id];
				if (tool)  {
					tool.repaint();
				}
			}
		}
		this.repaint = repaint;
		function updateVisibility()
		{
		}
		this.updateVisibility = updateVisibility;

		function remove()
		{
			gmxAPI._allToolsDIV.removeChild(gmxTools);
		}
		this.remove = remove;

		function chkBaseLayerTool(tn, attr)
		{
			if (toolHash[tn]) return false;
			else {
				if(!attr)  {
					attr = {
						'onClick': function() { gmxAPI.map.setBaseLayer(tn); },
						'onCancel': function() { gmxAPI.map.unSetBaseLayer(); },
						'onmouseover': function() { this.style.color = "orange"; },
						'onmouseout': function() { this.style.color = "white"; },
						'hint': tn
					};
				}
				return addTool(tn, attr);
			}

		}
		this.chkBaseLayerTool = chkBaseLayerTool;

		function getAlias(tn)
		{
			return aliasNames[tn] || tn;
		}
		this.getAlias = getAlias;

		function addTool(tn, attr)
		{
			var tr = gmxAPI.newElement("tr", {	"className": 'tools_tr_' + name + '_' + tn	});
			tBody.appendChild(tr);
			var td = gmxAPI.newElement("td", null, { padding: "4px", cursor: "pointer" });		// { padding: "4px", textAlign: "center" }
			tr.appendChild(td);

			var elType = 'img';
			var elAttr = {
				title: attr['hint'],
				onclick: function() { selectTool(tn); }
			};
			if(!attr['alias']) attr['alias'] = tn
			aliasNames[attr['alias']] = tn;

			if(!('onClick' in attr)) attr['onClick'] = function() { gmxAPI.map.setMode(tn); };
			if(!('onCancel' in attr)) attr['onCancel'] = function() { gmxAPI.map.unSetBaseLayer(); };
			
			var setStyle = function(elem, style) {
				for (var key in style)
				{
					var value = style[key];
					elem.style[key] = value;
					if (key == "opacity") elem.style.filter = "alpha(opacity=" + Math.round(value*100) + ")";
				}
			}

			var myActiveStyle = (attr.activeStyle ? attr.activeStyle : activeStyle);
			var myRegularStyle = (attr.regularStyle ? attr.regularStyle : regularStyle);
			var repaintFunc = null;
			if('regularImageUrl' in attr) {
				elAttr['onmouseover'] = function()	{ this.src = attr['activeImageUrl']; };
				repaintFunc = function(obj) { obj.src = (tn == activeToolName) ? attr['activeImageUrl'] : attr['regularImageUrl'];	};
				elAttr['src'] = attr['regularImageUrl'];
			} else {
				elType = 'div';
				repaintFunc = function(obj) {
					setStyle(obj, (toolHash[tn].isActive ? myActiveStyle : myRegularStyle));
					};
				elAttr['onmouseover'] = function()	{
					setStyle(this, (toolHash[tn].isActive ? myActiveStyle : myRegularStyle));
				};
				elAttr['innerHTML'] = attr['hint'];
			}
			elAttr['onmouseout'] = function()	{
				repaintFunc(this);
			};
			var control = gmxAPI.newElement( elType, elAttr, myRegularStyle);	// tool элемент 

			toolHash[tn] = {
				key: tn,
				alias: attr['alias'] || null,
				lang: attr['lang'] || null,
				backgroundColor: attr['backgroundColor'],
				isActive: false,
				isVisible: true,
				control: control,
				line: tr,
				setVisible: function(flag) {
					this.isVisible = flag;
					var st = 'visible';
					if(flag) {
						tr.style.display = '';
						tr.style.visibility = 'visible';
					} else {
						tr.style.display = 'none';
						tr.style.visibility = 'hidden';
					}
				},
				setToolImage: function(a1, a2) {},
				repaint: function()	{
					repaintFunc(this.control);
					},
				onClick: function()	{
					this.isActive = true;
					my.activeToolName = activeToolName = tn;
					return attr['onClick'].call();
					},
				onCancel: function()	{
					this.isActive = false;
					my.activeToolName = activeToolName = '';
					attr['onCancel'].call();
					},
				select: function() { selectTool(tn); }
			}
			
			td.appendChild(control);

			var pos = (attr['pos'] > 0 ? attr['pos'] : toolNames.length);
			toolNames.splice(pos, 0, tn);
			//positionTools();
			if(!gmxAPI._drawing.tools[tn]) gmxAPI._drawing.tools[tn] = toolHash[tn];
			return toolHash[tn];
		}
		this.addTool = addTool;

		function getToolIndex(tn)
		{
			for (var i = 0; i<toolNames.length; i++)
			{
				if(tn === toolNames[i]) return i;
			}
			return -1;
		}
		this.getToolIndex = getToolIndex;

		function removeTool(tn)
		{
			var num = getToolIndex(tn);
			if(num === -1 || !toolHash[tn]) return false;
			toolNames.splice(num, 1);
			tBody.removeChild(toolHash[tn]['line']);
			delete toolHash[tn];
			if(gmxAPI._drawing.tools[tn]) delete gmxAPI._drawing.tools[tn];
			return true;
		}
		this.removeTool = removeTool;

		function setToolIndex(tn, ind)
		{
			var num = getToolIndex(tn);
			if(num === -1 || !toolHash[tn]) return false;
			toolNames.splice(num, 1);

			var hash = toolHash[tn];
			var obj = tBody.removeChild(hash['line']);

			var len = tBody.children.length;
			if(ind >= len) ind = len - 1;
			
			toolHash[tn]['line'] = tBody.insertBefore(obj, tBody.children[ind]);
			toolNames.splice(i, 0, tn);
			return true;
		}
		this.setToolIndex = setToolIndex;

		
		this.currentlyDrawnObject = currentlyDrawnObject;
		this.activeToolName = activeToolName;
		this.isVisible = true;

		if(!gmxAPI._tools) gmxAPI._tools = {};
		gmxAPI._tools[name] = this;
	}
	//расширяем namespace
    gmxAPI._ToolsContainer = ToolsContainer;
})();
