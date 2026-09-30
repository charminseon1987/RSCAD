/* Flask 통신 및 액션 핸들러. */

// ──────────────────────────────────────────────────────────────────
// API 상태
// ──────────────────────────────────────────────────────────────────
async function checkAPI(){
  try{
    const r=await fetch(API+'/api/health',{signal:AbortSignal.timeout(2000)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(d.status!=='ok') throw new Error('status='+(d.status??'unknown'));
    apiOk=true;
    document.getElementById('api-dot').className='api-dot ok';
    set('api-label',`연결됨 · ${d.engine||'numpy'}`,C.stable);
    set('tb-order', isNum(d.n_states)?`${d.n_states}-STATE`:'MODEL ?');
    set('tb-phase', d.phase ? String(d.phase) : 'Phase ?');
    if(!isNum(d.n_states)) addLog('/api/health 에 n_states 없음 — 21/22차 확인 불가','warn');
    addLog(`Flask API 연결 성공 (${d.engine||'numpy'})`,'ok');
  }catch(e){
    apiOk=false;
    document.getElementById('api-dot').className='api-dot err';
    set('api-label','서버 없음',C.unstable);
    set('tb-order','MODEL —'); set('tb-phase','Phase —');
    addLog('Flask 연결 실패 ('+e.message+') — python app.py 실행 확인','err');
  }
}

// ──────────────────────────────────────────────────────────────────
// 야코비안
// ──────────────────────────────────────────────────────────────────
function dominantByZeta(modes){
  if(!Array.isArray(modes)||!modes.length) return null;
  const osc=modes.filter(m=>isNum(m.zeta)&&isNum(m.freq_hz));
  if(!osc.length) return null;
  return osc.reduce((a,b)=>b.zeta<a.zeta?b:a);
}

async function fetchJacobian(overrides={}){
  const r=await fetch(API+'/api/jacobian',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...params,...overrides})
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

async function runJacobian(){
  if(running) return;
  if(!apiOk){ addLog('Flask 서버에 먼저 연결하세요','err'); return; }
  running=true;
  const btn=document.getElementById('btn-j');
  btn.disabled=true; btn.textContent='계산 중…';
  addLog(`API 호출: SCR=${params.SCR}, X/R=${params.XR}, J=${params.J}, Dp=${params.Dp}, Kpv=${params.Kpv}, wc=${params.wc}`,'api');

  try{
    const d=await fetchJacobian();
    lastResult=d;

    const missing=['zeta_min','f_dom_hz','stable','eigenvalues','modes'].filter(k=>d[k]===undefined);
    if(missing.length) addLog('응답 필드 누락: '+missing.join(', '),'err');

    const zc = isNum(d.zeta_min) ? (d.zeta_min>=ZETA_TH?C.stable:d.zeta_min>=0.4?C.warn:C.unstable) : C.text3;
    set('r-stable', d.stable===undefined?'—':(d.stable?'STABLE':'UNSTABLE'), d.stable?C.stable:C.unstable);
    set('r-zeta',  fmt(d.zeta_min,4), zc);
    set('r-fdom',  fmt(d.f_dom_hz,3,' Hz'), C.text);
    set('r-delta', fmt(d.delta_deg,2,'°'), C.text);
    set('r-scr',   fmt(d.scr_star,2), C.text);
    set('r-coup',  fmt(d.coupling_A96,6), C.text2);
    set('r-engine', `${isNum(d.n_states)?d.n_states:'?'} · ${d.engine??'—'}`, C.text3);

    const du=d.du_pv_pct;
    const valid = isNum(du) ? du<=DUPV_TH : d.valid_linearization;
    set('r-dupv', isNum(du)?`${du.toFixed(2)} %`:'—', valid?C.stable:C.warn);
    if(isNum(du) && d.valid_linearization!==undefined && d.valid_linearization!==valid)
      addLog(`서버 valid_linearization(${d.valid_linearization})과 Δu_pv=${du.toFixed(2)}% / 임계 ${DUPV_TH}% 판정 불일치`,'err');

    const dz=dominantByZeta(d.modes);
    set('r-fzmin', dz?fmt(dz.freq_hz,3,' Hz'):'—', C.text);
    if(dz && isNum(d.f_dom_hz)){
      const rel=Math.abs(dz.freq_hz-d.f_dom_hz)/Math.max(1,Math.abs(d.f_dom_hz));
      if(rel>0.01){
        addLog(`f_dom 불일치: ζ_min 모드 ${dz.freq_hz.toFixed(2)}Hz vs API f_dom ${d.f_dom_hz.toFixed(2)}Hz — 서버 지배모드 선택 기준 확인`,'err');
        set('r-fdom', fmt(d.f_dom_hz,3,' Hz')+' ⚠', C.unstable);
      }
    }

    const badge=document.getElementById('badge-eig');
    badge.textContent = d.stable?'STABLE':'UNSTABLE';
    badge.className='badge '+(d.stable?'badge-ok':'badge-err');

    drawEig(d.eigenvalues);
    drawModes(d.modes,dz);
    updateOP(d);
    document.getElementById('r-note').textContent =
      `SCR=${params.SCR} · X/R=${params.XR} · Kpv=${params.Kpv} · wc=${params.wc}`;

    addLog(`완료 — ζ ${fmt(d.zeta_min,4)}, δ ${fmt(d.delta_deg,2)}°, SCR* ${fmt(d.scr_star,2)}`, d.stable?'ok':'warn');
    if(isNum(du)&&!valid) addLog(`Δu_pv ${du.toFixed(2)}% > ${DUPV_TH}% — PSCAD 교차검증 권고`,'warn');
    if(isNum(d.zeta_min)&&d.zeta_min<ZETA_TH) addLog(`ζ ${d.zeta_min.toFixed(4)} < ${ZETA_TH} — PSO 최적화 필요`,'warn');

  }catch(e){
    addLog('야코비안 API 오류: '+e.message,'err');
  }
  btn.textContent='야코비안 계산'; btn.disabled=false; running=false;
}

// ──────────────────────────────────────────────────────────────────
// SCR 스윕 — 실제 API 수집
// ──────────────────────────────────────────────────────────────────
async function runScrSweep(){
  if(!apiOk){ addLog('Flask 서버 연결 필요','err'); return; }
  const btn=document.getElementById('btn-sweepscr');
  btn.disabled=true; btn.textContent='스윕 중…';
  addLog(`SCR 스윕 시작 — ${SCR_GRID.length}점 (현재 파라미터 고정)`,'api');
  const out=[];
  for(const scr of SCR_GRID){
    try{
      const d=await fetchJacobian({SCR:scr});
      out.push({scr, zeta:d.zeta_min, du:d.du_pv_pct, delta:d.delta_deg, stable:d.stable});
    }catch(e){ addLog(`SCR=${scr} 실패: ${e.message}`,'err'); }
  }
  scrSweep=out.sort((a,b)=>a.scr-b.scr);
  drawZeta(); drawDupv();

  const withDu=scrSweep.filter(p=>isNum(p.du));
  if(!withDu.length){
    addLog('스윕 완료 — du_pv_pct 필드가 없어 선형화 오차 곡선 미표시','warn');
  }else{
    const mn=withDu.reduce((a,b)=>b.du<a.du?b:a);
    addLog(`스윕 완료 — Δu_pv 최소 ${mn.du.toFixed(2)}% @ SCR ${mn.scr}`,'ok');
    let turns=0;
    for(let i=1;i<withDu.length-1;i++){
      const a=withDu[i].du-withDu[i-1].du, b=withDu[i+1].du-withDu[i].du;
      if(a*b<0) turns++;
    }
    if(turns) addLog(`Δu_pv(SCR) 곡선에 변곡 ${turns}회 — 비단조. 극소점 위치 기록 (P2-A5)`,'warn');
  }
  btn.disabled=false; btn.textContent='SCR 스윕';
}

// ──────────────────────────────────────────────────────────────────
// 2D 스윕
// ──────────────────────────────────────────────────────────────────
async function runSweep(){
  if(!apiOk){addLog('Flask 서버 연결 필요','err');return;}
  addLog('2D 스윕 시작 (88포인트)…','api');
  const b=document.getElementById('badge-2d');
  b.textContent='COMPUTING'; b.className='badge badge-warn';
  try{
    const r=await fetch(API+'/api/sweep2d',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(params)
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    sweepData=Array.isArray(d.data)?d.data:[];
    draw2D(sweepData);
    b.textContent=`${d.total_points??sweepData.length} PT · DONE`; b.className='badge badge-ok';
    addLog(`2D 스윕 완료 — ${d.total_points??sweepData.length}포인트`,'ok');
    Object.entries(d.boundaries||{}).forEach(([xr,scr])=>{ if(scr) addLog(`X/R=${xr}: SCR*=${scr}`,'info'); });
  }catch(e){
    b.textContent='FAILED'; b.className='badge badge-err';
    addLog('스윕 오류: '+e.message,'err');
  }
}

// ──────────────────────────────────────────────────────────────────
// PSO
// ──────────────────────────────────────────────────────────────────
async function runPSO(){
  if(!apiOk){addLog('Flask 서버 연결 필요','err');return;}
  addLog('PSO 최적화 시작…','api');
  try{
    const r=await fetch(API+'/api/pso',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({SCR_list:[3.0,2.0,1.5,1.0],alpha:0.3,beta:0.6,gamma:0.1})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    Object.entries(d.opt_params||{}).forEach(([k,v])=>{
      if(params[k]!==undefined&&isNum(v)){
        params[k]=v;
        const el=document.getElementById('s-'+k); if(el) el.value=v;
        sv(k,v);
      }
    });
    addLog('PSO 완료 — 최적 파라미터 적용','ok');
    (d.validation||[]).forEach(v=>addLog(`SCR=${v.SCR}: ζ=${v.zeta_min}, ${v.stable?'안정':'불안정'}`,'info'));
    scrSweep=null; drawZeta(); drawDupv();
    await runJacobian();
  }catch(e){ addLog('PSO 오류: '+e.message,'err'); }
}

// ──────────────────────────────────────────────────────────────────
// CLI 결과 (runner.py → results/latest)
// ──────────────────────────────────────────────────────────────────
async function loadLatest(){
  if(!apiOk){ addLog('Flask 서버 연결 필요','err'); return; }
  try{
    const r=await fetch(API+'/api/latest',{signal:AbortSignal.timeout(4000)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    cliRun=d;
    renderCli(d);
    drawZeta(); drawDupv();
    addLog(`CLI 결과 로드 — ${d.run_id??'(id 없음)'}, ${(d.rows||[]).length}행`,'ok');

    const keys=['J','Dp','Kpv','Kiv','Kpc','Kic','Lv','wc','XR'];
    const diffs=keys.filter(k=>isNum(d.params?.[k])&&Math.abs(d.params[k]-params[k])>1e-9);
    if(diffs.length){
      addLog('CLI 런과 현재 슬라이더가 다름: '+diffs.map(k=>`${k} ${d.params[k]}≠${params[k]}`).join(', '),'err');
      addLog('→ 비교하려면 “CLI 기본값 적용” 후 다시 계산','warn');
    }
    if(isNum(d.n_states)) set('tb-order',`${d.n_states}-STATE`);
  }catch(e){
    addLog('CLI 결과 로드 실패: '+e.message,'warn');
    addLog('→ Flask에 GET /api/latest 필요 (results/latest/results.json)','info');
    document.getElementById('cli-list').innerHTML =
      '<div class="empty">/api/latest 없음<br><span>results/latest/results.json 을 서빙하세요.</span></div>';
  }
}

function renderCli(d){
  const box=document.getElementById('cli-list');
  box.innerHTML='';
  const rows=Array.isArray(d.rows)?d.rows:[];
  if(!rows.length){ box.innerHTML='<div class="empty">rows 비어 있음</div>'; return; }
  const head=document.createElement('div');
  head.className='op-row op-head';
  head.innerHTML='<span>SCR</span><span>ζ_min</span><span>δ (°)</span>';
  box.appendChild(head);
  rows.forEach(r=>{
    const el=document.createElement('div');
    el.className='op-row';
    el.innerHTML=`<span>${fmt(r.scr,2)}</span><span style="color:${C.cli}">${fmt(r.zeta_min,4)}</span><span>${fmt(r.delta_deg,2)}</span>`;
    box.appendChild(el);
  });
}

function applyPreset(){
  Object.entries(CLI_PRESET).forEach(([k,v])=>{params[k]=v;});
  syncSliders();
  scrSweep=null; drawZeta(); drawDupv();
  addLog('CLI 기본값 적용 — J=0.5, Dp=20, Kpv=0.05, wc=62.8, X/R=1.0','info');
}

function resetAll(){
  Object.entries(DEFAULTS).forEach(([k,v])=>{params[k]=v;});
  syncSliders();
  lastResult=null; sweepData=null; scrSweep=null; cliRun=null;
  d3.select('#svg-eig').selectAll('*').remove();
  d3.select('#svg-2d').selectAll('*').remove();
  ['r-stable','r-zeta','r-fzmin','r-fdom','r-delta','r-scr','r-coup','r-dupv','r-engine']
    .forEach(id=>set(id,'—',C.text3));
  document.getElementById('r-note').textContent='야코비안을 계산하면 값이 채워집니다.';
  document.getElementById('cli-list').innerHTML='<div class="empty"><span>불러오지 않음</span></div>';
  document.getElementById('mode-list').innerHTML='<div style="font-size:11px;color:'+C.text3+';text-align:center;padding:12px;">계산 후 표시</div>';
  drawZeta(); drawDupv(); updateOP(null);
  addLog('초기화 완료','info');
}
