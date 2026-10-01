import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * « Se souvenir de moi » (case de la page d'auth, clé `aura_auth_remember`).
 * - '1' (défaut) : session persistée dans localStorage → l'utilisateur reste
 *   connecté même après fermeture du navigateur.
 * - '0' : session stockée dans sessionStorage → la session est effacée dès que
 *   l'onglet est fermé.
 */
export const AUTH_REMEMBER_KEY = 'aura_auth_remember';

export function readAuthRemember(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_REMEMBER_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function writeAuthRemember(remember: boolean): void {
  try {
    localStorage.setItem(AUTH_REMEMBER_KEY, remember ? '1' : '0');
  } catch {}
}

const sessionStorageAdapter =
  typeof window !== 'undefined' && !readAuthRemember() ? window.sessionStorage : undefined;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Décoché = session volée : elle disparaît à la fermeture de l'onglet.
        ...(sessionStorageAdapter ? { storage: sessionStorageAdapter } : {}),
      },
    })
  : null;

/**
 * Uses an anonymous Supabase Auth identity so the app can persist projects
 * without asking for an email or exposing a service-role key in the browser.
 * If anonymous sign-in is disabled, callers can safely keep using localStorage.
 *
 * Depuis l'auth obligatoire, cette fonction ne crée une identité anonyme que si
 * aucune session n'existe — sinon elle renvoie simplement l'utilisateur connecté.
 */
export async function ensureSupabaseUser(): Promise<User | null> {
  if (!supabase) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

/** Jeton d'accès de la session courante (envoyé au Worker pour la bibliothèque de templates partagée). */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
