/*
 (c) 2014, Sergey Alekseev
 Leaflet.HeatMapWebGL, plugin for Gemixer layers.
*/
L.HeatMapWebGL = L.Class.extend({

    options: {
        gradientTexture: false,
        alphaRange: 1,
        pane: 'markerPane'
    },

    initialize: function (map, options) {
        L.setOptions(this, options);
        this._observers = {};
        this._labels = {};
        var _this = this;
/*
        this.bbox = gmxAPIutils.bounds();

        var chkData = function (data, layer) {
            if (!data.added && !data.removed) return;
console.log('chkData', data);
            var added = data.added || [],
                layerId = '_' + layer._leaflet_id,
                gmx = layer._gmx,
                labels = {};
            for (var i = 0, len = added.length; i < len; i++) {
                var item = added[i].item,
                    style = gmx.styleManager.getObjStyle(item),
                    id = '_' + item.id,
                    options = item.options;
                if (style.labelField) {
                    if (!('center' in options)) {
                        var bounds = item.bounds;
                        options.center = item.type === 'POINT' ?
                             [bounds.min.x, bounds.min.y]
                           : [(bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2]
                        ;
                    }
                    var txt = gmx.getPropItem(item.properties, style.labelField);
                    if (!('label' in options) || options.label.txt !== txt) {
                        var size = style.labelFontSize || 12;
                        style.font = size + 'px "Arial"';
                        var width = gmxAPIutils.getLabelWidth(txt, style);
                        if (!width) {
                            delete labels[id];
                            continue;
                        }
                        options.label = {
                            width: width + 3,
                            txt: txt,
                            style: style
                        };
                    }
                    if (options.label.width) {
                        labels[id] = item;
                    }
                }
            }
            _this._labels[layerId] = labels;
        }

        var addObserver = function (layer) {
            var gmx = layer._gmx,
                dataManager = gmx.dataManager;
            var observer = dataManager.addObserver({
                type: 'resend',
                bbox: _this.bbox,
                filters: ['styleFilter', 'userFilter'],
                callback: function(data) {
                    chkData(data, layer);
                    _this.redraw();
                }
            }, '_Labels');
            return observer;
        }
        this._layeradd = function (ev) {
            var layer = ev.layer,
                id = layer._leaflet_id;
            if (layer._gmx && layer._gmx.labelsLayer) {
                _this._updateBbox();
                var observer = addObserver(layer);
                _this._observers[id] = observer;
                _this._labels['_' + id] = {};
                _this.redraw();
                layer.on('doneDraw', _this.redraw, _this);

            }
        }
        this._layerremove = function (ev) {
            var layer = ev.layer,
                id = ev.layer._leaflet_id;
            if (_this._observers[id]) {
                var gmx = layer._gmx,
                    dataManager = gmx.dataManager;
                dataManager.removeObserver(_this._observers[id].id);
                delete _this._observers[id];
                delete _this._labels['_' + id];
                _this._reset();
                ev.layer.off('doneDraw', _this.redraw, _this);
            }
        }
*/
    },

    redraw: function () {
        if (!this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        map.getPanes()[this.options.pane].appendChild(this._canvas);

        map.on('moveend', this._reset, this);
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        map.getPanes()[this.options.pane].removeChild(this._canvas);

        map.off('moveend', this._reset, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        var options = this.options;
        this.WebGLHeatMap = createWebGLHeatmap({ 
            canvas: canvas, 
            gradientTexture: options.gradientTexture, 
            alphaRange: [0, options.alphaRange]
        });
    },

    _updateBbox: function () {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
            ww = gmxAPIutils.worldWidthMerc,
            ww2 = 2 * ww,
            m1 = L.Projection.Mercator.project(southWest),
            m2 = L.Projection.Mercator.project(northEast),
            w = (m2.x - m1.x) / 2,
            center = (m1.x + m2.x) / 2;
        center %= ww2;
        if (center > ww) center -= ww2;
        else if (center < -ww) center += ww2;

        this.mInPixel = gmxAPIutils.getPixelScale(_map._zoom);
        //this.mInPixel2 = 2 * this.mInPixel;
        this._ctxShift = [(w - center) * this.mInPixel, m2.y * this.mInPixel];
        // this.bbox.min.x = center - w; this.bbox.min.y = m1.y;
        // this.bbox.max.x = center + w; this.bbox.max.y = m2.y;
    },

    _clear: function () {
        var heatmap = this.WebGLHeatMap;
        heatmap.clear();
        heatmap.display();
    },

    _reset: function () {
        var _map = this._map,
            size = _map.getSize(),
            _canvas = this._canvas,
            mapTop = _map._getTopLeftPoint(),
            topLeft = _map.containerPointToLayerPoint([0, mapTop.y < 0 ? -mapTop.y : 0]);

        L.DomUtil.setPosition(_canvas, topLeft);
        _canvas.width = size.x; _canvas.height = size.y;

        this._updateBbox();

        // var ctx = _canvas.getContext('2d');
        // ctx.translate(this._ctxShift[0], this._ctxShift[1]);

        // for (var id in this._observers) {
            // this._observers[id].fire('update');
        // }
        this.redraw();
    },

    _redraw: function () {
        var heatmap = this.WebGLHeatMap;
        heatmap.clear();
        if (this.data) {
            var dataLen = this.data.length;
            var out = [],
                _zoom = this._map._zoom,
                ctxShift = this._ctxShift,
                mInPixel = this.mInPixel;
            
            for (var i = 0; i < dataLen; i++) {
                var it = this.data[i].properties,
                    geo = it[it.length - 1],
                    coord = geo.coordinates,
                    x = coord[0] * mInPixel,
                    y = coord[1] * mInPixel;

                heatmap.addPoint(
                    Math.floor(x + ctxShift[0]),
                    Math.floor(y + ctxShift[1])
                    // ,
                    // this._scale(latlng),
                    // dataVal[2]
                    );
            }
            heatmap.update();
            heatmap.display();
            if (!this._canvas.parentNode) {
                this._map.getPanes()[this.options.pane].appendChild(this._canvas);
            }
        }
/*
        for (var layerId in this._labels) {
            var labels = this._labels[layerId];
            for (var id in labels) {
                var it = labels[id],
                    options = it.options,
                    label = options.label,
                    style = label.style,
                    width = label.width,
                    size = style.labelFontSize || 12,
                    ww = width / this.mInPixel2,
                    hh = size / this.mInPixel2,
                    center = options.center,
                    bbox = gmxAPIutils.bounds([
                        [center[0] - ww, center[1] - hh],
                        [center[0] + ww, center[1] + hh]
                    ]),
                    isFiltered = false;

                for (var i = 0, len1 = out.length; i < len1; i++) {
                    if(bbox.intersects(out[i].bbox)) {
                        isFiltered = true;
                        break;
                    }
                }
                if(isFiltered) continue;

                if (!('labelStyle' in options)) {
                    var strokeStyle = gmxAPIutils.dec2color(style.labelHaloColor || 0, 1);
                    options.labelStyle = {
                        font: size + 'px "Arial"'
                        ,strokeStyle: strokeStyle
                        ,fillStyle: gmxAPIutils.dec2color(style.labelColor || 0, 1)
                        ,shadowBlur: 4
                        ,shadowColor: strokeStyle
                    };
                }
                out.push({
                    arr: it.properties
                    ,bbox: bbox
                    ,txt: label.txt
                    ,style: options.labelStyle
                    ,coord: gmxAPIutils.toPixels(center, width/2, size/2, this.mInPixel)
                });
            }
        }
        var _canvas = this._canvas;
        if (out.length) {
            if (!_canvas.parentNode) {
                this._map.getPanes()[this.options.pane].appendChild(_canvas);
            }

            var ctx = _canvas.getContext('2d'),
                p = this._ctxShift;

            ctx.clearRect(-p[0], -p[1], _canvas.width, _canvas.height);
            for (var i = 0, len = out.length; i < len; i++) {
                var it = out[i];
                gmxAPIutils.setLabel(ctx, it.txt, it.coord, it.style);
            }
        } else {
            if (_canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
        }
*/
        this._frame = null;
    },

    setData: function (data) {
        this.data = data;
    }
});

L.heatMapWebGL = function (map, options) {
    return new L.HeatMapWebGL(map, options);
};
