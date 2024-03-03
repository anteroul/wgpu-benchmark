import { Renderer } from "./renderer.js";
import { createNewPolygon } from "./shader.js";

let canvas = document.querySelector("canvas");
let renderer = null;
let quit = true;
let geometry;

async function init() {
    try {
        renderer = new Renderer(canvas);
        geometry = await createNewPolygon(renderer.context, "./src/shaders/vert.glsl", "./src/shaders/frag.glsl");
    } catch (err) {
        console.error("Failed to initialize renderer.", err);
        renderer = null;
    }
}

async function main() {
    if (!renderer) {
        await init();
        quit = false;
    }
    if (!quit && renderer) {
        renderer.context.clear(renderer.context.COLOR_BUFFER_BIT);
        renderer.render(geometry);
    }
}

main();