import { describe, expect, it } from 'vitest'
import {
  resolveVenueRecipientDisplayNameForPayload,
  resolveVenueRecipientSalutationFirstName,
} from './resolveVenueRecipientGreeting'

describe('resolveVenueRecipientSalutationFirstName', () => {
  it('uses first word of a real name', () => {
    expect(
      resolveVenueRecipientSalutationFirstName({
        name: 'Alex Johnson',
        email: 'alex@venue.com',
      }),
    ).toBe('Alex')
  })

  it('never uses email as salutation when name matches email', () => {
    expect(
      resolveVenueRecipientSalutationFirstName({
        name: 'buyer@venue.com',
        email: 'buyer@venue.com',
      }),
    ).toBe('there')
  })

  it('uses there when name is empty', () => {
    expect(
      resolveVenueRecipientSalutationFirstName({
        name: '',
        email: 'buyer@venue.com',
      }),
    ).toBe('there')
  })
})

describe('resolveVenueRecipientDisplayNameForPayload', () => {
  it('returns empty when name equals email', () => {
    expect(
      resolveVenueRecipientDisplayNameForPayload({
        name: 'buyer@venue.com',
        email: 'buyer@venue.com',
      }),
    ).toBe('')
  })

  it('returns trimmed name when valid', () => {
    expect(
      resolveVenueRecipientDisplayNameForPayload({
        name: 'Sam Director',
        email: 'sam@venue.com',
      }),
    ).toBe('Sam Director')
  })
})
