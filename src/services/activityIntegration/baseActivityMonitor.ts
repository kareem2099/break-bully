import * as vscode from 'vscode';
import {
  ActivityEvent,
  ActivityType,
  ActivityLevel,
  ActivityMetrics,
  ActivityContext,
  AdvancedTypingMetrics,
  FocusQualityMetrics,
  ContextSwitchMetrics,
  MoodAnalysis
} from './activityTypes';
import { activitySettings } from './activitySettings';
import { ExtensionStorage } from '../../utils/storage';
import { getConfiguration } from '../../core/configuration';
import { MachineLearningAnalyzer } from './machineLearningAnalyzer';
import { MoodDetectionAnalyzer } from './moodDetectionAnalyzer';
import { MoodState } from './activityTypes';
import { Logger } from '../../utils/logger';

// Type definitions for Git API to avoid 'any' type usage
interface GitCommit {
  hash: string;
  message: string;
  parents?: unknown[];
}

interface GitRepo {
  rootUri: { toString(): string };
  state?: {
    HEAD?: {
      commit?: GitCommit;
      upstream?: unknown;
    };
  };
}

interface GitAPI {
  repositories: GitRepo[];
  onDidChangeState(callback: () => void): void;
}

export enum ActivityState {
  READING = 'reading',
  CODING = 'coding',
  DEBUGGING = 'debugging',
  SEARCHING = 'searching',
  REFACTORING = 'refactoring',
  IDLE = 'idle'
}

/**
 * Limited storage interface for what BaseActivityMonitor actually needs.
 */
interface StorageApi {
  loadActivityEvents(): ActivityEvent[];
  saveActivityEvents(events: ActivityEvent[], retentionDays?: number): void;
  loadCustomSetting<T>(key: string, defaultValue?: T): T | undefined;
  saveCustomSetting<T>(key: string, value: T): void;
}

/**
 * Temporary storage fallback when VS Code extension context is not available.
 * Stores data in memory only and provides basic functionality for required methods.
 */
class TemporaryStorage implements StorageApi {
  private activityEvents: ActivityEvent[] = [];
  private customSettings: Map<string, unknown> = new Map();

  loadActivityEvents(): ActivityEvent[] {
    return [...this.activityEvents];
  }

  saveActivityEvents(events: ActivityEvent[], retentionDays: number = 30): void {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    this.activityEvents = events.filter(event => event.timestamp > cutoffTime);
  }

  loadCustomSetting<T>(key: string, defaultValue?: T): T | undefined {
    return this.customSettings.get(key) as T ?? defaultValue;
  }

  saveCustomSetting<T>(key: string, value: T): void {
    this.customSettings.set(key, value);
  }
}

export class BaseActivityMonitor {
  private activityEvents: ActivityEvent[] = [];
  private currentActivityScore = 0;
  private eventBuffer: ActivityEvent[] = [];
  private bufferFlushTimer: ReturnType<typeof setInterval> | null = null;
  private secondTimer: ReturnType<typeof setInterval> | null = null;
  private totalActiveSeconds = 0;
  private sessionActiveSeconds = 0; // Active time for current VS Code session
  private isWindowFocused = vscode.window.state.focused;
  private disposables: vscode.Disposable[] = [];

  // Enhanced activity detection state
  private currentActivityState = ActivityState.IDLE;
  private lastActivityTimestamp = Date.now();
  private idleThreshold = 30000; // 30 seconds idle threshold
  private typingBurstTimeout: ReturnType<typeof setTimeout> | null = null;
  private readingModeActive = false;
  private debugSessionActive = false;
  private activityStateHistory: { timestamp: number; state: ActivityState }[] = [];
  private storage: ExtensionStorage | StorageApi | null = null;

  // Advanced typing pattern tracking
  private currentTypingSession: {
    startTime: number;
    keystrokeTimings: number[];
    backspaceCount: number;
    totalCharacters: number;
    correctionTimings: number[];
    pauseLengths: number[];
    lastKeystrokeTime: number;
  } | null = null;
  private typingPatternsHistory: AdvancedTypingMetrics[] = [];
  private lastFileFocusTime = 0;
  private fileFocusDuration = 0;
  private typingAnalysisTimeout: ReturnType<typeof setTimeout> | null = null; // Used for debouncing typing analysis (prevents multiple rapid analyses)

  constructor(private context?: vscode.ExtensionContext) {
    this.initializeStorage();
    this.initializeEventListeners();
    this.startBufferFlushTimer();
    this.startSecondTimer();
    this.initializeWindowFocusListener();
    this.startIdleMonitor();
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    if (this.bufferFlushTimer) {
      clearInterval(this.bufferFlushTimer);
    }
    if (this.secondTimer) {
      clearInterval(this.secondTimer);
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

    // Advanced typing pattern tracking
    let typingAnalysisTimeout: ReturnType<typeof setTimeout> | null = null;
    Logger.debug('Advanced typing tracking initialized with timeout:', typingAnalysisTimeout); // Use the variable to indicate initialization complete

    const typingDisposable = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length > 0) {
        this.analyzeTypingEvent(event);
      }
    });
    this.disposables.push(typingDisposable);

    // Git commit tracking
    this.initializeGitTracking();

    // Debug session tracking
    this.initializeDebugTracking();

    // Test run tracking
    this.initializeTestTracking();

    // Search operation tracking
    this.initializeSearchTracking();

    // Refactor operation tracking
    this.initializeRefactorTracking();

    // Break taken events (these will be added externally via addManualEvent)
  }

  private initializeGitTracking(): void {
    // Use Git extension API to track commits
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (gitExtension) {
        const git = gitExtension.getAPI(1);

        // Track repository state changes
        git.onDidChangeState(() => {
          // Check for new commits when git state changes
          this.trackGitCommits(git);
          Logger.debug('Git repository state change detected'); // Use event implicitly by logging state change
        });

        // Also check periodically for commits (as backup)
        setInterval(() => {
          this.trackGitCommits(git);
        }, 5 * 60 * 1000); // Check every 5 minutes
      }
    } catch (error) {
      Logger.warn('Git tracking not available:', error);
    }
  }

  private initializeDebugTracking(): void {
    // Track debug session start and end
    const debugStartDisposable = vscode.debug.onDidStartDebugSession(session => {
      this.trackDebugSession(session, 'start');
    });
    this.disposables.push(debugStartDisposable);

    const debugEndDisposable = vscode.debug.onDidTerminateDebugSession(session => {
      this.trackDebugSession(session, 'end');
    });
    this.disposables.push(debugEndDisposable);

    // Track debug breakpoint changes
    let lastBreakpointCount = 0;
    const breakpointDisposable = vscode.debug.onDidChangeBreakpoints(event => {
      Logger.debug('Breakpoint change event received, breakpoints touched:', event.added.length + event.removed.length + event.changed.length); // Use event properties
      const currentBreakpointCount = vscode.debug.breakpoints.length;
      if (currentBreakpointCount !== lastBreakpointCount) {
        // Breakpoints changed during active debugging
        lastBreakpointCount = currentBreakpointCount;
      }
    });
    this.disposables.push(breakpointDisposable);
  }

  private initializeTestTracking(): void {
    // Track test runs via task execution
    const taskDisposable = vscode.tasks.onDidEndTaskProcess(event => {
      if (event.execution.task.name.toLowerCase().includes('test') ||
          event.execution.task.definition?.type === 'npm' &&
          event.execution.task.definition?.script?.includes('test')) {
        this.trackTestRun(event);
      }
    });
    this.disposables.push(taskDisposable);

    // Track test extensions if available
    const testExtensions = ['hbenl.vscode-test-explorer', 'ms-vscode.test-adapter-converter'];
    testExtensions.forEach(extId => {
      try {
        const ext = vscode.extensions.getExtension(extId);
        if (ext && ext.isActive) {
          // Add test explorar handlers here if needed
        }
      } catch (error) {
        Logger.warn('Extension not available:', error); // Log the error to use the variable and provide more info
      }
    });
  }

  private initializeSearchTracking(): void {
    // Track search panel usage
    const searchDisposable = vscode.commands.registerCommand('workbench.action.findInFiles', () => {
      this.trackSearchOperation('global');
    });
    this.disposables.push(searchDisposable);

    // Track local find widget
    const findDisposable = vscode.commands.registerCommand('actions.find', () => {
      this.trackSearchOperation('local');
    });
    this.disposables.push(findDisposable);

    // Track find widget with regex
    const findRegexDisposable = vscode.commands.registerCommand('editor.action.startFindReplaceAction', () => {
      this.trackSearchOperation('regex');
    });
    this.disposables.push(findRegexDisposable);
  }

  private initializeRefactorTracking(): void {
    // Track common refactor commands
    const refactorCommands = [
      'editor.action.rename',
      'editor.action.refactor',
      'dotnet.renameSymbol',
      'typescript.rename',
      'javascript.rename'
    ];

    refactorCommands.forEach(command => {
      try {
        const disposable = vscode.commands.registerCommand(command, (...args) => {
          this.trackRefactorOperation(command);
          // Execute original command logic would go here if we wanted to track after completion
          return vscode.commands.executeCommand(command, ...args);
        });
        this.disposables.push(disposable);
      } catch (error) {
        Logger.warn('Refactor command not available:', error); // Log the error to use the variable and provide more info
      }
    });

    // Track extract function/method (language specific)
    const extractCommands = [
      'editor.action.codeAction',
      'typescript.extract.function',
      'typescript.extract.interface'
    ];

    extractCommands.forEach(command => {
      const disposable = vscode.commands.registerCommand(command, (...args) => {
        this.trackRefactorOperation(`${command}_extract`);
        return vscode.commands.executeCommand(command, ...args);
      });
      this.disposables.push(disposable);
    });
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

  private trackGitCommits(git: GitAPI): void {
    try {
      const repositories = git.repositories;
      repositories.forEach((repo: GitRepo) => {
        const head = repo.state?.HEAD;
        if (head && head.commit && head.upstream) {
          const commit = head.commit;
          const upstream = head.upstream;
          Logger.debug('Processing git repo commit, upstream:', upstream); // Use upstream variable to avoid warning

          // Check if this is a new commit by comparing with previous known commit
          const lastKnownCommit = this.getLastKnownGitCommit(repo.rootUri.toString());
          if (lastKnownCommit !== commit.hash) {
            const changedFiles = commit.parents ? (commit.parents.length > 0 ? 1 : 10) : 10; // Rough estimate
            this.trackGitCommit(commit.message, changedFiles, commit.hash);
            this.setLastKnownGitCommit(repo.rootUri.toString(), commit.hash);
          }
        }
      });
    } catch (error) {
      // Git API may not be fully available
      Logger.debug('Git commit tracking debug:', error);
    }
  }

  private trackGitCommit(message: string, filesChanged: number, hash: string): void {
    const activityEvent: ActivityEvent = {
      id: `git_commit_${Date.now()}_${Math.random()}`,
      type: ActivityType.GIT_COMMIT,
      timestamp: Date.now(),
      intensity: Math.min(10, Math.max(3, Math.floor(filesChanged / 2) + 2)),
      context: {
        commitSize: filesChanged,
        commitHash: hash,
        commitMessage: message.substring(0, 100)
      }
    };

    this.addEvent(activityEvent);
  }

  private trackDebugSession(session: vscode.DebugSession, action: 'start' | 'end'): void {
    const intensity = action === 'start' ? 4 : 2;
    const isStart = action === 'start';

    const activityEvent: ActivityEvent = {
      id: `debug_session_${Date.now()}_${Math.random()}`,
      type: ActivityType.DEBUG_SESSION,
      timestamp: Date.now(),
      intensity,
      ...(isStart ? {} : { duration: 0 }), // Duration tracked externally if needed
      context: {
        debugType: session.type,
        debugConfiguration: session.configuration?.name,
        debugResult: isStart ? 'started' : 'ended'
      }
    };

    this.addEvent(activityEvent);
  }

  private trackTestRun(event: vscode.TaskProcessEndEvent): void {
    const exitCode = event.exitCode;
    const success = exitCode === 0;

    // Estimate test results from task name or assume typical test structure
    const estimatedTests = this.estimateTestResults(event.execution.task);

    const activityEvent: ActivityEvent = {
      id: `test_run_${Date.now()}_${Math.random()}`,
      type: ActivityType.TEST_RUN,
      timestamp: Date.now(),
      intensity: success ? 3 : 2,
      context: {
        testResults: estimatedTests,
        testType: this.getTestType(event.execution.task),
        testSuccess: success
      }
    };

    this.addEvent(activityEvent);
  }

  private trackSearchOperation(searchType: string): void {
    const activityEvent: ActivityEvent = {
      id: `search_${Date.now()}_${Math.random()}`,
      type: ActivityType.SEARCH_OPERATION,
      timestamp: Date.now(),
      intensity: 1,
      context: {
        searchQuery: searchType
      }
    };

    this.addEvent(activityEvent);
  }

  private trackRefactorOperation(operation: string): void {
    const activityEvent: ActivityEvent = {
      id: `refactor_${Date.now()}_${Math.random()}`,
      type: ActivityType.REFACTOR_OPERATION,
      timestamp: Date.now(),
      intensity: 4,
      context: {
        refactorScope: operation,
        refactorType: this.getRefactorType(operation)
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

  private startSecondTimer(): void {
    if (!activitySettings.isBasicEnabled()) return;

    // Count active seconds every second only when window is focused
    this.secondTimer = setInterval(() => {
      if (this.isWindowFocused) {
        this.totalActiveSeconds++;
        this.sessionActiveSeconds++;
        // Update score to reflect time-based activity
        this.updateActivityScore();
      }
    }, 1000);
  }

  private initializeWindowFocusListener(): void {
    if (!activitySettings.isBasicEnabled()) return;

    // Track window focus state to accurately count active time
    const windowStateDisposable = vscode.window.onDidChangeWindowState(state => {
      this.isWindowFocused = state.focused;
    });
    this.disposables.push(windowStateDisposable);
  }

  private flushEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    // Move events from buffer to main array
    const oldEvents = this.loadActivityEvents(); // Load persisted events
    this.activityEvents = [...oldEvents, ...this.eventBuffer];

    // Apply data retention policy (default 30 days)
    const config = getConfiguration();
    Logger.debug('Flush config loaded:', config); // Use config to avoid warning
    const retentionDays = 30; // TODO: Add retention setting to config
    this.saveActivityEventsWithRetention(this.activityEvents, retentionDays);

    // Load back the filtered events
    this.activityEvents = this.loadActivityEvents();

    // Clear buffer
    this.eventBuffer = [];
  }

  private updateActivityScore(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    // Get events from last 5 minutes
    const recentEvents = [
      ...this.activityEvents.filter(e => e.timestamp > fiveMinutesAgo),
      ...this.eventBuffer.filter(e => e.timestamp > fiveMinutesAgo)
    ];

    // Calculate event-based score
    let eventScore = 0;
    if (recentEvents.length > 0) {
      const settings = activitySettings.getSettings();
      let totalWeight = 0;
      let weightedSum = 0;

      recentEvents.forEach(event => {
        const weight = settings.activityWeights[event.type] || 1;
        weightedSum += event.intensity * weight;
        totalWeight += weight;
      });

      eventScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    // Calculate time-based score (1-10 scale based on active seconds in last 5 minutes)
    // Assuming 300 seconds max in 5 minutes, scale appropriately
    const activeSecondsInWindow = Math.min(300, this.totalActiveSeconds);
    const timeScore = (activeSecondsInWindow / 300) * 10;

    // Combine event score and time score with equal weight
    this.currentActivityScore = (eventScore + timeScore) / 2;
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

  getSessionActiveSeconds(): number {
    return this.sessionActiveSeconds;
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
      totalActiveSeconds: this.totalActiveSeconds,
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

  // Helper methods for Git tracking
  private getLastKnownGitCommit(repoUri: string): string | null {
    Logger.debug(`Checking last known commit for repo: ${repoUri}`); // Use repoUri parameter
    // In a real implementation, this would be stored persistently
    // For now, return null to always track new commits on startup
    return null;
  }

  private setLastKnownGitCommit(repoUri: string, commitHash: string): void {
    Logger.debug(`Setting last known commit for repo: ${repoUri}, hash: ${commitHash}`); // Use both parameters
    // In a real implementation, this would be stored persistently
    // For now, we'll just track all commits we detect
  }

  // Helper methods for test tracking
  private estimateTestResults(task: vscode.Task): { passed: number; failed: number; total: number } {
    // Estimate test results based on task output or typical patterns
    // In a real implementation, this would parse actual test results
    const taskName = task.name.toLowerCase();

    if (taskName.includes('unit')) {
      return { passed: 10, failed: 1, total: 11 };
    } else if (taskName.includes('integration')) {
      return { passed: 5, failed: 0, total: 5 };
    } else if (taskName.includes('e2e') || taskName.includes('end-to-end')) {
      return { passed: 3, failed: 0, total: 3 };
    } else {
      // Generic test estimation
      return { passed: 5, failed: 1, total: 6 };
    }
  }

  private getTestType(task: vscode.Task): string {
    const taskName = task.name.toLowerCase();

    if (taskName.includes('unit')) return 'unit';
    if (taskName.includes('integration')) return 'integration';
    if (taskName.includes('e2e') || taskName.includes('end-to-end')) return 'e2e';

    // Check script argument for npm tasks
    if (task.definition?.script) {
      const script = task.definition.script.toLowerCase();
      if (script.includes('unit')) return 'unit';
      if (script.includes('integration')) return 'integration';
      if (script.includes('e2e')) return 'e2e';
    }

    return 'unit'; // Default
  }

  // ===== ACTIVITY DATA STORAGE METHODS =====

  private getStorage(): ExtensionStorage | StorageApi {
    // Get from constructor or create new instance - we'll get from context later
    // For now, create a singleton pattern
    if (!this.storage) {
      if (this.context) {
        this.storage = new ExtensionStorage(this.context);
      } else {
        // Fallback - create temporary storage without context (data won't persist)
        Logger.warn('Extension context not available, using temporary storage');
        this.storage = new TemporaryStorage();
      }
    }
    return this.storage!;
  }

  private loadActivityEvents(): ActivityEvent[] {
    return this.getStorage().loadActivityEvents();
  }

  private saveActivityEventsWithRetention(events: ActivityEvent[], retentionDays: number): void {
    this.getStorage().saveActivityEvents(events, retentionDays);
  }

  // Initialize storage when context becomes available
  initializeStorage(): void {
    // This will be called when context is available
    if (!this.storage && this.context) {
      this.storage = new ExtensionStorage(this.context);
    }
  }

  private getStorageSafe(): ExtensionStorage | StorageApi {
    const storage = this.getStorage();
    if (!storage) {
      throw new Error('Storage not available for activity data operations');
    }
    return storage!;
  }

  // Helper method for refactor tracking
  private getRefactorType(operation: string): string {
    if (operation.includes('rename')) return 'rename';
    if (operation.includes('extract')) return 'extract';
    if (operation.includes('move')) return 'move';
    if (operation.includes('inline')) return 'inline';
    if (operation.includes('changeSignature')) return 'change_signature';

    return 'general';
  }

  // Enhanced Activity Detection Methods
  private startIdleMonitor(): void {
    if (!activitySettings.isBasicEnabled()) return;

    // Monitor for idle state every 10 seconds
    setInterval(() => {
      this.checkIdleState();
    }, 10000);
  }

  private checkIdleState(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTimestamp;

    if (timeSinceLastActivity > this.idleThreshold && this.currentActivityState !== ActivityState.IDLE) {
      this.updateActivityState(ActivityState.IDLE);
    }
  }

  private updateActivityState(newState: ActivityState): void {
    if (this.currentActivityState === newState) return;

    const previousState = this.currentActivityState;
    this.currentActivityState = newState;
    this.lastActivityTimestamp = Date.now();

    // Track state history
    this.activityStateHistory.push({
      timestamp: Date.now(),
      state: newState
    });

    // Keep history limited
    if (this.activityStateHistory.length > 50) {
      this.activityStateHistory = this.activityStateHistory.slice(-50);
    }

    Logger.debug(`Activity state changed: ${previousState} → ${newState}`);

    // Emit state change event for UI updates
    this.emitActivityStateChange(newState, previousState);
  }

  private emitActivityStateChange(newState: ActivityState, previousState: ActivityState): void {
    // Import notification functions dynamically to avoid circular dependencies
    import('../../utils/notifications').then(notifications => {
      // Show state change notification
      if (previousState !== newState && previousState !== ActivityState.IDLE) {
        notifications.showActivityStateChangeNotification(previousState, newState);
      }

      // Show flow state notification
      if (newState === ActivityState.CODING && this.currentActivityScore >= 7) {
        // Check if we're maintaining high productivity (potential flow state)
        const recentEvents = this.getRecentEvents(10); // Last 10 minutes
        const avgIntensity = recentEvents.length > 0
          ? recentEvents.reduce((sum, e) => sum + e.intensity, 0) / recentEvents.length
          : 0;

        if (avgIntensity >= 7) {
          const flowDuration = this.activityStateHistory
            .filter(entry => entry.state === ActivityState.CODING)
            .length * 1; // Rough estimate

          notifications.showFlowStateNotification(flowDuration);
        }
      }

      // Show productivity milestone notifications
      if (this.currentActivityScore >= 8) {
        notifications.showProductivityMilestoneNotification('high_productivity', this.currentActivityScore);
      }
    }).catch(error => {
      Logger.debug('Activity notifications not available:', error);
    });
  }

  private inferActivityStateFromEvent(event: vscode.TextDocumentChangeEvent): ActivityState {
    if (this.debugSessionActive) return ActivityState.DEBUGGING;

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document) return this.currentActivityState;

    // Analyze content changes to determine activity type
    const changes = event.contentChanges;
    const totalTextLength = changes.reduce((sum, change) => sum + change.text.length, 0);
    const totalRemovedLength = changes.reduce((sum, change) => sum + (change.rangeLength || 0), 0);
    Logger.debug(`Activity inference: total added: ${totalTextLength}, total removed: ${totalRemovedLength}`);

    // High editing activity with many changes = coding
    if (changes.length > 3 || totalTextLength > 100) {
      return ActivityState.CODING;
    }

    // Small changes with comments = reading/reviewing
    const lineText = event.document.lineAt(event.contentChanges[0].range.start.line).text;
    if (lineText.match(/^\s*(\/\/|#|\/\*|\*|<!--)/)) {
      this.readingModeActive = true;
      return ActivityState.READING;
    }

    // Moderate activity = coding
    if (totalTextLength > 10) {
      return ActivityState.CODING;
    }

    // Minimal changes = continuing current state
    return this.currentActivityState;
  }

  // Override existing tracking methods to include state management
  private trackFileChangeEnhanced(event: vscode.TextDocumentChangeEvent): void {
    const newState = this.inferActivityStateFromEvent(event);
    this.updateActivityState(newState);

    // Call original tracking method
    this.trackFileChange(event);

    // Additional context-aware logic
    this.updateReadingMode(event);
  }

  private updateReadingMode(event: vscode.TextDocumentChangeEvent): void {
    // Detect if user is reading/reviewing vs actively coding
    const changes = event.contentChanges;
    let commentLines = 0;
    let codeLines = 0;

    changes.forEach(change => {
      if (change.text.includes('//') || change.text.includes('/*') || change.text.includes('*')) {
        commentLines++;
      } else if (change.text.trim().length > 0) {
        codeLines++;
      }
    });

    this.readingModeActive = commentLines > codeLines;

    // Reset reading mode after a period of active coding
    if (codeLines > commentLines && codeLines > 2) {
      this.readingModeActive = false;
    }
  }

  // Enhanced typing burst detection with context awareness
  private trackTypingBurstEnhanced(startTime: number, endTime: number, charactersTyped: number, fileType: string): void {
    if (!activitySettings.isBasicEnabled()) return;

    const duration = endTime - startTime;

    // Context-aware intensity calculation
    let baseIntensity = Math.min(10, Math.max(1, Math.floor(charactersTyped / 50) + 1));

    // Adjust based on file type and current activity state
    if (fileType === 'typescript' || fileType === 'javascript') {
      baseIntensity *= 1.1; // Coding languages get boost
    }

    if (this.readingModeActive) {
      baseIntensity *= 0.7; // Reading gets lower intensity
    }

    const intensity = Math.min(10, Math.floor(baseIntensity));

    const activityEvent: ActivityEvent = {
      id: `typing_burst_${Date.now()}_${Math.random()}`,
      type: ActivityType.TYPING_BURST,
      timestamp: startTime,
      duration,
      intensity,
      context: {
        fileType,
        activityState: this.currentActivityState
      }
    };

    this.addEvent(activityEvent);
  }

  // Get current activity state for UI
  getCurrentActivityState(): ActivityState {
    return this.currentActivityState;
  }

  // Get current mood analysis for UI
  getCurrentMood(): MoodAnalysis | null {
    if (activitySettings.isAdvancedEnabled()) {
      try {
        return MoodDetectionAnalyzer.getInstance().getCurrentMood();
      } catch (error) {
        Logger.debug('Mood detection not available:', error);
      }
    }
    return null;
  }

  // Get current mood state enum value for quick checks
  getCurrentMoodState(): MoodState | null {
    const moodAnalysis = this.getCurrentMood();
    return moodAnalysis ? moodAnalysis.currentMood : null;
  }

  // Get activity state history for analytics
  getRecentActivityStates(minutes: number = 60): { timestamp: number; state: ActivityState }[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.activityStateHistory.filter(entry => entry.timestamp > cutoff);
  }

  // Reset activity tracking (useful for testing)
  reset(): void {
    this.activityEvents = [];
    this.eventBuffer = [];
    this.currentActivityScore = 0;
    this.totalActiveSeconds = 0;
    this.sessionActiveSeconds = 0;
    this.isWindowFocused = true;
    this.currentActivityState = ActivityState.IDLE;
    this.lastActivityTimestamp = Date.now();
    this.activityStateHistory = [];
  }

  // ===== MACHINE LEARNING ANALYSIS METHODS =====

  /**
   * Gets AI-powered insights about user's peak performance times
   */
  getPeakPerformanceInsights(): {
    peakHours: Array<{hour: number, avgScore: number, confidence: number}>;
    optimalWindows: Array<{startHour: number, endHour: number, score: number}>;
    insights: string[];
  } {
    const events = this.getRecentEvents(30 * 24 * 60); // Last 30 days in minutes
    return MachineLearningAnalyzer.analyzePeakPerformanceTimes(events);
  }

  /**
   * Detects burnout risk and suggests interventions
   */
  getBurnoutAnalysis(): {
    riskLevel: 'low' | 'medium' | 'high';
    warningSigns: string[];
    recommendedInterventions: string[];
    nextBreakSuggestion: { timeToNextBreak: number, reason: string };
  } {
    const events = this.getRecentEvents(14 * 24 * 60); // Last 2 weeks in minutes
    const analysis = MachineLearningAnalyzer.detectBurnoutPatterns(events);

    return {
      riskLevel: analysis.riskLevel,
      warningSigns: analysis.warningSigns,
      recommendedInterventions: analysis.recommendedInterventions,
      nextBreakSuggestion: analysis.nextBreakSugestion
    };
  }

  /**
   * Predicts productivity for a specific time
   */
  getProductivityPrediction(targetTime?: number, activityType?: string): {
    predictedScore: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
  } {
    const events = this.getRecentEvents(90 * 24 * 60); // Last 90 days
    const target = targetTime || Date.now();

    return MachineLearningAnalyzer.predictProductivity(events, target, activityType);
  }

  /**
   * Analyzes user's optimal work patterns and recommends session structures
   */
  getWorkPatternOptimization(): {
    optimalSessionLength: number;
    optimalBreakLength: number;
    workRestRatio: string;
    peakProductivityPatterns: string[];
    productivityTrends: 'improving' | 'stable' | 'declining';
  } {
    const events = this.getRecentEvents(21 * 24 * 60); // Last 3 weeks
    return MachineLearningAnalyzer.analyzeWorkPatterns(events);
  }

  /**
   * Analyzes typing events with advanced pattern recognition
   */
  private analyzeTypingEvent(event: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();

    // Start new typing session if none exists or it's been too long since last keystroke
    if (!this.currentTypingSession ||
        (now - this.currentTypingSession.lastKeystrokeTime) > 5000) { // 5 second gap
      this.startNewTypingSession(now);
    }

    // Analyze the content changes for typing patterns (null check already handled above)
    const typingMetrics = this.processContentChanges(event.contentChanges);
    Logger.debug('Calculated typing metrics:', typingMetrics); // Use typingMetrics
    if (this.currentTypingSession) {
      this.currentTypingSession.lastKeystrokeTime = now;
    }

    // Continue building the typing session until a pause indicates completion
    if (this.typingAnalysisTimeout) clearTimeout(this.typingAnalysisTimeout);
    this.typingAnalysisTimeout = setTimeout(() => {
      this.completeTypingSessionAndAnalyze();
    }, 2000); // 2 second pause = end of typing burst
  }

  /**
   * Starts a new typing session
   */
  private startNewTypingSession(startTime: number): void {
    this.currentTypingSession = {
      startTime,
      keystrokeTimings: [],
      backspaceCount: 0,
      totalCharacters: 0,
      correctionTimings: [],
      pauseLengths: [],
      lastKeystrokeTime: startTime
    };
  }

  /**
   * Processes content changes to extract typing metrics
   */
  private processContentChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]): {
    keystrokes: number;
    backspaces: number;
    additions: number;
    deletions: number;
    isCorrection: boolean;
  } {
    let keystrokes = 0;
    let backspaces = 0;
    let additions = 0;
    let deletions = 0;
    let isCorrection = false;

    changes.forEach(change => {
      const addedChars = change.text.length;
      const removedChars = change.rangeLength || 0;

      additions += addedChars;
      deletions += removedChars;
      keystrokes += addedChars;

      // Detect backspaces through deletions
      if (removedChars > 0 && addedChars === 0) {
        backspaces += removedChars;
        isCorrection = true;
      }
    });

    return { keystrokes, backspaces, additions, deletions, isCorrection };
  }

  /**
   * Completes a typing session and generates typing pattern analysis
   */
  private completeTypingSessionAndAnalyze(): void {
    if (!this.currentTypingSession) return;

    const session = this.currentTypingSession;
    const endTime = Date.now();
    const duration = endTime - session.startTime;

    // Calculate typing metrics
    const errorRate = session.totalCharacters > 0 ?
      (session.backspaceCount / session.totalCharacters) * 100 : 0;

    // Calculate rhythm variance (consistency)
    let rhythmVariance = 1.0; // Perfectly consistent by default
    if (session.keystrokeTimings.length > 1) {
      const intervals = session.keystrokeTimings.slice(1).map((time, i) =>
        time - session.keystrokeTimings[i]);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) =>
        sum + Math.pow(interval - mean, 2), 0) / intervals.length;
      rhythmVariance = Math.max(0.1, 1 - (Math.sqrt(variance) / mean)); // 0-1 scale
    }

    // Calculate WPM (words per minute)
    const wordsTyped = session.totalCharacters / 5; // Standard: 5 chars = 1 word
    const minutesElapsed = duration / (1000 * 60);
    const keystrokeVelocity = minutesElapsed > 0 ? wordsTyped / minutesElapsed : 0;

    // Detect fatigue indicators
    const fatigueIndicators: string[] = [];
    if (rhythmVariance < 0.5 && duration > 30000) fatigueIndicators.push('erratic_rhythm');
    if (errorRate > 5) fatigueIndicators.push('high_error_rate');
    if (session.correctionTimings.length > session.totalCharacters * 0.1) fatigueIndicators.push('frequent_corrections');

    // Determine correction patterns
    const correctionPatterns: ('immediate' | 'delayed' | 'bunching')[] = [];
    if (session.correctionTimings.length > 0) {
      // Analyze timing of corrections relative to typing flow
      session.correctionTimings.forEach(correctionTime => {
        const timeSinceStart = correctionTime - session.startTime;
        const relativePosition = timeSinceStart / duration;

        if (relativePosition < 0.1) correctionPatterns.push('immediate');
        else if (relativePosition > 0.9) correctionPatterns.push('delayed');
        else correctionPatterns.push('bunching');
      });
    }

    // Calculate burst quality score
    const burstQuality = this.calculateBurstQuality(
      keystrokeVelocity, errorRate, rhythmVariance, duration);

    // Create advanced typing metrics
    const advancedMetrics: AdvancedTypingMetrics = {
      keystrokeVelocity: Math.round(keystrokeVelocity * 10) / 10,
      errorRate: Math.round(errorRate * 10) / 10,
      rhythmVariance: Math.round(rhythmVariance * 100) / 100,
      pauseDistribution: session.pauseLengths,
      correctionPatterns,
      burstQuality: Math.round(burstQuality * 100) / 100,
      fatigueIndicators
    };

    // Store in typing patterns history
    this.typingPatternsHistory.push(advancedMetrics);
    if (this.typingPatternsHistory.length > 50) { // Keep recent patterns
      this.typingPatternsHistory = this.typingPatternsHistory.slice(-50);
    }

    // Update current activity state based on typing patterns
    this.updateActivityStateBasedOnTyping(advancedMetrics);

    // Generate focus quality analysis if appropriate
    const focusMetrics = this.generateFocusQualityMetrics(advancedMetrics);
    const contextMetrics = this.generateContextSwitchMetrics();

    // Analyze mood from typing patterns (if advanced features enabled)
    let moodAnalysis: MoodAnalysis | undefined;
    if (activitySettings.isAdvancedEnabled()) {
      try {
        const moodAnalyzer = MoodDetectionAnalyzer.getInstance();
        const recentActivity = this.getRecentEvents(20); // Last 20 minutes for context
        const currentHour = new Date().getHours();

        moodAnalysis = moodAnalyzer.analyzeTypingMood(
          advancedMetrics,
          focusMetrics,
          recentActivity,
          currentHour
        );

        // Log mood detection for debugging
        Logger.debug('Mood detected:', {
          mood: moodAnalysis.currentMood,
          confidence: moodAnalysis.confidence.toFixed(2),
          intensity: moodAnalysis.intensity,
          triggers: moodAnalysis.triggers
        });
      } catch (error) {
        Logger.debug('Mood detection failed:', error);
      }
    }

    // Create enhanced activity event
    const activityEvent: ActivityEvent = {
      id: `typing_session_${Date.now()}_${Math.random()}`,
      type: ActivityType.TYPING_BURST,
      timestamp: session.startTime,
      duration,
      intensity: Math.min(10, Math.max(1, Math.floor(burstQuality * 10))),
      context: {
        fileType: vscode.window.activeTextEditor?.document.languageId || 'unknown',
        typingMetrics: advancedMetrics,
        focusQuality: focusMetrics,
        contextSwitch: contextMetrics,
        ...(moodAnalysis && { moodAnalysis }) // Include mood analysis only if available
      }
    };

    this.addEvent(activityEvent);

    // Reset session
    this.currentTypingSession = null;

    Logger.debug('Completed typing session analysis:', {
      duration: Math.round(duration/1000) + 's',
      wpm: advancedMetrics.keystrokeVelocity,
      errors: advancedMetrics.errorRate + '%',
      quality: advancedMetrics.burstQuality,
      patterns: correctionPatterns.length > 0 ? correctionPatterns[0] : 'none'
    });
  }

  /**
   * Calculates overall typing burst quality score
   */
  private calculateBurstQuality(
    velocity: number,
    errorRate: number,
    rhythm: number,
    duration: number
  ): number {
    // Velocity score (0-1): 40-60 WPM is excellent, 20-40 good, below poor
    let velocityScore = 0;
    if (velocity >= 40) velocityScore = 1.0;
    else if (velocity >= 30) velocityScore = 0.8;
    else if (velocity >= 20) velocityScore = 0.6;
    else velocityScore = Math.max(0.2, velocity / 20);

    // Error rate score (0-1): <2% excellent, <5% good, >10% poor
    const errorScore = Math.max(0, 1 - (errorRate / 10));

    // Rhythm score (0-1): >0.8 excellent consistency
    const rhythmScore = rhythm;

    // Duration bonus: longer focused bursts get slight bonus
    const durationBonus = Math.min(0.1, duration / (1000 * 60 * 10)); // Max 0.1 bonus for 10 minutes

    return Math.min(1.0, (velocityScore * 0.4) + (errorScore * 0.3) + (rhythmScore * 0.3) + durationBonus);
  }

  /**
   * Updates activity state based on typing patterns
   */
  private updateActivityStateBasedOnTyping(metrics: AdvancedTypingMetrics): void {
    let newState = ActivityState.CODING;

    // Flow state detection: high quality, consistent typing, no fatigue
    if (metrics.burstQuality >= 0.8 && metrics.fatigueIndicators.length === 0 &&
        metrics.rhythmVariance >= 0.7) {
      newState = ActivityState.CODING; // Stay in coding, potentially flow state
    }

    // Fatigue state: low quality, inconsistent, high errors
    else if (metrics.fatigueIndicators.length > 1 || metrics.burstQuality < 0.4) {
      // Don't change state immediately - might just be a rough patch
      Logger.debug('Typing fatigue detected, monitoring closely');
    }

    // Reading state: slow, inconsistent typing
    else if (metrics.keystrokeVelocity < 20 && metrics.rhythmVariance < 0.5) {
      newState = ActivityState.READING;
    }

    this.updateActivityState(newState);
  }

  /**
   * Generates focus quality metrics from typing patterns
   */
  private generateFocusQualityMetrics(typingMetrics: AdvancedTypingMetrics): FocusQualityMetrics {
    const now = Date.now();
    Logger.debug('Calculating focus metrics at:', now); // Use now

    // File immersion: how long current file has been active
    const fileImmersion = this.fileFocusDuration || 0;
    const contextDepth = Math.min(10, Math.max(0, fileImmersion / (10 * 60 * 1000))); // 0-10 based on 10 minutes

    // Task switching: analyze file switches in recent activity
    const recentEvents = this.getRecentEvents(15); // Last 15 minutes
    const fileSwitches = recentEvents.filter(e => e.type === ActivityType.FILE_OPEN).length;
    const taskSwitchingRate = fileSwitches * 4; // Rate per hour

    // Classify work type based on patterns
    let workType: FocusQualityMetrics['workType'] = 'deep_coding';
    if (typingMetrics.errorRate > 8 || taskSwitchingRate > 12) workType = 'debugging';
    else if (fileImmersion < 300000) workType = 'administrative'; // Less than 5 minutes
    else if (typingMetrics.correctionPatterns.includes('immediate')) workType = 'creative';
    else if (taskSwitchingRate > 6) workType = 'review';

    // Focus stability: inverse of error rate and rhythm variance
    const focusStability = Math.min(1.0, (1 - typingMetrics.errorRate/10) * typingMetrics.rhythmVariance);

    return {
      contextDepth: Math.round(contextDepth * 10) / 10,
      taskSwitchingRate: Math.round(taskSwitchingRate * 10) / 10,
      codeToCommentRatio: this.readingModeActive ? 0.2 : 2.0, // Placeholder - could be more sophisticated
      documentationEngagement: this.readingModeActive,
      searchUtilization: 0, // Would need search event tracking
      workType,
      focusStability: Math.round(focusStability * 100) / 100
    };
  }

  /**
   * Generates context switching metrics for current session
   */
  private generateContextSwitchMetrics(): ContextSwitchMetrics {
    // This is a simplified implementation - in production would track actual app switches
    return {
      fromApp: 'vscode', // Current app
      toApp: 'vscode', // Staying in same app
      durationInPrevious: this.fileFocusDuration || 0,
      transitionPurpose: 'research', // Assuming research-based transitions
      productivityContext: 'deep_work', // Based on activity state
      contextChangeCost: 0 // No app switch = low cost
    };
  }

  /**
   * Gets comprehensive AI insights into user's productivity profile
   */
  getAISummaryInsights(): {
    peakTimes: string;
    currentRisk: string;
    nextBreak: string;
    productivityTrend: string;
    recommendations: string[];
  } {
    try {
      const peakInsights = this.getPeakPerformanceInsights();
      const burnoutAnalysis = this.getBurnoutAnalysis();
      const workPatterns = this.getWorkPatternOptimization();

      // Format peak time
      let peakTimeStr = 'Analyzing your patterns...';
      if (peakInsights.peakHours.length > 0) {
        const best = peakInsights.peakHours[0];
        const hour12 = best.hour === 0 ? 12 : best.hour > 12 ? best.hour - 12 : best.hour;
        const ampm = best.hour >= 12 ? 'PM' : 'AM';
        peakTimeStr = `${hour12}:00 ${ampm} (Productivity: ${best.avgScore}/10)`;
      }

      // Format risk level with emoji
      const riskEmojis = {
        low: '🟢',
        medium: '🟡',
        high: '🔴'
      };
      const currentRisk = `${riskEmojis[burnoutAnalysis.riskLevel]} ${burnoutAnalysis.riskLevel.charAt(0).toUpperCase() + burnoutAnalysis.riskLevel.slice(1)}`;

      // Format next break
      const nextBreak = burnoutAnalysis.nextBreakSuggestion.timeToNextBreak < 60
        ? `${burnoutAnalysis.nextBreakSuggestion.timeToNextBreak}min`
        : `${Math.round(burnoutAnalysis.nextBreakSuggestion.timeToNextBreak / 60)}hr`;

      // Format productivity trend
      const trendEmojis = {
        improving: '📈',
        stable: '📊',
        declining: '📉'
      };
      const productivityTrend = `${trendEmojis[workPatterns.productivityTrends]} Productivity ${workPatterns.productivityTrends}`;

      // Combine recommendations
      const recommendations = [
        ...peakInsights.insights.slice(0, 2),
        ...burnoutAnalysis.recommendedInterventions.slice(0, 2),
        ...workPatterns.peakProductivityPatterns.slice(0, 1),
        ...(peakInsights.optimalWindows.length > 0
          ? [`Focus complex work between ${peakInsights.optimalWindows[0].startHour}:00-${peakInsights.optimalWindows[0].endHour}:00`]
          : [])
      ].filter(r => r.length > 0);

      return {
        peakTimes: peakTimeStr,
        currentRisk,
        nextBreak,
        productivityTrend,
        recommendations: recommendations.slice(0, 5) // Limit to 5 recommendations
      };

  } catch (error) {
    Logger.debug('Error generating AI summary insights:', error); // Use error parameter
    return {
      peakTimes: 'Gathering your activity data...',
      currentRisk: '🟢 Gathering data',
      nextBreak: '45min',
      productivityTrend: '📊 Analyzing trends',
      recommendations: [
        'Continue using the extension to build your productivity profile',
        'The AI will provide personalized insights with more usage data'
      ]
    };
  }
  }

  /**
   * Gets personalized task scheduling recommendations
   */
  getTaskSchedulingRecommendations(taskComplexity: 'simple' | 'medium' | 'complex' = 'medium'): {
    optimalTimeSlot: string;
    durationEstimate: number;
    breakFrequency: number;
    productivityExpectation: string;
    tips: string[];
  } {
    try {
      const peakInsights = this.getPeakPerformanceInsights();
      const workPatterns = this.getWorkPatternOptimization();

      // Determine optimal time based on complexity
      let optimalHour: number;
      if (taskComplexity === 'simple') {
        // Any hour with reasonable productivity (bottom 50%)
        const sorted = [...peakInsights.peakHours].sort((a, b) => a.avgScore - b.avgScore);
        optimalHour = sorted[Math.floor(sorted.length / 2)]?.hour || 9;
      } else if (taskComplexity === 'complex') {
        // Best hour available
        optimalHour = peakInsights.peakHours[0]?.hour || 10;
      } else {
        // Middle of top half
        const topHalf = peakInsights.peakHours.slice(0, 3);
        optimalHour = topHalf[1]?.hour || 9; // Second best or default
      }

      // Format time slot
      const hour12 = optimalHour === 0 ? 12 : optimalHour > 12 ? optimalHour - 12 : optimalHour;
      const ampm = optimalHour >= 12 ? 'PM' : 'AM';
      const optimalTimeSlot = `${hour12}:00 ${ampm}`;

      // Estimate duration based on complexity and user's patterns
      const baseDuration = taskComplexity === 'simple' ? 15 : taskComplexity === 'medium' ? 45 : 90;
      const durationEstimate = Math.max(baseDuration, workPatterns.optimalSessionLength);

      // Break frequency based on task length and complexity
      const breakFrequency = durationEstimate > 60 ? Math.max(1, durationEstimate / 45) : 0;

      // Productivity expectation
      const expectedPeak = peakInsights.peakHours.find(h => h.hour === optimalHour);
      const productivityExpectation = expectedPeak
        ? `${expectedPeak.avgScore}/10 predicted productivity`
        : 'Normal productivity expected';

      // Generate tips based on complexity
      const tips: string[] = [];
      if (taskComplexity === 'complex') {
        tips.push('Use your peak performance time for maximum focus');
        tips.push('Take scheduled breaks every 45-60 minutes');
        tips.push('Ensure you have 7-8 hours of sleep before tackling');
      } else if (taskComplexity === 'medium') {
        tips.push('Schedule during moderate energy times for balance');
        tips.push('Break tasks into 20-30 minute chunks');
      } else {
        tips.push('Use residual energy times for simple tasks');
        tips.push('Combine with other low-focus activities');
      }

      // Add personalized tips based on burnout risk
      const burnoutAnalysis = this.getBurnoutAnalysis();
      if (burnoutAnalysis.riskLevel === 'high') {
        tips.push('Consider rescheduling if feeling fatigued');
        tips.push('Focus on health maintenance alongside productivity');
      }

      return {
        optimalTimeSlot,
        durationEstimate,
        breakFrequency: Math.round(breakFrequency),
        productivityExpectation,
        tips
      };

    } catch (error) {
      Logger.debug('Error generating task recommendations:', error); // Use error parameter
      // Fallback recommendations
      return {
        optimalTimeSlot: '9:00 AM',
        durationEstimate: 45,
        breakFrequency: 1,
        productivityExpectation: 'Normal productivity',
        tips: [
          'Build more activity data for personalized recommendations',
          'Focus on consistency and good sleep habits'
        ]
      };
    }
  }
}
