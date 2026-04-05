import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// #region agent log
fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b97826'},body:JSON.stringify({sessionId:'b97826',location:'supabase.ts:8',message:'env var check',data:{urlPresent:!!supabaseUrl,keyPresent:!!supabaseAnonKey,urlValue:supabaseUrl?.slice(0,30)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
// #endregion

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key'
)
