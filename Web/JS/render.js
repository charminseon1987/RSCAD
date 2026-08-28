/* DOM 목록 · 테이블 렌더링.
   값이 없으면 비웁니다 — 대체값을 만들지 않습니다. */

// ──────────────────────────────────────────────────────────────────
// 모드 리스트
// ──────────────────────────────────────────────────────────────────
function drawModes(modes,zmin){
  const box=document.getElementById('mode-list');
  box.innerHTML='';
  if(!Array.isArray(modes)||!modes.length){
    box.innerHTML=`<div style="font-size:11px;color:${C.text3};text-align:center;padding:12px;">모드 데이터 없음</div>`;
    return;
  }
  modes.slice(0,5).forEach(m=>{
    const z=m.zeta;
    const c=!isNum(z)?C.text3:z>=ZETA_TH?C.stable:z>=0.4?C.text2:C.warn;
    const isMin = zmin && m===zmin;
    const d=document.createElement('div');
    d.className='mode-item'+(isMin?' is-min':'');
    d.innerHTML=`
      <div class="mode-top">
        <span style="color:${isMin?C.warn:C.text}">${fmt(m.freq_hz,2)} Hz${isMin?'&nbsp;&nbsp;ζ_min':''}</span>
        <span style="color:${c}">ζ ${fmt(z,4)}</span>
      </div>
      <div class="mode-lam">${fmt(m.re,2)} ± ${isNum(m.im)?Math.abs(m.im).toFixed(2):'—'}j</div>`;
    box.appendChild(d);
  });
}

// ──────────────────────────────────────────────────────────────────
// 다중 동작점 — API 값만
// ──────────────────────────────────────────────────────────────────
function updateOP(res){
  const box=document.getElementById('op-list');
  box.innerHTML='';
  const ops = res && Array.isArray(res.operating_points) ? res.operating_points : null;
  if(!ops||!ops.length){
    box.innerHTML='<div class="empty">동작점 데이터 없음<br><span>/api/jacobian 응답에 operating_points[{scr,idc0,zg}] 추가 필요</span></div>';
    return;
  }
  const head=document.createElement('div');
  head.className='op-row op-head';
  head.innerHTML='<span>SCR</span><span>idc0</span><span>Zg</span>';
  box.appendChild(head);
  ops.forEach(op=>{
    const active=isNum(op.scr)&&Math.abs(op.scr-params.SCR)<0.3;
    const d=document.createElement('div');
    d.className='op-row'+(active?' active':'');
    d.innerHTML=`<span>${fmt(op.scr,2)}</span><span>${fmt(op.idc0,3)}</span><span>${fmt(op.zg,3)}</span>`;
    box.appendChild(d);
  });
}
