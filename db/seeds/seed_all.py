"""
StratIQ — Synthetic Data Seeder (Customer Churn Domain)
Generates realistic enterprise customer data without needing real datasets.

Usage:
  pip install psycopg2-binary faker
  python db/seeds/seed_all.py
"""

import os
import json
import random
import psycopg
from datetime import date, timedelta, datetime
from uuid import uuid4
from faker import Faker

fake = Faker()
random.seed(42)
Faker.seed(42)

DATABASE_URL = os.getenv(
    "SEED_DATABASE_URL",
    "postgresql://stratiq:stratiq@localhost:5432/stratiq"
)

# ─── Configuration ────────────────────────────────────────────────────────────
NUM_CUSTOMERS = 60
MONTHS_OF_HISTORY = 12
TODAY = date.today()

INDUSTRIES = ["SaaS", "FinTech", "HealthTech", "E-commerce", "Manufacturing",
              "Logistics", "EdTech", "Retail", "Media", "Consulting"]
TIERS = ["enterprise", "mid-market", "smb"]
TIER_WEIGHTS = [0.2, 0.35, 0.45]
REGIONS = ["North America", "Europe", "APAC", "LATAM"]
PLANS = {
    "enterprise": ("enterprise", 5000, 25000),
    "mid-market": ("pro",        1000, 5000),
    "smb":        ("basic",      200,  1000),
}
FEATURES = ["dashboard", "api_access", "reporting", "integrations",
            "ai_insights", "exports", "webhooks", "sso"]

SUPPORT_TEMPLATES = [
    "Customer reported that {feature} is not working as expected after the latest update.",
    "User unable to access {feature} — getting a 403 error intermittently.",
    "Performance issues with {feature}: response times exceeding 10 seconds.",
    "Request to improve {feature} — current UX is confusing for new team members.",
    "Data export from {feature} is missing columns, causing downstream issues.",
    "Our team is considering switching to a competitor because {feature} lacks key functionality.",
    "Billing discrepancy noticed — charged for {feature} tier we didn't upgrade to.",
    "Integration between {feature} and our CRM broke after your API update.",
    "We've been waiting 3 weeks for the {feature} bug fix — escalating to management.",
    "Positive feedback: {feature} has significantly improved our team's workflow.",
    "NPS survey comment: 'Would love to see {feature} improved — it's the main reason we stay.'",
    "Low engagement with {feature} — our team hasn't adopted it despite onboarding.",
    "Competitor offered us a 40% discount — reconsidering our contract renewal.",
    "Executive at customer account raised concerns about ROI from the platform.",
    "Customer success call: very happy with {feature}, planning to expand seats.",
]

SIGNAL_TYPES = ["low_usage", "missed_renewal", "negative_sentiment",
                "escalation", "price_objection", "competitor_mention"]


def connect():
    return psycopg.connect(DATABASE_URL)


def seed_users(cur):
    print("  → Seeding users...")
    users = [
        (str(uuid4()), "admin@stratiq.io",   "Admin User",    "admin"),
        (str(uuid4()), "sarah@stratiq.io",   "Sarah Chen",    "approver"),
        (str(uuid4()), "mike@stratiq.io",    "Mike Torres",   "viewer"),
        (str(uuid4()), "priya@stratiq.io",   "Priya Nair",    "approver"),
    ]
    for u in users:
        cur.execute("""
            INSERT INTO users (id, email, full_name, role)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
        """, u)
    return [u[0] for u in users]


def seed_customers(cur):
    print("  → Seeding customers...")
    customers = []
    owners = ["Sarah Chen", "Mike Torres", "Priya Nair", "James Liu", "Anna Kowalski"]

    for _ in range(NUM_CUSTOMERS):
        tier = random.choices(TIERS, weights=TIER_WEIGHTS)[0]
        cid = str(uuid4())
        name = fake.company()
        industry = random.choice(INDUSTRIES)
        region = random.choice(REGIONS)
        owner = random.choice(owners)
        cur.execute("""
            INSERT INTO customers (id, name, industry, tier, region, account_owner)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (cid, name, industry, tier, region, owner))
        customers.append({"id": cid, "tier": tier, "name": name})

    return customers


def seed_subscriptions(cur, customers):
    print("  → Seeding subscriptions...")
    subs = []
    for c in customers:
        tier = c["tier"]
        plan_name, mrr_min, mrr_max = PLANS[tier]
        mrr = round(random.uniform(mrr_min, mrr_max), 2)
        start = TODAY - timedelta(days=random.randint(180, 730))
        end   = start + timedelta(days=random.randint(365, 730))

        # Churn risk distribution: 20% churned, 25% at_risk, 55% active
        r = random.random()
        if r < 0.20:
            status = "churned"
            renewal_prob = round(random.uniform(0, 15), 2)
        elif r < 0.45:
            status = "at_risk"
            renewal_prob = round(random.uniform(15, 55), 2)
        else:
            status = "active"
            renewal_prob = round(random.uniform(55, 98), 2)

        sid = str(uuid4())
        cur.execute("""
            INSERT INTO subscriptions
              (id, customer_id, plan, mrr, contract_start, contract_end,
               renewal_probability, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (sid, c["id"], plan_name, mrr, start, end, renewal_prob, status))
        subs.append({"id": sid, "customer_id": c["id"], "status": status})

    return subs


def seed_usage_metrics(cur, customers, subs_by_customer):
    print("  → Seeding usage metrics...")
    for c in customers:
        status = subs_by_customer.get(c["id"], "active")
        for month_offset in range(MONTHS_OF_HISTORY - 1, -1, -1):
            period_start = (TODAY.replace(day=1) - timedelta(days=30 * month_offset))
            period_end   = period_start + timedelta(days=29)

            # Simulate declining usage for at-risk/churned
            decay = 1.0
            if status == "at_risk":
                decay = max(0.3, 1.0 - (month_offset / MONTHS_OF_HISTORY) * 0.5)
            elif status == "churned":
                decay = max(0.05, 1.0 - (month_offset / MONTHS_OF_HISTORY) * 0.8)

            feature_usage = {f: int(random.randint(0, 50) * decay) for f in FEATURES}
            nps = round(random.gauss(
                6.5 if status == "active" else (4.0 if status == "at_risk" else 2.5),
                1.2
            ), 1)
            nps = max(0, min(10, nps))

            cur.execute("""
                INSERT INTO usage_metrics
                  (id, customer_id, period_start, period_end,
                   logins_count, feature_usage, api_calls, support_tickets, nps_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (customer_id, period_start) DO NOTHING
            """, (
                str(uuid4()), c["id"], period_start, period_end,
                int(random.randint(10, 200) * decay),
                json.dumps(feature_usage),
                int(random.randint(100, 5000) * decay),
                random.randint(0, 8) if status != "active" else random.randint(0, 2),
                nps
            ))


def seed_churn_signals(cur, customers, subs_by_customer):
    print("  → Seeding churn signals...")
    for c in customers:
        status = subs_by_customer.get(c["id"], "active")
        if status == "active" and random.random() > 0.15:
            continue  # Active customers rarely have signals

        num_signals = {
            "at_risk": random.randint(1, 3),
            "churned": random.randint(2, 5),
            "active":  1,
        }[status]

        for _ in range(num_signals):
            signal_type = random.choice(SIGNAL_TYPES)
            severity = {
                "churned":  random.choice(["high", "critical"]),
                "at_risk":  random.choice(["medium", "high"]),
                "active":   "low",
            }[status]
            days_ago = random.randint(7, 120)
            detected = datetime.now() - timedelta(days=days_ago)

            cur.execute("""
                INSERT INTO churn_signals
                  (id, customer_id, signal_type, severity, detected_at, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(uuid4()), c["id"], signal_type, severity,
                detected,
                f"Auto-detected: {signal_type.replace('_', ' ')} pattern observed in recent activity."
            ))


def seed_kpi_snapshots(cur, customers, subs):
    print("  → Seeding KPI snapshots...")
    for month_offset in range(MONTHS_OF_HISTORY - 1, -1, -1):
        snap_date = TODAY.replace(day=1) - timedelta(days=30 * month_offset)

        total = len(subs)
        churned = sum(1 for s in subs if s["status"] == "churned")
        at_risk = sum(1 for s in subs if s["status"] == "at_risk")
        churn_rate = round((churned / total) * 100 + random.uniform(-1, 1), 2)
        mrr_at_risk = round(sum(
            random.uniform(500, 8000) for s in subs if s["status"] in ("at_risk", "churned")
        ) / 1000, 2)  # in thousands
        nps_avg = round(random.gauss(5.8, 0.8), 2)

        kpis = [
            ("churn_rate",      max(0, churn_rate),   {"unit": "%"}),
            ("mrr_at_risk",     mrr_at_risk,           {"unit": "k_usd"}),
            ("nps_avg",         max(0, min(10, nps_avg)), {"unit": "score_0_10"}),
            ("at_risk_count",   at_risk,               {"unit": "customers"}),
            ("churned_count",   churned,               {"unit": "customers"}),
            ("retention_rate",  round(100 - churn_rate, 2), {"unit": "%"}),
        ]
        for name, value, meta in kpis:
            cur.execute("""
                INSERT INTO kpi_snapshots
                  (id, snapshot_date, workflow, metric_name, metric_value, metadata)
                VALUES (%s, %s, 'churn', %s, %s, %s)
                ON CONFLICT (snapshot_date, workflow, metric_name) DO NOTHING
            """, (str(uuid4()), snap_date, name, value, json.dumps(meta)))


def seed_document_chunks(cur, customers, subs_by_customer):
    """
    Seed text evidence WITHOUT calling OpenAI (embeddings skipped for basic setup).
    Run embed_documents.py separately once you have an OpenAI key.
    """
    print("  → Seeding document chunks (no embeddings — run embed_documents.py later)...")
    at_risk_customers = [c for c in customers if subs_by_customer.get(c["id"]) in ("at_risk", "churned")]

    for c in random.sample(at_risk_customers, min(len(at_risk_customers), 30)):
        num_docs = random.randint(2, 5)
        for i in range(num_docs):
            feature = random.choice(FEATURES)
            template = random.choice(SUPPORT_TEMPLATES)
            content = template.format(feature=feature)
            source_type = random.choice(["support_ticket", "review", "survey"])
            sentiment = "negative" if subs_by_customer.get(c["id"]) == "churned" else "mixed"

            cur.execute("""
                INSERT INTO document_chunks
                  (id, source_type, source_id, source_title, content, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(uuid4()),
                source_type,
                f"DOC-{random.randint(10000,99999)}",
                f"{source_type.replace('_',' ').title()} — {c['name']}",
                content,
                json.dumps({
                    "customer_id":   c["id"],
                    "customer_name": c["name"],
                    "date":          str(TODAY - timedelta(days=random.randint(1, 90))),
                    "sentiment":     sentiment,
                })
            ))


def main():
    print("🌱 StratIQ Synthetic Data Seeder")
    print("=" * 40)
    conn = connect()
    cur  = conn.cursor()

    try:
        seed_users(cur)
        customers = seed_customers(cur)
        subs = seed_subscriptions(cur, customers)

        # Build lookup: customer_id → subscription status
        subs_by_customer = {}
        cur.execute("SELECT customer_id, status FROM subscriptions")
        for row in cur.fetchall():
            subs_by_customer[str(row[0])] = row[1]

        seed_usage_metrics(cur, customers, subs_by_customer)
        seed_churn_signals(cur, customers, subs_by_customer)
        seed_kpi_snapshots(cur, customers, subs)
        seed_document_chunks(cur, customers, subs_by_customer)

        conn.commit()
        print("\n✅ Seeding complete!")
        print(f"   • {NUM_CUSTOMERS} customers")
        print(f"   • {NUM_CUSTOMERS} subscriptions")
        print(f"   • {NUM_CUSTOMERS * MONTHS_OF_HISTORY} usage metric records")
        print(f"   • {MONTHS_OF_HISTORY} months of KPI snapshots")
        print(f"   • Document chunks seeded (embeddings pending)")
        print("\n💡 Next: Run python db/seeds/embed_documents.py to add vector embeddings")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
