export class Polygon {
    constructor(shader) {
        this.shader = shader;
        this.rotation = 0;
    }

    rotate(projection, view, deltaTime, speed) {
        this.rotation += deltaTime * speed;
        projection = mat4.create();

        mat4.rotate(
            view,           // destination matrix
            view,           // matrix to rotate
            this.rotation,  // amount to rotate in radians
            [1, 1, 1],      // axis to rotate around
        );
        //console.log("Rotation: " + this.rotation);
    }
}