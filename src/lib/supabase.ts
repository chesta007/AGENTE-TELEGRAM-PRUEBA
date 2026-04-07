/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no definidas. Verifica tu .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Helpers de Multi-Tenancy para el Frontend ───────────────────────────────

// Cache simple para evitar re-queries en cada operación del dashboard
let _defaultOrgIdCache: number | null = null;

/**
 * Obtiene el ID de la organización default (BIGINT → JS number).
 * Fase 2: cuando haya Supabase Auth, esto vendrá del JWT del usuario.
 * Por ahora resuelve siempre la org con slug='default'.
 */
export async function getDefaultOrgId(): Promise<number | null> {
  if (_defaultOrgIdCache !== null) return _defaultOrgIdCache;

  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'default')
    .maybeSingle();

  if (error || !data) {
    console.error('[Supabase] No se encontró la organización default:', error?.message);
    return null;
  }

  // Supabase JS devuelve BIGINT como string en algunos drivers — forzar número
  _defaultOrgIdCache = Number(data.id);
  return _defaultOrgIdCache;
}
