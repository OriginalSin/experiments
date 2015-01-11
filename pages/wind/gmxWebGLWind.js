/*
 (c) 2014, Sergey Alekseev salekseev@scanex.ru
 Leaflet.Wind2d, plugin for Gemixer layers.
*/
(function() {
    var vertShader = [
        "uniform mat4 u_matrix;",
        "attribute float a_x;",
        "attribute float a_y;",
        "attribute float a_radius;",
        "attribute vec3 a_color;",
        "varying vec3 v_color;",
        
        "void main() {",
        "    gl_PointSize = a_radius;",
        "    gl_Position = u_matrix * vec4(a_x, a_y, 1.0, 1.0);",
        "    v_color = a_color;",
        "}"
    ].join("\n");
    var fragShader = [
        "precision mediump float;",
        "uniform float u_alpha;",
        "varying vec3 v_color;",

        "void main() {",
        "    float centerDist = length(gl_PointCoord - 0.5);",
        "    float radius = 0.5;",
        // works for overlapping circles if blending is enabled
        "    gl_FragColor = vec4(v_color, u_alpha * step(centerDist, radius));",
        "}"
    ].join("\n");
    var shaders = {
        'shader-fs': {
            type: "x-shader/x-fragment",
            value: vertShader
        },
     
        'shader-vs': {
            type: "x-shader/x-vertex",
            value: fragShader
        }
/*
        'shader-fs': {
            type: "x-shader/x-fragment",
            value: '\
precision mediump float;\
varying vec2 vTextureCoord;\
uniform sampler2D uSampler;\
void main(void)  {\
    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);\
}'
        },
     
        'shader-vs': {
            type: "x-shader/x-vertex",
            value: '\
attribute vec3 aVertexPosition;\
uniform mat4 uMVMatrix;\
uniform mat4 uPMatrix;\
void main(void) {\
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);\
}'
        }
*/
    };
var gl,
    resCanvas,
    shaderProgram,
    vertexBuffer,   // буфер вершин
    indexBuffer,    //буфер индексов
    mvMatrix,
    pMatrix;
   
// установка шейдеров
// установка шейдеров
function initShaders() {
    var fragmentShader = getShader(gl.FRAGMENT_SHADER, 'shader-fs');
    var vertexShader = getShader(gl.VERTEX_SHADER, 'shader-vs');
 
    shaderProgram = gl.createProgram();
 
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
 
    gl.linkProgram(shaderProgram);
      
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Не удалось установить шейдеры");
    }
      
    gl.useProgram(shaderProgram);
 
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
    gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
}
/*
function initShaders() {
    var fragmentShader = getShader(gl.FRAGMENT_SHADER, 'shader-fs');
    var vertexShader = getShader(gl.VERTEX_SHADER, 'shader-vs');
 
    shaderProgram = gl.createProgram();
 
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
 
    gl.linkProgram(shaderProgram);
      
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Не удалось установить шейдеры");
    }
      
    gl.useProgram(shaderProgram);
 
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    // создания переменных uniform для передачи матриц в шейдер
    shaderProgram.MVMatrix = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.ProjMatrix = gl.getUniformLocation(shaderProgram, "uPMatrix");
}
*/
function setMatrixUniforms(){
    gl.uniformMatrix4fv(shaderProgram.ProjMatrix,false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.MVMatrix, false, mvMatrix); 
}
// Функция создания шейдера
function getShader(type, id) {
    var shader = gl.createShader(type);

    gl.shaderSource(shader, shaders[id].value);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Ошибка компиляции шейдера: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);  
        return null;
    }
    return shader; 
}
// установка буфера вершин
function initBuffers() {
 
var vertices = [
         0.0,  0.5,  0.0,
        -0.5, -0.5,  0.0,
         0.5, -0.5,  0.0
  ];
  // установка буфера вершин
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  vertexBuffer.itemSize = 3;
  vertexBuffer.numberOfItems = 3;
  var сolors = [
        1.0, 0.0, 0.0,
        0.0, 0.0, 1.0,
        0.0, 1.0, 0.0
    ];
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(сolors), gl.STATIC_DRAW);
}
// отрисовка
function draw() {   
    // установка области отрисовки
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
 
    gl.clear(gl.COLOR_BUFFER_BIT);
   
    // указываем, что каждая вершина имеет по три координаты (x, y, z)
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute,
                         vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexColorAttribute,
                        vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
     
    gl.drawArrays(gl.POINTS, 0, vertexBuffer.numberOfItems);
}
/*
 // установка буферов вершин и индексов
function initBuffers() {
 
    var vertices =[
                // лицевая часть
                -0.5, -0.5, 0.5,
                -0.5, 0.5, 0.5,
                 0.5, 0.5, 0.5,
                 0.5, -0.5, 0.5,
                // задняя часть
                -0.5, -0.5, -0.5,
                -0.5, 0.5, -0.5,
                 0.5, 0.5, -0.5,
                 0.5, -0.5, -0.5];
                  
    var indices = [0, 1, 1, 2, 2, 3, 3, 0, 0, 4, 4, 5, 5, 6, 6,7, 7,4, 1, 5, 2, 6, 3, 7];
     
 // установка буфера вершин
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
 
  vertexBuffer.itemSize = 3;
 
  // создание буфера индексов
  indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    // указываем число индексов это число равно числу индексов
    indexBuffer.numberOfItems = indices.length;
}
  
function draw() {   
     
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute,
                         vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
 
    gl.drawElements(gl.LINES, indexBuffer.numberOfItems, gl.UNSIGNED_SHORT,0);
}
*/
function setupWebGL()
{
    gl.clearColor(0.0, 0.0, 0.0, 0.0); 
    gl.clear(gl.COLOR_BUFFER_BIT); 
                 
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    mvMatrix = mat4.create();
    pMatrix = mat4.create();
    mat4.perspective(pMatrix, 1.04, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix,mvMatrix,[0, 0, -2.0]);
    mat4.rotate(mvMatrix,mvMatrix, 1.9, [0, 1, 0]);
}

L.WebGLWind = L.Class.extend({

    options: {
        pane: 'markerPane',
        //size: 25,
        opacity: 0.1,
        gradientTexture: false,
        alphaRange: 0.2
    },

    setData: function (data) {
        this.data = data;
    },

    initialize: function (map, options) {
        this.data = [];
        L.setOptions(this, options);
    },

    redraw: function () {
        if (this._map && !this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        map.getPanes()[this.options.pane].appendChild(this._canvas);

        map.on('moveend', this.redraw, this);
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._redraw();
    },

    onRemove: function (map) {
        map.getPanes()[this.options.pane].removeChild(this._canvas);

        map.off('moveend', this.redraw, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        if (!this._canvas.parentNode) {
            map.getPanes()[this.options.pane].appendChild(this._canvas);
        }
        map.addLayer(this);
        return this;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            pixelBoundsMin = this._map.getPixelBounds().min;

        var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
        if (pixelBoundsMin.y < 0) offset.y += pixelBoundsMin.multiplyBy(-scale).y;

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        var options = this.options;

var glOpts = { antialias: true, depth: false, preserveDrawingBuffer: true };

try {
    //gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
} catch(e) {
    console.log("Ваш браузер не поддерживает WebGL");
    return;
}
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

initShaders();
 initBuffers();
 setupWebGL();
 setMatrixUniforms();
 draw(); 

        // this.WebGLHeatMap = createWebGLHeatmap({ 
            // canvas: canvas, 
            // gradientTexture: options.gradientTexture, 
            // alphaRange: [0, options.alphaRange]
        // });
    },

    _updateBbox: function (zoom) {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
            ww = gmxAPIutils.worldWidthMerc,
            ww2 = 2 * ww,
            m1 = L.Projection.Mercator.project(southWest),
            m2 = L.Projection.Mercator.project(northEast),
            w = (m2.x - m1.x) / 2,
            center = (m1.x + m2.x) / 2;
        center %= ww2;
        if (center > ww) center -= ww2;
        else if (center < -ww) center += ww2;

        this.mInPixel = gmxAPIutils.getPixelScale(zoom || _map._zoom);
        this._ctxShift = [(w - center) * this.mInPixel, m2.y * this.mInPixel];
    },

    _redraw: function () {
        var _map = this._map,
            size = _map.getSize(),
            _canvas = this._canvas,
            mapTop = _map._getTopLeftPoint(),
            topLeft = _map.containerPointToLayerPoint([0, mapTop.y < 0 ? -mapTop.y : 0]);

        L.DomUtil.setPosition(_canvas, topLeft);
        _canvas.width = size.x; _canvas.height = size.y;
 // initBuffers();
 // setupWebGL();
 // setMatrixUniforms();
 // draw(); 

/*
        this.WebGLHeatMap.adjustSize();

        var heatmap = this.WebGLHeatMap;
        heatmap.clear();
        if (this.data) {
            this._updateBbox();
            var dataLen = this.data.length,
                valScale = this._map._zoom * 1,
                options = this.options,
                ctxShift = this._ctxShift,
                mInPixel = this.mInPixel;
            
            for (var i = 0; i < dataLen; i++) {
                var it = this.data[i].properties,
                    val = options.size || it[5] * valScale || 1,
                    geo = it[it.length - 1],
                    coord = geo.coordinates;

                heatmap.addPoint(
                    Math.floor(coord[0] * mInPixel + ctxShift[0]),
                    Math.floor(ctxShift[1] - coord[1] * mInPixel),
                    val,
                    options.opacity
                );
            }
            heatmap.update();
            heatmap.display();
        }
        this._frame = null;
*/
    }
});

L.webGLWind = function (map, options) {
    return new L.WebGLWind(map, options);
};
})();