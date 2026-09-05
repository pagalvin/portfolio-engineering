# How to Use P-OS Agents

Use the agents in this workflow for a typical feature:

1. **`brainstorming`** *(optional)* — Explore the idea, problem, or possible approaches.
2. **`business-requirements`** — Turn the idea into a bounded specification with requirements, non-goals, and acceptance criteria.
3. **`adr-architect`** *(when needed)* — Capture architectural decisions, tradeoffs, and implementation constraints.
4. **`uxd`** — Define user flows, interaction states, responsive behavior, accessibility, and UI/API-facing workflow expectations.
5. **`implementation-planner`** — Convert the ready specification and UX artifacts into a dependency-ordered implementation plan.
6. **`governancegit worktree remove C:\src\portfolio-engineering\portfolio-engineering.worktrees\ai-integration-worktree-setup`** — Review the plan against the specification, ADRs, UX artifacts, agent ownership, and repository reality. Run this before the first implementation task.
7. **Implementation agents** — Execute plan tasks according to their dependencies:
   - **`database-design`** — Design and implement schema, migrations, stores, and persistence contracts.
   - **`backend-coding`** — Implement Fastify routes, validation, authorization, and server integrations.
   - **`frontend-coding`** — Implement React routes, components, client behavior, and accessible UI.
   - Database, backend, and frontend tasks may run in parallel when the plan allows and their files do not overlap.
8. **`debugging`** *(reactive)* — Investigate reported defects, failed validation, or unexpected behavior and record the resolution in the specification's debugging log.
9. **`next-step-dispatcher`** *(on demand)* — Read the active plan and report ready, blocked, or in-progress tasks. This agent does not perform implementation work.
10. **`closeout`** — Reconcile completed work, update canonical documentation and schema documentation, capture bounded technical debt, and archive fully completed plans.

## Important sequencing rules

- The business requirements specification must be **Ready for planning** before `implementation-planner` creates a plan.
- UXD is required for features with a user-facing UI.
- Implementation tasks follow the plan's `Depends on` fields, not the numeric task order.
- Coding agents should not invent product, architecture, UX, or persistence decisions.
- `governance` is a readiness gate after planning and before implementation.
- `debugging` is used only when an actual issue or failed verification needs investigation.
- `closeout` runs after the relevant implementation work is complete.

## Short version

**Brainstorm → Requirements → ADR (if needed) → UXD → Plan → Governance → Database/API/UI implementation → Debugging (if needed) → Closeout**
