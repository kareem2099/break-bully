/**
 * Time Blocking Visual Interface
 * Interactive frontend for managing daily time blocks
 */

const vscode = acquireVsCodeApi();

// State management
let currentBlocks = [];
let currentDay = new Date().getDay();
let selectedBlock = null;

// DOM elements
const daySelect = document.getElementById('daySelect');
const timelineBody = document.getElementById('timelineBody');
const blockEditor = document.getElementById('blockEditor');
const totalBlocksEl = document.getElementById('totalBlocks');
const totalHoursEl = document.getElementById('totalHours');
const freeTimeEl = document.getElementById('freeTime');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Set up event listeners for data-action attributes
  const buttons = document.querySelectorAll('button[data-action]');
  buttons.forEach(button => {
    const action = button.getAttribute('data-action');
    if (action && window[action]) {
      button.addEventListener('click', window[action]);
    }
  });

  // Set up event listeners for block action buttons
  const blockButtons = document.querySelectorAll('button[data-block-action]');
  blockButtons.forEach(button => {
    const action = button.getAttribute('data-block-action');
    const blockId = button.getAttribute('data-block-id');
    if (action && window[action] && blockId) {
      button.addEventListener('click', function() {
        window[action](blockId);
      });
    }
  });



  // Also handle any remaining onclick attributes as fallback
  const daySelector = document.querySelector('select[onchange*="changeDay"]');
  if (daySelector) {
    daySelector.addEventListener('change', function() {
      const newDay = parseInt(this.value);
      if (newDay !== currentDay) {
        currentDay = newDay;
        changeDay();
      }
    });
  }

  // Set up day selector event listener
  daySelect.addEventListener('change', function() {
    const newDay = parseInt(this.value);
    if (newDay !== currentDay) {
      currentDay = newDay;
      changeDay();
    }
  });

  // Legacy handler for day selector
  initializeDaySelector();
  setupMessageListeners();
  requestTimeBlocks();

  // Set initial day
  daySelect.value = currentDay.toString();
});

// Setup day selector to persist choice
function initializeDaySelector() {
  daySelect.addEventListener('change', function() {
    const newDay = parseInt(this.value);
    if (newDay !== currentDay) {
      currentDay = newDay;
      changeDay();
    }
  });
}

// Communication with extension
function setupMessageListeners() {
  window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
      case 'timeBlocksUpdated':
        updateTimeBlocks(message.data.blocks);
        break;
      case 'currentModel':
        // Handle current model updates if needed
        break;
    }
  });
}

// Request time blocks from extension
function requestTimeBlocks() {
  vscode.postMessage({
    command: 'getTimeBlocks'
  });
}

// Handle day change
function changeDay() {
  vscode.postMessage({
    command: 'dayChanged',
    data: { day: currentDay }
  });
}

// Update visual timeline with blocks
function updateTimeBlocks(blocks) {
  currentBlocks = blocks;
  timelineBody.innerHTML = '';

  // Render timeline grid (6 AM to 10 PM = 16 hours)
  for (let hour = 6; hour < 22; hour++) {
    const hourDiv = document.createElement('div');
    hourDiv.className = 'timeline-hour';
    hourDiv.dataset.hour = hour;

    // Calculate position (each hour = 60px height)
    const pixelsPerMinute = 60 / 60; // 1px per minute

    // Add any blocks that start in this hour
    blocks.forEach(block => {
      const blockStartHour = Math.floor(block.startTime / 60);
      const blockStartMinute = block.startTime % 60;
      const blockDurationHours = block.duration / 60;

      if (blockStartHour === hour) {
        // Block starts in this hour
        const blockDiv = createBlockElement(block, blockStartMinute, blockDurationHours, pixelsPerMinute);
        hourDiv.appendChild(blockDiv);
      }
    });

    timelineBody.appendChild(hourDiv);
  }

  updateStats();
  setupDragAndDrop();
}

// Create visual block element
function createBlockElement(block, startMinute, durationHours, pixelsPerMinute) {
  const blockDiv = document.createElement('div');
  blockDiv.className = `timeline-block block-${block.type}`;
  blockDiv.dataset.blockId = block.id;
  blockDiv.style.top = `${startMinute * pixelsPerMinute}px`; // Start position within hour
  blockDiv.style.height = `${Math.max(30, block.duration * pixelsPerMinute)}px`; // Height based on duration

  blockDiv.innerHTML = `
    <div class="block-header">
      <span class="block-title">${block.name}</span>
      <span class="block-time">${formatDuration(block.duration)}</span>
    </div>
    <div class="block-controls">
      <button class="block-edit" data-block-action="editBlock" data-block-id="${block.id}">✏️</button>
      <button class="block-delete" data-block-action="deleteBlock" data-block-id="${block.id}">🗑️</button>
    </div>
  `;

  // Add priority indicator
  blockDiv.style.borderLeft = `4px solid ${getPriorityColor(block.priority)}`;

  // Make draggable
  blockDiv.draggable = true;
  blockDiv.addEventListener('dragstart', handleDragStart);
  blockDiv.addEventListener('dblclick', () => editBlock(block.id));

  return blockDiv;
}

// Block interaction functions
function addNewBlock() {
  showBlockEditor({
    name: '',
    startTime: 9 * 60, // 9 AM default
    duration: 60, // 1 hour default
    type: 'deep-work',
    priority: 3,
    recurring: false
  });
}

function editBlock(blockId) {
  const block = currentBlocks.find(b => b.id === blockId);
  if (block) {
    showBlockEditor(block);
  }
}

function deleteBlock(blockId) {
  if (confirm('Delete this time block?')) {
    vscode.postMessage({
      command: 'deleteBlock',
      data: { id: blockId }
    });
  }
}

function createDefaultSchedule() {
  vscode.postMessage({
    command: 'createDefaultSchedule'
  });
}

function applyToScheduler() {
  vscode.postMessage({
    command: 'applyToScheduler'
  });
}

function clearAllBlocks() {
  if (confirm('Clear all blocks for current day? This cannot be undone.')) {
    vscode.postMessage({
      command: 'clearAllBlocks'
    });
  }
}

// Block editor functions
function showBlockEditor(blockData) {
  selectedBlock = blockData.id || null; // Track currently selected block for editing
  // Use selectedBlock to determine if we are editing an existing block
  if (selectedBlock) {
    console.log('Currently editing block:', selectedBlock);
  }
  const isNew = !blockData.id;

  blockEditor.innerHTML = `
    <div class="editor-content">
      <h3>${isNew ? 'Add Time Block' : 'Edit Time Block'}</h3>

      <div class="form-group">
        <label for="blockName">Name:</label>
        <input type="text" id="blockName" value="${blockData.name || ''}" placeholder="e.g., Deep Work, Meetings">
      </div>

      <div class="form-group">
        <label for="blockType">Type:</label>
        <select id="blockType">
          <option value="deep-work" ${blockData.type === 'deep-work' ? 'selected' : ''}>🧠 Deep Work</option>
          <option value="meetings" ${blockData.type === 'meetings' ? 'selected' : ''}>👥 Meetings</option>
          <option value="admin" ${blockData.type === 'admin' ? 'selected' : ''}>📋 Admin</option>
          <option value="breaks" ${blockData.type === 'breaks' ? 'selected' : ''}>☕ Breaks</option>
          <option value="flexible" ${blockData.type === 'flexible' ? 'selected' : ''}>🔄 Flexible</option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="startTime">Start Time:</label>
          <input type="time" id="startTime" value="${formatTimeForInput(blockData.startTime)}">
        </div>
        <div class="form-group">
          <label for="duration">Duration (min):</label>
          <input type="number" id="duration" value="${blockData.duration || 60}" min="15" max="480" step="15">
        </div>
      </div>

      <div class="form-group">
        <label for="priority">Priority (1-10):</label>
        <input type="range" id="priority" min="1" max="10" value="${blockData.priority || 3}">
        <span id="priorityValue">${blockData.priority || 3}</span>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" id="recurring" ${blockData.recurring ? 'checked' : ''}>
          Recurring weekly
        </label>
      </div>

      <div class="editor-actions">
        <button class="btn btn-secondary" data-editor-action="cancelEdit">Cancel</button>
        <button class="btn btn-primary" data-editor-action="saveBlock" data-block-id="${blockData.id || 'null'}">
          ${isNew ? 'Add Block' : 'Update Block'}
        </button>
      </div>
    </div>
  `;

  blockEditor.style.display = 'block';

  // Setup priority slider
  const prioritySlider = document.getElementById('priority');
  const priorityValue = document.getElementById('priorityValue');
  if (prioritySlider && priorityValue) {
    prioritySlider.addEventListener('input', function() {
      priorityValue.textContent = this.value;
    });
  }

  // Set up click handlers for the editor buttons after they are created
  setTimeout(() => {
    const cancelBtn = document.querySelector('button[data-editor-action="cancelEdit"]');
    const saveBtn = document.querySelector('button[data-editor-action="saveBlock"]');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEdit);
    }
    if (saveBtn) {
      const blockId = saveBtn.getAttribute('data-block-id') || 'null';
      saveBtn.addEventListener('click', () => saveBlock(blockId === 'null' ? null : blockId));
    }
  }, 10);
}

function cancelEdit() {
  blockEditor.style.display = 'none';
  selectedBlock = null;
}

function saveBlock(blockId) {
  const name = document.getElementById('blockName').value.trim();
  const type = document.getElementById('blockType').value;
  const startTimeStr = document.getElementById('startTime').value;
  const duration = parseInt(document.getElementById('duration').value);
  const priority = parseInt(document.getElementById('priority').value);
  const recurring = document.getElementById('recurring').checked;

  if (!name) {
    alert('Please enter a block name');
    return;
  }

  if (!startTimeStr) {
    alert('Please select a start time');
    return;
  }

  // Convert time string to minutes since midnight
  const startTime = timeStringToMinutes(startTimeStr);

  const blockData = {
    name,
    type,
    startTime,
    duration,
    priority,
    recurring
  };

  if (blockId) {
    // Update existing block
    vscode.postMessage({
      command: 'updateTimeBlock',
      data: {
        id: blockId,
        updates: blockData
      }
    });
  } else {
    // Add new block
    vscode.postMessage({
      command: 'addTimeBlock',
      data: blockData
    });
  }

  blockEditor.style.display = 'none';
}

// Drag and drop functionality
function setupDragAndDrop() {
  const blocks = document.querySelectorAll('.timeline-block');

  blocks.forEach(block => {
    block.addEventListener('dragstart', handleDragStart);
    block.addEventListener('dragover', handleDragOver);
    block.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.blockId);
  e.target.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const draggedBlockId = e.dataTransfer.getData('text/plain');
  const targetBlockId = e.currentTarget.dataset.blockId;

  if (draggedBlockId && targetBlockId && draggedBlockId !== targetBlockId) {
    // For now, just swap positions - could be enhanced to reorder
    console.log('Dropped', draggedBlockId, 'on', targetBlockId);
  }

  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

// Statistics calculation
function updateStats() {
  const totalBlocks = currentBlocks.length;

  // Calculate total scheduled minutes
  const totalMinutes = currentBlocks.reduce((sum, block) => sum + block.duration, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal

  // Calculate free time (assuming 6 AM to 10 PM = 16 hours = 960 minutes)
  const totalDayMinutes = 16 * 60; // 6 AM to 10 PM
  const freeMinutes = Math.max(0, totalDayMinutes - totalMinutes);
  const freeHours = Math.round((freeMinutes / 60) * 10) / 10;

  totalBlocksEl.textContent = totalBlocks;
  totalHoursEl.textContent = `${totalHours}h`;
  freeTimeEl.textContent = `${freeHours}h`;
}

// Utility functions
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTimeForInput(minutesSinceMidnight) {
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function timeStringToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getPriorityColor(priority) {
  const colors = {
    1: '#ff4444', // Red
    2: '#ff6666',
    3: '#ff8844', // Orange-red
    4: '#ffaa44',
    5: '#ffdd44', // Yellow
    6: '#ddff44',
    7: '#aaff44', // Yellow-green
    8: '#66ff44',
    9: '#44ff66', // Green
    10: '#22ff88' // Bright green
  };
  return colors[priority] || colors[5];
}

// Global functions exposed to HTML
window.addNewBlock = addNewBlock;
window.editBlock = editBlock;
window.deleteBlock = deleteBlock;
window.createDefaultSchedule = createDefaultSchedule;
window.applyToScheduler = applyToScheduler;
window.clearAllBlocks = clearAllBlocks;
window.cancelEdit = cancelEdit;
window.saveBlock = saveBlock;
window.changeDay = changeDay;
