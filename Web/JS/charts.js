/* D3 렌더링. 데이터는 인자로만 받습니다 — 여기서 API를 호출하지 않습니다. */

// ──────────────────────────────────────────────────────────────────
// D3 — 고유값 평면
// ──────────────────────────────────────────────────────────────────
const axStyle = g=>{
  g.selectAll('text').attr('fill',C.text3).attr('font-size',8).attr('font-family','Roboto Mono, monospace');
  g.select('.domain').attr('stroke',C.line);
  g.selectAll('.tick line').attr('stroke',C.line);
};

function drawEig(eigs){
  const el=document.getElementById('svg-eig');
  d3.select('#svg-eig').selectAll('*').remove();
  if(!Array.isArray(eigs)||!eigs.length){
    d3.select('#svg-eig').append('text').attr('x','50%').attr('y','50%')
      .attr('text-anchor','middle').attr('fill',C.text3).attr('font-size',11).text('고유값 데이터 없음');
    return;
  }
  const W=el.clientWidth,H=el.clientHeight;
  const m={t:16,r:16,b:24,l:46};
  const w=W-m.l-m.r, h=H-m.t-m.b;
  const svgRoot=d3.select('#svg-eig');
  const svg=svgRoot.append('g').attr('transform',`translate(${m.l},${m.t})`);

  const pts=eigs.filter(e=>isNum(e.re)&&isNum(e.im));
  const reV=pts.map(e=>e.re), imV=pts.map(e=>e.im);
  const rPad=(d3.max(reV)-d3.min(reV))*.14||5;
  const iPad=(d3.max(imV)-d3.min(imV))*.10||50;
  const xS=d3.scaleLinear().domain([d3.min(reV)-rPad,Math.max(0,d3.max(reV))+rPad]).range([0,w]);
  const yS=d3.scaleLinear().domain([d3.min(imV)-iPad,d3.max(imV)+iPad]).range([h,0]);
  const x0=xS(0);

  // clip so the damping cone stays inside the plot well
  const defs=svgRoot.append('defs');
  defs.append('clipPath').attr('id','eig-clip')
      .append('rect').attr('x',0).attr('y',0).attr('width',w).attr('height',h);
  const plot=svg.append('g').attr('clip-path','url(#eig-clip)');

  // unstable half-plane
  plot.append('rect').attr('x',x0).attr('y',0).attr('width',Math.max(0,w-x0)).attr('height',h)
      .attr('fill',C.unstable).attr('opacity',.10);

  // ζ ≥ 0.64 damping cone — a region, not two dashed lines
  const th=Math.acos(ZETA_TH);
  const reFar=xS.domain()[0], imFar=Math.tan(th)*Math.abs(reFar);
  plot.append('polygon')
      .attr('points',[[x0,yS(0)],[xS(reFar),yS(imFar)],[xS(reFar),yS(-imFar)]]
        .map(p=>p.join(',')).join(' '))
      .attr('fill',C.accent).attr('opacity',.15)
      .attr('stroke',C.accent).attr('stroke-opacity',.40).attr('stroke-width',1);

  // imaginary axis
  plot.append('line').attr('x1',x0).attr('x2',x0).attr('y1',0).attr('y2',h)
      .attr('stroke',C.unstable).attr('stroke-opacity',.55).attr('stroke-width',1);

  svg.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(xS).ticks(5)).call(axStyle);
  svg.append('g').call(d3.axisLeft(yS).ticks(4)).call(axStyle);

  // identify the ζ_min eigenvalue pair so it can be highlighted
  const zetaOf=d=>Math.abs(d.im)>0.5 ? -d.re/Math.hypot(d.re,d.im) : Infinity;
  const zMin=Math.min(...pts.map(zetaOf));

  const tooltip=document.getElementById('tooltip');
  plot.selectAll('circle.eig').data(pts).join('circle').attr('class','eig')
    .attr('cx',d=>xS(d.re)).attr('cy',d=>yS(d.im))
    .attr('r',d=>{
      if(Math.abs(d.im)<0.5) return 3;
      return Math.abs(zetaOf(d)-zMin)<1e-9 ? 6 : 5;
    })
    .attr('fill',d=>{
      if(Math.abs(d.im)<0.5) return C.text3;
      if(Math.abs(zetaOf(d)-zMin)<1e-9) return C.warn;
      const f=Math.abs(d.im)/(2*Math.PI);
      return f<F_VSG ? C.bandVsg : f<F_LCL ? C.bandLcl : C.bandFast;
    })
    .attr('opacity',d=>Math.abs(d.im)<0.5?.55:.95)
    .on('mouseover',(evt,d)=>{
      const osc=Math.abs(d.im)>0.5;
      const z=osc?zetaOf(d).toFixed(4):'N/A';
      const f=osc?(Math.abs(d.im)/(2*Math.PI)).toFixed(2)+' Hz':'실수극점';
      tooltip.style.opacity=1;
      tooltip.style.left=(evt.clientX+12)+'px';
      tooltip.style.top=(evt.clientY-8)+'px';
      tooltip.innerHTML=`λ ${d.re.toFixed(3)} ${d.im>=0?'+':'−'} ${Math.abs(d.im).toFixed(3)}j<br>ζ ${z}<br>f ${f}`;
    })
    .on('mouseout',()=>tooltip.style.opacity=0);

  [[C.bandVsg,`VSG (<${F_VSG}Hz)`],[C.bandLcl,`LCL (${F_VSG}~${F_LCL}Hz)`],[C.bandFast,`고속 (>${F_LCL}Hz)`],[C.warn,'ζ_min']]
  .forEach(([c,l],i)=>{
    svg.append('circle').attr('cx',6).attr('cy',h-14-i*14).attr('r',4).attr('fill',c);
    svg.append('text').attr('x',15).attr('y',h-10-i*14).attr('fill',C.text2).attr('font-size',8).text(l);
  });
}

// ──────────────────────────────────────────────────────────────────
// D3 — 2D 히트맵
// ──────────────────────────────────────────────────────────────────
const zetaColor=d3.scaleLinear()
  .domain([0,0.45,ZETA_TH,1.0]).clamp(true)
  .range([C.unstable,'#C9814F',C.warn,C.stable]);

function draw2D(data){
  const el=document.getElementById('svg-2d');
  d3.select('#svg-2d').selectAll('*').remove();
  if(!Array.isArray(data)||!data.length){
    d3.select('#svg-2d').append('text').attr('x','50%').attr('y','50%')
      .attr('text-anchor','middle').attr('fill',C.text3).attr('font-size',11).text('스윕 데이터 없음');
    return;
  }
  const W=el.clientWidth,H=el.clientHeight;
  const m={t:12,r:64,b:32,l:40};
  const w=W-m.l-m.r, h=H-m.t-m.b;
  const svg=d3.select('#svg-2d').append('g').attr('transform',`translate(${m.l},${m.t})`);

  const scrPts=[...new Set(data.map(d=>d.scr))].sort((a,b)=>a-b);
  const xrPts =[...new Set(data.map(d=>d.xr))].sort((a,b)=>a-b);
  const cw=w/scrPts.length, ch=h/xrPts.length;
  const tooltip=document.getElementById('tooltip');

  data.forEach(d=>{
    const xi=scrPts.indexOf(d.scr), yi=xrPts.indexOf(d.xr);
    if(xi<0||yi<0) return;
    svg.append('rect').attr('x',xi*cw).attr('y',yi*ch)
       .attr('width',Math.max(1,cw-1.5)).attr('height',Math.max(1,ch-1.5)).attr('rx',3)
       .attr('fill',isNum(d.zeta)?zetaColor(d.zeta):'#232A33').attr('opacity',.9)
       .on('mouseover',evt=>{
         tooltip.style.opacity=1;
         tooltip.style.left=(evt.clientX+12)+'px';
         tooltip.style.top=(evt.clientY-8)+'px';
         tooltip.innerHTML=`SCR ${d.scr} / X/R ${d.xr}<br>ζ ${fmt(d.zeta,4)}<br>${d.stable?'안정':'불안정'}`;
       })
       .on('mouseout',()=>tooltip.style.opacity=0);

    if(isNum(d.zeta)&&d.zeta>=ZETA_TH&&xi>0){
      const prev=data.find(p=>p.scr===scrPts[xi-1]&&p.xr===d.xr);
      if(prev&&isNum(prev.zeta)&&prev.zeta<ZETA_TH)
        svg.append('rect').attr('x',xi*cw-1).attr('y',yi*ch)
           .attr('width',2).attr('height',Math.max(1,ch-1.5)).attr('rx',1)
           .attr('fill','#FFFFFF').attr('opacity',.85);
    }
  });

  scrPts.filter((_,i)=>i%3===0).forEach(s=>{
    const xi=scrPts.indexOf(s);
    svg.append('text').attr('x',xi*cw+cw/2).attr('y',h+13)
       .attr('text-anchor','middle').attr('fill',C.text3)
       .attr('font-family','Roboto Mono, monospace').attr('font-size',8).text(s);
  });
  svg.append('text').attr('x',w/2).attr('y',h+26).attr('text-anchor','middle')
     .attr('fill',C.text3).attr('font-size',9).text('SCR');
  xrPts.forEach((xr,yi)=>{
    svg.append('text').attr('x',-8).attr('y',yi*ch+ch/2+4).attr('text-anchor','end')
       .attr('fill',C.text3).attr('font-family','Roboto Mono, monospace').attr('font-size',8).text(xr);
  });
  svg.append('text').attr('x',-34).attr('y',-2).attr('fill',C.text3).attr('font-size',9).text('X/R');

  const defs=svg.append('defs');
  const g=defs.append('linearGradient').attr('id','cbar').attr('x1',0).attr('y1',1).attr('x2',0).attr('y2',0);
  d3.range(0,1.001,0.1).forEach(t=>g.append('stop').attr('offset',t).attr('stop-color',zetaColor(t*1.2)));
  svg.append('rect').attr('x',w+14).attr('y',0).attr('width',10).attr('height',h).attr('fill','url(#cbar)').attr('rx',5);
  svg.append('rect').attr('x',w+10).attr('y',h*(1-ZETA_TH/1.2)).attr('width',18).attr('height',1.5).attr('fill','#FFFFFF').attr('opacity',.9);
  svg.append('text').attr('x',w+32).attr('y',h*(1-ZETA_TH/1.2)+3)
     .attr('fill',C.text).attr('font-family','Roboto Mono, monospace').attr('font-size',8).text(ZETA_TH);
}

// ──────────────────────────────────────────────────────────────────
// 미니 라인 차트
// ──────────────────────────────────────────────────────────────────
function drawMini(svgId, pts, key, opt){
  const el=document.getElementById(svgId);
  d3.select('#'+svgId).selectAll('*').remove();
  const valid=(pts||[]).filter(p=>isNum(p[key])&&isNum(p.scr));
  if(!valid.length){
    d3.select('#'+svgId).append('text').attr('x','50%').attr('y','50%')
      .attr('text-anchor','middle').attr('fill',C.text3).attr('font-size',10).text(opt.emptyText);
    return;
  }
  const W=el.clientWidth,H=el.clientHeight;
  const m={t:10,r:12,b:20,l:34};
  const w=W-m.l-m.r, h=H-m.t-m.b;
  const svg=d3.select('#'+svgId).append('g').attr('transform',`translate(${m.l},${m.t})`);

  const vals=valid.map(p=>p[key]);
  const yMax=Math.max(opt.threshold*1.25, d3.max(vals)*1.12);
  const xS=d3.scaleLinear().domain(d3.extent(valid,p=>p.scr)).nice().range([0,w]);
  const yS=d3.scaleLinear().domain([Math.min(0,d3.min(vals)),yMax]).range([h,0]);

  svg.append('line').attr('x1',0).attr('x2',w).attr('y1',yS(opt.threshold)).attr('y2',yS(opt.threshold))
     .attr('stroke',C.warn).attr('stroke-opacity',.5).attr('stroke-width',1).attr('stroke-dasharray','4,3');
  svg.append('text').attr('x',w).attr('y',yS(opt.threshold)-4).attr('text-anchor','end')
     .attr('fill',C.warn).attr('fill-opacity',.8).attr('font-family','Roboto Mono, monospace')
     .attr('font-size',8).text(opt.thLabel);

  svg.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(xS).ticks(4)).call(axStyle);
  svg.append('g').call(d3.axisLeft(yS).ticks(3).tickFormat(d=>d.toFixed(opt.dec))).call(axStyle);

  const line=d3.line().x(p=>xS(p.scr)).y(p=>yS(p[key])).curve(d3.curveMonotoneX);
  svg.append('path').datum(valid).attr('fill','none').attr('stroke',opt.color)
     .attr('stroke-width',2).attr('stroke-linecap','round').attr('stroke-linejoin','round').attr('d',line);

  const tooltip=document.getElementById('tooltip');
  svg.selectAll('circle.pt').data(valid).join('circle').attr('class','pt')
     .attr('cx',p=>xS(p.scr)).attr('cy',p=>yS(p[key])).attr('r',2.5).attr('fill',opt.color)
     .on('mouseover',(evt,p)=>{
       tooltip.style.opacity=1;
       tooltip.style.left=(evt.clientX+12)+'px';
       tooltip.style.top=(evt.clientY-8)+'px';
       tooltip.innerHTML=`SCR ${p.scr}<br>${opt.label} ${p[key].toFixed(opt.dec+1)}`;
     })
     .on('mouseout',()=>tooltip.style.opacity=0);

  if(opt.markMin){
    const mn=valid.reduce((a,b)=>b[key]<a[key]?b:a);
    svg.append('circle').attr('cx',xS(mn.scr)).attr('cy',yS(mn[key])).attr('r',5.5)
       .attr('fill','none').attr('stroke','#FFFFFF').attr('stroke-opacity',.9).attr('stroke-width',1.5);
    svg.append('text').attr('x',xS(mn.scr)).attr('y',yS(mn[key])-10).attr('text-anchor','middle')
       .attr('fill',C.text).attr('font-family','Roboto Mono, monospace').attr('font-size',8)
       .text(`min @ ${mn.scr}`);
  }

  if(opt.cliKey && cliRun && Array.isArray(cliRun.rows)){
    const cli=cliRun.rows.filter(r=>isNum(r.scr)&&isNum(r[opt.cliKey]));
    svg.selectAll('circle.cli').data(cli).join('circle').attr('class','cli')
       .attr('cx',r=>xS(r.scr)).attr('cy',r=>yS(r[opt.cliKey])).attr('r',3.5)
       .attr('fill','none').attr('stroke',C.cli).attr('stroke-width',1.5);
  }
}

function drawZeta(){
  drawMini('svg-zeta',scrSweep,'zeta',{
    threshold:ZETA_TH, thLabel:`ζ ${ZETA_TH}`, color:C.accent, dec:2,
    label:'ζ', emptyText:'SCR 스윕을 실행하세요', cliKey:'zeta_min'
  });
}
function drawDupv(){
  drawMini('svg-dupv',scrSweep,'du',{
    threshold:DUPV_TH, thLabel:`${DUPV_TH}%`, color:C.warn, dec:1,
    label:'Δu_pv %', emptyText:'SCR 스윕을 실행하세요', markMin:true
  });
}
