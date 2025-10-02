import * as vscode from 'vscode';
import * as path from 'path';
import { workRestModels } from '../constants/workRestModels';
import { switchWorkRestModel } from '../services/workRestService';
import { state } from '../models/state';
import { usageAnalytics } from '../services/usageAnalyticsService';

export class ChangeWorkoutPanel {
  public static currentPanel: ChangeWorkoutPanel | undefined;
  public static readonly viewType = 'changeWorkout';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (ChangeWorkoutPanel.currentPanel) {
      ChangeWorkoutPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      ChangeWorkoutPanel.viewType,
      'Change Workout Model',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out', 'src', 'views')]
      }
    );

    ChangeWorkoutPanel.currentPanel = new ChangeWorkoutPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'getWorkRestModels':
            this._panel.webview.postMessage({
              command: 'workRestModels',
              data: workRestModels
            });
            break;
          case 'changeWorkRestModel':
            try {
              console.log('Attempting to switch to model:', message.data.modelId);
              const model = workRestModels.find(m => m.id === message.data.modelId);
              console.log('Found model:', model);

              if (!model) {
                throw new Error(`Model with ID '${message.data.modelId}' not found`);
              }

              // Track model selection for analytics
              usageAnalytics.trackModelSelection(message.data.modelId, 'user_selection');

              switchWorkRestModel(message.data.modelId);
              this._panel.webview.postMessage({
                command: 'workRestModelChanged',
                data: { success: true }
              });
              vscode.window.showInformationMessage('Work-rest model changed successfully! Timer updated.');

              // Notify the main webview to update its timer display
              vscode.commands.executeCommand('breakBully.refreshTimer');
            } catch (error) {
              console.error('Failed to change work-rest model:', error);
              this._panel.webview.postMessage({
                command: 'workRestModelChanged',
                data: { success: false, error: (error as Error).message }
              });
              vscode.window.showErrorMessage(`Failed to change work-rest model: ${(error as Error).message}`);
            }
            break;
          case 'startMLAssessment':
            // Send command to extension to open ML assessment panel
            vscode.commands.executeCommand('breakBully.startMLAssessment');
            break;
          case 'closePanel':
            this._panel.dispose();
            break;
          case 'getPersonalModels':
            try {
              // Load personal models from storage
              const personalModels = state.storage?.loadCustomSetting('userAssessmentPersonalModels');
              if (personalModels) {
                this._panel.webview.postMessage({
                  command: 'personalModelsData',
                  data: personalModels
                });
              } else {
                // No personal models available - nothing will be displayed
                this._panel.webview.postMessage({
                  command: 'personalModelsData',
                  data: null
                });
              }
            } catch (error) {
              console.error('Failed to load personal models:', error);
              this._panel.webview.postMessage({
                command: 'personalModelsData',
                data: null
              });
            }
            break;
          case 'usePersonalModel':
            try {
              const { model } = message.data;
              console.log('Using personal model:', model);

              // Convert personal model to work-rest model format
              const workRestModel = {
                id: model.id || `personal_${Date.now()}`,
                name: model.name || 'AI Personal Model',
                workDuration: model.workDuration || 25,
                restDuration: model.restDuration || 5,
                basedOn: 'AI_ASSESSMENT'
              };

              // Track AI personal model selection for analytics
              usageAnalytics.trackModelSelection(workRestModel.id, 'ai_recommendation');

              // Store the current personal model as active
              state.storage?.saveCustomSetting('activePersonalModel', model);

              // Use the existing work-rest service to activate this model
              switchWorkRestModel(workRestModel.id);

              this._panel.webview.postMessage({
                command: 'personalModelChanged',
                data: { success: true }
              });

              vscode.window.showInformationMessage(
                `🎯 AI Personal Model Activated: ${model.workDuration}min work, ${model.restDuration}min rest`
              );

              // Notify the main webview to update its timer display
              vscode.commands.executeCommand('breakBully.refreshTimer');
            } catch (error) {
              console.error('Failed to activate personal model:', error);
              this._panel.webview.postMessage({
                command: 'personalModelChanged',
                data: { success: false, error: (error as Error).message }
              });
              vscode.window.showErrorMessage(`Failed to activate personal model: ${(error as Error).message}`);
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    ChangeWorkoutPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Change Workout Model';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'changeWorkout.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'changeWorkout.css'));

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Change Workout Model</title>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Change Workout Model</h1>
            <p>Select a new work-rest model to change your break timing</p>
          </div>

          <div class="models-grid" id="modelsGrid">
            <!-- Models will be populated here -->
          </div>

          <div class="current-model" id="currentModel">
            <!-- Current model info will be shown here -->
          </div>

          <div class="actions">
            <button class="btn secondary" onclick="closePanel()">Cancel</button>
          </div>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
