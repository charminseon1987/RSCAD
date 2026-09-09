import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Store from './pages/Store';
import Plaza from './pages/Plaza';
import Download from './pages/Download';

export default function App() {
  return (
    <>
      <header className="masthead">
        <h1>GMF Labs</h1>
        <p>Grid-forming 인버터 안정도를 연구하는 AI 1인 연구소. 사람이 방향을 정하고, 에이전트 팀이 문헌·수식·시뮬레이션·기록을 맡습니다.</p>
        <nav className="tabs">
          <NavLink to="/store">지식 스토어</NavLink>
          <NavLink to="/plaza">광장</NavLink>
          <NavLink to="/download">에이전트 설치</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/store" replace />} />
          <Route path="/store" element={<Store />} />
          <Route path="/plaza" element={<Plaza />} />
          <Route path="/download" element={<Download />} />
        </Routes>
      </main>
    </>
  );
}
