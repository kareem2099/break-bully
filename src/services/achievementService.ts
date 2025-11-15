import * as vscode from 'vscode';
import { Achievement } from '../types';
import { state } from '../models/state';

interface AchievementExport {
  exportDate: string;
  version: string;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'streaks' | 'exercises' | 'goals' | 'consistency';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    unlockedAt: Date | undefined;
    requirement: number;
  }>;
  statistics: AchievementStats;
  totalUnlocked: number;
  totalAvailable: number;
}

interface AchievementStats {
  totalAchievements: number;
  unlockedAchievements: number;
  completionPercentage: number;
  categoryBreakdown: {
    streaks: { unlocked: number; total: number };
    exercises: { unlocked: number; total: number };
    goals: { unlocked: number; total: number };
    consistency: { unlocked: number; total: number };
  };
  rarityBreakdown: {
    common: { unlocked: number; total: number };
    rare: { unlocked: number; total: number };
    epic: { unlocked: number; total: number };
    legendary: { unlocked: number; total: number };
  };
  fastestAchievement: {
    name: string;
    unlockedAt: Date;
    daysToUnlock: number;
  } | null;
  mostUnlockedCategory: {
    category: string;
    unlocked: number;
    total: number;
  };
  averageRarity: string;
}

interface AchievementReport extends AchievementStats {
  unlockedAchievementsArray: Achievement[];
  recentAchievements: Achievement[];
}

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

export function exportAchievements(): AchievementExport {
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

export function getAchievementStats(): AchievementStats {
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
    const category = achievement.category || 'consistency'; // Default fallback
    if (categoryStats[category]) {
      categoryStats[category].total++;
      if (achievement.unlockedAt) {
        categoryStats[category].unlocked++;
      }
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
    const rarity = achievement.rarity || 'common'; // Default fallback
    if (rarityStats[rarity]) {
      rarityStats[rarity].total++;
      if (achievement.unlockedAt) {
        rarityStats[rarity].unlocked++;
      }
    }
  });

  // Find fastest achievement (most recent unlock)
  const sortedByUnlock = unlocked
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(a.unlockedAt!).getTime() - new Date(b.unlockedAt!).getTime());

  const fastestAchievement = sortedByUnlock.length > 0 ? {
    name: sortedByUnlock[0].name,
    unlockedAt: sortedByUnlock[0].unlockedAt!,
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

export function showAchievementsReport(): void {
  const report = generateAchievementReport();

  // Create and show achievements webview panel
  const panel = vscode.window.createWebviewPanel(
    'breakBullyAchievements',
    'Break Bully Achievements',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(vscode.extensions.getExtension('publisher.breakbully')?.extensionPath || '')]
    }
  );

  // Generate detailed HTML content for achievements
  const htmlContent = generateAchievementsHtml(report);
  panel.webview.html = htmlContent;

  // Handle messages from the achievements panel
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'exportAchievements':
          vscode.commands.executeCommand('breakBully.exportAchievements');
          break;
        case 'refreshData':
          { const updatedReport = generateAchievementReport();
          panel.webview.postMessage({
            command: 'updateReport',
            data: updatedReport
          });
          break; }
      }
    },
    undefined,
    []
  );
}

function generateAchievementsHtml(report: AchievementReport): string {
  const totalAchievements = state.achievements.length;
  const unlockedAchievements = report.unlockedAchievementsArray.length;
  const completionRate = totalAchievements > 0 ? Math.round((unlockedAchievements / totalAchievements) * 100) : 0;

  const categoryHtml = Object.entries(report.categoryBreakdown).map(([category, stats]: [string, { unlocked: number; total: number }]) => `
    <div class="stat-card">
        <div class="stat-value">${stats.unlocked}/${stats.total}</div>
        <div class="stat-label">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
    </div>
  `).join('');

  const rarityHtml = Object.entries(report.rarityBreakdown).map(([rarity, stats]: [string, { unlocked: number; total: number }]) => {
    const rarityEmoji = { common: '🥉', rare: '🥈', epic: '🥇', legendary: '👑' }[rarity] || '🏅';
    return `
      <div class="stat-card">
          <div class="stat-value">${rarityEmoji} ${stats.unlocked}/${stats.total}</div>
          <div class="stat-label">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</div>
      </div>
    `;
  }).join('');

  const recentAchievementsHtml = report.recentAchievements.map((achievement: Achievement) => `
    <div class="achievement-item unlocked">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-content">
            <div class="achievement-text">${achievement.name}</div>
            <div class="achievement-description">${achievement.description}</div>
            <div class="achievement-unlocked-date">
                Unlocked: ${achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}
            </div>
        </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Break Bully Achievements</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, #1e1e1e 0%, #252526 100%);
                color: #d4d4d4;
                margin: 0;
                padding: 20px;
                line-height: 1.6;
            }

            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid #3e3e42;
            }

            .header h1 {
                font-size: 28px;
                font-weight: 700;
                margin: 0 0 10px 0;
                background: linear-gradient(135deg, #4f8bd6, #89d185);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .header p {
                font-size: 16px;
                color: #cccccc;
                margin: 0;
            }

            .progress-circle {
                position: relative;
                width: 150px;
                height: 150px;
                margin: 30px auto;
            }

            .progress-circle circle {
                fill: none;
                stroke-width: 12;
                transform: translate(75px, 75px) rotate(-90deg);
            }

            .progress-bg {
                stroke: #3e3e42;
            }

            .progress-fill {
                stroke: #89d185;
                stroke-dasharray: ${283};
                stroke-dashoffset: ${283 - (283 * completionRate / 100)};
                transition: stroke-dashoffset 1.5s ease-in-out;
            }

            .progress-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 28px;
                font-weight: 700;
                color: #4f8bd6;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 30px;
            }

            .stat-card {
                background: #252526;
                border: 1px solid #3e3e42;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            }

            .stat-value {
                font-size: 24px;
                font-weight: 700;
                color: #4f8bd6;
                margin-bottom: 8px;
            }

            .stat-label {
                font-size: 14px;
                color: #cccccc;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
            }

            .section {
                background: #252526;
                border: 1px solid #3e3e42;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
            }

            .section h2 {
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 15px 0;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .recent-achievements {
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-height: 400px;
                overflow-y: auto;
            }

            .achievement-item {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding: 16px;
                background: linear-gradient(135deg, #252526 0%, rgba(37, 37, 38, 0.9) 100%);
                border-radius: 10px;
                border: 1px solid #3e3e42;
                transition: transform 0.2s ease;
            }

            .achievement-item:hover {
                transform: translateY(-2px);
            }

            .achievement-icon {
                font-size: 32px;
                flex-shrink: 0;
            }

            .achievement-content {
                flex: 1;
                min-width: 0;
            }

            .achievement-text {
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 4px;
            }

            .achievement-description {
                font-size: 13px;
                color: #cccccc;
                margin-bottom: 6px;
                line-height: 1.4;
            }

            .achievement-unlocked-date {
                font-size: 11px;
                color: #89d185;
                font-weight: 500;
            }

            .actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-top: 30px;
            }

            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .btn-primary {
                background: linear-gradient(135deg, #4f8bd6, #89d185);
                color: white;
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(79, 139, 214, 0.4);
            }

            .btn-secondary {
                background: #5f6a79;
                color: #ffffff;
                border: 1px solid #4c5561;
            }

            .btn-secondary:hover {
                background: #4c5561;
                transform: translateY(-1px);
            }

            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #cccccc;
            }

            .empty-state .empty-icon {
                font-size: 64px;
                margin-bottom: 20px;
                opacity: 0.6;
            }

            .empty-state .empty-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 12px;
                color: #ffffff;
            }

            .empty-state .empty-description {
                font-size: 16px;
                line-height: 1.5;
                max-width: 400px;
                margin: 0 auto;
                opacity: 0.8;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏆 Achievement Gallery</h1>
            <p>Explore all your wellness achievements and milestones</p>
        </div>

        <div class="progress-circle">
            <svg width="150" height="150">
                <circle class="progress-bg" r="65"></circle>
                <circle class="progress-fill" r="65"></circle>
            </svg>
            <div class="progress-text">${completionRate}%</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${unlockedAchievements}/${totalAchievements}</div>
                <div class="stat-label">Total Progress</div>
            </div>
            ${categoryHtml}
        </div>

        <div class="stats-grid">
            ${rarityHtml}
        </div>

        <div class="section">
            <h2>🏅 Recent Achievements</h2>
            <div class="recent-achievements">
                ${recentAchievementsHtml || '<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">No recent achievements</div><div class="empty-description">Keep working on your wellness goals to unlock more achievements!</div></div>'}
            </div>
        </div>

        <div class="actions">
            <button class="btn btn-primary" onclick="exportAchievements()">
                📤 Export Achievements
            </button>
            <button class="btn btn-secondary" onclick="refreshData()">
                🔄 Refresh Data
            </button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function exportAchievements() {
                vscode.postMessage({ command: 'exportAchievements' });
            }

            function refreshData() {
                vscode.postMessage({ command: 'refreshData' });
            }

            // Listen for updates from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateReport') {
                    // Could refresh the display with new data
                    console.log('Achievements updated:', message.data);
                }
            });
        </script>
    </body>
    </html>
  `;
}

function generateAchievementReport(): AchievementReport {
  const unlockedAchievements = getUnlockedAchievements();
  const stats = getAchievementStats();
  const recentAchievements = getRecentAchievements(7);

  return {
    unlockedAchievementsArray: unlockedAchievements,
    recentAchievements,
    ...stats
  };
}
