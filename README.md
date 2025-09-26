# Break Bully - Wellness Extension for VS Code

**Your intelligent wellness companion that helps developers maintain healthy work habits through smart break reminders, exercise guidance, and productivity tracking.**

Break Bully has evolved from a simple reminder system into a comprehensive wellness platform that actively monitors your activity, provides personalized break suggestions, and helps you build sustainable work habits. Whether you need gentle nudges or firm motivation, Break Bully adapts to your needs! 💪

## ✨ Key Features

### 🔔 Intelligent Break Reminders
- **4 Annoyance Levels**: From gentle reminders to persistent nagging
- **Smart Timing**: Adapts based on your work patterns and activity
- **Multiple Personalities**: Choose from gentle, motivational, funny, mindful, or annoying styles
- **Work-Rest Models**: Pomodoro, WHO guidelines, and custom timing

### 👁️ Eye Health & Screen Management
- **Screen Time Tracking**: Monitor continuous screen usage
- **Eye Exercise Library**: 20-20-20 rule and specialized exercises
- **Automatic Break Suggestions**: Smart eye break recommendations
- **Activity Monitoring**: Real-time tracking of coding sessions

### 🏆 Achievement System
- **Progress Tracking**: Unlock badges and achievements
- **Goal Setting**: Daily and weekly wellness objectives
- **Streak Rewards**: Build healthy habits with streak tracking
- **Statistics Dashboard**: Comprehensive wellness analytics

### 🏃‍♂️ Exercise Library
- **Built-in Exercises**: Stretches, breathing, and eye exercises
- **Custom Exercises**: Create and save your own routines
- **Guided Workflows**: Step-by-step exercise instructions
- **Completion Tracking**: Monitor your exercise habits

### 🔗 Git Integration
- **Productivity Tracking**: Monitor commit patterns
- **Smart Break Suggestions**: Break recommendations based on activity
- **Workflow Integration**: Seamless integration with development workflow

## 📱 Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Break Bully"
4. Click Install

### From Source
```bash
git clone https://github.com/kareem2099/break-bully.git
cd break-bully
npm install
npm run compile
```

## 🎮 Complete Command Reference

### Core Commands
- **`Break Bully: Show Reminder`** - Get an immediate break reminder
- **`Break Bully: Toggle Reminders`** - Enable/disable break reminders
- **`Break Bully: Open Settings`** - Access extension configuration
- **`Break Bully: Take a Break`** - Start a break session immediately

### Exercise Commands
- **`Break Bully: Quick Stretch`** - Launch a quick stretching exercise
- **`Break Bully: Eye Exercise`** - Start an eye health exercise
- **`Break Bully: Breathing Exercise`** - Begin a breathing exercise

### Advanced Features
- **`Break Bully: Change Workout Model`** - Switch between work-rest timing models
- **`Break Bully: Force Unblock Screen`** - Emergency screen unblock (admin feature)
- **`Break Bully: Create Custom Exercise`** - Add a new custom exercise
- **`Break Bully: Show Custom Exercise Library`** - Browse your custom exercises
- **`Break Bully: Trigger Git Break Suggestion`** - Check productivity and suggest breaks
- **`Break Bully: Show Update Panel`** - View latest features and updates

## ⚙️ Configuration Options

### Break Reminders
- **Enabled**: Toggle break reminders on/off
- **Interval**: Reminder frequency (5-180 minutes)
- **Show Notification**: Enable/disable popup notifications
- **Play Sound**: Audio notifications for reminders
- **Reminder Type**: Choose personality (gentle, motivational, funny, mindful, annoying)
- **Annoyance Level**: Escalation intensity (mild, moderate, extreme, nuclear)
- **Persistent Nagging**: Continuous reminders until break is taken

### Eye Health
- **Enable Eye Exercises**: Toggle eye health features
- **Screen Break Interval**: Minutes before eye break suggestions

### Goals & Achievements
- **Enable Goals**: Daily/weekly wellness objectives
- **Enable Achievements**: Badge and reward system

### Work-Rest Models
- **Work-Rest Model**: Choose timing pattern:
  - `pomodoro-classic`: 25min work, 5min rest
  - `who-45min-work-15min-rest`: WHO recommended
  - `who-1hour-work-30min-rest`: Extended sessions
  - `who-2hour-work-1hour-rest`: Long work blocks
  - `who-90min-work-30min-rest`: Research-based
  - `custom-flexible`: Custom timing

### Git Integration
- **Enable Git Integration**: Productivity tracking
- **Commit Threshold**: Commits before break suggestion
- **Productivity Check Interval**: Minutes between checks

### Notifications
- **Show Exercise Completion**: Completion notifications
- **Play Exercise Completion Sound**: Audio feedback

## 🏗️ Architecture

### Modular Design
- **Core Engine**: Break timing and reminder logic
- **UI System**: Modern webview interface with VSCode theming
- **Service Layer**: Specialized services for different features
- **Storage System**: Persistent data management
- **Analytics**: Comprehensive usage tracking

### File Structure
```
src/
├── extension.ts          # Main extension entry point
├── types.ts             # TypeScript type definitions
├── models/
│   └── state.ts         # Global state management
├── services/            # Feature-specific services
│   ├── breakService.ts
│   ├── exerciseService.ts
│   ├── wellnessService.ts
│   ├── achievementService.ts
│   └── analyticsService.ts
├── ui/                  # User interface components
│   ├── activityBarProvider.ts
│   ├── changeWorkoutPanel.ts
│   └── updatePanel.ts
├── views/               # Webview HTML/CSS/JS
├── core/                # Core functionality
└── utils/               # Utility functions
```

## 🧪 Testing

```bash
npm test          # Run all tests
npm run test:ci   # CI environment testing
```

**Test Coverage:**
- ✅ Extension activation and registration
- ✅ Command execution and validation
- ✅ Configuration management
- ✅ UI component functionality
- ✅ Service layer operations
- ✅ Error handling and edge cases

## 📊 Wellness Insights

Break Bully provides comprehensive analytics:
- **Break Patterns**: Frequency and consistency tracking
- **Screen Time**: Daily usage monitoring
- **Goal Completion**: Progress toward wellness objectives
- **Achievement Progress**: Badge earning statistics
- **Exercise Habits**: Usage patterns and preferences

## 🔧 Development

### Prerequisites
- Node.js 18+
- VSCode 1.60+
- TypeScript 4.9+

### Setup
```bash
npm install          # Install dependencies
npm run compile      # Build the extension
npm run watch        # Watch mode for development
```

### Testing
```bash
npm test            # Run test suite
npm run test:ci     # CI testing
```

### Publishing
```bash
npm run vscode:prepublish  # Prepare for publishing
vsce package               # Create .vsix package
vsce publish               # Publish to marketplace
```

## 🤝 Contributing

We welcome contributions! Break Bully is open source and we appreciate help in making it better.

### Ways to Contribute
- **Bug Reports**: Found an issue? Let us know!
- **Feature Requests**: Have ideas for new wellness features?
- **Code Contributions**: Help improve the codebase
- **Documentation**: Improve guides and documentation
- **Testing**: Add more test coverage

### Development Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- Built with VSCode Extension API
- Inspired by wellness research and developer health initiatives
- Thanks to the VSCode community for extension development resources

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kareem2099/break-bully/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kareem2099/break-bully/discussions)
- **Documentation**: See CHANGELOG.md for version details

---

**Break Bully**: Because your health is too important to ignore! 💚

*Helping developers worldwide maintain healthy work-life balance, one smart break at a time.*
