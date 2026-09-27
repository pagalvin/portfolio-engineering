# Business Requirements Document: Intuition Ledger

## Status

- Readiness: Ready for implementation planning
- Owner: TBD
- Date: 2026-09-27
- Document type: BRD
- Source: [Intuition Ledger feature brief](../brainstorming/intuition-ledger-feature-brief.md)
- Revised: 2026-09-27, UX review decisions applied (see **Revision notes**). Where this BRD and the brief differ, this BRD takes precedence.
- UX flow: [0009-intuition-ledger.md](../uxd/flows/0009-intuition-ledger.md)

## Summary

The Intuition Ledger lets a user record a prediction, most often about a security's price movement, and later record whether it came true. Over time the ledger turns intuition into measurable data: hit rate, calibration of stated confidence, and accuracy by prediction type and security.

Examples:

- "MSFT will rise by 1% by Friday."
- "ONDS will fall on earnings."
- "The Fed will cut rates in December." (not tied to a security)

Predictions are private to the user who creates them. This document defines the business need and MVP outcomes. It does not select a database schema, API, or user-interface design.

## Business objective

Help users learn whether their market intuition is reliable, and where it is strongest or weakest, by capturing predictions as checkable claims and measuring the results honestly.

## Problem / opportunity

- Investors routinely form predictions but rarely write them down, so memory favors the hits and forgets the misses.
- Without a record of confidence, users cannot tell whether "I'm 80% sure" actually means right 80% of the time.
- The Journal captures narrative reflection but has no structured claim with a deadline, prices, and a recorded outcome.
- The Security Master ([0008](0008-organization-security-master.md)) exists but no feature yet references it. The ledger is its first consumer.

## Desired outcomes

- Users can capture a prediction quickly, in the moment the intuition occurs.
- Price-based predictions record the price when the prediction was made and the predicted price, so results are objective.
- The original claim is preserved. Later changes to it are visible, not silent.
- Users can see their hit rate and calibration over time and by category.
- Predictions are never visible to other users, including members of the same organization.

## Glossary

- **Claim fields:** The fields that define what was predicted: subject, prediction type, direction, claim text, event label, move size (%) or predicted/target price, deadline, confidence, price at prediction, and price-captured timestamp.
- **Measurable prediction:** A prediction about a security (Security Master or Other) of type Direction, Percent move, Target price, or Event reaction. Freeform predictions are not measurable.
- **Amended:** A prediction whose claim fields were changed more than 5 minutes after it was created.
- **Due:** An open prediction whose deadline has passed and that has no recorded result.
- **Void:** A prediction the user has decided cannot be fairly scored. It stays in the ledger but is excluded from stats.
- **Touch:** A target price counts as reached if the price reached it at any point by the deadline, not only at the close.
- **Trading day:** In this release, Monday through Friday. Exchange holidays are not recognized ([TD-021](../tech-debt/checklist.md)).
- **Result history:** The retained record of every change to a prediction's result after it was first recorded.
- **Reasoning:** The user's free-form explanation of why they believe the prediction will come true. It is not a claim field.
- **Reasoning history:** The retained record of every edit to a prediction's reasoning made after the 5-minute grace window.

## Scope

### Included in the initial release

- Create, view, list, filter, and edit the user's own predictions.
- Subject selection from the organization's active Security Master records, an **Other** free-text symbol, or (Freeform only) no security.
- Five prediction types: Direction, Percent move, Target price, Event reaction, and Freeform (yes/no).
- Manual price capture for measurable predictions: price at prediction and predicted price at creation, and an optional actual price at resolution.
- Confidence (50–100%), reasoning notes, and tags.
- Amended detection with a 5-minute grace window, a visible badge, and retained amendment history.
- Recording outcomes as Correct or Incorrect, with a suggested result when an actual price is entered, and a retained result history.
- Voiding, restoring, and permanently deleting (voided only) predictions.
- A due-for-review queue and a due count on the navigation link.
- A dashboard with summary counts and charts, each with an accessible table alternative.
- Inclusion of predictions in the profile backup and profile delete path.
- Help content for the feature.

### Deferred

- Automatic price lookup from a market-pricing API ([TD-020](../tech-debt/checklist.md)).
- Exchange holiday calendars and market-hours awareness for deadline presets ([TD-021](../tech-debt/checklist.md); exchange calendar service tracked by [TD-022](../tech-debt/checklist.md)).
- Journal integration: showing predictions in Journal day views and exports ([TD-019](../tech-debt/checklist.md)).
- Automatic resolution of predictions.
- Relative predictions (for example, "QQQ beats SPY this month").
- AI review of reasoning or pattern detection.
- Promoting an **Other** symbol into a Security Master record.
- Reminders or notifications when predictions become due.
- Earnings or event calendars.

## Non-goals

- Partial outcomes. Results are only Correct, Incorrect, or Void.
- A "close" option for target-price predictions. Touch is the only rule.
- Sharing predictions with other users, within or outside the organization.
- Market-data synchronization, broker integration, or position tracking.
- Multi-currency handling. Prices are in the security's trading currency and are shown without a currency symbol.
- Gamified or judgmental performance framing, such as streaks, rankings, or scolding copy.
- Trading recommendations or any advice derived from predictions.

## Functional requirements

### Ownership and visibility

1. Each prediction belongs to exactly one user and that user's organization. Only the creating user can view, edit, resolve, void, restore, or delete it.
2. Lists, counts, suggestions, and stats include only the current user's predictions.

### Subject selection

3. The user chooses one subject:
   - a Security Master record from a dropdown of the organization's **active** securities
   - **Other**, with a free-text symbol
   - no security, with a free-text topic (Freeform only)
4. Inactive securities are not selectable for new predictions or when changing a subject. A prediction that already references a security that later becomes inactive keeps and displays that reference, including as the current value when editing.
5. **Other** symbols are trimmed and converted to uppercase before saving. While typing, the user is offered suggestions from their own previously used Other symbols.
6. When a normalized Other symbol matches an active Security Master symbol, the form offers to use the Security Master record instead (for example, "MSFT is in your Security Master. Use it?"). The user may accept or keep Other. The prompt does not block saving.
7. A prediction that references a Security Master record also stores the symbol as shown when it was saved, so historical predictions display consistently if the security is later edited or deactivated.

### Prediction types and claim fields

8. The user selects one prediction type:

   | Type | Example | Requires |
   | --- | --- | --- |
   | Direction | MSFT rises by Friday | Security, direction |
   | Percent move | MSFT rises 1% by Friday | Security, direction, and move size (%) or predicted price |
   | Target price | NVDA reaches 150 by end of month | Security, target price (direction is derived) |
   | Event reaction | ONDS falls on earnings | Security, event label, direction; optional move size (%) or predicted price |
   | Freeform | Fed cuts in December | Claim text; optional security or free-text topic |

   Event predictions that are not about a security use Freeform.
9. Every prediction requires a deadline. The user chooses one of these presets or a custom date:
   - **End of today:** today's date.
   - **End of week:** the last trading day of the current Sunday–Saturday week ([ADR 0006](../ADRs/0006-use-sunday-through-saturday-weeks.md)). If no trading days remain in the current week, the last trading day of the next week.
   - **End of month:** the last trading day of the current calendar month. If no trading days remain in the current month, the last trading day of the next month.
   - **Custom date:** any date on or after today. If it is not a trading day, a non-blocking hint says so.
   - The form shows the resolved date for the selected preset before saving (for example, "End of week: Fri, Oct 2").
   - Event reaction deadlines are the expected event date. They are approximate; the user judges whether the reaction broadly matched the prediction.
10. Every prediction requires a confidence from 50% to 100%, in whole percentages.
11. The create and edit forms show an optional, free-form **reasoning** text area by default, labelled "Why do you think this will happen? (optional)". It is not hidden behind a disclosure. The user types plain text or Markdown directly; when not being edited, reasoning is displayed as formatted Markdown, the same as Journal entries ([ADR 0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md)). The text is saved exactly as entered. Tags are optional. While typing a tag, the user is offered suggestions from their own previously used tags.

### Price capture for measurable predictions

12. Measurable predictions require the **price at prediction**, entered manually, and a **price-captured timestamp**. The timestamp defaults to the creation time and can be changed by the user. The user decides which price to enter (for example, the last close when the market is closed).
13. Direction is chosen as **Rises** or **Falls**. For Percent move and Event reaction with a magnitude, the user enters either an unsigned **move size (%)** greater than zero or a **predicted price**. The prediction stores both the **predicted price** and the **predicted % change**, and both are shown before saving.
    - If the user enters a move size, the predicted price is calculated from the price at prediction and the direction. Example: MSFT at 420.00, rises 1% → predicted price 424.20.
    - If the user enters a predicted price, the move size and direction are derived from it and shown. The predicted price must differ from the price at prediction.
14. For Target price, the user enters the target, and the direction and implied % are derived from it. Example: NVDA at 140.00, target 150.00 → rises 7.14%. The target must differ from the price at prediction.
15. All prices must be greater than zero and support at least 4 decimal places. Price and percentage input accepts the user's locale decimal format. Prices are displayed without a currency symbol. The stored prices and percentages are the values captured at save time and are never recalculated later.

### Editing and amendments

16. All fields remain editable after creation.
17. Changing a claim field within 5 minutes of creation does not mark the prediction Amended. During that window, the edit form shows how much grace time remains (for example, "Claim edits won't mark this Amended for 4:12").
18. After the grace window, saving a change to a claim field requires confirmation ("Changing the claim will mark this prediction Amended."). On confirmation, the prediction is marked **Amended**, the time of the change is recorded, and the previous claim values are retained. The original claim and each amendment remain viewable on the prediction's detail view. If the user cancels, nothing is saved and the draft is kept.
19. Changing reasoning, tags, or outcome details never marks a prediction Amended and never triggers the confirmation.
19a. Reasoning edits made within the 5-minute grace window are not recorded. Every reasoning edit saved after the grace window is kept in the **reasoning history** with the previous text, the new text, and when the change happened. The detail view shows "Reasoning edited on {date}" with the history available, and the original reasoning remains viewable. Reasoning edits add no badge and do not affect stats.
20. Once a prediction is Amended it stays Amended, even if the claim is changed back to its original values.
21. The Amended badge appears in the list and on the detail view, as text rather than color alone.

### Recording outcomes

22. The user records a result of **Correct** or **Incorrect**, a resolution date, and optional outcome notes (free-form text or Markdown, entered and displayed the same way as reasoning). The result is the user's judgment. They decide whether and when the prediction came true.
23. Results can be recorded only once the deadline has passed, with one exception: Target price and Percent move predictions can be recorded as Correct before their deadline when the target or predicted price was touched. Before the deadline, Incorrect cannot be recorded for any prediction type, and other prediction types cannot be recorded; those attempts explain "The deadline hasn't passed yet."
24. The resolution date is the date the outcome happened, chosen by the user. It defaults to the deadline, or to today if that is earlier, and it cannot be before the prediction was created or after today.
25. For measurable predictions, the user may enter an **actual price**. When they do, the app calculates the actual % change from the price at prediction and suggests a result. The user may accept or override the suggestion. For Target price, the actual price is the most extreme price reached in the predicted direction: the high for an upward target, the low for a downward target.
26. Suggested-result rules (used only when an actual price is entered):
    - **Direction, and Event reaction without a predicted price:** Correct if the actual price moved in the predicted direction from the price at prediction. No change suggests Incorrect.
    - **Percent move, and Event reaction with a predicted price:** Correct if the actual price reached or passed the predicted price in the predicted direction. Falling short suggests Incorrect, even if the direction was right.
    - **Target price:** Correct if the actual price touched the target.
    - **Freeform:** No suggestion.
27. A recorded result, actual price, resolution date, and outcome notes can be edited later, and the result can be cleared, returning the prediction to open or due. Every change or clearing of a result after it was first recorded is kept in the **result history** with the previous value, the new value, and when the change happened. The detail view shows "Result changed on {date}" with the history available. Result changes do not add a badge and do not affect stats beyond using the current result.

### Void, restore, and delete

28. The user can void any prediction that is not already voided, with an optional reason. Voided predictions remain in the ledger, are clearly labelled, and are excluded from hit-rate and calibration stats.
29. The user can restore a voided prediction. It returns to its previous state (open, due, or resolved with its result).
30. Only a voided prediction can be permanently deleted. Deletion requires explicit confirmation and removes the prediction with its amendment, result, and reasoning history.
31. Deleting a prediction removes its reference to any security. It never deletes the security.

### Prediction list and due queue

32. The list shows the user's predictions and follows the standard grid behaviors ([ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md)).
33. Users can search by subject, symbol, claim text, reasoning, and outcome notes. They can filter by status (Open, Due, Resolved, Void), prediction type, security/symbol, result (Correct, Incorrect), tag, and Amended. The status filter has a visible default of all non-void predictions.
34. The list shows at least subject, type, a readable summary of the claim, deadline, confidence, status, result, and the Amended badge.
35. A due-for-review queue lists due predictions, oldest deadline first, and is the primary entry point for recording outcomes.
36. The Intuition Ledger navigation link shows the number of due predictions as text (for example, "Intuition Ledger, 3 due"), not only a colored dot. No count is shown when none are due.
37. Status is derived: **Void** if voided; otherwise **Resolved** if a result is recorded; otherwise **Due** if the deadline has passed; otherwise **Open**. Deadlines are evaluated as end of day in the user's timezone.

### Dashboard and visualizations

38. The dashboard shows summary counts (open, due, resolved, voided) and the overall hit rate.
39. Hit rate is Correct ÷ (Correct + Incorrect) over resolved, non-void predictions. If there are no qualifying predictions, it shows as not available rather than 0%.
40. The dashboard includes:
    - hit rate over time, by week (Sunday–Saturday) and by month, grouped by resolution date
    - calibration: stated confidence in buckets (50–59, 60–69, 70–79, 80–89, 90–100) compared with the actual hit rate for each bucket
    - results by prediction type
    - results by security/symbol, grouped by normalized symbol whether the prediction used a Security Master record or Other; the chart shows the 10 symbols with the most resolved predictions, and the table alternative lists all symbols
    - predicted vs. actual % change for measurable predictions that have both a predicted price and an actual price
41. The calibration chart shows the number of predictions in each bucket. It is always shown when there is at least one qualifying prediction. When any bucket has fewer than 5 predictions, a note explains that those buckets don't yet have enough predictions to be meaningful.
42. The user can include or exclude Amended predictions from all charts and the hit rate. Amended predictions are included by default.
43. Charts show a clear empty state when there is no qualifying data.
44. Every chart has a "View as table" alternative with the same data, and charts support keyboard and screen-reader access.
45. Results use text and an icon, not color alone. Price direction (Rises/Falls) is not colored as good or bad, because color meanings for price moves differ between markets.
46. Performance copy is neutral and descriptive (for example, "Your 90–100% predictions were correct 60% of the time"). No streaks, rankings, or judgmental language.

### Profile lifecycle and Security Master

47. Predictions, amendment history, result history, reasoning history, and outcomes are included in the profile backup export and removed by the profile delete path ([ADR 0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md)).
48. A Security Master record referenced by any prediction, including a voided one, cannot be permanently deleted. The user receives a clear explanation and can deactivate it instead ([ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md)).

## Constraints / applicable ADRs

- [ADR 0001](../ADRs/0001-organization-aware-data-access.md): Predictions are organization-owned data scoped by organization, and further scoped to the creating user for privacy. Every read, write, delete, count, and aggregate is scoped by organization and user in the operation itself.
- [ADR 0002](../ADRs/0002-url-addressable-routing-and-history-safe-navigation.md) and [ADR 0004](../ADRs/0004-use-react-router-for-frontend-navigation.md): The dashboard, list, detail, create, edit, and due views are URL-addressable. List filters and the chart Amended toggle live in the URL.
- [ADR 0003](../ADRs/0003-use-a-shared-placeholder-for-planned-features.md): Any deferred capability shown in the UI (for example, automatic price lookup) uses the shared placeholder.
- [ADR 0005](../ADRs/0005-adopt-tailwind-css-and-shadcn-ui-for-frontend-ui.md): UI uses Tailwind semantic tokens and shadcn/ui primitives. Charts use the shadcn/ui Chart component (Recharts-based, added through the shadcn CLI) with semantic chart color tokens. No other chart or component library is introduced.
- [ADR 0006](../ADRs/0006-use-sunday-through-saturday-weeks.md): Weekly chart groupings use Sunday–Saturday weeks. The **End of week** preset resolves to the last trading day within the current Sunday–Saturday week, so it stays consistent with the ADR while matching the trading week.
- [ADR 0012](../ADRs/0012-defer-wysiwyg-engine-selection-behind-an-owned-markdown-editor.md): No WYSIWYG editor exists. Reasoning and outcome notes use a plain text area for direct Markdown authoring and the existing `MarkdownViewer` for display, the same as the Journal; text is saved exactly as entered. No WYSIWYG entry point is offered. ADR 0007 is superseded, and ADR 0008 applies only to WYSIWYG editing, so neither applies here.
- [ADR 0014](../ADRs/0014-require-delete-backup-review-for-profile-related-data.md): Predictions are profile-related data and must be covered by backup and delete.
- [ADR 0015](../ADRs/0015-keep-help-content-synchronized-with-feature-changes.md): Help content ships with the feature.
- [ADR 0016](../ADRs/0016-restrict-deletion-of-referenced-securities.md): Predictions reference securities by stable identity. Referenced securities cannot be deleted, and deletion never cascades.
- [ADR 0017](../ADRs/0017-standardize-data-grid-list-behaviors.md): The prediction list follows the standard grid behaviors, including the "Showing N of T predictions" status line.
- Security Master alignment: [0008](0008-organization-security-master.md) deferred the question of whether inactive securities are selectable in other features. This spec decides that they are not selectable for new predictions.
- No conflicts with applicable ADRs have been identified.

## UX handoff context

The detailed routes, journeys, state tables, and API-facing contract are in the [Intuition Ledger UX flow](../uxd/flows/0009-intuition-ledger.md), with a static [prototype](../uxd/prototypes/0009-intuition-ledger.html).

- **Target users:** Individual investors who want to test and improve their market intuition.
- **User goals:** Capture a prediction in seconds; come back when it is due and record what happened; see whether their confidence is well calibrated and where they are most accurate.
- **Core workflow intent:**
  - Create a prediction in a fast, sentence-like flow ("I predict [MSFT] will [rise] [1%] by [End of week]").
  - Review due predictions and record results.
  - Browse and filter the full ledger.
  - Review the dashboard.
- **Navigation:** An **Intuition Ledger** link in the **Learning** group, next to Journal, showing the due count.
- **Permissions and visibility:** Strictly private to the creating user. No shared or organization-wide views.
- **Terminology:**
  - Use "Intuition Ledger" for the feature and "prediction" for a record.
  - Use "Correct", "Incorrect", "Void", and "Amended" exactly.
  - Use "price at prediction", "predicted price", and "actual price" consistently.
  - Use "Rises" and "Falls" for direction.
  - Do not use "Partial" anywhere.
  - Do not describe predictions or results as advice.
- **Known edge cases:**
  - A security becomes inactive after it is used in a prediction.
  - An Other symbol matches an active Security Master symbol (FR 6).
  - Very low-priced securities need 4-decimal precision.
  - A prediction is created outside market hours, or on a non-trading day.
  - An exchange holiday falls on a preset deadline. The MVP treats it as a trading day; the user can pick a custom date.
  - A deadline passes with no result recorded.
  - A resolved prediction is later amended, re-resolved, or voided.
  - The dashboard has few or no resolved predictions.
- **Business constraints:** All prices are entered manually. No market-data or market-calendar dependency in this release.
- **Usability-test targets (not product requirements):**
  - A user can create a price-based prediction in under 30 seconds.
  - A user can resolve a due prediction from the due queue without navigating elsewhere.

## Assumptions

These low-risk assumptions were made while turning the brief into requirements. The user confirmed assumptions A1-A11 on 2026-09-27.

- **A1:** Deadlines are dates, not times. A prediction becomes Due after the end of the deadline day in the user's timezone.
- **A2:** For the Direction suggestion, no price change suggests Incorrect.
- **A3:** Once Amended, a prediction stays Amended even if its claim is reverted.
- **A4:** Claim fields remain editable after a result is recorded. Such edits follow the same Amended rule.
- **A5:** Amended predictions are included in charts and the hit rate by default, and the user can exclude them.
- **A6:** The default list status filter shows all non-void predictions.
- **A7:** Tags are free text and private to the user. Tag-based chart breakdowns are not required in this release.
- **A8:** Other-symbol and tag suggestions come only from the user's own predictions, not from other users in the organization.
- **A9:** Hit-rate-over-time charts group by resolution date.
- **A10:** The actual price is optional when recording a result, because the result is the user's judgment. Predictions without an actual price are left out of the predicted-vs-actual chart only.
- **A11:** Trading days are Monday–Friday until an exchange calendar is available (TD-021). TD-021 depends on the exchange calendar service (TD-022).

## Open questions

None. Open question 1 (early Correct for Percent move) was resolved on 2026-09-27: Percent move allows an early Correct.

## Definition of done

- Users can create, view, list, filter, edit, resolve, void, restore, and delete (voided only) their own predictions.
- Measurable predictions capture the price at prediction, the price-captured timestamp, and, where applicable, the predicted price and %. The actual price can be recorded at resolution.
- Amended detection, the 5-minute grace window with its countdown, the confirmation, the badge, and amendment history work as specified.
- Result changes are kept in the result history and shown on the detail view.
- The reasoning field is visible by default on create and edit, and reasoning edits after the grace window are kept in the reasoning history and shown on the detail view.
- Suggested results follow the rules when an actual price is entered, and the user can override them.
- The dashboard shows summary counts, hit rate, and the five required charts, each with a table alternative, with an Amended include/exclude toggle.
- The navigation link shows the due count.
- Predictions are private to their creator and scoped by organization.
- Predictions are covered by profile backup and delete.
- Referenced securities cannot be deleted.
- Help content is published.
- TD-019, TD-020, TD-021, and TD-022 remain tracked for deferred work.

## Acceptance criteria

1. A user can create a Direction, Percent move, Target price, Event reaction, or Freeform prediction with a deadline and a 50–100% confidence.
2. The security dropdown lists only the organization's active Security Master records. Inactive securities cannot be newly selected, but existing references to them still display.
3. Choosing **Other** accepts a free-text symbol, saves it trimmed and uppercase, and offers suggestions from the user's previously used Other symbols.
4. Typing an Other symbol that matches an active Security Master symbol offers to use the Security Master record, without blocking save.
5. Event reaction requires a security. Freeform is available for predictions that are not about a security.
6. A measurable prediction cannot be saved without a price at prediction greater than zero. Percent move and Target price predictions cannot be saved without a move size or predicted/target price.
7. Entering MSFT at 420.00, Rises, 1% shows a predicted price of 424.20. Entering NVDA at 140.00 with a 150.00 target shows "rises 7.14%". Both values are stored, and no currency symbol is shown.
8. Move size is entered without a sign; direction is chosen as Rises or Falls, or derived from an entered predicted or target price. A contradictory direction cannot be entered.
9. Price input accepts the user's locale decimal format and at least 4 decimal places.
10. **End of week** resolves to the last weekday in the current Sunday–Saturday week, and **End of month** resolves to the last weekday of the month, rolling forward when none remain. The resolved date is shown before saving.
11. During the first 5 minutes, the edit form shows the remaining grace time, and claim edits do not mark the prediction Amended. After 5 minutes, saving a claim change asks for confirmation and then marks it Amended; cancelling saves nothing. The original claim remains viewable.
12. Editing reasoning, tags, or outcome details never marks a prediction Amended.
12a. The reasoning text area, labelled "Why do you think this will happen? (optional)", is visible without expanding anything on create and edit. A prediction saves without reasoning. Markdown typed into it is shown formatted on the detail view and saved exactly as entered.
12b. Editing reasoning within 5 minutes of creation leaves no history. Editing it after 5 minutes adds a reasoning-history entry with the previous and new text, the detail view shows "Reasoning edited on {date}", and the original reasoning remains viewable. No badge is added and stats are unchanged.
13. Before the deadline, only Target price and Percent move predictions can be recorded, and only as Correct. Other types, or Incorrect for any type, show "The deadline hasn't passed yet."
14. The user can record Correct or Incorrect with or without an actual price. When an actual price is entered, a suggested result follows the rules, and the user can override it.
15. A Percent move prediction whose actual price moved in the right direction but fell short of the predicted price is suggested as Incorrect.
16. A Target price prediction whose entered high (rises) or low (falls) touched the target is suggested as Correct.
17. Changing or clearing a result is kept in the result history and the detail view shows "Result changed on {date}".
18. No Partial result exists anywhere in the feature.
19. A user can void a prediction, restore it, and delete it only while it is voided, after confirmation.
20. Voided predictions are excluded from the hit rate and calibration.
21. Hit rate equals Correct ÷ (Correct + Incorrect) and shows as not available when there is no qualifying data.
22. The dashboard shows summary counts; hit rate over time by week (Sunday–Saturday) and month; calibration by confidence bucket; results by type; results by symbol (top 10 in the chart, all in the table); and predicted vs. actual % change. All charts respond to the Amended toggle.
23. The calibration chart shows the count per bucket and, when any bucket has fewer than 5 predictions, a note that those buckets aren't yet meaningful. The chart is still shown.
24. Results-by-symbol groups a Security Master MSFT and an Other MSFT together.
25. Every chart has a "View as table" alternative. Results use text and an icon, and price direction is not colored as good or bad.
26. The list follows ADR 0017, with URL-owned search and filters (including tag), a visible default status filter, and a "Showing N of T predictions" line.
27. The due queue lists open predictions whose deadline has passed, oldest first, and the navigation link shows the due count as text.
28. A user cannot see, count, or modify another user's predictions, whether in the same organization or a different one.
29. Deleting a Security Master record referenced by any prediction, including a voided one, is blocked with a clear explanation.
30. A profile backup includes the profile's predictions, amendment history, result history, reasoning history, and outcomes, and deleting the profile removes them without deleting any securities.
31. Charts use the shadcn/ui Chart component. No other chart library is added.
32. Help content for the Intuition Ledger is available.

## Revision notes

Reasoning decisions applied on 2026-09-27 (later the same day):

- Reasoning is a free-form text area shown by default, labelled "Why do you think this will happen? (optional)" (FR 11, AC 12a).
- Reasoning edits after the 5-minute grace window are kept in a reasoning history and shown on the detail view, with no Amended badge and no stats effect (FR 19a, AC 12b). Backup, delete, and search include reasoning (FR 30, 33, 47; AC 30).
- Corrected the editor reference: no Markdown or WYSIWYG editor exists. Notes use a plain text area for direct Markdown, displayed formatted with `MarkdownViewer`, per ADR 0012. ADR 0007 (superseded) and ADR 0008 (WYSIWYG only) no longer cited.

UX review decisions applied on 2026-09-27:

- User confirmed assumptions A1-A11; open question 1 is resolved with Percent move allowing an early Correct before the deadline. Deferred work references now include TD-022 as the exchange calendar service dependency.
- Percent move and other results are the user's judgment; the user decides whether and when the goal was hit. The actual price is optional and drives a suggestion only.
- Event reaction requires a security; event predictions without a security use Freeform. Event deadlines are approximate.
- Result changes are kept in a result history, shown on the detail view, with no badge.
- Before the deadline, Target price and Percent move can be recorded, and only as Correct; other types, or Incorrect for any type, show "The deadline hasn't passed yet."
- A grace-window countdown and a confirmation before an edit marks a prediction Amended.
- Calibration shows counts per bucket and a "not yet meaningful" note, and is always shown.
- Deadline presets: End of today, End of week (last trading day of the week), End of month (last trading day of the month), and Custom date. Trading days are Monday–Friday until TD-021; TD-021 depends on the exchange calendar service in TD-022.
- Direction is Rises/Falls with an unsigned move size.
- Other symbols matching the Security Master prompt to use the Security Master record; charts group by normalized symbol.
- Prices show no currency symbol and accept locale decimal input.
- Prices greater than zero moved into a functional requirement.
- "Under 30 seconds" became a usability-test target.
- Accessibility and inclusion: chart table alternatives, non-color result cues, uncolored price direction, neutral performance copy, and a due count on the navigation link.
- Also added: tag filter and suggestions, Learning navigation placement, and top-10 symbol chart.

## Readiness

**Ready for implementation planning.** The business objective, scope, scoring and suggestion rules, price capture, amendment and result-history rules, void/delete lifecycle, privacy, accessibility requirements, and ADR constraints are defined. The UX flow and prototype are available. No open questions remain, and assumptions A1–A11 are confirmed. Deferred work is tracked in TD-019 (Journal integration), TD-020 (market-pricing API), TD-021 (exchange calendar), and TD-022 (exchange calendar service).
