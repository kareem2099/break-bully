import * as vscode from 'vscode';
import {
  UserAssessment,
  WorkStyle,
  BreakStyle,
  AssessmentQuestion,
  AnswerOption,
  AssessmentFlow,
  ModelScenario,
  ActivityAnalysis,
  ScoreValue
} from '../types/mlWorkRestTypes';
import { MLWorkRestGenerator } from '../services/mlWorkRestGenerator';
import { ActivityEvent } from '../services/activityIntegration/activityTypes';
import { state } from '../models/state';

// Type definitions for the assessment panel
interface WebviewMessage {
  type: string;
  data?: unknown;
}

interface AnswerSubmissionData {
  questionId: string;
  answerId: string;
}

/**
 * Work-Rest Assessment Panel
 * Interactive questionnaire-guided assessment to personalize work-rest models
 */
export class WorkRestAssessmentPanel {
  public static currentPanel: WorkRestAssessmentPanel | undefined;
  public static readonly viewType = 'workRestAssessment';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private currentAssessment: Partial<UserAssessment> = {};
  private currentFlow: AssessmentFlow;
  private currentQuestionIndex = 0;
  private activityEvents: ActivityAnalysis[] = [];

  constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, activityEvents: ActivityAnalysis[] = []) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    console.log('WorkRestAssessmentPanel constructor called with activityEvents:', activityEvents?.length || 0);

    this.activityEvents = activityEvents || [];

    this.currentFlow = this.initializeAssessmentFlow();

    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'src', 'views'),
        vscode.Uri.joinPath(this._extensionUri, 'assets'),
      ]
    };

    // Make sure the panel is visible and focused
    this._panel.reveal(vscode.ViewColumn.One, true);

    // Focus the panel after a small delay
    setTimeout(() => {
      this._panel.reveal(vscode.ViewColumn.Active, true);
    }, 100);

    console.log('Panel revealed, setting up message handlers');

    this._panel.webview.onDidReceiveMessage(async (message) => {
      console.log('Assessment panel received message:', message.type);
      await this.handleMessage(message);
    });

    this._panel.onDidDispose(() => {
      console.log('Assessment panel disposed');
      WorkRestAssessmentPanel.currentPanel = undefined;
    });

    console.log('Starting assessment with first question');
    this.showQuestion(0);
  }

  /**
   * Create and show the assessment panel
   */
  public static createOrShow(extensionUri: vscode.Uri, activityEvents?: ActivityAnalysis[]): void {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : undefined;

    if (WorkRestAssessmentPanel.currentPanel) {
      WorkRestAssessmentPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WorkRestAssessmentPanel.viewType,
      'Personalized Work-Rest Assessment',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'src', 'views'),
          vscode.Uri.joinPath(extensionUri, 'assets')
        ]
      }
    );

    WorkRestAssessmentPanel.currentPanel = new WorkRestAssessmentPanel(panel, extensionUri, activityEvents);
  }

  /**
   * Initialize the assessment flow with personality-based questions
   * Uses AnswerOption[] for answer definitions with scoring information
   */
  private initializeAssessmentFlow(): AssessmentFlow {
    return {
      questions: [
        {
          id: 'workStyle',
          title: 'How do you typically prefer to work?',
          description: 'Understanding your natural work rhythm helps create the perfect schedules.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'focused_bursts',
              label: 'Focused Bursts',
              description: 'I work best in intense, short sessions (25-35 minutes) with longer breaks',
              icon: '⚡',
              score: { [WorkStyle.FOCUSED_BURSTS]: 1.0 }
            },
            {
              id: 'sustained_flow',
              label: 'Sustained Flow',
              description: 'I can maintain deep focus for longer periods (60-90 minutes) with regular breaks',
              icon: '🏃‍♂️',
              score: { [WorkStyle.SUSTAINED_FLOW]: 1.0 }
            },
            {
              id: 'flexible_adaptive',
              label: 'Flexible & Adaptive',
              description: 'I adapt well to different work patterns depending on the task',
              icon: '🔄',
              score: { [WorkStyle.FLEXIBLE_ADAPTIVE]: 1.0 }
            },
            {
              id: 'short_iterations',
              label: 'Short Iterations',
              description: 'I prefer very brief work sessions (15-25 minutes) with frequent breaks',
              icon: '🔥',
              score: { [WorkStyle.SHORT_ITERATIONS]: 1.0 }
            }
          ]
        },
        {
          id: 'productivity_hours',
          title: 'When are you typically most productive?',
          description: 'We all have natural energy peaks and valleys throughout the day.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'morning',
              label: 'Morning Hours',
              description: 'My peak productivity is in the early morning (6AM-11AM)',
              icon: '🌅',
              score: { morningPeak: 1.0, energyMorning: 0.8 }
            },
            {
              id: 'midday',
              label: 'Midday Hours',
              description: 'I\'m most focused during mid-morning to early afternoon (9AM-2PM)',
              icon: '☀️',
              score: { middayPeak: 1.0, energyMidday: 0.8 }
            },
            {
              id: 'afternoon',
              label: 'Afternoon Hours',
              description: 'My energy peaks in the afternoon and early evening (12PM-6PM)',
              icon: '🌇',
              score: { afternoonPeak: 1.0, energyAfternoon: 0.8 }
            },
            {
              id: 'evening',
              label: 'Evening Hours',
              description: 'I\'m most productive later in the evening (after 7PM)',
              icon: '🌙',
              score: { eveningPeak: 1.0, energyEvening: 0.8 }
            }
          ]
        },
        {
          id: 'break_preferences',
          title: 'How do you prefer to spend your breaks?',
          description: 'The right break activities can help you recharge and stay motivated.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'mind_clearing',
              label: 'Mind Clearing',
              description: 'Meditation, deep breathing, or quiet reflection',
              icon: '🧘‍♀️',
              score: { [BreakStyle.MIND_CLEARING]: 1.0, preferredBreakActivities: ['meditation', 'breathing'] }
            },
            {
              id: 'light_distraction',
              label: 'Light Distraction',
              description: 'Reading, podcasts, or casual social media browsing',
              icon: '🎧',
              score: { [BreakStyle.LIGHT_DISTRACTION]: 1.0, preferredBreakActivities: ['reading', 'podcasts'] }
            },
            {
              id: 'physical_activity',
              label: 'Physical Activity',
              description: 'Walking, stretching, or any form of movement',
              icon: '🚶‍♂️',
              score: { [BreakStyle.PHYSICAL_ACTIVITY]: 1.0, preferredBreakActivities: ['walking', 'stretching'] }
            },
            {
              id: 'social_interaction',
              label: 'Social Interaction',
              description: 'Chat with colleagues, make a phone call, or step away for social time',
              icon: '💬',
              score: { [BreakStyle.SOCIAL_INTERACTION]: 1.0, preferredBreakActivities: ['social', 'calls'] }
            }
          ]
        },
        {
          id: 'break_length_preference',
          title: 'How long do you prefer your breaks to be?',
          description: 'Different break lengths work better for different people and tasks.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'short_breaks',
              label: 'Short Breaks (5-10 minutes)',
              description: 'Quick resets that keep me moving through my day',
              icon: '⚡',
              score: { preferredBreakDuration: 7.5, breakFrequencyPreference: 'frequent' }
            },
            {
              id: 'medium_breaks',
              label: 'Medium Breaks (10-15 minutes)',
              description: 'Enough time to recharge but not disrupt my flow too much',
              icon: '🔄',
              score: { preferredBreakDuration: 12.5, breakFrequencyPreference: 'regular' }
            },
            {
              id: 'long_breaks',
              label: 'Long Breaks (15-25 minutes)',
              description: 'Extended breaks for deeper relaxation and context switching',
              icon: '🏖️',
              score: { preferredBreakDuration: 20, breakFrequencyPreference: 'extended' }
            },
            {
              id: 'flexible_breaks',
              label: 'Flexible Length',
              description: 'I adapt break length based on how I feel and what I need',
              icon: '🎯',
              score: { preferredBreakDuration: 15, breakFrequencyPreference: 'adaptive' }
            }
          ]
        },
        {
          id: 'adaptability',
          title: 'How adaptable are you to schedule changes?',
          description: 'Some people thrive on routine, while others prefer flexibility.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'very_flexible',
              label: 'Very Flexible',
              description: 'I handle schedule changes easily and adapt quickly',
              icon: '🌀',
              score: { adaptabilityRating: 0.9 }
            },
            {
              id: 'moderately_flexible',
              label: 'Moderately Flexible',
              description: 'I\'m okay with some changes but prefer consistency',
              icon: '⚖️',
              score: { adaptabilityRating: 0.7 }
            },
            {
              id: 'structured',
              label: 'Prefer Structure',
              description: 'I work best with consistent schedules and predictability',
              icon: '📅',
              score: { adaptabilityRating: 0.4 }
            },
            {
              id: 'highly_routine',
              label: 'Highly Routine',
              description: 'I need strict schedules and find changes very disruptive',
              icon: '⏰',
              score: { adaptabilityRating: 0.2 }
            }
          ]
        },
        {
          id: 'fatigue_patterns',
          title: 'How do you typically respond to tiredness while working?',
          description: 'Everyone experiences fatigue differently during the workday.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'power_through',
              label: 'Power Through',
              description: 'I push through tiredness but quality suffers',
              icon: '💪',
              score: { fatigueResponse: 'ignores', burnoutRisk: 0.8 }
            },
            {
              id: 'gradual_decline',
              label: 'Gradual Quality Decline',
              description: 'My work quality decreases noticeably when I\'m tired',
              icon: '📉',
              score: { fatigueResponse: 'gradual_decline', burnoutRisk: 0.6 }
            },
            {
              id: 'take_immediate_breaks',
              label: 'Take Breaks Immediately',
              description: 'I notice tiredness early and take breaks proactively',
              icon: '🛑',
              score: { fatigueResponse: 'proactive', burnoutRisk: 0.3 }
            },
            {
              id: 'creativity_boost',
              label: 'Creativity Boost',
              description: 'Some tiredness actually boosts my creativity and problem-solving',
              icon: '💡',
              score: { fatigueResponse: 'enhanced_creativity', burnoutRisk: 0.2 }
            }
          ]
        },
        {
          id: 'goal_orientation',
          title: 'What motivates your work patterns?',
          description: 'Understanding your motivation helps optimize your productivity.',
          type: 'single_choice',
          required: true,
          answers: [
            {
              id: 'time_based',
              label: 'Time-Based Goals',
              description: 'I work best with scheduled breaks and time-based completion',
              icon: '⏱️',
              score: { motivationStyle: 'time_based', interruptionTolerance: 0.7 }
            },
            {
              id: 'task_based',
              label: 'Task-Based Goals',
              description: 'I prefer completing full tasks before taking breaks',
              icon: '✅',
              score: { motivationStyle: 'task_based', interruptionTolerance: 0.3 }
            },
            {
              id: 'flow_based',
              label: 'Flow State Focus',
              description: 'I get immersed in work and lose track of time',
              icon: '🎯',
              score: { motivationStyle: 'flow_based', interruptionTolerance: 0.8 }
            },
            {
              id: 'balanced',
              label: 'Balanced Approach',
              description: 'Mix of time, task, and flow - depends on the work',
              icon: '⚖️',
              score: { motivationStyle: 'balanced', interruptionTolerance: 0.5 }
            }
          ]
        }
      ]
    };
  }

  /**
   * Show a specific question in the assessment flow
   */
  private showQuestion(questionIndex: number): void {
    if (questionIndex >= this.currentFlow.questions.length) {
      this.completeAssessment();
      return;
    }

    const question = this.currentFlow.questions[questionIndex];
    this.currentQuestionIndex = questionIndex;

    this.renderQuestion(question, questionIndex);
  }

  /**
   * Render a question in the webview
   */
  private renderQuestion(question: AssessmentQuestion, questionIndex: number): void {
    const isFirstQuestion = questionIndex === 0;
    const isLastQuestion = questionIndex === this.currentFlow.questions.length - 1;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Work-Rest Assessment</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            color: #333;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            margin-bottom: 30px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
        }

        .question-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #333;
        }

        .question-description {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .answer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 30px;
        }

        .answer-card {
            position: relative;
            padding: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            background: white;
        }

        .answer-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            border-color: #667eea;
        }

        .answer-card.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .answer-card.selected .answer-description {
            color: rgba(255, 255, 255, 0.9);
        }

        .answer-icon {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .answer-label {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .answer-description {
            font-size: 14px;
            color: #666;
            line-height: 1.4;
        }

        .button-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 40px;
        }

        .nav-button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .nav-button.back {
            background: #f0f0f0;
            color: #666;
        }

        .nav-button.back:hover:not(:disabled) {
            background: #e0e0e0;
        }

        .nav-button.next {
            background: linear-gradient(90deg, #667eea, #764ba2);
            color: white;
        }

        .nav-button.next:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .question-counter {
            font-size: 14px;
            color: #888;
            text-align: center;
        }

        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }

            .answer-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .question-title {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${(questionIndex + 1) / this.currentFlow.questions.length * 100}%"></div>
        </div>

        <h1 class="question-title">${question.title}</h1>
        <p class="question-description">${question.description}</p>

        <div class="answer-grid" id="answerGrid">
            ${question.answers.map(answer => `
                <div class="answer-card" data-answer-id="${answer.id}" onclick="selectAnswer('${answer.id}')">
                    <div class="answer-icon">${answer.icon}</div>
                    <div class="answer-label">${answer.label}</div>
                    <div class="answer-description">${answer.description}</div>
                </div>
            `).join('')}
        </div>

        <div class="button-container">
            <button class="nav-button back" ${isFirstQuestion ? 'disabled' : ''} onclick="previousQuestion()">
                ← Back
            </button>

            <div class="question-counter">
                Question ${questionIndex + 1} of ${this.currentFlow.questions.length}
            </div>

            <button class="nav-button next" id="nextButton" onclick="nextQuestion()" disabled>
                ${isLastQuestion ? 'Complete Assessment' : 'Next →'}
            </button>
        </div>
    </div>

    <script>
        let selectedAnswerId = null;
        const vscode = acquireVsCodeApi();

        function selectAnswer(answerId) {
            console.log('JavaScript: selectAnswer called with:', answerId);
            // Remove previous selection
            document.querySelectorAll('.answer-card').forEach(card => {
                card.classList.remove('selected');
            });

            // Add selection to clicked card
            const selectedCard = document.querySelector(\`[data-answer-id="\${answerId}"]\`);
            if (selectedCard) {
                selectedCard.classList.add('selected');
            } else {
                console.log('JavaScript: Could not find selected card for answerId:', answerId);
            }

            selectedAnswerId = answerId;
            console.log('JavaScript: Set selectedAnswerId to:', selectedAnswerId);

            // Enable next button
            const nextButton = document.getElementById('nextButton');
            if (nextButton) {
                nextButton.disabled = false;
                console.log('JavaScript: Enabled next button');
            } else {
                console.log('JavaScript: Could not find nextButton element');
            }
        }

        function nextQuestion() {
            console.log('JavaScript: nextQuestion called, selectedAnswerId:', selectedAnswerId);
            if (!selectedAnswerId) {
                console.log('JavaScript: No answer selected, returning');
                return;
            }

            const message = {
                type: 'submitAnswer',
                data: {
                    questionId: '${question.id}',
                    answerId: selectedAnswerId
                }
            };
            console.log('JavaScript: Sending message to extension:', message);

            // Send message to extension using VSCode API
            vscode.postMessage(message);
        }

        function previousQuestion() {
            console.log('JavaScript: Moving to previous question');
            // Send message to extension using VSCode API
            vscode.postMessage({
                type: 'previousQuestion'
            });
        }

        // Handle keyboard navigation
        document.addEventListener('keydown', (event) => {
            console.log('JavaScript: Key pressed:', event.key);
            if (event.key === 'Enter' && selectedAnswerId && !document.getElementById('nextButton')?.disabled) {
                console.log('JavaScript: Enter pressed, calling nextQuestion');
                nextQuestion();
            } else if (event.key === 'ArrowLeft' && !document.getElementById('backButton')?.disabled) {
                console.log('JavaScript: ArrowLeft pressed, calling previousQuestion');
                previousQuestion();
            }
        });

        console.log('JavaScript: Assessment panel script loaded for question ${questionIndex + 1}');
    </script>
</body>
</html>`;

    this._panel.webview.html = htmlContent;
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    console.log('WorkRestAssessmentPanel handling message:', message);

    switch (message.type) {
      case 'submitAnswer':
        console.log('Handling submit answer:', message.data);
        await this.handleAnswerSubmission(message.data as AnswerSubmissionData);
        break;
      case 'previousQuestion':
        console.log('Moving to previous question');
        this.showQuestion(Math.max(0, this.currentQuestionIndex - 1));
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle answer submission and score accumulation
   */
  private async handleAnswerSubmission(data: { questionId: string; answerId: string }): Promise<void> {
    const question = this.currentFlow.questions.find(q => q.id === data.questionId);
    const answer = question?.answers.find(a => a.id === data.answerId) as AnswerOption | undefined;

    if (!question || !answer) return;

    // Accumulate scores
    this.accumulateAssessmentScores(answer.score);

    // Add to assessment
    this.currentAssessment.questionResponses = this.currentAssessment.questionResponses || [];
    this.currentAssessment.questionResponses.push({
      questionId: question.id,
      answerId: answer.id,
      score: answer.score,
      timestamp: new Date()
    });

    // Move to next question
    this.showQuestion(this.currentQuestionIndex + 1);
  }

  /**
   * Accumulate assessment scores from answers
   */
  private accumulateAssessmentScores(scores: Record<string, ScoreValue>): void {
    // Initialize assessment with proper structure
    this.currentAssessment.userPreferences = this.currentAssessment.userPreferences || {
      preferredWorkStyle: WorkStyle.FOCUSED_BURSTS,
      preferredBreakStyle: BreakStyle.MIND_CLEARING,
      preferredBreakDuration: 10,
      adaptabilityRating: 0.5,
      motivationStyle: 'balanced'
    };
    this.currentAssessment.energyPatterns = this.currentAssessment.energyPatterns || {
      morningPeak: 0,
      middayPeak: 0,
      afternoonPeak: 0,
      eveningPeak: 0,
      energyMorning: 0.7,
      energyMidday: 0.7,
      energyAfternoon: 0.7
    };
    this.currentAssessment.adaptabilityRating = 0;
    this.currentAssessment.completionScore = 0;
    this.currentAssessment.scoredAttributes = this.currentAssessment.scoredAttributes || {};

    // Accumulate scores
    Object.entries(scores).forEach(([key, value]) => {
      if (typeof value === 'number') {
        const currentValue = this.currentAssessment.scoredAttributes![key];
        const currentNum = typeof currentValue === 'number' ? currentValue : 0;
        this.currentAssessment.scoredAttributes![key] = currentNum + value;
      } else if (Array.isArray(value)) {
        // Handle array values like preferredBreakActivities
        const currentValue = this.currentAssessment.scoredAttributes![key];
        const currentArray = Array.isArray(currentValue) ? currentValue : [];
        currentArray.push(...value);
        this.currentAssessment.scoredAttributes![key] = currentArray;
      } else {
        // Handle string or other values
        this.currentAssessment.scoredAttributes![key] = value;
      }
    });
  }

  /**
   * Finalize assessment and generate personalized models
   */
  private async completeAssessment(): Promise<void> {
    // Convert accumulated scores to final assessment
    const finalAssessment = this.createFinalAssessment();

    // Validate assessment completeness
    if (!this.validateAssessment(finalAssessment)) {
      vscode.window.showErrorMessage('Assessment incomplete. Please answer all questions.');
      this.showQuestion(0); // Restart assessment
      return;
    }

    // Generate personalized models
    await this.generatePersonalModels(finalAssessment);

    // Store assessment
    state.storage?.saveCustomSetting('lastUserAssessment', finalAssessment);
  }

  /**
   * Convert accumulated scores to final UserAssessment object
   */
  private createFinalAssessment(): UserAssessment {
    const scoredAttrs = this.currentAssessment.scoredAttributes || {};

    // Determine work style (highest score wins)
    const workStyleScores = {
      [WorkStyle.FOCUSED_BURSTS]: (scoredAttrs['focused_bursts'] as number) || 0,
      [WorkStyle.SUSTAINED_FLOW]: (scoredAttrs['sustained_flow'] as number) || 0,
      [WorkStyle.FLEXIBLE_ADAPTIVE]: (scoredAttrs['flexible_adaptive'] as number) || 0,
      [WorkStyle.SHORT_ITERATIONS]: (scoredAttrs['short_iterations'] as number) || 0
    };

    const preferredWorkStyle = Object.entries(workStyleScores)
      .reduce((a, b) => workStyleScores[a[0] as WorkStyle] > workStyleScores[b[0] as WorkStyle] ? a : b)[0] as WorkStyle;

    // Determine break style (highest score wins)
    const breakStyleScores = {
      mind_clearing: (scoredAttrs['mind_clearing'] as number) || 0,
      light_distraction: (scoredAttrs['light_distraction'] as number) || 0,
      physical_activity: (scoredAttrs['physical_activity'] as number) || 0,
      social_interaction: (scoredAttrs['social_interaction'] as number) || 0
    };

    const preferredBreakStyle = Object.entries(breakStyleScores)
      .reduce((a, b) => breakStyleScores[a[0] as keyof typeof breakStyleScores] > breakStyleScores[b[0] as keyof typeof breakStyleScores] ? a : b)[0] as BreakStyle;

    return {
      id: `assessment_${Date.now()}`,
      timestamp: new Date(),
      userPreferences: {
        preferredWorkStyle,
        preferredBreakStyle,
        preferredBreakDuration: (scoredAttrs.preferredBreakDuration as number) || 10,
        adaptabilityRating: (scoredAttrs.adaptabilityRating as number) || 0.5,
        motivationStyle: (scoredAttrs.motivationStyle as string) || 'balanced'
      },
      energyPatterns: {
        morningPeak: (scoredAttrs.morningPeak as number) || 0,
        middayPeak: (scoredAttrs.middayPeak as number) || 0,
        afternoonPeak: (scoredAttrs.afternoonPeak as number) || 0,
        eveningPeak: (scoredAttrs.eveningPeak as number) || 0,
        energyMorning: (scoredAttrs.energyMorning as number) || 0.7,
        energyMidday: (scoredAttrs.energyMidday as number) || 0.7,
        energyAfternoon: (scoredAttrs.energyAfternoon as number) || 0.7
      },
      preferredBreakActivities: Array.from(new Set((scoredAttrs.preferredBreakActivities as string[]) || [])),
      completionScore: 1.0, // Completed all questions
      scoredAttributes: scoredAttrs,
      questionResponses: this.currentAssessment.questionResponses || []
    };
  }

  /**
   * Validate assessment completion
   */
  private validateAssessment(assessment: UserAssessment): boolean {
    const requiredFields = [
      assessment.userPreferences?.preferredWorkStyle,
      assessment.userPreferences?.preferredBreakStyle,
      assessment.completionScore > 0
    ];

    return requiredFields.every(field => field !== undefined && field !== null);
  }

  /**
   * Generate personalized models based on completed assessment
   */
  private async generatePersonalModels(assessment: UserAssessment): Promise<void> {
    try {
      // Show loading indicator
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating Your Personalized Models",
        cancellable: false
      }, async (progress) => {

        progress.report({ increment: 20, message: "Analyzing your assessment..." });

        // Generate models using ML service with activity data
        const generationResult = MLWorkRestGenerator.generatePersonalModels(
          assessment,
          this.activityEvents as unknown as ActivityEvent[], // Use activity events passed to constructor
          []  // No usage history initially
        );

        progress.report({ increment: 40, message: `Creating ${Object.values(ModelScenario).length} scenario-specific models (${ModelScenario.MORNING_FOCUS}, ${ModelScenario.AFTERNOON_SUSTAINED}, ${ModelScenario.EVENING_MAINTENANCE}, etc.)...` });

        // Store generated models
        const personalModels = {
          assessment,
          models: generationResult.recommended,
          alternatives: generationResult.alternatives,
          confidence: generationResult.confidence,
          notes: generationResult.generationNotes,
          insights: generationResult.personalizationInsights,
          generatedAt: new Date()
        };

        progress.report({ increment: 20, message: "Saving your personalized models..." });

        // Save to storage
        state.storage?.saveCustomSetting('userAssessmentPersonalModels', personalModels);

        progress.report({ increment: 20, message: "Complete!" });

        // Show success message
        vscode.window.showInformationMessage(
          `✨ Assessment complete! Generated ${generationResult.recommended.length} personalized models. Click below to see them!`,
          'View AI Models'
        ).then(selection => {
          if (selection === 'View AI Models') {
            // Trigger opening the change workout panel to show the new models
            vscode.commands.executeCommand('breakBully.changeWorkout');
          }
        });
      });

      // Close assessment panel
      this._panel.dispose();

    } catch (error) {
      console.error('Failed to generate personal models:', error);
      vscode.window.showErrorMessage('Failed to generate personalized models. Please try again.');

      // Allow user to restart assessment
      this.showQuestion(0);
    }
  }
}
