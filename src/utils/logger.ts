import * as vscode from 'vscode';

export class Logger {
    private static outputChannel = vscode.window.createOutputChannel("DotSense");

    private static get isDebugMode(): boolean {
        return vscode.workspace.getConfiguration('dotsense').get('enableDebugLogging', false);
    }

    static log(message: string, data?: unknown) {
        if (!this.isDebugMode) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;

        console.log(logMessage, data || '');
        this.outputChannel.appendLine(logMessage);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
    }

    static error(message: string, error?: Error | unknown) {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[ERROR ${timestamp}] ${message}`, error);
        this.outputChannel.appendLine(`[ERROR] ${message} ${error ? JSON.stringify(error) : ''}`);
    }

    static warn(message: string, data?: unknown) {
        if (!this.isDebugMode) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[WARN ${timestamp}] ${message}`;

        console.warn(logMessage, data || '');
        this.outputChannel.appendLine(logMessage);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
    }

    static info(message: string, data?: unknown) {
        if (!this.isDebugMode) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[INFO ${timestamp}] ${message}`;

        console.info(logMessage, data || '');
        this.outputChannel.appendLine(logMessage);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
    }

    static debug(message: string, data?: unknown) {
        if (!this.isDebugMode) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[DEBUG ${timestamp}] ${message}`;

        console.debug(logMessage, data || '');
        this.outputChannel.appendLine(logMessage);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
    }
}
