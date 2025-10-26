# DeepDive 🧠

**Your AI co-pilot for reading and watching content online.**

DeepDive is a Chrome extension that provides intelligent summarization, credibility analysis, fact-checking, and interactive Q&A for any article or YouTube video you're viewing.

---

## ✨ Features

- **🎯 Smart Summaries** - Get concise TL;DR and key takeaways instantly
- **🔍 Credibility Analysis** - Trust scores, bias detection, and source evaluation
- **✅ Real-Time Fact Checking** - Verify claims with Google Search-powered verification
- **👤 Author Research** - Automatic author background and expertise analysis
- **🔗 Content Connections** - Discover links between articles you've read
- **💬 Interactive Chat** - Ask questions about any article or video
- **📚 Reading History** - Track and revisit analyzed content
- **🌙 Dark Mode** - Comfortable reading in any environment

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Chrome browser
- API keys (get them free):
  - **Claude API key** from [Anthropic Console](https://console.anthropic.com/)
  - **Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation (3 steps)

#### 1. Clone and configure

```bash
git clone <your-repo-url>
cd calhacks12
```

Edit `backend/.env` and add your API keys:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_API_KEY=AIzaSy-your-key-here
PORT=3000
```

#### 2. Start the backend

```bash
cd backend
npm install
npm start
```

You should see: `🚀 DeepDive backend running on http://localhost:3000`

#### 3. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `frontend` folder from this project

Done! 🎉

### Try it out

1. Visit any article (try [nytimes.com](https://www.nytimes.com))
2. Click the **DD** button in the top-right corner of the page
3. Explore the Summary, Credibility, Connections, and Chat tabs!

---

## 📖 How It Works

### Architecture

```
┌─────────────────┐
│ Chrome Extension│
│   (Frontend)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Express Server │
│    (Backend)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌────────┐
│ Claude │ │ Gemini │
│  API   │ │  API   │
└────────┘ └────────┘
```

### Features in Detail

#### 📊 Credibility Analysis

Multi-tier credibility scoring:
- **Website Analysis** - Source reputation and editorial standards
- **Author Analysis** - Expert background research with web sources
- **Content Analysis** - Evidence quality, tone, and logical reasoning
- **Fact Checking** - Real-time claim verification with Google Search

#### 🔗 Connections Tab

Automatically finds connections between articles you've read:
- **Shared Topics** - Articles covering similar subjects
- **Same Authors** - Track content from the same writer
- **Reading History** - Browse your past 20 analyzed articles

#### 💬 Smart Chat

Ask questions about the content:
- "What's the main argument?"
- "Is this opinion or fact?"
- "What's missing from this analysis?"
- Adjustable response length (short, default, detailed, or auto)

---

## 🛠️ Technology Stack

### Frontend
- Vanilla JavaScript (no framework dependencies)
- Chrome Extension Manifest V3
- Injected UI with dark mode support

### Backend
- Node.js + Express
- Claude 3.5 Sonnet (credibility analysis, chat)
- Gemini 2.5 Flash (summaries, fact-checking, author research)
- In-memory storage (upgradeable to database)

### AI Features
- **Google Search Grounding** - Real-time web research via Gemini
- **Streaming responses** - See analysis appear in real-time
- **Parallel processing** - Fast analysis with concurrent API calls

---

## 📁 Project Structure

```
calhacks12/
├── frontend/              # Chrome extension
│   ├── manifest.json      # Extension config
│   ├── background.js      # Service worker (API communication)
│   ├── contentScript.js   # Content extraction + UI injection
│   ├── injectUI.css       # Styles (light/dark mode)
│   ├── popup.html         # Extension popup
│   └── assets/            # Icons
│
├── backend/               # Express API server
│   ├── server.js          # Main server (analyze, chat, connections)
│   ├── package.json       # Dependencies
│   └── .env              # API keys (DO NOT COMMIT!)
│
└── README.md             # This file
```

---

## 🔧 Development

### Backend development mode

```bash
cd backend
npm run dev  # Auto-restarts on file changes
```

### Making changes

**Frontend:**
- Edit files in `frontend/`
- Go to `chrome://extensions/`
- Click refresh icon on DeepDive
- Reload the webpage

**Backend:**
- Edit `backend/server.js`
- Server auto-restarts (if using `npm run dev`)

---

## 🐛 Troubleshooting

### Backend won't start

Check Node.js version:
```bash
node --version  # Should be 18.x or higher
```

Check if port 3000 is in use:
```bash
lsof -i :3000
kill -9 <PID>  # If needed
```

### Extension not working

Verify backend is running:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

Check browser console (F12 → Console) for errors

### API key issues

- Claude keys start with `sk-ant-`
- Gemini keys start with `AIzaSy`
- Remove any extra spaces from `.env` file
- Verify keys are valid in respective consoles

---

## 📚 API Endpoints

### `POST /analyze/stream`

Analyze content with streaming response.

**Request:**
```json
{
  "url": "https://example.com",
  "content": "Article text...",
  "type": "article",
  "metadata": {
    "title": "Article Title",
    "author": "Author Name"
  }
}
```

**Response:** Server-Sent Events stream with summary, credibility, and fact-check data.

### `POST /chat`

Chat about analyzed content.

**Request:**
```json
{
  "conversation_id": "uuid",
  "user_message": "What's the main point?",
  "response_length": "auto"  // auto, short, default, detailed
}
```

**Response:**
```json
{
  "assistant_message": "The main point is..."
}
```

### `GET /history`

Get analyzed article history.

**Response:**
```json
{
  "articles": [...],
  "total": 42
}
```

### `GET /connections/:urlHash`

Get connections for an article.

**Response:**
```json
{
  "connections": [...],
  "totalArticles": 10
}
```

---

## 🎯 Future Enhancements

- [ ] Persistent database storage (PostgreSQL/MongoDB)
- [ ] User authentication and multi-user support
- [ ] YouTube transcript extraction and analysis
- [ ] Export summaries to Notion, Obsidian, etc.
- [ ] Browser extension for Firefox and Safari
- [ ] Mobile app
- [ ] Collaborative reading lists
- [ ] Advanced analytics and reading patterns

---

## 🤝 Contributing

Contributions are welcome! This project was built for Cal Hacks 12.0.

---

## 📄 License

MIT License - Feel free to use this for your own projects!

---

## 🙏 Acknowledgments

Built with:
- [Anthropic Claude](https://www.anthropic.com/) for reasoning and analysis
- [Google Gemini](https://deepmind.google/technologies/gemini/) for summaries and search
- Love for better internet literacy ❤️

---

**Happy reading! 📚✨**
