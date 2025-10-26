// Content script that runs on every page
// Responsible for scraping content and injecting the UI

console.log('DeepDive content script loaded');

let isUIInjected = false;
let currentData = null;

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
  floatingButton.innerHTML = 'S';
  floatingButton.title = 'Open DeepDive';
  container.appendChild(floatingButton);
  
  // Create sidebar panel
  const sidebar = document.createElement('div');
  sidebar.id = 'smart-summary-sidebar';
  sidebar.className = 'smart-summary-hidden';
  sidebar.innerHTML = `
    <div class="smart-summary-header">
      <h2>DeepDive</h2>
      <button id="smart-summary-close">×</button>
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
        <div id="chat-history"></div>
        <div class="chat-input-container">
          <input type="text" id="chat-input" placeholder="Ask anything about this page...">
          <button id="chat-send">Send</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(sidebar);
  
  // Add event listeners
  floatingButton.addEventListener('click', handleButtonClick);
  document.getElementById('smart-summary-close').addEventListener('click', toggleSidebar);
  
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

// Send content to backend for analysis
async function analyzeCurrentPage() {
  const pageData = extractPageContent();
  
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
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      data: pageData
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    currentData = response;
    displayResults(response);
  } catch (error) {
    console.error('Analysis failed:', error);
    document.getElementById('tab-summary').innerHTML = 
      `<div class="error">Failed to analyze: ${error.message}</div>`;
  }
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
  
  // Display summary
  document.getElementById('tab-summary').innerHTML = `
    <div class="summary-content">
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
  `;
  
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
    const response = await chrome.runtime.sendMessage({
      action: 'getConnections',
      data: { urlHash }
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    displayConnections(response.connections);
  } catch (error) {
    console.error('Failed to load connections:', error);
    document.getElementById('tab-connections').innerHTML = `
      <div class="connections-empty">
        <p>No connections found yet</p>
        <p class="connections-detail">As you read more articles, DeepDive will discover connections between them based on topics, authors, and themes.</p>
      </div>
    `;
  }
}

function displayConnections(connections) {
  if (!connections || connections.length === 0) {
    document.getElementById('tab-connections').innerHTML = `
      <div class="connections-empty">
        <p>No connections found yet</p>
        <p class="connections-detail">As you read more articles, DeepDive will discover connections between them based on topics, authors, and themes.</p>
      </div>
    `;
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
  `;
  
  document.getElementById('tab-connections').innerHTML = connectionsHtml;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentData) return;
  
  // Get selected response length from dropdown
  const selectedLength = document.getElementById('response-length-select')?.value || 'auto';
  
  // Add user message to chat
  const chatHistory = document.getElementById('chat-history');
  chatHistory.innerHTML += `
    <div class="message user-message">
      <p>${message}</p>
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
        user_message: message,
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

