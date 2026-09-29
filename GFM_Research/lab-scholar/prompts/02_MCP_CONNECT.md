# Stage 1 완료 후 — Claude Code에 scholar MCP 연결

터미널(Git Bash)에서:
    claude mcp add --transport http --scope user scholar http://localhost:8000/mcp
    claude mcp list          # scholar: ✓ Connected 확인

Claude Code에서 테스트:
    scholar로 "grid-forming inverter weak grid small-signal" 논문 5편 찾아서
    '박사 · GFM 안정도' 폴더에 저장하고, IEEE 인용 목록 보여줘
