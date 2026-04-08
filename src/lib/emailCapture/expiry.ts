export const EMAIL_CAPTURE_DEFAULT_EXPIRY_DAYS = 90

export function defaultEmailCaptureExpiresAt(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + EMAIL_CAPTURE_DEFAULT_EXPIRY_DAYS)
  return d.toISOString()
}
