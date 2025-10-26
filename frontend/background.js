// Background service worker for DeepDive extension
// Handles communication between content scripts and backend API

const BACKEND_URL = 'http://localhost:3000';

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    analyzeContent(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'analyzeStream') {
    analyzeContentStreaming(request.data, sender.tab.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'chat') {
    sendChatMessage(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getConnections') {
    getConnections(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getHistory') {
    getHistory()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Call backend /analyze/stream endpoint with SSE
async function analyzeContentStreaming(data, tabId) {
  try {
    const response = await fetch(`${BACKEND_URL}/analyze/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          // Send update to content script
          chrome.tabs.sendMessage(tabId, {
            action: 'streamUpdate',
            data: data
          });
        }
      }
    }
  } catch (error) {
    console.error('Error streaming content:', error);
    // Send error to content script
    chrome.tabs.sendMessage(tabId, {
      action: 'streamUpdate',
      data: { type: 'error', message: error.message }
    });
    throw error;
  }
}

// Call backend /analyze endpoint
async function analyzeContent(data) {
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing content:', error);
    throw error;
  }
}

// Call backend /chat endpoint
async function sendChatMessage(data) {
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

// Get article connections
async function getConnections(data) {
  try {
    const response = await fetch(`${BACKEND_URL}/connections/${data.urlHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting connections:', error);
    throw error;
  }
}

// Get article history
async function getHistory() {
  try {
    const response = await fetch(`${BACKEND_URL}/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting history:', error);
    throw error;
  }
}

console.log('DeepDive background service worker loaded');

