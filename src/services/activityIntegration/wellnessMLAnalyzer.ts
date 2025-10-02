import { ActivityEvent } from './activityTypes';
import { MachineLearningAnalyzer } from './machineLearningAnalyzer';

/**
 * Machine Learning Analyzer for Wellness Activities
 * Analyzes user patterns to optimize stretch, breathing, eye exercises, and water reminders
 */
export class WellnessMLAnalyzer extends MachineLearningAnalyzer {

  /**
   * Analyzes wellness timing preferences and predicts optimal exercise times
   */
  static analyzeWellnessTiming(events: ActivityEvent[]): {
    optimalEyeExerciseHours: number[];
    optimalBreathingHours: number[];
    optimalStretchHours: number[];
    waterReminderSchedule: { hour: number, frequency: 'high' | 'medium' | 'low' }[];
    wellnessInsights: string[];
  } {
    const recentEvents = events.filter(e =>
      Date.now() - e.timestamp < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    if (recentEvents.length < 30) {
      return {
        optimalEyeExerciseHours: [9, 14, 16], // Default times
        optimalBreathingHours: [8, 12, 17],
        optimalStretchHours: [9, 14, 17],
        waterReminderSchedule: [
          { hour: 9, frequency: 'high' },
          { hour: 11, frequency: 'medium' },
          { hour: 14, frequency: 'high' },
          { hour: 16, frequency: 'medium' }
        ],
        wellnessInsights: ['Building wellness patterns - more data needed for personalized recommendations']
      };
    }

    // Group events by hour for pattern analysis
    const hourlyPatterns: { [hour: number]: ActivityEvent[] } = {};
    recentEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyPatterns[hour] = hourlyPatterns[hour] || [];
      hourlyPatterns[hour].push(event);
    });

    // Analyze engagement patterns for different wellness activities
    const eyeExerciseEngagement = this.analyzeEngagementPattern(hourlyPatterns, 'eye');
    const breathingEngagement = this.analyzeEngagementPattern(hourlyPatterns, 'breath');
    const stretchEngagement = this.analyzeEngagementPattern(hourlyPatterns, 'stretch');

    // Find optimal hours (top 3 hours for each activity)
    const optimalEyeExerciseHours = this.findOptimalHours(eyeExerciseEngagement, 3);
    const optimalBreathingHours = this.findOptimalHours(breathingEngagement, 3);
    const optimalStretchHours = this.findOptimalHours(stretchEngagement, 3);

    // Analyze dehydration patterns and create water schedule
    const waterReminderSchedule = this.createWaterReminderSchedule(recentEvents);

    // Generate personalized insights
    const wellnessInsights = this.generateWellnessInsights(
      optimalEyeExerciseHours,
      optimalBreathingHours,
      optimalStretchHours,
      waterReminderSchedule
    );

    return {
      optimalEyeExerciseHours,
      optimalBreathingHours,
      optimalStretchHours,
      waterReminderSchedule,
      wellnessInsights
    };
  }

  /**
   * Predicts exercise completion likelihood for recommendation personalization
   */
  static predictExerciseSuccess(
    events: ActivityEvent[],
    exerciseType: 'stretch' | 'breathing' | 'eye' | 'water',
    targetHour: number
  ): {
    successProbability: number;
    confidence: number;
    recommendation: string;
    alternativeTimes: number[];
  } {
    const targetDayOfWeek = new Date().getDay();

    // Find historical completion patterns for this exercise type
    const relevantEvents = events.filter(e =>
      e.context && (e.context as any).exerciseType === exerciseType
    );

    if (relevantEvents.length < 10) {
      return {
        successProbability: 0.5,
        confidence: 0.3,
        recommendation: 'Build more exercise history for personalized predictions',
        alternativeTimes: [9, 12, 15, 17]
      };
    }

    // Calculate success rate at similar times
    const hourlySuccessRates: { [hour: number]: { completed: number, total: number } } = {};

    relevantEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlySuccessRates[hour] = hourlySuccessRates[hour] || { completed: 0, total: 0 };

      hourlySuccessRates[hour].total++;
      // Assume completion if exercise duration was > 80% of expected
      if (event.duration && event.duration > (exerciseType === 'breathing' ? 180 : exerciseType === 'water' ? 60 : 20)) {
        hourlySuccessRates[hour].completed++;
      }
    });

    // Calculate success probability for target hour
    const targetHourData = hourlySuccessRates[targetHour];
    const successProbability = targetHourData
      ? targetHourData.completed / targetHourData.total
      : 0.4; // Default fallback

    // Calculate confidence based on sample size
    const confidence = Math.min(targetHourData ? targetHourData.total / 20 : 0.1, 1);

    // Generate recommendation
    let recommendation: string;
    if (successProbability > 0.8) {
      recommendation = 'Excellent time! High completion likelihood.';
    } else if (successProbability > 0.6) {
      recommendation = 'Good timing. Favorable completion odds.';
    } else if (successProbability > 0.4) {
      recommendation = 'Moderate success rate. Consider alternative times.';
    } else {
      recommendation = 'Low success rate. Try different times for better results.';
    }

    // Find best alternative times
    const alternativeTimes = Object.entries(hourlySuccessRates)
      .filter(([hour, data]) => parseInt(hour) !== targetHour && data.total >= 3)
      .sort(([, a], [, b]) => (b.completed / b.total) - (a.completed / a.total))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return {
      successProbability: Math.round(successProbability * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      recommendation,
      alternativeTimes
    };
  }

  /**
   * Creates personalized wellness routines based on user patterns
   */
  static createPersonalizedWellnessRoutine(events: ActivityEvent[]): {
    morningRoutine: Array<{ type: string; duration: number; instruction: string }>;
    afternoonRoutine: Array<{ type: string; duration: number; instruction: string }>;
    eveningRoutine: Array<{ type: string; duration: number; instruction: string }>;
    waterSchedule: Array<{ time: string; amount: string; reason: string }>;
    routineInsights: string[];
  } {
    const timingAnalysis = this.analyzeWellnessTiming(events);
    const userPattern = this.analyzeWellnessEngagementPattern(events);

    // Create morning routine (typically 8-10 AM)
    const morningRoutine = this.buildDailyRoutine(
      'morning',
      userPattern,
      timingAnalysis.optimalEyeExerciseHours.includes(9) ||
      timingAnalysis.optimalBreathingHours.includes(9) ||
      timingAnalysis.optimalStretchHours.includes(9)
    );

    // Create afternoon routine (typically 2-5 PM)
    const afternoonRoutine = this.buildDailyRoutine(
      'afternoon',
      userPattern,
      timingAnalysis.optimalEyeExerciseHours.includes(14) ||
      timingAnalysis.optimalEyeExerciseHours.includes(15) ||
      timingAnalysis.optimalEyeExerciseHours.includes(16) ||
      timingAnalysis.optimalStretchHours.includes(14) ||
      timingAnalysis.optimalStretchHours.includes(15) ||
      timingAnalysis.optimalStretchHours.includes(16)
    );

    // Create evening routine (typically 5-7 PM)
    const eveningRoutine = this.buildDailyRoutine(
      'evening',
      userPattern,
      timingAnalysis.optimalBreathingHours.includes(17) ||
      timingAnalysis.optimalBreathingHours.includes(18) ||
      timingAnalysis.optimalStretchHours.includes(17)
    );

    // Personalized water schedule
    const waterSchedule = this.createPersonalizedWaterSchedule(
      userPattern.dehydrationRisk,
      userPattern.typicalSessionLength
    );

    const routineInsights = this.generateRoutineInsights(
      morningRoutine,
      afternoonRoutine,
      eveningRoutine,
      userPattern
    );

    return {
      morningRoutine,
      afternoonRoutine,
      eveningRoutine,
      waterSchedule,
      routineInsights
    };
  }

  /**
   * Advanced notification system that learns from user responses
   */
  static optimizeNotifications(
    events: ActivityEvent[],
    notificationHistory: Array<{
      timestamp: number;
      type: 'stretch' | 'breathing' | 'eye' | 'water';
      successful: boolean;
      responseTime: number;
      userAccepted: boolean;
    }>
  ): {
    optimalNotificationTiming: { [activityType: string]: { hours: number[]; confidence: number } };
    personalizedMessaging: { [activityType: string]: string[] };
    notificationFrequency: { [activityType: string]: 'high' | 'medium' | 'low' };
    learningInsights: string[];
  } {
    const timingAnalysis = this.analyzeNotificationTiming(notificationHistory);
    const engagementAnalysis = this.analyzeNotificationEngagement(notificationHistory);

    // Calculate optimal timing for each activity type
    const optimalNotificationTiming = this.calculateOptimalNotificationTimes(
      notificationHistory,
      timingAnalysis
    );

    // Generate personalized message strategies
    const personalizedMessaging = this.createPersonalizedMessageStrategies(
      engagementAnalysis,
      notificationHistory
    );

    // Determine optimal notification frequency
    const notificationFrequency = this.optimizeNotificationFrequency(
      engagementAnalysis,
      notificationHistory.length
    );

    const learningInsights = this.generateNotificationLearningInsights(
      timingAnalysis,
      engagementAnalysis
    );

    return {
      optimalNotificationTiming,
      personalizedMessaging,
      notificationFrequency,
      learningInsights
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private static analyzeEngagementPattern(
    hourlyPatterns: { [hour: number]: ActivityEvent[] },
    activityType: string
  ): { [hour: number]: { engagement: number; completions: number; totalActivities: number } } {
    const engagementData: { [hour: number]: { engagement: number; completions: number; totalActivities: number } } = {};

    Object.entries(hourlyPatterns).forEach(([hourStr, events]) => {
      const hour = parseInt(hourStr);

      // Filter for wellness activity completions
      const wellnessEvents = events.filter(e =>
        e.context && (e.context as any).exerciseType === activityType
      );

      if (wellnessEvents.length === 0) {
        engagementData[hour] = { engagement: 0, completions: 0, totalActivities: 0 };
        return;
      }

      // Calculate engagement score (completion rate * frequency * duration score)
      const completions = wellnessEvents.filter(e =>
        e.duration && e.duration > 10 // Assume meaningful completion > 10 seconds
      ).length;

      const completionRate = completions / wellnessEvents.length;
      const frequency = wellnessEvents.length;
      const avgDuration = wellnessEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / wellnessEvents.length;
      const durationScore = Math.min(avgDuration / 60, 1); // Normalize to 1 minute max

      const engagement = (completionRate * 0.4) + (frequency * 0.3) + (durationScore * 0.3);

      engagementData[hour] = {
        engagement,
        completions,
        totalActivities: wellnessEvents.length
      };
    });

    return engagementData;
  }

  private static findOptimalHours(
    engagementData: { [hour: number]: { engagement: number; completions: number; totalActivities: number } },
    count: number
  ): number[] {
    return Object.entries(engagementData)
      .sort(([, a], [, b]) => b.engagement - a.engagement)
      .slice(0, count)
      .map(([hourStr]) => parseInt(hourStr));
  }

  private static createWaterReminderSchedule(events: ActivityEvent[]): Array<{ hour: number, frequency: 'high' | 'medium' | 'low' }> {
    const workSessions = this.analyzeWorkSessionPatterns(events);
    const schedule: Array<{ hour: number, frequency: 'high' | 'medium' | 'low' }> = [];

    // Standard hydration schedule: every 2 hours during work sessions
    workSessions.forEach(session => {
      const startHour = Math.max(8, session.startHour);
      const endHour = Math.min(18, session.endHour);

      for (let hour = startHour; hour <= endHour; hour += 2) {
        if (!schedule.find(s => s.hour === hour)) {
          const frequency = hour >= 9 && hour <= 17 ? 'high' : 'medium';
          schedule.push({ hour, frequency });
        }
      }
    });

    // Ensure minimum hydration coverage
    if (schedule.length < 3) {
      [9, 12, 15, 17].forEach(hour => {
        if (!schedule.find(s => s.hour === hour)) {
          schedule.push({ hour, frequency: 'medium' });
        }
      });
    }

    return schedule.sort((a, b) => a.hour - b.hour);
  }

  private static analyzeWorkSessionPatterns(events: ActivityEvent[]): Array<{ startHour: number, endHour: number }> {
    // Group events by day to analyze work sessions
    const sessionsByDay: { [date: string]: ActivityEvent[] } = {};

    events.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      sessionsByDay[date] = sessionsByDay[date] || [];
      sessionsByDay[date].push(event);
    });

    const workSessions: Array<{ startHour: number, endHour: number }> = [];

    Object.values(sessionsByDay).forEach(dayEvents => {
      if (dayEvents.length > 5) { // Meaningful work day
        const hours = dayEvents.map(e => new Date(e.timestamp).getHours()).sort((a, b) => a - b);
        const startHour = hours[0];
        const endHour = hours[hours.length - 1];

        if (endHour - startHour >= 4) { // At least 4-hour session
          workSessions.push({ startHour, endHour });
        }
      }
    });

    return workSessions.length > 0 ? workSessions : [{ startHour: 9, endHour: 17 }];
  }

  private static generateWellnessInsights(
    eyeHours: number[],
    breathingHours: number[],
    stretchHours: number[],
    waterSchedule: Array<{ hour: number, frequency: 'high' | 'medium' | 'low' }>
  ): string[] {
    const insights: string[] = [];

    insights.push(`🏆 Peak eye exercise effectiveness: ${this.formatHourList(eyeHours)}`);
    insights.push(`🧘 Optimal breathing times: ${this.formatHourList(breathingHours)}`);
    insights.push(`🏃‍♂️ Best stretching windows: ${this.formatHourList(stretchHours)}`);

    const highPriorityWater = waterSchedule.filter(s => s.frequency === 'high');
    insights.push(`💧 High-priority hydration: ${this.formatHourList(highPriorityWater.map(s => s.hour))}`);

    if (eyeHours.includes(14)) {
      insights.push('👁️ Mid-afternoon eye exercises align with peak screen time strain');
    }

    if (breathingHours.includes(17)) {
      insights.push('🌅 Evening breathing helps transition to wind-down period');
    }

    if (stretchHours.every(h => h >= 16)) {
      insights.push('🌆 Evening stretches may indicate morning stiffness - consider morning routine');
    }

    return insights;
  }

  private static formatHourList(hours: number[]): string {
    return hours.map(h => this.formatHour(h)).join(', ');
  }

  private static formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  private static analyzeWellnessEngagementPattern(events: ActivityEvent[]): {
    eyeEngagement: number;
    breathingEngagement: number;
    stretchEngagement: number;
    waterConsumption: number;
    typicalSessionLength: number;
    dehydrationRisk: 'low' | 'medium' | 'high';
  } {
    const wellnessEvents = events.filter(e => e.context && (e.context as any).exerciseType);

    if (wellnessEvents.length === 0) {
      return {
        eyeEngagement: 0.5,
        breathingEngagement: 0.5,
        stretchEngagement: 0.5,
        waterConsumption: 0.5,
        typicalSessionLength: 8,
        dehydrationRisk: 'medium'
      };
    }

    // Calculate engagement scores (0-1 scale)
    const eyeEngagement = wellnessEvents.filter(e => (e.context as any).exerciseType === 'eye').length / Math.max(wellnessEvents.length * 0.3, 1);
    const breathingEngagement = wellnessEvents.filter(e => (e.context as any).exerciseType === 'breath').length / Math.max(wellnessEvents.length * 0.25, 1);
    const stretchEngagement = wellnessEvents.filter(e => (e.context as any).exerciseType === 'stretch').length / Math.max(wellnessEvents.length * 0.25, 1);
    const waterConsumption = wellnessEvents.filter(e => (e.context as any).exerciseType === 'water').length / Math.max(wellnessEvents.length * 0.4, 1);

    // Analyze session length patterns
    const sessionsByDay = this.groupEventsByDay(events);
    const sessionLengths = Object.values(sessionsByDay).map(dayEvents => dayEvents.length);

    const typicalSessionLength = sessionLengths.length > 0
      ? sessionLengths.reduce((sum, len) => sum + len, 0) / sessionLengths.length
      : 8;

    // Assess dehydration risk based on wellness activity frequency
    let dehydrationRisk: 'low' | 'medium' | 'high' = 'high';

    if (waterConsumption > 0.3) dehydrationRisk = 'low';
    else if (waterConsumption > 0.2 || (eyeEngagement > 0.4 && stretchEngagement > 0.4)) dehydrationRisk = 'medium';

    return {
      eyeEngagement: Math.min(eyeEngagement, 1),
      breathingEngagement: Math.min(breathingEngagement, 1),
      stretchEngagement: Math.min(stretchEngagement, 1),
      waterConsumption: Math.min(waterConsumption, 1),
      typicalSessionLength: Math.max(typicalSessionLength, 4),
      dehydrationRisk
    };
  }

  private static groupEventsByDay(events: ActivityEvent[]): { [date: string]: ActivityEvent[] } {
    const grouped: { [date: string]: ActivityEvent[] } = {};

    events.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      grouped[date] = grouped[date] || [];
      grouped[date].push(event);
    });

    return grouped;
  }

  private static buildDailyRoutine(
    period: 'morning' | 'afternoon' | 'evening',
    userPattern: any,
    isPreferredTime: boolean
  ): Array<{ type: string; duration: number; instruction: string }> {
    const baseRoutine: Array<{ type: string; duration: number; instruction: string }> = [];

    if (period === 'morning') {
      baseRoutine.push(
        {
          type: 'breathing',
          duration: 240, // 4 minutes
          instruction: 'Start your day with mindful breathing to center and energize'
        },
        {
          type: 'stretch',
          duration: 120, // 2 minutes
          instruction: 'Gentle morning stretches to loosen overnight stiffness'
        }
      );

      if (userPattern.eyeEngagement > 0.6 || isPreferredTime) {
        baseRoutine.push({
          type: 'eye',
          duration: 60,
          instruction: 'Morning eye exercises to prepare for screen-intensive day'
        });
      }
    }

    if (period === 'afternoon') {
      baseRoutine.push({
        type: 'eye',
        duration: 60,
        instruction: 'Mid-day eye break to combat screen fatigue'
      });

      if (userPattern.stretchEngagement > 0.4) {
        baseRoutine.push({
          type: 'stretch',
          duration: 180,
          instruction: 'Extended stretch session for accumulated tension release'
        });
      }
    }

    if (period === 'evening') {
      baseRoutine.push(
        {
          type: 'breathing',
          duration: 300, // 5 minutes
          instruction: 'Evening breathing to transition from work mode to relaxation'
        },
        {
          type: 'stretch',
          duration: 120,
          instruction: 'Wind-down stretches for better sleep quality'
        }
      );
    }

    return baseRoutine;
  }

  private static createPersonalizedWaterSchedule(
    dehydrationRisk: 'low' | 'medium' | 'high',
    sessionLength: number
  ): Array<{ time: string; amount: string; reason: string }> {
    const baseSchedule: Array<{ time: string; amount: string; reason: string }> = [];

    // Morning hydration
    baseSchedule.push({
      time: '8:00 AM - 9:00 AM',
      amount: '16-20 oz',
      reason: 'Start day with proper hydration after overnight deficit'
    });

    if (dehydrationRisk === 'high' || sessionLength >= 8) {
      // Frequent daytime hydration for high-risk sessions
      baseSchedule.push(
        { time: '11:00 AM', amount: '8-12 oz', reason: 'Mid-morning maintenance hydration' },
        { time: '2:00 PM', amount: '12-16 oz', reason: 'Afternoon energy and focus boost' },
        { time: '4:00 PM', amount: '8-12 oz', reason: 'Prevent evening dehydration effects' }
      );
    } else if (dehydrationRisk === 'medium') {
      // Moderate schedule
      baseSchedule.push(
        { time: '12:00 PM', amount: '12-16 oz', reason: 'Lunchtime hydration reset' },
        { time: '4:00 PM', amount: '8-12 oz', reason: 'Afternoon hydration maintenance' }
      );
    } else {
      // Conservative schedule for low-risk users
      baseSchedule.push(
        { time: 'Midday', amount: '12-16 oz', reason: 'Sustained hydration throughout work session' }
      );
    }

    return baseSchedule;
  }

  private static generateRoutineInsights(
    morning: any[],
    afternoon: any[],
    evening: any[],
    userPattern: any
  ): string[] {
    const insights: string[] = [];

    insights.push(`${morning.length} morning exercises for focused start`);
    insights.push(`${afternoon.length} afternoon activities for sustained energy`);
    insights.push(`${evening.length} evening routines for healthy wind-down`);

    if (userPattern.dehydrationRisk === 'high') {
      insights.push('🎯 High hydration risk - routine includes frequent water reminders');
    }

    if (userPattern.eyeEngagement > 0.6) {
      insights.push('👁️ Eye-focused routine for intensive screen work patterns');
    }

    if (userPattern.breathingEngagement > 0.5) {
      insights.push('🧘 Breathing emphasis suggests stress management priorities');
    }

    return insights;
  }

  private static analyzeNotificationTiming(notificationHistory: Array<{
    timestamp: number;
    type: string;
    successful: boolean;
    responseTime: number;
    userAccepted: boolean;
  }>): { [hour: number]: { sent: number; accepted: number; avgResponseTime: number } } {
    const timingData: { [hour: number]: { sent: number; accepted: number; responseTimes: number[] } } = {};

    notificationHistory.forEach(notification => {
      const hour = new Date(notification.timestamp).getHours();
      timingData[hour] = timingData[hour] || { sent: 0, accepted: 0, responseTimes: [] };

      timingData[hour].sent++;
      if (notification.userAccepted) {
        timingData[hour].accepted++;
        timingData[hour].responseTimes.push(notification.responseTime);
      }
    });

    const result: { [hour: number]: { sent: number; accepted: number; avgResponseTime: number } } = {};

    Object.entries(timingData).forEach(([hour, data]) => {
      const avgResponseTime = data.responseTimes.length > 0
        ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
        : 300; // 5 minute default

      result[parseInt(hour)] = {
        sent: data.sent,
        accepted: data.accepted,
        avgResponseTime
      };
    });

    return result;
  }

  private static analyzeNotificationEngagement(notificationHistory: Array<{
    timestamp: number;
    type: string;
    successful: boolean;
    responseTime: number;
    userAccepted: boolean;
  }>): { [activityType: string]: { successRate: number; avgResponseTime: number; totalSent: number } } {
    const engagementData: { [activityType: string]: { accepted: number; total: number; responseTimes: number[] } } = {};

    notificationHistory.forEach(notification => {
      const type = notification.type;
      engagementData[type] = engagementData[type] || { accepted: 0, total: 0, responseTimes: [] };

      engagementData[type].total++;
      if (notification.userAccepted) {
        engagementData[type].accepted++;
        engagementData[type].responseTimes.push(notification.responseTime);
      }
    });

    const result: { [activityType: string]: { successRate: number; avgResponseTime: number; totalSent: number } } = {};

    Object.entries(engagementData).forEach(([type, data]) => {
      const successRate = data.total > 0 ? data.accepted / data.total : 0;
      const avgResponseTime = data.responseTimes.length > 0
        ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
        : 300;

      result[type] = {
        successRate,
        avgResponseTime,
        totalSent: data.total
      };
    });

    return result;
  }

  private static calculateOptimalNotificationTimes(
    notificationHistory: any[],
    timingData: { [hour: number]: { sent: number; accepted: number; avgResponseTime: number } }
  ): { [activityType: string]: { hours: number[]; confidence: number } } {
    const activityTypes = ['stretch', 'breathing', 'eye', 'water'];
    const result: { [activityType: string]: { hours: number[]; confidence: number } } = {};

    activityTypes.forEach(activityType => {
      const activityNotifications = notificationHistory.filter(n => n.type === activityType);

      if (activityNotifications.length < 10) {
        // Default recommendations for new users
        result[activityType] = {
          hours: activityType === 'water' ? [9, 11, 14, 16] : [9, 14, 16],
          confidence: 0.5
        };
      } else {
        // Find top performing hours for this activity
        const hourlyPerformance = Object.entries(timingData)
          .filter(([hour, data]) => data.sent >= 5) // Minimum sample size
          .map(([hour, data]) => ({
            hour: parseInt(hour),
            successRate: data.accepted / data.sent,
            avgResponseTime: data.avgResponseTime,
            sampleSize: data.sent
          }))
          .sort((a, b) => b.successRate - a.successRate)
          .slice(0, 3);

        const hours = hourlyPerformance.map(h => h.hour);
        const confidence = Math.min(hourlyPerformance.length / 3, 1);

        result[activityType] = { hours, confidence };
      }
    });

    return result;
  }

  private static createPersonalizedMessageStrategies(
    engagementData: { [activityType: string]: { successRate: number; avgResponseTime: number; totalSent: number } },
    notificationHistory: any[]
  ): { [activityType: string]: string[] } {
    const strategies: { [activityType: string]: string[] } = {};

    Object.entries(engagementData).forEach(([activityType, data]) => {
      const messages: string[] = [];

      if (data.successRate > 0.7) {
        messages.push('Excellent response rate - use empowering, positive messaging');
        messages.push('Keep timing consistent with current successful schedule');
      } else if (data.successRate > 0.5) {
        messages.push('Moderate response - try varied messaging and timing experiments');
        messages.push('Consider adding social proof or gentle peer pressure');
      } else {
        messages.push('Low response rate - use gentle, supportive messaging');
        messages.push('Experiment with different reminder styles and times');
        messages.push('Consider contextual triggers based on activity patterns');
      }

      if (data.avgResponseTime > 600) { // More than 10 minutes
        messages.push('Slow response time - consider more immediate rewards');
        messages.push('Try urgency-based messaging for faster engagement');
      } else if (data.avgResponseTime < 120) { // Less than 2 minutes
        messages.push('Quick responses - immediate, clear messaging works well');
      }

      messages.push(`Learned from ${data.totalSent} notification interactions`);

      strategies[activityType] = messages;
    });

    return strategies;
  }

  private static optimizeNotificationFrequency(
    engagementData: { [activityType: string]: { successRate: number; avgResponseTime: number; totalSent: number } },
    totalNotifications: number
  ): { [activityType: string]: 'high' | 'medium' | 'low' } {
    const frequency: { [activityType: string]: 'high' | 'medium' | 'low' } = {};

    Object.entries(engagementData).forEach(([activityType, data]) => {
      if (data.successRate > 0.7 && data.totalSent >= 20) {
        frequency[activityType] = 'high';
      } else if (data.successRate > 0.4 || data.totalSent < 10) {
        frequency[activityType] = 'medium';
      } else {
        frequency[activityType] = 'low';
      }
    });

    return frequency;
  }

  private static generateNotificationLearningInsights(
    timingData: { [hour: number]: { sent: number; accepted: number; avgResponseTime: number } },
    engagementData: { [activityType: string]: { successRate: number; avgResponseTime: number; totalSent: number } }
  ): string[] {
    const insights: string[] = [];

    // Find best performing hours overall
    const bestHours = Object.entries(timingData)
      .filter(([hour, data]) => data.sent >= 10)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        successRate: data.accepted / data.sent
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 2);

    if (bestHours.length >= 1) {
      insights.push(`🏆 Best notification hour: ${this.formatHour(bestHours[0].hour)} (${Math.round(bestHours[0].successRate * 100)}% success)`);
    }

    // Find most engaging activity type
    const bestActivity = Object.entries(engagementData)
      .sort(([, a], [, b]) => b.successRate - a.successRate)[0];

    if (bestActivity) {
      const [activityType, data] = bestActivity;
      insights.push(`💫 Most engaging activity: ${activityType} (${Math.round(data.successRate * 100)}% success rate)`);
    }

    // Check if response times are improving
    const avgResponseTimeTrend = Object.values(engagementData)
      .reduce((sum, data) => sum + data.avgResponseTime, 0) / Object.values(engagementData).length;

    if (avgResponseTimeTrend < 180) { // Under 3 minutes
      insights.push('⚡ Fast response times suggest highly engaged users');
    } else if (avgResponseTimeTrend > 600) { // Over 10 minutes
      insights.push('📊 Response times indicate opportunity for more engaging notifications');
    }

    return insights;
  }
}
