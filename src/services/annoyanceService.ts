import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';
import { state } from '../models/state';

export function startAnnoyanceMode(): void {
  const config = getConfiguration();
  stopAnnoyanceMode();

  if (config.annoyanceLevel === 'mild') return;

  let nagInterval = 30000; // 30 seconds
  if (config.annoyanceLevel === 'extreme') nagInterval = 15000; // 15 seconds
  if (config.annoyanceLevel === 'nuclear') nagInterval = 10000; // 10 seconds

  state.annoyanceTimer = setInterval(() => {
    const annoyingMessages: string[] = [
      '⏰ STILL WORKING?! BREAK TIME!',
      '🚨 This is not optional!',
      '😤 I\'m getting impatient...',
      '🔥 Your health > your code!',
      '⚠️ FINAL WARNING!'
    ];

    const randomMessage = annoyingMessages[Math.floor(Math.random() * annoyingMessages.length)];

    if (config.annoyanceLevel === 'nuclear') {
      vscode.window.showErrorMessage(randomMessage, 'OKAY I\'LL BREAK!').then(selection => {
        if (selection) {
          stopAnnoyanceMode();
          pauseReminders(5);
          vscode.window.showInformationMessage('Thank you for listening to reason! 😌');
        }
      });
    } else {
      vscode.window.showWarningMessage(randomMessage);
    }

    // Flash the status bar
    if (state.statusBarItem) {
      state.statusBarItem.text = `🚨 BREAK NOW! 🚨`;
      setTimeout(() => updateStatusBar(), 2000);
    }

  }, nagInterval);
}

export function stopAnnoyanceMode(): void {
  if (state.annoyanceTimer) {
    clearInterval(state.annoyanceTimer);
    state.annoyanceTimer = undefined;
  }
  state.annoyanceLevel = 0;
}

export function pauseReminders(minutes: number): void {
  import('./reminderService').then(reminderService => {
    if (state.reminderTimer) {
      clearInterval(state.reminderTimer);
    }

    stopAnnoyanceMode();

    // Set next reminder time to when reminders will resume
    state.nextReminderTime = Date.now() + minutes * 60 * 1000;

    setTimeout(() => {
      reminderService.startReminderSystem();
    }, minutes * 60 * 1000);
  });
}

function updateStatusBar(): void {
  import('./reminderService').then(reminderService => {
    // Call the updateStatusBar function from reminderService
    // This is a bit of a hack, but avoids circular imports
    reminderService.restartReminderSystem();
  });
}
