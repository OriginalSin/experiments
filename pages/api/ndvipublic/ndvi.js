/*Пример конфигурационого файла для ndvi плагина
var defaultMapID = 'ZHP5C';
var serverBase = 'http://maps.kosmosnimki.ru/';
var gmxAuthServer = 'http://my.kosmosnimki.ru/';

var gmxPlugins = [
    {file: './plugins/ndvi/ndvi.js', module: 'ndvi',params: {mapId:'ZHP5C',legendPath:'./plugins/ndvi/legend/NDVI_byte_101_legend.icxleg'}}
];
*/

(function(){
/*var extendJQuery;
extendJQuery = function() {
	if (typeof $ !== 'undefined') {
		$.getCSS = $.getCSS || function(url) {
			if (document.createStyleSheet) {
				document.createStyleSheet(url);
			} else {
				$("head").append("<link rel='stylesheet' type='text/css' href='" + url + "'>");
			}
		}
	} else {
		setTimeout(extendJQuery, 100);
	}

	$('input.inputStyle').each(function(){
		$(this)
		.data('default', $(this).val())
		.addClass('inactive')
		.focus(function() {
			$(this).removeClass('inactive');
			if($(this).val() === $(this).data('default') || $(this).val() === '') {
				$(this).val('');
			}
		})
		.blur(function() {
			if($(this).val() === '') {
				$(this).addClass('inactive').val($(this).data('default'));
			}
		});
	});
}
extendJQuery();*/

var publicInterface = {
	pluginName: 'ndvi',
	afterViewer: function(params){
			var map = gmxAPI.map;

				$.each(params.legendLayers, function(index, value) {
					var layerLegend = map.layers[value.layerName];
					var mainUrl = value.legendPath;
					layerLegend.addImageProcessingHook(function(obj,attr){
						function getTiles(url){
							var legend=[];
							var canvas = document.createElement("canvas");//Создаем новый элемент canvas
							$.ajax({
								type: "GET",
								url: url,
								dataType: "xml",
								success:function(xml){
									$(xml).find("ENTRY").each(function () {
										var code = $(this).find('Code').text(),
											partRed = $(this).find('Color > Part_Red').text(),
											partGreen = $(this).find('Color > Part_Green').text(),
											partBlue = $(this).find('Color > Part_Blue').text();
											legend[parseInt(code)]={'partRed':parseInt(partRed),'partGreen':parseInt(partGreen),'partBlue':parseInt(partBlue)};
									});
									legend[0]={'partRed':0,'partGreen':0,'partBlue':0};
									canvas.width = 256;
									canvas.height = 256;
									var context = canvas.getContext('2d');// Определяем контекст canvas
									context.drawImage(obj, 0, 0, 256, 256);  // Рисуем изображение от точки с координатами 0,0 шириной и высотой 256(эти параметры можно опустить)
									var imgd = context.getImageData(0, 0, 256, 256);//Получаем данные изображения с canvas
									var pix = imgd.data;//Получаем массив пикселов
									for (var i = 0, n = pix.length; i < n; i += 4){ //В цикле массива пикселов
										if(legend[pix[i]]!==undefined){
											pix[i] = legend[pix[i]].partRed;
											pix[i + 1] = legend[pix[i+1]].partGreen;
											pix[i + 2] = legend[pix[i+2]].partBlue;
										}
									}
									context.putImageData(imgd, 0, 0);//записываем изменненые данные в контекст canvas
									attr.callback(canvas);
								}
							});
						}

						var tile;
						if($.isEmptyObject(value.condition)){
							tile=getTiles(mainUrl);
						}else{
							$.each(value.condition, function(i, val) {
								if(attr.properties.prodtype==val.field)
									tile=getTiles(val.legendPath);
								else
									tile=getTiles(mainUrl);
							});
						}
						return null;
					});
				});

			var $div = $("<div'></div>");
			var yearValue = new Array();
			var checkList = new Array();
			var filtered = new Array();
			var dialog;
			var selectFeature=null;
			
			$.each(params.fieldLayers,function(j,layer){
				var infoLayer = gmxAPI.map.layers[layer.layerName];
				if(!infoLayer.getVisibility())
					infoLayer.setVisible(true);

				infoLayer.addListener("onClick",function(ob){
					var dataMean = [];
					var JSON_text;
					var deferreds = [];

					var colorArray = [];
					var rainbow = new Rainbow();
					var clickValue;

					if (selectFeature) selectFeature.remove();
					selectFeature = map.addObject();
					selectFeature.setStyle({outline:{color:0xff0000,thickness:1,opacity:100},fill:{color:0x0000ff,opacity:50}});
					selectFeature.setGeometry(ob.obj.getGeometry());

					if(!dialog){
						dialog=showDialog("Графики среднего значения NDVI", $div.get(0), 820, 550, false, false,null, function(){
							dialog = null;
							if (selectFeature) selectFeature.remove();
						});
						$(dialog).dialog('option','zIndex',20000);
						$(dialog).dialog('moveToTop');
					}

					$($div.get(0)).empty();
					$($div.get(0)).append('<div class="container demo-3"><section class="main"><ul class="bokeh"><li></li><li></li><li></li><li></li></ul><p style="text-align:center">Загрузка данных ...</p></section></div>');

					$.each(params.baloonLayers, function(index, value) {
						var deferred = $.Deferred();
						deferreds.push(deferred);
						JSON_text={};
						JSON_text.Border=ob.obj.getGeometry();
						JSON_text.BorderSRS="EPSG:4326";
						JSON_text.Items=[];

						var layerBaloon = map.layers[value.layerName];
						layerBaloon.getFeatures("",
							function(features){
								if(features.length>0){
									for (var i = 0; i < features.length; i++){
										var dateTmp;
										if(features[i].properties.prodtype==value.condition){
											if(features[i].properties.firstday)
												dateTmp=new Date(features[i].properties.firstday*1000);
											else
												dateTmp=new Date(features[i].properties.acqdate*1000);

											JSON_text.Items.push({
												"Layers":[features[i].properties.GMX_RasterCatalogID],
												"Channels":["r","g","b"],
												"Return":["Stat"]
											});
											dataMean.push({yearKey:dateTmp.getFullYear().toString(),layerName:value.layerName,date:dateTmp});
										}
									}
								}//end if				
								(function(){
									var host ='http://maps.kosmosnimki.ru/plugins/getrasterhist.ashx';
									var url =host+'Request='+JSON.stringify(JSON_text);
									sendCrossDomainPostRequest(host,{'WrapStyle': 'window','Request':JSON.stringify(JSON_text)},
										function(response){
											if(response && response['Result'] && response['Result'].length > 0) {
												for (var i = 0; i < response['Result'].length; i++){
													dataMean[i]["mean"]=(Number(response['Result'][i].Channels.b.Expectation)-1)/100;
												}
											}
											deferred.resolve();
										}
									);
								})();
							},
							ob.obj.getGeometry()
						);//end getFeature
					});

					$.when.apply($,deferreds).then(function(){
						var valueArray=[];
						function unique(arr) {
							var obj = {};
							for(var i=0; i<arr.length; i++) {
								var str = arr[i];
								obj[str] = true;
							}
							return Object.keys(obj);
						}

						
						function getGraph(year){
							if(yearValue.length==0)
								graph=[];
							else{
								graph=[];
								$.each(yearValue,function(i,val){
									$.each(dataMean, function(index, value){
										if(value.yearKey==val){
											var graphPoint = new Object();
											graphPoint["date"]=new Date("2000/"+(value.date.getMonth()+1).toString()+"/"+value.date.getDate().toString());
											graphPoint["fullDate"]=value.date.getFullYear().toString()+"."+(value.date.getMonth()+1).toString()+"."+value.date.getDate().toString();
											valueArray.push(value.layerName.toString()+"_"+val);
											graphPoint[value.layerName.toString()+"_"+val]=value.mean;
											graph.push(graphPoint);
										}
									});
								});
							}

							valueArray=unique(valueArray);
							graph.sort(function (a, b) {
								return a.date-b.date;
							});
							$.each(graph,function(index,value){
								value.date="2000-"+(value.date.getMonth()+1).toString()+"-"+value.date.getDate().toString();
							});

							return {graph:graph,ykeys:valueArray,labels:valueArray};
						}

						function pointValue(){
							var date = nsGmx.Calendar.toUTC($.datepicker.parseDate('yy.mm.dd', clickValue));
							var calendar = nsGmx.widgets.commonCalendar.get();
							calendar.setDateBegin(date, true);
							calendar.setDateEnd(new Date(date.valueOf() + 24*3600*1000 - 1));							
							$.each(valueArray,function(i,v){
								v=v.substr(0,v.length-5);
								//map.layers[v].setVisible(v in obj);
								map.layers[v].setVisible(true);
								var sql;
								if($('input[name=radioGroup]:checked').val()===undefined)
									sql="";
								else
									sql='"prodtype" = \''+$('input[name=radioGroup]:checked').val().toString()+'\'';
								map.layers[v].setVisibilityFilter(sql);
							});
						}

						if(checkList.length==0){
							$.each(dataMean,function(index,val){
								var obj=new Object();
								obj.yearKey=val.yearKey;
								obj.check="";
								obj.color="";
								checkList.push(obj);
							
							});
						}										
						var used = {};
						filtered = checkList.filter(function(obj) {
							return obj.yearKey in used ? 0:(used[obj.yearKey]=1);
						});
						filtered.sort(function (a, b) {
							return b.yearKey - a.yearKey;
						});

						rainbow.setSpectrum('#ff0000','#ffffff', '#0000ff');
						rainbow.setNumberRange(1, filtered.length);
						for (var i = 0; i < filtered.length ; i++) {
							var hex = '#' + rainbow.colourAt(i);
							filtered[i].color=hex;
						}					

						filtered[0].check="checked";
						if($.inArray(filtered[0].yearKey, yearValue)==-1)
							yearValue.push(filtered[0].yearKey);
						checkList= [].concat(filtered);


						/*$div.dialog({
							title: "Графики среднего значения NDVI",
							zIndex: 3999,
							height:'auto',
							width:'auto',
							draggable:true,
							resizable:false,
							close: function(){
								$div.dialog("destroy");
							}
						});*/

						//$($div.get(0)).attr('style', "width:720px; height:450px");
						
						$($div.get(0)).empty();

						$($div.get(0)).append('<input style="margin-left: 10px;" type="radio" name="radioGroup" id="NDVI16" value="NDVI16" checked><label for="NDVI16">  NDVI</label><input style="margin-left: 10px;" type="radio" name="radioGroup" id="QUALITY16" value="QUALITY16"><label for="QUALITY16">  QUALITY</label>')
						var divStr='<div style="float:left; margin-top: 10px;">';
												
						for(var i=0;i<filtered.length;i++){

							divStr+='<input style="margin-left: 10px;" type="checkbox" name="checkList[]" id="'+filtered[i].yearKey+'" value="'+filtered[i].yearKey+'"'+filtered[i].check+'>';
							divStr+='<label for="'+filtered[i].yearKey+'" style="background-color:'+filtered[i].color+'">  '+filtered[i].yearKey+'  </label>';
							divStr+='<br>';
						}
						divStr+='</div>';
						
						$($div.get(0)).append('<hr>'+divStr);
						$($div.get(0)).append('<div id="line-example" style="width:740px; height:380px; float:left;"></div>');

						mGraph=Morris.Line({
							element: 'line-example',
							data: [],
							xkey: 'date',
							ykeys: [],
							labels:[],
							xLabelFormat: function (x) {
							 	var monthArray=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
							 	var monthStr=monthArray[x.getMonth()];
							 	return monthStr;
							 },
							events:["2000-01-01","2000-02-01","2000-03-01","2000-04-01","2000-05-01","2000-06-01","2000-07-01","2000-08-01","2000-09-01","2000-10-01","2000-11-01","2000-12-01","2000-12-31"],
							eventLineColors:["#aaa"],
							eventStrokeWidth:2,
							smooth:false,
							//parseTime:false,
							hoverCallback: function (index, options, content) {
								var row = options.data[index];
								var str="";
								str+='<div>Дата: ' + row["fullDate"] + '</div>';
								$.each(valueArray,function(i,v){
									var value=Number(row[v]).toFixed(2);
									if(value!="NaN")
										str+='<div>' + v + ':' + value + '</div>';
								});
								return str;
							},
							xLabelMargin:10,
							integerYLabels: true,
						}).on('click', function(index, obj) {
							clickValue=obj["fullDate"];
							pointValue();
	                    });

	                    //var colorG=[];
						$('input[type=checkbox]').live( 'change', function(){
							var checkYear=$(this).attr('id');
							//colorG=[];
							function getColor(){
								var colorG=[];
								$.each(checkList,function(i,v){
									if(v.yearKey==checkYear && v.check!="checked"){
										v.check="checked";
										yearValue.push(checkYear);
										//colorG.push(v.color);
										//console.log(v.color);
										colorG[i]=v.color;
									}else if(v.yearKey==checkYear){
										v.check="";
										var position = $.inArray(checkYear, yearValue);
										if(position!=-1){
											yearValue.splice($.inArray(checkYear, yearValue), 1);
											//colorG.splice($.inArray(v.color, colorG), 1);
											//console.log(i);
											//colorG.splice(i, 1);
											delete colorG[i];
										}
									}
								});

								var color=[];
								for (var key in colorG) {
									color.push(colorG[key]);
								}
								return color;
							}

							
							//console.log(color);
							var dataGraph=getGraph();
							mGraph.options.ykeys=dataGraph.ykeys;
							mGraph.options.lineColors=[].concat(getColor());
							console.log(mGraph.options.lineColors);
							mGraph.options.labels=dataGraph.labels;
							mGraph.options.continuousLine=false;
							mGraph.setData(dataGraph.graph);
						});
				
						$("input[name='radioGroup']").change(function() {
							if(clickValue)
								pointValue();
						});
						// var color=[];
						// colorG[0]=filtered[0].color;
						//colorG.push(filtered[0].color);
						//colorG.push(filtered[0].color);
						var dataGraph=getGraph();
						mGraph.options.ykeys=dataGraph.ykeys;
						mGraph.options.labels=dataGraph.labels;
						mGraph.options.continuousLine=false;
						mGraph.options.lineColors=[filtered[0].color];
						//mGraph.options.lineColors=color;
						mGraph.setData(dataGraph.graph);
	 				})
				});
			});

	}
	//beforeViewer:function(){},
	//addMenuItems: addMenuItems
};

window.gmxCore && window.gmxCore.addModule('ndvi', publicInterface,{
		init: function(module, path){
			return $.when(
				gmxCore.loadScript(path + "raphael-min.js"),
				gmxCore.loadScript(path + "morris.min.js"),
				gmxCore.loadScript(path + "rainbowvis.js")
			);
		},
		css: 'ndvi.css'
	});
})();
