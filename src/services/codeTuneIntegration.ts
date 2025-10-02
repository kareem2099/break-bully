import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';

/**
 * Integration service for CodeTune extension
 */
export class CodeTuneIntegration {
  /**
   * Checks if CodeTune extension is installed
   */
  public static isCodeTuneInstalled(): boolean {
    const codeTuneExt = vscode.extensions.getExtension('FreeRave.codetune');
    return codeTuneExt !== undefined;
  }

  /**
   * Attempts to open CodeTune extension
   */
  public static async openCodeTune(): Promise<boolean> {
    try {
      // Check if CodeTune is installed
      if (!this.isCodeTuneInstalled()) {
        vscode.window.showInformationMessage('CodeTune extension is not installed. Would you like to install it?', 'Install').then(selection => {
          if (selection === 'Install') {
            vscode.env.openExternal(vscode.Uri.parse('vscode:extension/FreeRave.codetune'));
          }
        });
        return false;
      }

      // Try to activate the extension first
      const codeTuneExt = vscode.extensions.getExtension('FreeRave.codetune');
      if (codeTuneExt && !codeTuneExt.isActive) {
        try {
          await codeTuneExt.activate();
        } catch (error) {
          console.warn('Could not activate CodeTune extension:', error);
          return false;
        }
      }

      // Try to execute the play command (primary method)
      try {
        await vscode.commands.executeCommand('codetune.playQuran');
        return true;
      } catch (error) {
        console.warn('Could not execute codetune.playQuran command:', error);
      }

      // Fallback: try to open settings
      try {
        await vscode.commands.executeCommand('codetune.openSettings');
        return true;
      } catch (error) {
        console.warn('Could not execute codetune.openSettings command:', error);
      }

      return false;
    } catch (error) {
      console.error('Error opening CodeTune:', error);
      return false;
    }
  }

  /**
   * Shows a CodeTune suggestion notification during breaks
   */
  public static async showCodeTuneBreakSuggestion(): Promise<boolean> {
    const config = getConfiguration();

    // Check if CodeTune suggestions are enabled and not permanently ignored
    if (!config.suggestCodeTuneDuringBreaks || config.codeTunePermanentlyIgnored) {
      return false;
    }

    // Always show the suggestion - whether CodeTune is installed or not
    // This helps introduce new users to CodeTune and encourages installation
    const message = this.getRandomCodeTuneMessage();
    const result = await vscode.window.showInformationMessage(
      message,
      'Open CodeTune',
      'Not Now',
      'Never Show Again'
    );

    switch (result) {
      case 'Open CodeTune':
        return await this.openCodeTune();
      case 'Never Show Again':
        await this.setCodeTunePermanentlyIgnored(true);
        vscode.window.showInformationMessage('CodeTune suggestions have been disabled.', 'OK');
        return false;
      default:
        return false;
    }
  }

  /**
   * Sets the permanent ignore flag for CodeTune suggestions
   */
  public static async setCodeTunePermanentlyIgnored(ignored: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('breakBully');
    await config.update('codeTunePermanentlyIgnored', ignored, vscode.ConfigurationTarget.Global);
  }

  /**
   * Gets a random CodeTune suggestion message
   */
  private static getRandomCodeTuneMessage(): string {
    const messages = [
      "🎵 How about some peaceful Quran recitation during your break?",
      "📖 Consider listening to the Quran to enrich your wellness break 😌",
      "🕌 Your break could be enhanced with beautiful Quranic verses",
      "🎯 Would you like to listen to Quran while you rest?",
      "🌸 Some Quranic recitation might bring peace to your break time",
      "📿 Open CodeTune for spiritually refreshing break music",
      "🙏 Quran listening can add meaning to your well-deserved break"
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }
}
