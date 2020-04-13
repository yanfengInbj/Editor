import { dirname, join, basename } from "path";
import { readJSON } from "fs-extra";

import {
    Texture, SceneLoader, Light, Node, Material, ShadowGenerator, CascadedShadowGenerator,
    DirectionalLight, Camera, SerializationHelper, Mesh, MultiMaterial, TransformNode,
} from "babylonjs";

import { MeshesAssets } from "../assets/meshes";
import { PrefabAssets } from "../assets/prefabs";

import { Editor } from "../editor";

import { Overlay } from "../gui/overlay";

import { SceneSettings } from "../scene/settings";

import { Project } from "./project";
import { IProject } from "./typings";
import { FilesStore } from "./files";
import { ProjectHelpers } from "./helpers";

import { Assets } from "../components/assets";

export class ProjectImporter {
    /**
     * Imports the project located at the given path.
     * @param editor the editor reference.
     * @param path the path of the project to import.
     */
    public static async ImportProject(editor: Editor, path: string): Promise<void> {
        try {
            await this._ImportProject(editor, path);
        } catch (e) {
            // TODO.
            this._RefreshEditor(editor);
        }
    }

    /**
     * Imports the project located at the given path.
     */
    private static async _ImportProject(editor: Editor, path: string): Promise<void> {
        // Prepare overlay
        Overlay.Show("Importing Project...", true);

        // Configure Serialization Helper
        const textureParser = SerializationHelper._TextureParser;
        SerializationHelper._TextureParser = (source, scene, rootUrl) => {
            if (source.metadata && source.metadata.editorName) {
                const texture = scene.textures.find((t) => t.metadata && t.metadata.editorName === source.metadata.editorName);
                if (texture) { return texture; }
            }

            return textureParser(source, scene, rootUrl);
        };

        // Configure editor project
        Project.Path = path;
        Project.DirPath = `${dirname(path)}/`;

        // Read project file
        const project = await readJSON(path) as IProject;
        const rootUrl = join(Project.DirPath!, "/");

        Overlay.SetSpinnervalue(0);
        const spinnerStep = 1 / (project.textures.length + project.materials.length + project.meshes.length + project.lights.length + project.cameras.length);
        let spinnerValue = 0;

        // Register files
        project.filesList.forEach((f) => {
            const path = join(Project.DirPath!, "files", f);
            FilesStore.List[path] = { path, name: basename(f) };
        });

        // Configure assets
        project.assets.meshes.forEach((m) => MeshesAssets.Meshes.push({ name: m, path: join(Project.DirPath!, "assets", "meshes", m) }));
        if (project.assets.prefabs) {
            project.assets.prefabs.forEach((p) => PrefabAssets.Prefabs.push({ name: p, path: join(Project.DirPath!, "prefabs", p) }));
        }

        // Configure scene
        ProjectHelpers.ImportSceneSettings(editor.scene!, project.scene, rootUrl);

        // Configure camera
        SceneSettings.ConfigureFromJson(project.project.camera, editor);

        // Load all meshes
        Overlay.SetMessage("Creating Meshes...");

        for (const m of project.meshes) {
            try {
                const json = await readJSON(join(Project.DirPath, "meshes", m));
                await this.ImportMesh(editor, m, json, Project.DirPath, join("meshes", m));
            } catch (e) {
                editor.console.logError(`Failed to load mesh "${m}"`);
            }

            Overlay.SetSpinnervalue(spinnerValue += spinnerStep);
        }

        // Load all transform nodes
        Overlay.SetMessage("Creating Transform Nodes");

        for (const t of project.transformNodes ?? []) {
            try {
                const json = await readJSON(join(Project.DirPath, "transform", t));
                const transform = TransformNode.Parse(json, editor.scene!, rootUrl);
                transform._waitingParentId = json.parentId;
            } catch (e) {
                editor.console.logError(`Failed to load transform node "${t}"`);
            }
        }

        // Retrieve physics impostors for meshes
        const physicsEngine = editor.scene!.getPhysicsEngine();
        if (physicsEngine) {
            editor.scene!.meshes.forEach((m) => {
                try {
                    m.physicsImpostor = physicsEngine.getImpostorForPhysicsObject(m);
                    editor.console.logInfo(`Parsed physics impostor for mesh "${m.name}"`);
                } catch (e) {
                    editor.console.logError(`Failed to set physics impostor for mesh "${m.name}"`);
                }
            });
        }

        // Load all materials
        Overlay.SetMessage("Creating Materials...");

        for (const m of project.materials) {
            try {
                const json = await readJSON(join(Project.DirPath, "materials", m.json));
                const material = m.isMultiMaterial ? MultiMaterial.ParseMultiMaterial(json, editor.scene!) : Material.Parse(json, editor.scene!, rootUrl);
                editor.console.logInfo(`Parsed material "${m.json}"`);

                m.bindedMeshes.forEach((bm) => {
                    const mesh = editor.scene!.getMeshByID(bm);
                    if (mesh) {
                        mesh.material = material;
                    } else {
                        editor.console.logWarning(`Failed to attach material ${m.json} on mesh with id "${bm}"`);
                    }
                });
            } catch (e) {
                editor.console.logError(`Failed to parse material "${m.json}"`);
            }

            Overlay.SetSpinnervalue(spinnerValue += spinnerStep);
        }

        // Load all textures
        Overlay.SetMessage("Creating Textures...");

        for (const t of project.textures) {
            try {
                const json = await readJSON(join(Project.DirPath, "textures", t));

                const existing = editor.scene!.getTextureByUniqueID(json.uniqueId);
                if (existing) { continue; }

                Texture.Parse(json, editor.scene!, rootUrl) as Texture;
                editor.console.logInfo(`Parsed texture "${t}"`);
            } catch (e) {
                editor.console.logError(`Failed to parse texture "${t}"`);
            }
            Overlay.SetSpinnervalue(spinnerValue += spinnerStep);
        }

        // Load all lights
        Overlay.SetMessage("Creating Lights...");

        for (const l of project.lights) {
            try {
                const json = await readJSON(join(Project.DirPath, "lights", l.json));
                Light.Parse(json, editor.scene!);
                editor.console.logInfo(`Parsed light "${l.json}"`);

                if (l.shadowGenerator) {
                    const json = await readJSON(join(Project.DirPath, "shadows", l.shadowGenerator));
                    ShadowGenerator.Parse(json, editor.scene!, (size, light) => {
                        if (json.className !== "ShadowGenerator" && light instanceof DirectionalLight) {
                            return new CascadedShadowGenerator(size, light as DirectionalLight);
                        }
                        return new ShadowGenerator(size, light);
                    });
                    editor.console.logInfo(`Parsed shadows for light "${l.json}"`);
                }
            } catch (e) {
                editor.console.logError(`Failed to parse light "${l}"`);
            }

            Overlay.SetSpinnervalue(spinnerValue += spinnerStep);
        }

        // Load all cameras
        Overlay.SetMessage("Creating Cameras...");

        for (const c of project.cameras) {
            try {
                const json = await readJSON(join(Project.DirPath, "cameras", c));
                Camera.Parse(json, editor.scene!);
                editor.console.logInfo(`Parsed camera "${c}"`);
            } catch (e) {
                editor.console.logError(`Failed to parse camera "${c}"`);
            }

            Overlay.SetSpinnervalue(spinnerValue += spinnerStep);
        }

        // Post-Processes
        Overlay.SetMessage("Configuring Rendering...");

        if (project.postProcesses.ssao) {
            SerializationHelper.Parse(() => SceneSettings.SSAOPipeline, project.postProcesses.ssao.json, editor.scene!, rootUrl);
            SceneSettings.SetSSAOEnabled(editor, project.postProcesses.ssao.enabled);
        }
        if (project.postProcesses.standard) {
            SerializationHelper.Parse(() => SceneSettings.StandardPipeline, project.postProcesses.standard.json, editor.scene!, rootUrl);
            SceneSettings.SetStandardPipelineEnabled(editor, project.postProcesses.standard.enabled);
        }
        if (project.postProcesses.default) {
            SerializationHelper.Parse(() => SceneSettings.DefaultPipeline, project.postProcesses.default.json, editor.scene!, rootUrl);
            SceneSettings.SetDefaultPipelineEnabled(editor, project.postProcesses.default.enabled);
        }

        // Update cache
        Overlay.SetMessage("Loading Cache...");
        Assets.SetCachedData(await readJSON(join(Project.DirPath, "assets", "cache.json")));

        // Parent Ids
        const scene = editor.scene!;
        scene.meshes.forEach((m) => this._SetWaitingParent(m));
        scene.lights.forEach((l) => this._SetWaitingParent(l));
        scene.cameras.forEach((c) => this._SetWaitingParent(c));
        scene.transformNodes.forEach((tn) => this._SetWaitingParent(tn));

        // Refresh
        editor.scene!.onReadyObservable.addOnce(() => this._RefreshEditor(editor));
        editor.scene!._checkIsReady();
    }

    /**
     * Imports the given mesh according to its rooturl, name and json configuration.
     * @param editor the editor reference.
     * @param name the name of the mesh (used by logs).
     * @param json the json representation of the mesh.
     * @param rootUrl the root url of the mesh loader.
     * @param filename the name of the mesh file to load.
     */
    public static async ImportMesh(editor: Editor, name: string, json: any, rootUrl: string, filename: string): Promise<ReturnType<typeof SceneLoader.ImportMeshAsync>> {
        const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, editor.scene, null, ".babylon");

        editor.console.logInfo(`Parsed mesh "${name}"`);
        result.meshes.forEach((m, index) => {
            m._waitingParentId = json.meshes[index].parentId;
        });

        // Lods
        for (const lod of json.lods) {
            try {
                const blob = new Blob([JSON.stringify(lod.mesh)]);
                const url = URL.createObjectURL(blob);

                const lodResult = await SceneLoader.ImportMeshAsync("", "", url, editor.scene, null, ".babylon");
                const mesh = lodResult.meshes[0];
                if (!mesh || !(mesh instanceof Mesh)) { continue; }

                (result.meshes[0] as Mesh).addLODLevel(lod.distance, mesh);
                URL.revokeObjectURL(url);

                editor.console.logInfo(`Parsed LOD level "${lod.mesh.meshes[0].name}" for mesh "${name}"`);
            } catch (e) {
                editor.console.logError(`Failed to load LOD for "${result.meshes[0].name}"`);
            }
        }

        return result as any;
    }

    /**
     * Sets the parent of the given node waiting for it.
     */
    private static _SetWaitingParent(n: Node): void {
        if (!n._waitingParentId) { return; }

        n.parent = n.getScene().getNodeByID(n._waitingParentId) ?? n.getScene().getTransformNodeByID(n._waitingParentId);
        delete n._waitingParentId;
    }

    /**
     * Refreshes the editor.
     */
    private static _RefreshEditor(editor: Editor): void {
        editor.assets.refresh();
        editor.graph.refresh();

        Overlay.Hide();
    }
}
