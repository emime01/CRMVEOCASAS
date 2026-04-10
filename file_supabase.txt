import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nrpgykebktypuvidovsz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_GphjR_dNdLY77M92KY4D5w_Hajfdiaq'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
