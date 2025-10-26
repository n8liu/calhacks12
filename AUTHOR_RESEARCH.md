# Author Research with Gemini Google Search

## How It Works

SmartSummary now uses **Gemini 2.0 Flash with Google Search grounding** to research author backgrounds and credibility - no additional API keys needed!

## What This Means

✅ **Only 2 API keys needed** (Claude + Gemini)  
✅ **Google Search integration** built into Gemini  
✅ **Automatic source citations**  
✅ **Real-time web research**  
✅ **No extra cost** beyond Gemini API usage  

## The Technology

### Gemini Search Grounding

Google's Gemini 2.0 models include **grounding** - the ability to search Google and cite sources automatically.

When analyzing an author, the system:

1. **Sends a query to Gemini** like: "Who is [Author Name] from [Source]? What is their background, credentials, and reputation?"

2. **Gemini searches Google** using its built-in search capability

3. **Returns a comprehensive summary** with grounding metadata (sources)

4. **Claude analyzes the research** and creates the structured credibility assessment with citations

## Flow Diagram

```
Article detected with Author Name
         ↓
Gemini 2.0 Flash + Google Search
         ↓
"Who is [Author]? Background, credentials, reputation?"
         ↓
Gemini searches Google and returns:
- Summary of findings
- Source URLs (grounding metadata)
         ↓
Claude receives:
- Original article
- Gemini's research summary
- Source URLs
         ↓
Claude generates:
- Credibility score
- Author expertise analysis (with [1], [2] citations)
- Background details (cited)
- Reputation signals (cited)
- Potential biases (cited)
         ↓
Extension UI displays:
- Author analysis with citations
- Clickable source links
```

## Example

### Input:
```
Author: "Jane Smith"
Source: "The New York Times"
```

### Gemini Search:
```
Query: "Who is Jane Smith from The New York Times? Background, credentials, expertise?"

Gemini searches Google and returns:
"Jane Smith is a senior political correspondent at The New York Times with over 15 years 
of experience covering national politics. She previously worked at The Washington Post 
and has won two Pulitzer Prizes for investigative journalism. She holds a degree in 
Political Science from Columbia University and a Masters in Journalism..."

Sources:
[1] nytimes.com/author/jane-smith
[2] en.wikipedia.org/wiki/Jane_Smith_(journalist)
[3] pulitzer.org/winners/jane-smith
```

### Claude Analysis:
```json
{
  "author_analysis": {
    "expertise": "Pulitzer Prize-winning political correspondent with 15+ years experience [1][3]",
    "background": "Senior journalist at NYT, formerly at Washington Post. Columbia graduate [1][2]",
    "reputation_signals": "Highly regarded investigative journalist, two Pulitzer Prizes [3]",
    "potential_bias": "Generally centrist reporting, no major conflicts of interest detected [1]"
  }
}
```

### UI Display:
```
👤 Expertise
Pulitzer Prize-winning political correspondent with 15+ years experience [1][3]

📋 Background  
Senior journalist at NYT, formerly at Washington Post. Columbia graduate [1][2]

✓ Reputation Signals
Highly regarded investigative journalist, two Pulitzer Prizes [3]

⚠️ Potential Bias
Generally centrist reporting, no major conflicts of interest detected [1]

📚 Sources
[1] The New York Times - Author Bio
[2] Wikipedia - Jane Smith (journalist)
[3] Pulitzer Prizes - Winners
```

## Advantages vs Tavily

| Feature | Gemini Search | Tavily |
|---------|---------------|---------|
| API keys needed | 1 (Gemini) | 2 (Gemini + Tavily) |
| Search quality | Google Search | Tavily AI Search |
| Cost | Included in Gemini | Separate API |
| Setup | Already configured | Extra setup |
| Source quality | Excellent (Google) | Very good |
| Free tier | Generous | 1,000 searches/month |

## Configuration

**Nothing extra needed!** If you have a Gemini API key, author research is automatically enabled.

Just make sure your `backend/.env` has:

```env
GOOGLE_API_KEY=AIzaSy-your-key-here
```

## Fallback Behavior

If author research fails (no author name, Gemini error, etc.):
- Claude still analyzes based on article content
- Provides credibility assessment
- Notes that web research was unavailable
- Everything still works!

## Cost

Gemini search requests are billed as regular API calls. Costs are minimal:

- **Search query**: ~500 tokens
- **Search results**: ~1000-2000 tokens  
- **Total**: ~$0.01 per author search (at current Gemini pricing)

## Technical Details

### Model Configuration

```javascript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-exp',
  tools: [{
    googleSearch: {}  // Enable Google Search grounding
  }]
});
```

### Extracting Sources

```javascript
const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

if (groundingMetadata?.groundingChunks) {
  sources = groundingMetadata.groundingChunks
    .filter(chunk => chunk.web)
    .map(chunk => ({
      title: chunk.web.title,
      url: chunk.web.uri
    }));
}
```

## Limitations

1. **Model availability**: Requires Gemini 2.0 or newer (with grounding support)
2. **Google Search dependency**: Results depend on what's indexed by Google
3. **Language**: Best results for English-language searches
4. **Recency**: Google Search index lag (usually hours, not real-time)

## Future Enhancements

- [ ] Cache author research to reduce API calls
- [ ] Add fact-checking with Google Fact Check API
- [ ] Cross-reference multiple sources
- [ ] Add author social media analysis
- [ ] Historical bias tracking over time

---

**You're using cutting-edge AI search technology - all built into your Gemini API key!** 🚀

