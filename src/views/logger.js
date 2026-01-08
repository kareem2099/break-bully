// DotSense Webview Logger - Shared Utility
window.Logger = (function() {
    const enabled = true; 
    const prefix = '[DotSense UI]';

    return {
        log: function(message, data) {
            if (!enabled) return;
            const timestamp = new Date().toLocaleTimeString();
            console.log(`${prefix} [${timestamp}] ${message}`, data || '');
        },
        error: function(message, error) {
            const timestamp = new Date().toLocaleTimeString();
            console.error(`${prefix} ERROR [${timestamp}] ${message}`, error || '');

            // Send error message to Extension Backend
            if (window.vscode) {
                window.vscode.postMessage({
                    command: 'logError',
                    data: { message, error: error?.toString() }
                });
            }
        }
    };
})();
