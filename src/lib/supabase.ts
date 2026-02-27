import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Using mock mode.');
}

export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabase = createClient(
  supabaseUrl || 'http://localhost:5173',
  supabaseKey || 'mock-key'
);

// Helper untuk cek apakah Supabase tersedia
export const isSupabaseEnabled = () => {
  return !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('localhost');
};

export const getTable = <T extends keyof Database['public']['Tables']>(table: T) => {
  return supabase.from(table);
};