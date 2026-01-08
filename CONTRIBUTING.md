# Contributing to DotSense

Want to help make DotSense even more annoyingly effective? We welcome contributions! 🎉

## How to Contribute

### 🐛 Bug Reports
Found a bug that makes the bully less annoying? Please report it!

**Before submitting:**
- Check if the issue already exists
- Make sure it's actually a bug and not a feature (yes, excessive nagging is intentional!)

**Include:**
- VS Code version
- DotSense version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### ✨ Feature Requests
Got ideas to make DotSense more effective? We want to hear them!

**Popular requests:**
- More aggressive harassment methods
- Additional personality types
- Team bullying features
- Integration with external apps
- Custom bully avatars
- Sound effects and audio harassment

### 🚀 Code Contributions

#### Getting Started
1. Fork the repository
2. Clone your fork: `git clone https://github.com/kareem2099/dotsense.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

#### Development Setup
```bash
# Install dependencies
npm install

# Open in VS Code
code .

# Press F5 to run extension in development mode
# Make changes and test in the Extension Development Host
```

#### Code Style Guidelines
- Use descriptive variable names (even for annoyance-related code!)
- Add comments for complex harassment logic
- Keep functions focused and testable
- Use consistent indentation (2 spaces)
- Follow existing code patterns

#### Testing Your Changes
- Test all annoyance levels (Mild through Nuclear)
- Verify status bar updates correctly
- Check notification behavior in different scenarios
- Test configuration changes
- Ensure proper cleanup on deactivation

### 📝 Documentation
Help improve our docs!
- Fix typos or unclear explanations
- Add examples of effective harassment
- Improve setup instructions
- Document new features

### 🎨 Design Contributions
- Icons for different bully moods
- Status bar emoji improvements
- Notification styling suggestions
- UI/UX improvements for settings

## Development Guidelines

### Adding New Annoyance Methods
When adding new ways to bully developers:

1. **Respect System Resources**: Don't crash VS Code with excessive notifications
2. **User Control**: Always provide a way to disable/reduce new features
3. **Graceful Degradation**: Handle edge cases without breaking the extension
4. **Documentation**: Update README and changelog with new harassment methods

### Message Guidelines
New bully messages should be:
- **Firm but caring** - the goal is health, not actual harassment
- **Appropriately aggressive** for their annoyance level
- **Professional enough** for workplace use
- **Inclusive and respectful** - no offensive content

### Code Structure
```javascript
// Good: Clear harassment logic
function escalateAnnoyance() {
  if (ignoreCount > 3) {
    enableNuclearMode();
  }
}

// Bad: Unclear purpose
function doStuff() {
  // mysterious harassment code
}
```

## Pull Request Process

1. **Create descriptive PR title**: "Add nuclear mode screen flashing"
2. **Describe changes**: What harassment methods are added/changed?
3. **Test thoroughly**: Verify your bullying works as expected
4. **Update docs**: Add any new configuration options or features
5. **Be responsive**: Address feedback promptly

### PR Checklist
- [ ] Code follows project style
- [ ] New features are documented
- [ ] All annoyance levels tested
- [ ] No breaking changes (unless major version)
- [ ] CHANGELOG.md updated
- [ ] README.md updated if needed

## Types of Contributions Needed

### 🔥 High Priority
- **Sound Effects**: Audio harassment for maximum annoyance
- **Screen Dimming**: Visual break enforcement
- **Break Streak Tracking**: Shame users for missed breaks
- **Team Features**: Synchronized DotSenseing

### 🎯 Medium Priority
- **More Personalities**: Additional bully types
- **Better Messages**: More creative harassment text
- **Visual Improvements**: Status bar enhancements
- **Integration**: Connect with fitness/health apps

### 💡 Nice to Have
- **Custom Avatars**: User-selected bully characters
- **Analytics**: Break compliance tracking
- **Themes**: Different visual styles
- **Accessibility**: Screen reader support for harassment

## Community Guidelines

### Be Respectful
- Constructive feedback only
- Help newcomers learn the codebase
- Celebrate effective bullying implementations
- Keep discussions professional

### Stay On Theme
- Remember: we're building helpful harassment
- Focus on developer wellness through annoyance
- Maintain the playful but caring tone

### Code of Conduct
- Be inclusive and welcoming
- Respect different perspectives on effective nagging
- Focus on the code, not the person
- Help create a positive development environment

## Recognition

Contributors will be:
- Listed in README.md
- Mentioned in release notes
- Given credit for their harassment innovations
- Thanked by developers who achieve better work-life balance

## Questions?

- **General questions**: Open a discussion
- **Bug reports**: Create an issue
- **Feature ideas**: Start with an issue to discuss
- **Code questions**: Comment on relevant files

---

**Remember**: We're building annoying software that actually helps people. Every contribution makes developers healthier! 💪

*"Together, we can annoy the world into better wellness habits!"* 😄
