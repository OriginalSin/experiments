/*
 (c) 2015, Sergey Alekseev salekseev@scanex.ru
 Leaflet.WindWebGL, plugin for Gemixer layers.
*/
(function() {
    var options = {
        antialias: true
    };
    var shaders = {
        'shader-vs': {
            type: "x-shader/x-vertex",
            value: [
                'uniform mat4 u_matrix;',
                'attribute vec4 a_vertex;',
                'attribute float a_pointSize;',
                'attribute float a_tri;',
                'attribute vec4 a_color;',
                'varying vec4 v_color;',
                //'varying float v_tri;',
                'varying vec4 pos;',

                'void main() {',
                    'gl_PointSize =  a_pointSize;',         // Set the size of the point
                    //'a_vertex.y += a_tri;',
                    'pos = vec4(a_vertex[0] + a_tri * cos(a_color[1]) / 10.0, a_vertex[1] + a_tri * sin(a_color[1]) / 10.0, a_vertex[2], a_vertex[3]);',
                    'gl_Position = u_matrix * pos;',   // multiply each vertex by a matrix.
                    //'gl_Position = u_matrix * a_vertex;',   // multiply each vertex by a matrix.
                    'v_color = a_color;',                   // pass the color to the fragment shader
                    //'v_tri = a_tri;',                       // pass the tick
                '}'
                ].join("\n")
        },

        'shader-fs': {
            type: "x-shader/x-fragment",
            value: [
                'precision mediump float;',
                'varying vec4 v_color;',
                //'varying float v_tri;',

                'void main() {',
                    /*

                    'float border = 0.05;',
                    'float radius = 0.5;',
                    'vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);',
                    'vec4 color1 = vec4(v_color[0], v_color[0], v_color[0], 0.9);',
                    //'vec4 color1 = vec4(v_color[0], 0.0, 0.0, 0.8);',

                    'vec2 m = gl_PointCoord.xy - vec2(0.5, 0.5);',
                    'float dist = radius - sqrt(m.x * m.x + m.y * m.y);',

                    'float t = 0.0;',
                    'if (dist > border) {',
                        't = 0.0;',
                    '} else if (dist > 0.0) {',
                        't = dist / border;',
                    '}',

                    // float centerDist = length(gl_PointCoord - 0.5);
                    // works for overlapping circles if blending is enabled

                    'gl_FragColor = mix(color0, color1, t);',
                    //'gl_FragColor =vec4(v_color[0], v_color[0], v_color[0], t);',

                    */
                    // -- another way for circle
                    'float centerDist = length(gl_PointCoord - v_color[1]/360.0);',
                    'float radius = 0.5;',
                    'float speed = v_color[0];',
                    'float alpha = 0.9 * step(centerDist, radius) * speed / 30.0;',
                    //'float alpha = 0.5 * step(centerDist, radius);',
                    // works for overlapping circles if blending is enabled
                    'if (speed < 0.1 ) {',
                        'gl_FragColor = vec4(v_color[0], v_color[1], v_color[2], 0.0);',
                    '} else if (speed < 3.0 ) {',
                        'gl_FragColor = vec4(148.0, 12.0, 100.0, alpha);',
                        //'gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);',
                    '} else if (speed < 4.0 ) {',
                        'gl_FragColor = vec4(0.0, 149.0, 255.0, alpha);',
                    '} else if (speed < 7.0 ) {',
                        'gl_FragColor = vec4(77.0, 230.0, 0.0, alpha);',
                    '} else if (speed < 9.0 ) {',
                        'gl_FragColor = vec4(250.0, 250.0, 50.0, alpha);',
                    '} else if (speed < 12.0 ) {',
                        'gl_FragColor = vec4(230.0, 121.0, 26.0, alpha);',
                    '} else if (speed < 14.0 ) {',
                        'gl_FragColor = vec4(245.0, 245.0, 122.0, alpha);',
                    '} else if (speed < 18.0 ) {',
                        'gl_FragColor = vec4(250.0, 55.0, 55.0, alpha);',
                    '} else if (speed < 19.0 ) {',
                        'gl_FragColor = vec4(240.0, 14.0, 14.0, alpha);',
                    '} else if (speed < 22.0 ) {',
                        'gl_FragColor = vec4(0.0, 0.0, 255.0, alpha);',
                    '} else if (speed < 24.0 ) {',
                        'gl_FragColor = vec4(135.0, 50.0, 4.0, alpha);',
                    '} else if (speed < 27.0 ) {',
                        'gl_FragColor = vec4(158.0, 40.0, 19.0, alpha);',
                    '} else if (speed < 29.0 ) {',
                        'gl_FragColor = vec4(92.0, 43.0, 17.0, alpha);',
                    '} else if (speed < 32.0 ) {',
                        'gl_FragColor = vec4(105.0, 23.0, 3.0, alpha);',
                    '} else {',
                        'gl_FragColor = vec4(13.0, 12.0, 12.0, alpha);',
                    '}',

                    //'gl_FragColor = vec4(v_color[0], v_color[0], v_color[0], alpha);',

                    /*
                    // simple circles
                    'float d = distance (gl_PointCoord, vec2(0.5,0.5));',
                    'if (d < 0.5 ){',
                        'gl_FragColor =vec4(v_color[0], v_color[1], v_color[2], 0.2);',
                    '} else {',
                        'discard;',
                    '}',

                    // -- squares
                    'gl_FragColor = v_color;',
                    'gl_FragColor =vec4(v_color[0], v_color[1], v_color[2], 0.2);', // v_color;
                    */

                '}'
                ].join("\n")
        }
    };
var gl,
    rTri = 0,
    numPoints = 0,
    leafletMap,
    shaderProgram,
    pixelsToWebGLMatrix = new Float32Array(16),
    mapMatrix = new Float32Array(16),
    u_matLoc;
    

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

// отрисовка
function draw(scale, shiftPoint) {   
    var w = gl.viewportWidth,
        h = gl.viewportHeight;
    // установка области отрисовки
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, w, h);
 
    pixelsToWebGLMatrix.set([2 / w, 0, 0, 0, 0, -2 / h, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);

    var pointSize = Math.max(leafletMap.getZoom() - 4.0, 12.0);
    gl.vertexAttrib1f(gl.aPointSize, pointSize);

    //var dx = 2 * degToRad(rTri) / scale;
    //gl.vertexAttrib1f(gl.aTri, rTri);
    //gl.vertexAttrib1f(gl.iGlobalTime, (new Date()).getTime() / 1000);
    gl.vertexAttrib1f(gl.iGlobalTime, rTri);
//console.log('iGlobalTime', rTri);

    // -- set base matrix to translate canvas pixel coordinates -> webgl coordinates
    mapMatrix.set(pixelsToWebGLMatrix);
    scaleMatrix(mapMatrix, scale, scale);

    translateMatrix(mapMatrix, shiftPoint[0]/scale, shiftPoint[1]/scale);

    // -- attach matrix value to 'mapMatrix' uniform in shader
    gl.uniformMatrix4fv(u_matLoc, false, mapMatrix);
    gl.drawArrays(gl.POINTS, 0, numPoints);
}
// установка буфера вершин
function initBuffers(arr) {
    numPoints = arr.length;
    var vertArray = new Float32Array(numPoints * 5),
        speedMax = 0;
        bufferIndex = 0;
    arr.map(function (d, i) {
        var it = d.properties,
            geo = it[it.length - 1],
            speed = Number(it[5]),
            angle = Number(it[4]),
            coord = geo.coordinates;
        speedMax = Math.max(speedMax, speed);
        vertArray[bufferIndex++] = coord[0];
        vertArray[bufferIndex++] = -coord[1];
        vertArray[bufferIndex++] = speed;
        vertArray[bufferIndex++] = angle;
        vertArray[bufferIndex++] = Math.random();
        //vertArray[bufferIndex++] = Math.random();
    });
    var fsize = vertArray.BYTES_PER_ELEMENT;
    gl.aPointSize = gl.getAttribLocation(shaderProgram, "a_pointSize");

    //gl.aTri = gl.getAttribLocation(shaderProgram, "a_tri");
    gl.iGlobalTime = gl.getUniformLocation(shaderProgram, "iGlobalTime");
 
    var vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertArray, gl.STATIC_DRAW);
    var vertLoc = gl.getAttribLocation(shaderProgram, "a_vertex");
    gl.vertexAttribPointer(vertLoc, 2, gl.FLOAT, false, fsize*5, 0);
    gl.enableVertexAttribArray(vertLoc);
    
    // -- offset for color buffer
    var colorLoc = gl.getAttribLocation(shaderProgram, "a_color");
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, fsize*5, fsize*2);
    gl.enableVertexAttribArray(colorLoc);
}

// установка шейдеров
function initShaders(id) {
    var fragmentShader = getShader(gl.FRAGMENT_SHADER, id + '-fs');
    var vertexShader = getShader(gl.VERTEX_SHADER, id + '-vs');
 
    shaderProgram = gl.createProgram();
 
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
 
    gl.linkProgram(shaderProgram);
      
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Не удалось установить шейдеры");
    }
      
    gl.useProgram(shaderProgram);
    
    u_matLoc = gl.getUniformLocation(shaderProgram, "u_matrix");
    gl.uniformMatrix4fv(u_matLoc, false, pixelsToWebGLMatrix);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    
    // gl.enable(0x8642);
    // gl.enable(gl.POINT_SPRITE);
    // gl.enable(gl.VERTEX_PROGRAM_POINT_SIZE);
}

// Функция создания шейдера
function getShader(type, id) {
    var shader = gl.createShader(type),
        val = shaders[id] ? shaders[id].value : null;

    if (!val) {
        var shaderScript = document.getElementById(id);
        if (shaderScript) {
            val = shaderScript.textContent;
        }
    }

    gl.shaderSource(shader, val);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Ошибка компиляции шейдера: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);  
        return null;
    }
    return shader; 
}

function translateMatrix(matrix, tx, ty) {
    // translation is in last column of matrix
    matrix[12] += matrix[0] * tx + matrix[4] * ty;
    matrix[13] += matrix[1] * tx + matrix[5] * ty;
    matrix[14] += matrix[2] * tx + matrix[6] * ty;
    matrix[15] += matrix[3] * tx + matrix[7] * ty;
}

function scaleMatrix(matrix, scaleX, scaleY) {
    // scaling x and y, which is just scaling first two columns of matrix
    matrix[0] *= scaleX; matrix[1] *= scaleX;
    matrix[2] *= scaleX; matrix[3] *= scaleX;

    matrix[4] *= scaleY; matrix[5] *= scaleY;
    matrix[6] *= scaleY; matrix[7] *= scaleY;
}

function create3DContext(canvas, options) {
    var context = null,
        names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
        
    if (!canvas) canvas = L.DomUtil.create('canvas');
    for (var i = 0, len = names.length; i < len; i++) {
        try {
            context = canvas.getContext(names[i], options);
        } catch(e) {}
        if (context) {
            break;
        }
    }
    return context;
}
/**
 * Provides requestAnimationFrame in a cross browser way.
 */
window.requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
           window.setTimeout(callback, 1000/60);
         };
})();

var scale = 1;
var shiftPoint = [0, 0];

var lastTime = 0;

// function animate() {
    // var timeNow = new Date().getTime();
    // if (lastTime != 0) {
        // var elapsed = timeNow - lastTime;

        // rTri += (90 * elapsed) / 1000.0;
    // }
    // lastTime = timeNow;
// }

function animate() {
    if (rTri > 20000) {
        rTri = -1;
    }
    rTri++;
}

function tick() {
    requestAnimFrame(tick);
    draw(scale, shiftPoint);
    animate();
}

L.gmxOverlayWebGL = {
    draw: function(canvas, data) {
        if (!gl) {
            gl = create3DContext(canvas, options);
            initShaders('arrows'); // shader
//console.log('L.gmxOverlayWebGL', arguments);
        }
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        if (data && data.items) {
            numPoints = data.items.length;
            initBuffers(data.items);
            //draw(data.scale, data.shiftPoint);
            scale = data.scale;
            shiftPoint = data.shiftPoint;
            rTri = 0;
            tick();
        }
        return true;
    },
    isWebGL: create3DContext() ? true : false,
    getContext: function(canvas, options) {
        gl = create3DContext(canvas, options);
        return gl;
    },
    setOptions: function(opt) {
        if (opt.leafletMap) leafletMap = opt.leafletMap;
        //L.setOptions(this, opt);
        return this;
    },
    context: null
};
})();