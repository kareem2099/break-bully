import * as vscode from 'vscode';
import {
  AdvancedWorkRestModel,
  SchedulingModelType,
  TimeBlock,
  EisenhowerTask,
  EisenhowerPriority,
  EnergyProfile,
  EnergyReading,
  TaskSchedule,
  SchedulingIntelligence,
  CircadianRhythm,
  EnergyPattern,
  TimePreference,
  TaskPattern,
  AdaptationRule,
  TaskComplexity,
  EnergyLevel,
  DataSharingPreferences,
  SecureContribution
} from '../../types';
import { state } from '../../models/state';
import { BaseActivityMonitor } from './baseActivityMonitor';

/**
 * Advanced Scheduler Service - Core intelligent scheduling with ML capabilities
 * Manages advanced work scheduling models, energy profiling, and adaptive learning
 */
export class AdvancedSchedulerService {
  private baseMonitor: BaseActivityMonitor;
  private schedulingIntelligence: SchedulingIntelligence | null = null;
  private energyReadings: EnergyReading[] = [];
  private adaptationRules: AdaptationRule[] = [];
  private taskSchedules: TaskSchedule[] = [];
  private currentModel: AdvancedWorkRestModel | null = null;

  // Data Collective integration
  private dataSharingPreferences: DataSharingPreferences = {
    statisticalAggregation: true,
    scheduleTemplates: false,
    mlTrainingParticipation: false,
    energyPatterns: false,
    usageAnalytics: false,
    geographicRegion: false,
    publicContributions: false
  };

  constructor(baseMonitor: BaseActivityMonitor) {
    this.baseMonitor = baseMonitor;

    // Load persisted data
    this.loadPersistedData();

    // Start background learning
    this.startAdaptiveLearning();
  }

  /**
   * Set the current advanced scheduling model
   */
  setSchedulingModel(model: AdvancedWorkRestModel): void {
    this.currentModel = model;
    this.persistModel();
    this.notifyModelChange();
  }

  /**
   * Get the current scheduling model
   */
  getCurrentModel(): AdvancedWorkRestModel | null {
    return this.currentModel;
  }

  /**
   * Get next recommended action based on current scheduling model
   */
  getNextRecommendedAction(): {
    type: 'work' | 'break' | 'task-switch' | 'energy-check';
    duration?: number;
    taskId?: string;
    reason: string;
    confidence: number;
  } {
    if (!this.currentModel) {
      return { type: 'break', duration: 5, reason: 'No scheduling model active', confidence: 0.5 };
    }

    const currentType: SchedulingModelType = this.currentModel.type as SchedulingModelType;

    switch (currentType) {
      case 'time-blocking':
        return this.getTimeBlockingRecommendation();
      case 'eisenhower':
        return this.getEisenhowerRecommendation();
      case 'ultradian':
        return this.getUltradadianRecommendation();
      case 'energy-based':
        return this.getEnergyBasedRecommendation();
      case 'adaptive':
        return this.getAdaptiveRecommendation();
      case 'deadline-driven':
        return this.getDeadlineDrivenRecommendation();
      default:
        return this.getBasicRecommendation();
    }
  }

  /**
   * Time Blocking Recommendation Logic
   */
  private getTimeBlockingRecommendation() {
    const blocks: TimeBlock[] | undefined = this.currentModel!.advancedConfig?.timeBlocks;
    if (!blocks || blocks.length === 0) {
      return { type: 'work' as const, duration: 25, reason: 'Default time block', confidence: 0.5 };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = currentHour * 60 + now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday

    // Find active time block
    const activeBlock = blocks.find(block => {
      if (!block.recurring && block.daysOfWeek && !block.daysOfWeek.includes(currentDay)) {
        return false;
      }

      const blockStart = block.startTime;
      const blockEnd = block.startTime + block.duration;

      return currentMinutes >= blockStart && currentMinutes < blockEnd;
    });

    if (activeBlock) {
      return {
        type: activeBlock.type === 'breaks' ? 'break' as const : 'work' as const,
        duration: activeBlock.duration,
        reason: `Active: ${activeBlock.name}`,
        confidence: 0.8
      };
    }

    // Find next upcoming block
    const upcomingBlock = blocks
      .filter(block => block.startTime > currentMinutes)
      .sort((a, b) => a.startTime - b.startTime)[0];

    const nextReason = upcomingBlock
      ? `Next: ${upcomingBlock.name} at ${Math.floor(upcomingBlock.startTime / 60)}:${(upcomingBlock.startTime % 60).toString().padStart(2, '0')}`
      : 'No scheduled blocks';

    return {
      type: 'break' as const,
      duration: upcomingBlock ? Math.min(15, upcomingBlock.startTime - currentMinutes) : 10,
      reason: nextReason,
      confidence: 0.6
    };
  }

  /**
   * Eisenhower Matrix Recommendation Logic
   */
  private getEisenhowerRecommendation() {
    const config = this.currentModel!.advancedConfig?.eisenhowerConfig;
    if (!config?.enabled) {
      return { type: 'break' as const, duration: 5, reason: 'No Eisenhower tasks configured', confidence: 0.5 };
    }

    const taskQueue: EisenhowerTask[] | undefined = config.taskQueue;
    if (!taskQueue) {
      return { type: 'break' as const, duration: 5, reason: 'No Eisenhower tasks configured', confidence: 0.5 };
    }

    const urgentImportant = taskQueue
      .filter(task => !task.completed && task.priority === 'urgent-important')
      .sort((a, b) => (a.deadline?.getTime() || Number.MAX_SAFE_INTEGER) - (b.deadline?.getTime() || Number.MAX_SAFE_INTEGER));

    if (urgentImportant.length > 0) {
      return {
        type: 'work' as const,
        taskId: urgentImportant[0].id,
        duration: urgentImportant[0].estimatedDuration,
        reason: `Urgent-Important: ${urgentImportant[0].name}`,
        confidence: 0.9
      };
    }

    const urgentNotImportant = taskQueue
      .filter(task => !task.completed && task.priority === 'urgent-not-important');

    if (urgentNotImportant.length > 0) {
      return {
        type: 'break' as const,
        duration: 5,
        reason: 'Focus on important tasks, delegate urgent-not-important',
        confidence: 0.7
      };
    }

    return {
      type: 'work' as const,
      duration: 25,
      reason: 'Work on planned important tasks',
      confidence: 0.6
    };
  }

  /**
   * Ultradian Rhythm Recommendation (90-min focused work blocks)
   */
  private getUltradadianRecommendation() {
    const now = new Date();
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const ninetyMinSlots = Math.floor(minutesSinceMidnight / 90);

    // Check if we're in a work or break portion of the 90-min cycle
    const remainingInCycle = 90 - (minutesSinceMidnight % 90);

    if (remainingInCycle > 75) {
      // First 15 minutes: work
      return {
        type: 'work' as const,
        duration: remainingInCycle,
        reason: `Ultradian work phase (90-min cycle, slot ${ninetyMinSlots})`,
        confidence: 0.85
      };
    } else if (remainingInCycle > 15) {
      // Next 60 minutes: continue work
      return {
        type: 'work' as const,
        duration: remainingInCycle - 15,
        reason: `Ultradian work phase (90-min cycle, slot ${ninetyMinSlots})`,
        confidence: 0.85
      };
    } else {
      // Last 15 minutes: break
      return {
        type: 'break' as const,
        duration: remainingInCycle,
        reason: `Ultradian break phase (90-min cycle, slot ${ninetyMinSlots})`,
        confidence: 0.85
      };
    }
  }

  /**
   * Energy-Based Scheduling Recommendation
   */
  private getEnergyBasedRecommendation() {
    const profile: EnergyProfile | undefined = this.currentModel!.advancedConfig?.energyProfile;
    if (!profile) {
      return { type: 'energy-check' as const, reason: 'Energy profile not configured', confidence: 0.5 };
    }

    const highEnergyLevels: EnergyLevel[] = ['high', 'very-high'];
    const lowEnergyLevels: EnergyLevel[] = ['low', 'very-low'];

    const currentHour = new Date().getHours();
    const energyLevel = profile.hourlyEnergy[currentHour] || 5;
    const isPeakHour = profile.peakHours.includes(currentHour);
    const isLowEnergy = profile.lowEnergyHours.includes(currentHour);

    if (isPeakHour && energyLevel >= 7) {
      const pendingTasks = this.taskSchedules
        .filter(task => !task.completed && highEnergyLevels.includes(task.energyRequired))
        .sort((a, b) => this.getTaskPriorityScore(b) - this.getTaskPriorityScore(a));

      if (pendingTasks.length > 0) {
        return {
          type: 'work' as const,
          taskId: pendingTasks[0].id,
          duration: Math.min(pendingTasks[0].estimatedDuration, 60),
          reason: 'Peak energy hour - tackle high-energy task',
          confidence: 0.9
        };
      }
    }

    if (isLowEnergy || energyLevel <= 3) {
      const lowEnergyTasks = this.taskSchedules
        .filter(task => !task.completed && lowEnergyLevels.includes(task.energyRequired))
        .sort((a, b) => this.getTaskPriorityScore(b) - this.getTaskPriorityScore(a));

      if (lowEnergyTasks.length > 0) {
        return {
          type: 'work' as const,
          taskId: lowEnergyTasks[0].id,
          duration: Math.min(lowEnergyTasks[0].estimatedDuration, 30),
          reason: 'Low energy - focus on simple task',
          confidence: 0.7
        };
      }

      return {
        type: 'break' as const,
        duration: energyLevel <= 2 ? 15 : 10,
        reason: 'Low energy period - take a break',
        confidence: 0.8
      };
    }

    return {
      type: 'work' as const,
      duration: 45,
      reason: 'Moderate energy - continue focused work',
      confidence: 0.6
    };
  }

  /**
   * Adaptive Learning Recommendation
   */
  private getAdaptiveRecommendation() {
    // Use learned patterns to make recommendations
    if (!this.schedulingIntelligence) {
      return { type: 'work' as const, duration: 25, reason: 'Learning user patterns', confidence: 0.5 };
    }

    const currentHour = new Date().getHours();
    const currentTimePrefs = this.schedulingIntelligence.productivityZones
      .find(zone => zone.startHour <= currentHour && zone.endHour > currentHour);

    if (currentTimePrefs?.supportedByData && currentTimePrefs.preferenceScore > 0.5) {
      return {
        type: 'work' as const,
        duration: 45,
        reason: 'Optimal productive time slot (learned)',
        confidence: 0.85
      };
    }

    // Apply adaptation rules
    const applicableRule = this.adaptationRules
      .sort((a, b) => b.confidence - a.confidence)
      .find(rule => this.ruleApplies(rule));

    if (applicableRule) {
      return {
        type: 'work' as const,
        duration: Math.round(25 * applicableRule.adjustment.workDurationMultiplier),
        reason: 'Adaptive scheduling based on learned patterns',
        confidence: applicableRule.confidence
      };
    }

    return { type: 'work' as const, duration: 25, reason: 'Standard adaptive scheduling', confidence: 0.6 };
  }

  /**
   * Deadline-Driven Recommendation
   */
  private getDeadlineDrivenRecommendation() {
    const config = this.currentModel!.advancedConfig?.deadlineConfig;
    if (!config?.enabled) {
      return { type: 'work' as const, duration: 25, reason: 'Deadline scheduling disabled', confidence: 0.5 };
    }

    const now = new Date();
    const urgentTasks = this.taskSchedules
      .filter(task => {
        if (!task.deadline || task.completed) return false;
        const hoursUntilDeadline = (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilDeadline <= config.timePressureThreshold;
      })
      .sort((a, b) => (a.deadline!.getTime() - now.getTime()) - (b.deadline!.getTime() - now.getTime()));

    if (urgentTasks.length > 0) {
      return {
        type: 'work' as const,
        taskId: urgentTasks[0].id,
        duration: Math.min(urgentTasks[0].estimatedDuration, 60),
        reason: `Urgent deadline: ${urgentTasks[0].name}`,
        confidence: 0.95
      };
    }

    return { type: 'work' as const, duration: 25, reason: 'No urgent deadlines - standard work', confidence: 0.6 };
  }

  /**
   * Basic Fallback Recommendation
   */
  private getBasicRecommendation() {
    return { type: 'work' as const, duration: 25, reason: 'Basic work session', confidence: 0.5 };
  }

  /**
   * Task Management Methods
   */
  addTask(task: Omit<TaskSchedule, 'id' | 'completed'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: TaskSchedule = {
      ...task,
      id: taskId,
      completed: false
    };

    this.taskSchedules.push(newTask);
    this.persistTasks();
    return taskId;
  }

  completeTask(taskId: string, actualDuration?: number, satisfaction?: number): boolean {
    const task = this.taskSchedules.find(t => t.id === taskId);
    if (!task || task.completed) return false;

    task.completed = true;
    if (actualDuration !== undefined) task.actualDuration = actualDuration;
    if (satisfaction !== undefined) task.satisfaction = satisfaction;

    this.persistTasks();
    this.updateLearningData(task);
    return true;
  }

  /**
   * Energy Tracking Methods
   */
  recordEnergyReading(reading: Omit<EnergyReading, 'timestamp'>): void {
    const energyReading: EnergyReading = {
      ...reading,
      timestamp: new Date()
    };

    this.energyReadings.push(energyReading);

    // Keep only last 30 days of readings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    this.energyReadings = this.energyReadings.filter(r => r.timestamp > thirtyDaysAgo);

    this.persistEnergyReadings();
    this.updateEnergyProfile();
  }

  /**
   * Adaptive Learning Methods
   */
  private startAdaptiveLearning(): void {
    // Learn patterns every 6 hours
    setInterval(() => {
      this.updateSchedulingIntelligence();
      this.updateAdaptationRules();
    }, 6 * 60 * 60 * 1000);

    // Initial learning
    setTimeout(() => this.updateSchedulingIntelligence(), 5000);
  }

  private updateSchedulingIntelligence(): void {
    if (this.energyReadings.length < 10) return;

    const intelligence: SchedulingIntelligence = {
      userRhythm: this.calculateCircadianRhythm(),
      energyPatterns: this.analyzeEnergyPatterns(),
      productivityZones: this.identifyTimePreferences(),
      taskAffinity: this.analyzeTaskPatterns()
    };

    this.schedulingIntelligence = intelligence;
    this.persistIntelligence();
  }

  private calculateCircadianRhythm(): CircadianRhythm {
    const hourlyStats: { [hour: number]: { energy: number[], completion: number[] } } = {};

    // Aggregate by hour
    this.energyReadings.forEach(reading => {
      const hour = reading.hour;
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { energy: [], completion: [] };
      }
      hourlyStats[hour].energy.push(reading.energyLevel);
      hourlyStats[hour].completion.push(reading.completionRate);
    });

    // Calculate averages
    const peakPerformances: { hour: number; score: number }[] = [];
    const energyDips: { hour: number; score: number }[] = [];
    const weeklyPatterns: { [day: number]: { [hour: number]: number } } = {};

    for (let hour = 0; hour < 24; hour++) {
      const stats = hourlyStats[hour];
      if (stats && stats.energy.length > 0) {
        const avgEnergy = stats.energy.reduce((a, b) => a + b, 0) / stats.energy.length;
        const avgCompletion = stats.completion.reduce((a, b) => a + b, 0) / stats.completion.length;
        const score = (avgEnergy + avgCompletion * 10) / 2;

        if (score > 7) {
          peakPerformances.push({ hour, score });
        } else if (score < 4) {
          energyDips.push({ hour, score: score });
        }
      }
    }

    return {
      peakPerformances: peakPerformances.sort((a, b) => b.score - a.score),
      energyDips: energyDips.sort((a, b) => a.score - b.score),
      weeklyPatterns,
      confidence: Math.min(1, this.energyReadings.length / 100), // Higher confidence with more data
      lastUpdated: new Date()
    };
  }

  private analyzeEnergyPatterns(): EnergyPattern[] {
    // Group energy readings into 2-hour time slots
    const patterns: EnergyPattern[] = [];
    for (let startHour = 0; startHour < 24; startHour += 2) {
      const slotReadings = this.energyReadings.filter(r =>
        r.hour >= startHour && r.hour < startHour + 2
      );

      if (slotReadings.length > 5) {
        const avgEnergy = slotReadings.reduce((sum, r) => sum + r.energyLevel, 0) / slotReadings.length;
        const avgCompletion = slotReadings.reduce((sum, r) => sum + r.completionRate, 0) / slotReadings.length;

        patterns.push({
          timeSlot: { start: startHour, end: startHour + 2 },
          averageEnergy: avgEnergy,
          taskCompletionRate: avgCompletion,
          preferredActivities: [], // TODO: analyze this
          avoidedActivities: []
        });
      }
    }

    return patterns;
  }

  private identifyTimePreferences(): TimePreference[] {
    const preferences: TimePreference[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourReadings = this.energyReadings.filter(r => r.hour === hour);
      if (hourReadings.length > 3) {
        const avgEnergy = hourReadings.reduce((sum, r) => sum + r.energyLevel, 0) / hourReadings.length;
        const avgCompletion = hourReadings.reduce((sum, r) => sum + r.completionRate, 0) / hourReadings.length;

        const score = (avgEnergy + avgCompletion * 10) / 2; // Normalize like other functions

        preferences.push({
          startHour: hour,
          endHour: hour + 1,
          preferenceScore: score,
          supportedByData: hourReadings.length >= 10
        });
      }
    }

    return preferences;
  }

  private analyzeTaskPatterns(): TaskPattern[] {
    return []; // TODO: Implement task pattern analysis
  }

  /**
   * Helper Methods
   */
  private getTaskPriorityScore(task: TaskSchedule): number {
    let score = 0;

    // Priority mapping
    const priorityScores: {
      [key in EisenhowerPriority]: number;
    } = {
      'urgent-important': 100,
      'urgent-not-important': 50,
      'not-urgent-important': 75,
      'not-urgent-not-important': 25
    };

    score += priorityScores[task.priority] || 0;

    // Deadline pressure
    if (task.deadline) {
      const hoursUntilDeadline = (task.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDeadline < 24) {
        score += Math.max(0, 50 - hoursUntilDeadline);
      }
    }

    // Complexity adjustment
    const complexityMultiplier: {
      [key in TaskComplexity]: number;
    } = {
      'very-complex': 1.5,
      'complex': 1.2,
      'moderate': 1.0,
      'simple': 0.8
    };

    score *= complexityMultiplier[task.complexity] || 1.0;

    return score;
  }

  private ruleApplies(rule: AdaptationRule): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    if (rule.condition.timeOfDay) {
      const inTimeRange = currentHour >= rule.condition.timeOfDay.start &&
                         currentHour < rule.condition.timeOfDay.end;
      if (!inTimeRange) return false;
    }

    if (rule.condition.dayOfWeek && !rule.condition.dayOfWeek.includes(currentDay)) {
      return false;
    }

    // TODO: Check energy level and task complexity conditions

    return true;
  }

  private updateAdaptationRules(): void {
    // TODO: Implement adaptive rule updates based on performance
  }

  private updateEnergyProfile(): void {
    if (!this.currentModel?.advancedConfig?.energyProfile) return;

    const profile = this.currentModel.advancedConfig.energyProfile;
    const rhythm = this.calculateCircadianRhythm();

    profile.peakHours = rhythm.peakPerformances.slice(0, 4).map(p => p.hour);
    profile.lowEnergyHours = rhythm.energyDips.slice(0, 3).map(p => p.hour);

    // TODO: Update user type and weekly patterns
    profile.learned = true;
  }

  private updateLearningData(_completedTask: TaskSchedule): void {
    // TODO: Update adaptation rules based on task completion
    console.log('Completed task for learning:', _completedTask.id, _completedTask.name);
  }

  /**
   * Persistence Methods
   */
  private loadPersistedData(): void {
    try {
      this.taskSchedules = state.storage?.loadCustomSetting('advancedScheduler.tasks', []) || [];
      this.energyReadings = state.storage?.loadCustomSetting('advancedScheduler.energyReadings', []) || [];
      this.adaptationRules = state.storage?.loadCustomSetting('advancedScheduler.adaptationRules', []) || [];
      this.schedulingIntelligence = (state.storage?.loadCustomSetting('advancedScheduler.intelligence', null) ?? null) as SchedulingIntelligence | null;
      this.dataSharingPreferences = state.storage?.loadCustomSetting('advancedScheduler.dataSharing', this.dataSharingPreferences) || this.dataSharingPreferences;
    } catch (error) {
      console.error('Failed to load advanced scheduler data:', error);
    }
  }

  private persistTasks(): void {
    state.storage?.saveCustomSetting('advancedScheduler.tasks', this.taskSchedules);
  }

  private persistEnergyReadings(): void {
    state.storage?.saveCustomSetting('advancedScheduler.energyReadings', this.energyReadings);
  }

  private persistIntelligence(): void {
    state.storage?.saveCustomSetting('advancedScheduler.intelligence', this.schedulingIntelligence);
  }

  private persistModel(): void {
    state.storage?.saveCustomSetting('advancedScheduler.currentModel', this.currentModel);
  }

  private notifyModelChange(): void {
    vscode.commands.executeCommand('breakBully.refreshTimer');
  }

  /**
   * Data Collective Integration (Privacy-Preserving ML)
   */
  setDataSharingPreferences(preferences: DataSharingPreferences): void {
    this.dataSharingPreferences = preferences;
    state.storage?.saveCustomSetting('advancedScheduler.dataSharing', preferences);
  }

  getDataSharingPreferences(): DataSharingPreferences {
    return this.dataSharingPreferences;
  }

  async prepareContribution(): Promise<SecureContribution | null> {
    if (!this.dataSharingPreferences.mlTrainingParticipation) {
      return null;
    }

    // TODO: Implement secure contribution preparation
    // This would create ZKP proofs and encrypted data contributions

    return null;
  }

  getSchedulingStats(): {
    totalTasks: number;
    completedTasks: number;
    averageCompletionTime: number;
    scheduleAdherence: number;
    energyInsights: EnergyPattern[];
  } {
    const completedTasks = this.taskSchedules.filter(t => t.completed);
    const totalEstimated = this.taskSchedules.reduce((sum, t) => sum + t.estimatedDuration, 0);
    const totalActual = completedTasks.reduce((sum, t) => sum + (t.actualDuration || t.estimatedDuration), 0);

    return {
      totalTasks: this.taskSchedules.length,
      completedTasks: completedTasks.length,
      averageCompletionTime: completedTasks.length > 0 ?
        completedTasks.reduce((sum, t) => sum + (t.actualDuration || t.estimatedDuration), 0) / completedTasks.length : 0,
      scheduleAdherence: totalEstimated > 0 ? Math.min(1, totalActual / totalEstimated) : 0,
      energyInsights: this.schedulingIntelligence?.energyPatterns || []
    };
  }
}

// Export singleton instance (will be initialized when activity monitor is available)
export let advancedScheduler: AdvancedSchedulerService | undefined;

/**
 * Initialize the advanced scheduler service
 * Should be called after the activity monitor is available
 */
export function initializeAdvancedScheduler(baseMonitor: BaseActivityMonitor): void {
  advancedScheduler = new AdvancedSchedulerService(baseMonitor);
  console.log('Advanced Scheduler Service initialized');
}
