import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';

export interface EnhancedNotificationOptions {
  message: string;
  type?: 'info' | 'warning' | 'error';
  actions?: string[];
  playSound?: boolean;
  priority?: 'normal' | 'high';
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
