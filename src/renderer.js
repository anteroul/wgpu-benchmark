import { rand, euclideanModulo } from './util.js';

const kNumObjects = 10000;
const kColorOffset = 0;
const kOffsetOffset = 0;
const kScaleOffset = 2;
const staticUnitSize = 4;
const changingUnitSize = 2 * 4 + 2 * 4;
let startTime = 0.0;
let now = startTime;
let then = 0;


export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.objectInfos = [];
        this.circleObject = { Float32Array, Number };
        this.infoElem = document.getElementById('info');
    }

    createCircleVertices({
        radius = 1,
        numSubdivisions = 24,
        innerRadius = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
    } = {}) {
        const numVertices = numSubdivisions * 3 * 2;
        // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb_)
        // The 32-bit color value will be written/read as 4 8-bit values
        const vertexData = new Float32Array(numVertices * (2 + 1));
        const colorData = new Uint8Array(vertexData.buffer);

        let offset = 0;
        let colorOffset = 8;

        const addVertex = (x, y, r, g, b) => {
            vertexData[offset++] = x;
            vertexData[offset++] = y;
            offset += 1;  // skip the color
            colorData[colorOffset++] = r * 255;
            colorData[colorOffset++] = g * 255;
            colorData[colorOffset++] = b * 255;
            colorOffset += 9;  // skip extra byte and the position
        };

        const innerColor = [1, 1, 1];
        const outerColor = [0.1, 0.1, 0.1];

        // 2 vertices per subdivision
        //
        // 0--1 4
        // | / /|
        // |/ / |
        // 2 3--5
        for (let i = 0; i < numSubdivisions; ++i) {
            const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
            const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

            const c1 = Math.cos(angle1);
            const s1 = Math.sin(angle1);
            const c2 = Math.cos(angle2);
            const s2 = Math.sin(angle2);

            // first triangle
            addVertex(c1 * radius, s1 * radius, ...outerColor);
            addVertex(c2 * radius, s2 * radius, ...outerColor);
            addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

            // second triangle
            addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
            addVertex(c2 * radius, s2 * radius, ...outerColor);
            addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
        }

        return {
            vertexData,
            numVertices,
        };
    }

    async init() {
        this.adapter = await navigator.gpu?.requestAdapter();
        this.device = await this.adapter?.requestDevice();

        if (!this.device) {
            fail('This browser does not support WebGPU');
            return;
        }

        this.context = this.canvas.getContext('webgpu');
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
        });

        const module = this.device.createShaderModule({
            code: `
                struct Vertex {
                    @location(0) position: vec2f,
                    @location(1) color: vec4f,
                    @location(2) offset: vec2f,
                    @location(3) scale: vec2f,
                    @location(4) perVertexColor: vec3f,
                };

                struct VSOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec4f,
                };

                @vertex fn vs(
                    vert: Vertex,
                ) -> VSOutput {
                    var vsOut: VSOutput;
                    vsOut.position = vec4f(
                        vert.position * vert.scale + vert.offset, 0.0, 1.0);
                    vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
                    return vsOut;
                }

                @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                    return vsOut.color;
                }`,
        });

        this.pipeline = this.device.createRenderPipeline({
            label: 'per vertex color',
            layout: 'auto',
            vertex: {
                module,
                buffers: [
                    {
                        arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
                            { shaderLocation: 4, offset: 8, format: 'unorm8x4' },   // perVertexColor
                        ],
                    },
                    {
                        arrayStride: 4, // 4 bytes
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'unorm8x4' },   // color
                        ],
                    },
                    {
                        arrayStride: 4 * 4, // 4 floats, 4 bytes each
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 2, offset: 0, format: 'float32x2' },  // offset
                            { shaderLocation: 3, offset: 8, format: 'float32x2' },  // scale
                        ],
                    },
                ],
            },
            fragment: {
                module,
                targets: [{ format: this.presentationFormat }],
            },
        });

        let staticVertexBufferSize = staticUnitSize * kNumObjects;
        let changingVertexBufferSize = changingUnitSize * kNumObjects;

        this.staticVertexBuffer = this.device.createBuffer({
            label: 'static vertex for objects',
            size: staticVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.changingVertexBuffer = this.device.createBuffer({
            label: 'changing storage for objects',
            size: changingVertexBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        {
            const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
            for (let i = 0; i < kNumObjects; ++i) {
                const staticOffsetU8 = i * staticUnitSize;

                // These are only set once so set them now
                staticVertexValuesU8.set(        // set the color
                    [rand() * 255, rand() * 255, rand() * 255, 255],
                    staticOffsetU8 + kColorOffset);

                this.objectInfos.push({
                    scale: rand(0.2, 0.5),
                    offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
                    velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
                });
            }
            this.device.queue.writeBuffer(this.staticVertexBuffer, 0, staticVertexValuesU8);
        }

        // a typed array we can use to update the changingStorageBuffer
        this.vertexValues = new Float32Array(changingVertexBufferSize / 4);
        this.circleObject = this.createCircleVertices({ radius: 0.5, innerRadius: 0.25, });

        this.vertexBuffer = this.device.createBuffer({
            label: 'vertex buffer vertices',
            size: this.circleObject.vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.circleObject.vertexData);

        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        this.settings = {
            numObjects: 100,
        };
    }

    render() {
        now = performance.now();
        now *= 0.001;  // convert to seconds
        const deltaTime = now - then;
        const startTime = performance.now();
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setVertexBuffer(1, this.staticVertexBuffer);
        pass.setVertexBuffer(2, this.changingVertexBuffer);

        // Set the uniform values in our JavaScript side Float32Array
        const aspect = this.canvas.width / this.canvas.height;

        // set the scales for each object
        for (let ndx = 0; ndx < this.settings.numObjects; ++ndx) {
            const { scale, offset, velocity } = this.objectInfos[ndx];
            // -1.5 to 1.5
            offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
            offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

            const off = ndx * (changingUnitSize / 4);
            this.vertexValues.set(offset, off + kOffsetOffset);
            this.vertexValues.set([scale / aspect, scale], off + kScaleOffset);
        }

        // upload all offsets and scales at once
        this.device.queue.writeBuffer(
            this.changingVertexBuffer, 0,
            this.vertexValues, 0, this.settings.numObjects * changingUnitSize / 4);

        pass.draw(this.circleObject.numVertices, this.settings.numObjects);
        pass.end();

        const commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);

        const jsTime = performance.now() - startTime;
        this.infoElem.textContent = `\
        FPS: ${(1 / deltaTime).toFixed(1)}
        Tickrate: ${jsTime.toFixed(1)}ms`;
        
        requestAnimationFrame(this.render);
    }
}