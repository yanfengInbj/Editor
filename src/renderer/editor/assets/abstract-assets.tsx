import * as React from "react";
import { Tooltip, Position } from "@blueprintjs/core";

import { PickingInfo, Vector3, Observable } from "babylonjs";

import { Editor } from "../editor";

import { Nullable, Undefinable } from "../../../shared/types";
import { IFile } from "../project/files";

export interface IAssetsComponentProps {
    /**
     * The editor reference to be used in the assets component.
     */
    editor: Editor;
    /**
     * The id of the component.
     */
    id: string;
    /**
     * Optional callback called on the user double clicks an asset.
     */
    onClick?: Undefinable<(item: IAssetComponentItem, img: HTMLImageElement) => void>;
    /**
     * Optional callback called on the user double clicks an asset.
     */
    doubleClick?: Undefinable<(item: IAssetComponentItem, img: HTMLImageElement) => void>;
    /**
     * Optional style to apply.
     */
    style?: Undefinable<React.CSSProperties>;
}

export interface IAssetComponentItem {
    /**
     * Defines the id of the texture.
     */
    id: string;
    /**
     * Defines the preview of the texture in base64.
     */
    base64: string;
    /**
     * The key string used by React.
     */
    key: string;
}

export interface IAssetsComponentState {
    /**
     * Defines all the assets to draw in the panel.
     */
    items: IAssetComponentItem[];
    /**
     * Defines the height of the panel.
     */
    height: number;
}

export interface IAbstractAssets {
    /**
     * Refreshes the component.
     * @param object the optional object reference that has been modified in the editor.
     */
    refresh<T>(object: Undefinable<T>): Promise<void>;
    /**
     * Called on the user drops an asset in editor. (typically the preview canvas).
     * @param item the item being dropped.
     * @param pickInfo the pick info generated on the drop event.
     */
    onDropAsset(item: IAssetComponentItem, pickInfo: PickingInfo): void;
    /**
     * Called on the user drops files in the assets component and returns true if the files have been computed.
     * @param files the list of files being dropped.
     */
    onDropFiles?(files: IFile[]): boolean | Promise<boolean>;
}

export class AbstractAssets extends React.Component<IAssetsComponentProps, IAssetsComponentState> implements IAbstractAssets {
    /**
     * Defines the list of all available assets.
     */
    public items: IAssetComponentItem[] = [];
    /**
     * Defines the observable used to notify observers that an asset has been updated.
     */
    public updateAssetObservable: Observable<void> = new Observable<void>();

    /**
     * The editor reference.
     */
    protected editor: Editor;
    /**
     * Defines the size of assets to be drawn in the panel. Default is 100x100 pixels.
     */
    protected size: number = 100;

    /**
     * Stores the current list of nodes drawn in the panel..
     * @warning should be used with care.
     */
    protected _itemsNodes: React.ReactNode[] = [];

    private _filter: string = "";
    private _dropListener: Nullable<(ev: DragEvent) => void> = null;

    /**
     * Constructor.
     * @param props the component's props.
     */
    public constructor(props: IAssetsComponentProps) {
        super(props);

        this.editor = props.editor;
        this.state = { items: this.items, height: 0 };
    }

    /**
     * Refreshes the component.
     */
    public async refresh(): Promise<void> {
        this.setState({ items: this.items });
    }

    /**
     * Called on the user drops an asset in editor. (typically the preview canvas).
     * @param item the item being dropped.
     * @param pickInfo the pick info generated on the drop event.
     */
    public onDropAsset(_: IAssetComponentItem, __: PickingInfo): void {
        // Nothing to do by default.
    }

    /**
     * Called on the user double clicks an item.
     * @param item the item being double clicked.
     * @param img the double-clicked image element.
     */
    public onDoubleClick(item: IAssetComponentItem, img: HTMLImageElement): void {
        if (this.props.doubleClick) {
            this.props.doubleClick(item, img);
        }
    }

    /**
     * Called on the user clicks on an item.
     * @param item the item being clicked.
     * @param img the clicked image element.
     */
    public onClick(item: IAssetComponentItem, img: HTMLImageElement): void {
        if (this.props.onClick) {
            this.props.onClick(item, img);
        }
    }

    /**
     * Called on the user right-clicks on an item.
     * @param item the item being right-clicked.
     * @param event the original mouse event.
     */
    public onContextMenu(_: IAssetComponentItem, __: React.MouseEvent<HTMLImageElement, MouseEvent>): void {
        // Empty for now.
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        // Filter
        const filter = this._filter.toLowerCase();
        if (filter !== "") {
            this._itemsNodes = this.items.filter((i) => i.id.toLowerCase().indexOf(filter) !== -1)
                                         .map((i) => this._getItemNode(i));
        } else {
            this._itemsNodes = this.items.map((i) => this._getItemNode(i));
        }

        // Render!
        const size = this.editor.getPanelSize("assets");

        if (!this._itemsNodes.length) {
            return (
                <h1 style={{
                    float: "left",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    overflow: "hidden",
                    position: "relative",
                    fontFamily: "Roboto,sans-serif !important",
                    opacity: "0.5",
                    color: "white",
                }}>Empty</h1>
            );
        }

        return <div style={{ width: "100%", height: size.height - 90, overflow: "auto", ...this.props.style }} children={this._itemsNodes}></div>;
    }

    /**
     * Called on the component did mount.
     */
    public componentDidMount(): void {
        this.resize();
        if (this.editor.scene) { this.refresh(); }
    }

    /**
     * Sets the new filter on the user wants to filter the assets.
     * @param filter the new filter to search assets.
     */
    public setFilter(filter: string): void {
        this._filter = filter;
        this.setState({ items: this.items });
    }

    /**
     * Resizes the element.
     */
    public resize(): void {
        this.setState({ height: this.editor.getPanelSize("assets").height });
    }

    /**
     * Returns the jsx element according to the given component item.
     */
    private _getItemNode(item: IAssetComponentItem): JSX.Element {
        return (
            <div key={item.key} style={{
                position: "relative",
                width: `${this.size}px`,
                height: `${this.size}px`,
                float: "left",
                margin: "10px",
            }}>
                <Tooltip content={item.id} position={Position.TOP} usePortal={false}>
                    <img
                        src={item.base64}
                        style={{ width: `${this.size}px`, height: `${this.size}px`, borderRadius: "15px", objectFit: "contain" }}
                        onClick={(e) => this.onClick(item, e.target as HTMLImageElement)}
                        onDoubleClick={(e) => this.onDoubleClick(item, e.target as HTMLImageElement)}
                        onContextMenu={(e) => this.onContextMenu(item, e)}
                        onDragStart={(e) => this._dragStart(e, item)}
                        onDragEnd={() => this._dragEnd()}
                    ></img>
                </Tooltip>
                <small style={{
                    float: "left",
                    width: `${this.size}px`,
                    left: "50%",
                    top: "8px",
                    transform: "translate(-50%, -50%)",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    position: "relative",
                }}>{item.id}</small>
            </div>
        );
    }

    /**
     * Called on the user starts dragging the asset.
     */
    private _dragStart(_: React.DragEvent<HTMLImageElement>, item: IAssetComponentItem): void {
        this._dropListener = this._getDropListener(item);
        this.editor.engine!.getRenderingCanvas()?.addEventListener("drop", this._dropListener);
    }

    /**
     * Called on the user ends dragging the asset.
     */
    private _dragEnd(): void {
        this.editor.engine!.getRenderingCanvas()?.removeEventListener("drop", this._dropListener!);
        this._dropListener = null;
    }

    /**
     * Called on an item has been dropped on the game's canvas.
     */
    private _getDropListener(item: IAssetComponentItem): (ev: DragEvent) => void {
        return (ev: DragEvent) => {
            const pick = this.editor.scene!.pick(
                ev.offsetX,
                ev.offsetY,
                undefined,
                false,
            );
            if (!pick) { return; }
            if (!pick.pickedMesh) { pick.pickedPoint = Vector3.Zero(); }

            this.onDropAsset(item, pick);
        };
    }
}
