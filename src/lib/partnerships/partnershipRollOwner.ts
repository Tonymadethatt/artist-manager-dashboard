/** Auth user id that owns the shared previous-clients list (must match partnership_roll_public_owner in DB). */
export function getPartnershipRollOwnerId(): string | null {
  const raw = import.meta.env.VITE_PARTNERSHIP_ROLL_OWNER_ID as string | undefined
  const id = raw?.trim()
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }
  return id
}
