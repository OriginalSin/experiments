/** Плагин для интеграции в ГеоМиксер данных NASA Global Imagery Browse Services (GIBS)
*/
(function ($){

var NASA_URL_PREFIX = 'https://map1a.vis.earthdata.nasa.gov/wmts-webmerc/{layerName}/default/{dateStr}/GoogleMapsCompatible_Level{layerZoom}/{z}/{y}/{x}.jpg';
var NASA_LAYERS = {
    MODIS_Terra_CorrectedReflectance_TrueColor: {zoom: 9, title: 'Terra Corrected TrueColor'},
    MODIS_Terra_CorrectedReflectance_Bands721:  {zoom: 9, title: 'Terra Corrected Bands 721'},
    MODIS_Terra_CorrectedReflectance_Bands367:  {zoom: 9, title: 'Terra Corrected Bands 367'},
    MODIS_Aqua_CorrectedReflectance_TrueColor:  {zoom: 9, title: 'Aqua Corrected TrueColor'},
    MODIS_Aqua_CorrectedReflectance_Bands721:   {zoom: 9, title: 'Aqua Corrected Bands 721'},
    
    MODIS_Terra_SurfaceReflectance_Bands143:    {zoom: 8, title: 'Terra Surface Bands 143'},
    MODIS_Terra_SurfaceReflectance_Bands721:    {zoom: 8, title: 'Terra Surface Bands 721'},
    MODIS_Terra_SurfaceReflectance_Bands121:    {zoom: 9, title: 'Terra Surface Bands 121'},
    MODIS_Aqua_SurfaceReflectance_Bands143:     {zoom: 8, title: 'Aqua Surface Bands 143'},
    MODIS_Aqua_SurfaceReflectance_Bands721:     {zoom: 8, title: 'Aqua Surface Bands 721'},
    MODIS_Aqua_SurfaceReflectance_Bands121:     {zoom: 9, title: 'Aqua Surface Bands 121'},
    
    VIIRS_CityLights_2012: {zoom: 8, title: 'VIIRS City Lights 2012'}
};

var gibsLayers = [];
 
var publicInterface = {
    pluginName: 'GIBS Plugin',
    
    //параметры: layer (может быть несколько) - имя слоя в GIBS
	afterViewer: function(params, map)
    {
        params = $.extend({
            layer: ['MODIS_Terra_CorrectedReflectance_TrueColor']
        }, params);
        
        if (!$.isArray(params.layer)) {
            params.layer = [params.layer];
        }
        
        var calendar = nsGmx.widgets.commonCalendar.get();
        
        gibsLayers.push(
            L.tileLayer.GIBSLayer(NASA_URL_PREFIX, {
                calendar: calendar
            }).addTo(nsGmx.leafletMap)
        );
        params.layer.length && nsGmx.widgets.commonCalendar.show();
    },
    
    unload: function() {
        gibsLayers.forEach(function(layer) { nsGmx.leafletMap.removeLayer(layer); });
    }
}

gmxCore.addModule('GIBSPlugin', publicInterface);

var addTileUrlMixin = function(BaseClass) {
    return BaseClass.extend({
        getTileUrl: function (tilePoint) {
            var layerName = this.options.layerName || 'MODIS_Terra_CorrectedReflectance_TrueColor',
                calendar = this.options.calendar,
                layerZoom = (NASA_LAYERS[layerName] && NASA_LAYERS[layerName].zoom) || 7;
                
            var dateStr = $.datepicker.formatDate('yy-mm-dd', nsGmx.Calendar.toUTC(calendar.getDateEnd()));
            var size = Math.pow(2, tilePoint.z - 1);
            return L.Util.template(this._url, L.extend({
                layerName: layerName,
                dateStr: dateStr,
                layerZoom: layerZoom,
                z: tilePoint.z,
                x: tilePoint.x,
                y: tilePoint.y
            }, this.options));
        }
    })
};
L.TileLayer.GIBSLayer = addTileUrlMixin(L.TileLayer);

L.tileLayer.GIBSLayer = function (url, options) {
    return new L.TileLayer.GIBSLayer(url, options);
};

})(jQuery);