import * as vscode from 'vscode';
import { ReminderType } from '../types';
import { reminderMessages } from '../constants/reminderMessages';
import { getConfiguration } from '../core/configuration';
import { state } from '../models/state';

export function getRandomMessage(type: ReminderType): string {
  const messages = reminderMessages[type] || reminderMessages.gentle;
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

export function showSmartReminder(): void {
  const config = getConfiguration();
  const context = analyzeCurrentContext();
  const smartMessage = generateSmartMessage(context);

  // Update notification history
  state.smartNotifications.notificationHistory.push({
    timestamp: Date.now(),
    accepted: false, // Will be updated when user responds
    context: context.activity
  });

  // Keep only last 50 notifications for pattern analysis
  if (state.smartNotifications.notificationHistory.length > 50) {
    state.smartNotifications.notificationHistory = state.smartNotifications.notificationHistory.slice(-50);
  }

  // Determine notification style based on context and patterns
  const notificationStyle = determineNotificationStyle(context);

  if (config.showNotification) {
    showContextualNotification(smartMessage, notificationStyle, context);
  }

  // Update smart patterns
  updateSmartPatterns();

  // Update status bar with context-aware messages
  updateSmartStatusBar(context);
}

function analyzeCurrentContext(): any {
  const now = new Date();
  const currentHour = now.getHours();
  const isProductiveTime = state.smartNotifications.userPatterns.productiveHours.includes(currentHour);

  // Analyze recent activity patterns
  const recentHistory = state.smartNotifications.notificationHistory.slice(-10);
  const recentAcceptanceRate = recentHistory.length > 0 ?
    recentHistory.filter((h: any) => h.accepted).length / recentHistory.length : 0.5;

  // Determine activity context
  let activityContext = 'normal';
  if (state.screenTimeStats.isIdle) {
    activityContext = 'idle';
  } else if (state.screenTimeStats.continuousScreenTime > 90) { // 90 minutes continuous
    activityContext = 'deep-focus';
  } else if (state.screenTimeStats.continuousScreenTime > 45) { // 45 minutes
    activityContext = 'focused';
  }

  // Check if this is a preferred break time
  const isPreferredTime = state.smartNotifications.preferredBreakTimes.some((hour: number) =>
    Math.abs(hour - currentHour) <= 1
  );

  return {
    time: currentHour,
    isProductiveTime,
    activity: activityContext,
    recentAcceptanceRate,
    isPreferredTime,
    sessionDuration: state.screenTimeStats.codingSessionStart ?
      (now.getTime() - state.screenTimeStats.codingSessionStart.getTime()) / (1000 * 60) : 0,
    continuousScreenTime: state.screenTimeStats.continuousScreenTime,
    breakStreak: state.breakStats.streakDays
  };
}

function generateSmartMessage(context: any): string {
  const config = getConfiguration();
  let baseMessageType: ReminderType = config.reminderType;

  // Adjust message type based on context
  if (context.activity === 'deep-focus' && context.recentAcceptanceRate < 0.3) {
    // User is in deep focus and rarely takes breaks - be gentle
    baseMessageType = 'gentle';
  } else if (context.activity === 'idle') {
    // User is idle - be motivational
    baseMessageType = 'motivational';
  } else if (context.isPreferredTime) {
    // This is a time user usually takes breaks - be encouraging
    baseMessageType = 'motivational';
  } else if (context.sessionDuration > 120) { // 2 hours
    // Long session - be mindful
    baseMessageType = 'mindful';
  }

  // Force annoying messages based on annoyance level and context
  if (config.annoyanceLevel === 'extreme' || config.annoyanceLevel === 'nuclear') {
    baseMessageType = 'annoying';
  } else if (config.annoyanceLevel === 'moderate' && state.annoyanceLevel > 2) {
    baseMessageType = 'annoying';
  }

  let message = getRandomMessage(baseMessageType);

  // Add context-specific personalization
  if (context.breakStreak > 3) {
    message += ` You're on a ${context.breakStreak} day streak! 🔥`;
  } else if (context.continuousScreenTime > 60) {
    message += ` You've been at it for ${Math.floor(context.continuousScreenTime)} minutes.`;
  } else if (context.isPreferredTime) {
    message += ` This is usually a good time for you to take a break!`;
  }

  return message;
}

function determineNotificationStyle(context: any): any {
  const config = getConfiguration();

  // Base notification style
  let style = {
    urgency: 'normal',
    buttons: ['Take 5 minutes', 'Snooze for 10 min', 'Settings'],
    showMultiple: false,
    followUpDelay: 0
  };

  // Adjust based on context and patterns
  if (context.activity === 'deep-focus') {
    // Be less intrusive during deep focus
    style.urgency = 'gentle';
    style.buttons = ['Quick Break (2 min)', 'Snooze for 15 min', 'Settings'];
  } else if (context.activity === 'idle') {
    // User is idle - more encouraging
    style.urgency = 'motivational';
    style.buttons = ['Take 5 minutes', 'Take 10 minutes', 'Settings'];
  } else if (context.recentAcceptanceRate < 0.2) {
    // User rarely takes breaks - be more persistent but not annoying
    style.urgency = 'persistent';
    style.followUpDelay = 30000; // 30 seconds
  }

  // Override with annoyance level settings
  if (config.annoyanceLevel === 'extreme') {
    style.urgency = 'annoying';
    style.buttons = ['FINE! I\'LL TAKE A BREAK!', 'Just 2 more minutes...', 'Make it stop!'];
    style.followUpDelay = 5000;
  } else if (config.annoyanceLevel === 'nuclear') {
    style.urgency = 'urgent';
    style.buttons = ['OKAY OKAY I\'LL REST!', 'Settings'];
    style.showMultiple = true;
  }

  return style;
}

function showContextualNotification(message: string, style: any, context: any): void {
  const showNotification = (msg: string, buttons: string[]) => {
    if (style.showMultiple && style.urgency === 'urgent') {
      // Show multiple urgent notifications
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          vscode.window.showWarningMessage(`🚨 URGENT BREAK ALERT ${i + 1}/3: ${msg}`, ...buttons)
            .then(selection => handleNotificationResponse(selection, context));
        }, i * 500);
      }
    } else if (style.urgency === 'annoying') {
      vscode.window.showWarningMessage(msg, ...buttons)
        .then(selection => handleNotificationResponse(selection, context));

      // Follow-up if configured
      if (style.followUpDelay > 0) {
        setTimeout(() => {
          vscode.window.showWarningMessage('Still waiting for you to take that break... 😤', ...buttons)
            .then(selection => handleNotificationResponse(selection, context));
        }, style.followUpDelay);
      }
    } else {
      // Normal notification
      vscode.window.showInformationMessage(msg, ...buttons)
        .then(selection => handleNotificationResponse(selection, context));
    }
  };

  showNotification(message, style.buttons);
}

function handleNotificationResponse(selection: string | undefined, context: any): void {
  const config = getConfiguration();
  const notificationEntry = state.smartNotifications.notificationHistory[state.smartNotifications.notificationHistory.length - 1];

  if (selection && (selection.includes('BREAK') || selection.includes('REST') || selection.includes('Take'))) {
    // User accepted the break
    notificationEntry.accepted = true;
    state.smartNotifications.breakAcceptanceRate = Math.max(0.1,
      (state.smartNotifications.breakAcceptanceRate * 0.9) + 0.1); // Weighted average

    // Update preferred break times
    updatePreferredBreakTimes(context.time);

    vscode.window.showInformationMessage('FINALLY! Enjoy your well-deserved break! 🎉');
    stopAnnoyanceMode();
    pauseReminders(5);
  } else if (selection && selection.includes('Snooze')) {
    // User snoozed
    notificationEntry.accepted = false;
    state.annoyanceLevel++;

    if (config.annoyanceLevel === 'nuclear') {
      vscode.window.showErrorMessage('NO MORE SNOOZING! BREAK TIME IS NOW! 🔥');
      startAnnoyanceMode();
    } else {
      const snoozeMinutes = selection.includes('15') ? 15 : 10;
      pauseReminders(snoozeMinutes);
      vscode.window.showInformationMessage(`Snoozed... but I'm watching you 👁️`);
    }
  } else if (selection && selection.includes('Settings')) {
    vscode.commands.executeCommand('breakBully.openSettings');
  }

  // Update response time tracking
  state.smartNotifications.lastBreakResponseTime = Date.now();
}

function updatePreferredBreakTimes(hour: number): void {
  // Add this hour to preferred times if not already there
  if (!state.smartNotifications.preferredBreakTimes.includes(hour)) {
    state.smartNotifications.preferredBreakTimes.push(hour);

    // Keep only top 5 preferred times
    if (state.smartNotifications.preferredBreakTimes.length > 5) {
      state.smartNotifications.preferredBreakTimes = state.smartNotifications.preferredBreakTimes.slice(-5);
    }
  }
}

function updateSmartPatterns(): void {
  const now = new Date();
  const currentHour = now.getHours();

  // Update productive hours based on activity patterns
  if (state.screenTimeStats.continuousScreenTime > 30) { // Active coding session
    if (!state.smartNotifications.userPatterns.productiveHours.includes(currentHour)) {
      state.smartNotifications.userPatterns.productiveHours.push(currentHour);
    }
  }

  // Update break frequency based on recent history
  const recentBreaks = state.smartNotifications.notificationHistory
    .filter((h: any) => h.accepted)
    .slice(-10);

  if (recentBreaks.length >= 2) {
    const timeDiffs = [];
    for (let i = 1; i < recentBreaks.length; i++) {
      timeDiffs.push(recentBreaks[i].timestamp - recentBreaks[i-1].timestamp);
    }

    if (timeDiffs.length > 0) {
      const avgInterval = timeDiffs.reduce((a: number, b: number) => a + b, 0) / timeDiffs.length;
      state.smartNotifications.userPatterns.breakFrequency = Math.max(15, Math.min(60, avgInterval / (1000 * 60))); // 15-60 minutes
    }
  }

  // Update response time average
  const recentResponses = state.smartNotifications.notificationHistory.slice(-5);
  if (recentResponses.length > 0) {
    const avgResponseTime = recentResponses.reduce((sum: number, h: any) => {
      return sum + (h.timestamp - (h.timestamp - 30000)); // Simplified
    }, 0) / recentResponses.length;

    state.smartNotifications.userPatterns.responseTimeAverage =
      (state.smartNotifications.userPatterns.responseTimeAverage * 0.8) + (avgResponseTime * 0.2);
  }
}

function updateSmartStatusBar(context: any): void {
  const config = getConfiguration();

  if (config.enabled) {
    let statusText = `$(megaphone) Bully: ${config.interval}min`;

    // Context-aware status messages
    if (context.activity === 'deep-focus') {
      statusText = `🎯 Deep Focus: ${config.interval}min`;
    } else if (context.activity === 'idle') {
      statusText = `😴 Idle: ${config.interval}min`;
    } else if (context.breakStreak > 0) {
      statusText = `🔥 Streak ${context.breakStreak}: ${config.interval}min`;
    } else if (context.isPreferredTime) {
      statusText = `⏰ Good Time: ${config.interval}min`;
    }

    // Annoyance level overrides
    if (config.annoyanceLevel === 'extreme') {
      statusText = `🚨 Angry Bully: ${config.interval}min 🚨`;
    } else if (config.annoyanceLevel === 'nuclear') {
      statusText = `💥 BULLY MODE: ${config.interval}min 💥`;
    } else if (state.annoyanceLevel > 0) {
      statusText = `⚠️ Persistent Bully: ${config.interval}min ⚠️`;
    }

    if (state.statusBarItem) {
      state.statusBarItem.text = statusText;
      state.statusBarItem.show();
    }
  } else {
    if (state.statusBarItem) {
      state.statusBarItem.text = `$(megaphone) Bully: OFF`;
      state.statusBarItem.show();
    }
  }
}

// Import annoyance service functions
import { startAnnoyanceMode, stopAnnoyanceMode } from './annoyanceService';
import { pauseReminders } from './annoyanceService';

// Replace the old function call
export function showRandomReminder(): void {
  showSmartReminder();
}

export function startReminderSystem(): void {
  const config = getConfiguration();

  if (!config.enabled) {
    if (state.statusBarItem) {
      state.statusBarItem.hide();
    }
    state.nextReminderTime = null;
    return;
  }

  if (state.statusBarItem) {
    state.statusBarItem.show();
  }
  updateStatusBar();

  if (state.reminderTimer) {
    clearInterval(state.reminderTimer);
  }

  // Set the next reminder time
  state.nextReminderTime = Date.now() + config.interval * 60 * 1000;

  state.reminderTimer = setInterval(() => {
    showRandomReminder();
    // Update next reminder time after showing reminder
    state.nextReminderTime = Date.now() + config.interval * 60 * 1000;
  }, config.interval * 60 * 1000);
}

export function restartReminderSystem(): void {
  if (state.reminderTimer) {
    clearInterval(state.reminderTimer);
  }
  startReminderSystem();
}

function updateStatusBar(): void {
  const config = getConfiguration();
  if (config.enabled) {
    let statusText = `$(megaphone) Bully: ${config.interval}min`;

    // Make status bar annoying too
    if (config.annoyanceLevel === 'extreme') {
      statusText = `🚨 BULLY ALERT: ${config.interval}min 🚨`;
    } else if (config.annoyanceLevel === 'nuclear') {
      statusText = `💥 BULLY MODE: ${config.interval}min 💥`;
    } else if (state.annoyanceLevel > 0) {
      statusText = `⚠️ Angry Bully: ${config.interval}min ⚠️`;
    }

    if (state.statusBarItem) {
      state.statusBarItem.text = statusText;
      state.statusBarItem.show();
    }
  } else {
    if (state.statusBarItem) {
      state.statusBarItem.text = `$(megaphone) Bully: OFF`;
      state.statusBarItem.show();
    }
  }
}

export function toggleReminders(): void {
  const config = vscode.workspace.getConfiguration('breakBully');
  const currentlyEnabled = config.get('enabled', true);

  config.update('enabled', !currentlyEnabled, vscode.ConfigurationTarget.Global).then(() => {
    const status = !currentlyEnabled ? 'unleashed' : 'tamed';
    vscode.window.showInformationMessage(`Break Bully has been ${status}!`);
    restartReminderSystem();
  });
}
