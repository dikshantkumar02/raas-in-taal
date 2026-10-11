import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// If running in standalone script or Next.js app, ensure .env.local is available
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
    } catch {}
  }
}

// In unit test suites, avoid polluting the live production Supabase instance with mock user accounts
const isUnitTesting = (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test') && process.env.TEST_PERSISTENCE !== 'true';

const supabaseUrl = !isUnitTesting ? (process.env.NEXT_PUBLIC_SUPABASE_URL || '') : '';
const supabaseAnonKey = !isUnitTesting ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') : '';
const supabaseServiceRoleKey = !isUnitTesting ? (process.env.SUPABASE_SERVICE_ROLE_KEY || '') : '';

// Public client for client-side or anon interactions
export const supabasePublic = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin/Service-role client (strictly server-side only)
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
