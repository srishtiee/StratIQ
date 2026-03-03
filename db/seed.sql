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
  ('c-633', 'Orion Capital Services', 'Financial Services', 'Risk Command', 118000, 'Critical', 0.79, 42, '2026-05-12', 'Kashish Desai'),
  ('c-744', 'Summit Grove Insurance', 'Insurance Operations', 'Claims Intelligence', 97000, 'High', 0.71, 49, '2026-05-24', 'Khushi Patel'),
  ('c-855', 'Meridian CloudWorks', 'Cloud Infrastructure', 'Reliability Command', 142000, 'High', 0.69, 47, '2026-06-05', 'Srishti Bankar'),
  ('c-966', 'Harborline Manufacturing', 'Industrial Manufacturing', 'Factory Ops Pro', 76000, 'High', 0.64, 52, '2026-06-09', 'Kashish Desai'),
  ('c-107', 'Atlas University Network', 'Higher Education', 'Engagement Core', 52000, 'Moderate', 0.36, 72, '2026-07-08', 'Khushi Patel'),
  ('c-218', 'Noble Foods Cooperative', 'Food Distribution', 'Supply Pulse', 68000, 'Moderate', 0.46, 63, '2026-06-28', 'Srishti Bankar'),
  ('c-429', 'Pioneer Civic Labs', 'Public Sector', 'Citizen Ops', 59000, 'Low', 0.18, 84, '2026-08-18', 'Kashish Desai'),
  ('c-530', 'Evergreen Robotics', 'Advanced Manufacturing', 'Automation Growth', 104000, 'Low', 0.16, 88, '2026-09-02', 'Khushi Patel'),
  ('c-641', 'Redwood Media Group', 'Media Analytics', 'Audience 360', 73000, 'Moderate', 0.39, 68, '2026-07-15', 'Srishti Bankar')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usage_metrics (id, customer_id, period_label, weekly_active_users, usage_change_pct, premium_feature_adoption_pct, login_volume) VALUES
  ('um-001', 'c-102', '2026-W17', 94, -29.0, 41.0, 1180),
  ('um-002', 'c-204', '2026-W17', 121, -16.0, 53.0, 1324),
  ('um-003', 'c-319', '2026-W17', 88, -4.0, 57.0, 991),
  ('um-004', 'c-411', '2026-W17', 102, -18.0, 44.0, 1104),
  ('um-005', 'c-522', '2026-W17', 109, -7.0, 49.0, 1275),
  ('um-006', 'c-633', '2026-W17', 97, -23.0, 38.0, 1058),
  ('um-007', 'c-744', '2026-W17', 114, -11.0, 61.0, 1490),
  ('um-008', 'c-855', '2026-W17', 82, -24.0, 35.0, 940),
  ('um-009', 'c-966', '2026-W17', 76, -19.0, 32.0, 865),
  ('um-010', 'c-107', '2026-W17', 132, 4.0, 64.0, 1522),
  ('um-011', 'c-218', '2026-W17', 101, -9.0, 46.0, 1096),
  ('um-012', 'c-429', '2026-W17', 141, 8.0, 72.0, 1718),
  ('um-013', 'c-530', '2026-W17', 156, 12.0, 79.0, 1884),
  ('um-014', 'c-641', '2026-W17', 118, -6.0, 55.0, 1261)
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_tickets (id, customer_id, title, severity, status, snippet) VALUES
  ('st-001', 'c-102', 'Reliability escalation on automation service', 'P1', 'Open', 'Two executive-visible incidents remain open and the customer has asked for sponsor-level communication.'),
  ('st-002', 'c-102', 'Premium module adoption blocked by workflow failure', 'P2', 'Open', 'Customer success notes show repeated friction in premium automation onboarding.'),
  ('st-009', 'c-102', 'Sponsor asks for remediation calendar', 'P1', 'Open', 'The executive sponsor requested a dated reliability plan before renewing the strategic automation workstream.'),
  ('st-010', 'c-102', 'Procurement paused expansion order', 'P2', 'Open', 'Procurement paused the expansion order until confidence in service reliability improves.'),
  ('st-003', 'c-204', 'Competitor trial referenced during QBR prep', 'P2', 'Open', 'Account team notes indicate competitor benchmarking is active during commercial review.'),
  ('st-004', 'c-204', 'Stakeholder transition slowed decision cadence', 'P3', 'Open', 'New sponsor has not attended the last two adoption checkpoints.'),
  ('st-011', 'c-204', 'Store analytics usage concentrated in one region', 'P3', 'Open', 'Only the west region is using the replenishment dashboards, leaving enterprise adoption below plan.'),
  ('st-012', 'c-204', 'Pricing committee requested competitor comparison', 'P2', 'Open', 'The buying committee asked for a side-by-side benchmark against a lower-priced analytics vendor.'),
  ('st-005', 'c-319', 'Reporting export dependency', 'P3', 'Open', 'Champion is waiting for roadmap confirmation before expanding the deployment.'),
  ('st-013', 'c-319', 'HIPAA workflow attestation requested', 'P2', 'Open', 'Security review asked for proof that upcoming reporting exports preserve auditability and access controls.'),
  ('st-014', 'c-319', 'Clinical operations expansion pending roadmap', 'P3', 'Open', 'Expansion to clinical operations is blocked until roadmap dates are confirmed for compliance reporting.'),
  ('st-006', 'c-411', 'Dispatch analytics latency concern', 'P2', 'Open', 'Operations leader flagged export latency during weekly review.'),
  ('st-015', 'c-411', 'Non-discount recovery path requested', 'P3', 'Open', 'The account owner asked whether workflow tuning and dispatch enablement could prevent a pricing concession.'),
  ('st-016', 'c-411', 'Carrier scorecards delayed', 'P2', 'Open', 'Carrier scorecards are arriving one day late, weakening confidence in operational planning.'),
  ('st-007', 'c-522', 'Mobile workflow training gap', 'P3', 'Open', 'Field teams have not adopted the latest mobile workflow update.'),
  ('st-017', 'c-522', 'Regional managers missed training cohort', 'P3', 'Open', 'Two field regions missed the latest mobile workflow training and are still using manual workarounds.'),
  ('st-018', 'c-522', 'Field adoption champion reassigned', 'P3', 'Closed', 'The original enablement champion moved teams, leaving adoption ownership unclear for the next rollout.'),
  ('st-008', 'c-633', 'Analytics refresh delay caused trust concern', 'P1', 'Open', 'Leadership questioned dashboard timeliness during renewal planning.'),
  ('st-019', 'c-633', 'Risk model freshness questioned by audit team', 'P1', 'Open', 'Internal audit flagged that stale risk scores could undermine board reporting confidence.'),
  ('st-020', 'c-633', 'Compliance committee requested evidence trail', 'P2', 'Open', 'The compliance committee asked for stronger evidence lineage before expanding executive analytics access.'),
  ('st-021', 'c-744', 'Claims director sponsor transition', 'P2', 'Open', 'The claims director sponsoring the rollout left the company, and the replacement has not accepted the success plan.'),
  ('st-022', 'c-744', 'Renewal committee asked for business case refresh', 'P3', 'Open', 'Finance requested a refreshed retention value case after sponsor turnover slowed the claims analytics rollout.'),
  ('st-023', 'c-744', 'Regional adoption uneven after reorg', 'P3', 'Open', 'Three claims regions continue to use legacy dashboards after the operating model reorganization.'),
  ('st-024', 'c-855', 'Reliability dashboard misses infrastructure events', 'P1', 'Open', 'The infrastructure team reported that incident health dashboards missed two high-severity events.'),
  ('st-025', 'c-855', 'Engineering leader requests trust review', 'P2', 'Open', 'The engineering sponsor asked for a reliability trust review before expanding platform usage.'),
  ('st-026', 'c-855', 'On-call analytics workflow underused', 'P3', 'Open', 'On-call managers still export incident summaries manually instead of using premium workflow automation.'),
  ('st-027', 'c-966', 'Factory onboarding stalled after pilot', 'P2', 'Open', 'Three plants completed pilot training but never moved supervisors into the live workflow.'),
  ('st-028', 'c-966', 'Implementation owner changed twice', 'P2', 'Open', 'The implementation owner changed twice in six weeks, leaving factory rollout milestones unclear.'),
  ('st-029', 'c-966', 'Operators cite training gap', 'P3', 'Open', 'Line supervisors say the current training path does not fit shift handoff routines.'),
  ('st-030', 'c-107', 'Student engagement reporting stable', 'P4', 'Closed', 'The university analytics office confirmed weekly reporting is stable and expansion planning is on track.'),
  ('st-031', 'c-218', 'Cold-chain exception workflow lightly adopted', 'P3', 'Open', 'Cold-chain managers are using alerts but have not adopted the premium exception workflow.'),
  ('st-032', 'c-218', 'Distributor margin pressure discussed', 'P3', 'Open', 'Finance mentioned margin pressure but has not requested pricing concessions.'),
  ('st-033', 'c-429', 'Quarterly service review completed', 'P4', 'Closed', 'The civic analytics team completed quarterly review with no material blockers.'),
  ('st-034', 'c-530', 'Automation expansion approved', 'P4', 'Closed', 'The robotics team approved expansion to two additional manufacturing lines after strong adoption.'),
  ('st-035', 'c-641', 'Campaign attribution roadmap requested', 'P3', 'Open', 'Marketing operations wants clearer roadmap dates before expanding audience analytics usage.')
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
  ('audit-001', 'run-002', 'approval-002', 'workflow_run', 'StratIQ', 'Aster Retail Group package created and surfaced for review.', '2026-04-29T16:12:00+00:00'),
  ('audit-002', NULL, 'approval-002', 'approval', 'Customer Success Director', 'Aster Retail Group package moved to Approved status.', '2026-04-29T16:20:00+00:00')
ON CONFLICT (id) DO NOTHING;
