import type {
  ActionResult,
  ApprovalRequest,
  ArbiterDecision,
  AuditRecord,
  CustomerDetail,
  CustomerRiskSummary,
  DashboardInsights,
  EvidenceItem,
  PlannerOutput,
  RiskReview,
  WorkflowResponse,
  WorkflowRunSummary,
} from "@shared/contracts";

const sharedEvidence: EvidenceItem[] = [
  {
    id: "ev-usage-001",
    sourceType: "usage_metric",
    sourceId: "um-001",
    title: "Premium workflow adoption dropped 29%",
    snippet:
      "Northstar Fiber's premium automation module usage has declined for three consecutive reporting windows.",
    relevance: "Supports the analyst view that product depth is eroding before renewal.",
  },
  {
    id: "ev-ticket-001",
    sourceType: "support_ticket",
    sourceId: "st-001",
    title: "Executive-visible reliability escalation remains open",
    snippet:
      "Two unresolved P1 tickets mention confidence loss in service reliability and delayed remediation communication.",
    relevance: "Provides unstructured evidence behind churn risk and sponsor frustration.",
  },
  {
    id: "ev-renewal-001",
    sourceType: "renewal_signal",
    sourceId: "rn-001",
    title: "Renewal window closes in 17 days",
    snippet:
      "The commercial decision window is active and no sponsor-level recovery meeting has been logged yet.",
    relevance: "Raises urgency for a bounded, approval-ready retention action.",
  },
];

const plannerOutput: PlannerOutput = {
  agent: "Planner Agent",
  summary:
    "Two intervention paths are viable: a sponsor-led recovery motion or a commercial save package tied to adoption reset milestones.",
  strategies: [
    {
      id: "strategy-001",
      title: "Sponsor recovery motion",
      description:
        "Launch executive outreach with a named sponsor call, reliability roadmap briefing, and recovery owner alignment within 24 hours.",
      owner: "Customer Success Director",
      expectedImpact: "Rebuild trust and improve renewal confidence before procurement review.",
      deliveryWindow: "24 hours",
    },
    {
      id: "strategy-002",
      title: "Commercial save package",
      description:
        "Offer a structured retention package tied to onboarding reset, usage recovery milestones, and a service governance checkpoint.",
      owner: "RevOps Director",
      expectedImpact: "Protect near-term revenue while reducing adoption friction in the next 30 days.",
      deliveryWindow: "48 hours",
    },
  ],
};

const riskReview: RiskReview = {
  agent: "Risk/Compliance Agent",
  verdict: "caution",
  critique:
    "A pure discount-only response is weak because it does not address reliability trust. The chosen plan should include an accountable sponsor-level recovery step and a measurable follow-up checkpoint.",
  concerns: [
    "Commercial intervention without trust recovery may only delay churn.",
    "Operational ownership needs to be explicit before approval is granted.",
  ],
  requiredChecks: [
    "Confirm executive sponsor availability within 24 hours.",
    "Tie any save package to a documented remediation milestone.",
  ],
  quantitative_score: 82,
  qualitative_score: 65,
};

const arbiterDecision: ArbiterDecision = {
  agent: "Arbiter Agent",
  selectedStrategyId: "strategy-001",
  finalRecommendation:
    "Approve a sponsor-led recovery motion immediately, with a commercial save package held as a secondary lever if the sponsor meeting surfaces pricing risk.",
  rationale:
    "The strongest evidence points to trust erosion plus timing pressure, so the most defensible first move is executive outreach paired with explicit recovery ownership.",
  confidenceLabel: "High confidence",
};

const workflowRunSummary: WorkflowRunSummary = {
  id: "run-001",
  workflowType: "customer_churn",
  submittedAt: "2026-04-30T10:30:00Z",
  status: "completed",
  summary:
    "Northstar Fiber shows converging churn risk across usage decline, unresolved escalations, and renewal timing pressure.",
  finalRecommendation: arbiterDecision.finalRecommendation,
};

export const approvals: ApprovalRequest[] = [
  {
    id: "approval-001",
    runId: "run-001",
    customerId: "c-102",
    customerName: "Northstar Fiber",
    actionTitle: "Approve sponsor recovery motion and hold commercial save lever",
    owner: "Customer Success Director",
    priority: "Urgent",
    status: "Pending",
    rationale:
      "This route addresses trust risk first while preserving commercial flexibility if pricing resistance emerges.",
    estimatedImpact: "Protects up to $372k ARR exposure in the current renewal cycle.",
    dueLabel: "Review within 24 hours",
    createdAt: "2026-04-30T10:35:00Z",
  },
  {
    id: "approval-002",
    runId: "run-002",
    customerId: "c-204",
    customerName: "Aster Retail Group",
    actionTitle: "Approve adoption reset and sponsor mapping package",
    owner: "RevOps Director",
    priority: "High",
    status: "Ready",
    rationale:
      "Usage contraction appears recoverable if account ownership and adoption blockers are addressed before renewal planning begins.",
    estimatedImpact: "Improves expansion likelihood and reduces churn probability for a $1M account segment.",
    dueLabel: "Review this week",
    createdAt: "2026-04-29T16:10:00Z",
  },
];

export const actionHistory: ActionResult[] = [
  {
    id: "action-001",
    approvalId: "approval-002",
    status: "approved",
    summary: "Approval recorded and routed to the retention operating queue.",
    auditNote: "Owner routing confirmed for RevOps Director and Customer Success Director.",
    executedAt: "2026-04-29T16:20:00Z",
  },
];

export const auditRecords: AuditRecord[] = [
  {
    id: "audit-001",
    runId: "run-001",
    eventType: "workflow_run",
    actor: "Comms Agent",
    message: "Workflow package created for Northstar Fiber with approval-ready recommendation.",
    createdAt: "2026-04-30T10:35:00Z",
  },
  {
    id: "audit-002",
    approvalId: "approval-002",
    eventType: "approval",
    actor: "Customer Success Director",
    message: "Aster Retail Group retention package moved to Approved status.",
    createdAt: "2026-04-29T16:20:00Z",
  },
  {
    id: "audit-003",
    approvalId: "approval-002",
    eventType: "action",
    actor: "Execution Layer",
    message: "Retention operating queue entry created and action owner notified.",
    createdAt: "2026-04-29T16:25:00Z",
  },
];

export const dashboardInsights: DashboardInsights = {
  portfolioAtRisk: 19,
  renewalWindow: 6,
  executiveConfidence: "78%",
  actionQueue: approvals.filter((approval) => approval.status !== "Executed").length,
  criticalRevenue: 726000,
  riskMix: [
    { label: "Critical", count: 4, accent: "#c45c56" },
    { label: "High", count: 8, accent: "#c9852a" },
    { label: "Moderate", count: 5, accent: "#1f6d73" },
    { label: "Low", count: 2, accent: "#3d8a62" },
  ],
  highlights: [
    "Northstar Fiber has the highest converging churn pressure across adoption decline, escalations, and renewal timing.",
    "Six accounts enter a live renewal window this week and four already need approval-ready intervention packages.",
    "Support escalation evidence is the strongest unstructured signal correlated with urgent retention action.",
  ],
};

export const customers: CustomerRiskSummary[] = [
  {
    id: "c-102",
    name: "Northstar Fiber",
    segment: "Enterprise Telecom",
    plan: "Strategic 360",
    monthlyRevenue: 124000,
    riskLevel: "Critical",
    churnProbability: 0.82,
    healthScore: 38,
    renewalDate: "2026-05-17",
    accountOwner: "Khushi Patel",
    ticketLoad: "12 open, 3 escalated",
    lastActivity: "Usage down 29% in the latest weekly window",
    topDrivers: [
      "Premium workflow adoption is down 29%",
      "Two executive-visible P1 escalations remain unresolved",
      "Renewal decision window closes in 17 days",
    ],
    recommendedAction: arbiterDecision.finalRecommendation,
  },
  {
    id: "c-204",
    name: "Aster Retail Group",
    segment: "Retail Analytics",
    plan: "Growth Ops",
    monthlyRevenue: 86000,
    riskLevel: "High",
    churnProbability: 0.67,
    healthScore: 51,
    renewalDate: "2026-06-02",
    accountOwner: "Srishti Bankar",
    ticketLoad: "5 open, 1 escalated",
    lastActivity: "Stakeholder inactivity across 11 days",
    topDrivers: [
      "Reduced weekly active usage across premium users",
      "Executive sponsor changed in the last month",
      "Competitor trial mentioned in support notes",
    ],
    recommendedAction: "Approve adoption reset and sponsor mapping package.",
  },
  {
    id: "c-319",
    name: "Lattice Health",
    segment: "Healthcare Platforms",
    plan: "Compliance Plus",
    monthlyRevenue: 93000,
    riskLevel: "Moderate",
    churnProbability: 0.43,
    healthScore: 66,
    renewalDate: "2026-06-14",
    accountOwner: "Kashish Desai",
    ticketLoad: "3 open, 0 escalated",
    lastActivity: "Stable logins with weak feature depth",
    topDrivers: [
      "Limited workflow expansion after onboarding",
      "Champion engagement is isolated to one team",
      "Reporting roadmap dependency still unresolved",
    ],
    recommendedAction: "Recommend targeted enablement sprint with milestone review.",
  },
  {
    id: "c-411",
    name: "BlueHarbor Logistics",
    segment: "Supply Chain",
    plan: "Forecast Pro",
    monthlyRevenue: 71000,
    riskLevel: "High",
    churnProbability: 0.62,
    healthScore: 54,
    renewalDate: "2026-05-29",
    accountOwner: "Khushi Patel",
    ticketLoad: "7 open, 2 escalated",
    lastActivity: "Weekly active users down 18%",
    topDrivers: [
      "Usage decline in dispatch analytics",
      "Escalations tied to export latency",
      "Procurement review begins next week",
    ],
    recommendedAction: "Approve executive outreach and service remediation briefing.",
  },
  {
    id: "c-522",
    name: "Crestline Energy",
    segment: "Utilities",
    plan: "Field Ops Core",
    monthlyRevenue: 64000,
    riskLevel: "Moderate",
    churnProbability: 0.41,
    healthScore: 69,
    renewalDate: "2026-06-21",
    accountOwner: "Srishti Bankar",
    ticketLoad: "2 open, 0 escalated",
    lastActivity: "Healthy logins with low mobile feature expansion",
    topDrivers: [
      "Field users are not using the new mobile workflow",
      "Expansion champion has not attended enablement sessions",
      "Cost review flagged unused premium seats",
    ],
    recommendedAction: "Target a mobile adoption reset before procurement review.",
  },
  {
    id: "c-633",
    name: "Orion Capital Services",
    segment: "Financial Services",
    plan: "Risk Command",
    monthlyRevenue: 118000,
    riskLevel: "Critical",
    churnProbability: 0.79,
    healthScore: 42,
    renewalDate: "2026-05-12",
    accountOwner: "Kashish Desai",
    ticketLoad: "9 open, 2 escalated",
    lastActivity: "Decision-maker engagement dropped sharply",
    topDrivers: [
      "Risk dashboard adoption is down across leadership seats",
      "Escalations reference trust concerns with delayed analytics refresh",
      "Renewal review starts in under two weeks",
    ],
    recommendedAction: "Escalate to executive outreach and remediation governance motion.",
  },
];

export const customerDetails: CustomerDetail[] = customers.map((customer) => ({
  ...customer,
  evidence: customer.id === "c-102" ? sharedEvidence : sharedEvidence.slice(0, 2),
  recentRuns:
    customer.id === "c-102"
      ? [workflowRunSummary]
      : [
          {
            id: `run-${customer.id}`,
            workflowType: "customer_churn",
            submittedAt: "2026-04-28T14:10:00Z",
            status: "completed",
            summary: `${customer.name} shows elevated churn pressure requiring operator review.`,
            finalRecommendation: customer.recommendedAction,
          },
        ],
  latestApproval:
    approvals.find((approval) => approval.customerId === customer.id) ?? null,
}));

export const workflowTemplate: WorkflowResponse = {
  requestId: "run-001",
  submittedAt: workflowRunSummary.submittedAt,
  workflowType: "customer_churn",
  requestSummary:
    "Why did churn risk increase for Northstar Fiber, and which retention action should leadership approve first?",
  status: "completed",
  targetEntity: {
    id: "c-102",
    name: "Northstar Fiber",
    segment: "Enterprise Telecom",
  },
  summary:
    "Northstar Fiber shows converging churn risk across usage decline, unresolved escalations, and renewal timing pressure. The most defensible near-term move is sponsor-led recovery, with commercial concessions held as a secondary lever.",
  evidence: sharedEvidence,
  plannerOutput,
  riskReview,
  arbiterDecision,
  approval: approvals[0],
  actionHistory,
  auditRecords,
};
