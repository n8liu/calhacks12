# Author Research Feature

## Overview

DeepDive automatically researches article authors using **Gemini 2.5 Flash with Google Search Grounding** to provide comprehensive background information and credibility assessment.

## How It Works

### 1. Automatic Author Detection
When you analyze an article, the system:
- Extracts the author name from the page metadata
- Identifies the publication/source
- Triggers real-time author research

### 2. Google Search Integration
Uses Gemini's built-in Google Search tool to research:
- Author credentials and expertise
- Professional background
- Published works and reputation
- Potential biases or conflicts of interest

### 3. Structured Analysis
Returns:
```json
{
  "expertise": "Area of specialization and qualifications",
  "background": "Professional history and education",
  "reputation_signals": "Awards, recognition, peer standing",
  "potential_bias": "Known affiliations or viewpoints"
}
```

## Example Output

### In the UI:
```
👤 Author Analysis
Jane Smith

Expertise
Pulitzer Prize-winning political correspondent with 15+ years
experience [1][3]

Background
Senior journalist at NYT, formerly at Washington Post.
Columbia University graduate in Political Science [1][2]

Reputation Signals
Highly regarded investigative journalist, two Pulitzer Prizes [3]

Potential Bias
Generally centrist reporting, no major conflicts of interest
detected [1]

📚 Sources
[1] The New York Times - Author Bio
[2] Wikipedia - Jane Smith (journalist)
[3] Pulitzer Prizes - Winners
```

## Technical Details

### API Call
```javascript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{
    googleSearch: {}  // Enable Google Search grounding
  }]
});

const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [{
      text: `Research this author: ${authorName} from ${source}...`
    }]
  }]
});
```

### Source Extraction
```javascript
const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
const sources = groundingMetadata?.groundingChunks
  .filter(chunk => chunk.web)
  .map(chunk => ({
    title: chunk.web.title,
    url: chunk.web.uri,
    index: i + 1
  }));
```

## Benefits

✅ **No Extra API Keys** - Uses your existing Gemini key
✅ **Real-Time Data** - Fresh information from Google Search
✅ **Source Citations** - Every claim is backed by URLs
✅ **Automatic** - Happens during article analysis
✅ **Transparent** - See exactly where info comes from

## Fallback Behavior

If author research fails (no author, API error, etc.):
- Displays "No author information available"
- Credibility analysis continues based on content
- System remains fully functional

## Cost

Author research adds minimal cost:
- ~500 tokens for query
- ~1000-2000 tokens for response
- **~$0.01 per author search** at current Gemini pricing

## Configuration

No extra configuration needed! Just ensure your `.env` has:

```env
GOOGLE_API_KEY=AIzaSy-your-key-here
```

---

**Powered by Gemini 2.5 Flash with Google Search Grounding** 🔍
