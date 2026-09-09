const RELEASES = (import.meta.env.VITE_RELEASES_URL as string | undefined) ?? '#';

export default function Download() {
  return (
    <div className="grid">
      <section className="sheet">
        <h2>GMF Labs 에이전트 (connect-ai 포크)</h2>
        <p style={{ marginBottom: 16 }}>
          VS Code · Antigravity · Cursor 익스텐션. 로컬 LLM(LM Studio 또는 Ollama)만 사용합니다.
          설치 후 명령 팔레트에서 「GMF Labs: 광장 입장」을 실행하면 이 사이트의 광장에 연결됩니다.
        </p>
        <a className="btn" href={RELEASES} style={{ textDecoration: 'none', display: 'inline-block' }}>최신 릴리즈 받기</a>
        <p className="meta" style={{ color: 'var(--ink-2)', marginTop: 12, fontSize: 14 }}>
          .vsix 파일 → 명령 팔레트 → Extensions: Install from VSIX
        </p>
      </section>
      <section className="sheet">
        <h2>필요한 것</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>LM Studio(<span className="num">:1234</span>) 또는 Ollama(<span className="num">:11434</span>) + 모델 1개</li>
          <li>임베딩용 <span className="num">ollama pull nomic-embed-text</span></li>
          <li>Obsidian Vault 경로 (두뇌 폴더)</li>
        </ul>
      </section>
    </div>
  );
}
