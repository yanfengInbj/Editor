import { join, extname, basename } from "path";
import { copy } from "fs-extra";

import * as React from "react";
import { ContextMenu, Menu, MenuItem, Classes } from "@blueprintjs/core";

import { SceneLoader, PickingInfo, Material, MultiMaterial, CubeTexture, Texture } from "babylonjs";

import { assetsHelper } from "../tools/offscreen-assets-helper/offscreen-asset-helper";
import { Tools } from "../tools/tools";
import { GLTFTools } from "../tools/gltf";

import { Overlay } from "../gui/overlay";
import { Icon } from "../gui/icon";

import { IFile, FilesStore } from "../project/files";
import { Project } from "../project/project";

import { Assets } from "../components/assets";
import { AbstractAssets, IAssetComponentItem } from "./abstract-assets";
import { undoRedo } from "../tools/undo-redo";

export class MeshesAssets extends AbstractAssets {
    /**
     * Defines the size of assets to be drawn in the panel. Default is 100x100 pixels.
     * @override
     */
    protected size: number = 75;

    private _extensions: string[] = [".babylon", ".glb"];

    /**
     * Defines the list of all avaiable meshes in the assets component.
     */
    public static Meshes: IFile[] = [];

    /**
     * Refreshes the component.
     * @override
     */
    public async refresh(): Promise<void> {
        await assetsHelper.init();

        for (const m of MeshesAssets.Meshes) {
            if (this.items.find((i) => i.key === m.path)) { continue; }
            
            const rootUrl = join(Project.DirPath!, "files", "/");
            const name = join("..", "assets/meshes", m.name);
            await assetsHelper.importMesh(rootUrl, name);

            const base64 = await assetsHelper.getScreenshot();
            this.items.push({ id: m.name, key: m.path, base64 });

            this.updateAssetObservable.notifyObservers();
            await assetsHelper.reset();
        }
        
        return super.refresh();
    }

    /**
     * Called on the user double clicks an item.
     * @param item the item being double clicked.
     * @param img the double-clicked image element.
     */
    public async onDoubleClick(item: IAssetComponentItem, img: HTMLImageElement): Promise<void> {
        super.onDoubleClick(item, img);

        await this.editor.addWindowedPlugin("mesh-viewer", undefined, {
            rootUrl: join(Project.DirPath!, "files", "/"),
            name: join("..", "assets/meshes", item.id),
        });
    }

    /**
     * Called on the user right-clicks on an item.
     * @param item the item being right-clicked.
     * @param event the original mouse event.
     */
    public onContextMenu(item: IAssetComponentItem, e: React.MouseEvent<HTMLImageElement, MouseEvent>): void {
        super.onContextMenu(item, e);

        ContextMenu.show(
            <Menu className={Classes.DARK}>
                <MenuItem text="Remove" icon={<Icon src="times.svg" />} onClick={() => this._handleRemoveMesh(item)} />
            </Menu>,
            { left: e.clientX, top: e.clientY },
        );
    }

    /**
     * Called on the user drops an asset in editor. (typically the preview canvas).
     * @param item the item being dropped.
     * @param pickInfo the pick info generated on the drop event.
     * @override
     */
    public async onDropAsset(item: IAssetComponentItem, pickInfo: PickingInfo): Promise<void> {
        super.onDropAsset(item, pickInfo);

        require("babylonjs-loaders");

        const isGltf = extname(item.id).toLowerCase() === ".glb";
        if (isGltf) {
            Overlay.Show("Configuring GLTF...", true);
        }

        const rootUrl = join(Project.DirPath!, "files", "/");
        const name = join("..", "assets/meshes", item.id);
        const result = await SceneLoader.ImportMeshAsync("", rootUrl, name, this.editor.scene!);
        for (const mesh of result.meshes) {
            mesh.id = Tools.RandomId();
            if (mesh.material) { mesh.material.id = Tools.RandomId(); }
            if (!mesh.parent && pickInfo.pickedPoint) { mesh.position.copyFrom(pickInfo.pickedPoint); }

            // Materials
            if (mesh.material) {
                mesh.material.id = Tools.RandomId();

                if (mesh.material instanceof MultiMaterial) {
                    for (const m of mesh.material.subMaterials) {
                        if (!m) { return; }
                        m.id = Tools.RandomId();
                        if (isGltf) { await this._configureGltfMaterial(m); }
                    };
                } else {
                    if (isGltf) { await this._configureGltfMaterial(mesh.material); }
                }
            }
        }

        // Don't forget transform nodes
        for (const t of this.editor.scene!.transformNodes) {
            if (!t.metadata || !t.metadata.gltf) { continue; }
            if (t.metadata.gltf.editorDone) { continue; }

            t.id = Tools.RandomId();
            t.metadata.gltf.editorDone = true;
        }

        result.skeletons.forEach((s) => {
            // Skeleton Ids are not strings but numbers
            let id = 0;
            while (this.editor.scene!.getSkeletonById(id as any)) {
                id++;
            }

            s.id = id as any;
        });
        result.particleSystems.forEach((ps) => ps.id = Tools.RandomId());

        this.editor.assets.refresh();
        this.editor.graph.refresh();

        if (isGltf) {
            Overlay.Hide();
        }
    }

    /**
     * Called on the user drops files in the assets component and returns true if the files have been computed.
     * @param files the list of files being dropped.
     */
    public async onDropFiles(files: IFile[]): Promise<void> {
        for (const file of files) {
            const extension = extname(file.name).toLowerCase();
            if (this._extensions.indexOf(extension) === -1) { continue; }

            require("babylonjs-loaders");

            const existing = MeshesAssets.Meshes.find((m) => m.name === file.name);

            // Copy assets
            const dest = join(Project.DirPath!, "assets", "meshes", file.name);
            if (dest) { await copy(file.path, dest); }

            if (!existing) {
                MeshesAssets.Meshes.push({ name: file.name, path: dest });
            }
        }

        return this.refresh();
    }

    /**
     * Called on the user wants to remove a mesh from the library.
     */
    private _handleRemoveMesh(item: IAssetComponentItem): void {
        undoRedo.push({
            common: () => this.refresh(),
            redo: () => {
                const meshIndex = MeshesAssets.Meshes.findIndex((m) => m.path === item.key);
                if (meshIndex !== -1) { MeshesAssets.Meshes.splice(meshIndex, 1); }

                const itemIndex = this.items.indexOf(item);
                if (itemIndex !== -1) { this.items.splice(itemIndex, 1); }
            },
            undo: () => {
                MeshesAssets.Meshes.push({ name: item.id, path: item.key });
                this.items.push(item);
            },
        });
    }

    /**
     * Configures the given material's textures.
     */
    private async _configureGltfMaterial(material: Material): Promise<void> {
        const textures = material.getActiveTextures();
        for (const texture of textures) {
            if (texture.metadata?.gltf?.editorDone) { continue; }

            if (!(texture instanceof Texture) && !(texture instanceof CubeTexture)) { return; }

            texture.name = join("files", `${basename(texture.name)}${Tools.GetExtensionFromMimeType(texture["_mimeType"])}`);
            if (texture.url) { texture.url = texture.name; }

            FilesStore.AddFile(join(Project.DirPath!, texture.name));
        };

        await GLTFTools.TexturesToFiles(join(Project.DirPath!, "files"), textures);
    }
}

Assets.addAssetComponent({
    title: "Meshes",
    ctor: MeshesAssets,
});
