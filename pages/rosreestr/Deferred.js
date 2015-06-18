//all the methods can be called without instance itself
//For example:
//
// var def = new gmxDeferred();
// doSomething(def.resolve) (instead of doSomething(def.resolve.bind(def))
var gmxDeferred = function(cancelFunc) {
    var resolveCallbacks = [],
        rejectCallbacks = [],
        isFulfilled = false,
        isResolved = false,
        fulfilledData,
        onceAdded = false;

    var fulfill = this._fulfill = function(resolved) {
        if (isFulfilled) {
            return;
        }
        var callbacks = resolved ? resolveCallbacks : rejectCallbacks;
        fulfilledData = [].slice.call(arguments, 1);
        isFulfilled = true;
        isResolved = resolved;

        callbacks.forEach(function(callback) { callback.apply(null, fulfilledData); });
        resolveCallbacks = rejectCallbacks = [];
    };

    this.resolve = function(/*data*/) {
        fulfill.apply(null, [true].concat([].slice.call(arguments)));
    };

    this.reject = function(/*data*/) {
        fulfill.apply(null, [false].concat([].slice.call(arguments)));
    };

    var then = this.then = function(resolveCallback, rejectCallback) {
        var def = new gmxDeferred(),
            fulfillFunc = function(func, resolved) {
                return function() {
                    if (!func) {
                        def._fulfill.apply([resolved].concat([].slice.call(arguments)));
                    } else {
                        var res = func.apply(null, arguments);
                        if (res instanceof gmxDeferred) {
                            res.then(def.resolve, def.reject);
                        } else {
                            def.resolve(res);
                        }
                    }
                };
            };
        if (isFulfilled) {
            fulfillFunc(isResolved ? resolveCallback : rejectCallback, isResolved).apply(null, fulfilledData);
        } else {
            resolveCallbacks.push(fulfillFunc(resolveCallback, true));
            rejectCallbacks.push(fulfillFunc(rejectCallback, false));
        }
        return def;
    };

    this.once = function(onceResolveCallback) {
        if (!onceAdded) {
            onceAdded = true;
            then(onceResolveCallback);
        }
    };

    this.always = function(callback) {
        then(callback, callback);
    };

    this.getFulfilledData = function() {
        return fulfilledData;
    };

    this.cancel = function() {
        cancelFunc && cancelFunc();
    };
};

gmxDeferred.all = function() {
    var defArray = [].slice.apply(arguments);
    var resdef = new gmxDeferred();
    var left = defArray.length;
    var results = new Array(defArray.length);

    defArray.forEach(function(def, i) {
        def.then(function(res) {
            results[i] = res;
            left--;
            if (left === 0) {
                resdef.resolve.apply(resdef, results);
            }
        });
    });

    return resdef;
};

L.gmx = L.gmx || {};
L.gmx.Deferred = gmxDeferred;
