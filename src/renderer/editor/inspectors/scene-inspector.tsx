import { basename } from "path";

import { Scene, Texture } from "babylonjs";

import { Inspector } from "../components/inspector";
import { AbstractInspector } from "./abstract-inspector";

export class SceneInspector extends AbstractInspector<Scene> {
    private _environmentTexture: string = "";
    private _fogMode: string = "";

    /**
     * Called on the component did moubnt.
     * @override
     */
    public onUpdate(): void {
        this.addColors();
        this.addImageProcessing();
        this.addEnvironment();
        this.addFog();
        this.addCollisions();
    }

    /**
     * Adds the common editable properties.
     */
    protected addColors(): void {
        this.addColor(this.tool!, "Ambient Color", this.selectedObject, "ambientColor").open();
        this.addColor(this.tool!, "Clear Color", this.selectedObject, "clearColor").open();
    }

    /**
     * Adds the image processing editable properties.
     */
    protected addImageProcessing(): void {
        const imageProcessing = this.tool!.addFolder("Image Processing");
        imageProcessing.open();

        imageProcessing.add(this.selectedObject.imageProcessingConfiguration, "exposure").min(0).step(0.01).name("Exposure");
        imageProcessing.add(this.selectedObject.imageProcessingConfiguration, "contrast").min(0).step(0.01).name("Contrast");
        imageProcessing.add(this.selectedObject.imageProcessingConfiguration, "toneMappingEnabled").name("Tone Mapping Enabled");
    }

    /**
     * Adds the environment editable properties.
     */
    protected addEnvironment(): void {
        const reflection = this.tool!.addFolder("Environment");
        reflection.open();

        reflection.add(this.selectedObject, "environmentIntensity").step(0.01).name("Intensity");

        this._environmentTexture = this.selectedObject.environmentTexture?.name ?? "None";
        this.addTexture(reflection, this, "_environmentTexture").name("Texture").onChange(() => {
            const texture = this.editor.scene!.textures.find((t) => basename(t.name) === this._environmentTexture);
            this.selectedObject.environmentTexture = texture as Texture;
        });
    }
    
    /**
     * Adds the fog editable properties.
     */
    protected addFog(): void {
        const fog = this.tool!.addFolder("Fog");
        fog.open();

        const fogModes = ["FOGMODE_NONE", "FOGMODE_LINEAR", "FOGMODE_EXP", "FOGMODE_EXP2"];
        this._fogMode = fogModes.find((m) => this.selectedObject.fogMode === Scene[m]) ?? fogModes[0];
        fog.add(this, "_fogMode", fogModes).name("Mode").onChange(() => {
            this.selectedObject.fogMode = Scene[this._fogMode];
        });

        fog.add(this.selectedObject, "fogEnabled").name("Enable Fog");
        fog.add(this.selectedObject, "fogStart").min(0).step(0.1).name("Fog Start");
        fog.add(this.selectedObject, "fogEnd").min(0).step(0.1).name("Fog End");
        fog.add(this.selectedObject, "fogDensity").min(0).step(0.1).name("Fog Density");

        this.addColor(fog, "Color", this.selectedObject, "fogColor").open();
    }

    /**
     * Adds all the collisions editable properties.
     */
    protected addCollisions(): void {
        const collisions = this.tool!.addFolder("Collisions");
        collisions.open();

        collisions.add(this.selectedObject, "collisionsEnabled").name("Enabled");
        this.addVector(collisions, "Gravity", this.selectedObject, "gravity").open();
    }
}

Inspector.registerObjectInspector({
    ctor: SceneInspector,
    ctorNames: ["Scene"],
    title: "Scene",
});
