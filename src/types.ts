// TypeScript type definitions for DotSense extension

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

export interface DotSenseConfiguration {
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
  enableWellnessExercises: boolean;
  workRestModel?: string | undefined; // ID of selected work-rest model
  enableGitIntegration: boolean;
  gitCommitThreshold: number;
  gitProductivityCheckInterval: number;
  showExerciseCompletionNotification: boolean;
  playExerciseCompletionSound: boolean;
  showActivityNotifications: boolean;
  // CodeTune Integration
  suggestCodeTuneDuringBreaks: boolean;
  codeTunePermanentlyIgnored: boolean;
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

// Advanced Scheduling Types
export type SchedulingModelType =
  'basic' | 'time-blocking' | 'eisenhower' | 'ultradian' | 'energy-based' |
  'task-load-balancing' | 'adaptive' | 'deadline-driven' | 'custom';

export type EisenhowerPriority = 'urgent-important' | 'urgent-not-important' | 'not-urgent-important' | 'not-urgent-not-important';
export type EnergyLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'very-complex';
export type CircadianRhythmType = 'morning-person' | 'evening-person' | 'steady-performer' | 'undefined';

// Enhanced Work-Rest Model with Advanced Features
export interface AdvancedWorkRestModel extends WorkRestModel {
  type: SchedulingModelType;
  advancedConfig?: {
    // Time Blocking Configuration
    timeBlocks?: TimeBlock[];

    // Eisenhower Matrix Configuration
    eisenhowerConfig?: {
      enabled: boolean;
      taskQueue: EisenhowerTask[];
      autoScheduling: boolean;
    };

    // Energy-based Configuration
    energyProfile?: EnergyProfile;

    // Adaptive Learning Configuration
    adaptationRules?: AdaptationRule[];

    // Deadline-driven Configuration
    deadlineConfig?: {
      enabled: boolean;
      priorityWeight: number; // 0-1
      timePressureThreshold: number; // hours before deadline
    };
  };
}

// Time Blocking Types
export interface TimeBlock {
  id: string;
  name: string;
  startTime: number; // minutes since midnight
  duration: number; // minutes
  type: 'deep-work' | 'meetings' | 'admin' | 'breaks' | 'flexible';
  priority: number; // 1-10
  recurring: boolean;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
}

// Eisenhower Matrix Types
export interface EisenhowerTask {
  id: string;
  name: string;
  description?: string;
  priority: EisenhowerPriority;
  estimatedDuration: number;
  deadline?: Date;
  completed: boolean;
  energyRequired: EnergyLevel;
  scheduledTime?: Date;
  actualDuration?: number;
}

// Energy Tracking Types
export interface EnergyProfile {
  userType: CircadianRhythmType;
  hourlyEnergy: { [hour: number]: number }; // 0-23 hours, energy level 1-10
  peakHours: number[];
  lowEnergyHours: number[];
  weeklyPattern: { [day: number]: number }; // 0-6, energy multiplier
  learned: boolean;
}

export interface EnergyReading {
  timestamp: Date;
  hour: number;
  energyLevel: number; // 1-10
  activityType: string;
  completionRate: number; // 0-1
}

// Adaptive Scheduling Types
export interface AdaptationRule {
  condition: {
    timeOfDay?: { start: number; end: number };
    energyLevel?: EnergyLevel;
    taskComplexity?: TaskComplexity;
    dayOfWeek?: number[];
  };
  adjustment: {
    workDurationMultiplier: number;
    breakDurationMultiplier: number;
    priorityBoost: number;
  };
  confidence: number; // 0-1, based on success rate
  usageCount: number;
}

// Task Load Balancing Types
export interface TaskSchedule {
  id: string;
  name: string;
  estimatedDuration: number;
  complexity: TaskComplexity;
  energyRequired: EnergyLevel;
  priority: EisenhowerPriority;
  deadline?: Date;
  scheduledTime?: Date;
  actualDuration?: number;
  completed: boolean;
  satisfaction?: number; // user rating 1-5
}

// Scheduling Intelligence Types
export interface SchedulingIntelligence {
  userRhythm: CircadianRhythm;
  energyPatterns: EnergyPattern[];
  productivityZones: TimePreference[];
  taskAffinity: TaskPattern[];
  calendarSync?: CalendarSyncConfig;
}

// Learning and Analytics Types
export interface CircadianRhythm {
  peakPerformances: { hour: number; score: number }[];
  energyDips: { hour: number; score: number }[];
  weeklyPatterns: { [day: number]: { [hour: number]: number } };
  confidence: number;
  lastUpdated: Date;
}

export interface EnergyPattern {
  timeSlot: { start: number; end: number };
  averageEnergy: number;
  taskCompletionRate: number;
  preferredActivities: string[];
  avoidedActivities: string[];
}

export interface TimePreference {
  startHour: number;
  endHour: number;
  preferenceScore: number; // -1 to 1
  supportedByData: boolean;
}

export interface TaskPattern {
  taskType: string;
  optimalTime: number; // hour of day
  successRate: number;
  recommendedDuration: number;
  energyCost: EnergyLevel;
}

// Calendar Integration (Future Feature)
export interface CalendarSyncConfig {
  enabled: boolean;
  provider: 'google' | 'outlook' | 'ical';
  syncFrequency: number; // minutes
  lastSync: Date;
  autoAvoidMeetings: boolean;
}

// Data Collective Types for Privacy-Preserving ML
export interface DataSharingPreferences {
  statisticalAggregation: boolean;
  scheduleTemplates: boolean;
  mlTrainingParticipation: boolean;
  energyPatterns: boolean;
  usageAnalytics: boolean;
  geographicRegion: boolean; // for time zone normalization
  publicContributions: boolean; // contribute to open dataset
}

export interface SecureContribution {
  id: string;
  type: 'energy-patterns' | 'schedule-templates' | 'task-performance' | 'learning-updates';
  timestamp: Date;
  verificationHash: string;
  proof: string; // ZKP proof
  encryptedData: string;
  metadata: {
    dataPoints: number;
    validityScore: number;
    privacyLevel: 'high' | 'medium' | 'low';
  };
}

export interface FederatedModelUpdate {
  modelVersion: string;
  updateType: 'weights' | 'parameters';
  encryptedUpdate: string;
  verificationProof: string;
  confidenceScore: number;
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
  data?: unknown;
}

export interface DotSenseActivityBarProvider extends vscode.WebviewViewProvider {
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

export interface WellnessTrends {
  goalCompletionTrend: string;
  achievementUnlockTrend: string;
  breakConsistency: string;
  screenTimeTrend?: string;
  overallProgress?: string;
}

export interface CurrentDayStats {
  breaksTaken: number;
  screenTimeMinutes: number;
  goalsCompleted: number;
  exercisesCompleted: number;
  streakDays: number;
}

export interface WellnessInsights {
  timeRange: 'today' | 'week' | 'month' | 'all';
  startDate: Date;
  endDate: Date;
  dailyBreakdown: DailyWellnessData[];
  totalBreaks: number;
  averageBreaksPerDay: number;
  longestStreak: number;
  totalGoalsCompleted: number;
  goalCompletionRate: number;
  totalExercises: number;
  averageExercisesPerDay: number;
  totalScreenTimeMinutes: number;
  averageScreenTimePerDay: number;
  totalAchievementsUnlocked: number;
  achievementsPerDay: number;
  trends: WellnessTrends;
  overallTrends: WellnessTrends;
  overallAverageBreaksPerDay: number;
  overallGoalCompletionRate: number;
  averageScreenTime: number;
  currentDay: CurrentDayStats;
  recommendations: string[];
  basicRecommendations: string[];
}

export interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
}

declare global {
  const vscode: unknown;
  const acquireVsCodeApi: () => VSCodeAPI;
}
