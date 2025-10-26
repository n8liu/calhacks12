# Letta AI Integration Guide

Your DeepDive extension now has **real Letta AI integration** for persistent, intelligent memory!

## 🎉 What You Get with Letta

### Before (Local Memory):
- ❌ Memory lost on server restart
- ❌ No cross-session persistence
- ❌ Limited context retention

### After (Letta AI):
- ✅ **Persistent memory** across server restarts
- ✅ **Intelligent context management** by Letta
- ✅ **Long-term knowledge** building
- ✅ **Smart retrieval** of related articles
- ✅ **Cloud-based** memory storage

---

## 🔧 Setup

### Step 1: Get Your Letta API Key

1. Go to [https://app.letta.com/](https://app.letta.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `letta_`)

### Step 2: Add to Environment

Edit `backend/.env`:

```env
# Letta AI API (for persistent memory)
LETTA_API_KEY=letta_your_actual_key_here
LETTA_BASE_URL=https://api.letta.com
```

### Step 3: Restart Backend

```bash
cd backend
npm start
```

You should see:
```
🧠 Initializing Letta AI agent...
✅ Letta AI enabled - Persistent memory active!
   Agent ID: agent_xxxxx
```

---

## 🏗️ How It Works

### Dual Memory System

Your extension now uses **both** local memory and Letta:

```
Article Analyzed
      ↓
  ┌───┴───┐
  │       │
Local   Letta
Memory   API
  │       │
  └───┬───┘
      ↓
Perfect Memory
```

### What Goes to Letta

Every article you read is sent to Letta with:

```
Title: "Climate Policy in 2024"
URL: https://...
Author: Jane Doe
Source: nytimes.com
Topics: climate, politics, policy
Summary: The article discusses...
Credibility: Reliable (85%)
Date Read: 2025-10-26

Key Points:
1. ...
2. ...
```

### How Letta Helps

1. **Persistent Storage**: Never lose your reading history
2. **Intelligent Retrieval**: Letta understands context and relationships
3. **Memory Management**: Automatically organizes and prioritizes memories
4. **Cross-Session**: Remember what you read weeks ago
5. **Cloud Sync**: Access memory from any device (future feature)

---

## 🔍 Architecture

### Letta Agent

DeepDive creates a dedicated Letta agent:

```javascript
{
  name: 'DeepDive-Memory-Agent',
  persona: 'Memory system for DeepDive',
  role: 'Store and retrieve article memories, 
         find connections'
}
```

### API Calls

**On Article Analysis:**
```
POST /v1/agents/{agent_id}/messages
{
  "role": "user",
  "content": "Remember this article: ..."
}
```

**On Connection Query:**
```
POST /v1/agents/{agent_id}/messages
{
  "role": "user",
  "content": "What articles relate to: ..."
}
```

Letta manages:
- Long-term memory storage
- Context window optimization
- Memory consolidation
- Intelligent retrieval

---

## 📊 Benefits Over Local Memory

| Feature | Local Memory | With Letta |
|---------|-------------|------------|
| Persistence | ❌ Lost on restart | ✅ Permanent |
| Scale | Limited by RAM | ✅ Unlimited |
| Intelligence | Basic matching | ✅ AI-powered |
| Context | Single session | ✅ Cross-session |
| Retrieval | Simple lookup | ✅ Semantic search |
| Management | Manual | ✅ Automatic |

---

## 🎯 Example Workflow

### Day 1:
1. Read article about climate change → Stored in Letta
2. Read article about renewable energy → Stored in Letta
3. Letta notes: "Both about clean energy"

### Day 2 (after server restart):
1. Read new article about solar policy
2. Letta remembers: "You read 2 related articles yesterday!"
3. Shows connections even though local memory was cleared

---

## 🧪 Testing

### With Letta Enabled:

```bash
# Start server
npm start

# You should see:
✅ Letta AI enabled - Persistent memory active!
   Agent ID: agent_xxxxx

# Read some articles
# Restart server
# Read another article
# Check Connections tab - Previous articles still there!
```

### Without Letta:

```bash
# Leave LETTA_API_KEY blank or commented out
npm start

# You should see:
💡 Letta AI not configured - Using local memory only

# Still works! Just no persistence across restarts
```

---

## 🔐 Security & Privacy

### What Letta Stores:
- Article titles, URLs, summaries
- Topics and metadata
- Your analysis results

### What Letta DOESN'T Store:
- Full article content (only summaries)
- Your API keys
- Personal browsing data
- Passwords or credentials

### Privacy Controls:
- Your data is isolated to your Letta agent
- Only you can access your memories
- Can delete agent anytime via Letta dashboard
- GDPR compliant

---

## 💰 Pricing

Letta offers:
- **Free Tier**: Perfect for development and personal use
- **Pro Plans**: For heavy usage

Check current pricing at [letta.com/pricing](https://letta.com/pricing)

---

## 🛠️ Advanced Configuration

### Custom Agent Persona

Edit in `server.js`:

```javascript
const response = await axios.post(`${LETTA_BASE_URL}/v1/agents`, {
  name: 'DeepDive-Memory-Agent',
  persona: 'Your custom persona here...',
  // ...
});
```

### Query Customization

Modify how you ask Letta for connections:

```javascript
const query = `What articles relate to "${currentArticle.title}"?
Topics: ${currentArticle.topics.join(', ')}

Focus on: [your criteria here]`;
```

---

## 🐛 Troubleshooting

### "Letta initialization failed"

**Check:**
- Is `LETTA_API_KEY` set correctly in `.env`?
- Is the key valid? (Test at app.letta.com)
- Is `LETTA_BASE_URL` correct?
- Network connection working?

**Fix:**
```bash
# Test API key
curl -H "Authorization: Bearer $LETTA_API_KEY" \
  https://api.letta.com/v1/agents

# Should return list of agents
```

### "Agent already exists" error

Not an error! The system automatically retrieves your existing agent.

### Memory not persisting

**Check:**
1. Letta shows as enabled in startup logs?
2. Articles being stored? (Check Letta dashboard)
3. Agent ID consistent across restarts?

---

## 📈 Monitoring

### Check Letta Status

```bash
# In logs, look for:
✅ Article stored in Letta memory
✅ Retrieved connections from Letta
```

### View in Letta Dashboard

1. Go to [app.letta.com](https://app.letta.com)
2. Find "DeepDive-Memory-Agent"
3. View conversation history
4. See all stored memories

---

## 🚀 Future Enhancements

With Letta integrated, you can now add:

- [ ] **Multi-device sync** - Access memories from phone
- [ ] **Shared knowledge bases** - Collaborate with team
- [ ] **Advanced queries** - "Show me all articles about X from last month"
- [ ] **Memory export** - Download your knowledge graph
- [ ] **Trend analysis** - "What topics am I reading about most?"
- [ ] **Recommendation system** - "Articles similar to what I like"

---

## 🎓 Learn More

- **Letta Documentation**: [docs.letta.com](https://docs.letta.com)
- **API Reference**: [docs.letta.com/api](https://docs.letta.com/api)
- **Letta GitHub**: [github.com/letta-ai](https://github.com/letta-ai)

---

## ✨ You're All Set!

Your DeepDive extension now has **production-grade, persistent memory** powered by Letta AI!

**Next steps:**
1. Add your `LETTA_API_KEY` to `.env`
2. Restart backend
3. Read some articles
4. Restart server
5. Read more articles
6. See your reading history persist! 🎉

---

**Questions?** Check the Letta dashboard or server logs for details!

