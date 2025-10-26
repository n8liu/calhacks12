# Fact Checking System with Gemini 2.5 Flash Grounding

## Overview

DeepDive now includes a comprehensive fact-checking system powered by **Gemini 2.5 Flash with Google Search Grounding**. This feature verifies key factual claims from articles against external reliable sources and displays the verification results directly in the credibility section.

## How It Works

### 1. **Real-Time Web Search Fact Checking**
When you analyze an article, the system:
- Identifies 3-5 key factual claims from the article
- **Performs real-time web searches** using Gemini 2.5 Flash with Google Search Grounding
- Searches the web in real-time (NOT using cached data)
- Returns verification status (Confirmed, Partially Confirmed, Uncertain, or Contradicted)
- Provides live source URLs for each verification
- Shows the search queries used for verification

### 2. **Real-Time Source Integration**
All verification sources are:
- **Fresh web sources** retrieved in real-time during analysis
- Displayed in the "All Sources" section of the credibility tab
- Categorized as "Fact Check" sources with a ✅ icon
- Clickable links that open in new tabs
- Search queries displayed for transparency

### 3. **Verification Status**
Each verified claim shows:
- **✅ Confirmed** - The claim is supported by reliable sources (from real-time search)
- **⚠️ Partially Confirmed** - The claim has mixed support or needs context
- **❓ Uncertain** - Insufficient information to verify
- **❌ Contradicted** - The claim conflicts with reliable sources
- **Search queries** - Shows exactly what was searched to verify the claim

## Integration Points

### Backend (`backend/server.js`)

#### New Function: `factCheckArticle(content, metadata)`
```javascript
async function factCheckArticle(content, metadata) {
  // Uses Gemini 2.5 Flash with Google Search
  // Performs REAL-TIME web searches
  // Returns: { claims: [], sources: [] }
}
```

**Features:**
- **Real-time web search** - Uses Gemini's `googleSearch` tool for live verification
- Extracts up to 8000 characters of article content
- **Forces Gemini to search the web** - Explicitly instructs NOT to use training data
- Extracts grounding metadata (actual web sources retrieved)
- Returns structured JSON with claims, verification status, and search queries
- Provides reliability scores (0.0-1.0) for each claim
- Up to 15 sources per article for comprehensive verification

#### Integration with `/analyze` Endpoint
Fact checking now runs in parallel with summary and credibility analysis:
```javascript
const [summaryResult, credibilityResult, factCheckResult] = await Promise.allSettled([
  getSummaryFromGemini(cleanedContent, metadata),
  getCredibilityFromClaude(cleanedContent, metadata, url),
  factCheckArticle(cleanedContent, metadata)
]);
```

### Frontend (`frontend/contentScript.js`)

#### Enhanced Sources Section
The "All Sources" section now includes:
1. **Primary Source** - The original article
2. **Author Research** - Sources used to research the author
3. **Fact Check** - Sources used to verify claims (NEW)

#### Fact Check Display
Each verified claim shows:
```html
<div class="fact-check-claim">
  <div class="fact-check-header">
    <span class="fact-check-number">1</span>
    <span class="fact-check-status">✅ Confirmed</span>
  </div>
  <p class="fact-check-statement"><strong>Claim:</strong> ...</p>
  <p class="fact-check-assessment">...</p>
  <div class="fact-check-reliability">Reliability score: 85%</div>
</div>
```

### Styling (`frontend/injectUI.css`)
New CSS classes added:
- `.fact-check-claims` - Container for claim cards
- `.fact-check-claim` - Individual claim card
- `.fact-check-header` - Header with number and status
- `.fact-check-status` - Colored status badge
- `.fact-check-statement` - The actual claim text
- `.fact-check-assessment` - Verification explanation
- `.fact-check-reliability` - Reliability score display

## Data Flow

```
Article Analysis
    ↓
Parallel Processing:
    ├─ Summary (Gemini)
    ├─ Credibility (Claude)
    └─ Fact Check (Gemini + Google Search) ← NEW
    ↓
Response includes:
    - summary
    - bullets
    - credibility
    - fact_check ← NEW
    - source_meta
    ↓
Frontend Display:
    - Credibility Tab shows:
      ├─ Overall Assessment
      ├─ Fact Check Report ← NEW
      ├─ Website Analysis
      ├─ Author Analysis
      ├─ Content Analysis
      └─ All Sources (includes Fact Check sources)
```

## Real-Time Search Implementation

The fact-checking system is explicitly configured to perform real-time web searches:

```javascript
const prompt = `You are a fact-checking assistant. You MUST use the googleSearch tool 
to search the web in real-time to verify claims from this article.

CRITICAL INSTRUCTIONS:
1. You MUST use the googleSearch tool to search the web for each factual claim
2. DO NOT rely on training data - search the web NOW for real-time verification
...`;
```

This ensures that:
- ✅ Gemini performs actual web searches in real-time
- ✅ Sources are fresh and current (not from training data)
- ✅ Search queries are logged and displayed
- ✅ Grounding metadata captures actual retrieved URLs
- ✅ Verification is based on latest available information

## Example Response

```json
{
  "summary": "...",
  "bullets": ["...", "..."],
  "credibility": {
    "score": 0.82,
    "label": "Reliable",
    "overall_assessment": "...",
    "website_analysis": {...},
    "author_analysis": {...},
    "content_analysis": {...},
    "fact_check_sources": [...]
  },
  "fact_check": {
    "claims": [
      {
        "claim": "The unemployment rate decreased to 3.5% in 2024",
        "status": "Confirmed",
        "assessment": "Verified by Bureau of Labor Statistics...",
        "reliability": 0.95,
        "search_queries": [
          "unemployment rate 2024 3.5% BLS",
          "US unemployment rate 2024 verified"
        ]
      },
      {
        "claim": "GDP growth exceeded 4% last quarter",
        "status": "Partially Confirmed",
        "assessment": "Confirmed but context needed...",
        "reliability": 0.75,
        "search_queries": [
          "GDP growth Q1 2024",
          "economic growth 4% verified"
        ]
      }
    ],
    "sources": [
      {
        "index": 1,
        "title": "Bureau of Labor Statistics",
        "url": "https://www.bls.gov/...",
        "snippet": "..."
      }
    ]
  }
}
```

## Benefits

1. **Transparency** - See exactly which sources were used to verify claims
2. **Verification** - Independent confirmation of factual claims
3. **Context** - Understand when claims are partially confirmed or need context
4. **Source Attribution** - Direct links to verification sources
5. **Automated** - Runs automatically during article analysis

## Technical Details

### Gemini 2.5 Flash Grounding (Real-Time Search)
- Uses `googleSearch` tool for **real-time** web search
- **Forces real-time searching** - Prompt explicitly instructs NOT to use training data
- Performs live web searches for each claim verification
- Extracts grounding metadata from actual search results
- Captures source URLs, titles, and snippets from live searches
- Limits to 15 sources per fact check for comprehensive coverage
- Shows search queries in the UI for transparency

### Error Handling
- Graceful fallback if fact checking fails
- Returns empty claims array on error
- Does not block article analysis if fact checking fails
- Logs errors for debugging

### Performance
- Runs in parallel with other analyses
- Uses `Promise.allSettled` for fault tolerance
- Cached results for duplicate URLs
- Optimized content size (8000 char limit)

## Future Enhancements

Potential improvements:
1. More granular claim extraction (5-10 claims)
2. Automated bias detection in sources
3. Historical fact-checking (track changes over time)
4. User feedback on verification quality
5. Integration with established fact-checking organizations
6. Real-time notifications for contradicted claims

## API Integration

The fact checking uses Google's Gemini 2.5 Flash model with the `googleSearch` tool:

```javascript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  tools: [{
    googleSearch: {}
  }]
});
```

This requires a valid `GOOGLE_API_KEY` in your `.env` file.

## Display Locations

Fact check results appear in:
1. **Credibility Tab** - Full fact check report with all claims
2. **All Sources** - List of verification sources (Fact Check category)
3. **Summary Tab** - Sources section (if fact check sources exist)

The fact check section appears right after the "Overall Assessment" in the credibility tab, making verification prominent and easy to find.

