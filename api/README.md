# StratIQ API Stub

This FastAPI service mirrors the frontend-facing contracts used by the Next.js prototype.

It is intentionally thin in Phase 1:

- stable endpoints for later real integration
- mock-friendly payloads
- no model or data warehouse coupling yet

Run locally once dependencies are installed:

```bash
cd /Users/khushi/Desktop/StratIQ/api
uvicorn app.main:app --reload
```
