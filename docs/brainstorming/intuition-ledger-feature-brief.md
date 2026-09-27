# Intuition Ledger Feature Brief

- Status: draft
- Date: 2026-09-27
- Source: user brainstorming session on capturing and measuring market predictions
- BRD: [0009-intuition-ledger.md](../specs/0009-intuition-ledger.md). The BRD supersedes this brief where they differ (for example, deadline presets, optional actual price, result history, and no currency symbol).

---

## Summary

The Intuition Ledger lets a user record a prediction, most often about a security's price movement, and later record whether it came true. Over time the ledger turns gut feel into measurable data: hit rate, calibration of stated confidence, and accuracy by prediction type, security, and time horizon.

Examples:

- "I predict MSFT will rise by 1% by Friday."
- "I predict ONDS will fall on earnings."
- "I predict the Fed will cut rates in December." (not tied to a security)

Predictions are private to the user who creates them.

---

## Business Objective

- **Self-knowledge:** Help users learn whether their market intuition is reliable, and where it is strongest or weakest.
- **Honest measurement:** Preserve the original claim so results reflect what the user actually predicted, not a revised version.
- **Low friction:** Make capturing a prediction fast enough to do in the moment the intuition occurs.
- **Platform reuse:** Become an early consumer of the Organization Security Master ([0008](../specs/0008-organization-security-master.md)) as a referenced record.

---

## Problem / Opportunity

- Investors routinely form predictions ("this will pop on earnings") but rarely write them down, so memory favors the hits and forgets the misses.
- Without a record of confidence, users cannot tell whether "I'm 80% sure" actually means right 80% of the time.
- The Journal captures narrative reflection but has no structured, scorable claim with a deadline and an outcome.

---

## Desired User Outcomes

- As a user, I can capture a prediction in a few seconds using a streamlined form.
- As a user, I can pick a security from my organization's Security Master, or choose **Other** and type a symbol that is not in the Security Master.
- As a user, I can make a prediction that is not about a security at all.
- As a user, I can view all of my predictions, filter them, and see which are open, due for review, or resolved.
- As a user, I can edit a prediction; if I change the substance of the claim after creating it, the prediction is visibly marked **Amended**.
- As a user, I can record the outcome of a prediction as Correct, Incorrect, or Void, with notes.
- As a user, I can permanently delete a prediction after I have voided it.
- As a user, I can see visualizations of my prediction outcomes over time and by category.

---

## Key Decisions (from brainstorming)

| Topic | Decision |
| --- | --- |
| Visibility | Private to the creating user, scoped within their organization ([ADR 0001](../ADRs/0001-organization-aware-data-access.md)). |
| Edits after creation | Allowed. Changes to claim fields more than 5 minutes after creation mark the prediction **Amended** and display a badge. |
| Outcomes | Correct, Incorrect, or Void. No Partial result. |
| Void and delete | Both supported. A prediction must be voided before it can be permanently deleted. |
| Security selection | Dropdown of the organization's **active** Security Master records, plus an **Other** choice that allows a free-text symbol. Other symbols are normalized and suggested from previously used Other symbols. |
| Target price | Judged on "touch" only (reached at any point by the deadline). No "close" option. |
| Price data | Entered manually by the user in the MVP. The user decides which price to enter (for example, last close outside market hours). Automatic price lookup is deferred until market-pricing APIs exist ([TD-020](../tech-debt/checklist.md)). |
| Charts | shadcn/ui Chart component (built on Recharts, added through the shadcn CLI), per [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md). |
| Journal integration | Deferred to a later phase ([TD-019](../tech-debt/checklist.md)). |
| Measurable predictions | When a prediction has a hard, price-based result, capture the security's price at the time of the prediction and the predicted price. |

---

## Scope

### In Scope (MVP)

1. **Prediction capture**
   - Subject, which is one of:
     - a Security Master record (dropdown of the organization's active securities; inactive securities are not selectable)
     - **Other** security with a free-text symbol, normalized to uppercase with surrounding whitespace trimmed, and suggested from the user's previously used Other symbols
     - no security (freeform topic; for example, a macro event)
   - Prediction type (see below).
   - Direction (up / down) where applicable.
   - Magnitude (%) or target price where applicable.
   - Deadline: date presets (end of today, this Friday, end of week, end of month) or custom date; or an event label (for example, "Q3 earnings") with an expected date.
   - Confidence: 50–100%.
   - Price capture for measurable predictions (see **Measurable Predictions and Price Capture** below).
   - Reasoning notes (Markdown).
   - Optional tags.

2. **Prediction types**

   | Type | Example | Measurable | Resolution basis |
   | --- | --- | --- | --- |
   | Direction | MSFT up by Friday | Yes | Actual price vs. price at prediction |
   | Percent move | MSFT +1% by Friday | Yes | Actual price vs. predicted price |
   | Target price | NVDA reaches $150 by Oct 31 | Yes | Target touched at any point by the deadline |
   | Event reaction | ONDS falls on earnings | Yes, when tied to a security | Actual price after the event vs. price at prediction (and predicted price, if a magnitude is given) |
   | Freeform (yes/no) | Fed cuts in December | No | User judgment |

3. **Prediction list**
   - Grid of the user's predictions following [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md): URL-owned filters, visible defaults, row hover, count status line.
   - Filters: status (Open, Due, Resolved, Void), type, security/symbol, result, and search on subject/notes.
   - Amended badge and outcome badges shown in the grid.

4. **Due-for-review queue**
   - Predictions whose deadline has passed and that have no recorded outcome.
   - Serves as the primary entry point for recording outcomes.

5. **Edit prediction**
   - All fields editable.
   - Editing a **claim field** (subject, type, direction, magnitude/target, deadline, confidence, price at prediction, predicted price) more than 5 minutes after creation sets the prediction to Amended and records the time of the amendment.
   - Editing **non-claim fields** (notes, tags) does not mark the prediction as Amended.
   - A 5-minute grace window after creation allows corrections to claim fields without triggering Amended.
   - Amendment history (previous claim values) is retained so the original claim can be shown.

6. **Record outcome**
   - Result: Correct, Incorrect, or Void.
   - Actual price and resolution date. Actual price is required for measurable predictions (unless the result is Void) and optional otherwise.
   - For measurable predictions, the app computes the actual % change from the price at prediction and suggests a result by comparing the actual price to the predicted price; the user can override it.
   - Outcome notes / lessons learned (Markdown).
   - Outcomes may be edited later; this does not mark the claim as Amended.

7. **Void and delete**
   - A user can void a prediction at any time, with an optional reason. Voided predictions stay in the ledger and are excluded from hit-rate and calibration stats.
   - Only a voided prediction can be permanently deleted. Delete requires confirmation and removes the prediction and its amendment history.
   - A voided prediction can be restored (un-voided) until it is deleted.

8. **Visualizations**
   - Summary tiles: open, due, resolved, overall hit rate.
   - Hit rate over time (weekly/monthly, Sunday–Saturday weeks per [ADR 0006](../ADRs/0006-use-sunday-through-saturday-weeks.md)).
   - Calibration chart: stated confidence bucket vs. actual hit rate.
   - Outcome breakdown by prediction type, and by security/symbol.
   - Predicted vs. actual % move (scatter) for measurable predictions that have a predicted price.
   - Charts include a toggle to include or exclude Amended predictions.
   - Charts use the shadcn/ui Chart component (Recharts-based, added through the shadcn CLI) with semantic chart color tokens, and enable the chart accessibility layer ([ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md)). No other chart library is introduced.

### Out of Scope (Future Phases)

- Automatic price lookup, market-data integration, and earnings calendars. Pre-filling the price at prediction and the actual price from a market-pricing API is an important follow-up once such an API exists ([TD-020](../tech-debt/checklist.md)).
- Journal integration: showing predictions created or resolved on a day in that day's Journal view and exports ([TD-019](../tech-debt/checklist.md)).
- Partial outcomes.
- Automatic resolution of predictions.
- Relative predictions (for example, "QQQ beats SPY this month").
- Sharing predictions within an organization or publicly.
- AI review of reasoning or pattern detection (future use of [0002 AI provider connections](../specs/0002-ai-provider-connections.md)).
- Creating a Security Master record directly from an **Other** symbol (possible future "promote to Security Master" action).
- Reminders or notifications when predictions become due.

Deferred features that are surfaced in the UI must use the shared placeholder ([ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md)).

---

## Measurable Predictions and Price Capture

A prediction is **measurable** when it concerns a security (Security Master or **Other**) and has a hard, price-based result: Direction, Percent move, Target price, and Event reaction tied to a security. Freeform predictions are not measurable.

For measurable predictions, the ledger captures:

| Field | When | Required | Notes |
| --- | --- | --- | --- |
| Price at prediction | Creation | Yes | The security's price when the prediction is made, entered manually. The user decides which price to use (for example, the last close outside market hours). |
| Price captured at | Creation | Yes | Timestamp of the price at prediction; defaults to the prediction's creation time and may be adjusted by the user. |
| Predicted price | Creation | Yes when a magnitude or target exists | The price the user expects the security to reach. |
| Predicted % change | Creation | Derived | Stored alongside the predicted price. |
| Actual price | Resolution | Yes (unless Void) | The price observed at the deadline or after the event. For Target price, the most extreme price reached by the deadline in the predicted direction (the high for up, the low for down). |
| Actual % change | Resolution | Derived | Computed from the price at prediction and the actual price. |

**Predicted price by type:**

- **Percent move:** The user enters the %; the app calculates the predicted price. Example: MSFT at $420.00, +1% → predicted price $424.20.
- **Target price:** The user enters the target; that is the predicted price, and the app calculates the implied %. Example: NVDA at $140.00, target $150.00 → +7.14%. The target counts as reached if the price touched it at any point by the deadline.
- **Event reaction:** Predicted price is optional; if the user gives a magnitude or target, it is calculated as above. Otherwise the result is judged on direction only.
- **Direction:** No predicted price; the result is judged by whether the actual price is above or below the price at prediction.

**Capture rules:**

- The user may enter either the % or the predicted price; the other is calculated and both are shown before saving.
- Both prices are stored as values captured at the time of the prediction, not recalculated later. They are part of the claim, so changing them after creation marks the prediction Amended.
- Direction (up/down) must be consistent with the predicted price relative to the price at prediction; the form flags a mismatch.
- Prices are stored with enough precision for low-priced securities (at least 4 decimal places). Currency is assumed to be the security's trading currency; multi-currency handling is out of scope.

---

## Scoring Rules

- **Correct:** The claim was fully met by the deadline.
  - Direction: actual price moved in the predicted direction from the price at prediction.
  - Percent move / Event reaction with a magnitude: actual price is at or beyond the predicted price in the predicted direction.
  - Target price: the target was touched at any point by the deadline.
  - Event reaction without a magnitude: actual price moved in the predicted direction.
  - Freeform: the user judges the claim to be true.
- **Incorrect:** The claim was not met. Falling short of the predicted price, even in the right direction, is Incorrect.
- **Void:** The prediction cannot be fairly scored (for example, the event was cancelled). Excluded from hit-rate and calibration stats.
- **Hit rate:** Correct ÷ (Correct + Incorrect).
- **Calibration:** Resolved, non-void predictions grouped by confidence bucket (50–59, 60–69, 70–79, 80–89, 90–100) and compared to the bucket's actual hit rate.

---

## Data Considerations

- Each prediction belongs to one user and one organization. All queries are scoped by both ([ADR 0001](../ADRs/0001-organization-aware-data-access.md)).
- A prediction optionally references a Security Master record by stable ID. The symbol is also stored as a snapshot so that:
  - **Other** predictions have a symbol without a Security Master record.
  - Historical predictions display consistently if the security is later edited or deactivated.
- A security referenced by a prediction cannot be permanently deleted; the user may deactivate it instead ([ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md)).
- Inactive securities are not selectable when creating a prediction. Existing predictions that reference a security that later becomes inactive keep the reference and continue to display it. When editing such a prediction, the current inactive security remains shown as a labelled current value.
- **Other** symbols are stored normalized (trimmed, uppercase). Suggestions come from the user's own previously used Other symbols only.
- Deleting a voided prediction removes its security reference, which may make the security deletable again.
- Predictions are profile-scoped data. They must be included in the profile backup export and the profile delete path ([ADR 0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md)). Deleting a profile deletes that profile's predictions, which removes their security references; this does not delete securities.
- Amendment history is stored alongside the prediction and included in backups.

---

## User Flow

```
[ Intuition Ledger ]
   │
   ├─► Dashboard: summary tiles + charts + "Due for review" list
   │
   ├─► New prediction
   │     "I predict [Security ▾ | Other: ____ | None] will [rise ▾] by [1 %]
   │      by [This Friday ▾]"   Confidence [70%]
   │      Price now [$420.00]  →  Predicted price [$424.20]  (+1.00%)
   │      Notes [ ... ]   Tags [ ... ]
   │     └─► Save → appears in list as Open
   │
   ├─► Prediction list (grid, URL filters)
   │     └─► Open row → details (original claim, amendments, outcome)
   │            ├─► Edit → claim change after 5 min → Amended badge
   │            ├─► Record outcome
   │            └─► Void → (optional) Delete permanently
   │
   └─► Due for review
         └─► Record outcome: actual price → suggested result → confirm
              Correct | Incorrect | Void + notes
```

---

## Constraints & Applicable ADRs

- **[ADR 0001](../ADRs/0001-organization-aware-data-access.md):** Organization- and user-scoped data access; predictions are private.
- **[ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) / [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md):** Ledger, list, detail, and edit views are URL-addressable; filters live in the URL.
- **[ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md):** Shared placeholder for deferred capabilities.
- **[ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md):** Tailwind semantic tokens and shadcn/ui primitives, including for charts.
- **[ADR 0006](../ADRs/0006-use-sunday-through-saturday-weeks.md):** Weekly groupings and "this week" deadline presets use Sunday–Saturday weeks.
- **[ADR 0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md):** Predictions and amendment history are included in profile backup and deletion.
- **[ADR 0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md):** Help content is added for the Intuition Ledger.
- **[ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md):** Referenced securities cannot be deleted.
- **[ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md):** The prediction list follows the standard grid behaviors.
- **Markdown notes:** Reasoning and outcome notes follow the owned Markdown editor/viewer patterns ([ADR 0007](../ADRs/0007-use-cwl-editor-behind-an-owned-markdown-editor.md), [ADR 0008](../ADRs/0008-preserve-markdown-content-integrity-in-wysiwyg-editing.md)).

---

## Resolved Questions

| # | Question | Resolution |
| --- | --- | --- |
| 1 | Partial rules and hit-rate weighting | Partials are excluded entirely. Results are Correct, Incorrect, or Void. |
| 2 | Creation grace window before Amended | 5 minutes. |
| 3 | Deletable or only voidable? | Both. A prediction must be voided before it can be deleted. |
| 4 | Target price "touch" vs. "close" | "Touch" only. No "close" option. |
| 5 | Inactive securities selectable when creating? | No. |
| 6 | Normalize and suggest Other symbols? | Yes: trim, uppercase, and suggest from the user's previously used Other symbols. |
| 7 | Journal integration | Later phase. Tracked as [TD-019](../tech-debt/checklist.md). |
| 8 | Chart library | Follow ADR 0005: shadcn/ui Chart component (Recharts-based). |
| 9 | Price at prediction outside market hours | The user enters the price and decides which one to use. Automatic price lookup is a future requirement once market-pricing APIs exist. Tracked as [TD-020](../tech-debt/checklist.md). |

---

## Definition of Done (MVP, preliminary)

1. **Schemas & types:** Shared types and validation schemas for predictions, outcomes, and amendments.
2. **Database:** Prediction model scoped by organization and user, with an optional restrictive reference to the Security Master, a symbol snapshot, price at prediction and its timestamp, predicted price and %, actual price, and amendment history.
3. **Backend API:** Create, list/filter, read, update (with amendment detection after the 5-minute grace window), record outcome, void/restore, delete (voided only), Other-symbol suggestions, and stats endpoints, all scoped by organization and user.
4. **Frontend:** Dashboard with shadcn/ui charts, prediction list, new/edit form with an active-only Security Master dropdown plus **Other** (normalized, with suggestions), detail view with amendment history, due-for-review queue, record-outcome flow, and void/delete actions.
5. **Profile lifecycle:** Predictions included in profile backup export and delete cascade.
6. **Security Master:** Deleting a referenced security is blocked with a clear message.
7. **Help:** Help content published for the feature.
8. **Tests:** Scoping and privacy, amendment detection and the 5-minute grace window, void-before-delete enforcement, inactive securities excluded from selection, Other-symbol normalization and suggestions, target-price touch scoring, required price capture for measurable types, predicted price/% calculations, direction-vs-predicted-price consistency, outcome suggestion and scoring math, calibration bucketing, security delete restriction, backup/delete coverage, and component tests for the form and list.
