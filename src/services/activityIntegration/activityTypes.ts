import * as vscode from 'vscode';

export enum ActivityIntegrationLevel {
  NONE = 'none',
  BASIC = 'basic',
  SMART = 'smart',
  ADVANCED = 'advanced'
}

export enum ActivityType {
  FILE_EDIT = 'file_edit',
  FILE_SAVE = 'file_save',
  FILE_OPEN = 'file_open',
  GIT_COMMIT = 'git_commit',
  TYPING_BURST = 'typing_burst',
  DEBUG_SESSION = 'debug_session',
  TEST_RUN = 'test_run',
  SEARCH_OPERATION = 'search_operation',
  REFACTOR_OPERATION = 'refactor_operation',
  BREAK_TAKEN = 'break_taken'
}

export enum ActivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  FLOW = 'flow'
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  timestamp: number;
  duration?: number;
  intensity: number; // 1-10 scale
  context: ActivityContext;
}

export interface ActivityContext {
  fileType?: string;
  linesChanged?: number;
  commitSize?: number;
  commitHash?: string;
  commitMessage?: string;
  debugDuration?: number;
  debugType?: string;
  debugConfiguration?: string;
  debugResult?: string;
  testResults?: {
    passed: number;
    failed: number;
    total: number;
  };
  testType?: string;
  testSuccess?: boolean;
  searchQuery?: string;
  refactorScope?: string;
  refactorType?: string;
  breakType?: string;
  activityState?: string;
  exerciseType?: string; // For wellness activities: 'stretch' | 'breathing' | 'eye' | 'water'

  // Enhanced typing pattern analysis
  typingMetrics?: AdvancedTypingMetrics;
  focusQuality?: FocusQualityMetrics;
  contextSwitch?: ContextSwitchMetrics;
  moodAnalysis?: MoodAnalysis;
}

export interface ActivityMetrics {
  currentScore: number;
  averageScore: number;
  peakScore: number;
  activityLevel: ActivityLevel;
  timeInFlow: number; // minutes
  totalEvents: number;
  totalActiveSeconds: number; // total active seconds in session
  eventsByType: Record<ActivityType, number>;
}

export interface FlowStateInfo {
  isInFlow: boolean;
  confidence: number; // 0-1
  duration: number; // minutes
  startTime: number;
  endTime?: number;
  triggers: string[];
}

export interface ProductivityInsights {
  peakPerformanceHours: number[];
  optimalBreakSchedule: {
    workDuration: number;
    breakDuration: number;
    frequency: number;
  };
  productivityTrends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  recommendations: string[];
  effectiveness: {
    breakType: string;
    effectiveness: number; // 0-1
  }[];
}

export interface ActivitySettings {
  integrationLevel: ActivityIntegrationLevel;
  flowThreshold: number; // 1-10
  activityWeights: Record<ActivityType, number>;
  smartTiming: {
    maxExtension: number; // minutes
    minBreakDelay: number; // minutes
    flowProtection: boolean;
  };
  privacy: {
    storeHistory: boolean;
    shareAnalytics: boolean;
    retentionDays: number;
  };
  notifications: {
    flowStateAlerts: boolean;
    productivityTips: boolean;
    breakSuggestions: boolean;
  };
}

export interface ActivitySession {
  startTime: number;
  endTime?: number;
  events: ActivityEvent[];
  metrics: ActivityMetrics;
  flowStates: FlowStateInfo[];
  insights?: ProductivityInsights;
}

// VSCode API event types
export interface FileChangeEvent extends vscode.TextDocumentChangeEvent {
  timestamp: number;
}

export interface GitCommitEvent {
  hash: string;
  message: string;
  filesChanged: number;
  linesChanged: number;
  timestamp: number;
}

export interface TypingBurstEvent {
  startTime: number;
  endTime: number;
  charactersTyped: number;
  fileType: string;
}

export interface DebugSessionEvent {
  startTime: number;
  endTime: number;
  breakpoints: number;
  steps: number;
  result: 'success' | 'error' | 'cancelled';
}

export interface TestRunEvent {
  startTime: number;
  endTime: number;
  results: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  testType: 'unit' | 'integration' | 'e2e';
}

// Advanced Activity Analytics Interfaces

export interface AdvancedTypingMetrics {
  keystrokeVelocity: number;        // WPM (words per minute)
  errorRate: number;               // backspaces per 100 characters typed
  rhythmVariance: number;          // consistency (0-1, 1 = perfectly consistent)
  pauseDistribution: number[];     // array of pause lengths in ms
  correctionPatterns: ('immediate' | 'delayed' | 'bunching')[]; // timing of corrections
  burstQuality: number;            // overall typing efficiency (0-1)
  fatigueIndicators: string[];     // detected fatigue patterns
}

export interface FocusQualityMetrics {
  contextDepth: number;            // immersion level (0-10, higher = deeper focus)
  taskSwitchingRate: number;       // switches per hour
  codeToCommentRatio: number;      // code changes vs comments added
  documentationEngagement: boolean; // actively reading documentation
  searchUtilization: number;       // searches per hour (higher = problem-solving)
  workType: 'deep_coding' | 'debugging' | 'research' | 'administrative' | 'creative' | 'review';
  focusStability: number;          // consistency of focus periods (0-1)
}

export interface ContextSwitchMetrics {
  fromApp: string;                 // application switching away from
  toApp: string;                   // application switching to
  durationInPrevious: number;      // how long was user in previous app (minutes)
  transitionPurpose: 'research' | 'testing' | 'communication' | 'break' | 'distraction' | 'unknown';
  productivityContext: 'deep_work' | 'administrative' | 'creative' | 'debugging' | 'planning';
  contextChangeCost: number;       // cognitive cost of switch (0-10, higher = greater disruption)
}

interface WellnessExercise {
  type: string;
  duration: number;
  instruction: string;
}

interface WellnessPattern {
  eyeEngagement: number;
  breathingEngagement: number;
  stretchEngagement: number;
  waterConsumption: number;
  typicalSessionLength: number;
  dehydrationRisk: 'low' | 'medium' | 'high';
}

interface WaterScheduleItem {
  time: string;
  amount: string;
  reason: string;
}

// Notification history for ML analysis
export interface WellnessNotification {
  timestamp: number;
  type: 'stretch' | 'breathing' | 'eye' | 'water';
  successful: boolean;
  responseTime: number;
  userAccepted: boolean;
}

// Mood Detection Interfaces
export enum MoodState {
  FOCUSED = 'focused',
  FRUSTRATED = 'frustrated',
  STRESSED = 'stressed',
  FATIGUED = 'fatigued',
  ANXIOUS = 'anxious',
  CALM = 'calm'
}

export interface MoodAnalysis {
  currentMood: MoodState;
  confidence: number; // 0-1
  intensity: number; // 1-10
  triggers: string[];
  duration: number; // minutes in current mood
  trend: 'improving' | 'stable' | 'worsening';
  timestamp: number;
}

export interface MoodPattern {
  pattern: string;
  frequency: number;
  typicalTriggers: string[];
  effectiveness: number; // How well interventions work for this pattern
}

export interface MoodIntervention {
  type: 'breathing' | 'stretch' | 'break' | 'walk' | 'music' | 'meditation';
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  expectedEffectiveness: number; // 0-1
  duration: number; // minutes
}

export interface MoodHistory {
  moodStates: MoodAnalysis[];
  patterns: MoodPattern[];
  interventionSuccess: Record<string, number>; // intervention type -> success rate
}

export { WellnessExercise, WellnessPattern, WaterScheduleItem };
