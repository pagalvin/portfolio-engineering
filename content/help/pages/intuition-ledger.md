# Intuition Ledger

Use the Intuition Ledger to record a private prediction, track when it is due, and compare your confidence with what actually happened.

This is a record of your own reasoning and outcomes. It is not financial advice, market guidance, or a trading recommendation.

## What the ledger records

A prediction includes the subject, prediction type, deadline, confidence, and any supporting details or price inputs that fit that type.

Common prediction types in the ledger include:

- Direction: predict that a security will rise or fall.
- Percent move: predict a percentage change by a date.
- Target price: predict a security will reach a specific price.
- Event reaction: predict how a security will react to an event or headline.
- Freeform: record a prediction in your own words.

The deadline presets are intentionally simple: End of today, This Friday, End of month, and Custom date. Deadlines use the date you choose, and in this release they follow Monday through Friday trading days only. Holidays and exchange closures are not recognized yet.

## Why the reasoning field matters

The field labeled "Why do you think this will happen? (optional)" is for the explanation behind the prediction. It is not a claim field. It does not change what you predicted; it explains why you believed it.

You can write plain text or Markdown in the reasoning field. The reader renders Markdown so headings, lists, and emphasis can be displayed clearly. If you edit the reasoning later, those changes are kept in reasoning history.

Reasoning history is the record of edits to the explanation after the 5-minute grace window. It helps you see what changed without altering the original prediction claim. Editing reasoning does not mark a prediction as Amended.

## Grace window and Amended

When a prediction is first created, the ledger gives you a 5-minute grace window. During that time, you can correct a typo or obvious mistake without the prediction being marked as Amended.

After the grace window ends, changes to a claim field mark the prediction as Amended. The ledger keeps amendment history so you can compare the original claim with the later version. This makes it easier to spot where the original prediction changed and why.

The grace window applies to the claim itself. A later edit to the reasoning field is not treated as a claim change, so it does not set the Amended state.

## Results, result history, and voiding

When a prediction is due, you can record the result as Correct or Incorrect.

Once a result is recorded, later result changes are retained in result history. This gives you a clear record of when the outcome was updated and what changed.

A prediction can also be marked Void. Void means the prediction cannot be scored fairly. Voided predictions stay in the ledger for reference, but they are excluded from hit rate and calibration statistics. If you no longer want to keep a voided prediction, you can delete it permanently only after it is voided.

## Early Correct rules

For Target price and Percent move predictions, an early Correct can count only before the deadline. For these types, a result is only eligible for early Correct before the deadline expires. If the price or move is being evaluated after the deadline, you should record the outcome in the due queue or detail view after the deadline passes.

## Due queue and list totals

The due queue shows predictions whose deadline has passed and that still need a result.

The list footer can show "Showing N of T predictions." Here, N is the number currently visible after filters, and T is all of your predictions in the ledger, including voided predictions. This total is not limited to just the visible subset.

## Dashboard and charts

The Intuition Ledger dashboard summarizes your predictions and gives you a neutral view of how you are doing.

- Summary tiles show open, due, resolved, voided, and hit rate counts.
- Hit rate shows the share of resolved predictions that were Correct. When there is not enough data, the chart says "Not available yet."
- Calibration compares your stated confidence with your actual hit rate by confidence bucket.
- The calibration view shows "n = X" under each bucket to indicate how many predictions are in that bucket.
- Buckets with fewer than 5 predictions are de-emphasized, because they are not yet meaningful enough to interpret strongly.

## Neutral use and limits

This feature is for record-keeping and learning. It is not intended to guide trading decisions or to make market calls. It is a private measurement tool for your own patterns and confidence.

This release does not recognize exchange holidays or market closures. Deadlines follow Monday through Friday trading days only, and holidays are not yet modeled.
