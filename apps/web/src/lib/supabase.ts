import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const standalone = !!import.meta.env.VITE_API_BASE_URL;

if (!standalone && (!supabaseUrl || !supabaseKey)) {
  console.warn('Missing Supabase environment variables. Using mock mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://disabled.invalid',
  supabaseKey || 'unconfigured',
  standalone ? { global: { fetch: async () => { throw new Error('Legacy data access is unavailable in standalone mode.'); } }, auth: { persistSession: false } } : undefined,
);

// Helper untuk cek apakah Supabase tersedia
export const isSupabaseEnabled = (): boolean => {
  return !standalone && !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('localhost');
};
