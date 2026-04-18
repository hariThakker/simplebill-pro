import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qblpecdpudamykvgqalx.supabase.co';
const supabaseKey = 'sb_publishable_tlMLvbA4DsJnIrXWVMVbqA_KuSKdjel';

export const supabase = createClient(supabaseUrl, supabaseKey);
