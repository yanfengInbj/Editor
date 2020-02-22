import * as React from "react";
import { EditableText as BPEditableText, IEditableTextProps } from "@blueprintjs/core";

export class IEditableTextState {
    value: string;
}

export class EditableText extends React.Component<IEditableTextProps, IEditableTextState> {
    /**
     * Constructor.
     * @param props the component's props.
     */
    public constructor(props: IEditableTextProps) {
        super(props);
        this.state = { value: props.value ?? "" };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <BPEditableText
                {...this.props}
                value={this.state.value}
                onChange={(value) => this.setState({ value })}
            ></BPEditableText>
        )
    }
}
