import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../logger';
import type { UserSession } from '../../shared/types';

// Load environment variables from .env.local and .env
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

let supabaseClientInstance: SupabaseClient | null = null;

// Default authenticated user ID for desktop sessions
const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000001';
let currentUserId = DEFAULT_USER_ID;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isRealSupabaseConfigured) {
    return null;
  }

  if (!supabaseClientInstance) {
    logger.info('Supabase', `Initializing client with URL: ${supabaseUrl}`);
    supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseClientInstance;
}

export function getServiceRoleClient(): SupabaseClient | null {
  if (!isRealSupabaseConfigured || !supabaseServiceRoleKey || supabaseServiceRoleKey.includes('your-service-role-key')) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getCurrentUserSession(): UserSession {
  return {
    userId: currentUserId,
    email: 'creator@autocaption.local',
    isAuthenticated: true,
    isOfflineMock: !isRealSupabaseConfigured,
  };
}

export function setCustomUserId(userId: string): void {
  currentUserId = userId;
}

export function resetDefaultUserId(): void {
  currentUserId = DEFAULT_USER_ID;
}
