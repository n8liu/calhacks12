# Setup Checklist ✅

Follow this checklist to get SmartSummary running:

## Prerequisites

- [ ] Node.js 18+ installed
  ```bash
  node --version
  ```

- [ ] Chrome browser installed

- [ ] Claude API key obtained from [console.anthropic.com](https://console.anthropic.com/)

- [ ] Gemini API key obtained from [makersuite.google.com](https://makersuite.google.com/app/apikey)

## Backend Setup

- [ ] Navigate to backend directory
  ```bash
  cd backend
  ```

- [ ] Install dependencies
  ```bash
  npm install
  ```

- [ ] Configure environment variables
  ```bash
  # Edit backend/.env and add your API keys
  ANTHROPIC_API_KEY=sk-ant-xxxxx
  GOOGLE_API_KEY=AIzaSyxxxxx
  ```

- [ ] Test backend starts
  ```bash
  npm start
  ```

- [ ] Verify health endpoint works
  ```bash
  curl http://localhost:3000/health
  ```

## Chrome Extension Setup

- [ ] Open Chrome extensions page (`chrome://extensions/`)

- [ ] Enable "Developer mode" toggle (top-right)

- [ ] Click "Load unpacked"

- [ ] Select the `frontend` folder

- [ ] Extension appears in Chrome toolbar

- [ ] (Optional) Pin the extension for easy access

## Testing

- [ ] Navigate to a news article (e.g., nytimes.com)

- [ ] Click the 🧠 brain icon in top-right of page

- [ ] Panel opens with loading state

- [ ] Summary tab shows content summary

- [ ] Credibility tab shows trust score

- [ ] Chat tab allows asking questions

- [ ] Chat responses work correctly

## Troubleshooting Completed?

If you hit any issues, check:

- [ ] Backend console shows no errors
- [ ] Browser console shows no errors (F12 → Console)
- [ ] Extension service worker shows no errors (chrome://extensions/ → SmartSummary → "Inspect views")
- [ ] API keys are valid and have no extra spaces
- [ ] Port 3000 is not in use by another app

---

## You're Ready! 🎉

Once all boxes are checked, you have a working AI co-pilot for reading and watching content online!

## Next Development Steps

- [ ] Add YouTube transcript extraction
- [ ] Implement better content extraction for various sites
- [ ] Add user authentication
- [ ] Set up database for persistent storage
- [ ] Add URL-based caching to save costs
- [ ] Deploy backend to production (Railway, Render, AWS, etc.)
- [ ] Publish extension to Chrome Web Store

