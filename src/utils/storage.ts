import * as vscode from 'vscode';
import { BreakStats, WellnessGoal, WellnessChallenge, CustomExercise, SmartNotificationsData, ScreenTimeStats, Achievement, DailyWellnessData } from '../types';
import { ActivityEvent } from '../services/activityIntegration/activityTypes';

export class ExtensionStorage {
  constructor(private context: vscode.ExtensionContext) {}

  // Break Statistics
  saveBreakStats(stats: BreakStats): void {
    this.context.globalState.update('breakStats', stats);
  }

  loadBreakStats(): BreakStats {
    const defaultStats: BreakStats = {
      breaksTaken: 0,
      timeSaved: 0,
      streakDays: 0,
      lastBreakDate: null
    };

    return this.context.globalState.get('breakStats', defaultStats);
  }

  // Wellness Goals
  saveWellnessGoals(goals: WellnessGoal[]): void {
    this.context.globalState.update('wellnessGoals', goals);
  }

  loadWellnessGoals(): WellnessGoal[] {
    return this.context.globalState.get('wellnessGoals', []);
  }

  // Wellness Challenges
  saveWellnessChallenges(challenges: WellnessChallenge[]): void {
    this.context.globalState.update('wellnessChallenges', challenges);
  }

  loadWellnessChallenges(): WellnessChallenge[] {
    return this.context.globalState.get('wellnessChallenges', []);
  }

  // Custom Exercises
  saveCustomExercises(exercises: CustomExercise[]): void {
    this.context.globalState.update('customExercises', exercises);
  }

  loadCustomExercises(): CustomExercise[] {
    return this.context.globalState.get('customExercises', []);
  }

  // Smart Notifications Data
  saveSmartNotifications(data: SmartNotificationsData): void {
    this.context.globalState.update('smartNotifications', data);
  }

  loadSmartNotifications(): SmartNotificationsData {
    const defaultData: SmartNotificationsData = {
      lastBreakResponseTime: 0,
      breakAcceptanceRate: 0.5,
      preferredBreakTimes: [],
      notificationHistory: [],
      userPatterns: {
        productiveHours: [],
        breakFrequency: 30,
        responseTimeAverage: 30000
      }
    };

    return this.context.globalState.get('smartNotifications', defaultData);
  }

  // Screen Time Statistics
  saveScreenTimeStats(stats: ScreenTimeStats): void {
    this.context.globalState.update('screenTimeStats', stats);
  }

  loadScreenTimeStats(): ScreenTimeStats {
    const defaultStats: ScreenTimeStats = {
      sessionStartTime: null,
      totalScreenTimeToday: 0,
      continuousScreenTime: 0,
      lastBreakTime: null,
      lastActivityTime: new Date(),
      isIdle: false,
      codingSessionStart: null,
      longCodingSessionDetected: false
    };

    return this.context.globalState.get('screenTimeStats', defaultStats);
  }

  // Achievements
  saveAchievements(achievements: Achievement[]): void {
    this.context.globalState.update('achievements', achievements);
  }

  loadAchievements(): Achievement[] {
    return this.context.globalState.get('achievements', []);
  }

  // Daily Wellness Data
  saveDailyWellnessData(data: DailyWellnessData[]): void {
    this.context.globalState.update('dailyWellnessData', data);
  }

  loadDailyWellnessData(): DailyWellnessData[] {
    return this.context.globalState.get('dailyWellnessData', []);
  }

  // Data Export/Import for backup
  exportAllData(): any {
    return {
      breakStats: this.loadBreakStats(),
      wellnessGoals: this.loadWellnessGoals(),
      wellnessChallenges: this.loadWellnessChallenges(),
      customExercises: this.loadCustomExercises(),
      smartNotifications: this.loadSmartNotifications(),
      screenTimeStats: this.loadScreenTimeStats(),
      achievements: this.loadAchievements(),
      dailyWellnessData: this.loadDailyWellnessData(),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  importAllData(data: any): boolean {
    try {
      if (data.breakStats) this.saveBreakStats(data.breakStats);
      if (data.wellnessGoals) this.saveWellnessGoals(data.wellnessGoals);
      if (data.wellnessChallenges) this.saveWellnessChallenges(data.wellnessChallenges);
      if (data.customExercises) this.saveCustomExercises(data.customExercises);
      if (data.smartNotifications) this.saveSmartNotifications(data.smartNotifications);
      if (data.screenTimeStats) this.saveScreenTimeStats(data.screenTimeStats);
      if (data.achievements) this.saveAchievements(data.achievements);
      if (data.dailyWellnessData) this.saveDailyWellnessData(data.dailyWellnessData);

      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Clear all data (for reset functionality)
  clearAllData(): void {
    this.context.globalState.update('breakStats', undefined);
    this.context.globalState.update('wellnessGoals', undefined);
    this.context.globalState.update('wellnessChallenges', undefined);
    this.context.globalState.update('customExercises', undefined);
    this.context.globalState.update('smartNotifications', undefined);
    this.context.globalState.update('screenTimeStats', undefined);
    this.context.globalState.update('achievements', undefined);
    this.context.globalState.update('dailyWellnessData', undefined);
  }

  // Get storage info
  getStorageInfo(): any {
    return {
      keys: this.context.globalState.keys(),
      lastUpdate: new Date().toISOString()
    };
  }

  // Custom settings storage (for extension-specific settings)
  saveCustomSetting(key: string, value: any): void {
    this.context.globalState.update(`custom_${key}`, value);
  }

  loadCustomSetting(key: string, defaultValue?: any): any {
    return this.context.globalState.get(`custom_${key}`, defaultValue);
  }

  // ===== ACTIVITY MONITOR STORAGE & PRIVACY CONTROLS =====

  // Activity Events Storage with Retention Policies
  saveActivityEvents(events: ActivityEvent[], retentionDays: number = 30): void {
    // Apply retention policy - remove events older than retention period
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const filteredEvents = events.filter(event => event.timestamp > cutoffTime);

    // Compress data for storage efficiency
    const compressedData = this.compressActivityData(filteredEvents);

    this.context.globalState.update('activityEvents', compressedData);

    // Also save metadata about storage
    const metadata = {
      totalEvents: filteredEvents.length,
      retentionDays,
      lastCleanup: Date.now(),
      storageSize: JSON.stringify(compressedData).length
    };
    this.context.globalState.update('activityEventsMetadata', metadata);
  }

  loadActivityEvents(): ActivityEvent[] {
    try {
      const compressedData = this.context.globalState.get('activityEvents', null);
      if (!compressedData) return [];

      // Decompress data
      return this.decompressActivityData(compressedData);
    } catch (error) {
      console.error('Failed to load activity events:', error);
      return [];
    }
  }

  // Activity Events Metadata
  getActivityEventsMetadata() {
    return this.context.globalState.get('activityEventsMetadata', {
      totalEvents: 0,
      retentionDays: 30,
      lastCleanup: 0,
      storageSize: 0
    });
  }

  // Data Retention Policy Management
  applyDataRetentionPolicy(retentionDays: number): { eventsRemoved: number; spaceSaved: number } {
    const events = this.loadActivityEvents();
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const originalCount = events.length;
    const originalSize = JSON.stringify(this.compressActivityData(events)).length;

    const retainedEvents = events.filter(event => event.timestamp > cutoffTime);
    const newSize = JSON.stringify(this.compressActivityData(retainedEvents)).length;

    // Save retained events
    this.saveActivityEvents(retainedEvents, retentionDays);

    return {
      eventsRemoved: originalCount - retainedEvents.length,
      spaceSaved: Math.max(0, originalSize - newSize)
    };
  }

  // Privacy Controls & Data Export
  exportActivityData(options: {
    format: 'json' | 'csv';
    includeMetadata: boolean;
    anonymize: boolean;
    dateRange?: { start: number; end: number };
  }): string {
    const events = this.loadActivityEvents();
    const metadata = options.includeMetadata ? this.getActivityEventsMetadata() : null;

    // Apply date range filter
    let filteredEvents = events;
    if (options.dateRange) {
      filteredEvents = events.filter(event =>
        event.timestamp >= options.dateRange!.start &&
        event.timestamp <= options.dateRange!.end
      );
    }

    // Apply anonymization if requested
    if (options.anonymize) {
      filteredEvents = this.anonymizeActivityData(filteredEvents);
    }

    if (options.format === 'csv') {
      return this.exportToCSV(filteredEvents, metadata);
    } else {
      const exportData = {
        exportDate: new Date().toISOString(),
        formatVersion: '1.0',
        totalEvents: filteredEvents.length,
        dateRange: options.dateRange,
        anonymized: options.anonymize,
        events: filteredEvents,
        ...(metadata && { metadata })
      };
      return JSON.stringify(exportData, null, 2);
    }
  }

  // Data Import with Validation
  importActivityData(jsonData: string): { success: boolean; eventsImported: number; errors: string[] } {
    const errors: string[] = [];
    let eventsImported = 0;

    try {
      const data = JSON.parse(jsonData);

      // Validate data structure
      if (!data.events || !Array.isArray(data.events)) {
        errors.push('Invalid data format: missing events array');
        return { success: false, eventsImported: 0, errors };
      }

      // Validate events
      const validEvents: ActivityEvent[] = [];
      for (const event of data.events) {
        if (this.isValidActivityEvent(event)) {
          validEvents.push(event);
          eventsImported++;
        } else {
          errors.push(`Invalid event structure: ${JSON.stringify(event)}`);
        }
      }

      if (validEvents.length > 0) {
        // Merge with existing events, avoiding duplicates
        const existingEvents = this.loadActivityEvents();
        const mergedEvents = this.mergeActivityEvents(existingEvents, validEvents);

        // Get current retention policy
        const metadata = this.getActivityEventsMetadata();

        // Save merged data
        this.saveActivityEvents(mergedEvents, metadata.retentionDays);
      }

      return {
        success: errors.length === 0,
        eventsImported,
        errors
      };

    } catch (parseError) {
      return {
        success: false,
        eventsImported: 0,
        errors: [`JSON parsing error: ${parseError}`]
      };
    }
  }

  // Privacy Controls - Delete specific data types
  deleteActivityDataByType(activityTypes: string[]): { eventsDeleted: number } {
    const events = this.loadActivityEvents();
    const originalCount = events.length;

    const filteredEvents = events.filter(event => !activityTypes.includes(event.type));
    const eventsDeleted = originalCount - filteredEvents.length;

    // Save filtered events
    const metadata = this.getActivityEventsMetadata();
    this.saveActivityEvents(filteredEvents, metadata.retentionDays);

    return { eventsDeleted };
  }

  // Memory Optimization - Compress storage
  optimizeActivityStorage(): { spaceSaved: number; compressionRatio: number } {
    const events = this.loadActivityEvents();
    const originalSize = JSON.stringify(events).length;

    // Compress and get new size
    const compressed = this.compressActivityData(events);
    const compressedSize = JSON.stringify(compressed).length;

    // Save compressed data
    this.context.globalState.update('activityEvents', compressed);

    const compressionRatio = compressedSize / originalSize;

    return {
      spaceSaved: Math.max(0, originalSize - compressedSize),
      compressionRatio
    };
  }

  // Clear Activity Data (Privacy Control)
  clearActivityData(): void {
    this.context.globalState.update('activityEvents', undefined);
    this.context.globalState.update('activityEventsMetadata', undefined);
  }

  // ===== PRIVATE UTILITY METHODS =====

  private compressActivityData(events: ActivityEvent[]): any {
    // Basic compression - could be enhanced with gzip in future
    // For now, remove redundant context properties and optimize structure
    return events.map(event => ({
      i: event.id,
      t: event.type,
      ts: event.timestamp,
      d: event.duration,
      w: event.intensity,
      c: this.compressContext(event.context)
    }));
  }

  private decompressActivityData(compressedData: any): ActivityEvent[] {
    if (!Array.isArray(compressedData)) return [];

    return compressedData.map(item => ({
      id: item.i,
      type: item.t,
      timestamp: item.ts,
      duration: item.d,
      intensity: item.w,
      context: this.decompressContext(item.c)
    })).filter(event => this.isValidActivityEvent(event));
  }

  private compressContext(context: any): any {
    // Remove undefined properties and compress common fields
    const compressed: any = {};

    if (context.fileType) compressed.ft = context.fileType;
    if (context.linesChanged) compressed.lc = context.linesChanged;
    if (context.commitSize) compressed.cs = context.commitSize;
    if (context.commitMessage) compressed.cm = context.commitMessage.substring(0, 100);
    // Add other context compression as needed...

    return compressed;
  }

  private decompressContext(compressed: any): any {
    const context: any = {};

    if (compressed.ft) context.fileType = compressed.ft;
    if (compressed.lc) context.linesChanged = compressed.lc;
    if (compressed.cs) context.commitSize = compressed.cs;
    if (compressed.cm) context.commitMessage = compressed.cm;

    return context;
  }

  private anonymizeActivityData(events: ActivityEvent[]): ActivityEvent[] {
    return events.map(event => {
      const anonymizedContext = { ...event.context };
      // Remove personally identifiable information
      if (anonymizedContext.commitMessage) {
        anonymizedContext.commitMessage = '[REDACTED]';
      }
      if (anonymizedContext.searchQuery) {
        anonymizedContext.searchQuery = '[REDACTED]';
      }
      // Remove debug configuration and other PII
      if ('debugConfiguration' in anonymizedContext) {
        delete (anonymizedContext as any).debugConfiguration;
      }

      return {
        ...event,
        id: `anon_${Math.random().toString(36).substr(2, 9)}`, // Replace with anonymous ID
        context: anonymizedContext
      };
    });
  }

  private exportToCSV(events: ActivityEvent[], metadata?: any): string {
    const headers = [
      'timestamp',
      'date',
      'time',
      'type',
      'intensity',
      'duration',
      'fileType',
      'linesChanged'
    ];

    const csvRows = events.map(event => {
      const date = new Date(event.timestamp);
      return [
        event.timestamp,
        date.toISOString().split('T')[0], // YYYY-MM-DD
        date.toTimeString().split(' ')[0], // HH:MM:SS
        event.type,
        event.intensity,
        event.duration || '',
        event.context.fileType || '',
        event.context.linesChanged || ''
      ];
    });

    // Add metadata header if available
    let csvContent = headers.join(',') + '\n';

    if (metadata) {
      csvContent += `# Metadata: Total Events: ${metadata.totalEvents}, Retention Days: ${metadata.retentionDays}, Storage Size: ${metadata.storageSize} bytes\n`;
    }

    csvContent += csvRows.map(row => row.join(',')).join('\n');

    return csvContent;
  }

  private mergeActivityEvents(existing: ActivityEvent[], imported: ActivityEvent[]): ActivityEvent[] {
    // Create a map of existing events by ID to avoid duplicates
    const eventMap = new Map<string, ActivityEvent>();
    existing.forEach(event => eventMap.set(event.id, event));

    // Add imported events, avoiding duplicates
    imported.forEach(event => {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    });

    // Return merged events sorted by timestamp
    return Array.from(eventMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private isValidActivityEvent(event: any): event is ActivityEvent {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.type === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.intensity === 'number' &&
      event.intensity >= 1 && event.intensity <= 10 &&
      typeof event.context === 'object'
    );
  }
}
