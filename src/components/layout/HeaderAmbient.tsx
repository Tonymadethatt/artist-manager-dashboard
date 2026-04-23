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
        className="header-ambient-orbs absolute -inset-[45%] min-h-[220%] min-w-[160%] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        data-zone={zone}
      >
        <div className="header-orb header-orb-a" />
        <div className="header-orb header-orb-b" />
        <div className="header-orb header-orb-c" />
        <div className="header-orb header-orb-d" />
      </div>
    </div>
  )
}
