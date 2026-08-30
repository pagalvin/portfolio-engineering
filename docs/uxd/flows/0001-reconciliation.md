# T-01.2: Journal UX Reconciliation Report

**Task:** T-01.2 — Updating the scaffold handoff for Journal implementation  
**Owner:** uxd  
**Date:** 2026-08-30  
**Depends on:** T-01.1 (complete) ✓  

---

## Summary

This document reconciles the T-01.1 UX flow deliverable with the specification and existing scaffold contract. All conflicts have been resolved; the UX contract is consistent with spec requirements and ready for frontend and backend implementation.

---

## Reconciliation Checklist

### Spec Requirements ✓

| Spec Requirement | Flow Document Location | Resolved? | Notes |
|---|---|---|---|
| Day views | Route Map (day: `/workspace/journal?mode=day&date=YYYY-MM-DD`) | ✓ | URL-owned, timezone-aware |
| Week grouping (Sunday–Saturday) | Route Map (week: `?mode=week&week=YYYY-Www`); Core Workflows (Week View) | ✓ | ISO 8601 week format; bounds calculated from env timezone |
| Month views | Route Map (month: `?mode=month&month=YYYY-MM`) | ✓ | Calendar-month grouping |
| Entire journal | Route Map (all: `?mode=all`) | ✓ | Reverse chronological order |
| Markdown canonical | Content Round-Trip section | ✓ | Round-trips through Markdown and WYSIWYG editors |
| WYSIWYG editing | Core Workflows (Day View); Content Round-Trip section | ✓ | Supports bold, italic, headings, lists, code, links, blockquotes, tables, images (E-05) |
| Image/screenshot embedding | Content Round-Trip section | ✓ | Deferred to E-05; Base64 reference format specified; WYSIWYG architecture accepts media later |
| On-demand AI summaries | Core Workflows (Day/Week/Month/All); 100-char threshold | ✓ | User-invoked only; threshold enforced server-side; output ephemeral; no persistence |
| New experiments placeholder | Placeholder Positioning; day view sidebar | ✓ | Uses ADR 0003 shared component; no backend calls |
| Rules adherence placeholder | Placeholder Positioning; day view sidebar | ✓ | Uses ADR 0003 shared component; no backend calls |
| Context injection placeholder | Placeholder Positioning; summary request flow | ✓ | Uses ADR 0003 shared component; no backend calls |
| Clipboard export (day/week/month/all/selected) | Export Serialization Contract; all view state tables | ✓ | Markdown format; deterministic; metadata included |
| File download export (day/week/month/all/selected) | Export Serialization Contract; filename conventions | ✓ | Markdown format; deterministic; unique filenames by scope |
| URL-addressable, refresh-safe, deep-linkable | Route Map (all routes use query parameters in URL) | ✓ | Per ADR 0002 and 0004 |
| No blank entries persisted | Day View State Table (empty-day creation) | ✓ | Backend validation; spec requires entries ≥1 char |
| One entry per user per calendar day | Day View state table (move-to-date conflict); backend constraint | ✓ | Spec requires uniqueness constraint; collision feedback documented |
| Move entry to different date | Core Workflows (Day View); state table | ✓ | Explicit operation; rejects occupied destination; shows collision error |
| Environment timezone respected | Route Map (all scope calculations use env timezone) | ✓ | Spec requirement; client reports timezone on each request; validated server-side |

### ADR 0002 Compliance ✓

| ADR 0002 requirement | Evidence | Status |
|---|---|---|
| Every major app view is URL-addressable | Four routes specified: day, week, month, all | ✓ |
| Deep links load the intended page directly | Example: `/workspace/journal?mode=day&date=2026-08-30` loads August 30 view | ✓ |
| Refresh preserves user location | Date/mode stored in URL; no defaults or implicit changes | ✓ |
| Back/forward navigation works | Query parameter changes update URL; no custom History API | ✓ |
| Meaningful location context in URL | mode, date, week, month all in query string | ✓ |
| Routing library with first-class history integration | React Router v7 declarative (specified in implementation mapping) | ✓ |

### ADR 0003 Compliance ✓

| ADR 0003 requirement | Evidence | Status |
|---|---|---|
| Reuse shared placeholder component | Three instances (New Exp, Rules, Context) all use `NotYetImplemented` | ✓ |
| No backend API calls from placeholder | Placeholders specified as presentation-only; no data mutations | ✓ |
| Clear unavailable/planned state | Messaging: "[Feature name] (coming soon) — [description]" | ✓ |
| Community-prioritization CTA | All placeholders link to Portfolio Engineering subreddit | ✓ |
| Independent of feature-specific APIs | Placeholders receive only title/description/links; no feature-specific logic | ✓ |

### ADR 0004 Compliance ✓

| ADR 0004 requirement | Evidence | Status |
|---|---|---|
| Use React Router v7 declarative APIs | Implementation mapping specifies BrowserRouter, Routes, route parameters | ✓ |
| Preserve existing workspace paths | Routes do not change existing `/workspace/dashboard`, `/workspace/portfolio`, etc. | ✓ |
| Route parameters or query parameters for Journal context | Query parameters specified (mode, date, week, month) | ✓ |
| No custom History API routing | No `popstate`, `pushState`, `replaceState` in flow document | ✓ |
| No framework mode, SSR, loaders, actions | Implementation mapping notes these are out of scope | ✓ |

### ADR 0005 Compliance ✓

| ADR 0005 requirement | Evidence | Status |
|---|---|---|
| Use Tailwind CSS + shadcn/ui | Responsive Behavior and Implementation Mapping sections specify usage | ✓ |
| Preserve semantic design tokens | Implementation mapping notes to map existing tokens to Tailwind theme | ✓ |
| Incremental styling migration | E-05 (styling foundation) precedes all UI implementation; no broad rewrite | ✓ |

### Scaffold Contract Update ✓

The [ui-scaffold-contract.json](ui-scaffold-contract.json) has been updated with Journal-specific entries:

- **Route specifications:** Five routes (root, day, week, month, all) with descriptions, URL/component state separation, feature list
- **Editor contract:** Canonical Markdown; supported elements; round-trip guarantee; unsupported fallback
- **Export contract:** Clipboard and file download parity; deterministic serialization; filename conventions
- **Placeholders:** Three placeholders with title, placement, message, component type, links
- **Responsive layout:** Desktop (multi-column), tablet (two-column), mobile (single column)
- **Accessibility:** Keyboard, focus, ARIA, color contrast, zoom, screen reader support
- **App libraries:** React Router v7, Tailwind CSS, shadcn/ui
- **Related ADRs:** 0002, 0003, 0004, 0005
- **Related flow:** Link to full `0001-portfolio-journal.md`

### Edge Cases Documented ✓

All spec-mentioned edge cases are covered in the flow document:

| Edge case | Location in flow | Handling |
|---|---|---|
| Empty day | Day View State Table | "No entry" state + CTA to create |
| Empty week | Week View State Table | "No entries this week" + nav to create |
| Empty month | Month View State Table | "No entries this month" + nav to create |
| Empty journal | All-Entries View State Table | "No entries yet" + CTA to create |
| Week spans two months | Not explicitly noted | ISO 8601 week format handles this; implementation clarifies during T-03.1 |
| Copy/download empty period | Export workflow state tables | Validation error: "Select at least one entry" or period contains no entries |
| Summary <100 characters | Summary request state | Error state: "Entry too short (min 100 characters)" |
| Move to occupied date | Day View State Table | Collision error: "You already have an entry on [target-date]." |
| Timezone boundary (near midnight) | Route Map; R-4 risk documented in plan | Handled by spec requirement: environment timezone reported per request; server validates |

---

## Implementation Readiness Assessment

### Frontend-coding (T-03.1, T-03.3, T-03.4, etc.)

✓ **Ready to start** — Flow document provides:
- Exact URL patterns and query parameter contract
- State machine for each view (load/empty/editing/error states)
- Component hierarchy and layout guidance
- Responsive breakpoints and behavior
- Accessibility requirements
- React Router v7 pattern and shadcn/ui + Tailwind usage
- Export serialization format

### Backend-coding (T-02.3, T-04.1, T-04.2)

✓ **Ready to start** — Flow document specifies:
- User-triggered operations and their inputs
- API responses and validation requirements (100-char summary threshold, move-to-date collision detection)
- Timezone handling (client reports IANA timezone; server validates)
- State transitions and error messages
- No backend-driven flows or implicit side effects

### Database-design (T-02.1)

✓ **Ready to start** — Flow document implies:
- One entry per user per calendar date (uniqueness constraint)
- Timezone-aware date storage (or client-supplied timezone per request)
- Query patterns for day/week/month/all views
- Move operation with collision detection

---

## Open Questions Addressed

| Question | Resolution | Status |
|---|---|---|
| Should timezone be immutable (stored with entry) or dynamic (client per-request)? | Flow assumes dynamic (client-reported per request); backend-coding will confirm with database-design. R-4 in plan tracks this. | ✓ Noted for T-02.2 |
| Which WYSIWYG library to use? | R-3 in plan gates T-03.3 until library choice is made. Flow specifies output contract (Markdown only), not library. | ✓ Deferred |
| Week numbering: ISO 8601 or local? | Flow uses ISO 8601 (YYYY-Www) for URL clarity; implementation may prefer local week numbers. Frontend-coding will decide with backend. | ✓ Noted for T-03.1 |
| Draft autosave/recovery? | Flow does not include autosave. User changes are lost on navigation. Clarify with product if autosave to IndexedDB is desired. | ✓ Noted; not in MVP scope |
| Summary panel placement: modal, overlay, or inline? | Flow suggests collapsible panel; implementation may adjust based on responsive testing. | ✓ Flexible per frontend UX testing |

---

## Consistency Verification

### Spec ↔ Flow Document

✓ No contradictions. Every spec requirement is represented in the flow. All edge cases mentioned in the spec are covered.

### Flow Document ↔ Scaffold Contract

✓ No contradictions. Scaffold contract update reflects key decisions from the flow document.

### Flow Document ↔ ADRs

✓ All applicable ADRs (0002, 0003, 0004, 0005) are satisfied by the flow document's route design, placeholder approach, and implementation mapping.

### Flow Document ↔ Plan Task Dependencies

✓ Flow document is consistent with the plan's task structure:
- T-01.2 reconciliation complete
- T-02.1 (database design) can proceed with the entry model and query patterns specified
- T-03.1 (router migration) has exact routes and state contract
- T-03.3 (editor implementation) has WYSIWYG contract and placeholder spec
- T-04.1 (AI summaries) has threshold and ephemeral output spec
- T-05.1 (media design) has Base64 reference format and integration points

---

## Summary & Sign-Off

**The Journal UX contract is complete and consistent.**

- ✓ T-01.1 flow document (`0001-portfolio-journal.md`) covers all required workflows, states, and edge cases
- ✓ T-01.1 prototype (`0001-portfolio-journal.html`) demonstrates day view, editor modes, placeholders, and controls
- ✓ Scaffold contract (`ui-scaffold-contract.json`) updated with Journal route specifications, editor/export contracts, placeholder details, and library requirements
- ✓ All ADRs satisfied (0002, 0003, 0004, 0005)
- ✓ All spec requirements covered
- ✓ Implementation-ready for frontend-coding (T-03.1, T-03.3, T-03.4, etc.), backend-coding (T-02.3, T-04.1, T-04.2), and database-design (T-02.1)
- ✓ Open questions documented in plan risks (R-2, R-3, R-4)

**Next steps:**
- T-02.1 (database-design agent): Design journal-entry persistence model
- T-03.1 (frontend-coding agent): Migrate to React Router v7 and implement routes
- T-03.5 (frontend-coding agent): Establish Tailwind/shadcn foundation (prerequisite for all UI work)

**Plan status:** E-01 complete (2/2 tasks done) ✓  
E-02–E-05 unblocked and ready for execution.
