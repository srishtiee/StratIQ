# StratIQ — AI Executive Decision-Support Platform

## Stack
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Backend:** FastAPI, Python 3.11+, Pydantic v2
- **Database:** PostgreSQL 15 + pgvector (local via Docker / production via Supabase)
- **AI:** Anthropic Claude (reasoning) + OpenAI embeddings (RAG)
- **Infra:** Docker, AWS ECS Fargate

## Quick Start (Local)

### 1. Clone & environment
```bash
git clone <repo>
cd stratiq
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start the database
```bash
docker compose -f docker/docker-compose.yml up db -d
```

### 3. Run migrations & seed
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Apply schema
psql postgresql://stratiq:stratiq@localhost:5432/stratiq -f ../db/migrations/001_initial_schema.sql

# Seed synthetic data
python ../db/seeds/seed_all.py
```

### 4. Start the backend
```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure
```
stratiq/
├── backend/          # FastAPI app
├── frontend/         # Next.js app
├── db/
│   ├── migrations/   # SQL schemas
│   └── seeds/        # Synthetic data generators
├── docker/           # Dockerfiles + compose
└── .env.example
```
