/** Builtin artist emails that queue like artist custom (null venue, buffer 0). Netlify must not import this via `@/`-only modules. */
export function isQueuedBuiltinArtistEmailType(emailType: string): boolean {
  return emailType === 'management_report' || emailType === 'retainer_reminder'
}
