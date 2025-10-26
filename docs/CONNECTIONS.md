# Article Connections & Memory System

## Overview

DeepDive automatically discovers connections between articles you read and builds a knowledge graph of your reading history.

## Features

🔗 **Automatic Connection Discovery** - Finds related articles
🏷️ **Topic Extraction** - AI-powered categorization
👤 **Author Tracking** - Follow content from same writers
📚 **Reading History** - Browse past analyzed articles
🧠 **Smart Matching** - Semantic understanding, not just keywords

## How It Works

### 1. Article Storage
When you analyze an article, we store:
```javascript
{
  url: "https://...",
  title: "Article Title",
  author: "Author Name",
  source: "nytimes.com",
  summary: "AI-generated summary",
  topics: ["climate", "politics", "policy"],
  credibility_score: 0.85,
  analyzed_at: "2025-10-26T12:00:00Z"
}
```

### 2. Topic Extraction
Gemini analyzes each article and extracts 3-5 main topics:
```
Input: Article about renewable energy policy
Output: ["climate change", "renewable energy", "policy", "technology"]
```

### 3. Connection Discovery

Articles are connected by:

#### **Shared Topics**
- 1+ common topics = connection
- More shared topics = stronger connection

#### **Same Author**
- Articles by same author get +2 strength bonus
- Helps track author patterns and biases

#### **AI Explanation**
- Gemini generates human-readable connection reason
- Example: "Both articles discuss climate policy and renewable energy solutions"

### Connection Strength Formula
```
Strength = Shared Topics + (Same Author ? 2 : 0)

Examples:
• 3 shared topics = Strength 3
• 2 shared topics + same author = Strength 4
• Same author only = Strength 2
```

Top 5 strongest connections are displayed.

## UI: Connections Tab

### When connections exist:

```
🔗 Related Articles You've Read
Articles connected by topic, author, or theme

[1] Climate Policy in the 2024 Election
    NYTimes • Oct 20, 2025
    🔗 Both articles discuss renewable energy policy
    [climate] [politics] [energy]

[2] The Future of Solar Power
    The Guardian • Oct 18, 2025
    🔗 Both analyze clean energy technologies
    [climate] [technology] [solar]

--- Recent Articles ---

Your DeepDive reading history

→ Climate Policy in the 2024 Election
  The New York Times • by Jane Doe • Oct 20, 2025

→ The Future of Solar Power
  The Guardian • by John Smith • Oct 18, 2025
```

### When no connections (yet):

```
🔍 No connections found for this article yet

This article doesn't share topics, themes, or authors
with the 5 other articles you've analyzed.

Keep reading - connections will appear as your reading
history grows!

--- Recent Articles ---
[Shows reading history]
```

## Storage Architecture

### In-Memory (Current)
```javascript
// Three-tier system
articleMemory       // URL -> Full article data
articleConnections  // Article -> Related articles
topicIndex         // Topic -> Articles with that topic
```

**Pros:**
- Fast access
- No database setup
- Perfect for development

**Cons:**
- Lost on server restart
- Limited to server memory
- Not multi-instance safe

### Future: Database
Easy upgrade path to PostgreSQL/MongoDB for:
- Persistent storage
- Multi-user support
- Cloud deployment
- Advanced analytics

## API Endpoints

### `GET /history`
```json
{
  "articles": [
    {
      "url": "...",
      "title": "...",
      "topics": ["climate", "policy"],
      "analyzed_at": "2025-10-26T12:00:00Z"
    }
  ],
  "total": 42
}
```

Returns last 50 articles, sorted by most recent.

### `GET /connections/:urlHash`
```json
{
  "connections": [
    {
      "url": "...",
      "title": "...",
      "connectionReason": "Both discuss...",
      "connectionStrength": 4,
      "topics": ["climate", "policy"],
      "analyzed_at": "..."
    }
  ],
  "totalArticles": 10
}
```

Returns up to 5 most relevant connections.

## Performance

### Speed
- **Topic extraction**: ~1-2 seconds
- **Connection finding**: ~2-5 seconds (scales with # articles)
- **Stored asynchronously**: Doesn't block main response

### Optimization
- Only compares with last 20 articles
- Early filtering before AI comparison
- Can batch connection checks in parallel

## Use Cases

### 1. Track Reading Patterns
Discover what topics you read about most

### 2. Find Related Content
"I read something about this last week..."

### 3. Author Analysis
Track multiple articles by same author, spot patterns

### 4. Topic Exploration
See all articles about a specific subject

### 5. Cross-Reference
Compare claims across different sources

## Customization

### Adjust Connection Sensitivity
In `server.js`:
```javascript
// Show more connections
.slice(0, 10);  // instead of 5

// Minimum strength threshold
.filter(c => c.strength >= 2)
```

### Change Topic Count
```javascript
// Extract more topics
"extract 5-8 main topics"  // instead of 3-5
```

## Future Enhancements

### Phase 1: Persistence
- [ ] SQLite/PostgreSQL storage
- [ ] User accounts
- [ ] Export reading history

### Phase 2: Smarter Connections
- [ ] Similarity scoring with embeddings
- [ ] Contradictory article detection
- [ ] Timeline view
- [ ] Topic clustering

### Phase 3: Visualization
- [ ] D3.js network graph
- [ ] Interactive topic map
- [ ] Connection strength visualization

### Phase 4: Advanced
- [ ] Cross-source fact verification
- [ ] Bias pattern detection over time
- [ ] Recommendation engine
- [ ] Collaborative filtering

---

**The more you read, the smarter it gets!** 🧠
