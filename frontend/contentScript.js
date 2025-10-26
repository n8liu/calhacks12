// Content script that runs on every page
// Responsible for scraping content and injecting the UI

console.log('DeepDive content script loaded');

let isUIInjected = false;
let currentData = null;
let streamingText = '';
let credibilityStreamingText = '';
let streamingData = {};
let selectedTextForChat = '';

// Listen for streaming updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'streamUpdate') {
    handleStreamUpdate(message.data);
  }
  return true;
});

// Inject the floating button and sidebar
function injectUI() {
  if (isUIInjected) return;
  
  // Create container
  const container = document.createElement('div');
  container.id = 'smart-summary-root';
  document.body.appendChild(container);
  
  // Create floating button
  const floatingButton = document.createElement('button');
  floatingButton.id = 'smart-summary-toggle';
  floatingButton.innerHTML = 'DD';
  floatingButton.title = 'Open DeepDive';
  container.appendChild(floatingButton);
  
  // Create sidebar panel
  const sidebar = document.createElement('div');
  sidebar.id = 'smart-summary-sidebar';
  sidebar.className = 'smart-summary-hidden';
  sidebar.innerHTML = `
    <div class="smart-summary-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="fullscreen-toggle" title="Fullscreen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
        <h2>DeepDive</h2>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="theme-toggle" title="Toggle theme">🌙</button>
        <button id="smart-summary-close">×</button>
      </div>
    </div>
    <div class="smart-summary-tabs">
      <button class="tab-btn active" data-tab="summary">Summary</button>
      <button class="tab-btn" data-tab="credibility">Credibility</button>
      <button class="tab-btn" data-tab="connections">Connections</button>
      <button class="tab-btn" data-tab="chat">Ask AI</button>
    </div>
    <div class="smart-summary-content">
      <div id="tab-summary" class="tab-content active">
        <div class="loading">
          <div class="loading-bar-container">
            <div class="loading-bar"></div>
          </div>
          <p class="loading-text">Analyzing content...</p>
        </div>
      </div>
      <div id="tab-credibility" class="tab-content">
        <div class="loading">
          <div class="loading-bar-container">
            <div class="loading-bar"></div>
          </div>
          <p class="loading-text">Analyzing credibility...</p>
        </div>
      </div>
      <div id="tab-connections" class="tab-content">
        <div class="loading">
          <div class="loading-bar-container">
            <div class="loading-bar"></div>
          </div>
          <p class="loading-text">Finding connections...</p>
        </div>
      </div>
      <div id="tab-chat" class="tab-content">
        <div class="chat-controls">
          <label for="response-length-select">Response length:</label>
          <select id="response-length-select" class="response-length-select">
            <option value="auto" selected>Auto (AI decides)</option>
            <option value="short">Shorter (~75 words)</option>
            <option value="default">Default (~150 words)</option>
            <option value="detailed">Detailed (~300 words)</option>
          </select>
        </div>
        <div id="selected-text-indicator" class="selected-text-indicator hidden">
          <div class="selected-text-header">
            <span class="selected-text-label">✏️ Selected text:</span>
            <button id="clear-selection" class="clear-selection-btn" title="Clear selection">×</button>
          </div>
          <div id="selected-text-content" class="selected-text-content"></div>
        </div>
        <div id="chat-history"></div>
        <div class="chat-input-container">
          <input type="text" id="chat-input" placeholder="Highlight text on page, then ask about it...">
          <button id="chat-send">Send</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(sidebar);
  
  // Add event listeners
  floatingButton.addEventListener('click', handleButtonClick);
  document.getElementById('smart-summary-close').addEventListener('click', toggleSidebar);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('fullscreen-toggle').addEventListener('click', toggleFullscreen);

  // Initialize theme
  initTheme();
  
  // Make button draggable
  makeDraggable(floatingButton);
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });
  
  // Chat functionality
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Clear selection button
  document.getElementById('clear-selection').addEventListener('click', clearSelectedText);

  // Listen for text selection on the page
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('selectionchange', handleTextSelection);

  isUIInjected = true;
}

// Make button draggable
let isDragging = false;
let hasMoved = false;
let dragStartX = 0;
let dragStartY = 0;

function makeDraggable(element) {
  let offsetX = 0;
  let offsetY = 0;
  
  element.addEventListener('mousedown', function(e) {
    isDragging = true;
    hasMoved = false;
    
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    element.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    // Constrain to viewport
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;
    
    const constrainedX = Math.max(0, Math.min(x, maxX));
    const constrainedY = Math.max(0, Math.min(y, maxY));
    
    element.style.left = constrainedX + 'px';
    element.style.top = constrainedY + 'px';
    element.style.right = 'auto';
    
    // Check if moved significantly
    const deltaX = Math.abs(e.clientX - dragStartX);
    const deltaY = Math.abs(e.clientY - dragStartY);
    if (deltaX > 5 || deltaY > 5) {
      hasMoved = true;
    }
    
    e.preventDefault();
  });
  
  document.addEventListener('mouseup', function(e) {
    if (!isDragging) return;
    
    element.style.cursor = 'grab';
    isDragging = false;
    
    // If didn't move much, treat as click
    if (!hasMoved) {
      toggleSidebar();
    }
    
    hasMoved = false;
  });
  
  // Touch support
  element.addEventListener('touchstart', function(e) {
    isDragging = true;
    hasMoved = false;
    
    const rect = element.getBoundingClientRect();
    const touch = e.touches[0];
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    
    e.preventDefault();
  });
  
  document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - offsetX;
    const y = touch.clientY - offsetY;
    
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;
    
    const constrainedX = Math.max(0, Math.min(x, maxX));
    const constrainedY = Math.max(0, Math.min(y, maxY));
    
    element.style.left = constrainedX + 'px';
    element.style.top = constrainedY + 'px';
    element.style.right = 'auto';
    
    const deltaX = Math.abs(touch.clientX - dragStartX);
    const deltaY = Math.abs(touch.clientY - dragStartY);
    if (deltaX > 5 || deltaY > 5) {
      hasMoved = true;
    }
    
    e.preventDefault();
  });
  
  document.addEventListener('touchend', function(e) {
    if (!isDragging) return;
    
    isDragging = false;
    
    if (!hasMoved) {
      toggleSidebar();
    }
    
    hasMoved = false;
  });
}

function handleButtonClick(e) {
  // Click is now handled in makeDraggable to distinguish from dragging
}

function toggleSidebar() {
  const sidebar = document.getElementById('smart-summary-sidebar');
  
  sidebar.classList.toggle('smart-summary-hidden');
  
  // Analyze content when first opened
  if (!sidebar.classList.contains('smart-summary-hidden') && !currentData) {
    analyzeCurrentPage();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Handle text selection on the page
function handleTextSelection() {
  // Don't capture selections inside the DeepDive UI
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText) return;

  // Check if selection is inside our extension UI
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const deepDiveRoot = document.getElementById('smart-summary-root');

  if (deepDiveRoot && deepDiveRoot.contains(container)) {
    return; // Don't capture text selected within our UI
  }

  // Store the selected text
  if (selectedText.length > 5 && selectedText.length < 5000) {
    selectedTextForChat = selectedText;
    updateSelectedTextIndicator();
  }
}

// Update the selected text indicator in the chat tab
function updateSelectedTextIndicator() {
  const indicator = document.getElementById('selected-text-indicator');
  const content = document.getElementById('selected-text-content');

  if (!indicator || !content) return;

  if (selectedTextForChat) {
    indicator.classList.remove('hidden');

    // Truncate if too long for display
    const displayText = selectedTextForChat.length > 200
      ? selectedTextForChat.substring(0, 200) + '...'
      : selectedTextForChat;

    content.textContent = `"${displayText}"`;
  } else {
    indicator.classList.add('hidden');
    content.textContent = '';
  }
}

// Clear selected text
function clearSelectedText() {
  selectedTextForChat = '';
  updateSelectedTextIndicator();

  // Also clear the browser's selection
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('deepdive-theme');
  const themeToggle = document.getElementById('theme-toggle');
  
  if (savedTheme === 'dark') {
    document.getElementById('smart-summary-root').classList.add('dark-mode');
    themeToggle.textContent = '☀️';
  } else {
    themeToggle.textContent = '🌙';
  }
}

function toggleTheme() {
  const root = document.getElementById('smart-summary-root');
  const themeToggle = document.getElementById('theme-toggle');

  root.classList.toggle('dark-mode');

  if (root.classList.contains('dark-mode')) {
    localStorage.setItem('deepdive-theme', 'dark');
    themeToggle.textContent = '☀️';
  } else {
    localStorage.setItem('deepdive-theme', 'light');
    themeToggle.textContent = '🌙';
  }
}

function toggleFullscreen() {
  const sidebar = document.getElementById('smart-summary-sidebar');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');

  sidebar.classList.toggle('fullscreen');

  if (sidebar.classList.contains('fullscreen')) {
    fullscreenToggle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
      </svg>
    `;
    fullscreenToggle.title = 'Exit fullscreen';
  } else {
    fullscreenToggle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    `;
    fullscreenToggle.title = 'Fullscreen';
  }
}

// Extract content from the current page
function extractPageContent() {
  const url = window.location.href;
  const title = document.title;
  
  // Check if YouTube
  if (url.includes('youtube.com/watch')) {
    return extractYouTubeContent();
  }
  
  // Extract article content
  let content = '';
  let author = '';
  let publishedAt = '';
  
  // Try to find article content
  const article = document.querySelector('article') || document.querySelector('main');
  if (article) {
    content = article.innerText;
  } else {
    // Fallback: get all paragraph text
    const paragraphs = document.querySelectorAll('p');
    content = Array.from(paragraphs).map(p => p.innerText).join('\n\n');
  }
  
  // Try to extract author
  const authorMeta = document.querySelector('meta[name="author"]') || 
                     document.querySelector('[rel="author"]');
  if (authorMeta) {
    author = authorMeta.content || authorMeta.innerText;
  }
  
  // Try to extract publish date
  const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
                   document.querySelector('time');
  if (dateMeta) {
    publishedAt = dateMeta.content || dateMeta.dateTime || dateMeta.innerText;
  }
  
  return {
    url,
    content: content.substring(0, 50000), // Limit content size
    type: 'article',
    metadata: {
      title,
      author,
      published_at: publishedAt,
      source: new URL(url).hostname
    }
  };
}

function extractYouTubeContent() {
  const url = window.location.href;
  const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText || 
                document.querySelector('yt-formatted-string.ytd-watch-metadata')?.innerText ||
                document.title;
  
  const channel = document.querySelector('ytd-channel-name a')?.innerText || '';
  
  // Note: Getting full transcript requires YouTube API or transcript scraping
  // For MVP, we'll use the description
  const description = document.querySelector('ytd-expander.ytd-video-secondary-info-renderer')?.innerText || '';
  
  return {
    url,
    content: `Title: ${title}\n\nChannel: ${channel}\n\nDescription: ${description}`,
    type: 'video',
    metadata: {
      title,
      channel,
      source: 'youtube.com'
    }
  };
}

// Handle streaming updates
function handleStreamUpdate(data) {
  const summaryTab = document.getElementById('tab-summary');
  const credibilityTab = document.getElementById('tab-credibility');

  if (data.type === 'status') {
    // Update loading message
    const loadingElement = summaryTab.querySelector('.loading-text');
    if (loadingElement) {
      loadingElement.textContent = data.message;
    }
  } else if (data.type === 'summary_chunk') {
    // Accumulate streaming text
    streamingText += data.text;

    // Clean and format the streaming text for better display
    const cleanedText = cleanStreamingText(streamingText);

    // Display streaming text in real-time
    summaryTab.innerHTML = `
      <div class="summary-content streaming">
        <div class="streaming-header">
          <h3>Generating Summary</h3>
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div class="streaming-text">${cleanedText}</div>
      </div>
    `;
  } else if (data.type === 'summary_complete') {
    // Store complete summary
    streamingData.summary = data.summary;
    streamingData.bullets = data.bullets;
    streamingText = ''; // Reset
  } else if (data.type === 'credibility_chunk') {
    // Accumulate credibility streaming text
    credibilityStreamingText += data.text;

    // Clean and format the credibility streaming text
    const cleanedText = cleanCredibilityStreamingText(credibilityStreamingText);

    // Display streaming credibility in real-time
    credibilityTab.innerHTML = `
      <div class="credibility-content streaming">
        <div class="streaming-header">
          <h3>Analyzing Credibility</h3>
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div class="streaming-text">${cleanedText}</div>
      </div>
    `;
  } else if (data.type === 'credibility_complete') {
    streamingData.credibility = data.credibility;
    credibilityStreamingText = ''; // Reset
  } else if (data.type === 'fact_check_complete') {
    streamingData.fact_check = data.fact_check;
  } else if (data.type === 'complete') {
    // All done - display full results
    streamingData.conversation_id = data.conversation_id;
    currentData = streamingData;
    displayResults(streamingData);
    streamingData = {}; // Reset for next analysis
  } else if (data.type === 'error') {
    summaryTab.innerHTML = `<div class="error">Failed to analyze: ${data.message}</div>`;
  }
}

// Clean streaming text for better display
function cleanStreamingText(text) {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to parse if it looks like JSON is being formed
  if (cleaned.includes('{') && cleaned.includes('"summary"')) {
    try {
      // Try to extract and display the summary field as it's being built
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]*)/);
      if (summaryMatch) {
        let displayText = summaryMatch[1];

        // Check for bullets being formed
        const bulletsMatch = cleaned.match(/"bullets"\s*:\s*\[(.*)/s);
        if (bulletsMatch) {
          const bulletContent = bulletsMatch[1];
          // Extract bullet strings (handle incomplete bullets)
          const bullets = [...bulletContent.matchAll(/"([^"]*)"/g)];
          if (bullets && bullets.length > 0) {
            displayText += '\n\nKey Points:';
            bullets.forEach((match) => {
              const cleanBullet = match[1];
              if (cleanBullet) {
                displayText += `\n• ${cleanBullet}`;
              }
            });
          }
        }

        return escapeHtml(displayText);
      }
    } catch (e) {
      // If parsing fails, fall back to raw display
    }
  }

  // If we can't parse it nicely, at least escape HTML and clean formatting
  return escapeHtml(cleaned).replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

// Clean credibility streaming text for better display
function cleanCredibilityStreamingText(text) {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to parse if it looks like JSON is being formed
  if (cleaned.includes('{')) {
    try {
      // Try to extract key fields as they're being built
      let displayText = '';

      // Extract score if available
      const scoreMatch = cleaned.match(/"score"\s*:\s*([\d.]+)/);
      const labelMatch = cleaned.match(/"label"\s*:\s*"([^"]*)"/);

      if (scoreMatch && labelMatch) {
        const score = parseFloat(scoreMatch[1]);
        const scorePercent = Math.round(score * 100);
        displayText += `Trust Score: ${scorePercent}/100 - ${labelMatch[1]}\n\n`;
      }

      // Extract overall assessment
      const assessmentMatch = cleaned.match(/"overall_assessment"\s*:\s*"([^"]*)"/);
      if (assessmentMatch) {
        displayText += `${assessmentMatch[1]}\n\n`;
      }

      // Extract website analysis
      const websiteTypeMatch = cleaned.match(/"type"\s*:\s*"([^"]*)"/);
      if (websiteTypeMatch) {
        displayText += `Source Type: ${websiteTypeMatch[1]}\n`;
      }

      // Extract key analysis points if available
      const reputationMatch = cleaned.match(/"reputation"\s*:\s*"([^"]*)"/);
      if (reputationMatch) {
        displayText += `Reputation: ${reputationMatch[1]}\n`;
      }

      if (displayText) {
        return escapeHtml(displayText);
      }
    } catch (e) {
      // If parsing fails, fall back to raw display
    }
  }

  // If we can't parse it nicely, at least escape HTML and clean formatting
  return escapeHtml(cleaned).replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Send content to backend for analysis with streaming
async function analyzeCurrentPage() {
  const pageData = extractPageContent();

  // Reset streaming state
  streamingText = '';
  credibilityStreamingText = '';
  streamingData = {};

  // Show loading state with animated progress bars
  const loadingHTML = `
    <div class="loading">
      <div class="loading-bar-container">
        <div class="loading-bar"></div>
      </div>
      <p class="loading-text">Analyzing content...</p>
    </div>
  `;
  const credibilityLoadingHTML = `
    <div class="loading">
      <div class="loading-bar-container">
        <div class="loading-bar"></div>
      </div>
      <p class="loading-text">Checking credibility...</p>
    </div>
  `;

  document.getElementById('tab-summary').innerHTML = loadingHTML;
  document.getElementById('tab-credibility').innerHTML = credibilityLoadingHTML;

  try {
    // Use streaming endpoint
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeStream',
      data: pageData
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Response will be handled via streaming events
  } catch (error) {
    console.error('Analysis failed:', error);
    document.getElementById('tab-summary').innerHTML =
      `<div class="error">Failed to analyze: ${error.message}</div>`;
  }
}

// Build score breakdown section
function buildScoreBreakdown(credibility) {
  if (!credibility.score_breakdown) return '';

  const breakdown = credibility.score_breakdown;

  // Helper to get color based on score
  const getScoreColor = (score) => {
    const percent = Math.round(score * 100);
    if (percent >= 75) return '#059669'; // Green
    if (percent >= 50) return '#d97706'; // Amber
    return '#dc2626'; // Red
  };

  // Helper to create progress bar
  const createProgressBar = (label, score, description) => {
    const percent = Math.round(score * 100);
    const color = getScoreColor(score);

    return `
      <div class="score-breakdown-item">
        <div class="score-breakdown-header">
          <span class="score-breakdown-label">${label}</span>
          <span class="score-breakdown-value" style="color: ${color}">${percent}/100</span>
        </div>
        <div class="score-breakdown-bar-container">
          <div class="score-breakdown-bar" style="width: ${percent}%; background: ${color}"></div>
        </div>
        ${description ? `<div class="score-breakdown-description">${description}</div>` : ''}
      </div>
    `;
  };

  return `
    <div class="score-breakdown-section">
      <h3>📊 How This Score Was Calculated</h3>
      <p class="score-breakdown-intro">${breakdown.explanation || 'Score based on three-tier analysis of source, author, and content.'}</p>
      <div class="score-breakdown-grid">
        ${createProgressBar('Source Credibility', breakdown.website_score, 'Reputation and standards of the publication')}
        ${createProgressBar('Author Expertise', breakdown.author_score, 'Author credentials and track record')}
        ${createProgressBar('Content Quality', breakdown.content_score, 'Evidence, tone, and reasoning in this article')}
      </div>
    </div>
  `;
}

function buildAllSourcesSection(data) {
  const allSources = [];

  // Add original article
  allSources.push({
    title: data.source_meta?.title || document.title || 'Original Article',
    url: window.location.href,
    type: 'Primary Source',
    icon: '📄'
  });
  
  // Add author research sources
  if (data.credibility?.author_sources && data.credibility.author_sources.length > 0) {
    data.credibility.author_sources.forEach(source => {
      allSources.push({
        title: source.title,
        url: source.url,
        type: 'Author Research',
        icon: '🔍'
      });
    });
  }
  
  // Add fact check sources
  if (data.fact_check?.sources && data.fact_check.sources.length > 0) {
    data.fact_check.sources.forEach(source => {
      allSources.push({
        title: source.title,
        url: source.url,
        type: 'Fact Check',
        icon: '✅'
      });
    });
  }
  
  // Add any external sources mentioned (future: parse from summary/analysis)
  // This will be enhanced when we detect links in the content
  
  if (allSources.length === 0) return ''; // Only skip if no sources at all
  
  return `
    <div class="all-sources-section">
      <h3>Sources</h3>
      <div class="all-sources-list">
        ${allSources.map((source, idx) => `
          <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="source-link">
            <div class="source-link-content">
              <div class="source-link-info">
                <div class="source-link-title">${source.title}</div>
                <div class="source-link-type">${source.type}</div>
              </div>
            </div>
            <span class="source-link-arrow">→</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function displayResults(data) {
  // Helper function to make citations clickable
  const makeCitationsClickable = (text, sources) => {
    if (!sources || sources.length === 0) return text;
    
    // Replace [1], [2], etc. with clickable links
    return text.replace(/\[(\d+)\]/g, (match, num) => {
      const sourceIndex = parseInt(num) - 1;
      if (sourceIndex < sources.length) {
        const source = sources[sourceIndex];
        return `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="citation-link" title="${source.title}">[${num}]</a>`;
      }
      return match;
    });
  };
  
  // Build all sources for summary tab too
  const summarySourcesSection = buildAllSourcesSection(data);
  
  // Display summary with action buttons
  document.getElementById('tab-summary').innerHTML = `
    <div class="summary-content">
      <div class="summary-actions">
        <button class="summary-action-btn" id="copy-summary" title="Copy summary to clipboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button class="summary-action-btn" id="highlight-summary" title="Highlight key points on page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 13l3 3 7-7"></path>
            <path d="M3 3v18h18"></path>
          </svg>
          Highlight
        </button>
        <button class="summary-action-btn" id="share-summary" title="Share summary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          Share
        </button>
      </div>
      <div id="summary-text">
        <h3>Quick Summary</h3>
        <p>${data.summary}</p>
        <h3>Key Points</h3>
        <ul>
          ${data.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
        </ul>
        ${data.source_meta ? `
          <div class="source-meta">
            ${data.source_meta.author ? `<p><strong>Author:</strong> ${data.source_meta.author}</p>` : ''}
            ${data.source_meta.published_at ? `<p><strong>Published:</strong> ${data.source_meta.published_at}</p>` : ''}
            ${data.source_meta.word_count ? `<p><strong>Word count:</strong> ${data.source_meta.word_count}</p>` : ''}
          </div>
        ` : ''}
        ${summarySourcesSection}
      </div>
    </div>
  `;
  
  // Add event listeners for summary actions
  document.getElementById('copy-summary').addEventListener('click', () => copySummary(data));
  document.getElementById('highlight-summary').addEventListener('click', () => highlightSummary(data));
  document.getElementById('share-summary').addEventListener('click', () => shareSummary(data));
  
  // Display credibility
  const scorePercent = Math.round(data.credibility.score * 100);
  
  // Determine stroke color based on score (subtle, professional)
  let strokeColor = '#111827'; // Default black
  if (scorePercent >= 75) {
    strokeColor = '#059669'; // Dark green for high scores
  } else if (scorePercent >= 50) {
    strokeColor = '#d97706'; // Dark amber for medium
  } else {
    strokeColor = '#dc2626'; // Dark red for low
  }
  
  // Build author analysis section if available
  let authorSection = '';
  const hasAuthor = data.source_meta?.author && data.source_meta.author !== 'Unknown' && data.source_meta.author.trim() !== '';
  
  if (!hasAuthor) {
    // No author found - show informative message
    authorSection = `
      <div class="analysis-tier">
        <h3>Author Analysis</h3>
        <div class="no-author-message">
          <p><strong>No author information available</strong></p>
          <p class="no-author-detail">This content does not have an identified author or the author information could not be extracted from the page.</p>
        </div>
      </div>
    `;
  } else if (data.credibility.author_analysis) {
    const author = data.credibility.author_analysis;
    
    // Build sources section if available
    let sourcesHtml = '';
    if (data.credibility.author_sources && data.credibility.author_sources.length > 0) {
      sourcesHtml = `
        <div class="author-sources">
          <h4>Sources</h4>
          <div class="sources-list">
            ${data.credibility.author_sources.map(source => `
              <div class="source-item">
                <span class="source-number">[${source.index}]</span>
                <a href="${source.url}" target="_blank" rel="noopener noreferrer">
                  ${source.title}
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    authorSection = `
      <div class="analysis-tier">
        <h3>Author Analysis</h3>
        ${hasAuthor ? `<p class="author-name">${data.source_meta.author}</p>` : ''}
        <div class="tier-fields">
          <div class="tier-field">
            <strong>Expertise</strong>
            <p>${makeCitationsClickable(author.expertise, data.credibility.author_sources)}</p>
          </div>
          <div class="tier-field">
            <strong>Background</strong>
            <p>${makeCitationsClickable(author.background, data.credibility.author_sources)}</p>
          </div>
          <div class="tier-field">
            <strong>Reputation Signals</strong>
            <p>${makeCitationsClickable(author.reputation_signals, data.credibility.author_sources)}</p>
          </div>
          <div class="tier-field">
            <strong>Potential Bias</strong>
            <p>${makeCitationsClickable(author.potential_bias, data.credibility.author_sources)}</p>
          </div>
        </div>
        ${sourcesHtml}
      </div>
    `;
  }
  
  // Calculate circular progress bar values
  const radius = 46; // SVG circle radius
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (scorePercent / 100) * circumference;
  
  // Build comprehensive sources section
  const allSourcesSection = buildAllSourcesSection(data);
  
  // Build fact check section
  let factCheckSection = '';
  if (data.fact_check && data.fact_check.claims && data.fact_check.claims.length > 0) {
    const claims = data.fact_check.claims;
    
    const claimsHtml = claims.map((claim, idx) => {
      let statusColor = '#6b7280';
      let statusIcon = '❓';
      
      if (claim.status === 'Confirmed') {
        statusColor = '#059669';
        statusIcon = '✅';
      } else if (claim.status === 'Partially Confirmed') {
        statusColor = '#d97706';
        statusIcon = '⚠️';
      } else if (claim.status === 'Contradicted') {
        statusColor = '#dc2626';
        statusIcon = '❌';
      }
      
      return `
        <div class="fact-check-claim">
          <div class="fact-check-header">
            <span class="fact-check-number">${idx + 1}</span>
            <span class="fact-check-status" style="color: ${statusColor}">
              ${statusIcon} ${claim.status}
            </span>
          </div>
          <p class="fact-check-statement"><strong>Claim:</strong> ${claim.claim}</p>
          <p class="fact-check-assessment">${claim.assessment}</p>
          ${claim.search_queries && claim.search_queries.length > 0 ? `
            <div class="fact-check-queries">
              <span class="fact-check-queries-label">Search queries:</span>
              ${claim.search_queries.map(q => `<span class="fact-check-query-tag">${q}</span>`).join('')}
            </div>
          ` : ''}
          ${claim.reliability !== undefined ? `
            <div class="fact-check-reliability">
              <span>Reliability score: ${Math.round(claim.reliability * 100)}%</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    factCheckSection = `
      <div class="analysis-tier">
        <h3>Fact Check Report</h3>
        <p class="fact-check-intro">Verified key claims against real-time web sources using Gemini 2.5 Flash with Google Search. Each claim was independently verified through live web searches.</p>
        <div class="fact-check-claims">
          ${claimsHtml}
        </div>
      </div>
    `;
  }
  
  // Build website analysis section
  const websiteSection = data.credibility.website_analysis ? `
    <div class="analysis-tier">
      <h3>Website & Source Analysis</h3>
      <div class="tier-fields">
        <div class="tier-field">
          <strong>Source Type</strong>
          <p>${data.credibility.website_analysis.type}</p>
        </div>
        <div class="tier-field">
          <strong>Reputation</strong>
          <p>${data.credibility.website_analysis.reputation}</p>
        </div>
        <div class="tier-field">
          <strong>Editorial Standards</strong>
          <p>${data.credibility.website_analysis.editorial_standards}</p>
        </div>
        <div class="tier-field">
          <strong>Potential Conflicts</strong>
          <p>${data.credibility.website_analysis.potential_conflicts}</p>
        </div>
      </div>
    </div>
  ` : '';
  
  // Build content analysis section
  const contentSection = data.credibility.content_analysis ? `
    <div class="analysis-tier">
      <h3>Article Content Analysis</h3>
      <div class="tier-fields">
        <div class="tier-field">
          <strong>Evidence Quality</strong>
          <p>${data.credibility.content_analysis.evidence_quality}</p>
        </div>
        <div class="tier-field">
          <strong>Tone</strong>
          <p>${data.credibility.content_analysis.tone}</p>
        </div>
        <div class="tier-field">
          <strong>Fact vs Opinion</strong>
          <p>${data.credibility.content_analysis.fact_vs_opinion}</p>
        </div>
        <div class="tier-field">
          <strong>Logical Reasoning</strong>
          <p>${data.credibility.content_analysis.logical_reasoning}</p>
        </div>
        <div class="tier-field">
          <strong>Balance</strong>
          <p>${data.credibility.content_analysis.balance}</p>
        </div>
      </div>
    </div>
  ` : '';
  
  document.getElementById('tab-credibility').innerHTML = `
    <div class="credibility-content">
      <div class="credibility-score">
        <div class="score-circle">
          <svg width="100" height="100">
            <circle class="score-circle-bg" cx="50" cy="50" r="${radius}"></circle>
            <circle class="score-circle-progress" cx="50" cy="50" r="${radius}"
                    stroke="${strokeColor}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${progressOffset}">
            </circle>
          </svg>
          <div class="score-content">
            <div class="score-number" style="color: ${strokeColor}">${scorePercent}</div>
            <div class="score-label">/100</div>
          </div>
        </div>
        <div class="score-badge">${data.credibility.label}</div>
      </div>
      <div class="credibility-explanation">
        <h3>Overall Assessment</h3>
        <p>${makeCitationsClickable(data.credibility.overall_assessment || data.credibility.why || 'Analysis in progress...', data.credibility.author_sources)}</p>
      </div>
      ${buildScoreBreakdown(data.credibility)}
      ${factCheckSection}
      ${websiteSection}
      ${authorSection}
      ${contentSection}
      ${allSourcesSection}
    </div>
  `;
  
  // Initialize chat
  const chatHistory = document.getElementById('chat-history');
  chatHistory.innerHTML = `
    <div class="message assistant-message">
      <p>Ask me anything about this ${data.type === 'video' ? 'video' : 'article'}!</p>
    </div>
  `;
  
  // Load connections
  loadConnections(window.location.href);
}

async function loadConnections(url) {
  try {
    const urlHash = btoa(url);
    const [connectionsResponse, historyResponse] = await Promise.all([
      chrome.runtime.sendMessage({
        action: 'getConnections',
        data: { urlHash }
      }),
      chrome.runtime.sendMessage({
        action: 'getHistory'
      })
    ]);

    if (connectionsResponse.error) {
      throw new Error(connectionsResponse.error);
    }

    displayConnections(
      connectionsResponse.connections,
      connectionsResponse.totalArticles || 0,
      historyResponse.articles || []
    );
  } catch (error) {
    console.error('Failed to load connections:', error);
    displayConnections([], 0, []);
  }
}

function displayConnections(connections, totalArticles = 0, history = []) {
  // Build history section
  const historySection = history.length > 0 ? `
    <div class="history-section">
      <h3>Recent Articles</h3>
      <p class="history-subtitle">Your DeepDive reading history</p>
      <div class="history-list">
        ${history.slice(0, 20).map((article, idx) => `
          <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="history-item">
            <div class="history-item-content">
              <div class="history-item-title">${article.title || 'Untitled'}</div>
              <div class="history-item-meta">
                <span class="history-item-source">${article.source}</span>
                ${article.author ? `<span class="history-item-author">by ${article.author}</span>` : ''}
                <span class="history-item-date">${new Date(article.analyzed_at).toLocaleDateString()}</span>
              </div>
            </div>
            <span class="history-item-arrow">→</span>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';

  if (!connections || connections.length === 0) {
    // Show onboarding/explanation if user hasn't read many articles yet
    if (totalArticles < 2) {
      document.getElementById('tab-connections').innerHTML = `
        <div class="connections-onboarding">
          <div class="connections-icon">🔗</div>
          <h3>Discover Content Connections</h3>
          <p class="connections-subtitle">DeepDive will find meaningful connections between articles you read</p>

          <div class="connections-how-it-works">
            <h4>How it works:</h4>
            <ul>
              <li><strong>Shared Topics</strong> - Links articles covering similar subjects</li>
              <li><strong>Same Authors</strong> - Tracks content from authors you've read before</li>
              <li><strong>Related Themes</strong> - Discovers conceptual connections across different sources</li>
            </ul>
          </div>

          <div class="connections-suggestions">
            <h4>Get started:</h4>
            <ul>
              <li>Continue reading articles and videos</li>
              <li>Analyze content from different sources</li>
              <li>Return to this tab to see connections emerge</li>
            </ul>
          </div>

          <div class="connections-count">
            <p>Articles analyzed this session: <strong>${totalArticles}</strong></p>
            <p class="connections-detail">You'll see connections after processing 2+ articles</p>
          </div>
        </div>
        ${historySection}
      `;
    } else {
      // User has read multiple articles but no connections found for this one
      document.getElementById('tab-connections').innerHTML = `
        <div class="connections-empty">
          <div class="connections-icon">🔍</div>
          <p>No connections found for this article yet</p>
          <p class="connections-detail">This article doesn't share topics, themes, or authors with the ${totalArticles} other articles you've analyzed this session.</p>
          <p class="connections-detail">Keep reading - connections will appear as your reading history grows!</p>
        </div>
        ${historySection}
      `;
    }
    return;
  }
  
  // Build connected sources section
  const connectedSourcesHtml = connections.length > 0 ? `
    <div class="all-sources-section">
      <h3>Quick Access</h3>
      <div class="all-sources-list">
        ${connections.map((conn, idx) => `
          <a href="${conn.url}" target="_blank" rel="noopener noreferrer" class="source-link">
            <div class="source-link-content">
              <div class="source-link-info">
                <div class="source-link-title">${conn.title || 'Article'}</div>
                <div class="source-link-type">${conn.source}</div>
              </div>
            </div>
            <span class="source-link-arrow">→</span>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  const connectionsHtml = `
    <div class="connections-content">
      <h3>Related Articles You've Read</h3>
      <p class="connections-subtitle">Articles connected by topic, author, or theme</p>
      <div class="connections-list">
        ${connections.map((conn, idx) => `
          <div class="connection-item">
            <div class="connection-header">
              <span class="connection-number">${idx + 1}</span>
              <div class="connection-info">
                <h4><a href="${conn.url}" target="_blank">${conn.title || 'Article'}</a></h4>
                <p class="connection-meta">${conn.source} • ${new Date(conn.analyzed_at).toLocaleDateString()}</p>
              </div>
            </div>
            <p class="connection-reason">${conn.connectionReason}</p>
            <div class="connection-topics">
              ${(conn.topics || []).map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      ${connectedSourcesHtml}
    </div>
    ${historySection}
  `;

  document.getElementById('tab-connections').innerHTML = connectionsHtml;
}

// Copy summary to clipboard
function copySummary(data) {
  const summaryText = `
${data.summary}

Key Points:
${data.bullets.map(bullet => `• ${bullet}`).join('\n')}

Source: ${window.location.href}
${data.source_meta?.author ? `Author: ${data.source_meta.author}` : ''}
${data.source_meta?.published_at ? `Published: ${data.source_meta.published_at}` : ''}
  `.trim();
  
  navigator.clipboard.writeText(summaryText).then(() => {
    const btn = document.getElementById('copy-summary');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;
    btn.style.background = '#d1fae5';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.background = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

// Highlight key points on the page
let highlightElements = [];

function highlightSummary(data) {
  const btn = document.getElementById('highlight-summary');
  
  if (btn.classList.contains('active')) {
    // Already highlighted, clear them
    clearHighlights();
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 13l3 3 7-7"></path>
        <path d="M3 3v18h18"></path>
      </svg>
      Highlight
    `;
    return;
  }
  
  // Clear any existing highlights first
  clearHighlights();
  
  // Add highlights
  btn.classList.add('active');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Clear
  `;
  
  // Extract key phrases from bullets for searching
  const keyPhrases = data.bullets.flatMap(bullet => {
    // Extract meaningful words (more than 3 characters)
    const words = bullet.match(/\b\w{4,}\b/g) || [];
    return words.slice(0, 2).map(w => w.toLowerCase());
  });
  
  // Walk through the DOM and highlight matching text
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.toLowerCase();
    
    // Check if this text node contains any of our key phrases
    for (const phrase of keyPhrases) {
      if (text.includes(phrase) && phrase.length > 0) {
        const parent = node.parentElement;
        
        // Skip if already highlighted or in our sidebar
        if (parent.closest('#smart-summary-root')) continue;
        
        try {
          const highlight = document.createElement('mark');
          highlight.className = 'deepdive-highlight';
          highlight.style.backgroundColor = '#fef3c7';
          highlight.style.color = '#92400e';
          highlight.style.padding = '2px 4px';
          highlight.style.borderRadius = '3px';
          highlight.style.fontWeight = '500';
          highlight.textContent = node.textContent;
          
          node.parentNode.replaceChild(highlight, node);
          highlightElements.push(highlight);
          break; // Only highlight once per node
        } catch (e) {
          console.warn('Could not highlight node:', e);
        }
      }
    }
  }
  
  // Scroll to first highlight
  if (highlightElements.length > 0) {
    highlightElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearHighlights() {
  highlightElements.forEach(el => {
    const text = el.textContent;
    const textNode = document.createTextNode(text);
    el.parentNode.replaceChild(textNode, el);
  });
  highlightElements = [];
}

// Share summary
function shareSummary(data) {
  const shareText = `I found this interesting article: ${window.location.href}\n\n${data.summary}\n\nKey Points:\n${data.bullets.slice(0, 3).map(bullet => `• ${bullet}`).join('\n')}`;
  
  if (navigator.share) {
    navigator.share({
      title: document.title,
      text: shareText,
      url: window.location.href
    }).catch(err => {
      console.log('Share cancelled or failed:', err);
    });
  } else {
    // Fallback: copy share link
    navigator.clipboard.writeText(shareText).then(() => {
      const btn = document.getElementById('share-summary');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      btn.style.background = '#d1fae5';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Sharing not available. Please copy manually.');
    });
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message || !currentData) return;

  // Get selected response length from dropdown
  const selectedLength = document.getElementById('response-length-select')?.value || 'auto';

  // Build the display message
  let displayMessage = message;
  let fullMessage = message;

  // If there's selected text, include it in the context
  if (selectedTextForChat) {
    displayMessage = `
      <div class="chat-selected-context">
        <div class="chat-selected-label">📌 About selected text:</div>
        <div class="chat-selected-quote">"${selectedTextForChat.substring(0, 150)}${selectedTextForChat.length > 150 ? '...' : ''}"</div>
      </div>
      <p>${message}</p>
    `;
    fullMessage = `Regarding this selected text from the article:\n\n"${selectedTextForChat}"\n\n${message}`;
  }

  // Add user message to chat
  const chatHistory = document.getElementById('chat-history');
  chatHistory.innerHTML += `
    <div class="message user-message">
      ${displayMessage}
    </div>
  `;

  input.value = '';
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // Add loading indicator
  chatHistory.innerHTML += `
    <div class="message assistant-message loading-message">
      <div class="loading-bar-container">
        <div class="loading-bar"></div>
      </div>
      <p class="loading-text" style="margin-top: 8px; font-size: 13px;">Thinking...</p>
    </div>
  `;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chat',
      data: {
        conversation_id: currentData.conversation_id,
        user_message: fullMessage, // Use fullMessage with selected text context
        response_length: selectedLength
      }
    });
    
    // Remove loading message
    document.querySelector('.loading-message').remove();
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Add assistant response
    chatHistory.innerHTML += `
      <div class="message assistant-message">
        <p>${response.assistant_message}</p>
      </div>
    `;
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Clear selected text after successful response
    clearSelectedText();

  } catch (error) {
    console.error('Chat failed:', error);
    document.querySelector('.loading-message').innerHTML = `
      <p class="error">Error: ${error.message}</p>
    `;
  }
}

// Initialize
setTimeout(() => {
  injectUI();
}, 1000);

