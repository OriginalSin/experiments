experiments
===========

Пример|Описание|Примечание
------|---------|-----------
[gmxHeatMapWebGL.html](http://originalsin.github.io/experiments/pages/webglHeatMap/gmxHeatMapWebGL.html)| [WebGL Heatmap](http://leafletjs.com/plugins.html)| High performance Javascript heatmap plugin using WebGL
[restoreView.html](http://originalsin.github.io/experiments/pages/webglHeatMap/restoreView.html)| [Leaflet.RestoreView](https://github.com/makinacorpus/Leaflet.RestoreView)| Stores and restores map view using localStorage.
[testIframe.html](http://kosmosnimki.ru/demo/testIframe.html)| Листание карт|
[testDrawingObjectsListWidget.html](examples/testDrawingObjectsListWidget.html)|Подключение виджета drawing objects.


Работы с web worker
### Методы
Метод|Синтаксис|Возвращаемое значение|Описание
------|------|:---------:|-----------
setFilter|`setFilter(function(item): Boolean)`|`this`| Установить ф-ция для фильтрации объектов перед рендерингом. Единственный аргумент - ф-ция, которая принимает объект из слоя и возвращает булево значение (`false` - отфильтровать)
bindPopup|`bindPopup(html <String> `&#124;` el <HTMLElement> `&#124;` popup <Popup>, options <Popup options>? )`||
setDateInterval|`setDateInterval(beginDate, endDate)`|`this`|Задаёт временной интервал для мультиврменных слоёв. Только объекты из этого интервала будут загружены и показаны на карте. `beginDate` и `endDate` имеют тип `Date`.
addTo|`addTo(map)`|`this`|Добавить слой на карту. Аргемент `map` имеет тип `L.Map`.
