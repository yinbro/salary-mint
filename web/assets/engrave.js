/* ============================================================
   凹版雕版生成器 · Guilloche / Relief Engraving / Microtext
   全部参数化生成 SVG，不依赖任何图片资源
   ============================================================ */
'use strict';

const EN = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const R2 = n => Math.round(n*100)/100;

  /* 玫瑰花饰（车花）：两圆叠加的参数方程
     x = cx + R1·cos t + R2·cos(k t + φ)
     y = cy + R1·sin t + R2·sin(k t + φ)  */
  function rosette(cx, cy, o){
    const { R1=60, R2r=22, k=7, layers=9, phase=0, spin=0, steps=720, drift=0.9 } = o||{};
    const out = [];
    for (let L=0; L<layers; L++){
      const p = phase + L * (Math.PI*2) / layers * drift;
      const r1 = R1 - L*0.35, r2 = R2r + L*0.25;
      let d = '';
      for (let i=0; i<=steps; i++){
        const t = i/steps * Math.PI*2 + spin;
        const x = cx + r1*Math.cos(t) + r2*Math.cos(k*t + p);
        const y = cy + r1*Math.sin(t) + r2*Math.sin(k*t + p);
        d += (i ? 'L' : 'M') + R2(x) + ' ' + R2(y);
      }
      out.push(d + 'Z');
    }
    return out;
  }

  /* 编织波带（钞券边框内的辫状纹） */
  function waveBand(x0, y0, w, o){
    const { amp=7, freq=5.5, layers=10, amp2=2.4, freq2=17, phase=0, steps=460 } = o||{};
    const out = [];
    for (let L=0; L<layers; L++){
      const ph = phase + L/layers * Math.PI*2;
      let d = '';
      for (let i=0;i<=steps;i++){
        const u = i/steps, x = x0 + u*w;
        const y = y0 + amp*Math.sin(u*Math.PI*2*freq + ph) + amp2*Math.sin(u*Math.PI*2*freq2 - ph*1.7);
        d += (i ? 'L' : 'M') + R2(x) + ' ' + R2(y);
      }
      out.push(d);
    }
    return out;
  }

  /* 竖向编织波带 */
  function waveBandV(x0, y0, h, o){
    const { amp=7, freq=5.5, layers=10, amp2=2.4, freq2=17, phase=0, steps=460 } = o||{};
    const out = [];
    for (let L=0; L<layers; L++){
      const ph = phase + L/layers * Math.PI*2;
      let d = '';
      for (let i=0;i<=steps;i++){
        const u = i/steps, y = y0 + u*h;
        const x = x0 + amp*Math.sin(u*Math.PI*2*freq + ph) + amp2*Math.sin(u*Math.PI*2*freq2 - ph*1.7);
        d += (i ? 'L' : 'M') + R2(x) + ' ' + R2(y);
      }
      out.push(d);
    }
    return out;
  }

  /* 浮雕线刻圆盘：横向刻线随浮雕高度起伏，模拟凹版雕刻肖像的手法 */
  function reliefDisc(cx, cy, R, o){
    const { lines=54, amp=4.6, freq=3.1, phase=0, squeeze=1 } = o||{};
    const out = [];
    for (let i=1;i<lines;i++){
      const y  = cy - R + (2*R)*i/lines;
      const dy = (y - cy)/R;
      const half = Math.sqrt(Math.max(0, 1 - dy*dy)) * R * squeeze;
      if (half < 3) continue;
      const steps = Math.max(24, Math.round(half/2.2));
      let d = '';
      for (let j=0;j<=steps;j++){
        const x = cx - half + (2*half)*j/steps;
        const u = (x - cx)/R;
        const relief = Math.cos(u*Math.PI/2) * Math.cos(dy*Math.PI/2);
        const yy = y + amp*relief*Math.sin(u*Math.PI*freq + phase + i*0.22);
        d += (j ? 'L' : 'M') + R2(x) + ' ' + R2(yy);
      }
      out.push(d);
    }
    return out;
  }

  /* 同心车花环（细密同心椭圆，带径向调制） */
  function latheRing(cx, cy, r0, r1, o){
    const { rings=26, lobes=24, amp=3.2, phase=0, steps=360 } = o||{};
    const out = [];
    for (let i=0;i<rings;i++){
      const rr = r0 + (r1-r0)*i/(rings-1);
      const a  = amp * Math.sin(i/rings*Math.PI);
      let d = '';
      for (let j=0;j<=steps;j++){
        const t = j/steps*Math.PI*2;
        const R = rr + a*Math.cos(lobes*t + phase + i*0.35);
        d += (j ? 'L' : 'M') + R2(cx + R*Math.cos(t)) + ' ' + R2(cy + R*Math.sin(t)*0.995);
      }
      out.push(d + 'Z');
    }
    return out;
  }

  /* 网格底纹（防复印细网） */
  function meshLines(x0, y0, w, h, gap, ang){
    const out = [];
    const rad = ang*Math.PI/180, L = Math.hypot(w,h);
    const n = Math.ceil(L/gap);
    for (let i=-n;i<=n;i++){
      const ox = i*gap*Math.cos(rad+Math.PI/2), oy = i*gap*Math.sin(rad+Math.PI/2);
      const cx = x0+w/2+ox, cy = y0+h/2+oy;
      out.push('M'+R2(cx - L*Math.cos(rad)/2)+' '+R2(cy - L*Math.sin(rad)/2)+
               'L'+R2(cx + L*Math.cos(rad)/2)+' '+R2(cy + L*Math.sin(rad)/2));
    }
    return out;
  }

  /* ---------- DOM 组装 ---------- */
  function el(tag, attrs, txt){
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (txt != null) n.textContent = txt;
    return n;
  }
  function group(paths, attrs){
    const g = el('g', attrs);
    paths.forEach(d => g.appendChild(el('path', { d })));
    return g;
  }

  /* 微缩文字：沿路径重复排布 */
  function microPath(svg, id, d, text, attrs){
    let defs = svg.querySelector('defs');
    if (!defs){ defs = el('defs'); svg.insertBefore(defs, svg.firstChild); }
    defs.appendChild(el('path', { id, d, fill:'none' }));
    const t = el('text', Object.assign({ class:'mt' }, attrs||{}));
    const tp = el('textPath', { href:'#'+id, startOffset:'0' });
    tp.setAttribute('xlink:href', '#'+id);
    tp.textContent = new Array(46).join(text + ' · ');
    t.appendChild(tp);
    return t;
  }

  return { rosette, waveBand, waveBandV, reliefDisc, latheRing, meshLines, el, group, microPath, NS };
})();
