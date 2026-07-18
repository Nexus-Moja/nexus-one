# NEXUS ONE Build 008 — AI Operations

## Added
- `public/nexus-ai.js`: explainable local decision-support engine.
- `public/ai-operations.html`: AI operations command center.
- Demand forecasting by operating daypart.
- Transparent trip delay-risk scoring with contributing factors.
- Dispatch recommendations based on capacity, assignment status and risk.
- Pricing exception detection using the current integrated trip portfolio.
- AI risk column and recommendation panels in Dispatch.
- AI Operations entry point in Executive Intelligence.

## Safety and production boundary
The Build 008 engine is deterministic browser-side decision support. It does not make clinical decisions, automatically dispatch vehicles, or replace trained staff. Production deployment should use authenticated server data, validated historical models, monitored accuracy, role permissions and human approval workflows.
