import * as vscode from 'vscode';
import { DotSenseConfiguration } from '../types';

export function getConfiguration(): DotSenseConfiguration {
  const config = vscode.workspace.getConfiguration('dotsense');
  return {
    enabled: config.get('enabled', true),
    interval: config.get('interval', 30),
    showNotification: config.get('showNotification', true),
    playSound: config.get('playSound', false),
    reminderType: config.get('reminderType', 'gentle'),
    annoyanceLevel: config.get('annoyanceLevel', 'moderate'),
    persistentNagging: config.get('persistentNagging', false),
    enableEyeExercises: config.get('enableEyeExercises', true),
    screenBreakInterval: config.get('screenBreakInterval', 45),
    enableGoals: config.get('enableGoals', true),
    enableAchievements: config.get('enableAchievements', true),
    enableWellnessExercises: config.get('enableWellnessExercises', true),
    workRestModel: config.get('workRestModel') as string | undefined,
    enableGitIntegration: config.get('enableGitIntegration', true),
    gitCommitThreshold: config.get('gitCommitThreshold', 3),
    gitProductivityCheckInterval: config.get('gitProductivityCheckInterval', 15),
    showExerciseCompletionNotification: config.get('showExerciseCompletionNotification', true),
    playExerciseCompletionSound: config.get('playExerciseCompletionSound', true),
    showActivityNotifications: config.get('showActivityNotifications', true),
    // CodeTune Integration
    suggestCodeTuneDuringBreaks: config.get('suggestCodeTuneDuringBreaks', true),
    codeTunePermanentlyIgnored: config.get('codeTunePermanentlyIgnored', false)
  };
}
