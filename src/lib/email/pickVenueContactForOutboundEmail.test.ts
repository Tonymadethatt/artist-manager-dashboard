import { describe, expect, it } from 'vitest'
import { pickVenueContactForOutboundEmail } from './pickVenueContactForOutboundEmail'

describe('pickVenueContactForOutboundEmail', () => {
  it('returns first contact with a non-empty email in list order', () => {
    const a = pickVenueContactForOutboundEmail([
      { id: '1', email: null },
      { id: '2', email: '  a@x.com ' },
      { id: '3', email: 'b@x.com' },
    ])
    expect(a?.id).toBe('2')
  })

  it('returns null when no email', () => {
    expect(pickVenueContactForOutboundEmail([{ id: '1', email: null }])).toBeNull()
  })
})
