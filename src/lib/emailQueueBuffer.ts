/** Sync copies in netlify/functions/process-email-queue.ts when changing presets. */
export const EMAIL_QUEUE_BUFFER_OPTIONS = [5, 10, 15, 20, 30] as const
export type EmailQueueBufferMinutes = (typeof EMAIL_QUEUE_BUFFER_OPTIONS)[number]

export const DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES: EmailQueueBufferMinutes = 10

export const MIN_EMAIL_QUEUE_BUFFER_MINUTES: EmailQueueBufferMinutes =
  EMAIL_QUEUE_BUFFER_OPTIONS[0]

export function clampEmailQueueBufferMinutes(value: unknown): EmailQueueBufferMinutes {
  const n = typeof value === 'number' && Number.isFinite(value)
    ? value
    : parseInt(String(value), 10)
  if (EMAIL_QUEUE_BUFFER_OPTIONS.includes(n as EmailQueueBufferMinutes)) {
    return n as EmailQueueBufferMinutes
  }
  return DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES
}
