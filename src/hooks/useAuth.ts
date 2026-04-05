import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // #region agent log
      fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b97826'},body:JSON.stringify({sessionId:'b97826',location:'useAuth.ts:getSession',message:'auth session result',data:{hasSession:!!session,hasUser:!!session?.user,error:error?.message??null},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, loading, signIn, signOut }
}
