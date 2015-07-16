
L.DistanceGrid = function (cellSize) {
	this._cellSize = cellSize;
	this._sqCellSize = cellSize * cellSize;
	this._grid = {};
	this._objectPoint = { };
};

L.DistanceGrid.prototype = {

	addObject: function (obj, point) {
		var stamp = this._getStamp(point);

        if (obj instanceof L.MarkerCluster) {
            this._objectPoint[stamp] = obj;
        } else {
            if (!this._objectPoint[stamp]) this._objectPoint[stamp] = {};
            this._objectPoint[stamp][obj.options.properties[0]] = obj;
        }
	},
	getNearObjects: function (point, clear) {
		var stamp = this._getStamp(point),
            ret = this._objectPoint[stamp] || null;
        if (ret && clear) {
            delete this._objectPoint[stamp];
        }
        return ret;
	},
	_getCoord: function (x) {
		return Math.floor(x / this._cellSize);
	},
	_getStamp: function (point) {
		return this._getCoord(point[0]) + '_' + this._getCoord(point[1]);
	},

	clear: function () {
        this._objectPoint = { };
/*
	},
	updateObject: function (obj, point) {
		this.addObject(obj, point);
	},

	//Returns true if the object was found
	removeObject: function (obj, point) {
		var stamp = this._getStamp(point),
		    id = obj.options.properties[0];

        if (this._objectPoint[stamp] && this._objectPoint[stamp][id]) {
            delete this._objectPoint[stamp][id];
            return true;
		}
        return null;
	},

	getNearObject_old: function (point) {
		var x = this._getCoord(point[0]),
		    y = this._getCoord(point[1]),
		    i, j, k, row, cell, len, obj, dist,
		    objectPoint = this._objectPoint,
		    closestDistSq = this._sqCellSize,
		    closest = null;

		for (i = y - 1; i <= y + 1; i++) {
			row = this._grid[i];
			if (row) {

				for (j = x - 1; j <= x + 1; j++) {
					cell = row[j];
					if (cell) {

						for (k = 0, len = cell.length; k < len; k++) {
							obj = cell[k];
							dist = this._sqDist(objectPoint[L.Util.stamp(obj)], point);
							if (dist < closestDistSq) {
								closestDistSq = dist;
								closest = obj;
							}
						}
					}
				}
			}
		}
		return closest;
	},

	_getCoord: function (x) {
		return Math.floor(x / this._cellSize);
	},

	_sqDist: function (p, p2) {
		var dx = p2[0] - p[0],
		    dy = p2[1] - p[1];
		return dx * dx + dy * dy;
*/
	}
};
