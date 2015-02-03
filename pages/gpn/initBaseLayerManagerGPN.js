/*
 * initBaseLayers manager for GazPromN
 */
L.gmxBaseLayersManager.prototype.initDefaults = function (attr) {
    var blm = this,
        zIndexOffset = 2000000,
        //mapID = attr && attr.mapID ? attr.mapID : '1D30C72D02914C5FB90D1D448159CAB6',
        mapID = attr && attr.mapID ? attr.mapID : '7CA423DDBF9245BD927ACC36F55D4B99',
        hostName = '',
        lang = L.gmxLocale.getLanguage(),
        _gtxt = function (key) {
            return L.gmxLocale.getText(key) || key;
        },
        getURL = function(type) {
            return 'http://{s}.tile.cart.kosmosnimki.ru/' + type + '/{z}/{x}/{y}.png';
        },
        getOSMURL = function(type) {
            return 'http://{s}.tile.osm.kosmosnimki.ru/kosmo' + (lang === 'rus' ? '' : '-en') + '/{z}/{x}/{y}.png';
        };

    var prefix = 'maps.kosmosnimki.ru/';
    (function() {
        if (window.location.href.indexOf("testemis01.gazprom-neft.local") != -1) {
            prefix = "testemis01.gazprom-neft.local/kosmosnimki/";
        } else if (window.location.href.indexOf("spb99-emis01.gazprom-neft.local") != -1) {
            prefix = "spb99-emis01.gazprom-neft.local/kosmosnimki/";
        } else if (window.location.href.indexOf("gazprom-neft.local") != -1) {
            prefix = "spb99-emis01.gazprom-neft.local/kosmosnimki/";
        } else {
            return;
        }
        getURL = function(type) {
            return 'http://' + prefix + 'cart/{s}/'+type+'/{z}/{x}/{y}.png';
        };
        getOSMURL = function() {
            return 'http://' + prefix + 'osm/{s}{z}/{x}/{y}.png';
        };
    })();
    
    var copyrights = {
        collinsbartholomew: "&copy; <a href='http://www.collinsbartholomew.com/'>Collins Bartholomew Ltd.</a>"
        ,geocenter: "&copy; <a href='http://www.geocenter-consulting.ru/'>" + _gtxt('ЗАО «Геоцентр-Консалтинг»', 'Geocentre-Consulting') + "</a>"
        ,openStreetMap: "&copy; " + _gtxt('участники OpenStreetMap <a href="http://www.openstreetmap.org/copyright">ODbL</a>', 'OpenStreetMap contributers <a href="http://opendatacommons.org/licenses/odbl/">ODbL</a>')
        ,cgiar: "&copy; <a href='http://srtm.csi.cgiar.org/'>CGIAR-CSI</a>"
        ,'2gis': "&copy; <a href='http://help.2gis.ru/api-rules/#kart'>" + _gtxt('ООО «ДубльГИС»','2GIS') + "</a>"
        ,naturalearthdata: "&copy; <a href='http://www.naturalearthdata.com/'>Natural Earth</a>"
        ,nasa: "&copy; <a href='http://www.nasa.gov'>NASA</a>"
        ,earthstar: "&copy; <a href='http://www.es-geo.com'>Earthstar Geographics</a>"
        ,antrix: "&copy; <a href='http://www.antrix.gov.in/'>ANTRIX</a>"
        ,geoeye: "&copy; <a href='http://www.geoeye.com'>GeoEye Inc.</a>"
    };
    var getCopyright2 = function() {
        return [
            {minZoom: 1, maxZoom: 7, attribution: copyrights.collinsbartholomew + ', ' + _gtxt('2014', '2012')}
            ,{minZoom: 1, maxZoom: 7, attribution: copyrights.naturalearthdata + ', 2013'}
            ,{minZoom: 8, maxZoom: 17, attribution: copyrights.openStreetMap}
        ];
    }
    
    var iconPrefix = 'http://' + prefix + 'maps/api/img/baseLayers/';

    var baseLayers = {
        OSM: {
            icon: iconPrefix + 'basemap_osm_' + (lang === 'rus' ? 'ru' : '-eng') + '.png',
            layers:[
                L.tileLayer(getOSMURL(), {
                    maxZoom: 18,
                    gmxCopyright: getCopyright2()
                })
            ]
        }
    };

    if (prefix !== 'maps.kosmosnimki.ru/') {
        hostName = prefix + 'maps';
        attr = {
            hostName: hostName,
            mapID: mapID,
            apiKey: 'J1M7SITY5X'
        };
    }

    var layersGMX = [
        {
            mapID: mapID,
            layerID: 'B293E8FA41D14E18B13D450165017F64',  // satellite
            type: 'satellite',
            rus: 'Снимки',
            eng: 'Satellite',
            overlayColor: '#ffffff',
            icon: iconPrefix + 'basemap_satellite.png'
        }
    ];
    if (hostName) layersGMX[0].hostName = hostName;

    if (lang === 'rus') {
        baseLayers.map = { rus: 'Карта', eng: 'Map',
            icon: iconPrefix + 'basemap_rumap.png',
            layers:[
                L.tileLayer.Mercator(getURL('m'), {
                    maxZoom: 19,
                    maxNativeZoom: 17,
                    gmxCopyright: [
                        { minZoom: 1, maxZoom: 9, attribution: copyrights.collinsbartholomew + _gtxt(", 2014",", 2012") }
                        ,{ minZoom: 1, maxZoom: 17, attribution: copyrights.geocenter + ", 2014", bounds: [[40, 29], [80, 180]] }
                    ]
                })
            ]
        };
    } else {
        layersGMX.push({mapID: mapID, layerID: '5269E524341E4E7DB9D447C968B20A2C', type: 'map', rus: 'Карта', eng: 'Map', icon: iconPrefix + 'basemap_rumap.png'});     // rumap
        layersGMX.push({mapID: mapID, layerID: 'BCCCE2BDC9BF417DACF27BB4D481FAD9', type: 'hybrid', rus: 'Гибрид', eng: 'Hybrid'});    // hybrid
        if (hostName) layersGMX[1].hostName = layersGMX[2].hostName = hostName;
    }
    var def = new L.gmx.Deferred();
    
    var map = blm._map;
    //L.gmx.loadMap(mapID, {leafletMap: map, setZIndex: true, apiKey: 'J1M7SITY5X'}).then(function(gmxMap) {
    L.gmx.loadMap(mapID, {leafletMap: map, apiKey: 'J1M7SITY5X'}).then(function(gmxMap) {
        var layerByLayerID = gmxMap.layersByID,
            ikonosGPN = null,
            overlay = null;

        for (var i = 0, len = layersGMX.length; i < len; i++) {
            var info = layersGMX[i],
                type = info.type;
            if (type === 'hybrid') continue;
            baseLayers[type] = {
                rus: info.rus,
                eng: info.eng,
                icon: info.icon,
                overlayColor: info.overlayColor || '#00',
                layers:[layerByLayerID[info.layerID]]
            };
            if (type === 'satellite') {
                ikonosGPN = gmxMap.layersByTitle['Каталог Ikonos для Газпром-Нефть'];
                //ikonosGPN = layerByLayerID['Вставить ID'];    // Вставить ID слоя "Каталог Ikonos для Газпром-Нефть"
                ikonosGPN.options.clickable = false;
                
                baseLayers[type].layers.push(ikonosGPN);

                var satellite = layerByLayerID[info.layerID];       // satellite
                if(lang === 'rus') {
                    overlay = L.tileLayer.Mercator(getURL('o'), {               // rus Overlay
                        maxZoom: 19,
                        maxNativeZoom: 17,
                        clickable: false
                    });
                } else {
                    overlay = layerByLayerID['BCCCE2BDC9BF417DACF27BB4D481FAD9'];    // eng Overlay
                    overlay.options.clickable = false;
                }
                baseLayers.hybrid = {
                    rus: 'Гибрид',
                    eng: 'Hybrid',
                    overlayColor: '#ffffff',
                    icon: iconPrefix + 'basemap_hybrid.png',
                    layers: [
                        satellite        // satellite
                        ,
                        ikonosGPN
                        ,
                        overlay
                    ]
                };
            }
        }
        for(var id in baseLayers) {
            var baseLayer = baseLayers[id];
            if (!baseLayer.rus) baseLayer.rus = id;
            if (!baseLayer.eng) baseLayer.eng = id;
            blm.add(id, baseLayer);
        }
        def.resolve();
    });
    return def;
};

