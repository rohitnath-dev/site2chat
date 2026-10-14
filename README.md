<p align="center">
  <a href="https://site2chat.vercel.app" target="_blank" rel="noopener noreferrer">
    <img src="frontend/public/favicon.svg" alt="Site2Chat logo" width="120">
  </a>
</p>

<h1 align="center">Site2Chat</h1>

<p align="center"><em>Website content → shareable, retrieval-augmented AI chatbots.</em></p>

<p align="center">
  <a href="https://site2chat.vercel.app">Live Demo</a>
</p>

Site2Chat is a FastAPI backend and React + Vite frontend that together provide a workflow for creating chatbots from website content. The backend validates website URLs, ingests site pages into a PostgreSQL + pgvector model, stores page and chunk records, and exposes authenticated routes for chatbot management and retrieval-augmented chat. The frontend in `frontend/` provides a dashboard and chat experience for end users and chatbot owners.

## Table of contents

- [Project overview](#project-overview)
- [Features](#features)
- [Architecture and request flow](#architecture-and-request-flow)
- [Project structure](#project-structure)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Environment variables](#environment-variables)
- [Backend API](#backend-api)
- [Authentication](#authentication)
- [Database and models](#database-and-models)
- [Deployment notes](#deployment-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Project overview

Site2Chat combines a FastAPI backend with a React frontend to turn website content into chatbot knowledge. The implemented flow is:

1. A user creates a chatbot tied to a website URL.
2. The backend validates the URL before saving the chatbot.
3. A website ingestion job crawls the target site and stores pages/chunks in the database.
4. The generated content is used by the RAG service to answer user questions.
5. Conversations, messages, and model settings are stored and served through the backend API.

This repository contains the backend API, database models, ingestion/retrieval logic, and the frontend client used to manage chatbots and interact with them.

---

## Features

The following features are implemented in the inspected code:

- Authenticated chatbot management:
  - create, list, retrieve, update LLM configuration, and delete chatbots
- Website URL validation during chatbot creation
- Website ingestion for each chatbot
- Conversation and message persistence
- Retrieval-augmented chat generation
- Encrypted storage for per-user OpenRouter API keys
- Supabase JWT-based authentication
- React + TypeScript frontend for managing chatbots and chat experiences

---

## Architecture and request flow

The application is organized into backend, data, and frontend layers:

- `api/` defines the FastAPI routes and entrypoint
- `core/` contains runtime configuration and authentication logic
- `database/` defines the SQLAlchemy schema and persistence layer
- `rag/` contains crawler, ingestion, and retrieval logic
- `frontend/` contains the React + Vite app

The app mounts the following routers under `/api/v1` in `api/main.py`:

- `/health`
- `/chatbots`
- `/chat`

The verified request flow is:

1. The frontend authenticates with Supabase and sends bearer tokens for protected API calls.
2. The FastAPI backend validates the token against Supabase JWKS.
3. The user creates a chatbot with a website URL.
4. The backend validates the URL and stores chatbot metadata.
5. The ingestion process loads site content into page and chunk records.
6. When a user sends a message, the backend:
   - checks chatbot existence and readiness,
   - creates or reuses a conversation,
   - stores the incoming message,
   - calls the RAG service for an answer,
   - stores the assistant response and returns it.

---

## Project structure

```text
.
├── api/
│   ├── main.py
│   ├── health.py
│   ├── chatbots.py
│   └── chat.py
├── core/
│   ├── config.py
│   └── auth.py
├── database/
│   ├── connection.py
│   └── models.py
├── rag/
│   ├── crawler.py
│   ├── ingestion.py
│   └── rag.py
├── frontend/
│   ├── README.md
│   ├── package.json
│   └── public/
│       └── favicon.svg
├── pyproject.toml
├── requirements.txt
├── LICENSE
└── README.md
```

---

## Technology stack

### Backend

- Python 3.11 (`pyproject.toml` requires `>=3.11,<3.12`)
- FastAPI
- Pydantic v2
- SQLAlchemy
- PostgreSQL + pgvector
- Alembic
- PyJWT with crypto support
- LangChain ecosystem
- sentence-transformers, transformers, torch, and huggingface-hub
- faiss-cpu

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Supabase JavaScript client
- Lucide React icons

---

## Prerequisites

Before running the project locally, ensure the following are available:

- Python 3.11.x
- pip and a virtual environment tool
- Node.js and npm
- A PostgreSQL-compatible database with the pgvector extension
- A Supabase project for authentication
- An OpenRouter API key if you plan to use the OpenRouter credential flow

---

## Local development

### Backend

From the repository root:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the API locally:

```bash
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

The app entry point is `api.main:app`. The API is mounted under the version prefix configured in `core/config.py`.

### Frontend

The frontend is a separate app under `frontend/`:

```bash
cd frontend
cp .env.example .env    # fill in Supabase-related values
npm install
npm run dev              # default: http://localhost:5173
```

Create a production build:

```bash
cd frontend
npm run build
```

Preview the build locally:

```bash
cd frontend
npm run preview
```

The frontend-specific setup note is also documented in `frontend/README.md`.

---

## Environment variables

The following environment variables are explicitly referenced in the inspected code.

| Variable | Verified use | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Used in `core/auth.py` to fetch JWKS and validate tokens | Required for authenticated request flows |
| `OPENROUTER_KEY_ENCRYPTION_KEY` | Used in the encryption path for storing user OpenRouter keys | Keep this secret in a secure environment |
| `FRONTEND_ORIGINS` | Used in `api/main.py` to configure CORS origins | Defaults to `http://localhost:5173` if unset |
| `ENVIRONMENT` | Read in `core/config.py` | Defaults to `development` |
| `DEBUG` | Read in `core/config.py` | Parsed as a boolean string |
| `ADMIN_API_TOKEN` | Declared in `core/config.py` | No verified runtime use found in the inspected files |
| `VITE_API_BASE_URL` | Frontend config | Set the backend URL for the frontend |
| `VITE_SUPABASE_URL` | Frontend config | Public Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend config | Public Supabase anon key; not a secret |

Example `.env`:

```env
ENVIRONMENT=development
DEBUG=true
FRONTEND_ORIGINS=http://localhost:5173
SUPABASE_URL=https://<your-project>.supabase.co
OPENROUTER_KEY_ENCRYPTION_KEY=<secure-random-key>
ADMIN_API_TOKEN=
```

Do not commit secrets to the repository.

---

## Backend API

The FastAPI app is defined in `api/main.py` and mounted under the versioned API prefix `/api/v1`.

### Root

```http
GET /
```

Returns JSON:

```json
{
  "project": "site2chat API",
  "version": "1.0",
  "status": "running"
}
```

### Health

```http
GET /api/v1/health/
```

Returns:

```json
{
  "status": "healthy",
  "project": "site2chat API",
  "version": "1.0"
}
```

### Chatbot routes

All chatbot routes require authentication via `Depends(get_current_user)`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/chatbots/` | List chatbots owned by the authenticated user |
| `POST` | `/api/v1/chatbots/` | Create a chatbot with a name, website URL, and optional description |
| `GET` | `/api/v1/chatbots/{chatbot_id}` | Fetch a single chatbot |
| `PATCH` | `/api/v1/chatbots/{chatbot_id}/llm-settings` | Update `llm_provider` and `llm_model` |
| `DELETE` | `/api/v1/chatbots/{chatbot_id}` | Delete a chatbot |
| `POST` | `/api/v1/chatbots/{chatbot_id}/ingest` | Trigger website ingestion |
| `PUT` | `/api/v1/chatbots/credentials/openrouter` | Save an encrypted OpenRouter API key |
| `GET` | `/api/v1/chatbots/credentials/openrouter` | Check whether a key is configured |
| `DELETE` | `/api/v1/chatbots/credentials/openrouter` | Remove the stored key |

### Chat route

```http
POST /api/v1/chat/
```

Request body:

```json
{
  "chatbot_id": "00000000-0000-0000-0000-000000000000",
  "message": "Summarize the site content.",
  "session_id": "optional-session-id"
}
```

Required fields:
- `chatbot_id` is a UUID
- `message` is a required non-empty string
- `session_id` is optional

Behavior:
- validates that the chatbot exists,
- verifies the chatbot is in the `ready` or `partial` state,
- creates or reuses a conversation,
- stores the user message,
- calls the RAG service to answer the question,
- stores the assistant response and returns it.

Example response:

```json
{
  "status": "success",
  "chatbot_id": "00000000-0000-0000-0000-000000000000",
  "conversation_id": "00000000-0000-0000-0000-000000000000",
  "message": "Summarize the site content.",
  "reply": "Generated response text."
}
```

---

## Authentication

The backend validates bearer tokens using Supabase-issued JWTs.

Verified behavior in `core/auth.py`:

- Missing or invalid bearer tokens return `401 Unauthorized`
- Missing `SUPABASE_URL` returns `503 Service Unavailable`
- JWT signatures are verified using Supabase JWKS
- Allowed algorithms are `ES256` and `RS256`
- The `aud` claim must be `authenticated`
- The `iss` claim must match the issuer built from `SUPABASE_URL`
- The `sub` claim is required and used as the authenticated user ID

The issuer is built as:

```text
{SUPABASE_URL}/auth/v1
```

The frontend README also documents the frontend environment variables for Supabase (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`) and notes that Auth redirect URLs must be configured in the deployed app.

---

## Database and models

The database schema in `database/models.py` includes the following models:

- `Chatbot`
- `WebsitePage`
- `Conversation`
- `Message`
- `DocumentChunk`
- `UserLLMCredential`

Important verified details:

- `DocumentChunk.embedding` is stored as `pgvector.Vector(384)`
- `WebsitePage` and `DocumentChunk` are related to the owning chatbot
- `UserLLMCredential` stores an encrypted OpenRouter key for a user
- Models use PostgreSQL-specific types and pgvector

This is a PostgreSQL + pgvector-backed data model, as evidenced by the imports and dependency requirements.

Before running against a production database, ensure that any required PostgreSQL migrations are in place.

---

## Deployment notes

The repository includes deployment guidance in `frontend/README.md` for the frontend app and for configuring authentication and CORS. The documented recommendations include:

- serving `dist/` as a single-page app
- setting `FRONTEND_ORIGINS` on the backend
- configuring Supabase redirect URLs for email confirmation and password reset
- configuring the deployed frontend origin in Supabase auth settings

The frontend live demo is available at:

- https://site2chat.vercel.app

Do not assume unsupported deployment, runtime, or scaling claims beyond the repository code and the public demo URL.

---

## Contributing

This repository does not currently include a root `CONTRIBUTING.md` file or a code of conduct file. Standard GitHub contribution flow is appropriate:

1. Create a branch for your change.
2. Keep changes focused and easy to review.
3. Open a pull request for review.

No guarantee is made that all contributions will be accepted. Review and maintainer approval remain part of the project process.

---

## License

This project is licensed under the MIT License, as shown in the root `LICENSE` file.

The copyright notice in that file is:

> Copyright (c) 2026 Rohit

