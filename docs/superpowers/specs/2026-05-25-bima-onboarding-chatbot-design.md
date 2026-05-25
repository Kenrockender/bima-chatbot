# BIMA — BCA Life Staff Onboarding Chatbot
**Design Specification**
Date: 2026-05-25
Status: Approved

---

## 1. Overview

**Product Name:** BIMA (BCA Life Intelligent Mobile Assistant)

**Purpose:** A web-based AI chatbot that helps new BCA Life staff learn about the company's financial and insurance products. Staff can ask natural questions in English or Indonesian and receive answers sourced exclusively from company-approved documents (PDFs and URLs).

**Target Users:**
- **Primary:** New BCA Life staff during their onboarding period
- **Secondary:** IT staff who manage the knowledge base via the admin panel

**Success Criteria:**
- New staff feel confident about BCA Life products after using BIMA
- BIMA serves as a reliable reference tool staff can return to anytime
- The onboarding experience feels smooth and reflects a tech-forward company culture

---

## 2. Core Features

### 2.1 Staff Chat Interface
- Anonymous access — no login required
- Bilingual support: English and Indonesian (language toggle)
- Conversational memory within a session (follow-up questions supported)
- Session resets when the browser is closed or "New Conversation" is clicked
- Answers are grounded exclusively in uploaded documents — no hallucination
- Source attribution shown below each answer (document name / page)
- Escalation contact card shown when BIMA cannot find an answer

### 2.2 Admin Panel
- Password-protected at `/admin` (single password via environment variable)
- Upload PDFs (drag & drop or file picker, multiple files at once)
- Add URLs (BIMA fetches and indexes the content)
- View all knowledge base sources with status: `Processing`, `Ready`, or `Failed`
- Delete sources from the knowledge base
- Re-index a source (e.g., after a document update)

### 2.3 Escalation
- When BIMA cannot find a relevant answer (low similarity score), it responds politely and displays a contact card with WhatsApp number and/or email for HR/IT support
- BIMA never fabricates answers outside the provided documents

---

## 3. Chatbot Persona

- **Name:** BIMA
- **Full form:** BCA Life Intelligent Mobile Assistant
- **Tone:** Friendly, professional, warm
- **Avatar:** BCA Life branded
- **Languages:** English and Indonesian
- **Behavior:** Responds in the same language the staff member used

---

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│              STAFF (Browser)                │
│         Next.js Web App (Frontend)          │
│   Chat UI │ Language Toggle │ Contact Card  │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│           FastAPI Backend                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Chat API │  │Admin API │  │Ingest API │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│       │             │              │        │
│  ┌────▼─────────────▼──────────────▼─────┐  │
│  │         RAG Pipeline (LangChain)      │  │
│  └────────────┬──────────────────────────┘  │
│               │                             │
│  ┌────────────▼──────┐  ┌────────────────┐  │
│  │  ChromaDB         │  │  Ollama        │  │
│  │  (Vector Store)   │  │  (Local LLM)   │  │
│  └───────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React) + Tailwind CSS |
| Backend | Python FastAPI |
| LLM | Ollama + Llama 3.1 8B |
| Embeddings | Ollama + nomic-embed-text |
| Vector Store | ChromaDB (local) |
| RAG Framework | LangChain |
| PDF Parsing | PyPDF2 / pdfplumber |
| URL Scraping | BeautifulSoup4 |
| Session Memory | In-memory (per session, resets on close) |
| Admin Auth | Single password via environment variable |
| Metadata DB | SQLite |

---

## 6. RAG Pipeline

### Document Ingestion (Upload → Ready)
1. IT uploads PDF or submits URL via admin panel
2. Text is extracted (PyPDF2 for PDFs, BeautifulSoup4 for URLs)
3. Text is split into ~500-token chunks with overlap
4. Chunks are embedded using `nomic-embed-text` via Ollama
5. Embeddings and metadata (source name, page number) are stored in ChromaDB
6. Source status updates to `Ready`

### Answer Generation (Question → Response)
1. Staff types a question in the chat
2. Language is detected (EN or ID)
3. Question is embedded using the same embedding model
4. ChromaDB returns top 3–5 most relevant chunks
5. Question + retrieved chunks are sent to Llama 3.1 8B via Ollama
6. LLM generates an answer in the same language as the question
7. Answer + source reference returned to the chat UI

### Fallback
- If retrieved chunks score below a similarity threshold, BIMA responds: *"I'm sorry, I don't have information about that. Please contact our team for help."* and displays the escalation contact card.

---

## 7. UI Components

### Chat Interface
- Chat bubble layout (user messages right, BIMA messages left)
- EN / ID language toggle button (top right)
- BCA Life branded BIMA avatar and name header
- Source tag below each answer ("Source: [document name], page X")
- Escalation contact card (WhatsApp + email)
- "New Conversation" reset button

### Admin Panel (`/admin`)
- Password prompt on first visit
- Drag-and-drop PDF upload zone
- URL input field with "Add" button
- Sources table: Name | Type | Status | Date Added | Actions (Delete, Re-index)
- Toast notifications for upload success/failure

---

## 8. Deployment

- Runs entirely on a local office computer (no internet required after initial model download)
- Staff access BIMA via local network: `http://<office-machine-ip>:3000`
- IT starts all services with: `docker-compose up`
- Services:
  - `frontend` — Next.js on port 3000
  - `backend` — FastAPI on port 8000
  - `ollama` — Local LLM service on port 11434
  - `chromadb` — Vector store on port 8001

### Minimum Hardware Requirements
| Spec | Minimum | Recommended |
|---|---|---|
| RAM | 8GB | 16GB |
| Storage | 20GB free | 40GB free |
| OS | Windows 10/11 or Ubuntu | Ubuntu 22.04 LTS |
| CPU | 4-core | 8-core |

---

## 9. Knowledge Base Limits (MVP)
- 20–100 source documents (PDFs + URLs)
- 1–2 concurrent staff users
- No limit on conversation length within a session

---

## 10. Out of Scope (MVP)
- User login / authentication (deferred to v2)
- Usage analytics dashboard (deferred to v2)
- Mobile app
- Integration with external HR systems
- Support for languages other than English and Indonesian
- External AI API (OpenAI, Claude, etc.)

---

## 11. Future Considerations (v2)
- Staff login and progress tracking
- Admin analytics: most-asked questions, unanswered queries
- Support for more languages
- Ability to rate answers (thumbs up/down feedback)
- Auto-notify IT when a question goes unanswered repeatedly
