/* 실험 — 실행 · 제어루프 · 검증을 한 경로에 탭으로 모은다.

   세 화면이 같은 모델을 다루는데 경로가 나뉘어 있어 오갈 때마다 맥락이 끊겼다.
   라우트는 그대로 셋을 유지하고(북마크·기존 링크·사이드바 딥링크가 살아 있다)
   탭은 경로에서 고른다. 탭을 누르면 navigate 로 URL 도 따라간다.

   ── 마운트 전략: 처음 활성화될 때 마운트하고, 그 뒤로는 유지한다 ──

   탭을 옮길 때마다 언마운트하면 실행 탭의 계산 결과·로그와 검증 탭의 Q&A 기록이
   사라진다. 그렇다고 처음부터 셋을 다 마운트할 수도 없다 — BlockDiagram 이 마운트
   직후 path.getTotalLength() 로 배선 길이를 재는데, display:none 상태에서 재면 0 이
   나와 점이 흐르지 않는다. 그래서 '처음 보일 때 마운트 → 이후 hidden 으로만 감춤'.

   ── 적분은 활성 탭에서만 ──

   제어루프는 60 fps RAF 에서 RK4 를 돈다 (DT 20 µs · 프레임당 약 833 스텝 ×
   22차 rhs 4회 평가). 마운트만으로 CPU 를 계속 쓰므로 active 를 넘겨 막는다. */

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ControlLoop from './ControlLoop';
import GfmLab from './GfmLab';
import Stability from './Stability';

const TABS = [
  { key: 'run', path: '/lab/gfm', label: '실행', note: '파라미터를 정해 계산을 돌린다' },
  { key: 'loop', path: '/lab/control-loop', label: '제어루프', note: '식이 어떻게 움직이는지 본다' },
  { key: 'verify', path: '/lab/verification', label: '검증', note: '저장된 결과가 기준을 넘는지' },
] as const;

type TabKey = typeof TABS[number]['key'];

function tabFromPath(pathname: string): TabKey {
  const hit = TABS.find(t => pathname.startsWith(t.path));
  return hit ? hit.key : 'run';
}

export default function Lab() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = tabFromPath(location.pathname);

  /* 한 번이라도 열린 탭 — 이후로는 마운트를 유지한다 */
  const [mounted, setMounted] = useState<Set<TabKey>>(() => new Set([active]));
  useEffect(() => {
    setMounted(prev => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);

  /* 실행 탭에서 계산이 저장되면 올린다 — 검증 탭이 이 값을 보고 다시 읽는다.
     run 이름을 주고받을 필요는 없다. 서버가 저장 후 STATE 를 reload 하고
     LATEST.json 이 새 run 을 가리키므로(Server/app.py 의 /api/compute) 검증 탭은
     그냥 다시 읽으면 된다. */
  const [runVersion, setRunVersion] = useState(0);
  const bump = useRef(() => setRunVersion(v => v + 1)).current;

  const go = (path: string) => {
    if (!location.pathname.startsWith(path)) navigate(path);
  };

  const cur = TABS.find(t => t.key === active);

  return (
    <div>
      {/* ── 탭 ── */}
      <div className="max-w-[1600px] mx-auto px-10 pt-8">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-container)' }}>
            {TABS.map(t => {
              const on = t.key === active;
              return (
                <button key={t.key} onClick={() => go(t.path)}
                  aria-current={on ? 'page' : undefined}
                  className="mono-label px-4 py-2 rounded-lg transition-all duration-200"
                  style={{
                    fontSize: 14.5,
                    color: on ? 'var(--primary)' : 'var(--outline)',
                    background: on ? 'var(--surface-container-lowest)' : 'transparent',
                    border: on ? '1px solid var(--border)' : '1px solid transparent',
                    boxShadow: on ? 'var(--shadow-ambient)' : 'none',
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          {cur && (
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>
              {cur.note}
            </span>
          )}
        </div>
      </div>

      {/* ── 섹션 ──
          한 번 마운트하면 유지하고, 활성이 아닌 것은 hidden 으로 감춘다.
          style.display 대신 hidden 속성을 쓴다 — 전역 CSS 와 싸우지 않는다. */}
      {mounted.has('run') && (
        <div hidden={active !== 'run'}>
          <GfmLab onRunSaved={bump} />
        </div>
      )}
      {mounted.has('loop') && (
        <div hidden={active !== 'loop'}>
          <ControlLoop active={active === 'loop'} />
        </div>
      )}
      {mounted.has('verify') && (
        <div hidden={active !== 'verify'}>
          <Stability reloadKey={runVersion} />
        </div>
      )}
    </div>
  );
}
