// Firebase RTDB REST — connect-ai/src/plaza.ts 와 같은 스키마.
// 웹은 EventSource(SSE)로 실시간 구독, 쓰기는 REST POST/PUT.
const DB = (import.meta.env.VITE_PLAZA_DB_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const ROOM = 'lobby';
const path = (p: string) => `${DB}/plaza/rooms/${ROOM}/${p}.json`;

export interface PlazaMessage {
  uid: string; company: string; emoji: string;
  role: string; text: string; ts: number;
}
export interface PlazaPresence {
  uid: string; company: string; emoji: string;
  agents: string[]; source: 'web' | 'connect-ai'; ts: number;
}

export const plazaConfigured = () => DB.startsWith('https://');

/** SSE 구독 — RTDB는 put/patch 이벤트로 전체/부분 스냅샷을 준다. */
export function subscribe<T>(sub: 'messages' | 'presence', onData: (map: Record<string, T>) => void) {
  const state: Record<string, T> = {};
  const es = new EventSource(path(sub));
  const apply = (p: string, data: unknown) => {
    if (p === '/') { Object.keys(state).forEach(k => delete state[k]); Object.assign(state, (data as Record<string, T>) ?? {}); return; }
    const key = p.replace(/^\//, '').split('/')[0];
    if (data === null) delete state[key]; else state[key] = { ...(state[key] as object), ...(data as object) } as T;
  };
  const handler = (e: MessageEvent) => {
    const { path: p, data } = JSON.parse(e.data);
    apply(p, data);
    onData({ ...state });
  };
  es.addEventListener('put', handler);
  es.addEventListener('patch', handler);
  return () => es.close();
}

export async function postMessage(m: Omit<PlazaMessage, 'ts'>) {
  await fetch(path('messages'), { method: 'POST', body: JSON.stringify({ ...m, ts: Date.now() }) });
}
export async function putPresence(p: Omit<PlazaPresence, 'ts'>) {
  await fetch(path(`presence/${p.uid}`), { method: 'PUT', body: JSON.stringify({ ...p, ts: Date.now() }) });
}
export async function deletePresence(uid: string) {
  await fetch(path(`presence/${uid}`), { method: 'DELETE' });
}

export function webUid(): string {
  const k = 'gmf.plaza.uid';
  let v = localStorage.getItem(k);
  if (!v) { v = 'web-' + Math.random().toString(36).slice(2, 9); localStorage.setItem(k, v); }
  return v;
}
