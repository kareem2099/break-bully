import * as vscode from 'vscode';
import {
  ActivityEvent,
  ActivityType,
  ActivityLevel,
  ActivityMetrics,
  FileChangeEvent,
  ActivityContext
} from './activityTypes';
import { activitySettings } from './activitySettings';

export class BaseActivityMonitor {
  private activityEvents: ActivityEvent[] = [];
  private currentActivityScore = 0;
  private eventBuffer: ActivityEvent[] = [];
  private bufferFlushTimer: NodeJS.Timeout | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.initializeEventListeners();
    this.startBufferFlushTimer();
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    if (this.bufferFlushTimer) {
      clearInterval(this.bufferFlushTimer);
    }
  }

  private initializeEventListeners(): void {
    if (!activitySettings.isBasicEnabled()) return;

    // File change events
    const fileChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
      this.trackFileChange(event);
    });
    this.disposables.push(fileChangeDisposable);

    // File save events
    const fileSaveDisposable = vscode.workspace.onDidSaveTextDocument(document => {
      this.trackFileSave(document);
    });
    this.disposables.push(fileSaveDisposable);

    // File open events
    const fileOpenDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.trackFileOpen(editor.document);
      }
    });
    this.disposables.push(fileOpenDisposable);

    // Typing burst detection (simplified)
    let typingTimer: NodeJS.Timeout | null = null;
    let typingStartTime = 0;
    let typingCount = 0;

    const typingDisposable = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length > 0) {
        if (!typingTimer) {
          typingStartTime = Date.now();
          typingCount = 0;
        }

        typingCount += event.contentChanges.reduce((sum, change) =>
          sum + change.text.length, 0);

        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (typingCount > 10) { // Minimum characters for a burst
            this.trackTypingBurst(typingStartTime, Date.now(), typingCount, event.document.languageId);
          }
          typingTimer = null;
          typingCount = 0;
        }, 1000); // 1 second pause to detect burst end
      }
    });
    this.disposables.push(typingDisposable);
  }

  private trackFileChange(event: vscode.TextDocumentChangeEvent): void {
    if (!activitySettings.isBasicEnabled()) return;

    const linesChanged = event.contentChanges.reduce((sum, change) => {
      const addedLines = (change.text.match(/\n/g) || []).length;
      const removedLines = (change.range.end.line - change.range.start.line);
      return sum + Math.max(addedLines, removedLines);
    }, 0);

    const intensity = Math.min(10, Math.max(1, Math.floor(linesChanged / 5) + 1));

    const activityEvent: ActivityEvent = {
      id: `file_edit_${Date.now()}_${Math.random()}`,
      type: ActivityType.FILE_EDIT,
      timestamp: Date.now(),
      intensity,
      context: {
        fileType: event.document.languageId,
        linesChanged
      }
    };

    this.addEvent(activityEvent);
  }

  private trackFileSave(document: vscode.TextDocument): void {
    if (!activitySettings.isBasicEnabled()) return;

    const activityEvent: ActivityEvent = {
      id: `file_save_${Date.now()}_${Math.random()}`,
      type: ActivityType.FILE_SAVE,
      timestamp: Date.now(),
      intensity: 3, // Moderate intensity for saves
      context: {
        fileType: document.languageId
      }
    };

    this.addEvent(activityEvent);
  }

  private trackFileOpen(document: vscode.TextDocument): void {
    if (!activitySettings.isBasicEnabled()) return;

    const activityEvent: ActivityEvent = {
      id: `file_open_${Date.now()}_${Math.random()}`,
      type: ActivityType.FILE_OPEN,
      timestamp: Date.now(),
      intensity: 1, // Low intensity for file opens
      context: {
        fileType: document.languageId
      }
    };

    this.addEvent(activityEvent);
  }

  private trackTypingBurst(startTime: number, endTime: number, charactersTyped: number, fileType: string): void {
    if (!activitySettings.isBasicEnabled()) return;

    const duration = endTime - startTime;
    const intensity = Math.min(10, Math.max(1, Math.floor(charactersTyped / 50) + 1));

    const activityEvent: ActivityEvent = {
      id: `typing_burst_${Date.now()}_${Math.random()}`,
      type: ActivityType.TYPING_BURST,
      timestamp: startTime,
      duration,
      intensity,
      context: {
        fileType
      }
    };

    this.addEvent(activityEvent);
  }

  private addEvent(event: ActivityEvent): void {
    this.eventBuffer.push(event);

    // Update current activity score immediately for real-time feedback
    this.updateActivityScore();
  }

  private startBufferFlushTimer(): void {
    // Flush buffer every 30 seconds to manage memory
    this.bufferFlushTimer = setInterval(() => {
      this.flushEventBuffer();
    }, 30000);
  }

  private flushEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    // Move events from buffer to main array
    this.activityEvents.push(...this.eventBuffer);
    this.eventBuffer = [];

    // Clean up old events (keep last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.activityEvents = this.activityEvents.filter(event => event.timestamp > oneDayAgo);

    // Limit total events to prevent memory issues
    if (this.activityEvents.length > 10000) {
      this.activityEvents = this.activityEvents.slice(-5000);
    }
  }

  private updateActivityScore(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    // Get events from last 5 minutes
    const recentEvents = [
      ...this.activityEvents.filter(e => e.timestamp > fiveMinutesAgo),
      ...this.eventBuffer.filter(e => e.timestamp > fiveMinutesAgo)
    ];

    if (recentEvents.length === 0) {
      this.currentActivityScore = 0;
      return;
    }

    // Calculate weighted average intensity
    const settings = activitySettings.getSettings();
    let totalWeight = 0;
    let weightedSum = 0;

    recentEvents.forEach(event => {
      const weight = settings.activityWeights[event.type] || 1;
      weightedSum += event.intensity * weight;
      totalWeight += weight;
    });

    this.currentActivityScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  getCurrentActivityLevel(): ActivityLevel {
    if (this.currentActivityScore >= 8) return ActivityLevel.HIGH;
    if (this.currentActivityScore >= 4) return ActivityLevel.MEDIUM;
    if (this.currentActivityScore >= 1) return ActivityLevel.LOW;
    return ActivityLevel.LOW; // Default to low for no activity
  }

  getActivityScore(): number {
    return this.currentActivityScore;
  }

  getMetrics(): ActivityMetrics {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentEvents = this.activityEvents.filter(e => e.timestamp > oneHourAgo);

    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<ActivityType, number>);

    return {
      currentScore: this.currentActivityScore,
      averageScore: recentEvents.length > 0
        ? recentEvents.reduce((sum, e) => sum + e.intensity, 0) / recentEvents.length
        : 0,
      peakScore: recentEvents.length > 0
        ? Math.max(...recentEvents.map(e => e.intensity))
        : 0,
      activityLevel: this.getCurrentActivityLevel(),
      timeInFlow: 0, // Will be calculated by smart scheduler
      totalEvents: recentEvents.length,
      eventsByType
    };
  }

  getRecentEvents(minutes: number = 60): ActivityEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return [
      ...this.activityEvents.filter(e => e.timestamp > cutoff),
      ...this.eventBuffer.filter(e => e.timestamp > cutoff)
    ].sort((a, b) => b.timestamp - a.timestamp);
  }

  // Method to manually add events (for testing or external integrations)
  addManualEvent(type: ActivityType, intensity: number, context?: ActivityContext): void {
    const event: ActivityEvent = {
      id: `${type}_${Date.now()}_${Math.random()}`,
      type,
      timestamp: Date.now(),
      intensity: Math.max(1, Math.min(10, intensity)),
      context: context || {}
    };

    this.addEvent(event);
  }

  // Reset activity tracking (useful for testing)
  reset(): void {
    this.activityEvents = [];
    this.eventBuffer = [];
    this.currentActivityScore = 0;
  }
}
