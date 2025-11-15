// Security utilities

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function validateWebviewMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;

  const msg = message as Record<string, unknown>;

  if (!msg.command || typeof msg.command !== 'string') return false;

  const allowedCommands = [
    'takeBreak', 'openSettings', 'showStretch', 'breathingExercise',
    'showEyeExercise', 'showAnalytics', 'requestInitialData',
    'requestTimerStatus', 'onboardingCompleted', 'timerStarted',
    'exerciseComplete', 'closePanel'
  ];

  return allowedCommands.includes(msg.command);
}
