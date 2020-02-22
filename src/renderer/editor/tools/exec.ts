import { exec } from "child_process";

import { Editor } from "../editor";

export class ExecTools {
    /**
     * Executes the given command at the given working directory.
     * @param command the command to execute.
     * @param cwd the working directory while executing the command.
     */
    public static async Exec(editor: Editor, command: string, cwd: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const program = exec(command, { cwd }, (error) => {
                if (error) { return reject(); }

                resolve();
            });

            program.stdout?.on("data", (d) => editor.console.logInfo(d.toString()));
            program.stderr?.on("data", (d) => editor.console.logError(d.toString()));
        });
    }
}
