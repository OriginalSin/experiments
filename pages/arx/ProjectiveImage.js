// ProjectiveImage - projective transform that maps [0,1]x[0,1] onto the given set of points.
(function()
{
	var Matrix = function (w, h, values) {
	  this.w = w;
	  this.h = h;
	  this.values = values || allocate(h);
	};

	var allocate = function (w, h) {
	  var values = [];
	  for (var i = 0; i < h; ++i) {
		values[i] = [];
		for (var j = 0; j < w; ++j) {
		  values[i][j] = 0;
		}
	  }
	  return values;
	}

	var cloneValues = function (values) {
		var clone = [];
		for (var i = 0; i < values.length; ++i) {
			clone[i] = [].concat(values[i]);
		}
		return clone;
	}
	Matrix.prototype = {
		add : function (operand) {
			if (operand.w != this.w || operand.h != this.h) {
				throw new Error("Matrix add size mismatch");
			}

			var values = allocate(this.w, this.h);
			for (var y = 0; y < this.h; ++y) {
				for (var x = 0; x < this.w; ++x) {
				  values[y][x] = this.values[y][x] + operand.values[y][x];
				}
			}
			return new Matrix(this.w, this.h, values);
		},
		transformProjectiveVector : function (operand) {
			var out = [], x, y;
			for (y = 0; y < this.h; ++y) {
				out[y] = 0;
				for (x = 0; x < this.w; ++x) {
					out[y] += this.values[y][x] * operand[x];
				}
			}
			var zn = out[out.length - 1];
			if(zn) {
				var iz = 1 / (out[out.length - 1]);
				for (y = 0; y < this.h; ++y) {
					out[y] *= iz;
				}
			}
			return out;
		},
		multiply : function (operand) {
			var values, x, y;
			if (+operand !== operand) {
				// Matrix mult
				if (operand.h != this.w) {
					throw new Error("Matrix mult size mismatch");
				}
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < operand.w; ++x) {
						var accum = 0;
						for (var s = 0; s < this.w; s++) {
							accum += this.values[y][s] * operand.values[s][x];
						}
						values[y][x] = accum;
					}
				}
				return new Matrix(operand.w, this.h, values);
			}
			else {
				// Scalar mult
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < this.w; ++x) {
						values[y][x] = this.values[y][x] * operand;
					}
				}
				return new Matrix(this.w, this.h, values);
			}
		},
		rowEchelon : function () {
			if (this.w <= this.h) {
				throw new Error("Matrix rowEchelon size mismatch");
			}

			var temp = cloneValues(this.values);

			// Do Gauss-Jordan algorithm.
			for (var yp = 0; yp < this.h; ++yp) {
				// Look up pivot value.
				var pivot = temp[yp][yp];
				while (pivot == 0) {
					// If pivot is zero, find non-zero pivot below.
					for (var ys = yp + 1; ys < this.h; ++ys) {
						if (temp[ys][yp] != 0) {
							// Swap rows.
							var tmpRow = temp[ys];
							temp[ys] = temp[yp];
							temp[yp] = tmpRow;
							break;
						}
					}
					if (ys == this.h) {
						// No suitable pivot found. Abort.
						return new Matrix(this.w, this.h, temp);
					}
					else {
						pivot = temp[yp][yp];
					}
				}
				// Normalize this row.
				var scale = 1 / pivot;
				for (var x = yp; x < this.w; ++x) {
					temp[yp][x] *= scale;
				}
				// Subtract this row from all other rows (scaled).
				for (var y = 0; y < this.h; ++y) {
					if (y == yp) continue;
					var factor = temp[y][yp];
					temp[y][yp] = 0;
					for (x = yp + 1; x < this.w; ++x) {
						temp[y][x] -= factor * temp[yp][x];
					}
				}
			}

			return new Matrix(this.w, this.h, temp);
		},
		invert : function () {
			var x, y;

			if (this.w != this.h) {
				throw new Error("Matrix invert size mismatch");
			}

			var temp = allocate(this.w * 2, this.h);

			// Initialize augmented matrix
			for (y = 0; y < this.h; ++y) {
				for (x = 0; x < this.w; ++x) {
					temp[y][x] = this.values[y][x];
					temp[y][x + this.w] = (x == y) ? 1 : 0;
				}
			}

			temp = new Matrix(this.w * 2, this.h, temp);
			temp = temp.rowEchelon();

			// Extract right block matrix.
			var values = allocate(this.w, this.h);
			for (y = 0; y < this.w; ++y) {
				// @todo check if "x < this.w;" is mistake
				for (x = 0; x < this.w; ++x) {
					values[y][x] = temp.values[y][x + this.w];
				}
			}
			return new Matrix(this.w, this.h, values);
		}
	};

	var getProjectiveTransform = function (points) {
	  var eqMatrix = new Matrix(9, 8, [
		[ 1, 1, 1,   0, 0, 0, -points[3][0],-points[3][0],-points[3][0] ],
		[ 0, 1, 1,   0, 0, 0,  0,-points[2][0],-points[2][0] ],
		[ 1, 0, 1,   0, 0, 0, -points[1][0], 0,-points[1][0] ],
		[ 0, 0, 1,   0, 0, 0,  0, 0,-points[0][0] ],

		[ 0, 0, 0,  -1,-1,-1,  points[3][1], points[3][1], points[3][1] ],
		[ 0, 0, 0,   0,-1,-1,  0, points[2][1], points[2][1] ],
		[ 0, 0, 0,  -1, 0,-1,  points[1][1], 0, points[1][1] ],
		[ 0, 0, 0,   0, 0,-1,  0, 0, points[0][1] ]

	  ]);

	  var kernel = eqMatrix.rowEchelon().values;
	  var transform = new Matrix(3, 3, [
		[-kernel[0][8], -kernel[1][8], -kernel[2][8]],
		[-kernel[3][8], -kernel[4][8], -kernel[5][8]],
		[-kernel[6][8], -kernel[7][8],             1]
	  ]);
	  return transform;
	}

	var divide = function (u1, v1, u4, v4, p1, p2, p3, p4, attr) {
		 // See if we can still divide.
		if (attr.limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 == 0 && u4 == 1) || ((.25 + r * 5) * area > (attr.patchSize * attr.patchSize))) {
				// Calculate subdivision points (middle, top, bottom, left, right).
				var umid = (u1 + u4) / 2;
				var vmid = (v1 + v4) / 2;
				var tr   = attr.transform;
				var pmid = tr.transformProjectiveVector([umid, vmid, 1]);
				var pt   = tr.transformProjectiveVector([umid, v1, 1]);
				var pb   = tr.transformProjectiveVector([umid, v4, 1]);
				var pl   = tr.transformProjectiveVector([u1, vmid, 1]);
				var pr   = tr.transformProjectiveVector([u4, vmid, 1]);
				
				// Subdivide.
				attr.limit--;
				divide.call(this, u1,   v1, umid, vmid,   p1,   pt,   pl, pmid, attr);
				divide.call(this, umid,   v1,   u4, vmid,   pt,   p2, pmid,   pr, attr);
				divide.call(this, u1,  vmid, umid,   v4,   pl, pmid,   p3,   pb, attr);
				divide.call(this, umid, vmid,   u4,   v4, pmid,   pr,   pb,   p4, attr);

				return;
			}
		}
		
		var ctx = attr.ctx;

		// Render this patch.
		ctx.save();
//ctx.clearRect(0, 0, attr['canvas'].width, attr['canvas'].height);
		// Set clipping path.
		ctx.beginPath();
	
		ctx.moveTo(p1[0], p1[1]);
		ctx.lineTo(p2[0], p2[1]);
		ctx.lineTo(p4[0], p4[1]);
		ctx.lineTo(p3[0], p3[1]);

/*

		ctx.moveTo(p1[0] - attr['deltaX'], p1[1] - attr['deltaY']);
		ctx.lineTo(p2[0] - attr['deltaX'], p2[1] - attr['deltaY']);
		ctx.lineTo(p4[0] - attr['deltaX'], p4[1] - attr['deltaY']);
		ctx.lineTo(p3[0] - attr['deltaX'], p3[1] - attr['deltaY']);
*/		
		ctx.closePath();
		//ctx.clip();
		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		switch (amax) {
			case a1:
				ctx.transform(d12[0], d12[1], -d31[0], -d31[1], p1[0] + attr['deltaX'], p1[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				break;
			case a2:
				ctx.transform(d12[0], d12[1],  d24[0],  d24[1], p2[0] + attr['deltaX'], p2[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				break;
			case a4:
				ctx.transform(-d43[0], -d43[1], d24[0], d24[1], p4[0] + attr['deltaX'], p4[1] + attr['deltaY']);
				// Calculate 1.05 pixel padding on vector basis.
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
				dx = -1;
				dy = -1;
				break;
			case a3:
				// Calculate 1.05 pixel padding on vector basis.
				ctx.transform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0] + attr['deltaX'], p3[1] + attr['deltaY']);
				if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
				if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
				dy = -1;
				break;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		var padu = padx * du;
		var padv = pady * dv;


		var iw = attr.imageObj.width;
		var ih = attr.imageObj.height;

		ctx.drawImage(
			attr.imageObj,
			u1 * iw,
			v1 * ih,
			Math.min(u4 - u1 + padu, 1) * iw,
			Math.min(v4 - v1 + padv, 1) * ih,
			dx, dy,
			1 + padx, 1 + pady
		);
		ctx.restore();
	}

	var ProjectiveImage = function (attr) {
		var transform = getProjectiveTransform(attr.points);
		// Begin subdivision process.

		var ptl = transform.transformProjectiveVector([0, 0, 1]);
		var ptr = transform.transformProjectiveVector([1, 0, 1]);
		var pbl = transform.transformProjectiveVector([0, 1, 1]);
		var pbr = transform.transformProjectiveVector([1, 1, 1]);
		var	boundsP = new L.Bounds();
		boundsP.extend(new L.Point(ptl[0], ptl[1]));
		boundsP.extend(new L.Point(ptr[0], ptr[1]));
		boundsP.extend(new L.Point(pbr[0], pbr[1]));
		boundsP.extend(new L.Point(pbl[0], pbl[1]));
		var ww = boundsP.max.x - boundsP.min.x;
		var hh = boundsP.max.y - boundsP.min.y;
		if(attr.wView < ww || attr.hView < hh) {
			ww = attr.wView;
			hh = attr.hView;
		}
		var canvas = document.createElement("canvas");
		var w = attr.imageObj.width;
		var h = attr.imageObj.height;
		attr['canvas'] = canvas;
		attr['ctx'] = canvas.getContext('2d');
		attr['ctx'].setTransform(1, 0, 0, 1, 0, 0);
		attr['transform'] = transform;
		canvas.width = ww;
		canvas.height = hh;
		if(!attr['patchSize']) attr['patchSize'] = 4;
		if(!attr['limit']) attr['limit'] = 5;

		try {
			divide( 0, 0, 1, 1, ptl, ptr, pbl, pbr, attr );
		} catch(e) {
			gmxAPI.addDebugWarnings({'func': 'ProjectiveImage', 'event': e});
			canvas = null;
		}
		return {
			'canvas': canvas
			,'ptl': ptl
			,'ptr': ptr
			,'pbl': pbl
			,'pbr': pbr
		};
	}
	
	//расширяем namespace
	if(!gmxAPI) gmxAPI = {};
	if(!gmxAPI._leaflet) gmxAPI._leaflet = {};
	gmxAPI._leaflet['ProjectiveImage'] = ProjectiveImage;
})();

