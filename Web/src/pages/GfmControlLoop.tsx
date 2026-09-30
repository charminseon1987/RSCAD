/**
 * GFM Control Loop - Real-time Signal Flow Visualization
 * Embeds the interactive GFM control loop diagram
 */

export default function GfmControlLoop() {
  return (
    <div className="w-full h-screen">
      <iframe
        src="/gfm-control-loop.html"
        title="GFM 제어 루프 — 실시간 신호 흐름"
        className="w-full h-full border-0"
        style={{ minHeight: '100vh' }}
      />
    </div>
  );
}
