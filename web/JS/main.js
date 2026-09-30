/* 진입점.
   로드 순서: config → util → charts → render → api → main */

// ──────────────────────────────────────────────────────────────────
// 초기화
// ──────────────────────────────────────────────────────────────────
window.addEventListener('load', async ()=>{
  syncSliders();
  updateOP(null); drawZeta(); drawDupv();
  initPlaza();
  await checkAPI();
  loadPhaseStatus();
  loadExperimentHistory();
  if(apiOk){ await runJacobian(); await runSweep(); }
});

setInterval(()=>{ if(document.hasFocus()) checkAPI(); }, 15000);

window.addEventListener('resize',()=>{
  if(lastResult) drawEig(lastResult.eigenvalues);
  if(sweepData)  draw2D(sweepData);
  drawZeta(); drawDupv();
});
