/*
 (c) 2015, Sergey Alekseev salekseev@scanex.ru
 Leaflet.Overlay , plugin for overlay layer.
*/
L.Overlay = L.Class.extend({

    options: {
        pane: 'markerPane',
        drawFunc: null
    },

    setDrawFunc: function (drawFunc) {
        this.options.drawFunc = drawFunc;
        return this;
    },

    setData: function (data) {
        this._data = data;
        return this;
    },

    initialize: function (map, options) {
        this._frame = false;
        L.setOptions(this, options);
    },

    redraw: function () {
        if (this._map && !this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        map.getPanes()[this.options.pane].appendChild(this._canvas);

        map.on('moveend', this.redraw, this);
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this.redraw();
    },

    addTo: function (map) {
        // if (!this._canvas.parentNode) {
            // map.getPanes()[this.options.pane].appendChild(this._canvas);
        // }
        map.addLayer(this);
        return this;
    },

    onRemove: function (map) {
        map.getPanes()[this.options.pane].removeChild(this._canvas);

        map.off('moveend', this.redraw, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            pixelBoundsMin = this._map.getPixelBounds().min;

        var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
        if (pixelBoundsMin.y < 0) offset.y += pixelBoundsMin.multiplyBy(-scale).y;

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    },

    _initCanvas: function () {
        var className = this.options.className || 'leaflet-overlay-layer',
            canvas = L.DomUtil.create('canvas', 'leaflet-layer ' + className),
            size = this._map.getSize();

        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    },

    _updateBbox: function (zoom) {
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

        this.mInPixel = gmxAPIutils.getPixelScale(zoom || _map._zoom);
        this._ctxShift = [(w - center) * this.mInPixel, m2.y * this.mInPixel];
    },

    _redraw: function () {
        var _map = this._map,
            size = _map.getSize(),
            _canvas = this._canvas,
            mapTop = _map._getTopLeftPoint(),
            topLeft = _map.containerPointToLayerPoint([0, mapTop.y < 0 ? -mapTop.y : 0]);

        L.DomUtil.setPosition(_canvas, topLeft);
        _canvas.width = size.x; _canvas.height = size.y;
        this._frame = false;
        if (this._data && this.options.drawFunc) {
            this._updateBbox();
            this.options.drawFunc(_canvas, {
                items: this._data,
                shiftPoint: this._ctxShift,
                scale: this.mInPixel
            });
        }
    }
});

L.overlay = function (map, options) {
    return new L.Overlay(map, options);
};
