import { createContext, useContext } from 'react'
import { useNavBadgesData, type NavBadgeCounts } from '@/hooks/useNavBadgesData'

interface NavBadgesContextValue {
  counts: NavBadgeCounts
  markSeen: (section: string) => Promise<void>
  /** Re-fetch badge counts (e.g. after calendar-eligible deal/venue changes). */
  refreshNavBadges: () => Promise<void>
}

const NavBadgesContext = createContext<NavBadgesContextValue>({
  counts: { pipeline: 0, 'show-reports': 0, calendar: 0, 'email-queue': 0 },
  markSeen: async () => {},
  refreshNavBadges: async () => {},
})

interface NavBadgesProviderProps {
  children: React.ReactNode
  /** Pass location.pathname so counts refresh on every navigation. */
  pathname: string
}

export function NavBadgesProvider({ children, pathname }: NavBadgesProviderProps) {
  const { counts, markSeen, refresh } = useNavBadgesData(pathname)

  return (
    <NavBadgesContext.Provider value={{ counts, markSeen, refreshNavBadges: refresh }}>
      {children}
    </NavBadgesContext.Provider>
  )
}

/** Consume badge counts and markSeen from any component inside the Shell. */
export function useNavBadges() {
  return useContext(NavBadgesContext)
}
