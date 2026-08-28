/* 포맷 · DOM 헬퍼 · 로그 · 슬라이더 동기화. */

// ──────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const fmt = (v,d=3,suf='') => isNum(v) ? v.toFixed(d)+suf : '—';

function set(id,val,color){
  const el=document.getElementById(id);
  if(!el)return; el.textContent=val; if(color)el.style.color=color;
}
function addLog(msg,type='info'){
  const box=document.getElementById('log-box');
  const t=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const d=document.createElement('div'); d.className='log-line sev-'+type;
  const bar=document.createElement('div'); bar.className='log-bar';
  const ts=document.createElement('span'); ts.className='log-t'; ts.textContent=t;
  const ms=document.createElement('span'); ms.className='log-m'; ms.textContent=msg;
  d.append(bar,ts,ms); box.appendChild(d); box.scrollTop=box.scrollHeight;
  if(box.children.length>80) box.removeChild(box.children[0]);
}

const DECIMALS={SCR:2,XR:2,J:3,Lv:3,Dp:1,Kiv:1,Kic:1,Kpv:3,Kpc:3,wc:1};
function sv(key,val){
  const v=parseFloat(val);
  if(!isNum(v)) return;
  params[key]=v;
  const el=document.getElementById('v-'+key);
  if(el) el.textContent=v.toFixed(DECIMALS[key]??3);
}
function syncSliders(){
  Object.entries(params).forEach(([k,v])=>{
    const el=document.getElementById('s-'+k);
    if(el){el.value=v;}
    sv(k,v);
  });
}
