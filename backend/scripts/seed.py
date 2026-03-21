"""
Seed script — inserts realistic demo data and runs initial AI scoring.

Usage (from backend/):
    python scripts/seed.py

Creates:
  - 1 org (Acme Corp) + 1 admin user
  - compensation_bands for common roles
  - 20 employees across 5 departments with compensation
  - 10 customers (Enterprise/Mid-Market/SMB) with churn signals
  - KPIs for dashboard
  - Runs AI scoring pass → populates latest_* columns + ai_entity_reasoning
"""

import os
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

# Load .env before importing app modules
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Helpers ──────────────────────────────────────────────────────────────────

def uid() -> str:
    return str(uuid.uuid4())

def d(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()

def future(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


# ── Org & User ───────────────────────────────────────────────────────────────

def seed_org_and_user():
    print("Seeding org and user...")

    org = sb.table("orgs").insert({"name": "Acme Corp"}).execute().data[0]
    org_id = org["id"]
    print(f"  Org: {org_id}")

    # Create a real auth user via admin API so the FK to auth.users is satisfied
    SEED_EMAIL = "srishti.bankar@acme.com"
    SEED_PASSWORD = "StratIQ2026!"

    # Check if auth user already exists
    existing = sb.auth.admin.list_users()
    existing_user = next((u for u in existing if u.email == SEED_EMAIL), None)

    if existing_user:
        user_id = str(existing_user.id)
        print(f"  Auth user already exists: {user_id}")
    else:
        auth_user = sb.auth.admin.create_user({
            "email": SEED_EMAIL,
            "password": SEED_PASSWORD,
            "email_confirm": True,
        })
        user_id = str(auth_user.user.id)
        print(f"  Auth user created: {user_id}")

    sb.table("user_profiles").upsert({
        "id": user_id,
        "org_id": org_id,
        "name": "Srishti Bankar",
        "role": "admin",
    }).execute()
    print(f"  User profile: {user_id}")
    print(f"  Login: {SEED_EMAIL} / {SEED_PASSWORD}")

    return org_id, user_id


# ── Compensation Bands ────────────────────────────────────────────────────────

BANDS = [
    ("Software Engineer", "IC3", "San Francisco", 150000, 175000, 200000),
    ("Software Engineer", "IC4", "San Francisco", 185000, 215000, 245000),
    ("Software Engineer", "IC5", "San Francisco", 230000, 270000, 310000),
    ("Software Engineer", "IC3", "Remote",        125000, 145000, 165000),
    ("Software Engineer", "IC4", "Remote",        155000, 180000, 205000),
    ("Product Manager",   "IC4", "San Francisco", 175000, 200000, 230000),
    ("Product Manager",   "IC5", "San Francisco", 215000, 250000, 285000),
    ("Sales",             "IC3", "New York",      100000, 120000, 145000),
    ("Sales",             "IC4", "New York",      130000, 155000, 180000),
    ("Marketing",         "IC3", "Remote",         95000, 115000, 135000),
    ("Customer Success",  "IC3", "Remote",         90000, 108000, 126000),
    ("Customer Success",  "IC4", "Remote",        115000, 138000, 162000),
    ("Finance",           "IC4", "New York",      130000, 155000, 180000),
]

def seed_compensation_bands(org_id: str):
    print("Seeding compensation bands...")
    rows = [
        {
            "org_id": org_id,
            "role": role, "level": level, "location": loc,
            "market_min": mn, "market_mid": mid, "market_max": mx,
            "source": "Levels.fyi Q1 2026",
            "effective_date": "2026-01-01",
        }
        for role, level, loc, mn, mid, mx in BANDS
    ]
    sb.table("compensation_bands").upsert(rows, on_conflict="org_id,role,level,location").execute()
    print(f"  {len(rows)} bands inserted")


# ── Employees ─────────────────────────────────────────────────────────────────

EMPLOYEES = [
    # (name, email, dept, role, level, location, hire_days_ago, salary, manager_idx)
    # Engineering — 7 employees
    ("Jordan Blake",    "jordan.blake@acme.com",    "Engineering", "Software Engineer", "IC5", "San Francisco", 1460, 245000, None),
    ("Priya Sharma",    "priya.sharma@acme.com",    "Engineering", "Software Engineer", "IC4", "San Francisco", 730,  165000, 0),
    ("Marcus Chen",     "marcus.chen@acme.com",     "Engineering", "Software Engineer", "IC4", "Remote",        548,  142000, 0),
    ("Sofia Reyes",     "sofia.reyes@acme.com",     "Engineering", "Software Engineer", "IC3", "Remote",        365,  128000, 0),
    ("Tyler Wu",        "tyler.wu@acme.com",        "Engineering", "Software Engineer", "IC3", "San Francisco", 548,  148000, 0),
    ("Aisha Johnson",   "aisha.johnson@acme.com",   "Engineering", "Software Engineer", "IC4", "Remote",        912,  158000, 0),
    ("Dev Patel",       "dev.patel@acme.com",       "Engineering", "Software Engineer", "IC3", "Remote",        180,  118000, 0),
    # Product — 3 employees
    ("Rachel Kim",      "rachel.kim@acme.com",      "Product",     "Product Manager",   "IC5", "San Francisco", 1095, 235000, None),
    ("Noah Williams",   "noah.williams@acme.com",   "Product",     "Product Manager",   "IC4", "San Francisco", 730,  178000, 7),
    ("Fatima Hassan",   "fatima.hassan@acme.com",   "Product",     "Product Manager",   "IC4", "San Francisco", 365,  182000, 7),
    # Sales — 4 employees
    ("Carlos Mendez",   "carlos.mendez@acme.com",   "Sales",       "Sales",             "IC4", "New York",      912,  140000, None),
    ("Nina Kovacs",     "nina.kovacs@acme.com",     "Sales",       "Sales",             "IC3", "New York",      548,  105000, 10),
    ("James Park",      "james.park@acme.com",      "Sales",       "Sales",             "IC3", "New York",      365,  112000, 10),
    ("Leila Nouri",     "leila.nouri@acme.com",     "Sales",       "Sales",             "IC4", "New York",      730,  138000, 10),
    # Customer Success — 3 employees
    ("Sam Torres",      "sam.torres@acme.com",      "Customer Success", "Customer Success", "IC4", "Remote", 548,  112000, None),
    ("Maya Singh",      "maya.singh@acme.com",      "Customer Success", "Customer Success", "IC3", "Remote", 365,   88000, 14),
    ("Chris Lee",       "chris.lee@acme.com",       "Customer Success", "Customer Success", "IC3", "Remote", 730,   98000, 14),
    # Marketing — 2 employees
    ("Zoe Davis",       "zoe.davis@acme.com",       "Marketing",   "Marketing",         "IC3", "Remote",        730,   99000, None),
    ("Omar Farouk",     "omar.farouk@acme.com",     "Marketing",   "Marketing",         "IC3", "Remote",        548,   92000, 17),
    # Finance — 1 employee
    ("Hannah Brooks",   "hannah.brooks@acme.com",   "Finance",     "Finance",           "IC4", "New York",      1095, 148000, None),
]

def seed_employees(org_id: str) -> list[str]:
    print("Seeding employees...")
    employee_ids = []
    for i, (name, email, dept, role, level, location, hire_days, salary, mgr_idx) in enumerate(EMPLOYEES):
        row = sb.table("employees").upsert({
            "org_id": org_id,
            "name": name,
            "email": email,
            "department": dept,
            "role": role,
            "level": level,
            "location": location,
            "hire_date": d(hire_days),
            "status": "active",
        }, on_conflict="org_id,email").execute().data[0]
        employee_ids.append(row["id"])

    # Set manager_ids in a second pass
    for i, (_, _, _, _, _, _, _, _, mgr_idx) in enumerate(EMPLOYEES):
        if mgr_idx is not None:
            sb.table("employees").update({"manager_id": employee_ids[mgr_idx]}).eq("id", employee_ids[i]).execute()

    print(f"  {len(employee_ids)} employees inserted")
    return employee_ids


def seed_compensation(org_id: str, employee_ids: list[str]):
    print("Seeding compensation...")
    for i, (_, _, _, role, level, location, _, salary, _) in enumerate(EMPLOYEES):
        emp_id = employee_ids[i]
        # Look up market band
        band = sb.table("compensation_bands").select("market_mid").eq("org_id", org_id).eq("role", role).eq("level", level).eq("location", location).maybe_single().execute()
        market_mid = band.data["market_mid"] if band.data else None
        compa_ratio = round(salary / market_mid, 4) if market_mid else None

        sb.table("compensation").upsert({
            "org_id": org_id,
            "employee_id": emp_id,
            "salary": salary,
            "bonus": round(salary * 0.10),
            "equity": round(salary * 0.15),
            "market_benchmark": market_mid,
            "compa_ratio": compa_ratio,
            "last_review_date": d(180),
            "currency": "USD",
            "effective_date": d(365),
        }, on_conflict="employee_id").execute()
    print(f"  {len(employee_ids)} compensation rows inserted")


# ── Customers ─────────────────────────────────────────────────────────────────

CUSTOMERS = [
    # (name, segment, tier, arr, renewal_days, contract_start_days, status)
    ("TechCorp Inc",        "Enterprise",  "Gold",   480000, 41,  730, "active"),
    ("Meridian Health",     "Enterprise",  "Gold",   320000, 38,  548, "active"),
    ("Nexus Analytics",     "Enterprise",  "Silver", 220000, 120, 365, "active"),
    ("BlueSky Retail",      "Mid-Market",  "Silver", 145000, 200, 548, "active"),
    ("Crestline Finance",   "Mid-Market",  "Silver", 128000, 85,  730, "active"),
    ("Orbis Logistics",     "Mid-Market",  "Bronze", 95000,  310, 365, "active"),
    ("Pinnacle Media",      "Mid-Market",  "Bronze", 88000,  150, 548, "active"),
    ("Starlight Schools",   "SMB",         "Bronze", 42000,  60,  365, "active"),
    ("Redwood Consulting",  "SMB",         "Bronze", 38000,  180, 730, "active"),
    ("Coastline Studios",   "SMB",         "Bronze", 28000,  240, 548, "active"),
]

def seed_customers(org_id: str, user_id: str) -> list[str]:
    print("Seeding customers...")
    customer_ids = []
    for name, segment, tier, arr, renewal_days, contract_days, status in CUSTOMERS:
        row = sb.table("customers").upsert({
            "org_id": org_id,
            "name": name,
            "segment": segment,
            "tier": tier,
            "arr": arr,
            "csm_id": user_id,
            "renewal_date": future(renewal_days),
            "contract_start": d(contract_days),
            "status": status,
        }, on_conflict="org_id,name").execute().data[0]
        customer_ids.append(row["id"])
    print(f"  {len(customer_ids)} customers inserted")
    return customer_ids


CHURN_SIGNALS = [
    # (customer_idx, signal_type, values_by_month)   — 6 months of data
    # TechCorp — heavy usage drop + low NPS
    (0, "usage",   [92, 88, 80, 62, 48, 38]),
    (0, "nps",     [42, 40, 35, 28, 22, 18]),
    (0, "support", [1,  2,  3,  5,  7,  9]),
    # Meridian — moderate decline + sponsor change signal
    (1, "usage",   [88, 85, 82, 78, 72, 68]),
    (1, "nps",     [55, 52, 50, 46, 44, 40]),
    (1, "support", [2,  2,  3,  4,  5,  6]),
    # Nexus — stable
    (2, "usage",   [76, 78, 77, 80, 79, 81]),
    (2, "nps",     [68, 70, 69, 72, 71, 73]),
    # BlueSky — slight decline
    (3, "usage",   [82, 80, 78, 75, 73, 71]),
    (3, "nps",     [60, 58, 57, 55, 54, 52]),
    # Crestline — moderate churn risk
    (4, "usage",   [70, 68, 65, 60, 55, 50]),
    (4, "nps",     [50, 48, 44, 40, 36, 32]),
    (4, "support", [1,  2,  3,  4,  6,  8]),
    # Orbis — healthy
    (5, "usage",   [88, 90, 89, 92, 91, 93]),
    (5, "nps",     [72, 74, 73, 75, 76, 77]),
    # Pinnacle — mild concern
    (6, "usage",   [65, 64, 62, 60, 58, 55]),
    (6, "nps",     [55, 53, 51, 50, 48, 46]),
    # Starlight — low usage, small account
    (7, "usage",   [55, 52, 50, 48, 46, 44]),
    (7, "nps",     [48, 46, 44, 42, 40, 38]),
    # Redwood — stable SMB
    (8, "usage",   [78, 79, 80, 78, 80, 81]),
    (8, "nps",     [65, 66, 67, 66, 68, 69]),
    # Coastline — healthy SMB
    (9, "usage",   [85, 84, 86, 85, 87, 88]),
    (9, "nps",     [70, 72, 71, 73, 72, 74]),
]

def seed_churn_signals(org_id: str, customer_ids: list[str]):
    print("Seeding churn signals...")
    rows = []
    for cust_idx, signal_type, values in CHURN_SIGNALS:
        for month_offset, val in enumerate(values):
            rows.append({
                "org_id": org_id,
                "customer_id": customer_ids[cust_idx],
                "signal_type": signal_type,
                "value": val,
                "recorded_at": d((5 - month_offset) * 30),
            })
    sb.table("churn_signals").insert(rows).execute()
    print(f"  {len(rows)} churn signal rows inserted")


# ── KPIs ──────────────────────────────────────────────────────────────────────

def seed_kpis(org_id: str):
    print("Seeding KPIs...")
    kpis = [
        ("Total ARR",               "finance",  4200000, 4100000, "USD",  "2026-Q2", "up"),
        ("Monthly Recurring Revenue","finance",  342000,  364000,  "USD",  "2026-Apr","down"),
        ("Headcount",               "hr",        87,      95,      "count","2026-Apr","down"),
        ("Attrition Rate",          "hr",        18,      12,      "%",    "2026-Apr","up"),
        ("Avg Employee Engagement",  "hr",        62,      75,      "score","2026-Apr","down"),
        ("Avg Customer Health Score","customer",  64,      70,      "score","2026-Apr","down"),
        ("ARR at Risk",             "customer",  820000,  400000,  "USD",  "2026-Apr","up"),
        ("Customer Count",          "customer",  10,      12,      "count","2026-Apr","flat"),
        ("Avg NPS",                 "customer",  48,      60,      "score","2026-Apr","down"),
        ("Support Tickets Open",    "ops",        34,      20,      "count","2026-Apr","up"),
    ]
    rows = [
        {
            "org_id": org_id,
            "name": name, "category": cat,
            "value": val, "target": target,
            "unit": unit, "period": period, "trend": trend,
        }
        for name, cat, val, target, unit, period, trend in kpis
    ]
    sb.table("kpis").insert(rows).execute()
    print(f"  {len(rows)} KPI rows inserted")


# ── Static AI Scores & Reasoning ─────────────────────────────────────────────
# Realistic scores + rationale seeded directly — no API calls needed.
# Ordered to match EMPLOYEES list indices 0-19.

EMPLOYEE_SCORES = [
    # (attrition, engagement, performance, rationale)
    (28, 78, 88, "Low attrition risk. Tenured IC5 at competitive compa-ratio of 0.91. Strong performance with high engagement."),
    (72, 52, 76, "Elevated risk. Compa-ratio of 0.77 is 23% below market for IC4 in SF. Engagement has declined over the last two quarters."),
    (58, 61, 72, "Moderate risk. Remote IC4 at 0.79 compa-ratio. Tenure under 2 years — common flight window for mid-level engineers."),
    (45, 68, 80, "Moderate risk. IC3 in remote role, salary near band floor. Promotion eligibility approaching — retention risk rises if no promotion decision is made."),
    (38, 74, 83, "Lower risk. SF-based IC3 with above-band salary. Strong performance score offsets tenure gap."),
    (81, 42, 69, "Critical risk. IC4 at 0.74 compa-ratio — among the lowest in Engineering. Engagement score of 42 signals active disengagement. Immediate compensation review recommended."),
    (65, 55, 71, "High risk. New hire (6 months), IC3 remote at 0.81 compa-ratio. Early-tenure attrition is elevated in this role cluster."),
    (22, 82, 91, "Low risk. Tenured IC5 PM with strong performance and engagement. Compensation aligned to market."),
    (41, 70, 79, "Moderate risk. IC4 PM at 0.89 compa-ratio. Solid engagement — risk driven mainly by tenure plateau at current level."),
    (35, 75, 84, "Lower risk. IC4 PM hired 1 year ago, engagement and performance both healthy. Watch compa-ratio if band shifts."),
    (30, 77, 85, "Low risk. Sales IC4 with strong performance. Tenure over 2.5 years suggests stability."),
    (62, 58, 68, "High risk. IC3 Sales in NYC at 0.88 compa-ratio. Below-average engagement and approaching 18-month tenure — a common attrition window in Sales."),
    (48, 65, 74, "Moderate risk. IC3 Sales hired 1 year ago. Performance on track but compensation is at the low end of the NYC band."),
    (33, 73, 80, "Lower risk. IC4 Sales at 0.89 compa-ratio with good engagement. Tenure suggests loyalty."),
    (44, 67, 76, "Moderate risk. CS IC4 at 0.81 compa-ratio. Remote roles in CS show higher attrition at this tenure band."),
    (77, 44, 65, "High risk. CS IC3 at 0.81 compa-ratio — well below market mid. Engagement score of 44 is concerning. Role and pay misalignment likely driving dissatisfaction."),
    (55, 60, 70, "Moderate risk. CS IC3 at 0.91 compa-ratio, but 2-year tenure in a role with limited progression signals stagnation risk."),
    (40, 71, 77, "Moderate risk. Marketing IC3 at 0.86 compa-ratio. Tenure of 2 years without level change is an emerging risk factor."),
    (52, 63, 72, "Moderate risk. Marketing IC3 hired 18 months ago at 0.80 compa-ratio. Compensation gap and mid-tenure combine for moderate flight risk."),
    (26, 80, 87, "Low risk. Finance IC4 with strong tenure, high engagement, and compensation near market mid. Stable profile."),
]

CUSTOMER_SCORES = [
    # (churn, health, revenue_at_risk, rationale)
    (88, 32, 480000, "Critical churn risk. Usage down 59% over 6 months, NPS at 18, and 9 open support tickets. Renewal in 41 days with no active save motion in place."),
    (74, 44, 320000, "High churn risk. Consistent usage and NPS decline over 6 months. Renewal in 38 days. Executive sponsor departure reported — new stakeholder relationship not yet established."),
    (22, 78, 0,      "Low risk. Usage and NPS both trending up. Healthy engagement with no escalation signals."),
    (38, 65, 0,      "Moderate risk. Mild usage decline over 3 months. NPS holding at 52. Monitor for acceleration."),
    (67, 48, 128000, "High risk. Usage down 29% since October. NPS dropped from 50 to 32. 8 support tickets in last 30 days. Renewal in 85 days."),
    (15, 84, 0,      "Low risk. Usage growing, NPS improving. Healthy account."),
    (42, 61, 0,      "Moderate risk. Usage softening gradually. NPS at 46 — below target. No critical signals yet but trend warrants a proactive check-in."),
    (55, 54, 42000,  "Moderate-high risk. Usage at 44 (below baseline), NPS at 38. Small account but renewal in 60 days without engagement improvement."),
    (20, 79, 0,      "Low risk. Stable usage and NPS. Long-tenured SMB account with consistent engagement."),
    (12, 86, 0,      "Low risk. Usage growing month-over-month. High NPS and no support escalations. Expansion candidate."),
]


def seed_static_scores(org_id: str, employee_ids: list[str], customer_ids: list[str]):
    print("\nSeeding static AI scores and reasoning...")

    # Create one analysis run for people, one for retention
    people_run = sb.table("ai_analysis_runs").insert({
        "org_id": org_id,
        "trigger_type": "initial",
        "trigger_id": uid(),
        "module": "people",
        "entities_analyzed": len(employee_ids),
        "model_used": "seed-static",
        "status": "complete",
    }).execute().data[0]

    retention_run = sb.table("ai_analysis_runs").insert({
        "org_id": org_id,
        "trigger_type": "initial",
        "trigger_id": uid(),
        "module": "retention",
        "entities_analyzed": len(customer_ids),
        "model_used": "seed-static",
        "status": "complete",
    }).execute().data[0]

    # Employee scores
    for i, emp_id in enumerate(employee_ids):
        attrition, engagement, performance, rationale = EMPLOYEE_SCORES[i]
        factors = {
            "comp_gap": round(max(0, (85 - (attrition * 0.5)) / 100), 2),
            "engagement_signals": round((100 - engagement) / 100, 2),
            "tenure_risk": round(attrition / 200, 2),
            "survey_signal": 0.0,
        }
        sb.table("employee_scores").insert({
            "org_id": org_id,
            "employee_id": emp_id,
            "attrition_risk_score": attrition,
            "engagement_score": engagement,
            "performance_score": performance,
            "trigger_type": "initial",
            "trigger_source_id": people_run["id"],
            "ai_rationale": rationale,
            "contributing_factors": factors,
        }).execute()

        sb.table("ai_entity_reasoning").insert({
            "org_id": org_id,
            "run_id": people_run["id"],
            "entity_type": "employee",
            "entity_id": emp_id,
            "reasoning": rationale,
            "score_before": 0,
            "score_after": attrition,
            "delta": attrition,
            "factors": factors,
        }).execute()

        sb.table("employees").update({
            "latest_attrition_risk_score": attrition,
            "latest_engagement_score": engagement,
            "latest_performance_score": performance,
            "scores_last_updated_at": "now()",
        }).eq("id", emp_id).execute()

    print(f"  {len(employee_ids)} employee scores inserted")

    # Customer scores
    for i, cust_id in enumerate(customer_ids):
        churn, health, rev_at_risk, rationale = CUSTOMER_SCORES[i]
        factors = {
            "usage_drop": round((100 - health) / 150, 2),
            "call_note_signal": 0.0,
            "renewal_urgency": round(churn / 200, 2),
            "nps_signal": round((100 - health) / 200, 2),
        }
        sb.table("customer_scores").insert({
            "org_id": org_id,
            "customer_id": cust_id,
            "churn_score": churn,
            "health_score": health,
            "revenue_at_risk": rev_at_risk,
            "trigger_type": "initial",
            "trigger_source_id": retention_run["id"],
            "ai_rationale": rationale,
            "contributing_factors": factors,
        }).execute()

        sb.table("ai_entity_reasoning").insert({
            "org_id": org_id,
            "run_id": retention_run["id"],
            "entity_type": "customer",
            "entity_id": cust_id,
            "reasoning": rationale,
            "score_before": 0,
            "score_after": churn,
            "delta": churn,
            "factors": factors,
        }).execute()

        sb.table("customers").update({
            "latest_churn_score": churn,
            "latest_health_score": health,
            "latest_revenue_at_risk": rev_at_risk,
            "scores_last_updated_at": "now()",
        }).eq("id", cust_id).execute()

    print(f"  {len(customer_ids)} customer scores inserted")
    print("  Static scoring complete.")


# ── KPI History ───────────────────────────────────────────────────────────────

KPI_HISTORY = {
    "Monthly Recurring Revenue": [310000, 325000, 340000, 350000, 365000, 358000, 348000, 342000],
    "Attrition Rate":            [9, 10, 11, 12, 14, 15, 17, 18],
    "Avg Customer Health Score": [72, 71, 70, 69, 68, 66, 65, 64],
    "ARR at Risk":               [520000, 540000, 600000, 620000, 710000, 765000, 795000, 820000],
}
KPI_MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]
KPI_DAYS_AGO = [210, 180, 150, 120, 90, 60, 30, 0]
KPI_META = {
    "Monthly Recurring Revenue": ("finance", "USD", 364000),
    "Attrition Rate":            ("hr",      "%",   12),
    "Avg Customer Health Score": ("customer","score",70),
    "ARR at Risk":               ("customer","USD",  400000),
}


def seed_kpi_history(org_id: str):
    print("Seeding KPI history...")
    rows = []
    for kpi_name, values in KPI_HISTORY.items():
        cat, unit, target = KPI_META[kpi_name]
        for i, val in enumerate(values):
            trend = "up" if i > 0 and val > values[i-1] else ("down" if i > 0 and val < values[i-1] else "flat")
            rows.append({
                "org_id": org_id,
                "name": kpi_name,
                "category": cat,
                "value": val,
                "target": target,
                "unit": unit,
                "period": KPI_MONTHS[i],
                "trend": trend,
                "recorded_at": (date.today() - timedelta(days=KPI_DAYS_AGO[i])).isoformat(),
            })
    sb.table("kpis").insert(rows).execute()
    print(f"  {len(rows)} KPI history rows inserted")


# ── Seed Actions ──────────────────────────────────────────────────────────────

SEED_ACTIONS = [
    # (type, title, description, status, source_module, days_ago_created)
    ("pdf_report",   "Q2 Attrition Review — Engineering & Product",
     "Generate a comprehensive PDF report analyzing attrition trends in Engineering and Product departments with risk analysis and recommendations.",
     "pending_approval", "people", 0),
    ("email_send",   "Intervention Email — TechCorp Inc. at Risk",
     "Send personalized intervention email to TechCorp executive team addressing usage decline and offering executive business review.",
     "pending_approval", "retention", 0),
    ("task",         "Compensation Review: 5 Underpaid High Performers",
     "Create a task for HR to review compensation adjustments for 5 employees with compa-ratio below 0.87 and performance scores above 85.",
     "pending_approval", "people", 1),
    ("csv_export",   "At-Risk Customer Export — Q2 2026",
     "Export CSV of all customers with churn score > 60 including ARR, renewal dates, health signals and CSM assignments.",
     "completed", "retention", 1),
    ("pdf_report",   "Executive KPI Briefing — April 2026",
     "Monthly executive briefing PDF with all KPI variances, risk register highlights, and recommended focus areas.",
     "completed", "dashboard", 1),
    ("meeting_ics",  "Emergency Retention Review — TechCorp & Meridian",
     "Schedule 60-minute emergency retention review with CSM team for TechCorp and Meridian Health accounts.",
     "completed", "retention", 2),
    ("email_send",   "Q2 Leadership Digest — All Hands Preview",
     "Weekly leadership digest email to all VPs summarizing KPI status, people risks, and customer health.",
     "completed", "dashboard", 2),
    ("task",         "Outreach to Meridian Health Executive Sponsor",
     "Personally reach out to new Meridian Health CTO and offer onboarding support.",
     "completed", "retention", 3),
    ("pdf_report",   "Compensation Benchmarking Analysis — IC4 & IC5",
     "PDF analysis comparing current IC4/IC5 salaries to market benchmarks with pay equity summary.",
     "failed", "people", 3),
    ("csv_export",   "High-Risk Employee Export",
     "Export CSV of all employees with attrition risk score above 60.",
     "draft", "people", 4),
    ("meeting_ics",  "Compensation Review Committee — Bi-Weekly",
     "Recurring calendar invite for compensation review committee to assess flagged employees.",
     "approved", "people", 5),
]


def seed_actions(org_id: str, user_id: str):
    print("Seeding actions...")
    now = datetime.now()
    rows = []
    for type_, title, desc, status, module, days_ago in SEED_ACTIONS:
        rows.append({
            "org_id": org_id,
            "user_id": user_id,
            "type": type_,
            "title": title,
            "description": desc,
            "status": status,
            "source_module": module,
            "created_at": (now - timedelta(days=days_ago, hours=1)).isoformat(),
        })
    sb.table("actions").insert(rows).execute()
    print(f"  {len(rows)} actions inserted")


# ── Seed Notifications ────────────────────────────────────────────────────────

SEED_NOTIFICATIONS = [
    # (type, message, hours_ago)
    ("scores_updated",          "5 Engineering employees re-scored: Aisha Johnson now at 81 (Critical), Marcus Chen at 72 (High Risk). Compensation gap is the primary driver.", 2),
    ("action_pending_approval", "Action pending approval: Intervention Email — TechCorp Inc. ($480K ARR, renewal in 41 days)", 3),
    ("scores_updated",          "TechCorp Inc. churn score updated to 88 (Critical). Usage down 59% in 6 months. Renewal in 41 days.", 4),
    ("action_pending_approval", "Action pending approval: Q2 Attrition Review PDF — Engineering & Product", 5),
    ("scores_updated",          "Crestline Finance churn score updated to 67 (High Risk). Renewal in 85 days.", 28),
    ("action_completed",        "Action completed: Emergency Retention Review calendar invite sent to 3 attendees.", 48),
    ("upload_complete",         "Upload complete: churn_signals.csv — 138 rows processed successfully.", 72),
]


def seed_notifications(org_id: str, user_id: str):
    print("Seeding notifications...")
    now = datetime.now()
    rows = []
    for type_, message, hours_ago in SEED_NOTIFICATIONS:
        rows.append({
            "org_id": org_id,
            "user_id": user_id,
            "type": type_,
            "message": message,
            "read": False,
            "created_at": (now - timedelta(hours=hours_ago)).isoformat(),
        })
    sb.table("notifications").insert(rows).execute()
    print(f"  {len(rows)} notifications inserted")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== StratIQ seed script ===\n")

    org_id, user_id = seed_org_and_user()
    seed_compensation_bands(org_id)
    employee_ids = seed_employees(org_id)
    seed_compensation(org_id, employee_ids)
    customer_ids = seed_customers(org_id, user_id)
    seed_churn_signals(org_id, customer_ids)
    seed_kpis(org_id)
    seed_kpi_history(org_id)
    seed_static_scores(org_id, employee_ids, customer_ids)
    seed_actions(org_id, user_id)
    seed_notifications(org_id, user_id)

    print("\n=== Seed complete ===")
    print(f"\nAdd these to your frontend .env.local:")
    print(f"  NEXT_PUBLIC_ORG_ID={org_id}")
    print(f"  NEXT_PUBLIC_USER_ID={user_id}")


if __name__ == "__main__":
    main()


