/* ============================================================
   金库 · Canvas 金条 / 金币 可视化
   ============================================================ */
'use strict';

const Vault = (() => {

  function css(name, fb){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }

  function create(canvas){
    const st = {
      canvas, ctx: canvas.getContext('2d'),
      w:0, h:0, dpr:1,
      bars:0, coins:0, ghost:0, unit:1000,
      motes:[], t:0, running:false, reduced:false, drops:[]
    };

    function resize(){
      const r = canvas.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio||1, 2);
      st.w = Math.max(320, r.width); st.h = Math.max(240, r.height);
      canvas.width  = Math.round(st.w*st.dpr);
      canvas.height = Math.round(st.h*st.dpr);
      st.ctx.setTransform(st.dpr,0,0,st.dpr,0,0);
      seedMotes();
      draw();
    }
    function seedMotes(){
      st.motes = [];
      const n = Math.round(st.w/16);
      for (let i=0;i<n;i++) st.motes.push({
        x: Math.random()*st.w, y: Math.random()*st.h,
        r: 0.4 + Math.random()*1.5, s: 0.06 + Math.random()*0.22,
        a: 0.06 + Math.random()*0.22, p: Math.random()*Math.PI*2
      });
    }

    /* ---------- 金条 ---------- */
    function ingot(g, x, y, w, h, d, hot){
      const i = h*0.42, ox = d*0.62, oy = -d*0.36;
      const gold  = hot ? ['#FFF0BC','#F0CE72','#C89A34','#8C6417'] : ['#F6E4AE','#DEBE6E','#B2892C','#7A5613'];

      // 顶面
      g.beginPath();
      g.moveTo(x+i, y-h); g.lineTo(x+w-i, y-h);
      g.lineTo(x+w-i+ox, y-h+oy); g.lineTo(x+i+ox, y-h+oy); g.closePath();
      let lg = g.createLinearGradient(x+i, y-h, x+w-i+ox, y-h+oy);
      lg.addColorStop(0, gold[0]); lg.addColorStop(0.45, gold[1]); lg.addColorStop(1, gold[2]);
      g.fillStyle = lg; g.fill();

      // 侧面
      g.beginPath();
      g.moveTo(x+w, y); g.lineTo(x+w-i, y-h);
      g.lineTo(x+w-i+ox, y-h+oy); g.lineTo(x+w+ox*0.72, y+oy*0.72); g.closePath();
      lg = g.createLinearGradient(x+w, y, x+w+ox, y-h);
      lg.addColorStop(0, gold[3]); lg.addColorStop(1, gold[2]);
      g.fillStyle = lg; g.fill();

      // 正面
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x+w, y); g.lineTo(x+w-i, y-h); g.lineTo(x+i, y-h); g.closePath();
      lg = g.createLinearGradient(x, y, x, y-h);
      lg.addColorStop(0, gold[3]); lg.addColorStop(0.38, gold[2]);
      lg.addColorStop(0.72, gold[1]); lg.addColorStop(1, gold[0]);
      g.fillStyle = lg; g.fill();

      // 高光与压印
      g.save(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x+i*1.2, y-h*0.72); g.lineTo(x+w-i*1.2, y-h*0.72); g.stroke();
      g.strokeStyle = 'rgba(60,36,0,.30)';
      g.beginPath(); g.moveTo(x+i*1.4, y-h*0.34); g.lineTo(x+w-i*1.4, y-h*0.34); g.stroke();
      g.restore();

      g.strokeStyle = 'rgba(44,26,0,.42)'; g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x+w, y); g.lineTo(x+w-i, y-h); g.lineTo(x+i, y-h); g.closePath();
      g.stroke();
    }

    function ghostIngot(g, x, y, w, h, d){
      const i = h*0.42, ox = d*0.62, oy = -d*0.36;
      g.save();
      g.strokeStyle = css('--vault-ghost', 'rgba(210,180,110,.30)');
      g.lineWidth = 0.9; g.setLineDash([3,3]);
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x+w, y); g.lineTo(x+w-i, y-h); g.lineTo(x+i, y-h); g.closePath(); g.stroke();
      g.beginPath();
      g.moveTo(x+i, y-h); g.lineTo(x+i+ox, y-h+oy); g.lineTo(x+w-i+ox, y-h+oy); g.lineTo(x+w-i, y-h); g.stroke();
      g.restore();
    }

    /* ---------- 金币 ---------- */
    function coin(g, cx, cy, r, hot){
      const lg = g.createLinearGradient(cx-r, cy-r*0.5, cx+r, cy+r*0.5);
      lg.addColorStop(0, hot ? '#FFF3C4' : '#F3E0A8');
      lg.addColorStop(0.5, hot ? '#E8C468' : '#D4B25F');
      lg.addColorStop(1, '#9A742A');
      g.beginPath(); g.ellipse(cx, cy, r, r*0.42, 0, 0, Math.PI*2);
      g.fillStyle = lg; g.fill();
      g.strokeStyle = 'rgba(60,38,0,.4)'; g.lineWidth = 0.7; g.stroke();
      g.beginPath(); g.ellipse(cx, cy-r*0.09, r*0.56, r*0.23, 0, 0, Math.PI*2);
      g.strokeStyle = 'rgba(255,248,214,.5)'; g.stroke();
    }

    /* ---------- 背景：库门 + 聚光 ---------- */
    function backdrop(g){
      const bg1 = css('--vault-bg1','#0B0B0F'), bg2 = css('--vault-bg2','#191512');
      let lg = g.createLinearGradient(0,0,0,st.h);
      lg.addColorStop(0, bg1); lg.addColorStop(1, bg2);
      g.fillStyle = lg; g.fillRect(0,0,st.w,st.h);

      const cx = st.w*0.5, cy = st.h*0.42, R = Math.min(st.w,st.h)*0.44;
      // 库门
      g.save(); g.globalAlpha = 0.5;
      g.strokeStyle = css('--vault-line','rgba(198,166,102,.20)');
      for (let i=0;i<5;i++){
        g.lineWidth = i===0 ? 2.2 : 1;
        g.beginPath(); g.arc(cx, cy, R - i*13, 0, Math.PI*2); g.stroke();
      }
      for (let i=0;i<8;i++){
        const a = i/8*Math.PI*2 + 0.2;
        g.beginPath(); g.arc(cx + Math.cos(a)*(R-6), cy + Math.sin(a)*(R-6), 3.2, 0, Math.PI*2);
        g.fillStyle = css('--vault-line','rgba(198,166,102,.20)'); g.fill();
      }
      // 转盘
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI*2); g.stroke();
      for (let i=0;i<24;i++){
        const a = i/24*Math.PI*2 + st.t*0.0004;
        g.beginPath();
        g.moveTo(cx+Math.cos(a)*24, cy+Math.sin(a)*24);
        g.lineTo(cx+Math.cos(a)*30, cy+Math.sin(a)*30); g.stroke();
      }
      g.restore();

      // 聚光
      const rg = g.createRadialGradient(st.w*0.5, st.h*0.16, 10, st.w*0.5, st.h*0.5, st.h*1.05);
      rg.addColorStop(0, css('--vault-spot','rgba(255,226,150,.16)'));
      rg.addColorStop(0.55, 'rgba(255,214,130,.04)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0,0,st.w,st.h);

      // 地面
      const fy = st.h*0.78;
      const fg = g.createLinearGradient(0, fy-16, 0, st.h);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, css('--vault-floor','rgba(120,90,40,.20)'));
      g.fillStyle = fg; g.fillRect(0, fy-16, st.w, st.h-fy+16);
      g.strokeStyle = css('--vault-line','rgba(198,166,102,.18)');
      g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy); g.lineTo(st.w, fy); g.stroke();
      return fy;
    }

    function draw(){
      const g = st.ctx; if (!g) return;
      g.clearRect(0,0,st.w,st.h);
      const fy = backdrop(g);

      // 尺度自适应
      const compact = st.w < 640;
      let bw = compact ? 30 : 44, bh = compact ? 13 : 18, bd = compact ? 14 : 20;
      const total = st.bars, ghost = st.ghost;
      const N = Math.max(1, total + ghost);
      // 底排根数按总量开方定，让它始终堆成金字塔而不是摊成一条线；
      // 再用画布宽度收一次上限，避免宽度不够时横向溢出。
      const capW  = Math.max(3, Math.floor((st.w*0.72)/(bw*0.92)));
      const base  = Math.min(capW, Math.max(4, Math.ceil(Math.sqrt(N*1.7))));
      const rows = [];
      let left = N, row = 0;
      while (left > 0 && row < 16){
        const cap = Math.max(1, base - row);
        const n = Math.min(cap, left);
        rows.push(n); left -= n; row++;
      }
      // 金条数少时按堆的行列数把尺寸放大，填到画布的目标占比，
      // 否则十几根金条摊在大画布里会显得又小又空；只放大不缩小，上限 1.9 倍。
      const pileW = base * bw * 0.92;
      const pileH = rows.length * (bh + 2);
      const k = Math.min(1.9, Math.max(1, Math.min((st.w*0.50)/pileW, (st.h*0.42)/pileH)));
      bw *= k; bh *= k; bd *= k;
      // 由下向上绘制
      let drawn = 0;
      const baseY = fy - 4;
      rows.forEach((n, ri) => {
        const y = baseY - ri*(bh + 2);
        const totalW = n*bw*0.92;
        const x0 = st.w/2 - totalW/2 - (ri* (bd*0.16));
        for (let i=0;i<n;i++){
          const x = x0 + i*bw*0.92;
          const isReal = drawn < total;
          const hot = isReal && drawn >= total-1;
          if (isReal) ingot(g, x, y, bw, bh, bd, hot);
          else ghostIngot(g, x, y, bw, bh, bd);
          drawn++;
        }
      });

      // 散币：在金条堆右侧码成一小堆，别左右各撒一摊显得像散落的噪点
      const cr = compact ? 9 : 12;
      const cn = Math.min(st.coins, 9);
      const heapX = st.w/2 + (rows[0]||1)*bw*0.46 + cr*2.2;
      const HEAP = [[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[0,2],[1,2]];
      for (let i=0;i<cn;i++){
        const [hx, hy] = HEAP[i];
        coin(g, heapX + hx*cr*1.55 + hy*cr*0.78, fy - 6 - hy*cr*0.86, cr, i===cn-1);
      }

      // 落币动画
      st.drops = st.drops.filter(d => d.life > 0);
      st.drops.forEach(d => {
        d.life -= 1; d.vy += 0.55; d.y += d.vy; d.rot += d.vr;
        if (d.y > fy - 8){ d.y = fy - 8; d.vy *= -0.34; }
        g.save(); g.globalAlpha = Math.min(1, d.life/22);
        g.translate(d.x, d.y); g.rotate(d.rot);
        coin(g, 0, 0, cr, true); g.restore();
      });

      // 尘埃
      if (!st.reduced){
        st.motes.forEach(m => {
          g.beginPath();
          g.arc(m.x, m.y, m.r, 0, Math.PI*2);
          g.fillStyle = 'rgba(255,232,178,'+(m.a*(0.55+0.45*Math.sin(st.t*0.0016+m.p)))+')';
          g.fill();
        });
      }
    }

    function loop(){
      if (!st.running) return;
      st.t += 16;
      if (!st.reduced){
        st.motes.forEach(m => {
          m.y -= m.s; m.x += Math.sin(st.t*0.0009 + m.p)*0.16;
          if (m.y < -4){ m.y = st.h+4; m.x = Math.random()*st.w; }
        });
      }
      draw();
      requestAnimationFrame(loop);
    }

    st.setData = function(mintedAmount, expectedAmount, unit){
      st.unit = unit || 1000;
      const b = Math.floor(mintedAmount / st.unit);
      if (b > st.bars && st.bars > 0){
        for (let i=0;i<3;i++) st.drops.push({
          x: st.w/2 + (Math.random()-0.5)*90, y: -14,
          vy: 1 + Math.random()*2, rot:(Math.random()-0.5)*0.7,
          vr:(Math.random()-0.5)*0.14, life: 70
        });
      }
      st.bars  = b;
      st.coins = Math.floor((mintedAmount % st.unit) / (st.unit/10));
      st.ghost = Math.max(0, Math.floor(expectedAmount/st.unit) - b);
      if (!st.running) draw();
    };
    st.start = function(){
      if (st.running) return;
      st.running = true;
      st.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(loop);
    };
    st.stop = function(){ st.running = false; };
    st.resize = resize;
    st.redraw = draw;

    resize();
    return st;
  }

  return { create };
})();
