# 🚀 Get Started in 3 Steps

## Step 1: Get API Keys (5 minutes)

You need two API keys:

### Claude API Key
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Create an API key
4. Copy it (starts with `sk-ant-`)

### Gemini API Key
1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google
3. Click "Create API Key"
4. Copy it (starts with `AIzaSy`)

## Step 2: Configure Backend (2 minutes)

1. Open `backend/.env` in a text editor
2. Replace the placeholder values:

```env
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
GOOGLE_API_KEY=AIzaSy-your-actual-key-here
PORT=3000
```

3. Save the file

## Step 3: Start Everything (1 minute)

### Option A: Use the startup script (Mac/Linux)

```bash
./start.sh
```

### Option B: Manual start

```bash
cd backend
npm start
```

You should see:
```
🚀 SmartSummary backend running on http://localhost:3000
```

## Step 4: Load Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `frontend` folder from this project
6. Done! ✅

## Test It!

1. Visit any article (try [nytimes.com](https://www.nytimes.com))
2. Click the 🧠 brain icon in the top-right corner
3. See the magic happen! ✨

---

## Troubleshooting

**Backend won't start?**
- Make sure Node.js 18+ is installed: `node --version`
- Check if port 3000 is free: `lsof -i :3000`

**Extension not showing?**
- Check `chrome://extensions/` - is it enabled?
- Try reloading the extension

**Not analyzing content?**
- Check backend is running: `curl http://localhost:3000/health`
- Open browser console (F12) and look for errors
- Check your API keys are valid

---

## 📚 More Help

- **Quick setup guide**: See [QUICKSTART.md](./QUICKSTART.md)
- **Full documentation**: See [README.md](./README.md)
- **Setup checklist**: See [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)

Happy hacking! 🎉

