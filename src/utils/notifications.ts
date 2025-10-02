import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';

export interface EnhancedNotificationOptions {
  message: string;
  type?: 'info' | 'warning' | 'error';
  actions?: string[];
  playSound?: boolean;
  priority?: 'normal' | 'high';
}

export interface ActivityNotificationOptions extends EnhancedNotificationOptions {
  activityType: 'state_change' | 'milestone' | 'flow_state' | 'break_suggestion' | 'productivity_report';
  activityData?: {
    fromState?: string;
    toState?: string;
    duration?: number;
    score?: number;
    flowTime?: number;
  };
}

/**
 * Shows an enhanced notification with sound and visual improvements
 */
export function showEnhancedNotification(options: EnhancedNotificationOptions): Thenable<string | undefined> {
  const config = getConfiguration();
  const { message, type = 'info', actions = [], playSound, priority = 'normal' } = options;

  // Determine if sound should be played
  const shouldPlaySound = playSound !== undefined ? playSound : config.playExerciseCompletionSound;

  // Play sound if enabled
  if (shouldPlaySound && config.playExerciseCompletionSound) {
    playCompletionSound();
  }

  // Choose notification method based on type and priority
  let notificationPromise: Thenable<string | undefined>;

  if (type === 'error' || (type === 'warning' && priority === 'high')) {
    notificationPromise = vscode.window.showErrorMessage(message, ...actions);
  } else if (type === 'warning') {
    notificationPromise = vscode.window.showWarningMessage(message, ...actions);
  } else {
    notificationPromise = vscode.window.showInformationMessage(message, ...actions);
  }

  return notificationPromise;
}

/**
 * Shows a celebratory completion notification for exercises
 */
export function showExerciseCompletionNotification(exerciseName: string, exerciseType: string): Thenable<string | undefined> {
  const config = getConfiguration();

  if (!config.showExerciseCompletionNotification) {
    return Promise.resolve(undefined);
  }

  const messages = {
    stretch: [
      `🏃‍♂️ Stretch Complete! Your muscles are thanking you!`,
      `🤸‍♀️ Amazing stretch session! Feel the flexibility!`,
      `💪 Stretch finished! Your body is rejuvenated!`,
      `🧘‍♂️ Stretch complete! Tension released, energy restored!`
    ],
    breathing: [
      `🫁 Breathing exercise complete! Mindful breaths for clarity!`,
      `🌬️ Deep breathing finished! Stress reduced, focus improved!`,
      `🧘‍♀️ Breathing session complete! Calm and centered!`,
      `💨 4-7-8 breathing done! Anxiety lowered, relaxation achieved!`
    ],
    eye: [
      `👁️ Eye exercise complete! Vision refreshed!`,
      `🔍 20-20-20 rule followed! Eyes feel better!`,
      `👀 Eye break finished! Screen strain reduced!`,
      `🌟 Eye exercise done! Visual comfort restored!`
    ],
    water: [
      `💧 Hydration complete! Your brain is powered up!`,
      `🚰 Water break finished! Dehydration defeated!`,
      `🌊 Hydration goal met! Cognitive function boosted!`,
      `💦 Water session done! Energy levels replenished!`
    ],
    default: [
      `🎉 Exercise complete! Great job staying healthy!`,
      `🏆 Well done! Exercise finished successfully!`,
      `⭐ Achievement unlocked! Exercise completed!`,
      `🎯 Mission accomplished! Exercise done!`
    ]
  };

  const exerciseMessages = messages[exerciseType as keyof typeof messages] || messages.default;
  const randomMessage = exerciseMessages[Math.floor(Math.random() * exerciseMessages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'info',
    actions: ['Take Another Break', 'Continue Working'],
    playSound: true,
    priority: 'high'
  });
}

/**
 * Shows progress notification during exercise
 */
export function showExerciseProgressNotification(exerciseName: string, progress: number): void {
  const config = getConfiguration();

  if (!config.showExerciseCompletionNotification) {
    return;
  }

  if (progress === 50) {
    vscode.window.showInformationMessage(`🔄 ${exerciseName}: Halfway there! Keep going!`, 'Continue');
  } else if (progress === 75) {
    vscode.window.showInformationMessage(`🚀 ${exerciseName}: Almost done! You're doing great!`, 'Continue');
  }
}

/**
 * Plays a system sound for exercise completion
 * Note: VS Code doesn't support custom sounds, so we use system beep
 */
function playCompletionSound(): void {
  try {
    // Use system beep - this is the only sound VS Code extensions can play
    process.stdout.write('\x07'); // ASCII bell character
  } catch (error) {
    // Silently fail if beep doesn't work on this system
    console.debug('Could not play completion sound:', error);
  }
}

/**
 * Shows a motivational notification for starting an exercise
 */
export function showExerciseStartNotification(exerciseName: string, duration: string): void {
  const config = getConfiguration();

  if (!config.showExerciseCompletionNotification) {
    return;
  }

  const messages = [
    `⏰ ${exerciseName} started! ${duration} of wellness ahead!`,
    `🎯 ${exerciseName} beginning! Let's make this count!`,
    `💫 ${exerciseName} in progress! Your well-being matters!`,
    `🌟 ${exerciseName} timer active! Time for self-care!`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  vscode.window.showInformationMessage(randomMessage);
}

/**
 * Activity-specific notification functions
 */

/**
 * Shows a notification when the user enters flow state
 */
export function showFlowStateNotification(flowDuration: number): Thenable<string | undefined> {
  const config = getConfiguration();
  const showActivityNotifications = (config as any).showActivityNotifications ?? true;

  if (!showActivityNotifications) return Promise.resolve(undefined);

  const messages = [
    `🎯 You're in the zone! Flow state detected - keep the momentum going!`,
    `🚀 Peak productivity achieved! You're in flow - this is your power hour!`,
    `⚡ Deep focus activated! Flow state at ${Math.round(flowDuration)} minutes!`,
    `💫 Creative flow engaged! You're doing amazing work!`,
    `🎨 Flow state unlocked! Your best ideas are flowing!`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'info',
    actions: ['Stay Focused', 'Celebrate Moment'],
    playSound: true,
    priority: 'normal'
  });
}

/**
 * Shows a notification when activity state changes
 */
export function showActivityStateChangeNotification(fromState: string, toState: string): Thenable<string | undefined> {
  const config = getConfiguration();
  const showActivityNotifications = (config as any).showActivityNotifications ?? true;

  if (!showActivityNotifications) return Promise.resolve(undefined);

  const stateMessages = {
    'idle→coding': [
      `🔄 Back to work! Code mode activated!`,
      `💻 Coding session resumed! Let's build something amazing!`,
      `🎯 Focus regained! Back to creating!`
    ],
    'reading→coding': [
      `💻 From reading to writing! Code production started!`,
      `📝 Research complete! Now executing ideas!`,
      `🎨 Implementation phase! Turning concepts into code!`
    ],
    'coding→debugging': [
      `🐛 Debug mode engaged! Let's solve this puzzle!`,
      `🔍 Problem-solving activated! Debugging in progress!`,
      `🛠️ Troubleshooting mode! Finding that sneaky bug!`
    ],
    'debugging→coding': [
      `✅ Bug squashed! Back to smooth coding!`,
      `🎉 Problem solved! Productive coding resumed!`,
      `🚀 Debugging complete! Full speed ahead!`
    ],
    'coding→idle': [
      `⏯️ Coding paused. Take a moment to recharge!`,
      `🧘‍♂️ Step away from the code! Mind needs a break!`,
      `💤 Coding session paused. Fresh perspective will help!`
    ]
  };

  const key = `${fromState}→${toState}` as keyof typeof stateMessages;
  const messages = stateMessages[key]?.length > 0 ? stateMessages[key] : [
    `🔄 Activity shifted from ${fromState} to ${toState}!`,
    `⚡ New focus area: ${toState}!`,
    `🎭 Mode change: Now in ${toState}!`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'info',
    actions: ['Acknowledged'],
    playSound: false,
    priority: 'normal'
  });
}

/**
 * Shows productivity milestone celebration
 */
export function showProductivityMilestoneNotification(milestone: string, score: number): Thenable<string | undefined> {
  const config = getConfiguration();
  const showActivityNotifications = (config as any).showActivityNotifications ?? true;

  if (!showActivityNotifications) return Promise.resolve(undefined);

  const milestoneMessages = {
    'high_productivity': [
      `🚀 Productivity rocket launched! Score: ${score.toFixed(1)}/10!`,
      `💫 Exceptional performance! Activity score: ${score.toFixed(1)}!`,
      `🎯 Peak productivity achieved! You're crushing it!`,
      `⚡ Super productive session! Score: ${score.toFixed(1)}!`
    ],
    'extended_focus': [
      `⏱️ Long focus session completed! Great concentration!`,
      `🌟 Extended productivity streak! Mind and body in sync!`,
      `🏆 Sustained focus achieved! This is what excellence looks like!`
    ],
    'flow_maintained': [
      `🎨 Flow state sustained! Creative productivity at peak!`,
      `👑 Flow master! Keeping that momentum going!`,
      `🌊 Deep in flow! This is your superpower activated!`
    ]
  };

  const messages = milestoneMessages[milestone as keyof typeof milestoneMessages] || [
    `🎉 Productivity milestone reached!`,
    `🏆 Great work! Milestone achieved!`,
    `⭐ Productivity achievement unlocked!`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'info',
    actions: ['Keep Going', 'Celebrate'],
    playSound: true,
    priority: 'high'
  });
}

/**
 * Shows break timing suggestion based on activity level
 */
export function showBreakTimingSuggestion(reason: string, recommendedBreak: number): Thenable<string | undefined> {
  const config = getConfiguration();
  const showActivityNotifications = (config as any).showActivityNotifications ?? true;

  if (!showActivityNotifications) return Promise.resolve(undefined);

  const reasonMessages = {
    'high_activity': [
      `🔥 High activity detected! ${recommendedBreak}min break recommended to sustain productivity!`,
      `⚡ Intense coding session! Take a ${recommendedBreak}min break to keep the flow going!`,
      `💻 Deep focus maintained! ${recommendedBreak}min recharge break will amplify your efficiency!`
    ],
    'extended_session': [
      `⏰ Long session detected! ${recommendedBreak}min break before continuing!`,
      `🌅 Time for renewal! ${recommendedBreak}min break to maintain peak performance!`,
      `🔄 Reset time! ${recommendedBreak}min break to keep productivity high!`
    ],
    'burnout_risk': [
      `⚠️ Burnout risk detected! ${recommendedBreak}min rest break essential!`,
      `🛑 Health priority! ${recommendedBreak}min break to prevent fatigue!`,
      `❤️ Self-care alert! ${recommendedBreak}min break for long-term productivity!`
    ]
  };

  const messages = reasonMessages[reason as keyof typeof reasonMessages] || [
    `🔔 Break time! ${recommendedBreak}min suggested for optimal performance!`,
    `🎯 Perfect timing! ${recommendedBreak}min break will boost your productivity!`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'warning',
    actions: ['Take Break Now', '5 Min More', 'Ignore'],
    playSound: true,
    priority: 'high'
  });
}

/**
 * Shows hourly productivity summary
 */
export function showHourlyProductivityReport(hour: number, productivity: number, trend: 'up' | 'down' | 'stable'): Thenable<string | undefined> {
  const config = getConfiguration();
  const showActivityNotifications = (config as any).showActivityNotifications ?? false; // Default off for hourly reports

  if (!showActivityNotifications) return Promise.resolve(undefined);

  const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊';
  const productEmoji = productivity > 7 ? '🚀' : productivity > 4 ? '💪' : '🔄';

  const messages = [
    `${trendEmoji}${productEmoji} Hour ${hour}:00-${hour+1}:00 summary - Productivity ${productivity.toFixed(1)}/10`,
    `${trendEmoji} Productivity at ${productivity.toFixed(1)}/10 this hour ${productEmoji}`,
    `${productEmoji} ${hour}:00-${hour+1}:00 productivity rating: ${productivity.toFixed(1)}/10 ${trendEmoji}`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return showEnhancedNotification({
    message: randomMessage,
    type: 'info',
    actions: ['View Details'],
    playSound: false,
    priority: 'normal'
  });
}

/**
 * Main function to show activity notifications based on type
 */
export function showActivityNotification(options: ActivityNotificationOptions): Thenable<string | undefined> {
  const { activityType, activityData = {} } = options;

  switch (activityType) {
    case 'state_change':
      return showActivityStateChangeNotification(activityData.fromState || '', activityData.toState || '');

    case 'flow_state':
      return showFlowStateNotification(activityData.flowTime || 0);

    case 'break_suggestion':
      return showBreakTimingSuggestion('high_activity', activityData.duration || 5);

    case 'productivity_report':
      // This would be called with specific hour/productivity data
      return showHourlyProductivityReport(new Date().getHours(), activityData.score || 5, 'stable');

    default:
      return showEnhancedNotification(options);
  }
}
