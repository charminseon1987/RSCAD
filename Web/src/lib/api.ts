const API = '/api';

export async function fetchJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init);
  return r.json();
}

export function postJSON<T = any>(path: string, body: object): Promise<T> {
  return fetchJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
