export const intuitionLedgerHelpFallbacks = {
  amended: `Amended means a claim field changed after the 5-minute grace window. The original prediction is still preserved in amendment history, and the badge makes it clear that the claim changed later.

This does not include later edits to the reasoning field. Reasoning changes are tracked separately in reasoning history, not as an amendment to the original prediction.`,
  void: `Void means the prediction cannot be scored fairly. Voided predictions stay in the ledger for reference, but they are excluded from hit rate and calibration statistics.

You can restore a voided prediction or delete it permanently only after it has been voided. This is not a trading recommendation or a signal that the original prediction was wrong.`,
  calibration: `Calibration compares your stated confidence with your actual hit rate. Each bucket shows the confidence range and the number of predictions in that bucket, labeled as n = X.

Buckets with fewer than 5 predictions are not yet meaningful enough to treat as a reliable signal. They are de-emphasized to make that limitation clear.`,
  graceWindow: `The grace window is the first 5 minutes after you create a prediction. During this time, you can correct minor mistakes without the prediction being marked as Amended.

After the grace window ends, changes to claim fields are recorded as Amended. Reasoning edits are tracked separately in reasoning history and do not mark the prediction as Amended.

This release uses Monday through Friday trading days only. Holidays and exchange closures are not recognized yet.`,
}