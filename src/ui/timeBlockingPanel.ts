import * as vscode from 'vscode';
import * as path from 'path';
import {
  TimeBlock,
  AdvancedWorkRestModel,
  SchedulingModelType
} from '../types';
import { advancedScheduler } from '../services/activityIntegration/advancedSchedulerService';

export class TimeBlockingPanel {
  public static currentPanel: TimeBlockingPanel | undefined;
  public static readonly viewType = 'timeBlocking';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private timeBlocks: TimeBlock[] = [];
  private currentDay: number = new Date().getDay(); // 0 = Sunday

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (TimeBlockingPanel.currentPanel) {
      TimeBlockingPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      TimeBlockingPanel.viewType,
      'Daily Time Blocks',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out', 'src', 'views')]
      }
    );

    TimeBlockingPanel.currentPanel = new TimeBlockingPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Load existing time blocks
    this.loadTimeBlocks();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'getTimeBlocks':
            this.sendTimeBlocks();
            break;

          case 'addTimeBlock':
            this.addTimeBlock(message.data);
            break;

          case 'updateTimeBlock':
            this.updateTimeBlock(message.data.id, message.data.updates);
            break;

          case 'deleteTimeBlock':
            this.deleteTimeBlock(message.data.id);
            break;

          case 'dayChanged':
            this.currentDay = message.data.day;
            this.sendTimeBlocks();
            break;

          case 'createDefaultSchedule':
            this.createDefaultSchedule();
            break;

          case 'applyToScheduler':
            await this.applyToScheduler();
            break;

          case 'getCurrentModel':
            const model = advancedScheduler ? advancedScheduler.getCurrentModel() : null;
            this.sendCurrentModel(model);
            break;

          case 'clearAllBlocks':
            this.clearAllBlocks();
            break;

          default:
            console.log('Unknown command:', message.command);
        }
      },
      null,
      this._disposables
    );
  }

  private loadTimeBlocks(): void {
    // Load time blocks from storage
    try {
      const allBlocks = require('../models/state').state.storage?.loadCustomSetting('timeBlocking.blocks', {}) || {};
      this.timeBlocks = allBlocks[this.currentDay] || [];
      this.sendTimeBlocks();
    } catch (error) {
      console.error('Failed to load time blocks:', error);
      this.timeBlocks = [];
    }
  }

  private sendTimeBlocks(): void {
    const dayBlocks = this.timeBlocks.filter(block =>
      !block.daysOfWeek || block.daysOfWeek.includes(this.currentDay)
    ).sort((a, b) => a.startTime - b.startTime);

    this._panel.webview.postMessage({
      command: 'timeBlocksUpdated',
      data: {
        blocks: dayBlocks,
        day: this.currentDay
      }
    });
  }

  private sendCurrentModel(model: AdvancedWorkRestModel | null): void {
    this._panel.webview.postMessage({
      command: 'currentModel',
      data: model
    });
  }

  private addTimeBlock(blockData: any): void {
    const block = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: blockData.name || 'New Block',
      startTime: blockData.startTime || 9 * 60, // 9 AM default
      duration: blockData.duration || 60, // 1 hour default
      type: blockData.type || 'deep-work',
      priority: blockData.priority || 3,
      recurring: blockData.recurring || false,
      daysOfWeek: blockData.recurring ? [this.currentDay] : undefined
    } as TimeBlock;

    // Check for conflicts
    if (this.hasTimeConflict(block)) {
      vscode.window.showErrorMessage('Time block conflicts with existing schedule!');
      return;
    }

    this.timeBlocks.push(block);
    this.saveTimeBlocks();
    this.sendTimeBlocks();

    vscode.window.showInformationMessage(`Added time block: ${block.name}`);
  }

  private updateTimeBlock(blockId: string, updates: Partial<TimeBlock>): void {
    const blockIndex = this.timeBlocks.findIndex(b => b.id === blockId);
    if (blockIndex >= 0) {
      // Create updated block for conflict checking
      const updatedBlock = { ...this.timeBlocks[blockIndex], ...updates };

      if (this.hasTimeConflict(updatedBlock, blockId)) {
        vscode.window.showErrorMessage('Time block conflicts with existing schedule!');
        return;
      }

      this.timeBlocks[blockIndex] = updatedBlock;
      this.saveTimeBlocks();
      this.sendTimeBlocks();

      vscode.window.showInformationMessage(`Updated time block: ${updatedBlock.name}`);
    }
  }

  private deleteTimeBlock(blockId: string): void {
    const blockIndex = this.timeBlocks.findIndex(b => b.id === blockId);
    if (blockIndex >= 0) {
      const deletedBlock = this.timeBlocks[blockIndex];
      this.timeBlocks.splice(blockIndex, 1);
      this.saveTimeBlocks();
      this.sendTimeBlocks();

      vscode.window.showInformationMessage(`Deleted time block: ${deletedBlock.name}`);
    }
  }

  private hasTimeConflict(newBlock: TimeBlock, excludeId?: string): boolean {
    const newStart = newBlock.startTime;
    const newEnd = newBlock.startTime + newBlock.duration;

    return this.timeBlocks.some(block => {
      if (excludeId && block.id === excludeId) return false;
      if (block.daysOfWeek && !block.daysOfWeek.includes(this.currentDay)) return false;

      const blockStart = block.startTime;
      const blockEnd = block.startTime + block.duration;

      return !(newEnd <= blockStart || newStart >= blockEnd);
    });
  }

  private saveTimeBlocks(): void {
    try {
      const allBlocks = require('../models/state').state.storage?.loadCustomSetting('timeBlocking.blocks', {}) || {};
      allBlocks[this.currentDay] = this.timeBlocks;
      require('../models/state').state.storage?.saveCustomSetting('timeBlocking.blocks', allBlocks);
    } catch (error) {
      console.error('Failed to save time blocks:', error);
    }
  }

  private createDefaultSchedule(): void {
    const defaultBlocks: TimeBlock[] = [
      {
        id: `default_deep_${Date.now()}_1`,
        name: 'Deep Work',
        startTime: 9 * 60, // 9 AM
        duration: 90, // 90 minutes
        type: 'deep-work',
        priority: 5,
        recurring: true,
        daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
      },
      {
        id: `default_meeting_${Date.now()}_2`,
        name: 'Meeting Time',
        startTime: 11 * 60, // 11 AM
        duration: 60,
        type: 'meetings',
        priority: 4,
        recurring: true,
        daysOfWeek: [1, 2, 3, 4, 5]
      },
      {
        id: `default_lunch_${Date.now()}_3`,
        name: 'Break & Lunch',
        startTime: 12 * 60, // 12 PM
        duration: 60,
        type: 'breaks',
        priority: 3,
        recurring: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
      },
      {
        id: `default_afternoon_${Date.now()}_4`,
        name: 'Afternoon Focus',
        startTime: 13 * 60, // 1 PM
        duration: 120,
        type: 'deep-work',
        priority: 4,
        recurring: true,
        daysOfWeek: [1, 2, 3, 4, 5]
      },
      {
        id: `default_admin_${Date.now()}_5`,
        name: 'Admin & Communication',
        startTime: 16 * 60, // 4 PM
        duration: 60,
        type: 'admin',
        priority: 3,
        recurring: true,
        daysOfWeek: [1, 2, 3, 4, 5]
      }
    ];

    // Only add blocks that don't conflict
    for (const block of defaultBlocks) {
      if (!this.hasTimeConflict(block)) {
        this.timeBlocks.push(block);
      }
    }

    this.saveTimeBlocks();
    this.sendTimeBlocks();

    vscode.window.showInformationMessage('Created default schedule with work-life balance blocks!');
  }

  private clearAllBlocks(): void {
    this.timeBlocks = this.timeBlocks.filter(block =>
      block.daysOfWeek && !block.daysOfWeek.includes(this.currentDay)
    );
    this.saveTimeBlocks();
    this.sendTimeBlocks();
    vscode.window.showInformationMessage('Cleared all blocks for current day');
  }

  private async applyToScheduler(): Promise<void> {
    if (!advancedScheduler) {
      vscode.window.showErrorMessage('Advanced scheduler not initialized');
      return;
    }

    // Create or update advanced work-rest model with time blocking
    const currentModel = advancedScheduler.getCurrentModel();
    const timeBlockingModel: AdvancedWorkRestModel = {
      id: 'time-blocking-schedule',
      name: 'Time Blocking Schedule',
      description: 'Custom time blocks for structured daily planning',
      workDuration: 25, // Default fallback
      restDuration: 5,  // Default fallback
      basedOn: 'custom',
      type: 'time-blocking',
      advancedConfig: {
        timeBlocks: this.timeBlocks.filter(block =>
          !block.daysOfWeek || block.daysOfWeek.includes(this.currentDay)
        )
      }
    };

    advancedScheduler.setSchedulingModel(timeBlockingModel);
    this.sendCurrentModel(timeBlockingModel);

    vscode.window.showInformationMessage('Applied time blocking schedule to intelligent planner!');

    // Close the panel
    this._panel.dispose();
  }

  public dispose() {
    TimeBlockingPanel.currentPanel = undefined;

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
    this._panel.title = 'Time Blocking - Daily Schedule';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'timeBlocking.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'timeBlocking.css'));

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Time Blocking</title>
      </head>
      <body>
        <div class="time-blocking-container">
          <div class="header">
            <h1>🕐 Time Blocking</h1>
            <p>Plan your day with focused time blocks</p>

            <div class="day-selector">
              <select id="daySelect" onchange="changeDay()">
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          </div>

          <div class="controls">
            <button class="btn btn-primary" data-action="addNewBlock">
              ➕ Add Block
            </button>
            <button class="btn btn-secondary" data-action="createDefaultSchedule">
              🎯 Default Schedule
            </button>
            <button class="btn btn-tertiary" data-action="applyToScheduler">
              🚀 Apply to Scheduler
            </button>
            <button class="btn btn-danger" data-action="clearAllBlocks">
              🗑️ Clear All
            </button>
          </div>

          <div class="timeline">
            <div class="timeline-header">
              <div class="time-labels">
                <span>6 AM</span>
                <span>9 AM</span>
                <span>12 PM</span>
                <span>3 PM</span>
                <span>6 PM</span>
                <span>9 PM</span>
              </div>
            </div>

            <div class="timeline-body" id="timelineBody">
              <!-- Time blocks will be rendered here -->
            </div>
          </div>

          <div class="block-editor" id="blockEditor">
            <!-- Block editing form will appear here when editing -->
          </div>

          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">Total Blocks:</span>
              <span class="stat-value" id="totalBlocks">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Scheduled Hours:</span>
              <span class="stat-value" id="totalHours">0h</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Free Time:</span>
              <span class="stat-value" id="freeTime">0h</span>
            </div>
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
