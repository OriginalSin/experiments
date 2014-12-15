var nsGmx = nsGmx || {};nsGmx.Templates = nsGmx.Templates || {};nsGmx.Templates.DrawingObjectsListWidget = {};
nsGmx.Templates.DrawingObjectsListWidget["listTemplate"] = "<div class=\"drawingObjectsListWidget ui-widget\">\n" +
    "    {{collection}}\n" +
    "</div>";
nsGmx.Templates.DrawingObjectsListWidget["nodeTemplate"] = "<div class=\"ui-widget-content drawingObjectsListNode\">\n" +
    "    <div class=\"drawingObjectsListNode-checkableArea\">\n" +
    "        <div class=\"ui-icon {{#selected}}ui-icon-check{{else}}ui-icon-blank{{/selected}} drawingObjectsListNode-checkIcon\">\n" +
    "        </div>\n" +
    "        <div class=\"drawingObjectsListNode-info ui-helper-noselect\">\n" +
    "            {{type}} ({{info}})\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    {{#showRemoveButton}}\n" +
    "            <div class=\"ui-icon ui-icon-close drawingObjectsListNode-removeIcon\"></div>\n" +
    "    {{/showRemoveButton}}\n" +
    "    {{#showStyleButton}}\n" +
    "            <div class=\"ui-icon ui-icon-pencil drawingObjectsListNode-styleIcon\"></div>\n" +
    "    {{/showStyleButton}}\n" +
    "    <div class=\"ui-helper-clearfix\"></div>\n" +
    "</div>";
nsGmx.Templates.DrawingObjectsListWidget["emptyTemplate"] = "<div class=\"drawingObjectsListWidget-noFeatures\">{{i \"drawingObjectsListWidget.noFeatures\"}}</div>";;
/**
 * @namespace
 */
var nsGmx = nsGmx || {};

/** Попытка изменить состояние объекта
 * @event objectToggle
 * @param {L.GmxDrawing.Feature} drawingObject
 * @param {Boolean} selected
 */

/** Попытка отцентровать объект
 * @event objectFocus
 * @param {L.GmxDrawing.Feature} drawingObject
 */

/** Кликнули на кнопку изменения стиля
 * @event styleButtonClick
 * @param {L.GmxDrawing.Feature} drawingObject
 */

nsGmx.DrawingObjectsListWidget = (function() {
    'use strict';

    // TODO: возможно, стоит выделить логику работы со стилями в отдельную сущность
    var DrawingObjectModel = Backbone.Model.extend({
        _featureHasArea: function(feature) {
            return (
                // объект имеет тип, у которого может быть площадь
                !(feature.options.type.toLowerCase() === 'point') &&
                !(feature.options.type.toLowerCase() === 'polyline')
            ) && (
                // объект имеет площадь (количество вершин >= 3)
                feature.getLatLngs().length > 2
            );
        },

        _featureHasLength: function(feature) {
            return (
                // объект имеет тип, у которого может быть длина
                !(feature.options.type.toLowerCase() === 'point')
            ) && (
                // объект имеет длину (количество вершин >= 2)
                feature.getLatLngs().length > 1
            );
        },

        _featureHasLatLng: function(feature) {
            return feature.options.type.toLowerCase() === 'point';
        },

        _updateProperties: function(feature) {
            // у маркера и линии площадь отсутствует
            this.set({
                geoArea: L.gmxUtil && this._featureHasArea(feature) ? L.gmxUtil.getArea(feature.getLatLngs()) : undefined
            });
            // длину посичтаем для всех, кроме маркера
            this.set({
                geoLength: L.gmxUtil && this._featureHasLength(feature) ? L.gmxUtil.getLength(feature.getLatLngs()) : undefined
            });
            // для точки зададим координаты
            this.set({
                geoLatLng: this._featureHasLatLng(feature) ? feature.getLatLng() : undefined
            });
        },

        // Сохранить первоначальные свойства, которые могут быть изменены преобразователем свойств
        _retainProperties: function(feature, markingStrategy) {
            // получаем изменённый стиль геометрии
            var normalStyle = feature.getLinesStyle();
            var modifiedStyle = markingStrategy(normalStyle);
            for (var prop in modifiedStyle) {
                if (modifiedStyle.hasOwnProperty(prop)) {
                    // могли применить другой преобразователь
                    if (!this._retainedProperties.hasOwnProperty(prop)) {
                        this._retainedProperties[prop] = normalStyle[prop];
                    }
                }
            }
        },

        // Преобразователь свойств, восстанавливающий первоначальные значения
        _restoringStrategy: function(featureStyles) {
            return this._retainedProperties;
        },

        /**
         * @param {Feature} feature
         * @param {Function} markingStrategy
         */
        constructor: function(feature, markingStrategy) {
            this._marked = false;
            this._retainedProperties = {};
            this._markingStrategy = markingStrategy || function() {
                return {}
            };

            var props = {};
            props.feature = feature;
            props.type = feature.options.type.toLowerCase();
            props.id = L.stamp(feature);
            props.selected = true;
            Backbone.Model.apply(this, [props]);
        },

        initialize: function() {
            var self = this;
            this._updateProperties(this.get('feature'));
            this.get('feature').on('edit', function(drawingEvent) {
                self._updateProperties(drawingEvent.object);
            });
        },

        hasArea: function() {
            return this._featureHasArea(this.get('feature'));
        },

        hasLength: function() {
            return this._featureHasLength(this.get('feature'));
        },

        hasLatLng: function() {
            return this._featureHasLatLng(this.get('feature'));
        },

        // Выделить геометрию. Вызывается один раз после unmarkGeometry.
        markGeometry: function() {
            if (!this._marked) {
                this._retainProperties(this.get('feature'), this._markingStrategy);
                var newStyle = this._markingStrategy(this.get('feature').getLinesStyle());
                this.get('feature').setLinesStyle(newStyle);
                this.get('feature').setPointsStyle(newStyle);
                this._marked = true;
            }
        },

        // Снять выделение. Вызывается один раз после markGeometry.
        unmarkGeometry: function() {
            if (this._marked) {
                this.get('feature').setLinesStyle(this._retainedProperties);
                this.get('feature').setPointsStyle(this._retainedProperties);
                this._retainedProperties = {};
                this._marked = false;
            }
        }
    });

    var DrawingObjectsCollection = Backbone.Collection.extend({

    });

    var DrawingObjectView = Thorax.View.extend({
        template: Handlebars.compile(nsGmx.Templates.DrawingObjectsListWidget.nodeTemplate),
        events: {
            'click .drawingObjectsListNode-checkableArea': (function() {
                var clicks = 0;
                var timeout = null;

                var singleClick = function() {
                    if (this.parent.parent.selectMode === 'single') {
                        this.parent.parent.uncheckGeometries();
                    }
                    this.model.set({
                        selected: !this.model.get('selected')
                    });
                };

                var doubleClick = function() {
                    this.parent.parent.trigger('objectFocus', [this.model.get('feature')]);
                };

                return function() {
                    var self = this;
                    clicks++;
                    if (!timeout) {
                        timeout = setTimeout(function() {
                            if (clicks === 1) {
                                singleClick.call(self);
                            } else {
                                doubleClick.call(self);
                            }
                            clicks = 0;
                            timeout = null;
                        }, 180);
                    }
                }
            })(),
            'mouseover .drawingObjectsListNode': function() {
                $(this.el).find('.drawingObjectsListNode').addClass('ui-state-hover');
                this.model.markGeometry();

            },
            'mouseout .drawingObjectsListNode': function() {
                $(this.el).find('.drawingObjectsListNode').removeClass('ui-state-hover');
                this.model.unmarkGeometry();
            },
            'click .drawingObjectsListNode-removeIcon': function() {
                // модель поймает событие удаления геометрии и удалится автоматически
                this.model.get('feature').remove();
            },
            'click .drawingObjectsListNode-styleIcon': function() {
                this.model.unmarkGeometry();
                this.parent.parent.styleChangeCallback && this.parent.parent.styleChangeCallback(this.model.get('feature'))
            }
        },
        context: function() {
            var prettifyLatLng = function(latLng) {
                var trunc = function(x) {
                    return ("" + (Math.round(10000000 * x) / 10000000 + 0.00000001)).substring(0, 9);
                };

                var formatCoordinates = function(x, y) {
                    return trunc(Math.abs(y)) + (y > 0 ? " N, " : " S, ") +
                        trunc(Math.abs(x)) + (x > 0 ? " E" : " W");
                };

                return formatCoordinates(latLng.lng, latLng.lat);
            };

            var translateGeometryType = function(type) {
                return nsGmx.Translations.getText('drawingObjectsListWidget.' + type);
            };

            var area = L.gmxUtil && this.model.hasArea() ? L.gmxUtil.prettifyArea(this.model.get('geoArea')) : '';
            var length = L.gmxUtil && this.model.hasLength() ? L.gmxUtil.prettifyDistance(this.model.get('geoLength')) : '';
            var latLng = this.model.hasLatLng() ? prettifyLatLng(this.model.get('geoLatLng')) : '';

            return {
                type: translateGeometryType(this.model.get('type')), //TODO: translation here
                info: area ? area : length ? length : latLng,
                selected: this.model.get('selected'),
                // при первом вызове context parent = undefined, по-этому делаем проверку
                // this.parent это view хелпера collection, по-этому получаем доступ к
                // CollectionView путём this.parent.parent
                showStyleButton: this.parent && this.parent.parent ? this.parent.parent.showStyleButton : false,
                showRemoveButton: this.parent && this.parent.parent ? this.parent.parent.showRemoveButton : false
            }
        }
    });

    var DrawingObjectsListView = Thorax.View.extend({
        template: Handlebars.compile(nsGmx.Templates.DrawingObjectsListWidget.listTemplate),
        emptyTemplate: Handlebars.compile(nsGmx.Templates.DrawingObjectsListWidget.emptyTemplate),
        itemView: DrawingObjectView,
        events: {},
        uncheckGeometries: function() {
            _(this.getCollectionViews()[0].children).forEach(function(collectionView) {
                collectionView.model.set('selected', false);
            });
        }
    });

    /**
     * @class DrawingObjectsWidget
     * @param {jQueryCollection} placeholder
     * @param {Object} options
     * @param {GMXDrawing} drawingManager
     * @param {String} [options.selectMode] 'single' или 'multiple'
     * @param {Boolean} [options.showCheckbox] true
     * @param {Boolean} [options.showStyleButton] true показывать ли кнопку изменения стиля
     * @param {Boolean} [options.showRemoveButton] true показывать ли кнопку удаления
     * @param {Boolean} [options.markGeometries] true подсвечивать ли геометрии по наведении курсора
     * @param {Function} [options.markingStrategy] Функция, преобразующая стиль подсвеченной геометрии.
     *                                             Не должна изменять исходный стиль.
     *                                             Может возвращать только изменённые свойства
     */
    var DrawingObjectsListWidget = function(placeholder, options) {
        var _options = this._fixOptions(options);
        this._collection = this._createModel(_options);
        this._view = this._createView(this._collection, _options);
        this._view.appendTo(placeholder);
    };

    DrawingObjectsListWidget.prototype._fixOptions = function(options) {
        return {
            drawingManager: options.drawingManager,
            selectMode: options.selectMode === 'single' ? 'single' : 'multiple',
            showCheckbox: typeof options.showCheckbox === 'boolean' ? options.showCheckbox : true,
            showStyleButton: typeof options.showStyleButton === 'boolean' ? options.showStyleButton : true,
            showRemoveButton: typeof options.showRemoveButton === 'boolean' ? options.showRemoveButton : true,
            markGeometries: typeof options.markGeometries === 'boolean' ? options.markGeometries : true,
            markingStrategy: options.markingStrategy || this._defaultMarkingStrategy
        }
    };

    DrawingObjectsListWidget.prototype._createModel = function(options) {
        var self = this;
        var drawingManager = options.drawingManager;

        var collection = new DrawingObjectsCollection([], {
            model: DrawingObjectModel
        });

        var addModel = function(feature) {
            var drawingObjectModel = new DrawingObjectModel(feature, options.markingStrategy);
            drawingObjectModel.on('change:selected', function(model) {
                $(self).trigger('objectToggle', [model.get('feature'), model.get('selected')]);
            });
            if (options.selectMode === 'single') {
                collection.each(function(e) {
                    e.set('selected', false);
                });
            }
            collection.add(drawingObjectModel);
        };

        drawingManager.getFeatures().map(function(feature) {
            addModel(feature);
        });

        drawingManager.on('add', function(drawingEvent) {
            addModel(drawingEvent.object);
        });

        drawingManager.on('remove', function(drawingEvent) {
            var id = L.stamp(drawingEvent.object);
            collection.remove(collection.get(id));
        });

        drawingManager.on('layerremove', function(drawingEvent) {
            console.log('layerremove');
        });

        return collection;
    };

    DrawingObjectsListWidget.prototype._createView = function(collection, options) {
        var self = this;

        var view = new DrawingObjectsListView({
            collection: collection,
            selectMode: options.selectMode,
            showCheckbox: options.showCheckbox,
            showStyleButton: options.showStyleButton,
            showRemoveButton: options.showRemoveButton,
            styleChangeCallback: function(feature) {
                $(self).triggerHandler('styleButtonClick', [feature]);
            }
        });

        view.on('objectFocus', function(args) {
            $(self).trigger('objectFocus', [args[0]]);
        });

        return view;
    };

    // Преобразователь стилей, используемый по умолчанию
    // @param  {Leaflet Options} styles исходные стили
    // @return {Leaflet Options} преобразованные стили
    DrawingObjectsListWidget.prototype._defaultMarkingStrategy = function(styles) {
            // функция, изменяющая яркость цвета, заданного в шестнадцатеричном формате
            // @param {String} hexColor
            // @param {Number} amount во сколько раз увелить яркость
            var adjustHexColor = function(rawColorHexStr, factor) {
                var transformComponent = function(hexColor, factor) {
                    var newHexColor = ~~(hexColor * factor);
                    if (newHexColor > 255) {
                        return 255;
                    } else {
                        return newHexColor;
                    }
                };

                var stringifyComponent = function(hexColor) {
                    if (hexColor < 16) {
                        return '0' + hexColor.toString(16);
                    } else if (hexColor > 255) {
                        return 'ff';
                    } else {
                        return hexColor.toString(16);
                    }
                };

                var colorHexStr = rawColorHexStr.charAt(0) === '#' ? rawColorHexStr.slice(1) : rawColorHexStr;
                var useHash = rawColorHexStr.charAt(0) === '#' ? true : false;

                var colorHex = parseInt(colorHexStr, 16);
                var rHex = (colorHex & 0xff0000) >> 16;
                var gHex = (colorHex & 0x00ff00) >> 8;
                var bHex = (colorHex & 0x0000ff);

                rHex = transformComponent(rHex, factor);
                gHex = transformComponent(gHex, factor);
                bHex = transformComponent(bHex, factor);

                var sc = stringifyComponent;

                return (useHash ? '#' : '') + sc(rHex) + sc(gHex) + sc(bHex);
            };

            return {
                // увеличить яркость цвета в 2 раза если объект не является точкой
                color: styles.color && adjustHexColor(styles.color, 2)
            };
        },

        /**
         * Получить список выбранных объектов
         * @return {Array<L.GmxDrawing.Feature>}
         */
        DrawingObjectsListWidget.prototype.getSelectedObjects = function() {
            return this._collection.filter(function(model) {
                return model.get('selected') === true;
            }).map(function(model) {
                return model.get('feature');
            })
        };


    return DrawingObjectsListWidget;
})();;
nsGmx.Translations && nsGmx.Translations.addText('eng', {
    drawingObjectsListWidget: {
        'noFeatures': 'no features',
        'rectangle': 'rectangle',
        'polyline': 'polyline',
        'polygon': 'polygon',
        'point': 'point'
    }
});

nsGmx.Translations && nsGmx.Translations.addText('rus', {
    drawingObjectsListWidget: {
        'noFeatures': 'нет геометрий',
        'rectangle': 'прямоугольник',
        'polyline': 'линия',
        'polygon': 'многоугольник',
        'point': 'точка'
    }
});;