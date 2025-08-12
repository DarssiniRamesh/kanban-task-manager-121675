import { createClient } from '@supabase/supabase-js';

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  // You may want to put these in env vars for production.
  const SUPABASE_URL = 'https://tgugqsvmguzibckxrlrk.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndWdxc3ZtZ3V6aWJja3hybHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0ODE4MjMsImV4cCI6MjA3MDA1NzgyM30.OZO3o1WpVG2SX0LwVf5uDIA0TEzey793UZzc-v7DqqY';
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
