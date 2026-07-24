---
applyTo: "docs/ADRs/**/*.md"
---

# ADR authoring rules

- ADRs in this repository live under `docs/ADRs`.
- Keep each ADR focused on one architectural decision or one tightly related decision set.
- Write for the audiences named in the ADR. Common audiences are architect agents, coding agents, testing agents, and humans.
- Keep decisions, rationale, tradeoffs, and follow-up work explicit.
- Prefer short sections and bullet lists over dense prose.
- Use relative links for repository references.

# Required structure

Follow the template in `docs/ADRs/0000-template.md`.

Each ADR should include:

1. Title
2. Status
3. Date
4. Audience
5. Context
6. Decision
7. Decision drivers
8. Options considered
9. Consequences
10. Audience-specific guidance
11. Open questions or follow-up work

# Coding-agent emphasis

When coding agents are part of the audience, include:

- implementation boundaries
- required behaviors
- interfaces or contracts affected
- data model or persistence implications
- migration or rollout notes
- explicit non-goals

# Testing-agent emphasis

When testing agents are part of the audience, include:

- acceptance criteria
- important risks
- suggested test focus
- expected observability or failure signals
