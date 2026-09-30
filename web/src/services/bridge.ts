// 로컬 connect-ai Bridge(:4825) — 지식/스킬 주입. 익스텐션 또는 데스크톱 앱이 켜져 있어야 함.
const BRIDGE = (import.meta.env.VITE_BRIDGE_URL as string | undefined) ?? 'http://127.0.0.1:4825';

export interface BridgeStatus { ok: boolean; version?: string; brainFiles?: number; }

export async function ping(): Promise<BridgeStatus> {
  try {
    const r = await fetch(`${BRIDGE}/ping`, { signal: AbortSignal.timeout(1500) });
    const d = await r.json();
    return { ok: d.app === 'connect-ai-bridge', version: d.version, brainFiles: d.brain?.fileCount };
  } catch { return { ok: false }; }
}

/** 지식 팩(마크다운) → <brain>/00_Raw/날짜/<title>.md */
export async function injectKnowledge(title: string, markdown: string) {
  const r = await fetch(`${BRIDGE}/api/brain-inject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, markdown }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
  return r.json() as Promise<{ success: boolean; filePath: string }>;
}

/** 스킬(Python 도구) → _agents/<agent>/tools/<name>.py */
export async function injectSkill(p: { agent: string; name: string; script: string; displayName?: string; description?: string; readme?: string }) {
  const r = await fetch(`${BRIDGE}/api/skill-inject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...p, source: 'gmf-labs' }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
  return r.json();
}
