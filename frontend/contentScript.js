// Content script that runs on every page
// Responsible for scraping content and injecting the UI

console.log('SmartSummary content script loaded');

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
  floatingButton.innerHTML = '🧠';
  floatingButton.title = 'Open SmartSummary';
  container.appendChild(floatingButton);
  
  // Create sidebar panel
  const sidebar = document.createElement('div');
  sidebar.id = 'smart-summary-sidebar';
  sidebar.className = 'smart-summary-hidden';
  sidebar.innerHTML = `
    <div class="smart-summary-header">
      <h2>SmartSummary</h2>
      <button id="smart-summary-close">×</button>
    </div>
    <div class="smart-summary-tabs">
      <button class="tab-btn active" data-tab="summary">Summary</button>
      <button class="tab-btn" data-tab="credibility">Credibility</button>
      <button class="tab-btn" data-tab="chat">Ask AI</button>
    </div>
    <div class="smart-summary-content">
      <div id="tab-summary" class="tab-content active">
        <div class="loading">Analyzing content...</div>
      </div>
      <div id="tab-credibility" class="tab-content">
        <div class="loading">Analyzing credibility...</div>
      </div>
      <div id="tab-chat" class="tab-content">
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
  floatingButton.addEventListener('click', toggleSidebar);
  document.getElementById('smart-summary-close').addEventListener('click', toggleSidebar);
  
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
  
  // Show loading state
  document.getElementById('tab-summary').innerHTML = '<div class="loading">Analyzing content...</div>';
  document.getElementById('tab-credibility').innerHTML = '<div class="loading">Checking credibility...</div>';
  
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

function displayResults(data) {
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
    </div>
  `;
  
  // Display credibility
  const scorePercent = Math.round(data.credibility.score * 100);
  const scoreColor = scorePercent >= 70 ? '#22c55e' : scorePercent >= 40 ? '#eab308' : '#ef4444';
  
  document.getElementById('tab-credibility').innerHTML = `
    <div class="credibility-content">
      <div class="credibility-score" style="color: ${scoreColor}">
        <div class="score-circle">
          <span class="score-number">${scorePercent}</span>
          <span class="score-label">/100</span>
        </div>
        <div class="score-badge">${data.credibility.label}</div>
      </div>
      <div class="credibility-explanation">
        <h3>Analysis</h3>
        <p>${data.credibility.why}</p>
      </div>
    </div>
  `;
  
  // Initialize chat
  const chatHistory = document.getElementById('chat-history');
  chatHistory.innerHTML = `
    <div class="message assistant-message">
      <p>Ask me anything about this ${data.type === 'video' ? 'video' : 'article'}!</p>
    </div>
  `;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentData) return;
  
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
      <p>Thinking...</p>
    </div>
  `;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chat',
      data: {
        conversation_id: currentData.conversation_id,
        user_message: message
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

