var gmxNullMap = {
	"properties":{
		"UseOpenStreetMap": true	// добавить OpenStreetMap к базовым подложкам
		,"DefaultLanguage": "rus"	// язык карты rus или eng
		,"DefaultLat":69,"DefaultLong":105,"DefaultZoom":3	// начальная позиция карты
	}
	//,"children":[]
};

OSMTileFunction = function(i, j, z) {
	return "http://b.tile.openstreetmap.org/" + z + "/" + i + "/" + j + ".png";
};
OSMhash = {
	'urlOSM': "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	'subdomains': "b"
}
