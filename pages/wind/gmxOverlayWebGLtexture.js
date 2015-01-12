/*
 (c) 2015, Sergey Alekseev salekseev@scanex.ru
 Leaflet.WindWebGL, plugin for Gemixer layers.
*/
(function() {
    var options = {
        antialias: true
    };

    var shaders = {
        'shader22-vs': {
            type: "x-shader/x-vertex",
            value: [
                'uniform mat4 u_matrix;',
                //'attribute vec4 aVertexPosition;',
                'attribute vec4 a_vertex;',
                'attribute float a_pointSize;',
                'attribute float a_tri;',
                'attribute vec4 a_color;',
                'varying vec4 v_color;',
                //'varying float v_tri;',
                'varying vec4 pos;',
                "varying vec2 vTextureCoord;",

                'void main() {',
                    'gl_PointSize =  a_pointSize;',         // Set the size of the point
                    //'a_vertex.y += a_tri;',
                    'pos = vec4(a_vertex[0] + a_tri * cos(a_color[1]) / 10.0, a_vertex[1] + a_tri * sin(a_color[1]) / 10.0, a_vertex[2], a_vertex[3]);',
                    //'gl_Position = u_matrix * pos;',   // multiply each vertex by a matrix.
                    'gl_Position = a_vertex;',   // multiply each vertex by a matrix.
                    'v_color = a_color;',                   // pass the color to the fragment shader
                    "vTextureCoord = gl_Position.zw;",
                    //'v_tri = a_tri;',                       // pass the tick
                '}'
                ].join("\n")
        },

        'shader22-fs': {
            type: "x-shader/x-fragment",
            value: [
                'precision mediump float;',
                'varying vec4 v_color;',
                //'varying float v_tri;',
                "varying vec2 vTextureCoord;",
                "uniform sampler2D uSampler;",

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
                    */

"gl_FragColor = texture2D(uSampler, vTextureCoord);",
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
    iconUrl = '',
    iconImage = null,
    deferred = new L.gmx.Deferred(),
    leafletMap,
    shaderProgram,
    pixelsToWebGLMatrix = new Float32Array(16),
    mapMatrix = new Float32Array(16),
    u_matLoc;
    
function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}

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
//gl.drawArrays(gl.TRIANGLE_FAN, 0, numPoints);

}
/*
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
        // vertArray[bufferIndex++] = coord[0];
        // vertArray[bufferIndex++] = -coord[1];
        vertArray[bufferIndex++] = 150;
        vertArray[bufferIndex++] = 200;
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

    gl.uniform1i(shaderProgram.uSampler, 0);
}
*/
function isPOT(value) {
    return value > 0 && ((value - 1) & value) === 0;
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
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
    shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
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

function handleLoadedTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);
}


var crateTexture;

function initTexture(url) {
    crateTexture = gl.createTexture();
    crateTexture.image = new Image();
    crateTexture.image.onload = function () {
        handleLoadedTexture(crateTexture)
    }

    crateTexture.image.src = url;
}

    var mvMatrix = mat4.create();
    var mvMatrixStack = [];
    var pMatrix = mat4.create();

    function mvPushMatrix() {
        var copy = mat4.create();
        mat4.set(mvMatrix, copy);
        mvMatrixStack.push(copy);
    }

    function mvPopMatrix() {
        if (mvMatrixStack.length == 0) {
            throw "Invalid popMatrix!";
        }
        mvMatrix = mvMatrixStack.pop();
    }


    function setMatrixUniforms() {
        gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
        gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

        var normalMatrix = mat3.create();
        mat4.toInverseMat3(mvMatrix, normalMatrix);
        mat3.transpose(normalMatrix);
        gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
    }


    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }



    var xRot = 0;
    var xSpeed = 3;

    var yRot = 0;
    var ySpeed = -3;

    var z = -5.0;
    var cubeVertexPositionBuffer;
    var cubeVertexNormalBuffer;
    var cubeVertexTextureCoordBuffer;
    var cubeVertexIndexBuffer;

    function initBuffers() {
        cubeVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        vertices = [
            // Front face
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0, -1.0, -1.0,

            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,

            // Right face
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        cubeVertexPositionBuffer.itemSize = 3;
        cubeVertexPositionBuffer.numItems = 24;

        cubeVertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
        var vertexNormals = [
            // Front face
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,
             0.0,  0.0,  1.0,

            // Back face
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,
             0.0,  0.0, -1.0,

            // Top face
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,
             0.0,  1.0,  0.0,

            // Bottom face
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,
             0.0, -1.0,  0.0,

            // Right face
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,
             1.0,  0.0,  0.0,

            // Left face
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
        cubeVertexNormalBuffer.itemSize = 3;
        cubeVertexNormalBuffer.numItems = 24;

        cubeVertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
        var textureCoords = [
            // Front face
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,

            // Back face
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,

            // Top face
            0.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,

            // Bottom face
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,

            // Right face
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,

            // Left face
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
        cubeVertexTextureCoordBuffer.itemSize = 2;
        cubeVertexTextureCoordBuffer.numItems = 24;

        cubeVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        var cubeVertexIndices = [
            0, 1, 2,      0, 2, 3,    // Front face
            4, 5, 6,      4, 6, 7,    // Back face
            8, 9, 10,     8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15, // Bottom face
            16, 17, 18,   16, 18, 19, // Right face
            20, 21, 22,   20, 22, 23  // Left face
        ];
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
        cubeVertexIndexBuffer.itemSize = 1;
        cubeVertexIndexBuffer.numItems = 36;
    }

    function drawScene() {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

        mat4.identity(mvMatrix);

        mat4.translate(mvMatrix, [0.0, 0.0, z]);

        mat4.rotate(mvMatrix, degToRad(xRot), [1, 0, 0]);
        mat4.rotate(mvMatrix, degToRad(yRot), [0, 1, 0]);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, crateTexture);
        gl.uniform1i(shaderProgram.samplerUniform, 0);
        var lighting = 0;//document.getElementById("lighting").checked;
        gl.uniform1i(shaderProgram.useLightingUniform, lighting);
        if (lighting) {
            gl.uniform3f(
                shaderProgram.ambientColorUniform,
                parseFloat(1), //document.getElementById("ambientR").value),
                parseFloat(1), //document.getElementById("ambientG").value),
                parseFloat(1) //document.getElementById("ambientB").value)
            );

            var lightingDirection = [
                parseFloat(1), //document.getElementById("lightDirectionX").value),
                parseFloat(1), //document.getElementById("lightDirectionY").value),
                parseFloat(1) //document.getElementById("lightDirectionZ").value)
            ];
            var adjustedLD = vec3.create();
            vec3.normalize(lightingDirection, adjustedLD);
            vec3.scale(adjustedLD, -1);
            gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);

            gl.uniform3f(
                shaderProgram.directionalColorUniform,
                parseFloat(1), //document.getElementById("directionalR").value),
                parseFloat(1), //document.getElementById("directionalG").value),
                parseFloat(1) //document.getElementById("directionalB").value)
            );
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        setMatrixUniforms();
        gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
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
    drawScene();
    //draw(scale, shiftPoint);
    //animate();
}

L.gmxOverlayWebGL = {
    draw: function(canvas, data) {
//        deferred.then(function() {
console.log('deferred', arguments);
            if (!gl) {
                gl = create3DContext(canvas, options);
                //initShaders('arrows'); // shader
                //initShaders('shader'); // shader
                
    //console.log('L.gmxOverlayWebGL', arguments);
            }
            gl.viewportWidth = canvas.width;
            gl.viewportHeight = canvas.height;
        initShaders('shader');
        initBuffers();
        initTexture(iconUrl);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.DEPTH_TEST);
                tick();
/*
            if (data && data.items) {
                numPoints = data.items.length;
                initBuffers(data.items);
                //draw(data.scale, data.shiftPoint);
                scale = data.scale;
                shiftPoint = data.shiftPoint;
                rTri = 0;
                tick();
            }
*/
        // });
        // if (iconImage) deferred.resolve();

        return true;
    },
    isWebGL: create3DContext() ? true : false,
    getContext: function(canvas, options) {
        gl = create3DContext(canvas, options);
        return gl;
    },
    setOptions: function(opt) {
        if (opt.leafletMap) leafletMap = opt.leafletMap;
        if (opt.iconUrl) {
            iconUrl = opt.iconUrl;
            //iconUrl = 'crate.gif';
            //initTexture(iconUrl);
            // var img = new Image();
            // img.onload = function(ev) {
// console.log('onload', deferred);
                // iconImage = img;
                // deferred.resolve();
            // };
            // img.onerror = function(ev) {
                // console.log('onerror', ev);
            // }
            // img.src = iconUrl;
        }
        //L.setOptions(this, opt);
        return this;
    },
    context: null
};
})();