# DeepDive - Quick Start Guide

Get your AI co-pilot up and running in 5 minutes! 🚀

## Prerequisites

- Node.js 18+ installed ([Download](https://nodejs.org/))
- Chrome browser
- API keys:
  - **Claude API key** from [Anthropic Console](https://console.anthropic.com/)
  - **Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## Step 1: Set Up Backend

### 1.1 Navigate to backend directory

```bash
cd backend
```

### 1.2 Install dependencies

```bash
npm install
```

### 1.3 Configure API keys

Edit `backend/.env` and add your API keys:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_API_KEY=AIzaSyxxxxx
PORT=3000
```

### 1.4 Start the backend server

```bash
npm start
```

You should see:
```
🚀 DeepDive backend running on http://localhost:3000
```

Keep this terminal window open!

---

## Step 2: Load Chrome Extension

### 2.1 Open Chrome Extensions

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)

### 2.2 Load the extension

1. Click **"Load unpacked"**
2. Select the `frontend` folder from this project
3. You should see the DeepDive extension appear!

### 2.3 (Optional) Fix icon warnings

If you see icon warnings:
- Either add icon images to `frontend/assets/` (icon16.png, icon48.png, icon128.png)
- Or comment out the icon references in `frontend/manifest.json` for now

---

## Step 3: Test It Out!

### 3.1 Visit any webpage

Go to any article or YouTube video, for example:
- https://www.nytimes.com/
- https://www.youtube.com/watch?v=dQw4w9WgxcQ

### 3.2 Click the brain icon 🧠

You should see it in the top-right corner of the page.

### 3.3 Explore the features

- **Summary tab**: See the TL;DR and key points
- **Credibility tab**: Check the trust score and analysis
- **Ask AI tab**: Chat and ask questions about the content!

---

## Troubleshooting

### Backend won't start

**Check Node.js version:**
```bash
node --version  # Should be 18.x or higher
```

**Check if port 3000 is in use:**
```bash
lsof -i :3000
# Kill the process if needed: kill -9 <PID>
```

### Extension not working

**Check the backend is running:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Check browser console:**
1. Right-click on page → Inspect
2. Go to Console tab
3. Look for errors related to DeepDive

**Check extension console:**
1. Go to `chrome://extensions/`
2. Find DeepDive
3. Click "Inspect views: service worker"
4. Check for errors

### API errors

**Invalid API keys:**
- Make sure you've copied the full API keys without extra spaces
- Claude keys start with `sk-ant-`
- Gemini keys start with `AIzaSy`

**Rate limits:**
- You might be hitting API rate limits
- Wait a few minutes and try again
- Check your API usage in respective consoles

---

## Development Mode

### Run backend with auto-reload

```bash
cd backend
npm run dev
```

This uses nodemon to auto-restart when you change files.

### Making changes

**Frontend changes:**
- Edit files in `frontend/`
- Go to `chrome://extensions/`
- Click the refresh icon on DeepDive extension
- Reload the webpage you're testing on

**Backend changes:**
- Edit `backend/server.js`
- If using `npm run dev`, it auto-restarts
- If using `npm start`, stop (Ctrl+C) and restart

---

## Project Structure

```
calhacks12/
├── frontend/              # Chrome extension
│   ├── manifest.json      # Extension config
│   ├── background.js      # Service worker (API calls)
│   ├── contentScript.js   # Page scraping + UI injection
│   ├── injectUI.css       # Styles for injected UI
│   ├── popup.html         # Extension popup
│   └── assets/            # Icons
│
├── backend/               # Express API server
│   ├── server.js          # Main server with /analyze & /chat
│   ├── package.json       # Dependencies
│   └── .env              # API keys (DO NOT COMMIT!)
│
└── README.md             # Full technical documentation
```

---

## Next Steps

Once everything is working:

1. **Improve content extraction** - Better scraping for different sites
2. **Add user authentication** - Track usage per user
3. **Add a database** - Store conversations persistently
4. **Implement caching** - Save money on repeated URLs
5. **Add YouTube transcript support** - For better video analysis
6. **Better error handling** - User-friendly error messages
7. **Rate limiting** - Prevent abuse
8. **Deploy** - Host backend on Railway/Render/AWS

---

## API Documentation

### POST /analyze

Analyze webpage content.

**Request:**
```json
{
  "url": "https://example.com/article",
  "content": "Full text content...",
  "type": "article",
  "metadata": {
    "title": "Article Title",
    "author": "John Doe",
    "published_at": "2025-10-20",
    "source": "example.com"
  }
}
```

**Response:**
```json
{
  "summary": "3 sentence summary...",
  "bullets": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "credibility": {
    "score": 0.82,
    "label": "Reliable",
    "why": "Explanation..."
  },
  "source_meta": {
    "title": "Article Title",
    "author": "John Doe",
    "word_count": 1530,
    "reading_time": 8
  },
  "conversation_id": "uuid-here"
}
```

### POST /chat

Chat about analyzed content.

**Request:**
```json
{
  "conversation_id": "uuid-here",
  "user_message": "What's the main argument?"
}
```

**Response:**
```json
{
  "assistant_message": "The main argument is..."
}
```

---

## Need Help?

- Check the full [README.md](./README.md) for detailed architecture
- Review API documentation above
- Check browser and server console logs
- Make sure both backend and extension are running

Happy hacking! 🧠✨

