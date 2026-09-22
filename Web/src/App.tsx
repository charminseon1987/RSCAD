import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Lab from './pages/Lab';
import Paper from './pages/Paper';
import RscadFX from './pages/RscadFX';
import Simulation from './pages/Simulation';

const NAV = [
  { to: '/', label: 'HOME', end: true },
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/simulation', label: 'SIMULATION' },
  { to: '/lab', label: 'LAB' },
  { to: '/paper', label: 'PAPER' },
  { to: '/rscad-fx', label: 'RSCAD FX' },
];

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      {/* ── Top Nav — Liquid Glass ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-[1600px] mx-auto px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary)' }}
            >
              <span className="text-[11px] font-bold" style={{ color: 'var(--on-primary)' }}>G</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--primary)' }}
              >
                GFM Labs
              </span>
              <span
                className="mono-label hidden sm:block"
                style={{ color: 'var(--outline)', fontSize: 10, textTransform: 'uppercase' }}
              >
                Mission Control
              </span>
            </div>
          </NavLink>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({isActive}) =>
                  `mono-label px-3 py-1.5 rounded-lg transition-all duration-200 ${
                    isActive ? 'glass-nav-pill' : ''
                  }`
                }
                style={({isActive}) => ({
                  color: isActive ? 'var(--primary)' : 'var(--outline)',
                  fontSize: 11,
                })}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-14">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/paper" element={<Paper />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/rscad-fx" element={<RscadFX />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
