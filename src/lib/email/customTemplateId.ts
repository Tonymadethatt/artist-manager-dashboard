export const CUSTOM_EMAIL_TYPE_PREFIX = 'custom:' as const

export function customEmailTypeValue(id: string): string {
  return `${CUSTOM_EMAIL_TYPE_PREFIX}${id}`
}

/** Returns UUID string after `custom:` or null if not a custom template reference. */
export function parseCustomTemplateId(emailType: string | null | undefined): string | null {
  if (!emailType || !emailType.startsWith(CUSTOM_EMAIL_TYPE_PREFIX)) return null
  const id = emailType.slice(CUSTOM_EMAIL_TYPE_PREFIX.length)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null
  return id
}

export function isCustomEmailType(emailType: string | null | undefined): boolean {
  return parseCustomTemplateId(emailType) !== null
}
