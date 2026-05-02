"""
StratIQ — Embed document chunks using OpenAI
Run this AFTER seed_all.py and after setting your OPENAI_API_KEY.

Usage:
  OPENAI_API_KEY=sk-... python db/seeds/embed_documents.py
"""

import os
import psycopg
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DATABASE_URL = os.getenv("SEED_DATABASE_URL", "postgresql://stratiq:stratiq@localhost:5432/stratiq")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def embed(text: str) -> list[float]:
    response = client.embeddings.create(model="text-embedding-3-small", input=text)
    return response.data[0].embedding

def main():
    conn = psycopg.connect(DATABASE_URL)
    cur  = conn.cursor()

    cur.execute("SELECT id, content FROM document_chunks WHERE embedding IS NULL")
    rows = cur.fetchall()
    print(f"Embedding {len(rows)} document chunks...")

    for i, (chunk_id, content) in enumerate(rows):
        vec = embed(content)
        cur.execute("UPDATE document_chunks SET embedding = %s WHERE id = %s", (vec, chunk_id))
        if (i + 1) % 10 == 0:
            conn.commit()
            print(f"  {i+1}/{len(rows)} embedded")

    conn.commit()
    cur.close()
    conn.close()
    print("✅ All embeddings stored.")

if __name__ == "__main__":
    main()
