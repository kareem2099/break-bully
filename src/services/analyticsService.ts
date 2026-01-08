import * as vscode from 'vscode';
import { state } from '../models/state';

interface AnalyticsReport {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalBreaks: number;
    totalScreenTime: number;
    averageSessionLength: number;
    goalsCompleted: number;
    challengesCompleted: number;
  };
  dailyStats: DailyStats[];
  trends: TrendsData;
  recommendations: string[];
}

interface DailyStats {
  date: string;
  breaks: number;
  screenTime: number;
  exercises: number;
  goalsCompleted: number;
}

interface TrendsData {
  breakConsistency: string;
  screenTimeTrend: string;
  exerciseFrequency: string;
  goalCompletionRate: number;
}

export function showAnalyticsReport(): void {
  const report = generateWellnessReport();

  // Create and show analytics webview panel
  const panel = vscode.window.createWebviewPanel(
    'dotsenseAnalytics',
    'DotSense Analytics',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(vscode.extensions.getExtension('FreeRave.dotsense')?.extensionPath || '')]
    }
  );

  // Generate detailed HTML content for analytics
  const htmlContent = generateAnalyticsHtml(report);
  panel.webview.html = htmlContent;

  // Handle messages from the analytics panel
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'exportReport':
          exportAnalyticsReport(report);
          break;
        case 'refreshData':
          { const updatedReport = generateWellnessReport();
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

function generateAnalyticsHtml(report: AnalyticsReport): string {
  const totalGoals = state.wellnessGoals.length;
  const completedGoals = report.summary.goalsCompleted;
  const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DotSense Analytics</title>
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
            }

            .header p {
                font-size: 16px;
                color: #cccccc;
                margin: 0;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
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
                font-size: 32px;
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

            .progress-ring {
                position: relative;
                width: 120px;
                height: 120px;
                margin: 20px auto;
            }

            .progress-ring circle {
                fill: none;
                stroke-width: 8;
                transform: translate(60px, 60px) rotate(-90deg);
            }

            .progress-ring-bg {
                stroke: #3e3e42;
            }

            .progress-ring-fill {
                stroke: #89d185;
                stroke-dasharray: 283;
                stroke-dashoffset: ${283 - (283 * completionRate / 100)};
                transition: stroke-dashoffset 1s ease-in-out;
            }

            .progress-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
                font-weight: 700;
                color: #4f8bd6;
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

            .recommendations-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .recommendations-list li {
                padding: 8px 0;
                border-bottom: 1px solid #3e3e42;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }

            .recommendations-list li:last-child {
                border-bottom: none;
            }

            .recommendations-list li::before {
                content: '💡';
                flex-shrink: 0;
                margin-top: 2px;
            }

            .trends-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }

            .trend-item {
                background: #1e1e1e;
                border: 1px solid #3e3e42;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
            }

            .trend-value {
                font-size: 18px;
                font-weight: 600;
                color: #89d185;
                margin-bottom: 5px;
            }

            .trend-label {
                font-size: 12px;
                color: #cccccc;
                text-transform: uppercase;
                letter-spacing: 0.5px;
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

            .chart-placeholder {
                background: #1e1e1e;
                border: 2px dashed #3e3e42;
                border-radius: 8px;
                padding: 40px;
                text-align: center;
                color: #cccccc;
                margin: 20px 0;
            }

            .chart-placeholder::before {
                content: '📈';
                font-size: 48px;
                display: block;
                margin-bottom: 15px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Wellness Analytics</h1>
            <p>Track your progress and optimize your wellness routine</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalBreaks}</div>
                <div class="stat-label">Total Breaks</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.floor(report.summary.totalScreenTime / 60)}h ${report.summary.totalScreenTime % 60}m</div>
                <div class="stat-label">Screen Time</div>
            </div>
            <div class="stat-card">
                <div class="progress-ring">
                    <svg width="120" height="120">
                        <circle class="progress-ring-bg" r="45" cx="60" cy="60"></circle>
                        <circle class="progress-ring-fill" r="45" cx="60" cy="60"></circle>
                    </svg>
                    <div class="progress-text">${completionRate}%</div>
                </div>
                <div class="stat-label">Goal Completion</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.challengesCompleted}</div>
                <div class="stat-label">Challenges Won</div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 Goals Progress</h2>
            <p>You've completed <strong>${completedGoals}</strong> out of <strong>${totalGoals}</strong> wellness goals this week.</p>
            <div class="chart-placeholder">
                <div>Interactive Goal Progress Chart</div>
                <small>Chart visualization would be implemented here</small>
            </div>
        </div>

        <div class="section">
            <h2>📈 Trends & Insights</h2>
            <div class="trends-grid">
                <div class="trend-item">
                    <div class="trend-value">${report.trends.breakConsistency || 'Good'}</div>
                    <div class="trend-label">Break Consistency</div>
                </div>
                <div class="trend-item">
                    <div class="trend-value">${report.trends.screenTimeTrend || 'Stable'}</div>
                    <div class="trend-label">Screen Time Trend</div>
                </div>
                <div class="trend-item">
                    <div class="trend-value">${report.trends.exerciseFrequency || 'Increasing'}</div>
                    <div class="trend-label">Exercise Frequency</div>
                </div>
                <div class="trend-item">
                    <div class="trend-value">${report.trends.goalCompletionRate || 75}%</div>
                    <div class="trend-label">Success Rate</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>💡 Recommendations</h2>
            <ul class="recommendations-list">
                ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>

        <div class="actions">
            <button class="btn btn-primary" onclick="exportReport()">
                📤 Export Report
            </button>
            <button class="btn btn-secondary" onclick="refreshData()">
                🔄 Refresh Data
            </button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function exportReport() {
                vscode.postMessage({ command: 'exportReport' });
            }

            function refreshData() {
                vscode.postMessage({ command: 'refreshData' });
            }

            // Listen for updates from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateReport') {
                    // Could refresh the display with new data
                    Logger.log('Report updated:', message.data);
                }
            });
        </script>
    </body>
    </html>
  `;
}

function exportAnalyticsReport(report: AnalyticsReport): void {
  const exportData = {
    generatedAt: new Date().toISOString(),
    report: report,
    metadata: {
      extension: 'DotSense',
      version: '1.3.0'
    }
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const fileName = `dotsense-analytics-${new Date().toISOString().split('T')[0]}.json`;

  vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(fileName),
    filters: {
      'JSON files': ['json'],
      'All files': ['*']
    }
  }).then(uri => {
    if (uri) {
      vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent)).then(() => {
        vscode.window.showInformationMessage(`Analytics report exported to ${uri.fsPath}`);
      }, error => {
        vscode.window.showErrorMessage(`Failed to export analytics: ${error.message}`);
      });
    }
  });
}

function generateWellnessReport(): AnalyticsReport {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const report = {
    period: 'weekly',
    startDate: weekAgo.toISOString(),
    endDate: today.toISOString(),
    summary: {
      totalBreaks: state.breakStats.breaksTaken,
      totalScreenTime: state.screenTimeStats.totalScreenTimeToday,
      averageSessionLength: calculateAverageSessionLength(),
      goalsCompleted: state.wellnessGoals.filter(g => g.completed).length,
      challengesCompleted: state.wellnessChallenges.filter(c => c.completed).length
    },
    dailyStats: generateDailyStats(),
    trends: analyzeTrends(),
    recommendations: generateRecommendations()
  };

  return report;
}

function calculateAverageSessionLength(): number {
  // This would need more sophisticated tracking
  // For now, return a simple calculation
  return state.screenTimeStats.codingSessionStart ?
    Math.floor((Date.now() - state.screenTimeStats.codingSessionStart.getTime()) / (1000 * 60)) : 0;
}

function generateDailyStats(): DailyStats[] {
  // Generate stats for the past 7 days
  const stats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    stats.push({
      date: date.toISOString().split('T')[0],
      breaks: Math.floor(Math.random() * 8) + 2, // Mock data
      screenTime: Math.floor(Math.random() * 480) + 120, // Mock data
      exercises: Math.floor(Math.random() * 5), // Mock data
      goalsCompleted: Math.floor(Math.random() * 3) // Mock data
    });
  }
  return stats;
}

function analyzeTrends(): TrendsData {
  return {
    breakConsistency: 'improving',
    screenTimeTrend: 'stable',
    exerciseFrequency: 'increasing',
    goalCompletionRate: 75
  };
}

function generateRecommendations(): string[] {
  const recommendations = [];

  if (state.breakStats.breaksTaken < 4) {
    recommendations.push('Consider taking more frequent breaks to maintain productivity');
  }

  if (state.screenTimeStats.totalScreenTimeToday > 480) {
    recommendations.push('Your screen time is quite high - consider more eye breaks');
  }

  if (state.wellnessGoals.filter(g => g.completed).length < state.wellnessGoals.length / 2) {
    recommendations.push('Try to complete more daily goals for better wellness tracking');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Your wellness habits are on track.');
  }

  return recommendations;
}
