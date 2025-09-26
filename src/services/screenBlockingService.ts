import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';

export interface BlockingState {
  isActive: boolean;
  reason: 'rest-enforcement' | 'rest-warning';
  annoyanceLevel: 'mild' | 'moderate' | 'extreme' | 'nuclear';
  startTime: Date;
  warningTime?: Date;
}

let blockingState: BlockingState | null = null;
let blockingDecoration: vscode.TextEditorDecorationType | null = null;
let warningTimer: NodeJS.Timeout | null = null;
let blockingTimer: NodeJS.Timeout | null = null;

// Command override disposables for blocking input
let commandDisposables: vscode.Disposable[] = [];

export function initializeScreenBlocking(): void {
  // Listen for text document changes to detect coding activity
  vscode.workspace.onDidChangeTextDocument((event) => {
    onTextDocumentChanged(event);
  });

  // Listen for active editor changes
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && blockingState?.isActive) {
      applyBlockingDecoration(editor);
    }
  });

  // Listen for text document saves to potentially block them during rest
  vscode.workspace.onWillSaveTextDocument((event) => {
    if (blockingState?.isActive && isCodeFile(event.document)) {
      // Block saves during rest periods for extreme enforcement
      const config = getConfiguration();
      if (config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear') {
        event.waitUntil(Promise.reject(new Error('🚫 SAVE BLOCKED - Rest period active. Complete your rest break first.')));
      }
    }
  });
}

export function startRestEnforcement(): void {
  const config = getConfiguration();

  blockingState = {
    isActive: false,
    reason: 'rest-enforcement',
    annoyanceLevel: config.annoyanceLevel,
    startTime: new Date()
  };

  // Show initial warning
  showRestWarning();
}

export function stopRestEnforcement(): void {
  if (blockingState) {
    clearBlocking();
    blockingState = null;
  }

  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }

  if (blockingTimer) {
    clearTimeout(blockingTimer);
    blockingTimer = null;
  }
}

function onTextDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
  // Only monitor during rest enforcement
  if (!blockingState || blockingState.reason !== 'rest-enforcement') {
    return;
  }

  // Check if this is a code file (not settings, etc.)
  if (!isCodeFile(event.document)) {
    return;
  }

  // Check if user is actively typing (not just cursor movement)
  if (event.contentChanges.length > 0) {
    // If blocking is active, immediately undo the change
    if (blockingState.isActive) {
      // Find the editor for this document
      const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
      if (editor) {
        // Undo the change immediately
        vscode.commands.executeCommand('undo', editor);
        // Show blocking message
        showBlockedInputMessage();
      }
    } else {
      // Not blocking yet, but detect coding activity
      onCodingActivityDetected();
    }
  }
}

function isCodeFile(document: vscode.TextDocument): boolean {
  // Consider these as code files that should be blocked during rest
  const codeExtensions = [
    '.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go',
    '.rs', '.swift', '.kt', '.scala', '.html', '.css', '.scss', '.less',
    '.json', '.xml', '.yaml', '.yml', '.md', '.sql', '.sh', '.bat', '.ps1'
  ];

  const fileName = document.fileName.toLowerCase();
  return codeExtensions.some(ext => fileName.endsWith(ext)) ||
         document.languageId !== 'plaintext';
}

function onCodingActivityDetected(): void {
  if (!blockingState) return;

  const config = getConfiguration();

  if (blockingState.isActive) {
    // Already blocking, reinforce the block
    applyBlockingDecoration(vscode.window.activeTextEditor);
    return;
  }

  // Start warning phase
  blockingState.warningTime = new Date();

  if (config.annoyanceLevel === 'mild' || config.annoyanceLevel === 'moderate') {
    // Allow 10 seconds grace period
    showGracePeriodWarning();

    warningTimer = setTimeout(() => {
      if (blockingState && !blockingState.isActive) {
        startBlocking();
      }
    }, 10000); // 10 seconds

  } else if (config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear') {
    // Immediate blocking
    showImmediateBlockWarning();

    blockingTimer = setTimeout(() => {
      startBlocking();
    }, 10000); // 10 second warning
  }
}

function showRestWarning(): void {
  vscode.window.showWarningMessage(
    '🛋️ REST PERIOD ACTIVE\n\nYou are now in a rest period. Avoid coding activities to maintain work-life balance.',
    'Understood'
  );
}

function showGracePeriodWarning(): void {
  vscode.window.showWarningMessage(
    '⚠️ CODING DETECTED DURING REST!\n\nYou have 10 seconds to finish what you\'re doing, then typing will be blocked.',
    'Stop Coding'
  );
}

function showImmediateBlockWarning(): void {
  vscode.window.showErrorMessage(
    '🚫 CODING DETECTED DURING REST!\n\nScreen will be blocked in 10 seconds. Stop all coding activities immediately!',
    'Stop Coding Now'
  );
}

function startBlocking(): void {
  if (!blockingState) return;

  blockingState.isActive = true;

  // Register command overrides to block input
  registerInputBlockingCommands();

  // Make all open text documents read-only
  makeDocumentsReadOnly();

  // Create blocking decoration
  createBlockingDecoration();

  // Apply to all visible editors
  vscode.window.visibleTextEditors.forEach(editor => {
    applyBlockingDecoration(editor);
  });

  // Show blocking notification
  showBlockingNotification();
}

function createBlockingDecoration(): void {
  const config = getConfiguration();

  if (config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear') {
    // Full black overlay
    blockingDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      color: 'rgba(255, 255, 255, 0.1)',
      after: {
        contentText: '🚫 REST ENFORCEMENT ACTIVE - Screen blocked until rest period ends 🚫',
        color: '#ff6b6b',
        fontWeight: 'bold',
        margin: '0 0 0 20px'
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
  } else {
    // Mild blocking - just prevent typing but allow reading
    blockingDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      border: '2px solid #ff6b6b',
      borderRadius: '4px',
      after: {
        contentText: '⚠️ REST PERIOD - Avoid typing',
        color: '#ff6b6b',
        fontWeight: 'bold',
        margin: '0 0 0 10px'
      }
    });
  }
}

function applyBlockingDecoration(editor?: vscode.TextEditor): void {
  if (!blockingDecoration || !editor) return;

  const document = editor.document;
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  editor.setDecorations(blockingDecoration, [{
    range: fullRange,
    hoverMessage: 'Rest period active - avoid coding activities'
  }]);
}

function showBlockingNotification(): void {
  const config = getConfiguration();

  if (config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear') {
    vscode.window.showErrorMessage(
      '🚫 SCREEN BLOCKED\n\nRest enforcement active. Screen will remain blocked until rest period completes.',
      'Accept Rest Period'
    );
  } else {
    vscode.window.showWarningMessage(
      '⚠️ TYPING BLOCKED\n\nRest period active. You can read but cannot type until rest completes.',
      'Accept Rest Period'
    );
  }
}

function registerInputBlockingCommands(): void {
  // Clear any existing command overrides
  unregisterInputBlockingCommands();

  // Commands to block during rest enforcement
  const commandsToBlock = [
    'type',                    // Main typing command
    'paste',                   // Paste command
    'cut',                     // Cut command
    'deleteRight',             // Delete key
    'deleteLeft',              // Backspace
    'deleteWordRight',         // Ctrl+Delete
    'deleteWordLeft',          // Ctrl+Backspace
    'deleteAllRight',          // Ctrl+Shift+Delete
    'deleteAllLeft',           // Ctrl+Shift+Backspace
    'indent',                  // Tab indentation
    'outdent',                 // Shift+Tab outdentation
    'insertLineAfter',          // Enter key for new lines
    'insertLineBefore',         // Ctrl+Enter
    'addCursorAbove',          // Ctrl+Alt+Up
    'addCursorBelow',          // Ctrl+Alt+Down
    'addCursorsToBottom',      // Ctrl+Shift+Alt+Down
    'addCursorsToTop'          // Ctrl+Shift+Alt+Up
  ];

  // Register command overrides
  for (const command of commandsToBlock) {
    const disposable = vscode.commands.registerCommand(command, (...args: any[]) => {
      if (blockingState?.isActive) {
        // Block the command and show feedback
        showBlockedInputMessage();
        return; // Prevent the original command from executing
      }
      // If not blocking, execute the original command
      return vscode.commands.executeCommand(`default:${command}`, ...args);
    });
    commandDisposables.push(disposable);
  }
}

function unregisterInputBlockingCommands(): void {
  // Dispose all command overrides
  commandDisposables.forEach(disposable => disposable.dispose());
  commandDisposables = [];
}

function makeDocumentsReadOnly(): void {
  // Make all open text documents read-only during blocking
  vscode.workspace.textDocuments.forEach(document => {
    if (isCodeFile(document)) {
      // Note: VSCode doesn't have a direct "read-only" API for text documents
      // The command overrides will handle the blocking instead
      // This function is here for future enhancement if needed
    }
  });
}

function showBlockedInputMessage(): void {
  const config = getConfiguration();
  const message = config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear'
    ? '🚫 INPUT BLOCKED - Rest period active. Complete your rest break first.'
    : '⚠️ TYPING BLOCKED - Rest period active. Take a break from coding.';

  vscode.window.showErrorMessage(message, 'Complete Rest Period');
}

function clearBlocking(): void {
  // Unregister command overrides
  unregisterInputBlockingCommands();

  if (blockingDecoration) {
    blockingDecoration.dispose();
    blockingDecoration = null;
  }

  // Clear decorations from all editors
  vscode.window.visibleTextEditors.forEach(editor => {
    if (blockingDecoration) {
      editor.setDecorations(blockingDecoration, []);
    }
  });
}

export function getBlockingState(): BlockingState | null {
  return blockingState;
}

export function isRestEnforced(): boolean {
  return blockingState?.reason === 'rest-enforcement' || false;
}

export function forceUnblock(): void {
  // Emergency unblock (could be used for critical situations)
  unregisterInputBlockingCommands();
  if (blockingDecoration) {
    blockingDecoration.dispose();
    blockingDecoration = null;
  }
  if (blockingState) {
    blockingState.isActive = false;
  }
}
