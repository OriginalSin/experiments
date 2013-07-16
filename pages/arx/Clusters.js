//Управление клиентской кластеризацией 
(function()
{
	var countKeyName = gmxAPI.KOSMOSNIMKI_LOCALIZED("Количество", "Count");
	var RenderStyle = {		// стили кластеров
		marker: { image: 'http://images.kosmosnimki.ru/clusters/cluster_circ.png', center: true, minScale: 0.5, maxScale: 2, scale: '['+countKeyName+']/50' },
		label: { size: 12, align:'center', color: 0xff00ff, haloColor: 0xffffff, value:'[Метка]', field: countKeyName }
	};
	var HoverStyle = {		// стили кластеров при наведении
		marker: { image: 'http://images.kosmosnimki.ru/clusters/cluster_circ_hov.png', center: true, minScale: 0.5, maxScale: 2, scale: '['+countKeyName+']/50' },
		label: { size: 12, align:'center', color: 0xff0000, haloColor: 0xffffff, value:'[Метка]', field: countKeyName }
	};

	var newProperties = {						// Заполняемые поля properties кластеров
	};
	newProperties[countKeyName] = '[objectInCluster]';	// objectInCluster - количество обьектов попавших в кластер (по умолчанию 'Количество')

	var defaultAttr = {
		'radius': 20,
		'iterationCount': 1,
		'newProperties': newProperties,			// Заполняемые поля properties кластеров
		'RenderStyle': RenderStyle,				// стили кластеров
		'HoverStyle': HoverStyle,				// стили кластеров при наведении
		'clusterView': {},						// Атрибуты отображения членов кластера (при null не отображать)
		'visible': false
	};
	
	var _chkAttr = function(data)
	{
		if(data['radius'] < 1) data['radius'] = 20;
		if(!data['RenderStyle']) data['RenderStyle'] = RenderStyle;
		if(!data['HoverStyle']) data['HoverStyle'] = HoverStyle;
		if(!data['clusterView']) data['clusterView'] = {};
		if(!data['newProperties']) data['newProperties'] = newProperties;
		return data;
	}

	var Clusters =	function(parent)		// атрибуты кластеризации потомков
	{
		this._parent = parent;
		this._attr = gmxAPI.clone(defaultAttr);

		// Добавление прослушивателей событий
		var me = this;
		var evID = null;
		var chkFilter = function(data)
		{
			if(evID) parent.parent.removeListener('onLayer', evID);
			var filter = me._parent;
			if(!filter['clusters'] || !filter['clusters']['attr']) return;	// Кластеризация не устанавливалась
			filter.setClusters(filter['clusters']['attr']);
		}
		evID = parent.parent.addListener('onLayer', chkFilter); // Отложенная установка кластеризации

	};
	Clusters.prototype = {
		'_chkToFlash':	function() {
			if(this._attr.visible && this._parent) gmxAPI._cmdProxy('setClusters', { 'obj': this._parent, 'attr': this._attr });
		}
		,
		'setClustersBalloon':	function(func) {
			this.textFunc = func;
		}
		,
		'getTextFunc':	function() {
			var me = this;
			return this.textFunc || function(o, div)
			{
				var text = "";
				var nProp = me.getProperties();
				var props = o.properties;
				for (var key in nProp)
				{
					var value = "" + props[key];
					if (value.indexOf("http://") == 0)
						value = "<a href='" + value + "'>" + value + "</a>";
					else if (value.indexOf("www.") == 0)
						value = "<a href='http://" + value + "'>" + value + "</a>";
					text += "<b>" + key + ":</b> " + value + "<br />";
				}
				return text;
			}
		},
		'setProperties':function(prop) { var out = {}; for(key in prop) out[key] = prop[key]; this._attr.newProperties = out; this._chkToFlash(); },
		'getProperties':function() { var out = {}; for(key in this._attr.newProperties) out[key] = this._attr.newProperties[key]; return out; },
		'setStyle':		function(style, hoverStyle) { this._attr.RenderStyle = style; this._attr.HoverStyle = (hoverStyle ? hoverStyle : style); this._chkToFlash(); },
		'getStyle':		function() { var out = {}; if(this._attr.RenderStyle) out.RenderStyle = this._attr.RenderStyle; if(this._attr.HoverStyle) out.HoverStyle = this._attr.HoverStyle; return out; },
		'setRadius':	function(radius) { this._attr.radius = radius; this._chkToFlash(); },
		'getRadius':	function() { return this._attr.radius; },
		'setIterationCount':	function(iterationCount) { this._attr.iterationCount = iterationCount; this._chkToFlash(); },
		'getIterationCount':	function() { return this._attr.iterationCount; },
		'getVisible':	function() { return this._attr.visible; },
		'setVisible':	function(flag) { this._attr.visible = (flag ? true : false); if(this._attr.visible) this._chkToFlash(); else gmxAPI._cmdProxy('delClusters', { 'obj': this._parent }); },
		'setClusterView':	function(hash) { this._attr.clusterView = hash; this._chkToFlash(); },
		'getClusterView':	function() { if(!this._attr.clusterView) return null; var out = {}; for(key in this._attr.clusterView) out[key] = this._attr.clusterView[key]; return out; }
	};

	//расширяем namespace
    gmxAPI._Clusters = Clusters;
    gmxAPI._getDefaultClustersAttr = function() { return defaultAttr; }
	
	//расширяем FlashMapObject
	gmxAPI.extendFMO('setClusters', function(attr) { var ph = (attr ? _chkAttr(attr) : this._attr); return gmxAPI._cmdProxy('setClusters', { 'obj': this, 'attr': ph }); });
	gmxAPI.extendFMO('delClusters', function() { 	if(this.clusters && this.clusters.attr) delete this.clusters.attr; return gmxAPI._cmdProxy('delClusters', { 'obj': this }); });
})();