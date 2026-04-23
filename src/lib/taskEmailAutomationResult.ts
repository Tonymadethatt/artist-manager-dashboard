/** Result of `queueEmailAutomationForCompletedTask` (optional lead bulk stats for UI). */
export type TaskEmailAutomationResult = {
  ok: boolean
  reason: string
  leadBulkStats?: { sent: number; failed: number; skipped: number }
}
