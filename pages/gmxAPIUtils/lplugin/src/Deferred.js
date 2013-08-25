var gmxDeferred = function() {
    var resolveCallbacks = [],
        rejectCallbacks = [],
        isFulfilled = false,
        isResolved = false,
        fulfilledData,
        onceAdded = false;
        
    var _fulfill = function(data, resolved) {
        if (isFulfilled) {
            return;
        }
        var callbacks = resolved ? resolveCallbacks : rejectCallbacks;
        fulfilledData = data;
        isFulfilled = true;
        isResolved = resolved;
        
        callbacks.forEach(function(callback) { callback(data); });
        resolveCallbacks = rejectCallbacks = [];
    }
    
    this.resolve = function(data) {
        _fulfill(data, true);
    }
    
    this.reject = function(data) {
        _fulfill(data, false);
    }
    
    this.done = function(resolveCallback, rejectCallback) {
        if (isFulfilled) {
            if (isResolved) {
                resolveCallback && resolveCallback(fulfilledData);
            } else {
                rejectCallback && rejectCallback(fulfilledData);
            }
        } else {
            resolveCallback && resolveCallbacks.push(resolveCallback);
            rejectCallback && rejectCallbacks.push(rejectCallback);
        }
    }
    
    this.once = function(onceResolveCallback) {
        if (!onceAdded) {
            onceAdded = true;
            this.done(onceResolveCallback);
        }
    }
    
    this.getFulfilledData = function() {
        return fulfilledData;
    }
}