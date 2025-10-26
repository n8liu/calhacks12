import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// In-memory storage (replace with database in production)
const conversations = new Map();
const cache = new Map();

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

    // Parallel: Get summary from Gemini and credibility from Claude
    // Use allSettled so one failure doesn't break everything
    const [summaryResult, credibilityResult] = await Promise.allSettled([
      getSummaryFromGemini(cleanedContent, metadata),
      getCredibilityFromClaude(cleanedContent, metadata, url)
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
        why: 'Credibility analysis temporarily unavailable. This does not reflect on the source quality.'
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
    const { conversation_id, user_message } = req.body;

    if (!conversation_id || !user_message) {
      return res.status(400).json({ error: 'Missing required fields: conversation_id, user_message' });
    }

    const conversation = conversations.get(conversation_id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    console.log(`Chat message for conversation ${conversation_id}`);

    // Get response from Claude
    const assistantMessage = await chatWithClaude(
      conversation.content,
      conversation.metadata,
      conversation.messages,
      user_message
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

// Helper: Get credibility from Claude
async function getCredibilityFromClaude(content, metadata, url) {
  try {
    const prompt = `You are a careful media literacy assistant. You assess credibility and bias, not political alignment. Be specific and calm.

We have an article/video with this metadata:

Source: ${metadata?.source || new URL(url).hostname}
Author: ${metadata?.author || 'Unknown'}
Published: ${metadata?.published_at || 'Unknown'}

Content:
${content.substring(0, 6000)}

TASK:
1. Rate credibility 0.0 (not trustworthy) → 1.0 (highly trustworthy).
2. Provide a one-word label: "Reliable", "Mixed", or "Low".
3. Explain in 2-4 sentences WHY you chose this, citing things like:
   - Expertise / reputation of the source
   - Emotional or manipulative language
   - Presence/absence of data, citations, or verifiable specifics
   - Whether it's reporting vs opinion
4. Mention any obvious bias.

Return JSON:
{
  "score": 0.82,
  "label": "Reliable",
  "why": "..."
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
    
    throw new Error('Failed to parse Claude response');
  } catch (error) {
    console.error('Claude credibility error:', error);
    // Fallback
    return {
      score: 0.5,
      label: 'Unknown',
      why: 'Unable to assess credibility at this time.'
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

// Helper: Chat with Claude
async function chatWithClaude(sourceContent, metadata, conversationHistory, userMessage) {
  try {
    const systemPrompt = `You are assisting the user in understanding ONE specific source (below). You must stay grounded in that source unless the user explicitly asks for general world knowledge. If the user asks "is this accurate?" you should say if the claim is supported in the text, and you may flag parts that sound speculative or biased, but you must say you are not verifying with outside sources. Keep answers under 150 words unless the user asks for more.

SOURCE:
Title: ${metadata?.title || 'Unknown'}
Author: ${metadata?.author || 'Unknown'}

Content:
${sourceContent.substring(0, 6000)}`;

    // Build conversation messages
    const messages = [];
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.text
      });
    });
    
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartSummary backend running on http://localhost:${PORT}`);
  console.log(`📝 Endpoints:`);
  console.log(`   POST /analyze - Analyze content`);
  console.log(`   POST /chat - Chat about content`);
  console.log(`   GET /health - Health check`);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  WARNING: ANTHROPIC_API_KEY not set in .env');
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('⚠️  WARNING: GOOGLE_API_KEY not set in .env');
  }
});

