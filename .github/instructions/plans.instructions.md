---
applyTo: "docs/plans/**/*.md"
---

# Implementation plan rules

Plans in this repository live under `docs/plans`. They are written by the `implementation-planner` agent and updated in place by the agents executing them.

Plans are the single source of truth for implementation progress. Never rely on chat context or agent memory for status.

## Structure

- Follow the template in `docs/plans/plan_template.md`.
- Plan numbers mirror their spec number: `docs/specs/0003-foo.md` plans to `docs/plans/0003-foo.md`.
- Two levels only: Effort (`E-NN`) → Task (`T-NN.N`).
- Every plan opens with a `Progress` block.
- Every effort declares an exit gate.
- Every task carries ID, Status, Owner, Depends on, Files, Intent, ADRs, Verify, and Notes.

## Task IDs are permanent

- Never renumber a task. Append the next unused sequence number in the effort.
- Never reuse an ID from a cancelled or removed task.
- Never delete a task entry. Mark it `cancelled` with a reason.
- Order is expressed through `Depends on`, not numeric adjacency.

Renumbering breaks every cross-reference in the plan, in commit messages, and in other agents' context.

## Updating a plan while executing it

Any agent doing work described by a plan must:

1. Set the task to `in-progress` before starting it.
2. Set it to `done` or `blocked` as the last step of the task.
3. Refresh the `Progress` block in the same edit.
4. Append discoveries, deviations, and blockers to that task's `Notes`.

## Do

- Verify the task's `Verify` condition before marking it `done`.
- Record blockers on the task and in `Risks and open items`.
- Keep `Notes` factual and concise.
- Log structural changes in the `Revisions` table.
- Use relative links for repository references.

## Do not

- Do not mark a task `done` without meeting its `Verify` condition.
- Do not batch status updates across several tasks at the end of a session. This is the primary cause of plan drift.
- Do not edit the status or content of a `done` task. Add a new task describing any reversal.
- Do not rewrite a plan from scratch. Amend in place so history survives.
- Do not restate spec or ADR content. Cite it.
- Do not expand scope by adding tasks the spec does not support. Raise it in `Risks and open items` instead.
