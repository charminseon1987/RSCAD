/* 보고서 · 지식화.
   CLI 결과 파일(JSON)과 그림(PNG)을 읽어 Word 문서와 Obsidian 노트로 내보냅니다.

   Flask API 를 쓰지 않는 이유:
   /api/jacobian 은 구 지표(ζ 0.64 기준, scr_star 근사식)를 반환한다.
   문서로 새어나가면 안 되므로, 내보내기는 runner/pf/xval 이 남긴
   결과 파일만 읽는다. 서버가 꺼져 있어도 동작한다. */

// ──────────────────────────────────────────────────────────────────
// 상태
// ──────────────────────────────────────────────────────────────────
const REPORT = {
  run: null, model_version: null, xr: null,
  // 판정 기준. 실행 파일(meta.json)에 있으면 그 값을 쓰고, 사용자가 바꾸면
  // score 를 재계산한다. TS_COEF 는 정의(2% 정착)이므로 입력받지 않는다.
  t_s_spec: T_S_SPEC, zeta_floor: ZETA_FLOOR,
  sigma_ref: SIGMA_REF,
  ts_source: 'default',   // default | meta | user
  recomputed: false,
  run_t_s: null,          // 실행 당시 값 (대조용)
  ctrl: null,
  stability: null,      // eigenvalue_results.json
  participation: null,  // participation_factors.json
  lin: null,            // linearization_validity_*.json
  figs: {},             // 파일명 → dataURL
  loaded: []
};

const pctS = v => isNum(v) ? (v * 100).toFixed(2) + '%' : '—';
const scrS = v => isNum(v) ? Number(v).toFixed(1) : '—';

// ──────────────────────────────────────────────────────────────────
// 파일 읽기
// ──────────────────────────────────────────────────────────────────
async function loadReportFiles(fileList){
  const files = [...fileList];
  if(!files.length) return;
  let n = 0;

  for(const f of files){
    if(/\.png$/i.test(f.name)){
      REPORT.figs[f.name] = await new Promise(res=>{
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      REPORT.loaded.push(f.name); n++;
      addLog(`그림 로드 — ${f.name}`,'info');
      continue;
    }
    if(!/\.json$/i.test(f.name)){
      addLog(`건너뜀 — ${f.name} (json/png 아님)`,'warn');
      continue;
    }

    let j;
    try { j = JSON.parse(await f.text()); }
    catch(e){ addLog(`${f.name} — JSON 파싱 실패`,'err'); continue; }

    if(j.ctrl_params && j.points){                       // meta.json
      REPORT.run = j.run_name ?? REPORT.run;
      REPORT.model_version = j.model_version ?? REPORT.model_version;
      REPORT.xr = j.last_run_XR ?? j.XR ?? REPORT.xr;
      if(isNum(j.t_s_spec)){
        REPORT.run_t_s = j.t_s_spec;
        if(REPORT.ts_source !== 'user'){       // 사용자 입력이 우선
          REPORT.t_s_spec = j.t_s_spec;
          REPORT.ts_source = 'meta';
        }
      }
      REPORT.ctrl = j.ctrl_params;
      n++; addLog(`meta 로드 — ${REPORT.run}`,'ok');

    } else if(j.by_SCR && j.input){                      // linearization_validity_*
      REPORT.lin = {
        input: j.input, tol: j.tol,
        rows: Object.entries(j.by_SCR).map(([k,v])=>({
          scr:+k, T:v.T,
          thr: v.threshold_fit ?? v.threshold_ratio,
          n: v.fit?.exponent, r2: v.fit?.r2,
          dcmax: v.dc_gain_error_max, dcd: v.dc_gain_error_delta
        })).sort((a,b)=>b.scr-a.scr)
      };
      n++; addLog(`선형화 유효범위 로드 — ${j.input} 섭동, ${REPORT.lin.rows.length}점`,'ok');

    } else if(j.by_SCR && j.delta_state){                // participation_factors
      REPORT.participation = Object.entries(j.by_SCR).map(([k,v])=>({
        scr:+k, pd:v.p_delta, pw:v.p_omega, sum:v.p_sum,
        sigma:v.sync_mode?.sigma, osc:v.sync_mode?.oscillatory,
        top:(v.top_states||[]).slice(0,3)
      })).sort((a,b)=>b.scr-a.scr);
      n++; addLog(`참여계수 로드 — ${REPORT.participation.length}점`,'ok');

    } else {                                             // eigenvalue_results
      const rows = Object.entries(j)
        .filter(([,v])=>v && v.converged !== false && isNum(v.sigma_min))
        .map(([k,v])=>({
          scr:+k, sigma:v.sigma_min, ts:v.t_s_max, score:v.score,
          binding:v.binding, crit:v.crit_state, osc:!!v.crit_osc,
          delta:v.delta_deg, zeta:v.zeta_min
        })).sort((a,b)=>b.scr-a.scr);
      if(rows.length){
        REPORT.stability = rows; n++;
        addLog(`안정도 지표 로드 — ${rows.length}점`,'ok');
      } else {
        addLog(`${f.name} — sigma_min 항목 없음. runner.py 를 최신본으로 실행했는지 확인`,'err');
      }
    }
  }

  if(n){ applyCriteria(); syncCriteriaUI(); renderReport(); }
}

// ──────────────────────────────────────────────────────────────────
// 판정 기준 적용
// ──────────────────────────────────────────────────────────────────
/* score = min(σ_min / σ_ref, ζ_min / ζ_floor) — metrics.metrics 와 동일한 정의.
   기준을 바꾸면 저장된 score 를 그대로 쓸 수 없으므로 다시 계산한다.
   sigma_min 과 zeta_min 이 결과 파일에 있으므로 재계산이 가능하다. */
function applyCriteria(){
  REPORT.sigma_ref = TS_COEF / REPORT.t_s_spec;
  if(!REPORT.stability) return;

  REPORT.stability.forEach(r=>{
    const rs = isNum(r.sigma) ? r.sigma / REPORT.sigma_ref : NaN;
    const rz = isNum(r.zeta)  ? r.zeta  / REPORT.zeta_floor : Infinity;
    r.score   = Math.min(rs, rz);
    r.binding = rs <= rz ? 'sigma' : 'zeta';
    r.ts      = isNum(r.sigma) && r.sigma > 0 ? TS_COEF / r.sigma : null;
  });

  REPORT.recomputed = isNum(REPORT.run_t_s)
                   && Math.abs(REPORT.run_t_s - REPORT.t_s_spec) > 1e-9;
}

function setCriteria(ts, zf, src){
  if(isNum(ts) && ts > 0)  REPORT.t_s_spec   = ts;
  if(isNum(zf) && zf > 0)  REPORT.zeta_floor = zf;
  REPORT.ts_source = src;
  applyCriteria();
  renderReport();
  addLog(`판정 기준 — t_s ${REPORT.t_s_spec} s, σ_ref ${fmt(REPORT.sigma_ref,2)}, ζ_floor ${REPORT.zeta_floor}`
         + (REPORT.recomputed ? '  (실행값과 다름 · score 재계산)' : ''),
         REPORT.recomputed ? 'warn' : 'info');
}

// ──────────────────────────────────────────────────────────────────
// 요약 표시
// ──────────────────────────────────────────────────────────────────
function renderReport(){
  const box = document.getElementById('rep-list');
  const has = k => REPORT[k] ? '✓' : '—';
  const nFig = Object.keys(REPORT.figs).length;

  const ok = REPORT.stability ? REPORT.stability.filter(r=>r.score>=1).length : 0;
  const tot = REPORT.stability ? REPORT.stability.length : 0;

  const srcLabel = {default:'기본값', meta:'실행값', user:'사용자 지정'}[REPORT.ts_source];
  const warn = REPORT.recomputed
    ? `<div class="res-note" style="color:var(--warn)">실행값 t_s ${REPORT.run_t_s} s 와 다르다. score 를 재계산했다.</div>` : '';

  box.innerHTML = `
    <div class="op-row op-head"><span>판정 기준</span><span>${srcLabel}</span></div>
    <div class="op-row"><span>σ_ref</span><span>${fmt(REPORT.sigma_ref,2)} [1/s]</span></div>
    ${warn}
    <div class="op-row op-head" style="margin-top:8px"><span>항목</span><span>상태</span></div>
    <div class="op-row"><span>meta</span><span>${has('ctrl')}</span></div>
    <div class="op-row"><span>안정도 지표</span><span>${tot ? tot+'점' : '—'}</span></div>
    <div class="op-row"><span>참여계수</span><span>${REPORT.participation ? REPORT.participation.length+'점' : '—'}</span></div>
    <div class="op-row"><span>선형화 유효범위</span><span>${REPORT.lin ? REPORT.lin.rows.length+'점' : '—'}</span></div>
    <div class="op-row"><span>그림</span><span>${nFig ? nFig+'장' : '—'}</span></div>
    ${tot ? `<div class="op-row active"><span>요구 충족</span><span>${ok} / ${tot}</span></div>` : ''}
    ${REPORT.run ? `<div class="res-note" style="border-top:1px solid var(--line);margin-top:6px;">${REPORT.run}</div>` : ''}`;

  const ready = !!REPORT.stability;
  document.getElementById('btn-doc').disabled = !ready;
  document.getElementById('btn-md').disabled  = !ready;
}

// ──────────────────────────────────────────────────────────────────
// 저장 헬퍼
// ──────────────────────────────────────────────────────────────────
function download(name, text, mime, bom){
  // BOM 은 Word 의 UTF-8 인식에 필요하지만, 마크다운 앞에 붙으면
  // Obsidian 이 프론트매터를 인식하지 못한다.
  const b = new Blob([(bom ? '\ufeff' : '') + text], {type:mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

function stabTable(){
  if(!REPORT.stability) return '';
  return `<h2>안정도 지표</h2><table>
    <tr><th>SCR</th><th>감쇠율 σ</th><th>정착시간 (s)</th><th>여유</th>
        <th>임계 모드</th><th>지배 상태</th><th>전력각</th></tr>
    ${REPORT.stability.map(r=>`<tr><td>${scrS(r.scr)}</td><td>${fmt(r.sigma,4)}</td>
      <td>${fmt(r.ts,2)}</td><td>${fmt(r.score,3)}</td>
      <td>${r.osc?'진동':'실수극'}</td><td>${r.crit??'—'}</td>
      <td>${fmt(r.delta,2)}°</td></tr>`).join('')}
  </table><p>목표 감쇠율 ${fmt(REPORT.sigma_ref,1)} [1/s] · 정착시간 ${REPORT.t_s_spec} s 기준. 여유 1.0 = 요구 충족.</p>`;
}

function partTable(){
  if(!REPORT.participation) return '';
  return `<h2>참여계수</h2><table>
    <tr><th>SCR</th><th>p(δ)</th><th>p(Δω)</th><th>합</th><th>동기화 모드 σ</th><th>유형</th></tr>
    ${REPORT.participation.map(r=>`<tr><td>${scrS(r.scr)}</td><td>${fmt(r.pd,4)}</td>
      <td>${fmt(r.pw,4)}</td><td>${fmt(r.sum,4)}</td><td>${fmt(r.sigma,4)}</td>
      <td>${r.osc?'진동':'실수극'}</td></tr>`).join('')}
  </table><p>δ·Δω 참여도 최대 모드를 동기화 모드로 채택. 진동 여부를 가리지 않는다.</p>`;
}

function linTable(){
  if(!REPORT.lin) return '';
  const L = REPORT.lin;
  return `<h2>선형화 유효 범위</h2><table>
    <tr><th>SCR</th><th>적분 구간 (s)</th><th>유효 범위</th><th>지수 n</th>
        <th>R²</th><th>DC오차(max)</th><th>DC오차(δ)</th></tr>
    ${L.rows.map(r=>`<tr><td>${scrS(r.scr)}</td><td>${fmt(r.T,2)}</td>
      <td>${pctS(r.thr)}</td><td>${fmt(r.n,2)}</td><td>${fmt(r.r2,4)}</td>
      <td>${pctS(r.dcmax)}</td><td>${pctS(r.dcd)}</td></tr>`).join('')}
  </table><p>${L.input} 섭동 기준, 허용 오차 정격 대비 ${pctS(L.tol)}. 회귀 지수가 2에 가까우면 오차가 섭동 크기의 제곱에 비례한다.</p>`;
}

function figBlock(){
  return Object.entries(REPORT.figs).map(([name,url])=>
    `<p><img src="${url}" style="width:100%"><br>
     <span style="font-size:9pt;color:#5c6570">${name}</span></p>`).join('');
}

// ──────────────────────────────────────────────────────────────────
// Word 문서
// ──────────────────────────────────────────────────────────────────
function exportDoc(){
  if(!REPORT.stability){ addLog('안정도 지표를 먼저 불러오세요','err'); return; }
  const c = REPORT.ctrl || {};
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>검증 실행 보고서</title><style>
body{font-family:'Malgun Gothic',sans-serif;font-size:10.5pt;line-height:1.65}
h1{font-size:17pt} h2{font-size:13pt;border-bottom:1px solid #999;padding-bottom:3pt;margin-top:18pt}
table{border-collapse:collapse;width:100%;font-size:9.5pt;margin-bottom:6pt}
th{background:#2f4858;color:#fff;padding:5pt;text-align:left}
td{border-bottom:.5pt solid #ccc;padding:5pt}
p{margin:4pt 0 10pt}
</style></head><body>
<h1>소신호 모델 검증 실행 보고서</h1>
<p>조연호 · 연세대학교 스마트그리드 연구실<br>
모델 ${REPORT.model_version ?? '—'} · 실행 ${REPORT.run ?? '—'} · 작성 ${new Date().toISOString().slice(0,10)}</p>

<h2>실행 조건</h2>
<table>
<tr><td style="width:26%">운전 조건</td><td>SCR ${REPORT.stability.map(r=>scrS(r.scr)).join(' / ')}, X/R ${REPORT.xr ?? '—'}</td></tr>
<tr><td>제어 파라미터</td><td>${Object.entries(c).map(([k,v])=>`${k} ${v}`).join(', ') || '—'}</td></tr>
<tr><td>정착시간 요구</td><td>${REPORT.t_s_spec} s (2% 기준) → 감쇠율 목표 ${fmt(REPORT.sigma_ref,2)} [1/s]
  ${REPORT.recomputed ? `<br><span style="color:#a32d24">실행 당시 값 ${REPORT.run_t_s} s 와 다름. 저장된 감쇠율로 여유를 재계산했다.</span>` : ''}</td></tr>
<tr><td>링잉 하한 ζ</td><td>${REPORT.zeta_floor}</td></tr>
${REPORT.lin ? `<tr><td>섭동 · 허용치</td><td>${REPORT.lin.input}, 정격 대비 ${pctS(REPORT.lin.tol)}</td></tr>` : ''}
<tr><td>결과 폴더</td><td>results/${REPORT.run ?? '—'}/</td></tr>
</table>

${stabTable()}
${partTable()}
${linTable()}
${Object.keys(REPORT.figs).length ? '<h2>그림</h2>' + figBlock() : ''}

<h2>비고</h2>
<p>수치는 CLI 파이프라인(runner · pf · xval)이 남긴 결과 파일에서 읽었다.
유효 범위는 허용치와 함께 인용해야 한다. 허용치는 계측 불확도가 확정되면
회귀식으로부터 재계산한다.</p>
</body></html>`;

  const tag = (REPORT.run ?? 'run').slice(0,30);
  download(`검증실행_보고서_${tag}.doc`, doc, 'application/msword', true);
  addLog('Word 문서로 저장','ok');
}

// ──────────────────────────────────────────────────────────────────
// Obsidian 노트
// ──────────────────────────────────────────────────────────────────
function exportMd(){
  if(!REPORT.stability){ addLog('안정도 지표를 먼저 불러오세요','err'); return; }
  const S = REPORT.stability, L = REPORT.lin, P = REPORT.participation;
  const c = REPORT.ctrl || {};
  const today = new Date().toISOString().slice(0,10);
  const sc = S.map(r=>r.score).filter(isNum);
  const okList = S.filter(r=>r.score>=1).map(r=>scrS(r.scr));
  const ngList = S.filter(r=>r.score<1).map(r=>scrS(r.scr));

  let md = `---
type: experiment
date: ${today}
phase: 2
model_version: ${REPORT.model_version ?? '—'}
run: ${REPORT.run ?? '—'}
status: verified
tags: [phase2, 안정도지표, 감쇠율]
---

# 🧪 실험: ${REPORT.run ?? '실행'}

## 실행 명령

\`\`\`bash
python Simulation/runner.py --SCR ${S.map(r=>scrS(r.scr)).join(' ')} --XR ${REPORT.xr ?? 1.0}
python Simulation/pf.py
${L ? `python Simulation/xval.py --input ${L.input} --tol ${L.tol} --traj-at 0.1` : ''}
\`\`\`

## 조건

| 항목 | 값 |
|---|---|
| 운전 조건 | SCR ${S.map(r=>scrS(r.scr)).join(' / ')}, X/R ${REPORT.xr ?? '—'} |
| 제어 파라미터 | ${Object.entries(c).map(([k,v])=>`${k}=${v}`).join(' ') || '—'} |
| 정착시간 요구 | t_s ≤ ${REPORT.t_s_spec} s → σ_ref = ${fmt(REPORT.sigma_ref,2)} |
| 링잉 하한 ζ | ${REPORT.zeta_floor} |${REPORT.recomputed ? `
| ⚠ 기준 변경 | 실행 당시 t_s ${REPORT.run_t_s} s. 저장된 σ_min 으로 여유를 재계산했다 |` : ''}
${L ? `| 섭동 · 허용치 | ${L.input}, 정격 대비 ${pctS(L.tol)} |` : ''}
| 결과 폴더 | \`results/${REPORT.run ?? '—'}/\` |

## 안정도 지표

| SCR | σ_min | t_s [s] | score | 구속 | 임계 지배 | δ(°) |
|---|---|---|---|---|---|---|
${S.map(r=>`| ${scrS(r.scr)} | ${fmt(r.sigma,4)} | ${fmt(r.ts,2)} | ${fmt(r.score,3)} | ${r.binding??'—'} | ${r.crit??'—'} | ${fmt(r.delta,2)} |`).join('\n')}

▸ ${okList.length ? `SCR ${okList.join(', ')} 에서 요구 충족` : '전 조건 미달'}${ngList.length?`, ${ngList.join(', ')} 은 미달`:''}. 여유 ${fmt(Math.max(...sc),3)} → ${fmt(Math.min(...sc),3)}.
※ 감쇠비만 보는 구 지표는 필터 공진이 최솟값을 독점해 계통 조건에 반응하지 않는다. → [[모드교차_최소감쇠비_함정]]
`;

  if(P){
    md += `
## 참여계수

| SCR | p(δ) | p(Δω) | 합 | 동기화 모드 σ | 유형 |
|---|---|---|---|---|---|
${P.map(r=>`| ${scrS(r.scr)} | ${fmt(r.pd,4)} | ${fmt(r.pw,4)} | ${fmt(r.sum,4)} | ${fmt(r.sigma,4)} | ${r.osc?'진동':'실수극'} |`).join('\n')}

▸ δ·Δω 참여도 최대 모드를 동기화 모드로 채택했다. 진동 여부를 가리지 않는다.
※ 약계통에서 δ 비중이 커지면 J 조정 효과가 줄고 Dp·wc 가 직접적인 손잡이가 된다. → [[PSO_목적함수_설계]]
`;
  }

  if(L){
    const ns = L.rows.map(r=>r.n).filter(isNum);
    const th = L.rows.map(r=>r.thr).filter(isNum);
    md += `
## 선형화 유효 범위

| SCR | T [s] | 유효 범위 | 지수 n | R² | DC오차(max) | DC오차(δ) |
|---|---|---|---|---|---|---|
${L.rows.map(r=>`| ${scrS(r.scr)} | ${fmt(r.T,2)} | ${pctS(r.thr)} | ${fmt(r.n,2)} | ${fmt(r.r2,4)} | ${pctS(r.dcmax)} | ${pctS(r.dcd)} |`).join('\n')}

▸ 유효 범위 ${pctS(Math.max(...th))} → ${pctS(Math.min(...th))}. 회귀 지수 ${fmt(Math.min(...ns),2)}~${fmt(Math.max(...ns),2)} 로 오차 ∝ 섭동² 이 확인된다.
※ 허용치 ${pctS(L.tol)} 는 잠정값이다. 계측 불확도 확정 후 회귀식으로 재계산한다. → [[선형화_유효성_지표_규명]]
`;
  }

  const figNames = Object.keys(REPORT.figs);
  if(figNames.length){
    md += `
## 그림

${figNames.map(n=>`![[${n}]]`).join('\n')}

※ 그림 파일을 볼트 첨부 폴더에 함께 복사해야 표시된다.
`;
  }

  md += `
## 📌 핵심 메모

- 임계 모드가 실수극이면 감쇠비로는 포착되지 않는다. 감쇠율로 판정한다.
- 유효 범위 수치는 허용치와 함께 인용한다.
- **t_s = ${REPORT.t_s_spec} s 는 아직 근거 문서가 확인되지 않은 잠정값이다.** 폐기된 v0 코드에서 역산한 값이며, 출처 확정은 \`P3-A6\` 의 과제다. → [[PSO_목적함수_설계]]

## 연결 노트

- [[Phase02_완료]]
- [[과감쇠_동기화모드]]
- [[블록삼각_함정]]
- [[PSO_목적함수_설계]]
`;

  const tag = (REPORT.run ?? 'run').slice(0,26);
  download(`EXP_${today}_${tag}.md`, md, 'text/markdown', false);
  addLog('Obsidian 노트로 저장','ok');
}

// ──────────────────────────────────────────────────────────────────
// 결선
// ──────────────────────────────────────────────────────────────────
function syncCriteriaUI(){
  const a = document.getElementById('in-ts'), b = document.getElementById('in-zf');
  if(a) a.value = REPORT.t_s_spec;
  if(b) b.value = REPORT.zeta_floor;
  const s = document.getElementById('lbl-sigma');
  if(s) s.textContent = fmt(REPORT.sigma_ref, 2);
}

window.addEventListener('load', ()=>{
  const fi = document.getElementById('rep-files');
  if(fi) fi.addEventListener('change', async e=>{
    await loadReportFiles(e.target.files);
    e.target.value = '';
  });

  const ts = document.getElementById('in-ts'), zf = document.getElementById('in-zf');
  const onChange = ()=>{
    setCriteria(parseFloat(ts.value), parseFloat(zf.value), 'user');
    syncCriteriaUI();
  };
  ts?.addEventListener('change', onChange);
  zf?.addEventListener('change', onChange);

  document.getElementById('btn-reset-crit')?.addEventListener('click', ()=>{
    if(isNum(REPORT.run_t_s)){
      setCriteria(REPORT.run_t_s, ZETA_FLOOR, 'meta');
    } else {
      setCriteria(T_S_SPEC, ZETA_FLOOR, 'default');
    }
    syncCriteriaUI();
  });

  document.getElementById('btn-doc')?.addEventListener('click', exportDoc);
  document.getElementById('btn-md')?.addEventListener('click', exportMd);
  applyCriteria(); syncCriteriaUI(); renderReport();
});
