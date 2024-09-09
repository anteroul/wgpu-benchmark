import { Renderer } from "./renderer.js";

let renderer = null;

async function init() {
    try {
        renderer = new Renderer(document.querySelector("canvas"));
        await renderer.init();
    } catch (err) {
        console.error("Failed to initialize renderer.", err);
        renderer = null;
    }
}

async function main() {
    if (!renderer) {
        await init();
    }
    requestAnimationFrame(renderer.render());
}

main();