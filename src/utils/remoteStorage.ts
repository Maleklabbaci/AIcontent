import { ensureSupabaseUser, supabase } from '../lib/supabase';

export interface RemoteSessionMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  images?: string[];
  design?: unknown;
  suggestions?: string[];
}

export interface RemoteSession {
  id: string;
  title: string;
  format: string;
  previewText: string;
  lastUpdated: string;
  messages: RemoteSessionMessage[];
}

interface RemoteSessionRow {
  id: string;
  title: string;
  format: string;
  preview_text: string;
  updated_at: string;
  messages: RemoteSessionMessage[];
}

export async function loadRemoteSessions(): Promise<RemoteSession[]> {
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from('aura_sessions')
    .select('id,title,format,preview_text,updated_at,messages')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return ((data || []) as RemoteSessionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    format: row.format,
    previewText: row.preview_text,
    lastUpdated: row.updated_at,
    messages: Array.isArray(row.messages) ? row.messages : [],
  }));
}

export async function saveRemoteSession(session: RemoteSession): Promise<void> {
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return;

  const { error } = await supabase.from('aura_sessions').upsert(
    {
      id: session.id,
      user_id: user.id,
      title: session.title,
      format: session.format,
      preview_text: session.previewText,
      messages: session.messages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

export async function deleteRemoteSession(id: string): Promise<void> {
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return;

  const { error } = await supabase.from('aura_sessions').delete().eq('id', id);
  if (error) throw error;
}
