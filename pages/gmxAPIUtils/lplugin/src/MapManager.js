/** Asynchronously request information about map given server host and map name
*/
var gmxMapManager = {
    getMap: function(serverHost, apiKey, mapName) {
        var maps = this._maps;
        if (!maps[serverHost] || !maps[serverHost][mapName]) {
            var def = new gmxDeferred();
            maps[serverHost] = maps[serverHost] || {};
            maps[serverHost][mapName] = def;
            
            gmxSessionManager.requestSessionKey(serverHost, apiKey).done(function(sessionKey) {
                gmxAPIutils.request({
                    url: "http://" + serverHost + "/TileSender.ashx?WrapStyle=None&key=" + encodeURIComponent(sessionKey) + "&MapName=" + mapName + '&ModeKey=map',
                    callback: function(st) {
                        json = JSON.parse(st);
                        if (json && json.Status === 'ok' && json.Result) {
                            def.resolve(json.Result);
                        } else {
                            def.reject(json);
                        }
                    }
                });
            })
        }
        return maps[serverHost][mapName];
    },
    _maps: {} //Deferred for each map. Structure maps[serverHost][mapName]
}