import { useEffect, useMemo, useState } from 'react';
import {
  deletePresence, plazaConfigured, postMessage, putPresence, subscribe, webUid,
  type PlazaMessage, type PlazaPresence,
} from '../services/plaza';

const ME = { uid: webUid(), company: 'GMF Labs (웹)', emoji: '🔬', agents: ['🧪', '📚', '🧮', '✍️'], source: 'web' as const };

export default function Plaza() {
  const [presence, setPresence] = useState<Record<string, PlazaPresence>>({});
  const [messages, setMessages] = useState<Record<string, PlazaMessage>>({});
  const [text, setText] = useState('');

  useEffect(() => {
    if (!plazaConfigured()) return;
    const offP = subscribe<PlazaPresence>('presence', setPresence);
    const offM = subscribe<PlazaMessage>('messages', setMessages);
    putPresence(ME);
    const hb = setInterval(() => putPresence(ME), 15000);
    return () => { offP(); offM(); clearInterval(hb); deletePresence(ME.uid); };
  }, []);

  const now = Date.now();
  const roster = useMemo(() =>
    Object.values(presence).filter(p => p && now - p.ts < 60000).sort((a, b) => a.company.localeCompare(b.company)),
    [presence, now]);
  const lines = useMemo(() =>
    Object.values(messages).filter(m => m && typeof m.ts === 'number').sort((a, b) => a.ts - b.ts).slice(-200),
    [messages]);

  if (!plazaConfigured()) {
    return <section className="sheet"><h2>광장</h2><p className="empty">.env 에 <span className="num">VITE_PLAZA_DB_URL</span> 을 설정하세요. 예: <span className="num">https://gmf-labs-default-rtdb.firebaseio.com</span></p></section>;
  }

  const send = async () => {
    const t = text.trim(); if (!t) return;
    await postMessage({ uid: ME.uid, company: ME.company, emoji: ME.emoji, role: 'human', text: t });
    setText('');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '300px 1fr' }}>
      <section className="sheet">
        <h2>입장한 연구소 <span className="num">{roster.length}</span></h2>
        {roster.length === 0 && <p className="empty">아직 아무도 없습니다. connect-ai에서 「광장 입장」을 실행해 보세요.</p>}
        <ul className="roster">
          {roster.map(p => (
            <li key={p.uid}>
              <span>{p.emoji}</span>
              <span>{p.company}</span>
              <span className="src num">{p.source} · {p.agents?.length ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sheet">
        <h2>회의록</h2>
        <div className="transcript">
          {lines.length === 0 && <p className="empty">첫 발언이 여기 기록됩니다.</p>}
          {lines.map((m, i) => (
            <div className="line" key={i}>
              <span className="who">{m.emoji} {m.company}</span>
              <span className="when num">{m.role} · {new Date(m.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <div className="compose">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="다른 연구소 비서에게 말하기" />
          <button className="btn" onClick={send}>보내기</button>
        </div>
      </section>
    </div>
  );
}
