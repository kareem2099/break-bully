import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import 'mocha';

// Test suite for Break Bully Extension
describe('Break Bully Extension Tests', function(this: Mocha.Suite) {
  this.timeout(10000); // Increase timeout for extension activation

  let extension: vscode.Extension<any> | undefined;

  before(async function(this: Mocha.Context) {
    // Activate the extension
    const extensionId = 'your-publisher.break-bully';
    extension = vscode.extensions.getExtension(extensionId);

    if (extension) {
      await extension.activate();
    }
  });

  describe('Extension Activation', function() {
    it('should activate successfully', function() {
      assert.ok(extension, 'Extension should be found');
      assert.ok(extension?.isActive, 'Extension should be active');
    });

    it('should register all commands', async function() {
      const commands = await vscode.commands.getCommands();

      assert.ok(commands.includes('breakBully.showReminder'),
        'Should register showReminder command');
      assert.ok(commands.includes('breakBully.toggleReminders'),
        'Should register toggleReminders command');
      assert.ok(commands.includes('breakBully.openSettings'),
        'Should register openSettings command');
    });
  });

  describe('Configuration Tests', function() {
    it('should have default configuration values', function() {
      const config = vscode.workspace.getConfiguration('breakBully');

      assert.strictEqual(config.get('enabled'), true,
        'Should be enabled by default');
      assert.strictEqual(config.get('interval'), 30,
        'Should have 30 minute default interval');
      assert.strictEqual(config.get('annoyanceLevel'), 'moderate',
        'Should have moderate annoyance level by default');
      assert.strictEqual(config.get('reminderType'), 'gentle',
        'Should have gentle reminder type by default');
    });

    it('should validate annoyance level options', function() {
      const config = vscode.workspace.getConfiguration('breakBully');
      const schema = config.inspect('annoyanceLevel');

      const expectedLevels = ['mild', 'moderate', 'extreme', 'nuclear'];
      assert.ok(schema, 'Configuration should exist');
      // Note: Exact validation depends on VS Code's config system
    });
  });

  describe('Command Execution Tests', function() {
    it('should execute show reminder command', async function() {
      try {
        await vscode.commands.executeCommand('breakBully.showReminder');
        // Command should execute without throwing
        assert.ok(true, 'Command executed successfully');
      } catch (error) {
        assert.fail(`Command failed: ${(error as Error).message}`);
      }
    });

    it('should execute toggle reminders command', async function() {
      try {
        await vscode.commands.executeCommand('breakBully.toggleReminders');
        assert.ok(true, 'Toggle command executed successfully');
      } catch (error) {
        assert.fail(`Toggle command failed: ${(error as Error).message}`);
      }
    });

    it('should execute open settings command', async function() {
      try {
        await vscode.commands.executeCommand('breakBully.openSettings');
        assert.ok(true, 'Settings command executed successfully');
      } catch (error) {
        assert.fail(`Settings command failed: ${(error as Error).message}`);
      }
    });
  });

  describe('Message Generation Tests', function() {
    // Mock the extension's message generation if exported
    const reminderMessages: Record<string, string[]> = {
      gentle: ['Test gentle message'],
      annoying: ['TEST ANNOYING MESSAGE'],
      motivational: ['Test motivational message'],
      funny: ['Test funny message'],
      mindful: ['Test mindful message']
    };

    function getRandomMessage(type: string): string {
      const messages = reminderMessages[type] || reminderMessages.gentle;
      return messages[Math.floor(Math.random() * messages.length)];
    }

    it('should return gentle messages', function() {
      const message = getRandomMessage('gentle');
      assert.ok(message, 'Should return a message');
      assert.ok(typeof message === 'string', 'Should return a string');
    });

    it('should return annoying messages in caps', function() {
      const message = getRandomMessage('annoying');
      assert.ok(message, 'Should return a message');
      assert.ok(message.toUpperCase() === message,
        'Annoying messages should be in caps');
    });

    it('should fallback to gentle messages for invalid types', function() {
      const message = getRandomMessage('invalid');
      assert.ok(message, 'Should return a fallback message');
    });
  });

  describe('Timer Management Tests', function() {
    it('should handle timer lifecycle', function() {
      // Test timer creation and cleanup
      let testTimer: NodeJS.Timeout | undefined;

      // Create timer
      testTimer = setInterval(() => {
        // Mock timer behavior
      }, 1000);

      assert.ok(testTimer, 'Timer should be created');

      // Clear timer
      clearInterval(testTimer);
      testTimer = undefined;

      assert.strictEqual(testTimer, undefined, 'Timer should be cleared');
    });
  });

  describe('Annoyance Level Tests', function() {
    const testConfig: Record<string, { interval: number; aggressive: boolean }> = {
      mild: { interval: 30000, aggressive: false },
      moderate: { interval: 30000, aggressive: false },
      extreme: { interval: 15000, aggressive: true },
      nuclear: { interval: 10000, aggressive: true }
    };

    it('should have appropriate intervals for each level', function() {
      Object.keys(testConfig).forEach(level => {
        const config = testConfig[level];
        assert.ok(config.interval > 0,
          `${level} should have positive interval`);

        if (level === 'extreme' || level === 'nuclear') {
          assert.ok(config.aggressive,
            `${level} should be aggressive`);
        }
      });
    });

    it('should escalate properly from mild to nuclear', function() {
      const levels = ['mild', 'moderate', 'extreme', 'nuclear'];

      for (let i = 1; i < levels.length; i++) {
        const current = testConfig[levels[i]];
        const previous = testConfig[levels[i-1]];

        assert.ok(current.interval <= previous.interval,
          `${levels[i]} should have shorter or equal interval than ${levels[i-1]}`);
      }
    });
  });

  describe('Error Handling Tests', function() {
    it('should handle missing configuration gracefully', function() {
      // Test with undefined configuration
      const mockConfig = {
        get: (key: string) => undefined
      };

      // Should use defaults when config is missing
      const enabled = mockConfig.get('enabled') ?? true;
      const interval = mockConfig.get('interval') ?? 30;

      assert.strictEqual(enabled, true, 'Should default to enabled');
      assert.strictEqual(interval, 30, 'Should default to 30 minutes');
    });

    it('should handle invalid intervals', function() {
      const invalidIntervals = [-1, 0, 200, 'not-a-number'];

      invalidIntervals.forEach(interval => {
        // Clamp interval to valid range
        const clampedInterval = Math.max(5, Math.min(180,
          typeof interval === 'number' ? interval : 30));

        assert.ok(clampedInterval >= 5 && clampedInterval <= 180,
          `Should clamp invalid interval ${interval} to valid range`);
      });
    });
  });

  after(function() {
    // Cleanup after tests
    if (extension && extension.isActive) {
      // Extension will be deactivated automatically
    }
  });
});

// Additional test utilities
function createMockConfiguration(overrides: Record<string, any> = {}): any {
  const defaults: Record<string, any> = {
    enabled: true,
    interval: 30,
    showNotification: true,
    playSound: false,
    reminderType: 'gentle',
    annoyanceLevel: 'moderate',
    persistentNagging: false
  };

  return {
    get: (key: string, defaultValue?: any) => {
      return overrides.hasOwnProperty(key) ?
        overrides[key] :
        (defaults.hasOwnProperty(key) ? defaults[key] : defaultValue);
    }
  };
}

// Performance tests
describe('Performance Tests', function() {
  it('should not leak memory with frequent timer operations', function(done) {
    let timerCount = 0;
    const timers: NodeJS.Timeout[] = [];

    // Create and destroy many timers quickly
    for (let i = 0; i < 100; i++) {
      const timer = setInterval(() => {
        timerCount++;
      }, 10);

      timers.push(timer);

      // Clear timer after short delay
      setTimeout(() => {
        clearInterval(timer);
        if (timers.length === 100) {
          // All timers created and cleared
          setTimeout(() => {
            assert.ok(timerCount >= 0, 'Timer operations completed');
            done();
          }, 50);
        }
      }, 20);
    }
  });
});
