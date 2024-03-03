export class Renderer {
    constructor(canvas) {
        this.context = canvas.getContext("webgl");

        if (!this.context) {
            throw new Error("WebGL could not be initialized!");
        } else {
            console.log("WebGL initialized successfully.");
        }
    }

    initBuffers() {
        const colorBuffer = this.initColorBuffer();

        return {
            position: this.initPositionBuffer(),
            color: this.initColorBuffer(),
        };
    }

    initColorBuffer() {
        const colors = [
            1.0,
            1.0,
            1.0,
            1.0, // white
            1.0,
            0.0,
            0.0,
            1.0, // red
            0.0,
            1.0,
            0.0,
            1.0, // green
            0.0,
            0.0,
            1.0,
            1.0, // blue
        ];

        const colorBuffer = this.context.createBuffer();

        this.context.bindBuffer(this.context.ARRAY_BUFFER, colorBuffer);
        this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array(colors), this.context.STATIC_DRAW);

        return colorBuffer;
    }

    initPositionBuffer() {
        // Create a buffer for the square's positions.
        const positionBuffer = this.context.createBuffer();
        this.context.bindBuffer(this.context.ARRAY_BUFFER, positionBuffer);
        // Now create an array of positions for the square.
        const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
        this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array(positions), this.context.STATIC_DRAW);

        return positionBuffer;
    }

    render(polygon, deltaTime) {
        const programInfo = polygon.shader;
        const buffers = this.initBuffers();

        this.context.clearColor(0.0, 0.0, 0.2, 1.0);
        this.context.clearDepth(1.0);
        this.context.enable(this.context.DEPTH_TEST);
        this.context.depthFunc(this.context.LEQUAL);

        // Clear canvas.
        this.context.clear(this.context.COLOR_BUFFER_BIT | this.context.DEPTH_BUFFER_BIT);

        const fieldOfView = (45 * Math.PI) / 180; // in radians
        const aspect = this.context.canvas.clientWidth / this.context.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();

        // NOTE: glmatrix.js always has the first argument
        // as the destination to receive the result.
        mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        // Set the drawing position to the "identity" point, which is
        // the center of the scene.
        const modelViewMatrix = mat4.create();

        // Now move the drawing position a bit to where we want to
        // start drawing the square.
        mat4.translate(
            modelViewMatrix, // destination matrix
            modelViewMatrix, // matrix to translate
            [-0.0, 0.0, -6.0],
        ); // amount to translate

        polygon.rotate(projectionMatrix, modelViewMatrix, deltaTime, 1.5);

        this.setPositionAttribute(buffers, programInfo);
        this.setColorAttribute(this.context, buffers, programInfo);
        this.context.useProgram(programInfo.program);

        this.context.uniformMatrix4fv(
            programInfo.uniformLocations.projectionMatrix,
            false,
            projectionMatrix,
        );
        this.context.uniformMatrix4fv(
            programInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix,
        );
        {
            const offset = 0;
            const vertexCount = 4;
            this.context.drawArrays(this.context.TRIANGLE_STRIP, offset, vertexCount);
        }
    }

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    setPositionAttribute(buffers, programInfo) {
        const numComponents = 2; // pull out 2 values per iteration
        const type = this.context.FLOAT; // the data in the buffer is 32bit floats
        const normalize = false; // don't normalize
        const stride = 0; // how many bytes to get from one set of values to the next
        // 0 = use type and numComponents above
        const offset = 0; // how many bytes inside the buffer to start from
        this.context.bindBuffer(this.context.ARRAY_BUFFER, buffers.position);
        this.context.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset,
        );
        this.context.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }

    setColorAttribute(gl, buffers, programInfo) {
        const numComponents = 4;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexColor,
            numComponents,
            type,
            normalize,
            stride,
            offset,
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
    }
}