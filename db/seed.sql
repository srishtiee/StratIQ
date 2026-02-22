INSERT INTO users (id, name, email, role) VALUES
  ('user-001', 'Khushi Patel', 'khushi@stratiq.local', 'CXO Product Lead'),
  ('user-002', 'Srishti Bankar', 'srishti@stratiq.local', 'Customer Success Lead'),
  ('user-003', 'Kashish Desai', 'kashish@stratiq.local', 'RevOps Director')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, name, segment, plan, monthly_revenue, risk_level, churn_probability, health_score, renewal_date, account_owner) VALUES
  ('c-102', 'Northstar Fiber', 'Enterprise Telecom', 'Strategic 360', 124000, 'Critical', 0.82, 38, '2026-05-17', 'Khushi Patel'),
  ('c-204', 'Aster Retail Group', 'Retail Analytics', 'Growth Ops', 86000, 'High', 0.67, 51, '2026-06-02', 'Srishti Bankar'),
  ('c-319', 'Lattice Health', 'Healthcare Platforms', 'Compliance Plus', 93000, 'Moderate', 0.43, 66, '2026-06-14', 'Kashish Desai'),
  ('c-411', 'BlueHarbor Logistics', 'Supply Chain', 'Forecast Pro', 71000, 'High', 0.62, 54, '2026-05-29', 'Khushi Patel'),
  ('c-522', 'Crestline Energy', 'Utilities', 'Field Ops Core', 64000, 'Moderate', 0.41, 69, '2026-06-21', 'Srishti Bankar'),
  ('c-633', 'Orion Capital Services', 'Financial Services', 'Risk Command', 118000, 'Critical', 0.79, 42, '2026-05-12', 'Kashish Desai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usage_metrics (id, customer_id, period_label, weekly_active_users, usage_change_pct, premium_feature_adoption_pct, login_volume) VALUES
  ('um-001', 'c-102', '2026-W17', 94, -29.0, 41.0, 1180),
  ('um-002', 'c-204', '2026-W17', 121, -16.0, 53.0, 1324),
  ('um-003', 'c-319', '2026-W17', 88, -4.0, 57.0, 991),
  ('um-004', 'c-411', '2026-W17', 102, -18.0, 44.0, 1104),
  ('um-005', 'c-522', '2026-W17', 109, -7.0, 49.0, 1275),
  ('um-006', 'c-633', '2026-W17', 97, -23.0, 38.0, 1058)
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_tickets (id, customer_id, title, severity, status, snippet) VALUES
  ('st-001', 'c-102', 'Reliability escalation on automation service', 'P1', 'Open', 'Two executive-visible incidents remain open and the customer has asked for sponsor-level communication.'),
  ('st-002', 'c-102', 'Premium module adoption blocked by workflow failure', 'P2', 'Open', 'Customer success notes show repeated friction in premium automation onboarding.'),
  ('st-003', 'c-204', 'Competitor trial referenced during QBR prep', 'P2', 'Open', 'Account team notes indicate competitor benchmarking is active during commercial review.'),
  ('st-004', 'c-204', 'Stakeholder transition slowed decision cadence', 'P3', 'Open', 'New sponsor has not attended the last two adoption checkpoints.'),
  ('st-005', 'c-319', 'Reporting export dependency', 'P3', 'Open', 'Champion is waiting for roadmap confirmation before expanding the deployment.'),
  ('st-006', 'c-411', 'Dispatch analytics latency concern', 'P2', 'Open', 'Operations leader flagged export latency during weekly review.'),
  ('st-007', 'c-522', 'Mobile workflow training gap', 'P3', 'Open', 'Field teams have not adopted the latest mobile workflow update.'),
  ('st-008', 'c-633', 'Analytics refresh delay caused trust concern', 'P1', 'Open', 'Leadership questioned dashboard timeliness during renewal planning.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflow_runs (id, customer_id, prompt, workflow_type, request_summary, summary, status, submitted_at) VALUES
  ('run-002', 'c-204', 'Assess retention risk for Aster Retail Group ahead of sponsor review.', 'customer_churn', 'Assess retention risk for Aster Retail Group ahead of sponsor review.', 'Aster Retail Group shows elevated churn risk driven by declining usage and sponsor transition.', 'approved', '2026-04-29T16:05:00+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO run_evidence (id, run_id, source_type, source_id, title, snippet, relevance) VALUES
  ('re-201', 'run-002', 'usage_metric', 'um-002', 'Weekly active usage contracted 16%', 'Usage contraction is concentrated in premium analytics cohorts.', 'Signals weaker product stickiness before renewal planning.'),
  ('re-202', 'run-002', 'support_ticket', 'st-003', 'Competitive pressure referenced in notes', 'Account team notes reference competitor benchmarking during the latest review cycle.', 'Raises urgency for an adoption and sponsor-alignment response.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO run_decisions (id, run_id, planner_summary, planner_options, risk_verdict, risk_critique, risk_concerns, risk_required_checks, arbiter_strategy_id, arbiter_final_recommendation, arbiter_rationale, arbiter_confidence_label) VALUES
  (
    'rd-002',
    'run-002',
    'Primary path is adoption reset with sponsor mapping and pricing held as a secondary support lever.',
    '[{"id":"strategy-201","title":"Adoption reset package","description":"Run targeted enablement and sponsor mapping before pricing discussion.","owner":"RevOps Director","expectedImpact":"Improve sponsor confidence and feature depth within 30 days.","deliveryWindow":"72 hours"}]'::jsonb,
    'pass',
    'No major compliance blockers. Ensure sponsor change risk is addressed before commercial negotiation.',
    '["Sponsor engagement is currently weak."]'::jsonb,
    '["Confirm sponsor attendance for enablement checkpoint."]'::jsonb,
    'strategy-201',
    'Approve the adoption reset and sponsor mapping package.',
    'This route addresses the root cause before pricing is used as the first lever.',
    'Moderate confidence'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO approvals (id, run_id, customer_id, action_title, owner, priority, status, rationale, estimated_impact, due_label, created_at) VALUES
  ('approval-002', 'run-002', 'c-204', 'Approve adoption reset and sponsor mapping package', 'RevOps Director', 'High', 'Approved', 'Usage recovery is still plausible if account ownership and adoption blockers are addressed quickly.', 'Improves expansion likelihood and reduces churn probability for a $1M account segment.', 'Review this week', '2026-04-29T16:10:00+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO actions (id, approval_id, status, summary, audit_note, executed_at) VALUES
  ('action-001', 'approval-002', 'approved', 'Approval recorded and routed to the retention operating queue.', 'Owner routing confirmed for RevOps Director and Customer Success Director.', '2026-04-29T16:20:00+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_records (id, run_id, approval_id, event_type, actor, message, created_at) VALUES
  ('audit-001', 'run-002', 'approval-002', 'workflow_run', 'Comms Agent', 'Aster Retail Group package created and surfaced for review.', '2026-04-29T16:12:00+00:00'),
  ('audit-002', NULL, 'approval-002', 'approval', 'Customer Success Director', 'Aster Retail Group package moved to Approved status.', '2026-04-29T16:20:00+00:00')
ON CONFLICT (id) DO NOTHING;
