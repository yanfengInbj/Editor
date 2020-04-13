/**
 * TODO: use offscreen canvas for assets rendering.
 */
import "../../../module";
import { Engine, Scene, TargetCamera, Vector3, Color4, HemisphericLight, Mesh, Nullable, Material, SceneLoader, Tools } from "babylonjs";
import "babylonjs-materials";
import "babylonjs-loaders";

class OffscreenAssetsHelper {
    /**
     * The canvas used to render elements.
     */
    public canvas: OffscreenCanvas;
    /**
     * The engine used to render elements in the canvas.
     */
    public engine: Engine;
    /**
     * The scene used to rendere elements.
     */
    public scene: Scene;
    /**
     * The camera used to have a view on the scene.
     */
    public camera: TargetCamera;
    /**
     * The light used to get a view on materials
     */
    public light: HemisphericLight;

    private _mesh: Nullable<Mesh> = null;

    /**
     * Defines the instance of the assets helper.
     * @hidden
     */
    public static _Instance: OffscreenAssetsHelper;

    /**
     * Constructor.
     * @param canvas the canvas element
     */
    public constructor(canvas: OffscreenCanvas) {
        this.canvas = canvas;

        // Babylon.JS stuffs
        this.engine = new Engine(this.canvas as any);
        this.engine.enableOfflineSupport = false;
        this.reset();
    }

    /**
     * Resets the assets helper.
     */
    public reset(): void {
        if (this._mesh) { this._mesh.dispose(true, true); }
        if (this.scene) {
            this.scene["_inputManager"].detachControl = () => { };
            this.scene.dispose();
        }

        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color4(0, 0, 0, 1);
        this.scene.defaultMaterial.backFaceCulling = false;

        this.camera = new TargetCamera("AssetsHelperCamera", new Vector3(0, 0, 0), this.scene, true);
        this.camera.minZ = 0.1;
        
        this.light = new HemisphericLight("AssetsHelperLight", new Vector3(0, 1, 0), this.scene);
    }

    /**
     * Returns a screenshot of the scene once the scene is ready.
     * Returns a screenshot as a base64 string.
     */
    public async getScreenshot(): Promise<string> {
        return new Promise<string>((resolve) => {
            this.scene.onReadyObservable.addOnce(async () => {
                const minimum = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                const maximum = new Vector3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

                this.scene.meshes.forEach(d => {
                    const b = d._boundingInfo;
                    if (!b) { return; }
                    maximum.x = Math.max(b.maximum.x, maximum.x);
                    maximum.y = Math.max(b.maximum.y, maximum.y);
                    maximum.z = Math.max(b.maximum.z, maximum.z);

                    minimum.x = Math.min(b.minimum.x, minimum.x);
                    minimum.y = Math.min(b.minimum.y, minimum.y);
                    minimum.z = Math.min(b.minimum.z, minimum.z);
                });

                const center = Vector3.Center(minimum, maximum);
                const distance = Vector3.Distance(minimum, maximum) * 0.5;

                this.camera.position = center.add(new Vector3(distance, distance, distance));
                this.camera.setTarget(center);

                this.scene.render();

                const blob = await this.canvas.convertToBlob({ type: "image/png" });
                Tools.ReadFileAsDataURL(blob, (data) => resolve(data), null!);
            });

            this.scene._checkIsReady();
        });
    }

    /**
     * Creates a new mesh according to the given type.
     * @param type the type of the mesh to create.
     */
    public createMesh(type: number): void {
        switch (type) {
            case 0: this._mesh = Mesh.CreateSphere("MaterialsSphere", 32, 1, this.scene, false); break;
            default: break;
        }
    }

    /**
     * Laods the given mesh.
     * @param rootUrl the root url containing the mesh's file.
     * @param filename the name of the mesh file to load.
     */
    public async importMesh(rootUrl: string, filename: string): Promise<void> {
        await SceneLoader.ImportMeshAsync("", rootUrl, filename, this.scene, null, null);
    }

    /**
     * Sets the new material to the current mesh.
     * @param json the JSON representation of the material.
     * @param rootUrl the rootUrl containing the material's assets.
     */
    public setMaterial(json: any, rootUrl: string): void {
        if (!this._mesh) { return; }
        this._mesh.material = Material.Parse(json, this.scene, rootUrl);
    }

    /**
     * Disposes the current mesh material.
     */
    public disposeMaterial(): void {
        if (!this._mesh?.material) { return; }
        this._mesh.material.dispose(true, true);
    }
}

/**
 * Called for each message sent from the editor.
 */
addEventListener("message", async (ev) => {
    try {
        let response: any = undefined;

        switch (ev.data.id) {
            // Init helper.
            case "init": OffscreenAssetsHelper._Instance = new OffscreenAssetsHelper(ev.data.canvas); break;
            // Resets the helper by removing elements and disposing the scene.
            case "reset": OffscreenAssetsHelper._Instance.reset(); break;
            // Return a screeshot of the current canvas.
            case "getScreenshot": response = await OffscreenAssetsHelper._Instance.getScreenshot(); break;
            // Creates the given mesh.
            case "createMesh": OffscreenAssetsHelper._Instance.createMesh(ev.data.type); break;
            // Import a mesh
            case "importMesh": await OffscreenAssetsHelper._Instance.importMesh(ev.data.rootUrl, ev.data.filename); break;
            // Sets the given material to the mesh.
            case "setMaterial": OffscreenAssetsHelper._Instance.setMaterial(ev.data.json, ev.data.rootUrl); break;
            // Disposes the current material
            case "disposeMaterial": OffscreenAssetsHelper._Instance.disposeMaterial(); break;
        }

        postMessage({ id: ev.data.id, response }, undefined!);
    } catch (e) {
        postMessage({ id: ev.data.id, error: true }, undefined!);
    }
});
