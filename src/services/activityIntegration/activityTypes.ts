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
