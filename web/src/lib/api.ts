const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const API = `${BASE}/api`;

/* 백엔드 파일을 <img>·<iframe>·pdf.js 에 직접 물릴 때 쓰는 절대 경로.
   fetchJSON 과 같은 베이스를 써야 개발 프록시와 배포가 같이 맞는다. */
export function apiUrl(path: string): string {
  return API + path;
}

export async function fetchJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 200) || r.statusText}`);
  }
  return r.json();
}

export function postJSON<T = any>(path: string, body: object): Promise<T> {
  return fetchJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
