import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Letta AI Configuration
const LETTA_API_KEY = process.env.LETTA_API_KEY;
const LETTA_BASE_URL = process.env.LETTA_BASE_URL || 'https://api.letta.com';
let lettaAgentId = null;

// In-memory storage (replace with database in production)
const conversations = new Map();
const cache = new Map();

// Article memory system (enhanced with Letta)
const articleMemory = new Map(); // url -> article data
const articleConnections = new Map(); // articleId -> [related article IDs]
const topicIndex = new Map(); // topic -> [article IDs]

// Helper: Generate cache key from URL
function getCacheKey(url) {
  return Buffer.from(url).toString('base64');
}

// Helper: Clean and truncate content
function cleanContent(content, maxTokens = 8000) {
  // Simple token approximation: ~4 chars per token
  const maxChars = maxTokens * 4;
  return content.substring(0, maxChars).trim();
}

// Letta AI Helper: Initialize or get agent
async function initializeLettaAgent() {
  if (!LETTA_API_KEY || LETTA_API_KEY === 'your_letta_api_key_here') {
    return null;
  }

  try {
    // Check if we already have an agent
    if (lettaAgentId) {
      return lettaAgentId;
    }

    // Create or retrieve DeepDive agent
    const response = await axios.post(
      `${LETTA_BASE_URL}/v1/agents`,
      {
        name: 'DeepDive-Memory-Agent',
        persona: 'You are a memory system for DeepDive. You remember articles users have read and help them discover connections between content.',
        human: 'A user reading articles and seeking to understand connections between information.',
        system: 'Store and retrieve article memories. Find connections between articles based on topics, authors, and themes.'
      },
      {
        headers: {
          'Authorization': `Bearer ${LETTA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    lettaAgentId = response.data.id;
    console.log('✅ Letta agent initialized:', lettaAgentId);
    return lettaAgentId;

  } catch (error) {
    if (error.response?.status === 409) {
      // Agent already exists, retrieve it
      try {
        const listResponse = await axios.get(`${LETTA_BASE_URL}/v1/agents`, {
          headers: { 'Authorization': `Bearer ${LETTA_API_KEY}` }
        });
        
        const agent = listResponse.data.find(a => a.name === 'DeepDive-Memory-Agent');
        if (agent) {
          lettaAgentId = agent.id;
          console.log('✅ Letta agent retrieved:', lettaAgentId);
          return lettaAgentId;
        }
      } catch (listError) {
        console.error('Error retrieving Letta agent:', listError.message);
      }
    }
    
    console.error('Letta agent initialization error:', error.message);
    return null;
  }
}

// Letta AI Helper: Store article in Letta memory
async function storeLettaMemory(articleData) {
  const agentId = await initializeLettaAgent();
  if (!agentId) return null;

  try {
    const memoryMessage = `Remember this article:
Title: "${articleData.title}"
URL: ${articleData.url}
Author: ${articleData.author}
Source: ${articleData.source}
Topics: ${articleData.topics.join(', ')}
Summary: ${articleData.summary}
Credibility: ${articleData.credibility_label} (${Math.round(articleData.credibility_score * 100)}%)
Date Read: ${articleData.analyzed_at}

Key Points:
${articleData.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;

    const response = await axios.post(
      `${LETTA_BASE_URL}/v1/agents/${agentId}/messages`,
      {
        messages: [{
          role: 'user',
          content: memoryMessage
        }],
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${LETTA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Article stored in Letta memory');
    return response.data;

  } catch (error) {
    console.error('Letta memory storage error:', error.message);
    return null;
  }
}

// Letta AI Helper: Query connections from Letta
async function queryLettaConnections(currentArticle) {
  const agentId = await initializeLettaAgent();
  if (!agentId) return null;

  try {
    const query = `What articles have I read that are related to this one?
Title: "${currentArticle.title}"
Topics: ${currentArticle.topics.join(', ')}
Author: ${currentArticle.author}

List up to 5 related articles with explanation of the connection. Format as JSON array.`;

    const response = await axios.post(
      `${LETTA_BASE_URL}/v1/agents/${agentId}/messages`,
      {
        messages: [{
          role: 'user',
          content: query
        }],
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${LETTA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Parse Letta's response for connections
    const responseText = response.data.messages?.[0]?.content || '';
    console.log('✅ Retrieved connections from Letta');
    return responseText;

  } catch (error) {
    console.error('Letta query error:', error.message);
    return null;
  }
}

// POST /analyze/stream - Analyze content with streaming summary
app.post('/analyze/stream', async (req, res) => {
  try {
    const { url, content, type, metadata } = req.body;

    if (!content || !url) {
      return res.status(400).json({ error: 'Missing required fields: url, content' });
    }

    console.log(`Analyzing (streaming) ${type || 'page'}: ${url}`);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const cleanedContent = cleanContent(content);

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting analysis...' })}\n\n`);

    // Start streaming summary from Gemini
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Generating summary...' })}\n\n`);

    let summary = '';
    let bullets = [];

    try {
      const summaryData = await getSummaryFromGeminiStreaming(cleanedContent, metadata, (chunk) => {
        // Send each chunk to the client
        res.write(`data: ${JSON.stringify({ type: 'summary_chunk', text: chunk })}\n\n`);
      });

      summary = summaryData.summary;
      bullets = summaryData.bullets;

      res.write(`data: ${JSON.stringify({ type: 'summary_complete', summary, bullets })}\n\n`);
    } catch (error) {
      console.error('Summary error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', field: 'summary', message: 'Summary failed' })}\n\n`);
    }

    // Now get credibility with streaming
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing credibility...' })}\n\n`);

    let credibility;
    try {
      credibility = await getCredibilityFromClaudeStreaming(cleanedContent, metadata, url, (chunk) => {
        // Send each chunk to the client
        res.write(`data: ${JSON.stringify({ type: 'credibility_chunk', text: chunk })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ type: 'credibility_complete', credibility })}\n\n`);
    } catch (error) {
      console.error('Credibility error:', error);
      credibility = {
        score: 0.5,
        label: 'Unknown',
        overall_assessment: 'Credibility analysis temporarily unavailable.'
      };
      res.write(`data: ${JSON.stringify({ type: 'credibility_complete', credibility })}\n\n`);
    }

    // Fact check
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Fact checking...' })}\n\n`);

    const factCheck = await factCheckArticle(cleanedContent, metadata).catch(err => ({
      claims: [],
      summary: 'Fact check unavailable'
    }));

    res.write(`data: ${JSON.stringify({ type: 'fact_check_complete', fact_check: factCheck })}\n\n`);

    // Store in memory and cache
    const cacheKey = getCacheKey(url);
    const conversationId = uuidv4();

    const result = {
      summary,
      bullets,
      credibility,
      fact_check: factCheck,
      source_meta: metadata,
      conversation_id: conversationId,
      type: type || 'article'
    };

    cache.set(cacheKey, result);
    conversations.set(conversationId, {
      url,
      content: cleanedContent,
      metadata,
      messages: [],
      createdAt: new Date()
    });

    // Store in article memory
    const articleData = {
      url,
      title: metadata?.title || 'Untitled',
      author: metadata?.author,
      published_at: metadata?.published_at,
      type: type || 'article',
      summary,
      analyzed_at: new Date()
    };

    const topics = await extractTopics(summary, bullets);
    articleMemory.set(url, articleData);

    topics.forEach(topic => {
      if (!topicIndex.has(topic)) {
        topicIndex.set(topic, []);
      }
      topicIndex.get(topic).push(url);
    });

    const allArticles = Array.from(articleMemory.values());
    const connections = await findConnections(articleData, allArticles);
    articleConnections.set(cacheKey, connections);

    res.write(`data: ${JSON.stringify({ type: 'complete', conversation_id: conversationId })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in /analyze/stream:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// POST /analyze - Analyze content with Gemini + Claude
app.post('/analyze', async (req, res) => {
  try {
    const { url, content, type, metadata } = req.body;

    if (!content || !url) {
      return res.status(400).json({ error: 'Missing required fields: url, content' });
    }

    console.log(`Analyzing ${type || 'page'}: ${url}`);

    // Check cache
    const cacheKey = getCacheKey(url);
    if (cache.has(cacheKey)) {
      console.log('Returning cached result');
      return res.json(cache.get(cacheKey));
    }

    const cleanedContent = cleanContent(content);

    // Parallel: Get summary from Gemini, credibility from Claude, and fact check
    // Use allSettled so one failure doesn't break everything
    const [summaryResult, credibilityResult, factCheckResult] = await Promise.allSettled([
      getSummaryFromGemini(cleanedContent, metadata),
      getCredibilityFromClaude(cleanedContent, metadata, url),
      factCheckArticle(cleanedContent, metadata)
    ]);

    // Handle summary result (Gemini)
    let summary, bullets;
    if (summaryResult.status === 'fulfilled') {
      summary = summaryResult.value.summary;
      bullets = summaryResult.value.bullets;
      console.log('✅ Gemini summary successful');
    } else {
      console.warn('⚠️  Gemini failed, using Claude for summary');
      // Fallback: Try to get summary from Claude
      try {
        const claudeSummary = await getSummaryFromClaude(cleanedContent, metadata);
        summary = claudeSummary.summary;
        bullets = claudeSummary.bullets;
        console.log('✅ Claude summary fallback successful');
      } catch (fallbackError) {
        console.error('❌ Both Gemini and Claude summary failed:', fallbackError);
        summary = 'Summary temporarily unavailable. The content has been saved and you can still chat about it.';
        bullets = ['AI summarization is currently experiencing issues', 'You can still use the chat feature to ask questions'];
      }
    }

    // Handle credibility result (Claude)
    let credibility;
    if (credibilityResult.status === 'fulfilled') {
      credibility = credibilityResult.value;
      console.log('✅ Claude credibility check successful');
    } else {
      console.warn('⚠️  Claude credibility check failed:', credibilityResult.reason);
      credibility = {
        score: 0.5,
        label: 'Unknown',
        overall_assessment: 'Credibility analysis temporarily unavailable. This does not reflect on the source quality.',
        website_analysis: {
          type: 'Unable to analyze at this time',
          reputation: 'Unable to analyze at this time',
          editorial_standards: 'Unable to analyze at this time',
          potential_conflicts: 'Unable to analyze at this time'
        },
        author_analysis: {
          expertise: 'Unable to analyze at this time',
          background: 'Unable to analyze at this time',
          reputation_signals: 'Unable to analyze at this time',
          potential_bias: 'Unable to analyze at this time'
        },
        content_analysis: {
          evidence_quality: 'Unable to analyze at this time',
          tone: 'Unable to analyze at this time',
          fact_vs_opinion: 'Unable to analyze at this time',
          logical_reasoning: 'Unable to analyze at this time',
          balance: 'Unable to analyze at this time'
        }
      };
    }

    // Handle fact check result
    let factCheck;
    if (factCheckResult.status === 'fulfilled') {
      factCheck = factCheckResult.value;
      console.log(`✅ Fact check completed with ${factCheck.claims.length} claims verified`);
      
      // Add fact check sources to credibility response
      if (factCheck.sources && factCheck.sources.length > 0) {
        credibility.fact_check_sources = factCheck.sources;
      }
    } else {
      console.warn('⚠️  Fact check failed:', factCheckResult.reason);
      factCheck = {
        claims: [],
        sources: []
      };
    }

    // Create conversation
    const conversationId = uuidv4();
    conversations.set(conversationId, {
      url,
      content: cleanedContent,
      metadata,
      messages: [],
      createdAt: new Date()
    });

    // Build response
    const result = {
      summary,
      bullets,
      credibility,
      fact_check: factCheck,
      source_meta: {
        title: metadata?.title,
        author: metadata?.author,
        published_at: metadata?.published_at,
        source: metadata?.source,
        word_count: cleanedContent.split(/\s+/).length,
        reading_time: Math.ceil(cleanedContent.split(/\s+/).length / 200) // ~200 wpm
      },
      conversation_id: conversationId
    };

    // Cache result
    cache.set(cacheKey, result);

    // Store in article memory (async, don't wait)
    storeArticleInMemory(url, result, metadata).then(memoryResult => {
      if (memoryResult) {
        result.memory = memoryResult;
      }
    }).catch(err => console.error('Memory storage error:', err));

    res.json(result);
  } catch (error) {
    console.error('Error in /analyze:', error);
    res.status(500).json({ 
      error: 'Failed to analyze content', 
      details: error.message 
    });
  }
});

// POST /chat - Chat about the content
app.post('/chat', async (req, res) => {
  try {
    const { conversation_id, user_message, response_length } = req.body;

    if (!conversation_id || !user_message) {
      return res.status(400).json({ error: 'Missing required fields: conversation_id, user_message' });
    }

    const conversation = conversations.get(conversation_id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Ensure messages array exists
    if (!conversation.messages) {
      conversation.messages = [];
    }

    console.log(`Chat message for conversation ${conversation_id} (length: ${response_length || 'auto'})`);

    // Get response from Claude
    const assistantMessage = await chatWithClaude(
      conversation.content,
      conversation.metadata,
      conversation.messages,
      user_message,
      response_length || 'auto'
    );

    // Store messages
    conversation.messages.push(
      { role: 'user', text: user_message },
      { role: 'assistant', text: assistantMessage }
    );

    res.json({ assistant_message: assistantMessage });
  } catch (error) {
    console.error('Error in /chat:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message', 
      details: error.message 
    });
  }
});

// Helper: Get summary from Gemini with streaming
async function getSummaryFromGeminiStreaming(content, metadata, onChunk) {
  try {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You extract factual summaries from source material. You do not add external facts.

SOURCE METADATA:
Title: ${metadata?.title || 'Unknown'}
Author: ${metadata?.author || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

FULL TEXT:
${content}

TASK:
1. Give a 2-3 sentence plain-English summary of the source. No hype.
2. Give 5 concise bullet points of the main claims/conclusions from the source, using ONLY what appears in the source.
3. Return valid JSON with:
{
  "summary": "...",
  "bullets": ["...", "...", "...", "...", "..."]
}

Return ONLY the JSON, no other text.`;

    const result = await model.generateContentStream(prompt);
    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      if (onChunk) {
        onChunk(chunkText);
      }
    }

    // Parse JSON from complete response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse Gemini response');
  } catch (error) {
    console.error('Gemini streaming error:', error.message);
    throw error;
  }
}

// Helper: Get summary from Gemini
async function getSummaryFromGemini(content, metadata) {
  try {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You extract factual summaries from source material. You do not add external facts.

SOURCE METADATA:
Title: ${metadata?.title || 'Unknown'}
Author: ${metadata?.author || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

FULL TEXT:
${content}

TASK:
1. Give a 2-3 sentence plain-English summary of the source. No hype.
2. Give 5 concise bullet points of the main claims/conclusions from the source, using ONLY what appears in the source.
3. Return valid JSON with:
{
  "summary": "...",
  "bullets": ["...", "...", "...", "...", "..."]
}

Return ONLY the JSON, no other text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse Gemini response');
  } catch (error) {
    console.error('Gemini error:', error.message);
    // Re-throw so Promise.allSettled can catch it and trigger Claude fallback
    throw error;
  }
}

// Helper: Search the web for author information using Gemini 2.5 Flash with Google Search
async function searchAuthorInfo(authorName, source) {
  if (!authorName || authorName === 'Unknown') {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: [{
        googleSearch: {}
      }]
    });

    const searchQuery = `Who is ${authorName}${source ? ` from ${source}` : ''}? What is their background, credentials, expertise, and reputation as a journalist/writer/author? Include their professional history, notable works, and any potential biases or conflicts of interest.`;
    
    console.log(`🔍 Searching with Gemini: ${searchQuery}`);
    
    const result = await model.generateContent(searchQuery);
    const response = await result.response;
    const text = response.text();
    
    // Extract grounding metadata (sources)
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let sources = [];
    
    if (groundingMetadata?.groundingChunks) {
      sources = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web)
        .map(chunk => ({
          title: chunk.web.title || 'Web Source',
          url: chunk.web.uri,
          content: text.substring(0, 500) // Use part of the response as context
        }));
    }
    
    // Return structured result
    return {
      summary: text,
      sources: sources.slice(0, 5) // Limit to 5 sources
    };
    
  } catch (error) {
    console.error('Gemini search error:', error.message);
    return null;
  }
}

// Helper: Fact check article claims using Gemini 2.5 Flash Grounding
async function factCheckArticle(content, metadata) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: [{
        googleSearch: {}
      }]
    });

    // Extract key topics/entities from the article for better search targeting
    const title = metadata?.title || 'Unknown';
    const author = metadata?.author || 'Unknown';
    const source = metadata?.source || 'Unknown';
    
    const prompt = `You are a fact-checking assistant. You MUST use the googleSearch tool to search the web in real-time to verify claims from this article.

Article Title: ${title}
Author: ${author}
Source: ${source}

Article Content:
${content.substring(0, 8000)}

CRITICAL INSTRUCTIONS:
1. You MUST use the googleSearch tool to search the web for each factual claim
2. DO NOT rely on training data - search the web NOW for real-time verification
3. Identify 3-5 key factual claims that can be independently verified
4. For each claim, perform a web search to find reliable sources
5. Use the search results to verify, contradict, or provide context

For each claim you identify, search the web with queries like:
- "[specific claim from article] verification"
- "[key fact] fact check"
- "[statistic or claim] confirmed"
- "[topic] reliable sources"

IMPORTANT: You MUST use the googleSearch tool. Return ONLY a JSON array:
[
  {
    "claim": "Exact factual claim from the article",
    "status": "Confirmed" | "Partially Confirmed" | "Uncertain" | "Contradicted",
    "assessment": "Your verification based on web search results",
    "reliability": 0.0-1.0,
    "search_queries": ["query used for verification"]
  }
]

Focus on verifiable factual claims (statistics, events, data, statements of fact), not opinions.`;

    console.log('🔍 Fact-checking article with real-time web search...');
    console.log(`   Article: ${title.substring(0, 60)}...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Fact-check response received');
    
    // Extract grounding metadata (sources used in real-time)
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let verificationSources = [];
    
    if (groundingMetadata?.groundingChunks) {
      console.log(`   Found ${groundingMetadata.groundingChunks.length} grounding chunks`);
      
      verificationSources = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web)
        .map((chunk, index) => {
          const source = {
            index: index + 1,
            title: chunk.web.title || 'Web Source',
            url: chunk.web.uri,
            snippet: chunk.web.content || ''
          };
          console.log(`   Source ${source.index}: ${source.title}`);
          return source;
        });
      
      console.log(`   Total web sources extracted: ${verificationSources.length}`);
    } else {
      console.log('   No grounding chunks found - search may not have been triggered');
    }
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let verifiedClaims = [];
    
    if (jsonMatch) {
      verifiedClaims = JSON.parse(jsonMatch[0]);
      console.log(`   Verified ${verifiedClaims.length} claims`);
    }
    
    // Return structured result
    return {
      claims: verifiedClaims,
      sources: verificationSources.slice(0, 15) // Limit to 15 sources
    };
    
  } catch (error) {
    console.error('Fact-checking error:', error.message);
    return {
      claims: [],
      sources: []
    };
  }
}

// Helper: Get credibility from Claude with streaming
async function getCredibilityFromClaudeStreaming(content, metadata, url, onChunk) {
  try {
    // First, search for author information online using Gemini
    let authorInfoText = '';
    let authorSources = [];

    if (metadata?.author && metadata.author !== 'Unknown') {
      console.log(`🔍 Searching web for author: ${metadata.author}`);
      const searchResults = await searchAuthorInfo(metadata.author, metadata?.source);

      if (searchResults && searchResults.summary) {
        console.log(`✅ Found information about author with ${searchResults.sources.length} sources`);
        authorSources = searchResults.sources;
        authorInfoText = '\n\nWEB RESEARCH ABOUT THE AUTHOR:\n';
        authorInfoText += searchResults.summary + '\n\n';

        if (searchResults.sources.length > 0) {
          authorInfoText += 'SOURCES:\n';
          searchResults.sources.forEach((source, idx) => {
            authorInfoText += `[${idx + 1}] ${source.title}\nURL: ${source.url}\n\n`;
          });
        }
      } else {
        console.log('⚠️  No web results found for author');
      }
    }

    const prompt = `You are a careful media literacy assistant. You assess credibility and bias in three layers: Website, Author, and Content. Be specific and calm.

METADATA:
Source: ${metadata?.source || new URL(url).hostname}
Author: ${metadata?.author || 'Unknown'}
Channel: ${metadata?.channel || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

ARTICLE CONTENT:
${content.substring(0, 6000)}
${authorInfoText}

TASK - Perform a THREE-TIER analysis:

TIER 1: WEBSITE/SOURCE ANALYSIS
Analyze the publication/platform itself:
- What type of source is this? (Major news outlet, blog, academic, etc.)
- What is its general reputation and track record?
- Known editorial standards or biases?
- Funding model and potential conflicts?

TIER 2: AUTHOR ANALYSIS
${authorSources.length > 0 ?
  `Using the WEB RESEARCH provided above:
- What expertise or credentials does the author have? [cite with [1], [2]]
- Professional background and history? [cite]
- Established journalist, blogger, academic, or content creator?
- Any conflicts of interest or biases? [cite]` :
  `Based on the article content and writing style:
- What type of author does this appear to be?
- What expertise is evident from the writing?
- Any biases evident in the writing style?`}

TIER 3: ARTICLE CONTENT ANALYSIS
Analyze THIS specific article's reliability:
- Quality of evidence and citations in THIS article
- Emotional/manipulative language vs neutral reporting
- Factual claims vs speculation/opinion
- Logical reasoning and argumentation quality
- Balance and fairness in presenting information

FINAL RATING:
Combine all three tiers to give an overall credibility score 0.0-1.0 and label.

SCORING BREAKDOWN:
Also provide individual scores (0.0-1.0) for each tier:
- website_score: Credibility of the source/publication (0.0-1.0)
- author_score: Author expertise and credibility (0.0-1.0)
- content_score: Quality of this specific article (0.0-1.0)

The overall score should be a weighted combination of these three scores.

Return JSON:
{
  "score": 0.82,
  "label": "Reliable",
  "overall_assessment": "Brief 2-3 sentence summary of overall credibility",
  "score_breakdown": {
    "website_score": 0.85,
    "author_score": 0.80,
    "content_score": 0.82,
    "explanation": "Brief explanation of how scores were weighted"
  },
  "website_analysis": {
    "type": "Major news outlet / Blog / Academic / etc.",
    "reputation": "Assessment of source's general credibility",
    "editorial_standards": "Known standards or lack thereof",
    "potential_conflicts": "Funding, ownership, or bias concerns"
  },
  "author_analysis": {
    "expertise": "Assessment with citations like [1] or [2]",
    "background": "Professional history with citations",
    "reputation_signals": "Credibility indicators with citations",
    "potential_bias": "Author-specific biases with citations"
  },
  "content_analysis": {
    "evidence_quality": "How well is this article supported?",
    "tone": "Neutral reporting vs emotional/opinion",
    "fact_vs_opinion": "Balance of factual vs speculative claims",
    "logical_reasoning": "Quality of argumentation",
    "balance": "Fairness in presenting different perspectives"
  }
}

IMPORTANT: Cite author research sources using [1], [2], [3].
Return ONLY the JSON, no other text.`;

    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let fullText = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const chunkText = chunk.delta.text;
        fullText += chunkText;
        if (onChunk) {
          onChunk(chunkText);
        }
      }
    }

    // Parse JSON from complete response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Add actual source URLs to the response
      if (authorSources.length > 0) {
        result.author_sources = authorSources.map((source, idx) => ({
          index: idx + 1,
          title: source.title,
          url: source.url
        }));
      }

      return result;
    }

    throw new Error('Failed to parse Claude response');
  } catch (error) {
    console.error('Claude credibility streaming error:', error);
    throw error;
  }
}

// Helper: Get credibility from Claude
async function getCredibilityFromClaude(content, metadata, url) {
  try {
    // First, search for author information online using Gemini
    let authorInfoText = '';
    let authorSources = [];
    
    if (metadata?.author && metadata.author !== 'Unknown') {
      console.log(`🔍 Searching web for author: ${metadata.author}`);
      const searchResults = await searchAuthorInfo(metadata.author, metadata?.source);
      
      if (searchResults && searchResults.summary) {
        console.log(`✅ Found information about author with ${searchResults.sources.length} sources`);
        authorSources = searchResults.sources;
        authorInfoText = '\n\nWEB RESEARCH ABOUT THE AUTHOR:\n';
        authorInfoText += searchResults.summary + '\n\n';
        
        if (searchResults.sources.length > 0) {
          authorInfoText += 'SOURCES:\n';
          searchResults.sources.forEach((source, idx) => {
            authorInfoText += `[${idx + 1}] ${source.title}\nURL: ${source.url}\n\n`;
          });
        }
      } else {
        console.log('⚠️  No web results found for author');
      }
    }

    const prompt = `You are a careful media literacy assistant. You assess credibility and bias in three layers: Website, Author, and Content. Be specific and calm.

METADATA:
Source: ${metadata?.source || new URL(url).hostname}
Author: ${metadata?.author || 'Unknown'}
Channel: ${metadata?.channel || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

ARTICLE CONTENT:
${content.substring(0, 6000)}
${authorInfoText}

TASK - Perform a THREE-TIER analysis:

TIER 1: WEBSITE/SOURCE ANALYSIS
Analyze the publication/platform itself:
- What type of source is this? (Major news outlet, blog, academic, etc.)
- What is its general reputation and track record?
- Known editorial standards or biases?
- Funding model and potential conflicts?

TIER 2: AUTHOR ANALYSIS
${authorSources.length > 0 ? 
  `Using the WEB RESEARCH provided above:
- What expertise or credentials does the author have? [cite with [1], [2]]
- Professional background and history? [cite]
- Established journalist, blogger, academic, or content creator?
- Any conflicts of interest or biases? [cite]` :
  `Based on the article content and writing style:
- What type of author does this appear to be?
- What expertise is evident from the writing?
- Any biases evident in the writing style?`}

TIER 3: ARTICLE CONTENT ANALYSIS
Analyze THIS specific article's reliability:
- Quality of evidence and citations in THIS article
- Emotional/manipulative language vs neutral reporting
- Factual claims vs speculation/opinion
- Logical reasoning and argumentation quality
- Balance and fairness in presenting information

FINAL RATING:
Combine all three tiers to give an overall credibility score 0.0-1.0 and label.

SCORING BREAKDOWN:
Also provide individual scores (0.0-1.0) for each tier:
- website_score: Credibility of the source/publication (0.0-1.0)
- author_score: Author expertise and credibility (0.0-1.0)
- content_score: Quality of this specific article (0.0-1.0)

The overall score should be a weighted combination of these three scores.

Return JSON:
{
  "score": 0.82,
  "label": "Reliable",
  "overall_assessment": "Brief 2-3 sentence summary of overall credibility",
  "score_breakdown": {
    "website_score": 0.85,
    "author_score": 0.80,
    "content_score": 0.82,
    "explanation": "Brief explanation of how scores were weighted"
  },
  "website_analysis": {
    "type": "Major news outlet / Blog / Academic / etc.",
    "reputation": "Assessment of source's general credibility",
    "editorial_standards": "Known standards or lack thereof",
    "potential_conflicts": "Funding, ownership, or bias concerns"
  },
  "author_analysis": {
    "expertise": "Assessment with citations like [1] or [2]",
    "background": "Professional history with citations",
    "reputation_signals": "Credibility indicators with citations",
    "potential_bias": "Author-specific biases with citations"
  },
  "content_analysis": {
    "evidence_quality": "How well is this article supported?",
    "tone": "Neutral reporting vs emotional/opinion",
    "fact_vs_opinion": "Balance of factual vs speculative claims",
    "logical_reasoning": "Quality of argumentation",
    "balance": "Fairness in presenting different perspectives"
  }
}

IMPORTANT: Cite author research sources using [1], [2], [3].
Return ONLY the JSON, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const text = message.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Add actual source URLs to the response
      if (authorSources.length > 0) {
        result.author_sources = authorSources.map((source, idx) => ({
          index: idx + 1,
          title: source.title,
          url: source.url
        }));
      }
      
      return result;
    }
    
    throw new Error('Failed to parse Claude response');
  } catch (error) {
    console.error('Claude credibility error:', error);
    // Fallback
    return {
      score: 0.5,
      label: 'Unknown',
      overall_assessment: 'Unable to assess credibility at this time.',
      website_analysis: {
        type: 'Unable to analyze',
        reputation: 'Unable to analyze',
        editorial_standards: 'Unable to analyze',
        potential_conflicts: 'Unable to analyze'
      },
      author_analysis: {
        expertise: 'Unable to analyze',
        background: 'Unable to analyze',
        reputation_signals: 'Unable to analyze',
        potential_bias: 'Unable to analyze'
      },
      content_analysis: {
        evidence_quality: 'Unable to analyze',
        tone: 'Unable to analyze',
        fact_vs_opinion: 'Unable to analyze',
        logical_reasoning: 'Unable to analyze',
        balance: 'Unable to analyze'
      }
    };
  }
}

// Helper: Get summary from Claude (fallback when Gemini fails)
async function getSummaryFromClaude(content, metadata) {
  const prompt = `You extract factual summaries from source material. You do not add external facts.

SOURCE METADATA:
Title: ${metadata?.title || 'Unknown'}
Author: ${metadata?.author || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

FULL TEXT:
${content.substring(0, 6000)}

TASK:
1. Give a 2-3 sentence plain-English summary of the source. No hype.
2. Give 5 concise bullet points of the main claims/conclusions from the source, using ONLY what appears in the source.
3. Return valid JSON with:
{
  "summary": "...",
  "bullets": ["...", "...", "...", "...", "..."]
}

Return ONLY the JSON, no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const text = message.content[0].text;
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Failed to parse Claude summary response');
}

// Helper: Extract topics and themes from article using Gemini
async function extractTopics(summary, bullets, content) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `Analyze this article and extract 3-5 main topics/themes as single words or short phrases.

Summary: ${summary}

Key Points:
${bullets.join('\n')}

Return ONLY a JSON array of topics, like: ["politics", "climate change", "technology"]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];
  } catch (error) {
    console.error('Topic extraction error:', error.message);
    return [];
  }
}

// Helper: Find connections between articles
async function findConnections(newArticle, allArticles) {
  if (allArticles.length === 0) return [];
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Compare with recent articles (last 20)
    const recentArticles = allArticles.slice(-20);
    
    const connections = [];
    
    for (const existingArticle of recentArticles) {
      // Skip same article
      if (existingArticle.url === newArticle.url) continue;
      
      // Quick topic overlap check
      const sharedTopics = newArticle.topics.filter(t => 
        existingArticle.topics.includes(t)
      );
      
      // Same author
      const sameAuthor = newArticle.author && 
                        existingArticle.author && 
                        newArticle.author === existingArticle.author;
      
      if (sharedTopics.length > 0 || sameAuthor) {
        // Ask AI for connection reasoning
        const prompt = `Compare these two articles and explain their connection in 1 sentence.

Article 1: "${newArticle.title}"
Summary: ${newArticle.summary}
Topics: ${newArticle.topics.join(', ')}

Article 2: "${existingArticle.title}"
Summary: ${existingArticle.summary}
Topics: ${existingArticle.topics.join(', ')}

Return ONLY the connection reason as plain text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const reason = response.text().trim();
        
        connections.push({
          url: existingArticle.url,
          reason,
          strength: sharedTopics.length + (sameAuthor ? 2 : 0)
        });
      }
    }
    
    // Sort by connection strength
    return connections.sort((a, b) => b.strength - a.strength).slice(0, 5);
    
  } catch (error) {
    console.error('Connection finding error:', error.message);
    return [];
  }
}

// Helper: Store article in memory
async function storeArticleInMemory(url, analysisResult, metadata) {
  try {
    const urlHash = getCacheKey(url);
    
    // Extract topics
    const topics = await extractTopics(
      analysisResult.summary,
      analysisResult.bullets,
      ''
    );
    
    // Create article memory entry
    const articleData = {
      url,
      urlHash,
      title: metadata?.title || 'Untitled',
      author: metadata?.author || 'Unknown',
      source: metadata?.source || new URL(url).hostname,
      published_at: metadata?.published_at,
      analyzed_at: new Date().toISOString(),
      summary: analysisResult.summary,
      bullets: analysisResult.bullets,
      topics,
      credibility_score: analysisResult.credibility.score,
      credibility_label: analysisResult.credibility.label
    };
    
    // Store article
    articleMemory.set(url, articleData);
    
    // Update topic index
    topics.forEach(topic => {
      if (!topicIndex.has(topic)) {
        topicIndex.set(topic, []);
      }
      topicIndex.get(topic).push(url);
    });
    
    // Find connections
    const allArticles = Array.from(articleMemory.values());
    const connections = await findConnections(articleData, allArticles);
    articleConnections.set(urlHash, connections);
    
    console.log(`📚 Stored article in memory: ${articleData.title}`);
    console.log(`   Topics: ${topics.join(', ')}`);
    console.log(`   Connections found: ${connections.length}`);
    
    // Also store in Letta for persistent memory (async, don't wait)
    storeLettaMemory(articleData).catch(err => 
      console.error('Letta storage error:', err.message)
    );
    
    return {
      topics,
      connections: connections.length,
      totalArticles: articleMemory.size,
      lettaEnabled: LETTA_API_KEY && LETTA_API_KEY !== 'your_letta_api_key_here'
    };
    
  } catch (error) {
    console.error('Error storing article:', error);
    return null;
  }
}

// Helper: Chat with Claude
async function chatWithClaude(sourceContent, metadata, conversationHistory, userMessage, responseLength = 'auto') {
  try {
    // Define length instructions based on user preference
    const lengthInstructions = {
      auto: 'Adjust your response length naturally based on the question complexity. Simple questions deserve brief answers, complex ones deserve thorough explanations.',
      short: 'Keep answers concise and under 75 words. Be direct and to the point.',
      default: 'Keep answers under 150 words unless the user asks for more.',
      detailed: 'Provide comprehensive, thorough answers with examples and context. You may use up to 300 words when helpful.'
    };
    
    const lengthInstruction = lengthInstructions[responseLength] || lengthInstructions.auto;
    
    const systemPrompt = `You are assisting the user in understanding ONE specific source (below). You must stay grounded in that source unless the user explicitly asks for general world knowledge. If the user asks "is this accurate?" you should say if the claim is supported in the text, and you may flag parts that sound speculative or biased, but you must say you are not verifying with outside sources. ${lengthInstruction}

SOURCE:
Title: ${metadata?.title || 'Unknown'}
Author: ${metadata?.author || 'Unknown'}

Content:
${sourceContent.substring(0, 6000)}`;

    // Build conversation messages
    const messages = [];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.text
        });
      });
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Claude chat error:', error);
    return 'Sorry, I encountered an error processing your message. Please try again.';
  }
}

// GET /history - Get analyzed article history
app.get('/history', (req, res) => {
  try {
    const articles = Array.from(articleMemory.values())
      .sort((a, b) => new Date(b.analyzed_at) - new Date(a.analyzed_at))
      .slice(0, 50); // Last 50 articles
    
    res.json({ articles, total: articleMemory.size });
  } catch (error) {
    console.error('Error in /history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// GET /connections/:url - Get article connections
app.get('/connections/:urlHash', (req, res) => {
  try {
    const { urlHash } = req.params;
    const connections = articleConnections.get(urlHash) || [];

    // Get full article data for connections
    const connectedArticles = connections.map(conn => ({
      ...articleMemory.get(conn.url),
      connectionReason: conn.reason,
      connectionStrength: conn.strength
    })).filter(Boolean);

    res.json({
      connections: connectedArticles,
      totalArticles: articleMemory.size
    });
  } catch (error) {
    console.error('Error in /connections:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 DeepDive backend running on http://localhost:${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   POST /analyze - Analyze content`);
  console.log(`   POST /chat - Chat about content`);
  console.log(`   GET /history - Get reading history`);
  console.log(`   GET /connections/:urlHash - Get article connections`);
  console.log(`   GET /health - Health check`);
  console.log('');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  WARNING: ANTHROPIC_API_KEY not set in .env');
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('⚠️  WARNING: GOOGLE_API_KEY not set in .env');
  } else {
    console.log('✅ Gemini enabled for summaries and author research (with Google Search)');
  }
  
  // Initialize Letta
  if (LETTA_API_KEY && LETTA_API_KEY !== 'your_letta_api_key_here') {
    console.log('🧠 Initializing Letta AI agent...');
    const agentId = await initializeLettaAgent();
    if (agentId) {
      console.log('✅ Letta AI enabled - Persistent memory active!');
      console.log(`   Agent ID: ${agentId}`);
    } else {
      console.warn('⚠️  Letta initialization failed - Using local memory only');
    }
  } else {
    console.log('💡 Letta AI not configured - Using local memory only');
    console.log('   Add LETTA_API_KEY to .env for persistent memory across restarts');
  }
});

