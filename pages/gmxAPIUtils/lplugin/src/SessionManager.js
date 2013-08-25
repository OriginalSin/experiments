/** Asynchronously request session keys from GeoMixer servers (given apiKey and server host)
*/
var gmxSessionManager = {
    requestSessionKey: function(serverHost, apiKey) {
        var keys = this._keys;
        if (!(serverHost in keys)) {
            keys[serverHost] = new gmxDeferred();
            gmxAPIutils.request({
                url: "http://" + serverHost + "/ApiKey.ashx?WrapStyle=None&Key=" + apiKey,
                callback: function(ph) {
                    ph = JSON.parse(ph);
                    //TODO: check ph.Result.Status
                    if(ph && ph.Status === 'ok') {
                        keys[serverHost].resolve(ph.Result.Key);
                    } else {
                        keys[serverHost].reject();
                    }
                }
            });
        }
        return keys[serverHost];
    },
    //get already received session key
    getSessionKey: function(serverHost) {
        return this._keys[serverHost] && this._keys[serverHost].getFulfilledData();
    },
    _keys: {} //deferred for each host
}