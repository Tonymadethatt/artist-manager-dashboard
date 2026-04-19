import type { NavZoneForAmbient } from './navCategory'

type HeaderAmbientProps = {
  zone: NavZoneForAmbient
}

/**
 * Soft blurred gradient orbs behind the header title — zone hue matches sidebar categories.
 */
export function HeaderAmbient({ zone }: HeaderAmbientProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <div
        className="header-ambient-orbs absolute inset-[-40%_-20%] mix-blend-plus-lighter"
        data-zone={zone}
      >
        <div className="header-orb header-orb-a" />
        <div className="header-orb header-orb-b" />
        <div className="header-orb header-orb-c" />
      </div>
    </div>
  )
}
