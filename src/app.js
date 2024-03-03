import { Renderer } from "./renderer.js";
import { Polygon } from "./polygon.js";
import { createNewPolygon } from "./shader.js";

const canvas = document.querySelector("canvas");
let renderer = null;
let polygon = null;
let ticks = 0;
let deltaTime = 0;

async function init() {
    try {
        renderer = new Renderer(canvas);
        polygon = new Polygon(await createNewPolygon(renderer.context, "./src/shaders/vert.glsl", "./src/shaders/frag.glsl"));
    } catch (err) {
        console.error("Failed to initialize renderer.", err);
        renderer = null;
    }
}

function update(now) {
    now *= 0.001;
    deltaTime = now - ticks;
    ticks = now;
    renderer.render(polygon, deltaTime);
    requestAnimationFrame(update);
}

async function main() {
    if (!renderer) {
        await init();
    }
    update(ticks);
    requestAnimationFrame(update);
}

main();