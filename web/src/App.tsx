import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Papers from './pages/Papers';
import Knowledge from './pages/Knowledge';
import MyPaper from './pages/MyPaper';
import ExperimentLog from './pages/ExperimentLog';
import Archify from './pages/Archify';
import Lab from './pages/Lab';
import ThemeToggle from './components/ThemeToggle';
import Landing from './pages/Landing';
import RscadFX from './pages/RscadFX';
import Login from './pages/Login';

/* ── 좌측 사이드바 ──
   그룹과 하위 화면을 한 번에 펼쳐 보여준다. 상단 2단 nav 와 달리 화면이 더 늘어나도 안정적이다. */
type Leaf = { to: string; label: string; end?: boolean; children?: Leaf[] };
type Group = { label: string; base: string; children: Leaf[] };

const NAV: (Leaf | Group)[] = [
  { to: '/', label: '메인', end: true },
  {
    label: '연구', base: '/research',
    children: [
      {
        to: '/research/scholar/flow', label: '연구실 스콜라',
        children: [
          /* 검색·답변은 수집 워크플로 ①단계로 합쳐졌다 */
          { to: '/research/scholar/flow', label: '수집 워크플로 (7단계)' },
          { to: '/research/scholar/compare', label: '비교표' },
          { to: '/research/scholar/library', label: '라이브러리' },
        ],
      },
      { to: '/research/knowledge', label: '지식화' },
      { to: '/research/my-paper', label: '내논문' },
    ],
  },
  {
    label: '실험', base: '/lab',
    children: [
      /* 실행·제어루프·검증은 /lab/gfm 안의 탭 3개로 합쳤다 */
      { to: '/lab/gfm', label: 'GFM 실험' },
      { to: '/lab/log', label: '실험기록' },
    ],
  },
  { to: '/archify', label: 'Archify' },
  {
    label: '발표', base: '/present',
    children: [
      { to: '/present/landing', label: '메인 (풀스크린)' },
      { to: '/present/rscad-fx', label: 'RscadFX' },
    ],
  },
];

function isGroup(n: Leaf | Group): n is Group {
  return (n as Group).children !== undefined;
}

const SIDEBAR_W = 248;
const SIDEBAR_W_MIN = 68;

/* ── 발표 모드 — 사이드바 없이 페이지만, Esc 로 복귀 ── */
function PresentShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const btn = {
    fontSize: 15,
    background: 'rgba(0,0,0,.55)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.25)',
  };

  return (
    <>
      {children}
      {/* 평소엔 거의 안 보이다가 마우스를 올리면 드러난다 — 발표 화면을 가리지 않게 */}
      <div className="fixed top-3 left-3 z-[100] flex gap-2 opacity-15 hover:opacity-100 transition-opacity duration-200">
        <button onClick={() => navigate('/')} className="mono-label px-3 py-1.5 rounded-lg backdrop-blur" style={btn}>
          ← 나가기 (Esc)
        </button>
        <button onClick={goFullscreen} className="mono-label px-3 py-1.5 rounded-lg backdrop-blur" style={btn}>
          전체화면
        </button>
      </div>
    </>
  );
}

export default function App() {
  const location = useLocation();
  const isPresent = location.pathname.startsWith('/present/');
  const isAuth = location.pathname === '/login';
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const pages = (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/research/scholar/:screen" element={<Papers />} />
      <Route path="/research/scholar" element={<Navigate to="/research/scholar/flow" replace />} />
      <Route path="/research/scholar/search" element={<Navigate to="/research/scholar/flow" replace />} />
      <Route path="/research/papers" element={<Navigate to="/research/scholar/flow" replace />} />
      <Route path="/research/knowledge" element={<Knowledge />} />
      <Route path="/research/my-paper" element={<MyPaper />} />
      {/* 실험 세 화면은 Lab 의 탭이다 — 경로를 유지해 북마크·딥링크가 살아 있다 */}
      <Route path="/lab/gfm" element={<Lab />} />
      <Route path="/lab/control-loop" element={<Lab />} />
      <Route path="/lab/verification" element={<Lab />} />
      <Route path="/lab/log" element={<ExperimentLog />} />
      <Route path="/archify" element={<Archify />} />
      <Route path="/present/landing" element={<Landing />} />
      <Route path="/present/rscad-fx" element={<RscadFX />} />
      <Route path="/login" element={<Login />} />
      {/* 옛 경로 — 북마크가 깨지지 않게 */}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/simulation" element={<Navigate to="/lab/gfm" replace />} />
      <Route path="/lab" element={<Navigate to="/lab/gfm" replace />} />
      <Route path="/paper" element={<Navigate to="/research/my-paper" replace />} />
      <Route path="/rscad-fx" element={<Navigate to="/present/rscad-fx" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  // 발표 경로는 앱 껍데기를 벗는다 — 고정 nav 가 풀스크린 시연을 막던 원인이었다
  if (isPresent) return <PresentShell>{pages}</PresentShell>;

  // 로그인 페이지는 사이드바 없이 풀스크린 — 자체 네비게이션 포함
  if (isAuth) return <>{pages}</>;

  const w = collapsed ? SIDEBAR_W_MIN : SIDEBAR_W;

  const leafStyle = (isActive: boolean, sub = false) => ({
    color: isActive ? 'var(--primary)' : 'var(--outline)',
    fontSize: sub ? 15 : 16,
    fontWeight: isActive ? 600 : 400,
    background: isActive ? 'var(--surface-container)' : 'transparent',
    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* ── 좌측 사이드바 ── */}
      <aside className="fixed top-0 left-0 bottom-0 z-50 flex flex-col glass-nav"
        style={{ width: w, transition: 'width .18s ease', borderRight: '1px solid var(--border)' }}>

        {/* 로고 */}
        <NavLink to="/" className="flex items-center gap-2.5 px-4" style={{ height: 56, flexShrink: 0 }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary)' }}>
            <span className="text-[11px] font-bold" style={{ color: 'var(--on-primary)' }}>G</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--primary)' }}>GFM Labs</span>
          )}
        </NavLink>

        {/* 메뉴 — 2depth. 1depth 는 그룹, 누르면 펼쳐지고 접힌다 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {NAV.map(n => {
            if (!isGroup(n)) {
              return (
                <NavLink key={n.to} to={n.to} end={n.end}
                  className="mono-label block truncate rounded-r-lg transition-all duration-150"
                  style={({ isActive }) => ({
                    ...leafStyle(isActive),
                    padding: collapsed ? '10px 4px' : '10px 12px',
                    textAlign: collapsed ? ('center' as const) : ('left' as const),
                  })}
                  title={n.label}>
                  {collapsed ? n.label.slice(0, 2) : n.label}
                </NavLink>
              );
            }

            const inGroup = location.pathname.startsWith(n.base);
            const expanded = openGroups[n.label] ?? inGroup;

            return (
              <div key={n.label}>
                {/* 1depth — 그룹 */}
                <button onClick={() => setOpenGroups(s => ({ ...s, [n.label]: !expanded }))}
                  className="mono-label w-full flex items-center justify-between rounded-r-lg transition-all duration-150"
                  style={{
                    padding: collapsed ? '10px 4px' : '10px 12px',
                    fontSize: 17,
                    fontWeight: inGroup ? 600 : 400,
                    color: inGroup ? 'var(--primary)' : 'var(--on-surface-variant)',
                    background: 'transparent',
                    borderLeft: inGroup ? '3px solid var(--primary)' : '3px solid transparent',
                    textAlign: collapsed ? 'center' : 'left',
                  }}
                  title={n.label}>
                  <span className="truncate">{collapsed ? n.label.slice(0, 2) : n.label}</span>
                  {!collapsed && (
                    <span style={{ fontSize: 14, color: 'var(--outline-variant)', transition: 'transform .15s' }}>
                      {expanded ? '▾' : '▸'}
                    </span>
                  )}
                </button>

                {/* 2depth — 그룹 안의 화면 (자식이 있으면 3depth 까지) */}
                {expanded && !collapsed && n.children.map(c => {
                  const hasKids = !!c.children?.length;
                  // 3depth 는 그 하위 경로에 있을 때만 편다
                  const inLeaf = hasKids && c.children!.some(k => location.pathname === k.to);
                  return (
                    <div key={c.to}>
                      <NavLink to={c.to}
                        className="mono-label block truncate rounded-r-lg transition-all duration-150"
                        style={({ isActive }) => ({
                          ...leafStyle(isActive || inLeaf, true),
                          padding: '7px 12px 7px 26px',
                        })}
                        title={c.label}>
                        {c.label}
                      </NavLink>
                      {hasKids && inLeaf && c.children!.map(k => (
                        <NavLink key={k.to} to={k.to}
                          className="mono-label block truncate rounded-r-lg transition-all duration-150"
                          style={({ isActive }) => ({
                            color: isActive ? 'var(--primary)' : 'var(--outline)',
                            fontSize: 14,
                            fontWeight: isActive ? 600 : 400,
                            background: isActive ? 'var(--surface-container)' : 'transparent',
                            borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                            padding: '6px 12px 6px 42px',
                          })}
                          title={k.label}>
                          {k.label}
                        </NavLink>
                      ))}
                    </div>
                  );
                })}
                {/* 접힌 사이드바에서는 2depth 를 아이콘 줄로만 */}
                {collapsed && n.children.map(c => (
                  <NavLink key={c.to} to={c.to}
                    className="mono-label block truncate rounded-r-lg transition-all duration-150"
                    style={({ isActive }) => ({
                      ...leafStyle(isActive, true),
                      padding: '6px 4px',
                      fontSize: 14,
                      textAlign: 'center' as const,
                    })}
                    title={c.label}>
                    {c.label.slice(0, 2)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* 테마 */}
        <div className="shrink-0 flex justify-center py-2"
          style={{ borderTop: '1px solid var(--border)' }}>
          <ThemeToggle />
        </div>

        {/* 접기 */}
        <button onClick={() => setCollapsed(v => !v)}
          className="mono-label shrink-0"
          style={{
            height: 36, fontSize: 15, color: 'var(--outline)',
            borderTop: '1px solid var(--border)', background: 'transparent',
          }}>
          {collapsed ? '›' : '‹ 접기'}
        </button>
      </aside>

      {/* 블롭이 z-index:0 고정 요소라, 본문에 스태킹을 줘야 위로 올라온다 */}
      <main style={{ marginLeft: w, transition: 'margin-left .18s ease', position: 'relative', zIndex: 1 }}>{pages}</main>
    </div>
  );
}
