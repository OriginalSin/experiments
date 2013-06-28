var gmxNullMap = {
	"properties":{
		"UseOpenStreetMap": true	// �������� OpenStreetMap � ������� ���������
		,"DefaultLanguage": "rus"	// ���� ����� rus ��� eng
		,"DefaultLat":69,"DefaultLong":105,"DefaultZoom":3	// ��������� ������� �����
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
