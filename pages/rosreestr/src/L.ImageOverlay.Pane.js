(function () {
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

    L.imageOverlay.pane = function (imageUrl, bounds, options) {
      return new L.ImageOverlay.Pane(imageUrl, bounds, options);
    };
})();
