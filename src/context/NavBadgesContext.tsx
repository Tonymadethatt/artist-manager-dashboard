import { createContext, useContext } from 'react'
import { useNavBadgesData, type NavBadgeCounts } from '@/hooks/useNavBadgesData'

interface NavBadgesContextValue {
  counts: NavBadgeCounts
  markSeen: (section: string) => Promise<void>
}

const NavBadgesContext = createContext<NavBadgesContextValue>({
  counts: { pipeline: 0, 'show-reports': 0, calendar: 0, 'email-queue': 0 },
  markSeen: async () => {},
})

interface NavBadgesProviderProps {
  children: React.ReactNode
  /** Pass location.pathname so counts refresh on every navigation. */
  pathname: string
}

export function NavBadgesProvider({ children, pathname }: NavBadgesProviderProps) {
  const { counts, markSeen } = useNavBadgesData(pathname)

  return (
    <NavBadgesContext.Provider value={{ counts, markSeen }}>
      {children}
    </NavBadgesContext.Provider>
  )
}

/** Consume badge counts and markSeen from any component inside the Shell. */
export function useNavBadges() {
  return useContext(NavBadgesContext)
}
