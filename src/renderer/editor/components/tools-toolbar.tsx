import * as React from "react";
import { ButtonGroup, Button, ContextMenu, Classes, Menu, MenuItem } from "@blueprintjs/core";

import { Editor } from "../editor";
import { Icon } from "../gui/icon";

import { ProjectExporter } from "../project/project-exporter";
import { WorkSpace } from "../project/workspace";

export interface IToolbarProps {
    /**
     * The editor reference.
     */
    editor: Editor;
}

export interface IToolbarState {
    /**
     * Defines wether or not project has a workspace loaded.
     */
    hasWorkspace: boolean;
}

export class ToolsToolbar extends React.Component<IToolbarProps, IToolbarState> {
    private _editor: Editor;

    /**
     * Constructor.
     * @param props the component's props.
     */
    public constructor(props: IToolbarProps) {
        super(props);

        this._editor = props.editor;
        this._editor.toolsToolbar = this;

        this.state = { hasWorkspace: false };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <ButtonGroup style={{ marginTop: "auto", marginBottom: "auto" }}>
                <Button disabled={!this.state.hasWorkspace} icon={<Icon src="play.svg"/>} rightIcon="caret-down" text="Play..." onContextMenu={(e) => this._handlePlayContextMenu(e)} onClick={() => this._buttonClicked("play")} />
                <Button disabled={!this.state.hasWorkspace} icon={<Icon src="play.svg"/>} rightIcon="caret-down" text="Generate..." onContextMenu={(e) => this._handleGenerateContextMenu(e)} onClick={() => this._buttonClicked("generate")} />
            </ButtonGroup>
        );
    }

    /**
     * Called on a menu item is clicked.
     */
    private async _buttonClicked(id: string): Promise<void> {
        switch (id) {
            case "play": this._editor.runProject(true); break;
            case "play-my-browser": this._editor.runProject(false); break;

            case "generate": ProjectExporter.ExportFinalScene(this._editor); break;
            case "build-project": WorkSpace.BuildProject(this._editor); break;
            default: break;
        }
    }

    /**
     * Called on the user right-clicks on the "play" button.
     */
    private _handlePlayContextMenu(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
        ContextMenu.show(
            <Menu className={Classes.DARK}>
                <MenuItem text="Play in integrated browser" icon={<Icon src="play.svg" />} onClick={() => this._buttonClicked("play")} />
                <MenuItem text="Play in my browser" icon={<Icon src="play.svg" />} onClick={() => this._buttonClicked("play-my-browser")} />
            </Menu>,
            { left: e.clientX, top: e.clientY },
        );
    }

    /**
     * Called on the user right-clicks on the "generate" button.
     */
    private _handleGenerateContextMenu(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
        ContextMenu.show(
            <Menu className={Classes.DARK}>
                <MenuItem text="Generate scene" icon={<Icon src="play.svg" />} onClick={() => this._buttonClicked("generate")} />
                <MenuItem text="Build project" icon={<Icon src="play.svg" />} onClick={() => this._buttonClicked("build-project")} />
            </Menu>,
            { left: e.clientX, top: e.clientY },
        );
    }
}
