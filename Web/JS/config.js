/* 토큰 · 임계값 · 기본 파라미터.
   반드시 다른 스크립트보다 먼저 로드되어야 합니다. */

// ──────────────────────────────────────────────────────────────────
// 설정
// ──────────────────────────────────────────────────────────────────
const API = 'http://localhost:5000';
const ZETA_TH  = 0.64;
const DUPV_TH  = 5.0;
const SCR_GRID = [5,4,3,2.5,2,1.7,1.6,1.5,1.4,1.3,1.2,1.0,0.8];

const C = {
  text:'#E6E9ED', text2:'#97A1AD', text3:'#5D6875',
  line:'#262E38', well:'#12161B',
  accent:'#7C8CF8', cli:'#5FB8C4',
  stable:'#4FB68C', warn:'#D9A24E', unstable:'#D2685F',
  bandVsg:'#7C8CF8', bandLcl:'#6FA8D0', bandFast:'#9B8BD0'
};
const F_VSG = 10, F_LCL = 60;

const DEFAULTS = {SCR:1.5,XR:1.0,J:0.5,Dp:20,Lv:0.1,Kpv:1.0,Kiv:100,Kpc:5.0,Kic:50,wc:31.4};
const CLI_PRESET = {SCR:1.5,XR:1.0,J:0.5,Dp:20,Kpv:0.05,wc:62.8};

const params = {...DEFAULTS};
let apiOk=false, lastResult=null, sweepData=null, scrSweep=null, cliRun=null, running=false;
