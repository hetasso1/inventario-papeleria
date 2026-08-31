import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Supabase client for browser-side usage.
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
