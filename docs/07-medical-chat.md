# AI Medical Chat Assistant — Architecture

A chat panel on every analysis page that is **grounded in that specific scan's results**, not a generic chatbot. Powered by the **Medical Chat Agent** ([`05-multi-agent.md`](05-multi-agent.md)).

## What it answers (in context)

Explain this disease · Why did the AI detect this? · What does this confidence score mean? · What should I do next? · Possible treatment options? · When should I see a doctor? · Explain this in simple language. — always about _this_ patient's _this_ scan.

## Grounding strategy (RAG + structured context)

The agent's context window is assembled from three sources, never free-floating:

1. **Structured scan context (authoritative):** the `prediction` (labels, confidences, severity), the `report.narrative`, heatmap description, scan metadata. Injected as structured JSON.
2. **Curated medical knowledge base (RAG):** vetted, citable content per condition (definition, causes, risk factors, standard management, red-flags). Stored as embeddings in **pgvector**; retrieved by detected condition + user question. Curated by us (not open web) to control accuracy.
3. **Guardrail layer:** system prompt enforcing educational-only, no diagnosis/prescription, medication = _general education_ with disclaimer, escalate to "see a clinician / seek urgent care" on red-flag questions.

```
question + scan_id
      │
      ▼
Medical Chat Agent ── load structured scan context (prediction+report)
      │             ── retrieve KB chunks (pgvector, by condition+intent)
      ▼
Claude (claude-sonnet-5, streaming) with:
   [system: guardrails] [scan context] [retrieved KB] [chat history] [question]
      │
      ▼
stream tokens → append deterministic disclaimer → audit log
```

## Why this design

- **Grounded, not hallucinated:** the model is told _"only discuss the findings provided and the retrieved references; if asked beyond scope, defer to a clinician."_
- **Confidence-literate:** the agent is given the actual numbers so "what does 83% mean" is answered concretely and honestly (incl. model limitations).
- **Safe:** medication and treatment content is educational, disclaimed, and never framed as a prescription; urgent symptoms trigger an escalation response.

## Tech

- **LLM:** Claude `claude-sonnet-5` (fast/cheap default); `claude-opus-4-8` optional premium.
- **Streaming:** SSE to the chat panel; token-by-token.
- **Memory:** session-scoped conversation stored per `scan_id`; not cross-contaminated between scans.
- **Vector store:** pgvector in the existing Postgres (no new infra).
- **Cost control:** prompt caching of the static KB + system prompt; short context windows.

## API

```
POST /api/v1/chat/sessions            {scan_id} → session_id
POST /api/v1/chat/sessions/{id}/messages  {content}  → SSE stream
GET  /api/v1/chat/sessions/{id}       # history
```

## Data model addition

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  grounding JSONB,           -- which KB chunks / context were used
  tokens INT, llm_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE kb_documents (      -- curated medical knowledge base
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition TEXT, section TEXT, source TEXT,
  content TEXT, embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON kb_documents USING ivfflat (embedding vector_cosine_ops);
```

## UI

Docked glass panel beside results; suggested-prompt chips; streaming markdown; citations to KB where used; persistent disclaimer; "explain simply" toggle.
