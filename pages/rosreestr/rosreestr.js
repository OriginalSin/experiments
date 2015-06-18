(function () {
    var cadastreServer = 'http://maps.rosreestr.ru/arcgis/rest/services/',
        out = {},
        prevImageOverlays = [],
        imageOverlay = null;

    var setImageOverlay = function() {
        if (!out.map) return;
        var map = out.map,
            size = map.getSize(),
            bounds = map.getPixelBounds(),
            sw = L.Projection.Mercator.project(map.unproject(bounds.getBottomLeft())),
            ne = L.Projection.Mercator.project(map.unproject(bounds.getTopRight())),
            layerId = out.identify[0].layerId,
            val = out.identify[0].attributes['Строковый идентификатор ИПГУ'];
            
        var params = {
            format: 'png32',
            dpi: 96,
            transparent: true,
            layers: 'show:' + layerId,
            layerDefs: '{"' + layerId + '":"PARCEL_ID LIKE \'' + val + '\'"}',
            size: size.x + ',' + size.y,
            bbox: [sw.x, sw.y + out.shift, ne.x, ne.y + out.shift].join(','),
            imageSR: 102100,
            bboxSR: 102100
        };
        if (layerId === 2) {
            val = out.identify[0].value;
            params.layerDefs = layerId + ':PKK_ID LIKE \'' + val + '\'';
        }

        var imageUrl = cadastreServer + 'Cadastre/CadastreSelected/MapServer/export?f=image';

        for (var key in params) {
            imageUrl += '&' + key + '=' + params[key];
        }
        if (imageOverlay) {
            prevImageOverlays.push(imageOverlay);
        }
        imageOverlay = new L.ImageOverlay.Pane(imageUrl, map.getBounds())
            .on('load', function() {
                prevImageOverlays.map(function(it) {
                    map.removeLayer(it);
                });
                prevImageOverlays = [];
            })
            .addTo(map)
            .setZIndex(99);
    };

    var identifyParse = function(identify) {
        var attr = {
            url: cadastreServer + 'Cadastre/CadastreSelected/MapServer/exts/GKNServiceExtension/online/parcel/find',
            params: {
                f: 'json',
                returnGeometry: 'true'
            }
        };
        var it = identify[0];
        
    //console.log('__', it.displayFieldName);
        if (it.displayFieldName === 'Идентификатор') {
            attr.url = cadastreServer + 'Cadastre/CadastreSelected/MapServer/e2/query';
            attr.params.outFields = '*';
            attr.params.spatialRel = 'esriSpatialRelIntersects';
            attr.params.where = "PKK_ID IN ('" + it.value + "')";
        } else if (it.displayFieldName === 'Идентификатор ПКК') {
            attr.params.cadNums = "['" + it.attributes['Строковый идентификатор ИПГУ'] + "']";
            attr.params.onlyAttributes = 'false';
        }
        return attr;
    };
    var onClickMap = function(ev) {
        var _this = this,
            map = _this._map,
            options = { callbackParamName: 'callback' };
            scale = L.CRS.scale(map.getZoom()),
            pos = map.getCenter(),
            shift = (map.options.crs.project(pos).y - L.CRS.EPSG3395.project(pos).y),
            deltaY = Math.floor(scale * shift / 40075016.685578496);
    //console.log('click', ev);
        var layerId = '',
            latlng = ev.latlng,
            point = L.Projection.Mercator.project(latlng);
        point.y += shift;
        var geometry = '{"x":' + point.x + ',"y":' + point.y + ',"spatialReference":{"wkid":102100}}',
            mapExtent = '{xmin:' + point.x + ',ymin:' + point.y + ',xmax:' + point.x + ',"ymax":' + point.y + ',spatialReference:{wkid:102100}}';

        out.shift = shift;
        out.map = map;

        L.gmxUtil.requestJSONP(
            cadastreServer + 'Cadastre/CadastreSelected/MapServer/identify',
            {
                f: 'json',
                geometry: geometry,
                tolerance: '0',
                returnGeometry: 'false',
                mapExtent: mapExtent,
                imageDisplay: _this.options.size + ',96',
                geometryType: 'esriGeometryPoint',
                sr: '102100',
                layers: layerId || 'top' //top or all or layerId
            }, options
        ).then(function(response) {
    //console.log('identify', response);
            //var cadNums = '';
            if (response && response.results && response.results.length) {
                out.identify = response.results;
                setImageOverlay();

                var attr = identifyParse(out.identify);
                
                var attributes = out.identify[0].attributes;
                //cadNums = attributes['Строковый идентификатор ИПГУ'];
                L.gmxUtil.requestJSONP(attr.url, attr.params, options).then(function(response) {
    //console.log('find', response);
                    if (response && response.features && response.features.length) {
                        out.find = response.features;
                        L.gmxUtil.requestJSONP(
                            cadastreServer + 'Cadastre/TerrAgencies/MapServer/0/query',
                            {
                                f: 'json',
                                where: '',
                                returnGeometry: 'false',
                                spatialRel: 'esriSpatialRelIntersects',
                                outFields: 'NAME,PHONENUMBER,ORG_CODE,ORG_NAME,POSTCODE,SETTLEMENT,STREET,HOUSE,BUILDING',
                                outSR: '102100',
                                inSR: '102100',
                                geometryType: 'esriGeometryPoint',
                                geometry: geometry
                            }, options
                        ).then(function(response) {
                            if (response && response.features && response.features.length) {
                                out.query = response;
                            }
                        });
                    }
                });
            }
        });
    };

    var addImageOverlayPaneMixin = function(BaseClass) {
        return BaseClass.extend({
            options: {
                opacity: 1,
                pane: 'tilePane'
            },
            onAdd: function (map) {
                this._map = map;

                if (!this._image) {
                    this._initImage();
                }

                var pane = map._panes[this.options.pane || 'overlayPane'];
                pane.appendChild(this._image);

                map
                    .on('viewreset', this._reset, this);

                if (map.options.zoomAnimation && L.Browser.any3d) {
                    map.on('zoomanim', this._animateZoom, this);
                }

                this._reset();
            },

            onRemove: function (map) {
                if (this._image && this._image.parentNode) {
                    this._image.parentNode.removeChild(this._image);
                }

                map.off('viewreset', this._reset, this);

                if (map.options.zoomAnimation) {
                    map.off('zoomanim', this._animateZoom, this);
                }
            },
            setZIndex: function (zIndex) {
                this.options.zIndex = zIndex;
                this._updateZIndex();

                return this;
            },
            _updateZIndex: function () {
                if (this._image && this.options.zIndex !== undefined) {
                    this._image.style.zIndex = this.options.zIndex;
                }
            },
            bringToFront: function () {
                if (this._image && this._image.parentNode) {
                    var pane = this._image.parentNode;
                    pane.appendChild(this._image);
                    this._setAutoZIndex(pane, Math.max);
                }
                return this;
            },

            bringToBack: function () {
                if (this._image) {
                    var pane = this._image.parentNode;
                    pane.insertBefore(this._image, pane.firstChild);
                    this._setAutoZIndex(pane, Math.min);
                }
                return this;
            }
        });
    };
    L.ImageOverlay.Pane = addImageOverlayPaneMixin(L.ImageOverlay);

    var template = 'http://{s}.maps.rosreestr.ru/arcgis/rest/services/Cadastre/Cadastre/MapServer/export';
    L.rosreestr = new L.TileLayer.WMS(template, {
        tileSize: 1024,
        size: '1024,1024',
        bboxSR: 102100,
        imageSR: 102100,
        dpi: 96,
        f: 'image',
        format: 'png32',
        transparent: true,
        attribution: 'Rosreestr'
    });
    L.Map.addInitHook(function () {
        var map = this;
        map
            .on('layeradd', function (ev) {
                if (ev.layer === L.rosreestr) {
                    L.DomUtil.addClass(ev.layer.getContainer(), 'leaflet-clickable-raster-layer');
                    ev.layer.setZIndex(100);
                    map
                        .on('click', onClickMap, ev.layer)
                        .on('moveend', setImageOverlay);
                }
            })
            .on('layerremove', function (ev) {
                if (ev.layer === L.rosreestr) {
                    if (imageOverlay) { map.removeLayer(imageOverlay); }
                    map
                        .off('click', onClickMap, ev.layer)
                        .off('moveend', setImageOverlay);
                }
            });
    });
})();
