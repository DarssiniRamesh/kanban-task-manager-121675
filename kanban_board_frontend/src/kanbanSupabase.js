import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Read required Supabase configuration from CRA environment variables.
 * This avoids committing credentials to the repository and allows per-environment configuration.
 */
function readSupabaseConfigFromEnv() {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // eslint-disable-next-line no-console
    console.error(
      '[Supabase] Missing configuration. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment.'
    );
    return { url: null, anonKey: null };
  }

  return { url, anonKey };
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /**
   * Returns a singleton Supabase client instance for the browser.
   *
   * Env vars (Create React App):
   * - REACT_APP_SUPABASE_URL
   * - REACT_APP_SUPABASE_ANON_KEY
   *
   * Throws if configuration is missing to fail fast and make setup issues obvious.
   */
  if (_client) return _client;

  const { url, anonKey } = readSupabaseConfigFromEnv();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.'
    );
  }

  _client = createClient(url, anonKey);
  return _client;
}
