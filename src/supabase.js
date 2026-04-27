import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qblpecdpudamykvgqalx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibHBlY2RwdWRhbXlrdmdxYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDA4MDIsImV4cCI6MjA5MjA3NjgwMn0.6Xpj4lRB6NHZ9w0o7bR-N3wosFrfFU0U5m-hHU-mDtE';

export const supabase = createClient(supabaseUrl, supabaseKey);
