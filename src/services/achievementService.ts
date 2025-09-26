import * as vscode from 'vscode';
import { Achievement } from '../types';
import { state } from '../models/state';

// Predefined achievements
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  // Streak Achievements
  {
    id: 'first-break',
    name: 'First Steps',
    description: 'Take your first break',
    detailedDescription: 'Every wellness journey begins with a single step. Congratulations on taking your first break!',
    icon: '🎯',
    category: 'streaks',
    rarity: 'common',
    requirement: 1
  },
  {
    id: 'break-streak-3',
    name: 'Getting Started',
    description: 'Take breaks for 3 consecutive days',
    detailedDescription: 'Building healthy habits takes consistency. You\'ve shown great dedication by maintaining a 3-day break streak!',
    icon: '🔥',
    category: 'streaks',
    rarity: 'common',
    requirement: 3
  },
  {
    id: 'break-streak-7',
    name: 'Week Warrior',
    description: 'Take breaks for 7 consecutive days',
    detailedDescription: 'A full week of consistent wellness habits! You\'re developing the discipline that leads to lasting health improvements.',
    icon: '⚡',
    category: 'streaks',
    rarity: 'rare',
    requirement: 7
  },
  {
    id: 'break-streak-30',
    name: 'Monthly Master',
    description: 'Take breaks for 30 consecutive days',
    detailedDescription: 'An entire month of unbroken commitment to your wellness! This level of consistency is truly remarkable and life-changing.',
    icon: '👑',
    category: 'streaks',
    rarity: 'epic',
    requirement: 30
  },

  // Exercise Achievements
  {
    id: 'first-exercise',
    name: 'Exercise Explorer',
    description: 'Complete your first exercise',
    detailedDescription: 'Movement is medicine for the mind and body. You\'ve taken the first step toward a more active, healthier lifestyle!',
    icon: '💪',
    category: 'exercises',
    rarity: 'common',
    requirement: 1
  },
  {
    id: 'exercise-10',
    name: 'Fitness Fan',
    description: 'Complete 10 exercises',
    detailedDescription: 'Ten exercises completed! You\'re building momentum and discovering how good movement feels.',
    icon: '🏃‍♂️',
    category: 'exercises',
    rarity: 'common',
    requirement: 10
  },
  {
    id: 'exercise-50',
    name: 'Wellness Warrior',
    description: 'Complete 50 exercises',
    detailedDescription: 'Fifty exercises conquered! You\'ve transformed exercise from a chore into a cherished part of your routine.',
    icon: '🛡️',
    category: 'exercises',
    rarity: 'rare',
    requirement: 50
  },

  // Goal Achievements
  {
    id: 'first-goal',
    name: 'Goal Getter',
    description: 'Complete your first wellness goal',
    detailedDescription: 'Setting and achieving goals is the foundation of personal growth. You\'ve proven you have what it takes!',
    icon: '🎯',
    category: 'goals',
    rarity: 'common',
    requirement: 1
  },
  {
    id: 'goals-10',
    name: 'Goal Crusher',
    description: 'Complete 10 wellness goals',
    detailedDescription: 'Ten goals achieved! You\'re not just setting targets - you\'re crushing them and building an unstoppable momentum.',
    icon: '💎',
    category: 'goals',
    rarity: 'rare',
    requirement: 10
  },
  {
    id: 'first-challenge',
    name: 'Challenge Champion',
    description: 'Complete your first wellness challenge',
    detailedDescription: 'Challenges test our limits and reveal our potential. You\'ve emerged victorious from your first major wellness battle!',
    icon: '🏆',
    category: 'goals',
    rarity: 'rare',
    requirement: 1
  },

  // Consistency Achievements
  {
    id: 'breaks-50',
    name: 'Break Master',
    description: 'Take 50 breaks total',
    detailedDescription: 'Fifty breaks taken with intention and care. You\'re mastering the art of work-life balance!',
    icon: '🎖️',
    category: 'consistency',
    rarity: 'common',
    requirement: 50
  },
  {
    id: 'breaks-100',
    name: 'Century Club',
    description: 'Take 100 breaks total',
    detailedDescription: 'One hundred mindful breaks! This milestone represents a significant investment in your long-term health and productivity.',
    icon: '💯',
    category: 'consistency',
    rarity: 'epic',
    requirement: 100
  },
  {
    id: 'screen-time-savior',
    name: 'Screen Time Savior',
    description: 'Take 25 eye breaks',
    detailedDescription: 'Twenty-five eye breaks completed! You\'re protecting your vision and preventing eye strain with consistent, proactive care.',
    icon: '👁️',
    category: 'consistency',
    rarity: 'rare',
    requirement: 25
  },
  {
    id: 'perfect-week',
    name: 'Perfect Week',
    description: 'Complete all daily goals for 7 consecutive days',
    detailedDescription: 'A flawless week of wellness! You\'ve maintained perfect consistency across all your health goals for an entire week.',
    icon: '🌟',
    category: 'consistency',
    rarity: 'epic',
    requirement: 7
  },
  {
    id: 'no-missed-breaks',
    name: 'Unbreakable',
    description: 'Go 7 days without missing a single break reminder',
    detailedDescription: 'Seven days of perfect adherence! You\'ve shown incredible discipline by never missing a break reminder.',
    icon: '🛡️',
    category: 'consistency',
    rarity: 'legendary',
    requirement: 7
  },

  // Time-based Achievements
  {
    id: 'eight-hour-session',
    name: 'Marathon Coder',
    description: 'Code for 8 hours in a single session',
    detailedDescription: 'Eight hours of focused coding! You\'ve demonstrated remarkable concentration and endurance in a single coding session.',
    icon: '🏃‍♂️',
    category: 'consistency',
    rarity: 'rare',
    requirement: 480 // minutes
  },
  {
    id: 'work-hours-breaks',
    name: 'Professional Balance',
    description: 'Take breaks during standard work hours (9 AM - 6 PM)',
    detailedDescription: 'You\'ve learned to maintain work-life balance even during peak productivity hours. Smart breaks during work time!',
    icon: '💼',
    category: 'consistency',
    rarity: 'rare',
    requirement: 10
  },

  // Exercise-specific Achievements
  {
    id: 'stretch-master',
    name: 'Stretch Champion',
    description: 'Complete 25 stretch exercises',
    detailedDescription: 'Twenty-five stretches completed! Your body thanks you for maintaining flexibility and preventing muscle tension.',
    icon: '🤸',
    category: 'exercises',
    rarity: 'rare',
    requirement: 25
  },
  {
    id: 'breathing-guru',
    name: 'Breathing Guru',
    description: 'Complete 20 breathing exercises',
    detailedDescription: 'Twenty breathing exercises mastered! You\'ve developed excellent breath control and stress management techniques.',
    icon: '🧘',
    category: 'exercises',
    rarity: 'rare',
    requirement: 20
  },
  {
    id: 'eye-care-expert',
    name: 'Vision Guardian',
    description: 'Complete 30 eye exercises',
    detailedDescription: 'Thirty eye exercises completed! You\'re a true guardian of your vision, preventing eye strain and maintaining healthy eyesight.',
    icon: '👁️',
    category: 'exercises',
    rarity: 'rare',
    requirement: 30
  },

  // Screen time Achievements
  {
    id: 'screen-time-reducer',
    name: 'Digital Detox',
    description: 'Reduce average daily screen time by 20%',
    detailedDescription: 'You\'ve successfully reduced your screen time by 20%! This conscious effort protects your eyes and mental health.',
    icon: '📱',
    category: 'consistency',
    rarity: 'rare',
    requirement: 20 // percentage reduction
  },
  {
    id: 'perfect-eye-timing',
    name: 'Timing Master',
    description: 'Take eye breaks within 5 minutes of screen time warnings',
    detailedDescription: 'Perfect timing! You consistently take eye breaks right when needed, showing proactive care for your vision health.',
    icon: '⏰',
    category: 'consistency',
    rarity: 'epic',
    requirement: 15
  },
  {
    id: 'low-screen-day',
    name: 'Light User',
    description: 'Keep daily screen time under 6 hours',
    detailedDescription: 'A balanced digital lifestyle! You\'ve maintained healthy screen time limits, protecting both your eyes and mental well-being.',
    icon: '🌅',
    category: 'consistency',
    rarity: 'rare',
    requirement: 360 // minutes (6 hours)
  }
];

export function initializeAchievements(): void {
  if (!state.storage) {
    console.error('Storage not initialized');
    return;
  }

  // Ensure all predefined achievements exist in state
  ACHIEVEMENT_DEFINITIONS.forEach(def => {
    if (!state.achievements.find(a => a.id === def.id)) {
      state.achievements.push({
        ...def,
        progress: 0
      });
    }
  });

  // Save to storage
  state.storage.saveAchievements(state.achievements);
}

export function checkAchievements(): void {
  const config = vscode.workspace.getConfiguration('breakBully');
  if (!config.get('enableAchievements', true)) return;

  let newUnlocks: Achievement[] = [];

  state.achievements.forEach(achievement => {
    if (achievement.unlockedAt) return; // Already unlocked

    const progress = getAchievementProgress(achievement.id);
    achievement.progress = progress;

    if (progress >= achievement.requirement) {
      achievement.unlockedAt = new Date();
      newUnlocks.push(achievement);
    }
  });

  // Save updated achievements
  if (state.storage) {
    state.storage.saveAchievements(state.achievements);
  }

  // Celebrate new unlocks
  newUnlocks.forEach(achievement => {
    celebrateAchievement(achievement);
  });
}

function getAchievementProgress(achievementId: string): number {
  switch (achievementId) {
    // Basic break achievements
    case 'first-break':
    case 'breaks-50':
    case 'breaks-100':
      return state.breakStats.breaksTaken;

    // Streak achievements
    case 'break-streak-3':
    case 'break-streak-7':
    case 'break-streak-30':
      return state.breakStats.streakDays;

    // Exercise achievements
    case 'first-exercise':
    case 'exercise-10':
    case 'exercise-50':
      // This would need to be tracked separately - for now, estimate based on goals
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'exercises')
        .reduce((sum, g) => sum + g.current, 0));

    // Goal achievements
    case 'first-goal':
    case 'goals-10':
      return state.wellnessGoals.filter(g => g.completed).length;

    case 'first-challenge':
      return state.wellnessChallenges.filter(c => c.completed).length;

    // Screen time achievements
    case 'screen-time-savior':
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'screen-breaks')
        .reduce((sum, g) => sum + g.current, 0));

    // Advanced consistency achievements
    case 'perfect-week':
      // Would need to track consecutive days with all goals completed
      // For now, return 0 as this requires more complex tracking
      return 0;

    case 'no-missed-breaks':
      // Would need to track missed break reminders
      // For now, return current streak as approximation
      return state.breakStats.streakDays;

    // Time-based achievements
    case 'eight-hour-session':
      // Track longest coding session in minutes
      // For now, return current session time
      if (state.screenTimeStats.codingSessionStart) {
        return Math.floor((Date.now() - state.screenTimeStats.codingSessionStart.getTime()) / (1000 * 60));
      }
      return 0;

    case 'work-hours-breaks':
      // Would need to track breaks taken during work hours (9 AM - 6 PM)
      // For now, return total breaks as approximation
      return state.breakStats.breaksTaken;

    // Exercise-specific achievements
    case 'stretch-master':
      // Would need to track specific exercise types
      // For now, estimate based on exercise goals
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'exercises')
        .reduce((sum, g) => sum + g.current, 0) * 0.6); // Assume 60% are stretches

    case 'breathing-guru':
      // Would need to track breathing exercises specifically
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'exercises')
        .reduce((sum, g) => sum + g.current, 0) * 0.3); // Assume 30% are breathing

    case 'eye-care-expert':
      // Would need to track eye exercises specifically
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'screen-breaks')
        .reduce((sum, g) => sum + g.current, 0));

    case 'screen-time-reducer':
      // Would need to track screen time reduction over time
      // For now, return 0 as this requires historical data
      return 0;

    case 'perfect-eye-timing':
      // Would need to track timing of eye breaks
      // For now, return screen breaks as approximation
      return Math.floor(state.wellnessGoals
        .filter(g => g.category === 'screen-breaks')
        .reduce((sum, g) => sum + g.current, 0));

    case 'low-screen-day':
      // Check if today's screen time is under 6 hours
      return state.screenTimeStats.totalScreenTimeToday <= 360 ? 360 : 0;

    default:
      return 0;
  }
}

function celebrateAchievement(achievement: Achievement): void {
  // Show notification
  vscode.window.showInformationMessage(
    `🏆 Achievement Unlocked: ${achievement.name}`,
    achievement.description
  );

  // Send to webview for celebration
  if (state.activityBarProvider) {
    state.activityBarProvider.postMessage({
      command: 'celebrateAchievement',
      data: {
        achievement: achievement.name,
        description: achievement.description,
        icon: achievement.icon
      }
    });
  }
}

export function getUnlockedAchievements(): Achievement[] {
  return state.achievements.filter(a => a.unlockedAt);
}

export function getAchievementProgressText(achievement: Achievement): string {
  if (achievement.unlockedAt) {
    return '✅ Unlocked';
  }

  const progress = achievement.progress || 0;
  const percentage = Math.min((progress / achievement.requirement) * 100, 100);
  return `${progress}/${achievement.requirement} (${Math.round(percentage)}%)`;
}

export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return state.achievements.filter(a => a.category === category);
}

export function exportAchievements(): any {
  const unlockedAchievements = getUnlockedAchievements();
  const stats = getAchievementStats();

  return {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    achievements: unlockedAchievements.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      rarity: a.rarity,
      unlockedAt: a.unlockedAt,
      requirement: a.requirement
    })),
    statistics: stats,
    totalUnlocked: unlockedAchievements.length,
    totalAvailable: state.achievements.length
  };
}

export function getAchievementStats(): any {
  const unlocked = getUnlockedAchievements();
  const all = state.achievements;

  // Category breakdown
  const categoryStats = {
    streaks: { unlocked: 0, total: 0 },
    exercises: { unlocked: 0, total: 0 },
    goals: { unlocked: 0, total: 0 },
    consistency: { unlocked: 0, total: 0 }
  };

  all.forEach(achievement => {
    categoryStats[achievement.category].total++;
    if (achievement.unlockedAt) {
      categoryStats[achievement.category].unlocked++;
    }
  });

  // Rarity breakdown
  const rarityStats = {
    common: { unlocked: 0, total: 0 },
    rare: { unlocked: 0, total: 0 },
    epic: { unlocked: 0, total: 0 },
    legendary: { unlocked: 0, total: 0 }
  };

  all.forEach(achievement => {
    rarityStats[achievement.rarity].total++;
    if (achievement.unlockedAt) {
      rarityStats[achievement.rarity].unlocked++;
    }
  });

  // Find fastest achievement (most recent unlock)
  const sortedByUnlock = unlocked
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(a.unlockedAt!).getTime() - new Date(b.unlockedAt!).getTime());

  const fastestAchievement = sortedByUnlock.length > 0 ? {
    name: sortedByUnlock[0].name,
    unlockedAt: sortedByUnlock[0].unlockedAt,
    daysToUnlock: Math.floor((new Date(sortedByUnlock[0].unlockedAt!).getTime() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24))
  } : null;

  // Most unlocked category
  const mostUnlockedCategory = Object.entries(categoryStats)
    .sort(([,a], [,b]) => b.unlocked - a.unlocked)[0];

  return {
    totalAchievements: all.length,
    unlockedAchievements: unlocked.length,
    completionPercentage: Math.round((unlocked.length / all.length) * 100),
    categoryBreakdown: categoryStats,
    rarityBreakdown: rarityStats,
    fastestAchievement,
    mostUnlockedCategory: {
      category: mostUnlockedCategory[0],
      unlocked: mostUnlockedCategory[1].unlocked,
      total: mostUnlockedCategory[1].total
    },
    averageRarity: calculateAverageRarity(unlocked)
  };
}

function calculateAverageRarity(achievements: Achievement[]): string {
  if (achievements.length === 0) return 'none';

  const rarityValues = { common: 1, rare: 2, epic: 3, legendary: 4 };
  const total = achievements.reduce((sum, a) => sum + rarityValues[a.rarity], 0);
  const average = total / achievements.length;

  if (average >= 3.5) return 'legendary';
  if (average >= 2.5) return 'epic';
  if (average >= 1.5) return 'rare';
  return 'common';
}

export function generateAchievementShareText(achievement: Achievement): string {
  const rarityEmoji = {
    common: '🥉',
    rare: '🥈',
    epic: '🥇',
    legendary: '👑'
  };

  return `🏆 Achievement Unlocked: ${achievement.name} ${rarityEmoji[achievement.rarity]}\n` +
         `${achievement.description}\n` +
         `#BreakBully #Wellness #Achievement`;
}

export function getRecentAchievements(days: number = 7): Achievement[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return getUnlockedAchievements()
    .filter(a => a.unlockedAt && new Date(a.unlockedAt) >= cutoffDate)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime());
}
