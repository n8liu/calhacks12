# Fact-Checking System

## Overview

DeepDive includes real-time fact-checking powered by **Gemini 2.5 Flash with Google Search Grounding**. It verifies key factual claims from articles against live web sources.

## Features

✅ **Real-Time Web Search** - Searches the web NOW, not cached data
✅ **Multiple Claim Verification** - Checks 3-5 key claims per article
✅ **Source Attribution** - Every verification includes URLs
✅ **Transparency** - Shows search queries used
✅ **Reliability Scores** - 0-100% confidence for each claim

## How It Works

### 1. Claim Extraction
The system identifies verifiable factual claims like:
- Statistics and numbers
- Dates and timelines
- Specific events
- Attributable quotes
- Scientific facts

### 2. Real-Time Verification
For each claim:
- Generates targeted search queries
- **Searches Google in real-time** (not training data)
- Compares claim against found sources
- Assigns verification status

### 3. Verification Statuses

| Status | Icon | Meaning |
|--------|------|---------|
| Confirmed | ✅ | Supported by reliable sources |
| Partially Confirmed | ⚠️ | Mixed support or needs context |
| Uncertain | ❓ | Insufficient information |
| Contradicted | ❌ | Conflicts with reliable sources |

## Example

### Article Claim:
> "The unemployment rate decreased to 3.5% in 2024"

### Fact Check Result:
```
✅ Confirmed

Claim: The unemployment rate decreased to 3.5% in 2024

Assessment: Verified by Bureau of Labor Statistics data.
The unemployment rate did reach 3.5% in Q1 2024 according
to official government sources.

Reliability Score: 95%

Search Queries:
• unemployment rate 2024 3.5% BLS
• US unemployment rate 2024 verified

Sources:
[1] Bureau of Labor Statistics - Employment Situation
[2] US Department of Labor - Economic Data
```

## Technical Implementation

### Gemini Configuration
```javascript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{
    googleSearch: {}
  }]
});

// Prompt forces real-time search
const prompt = `You MUST use the googleSearch tool to search
the web in real-time to verify claims from this article.

DO NOT rely on training data - search the web NOW...`;
```

### Response Format
```json
{
  "claims": [
    {
      "claim": "The factual claim being verified",
      "status": "Confirmed",
      "assessment": "Explanation of verification",
      "reliability": 0.95,
      "search_queries": ["query 1", "query 2"]
    }
  ],
  "sources": [
    {
      "index": 1,
      "title": "Source Title",
      "url": "https://...",
      "snippet": "Relevant excerpt"
    }
  ]
}
```

## UI Display

### Credibility Tab
Shows after "Overall Assessment":

```
📋 Fact Check Report
Verified key claims against real-time web sources using
Gemini 2.5 Flash with Google Search.

[1] ✅ Confirmed
Claim: The unemployment rate decreased to 3.5% in 2024
Verified by Bureau of Labor Statistics data...
Reliability score: 95%

[2] ⚠️ Partially Confirmed
Claim: GDP growth exceeded 4% last quarter
Confirmed but context needed...
Reliability score: 75%
```

### All Sources Section
Fact-check sources appear with ✅ icon:

```
📚 Sources

✅ Bureau of Labor Statistics
   Fact Check • bls.gov/news.release/...

✅ US Department of Labor
   Fact Check • dol.gov/general/topic/statistics...
```

## Performance

- **Runs in parallel** with summary/credibility analysis
- **Doesn't block** - uses `Promise.allSettled()`
- **Cached results** for duplicate URLs
- **~3-5 seconds** per article (concurrent processing)

## Cost Optimization

- Limits content to 8000 characters
- Extracts only 3-5 most important claims
- Caches results per URL
- Up to 15 sources max per article

Typical cost: **~$0.02-0.03 per article** at current Gemini pricing

## Error Handling

If fact-checking fails:
- Returns empty claims array
- Doesn't block article analysis
- Logs error for debugging
- User sees other analysis results

## Configuration

No extra setup needed! Just ensure:

```env
GOOGLE_API_KEY=AIzaSy-your-key-here
```

in your `backend/.env` file.

## Limitations

- Requires Gemini 2.5 or newer
- Depends on Google Search index (usually hours lag)
- Best for English-language content
- May miss very recent breaking news

## Future Enhancements

- [ ] More granular claim extraction (5-10 claims)
- [ ] Integration with fact-checking organizations
- [ ] Historical tracking of claim changes
- [ ] User feedback on verification quality
- [ ] Cross-source contradiction detection

---

**Powered by Gemini 2.5 Flash with Google Search Grounding** ✅
