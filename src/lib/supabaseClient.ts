import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables (or injected process.env via vite define / node)
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';
const supabaseUrl: string = envUrl.trim();
const supabaseAnonKey: string = envKey.trim();

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string;
  hasKey: boolean;
  error?: string;
}

/**
 * Validates the current Supabase configuration without throwing.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    return {
      isConfigured: false,
      url: supabaseUrl,
      hasKey: Boolean(supabaseAnonKey),
      error: `Missing required Supabase environment variable(s): ${missing.join(', ')}`,
    };
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('http')) {
      return {
        isConfigured: false,
        url: supabaseUrl,
        hasKey: Boolean(supabaseAnonKey),
        error: `Invalid VITE_SUPABASE_URL: must start with https:// or http:// (received: "${supabaseUrl}")`,
      };
    }
  } catch {
    return {
      isConfigured: false,
      url: supabaseUrl,
      hasKey: Boolean(supabaseAnonKey),
      error: `Invalid VITE_SUPABASE_URL: "${supabaseUrl}" is not a valid URL`,
    };
  }

  return {
    isConfigured: true,
    url: supabaseUrl,
    hasKey: true,
  };
}

let clientInstance: SupabaseClient | null = null;

/**
 * Returns the Supabase client instance or throws a clear runtime error.
 * No silent fallback or mock client is used.
 */
export function getSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(status.error || 'Supabase is not configured.');
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return clientInstance;
}

export { supabaseUrl, supabaseAnonKey };
