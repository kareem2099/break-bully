import * as vscode from 'vscode';
import { state } from './models/state';

/**
 * TEMPORARY COMMAND FOR DEBUGGING - EXPORT ALL STORED DATA
 * This file can be safely deleted when debugging is complete
 */
export function registerTempExportCommand(context: vscode.ExtensionContext) {
  const exportAllStoredDataCommand = vscode.commands.registerCommand('breakBully.exportAllStoredData', () => {
    exportAllStoredData();
  });

  context.subscriptions.push(exportAllStoredDataCommand);
}

/**
 * Export all stored data to a JSON file in the workspace
 */
async function exportAllStoredData() {
  try {
    // Check if storage is available
    if (!state.storage) {
      vscode.window.showErrorMessage('Break Bully: Storage not initialized');
      return;
    }

    // Get all data from storage
    const allData = state.storage.exportAllData();

    // Create a pretty-printed JSON string
    const jsonContent = JSON.stringify(allData, null, 2);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `break-bully-stored-data-export-${timestamp}.json`;

    // Show save dialog
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(filename),
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*']
      },
      saveLabel: 'Export Data'
    });

    if (uri) {
      // Write file
      await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));

      // Show success message
      vscode.window.showInformationMessage(
        `Break Bully data exported successfully to: ${uri.fsPath}`
      );

      // Optionally open the file
      const openFile = await vscode.window.showQuickPick(['Open File', 'Close'], {
        placeHolder: 'Would you like to open the exported file?'
      });

      if (openFile === 'Open File') {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
      }
    } else {
      vscode.window.showInformationMessage('Export cancelled by user');
    }

  } catch (error) {
    console.error('Error exporting data:', error);
    vscode.window.showErrorMessage(`Failed to export data: ${error}`);
  }
}
