import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Lab from './pages/Lab';
import Paper from './pages/Paper';

const NAV = [
  { to: '/', label: '🏠 메인', end: true },
  { to: '/lab', label: '🔬 실험실' },
  { to: '/paper', label: '✍️ 논문' },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              GFM Labs
            </span>
            <span className="text-xs text-gray-500 hidden sm:block">Grid-Forming Inverter Stability Research</span>
          </div>
          <div className="flex gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({isActive}) =>
                  `px-4 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-gray-800 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }>
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-14">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/paper" element={<Paper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
