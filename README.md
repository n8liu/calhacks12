# AI Co-Pilot for Reading & Watching

**"AI co-pilot for whatever I'm reading/watching right now."**

This project is a Chrome extension that provides intelligent summarization, credibility analysis, and interactive Q&A for any article or YouTube video you're viewing.

---

## Table of Contents

1. [Core User Experience](#1-core-user-experience)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Full Data Flow](#3-full-data-flow)
4. [Frontend Design](#4-frontend-design-chrome-extension)
5. [Backend Design](#5-backend-design)
6. [Prompts](#6-prompts-examples)
7. [Storage / DB Schema](#7-storage--db-schema-minimal-viable)
8. [Security / Privacy / Auth](#8-security--privacy--auth)
9. [Rate Limiting & Cost Control](#9-rate-limiting--cost-control)
10. [Stretch Features](#10-stretch-features)
11. [TL;DR Blueprint](#11-tldr-blueprint)

---

## 1. Core user experience

### What the user sees

1. A little floating bubble in the top-right of any page (article or YouTube).

   * Clicking it opens a panel/side-drawer.
   * The panel has:

     * **Summary tab:** TL;DR and key takeaways.
     * **Credibility tab:** "How trustworthy is this source?" + red/yellow/green badge.
     * **Ask tab / Chat:** Chat UI ("Ask anything about this video/article").

2. Auto-detection:

   * On a blog post → it scrapes title, author, content.
   * On YouTube → it grabs title, channel, publish date, and transcript.

3. Realtime behavior:

   * When they open the panel, it's already filled with summary + credibility, no button press.
   * They can type follow-up questions like:

     * "Is this opinion or fact?"
     * "What's the author's bias?"
     * "Give me a counterargument."

You're not just summarizing. You're doing: **"understand, judge, interrogate."**

---

## 2. High-level architecture

### Pieces

1. **Chrome extension (frontend)**

   * Content script: runs in the context of whatever tab the user is on. Extracts page data.
   * Sidebar UI / injected widget: the floating button + slide-out panel.
   * Extension service worker (background script): orchestrates messaging between tabs and backend, auth, rate limiting per user.
   * Popup.html (browser action): optional mini control panel when they click the extension icon.

2. **Backend service (your server)**

   * API endpoints:

     * `/analyze` – takes `{url, pageText, meta}` and returns `{summary, key_points, credibility, source_meta}`.
     * `/chat` – takes `{conversation_id, user_message, context_embed}` and returns `{assistant_message}`.
   * Calls out to:

     * Claude API (for reasoning, bias/credibility, clarifications).
     * Gemini API (for fast summarization + factual extraction).
   * Internal memory / cache (Redis / Postgres) so the same YouTube link doesn't get re-summarized 500 times.

3. **Optional lightweight datastore**

   * User table (user_id, API quotas).
   * Conversation table (conversation_id, turns).
   * Cache table keyed by URL hash for summary/credibility.

---

## 3. Full data flow (step-by-step)

### A. User lands on a page

1. `content_script.js` scrapes:

   * URL
   * Document title
   * Main article text (by querying `<article>`, `<p>`, etc.)
   * On YouTube: video title, channel, description, transcript (the transcript can be fetched from the YouTube page DOM or YouTube transcript API if accessible without login).

2. `content_script.js` sends `POST` to your backend `/analyze` through the service worker (never directly expose Claude/Gemini keys in the extension).

Payload example:

```json
{
  "url": "https://www.nytimes.com/some-article",
  "content": "<full extracted text>",
  "type": "article",
  "metadata": {
    "author": "Jane Doe",
    "published_at": "2025-10-20",
    "source": "NYTimes"
  }
}
```

3. Backend:

   * Cleans + chunks content.
   * Sends summarization prompt to Gemini (cheaper/faster).
   * Sends credibility/bias prompt to Claude (more careful reasoning).
   * Merges results.
   * Caches `{url -> summary, credibility}`.

4. Backend returns:

```json
{
  "summary": "Main claim is ...",
  "bullets": [
    "Point 1 ...",
    "Point 2 ...",
    "Implication ..."
  ],
  "credibility": {
    "score": 0.82,
    "label": "Likely reliable",
    "why": "Large established outlet, cites primary sources, neutral language."
  },
  "source_meta": {
    "author": "Jane Doe",
    "published_at": "2025-10-20",
    "reading_time": "7 min",
    "word_count": 1530
  },
  "conversation_id": "abc123" 
}
```

5. Extension injects this into the slide-out UI.

### B. User asks a follow-up question in chat

1. User types: "Summarize just the counterarguments."

2. UI sends:

```json
{
  "conversation_id": "abc123",
  "user_message": "Summarize just the counterarguments."
}
```

to `/chat`.

3. Backend `/chat`:

   * Looks up prior turns and original extracted text.
   * Builds a system prompt for Claude: "You are an assistant helping the user understand the current page. Use ONLY this source unless explicitly asked for outside info…"
   * Sends to Claude.
   * Returns Claude's reply → extension displays it in the chat.

---

## 4. Frontend design (Chrome extension)

### 4.1 Extension file layout

```text
extension/
  ├─ manifest.json
  ├─ background.js           (service worker)
  ├─ contentScript.js        (runs on every page)
  ├─ injectUI.js             (injected sidebar / chat panel)
  ├─ injectUI.css
  ├─ popup.html              (browser action popup)
  ├─ popup.js
  └─ assets/
      └─ icon128.png
```

#### `manifest.json` (Manifest V3 sketch)

```json
{
  "manifest_version": 3,
  "name": "SmartSummary",
  "version": "0.1.0",
  "description": "Summarize and fact-check whatever you're reading or watching.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://your-backend.example.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["contentScript.js"],
    "run_at": "document_idle"
  }]
}
```

* `content_scripts` scrapes + injects UI.
* `background.js` handles network to backend (so you can centralize auth).

---

### 4.2 UI in-page (the slide-out panel)

You'll inject a root `<div id="smart-summary-root">` into the DOM and mount a small React app there.

**Panel layout (visually):**

* Header row:

  * Favicon / source
  * Title of article/video
  * Credibility badge chip (Green / Yellow / Red dot)

* Tabs:

  * **Summary**
  * **Credibility**
  * **Ask AI**

* Body (scrollable):

  * Summary tab:

    * "Quick Summary" (2–3 sentences)
    * "Key Points" (bullets)

  * Credibility tab:

    * "Trust score: 82/100"
    * "Factors"

      * Source reputation
      * Evidence/citations
      * Emotion vs neutral tone
      * Known bias

  * Ask AI tab:

    * Chat history
    * Input box + send button

**Floating button**

* Circular button (like ChatGPT's "Ask this page"), fixed `position: fixed; top: 16px; right: 16px; z-index: 999999;`
* Clicking toggles the panel.

**States**

* `loading`: shimmer skeleton (3 gray lines)
* `ready`: render data
* `error`: "Couldn't summarize this page. Try manually sending it?"

**Why injected UI instead of a browserAction popup?**

* Popup closes when you click outside. Injected panel feels native and persistent while scrolling/reading.

---

### 4.3 Frontend component tree (React mental model)

* `<SidebarRoot>`

  * `<HeaderBar>`
  * `<Tabs>`

    * `<SummaryTab>`
    * `<CredibilityTab>`
    * `<ChatTab>`

      * `<ChatHistory>`
      * `<ChatInput>`

Internal state:

```js
{
  isOpen: true,
  loading: false,
  data: {
    summary: "...",
    bullets: [...],
    credibility: { score: 0.82, label: "Likely reliable", why: "..."},
    source_meta: {...}
  },
  chat: [
    {role: "assistant", text: "Ask me anything about this video."},
    {role: "user", text: "What's the main argument?"}
  ]
}
```

Message sending flow:

* User submits → optimistic add to `chat` → call background → background calls backend `/chat` → response posted back via `chrome.runtime.sendMessage` → UI updates.

---

## 5. Backend design

### 5.1 Endpoints

#### `POST /analyze`

**Input:** `{url, content, type, metadata}`  
**Output:** `{summary, bullets, credibility, source_meta, conversation_id}`

**Behavior:**

1. Normalize content (strip nav/footer/ads, limit to length ~8k tokens).

2. Call Gemini for structured extractive summary:

   * "Give a 3 sentence summary and 5 bullet points using only claims that appear in the text."

3. Call Claude for credibility:

   * "Rate trustworthiness from 0-1. Consider source authority, presence of citations, tone (sensational vs neutral), factual vs speculative language. Give reasoning."

4. Create a conversation record:

   * `conversation_id` plus:

     * The raw article/video text (or an embedding/chunked store).
     * Initial assistant summary as first assistant turn.

5. Return result.

#### `POST /chat`

**Input:** `{conversation_id, user_message}`  
**Output:** `{assistant_message}`

**Behavior:**

1. Load conversation history + original source text.
2. Construct prompt for Claude:

   * System: "You are an analyst helping the user interrogate ONE SOURCE (pasted below). You should cite lines from the source text instead of making up facts. If user asks 'is this true in general?', say you cannot browse the live web in this chat and you're answering based only on the source, unless they explicitly ask you to generalize."

3. Append user_message.
4. Send to Claude.
5. Store turn in DB.
6. Return assistant_message.

---

### 5.2 Model division strategy (Claude vs Gemini)

**Gemini**

* Fast summarization and bullet extraction.
* Good at digesting long transcripts and returning structured answers.
* Use it in `/analyze` for `summary` and `bullets`.

**Claude**

* Long-context reasoning, nuance, hedging, bias analysis, polite chat.
* Use it in `/analyze` for `credibility`.
* Use it in `/chat` for conversation replies.

**You're playing them to strengths:**

* Gemini = "what was said"
* Claude = "should I trust this, and what does it mean"

Bonus: You can A/B or fallback. If Gemini rate limits you, ask Claude for summary too.

---

## 6. Prompts (examples)

### 6.1 Gemini summarization prompt

**System:**

> You extract factual summaries from source material. You do not add external facts.

**User:**

```text
SOURCE METADATA:
Title: {{title}}
Author: {{author}}
Published: {{published_at}}
URL: {{url}}

FULL TEXT:
{{content}}

TASK:
1. Give a 2-3 sentence plain-English summary of the source. No hype.
2. Give 5 concise bullet points of the main claims/conclusions from the source, using ONLY what appears in the source.
3. Return valid JSON with:
{
  "summary": "...",
  "bullets": ["...", "...", "...", "...", "..."]
}
```

### 6.2 Claude credibility/bias prompt

**System:**

> You are a careful media literacy assistant. You assess credibility and bias, not political alignment. Be specific and calm.

**User:**

```text
We have an article/video with this metadata:

Source: {{source_domain}}
Author: {{author}}
Published: {{published_at}}
Channel/Outlet: {{channel_or_outlet}}

Content:
{{content}}

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
  "why": " ... "
}
```

### 6.3 Claude chat prompt

**System:**

> You are assisting the user in understanding ONE specific source (below). You must stay grounded in that source unless the user explicitly asks for general world knowledge. If the user asks "is this accurate?" you should say if the claim is supported in the text, and you may flag parts that sound speculative or biased, but you must say you are not verifying with outside sources. Keep answers under 150 words unless the user asks for more.

Then you append:

* Original source text (chunked intelligently).
* Conversation history (user/assistant pairs).
* New user message.

---

## 7. Storage / DB schema (minimal viable)

**users**

* `user_id`
* `created_at`
* `plan_tier` (free, pro)
* `monthly_tokens_used`

**conversations**

* `conversation_id`
* `user_id`
* `url`
* `source_text` (could be in a separate `conversation_blobs` table if large)
* `created_at`

**messages**

* `id`
* `conversation_id`
* `role` ("user" | "assistant")
* `text`
* `timestamp`

**cache_summaries**

* `url_hash`
* `summary_json`
* `credibility_json`
* `last_generated_at`

**Why cache:** if 1000 users are on the same MrBeast video, you don't want to pay 1000x.

---

## 8. Security / privacy / auth

**Do NOT put Claude/Gemini API keys in the extension code.**

* All LLM calls go through your backend.
* The extension talks to your backend with a short-lived auth token, e.g. JWT stored in `chrome.storage.sync`.

**CORS**

* Your backend should only accept requests with a valid token, not just any site.

**PII considerations**

* You're scraping page content the user is viewing, which may include logged-in dashboards, internal docs, etc. You MUST:

  * Show a first-run modal: "I will send page text to [your company] for AI summarization. Don't open this on private dashboards if you're not comfortable."
  * Offer a "Only summarize public websites / youtube.com / news sites" toggle, enforced client-side by hostname allowlist.

---

## 9. Rate limiting & cost control

* Frontend throttles `/analyze`:

  * Only send after user has been on the page for ~2-3 seconds AND page text length > X.
  * Do not auto-run again for the same URL unless 10+ minutes passed (store last result in `chrome.storage.local` keyed by URL).

* Backend enforces per-user:

  * Max summaries/hour.
  * Max chat turns/hour.

* Cache by URL hash for public pages to massively cut cost.

---

## 10. Stretch features

* **Inline fact check highlights**  
  Let user toggle "Highlight questionable claims" → you span-wrap sentences with `background-color: rgba(255,0,0,.08)` for sensational language or unverified stats (Claude can tag those sentences during `/analyze`).

* **Citation map**  
  "This claim comes from minute 12:31 of the video" or "Paragraph 4 says…". This is huge for credibility trust.

* **Reading-level translation**  
  Button: "Explain like I'm 12".

* **Export mode**  
  Copy summary + credibility as Markdown to clipboard for later notes.

---

## 11. TL;DR blueprint

**Frontend (extension):**

* Injects a floating assistant panel into every page.
* Scrapes article/video text + metadata.
* Shows 3 tabs: Summary / Credibility / Ask AI.
* Sends chat turns to backend and renders streaming replies.

**Backend:**

* `/analyze`:

  * Uses Gemini → summary + key bullets.
  * Uses Claude → credibility score / bias analysis.
  * Creates/stores conversation_id and caches results.

* `/chat`:

  * Uses Claude with full conversation + source text to answer follow-up questions.

**Trust layer:**

* Credibility score (0–1), label ("Reliable / Mixed / Low"), explanation.
* Bias callout.

**Safety:**

* All model keys server-side.
* User opt-in notice for private/internal pages.
* Rate limit + cache to control spend.

---

## Getting Started

This is absolutely shippable as an MVP at a hackathon and it hits like **"AI that helps me not get fooled on the internet."**

Ready to build? Let's ship it! 🚀

