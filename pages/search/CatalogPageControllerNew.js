
_translationsHash.addtext("rus", {
	"Начальная дата поиска задана неверно."								: "Начальная дата поиска задана неверно.",
	"Конечная дата поиска задана неверно."								: "Конечная дата поиска задана неверно.",
	"Пожалуйста, укажите источники снимков."							: "Пожалуйста, укажите источники снимков.",
	"Параметры поиска заданы неверно."									: "Параметры поиска заданы неверно.",
	"Найдено слишком много снимков.\nПожалуйста, уточните параметры поиска.": "Найдено слишком много снимков.\nПожалуйста, уточните параметры поиска.",
	"Найдено слишком много снимков для отображения. Скачать shp-файл?"	: "Найдено слишком много снимков для отображения. Скачать shp-файл?",
	"Ничего не найдено, измените параметры поиска."						: "Ничего не найдено, измените параметры поиска.",
	"Не удалось соединиться с сервисом.\nПожалуйста, повторите попытку позже.": "Не удалось соединиться с сервисом.\nПожалуйста, повторите попытку позже."
});

_translationsHash.addtext("eng", {
	"Начальная дата поиска задана неверно."								: "Invalid date from",
	"Конечная дата поиска задана неверно."								: "Invalid date to",
	"Пожалуйста, укажите источники снимков."							: "Please select at least one satellite",
	"Параметры поиска заданы неверно."									: "Invalid search criteria",
	"Найдено слишком много снимков.\nПожалуйста, уточните параметры поиска.": "There are too many images. \nPlease change search criteria",
	"Найдено слишком много снимков для отображения. Скачать shp-файл?"	: "There are too many images to draw on map. Do you want to download shp file?",
	"Ничего не найдено, измените параметры поиска."						: "There are no images. \nPlease change search criteria",
	"Не удалось соединиться с сервисом.\nПожалуйста, повторите попытку позже.": "Connection error. Please try later"
});

CatalogPageController = function(view) {
    this._view = view;
    this._map = null;
    this._mapContainer = null;
    
    this._panels = {};
    this._preferences = null;
    this._searchOptions = null;
    this._urlProvider = null;
    this._dataProvider = null;
    this._searchResults = null;
    this._geometry = null;
    this._shapeFileView = null;
    this._shapeFile = null;
    this._waitingDialog = null;
    
    this._permalink = null;
    
    this._initialize();
}

CatalogPageController.prototype = {
    _rearrangeLayout: function () {
        var panelsStates = [];
        if ($("#leftPanel:visible").length) panelsStates.push("left");
        if ($("#searchResults:visible").length) panelsStates.push("results");
        if ($("#rightPanel:visible").length) panelsStates.push("right");

        var newClassName = panelsStates.join('-');
        $("#searchResults").toggleClass("minimizedmap", newClassName == "results" || newClassName == "results-right");
        $("#mapContainer").attr('class', newClassName);

        $("#leftPanel").jScrollPane({ verticalGutter: 0 });
		$("#rightPanel").jScrollPane({ verticalGutter: 0 });
        $("#leftPanel").data('jsp').getContentPane().resize(function () {
            $("#leftPanel").data('jsp').reinitialise({ verticalGutter: 0 });
        });
		$("#rightPanel").data('jsp').getContentPane().resize(function () {
            $("#rightPanel").data('jsp').reinitialise({ verticalGutter: 0 });
        });
        $("#leftPanel").resize(function () {
            $("#leftPanel").data('jsp').reinitialise({ verticalGutter: 0 });
        });
		$("#rightPanel").resize(function () {
            $("#rightPanel").data('jsp').reinitialise({ verticalGutter: 0 });
        });
		if(this._map)this._map.checkMapSize();
    },

    _initialize: function () {
        this._preferences = new PreferencesViewController(this._view.find('div.b-preferences-shortcut'));
        this._resizeFix();

        this._initializePanel('left');
        this._initializePanel('right');
        this._panels.right.collapser.click();

        this._urlProvider = new SearchUrlProvider();
        this._dataProvider = new JsonDataProvider();
		AuthController.initialize(this._view.find('#auth-canvas'));
        this._mapContainer = $('#map');
        createFlashMap(this._mapContainer[0], '1CB019F36D024831972F3029B724D7CA', this._initializeMap.bind(this));
    },

    _initializeMap: function (map) {
		window.globalFlashMap = map;
        this._map = map;
        map.container = this._mapContainer;
		/*if (this._preferences.getTheme() == 'light'){
			map.setBaseLayer(MapInitialization.layers.Satellite);
		}else{
			map.setBaseLayer(MapInitialization.layers.Map);
		}*/
        //new MapInitialization(map, this._preferences.getTheme() == 'light' ? MapInitialization.layers.Satellite : MapInitialization.layers.Map);
		map.setMinMaxZoom(3, 14);
		map.moveTo(55.634508, 37.433167);
		
        gmxAPI.control.initControls();
        //new CustomMapControlsController(this._view.find('#mapControls'), map);

        var geoSearch = new GeoSearchController(map);
        geoSearch.set_onAfterSearch(function (searchString) {
            this._waitingDialog.open();
            var ids = searchString.replace(/[,;]/, ' ').split(/\s+/);
            this._performQuicklooksSearch(ids, function (quicklooksCount) {
                if (quicklooksCount > 0) {
                }
                this._waitingDialog.close();
            } .bind(this));
        } .bind(this));
		
        this._searchOptions = new SearchOptionsViewController(this._panels.left.content.find('#search-tabs'), map);
        this._searchOptions.set_onSearchClick(this._performSearch.bind(this));
		this._searchOptions.set_onSearchDownloadClick(this._perfomrmDownloadSearchResults.bind(this));
		
        this._searchResults = new SearchResultsController(this._view.find('#searchResults'), map);
        this._searchResults.set_onShow(function () { this._setPanelState('left', false); } .bind(this));
        this._searchResults.set_onClose(function () { this._setPanelState('left', true); } .bind(this));
        this._searchResults.set_onAddToCart(this._updateDownloadButtonVisibility.bind(this));
        this._searchResults.set_onRemoveFromCart(this._updateDownloadButtonVisibility.bind(this));
		
        this._geometry = new GeometryViewController(this._panels.right.content.find('.map-geometry'), map);
        this._geometry.set_onFinishObject(this._objectFinished.bind(this));
        this._geometry.set_onRemoveObject(this._objectRemoved.bind(this));

        this._shapeFileView = new ShapeFileViewController(this._panels.left.content.find('.shp-file-actions'));
        this._shapeFileView.set_onDownloadShapeFileClicked(this._downloadShapeFile.bind(this));
        this._shapeFileView.set_onUploadShapeFileClicked(this._uploadShapeFile.bind(this));

        this._shapeFile = new ShapeFileController(this._view.find('#shp-file-download'), this._view.find('#shp-file-upload'), map);

        this._waitingDialog = new WaitingDialogController();

        this._objectRemoved();

        // TODO: FF4 fix. Need to remove
        this._view.find('.results-panel').hide();
		
		this._permalink = new PermalinkController(this._view.find('#permalinkDialog'),
														  this._urlProvider, this._dataProvider, map, this._searchResults, this._searchOptions);
														  
        this._initializePermalink(map);
        this._initializeShare(map);
		this._initChangeLanguage();
		AuthController.checkAuthentication();
    },

    _initializePermalink: function (map) {
        
        ServiceLocator.register('Permalink', this._permalink);
        this._view.find('#permalink')
            .hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); })
            .click(function () { this._permalink.getLink(); } .bind(this));

        var permalinkId = readCookie("TinyReference");
        eraseCookie("TinyReference");
        if (permalinkId) this._permalink.restore(permalinkId);
    },
	
    _initializeShare: function(map){
		var doShare = function(url){
			this._permalink.getPermalinkUrl(function (permalink_url) {
				window.open(
					url + permalink_url
					,'share-dialog'
					,'width=626,height=436'
				);
			}.bind(this));
		}.bind(this)
		this._view.find('.own-projects .share-fb').click(function(){ doShare('https://www.facebook.com/sharer/sharer.php?u='); }.bind(this));
		this._view.find('.own-projects .share-vk').click(function(){ doShare('http://vkontakte.ru/share.php?url='); }.bind(this));
		this._view.find('.own-projects .share-t').click(function(){ doShare('http://twitter.com/share?url='); }.bind(this));
    },

	_initChangeLanguage: function(){
		this._view.find('.b-language-bar a').click(function(){
			this._permalink.getPermalinkUrl(function (permalink_url) {
				window.location.href = permalink_url
			}.bind(this), (window.language == 'eng') ? 'rus' : 'eng')
			return false;
		}.bind(this));
	},
	
    _updateDownloadButtonVisibility: function () {
        this._shapeFileView.setDownloadButtonVisibility(!!this._geometry.get_objectsCount() || !this._searchResults.isCartEmpty());
    },

    _resizeFix: function () {
        $(window).resize(
            function () {
                var mapContainer = $('#map');
                var header = $('.middle-cell .header');
                return function () {
                    mapContainer.height(100);
                    mapContainer.height(mapContainer.parent().height() - header.height());
                };
            } ()).resize();
    },

    _initializePanel: function (prefix) {
        this._panels[prefix] = {
            collapser: $('#' + prefix + 'Collapser')
                            .addClass('collapser-arrow-' + prefix)
                            .click(function () { this._togglePanel(prefix); } .bind(this)),
            content: $('#' + prefix + 'Panel')
        };
    },

    _setPanelState: function (prefix, isVisible) {
        this._panels[prefix].collapser
            .toggleClass('collapser-arrow-left', (prefix == 'left') == isVisible)
            .toggleClass('collapser-arrow-right', (prefix == 'right') == isVisible);
        this._panels[prefix].content[isVisible ? 'show' : 'hide']();
        this._rearrangeLayout();
    },

    _togglePanel: function (prefix) {
        this._setPanelState(prefix, !this._panels[prefix].collapser.hasClass('collapser-arrow-' + prefix));
    },

    _downloadShapeFile: function () {
        this._shapeFile.download(this._searchResults.getImagesInCart());
    },

    _uploadShapeFile: function () {
        this._shapeFile.upload();
    },

    _performQuicklooksSearch: function (ids, finishedCallback) {
        //this._dataProvider.postData(
		sendCrossDomainPostRequest(
            this._urlProvider.getQuicklooksInfoUrl(), { id: ids.join(','), WrapStyle: "window" },
            function (data) {
                var result = data.Result;
                if (result.length > 0) {

                    this._searchResults.show();
                    this._searchResults.selectList('results');
                    this._searchResults.setData(result,
                        function () {
                            this._searchResults.zoomToQuicklooks('results');
                            if (finishedCallback) finishedCallback(result.length);
                        } .bind(this),
                        true
                    );
                } else if (finishedCallback) finishedCallback(0);
            } .bind(this)
        );
    },

    _performSearch: function () {
        var searchCriteria = this._searchOptions.get_searchCriteria();
        if (!this._validateSearchCriteria(searchCriteria)) {
            return;
        }
        this._searchOptions.showRequestProgress();
        this._requestSearchData(searchCriteria);
    },

	_perfomrmDownloadSearchResults: function(){
		var searchCriteria = this._searchOptions.get_searchCriteria();
        if (!this._validateSearchCriteria(searchCriteria)) {
            return;
        }
		//this._searchOptions.showRequestProgress();
        this._downloadSearchData(searchCriteria);
	},
	
    _validateSearchCriteria: function (searchCriteria) {
        if (!searchCriteria.dateStart) {
            this._showMessage(_gtxt('Начальная дата поиска задана неверно.'));
            return false;
        }
        if (!searchCriteria.dateEnd) {
            this._showMessage(_gtxt('Конечная дата поиска задана неверно.'));
            return false;
        }
        if (!searchCriteria.satellites.length) {
            this._showMessage(_gtxt('Пожалуйста, укажите источники снимков.'));
            return false;
        }
        if (!searchCriteria.queryType ||
             searchCriteria.dateStart.valueOf() > searchCriteria.dateEnd.valueOf()) {
            this._showMessage(_gtxt('Параметры поиска заданы неверно.'));
            return false;
        }
        return true;
    },

    _requestSearchData: function (searchCriteria) {
        //this._dataProvider.postData(
		sendCrossDomainPostRequest(
        // URL
            this._urlProvider.getServiceUrl(),
        //Data
			this._urlProvider[
                    searchCriteria.queryType == 'all' ? 'getPeriodSourceData' : 'getBoxSourceData'
                ](searchCriteria),
        //OnSuccess
            function (data) {
                this._searchOptions.hideRequestProgress();
				_data = data.Result;
                if (_data == 'exceeds') { //data.Status == 'ok' && data.Result == 'exceeds') {
                    this._waitingDialog.close();
					if (AuthController.userInfo.Role != 'scanex') {
						this._showMessage(_gtxt('Найдено слишком много снимков.\nПожалуйста, уточните параметры поиска.'));
						return;
					}
					else{
						if (confirm(_gtxt('Найдено слишком много снимков для отображения. Скачать shp-файл?'))){
							this._downloadSearchData(searchCriteria);
						}
						return;
					}
                }
                if (_data.length > 0) {
                    this._searchResults.show();
                    this._searchResults.selectList('results');
                    if (searchCriteria.searchGeometry.length) this._zoomToGeometry();
                    this._waitingDialog.open();
                    this._searchResults.setData(_data, function () {
                        this._waitingDialog.close();
                    } .bind(this));
                } else {
                    this._waitingDialog.close();
                    this._showMessage(_gtxt('Ничего не найдено, измените параметры поиска.'));
                }
            } .bind(this)
		);
    },

	_downloadSearchData: function(searchCriteria) {
		this._shapeFile.downloadByParams( 
			this._urlProvider[
				searchCriteria.queryType == 'all' ? 'getPeriodSourceData' : 'getBoxSourceData'
			](searchCriteria),
			function(){
				//this._searchOptions.hideRequestProgress();
			}.bind(this)
			);
	},
	
    _zoomToGeometry: function () {
        var objects = [];
        this._map.drawing.forEachObject(function (o) { if (o.properties.isVisible) objects.push(o); });

        if (objects.length != 0) {
            var b = getBounds();
            for (var i = 0; i < objects.length; ++i)
                b.update(objects[i].geometry.coordinates);
            //var x = globalFlashMap.getX(), y = globalFlashMap.getY();
            //if ((x < b.minX) || (y < b.minY) || (x > b.maxX) || (y > b.maxY))
            globalFlashMap.zoomToExtent(b.minX, b.minY, b.maxX, b.maxY);
        }
    },

    _showMessage: function (text) {
        alert(text);
    },
	
	_objectFinished: function(){
		this._updateDownloadButtonVisibility();
		if (geometryCount(this._map) == 1){
			this._panels.right.collapser.show();
			this._setPanelState('right', true);
		}
	},
	
	_objectRemoved: function(){
		this._updateDownloadButtonVisibility();
		if (geometryCount(this._map) <= 1){
			this._panels.right.collapser.hide();
			this._setPanelState('right', false);
		}
	}
}