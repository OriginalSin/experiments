(function() {
/*
*/
    var shaders = {
        shader_fs: {
            type: "x-shader/x-fragment",
            value: '\
precision mediump float;\
varying vec2 vTextureCoord;\
uniform sampler2D uSampler;\
void main(void)  {\
    gl_FragColor = texture2D(uSampler, vTextureCoord);\
}'
        },
     
        shader_vs: {
            type: "x-shader/x-vertex",
            value: '\
attribute vec2 aVertCoord;\
uniform mat4 uTransformMatrix;\
varying vec2 vTextureCoord;\
void main(void) {\
    vTextureCoord = aVertCoord;\
    gl_Position = uTransformMatrix * vec4(aVertCoord, 0.0, 1.0);\
}'
        }
    };

var resCanvas = L.DomUtil.create('canvas'),
    glOpts = { antialias: true, depth: false, preserveDrawingBuffer: true },
    gl = resCanvas.getContext('webgl', glOpts) || resCanvas.getContext('experimental-webgl', glOpts);

if(gl) {
    var qualityOptions = {
        anisotropicFiltering: true,
        mipMapping: true,
        linearFiltering: true
    },
    anisoExt =
        gl.getExtension('EXT_texture_filter_anisotropic') ||
        gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

    // If we failed, tell the user that their image will look like poo on a
    // stick.
    if(!anisoExt) {
        console.warn("Your browser doesn't support anisotropic filtering. "+
                 "Ordinary MIP mapping will be used.");
    }

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
    function nextHighestPowerOfTwo(x) {
        --x;
        for (var i = 1; i < 32; i <<= 1) {
            x = x | x >> i;
        }
        return x + 1;
    }

    // from javax.media.jai.PerspectiveTransform
    function getSquareToQuad(x0, y0, x1, y1, x2, y2, x3, y3) {
        var dx1 = x1 - x2,
            dy1 = y1 - y2,
            dx2 = x3 - x2,
            dy2 = y3 - y2,
            dx3 = x0 - x1 + x2 - x3,
            dy3 = y0 - y1 + y2 - y3,
            det = dx1*dy2 - dx2*dy1,
            a = (dx3*dy2 - dx2*dy3) / det,
            b = (dx1*dy3 - dx3*dy1) / det;
        return [
            x1 - x0 + a*x1, y1 - y0 + a*y1, a,
            x3 - x0 + b*x3, y3 - y0 + b*y3, b,
            x0, y0, 1
        ];
    }

    function getInverse(m) {
        var a = m[0], b = m[1], c = m[2],
            d = m[3], e = m[4], f = m[5],
            g = m[6], h = m[7], i = m[8],
            det = a*e*i - a*f*h - b*d*i + b*f*g + c*d*h - c*e*g;
        return [
            (e*i - f*h) / det, (c*h - b*i) / det, (b*f - c*e) / det,
            (f*g - d*i) / det, (a*i - c*g) / det, (c*d - a*f) / det,
            (d*h - e*g) / det, (b*g - a*h) / det, (a*e - b*d) / det
        ];
    }

    function multiply(a, b) {
        return [
            a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
            a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
            a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
            a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
            a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
            a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
            a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
            a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
            a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
        ];
    }
    /**
     * @filter       Perspective
     * @description  Warps one quadrangle to another with a perspective transform. This can be used to
     *               make a 2D image look 3D or to recover a 2D image captured in a 3D environment.
     * @param before The x and y coordinates of four points before the transform in a flat list. This
     *               would look like [ax, ay, bx, by, cx, cy, dx, dy] for four points (ax, ay), (bx, by),
     *               (cx, cy), and (dx, dy).
     * @param after  The x and y coordinates of four points after the transform in a flat list, just
     *               like the other argument.
     */
    function perspective(before, after) {
        var a = getSquareToQuad.apply(null, after),
            b = getSquareToQuad.apply(null, before),
            c = multiply(getInverse(a), b);
        return getInverse(c);
    }

    function setupGlContext() {
        // Store return values here
        var rv = {},
            vertexShader = getShader(gl.VERTEX_SHADER, 'shader_vs'),
            fragmentShader = getShader(gl.FRAGMENT_SHADER, 'shader_fs');
        
        // Compile the program
        rv.shaderProgram = gl.createProgram();
        gl.attachShader(rv.shaderProgram, vertexShader);
        gl.attachShader(rv.shaderProgram, fragmentShader);
        gl.linkProgram(rv.shaderProgram);

        if (!gl.getProgramParameter(rv.shaderProgram, gl.LINK_STATUS)) {
            console.log('Shader linking failed.');
        }
            
        // Create a buffer to hold the vertices
        rv.vertexBuffer = gl.createBuffer();

        // Find and set up the uniforms and attributes        
        gl.useProgram(rv.shaderProgram);
        rv.vertAttrib = gl.getAttribLocation(rv.shaderProgram, 'aVertCoord');
            
        rv.transMatUniform = gl.getUniformLocation(rv.shaderProgram, 'uTransformMatrix');
        rv.samplerUniform = gl.getUniformLocation(rv.shaderProgram, 'uSampler');
            
        // Create a texture to use for the screen image
        rv.screenTexture = gl.createTexture();
        return rv;
    }
    var glResources = setupGlContext();

    L.webGLimageTransform = function (options) {
        if(!gl || !glResources) { return; }
        
        var image = options.image,
            controlPoints = options.controlPoints,
            width = image.naturalWidth,
            height = image.naturalHeight;
        
        // Scale up the texture to the next highest power of two dimensions.
        var canvas = L.DomUtil.create('canvas');
        canvas.width = nextHighestPowerOfTwo(width);
        canvas.height = nextHighestPowerOfTwo(height);
        
        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);

        gl.bindTexture(gl.TEXTURE_2D, glResources.screenTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        
        if(qualityOptions.linearFiltering) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                             qualityOptions.mipMapping
                                 ? gl.LINEAR_MIPMAP_LINEAR
                                 : gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, 
                             qualityOptions.mipMapping
                                 ? gl.NEAREST_MIPMAP_NEAREST
                                 : gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }
        
        if(anisoExt) {
            // turn the anisotropy knob all the way to 11 (or down to 1 if it is
            // switched off).
            var maxAniso = qualityOptions.anisotropicFiltering ?
                gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
        }
        
        if(qualityOptions.mipMapping) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // Record normalised height and width.
        var w = width / canvas.width, h = height / canvas.height;
        var vpW = resCanvas.width = options.width;
        var vpH = resCanvas.height = options.height;

        var srcPoints = new Float32Array([
            0, 0 , // top-left
            w, 0 , // top-right
            0, h , // bottom-left
            w, h   // bottom-right
        ]);
        var v = perspective(
            srcPoints, 
            [
                (2 * controlPoints[0].x / vpW) - 1, -(2 * controlPoints[0].y / vpH) + 1,
                (2 * controlPoints[1].x / vpW) - 1, -(2 * controlPoints[1].y / vpH) + 1,
                (2 * controlPoints[3].x / vpW) - 1, -(2 * controlPoints[3].y / vpH) + 1,
                (2 * controlPoints[2].x / vpW) - 1, -(2 * controlPoints[2].y / vpH) + 1
            ]
        );
            
        // setup the vertex buffer with the source points
        gl.bindBuffer(gl.ARRAY_BUFFER, glResources.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, srcPoints, gl.STATIC_DRAW);
        
        // Redraw the image
        
        // set background to full transparency
        gl.clearColor(0,0, 0,0);
        gl.viewport(0, 0, vpW, vpH);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(glResources.shaderProgram);

        // draw the triangles
        gl.bindBuffer(gl.ARRAY_BUFFER, glResources.vertexBuffer);
        gl.enableVertexAttribArray(glResources.vertAttrib);
        gl.vertexAttribPointer(glResources.vertAttrib, 2, gl.FLOAT, false, 0, 0);
        
        gl.uniformMatrix4fv(
            glResources.transMatUniform,
            false, [
                v[0], v[1],    0, v[2],
                v[3], v[4],    0, v[5],
                   0,    0,    0,    0,
                v[6], v[7],    0,    1
            ]);
            
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glResources.screenTexture);
        gl.uniform1i(glResources.samplerUniform, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return resCanvas;
    }
}
})()