/* ============================================================
   机械翻页牌 Split-Flap Display
   ============================================================ */
'use strict';

const Flap = (() => {

  let audioCtx = null, soundOn = false;
  function click(vol){
    if (!soundOn) return;
    try{
      audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(),
            f = audioCtx.createBiquadFilter();
      o.type = 'square'; o.frequency.setValueAtTime(1400 + Math.random()*500, t);
      f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((vol||0.05), t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.05);
      o.connect(f); f.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t+0.06);
    }catch(e){}
  }
  function setSound(v){
    soundOn = !!v;
    if (soundOn && !audioCtx){
      try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    }
    if (soundOn && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function makeCell(){
    const c = document.createElement('span');
    c.className = 'fl';
    c.innerHTML =
      '<span class="fl-h fl-u"><i></i></span>' +
      '<span class="fl-h fl-d"><i></i></span>' +
      '<span class="fl-h fl-fu"><i></i></span>' +
      '<span class="fl-h fl-fd"><i></i></span>' +
      '<span class="fl-hinge"></span>';
    c._u  = c.querySelector('.fl-u  i');
    c._d  = c.querySelector('.fl-d  i');
    c._fu = c.querySelector('.fl-fu i');
    c._fd = c.querySelector('.fl-fd i');
    c._v  = '';
    return c;
  }

  function setCell(c, ch, quiet){
    if (c._v === ch) return false;
    const old = c._v || ' ';
    c._v = ch;
    if (quiet){
      c._u.textContent = ch; c._d.textContent = ch;
      c._fu.textContent = ch; c._fd.textContent = ch;
      return true;
    }
    c._u.textContent  = ch;   // 新字上半，旧牌翻走后露出
    c._d.textContent  = old;  // 旧字下半，等新牌翻下来覆盖
    c._fu.textContent = old;
    c._fd.textContent = ch;
    c.classList.remove('go');
    void c.offsetWidth;
    c.classList.add('go');
    clearTimeout(c._t);
    c._t = setTimeout(() => {
      c._d.textContent = ch;
      c.classList.remove('go');
    }, 210);
    return true;
  }

  /**
   * @param {HTMLElement} host
   * @param {object} o { pad:分隔符是否独立牌, cls:附加 class }
   */
  function create(host, o){
    o = o || {};
    host.classList.add('flapboard');
    if (o.cls) host.classList.add(o.cls);
    const st = { host, cells:[], sig:'', v:'' };

    st.set = function(text, quiet){
      text = String(text);
      const chars = text.split('');
      const sig = chars.map(c => /[\d]/.test(c) ? 'd' : c).join('');
      if (sig !== st.sig){
        host.innerHTML = ''; st.cells = [];
        chars.forEach(ch => {
          if (/[\d]/.test(ch)){
            const c = makeCell(); host.appendChild(c); st.cells.push(c); setCell(c, ch, true);
          } else {
            const s = document.createElement('span');
            s.className = 'fl-sep'; s.textContent = ch;
            host.appendChild(s); st.cells.push(null);
          }
        });
        st.sig = sig; st.v = text;
        host.setAttribute('data-v', text);
        return;
      }
      let n = 0;
      chars.forEach((ch, i) => {
        const c = st.cells[i];
        if (c){ if (setCell(c, ch, quiet)) n++; }
        else if (host.children[i]) host.children[i].textContent = ch;
      });
      if (n && !quiet) click(0.028 + Math.min(n,4)*0.006);
      st.v = text;
      host.setAttribute('data-v', text);
    };
    return st;
  }

  return { create, setSound, click };
})();
