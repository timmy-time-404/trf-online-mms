import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Using mock mode.');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:5173',
  supabaseKey || 'mock-key'
);

// Helper untuk cek apakah Supabase tersedia
export const isSupabaseEnabled = () => {
  return !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('localhost');
};