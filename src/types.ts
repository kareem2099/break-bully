// TypeScript type definitions for Break Bully extension

import * as vscode from 'vscode';

export interface BreakStats {
  breaksTaken: number;
  timeSaved: number;
  streakDays: number;
  lastBreakDate: Date | null;
}

export interface ScreenTimeStats {
  sessionStartTime: Date | null;
  totalScreenTimeToday: number; // minutes
  continuousScreenTime: number; // minutes since last break
  lastBreakTime: Date | null;
  lastActivityTime: Date | null;
  isIdle: boolean;
  codingSessionStart: Date | null;
  longCodingSessionDetected: boolean;
}

export interface WellnessGoal {
  id: string;
  type: 'daily' | 'weekly' | 'custom';
  category: 'breaks' | 'exercises' | 'screen-breaks' | 'eye-exercises' | 'custom';
  target: number;
  current: number;
  description: string;
  deadline: Date;
  completed: boolean;
  createdAt: Date;
  reward?: string;
  streak?: number;
  isCustom?: boolean;
  customType?: string; // For custom goals (e.g., "steps", "water", "meditation")
  customUnit?: string; // Unit for custom goals (e.g., "glasses", "minutes", "pages")
}

export interface WellnessChallenge {
  id: string;
  name: string;
  description: string;
  duration: number; // days
  goals: WellnessGoal[];
  startDate: Date;
  endDate: Date;
  completed: boolean;
  progress: number; // percentage
  reward: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  detailedDescription?: string;
  icon: string;
  category: 'streaks' | 'exercises' | 'goals' | 'consistency';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: number;
  unlockedAt?: Date;
  progress?: number;
}

export interface BreakBullyConfiguration {
  enabled: boolean;
  interval: number;
  showNotification: boolean;
  playSound: boolean;
  reminderType: ReminderType;
  annoyanceLevel: AnnoyanceLevel;
  persistentNagging: boolean;
  enableEyeExercises: boolean;
  screenBreakInterval: number; // minutes
  enableGoals: boolean;
  enableAchievements: boolean;
  workRestModel?: string | undefined; // ID of selected work-rest model
  enableGitIntegration: boolean;
  gitCommitThreshold: number;
  gitProductivityCheckInterval: number;
  showExerciseCompletionNotification: boolean;
  playExerciseCompletionSound: boolean;
}

export type ReminderType = 'gentle' | 'motivational' | 'funny' | 'mindful' | 'annoying' | 'hybrid';
export type AnnoyanceLevel = 'mild' | 'moderate' | 'extreme' | 'nuclear';

export interface WorkRestModel {
  id: string;
  name: string;
  description: string;
  workDuration: number; // minutes
  restDuration: number; // minutes
  cycles?: number; // optional number of cycles before longer break
  longRestDuration?: number; // minutes for longer break after cycles
  basedOn: 'pomodoro' | 'who' | 'custom'; // research basis
}

export type ExerciseCategory = 'stretch' | 'breathing' | 'eye' | 'full-body' | 'neck' | 'shoulders' | 'back';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id?: string;
  name: string;
  duration: string;
  instructions: string;
  steps?: string[];
  category?: ExerciseCategory;
  difficulty?: DifficultyLevel;
  createdBy?: 'user' | 'built-in';
  favorite?: boolean;
}

export interface StretchExercise extends Exercise {
  name: string;
  duration: string;
  instructions: string;
}

export interface BreathingExercise extends Exercise {
  name: string;
  duration: string;
  instructions: string;
  steps: string[];
}

export interface EyeExercise extends Exercise {
  type: 'eye';
  screenBreakTrigger?: number; // minutes of screen time before suggesting
  isScreenBreak?: boolean;
}

export interface CustomExercise extends Exercise {
  category: ExerciseCategory;
  difficulty: DifficultyLevel;
  createdBy: 'user' | 'built-in';
  favorite: boolean;
  createdAt: Date;
  usageCount: number;
}

export interface ReminderMessages {
  gentle: string[];
  motivational: string[];
  funny: string[];
  mindful: string[];
  annoying: string[];
  hybrid: string[];
}

export interface TimerData {
  duration: number;
}

export interface StatusUpdateData {
  isEnabled: boolean;
  nextReminder: number | null;
}

export interface WebviewMessage {
  command: string;
  data?: any;
}

export interface BreakBullyActivityBarProvider extends vscode.WebviewViewProvider {
  updateStats(stats: BreakStats): void;
  updateStatus(): void;
  updateScreenTime(): void;
  updateActivityStatus(): void;
  updateWellnessGoals(): void;
  updateWellnessChallenges(): void;
  updateAchievements(): void;
  postMessage(message: WebviewMessage): void;
}

export interface SmartNotificationsData {
  lastBreakResponseTime: number;
  breakAcceptanceRate: number;
  preferredBreakTimes: number[];
  notificationHistory: Array<{timestamp: number, accepted: boolean, context: string}>;
  userPatterns: {
    productiveHours: number[];
    breakFrequency: number;
    responseTimeAverage: number;
  };
}

export interface DailyWellnessData {
  date: string; // YYYY-MM-DD format
  breaksTaken: number;
  screenTimeMinutes: number;
  goalsCompleted: number;
  exercisesCompleted: number;
  achievementsUnlocked: number;
  streakDays: number;
}

export interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
}

declare global {
  const vscode: any;
  const acquireVsCodeApi: () => VSCodeAPI;
}
