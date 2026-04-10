import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nrpgykebktypuvidovsz.supabase.co'
const SUPABASE_KEY = 'sb_secret_9F1gFDoAAp6ZdQ8rQXT7WQ_DcsYZA8K'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})
