// ===== UPDATE PANEL WEBVIEW =====

(function() {
    'use strict';

    const vscode = acquireVsCodeApi();

    // ===== INITIALIZATION =====
    function initialize() {
        console.log('Update panel webview initialized');

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Parse and display changelog
        if (window.changelogContent) {
            displayChangelog(window.changelogContent);
        }
    }

    // ===== MESSAGE HANDLING =====
    function handleMessage(event) {
        const message = event.data;
        console.log('Received message from extension:', message.command, message.data);

        switch (message.command) {
            // Handle any future messages if needed
        }
    }

    // ===== CHANGELOG PARSING AND DISPLAY =====
    function displayChangelog(markdownContent) {
        const container = document.getElementById('changelogContent');
        if (!container) return;

        // Parse markdown and convert to HTML
        const htmlContent = parseMarkdownToHtml(markdownContent);
        container.innerHTML = htmlContent;
    }

    function parseMarkdownToHtml(markdown) {
        let html = markdown;

        // Convert headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Convert version headers with badges
        html = html.replace(/^## \[([^\]]+)\] - ([^\n]+)$/gm, '<div class="version-badge">$1</div><h2>$1 <small>$2</small></h2>');

        // Convert bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert italic text
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Convert blockquotes
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

        // Convert lists
        html = convertLists(html);

        // Convert paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>\s*<h/g, '<h');
        html = html.replace(/<\/h[1-6]>\s*<\/p>/g, '</h1>');
        html = html.replace(/<p>\s*<blockquote/g, '<blockquote');
        html = html.replace(/<\/blockquote>\s*<\/p>/g, '</blockquote>');

        // Group related sections
        html = groupFeatureSections(html);

        return html;
    }

    function convertLists(text) {
        const lines = text.split('\n');
        let inList = false;
        let listType = '';
        let result = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

            if (listMatch) {
                const indent = listMatch[1].length;
                const bullet = listMatch[2];
                const content = listMatch[3];

                if (!inList || (bullet.match(/\d+\./) && listType !== 'ol') || (!bullet.match(/\d+\./) && listType !== 'ul')) {
                    if (inList) {
                        result += listType === 'ul' ? '</ul>' : '</ol>';
                    }

                    listType = bullet.match(/\d+\./) ? 'ol' : 'ul';
                    result += `<${listType}>`;
                    inList = true;
                }

                result += `<li>${content}</li>`;
            } else {
                if (inList) {
                    result += listType === 'ul' ? '</ul>' : '</ol>';
                    inList = false;
                }
                result += line + '\n';
            }
        }

        if (inList) {
            result += listType === 'ul' ? '</ul>' : '</ol>';
        }

        return result;
    }

    function groupFeatureSections(html) {
        // Group sections under major features
        const sections = [
            { title: '🎨 Major UI Overhaul', keywords: ['ui', 'interface', 'design', 'style', 'css', 'html'] },
            { title: '🏗️ Code Architecture Improvements', keywords: ['code', 'architecture', 'structure', 'file', 'modular'] },
            { title: '✨ UI/UX Enhancements', keywords: ['enhancement', 'improvement', 'feature', 'achievement'] },
            { title: '🐛 Bug Fixes', keywords: ['fix', 'bug', 'issue', 'error'] },
            { title: '📦 Technical Improvements', keywords: ['technical', 'performance', 'optimization'] }
        ];

        let result = html;

        sections.forEach(section => {
            const regex = new RegExp(`<h3>${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>(.*?)(?=<h[1-3]|$)`, 'gis');
            result = result.replace(regex, (match, content) => {
                return `<div class="feature-category"><h3>${section.title}</h3><ul>${content.trim()}</ul></div>`;
            });
        });

        return result;
    }

    // ===== UTILITY FUNCTIONS =====
    function closePanel() {
        vscode.postMessage({
            command: 'closePanel'
        });
    }

    // Expose closePanel globally for inline onclick handlers
    window.closePanel = closePanel;

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        initialize();
    });

})();
