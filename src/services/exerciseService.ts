import * as vscode from 'vscode';
import * as path from 'path';
import { StretchExercise, BreathingExercise, EyeExercise, Exercise, CustomExercise, ExerciseCategory, DifficultyLevel } from '../types';
import { getConfiguration } from '../core/configuration';
import { state } from '../models/state';
import { ExtensionStorage } from '../utils/storage';
import { showExerciseCompletionNotification, showExerciseProgressNotification, showExerciseStartNotification } from '../utils/notifications';

// ===== GIT INTEGRATION SERVICE =====

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitProductivityStats {
  commitsToday: number;
  commitsThisSession: number;
  averageCommitsPerHour: number;
  lastCommitTime: Date | null;
  productiveSession: boolean;
  shouldSuggestBreak: boolean;
}

interface GitCommit {
  hash: string;
  message: string;
  authorName: string;
  date: Date;
  parents?: unknown[];
  authorEmail?: string;
}

interface WaterTip {
  title: string;
  duration: string;
  instructions: string;
  benefits: string[];
  steps: string[];
}

interface GitRepository {
  log(options: { maxEntries: number; since: Date }): Promise<GitCommit[]>;
}

interface GitAPI {
  repositories: readonly GitRepository[];
  getRepository?(uri: unknown): unknown;
}

class GitIntegrationService {
  private gitExtension: GitAPI | null = null;
  private commitHistory: CommitInfo[] = [];
  private sessionStartTime: Date = new Date();

  constructor() {
    this.initializeGitExtension();
  }

  private async initializeGitExtension(): Promise<void> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        await gitExtension.activate();
        this.gitExtension = gitExtension.exports.getAPI(1);
        console.log('Git extension initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize Git extension:', error);
    }
  }

  async getRecentCommits(hours: number = 24): Promise<CommitInfo[]> {
    if (!this.gitExtension) {
      return [];
    }

    try {
      const repositories = this.gitExtension.repositories;
      if (!repositories || repositories.length === 0) {
        return [];
      }

      const repo = repositories[0]; // Use the first repository
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

      const commits = await repo.log({ maxEntries: 50, since });

      return commits.map((commit: GitCommit): CommitInfo => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.authorName,
        date: commit.date,
        filesChanged: commit.parents?.length || 0,
        insertions: 0, // Would need more complex parsing
        deletions: 0
      }));
    } catch (error) {
      console.warn('Failed to get recent commits:', error);
      return [];
    }
  }

  async analyzeProductivity(): Promise<GitProductivityStats> {
    const recentCommits = await this.getRecentCommits(24);
    const sessionCommits = recentCommits.filter(commit =>
      commit.date >= this.sessionStartTime
    );

    const now = new Date();
    const sessionHours = (now.getTime() - this.sessionStartTime.getTime()) / (1000 * 60 * 60);

    const stats: GitProductivityStats = {
      commitsToday: recentCommits.length,
      commitsThisSession: sessionCommits.length,
      averageCommitsPerHour: sessionHours > 0 ? sessionCommits.length / sessionHours : 0,
      lastCommitTime: recentCommits.length > 0 ? recentCommits[0].date : null,
      productiveSession: false,
      shouldSuggestBreak: false
    };

    // Determine if this is a productive session
    stats.productiveSession = stats.commitsThisSession >= 2 || stats.averageCommitsPerHour >= 1;

    // Suggest break after certain milestones
    const config = getConfiguration();
    const commitThreshold = config.gitCommitThreshold || 3;

    stats.shouldSuggestBreak = stats.commitsThisSession >= commitThreshold &&
                              stats.productiveSession &&
                              this.shouldSuggestBreakAfterRecentCommit(recentCommits);

    return stats;
  }

  private shouldSuggestBreakAfterRecentCommit(commits: CommitInfo[]): boolean {
    if (commits.length === 0) return false;

    const lastCommit = commits[0];
    const timeSinceLastCommit = Date.now() - lastCommit.date.getTime();
    const minutesSinceLastCommit = timeSinceLastCommit / (1000 * 60);

    // Suggest break if last commit was recent (within last 30 minutes)
    // and there have been multiple commits recently
    return minutesSinceLastCommit <= 30 && commits.length >= 2;
  }

  async triggerSmartBreakSuggestion(): Promise<void> {
    const stats = await this.analyzeProductivity();

    if (stats.shouldSuggestBreak) {
      const commitCount = stats.commitsThisSession;
      const message = this.generateBreakSuggestionMessage(commitCount, stats);

      // Show the suggestion
      const result = await vscode.window.showInformationMessage(
        message,
        'Take a Break',
        'Continue Working'
      );

      if (result === 'Take a Break') {
        // Trigger a break
        const breakService = await import('./breakService');
        breakService.takeBreak();
      }
    }
  }

  private generateBreakSuggestionMessage(commitCount: number, stats: GitProductivityStats): string {
    const baseMessages = [
      `🎉 ${commitCount} commits down! Your code is looking great. Ready for a well-deserved break?`,
      `💪 ${commitCount} commits completed! You've been productive - time to recharge.`,
      `🚀 ${commitCount} commits pushed! Great work today. How about a quick break?`,
      `📈 ${commitCount} commits in this session! You're on fire. Take a moment to celebrate with a break.`,
      `⚡ ${commitCount} commits accomplished! Your productivity is impressive. Break time!`
    ];

    // Customize message based on productivity stats
    let messageIndex = Math.min(commitCount - 1, baseMessages.length - 1);

    // Use productivity level to enhance the message
    if (stats.productiveSession && stats.averageCommitsPerHour >= 2) {
      // Highly productive session - add encouragement
      return `${baseMessages[messageIndex]} Your productivity stats show you're in the zone!`;
    } else if (stats.productiveSession && stats.commitsToday > commitCount) {
      // Has been productive throughout the day
      return `${baseMessages[messageIndex]} You've had a productive day overall!`;
    }

    return baseMessages[messageIndex];
  }

  resetSession(): void {
    this.sessionStartTime = new Date();
  }
}

// Global Git service instance
let gitService: GitIntegrationService | null = null;

export function initializeGitIntegration(): void {
  gitService = new GitIntegrationService();
}

export function getGitProductivityStats(): Promise<GitProductivityStats> {
  return gitService?.analyzeProductivity() || Promise.resolve({
    commitsToday: 0,
    commitsThisSession: 0,
    averageCommitsPerHour: 0,
    lastCommitTime: null,
    productiveSession: false,
    shouldSuggestBreak: false
  });
}

export function triggerGitBasedBreakSuggestion(): Promise<void> {
  return gitService?.triggerSmartBreakSuggestion() || Promise.resolve();
}

export function resetGitSession(): void {
  gitService?.resetSession();
}

// ===== GIT PRODUCTIVITY DASHBOARD =====

export function showGitProductivityDashboard(): void {
  const panel = vscode.window.createWebviewPanel(
    'breakBullyGitProductivity',
    'Git Productivity Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'views'))]
    }
  );

  // Get initial Git stats
  getGitProductivityStats().then(stats => {
    const recentCommits = gitService ? gitService.getRecentCommits(24) : Promise.resolve([]);

    Promise.all([stats, recentCommits]).then(([stats, commits]) => {
      panel.webview.html = generateGitDashboardHtml(stats, commits);
    }).catch(error => {
      console.error('Failed to load Git stats:', error);
      panel.webview.html = generateGitDashboardHtml(stats, []);
    });
  }).catch(error => {
    console.error('Failed to get Git stats:', error);
    panel.webview.html = generateGitDashboardHtml({
      commitsToday: 0,
      commitsThisSession: 0,
      averageCommitsPerHour: 0,
      lastCommitTime: null,
      productiveSession: false,
      shouldSuggestBreak: false
    }, []);
  });

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'refreshStats':
          getGitProductivityStats().then(stats => {
            const recentCommits = gitService ? gitService.getRecentCommits(24) : Promise.resolve([]);
            Promise.all([stats, recentCommits]).then(([stats, commits]) => {
              panel.webview.postMessage({
                command: 'updateStats',
                data: { stats, commits }
              });
            });
          });
          break;
        case 'takeBreak':
          import('./breakService').then(breakService => {
            breakService.takeBreak();
            panel.dispose();
          });
          break;
        case 'closePanel':
          panel.dispose();
          break;
      }
    },
    undefined,
    []
  );
}

function generateGitDashboardHtml(stats: GitProductivityStats, commits: CommitInfo[]): string {
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getProductivityLevel = (stats: GitProductivityStats) => {
    if (stats.commitsThisSession >= 5) return { level: 'High', color: '#4CAF50', icon: '🚀' };
    if (stats.commitsThisSession >= 3) return { level: 'Good', color: '#2196F3', icon: '💪' };
    if (stats.commitsThisSession >= 1) return { level: 'Moderate', color: '#FF9800', icon: '📈' };
    return { level: 'Low', color: '#9E9E9E', icon: '😴' };
  };

  const productivity = getProductivityLevel(stats);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Git Productivity Dashboard</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-editor-foreground, #d4d4d4);
                padding: 20px;
                margin: 0;
                overflow-x: hidden;
            }
            .dashboard-container {
                max-width: 900px;
                margin: 0 auto;
            }
            .dashboard-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .dashboard-title {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .dashboard-subtitle {
                color: var(--vscode-descriptionForeground, #cccccc99);
                font-size: 16px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
            }
            .stat-value {
                font-size: 32px;
                font-weight: 700;
                color: var(--vscode-charts-blue, #4f8bd6);
                margin-bottom: 8px;
            }
            .stat-label {
                color: var(--vscode-descriptionForeground, #cccccc99);
                font-size: 14px;
                margin-bottom: 12px;
            }
            .stat-trend {
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
            }
            .productivity-card {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 30px;
                text-align: center;
            }
            .productivity-level {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .productivity-icon {
                font-size: 32px;
                margin-bottom: 12px;
            }
            .break-suggestion {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .break-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--vscode-charts-green, #89d185);
            }
            .commits-section {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .commits-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                color: var(--vscode-foreground, #d4d4d4);
            }
            .commit-item {
                display: flex;
                align-items: flex-start;
                padding: 12px;
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 8px;
                margin-bottom: 8px;
                background: var(--vscode-editor-background, #1e1e1e);
            }
            .commit-hash {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: var(--vscode-charts-blue, #4f8bd6);
                margin-right: 12px;
                min-width: 60px;
            }
            .commit-content {
                flex: 1;
            }
            .commit-message {
                font-weight: 500;
                margin-bottom: 4px;
            }
            .commit-meta {
                font-size: 12px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .no-commits {
                text-align: center;
                color: var(--vscode-descriptionForeground, #cccccc99);
                padding: 40px;
                font-style: italic;
            }
            .actions-section {
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .action-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            .action-btn.primary {
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                color: white;
            }
            .action-btn.primary:hover {
                background: linear-gradient(135deg, #ff5252 0%, #45b7d1 100%);
            }
            .action-btn.secondary {
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
            }
            .action-btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            @media (max-width: 600px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                .actions-section {
                    flex-direction: column;
                }
                .action-btn {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="dashboard-container">
            <div class="dashboard-header">
                <h1 class="dashboard-title">🚀 Git Productivity Dashboard</h1>
                <p class="dashboard-subtitle">Track your coding activity and get smart break suggestions</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.commitsToday}</div>
                    <div class="stat-label">Commits Today</div>
                    <div class="stat-trend" style="background: ${stats.commitsToday > 0 ? '#4CAF50' : '#9E9E9E'}">
                        ${stats.commitsToday > 0 ? 'Active' : 'Inactive'}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.commitsThisSession}</div>
                    <div class="stat-label">Session Commits</div>
                    <div class="stat-trend" style="background: ${productivity.color}">
                        ${productivity.level}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.averageCommitsPerHour.toFixed(1)}</div>
                    <div class="stat-label">Avg Commits/Hour</div>
                    <div class="stat-trend" style="background: ${stats.averageCommitsPerHour > 1 ? '#4CAF50' : '#FF9800'}">
                        ${stats.averageCommitsPerHour > 1 ? 'High' : 'Normal'}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatTime(stats.lastCommitTime)}</div>
                    <div class="stat-label">Last Commit</div>
                    <div class="stat-trend" style="background: ${stats.lastCommitTime ? '#2196F3' : '#9E9E9E'}">
                        ${stats.lastCommitTime ? 'Recent' : 'None'}
                    </div>
                </div>
            </div>

            <div class="productivity-card">
                <div class="productivity-icon">${productivity.icon}</div>
                <div class="productivity-level" style="color: ${productivity.color}">
                    ${productivity.level} Productivity Level
                </div>
                <div style="color: var(--vscode-descriptionForeground, #cccccc99); margin-top: 8px;">
                    ${stats.productiveSession ?
                        'You\'re having a productive coding session!' :
                        'Keep coding to build momentum!'}
                </div>
            </div>

            ${stats.shouldSuggestBreak ? `
                <div class="break-suggestion">
                    <div class="break-title">💡 Break Suggestion</div>
                    <p style="margin-bottom: 16px; line-height: 1.5;">
                        Based on your ${stats.commitsThisSession} commits this session,
                        you might benefit from a short break to maintain productivity and prevent burnout.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="action-btn primary" onclick="takeBreak()">Take a Break Now</button>
                        <button class="action-btn secondary" onclick="continueWorking()">Continue Working</button>
                    </div>
                </div>
            ` : ''}

            <div class="commits-section">
                <div class="commits-title">📝 Recent Commits (Last 24 Hours)</div>
                ${commits.length > 0 ? commits.slice(0, 10).map(commit => `
                    <div class="commit-item">
                        <div class="commit-hash">${commit.hash.substring(0, 7)}</div>
                        <div class="commit-content">
                            <div class="commit-message">${commit.message}</div>
                            <div class="commit-meta">
                                ${commit.author} • ${formatTime(commit.date)} •
                                ${commit.filesChanged} file${commit.filesChanged !== 1 ? 's' : ''} changed
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="no-commits">
                        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                        <div>No commits in the last 24 hours</div>
                        <div style="margin-top: 8px; font-size: 14px;">Start coding to see your productivity stats!</div>
                    </div>
                `}
            </div>

            <div class="actions-section">
                <button class="action-btn primary" onclick="refreshStats()">🔄 Refresh Stats</button>
                <button class="action-btn secondary" onclick="closePanel()">Close Dashboard</button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function refreshStats() {
                vscode.postMessage({
                    command: 'refreshStats'
                });
            }

            function takeBreak() {
                vscode.postMessage({
                    command: 'takeBreak'
                });
            }

            function continueWorking() {
                // Just close the suggestion, user can continue working
                const suggestion = document.querySelector('.break-suggestion');
                if (suggestion) {
                    suggestion.style.display = 'none';
                }
            }

            function closePanel() {
                vscode.postMessage({
                    command: 'closePanel'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateStats':
                        if (message.data && message.data.stats) {
                            location.reload(); // Simple refresh for now
                        }
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;
}

// Global storage instance (will be initialized when extension activates)
let storage: ExtensionStorage | null = null;

export function initializeExerciseStorage(context: vscode.ExtensionContext): void {
  storage = new ExtensionStorage(context);
}

export function showStretchExercise(): void {
  const stretches: StretchExercise[] = [
    {
      name: "Neck Rolls",
      duration: "30 seconds",
      instructions: "Gently roll your head in circles, 10 times clockwise, 10 times counterclockwise."
    },
    {
      name: "Shoulder Shrugs",
      duration: "20 seconds",
      instructions: "Shrug your shoulders up to your ears, hold for 5 seconds, then release. Repeat 10 times."
    },
    {
      name: "Wrist Stretches",
      duration: "20 seconds",
      instructions: "Extend one arm forward, pull back on fingers with other hand. Hold 10 seconds each side."
    },
    {
      name: "Seated Forward Bend",
      duration: "30 seconds",
      instructions: "Sit with legs extended, reach forward toward toes. Hold and breathe deeply."
    }
  ];

  const randomStretch = stretches[Math.floor(Math.random() * stretches.length)];
  showExerciseModal('Quick Stretch', randomStretch);
}

export function showBreathingExercise(): void {
  const breathing: BreathingExercise = {
    name: "4-7-8 Breathing",
    duration: "4 minutes",
    instructions: "Inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds. Repeat 4 times.",
    steps: [
      "Sit comfortably with your back straight",
      "Place the tip of your tongue behind your upper front teeth",
      "Exhale completely through your mouth",
      "Close your mouth and inhale quietly through your nose for 4 seconds",
      "Hold your breath for 7 seconds",
      "Exhale completely through your mouth for 8 seconds",
      "Repeat this cycle 4 times"
    ]
  };

  showExerciseModal('Breathing Exercise', breathing);
}

export function showEyeExercise(): void {
  const config = getConfiguration();
  if (!config.enableEyeExercises) {
    vscode.window.showInformationMessage('Eye exercises are disabled in settings.');
    return;
  }

  const eyeExercises: EyeExercise[] = [
    {
      type: 'eye',
      name: "20-20-20 Rule",
      duration: "20 seconds",
      instructions: "Look at something 20 feet away for 20 seconds to reduce eye strain.",
      screenBreakTrigger: config.screenBreakInterval,
      isScreenBreak: state.screenTimeStats.continuousScreenTime >= config.screenBreakInterval
    },
    {
      type: 'eye',
      name: "Eye Rolls",
      duration: "30 seconds",
      instructions: "Slowly roll your eyes clockwise 5 times, then counterclockwise 5 times.",
      screenBreakTrigger: config.screenBreakInterval,
      isScreenBreak: state.screenTimeStats.continuousScreenTime >= config.screenBreakInterval
    },
    {
      type: 'eye',
      name: "Focus Shifting",
      duration: "45 seconds",
      instructions: "Look at your thumb close to your face, then focus on something far away. Alternate 10 times.",
      screenBreakTrigger: config.screenBreakInterval,
      isScreenBreak: state.screenTimeStats.continuousScreenTime >= config.screenBreakInterval
    },
    {
      type: 'eye',
      name: "Blink Exercise",
      duration: "30 seconds",
      instructions: "Blink rapidly for 10 seconds, then close your eyes tightly for 10 seconds. Repeat once.",
      screenBreakTrigger: config.screenBreakInterval,
      isScreenBreak: state.screenTimeStats.continuousScreenTime >= config.screenBreakInterval
    }
  ];

  const randomEyeExercise = eyeExercises[Math.floor(Math.random() * eyeExercises.length)];
  showExerciseModal('Eye Exercise', randomEyeExercise);
}

export function showWaterReminder(): void {
  const waterTips = [
    {
      title: "💧 Hydration Break",
      duration: "2 minutes",
      instructions: "Take a moment to drink a full glass of water. Proper hydration improves focus, reduces fatigue, and supports overall brain function.",
      benefits: [
        "Improves cognitive performance and concentration",
        "Reduces headaches and fatigue",
        "Helps maintain healthy blood pressure",
        "Supports joint health and reduces discomfort",
        "Boosts metabolism and energy levels"
      ],
      steps: [
        "Get a clean glass or water bottle",
        "Fill it with fresh, cool water",
        "Drink slowly and mindfully",
        "Take deep breaths between sips",
        "Notice how your body feels refreshed"
      ]
    },
    {
      title: "🚰 Water Wellness",
      duration: "3 minutes",
      instructions: "Hydration is essential for developers! Take this time to properly hydrate and learn about the benefits of staying hydrated while coding.",
      benefits: [
        "Prevents eye strain and dry eyes",
        "Maintains optimal brain function for problem-solving",
        "Reduces mental fatigue and improves decision-making",
        "Supports healthy posture and reduces muscle tension",
        "Enhances overall coding performance and productivity"
      ],
      steps: [
        "Prepare your favorite water (add lemon, cucumber, or mint if desired)",
        "Find a comfortable spot away from your screen",
        "Drink water slowly, savoring each sip",
        "Practice deep breathing while hydrating",
        "Return to coding feeling refreshed and focused"
      ]
    },
    {
      title: "🌊 Hydration Station",
      duration: "2 minutes",
      instructions: "Your body is approximately 60% water. Regular hydration breaks help maintain this balance and keep you performing at your best.",
      benefits: [
        "Optimizes neurotransmitter function in the brain",
        "Improves oxygen delivery to brain cells",
        "Reduces stress and anxiety levels",
        "Supports healthy digestion and nutrient absorption",
        "Maintains electrolyte balance for better focus"
      ],
      steps: [
        "Measure out 8-16 ounces of water",
        "Find a quiet space for your hydration break",
        "Drink water at a comfortable pace",
        "Stretch gently while hydrating",
        "Acknowledge the positive impact on your well-being"
      ]
    }
  ];

  const randomTip = waterTips[Math.floor(Math.random() * waterTips.length)];
  showWaterModal(randomTip);
}

function showExerciseModal(title: string, exercise: Exercise): void {
  const panel = vscode.window.createWebviewPanel(
    'breakBullyExercise',
    title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'views'))]
    }
  );

  const cssPath = vscode.Uri.file(path.join(__dirname, '..', 'views', 'styles.css'));
  const cssUri = panel.webview.asWebviewUri(cssPath);

  // Parse duration to seconds
  const durationText = exercise.duration;
  let durationSeconds = 30; // default
  if (durationText.includes('minutes')) {
    durationSeconds = parseInt(durationText.split(' ')[0]) * 60;
  } else if (durationText.includes('seconds')) {
    durationSeconds = parseInt(durationText.split(' ')[0]);
  }

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link rel="stylesheet" href="${cssUri}">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-editor-foreground, #d4d4d4);
                padding: 20px;
                margin: 0;
            }
            .exercise-container {
                max-width: 600px;
                margin: 0 auto;
            }
            .exercise-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .exercise-title {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .exercise-duration {
                color: var(--vscode-charts-green, #89d185);
                font-weight: 600;
                font-size: 16px;
            }
            .exercise-instructions {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            .exercise-steps {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .exercise-steps h4 {
                margin-bottom: 12px;
                color: var(--vscode-foreground, #d4d4d4);
            }
            .exercise-steps ol {
                padding-left: 20px;
            }
            .exercise-steps li {
                margin-bottom: 8px;
            }
            .timer-section {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                display: none;
            }
            .timer-display {
                font-size: 48px;
                font-weight: 700;
                color: var(--vscode-charts-orange, #ff8c00);
                margin-bottom: 10px;
                font-variant-numeric: tabular-nums;
            }
            .timer-label {
                color: var(--vscode-descriptionForeground, #cccccc);
                font-size: 14px;
            }
            .exercise-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .exercise-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .exercise-btn.primary {
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                color: white;
            }
            .exercise-btn.primary:hover {
                background: linear-gradient(135deg, #ff5252 0%, #45b7d1 100%);
            }
            .exercise-btn.secondary {
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
            }
            .exercise-btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            .exercise-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .completed-message {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-charts-green, #89d185);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                display: none;
            }
            .completed-message h3 {
                color: var(--vscode-charts-green, #89d185);
                margin-bottom: 10px;
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            .timer-active .timer-display {
                animation: pulse 1s infinite;
            }
        </link>
    </head>
    <body>
        <div class="exercise-container">
            <div class="exercise-header">
                <h1 class="exercise-title">${title}</h1>
                <p class="exercise-duration">Duration: ${exercise.duration}</p>
            </div>

            <div class="exercise-instructions">
                <h3>${exercise.name}</h3>
                <p>${exercise.instructions}</p>
            </div>

            ${exercise.steps ? `
                <div class="exercise-steps">
                    <h4>Step-by-Step Instructions:</h4>
                    <ol>
                        ${exercise.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
            ` : ''}

            <div class="timer-section" id="timerSection">
                <div class="timer-display" id="timerDisplay">--:--</div>
                <div class="timer-label">Time remaining</div>
            </div>

            <div class="completed-message" id="completedMessage">
                <h3>🎉 Exercise Complete!</h3>
                <p>Great job! You've completed your ${title.toLowerCase()}. Take a moment to notice how you feel.</p>
            </div>

            <div class="exercise-actions">
                <button class="exercise-btn primary" id="startBtn" onclick="startTimer()">Start Exercise</button>
                <button class="exercise-btn secondary" id="closeBtn" onclick="closePanel()">Close</button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let timerInterval;
            let remainingSeconds = ${durationSeconds};
            let isRunning = false;

            function startTimer() {
                if (isRunning) return;

                isRunning = true;
                const startBtn = document.getElementById('startBtn');
                const timerSection = document.getElementById('timerSection');

                startBtn.textContent = 'Exercise in Progress...';
                startBtn.disabled = true;
                timerSection.style.display = 'block';
                document.body.classList.add('timer-active');

                updateTimerDisplay();

                timerInterval = setInterval(() => {
                    remainingSeconds--;

                    // Show progress notifications
                    const totalDuration = ${durationSeconds};
                    const progress = ((totalDuration - remainingSeconds) / totalDuration) * 100;
                    if (progress === 50 || progress === 75) {
                        vscode.postMessage({
                            command: 'showProgress',
                            exerciseName: exercise.name,
                            progress: Math.round(progress)
                        });
                    }

                    if (remainingSeconds <= 0) {
                        completeExercise();
                    } else {
                        updateTimerDisplay();
                    }
                }, 1000);

                vscode.postMessage({
                    command: 'timerStarted',
                    duration: ${durationSeconds}
                });
            }

            function updateTimerDisplay() {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                const timerDisplay = document.getElementById('timerDisplay');

                timerDisplay.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
            }

            function completeExercise() {
                clearInterval(timerInterval);
                isRunning = false;

                const timerSection = document.getElementById('timerSection');
                const completedMessage = document.getElementById('completedMessage');
                const startBtn = document.getElementById('startBtn');

                timerSection.style.display = 'none';
                completedMessage.style.display = 'block';
                startBtn.textContent = 'Exercise Complete!';
                startBtn.disabled = true;
                document.body.classList.remove('timer-active');

                // Play completion sound/notification
                vscode.postMessage({
                    command: 'exerciseComplete',
                    exercise: '${exercise.name}'
                });
            }

            function closePanel() {
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                vscode.postMessage({
                    command: 'closePanel'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateTimer':
                        // Could be used for external timer control if needed
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'showProgress':
          showExerciseProgressNotification(message.exerciseName, message.progress);
          break;
        case 'timerStarted':
          showExerciseStartNotification(exercise.name, exercise.duration);
          break;
        case 'exerciseComplete':
          // Determine exercise type for notification
          { let exerciseType = 'default';
          if (exercise.name.toLowerCase().includes('stretch') || exercise.name.toLowerCase().includes('neck') || exercise.name.toLowerCase().includes('shoulder')) {
            exerciseType = 'stretch';
          } else if (exercise.name.toLowerCase().includes('breath') || exercise.name.toLowerCase().includes('breathing')) {
            exerciseType = 'breathing';
          } else if (exercise.name.toLowerCase().includes('eye') || exercise.name.toLowerCase().includes('blink') || exercise.name.toLowerCase().includes('focus')) {
            exerciseType = 'eye';
          }

          // Increment exercise progress when any exercise is completed
          import('./wellnessService').then(wellnessService => {
            wellnessService.incrementExerciseProgress();
          });

          // For eye exercises, also increment eye break progress
          if (exerciseType === 'eye') {
            import('./wellnessService').then(wellnessService => {
              wellnessService.incrementEyeBreakProgress();
            });
          }

          showExerciseCompletionNotification(exercise.name, exerciseType).then(selection => {
            if (selection === 'Take Another Break') {
              import('./breakService').then(breakService => {
                breakService.takeBreak();
              });
            }
          });
          break; }
        case 'closePanel':
          panel.dispose();
          break;
      }
    },
    undefined,
    []
  );
}

// ===== CUSTOM EXERCISE MANAGEMENT =====

export function createCustomExercise(exerciseData: {
  name: string;
  duration: string;
  instructions: string;
  category: ExerciseCategory;
  difficulty: DifficultyLevel;
  steps?: string[];
}): CustomExercise {
  if (!storage) {
    throw new Error('Exercise storage not initialized');
  }

  const customExercise: CustomExercise = {
    id: generateExerciseId(),
    name: exerciseData.name,
    duration: exerciseData.duration,
    instructions: exerciseData.instructions,
    category: exerciseData.category,
    difficulty: exerciseData.difficulty,
    steps: exerciseData.steps || [],
    createdBy: 'user',
    favorite: false,
    createdAt: new Date(),
    usageCount: 0
  };

  // Save to storage
  const exercises = storage.loadCustomExercises();
  exercises.push(customExercise);
  storage.saveCustomExercises(exercises);

  return customExercise;
}

export function getCustomExercises(): CustomExercise[] {
  if (!storage) {
    return [];
  }
  return storage.loadCustomExercises();
}

export function updateCustomExercise(id: string, updates: Partial<CustomExercise>): boolean {
  if (!storage) {
    return false;
  }

  const exercises = storage.loadCustomExercises();
  const index = exercises.findIndex(ex => ex.id === id);

  if (index === -1) {
    return false;
  }

  exercises[index] = { ...exercises[index], ...updates };
  storage.saveCustomExercises(exercises);
  return true;
}

export function deleteCustomExercise(id: string): boolean {
  if (!storage) {
    return false;
  }

  const exercises = storage.loadCustomExercises();
  const filteredExercises = exercises.filter(ex => ex.id !== id);

  if (filteredExercises.length === exercises.length) {
    return false; // Exercise not found
  }

  storage.saveCustomExercises(filteredExercises);
  return true;
}

export function getCustomExerciseById(id: string): CustomExercise | null {
  if (!storage) {
    return null;
  }

  const exercises = storage.loadCustomExercises();
  return exercises.find(ex => ex.id === id) || null;
}

export function toggleExerciseFavorite(id: string): boolean {
  if (!storage) {
    return false;
  }

  const exercises = storage.loadCustomExercises();
  const exercise = exercises.find(ex => ex.id === id);

  if (!exercise) {
    return false;
  }

  exercise.favorite = !exercise.favorite;
  storage.saveCustomExercises(exercises);
  return true;
}

export function incrementExerciseUsage(id: string): boolean {
  if (!storage) {
    return false;
  }

  const exercises = storage.loadCustomExercises();
  const exercise = exercises.find(ex => ex.id === id);

  if (!exercise) {
    return false;
  }

  exercise.usageCount = (exercise.usageCount || 0) + 1;
  storage.saveCustomExercises(exercises);
  return true;
}

function generateExerciseId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== CUSTOM EXERCISE UI =====

export function showCustomExerciseCreator(): void {
  const panel = vscode.window.createWebviewPanel(
    'breakBullyCustomExerciseCreator',
    'Create Custom Exercise',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'views'))]
    }
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Create Custom Exercise</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-editor-foreground, #d4d4d4);
                padding: 20px;
                margin: 0;
                overflow-x: hidden;
            }
            .creator-container {
                max-width: 700px;
                margin: 0 auto;
            }
            .creator-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .creator-title {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .creator-subtitle {
                color: var(--vscode-descriptionForeground, #cccccc99);
                font-size: 16px;
            }
            .form-section {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 20px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-label {
                display: block;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--vscode-foreground, #d4d4d4);
            }
            .form-input, .form-textarea, .form-select {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 6px;
                background: var(--vscode-input-background, #3c3c3c);
                color: var(--vscode-input-foreground, #d4d4d4);
                font-size: 14px;
                box-sizing: border-box;
            }
            .form-input:focus, .form-textarea:focus, .form-select:focus {
                outline: none;
                border-color: var(--vscode-focusBorder, #0078d4);
                box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
            }
            .form-textarea {
                resize: vertical;
                min-height: 80px;
                font-family: inherit;
            }
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            .form-row .form-group {
                margin-bottom: 0;
            }
            .steps-section {
                margin-top: 20px;
            }
            .steps-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .add-step-btn {
                padding: 8px 16px;
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
            }
            .add-step-btn:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            .step-item {
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
                align-items: flex-start;
            }
            .step-number {
                background: var(--vscode-charts-blue, #4f8bd6);
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .step-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 6px;
                background: var(--vscode-input-background, #3c3c3c);
                color: var(--vscode-input-foreground, #d4d4d4);
                font-size: 14px;
            }
            .step-input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder, #0078d4);
            }
            .remove-step-btn {
                background: var(--vscode-errorForeground, #f48771);
                color: white;
                border: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .remove-step-btn:hover {
                background: #e74c3c;
            }
            .preview-section {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 20px;
            }
            .preview-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                color: var(--vscode-charts-green, #89d185);
            }
            .exercise-preview {
                background: var(--vscode-editor-background, #1e1e1e);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 8px;
                padding: 16px;
            }
            .preview-name {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .preview-meta {
                color: var(--vscode-descriptionForeground, #cccccc99);
                font-size: 14px;
                margin-bottom: 12px;
            }
            .preview-instructions {
                margin-bottom: 12px;
                line-height: 1.5;
            }
            .preview-steps {
                font-size: 14px;
            }
            .preview-steps ol {
                padding-left: 20px;
            }
            .preview-steps li {
                margin-bottom: 4px;
            }
            .creator-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                padding-top: 20px;
            }
            .creator-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            .creator-btn.primary {
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                color: white;
            }
            .creator-btn.primary:hover {
                background: linear-gradient(135deg, #ff5252 0%, #45b7d1 100%);
            }
            .creator-btn.secondary {
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
            }
            .creator-btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            .creator-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .error-message {
                background: var(--vscode-inputValidation-errorBackground, #5f1313);
                border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
                color: var(--vscode-errorForeground, #f48771);
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 16px;
                display: none;
            }
            .success-message {
                background: var(--vscode-inputValidation-infoBackground, #063b49);
                border: 1px solid var(--vscode-inputValidation-infoBorder, #3794ff);
                color: var(--vscode-charts-blue, #4f8bd6);
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 16px;
                display: none;
            }
            @media (max-width: 600px) {
                .form-row {
                    grid-template-columns: 1fr;
                    gap: 0;
                }
                .creator-actions {
                    flex-direction: column;
                }
                .creator-btn {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="creator-container">
            <div class="creator-header">
                <h1 class="creator-title">🏋️ Create Custom Exercise</h1>
                <p class="creator-subtitle">Design your own wellness exercise with personalized instructions and timing</p>
            </div>

            <div id="errorMessage" class="error-message"></div>
            <div id="successMessage" class="success-message"></div>

            <form id="exerciseForm">
                <div class="form-section">
                    <h3>Basic Information</h3>

                    <div class="form-group">
                        <label class="form-label" for="exerciseName">Exercise Name *</label>
                        <input type="text" id="exerciseName" class="form-input" placeholder="e.g., Desk Yoga Flow" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="exerciseDuration">Duration *</label>
                            <input type="text" id="exerciseDuration" class="form-input" placeholder="e.g., 5 minutes" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="exerciseCategory">Category *</label>
                            <select id="exerciseCategory" class="form-select" required>
                                <option value="">Select category...</option>
                                <option value="stretch">Stretch</option>
                                <option value="breathing">Breathing</option>
                                <option value="eye">Eye Exercise</option>
                                <option value="full-body">Full Body</option>
                                <option value="neck">Neck</option>
                                <option value="shoulders">Shoulders</option>
                                <option value="back">Back</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="exerciseDifficulty">Difficulty Level *</label>
                        <select id="exerciseDifficulty" class="form-select" required>
                            <option value="">Select difficulty...</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="exerciseInstructions">Instructions *</label>
                        <textarea id="exerciseInstructions" class="form-textarea" placeholder="Describe how to perform this exercise..." required></textarea>
                    </div>
                </div>

                <div class="form-section">
                    <div class="steps-section">
                        <div class="steps-header">
                            <h3>Step-by-Step Guide (Optional)</h3>
                            <button type="button" class="add-step-btn" onclick="addStep()">+ Add Step</button>
                        </div>
                        <div id="stepsContainer">
                            <!-- Steps will be added here dynamically -->
                        </div>
                    </div>
                </div>

                <div class="preview-section">
                    <h3 class="preview-title">📋 Live Preview</h3>
                    <div class="exercise-preview" id="exercisePreview">
                        <div class="preview-name" id="previewName">Your Exercise Name</div>
                        <div class="preview-meta" id="previewMeta">Duration • Category • Difficulty</div>
                        <div class="preview-instructions" id="previewInstructions">Your instructions will appear here...</div>
                        <div class="preview-steps" id="previewSteps" style="display: none;">
                            <strong>Steps:</strong>
                            <ol id="previewStepsList"></ol>
                        </div>
                    </div>
                </div>

                <div class="creator-actions">
                    <button type="button" class="creator-btn primary" onclick="createExercise()">Create Exercise</button>
                    <button type="button" class="creator-btn secondary" onclick="closePanel()">Cancel</button>
                </div>
            </form>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let stepCount = 0;

            // Form validation and preview updates
            document.getElementById('exerciseForm').addEventListener('input', updatePreview);
            document.getElementById('exerciseForm').addEventListener('change', updatePreview);

            function updatePreview() {
                const name = document.getElementById('exerciseName').value || 'Your Exercise Name';
                const duration = document.getElementById('exerciseDuration').value || 'Duration';
                const category = document.getElementById('exerciseCategory').options[document.getElementById('exerciseCategory').selectedIndex]?.text || 'Category';
                const difficulty = document.getElementById('exerciseDifficulty').options[document.getElementById('exerciseDifficulty').selectedIndex]?.text || 'Difficulty';
                const instructions = document.getElementById('exerciseInstructions').value || 'Your instructions will appear here...';

                document.getElementById('previewName').textContent = name;
                document.getElementById('previewMeta').textContent = \`\${duration} • \${category} • \${difficulty}\`;
                document.getElementById('previewInstructions').textContent = instructions;

                updateStepsPreview();
            }

            function updateStepsPreview() {
                const stepsList = document.getElementById('previewStepsList');
                const previewSteps = document.getElementById('previewSteps');
                const stepInputs = document.querySelectorAll('.step-input');

                stepsList.innerHTML = '';
                let hasSteps = false;

                stepInputs.forEach((input, index) => {
                    if (input.value.trim()) {
                        const li = document.createElement('li');
                        li.textContent = input.value.trim();
                        stepsList.appendChild(li);
                        hasSteps = true;
                    }
                });

                previewSteps.style.display = hasSteps ? 'block' : 'none';
            }

            function addStep() {
                stepCount++;
                const stepsContainer = document.getElementById('stepsContainer');

                const stepDiv = document.createElement('div');
                stepDiv.className = 'step-item';
                stepDiv.innerHTML = \`
                    <div class="step-number">\${stepCount}</div>
                    <input type="text" class="step-input" placeholder="Describe this step..." oninput="updatePreview()">
                    <button type="button" class="remove-step-btn" onclick="removeStep(this)">×</button>
                \`;

                stepsContainer.appendChild(stepDiv);
                updateStepNumbers();
            }

            function removeStep(button) {
                button.parentElement.remove();
                updateStepNumbers();
                updatePreview();
            }

            function updateStepNumbers() {
                const stepItems = document.querySelectorAll('.step-item');
                stepItems.forEach((item, index) => {
                    item.querySelector('.step-number').textContent = (index + 1).toString();
                });
                stepCount = stepItems.length;
            }

            function createExercise() {
                // Hide previous messages
                document.getElementById('errorMessage').style.display = 'none';
                document.getElementById('successMessage').style.display = 'none';

                // Get form data
                const name = document.getElementById('exerciseName').value.trim();
                const duration = document.getElementById('exerciseDuration').value.trim();
                const category = document.getElementById('exerciseCategory').value;
                const difficulty = document.getElementById('exerciseDifficulty').value;
                const instructions = document.getElementById('exerciseInstructions').value.trim();

                // Validate required fields
                if (!name || !duration || !category || !difficulty || !instructions) {
                    showError('Please fill in all required fields marked with *');
                    return;
                }

                // Get steps
                const stepInputs = document.querySelectorAll('.step-input');
                const steps = Array.from(stepInputs)
                    .map(input => input.value.trim())
                    .filter(step => step.length > 0);

                // Create exercise data
                const exerciseData = {
                    name,
                    duration,
                    instructions,
                    category,
                    difficulty,
                    steps: steps.length > 0 ? steps : undefined
                };

                // Send to extension
                vscode.postMessage({
                    command: 'createCustomExercise',
                    data: exerciseData
                });
            }

            function showError(message) {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                errorDiv.scrollIntoView({ behavior: 'smooth' });
            }

            function showSuccess(message) {
                const successDiv = document.getElementById('successMessage');
                successDiv.textContent = message;
                successDiv.style.display = 'block';
                successDiv.scrollIntoView({ behavior: 'smooth' });
            }

            function closePanel() {
                vscode.postMessage({
                    command: 'closePanel'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'exerciseCreated':
                        showSuccess('✅ Exercise created successfully! You can now use it in your break routine.');
                        setTimeout(() => {
                            closePanel();
                        }, 2000);
                        break;
                    case 'exerciseCreateError':
                        showError('❌ Failed to create exercise: ' + message.error);
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'createCustomExercise':
          try {
            const exercise = createCustomExercise(message.data);
            panel.webview.postMessage({
              command: 'exerciseCreated',
              exercise: exercise
            });
            vscode.window.showInformationMessage(`✅ Custom exercise "${exercise.name}" created successfully!`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            panel.webview.postMessage({
              command: 'exerciseCreateError',
              error: errorMessage
            });
            vscode.window.showErrorMessage(`❌ Failed to create exercise: ${errorMessage}`);
          }
          break;
        case 'closePanel':
          panel.dispose();
          break;
      }
    },
    undefined,
    []
  );
}

export function showCustomExerciseLibrary(): void {
  const panel = vscode.window.createWebviewPanel(
    'breakBullyCustomExerciseLibrary',
    'Custom Exercise Library',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'views'))]
    }
  );

  const exercises = getCustomExercises();

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Custom Exercise Library</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-editor-foreground, #d4d4d4);
                padding: 20px;
                margin: 0;
            }
            .library-container {
                max-width: 800px;
                margin: 0 auto;
            }
            .library-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .library-title {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .library-subtitle {
                color: var(--vscode-descriptionForeground, #cccccc99);
                font-size: 16px;
            }
            .library-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-bottom: 20px;
            }
            .library-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            .library-btn.primary {
                background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                color: white;
            }
            .library-btn.primary:hover {
                background: linear-gradient(135deg, #ff5252 0%, #45b7d1 100%);
            }
            .library-btn.secondary {
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
            }
            .library-btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            .exercises-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                gap: 20px;
            }
            .exercise-card {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                transition: all 0.3s ease;
            }
            .exercise-card:hover {
                border-color: var(--vscode-focusBorder, #0078d4);
                box-shadow: 0 4px 12px rgba(0, 120, 212, 0.15);
            }
            .exercise-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
            }
            .exercise-name {
                font-size: 18px;
                font-weight: 600;
                color: var(--vscode-foreground, #d4d4d4);
                flex: 1;
                margin-right: 12px;
            }
            .exercise-favorite {
                background: none;
                border: none;
                color: var(--vscode-descriptionForeground, #cccccc99);
                cursor: pointer;
                font-size: 16px;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            .exercise-favorite:hover {
                color: #ff6b6b;
                background: rgba(255, 107, 107, 0.1);
            }
            .exercise-favorite.active {
                color: #ff6b6b;
            }
            .exercise-meta {
                display: flex;
                gap: 12px;
                margin-bottom: 12px;
                font-size: 14px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .exercise-meta-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .exercise-instructions {
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 12px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .exercise-steps {
                font-size: 14px;
                margin-bottom: 12px;
            }
            .exercise-steps ol {
                padding-left: 20px;
                margin: 0;
            }
            .exercise-steps li {
                margin-bottom: 4px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .exercise-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .exercise-action-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .exercise-action-btn.start {
                background: var(--vscode-charts-green, #89d185);
                color: white;
            }
            .exercise-action-btn.start:hover {
                background: #6bb86b;
            }
            .exercise-action-btn.edit {
                background: var(--vscode-charts-blue, #4f8bd6);
                color: white;
            }
            .exercise-action-btn.edit:hover {
                background: #3a7bd5;
            }
            .exercise-action-btn.delete {
                background: var(--vscode-errorForeground, #f48771);
                color: white;
            }
            .exercise-action-btn.delete:hover {
                background: #e74c3c;
            }
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .empty-state h3 {
                font-size: 24px;
                margin-bottom: 12px;
                color: var(--vscode-foreground, #d4d4d4);
            }
            .empty-state p {
                font-size: 16px;
                margin-bottom: 20px;
            }
            @media (max-width: 600px) {
                .exercises-grid {
                    grid-template-columns: 1fr;
                }
                .library-actions {
                    flex-direction: column;
                }
                .library-btn {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="library-container">
            <div class="library-header">
                <h1 class="library-title">📚 Custom Exercise Library</h1>
                <p class="library-subtitle">Manage your personal collection of wellness exercises</p>
            </div>

            <div class="library-actions">
                <button class="library-btn primary" onclick="createNewExercise()">+ Create New Exercise</button>
                <button class="library-btn secondary" onclick="closePanel()">Close Library</button>
            </div>

            <div class="exercises-grid" id="exercisesGrid">
                ${exercises.length === 0 ? `
                    <div class="empty-state">
                        <h3>No Custom Exercises Yet</h3>
                        <p>Create your first personalized exercise to get started with your custom wellness routine.</p>
                        <button class="library-btn primary" onclick="createNewExercise()">Create Your First Exercise</button>
                    </div>
                ` : exercises.map(exercise => `
                    <div class="exercise-card" data-id="${exercise.id}">
                        <div class="exercise-header">
                            <div class="exercise-name">${exercise.name}</div>
                            <button class="exercise-favorite ${exercise.favorite ? 'active' : ''}" onclick="toggleFavorite('${exercise.id}')">
                                ${exercise.favorite ? '❤️' : '🤍'}
                            </button>
                        </div>
                        <div class="exercise-meta">
                            <div class="exercise-meta-item">⏱️ ${exercise.duration}</div>
                            <div class="exercise-meta-item">🏷️ ${exercise.category}</div>
                            <div class="exercise-meta-item">📊 ${exercise.difficulty}</div>
                            ${exercise.usageCount ? `<div class="exercise-meta-item">🎯 Used ${exercise.usageCount} times</div>` : ''}
                        </div>
                        <div class="exercise-instructions">${exercise.instructions}</div>
                        ${exercise.steps ? `
                            <div class="exercise-steps">
                                <strong>Steps:</strong>
                                <ol>
                                    ${exercise.steps.map(step => `<li>${step}</li>`).join('')}
                                </ol>
                            </div>
                        ` : ''}
                        <div class="exercise-actions">
                            <button class="exercise-action-btn start" onclick="startExercise('${exercise.id}')">Start</button>
                            <button class="exercise-action-btn edit" onclick="editExercise('${exercise.id}')">Edit</button>
                            <button class="exercise-action-btn delete" onclick="deleteExercise('${exercise.id}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function createNewExercise() {
                vscode.postMessage({
                    command: 'createNewExercise'
                });
            }

            function startExercise(exerciseId) {
                vscode.postMessage({
                    command: 'startCustomExercise',
                    exerciseId: exerciseId
                });
            }

            function editExercise(exerciseId) {
                vscode.postMessage({
                    command: 'editExercise',
                    exerciseId: exerciseId
                });
            }

            function deleteExercise(exerciseId) {
                if (confirm('Are you sure you want to delete this exercise? This action cannot be undone.')) {
                    vscode.postMessage({
                        command: 'deleteExercise',
                        exerciseId: exerciseId
                    });
                }
            }

            function toggleFavorite(exerciseId) {
                vscode.postMessage({
                    command: 'toggleFavorite',
                    exerciseId: exerciseId
                });
            }

            function closePanel() {
                vscode.postMessage({
                    command: 'closePanel'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'exerciseDeleted':
                        // Remove the exercise card from UI
                        const card = document.querySelector(\`[data-id="\${message.exerciseId}"]\`);
                        if (card) {
                            card.remove();
                        }
                        // Check if library is now empty
                        const remainingCards = document.querySelectorAll('.exercise-card');
                        if (remainingCards.length === 0) {
                            location.reload(); // Reload to show empty state
                        }
                        break;
                    case 'favoriteToggled':
                        const favoriteBtn = document.querySelector(\`[data-id="\${message.exerciseId}"] .exercise-favorite\`);
                        if (favoriteBtn) {
                            favoriteBtn.classList.toggle('active');
                            favoriteBtn.textContent = favoriteBtn.classList.contains('active') ? '❤️' : '🤍';
                        }
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'createNewExercise':
          showCustomExerciseCreator();
          break;
        case 'startCustomExercise':
          { const exercise = getCustomExerciseById(message.exerciseId);
          if (exercise) {
            incrementExerciseUsage(message.exerciseId);
            showExerciseModal('Custom Exercise', exercise);
          }
          break; }
        case 'editExercise':
          // For now, just show an info message - full edit functionality would be complex
          vscode.window.showInformationMessage('Edit functionality coming soon! For now, delete and recreate the exercise.');
          break;
        case 'deleteExercise':
          if (deleteCustomExercise(message.exerciseId)) {
            panel.webview.postMessage({
              command: 'exerciseDeleted',
              exerciseId: message.exerciseId
            });
            vscode.window.showInformationMessage('Exercise deleted successfully.');
          } else {
            vscode.window.showErrorMessage('Failed to delete exercise.');
          }
          break;
        case 'toggleFavorite':
          if (toggleExerciseFavorite(message.exerciseId)) {
            panel.webview.postMessage({
              command: 'favoriteToggled',
              exerciseId: message.exerciseId
            });
          }
          break;
        case 'closePanel':
          panel.dispose();
          break;
      }
    },
    undefined,
    []
  );
}

function showWaterModal(waterTip: WaterTip): void {
  const panel = vscode.window.createWebviewPanel(
    'breakBullyWater',
    waterTip.title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'views'))]
    }
  );

  const cssPath = vscode.Uri.file(path.join(__dirname, '..', 'views', 'styles.css'));
  const cssUri = panel.webview.asWebviewUri(cssPath);

  // Parse duration to seconds
  const durationText = waterTip.duration;
  let durationSeconds = 120; // default 2 minutes
  if (durationText.includes('minutes')) {
    durationSeconds = parseInt(durationText.split(' ')[0]) * 60;
  } else if (durationText.includes('seconds')) {
    durationSeconds = parseInt(durationText.split(' ')[0]);
  }

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${waterTip.title}</title>
        <link rel="stylesheet" href="${cssUri}">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-editor-foreground, #d4d4d4);
                padding: 20px;
                margin: 0;
            }
            .water-container {
                max-width: 700px;
                margin: 0 auto;
            }
            .water-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .water-title {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .water-duration {
                color: var(--vscode-charts-blue, #4f8bd6);
                font-weight: 600;
                font-size: 16px;
            }
            .water-instructions {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            .water-benefits {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .water-benefits h4 {
                margin-bottom: 12px;
                color: var(--vscode-charts-green, #89d185);
                font-size: 18px;
            }
            .water-benefits ul {
                padding-left: 20px;
            }
            .water-benefits li {
                margin-bottom: 8px;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            .water-steps {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .water-steps h4 {
                margin-bottom: 12px;
                color: var(--vscode-foreground, #d4d4d4);
                font-size: 18px;
            }
            .water-steps ol {
                padding-left: 20px;
            }
            .water-steps li {
                margin-bottom: 8px;
            }
            .timer-section {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                display: none;
            }
            .timer-display {
                font-size: 48px;
                font-weight: 700;
                color: var(--vscode-charts-blue, #4f8bd6);
                margin-bottom: 10px;
                font-variant-numeric: tabular-nums;
            }
            .timer-label {
                color: var(--vscode-descriptionForeground, #cccccc);
                font-size: 14px;
            }
            .water-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .water-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .water-btn.primary {
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
                color: white;
            }
            .water-btn.primary:hover {
                background: linear-gradient(135deg, #26d0ce 0%, #2e8b57 100%);
            }
            .water-btn.secondary {
                background: var(--vscode-button-secondaryBackground, #3c3c3c);
                color: var(--vscode-foreground, #d4d4d4);
                border: 1px solid var(--vscode-panel-border, #3e3e42);
            }
            .water-btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground, #505050);
            }
            .water-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .completed-message {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-charts-green, #89d185);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                display: none;
            }
            .completed-message h3 {
                color: var(--vscode-charts-green, #89d185);
                margin-bottom: 10px;
                font-size: 24px;
            }
            .hydration-tip {
                background: var(--vscode-editorWidget-background, #252526);
                border: 1px solid var(--vscode-charts-blue, #4f8bd6);
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
                font-style: italic;
                color: var(--vscode-descriptionForeground, #cccccc99);
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            .timer-active .timer-display {
                animation: pulse 1s infinite;
            }
        </style>
    </head>
    <body>
        <div class="water-container">
            <div class="water-header">
                <h1 class="water-title">${waterTip.title}</h1>
                <p class="water-duration">Recommended Duration: ${waterTip.duration}</p>
            </div>

            <div class="hydration-tip">
                💡 <strong>Did you know?</strong> Even mild dehydration can impair cognitive function, energy levels, and mood. Regular hydration breaks help maintain optimal brain performance!
            </div>

            <div class="water-instructions">
                <h3>Why Hydrate?</h3>
                <p>${waterTip.instructions}</p>
            </div>

            <div class="water-benefits">
                <h4>💧 Health Benefits of Staying Hydrated:</h4>
                <ul>
                    ${waterTip.benefits.map((benefit: string) => `<li>${benefit}</li>`).join('')}
                </ul>
            </div>

            <div class="water-steps">
                <h4>Step-by-Step Hydration Guide:</h4>
                <ol>
                    ${waterTip.steps.map((step: string) => `<li>${step}</li>`).join('')}
                </ol>
            </div>

            <div class="timer-section" id="timerSection">
                <div class="timer-display" id="timerDisplay">--:--</div>
                <div class="timer-label">Time for mindful hydration</div>
            </div>

            <div class="completed-message" id="completedMessage">
                <h3>🎉 Hydration Complete!</h3>
                <p>Excellent! You've successfully completed your hydration break. Your body and mind will thank you for staying properly hydrated!</p>
            </div>

            <div class="water-actions">
                <button class="water-btn primary" id="startBtn" onclick="startHydration()">Start Hydration Break</button>
                <button class="water-btn secondary" id="closeBtn" onclick="closePanel()">Close</button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let timerInterval;
            let remainingSeconds = ${durationSeconds};
            let isRunning = false;

            function startHydration() {
                if (isRunning) return;

                isRunning = true;
                const startBtn = document.getElementById('startBtn');
                const timerSection = document.getElementById('timerSection');

                startBtn.textContent = 'Hydrating... 💧';
                startBtn.disabled = true;
                timerSection.style.display = 'block';
                document.body.classList.add('timer-active');

                updateTimerDisplay();

                timerInterval = setInterval(() => {
                    remainingSeconds--;

                    if (remainingSeconds <= 0) {
                        completeHydration();
                    } else {
                        updateTimerDisplay();
                    }
                }, 1000);

                vscode.postMessage({
                    command: 'hydrationStarted',
                    duration: ${durationSeconds}
                });
            }

            function updateTimerDisplay() {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                const timerDisplay = document.getElementById('timerDisplay');

                timerDisplay.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
            }

            function completeHydration() {
                clearInterval(timerInterval);
                isRunning = false;

                const timerSection = document.getElementById('timerSection');
                const completedMessage = document.getElementById('completedMessage');
                const startBtn = document.getElementById('startBtn');

                timerSection.style.display = 'none';
                completedMessage.style.display = 'block';
                startBtn.textContent = 'Hydration Complete! ✅';
                startBtn.disabled = true;
                document.body.classList.remove('timer-active');

                vscode.postMessage({
                    command: 'hydrationComplete',
                    tip: '${waterTip.title}'
                });
            }

            function closePanel() {
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                vscode.postMessage({
                    command: 'closePanel'
                });
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateTimer':
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'hydrationStarted':
          showExerciseStartNotification(waterTip.title, waterTip.duration);
          break;
        case 'hydrationComplete':
          // Hydration completion also counts as exercise progress
          import('./wellnessService').then(wellnessService => {
            wellnessService.incrementExerciseProgress();
          });

          showExerciseCompletionNotification(waterTip.title, 'water').then(selection => {
            if (selection === 'Take Another Break') {
              import('./breakService').then(breakService => {
                breakService.takeBreak();
              });
            }
          });
          break;
        case 'closePanel':
          panel.dispose();
          break;
      }
    },
    undefined,
    []
  );
}
