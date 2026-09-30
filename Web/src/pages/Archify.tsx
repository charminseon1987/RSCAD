/* Archify — 다이어그램 갤러리 · 유형 참조 · 프롬프트 빌더.
   생성은 Claude Code 스킬이 하지만, 이미 만든 다이어그램은 여기서 바로 본다.

   iframe 을 쓰지 않는다. archify 가 렌더한 HTML 대신, spec 과 기하 정보를 합친
   JSON(Web/src/data/arch/*.json)을 ArchDiagram 이 React SVG 로 그린다.
   그 JSON 은 tools/extract_arch_geometry.py 가 만든다 — 다이어그램을 새로 만들거나
   spec 을 고쳤으면 그 스크립트를 다시 돌리고 아래 REGISTRY 에 한 줄 추가하면 된다. */
import { useState } from 'react';
import ArchDiagram, { type ArchSpec } from '../components/arch/ArchDiagram';
import webIaSpec from '../data/arch/gmf-web-ia.json';
import rscadSpec from '../data/arch/rscad-runtime.json';

/* GFM 제어루프는 여기서 빼 두었다 — /lab/control-loop 에 실시간 React 화면이 있고,
   정적 다이어그램으로 중복시키면 어느 쪽이 최신인지 알 수 없게 된다. */
const REGISTRY: { key: string; type: string; spec: ArchSpec }[] = [
  { key: 'gmf-web-ia', type: 'architecture', spec: webIaSpec as unknown as ArchSpec },
  { key: 'rscad-runtime', type: 'architecture', spec: rscadSpec as unknown as ArchSpec },
];

const TYPES = [
  { key: 'architecture', ko: '아키텍처', en: 'Architecture', target: '컴포넌트, 서비스, 저장소, 경계', fields: ['범위', '핵심 컴포넌트', '주 경로'] },
  { key: 'workflow', ko: '워크플로', en: 'Workflow', target: 'CI/CD, 승인 절차, 도구 호출, 런북', fields: ['참여자', '순서', '분기', '예외'] },
  { key: 'sequence', ko: '시퀀스', en: 'Sequence', target: 'API 호출, 캐시 폴백, 인증, 비동기 추적', fields: ['호출자', '피호출자', '반환', '타이밍'] },
  { key: 'dataflow', ko: '데이터 흐름', en: 'Data Flow', target: '파이프라인, 계보, 개인정보, 소비자', fields: ['소스', '변환', '저장소', '경계'] },
  { key: 'lifecycle', ko: '생명주기', en: 'Lifecycle', target: '상태, 재시도, 대기, 종료 결과', fields: ['상태', '이벤트', '재시도와 취소 경로'] },
] as const;

export default function Archify() {
  const [openKey, setOpenKey] = useState(REGISTRY[0]?.key ?? '');
  const open = REGISTRY.find(d => d.key === openKey) ?? REGISTRY[0] ?? null;

  const [sel, setSel] = useState<string>('architecture');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const t = TYPES.find(x => x.key === sel)!;
  const prompt = [
    `/archify ${t.ko}(${t.en}) 다이어그램을 만들어줘.`,
    '',
    ...t.fields.map(f => `- ${f}: ${vals[`${t.key}:${f}`] || '(채워 주세요)'}`),
    '',
    `산출물은 docs/diagrams/<name>.${t.key}.json 과 <name>-${t.key}.html 로 저장해줘.`,
    'quality_profile 은 showcase, 본문은 한국어.',
  ].join('\n');

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>Archify</h1>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 17 }}>
            다이어그램 {REGISTRY.length}건 {open && `· 지금 보는 것: ${open.spec.title}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBuilderOpen(v => !v)}
            className="mc-btn-secondary mono-label" style={{ fontSize: 15, padding: '8px 14px' }}>
            {builderOpen ? '빌더 닫기' : '새 다이어그램 만들기'}
          </button>
        </div>
      </div>

      {/* ── 갤러리 탭 ── */}
      {REGISTRY.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {REGISTRY.map(d => (
            <button key={d.key} onClick={() => setOpenKey(d.key)}
              className="glass-card glass-card-hover text-left" style={{
                padding: '10px 14px',
                border: open?.key === d.key ? '2px solid var(--primary)' : '1px solid var(--border)',
              }}>
              <div className="mono-label" style={{ fontSize: 16, color: open?.key === d.key ? 'var(--primary)' : 'var(--on-surface)' }}>
                {d.spec.title}
              </div>
              <div className="mono-clock mt-0.5" style={{ fontSize: 15, color: 'var(--outline)' }}>
                {d.type} · 노드 {d.spec.components.length}
                {d.spec.views.length ? ` · 뷰 ${d.spec.views.length}` : ''}
                {' · 간선 '}{d.spec.connections.length}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── 다이어그램 본체 — React SVG ── */}
      {open ? (
        <ArchDiagram key={open.key} spec={open.spec} />
      ) : (
        <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 17 }}>
          아직 다이어그램이 없습니다. 아래 빌더로 프롬프트를 만들어 Claude Code 에서 생성하세요.
        </p>
      )}

      {/* ── 프롬프트 빌더 (접힘) ── */}
      {builderOpen && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5 space-y-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>유형 고르기</span>
            {TYPES.map(x => (
              <button key={x.key} onClick={() => setSel(x.key)}
                className="glass-card glass-card-hover text-left w-full" style={{
                  padding: 14,
                  border: sel === x.key ? '2px solid var(--primary)' : '1px solid var(--border)',
                }}>
                <div className="flex items-baseline gap-2">
                  <span className="mono-label" style={{ fontSize: 16, color: sel === x.key ? 'var(--primary)' : 'var(--on-surface)' }}>{x.ko}</span>
                  <span className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>{x.en}</span>
                </div>
                <p className="mono-clock mt-1" style={{ fontSize: 15, color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>{x.target}</p>
              </button>
            ))}
          </div>

          <div className="col-span-12 lg:col-span-7 glass-card" style={{ padding: 20 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>프롬프트에 담을 내용 — {t.ko}</span>
            <div className="space-y-2 mt-3">
              {t.fields.map(f => (
                <div key={f}>
                  <label className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>{f}</label>
                  <input className="mc-input w-full mt-1" style={{ fontSize: 17 }}
                    value={vals[`${t.key}:${f}`] || ''}
                    onChange={e => setVals(v => ({ ...v, [`${t.key}:${f}`]: e.target.value }))}
                    placeholder={`${f} 를 한 줄로`} />
                </div>
              ))}
            </div>

            <pre className="mono-clock mt-4 p-3 rounded-xl"
              style={{
                fontSize: 16, lineHeight: 1.7, color: 'var(--on-surface-variant)',
                background: 'var(--surface-container-low)', border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{prompt}</pre>

            <div className="flex items-center gap-3 mt-3">
              <button onClick={copy} className="mc-btn-primary mono-label" style={{ fontSize: 15, padding: '8px 16px' }}>
                프롬프트 복사
              </button>
              {copied && <span className="mono-clock" style={{ fontSize: 16, color: 'var(--primary)' }}>복사했습니다</span>}
            </div>

            <p className="mono-clock mt-3" style={{ fontSize: 15, color: 'var(--outline)', lineHeight: 1.8 }}>
              ① 복사 → ② Claude Code 에 붙여넣어 archify 호출 → ③ docs/ 에 저장 →
              ④ <code>python tools/extract_arch_geometry.py</code> → ⑤ Archify.tsx 의 REGISTRY 에 한 줄 추가.
              <br />
              <span style={{ color: 'var(--error)' }}>이 화면은 다이어그램을 만들지 않습니다 — 생성 경로가 서버에 없습니다.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
