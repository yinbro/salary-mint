/* ============================================================
   薪水铸币厂 · 钞券版 主程序
   ============================================================ */
'use strict';

(() => {

const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const CFG_KEY = 'mintatl.cfg.v1';
const OVR_KEY = 'mintatl.days.v1';
const META_KEY = 'mintatl.meta.v4';
const BUILD   = 'Edition IV · 月度账本 · 2026.10';

/* ---------- 默认配置 ----------
   班次默认按上海互联网常见口径：10:00 开工、12:00–14:00 午休、19:00 收工，
   午休不计薪 → 每日计薪 420 分钟。可在设置抽屉里改。 */
const DEF = {
  schemaVersion:SCHEMA_VERSION, mode:'month', monthly:15000, workDays:21.75, hourly:100,
  annualMonths:15, bonusMonths:3, bonusFactor:1, bonusMonth:12,
  viewMode:'annualized', bonusSpread:true,
  start:'10:00', end:'19:00', lunch:120, lunchAt:'12:00',
  week:[1,2,3,4,5], theme:'auto',
  siBase:0, hfBase:0, hfRate:0.05, taxStartMonth:1,
  netMode:false, sound:false, sig:'MINT MASTER', unit:1000,
  goalSet:'life',
  goals: JSON.parse(JSON.stringify(GOAL_SETS[0].goals))
};

function loadJSON(k, def, merge){
  try{
    const raw = localStorage.getItem(k);
    if (!raw) return JSON.parse(JSON.stringify(def));
    const v = JSON.parse(raw);
    return merge ? Object.assign(JSON.parse(JSON.stringify(def)), v) : v;
  }catch(e){ return JSON.parse(JSON.stringify(def)); }
}
const hadCfg = !!localStorage.getItem(CFG_KEY);
function migrateCfg(raw){
  const out = Object.assign(JSON.parse(JSON.stringify(DEF)), raw || {});
  /* 只在字段缺失时映射旧 annualMonths / bonusSpread，绝不覆盖用户已有 Edition IV 自定义值。 */
  const hasRaw = !!(raw && Object.keys(raw).length);
  if (hasRaw && raw.bonusMonths == null) out.bonusMonths = Math.max(0, (Number(raw.annualMonths)||12) - 12);
  if (hasRaw && raw.bonusFactor == null) out.bonusFactor = 1;
  if (hasRaw && raw.viewMode == null) out.viewMode = raw.bonusSpread === false ? 'actual' : 'annualized';
  out.annualMonths = 12 + Math.max(0, Number(out.bonusMonths)||0);
  out.bonusSpread = out.viewMode === 'annualized';
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}
let cfg   = migrateCfg(loadJSON(CFG_KEY, {}, false));
let ovr   = loadJSON(OVR_KEY, {}, false);
let draft = null;
let M     = PR.shift(cfg);
const firstRun = !hadCfg;
try{ if (hadCfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch(e){}

function persist(){
  try{
    cfg.viewMode = cfg.viewMode === 'actual' ? 'actual' : 'annualized';
    cfg.bonusSpread = cfg.viewMode === 'annualized';
    cfg.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    localStorage.setItem(OVR_KEY, JSON.stringify(ovr));
  }catch(e){ toast('本地存储不可用，改动不会保留'); }
}

/* ============================================================
   心情戳（本机 Cookie 持久化）
   mood[key] = { d:'g'|'s'|'b', w:'e'|'h' }
     d 心情：g 开心 / s 一般 / b 不开心
     w 钱  ：e 不难赚 / h 难赚
   编码：v1|202609:16gh,17s-|202610:01b-
     每天 4 字符，一年 365 天约 2.1 KB，留在单个 Cookie 的 4 KB 上限内。
   Cookie 在 file:// 协议下会被浏览器拒收，此时自动退回 localStorage。
   ============================================================ */
const MOOD_CK  = 'mintatl_mood';
const MOOD_LS  = 'mintatl.mood.v1';
const MOOD_DETAIL_LS = 'mintatl.mood.v4';
const MOOD_MAX = 3500;   // Cookie 字符上限保护
const MOOD_D = { g:{ em:'🙂', t:'开心' }, s:{ em:'😐', t:'一般' }, b:{ em:'😖', t:'不开心' } };
const MOOD_W = { e:{ em:'💰', t:'这钱不难赚' }, h:{ em:'🥵', t:'这钱难赚' } };
let moodCookieOK = true;

function ckGet(name){
  try{
    const all = String(document.cookie||'').split('; ');
    for (const it of all) if (it.indexOf(name + '=') === 0) return decodeURIComponent(it.slice(name.length+1));
  }catch(e){}
  return '';
}
function ckSet(name, val){
  try{
    document.cookie = name + '=' + encodeURIComponent(val) + '; path=/; max-age=31536000; SameSite=Lax';
    return ckGet(name) === val;
  }catch(e){ return false; }
}
function encMood(m){
  const by = {};
  Object.keys(m).sort().forEach(k => {
    const v = m[k]; if (!v || (!v.d && !v.w)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    const ym = k.slice(0,4) + k.slice(5,7);
    (by[ym] = by[ym] || []).push(k.slice(8,10) + (v.d||'-') + (v.w||'-'));
  });
  const ks = Object.keys(by).sort();
  if (!ks.length) return '';
  return 'v1|' + ks.map(ym => ym + ':' + by[ym].join(',')).join('|');
}
function decMood(s){
  const out = {};
  if (!s || s.indexOf('v1|') !== 0) return out;
  s.slice(3).split('|').forEach(seg => {
    const i = seg.indexOf(':'); if (i !== 6) return;
    const ym = seg.slice(0,6);
    seg.slice(i+1).split(',').forEach(t => {
      if (t.length < 3) return;
      const k = ym.slice(0,4) + '-' + ym.slice(4,6) + '-' + t.slice(0,2);
      const v = {};
      if ('gsb'.indexOf(t[2]) >= 0) v.d = t[2];
      if (t[3] && 'eh'.indexOf(t[3]) >= 0) v.w = t[3];
      if (v.d || v.w) out[k] = v;
    });
  });
  return out;
}
function loadMood(){
  let legacy = {};
  try{
    /* localStorage 是主存储；旧 Cookie 只在本机无记录时迁入。 */
    legacy = decMood(localStorage.getItem(MOOD_LS) || '');
    if (!Object.keys(legacy).length) legacy = decMood(ckGet(MOOD_CK));
    const rich = JSON.parse(localStorage.getItem(MOOD_DETAIL_LS) || '{}');
    return Object.assign(legacy, rich && typeof rich === 'object' ? rich : {});
  }catch(e){ return legacy; }
}
let mood = loadMood();

function saveMood(){
  /* Cookie 只写轻量兼容字段；完整数据（原因标签等）始终写 localStorage。 */
  let enc = encMood(mood);
  const compact = Object.assign({}, mood);
  while (enc.length > MOOD_MAX){
    const oldest = Object.keys(compact).sort()[0];
    if (!oldest) break;
    delete compact[oldest];
    enc = encMood(compact);
  }
  const ok = ckSet(MOOD_CK, enc);
  moodCookieOK = ok;
  try{
    localStorage.setItem(MOOD_LS, enc);
    localStorage.setItem(MOOD_DETAIL_LS, JSON.stringify(mood));
  }catch(e){}
  return ok;
}
try{ if (!localStorage.getItem(MOOD_DETAIL_LS) && Object.keys(mood).length) saveMood(); }catch(e){}
function moodOf(k){ return mood[k] || null; }
function moodStats(y, m){
  let n=0, g=0, s=0, b=0, e=0, h=0;
  const pre = m == null ? String(y) : (y + '-' + PR.pad(m+1));
  Object.keys(mood).forEach(k => {
    if (k.indexOf(pre) !== 0) return;
    const v = mood[k]; n++;
    if (v.d === 'g') g++; else if (v.d === 's') s++; else if (v.d === 'b') b++;
    if (v.w === 'e') e++; else if (v.w === 'h') h++;
  });
  return { n, g, s, b, e, h };
}
function recordsForMonth(y,m){
  const pre = y + '-' + PR.pad(m+1);
  return Object.keys(mood).filter(k => k.slice(0,7) === pre).sort().map(k => ({ key:k, ...mood[k] }));
}
function setViewMode(mode){
  cfg.viewMode = mode === 'actual' ? 'actual' : 'annualized';
  cfg.bonusSpread = cfg.viewMode === 'annualized';
  M = PR.shift(cfg); persist(); lastDayKey = ''; lastMonthKey = '';
  renderViewMode(); renderCalendar(); renderHeat(); renderPayroll(); tick();
}
function renderViewMode(){
  const annualized = cfg.viewMode !== 'actual';
  $$('#viewQuick button').forEach(b => b.classList.toggle('on', b.dataset.v === cfg.viewMode));
  $('#viewNote').textContent = annualized
    ? '当前按年化价值显示：实际奖金按全年工作日摊入日薪；税务计算不变。'
    : '当前按实际发薪显示：普通月份只算 base，奖金在 ' + (cfg.bonusMonth||12) + ' 月集中；税务计算不变。';
}

/* ---------- 格式化 ---------- */
const fmt = (n, d) => {
  d = d == null ? 2 : d;
  const v = (!isFinite(n) ? 0 : n);
  return v.toLocaleString('zh-CN', { minimumFractionDigits:d, maximumFractionDigits:d });
};
const yuan  = (n, d) => '￥' + fmt(n, d == null ? 2 : d);
const yuan0 = n => '￥' + fmt(n, 0);
const pct   = n => fmt(Math.max(0, Math.min(100, n)), 1) + '%';

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ============================================================
   1. 雕版图层
   ============================================================ */
function buildEngraving(){
  const mk = (host, verso) => {
    host.innerHTML = '';
    const add = (svg, x, y, w, h) => {
      svg.setAttribute('style', `left:${x};top:${y};width:${w};height:${h}`);
      host.appendChild(svg);
    };
    const S = (vb, cls) => {
      const s = EN.el('svg', { viewBox:vb, preserveAspectRatio:'none', class:cls });
      s.setAttribute('aria-hidden','true'); return s;
    };

    /* 上下编织带 */
    [['4%','15px'],['4%','calc(100% - 33px)']].forEach((p, i) => {
      const s = S('0 0 900 18', 'gl');
      s.appendChild(EN.group(EN.waveBand(0, 9, 900, { amp:5.4, freq:16, layers:9, amp2:1.8, freq2:47, phase:i*1.1 })));
      add(s, p[0], p[1], '92%', '18px');
    });
    /* 左右编织带 */
    [['15px'],['calc(100% - 33px)']].forEach((p, i) => {
      const s = S('0 0 18 500', 'gl2');
      s.appendChild(EN.group(EN.waveBandV(9, 0, 500, { amp:5, freq:11, layers:8, amp2:1.6, freq2:31, phase:i*0.9 })));
      add(s, p[0], '5%', '18px', '90%');
    });
    /* 四角车花：尺寸与位置全部交给 CSS 变量 --cs/--ci，
       这样窄屏可以等比收小，且与 .note-ui 的安全内边距只有一处口径 */
    for (let i = 0; i < 4; i++){
      const s = S('0 0 84 84', (i%2 ? 'gl2' : 'gl') + ' cnr c' + i);
      s.appendChild(EN.group(EN.rosette(42, 42, { R1:22, R2r:9, k:i%2?9:7, layers:8, spin:i*0.4 })));
      s.appendChild(EN.group(EN.latheRing(42, 42, 30, 38, { rings:7, lobes:i%2?30:24, amp:2, phase:i })));
      host.appendChild(s);
    }
    /* 微缩文字带 */
    const mt = EN.el('svg', { viewBox:'0 0 900 10', preserveAspectRatio:'none' });
    mt.appendChild(EN.microPath(mt, 'mtp'+(verso?'v':'r'), 'M0 7 L900 7',
      verso ? 'TIME IS THE ONLY COLLATERAL' : 'SALARY MINT ATELIER'));
    add(mt, '4%', 'calc(100% - 46px)', '92%', '10px');

    /* 大面积车花：尺寸位置交给 CSS（--bs），窄屏要能整块隐藏，
       否则 300px 车花会盖满窄券、把「每秒进账/时薪」这些小字淹掉 */
    const big = S('0 0 300 300', 'gl3 big' + (verso ? ' mid' : ''));
    big.appendChild(EN.group(EN.rosette(150, 150, { R1:74, R2r:30, k:11, layers:12, drift:0.7 })));
    big.appendChild(EN.group(EN.latheRing(150, 150, 96, 132, { rings:16, lobes:44, amp:4.2 })));
    host.appendChild(big);

    /* 券背原来还有左右两枚 200px 车花，但页边只有 88px，
       它们必然压在「日薪 / 每秒」这些标签上，故不再生成；
       券背的装饰由中心大车花 + 四角车花 + 编织带承担。 */
  };
  mk($('#engRecto'), false);
  mk($('#engVerso'), true);

  /* 左侧浮雕勋章 */
  const md = $('#engMedal');
  md.innerHTML = '';
  const g1 = EN.group(EN.reliefDisc(100, 100, 62, { lines:56, amp:4.4, freq:3.2 }), { class:'rel' });
  const g2 = EN.group(EN.latheRing(100, 100, 68, 92, { rings:20, lobes:36, amp:3.4 }), { class:'lathe' });
  const g3 = EN.group(EN.rosette(100, 100, { R1:30, R2r:13, k:9, layers:7 }), { class:'gl3' });
  md.appendChild(g1); md.appendChild(g2); md.appendChild(g3);

  /* 印章内的车花 */
  [['#seal-gl', 7], ['#seal-gl2', 9]].forEach(([sel, k]) => {
    const g = $(sel); if (!g) return;
    g.innerHTML = '';
    EN.rosette(20, 20, { R1:10.5, R2r:4.4, k, layers:6 }).forEach(d => {
      g.appendChild(EN.el('path', { d }));
    });
  });
}

/* ============================================================
   2. 翻页牌
   ============================================================ */
const boardMain = Flap.create($('#boardMain'), { cls:'lg' });

/* ============================================================
   3. 冠字号
   ============================================================ */
function serial(now){
  const seed = (cfg.mode==='month'? cfg.monthly : cfg.hourly) + M.paid + now.getDate();
  const L = 'ABCDEFGHJKLMNPQRSTUVWXY';
  const a = L[Math.floor(seed) % L.length];
  const b = L[Math.floor(seed/7 + now.getMonth()) % L.length];
  const p = PR.pad;
  return a + b + ' ' + p(now.getMonth()+1) + p(now.getDate()) + p(now.getHours()) + p(now.getMinutes());
}

/* ============================================================
   4. 核心渲染
   ============================================================ */
const STATE_TXT = {
  work:'铸造中', lunch:'午休停机', pre:'尚未开炉', off:'今日收工',
  rest:'周末休炉', legal:'法定节假日', holiday:'放假中', leave:'请假 · 不计薪'
};
const vault = Vault.create($('#vaultCv'));
let vaultOn = false;
let lastDayKey = '';
let lastMonthKey = '';

function netRatio(now){
  if (!cfg.netMode) return 1;
  const r = PR.netNow(cfg, now.getMonth());
  return r.ratio;
}

function tick(){
  const now = new Date();
  const S   = PR.todayState(now, cfg, ovr, M);
  const ratio = netRatio(now);
  const plan = S.plan;

  /* --- 今日金额 --- */
  const dayFull = PR.dayAmount(plan, M);
  let paidMin = 0, earned = 0, prog = 0;
  if (S.s === 'work' || S.s === 'lunch' || S.s === 'off'){
    paidMin = PR.paidElapsed(S.rel, M);
    prog = paidMin / M.paid;
    earned = dayFull * prog;
  } else if (S.s === 'pre'){ prog = 0; earned = 0; }
  else { prog = 0; earned = 0; }

  const shown = earned * ratio;
  boardMain.set(fmt(shown, 2));
  $('#dayState').textContent = STATE_TXT[S.s] || '—';
  $('#dayState').className = 'st' + (S.s === 'work' ? ' live' : '');
  $('#netFlag').hidden = !cfg.netMode;

  const perSecShown = (S.s === 'work' ? M.perSec * (plan.type==='ot'?plan.mult:1) : 0) * ratio;
  $('#mRate').textContent = S.s === 'work' ? '￥' + fmt(perSecShown, 4) : '￥0.0000';
  $('#mHour').textContent = yuan(M.perHour * ratio * (plan.type==='ot'?plan.mult:1), 2);
  $('#mDay').textContent  = yuan(dayFull * ratio, 2);
  $('#mPct').textContent  = pct(prog*100);

  const s = serial(now);
  $('#serialTop').textContent = s;
  $('#serialBot').textContent = s;
  $('#noteDate').textContent = now.getFullYear() + '.' + PR.pad(now.getMonth()+1) + '.' + PR.pad(now.getDate())
    + ' · 周' + ['日','一','二','三','四','五','六'][now.getDay()];
  $('#medalCap').textContent = plan.holiday
    ? plan.holiday + (plan.isMakeup ? ' 调休上班' : (plan.isLegal ? ' 法定节假日' : ' 放假')) + ' · 午休不计薪'
    : '见票即付 · 午休不计薪';

  /* --- 时间轴 --- */
  renderTimeline(S, prog, now);

  /* --- 倒计时 --- */
  renderCountdown(S, now, dayFull, ratio, paidMin);

  /* --- 月度 --- */
  const ms = PR.monthStats(now, cfg, ovr, M);
  const monthKey = now.getFullYear()+'-'+now.getMonth();
  $('#moMint').textContent = yuan(ms.minted * ratio, 2);
  $('#moExp').textContent  = yuan(ms.expected * ratio, 2);
  $('#moDays').textContent = ms.workDays + (ms.otDays ? ' + ' + ms.otDays : '') + ' 天';
  $('#moDone').textContent = ms.doneDays + ' 天';
  $('#moTag').textContent  = (now.getMonth()+1) + ' 月';
  const mp = ms.expected > 0 ? ms.minted/ms.expected*100 : 0;
  $('#moBar').style.width = Math.min(100, mp) + '%';
  renderMonthLedger(now, ms);
  const canClose = S.s === 'off' && plan.type !== 'leave';
  $('#settleCta').classList.toggle('ready', canClose);
  $('#settleState').textContent = canClose ? '已到收工时间' : (moodOf(PR.dkey(now)) ? '今日已记录' : '随时可记');

  /* --- 金库 --- */
  $('#vMint').textContent = yuan(ms.minted * ratio, 0);
  $('#vExp').textContent  = yuan(ms.expected * ratio, 0);
  const unit = Number(cfg.unit) || 1000;
  vault.setData(ms.minted * ratio, ms.expected * ratio, unit);
  $('#vUnit').textContent  = yuan0(unit);
  $('#vCoin').textContent  = yuan0(unit/10);
  $('#vBars').textContent  = vault.bars;
  $('#vCoins').textContent = vault.coins;
  $('#vGhost').textContent = vault.ghost;
  $('#moOt').textContent = ms.otDays ? yuan(ms.list.filter(d=>d.type==='ot').reduce((a,d)=>a+d.amt,0)*ratio, 0) : '￥0';
  $('#moOtSub').textContent = ms.otDays ? ms.otDays + ' 天整日加班' : '本月尚无加班标记';
  $('#moLegal').textContent  = ms.legalDays + ' 天';
  $('#moMakeup').textContent = ms.list.filter(d=>d.isMakeup).length + ' 天';

  /* --- 本年累计（按月缓存，仅当月实时） --- */
  const yr = yearToDate(now, ms);
  $('#yMint').textContent = yuan(yr.total * ratio, 0);
  $('#yMintSub').textContent = yr.days + ' 个计薪日 · ' + now.getFullYear() + ' 年';

  /* --- 小目标 --- */
  renderGoals(shown);

  /* --- 券背 --- */
  renderVerso(now, ms, ratio, dayFull);

  /* --- 换算所 & 勋章 --- */
  renderExchange(shown, dayFull, ratio);
  renderMedals({ now, S, shown, dayFull, prog, ms, bars:vault.bars });

  /* --- 日历/日历表/薪酬：跨天或跨月才重算 --- */
  const dk = PR.dkey(now);
  if (dk !== lastDayKey){
    lastDayKey = dk;
    if (monthKey !== lastMonthKey){ lastMonthKey = monthKey; }
    renderCalendar(); renderHeat(); renderPayroll();
  }
}

function renderMonthLedger(now, ms){
  const ty = PR.taxYear(cfg), row = ty.rows[now.getMonth()];
  const ratio = row && row.active && row.gross ? row.net / row.gross : 1;
  const gross = ms.expected;
  let net = gross * ratio;
  if (ms.bonus) net = (gross - ms.bonus) * ratio + ms.bonus - ty.bonus.tax;
  const rec = recordsForMonth(now.getFullYear(), now.getMonth());
  $('#ldGross').textContent = yuan0(gross) + (cfg.viewMode === 'actual' ? ' · 实际' : ' · 年化');
  $('#ldNet').textContent = yuan0(net) + ' · 估算';
  $('#ldDays').textContent = ms.doneDays + ' / ' + Math.max(0, ms.workDays - ms.doneDays) + ' 天';
  $('#ldRecords').textContent = rec.length + ' 天';
}

/* 本年累计：往月结果缓存，当月取实时 */
let _ytdKey = '', _ytdPast = { total:0, days:0 };
function yearToDate(now, ms){
  const key = [now.getFullYear(), now.getMonth(), PR.dkey(now),
               cfg.mode, cfg.monthly, cfg.hourly, cfg.workDays,
               cfg.start, cfg.end, cfg.lunch, cfg.lunchAt, cfg.week.join(''),
               Object.keys(ovr).length].join('|');
  if (key !== _ytdKey){
    let t = 0, d = 0;
    for (let m=0;m<now.getMonth();m++){
      const st = PR.monthStats(now, cfg, ovr, M, now.getFullYear(), m);
      t += st.minted; d += st.doneDays;
    }
    _ytdPast = { total:t, days:d };
    _ytdKey = key;
  }
  return { total:_ytdPast.total + ms.minted, days:_ytdPast.days + ms.doneDays };
}

/* ---------- 时间轴 ---------- */
function renderTimeline(S, prog, now){
  const host = $('#tl');
  const pre = host._built;
  if (!pre){
    host.innerHTML =
      '<div class="tl-track"><div class="tl-seg pay" data-a></div><div class="tl-seg lun" data-b></div>' +
      '<div class="tl-seg pay" data-c></div>' +
      '<div class="tl-fill" data-f></div><div class="tl-fill" data-f2></div></div>' +
      '<div class="tl-now" data-n hidden></div><div data-mk></div>';
    host._built = true;
  }
  const pctOf = m => (m / M.span) * 100;
  host.querySelector('[data-a]').style.cssText = `left:0;width:${pctOf(M.lRel)}%`;
  host.querySelector('[data-b]').style.cssText = `left:${pctOf(M.lRel)}%;width:${pctOf(M.lunch)}%`;
  host.querySelector('[data-c]').style.cssText = `left:${pctOf(M.lRel+M.lunch)}%;right:0`;
  // 进度金色必须被午休段切断：午休不计薪，画成连续一条会跟核心口径自相矛盾
  const fillRel = PR.relAtPaid(prog * M.paid, M);
  const lunEnd  = M.lRel + M.lunch;
  host.querySelector('[data-f]').style.cssText =
    `left:0;width:${Math.min(100, pctOf(Math.min(fillRel, M.lRel)))}%`;
  host.querySelector('[data-f2]').style.cssText =
    `left:${pctOf(lunEnd)}%;width:${Math.min(100, pctOf(Math.max(0, fillRel - lunEnd)))}%`;

  const nw = host.querySelector('[data-n]');
  const live = (S.s==='work'||S.s==='lunch');
  nw.hidden = !live;
  if (live){
    nw.style.left = Math.min(100, Math.max(0, pctOf(S.rel))) + '%';
    nw.setAttribute('data-t', PR.pad(now.getHours())+':'+PR.pad(now.getMinutes()));
  }

  const mk = host.querySelector('[data-mk]');
  const marks = [
    [0, PR.hhmm(M.s), '开工'],
    [M.lRel, PR.hhmm(M.s+M.lRel), '午休'],
    [M.lRel+M.lunch, PR.hhmm(M.s+M.lRel+M.lunch), '复工'],
    [M.span, PR.hhmm(M.s+M.span), '收工']
  ];
  const sig = marks.map(m=>m[1]).join('|');
  if (mk._sig !== sig){
    mk._sig = sig;
    // 首末两个刻度不能居中对齐，否则标签有一半被容器裁掉
    mk.innerHTML = marks.map((m, i) => {
      const edge = i === 0 ? ' first' : (i === marks.length-1 ? ' last' : '');
      return `<div class="tl-mk${edge}" style="left:${Math.min(100, Math.max(0, pctOf(m[0])))}%"><b>${m[1]}</b><span>${m[2]}</span></div>`;
    }).join('');
  }
  $('#tlRange').textContent = PR.hhmm(M.s) + '–' + PR.hhmm(M.s+M.span)
    + ' · 计薪 ' + fmt(M.paid/60, 1) + ' 小时';
}

/* ---------- 倒计时 ---------- */
function renderCountdown(S, now, dayFull, ratio, paidMin){
  const T = $('#cdTitle'), V = $('#cdVal'), U = $('#cdSub'), B = $('#cdBar');
  const dur = ms => {
    ms = Math.max(0, ms);
    const s = Math.floor(ms/1000), d = Math.floor(s/86400), h = Math.floor(s%86400/3600),
          m = Math.floor(s%3600/60), ss = s%60;
    if (d > 0) return d + '天' + PR.pad(h) + '时' + PR.pad(m) + '分';
    return PR.pad(h)+':'+PR.pad(m)+':'+PR.pad(ss);
  };
  if (S.s === 'work'){
    const endMs = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime() + (M.s+M.span)*60000;
    T.textContent = '距收工';
    V.textContent = dur(endMs - now.getTime());
    U.textContent = '剩余计薪 ' + fmt((M.paid - paidMin)/60, 2) + ' 小时 · 可再铸 ' + yuan((dayFull-dayFull*paidMin/M.paid)*ratio, 2);
    B.style.width = (paidMin/M.paid*100) + '%';
  } else if (S.s === 'lunch'){
    const t = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime() + (M.s+M.lRel+M.lunch)*60000;
    T.textContent = '距复工';
    V.textContent = dur(t - now.getTime());
    U.textContent = '午休不计薪 · 机器停转';
    B.style.width = ((S.rel - M.lRel)/M.lunch*100) + '%';
  } else {
    const t = PR.nextWorkStart(now, cfg, ovr, M);
    T.textContent = '距开炉';
    V.textContent = dur(t - now.getTime());
    const d = new Date(t);
    U.textContent = '下一炉：' + (d.getMonth()+1) + '/' + d.getDate() + ' ' + PR.hhmm(M.s)
      + ' · ' + ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    B.style.width = '0%';
  }
}

/* ---------- 可兑换体系 ---------- */
const goalSig  = gs => (gs||[]).map(g=>g.em+'|'+g.name+'|'+g.amt).join('/');
const findSet  = id => GOAL_SETS.filter(s => s.id === id)[0] || null;
function matchSet(gs){
  const s = goalSig(gs);
  for (let i=0;i<GOAL_SETS.length;i++) if (goalSig(GOAL_SETS[i].goals) === s) return GOAL_SETS[i].id;
  return 'custom';
}
function setChips(cur){
  const list = GOAL_SETS.map(s =>
    `<button type="button" data-s="${s.id}" class="${s.id===cur?'on':''}" title="${s.d}">${s.n}</button>`).join('');
  return list + (cur === 'custom' ? '<button type="button" class="on" data-s="custom">自定义</button>' : '');
}
function renderGoalSets(){
  const cur = cfg.goalSet || matchSet(cfg.goals);
  const h = setChips(cur);
  const el = $('#goalSets');
  if (el && el._sig !== h){ el._sig = h; el.innerHTML = h; }
}
function applyGoalSet(id){
  const s = findSet(id); if (!s) return;
  cfg.goals = JSON.parse(JSON.stringify(s.goals));
  cfg.goalSet = s.id;
  persist(); renderGoalSets(); tick();
  toast('已切换到「' + s.n + '」体系');
}

/* ---------- 小目标 ---------- */
function renderGoals(shown){
  const host = $('#goals');
  const sig = cfg.goals.map(g=>g.em+g.name+g.amt).join('|');
  if (host._sig !== sig){
    host._sig = sig;
    host.innerHTML = cfg.goals.map((g,i) =>
      `<div class="goal" data-i="${i}"><span class="gf"></span>
        <div class="gt"><em>${g.em||'◆'}</em><span>${g.name}</span></div>
        <div class="gn"><b data-n>—</b><span data-p>—</span></div></div>`).join('');
  }
  cfg.goals.forEach((g,i) => {
    const el = host.children[i]; if (!el) return;
    const r = g.amt > 0 ? shown/g.amt : 0;
    el.classList.toggle('done', r >= 1);
    el.querySelector('.gf').style.width = Math.min(100, r*100) + '%';
    el.querySelector('[data-n]').textContent = r >= 1
      ? '×' + Math.floor(r)
      : pct(r*100);
    el.querySelector('[data-p]').textContent = r >= 1
      ? '已铸够 ' + yuan0(g.amt)
      : '还差 ' + yuan(g.amt - shown, 2);
  });
}

/* ---------- 券背 ---------- */
function renderVerso(now, ms, ratio, dayFull){
  const ty = PR.taxYear(cfg);
  const row = ty.rows[now.getMonth()];
  const A = ty.annual;
  const isM = cfg.mode === 'month';
  const rows = [
    ['计薪方式', isM
      ? '按月薪 ÷ ' + fmt(cfg.workDays,2) + ' 天' + (A.spread ? ' × ' + fmt(A.months,A.months%1?1:0) + '/12 年化' : '')
      : '按时薪 × 计薪时长'],
    ['年薪月数', isM
      ? fmt(A.months, A.months%1?1:0) + ' 薪 · 12 月 base' + (A.bonusM>0 ? ' + ' + fmt(A.bonusM,A.bonusM%1?1:0) + ' 月年终奖' : '')
      : '—（时薪无年终奖）'],
    ['班次', PR.hhmm(M.s)+'–'+PR.hhmm(M.s+M.span)],
    ['午休', M.lunch + ' 分钟 · 不计薪'],
    ['计薪时长', fmt(M.paid/60,2) + ' 小时/日'],
    ['日薪（税前）', yuan(M.daily,2) + (A.spread ? '（含年终奖摊薄）' : '')],
    ['时薪（税前）', yuan(M.perHour,2)],
    ['每秒（税前）', '￥'+fmt(M.perSec,4)],
    ['本月应铸', yuan(ms.expected,0)],
    ['本月已铸', yuan(ms.minted,0)],
    ['本月到手（估）', row && row.active ? yuan(row.net,0) : '—'],
    ['年到手（估）', isM ? yuan(ty.year.net,0) + ' · 月均 ' + yuan(ty.year.avgNet,0) : '—']
  ];
  const g = $('#versoGrid');
  g.innerHTML = rows.map(r =>
    `<div class="vrow"><span class="vk">${r[0]}</span><span class="vv">${r[1]}</span></div>`).join('');
  // 与换算所（cup）保持同一套兜底：清单被删空时仍按 18 元一档算，
  // 措辞与体系无关（生活／悦己／装备／二次元／旅行 各套通用）
  const cupPrice = cfg.goals[0] && cfg.goals[0].amt > 0 ? cfg.goals[0].amt : 18;
  const cups = Math.floor(ms.minted / cupPrice);
  const cupName = cfg.goals[0] ? cfg.goals[0].name : '一杯奶茶';
  $('#versoFoot').innerHTML =
    `凭本券于本月内可兑换 <b class="num">${cups}</b> × ${cupName}。` +
    `　本券由 ${cfg.sig||'MINT MASTER'} 签发，仅在本机浏览器有效，不具备任何法定支付效力。`;
}

/* ============================================================
   5. 薪酬解剖
   ============================================================ */
function renderPayroll(){
  const now = new Date();
  const ty = PR.taxYear(cfg);
  const row = ty.rows[now.getMonth()];
  const ins = ty.ins;
  renderAnnual(ty);
  $('#wfMonth').textContent = (now.getMonth()+1) + ' 月 · 上海口径';

  const mx = Math.max(ty.gross, 1);
  const bar = (cls, v, from) =>
    `<i class="${cls}" style="left:${(from/mx*100)}%;width:${Math.max(0.6, v/mx*100)}%"></i>`;
  const tax = row && row.active ? row.tax : 0;
  const net = row && row.active ? row.net : ty.gross - ins.total;
  let acc = 0;
  const seg = [];
  seg.push(['税前月薪','gross', ty.gross, 0]);
  acc = ty.gross;
  [['养老 8%', ins.pension], ['医疗 2%', ins.medical], ['失业 0.5%', ins.unemployment],
   ['公积金 '+Math.round(ins.hfRate*100)+'%', ins.hf]].forEach(x => {
    acc -= x[1]; seg.push([x[0], 'cut', x[1], acc]);
  });
  acc -= tax; seg.push(['个税（累计预扣）','tax', tax, acc]);
  seg.push(['到手','net', net, 0]);

  $('#wf').innerHTML = seg.map((x, i) =>
    `<div class="wfr${(i===0||i===seg.length-1)?' tot':''}">
      <span class="wl">${x[0]}</span>
      <span class="wb">${bar(x[1], x[2], x[3])}</span>
      <span class="wv">${(x[1]==='cut'||x[1]==='tax'?'−':'')+yuan(x[2],2)}</span>
    </div>`).join('');

  $('#pSiBase').textContent = yuan0(ins.siBase);
  $('#pSiHint').textContent = '上下限 ' + yuan0(SI_SH.baseMin) + '–' + yuan0(SI_SH.baseMax) + ' · ' + SI_SH.year + (now.getFullYear()>2026?' · 当前沿用 2026 参数':'');
  $('#pHfBase').textContent = yuan0(ins.hfBase) + ' / ' + Math.round(ins.hfRate*100) + '%';
  $('#pHfHint').textContent = '上下限 ' + yuan0(SI_SH.hfBaseMin) + '–' + yuan0(SI_SH.hfBaseMax) + ' · 个人 5%~7%';

  /* 曲线 */
  drawTaxSvg(ty, now.getMonth()+1);

  const first = ty.rows.find(r=>r.active), last = ty.rows.filter(r=>r.active).pop();
  const bn = ty.bonus;
  $('#taxNote').textContent = first && last
    ? `同一份月薪，${first.m} 月扣 ${yuan(first.tax,0)}，${last.m} 月扣 ${yuan(last.tax,0)}；` +
      `12 个月 base 的个税 ${yuan(ty.sum.tax,0)}` +
      (bn.amount > 0 ? `，年终奖单独计税再扣 ${yuan(bn.tax,0)}，全年个税合计 ${yuan(ty.year.tax,0)}` : '') +
      `，年到手 ${yuan(ty.year.net,0)}，综合税负 ` +
      fmt(ty.year.gross>0 ? ty.year.tax/ty.year.gross*100 : 0, 2) + '%。累计预扣法让税率随累计应税额逐级跳档，同一份月薪的月度个税会逐月抬升。'
    : '—';

  /* 表 */
  const tb = $('#taxTable tbody');
  const bonusRow = bn.amount > 0
    ? `<tr><td><b>年终奖</b></td>
        <td class="n">${fmt(bn.amount,0)}</td>
        <td class="n" colspan="4" style="color:var(--ink-4)">不再计提</td>
        <td class="n" style="color:var(--ink-4)">单独计税</td>
        <td class="n">${Math.round(bn.apart.rate*100)}%</td>
        <td class="n">${fmt(bn.tax,2)}</td>
        <td class="n">${fmt(bn.net,2)}</td></tr>`
    : '';
  tb.innerHTML = ty.rows.map(r => {
    if (!r.active) return `<tr><td>${r.m} 月</td><td class="n" colspan="9" style="color:var(--ink-4)">未计薪</td></tr>`;
    return `<tr${r.m===now.getMonth()+1?' class="hi"':''}>
      <td>${r.m} 月</td>
      <td class="n">${fmt(r.gross,0)}</td>
      <td class="n">${fmt(r.ins.pension,0)}</td>
      <td class="n">${fmt(r.ins.medical,0)}</td>
      <td class="n">${fmt(r.ins.unemployment,0)}</td>
      <td class="n">${fmt(r.ins.hf,0)}</td>
      <td class="n">${fmt(r.cumTaxable,0)}</td>
      <td class="n">${Math.round(r.rate*100)}%</td>
      <td class="n">${fmt(r.tax,2)}</td>
      <td class="n">${fmt(r.net,2)}</td></tr>`;
  }).join('') + bonusRow + `<tr class="hi"><td><b>合计</b></td>
      <td class="n">${fmt(ty.year.gross,0)}</td>
      <td class="n" colspan="4">−${fmt(ty.year.ins,0)}</td>
      <td class="n">—</td><td class="n">—</td>
      <td class="n">${fmt(ty.year.tax,0)}</td>
      <td class="n">${fmt(ty.year.net,0)}</td></tr>`;
}

/* ---------- 年薪结构（年薪月数 / 年终奖 / 年到手） ---------- */
function renderAnnual(ty){
  const A = ty.annual, bn = ty.bonus, Y = ty.year;
  const card = $('#annuCard'); if (!card) return;
  if (cfg.mode !== 'month'){
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const mN = fmt(A.months, A.months%1 ? 1 : 0);
  $('#annuK').textContent = mN + ' 薪 · ' + (A.spread ? '已摊入日薪' : '不摊入日薪');

  /* 结构条：12 个月 base + 年终奖 */
  const pkg = Math.max(A.package, 1);
  const wBase = A.monthly*12 / pkg * 100;
  $('#anBar').innerHTML =
    `<i class="ab base" style="width:${wBase}%"><b>12 × base</b></i>` +
    (A.bonus > 0 ? `<i class="ab bonus" style="width:${100-wBase}%"><b>年终奖 ${fmt(A.bonusM,A.bonusM%1?1:0)} 月</b></i>` : '');

  $('#anBase').textContent   = yuan0(A.monthly*12);
  $('#anBaseSub').textContent = '月 base ' + yuan0(A.monthly) + ' × 12';
  $('#anBonus').textContent  = A.bonus > 0 ? yuan0(A.bonus) : '无';
  $('#anBonusSub').textContent = A.bonus > 0
    ? '＝ ' + yuan0(A.monthly) + ' × ' + fmt(A.bonusM, A.bonusM%1?1:0) + ' 月 × 系数 ' + fmt(A.bonusFactor,1)
    : '年薪月数填 12，无年终奖';
  $('#anPkg').textContent    = yuan0(A.package);
  $('#anPkgSub').textContent = '年化月均 ' + yuan0(A.package/12) + ' · 日薪 ' + yuan(M.daily,2);
  $('#anNet').textContent    = yuan0(Y.net);
  $('#anNetSub').textContent = '到手率 ' + fmt(Y.ratio*100,1) + '% · 月均 ' + yuan0(Y.avgNet);

  if (A.bonus > 0){
    $('#anApart').textContent = yuan0(bn.tax);
    $('#anApartSub').textContent = '奖金 ÷ 12 = ' + yuan0(bn.apart.per) + ' → 税率 ' +
      Math.round(bn.apart.rate*100) + '%，速算扣除 ' + yuan0(bn.apart.quick);
    $('#anMerged').textContent = yuan0(bn.merged);
    $('#anMergedSub').textContent = bn.better === 'apart'
      ? '比单独计税多缴 ' + yuan0(bn.gap)
      : '比单独计税少缴 ' + yuan0(bn.gap);
    const threshold = bn.apart.next == null ? '已在最高档' : (bn.apart.distance === 0
      ? '已到当前档上限；再增加 ￥0.01 进入下一档'
      : '距下一单独计税档还差 ' + yuan(bn.apart.distance,2));
    $('#anNote').textContent =
      '两种方案均已计算，预计全年到手采用税额较低的「' + (bn.better==='apart'?'单独计税':'并入综合所得') + '」。' +
      threshold + '。2026 上海社保、公积金参数；2027 年及以后若尚未更新，将沿用并弱提示。' +
      (bn.gap ? '两方案相差 ' + yuan0(bn.gap) + '。' : '两方案税额相同。');
  } else {
    $('#anApart').textContent = '—';
    $('#anApartSub').textContent = '无年终奖';
    $('#anMerged').textContent = '—';
    $('#anMergedSub').textContent = '无年终奖';
    $('#anNote').textContent = '当前按 12 薪计算，没有年终奖。若公司是 15 薪一类结构，去设置里改「年薪月数」。';
  }
}

function drawTaxSvg(ty, curM){
  const svg = $('#taxSvg');
  const W = Math.max(360, svg.clientWidth || svg.parentNode.clientWidth - 48), H = 200;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const L = 40, R = 48, T = 16, B = 26;   // R 要留够右轴（到手）标签的宽度，否则被 viewBox 裁掉
  const iw = W - L - R, ih = H - T - B;
  const act = ty.rows.filter(r => r.active);
  const maxV = Math.max.apply(null, act.map(r => Math.max(r.tax, 0)).concat([1]));
  // 个税与到手量级差一个数量级，只能双轴。双轴必须把两条轴的刻度都标出来，
  // 否则读者会拿两条线的相对高低直接比较，那是定量语义误导。
  // 注意：求最小值时不能带 concat([1]) 那种哨兵值，否则右轴下限会被拉成负数
  const netVals = act.length ? act.map(r => r.net) : [1];
  const maxN = Math.max.apply(null, netVals);
  const minN = Math.min.apply(null, netVals);
  const loN  = minN >= maxN ? maxN * 0.98 : minN - (maxN - minN) * 0.35;
  const x = m => L + (iw * (m - 1) / 11);
  const yT = v => T + ih - (v / maxV) * ih * 0.92;
  const yN = v => T + ih - ((v - loN) / Math.max(1, maxN - loN)) * ih * 0.92;

  let s = '';
  for (let i=0;i<=4;i++){
    const yy = T + ih*i/4;
    s += `<line class="gd" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/>`;
  }
  s += `<line class="ax" x1="${L}" y1="${T+ih}" x2="${W-R}" y2="${T+ih}"/>`;
  s += `<text x="${L-6}" y="${T+5}" text-anchor="end">${fmt(maxV,0)}</text>`;
  s += `<text x="${L-6}" y="${T+ih+4}" text-anchor="end">0</text>`;
  // 右轴：到手。轴不从 0 起，所以上下限都写清楚
  s += `<text class="ax2" x="${W-R+4}" y="${T+5}" text-anchor="start">${fmt(maxN,0)}</text>`;
  s += `<text class="ax2" x="${W-R+4}" y="${T+ih+4}" text-anchor="start">${fmt(loN,0)}</text>`;

  if (act.length){
    const pT = act.map(r => `${x(r.m)},${yT(r.tax)}`).join(' ');
    const pN = act.map(r => `${x(r.m)},${yN(r.net)}`).join(' ');
    s += `<polygon class="ar" points="${x(act[0].m)},${T+ih} ${pT} ${x(act[act.length-1].m)},${T+ih}"/>`;
    s += `<polyline class="ln2" points="${pN}"/>`;
    s += `<polyline class="ln" points="${pT}"/>`;
    act.forEach(r => {
      s += `<circle class="dot${r.m===curM?' now':''}" cx="${x(r.m)}" cy="${yT(r.tax)}" r="${r.m===curM?3.6:2.4}"/>`;
    });
    const c = act.find(r=>r.m===curM);
    if (c) s += `<text class="vv" x="${x(c.m)}" y="${yT(c.tax)-9}" text-anchor="middle">${fmt(c.tax,0)}</text>`;
  }
  for (let m=1;m<=12;m++){
    s += `<text x="${x(m)}" y="${H-8}" text-anchor="middle">${m}</text>`;
  }
  svg.innerHTML = s;
}

/* ============================================================
   6. 日历
   ============================================================ */
let calY, calM, selKey = null;
function renderCalendar(){
  const now = new Date();
  if (calY == null){ calY = now.getFullYear(); calM = now.getMonth(); }
  const first = new Date(calY, calM, 1);
  const days  = new Date(calY, calM+1, 0).getDate();
  const lead  = (first.getDay() + 6) % 7;   // 周一起

  $('#calTitle').textContent = calY + ' 年 ' + (calM+1) + ' 月';
  const ms = PR.monthStats(now, cfg, ovr, M, calY, calM);
  $('#calSub').textContent = '计薪 ' + ms.workDays + ' 天 · 应铸 ' + yuan0(ms.expected);

  const dowNames = ['一','二','三','四','五','六','日'];
  let h = dowNames.map((d,i)=>`<div class="dow${i>=5?' wk':''}">${d}</div>`).join('');
  for (let i=0;i<lead;i++) h += '<div class="cd pad"></div>';

  const todayKey = PR.dkey(now);
  for (let d=1;d<=days;d++){
    const dt = new Date(calY, calM, d);
    const p  = PR.dayPlan(dt, cfg, ovr);
    const amt = PR.dayAmount(p, M);
    const k  = p.key;
    const cls = ['cd', 't-'+p.type];
    if (p.isMakeup) cls.push('mkup');
    if (k === todayKey) cls.push('today');
    if (dt > now) cls.push('fut');
    if (k === selKey) cls.push('sel');
    const mk = p.isMakeup ? '<span class="mk">班</span>'
            : (p.type==='ot' ? '<span class="mk" style="color:var(--gold);border:1px solid var(--gold-dim)">OT</span>' : '');
    const mo = moodOf(k);
    const stamp = mo
      ? `<span class="stmp${mo.d?' d-'+mo.d:''}">${mo.d?MOOD_D[mo.d].em:''}${mo.w?MOOD_W[mo.w].em:''}</span>`
      : '';
    h += `<button class="${cls.join(' ')}" data-k="${k}" type="button">
            ${mk}
            <span class="dn">${d}</span>
            ${p.holiday ? `<span class="hn">${p.holiday}</span>` : ''}
            <span class="amt">${amt>0 ? yuan0(amt) : '—'}</span>
            ${p.otHours ? `<span class="otq">+${p.otHours}h</span>` : ''}
            ${stamp}
          </button>`;
  }
  const cal = $('#cal');
  cal.innerHTML = h;
  cal.onclick = e => {
    const b = e.target.closest('.cd'); if (!b || b.classList.contains('pad')) return;
    selKey = b.dataset.k; renderCalendar(); renderSheet();
  };

  /* 未发布年度提示 */
  const warn = $('#calWarn');
  if (!arrangementKnown(calY)){
    warn.innerHTML = `<li>${calY} 年放假安排国务院办公厅尚未发布，本月仅按每周计薪日渲染，不推测调休。</li>`;
  } else { warn.innerHTML = ''; }

  /* 本月心情戳统计 */
  const mo = moodStats(calY, calM);
  const el = $('#calMood');
  if (el){
    el.innerHTML = mo.n
      ? `本月已盖 <b>${mo.n}</b> 天：` +
        [ mo.g?`${MOOD_D.g.em} 开心 ${mo.g}`:'', mo.s?`${MOOD_D.s.em} 一般 ${mo.s}`:'', mo.b?`${MOOD_D.b.em} 不开心 ${mo.b}`:'',
          mo.e?`${MOOD_W.e.em} 不难赚 ${mo.e}`:'', mo.h?`${MOOD_W.h.em} 难赚 ${mo.h}`:'' ].filter(Boolean).join(' · ') +
        '　<i>完整记录存在本机 localStorage，Cookie 仅作兼容</i>'
      : '点某一天补录最近 31 天的心情与赚钱感受；完整记录只存在本机 localStorage。';
  }

  if (!selKey || selKey.slice(0,7) !== calY+'-'+PR.pad(calM+1)){
    selKey = (calY===now.getFullYear() && calM===now.getMonth()) ? todayKey : calY+'-'+PR.pad(calM+1)+'-01';
  }
  renderSheet();
}

function renderSheet(){
  const now = new Date();
  const p = PR.dayPlan(selKey, cfg, ovr);
  const amt = PR.dayAmount(p, M);
  const o = ovr[selKey] || {};
  const d = new Date(selKey + 'T00:00:00');
  const TYPE = { work:'计薪工作日', rest:'周末', off:'放假（调休凑假）', legal:'法定节假日', leave:'请假 · 不计薪', ot:'加班计薪' };
  const rows = [
    ['日期类型', TYPE[p.type] + (p.isMakeup ? '（调休上班）' : '')],
    ['节假日', p.holiday || '—'],
    ['加班倍率', p.type==='ot' ? '×'+fmt(p.mult,1) : (p.type==='work' ? '延时 ×1.5' : '×'+fmt(p.mult,1)+'（若加班）')],
    ['应铸金额', amt>0 ? yuan(amt,2) : '￥0.00'],
    ['其中延时加班', p.otHours ? yuan(M.perHour*OT.weekday*p.otHours,2)+`（${p.otHours}h）` : '—']
  ];
  const acts = [];
  if (p.base === 'work'){
    acts.push(o.st==='off'
      ? `<button class="btn sm" data-a="clear">取消请假</button>`
      : `<button class="btn sm" data-a="off">标记请假</button>`);
  } else {
    acts.push(o.st==='ot'
      ? `<button class="btn sm" data-a="clear">取消加班</button>`
      : `<button class="btn sm" data-a="ot">标记整日加班 ×${fmt(p.mult,1)}</button>`);
  }
  if (o.st) acts.push(`<button class="btn sm" data-a="clear">清除标记</button>`);

  /* 心情戳：两组互斥选项，再点一次取消 */
  const mv = moodOf(selKey) || {};
  const chip = (grp, key, def) =>
    `<button class="mchip${mv[grp]===key?' on':''} ${grp}-${key}" data-m="${grp}:${key}" type="button">
       <em>${def.em}</em><span>${def.t}</span></button>`;
  const moodBox =
    `<div class="mbox">
      <div class="mline"><span class="ml">今天心情</span>
        <div class="mchips">${['g','s','b'].map(k=>chip('d',k,MOOD_D[k])).join('')}</div></div>
      <div class="mline"><span class="ml">这钱好赚吗</span>
        <div class="mchips">${['e','h'].map(k=>chip('w',k,MOOD_W[k])).join('')}</div></div>
      <div class="mfoot">
        <span>${mv.d||mv.w ? '已盖戳，存在本机 ' + (moodCookieOK ? 'Cookie' : '存储') + '，刷新不丢' : '点一下盖戳，再点一下取消'}</span>
        ${mv.d||mv.w ? '<button class="btn sm" data-m="clear" type="button">撕掉戳</button>' : ''}
      </div>
    </div>`;

  $('#sheet').innerHTML =
    `<div class="sh"><b>${(d.getMonth()+1)}月${d.getDate()}日</b>
      <span>${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]} · ${selKey}</span></div>` +
    rows.map(r=>`<div class="srow"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('') +
    (p.base==='work' && p.type==='work'
      ? `<div class="ot-in"><span>工作日延时加班</span>
          <input type="number" id="otH" min="0" max="8" step="0.5" value="${p.otHours||0}">
          <span>小时 · ×1.5</span></div>` : '') +
    `<div class="sact">${acts.join('')}</div>` +
    moodBox;

  $('#sheet').onclick = e => {
    /* 心情戳 */
    const mb = e.target.closest('[data-m]');
    if (mb){
      if (!recordableDate(selKey)){ toast('只能记录今天及过去 31 天'); return; }
      const v = mb.dataset.m;
      if (v === 'clear'){ delete mood[selKey]; }
      else {
        const parts = v.split(':'), grp = parts[0], key = parts[1];
        const cur = Object.assign({}, mood[selKey] || {});
        if (cur[grp] === key) delete cur[grp]; else cur[grp] = key;
        if (!cur.d && !cur.w) delete mood[selKey]; else mood[selKey] = cur;
      }
      const ok = saveMood();
      renderCalendar(); renderSheet(); renderYear();
      toast(v === 'clear' ? '已撕掉戳'
        : (ok ? '已盖戳 · 存进本机 Cookie' : '已盖戳 · 本机存储（当前环境 Cookie 不可写）'));
      return;
    }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'clear') delete ovr[selKey];
    else ovr[selKey] = Object.assign({}, ovr[selKey], { st:a });
    persist(); renderCalendar(); renderHeat(); tick();
    toast(a==='clear' ? '已清除标记' : (a==='off' ? '已标记请假' : '已标记加班'));
  };
  const oh = $('#otH');
  if (oh) oh.onchange = () => {
    const v = Math.max(0, Math.min(8, Number(oh.value)||0));
    if (v === 0){ if (ovr[selKey]) { delete ovr[selKey].ot; if (!ovr[selKey].st) delete ovr[selKey]; } }
    else ovr[selKey] = Object.assign({}, ovr[selKey], { ot:v });
    persist(); renderCalendar(); renderHeat(); tick();
  };
}

/* ---------- 年度铸造节奏（逐月柱状 + 心情底条） ----------
   旧版是 12×31 的日粒度热力图：颜色只区分「计薪/加班/节假日」，
   同一年里几百个格子几乎同色，横纵都在数格子，看不出信息。
   现在按月聚合：柱高＝该月应铸金额，填充＝已铸进度，柱下细条＝当月心情戳分布。 */
function renderYear(){
  const now = new Date();
  const Y = calY == null ? now.getFullYear() : calY;
  const known = arrangementKnown(Y);
  $('#heatYear').textContent = Y + ' 年 · 逐月应铸' + (known ? '' : ' · 放假安排未发布');

  const ms = [];
  let total = 0, work = 0, legal = 0, otD = 0;
  for (let m=0;m<12;m++){
    const st = PR.monthStats(now, cfg, ovr, M, Y, m);
    const mo = moodStats(Y, m);
    ms.push({ m, st, mo });
    total += st.expected; work += st.workDays; legal += st.legalDays; otD += st.otDays;
  }
  const mx = Math.max.apply(null, ms.map(x => x.st.expected).concat([1]));
  const curM = (Y === now.getFullYear()) ? now.getMonth() : -1;

  $('#yearBars').innerHTML = ms.map(x => {
    const h = Math.max(3, x.st.expected / mx * 100);
    const prog = x.st.expected > 0 ? Math.min(100, x.st.minted / x.st.expected * 100) : 0;
    const state = (Y < now.getFullYear() || (Y === now.getFullYear() && x.m < now.getMonth())) ? 'past'
                : (x.m === curM ? 'cur' : 'future');
    const mo = x.mo;
    const moBar = mo.n > 0
      ? `<span class="ymo" title="心情：开心 ${mo.g} · 一般 ${mo.s} · 不开心 ${mo.b}">
           ${mo.g?`<i class="g" style="flex:${mo.g}"></i>`:''}
           ${mo.s?`<i class="s" style="flex:${mo.s}"></i>`:''}
           ${mo.b?`<i class="b" style="flex:${mo.b}"></i>`:''}
         </span>`
      : '<span class="ymo none"></span>';
    return `<div class="yb ${state}${x.m===curM?' on':''}" data-m="${x.m}"
              title="${Y}-${PR.pad(x.m+1)} · 应铸 ${yuan0(x.st.expected)} · 计薪 ${x.st.workDays} 天${x.st.otDays?' · 加班 '+x.st.otDays+' 天':''}${mo.n?' · 心情戳 '+mo.n+' 天':''}">
        <span class="ytrack">
          <span class="ycol" style="height:${h}%">
            <i class="yfill" style="height:${state==='past'?100:(state==='cur'?prog:0)}%"></i>
            <span class="yv">${x.st.expected>0 ? fmt(x.st.expected/10000,1)+'万' : '—'}</span>
          </span>
        </span>
        ${moBar}
        <span class="ym">${x.m+1}</span>
        <span class="yd">${x.st.workDays}天</span>
      </div>`;
  }).join('');

  $('#yearBars').onclick = e => {
    const b = e.target.closest('.yb'); if (!b) return;
    calM = Number(b.dataset.m); calY = Y;
    renderCalendar(); renderSheet(); renderYear();
    const c = document.getElementById('cal');
    if (c) c.scrollIntoView({ behavior:'smooth', block:'center' });
  };

  const yMood = moodStats(Y, null);
  const ty = PR.taxYear(cfg);
  $('#yTotal').textContent = yuan0(total);
  /* 这里是「按当年真实计薪日聚合」的结果，和「月薪 × 年薪月数」不一定相等：
     后者按每月 21.75 天的法定月平均折算，前者数的是当年实际计薪日。差额如实写出来。 */
  $('#ySub').textContent = cfg.mode === 'month'
    ? '年总包口径 ' + yuan0(ty.annual.package) + ' · 差额来自实际计薪日与月均 ' + fmt(cfg.workDays,2) + ' 天的口径差'
    : '年化月均 ' + yuan0(total/12);
  $('#yWork').textContent  = work + ' 天' + (otD ? ' + 加班 ' + otD + ' 天' : '');
  $('#yLegal').textContent = legal + ' 天';
  $('#yMood').textContent  = yMood.n + ' 天';
  $('#yMoodSub').textContent = yMood.n
    ? '开心 ' + yMood.g + ' · 一般 ' + yMood.s + ' · 不开心 ' + yMood.b + ' · 难赚 ' + yMood.h
    : '点日历格子打标';
}
/* 旧名保留，日历与设置里多处调用 */
function renderHeat(){ renderYear(); }

/* ============================================================
   7. 换算所
   ============================================================ */
function renderExchange(shownToday, dayFull, ratio){
  const ty = PR.taxYear(cfg);
  const gross = ty.gross;
  const netM  = ty.rows.find(r=>r.active) ? ty.rows[new Date().getMonth()] : null;

  /* 会议 */
  const n = Math.max(1, Number($('#mtN').value)||1);
  const mm = Math.max(1, Number($('#mtM').value)||1);
  const mode = $('#mtMode').value;
  $('#mtCustomWrap').hidden = mode !== 'custom';
  const ph = mode === 'custom' ? Math.max(0, Number($('#mtH').value)||0) : M.perHour;
  const cost = ph * (mm/60) * n;
  $('#mtOut').textContent = yuan(cost, 2);
  $('#mtHint').textContent = `${n} 人 × ${mm} 分钟 × ${yuan(ph,2)}/时`;
  $('#mtBar').style.width = Math.min(100, cost/Math.max(M.daily,1)*100) + '%';
  const cup = cfg.goals[0] && cfg.goals[0].amt>0 ? cfg.goals[0].amt : 18;
  $('#mtCmp').textContent = `= ${fmt(cost/Math.max(M.daily,1),2)} 个你的工作日 · ${Math.floor(cost/cup)} × ${(cfg.goals[0]||{name:'一杯奶茶'}).name}`;

  /* 摸鱼 */
  const im = Math.max(0, Number($('#idM').value)||0);
  const iff = Math.max(0, Number($('#idF').value)||0);
  const eff = Math.max(0, im - iff);
  const idv = M.perHour * (eff/60) * ratio;
  $('#idOut').textContent = yuan(idv, 2);
  $('#idHint').textContent = `${im} 分钟摸鱼 − ${iff} 分钟生理必需 = ${eff} 分钟折现`;
  $('#idPct').textContent  = pct(eff / M.paid * 100);
  $('#idYear').textContent = yuan(idv * (Number(cfg.workDays)||21.75) * 12, 0);

  /* 奶茶本位 */
  const bp = Math.max(1, Number($('#btP').value)||1);
  const baseSel = $('#btBase').value;
  const baseV = baseSel==='today' ? shownToday
             : baseSel==='day'    ? dayFull * ratio
             : baseSel==='month'  ? gross
             : (netM && netM.active ? netM.net : gross);
  $('#btOut').textContent = fmt(baseV/bp, 1) + ' 杯';
  const BLB = { today:'今日已铸', day:'一天日薪', month:'一个月税前', net:'一个月到手' };
  $('#btHint').textContent = `${BLB[baseSel]} ${yuan(baseV,2)} ÷ ${yuan(bp,0)}/杯`;

  const UNITS = [
    ['🧋','奶茶', bp],
    ['🚇','地铁单程', 4],
    ['🍱','一份外卖', 32],
    ['🎬','电影票', 60],
    ['🚕','打车 10 公里', 38],
    ['💪','健身月卡', 300],
    ['🏠','上海一平米（外环外均价约）', 42000]
  ];
  const uh = UNITS.map(u => {
    const v = baseV / u[2];
    const disp = v >= 100 ? fmt(v,0) : (v >= 1 ? fmt(v,1) : fmt(v,3));
    return `<div class="unit"><div class="ue">${u[0]}</div><div class="un">${u[1]}</div><div class="uv">${disp}</div></div>`;
  }).join('');
  const uEl = $('#units');
  if (uEl._sig !== uh){ uEl._sig = uh; uEl.innerHTML = uh; }
}

/* ============================================================
   8. 勋章厅
   ============================================================ */
const MEDALS = [
  { id:'first', n:'开炉', d:'今日已铸 > 0', t:c=>c.shown>0 },
  { id:'full',  n:'满班', d:'走完当日全部计薪分钟', t:c=>c.prog>=0.999 },
  { id:'night', n:'夜铸', d:'21:00 之后仍在铸造', t:c=>c.now.getHours()>=21 && c.S.s==='work' },
  { id:'half',  n:'月半', d:'本月已铸达应铸 50%', t:c=>c.ms.expected>0 && c.ms.minted/c.ms.expected>=0.5 },
  { id:'moon',  n:'满月', d:'本月应铸全部铸完', t:c=>c.ms.expected>0 && c.ms.minted>=c.ms.expected-0.01 },
  { id:'bar1',  n:'金条入库', d:'金库中出现第 1 根金条', t:c=>c.bars>=1 }
];
function medalIcon(on, seedK){
  const seed = seedK % 5 + 6;
  const paths = EN.rosette(22, 22, { R1:11, R2r:4.6, k:seed, layers:5 }).map(d=>`<path d="${d}"/>`).join('');
  return `<svg class="mdi" viewBox="0 0 44 44" aria-hidden="true">
    <g fill="none" stroke="${on?'var(--gold)':'var(--ink-4)'}" stroke-width=".55" opacity="${on?.95:.55}">${paths}</g>
    <circle cx="22" cy="22" r="6.6" fill="none" stroke="${on?'var(--gold)':'var(--ink-4)'}" stroke-width=".8" opacity=".7"/>
    ${on?'<circle cx="22" cy="22" r="3" fill="var(--gold)" opacity=".85"/>':''}
  </svg>`;
}
function renderMedals(ctx){
  const on = MEDALS.map(m => { try{ return !!m.t(ctx); }catch(e){ return false; } });
  const sig = on.join('');
  const host = $('#medalWall');
  if (host._sig === sig) return;
  host._sig = sig;
  host.innerHTML = MEDALS.map((m,i) =>
    `<div class="md ${on[i]?'on':'locked'}">
      ${on[i]?'<span class="got">已得</span>':''}
      ${medalIcon(on[i], i)}
      <b>${m.n}</b><span>${m.d}</span>
    </div>`).join('');
}

/* ============================================================
   9. 战报卡
   ============================================================ */
/* 战报日：'today' | 'prev'。凌晨或当天还没铸满时，默认出前一天的完整战报。 */
let cardSel = null;
let cardAuto = true;

function todayDone(now){
  const S = PR.todayState(now, cfg, ovr, M);
  const full = PR.dayAmount(S.plan, M);
  if (full <= 0) return false;
  const pm = (S.s==='work'||S.s==='lunch'||S.s==='off') ? PR.paidElapsed(S.rel, M) : 0;
  return pm >= M.paid - 0.001;
}
function cardDefaultDay(now){
  now = now || new Date();
  if (todayDone(now)) return 'today';
  /* 今天还没铸满（含凌晨、尚未开炉）→ 只要前一天真有铸造量就出前一天 */
  const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
  return PR.dayAmount(PR.dayPlan(prev, cfg, ovr), M) > 0 ? 'prev' : 'today';
}

function cardStats(sel){
  const now = new Date();
  const isToday = sel === 'today';
  const day = isToday ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
  const ref = isToday ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  const plan = isToday ? PR.todayState(now, cfg, ovr, M).plan : PR.dayPlan(day, cfg, ovr);
  const full = PR.dayAmount(plan, M);
  let paidMin = 0, state = '';
  if (isToday){
    const S = PR.todayState(now, cfg, ovr, M);
    paidMin = (S.s==='work'||S.s==='lunch'||S.s==='off') ? PR.paidElapsed(S.rel, M) : 0;
    state = STATE_TXT[S.s] || '—';
  } else {
    paidMin = full > 0 ? M.paid : 0;
    state = full > 0 ? '当日已封炉'
          : plan.isLegal ? STATE_TXT.legal
          : plan.type === 'leave' ? STATE_TXT.leave
          : plan.holiday ? STATE_TXT.holiday
          : STATE_TXT.rest;
  }
  const ratio = netRatio(now);
  return { now, day, ref, plan, full, paidMin, state, isToday, ratio,
           earned: full * (paidMin / M.paid) * ratio,
           ms: PR.monthStats(ref, cfg, ovr, M) };
}
function cardDayLabel(sel){
  const c = cardStats(sel);
  const d = c.day;
  return (d.getMonth()+1) + '/' + d.getDate() + ' 周'
    + ['日','一','二','三','四','五','六'][d.getDay()];
}
function renderCardDay(){
  const seg = $('#segCardDay'); if (!seg) return;
  if (!cardSel) cardSel = cardDefaultDay();
  $$('#segCardDay button').forEach(b => b.classList.toggle('on', b.dataset.v === cardSel));
  const auto = cardDefaultDay();
  const c = cardStats(cardSel);
  $('#cardDayHint').textContent =
    cardDayLabel(cardSel) + ' · ' + c.state
    + (cardSel === auto ? '（默认）' : '')
    + (auto === 'prev' && cardSel === 'today' ? ' · 今天还没铸满，通常出前一天更完整' : '');
}

function drawCard(){
  const cv = $('#cardCv'), g = cv.getContext('2d');
  const W = 1080, H = 1350;
  cv.width = W; cv.height = H;
  const night = document.documentElement.getAttribute('data-theme') === 'night';
  const PAPER = night ? '#0E1116' : '#F1EADB';
  const INK   = night ? '#E9E3D3' : '#16233A';
  const GOLD  = night ? '#D6B267' : '#A87C2A';
  const SUB   = night ? '#87826F' : '#727E92';
  const priv  = document.documentElement.classList.contains('privacy');

  g.fillStyle = PAPER; g.fillRect(0,0,W,H);
  // 网底
  g.strokeStyle = night ? 'rgba(214,178,103,.09)' : 'rgba(22,35,58,.06)';
  g.lineWidth = 1;
  for (let i=-H;i<W+H;i+=14){
    g.beginPath(); g.moveTo(i,0); g.lineTo(i+H,H); g.stroke();
    g.beginPath(); g.moveTo(i,H); g.lineTo(i+H,0); g.stroke();
  }
  // 双框
  g.strokeStyle = GOLD; g.lineWidth = 3; g.strokeRect(46,46,W-92,H-92);
  g.lineWidth = 1; g.strokeRect(60,60,W-120,H-120);

  // 车花
  g.save(); g.translate(W/2, 470); g.strokeStyle = GOLD; g.globalAlpha = .22; g.lineWidth = 1;
  for (let L=0;L<9;L++){
    g.beginPath();
    for (let i=0;i<=720;i++){
      const t = i/720*Math.PI*2, ph = L*0.7;
      const x = (200-L*2)*Math.cos(t) + 78*Math.cos(11*t+ph);
      const y = (200-L*2)*Math.sin(t) + 78*Math.sin(11*t+ph);
      i ? g.lineTo(x,y) : g.moveTo(x,y);
    }
    g.closePath(); g.stroke();
  }
  g.restore();

  if (!cardSel) cardSel = cardDefaultDay();
  const C = cardStats(cardSel);
  const now = C.now, ratio = C.ratio;
  const day = C.day, ref = C.ref;
  const dayFull = C.full, paidMin = C.paidMin, earned = C.earned, ms = C.ms;
  const stamp = C.isToday
    ? PR.pad(now.getHours()) + ':' + PR.pad(now.getMinutes())
    : PR.hhmm(M.s + M.span);

  const cx = W/2;
  g.textAlign = 'center';
  g.fillStyle = INK; g.font = '900 46px "Noto Serif SC", serif';
  g.fillText('薪水铸币厂', cx, 168);
  g.fillStyle = SUB; g.font = '400 20px "EB Garamond", serif';
  g.fillText('S A L A R Y   M I N T   A T E L I E R', cx, 202);
  g.strokeStyle = GOLD; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx-120, 226); g.lineTo(cx+120, 226); g.stroke();

  g.fillStyle = SUB; g.font = '500 22px "Noto Sans SC", sans-serif';
  g.fillText((C.isToday ? '今日已铸' : '当日已铸') + (cfg.netMode ? '（到手口径）' : '（税前口径）'), cx, 330);

  g.fillStyle = INK; g.font = '700 128px "Archivo", Arial, sans-serif';
  g.fillText(priv ? '￥ ****' : '￥' + fmt(earned, 2), cx, 452);

  g.fillStyle = GOLD; g.font = '500 24px "JetBrains Mono", monospace';
  g.fillText(C.state + ' · 进度 ' + pct(paidMin/M.paid*100), cx, 500);

  // 三格
  const cells = [
    ['时薪', priv ? '￥****' : yuan(M.perHour*ratio,0)],
    [C.isToday ? '今日应铸' : '当日应铸', priv ? '￥****' : yuan(dayFull*ratio,0)],
    ['本月已铸', priv ? '￥****' : yuan(ms.minted*ratio,0)]
  ];
  cells.forEach((c,i) => {
    const x = 108 + i*(W-216)/3 + (W-216)/6;
    g.strokeStyle = night ? 'rgba(214,178,103,.22)' : 'rgba(22,35,58,.16)';
    g.lineWidth = 1;
    g.strokeRect(108 + i*(W-216)/3, 760, (W-216)/3, 130);
    g.fillStyle = SUB; g.font = '400 19px "Noto Sans SC", sans-serif';
    g.fillText(c[0], x, 800);
    g.fillStyle = INK; g.font = '500 36px "JetBrains Mono", monospace';
    g.fillText(c[1], x, 852);
  });

  // 班次
  g.fillStyle = SUB; g.font = '400 21px "Noto Sans SC", sans-serif';
  g.fillText(PR.hhmm(M.s)+' – '+PR.hhmm(M.s+M.span)+' · 午休 '+M.lunch+' 分钟不计薪 · 计薪 '+fmt(M.paid/60,1)+' 小时',
             cx, 950);
  const p = C.plan;
  g.fillText(p.holiday ? p.holiday + (p.isMakeup?'（调休上班）':(p.isLegal?'（法定节假日）':'（放假）')) : '常规计薪日', cx, 986);

  // 进度条
  const bx = 140, bw = W-280, by = 1040;
  g.fillStyle = night ? 'rgba(255,255,255,.07)' : 'rgba(22,35,58,.08)';
  g.fillRect(bx, by, bw, 14);
  g.fillStyle = GOLD;
  g.fillRect(bx, by, bw * Math.min(1, paidMin/M.paid), 14);

  // 冠字号 & 日期
  g.fillStyle = night ? '#E0705F' : '#96261D';
  g.font = '500 26px "JetBrains Mono", monospace';
  g.fillText(serial(ref), cx, 1136);
  g.fillStyle = SUB; g.font = '400 20px "JetBrains Mono", monospace';
  g.fillText(day.getFullYear()+'.'+PR.pad(day.getMonth()+1)+'.'+PR.pad(day.getDate())+' '+stamp, cx, 1174);

  g.fillStyle = INK; g.font = 'italic 500 30px "EB Garamond", serif';
  g.fillText(cfg.sig || 'MINT MASTER', cx, 1240);
  g.strokeStyle = night ? 'rgba(214,178,103,.4)' : 'rgba(22,35,58,.3)';
  g.beginPath(); g.moveTo(cx-90, 1252); g.lineTo(cx+90, 1252); g.stroke();
  g.fillStyle = SUB; g.font = '400 16px "EB Garamond", serif';
  g.fillText('值班铸币师 · MINT MASTER', cx, 1278);
  return cv;
}

/* ============================================================
   Edition IV · 初始化 / 结算 / 月度简报
   ============================================================ */
function recordableDate(key){
  const now = new Date(), d = new Date(key + 'T00:00:00');
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const age = Math.floor((today-d)/86400000);
  return isFinite(d.getTime()) && age >= 0 && age <= 31;
}
let settleDraft = null;
function renderSettle(key){
  const now = new Date(), d = new Date(key+'T00:00:00');
  const p = PR.dayPlan(d,cfg,ovr), annualCfg = Object.assign({},cfg,{viewMode:'annualized'});
  const actualCfg = Object.assign({},cfg,{viewMode:'actual'});
  const ma = PR.shift(annualCfg), mx = PR.shift(actualCfg);
  const worked = p.type==='work'||p.type==='ot';
  const annualV = worked ? PR.dayAmount(p,ma) : 0, actualV = worked ? PR.dayAmount(p,mx) : 0;
  const overtime = p.type==='work' ? ma.perHour*OT.weekday*p.otHours : (p.type==='ot' ? actualV : 0);
  settleDraft = Object.assign({d:null,w:null,reasons:[]}, mood[key]||{});
  $('#settleDate').value = key;
  $('#settleValues').innerHTML = [
    ['计薪时长',worked?fmt(ma.paid/60,1)+' 小时':'0 小时'],
    ['年化价值 · 税前',yuan(annualV,2)],['实际发薪 · 税前',yuan(actualV,2)],
    ['加班收入 · 税前',yuan(overtime,2)]
  ].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  const chip=(grp,k,x)=>`<button class="mchip ${grp}-${k}${settleDraft[grp]===k?' on':''}" data-s="${grp}:${k}"><em>${x.em}</em><span>${x.t}</span></button>`;
  $('#settleMood').innerHTML=['g','s','b'].map(k=>chip('d',k,MOOD_D[k])).join('');
  $('#settleWorth').innerHTML=['e','h'].map(k=>chip('w',k,MOOD_W[k])).join('');
  $('#settleReasons').innerHTML=MOOD_REASONS.map(r=>`<button class="${(settleDraft.reasons||[]).includes(r)?'on':''}" data-r="${r}">${r}</button>`).join('');
  const valid=recordableDate(key);
  $('#btnSettleSave').disabled=!valid;
  $('#settleHint').textContent=valid ? (p.type==='leave'?'请假日不会主动提醒，但你仍可手动记录。':'最多选择 2 个原因标签。') : '只能记录今天及过去 31 天，未来日期不可记录。';
}
function openSettle(key){
  key=key||PR.dkey(new Date()); $('#settleModal').classList.add('on'); renderSettle(key);
}
function reportStats(){
  const now=new Date(), rec=recordsForMonth(now.getFullYear(),now.getMonth()), st=moodStats(now.getFullYear(),now.getMonth());
  const ms=PR.monthStats(now,cfg,ovr,M), ty=PR.taxYear(cfg), row=ty.rows[now.getMonth()];
  const tags={}; rec.forEach(r=>(r.reasons||[]).forEach(x=>tags[x]=(tags[x]||0)+1));
  let streak=0,best=0,last=null; rec.forEach(r=>{const t=new Date(r.key+'T00:00:00').getTime();streak=last!==null&&t-last===86400000?streak+1:1;best=Math.max(best,streak);last=t;});
  const rate=ms.doneDays?Math.min(100,rec.length/ms.doneDays*100):0;
  const top=Object.keys(tags).sort((a,b)=>tags[b]-tags[a]);
  let insight='数据不足：至少记录 5 天后生成规则洞察。';
  if(rec.length>=5){
    if(st.h>st.e) insight='在已记录的 '+rec.length+' 天里，「这钱难赚」更多；高频原因是 '+(top.slice(0,2).join('、')||'尚未选择标签')+'。';
    else if(st.g>st.b) insight='在已记录的 '+rec.length+' 天里，积极心情更多；高频原因是 '+(top.slice(0,2).join('、')||'尚未选择标签')+'。';
    else insight='已记录 '+rec.length+' 天，心情分布较均衡；高频原因是 '+(top.slice(0,2).join('、')||'尚未选择标签')+'。';
  }
  return {now,rec,st,ms,row,tags,top,best,rate,insight};
}
function renderReport(){
  const r=reportStats(), net=r.row&&r.row.active?r.row.net:0;
  $('#reportBody').innerHTML=`<div class="report-grid"><div><span>本月预计税前</span><b class="blur">${yuan0(r.ms.expected)}</b></div><div><span>本月预计到手</span><b class="blur">${yuan0(net)}</b></div><div><span>记录率</span><b>${fmt(r.rate,0)}%</b></div><div><span>最长连续记录</span><b>${r.best} 天</b></div><div><span>心情</span><b>🙂 ${r.st.g} · 😐 ${r.st.s} · 😖 ${r.st.b}</b></div><div><span>赚钱感受</span><b>不难赚 ${r.st.e} · 难赚 ${r.st.h}</b></div></div><p class="dhint">原因标签：${r.top.length?r.top.map(x=>x+' '+r.tags[x]).join(' · '):'尚无记录'}</p><div class="report-insight">${r.insight}</div>`;
}
let reportMode='private';
function drawReportCard(){
  const cv=$('#reportCanvas'),g=cv.getContext('2d'),r=reportStats(),W=1080,H=1350;
  cv.width=W;cv.height=H;g.fillStyle='#F1EADB';g.fillRect(0,0,W,H);g.strokeStyle='#A87C2A';g.lineWidth=3;g.strokeRect(48,48,W-96,H-96);g.lineWidth=1;g.strokeRect(64,64,W-128,H-128);
  g.textAlign='center';g.fillStyle='#16233A';g.font='900 48px serif';g.fillText('本月简报',W/2,170);g.fillStyle='#727E92';g.font='24px sans-serif';g.fillText(r.now.getFullYear()+' 年 '+(r.now.getMonth()+1)+' 月 · 薪水铸币厂',W/2,215);
  const hideAll=reportMode==='emotion', hideAbs=reportMode!=='full';
  if(!hideAll){g.fillStyle='#16233A';g.font='700 62px monospace';g.fillText(hideAbs?'金额已隐藏':yuan0(r.ms.expected)+' 税前',W/2,360);g.fillStyle='#727E92';g.font='24px sans-serif';g.fillText(hideAbs?'隐私档不展示绝对金额':'预计到手 '+yuan0(r.row&&r.row.active?r.row.net:0),W/2,410);}
  g.fillStyle='#16233A';g.font='600 36px sans-serif';g.fillText('🙂 '+r.st.g+'　😐 '+r.st.s+'　😖 '+r.st.b,W/2,hideAll?390:570);g.fillText('不难赚 '+r.st.e+'　·　难赚 '+r.st.h,W/2,hideAll?470:650);
  g.fillStyle='#727E92';g.font='26px sans-serif';g.fillText('记录 '+r.rec.length+' 天　·　记录率 '+fmt(r.rate,0)+'%　·　最长连续 '+r.best+' 天',W/2,hideAll?570:750);
  const text=r.insight.length>38?r.insight.slice(0,38)+'…':r.insight;g.fillStyle='#16233A';g.font='25px sans-serif';g.fillText(text,W/2,hideAll?730:910);g.fillStyle='#A87C2A';g.font='22px monospace';g.fillText(reportMode==='full'?'完整档':reportMode==='private'?'隐私档 · 无绝对金额':'纯情绪档 · 无任何金额',W/2,1190);return cv;
}
function openReport(){renderReport();$('#reportModal').classList.add('on');}

function initWizard(){
  cfg.onboardingComplete=false; persist();
  let step=1,factor=1,shift='flex',view='annualized';
  const show=()=>{$$('.wiz-step').forEach(x=>x.classList.toggle('on',Number(x.dataset.step)===step));$('#wizCount').textContent=step+' / 3';$('#wBack').hidden=step===1;$('#wNext').textContent=step===3?'完成并进入首页':'下一步';};
  $('#wFactor').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#wFactor button').forEach(x=>x.classList.toggle('on',x===b));$('#wFactorCustom').hidden=b.dataset.v!=='custom';factor=b.dataset.v==='custom'?Number($('#wFactorCustom').value)||1:Number(b.dataset.v);};
  $('#wFactorCustom').oninput=()=>factor=Math.max(0,Number($('#wFactorCustom').value)||0);
  $('#wShift').onclick=e=>{const b=e.target.closest('button');if(!b)return;shift=b.dataset.v;$$('#wShift button').forEach(x=>x.classList.toggle('on',x===b));$('#wShiftCustom').hidden=shift!=='custom';};
  $('#wView').onclick=e=>{const b=e.target.closest('button');if(!b)return;view=b.dataset.v;$$('#wView button').forEach(x=>x.classList.toggle('on',x===b));};
  $('#wBack').onclick=()=>{step=Math.max(1,step-1);show();};
  $('#wNext').onclick=()=>{if(step<3){step++;show();return;}const ann=Math.max(12,Math.min(24,Number($('#wAnnual').value)||12));const next=Object.assign({},DEF,{onboardingComplete:true,monthly:Math.max(0,Number($('#wMonthly').value)||0),bonusMonths:ann-12,annualMonths:ann,bonusFactor:factor,viewMode:view,bonusSpread:view==='annualized'});if(shift==='standard')Object.assign(next,{start:'09:00',end:'18:00',lunchAt:'12:00',lunch:60});if(shift==='custom')Object.assign(next,{start:$('#wStart').value,end:$('#wEnd').value,lunchAt:$('#wLunchAt').value,lunch:Math.max(0,Number($('#wLunch').value)||0)});applyCfg(next,true);$('#wizard').hidden=true;toast('初始化完成');};
  show();$('#wizard').hidden=false;
}

/* ============================================================
   10. 抽屉
   ============================================================ */
function openDrawer(){
  draft = JSON.parse(JSON.stringify(cfg));
  fillForm();
  $('#drawer').classList.add('on');
  $('#scrim').classList.add('on');
  $('#drawer').setAttribute('aria-hidden','false');
  markDirty();
}
function closeDrawer(){
  $('#drawer').classList.remove('on');
  $('#scrim').classList.remove('on');
  $('#drawer').setAttribute('aria-hidden','true');
  draft = null;
}
function fillForm(){
  const d = draft;
  $$('#segMode button').forEach(b => b.classList.toggle('on', b.dataset.v === d.mode));
  $('#paneMonth').hidden = d.mode !== 'month';
  $('#paneHour').hidden  = d.mode !== 'hour';
  $('#fMonthly').value  = d.monthly;
  $('#fWorkDays').value = d.workDays;
  $('#fAnnual').value   = d.annualMonths;
  $('#fBonusMonths').value = d.bonusMonths;
  $('#fBonusFactor').value = d.bonusFactor;
  $('#fBonusMonth').value = String(d.bonusMonth || 12);
  $$('#segView button').forEach(b => b.classList.toggle('on', b.dataset.v === d.viewMode));
  $('#fSpread').classList.toggle('on', d.viewMode === 'annualized');
  $('#fSpread').setAttribute('aria-checked', d.viewMode === 'annualized' ? 'true':'false');
  renderAnnualPick();
  $('#fHourly').value   = d.hourly;
  $('#fStart').value    = d.start;
  $('#fEnd').value      = d.end;
  $('#fLunchAt').value  = d.lunchAt;
  $('#fLunch').value    = d.lunch;
  $('#fSiBase').value   = d.siBase || '';
  $('#fHfBase').value   = d.hfBase || '';
  $('#fHfRate').value   = String(d.hfRate);
  $('#fTaxStart').value = String(d.taxStartMonth);
  $('#fSig').value      = d.sig || '';
  $('#fUnit').value     = String(d.unit);
  $('#fNetMode').classList.toggle('on', !!d.netMode);
  $('#fNetMode').setAttribute('aria-checked', d.netMode ? 'true':'false');
  $('#fSound').classList.toggle('on', !!d.sound);
  $('#fSound').setAttribute('aria-checked', d.sound ? 'true':'false');
  $$('#segTheme button').forEach(b => b.classList.toggle('on', b.dataset.v === d.theme));
  $('#siRange').textContent = yuan0(SI_SH.baseMin)+'–'+yuan0(SI_SH.baseMax);
  const wk = $('#wkPick');
  const NM = ['一','二','三','四','五','六','日'];
  wk.innerHTML = NM.map((n,i)=>{
    const dow = i===6 ? 0 : i+1;
    return `<button type="button" data-d="${dow}" class="${d.week.includes(dow)?'on':''}">${n}</button>`;
  }).join('');
  renderGoalEdit();
}
/* 年薪月数：常见档位快选 + 年终奖回显 */
function renderAnnualPick(){
  const seg = $('#segAnnual');
  const d = draft;
  const m = 12 + Math.max(0, Number(d.bonusMonths)||0);
  d.annualMonths = m;
  if ($('#fAnnual')) $('#fAnnual').value = m;
  if (seg){
    seg.innerHTML = ANNUAL_PLANS.map(p =>
      `<button type="button" data-a="${p.m}" class="${Math.abs(p.m - m) < 0.01 ? 'on':''}">${p.n}</button>`).join('');
  }
  const bonusM = Math.max(0, Number(d.bonusMonths)||0);
  const bonus  = (Number(d.monthly)||0) * bonusM * Math.max(0, Number(d.bonusFactor)||0);
  const hint = $('#fAnnualHint');
  if (hint) hint.textContent = bonusM > 0
    ? '12 月 base + ' + fmt(bonusM, bonusM%1?1:0) + ' 月奖金 × ' + fmt(d.bonusFactor, 1)
    : '无年终奖';
  const bv = $('#fBonusView');
  if (bv) bv.value = bonusM > 0 ? yuan0(bonus) + '（' + fmt(bonusM, bonusM%1?1:0) + ' 个月）' : '无';
}
function renderGoalEdit(){
  const pick = $('#goalSetPick');
  if (pick) pick.innerHTML = setChips(draft.goalSet || matchSet(draft.goals));
  $('#goalEdit').innerHTML = draft.goals.map((g,i)=>
    `<div class="ge" data-i="${i}">
      <input class="em" value="${g.em||''}" maxlength="2" aria-label="图标">
      <input class="nm" value="${g.name||''}" maxlength="14" aria-label="名称">
      <input class="amt" type="number" value="${g.amt||0}" min="0" step="1" aria-label="金额">
      <button type="button" data-del aria-label="删除">×</button>
    </div>`).join('');
}
function readForm(){
  const d = draft;
  d.monthly  = Math.max(0, Number($('#fMonthly').value)||0);
  d.workDays = Math.max(1, Number($('#fWorkDays').value)||21.75);
  d.bonusMonths = Math.max(0, Math.min(12, Number($('#fBonusMonths').value)||0));
  d.annualMonths = 12 + d.bonusMonths;
  d.bonusFactor = Math.max(0, Number($('#fBonusFactor').value)||0);
  d.bonusMonth = Math.max(1, Math.min(12, Number($('#fBonusMonth').value)||12));
  d.bonusSpread = d.viewMode === 'annualized';
  d.hourly   = Math.max(0, Number($('#fHourly').value)||0);
  d.start    = $('#fStart').value || DEF.start;
  d.end      = $('#fEnd').value   || DEF.end;
  d.lunchAt  = $('#fLunchAt').value || '12:00';
  d.lunch    = Math.max(0, Number($('#fLunch').value)||0);
  d.siBase   = Math.max(0, Number($('#fSiBase').value)||0);
  d.hfBase   = Math.max(0, Number($('#fHfBase').value)||0);
  d.hfRate   = Number($('#fHfRate').value)||0.05;
  d.taxStartMonth = Number($('#fTaxStart').value)||1;
  d.sig      = $('#fSig').value.trim();
  d.unit     = Number($('#fUnit').value)||1000;
  d.goals = $$('#goalEdit .ge').map(r => ({
    em: r.querySelector('.em').value.trim() || '◆',
    name: r.querySelector('.nm').value.trim() || '未命名',
    amt: Math.max(0, Number(r.querySelector('.amt').value)||0)
  })).filter(g => g.amt > 0);
  d.goalSet = matchSet(d.goals);
  const pick = $('#goalSetPick');
  if (pick) pick.innerHTML = setChips(d.goalSet);
  renderAnnualPick();
  markDirty();
}
function markDirty(){
  if (!draft) return;
  const same = JSON.stringify(draft) === JSON.stringify(cfg);
  $('#dirtyHint').textContent = same ? '与当前一致' : '有未保存改动';
  $('#dirtyHint').style.color = same ? 'var(--ink-4)' : 'var(--press)';
}
function applyCfg(next, silent){
  cfg = next; M = PR.shift(cfg);
  applyTheme(); Flap.setSound(cfg.sound);
  persist();
  boardMain.sig = '';
  lastDayKey = ''; lastMonthKey = '';
  renderCalendar(); renderHeat(); renderPayroll(); renderGoalSets(); tick();
  cardSel = null; cardAuto = true; renderCardDay();
  vault.resize();
  if (!silent) toast('已压印新参数');
}

/* ---------- 主题 ---------- */
function applyTheme(){
  let t = cfg.theme;
  if (t === 'auto'){
    const h = new Date().getHours();
    t = (h >= 7 && h < 18) ? 'day' : 'night';
  }
  document.documentElement.setAttribute('data-theme', t === 'night' ? 'night' : 'day');
  const ic = $('#icTheme');
  if (ic) ic.innerHTML = t === 'night'
    ? '<path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5 8.8 8.8 0 1 0 20.5 14.4z"/>'
    : '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>';
  $('#btnTheme').classList.toggle('on', t === 'night');
  vault.redraw();
}

/* ---------- 确认弹窗 ---------- */
let mkCb = null;
function confirmBox(title, body, cb){
  $('#mkTitle').textContent = title;
  $('#mkBody').textContent = body;
  mkCb = cb; $('#modal').classList.add('on');
}
$('#mkNo').onclick  = () => { $('#modal').classList.remove('on'); mkCb = null; };
$('#mkYes').onclick = () => { $('#modal').classList.remove('on'); const c = mkCb; mkCb = null; if (c) c(); };

/* ============================================================
   11. 事件绑定
   ============================================================ */
/* 抽屉 */
$('#btnCfg').onclick   = openDrawer;
$('#btnClose').onclick = closeDrawer;
$('#scrim').onclick    = closeDrawer;
$('#btnRevert').onclick = () => { draft = JSON.parse(JSON.stringify(cfg)); fillForm(); toast('已放弃改动'); };
$('#btnSave').onclick   = () => { readForm(); applyCfg(JSON.parse(JSON.stringify(draft))); closeDrawer(); };

$('#segMode').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  draft.mode = b.dataset.v; fillForm();
};
$('#segTheme').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  draft.theme = b.dataset.v;
  $$('#segTheme button').forEach(x => x.classList.toggle('on', x === b));
  const keep = cfg.theme; cfg.theme = draft.theme; applyTheme(); cfg.theme = keep;
  markDirty();
};
$('#wkPick').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = Number(b.dataset.d);
  const i = draft.week.indexOf(d);
  if (i >= 0){ if (draft.week.length <= 1) return toast('至少保留一个计薪日'); draft.week.splice(i,1); }
  else draft.week.push(d);
  draft.week.sort();
  b.classList.toggle('on');
  markDirty();
};
$('#segAnnual').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  draft.bonusMonths = Math.max(0, (Number(b.dataset.a) || 12) - 12);
  draft.annualMonths = 12 + draft.bonusMonths;
  $('#fAnnual').value = draft.annualMonths;
  $('#fBonusMonths').value = draft.bonusMonths;
  renderAnnualPick();
  markDirty();
};
$('#segView').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  draft.viewMode = b.dataset.v;
  draft.bonusSpread = draft.viewMode === 'annualized';
  $$('#segView button').forEach(x => x.classList.toggle('on', x === b));
  markDirty();
};
$('#fSpread').onclick = () => {
  draft.viewMode = draft.viewMode === 'annualized' ? 'actual' : 'annualized';
  draft.bonusSpread = draft.viewMode === 'annualized';
  $('#fSpread').classList.toggle('on', draft.bonusSpread);
  $('#fSpread').setAttribute('aria-checked', draft.bonusSpread?'true':'false');
  $$('#segView button').forEach(b => b.classList.toggle('on', b.dataset.v === draft.viewMode));
  markDirty();
};
$('#fNetMode').onclick = () => {
  draft.netMode = !draft.netMode;
  $('#fNetMode').classList.toggle('on', draft.netMode);
  $('#fNetMode').setAttribute('aria-checked', draft.netMode?'true':'false');
  markDirty();
};
$('#fSound').onclick = () => {
  draft.sound = !draft.sound;
  $('#fSound').classList.toggle('on', draft.sound);
  $('#fSound').setAttribute('aria-checked', draft.sound?'true':'false');
  Flap.setSound(draft.sound); if (draft.sound) Flap.click(0.05);
  markDirty();
};
$('#drawer').addEventListener('input', e => {
  if (e.target.id === 'fAnnual' && draft){
    draft.bonusMonths = Math.max(0, Math.min(12, (Number(e.target.value)||12)-12));
    $('#fBonusMonths').value = draft.bonusMonths;
  }
  if (e.target.closest('.db')) readForm();
});
$('#goalSets').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.dataset.s === 'custom') return;
  applyGoalSet(b.dataset.s);
};
$('#goalSetPick').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.dataset.s === 'custom') return;
  const s = findSet(b.dataset.s); if (!s) return;
  draft.goals = JSON.parse(JSON.stringify(s.goals));
  draft.goalSet = s.id;
  renderGoalEdit(); markDirty();
};
$('#goalEdit').onclick = e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const i = Number(b.closest('.ge').dataset.i);
  draft.goals.splice(i,1); renderGoalEdit(); markDirty();
};
$('#btnAddGoal').onclick = () => {
  draft.goals.push({ em:'◆', name:'新目标', amt:100 }); renderGoalEdit(); markDirty();
};
$('#btnExport').onclick = () => {
  const payload = { cfg:draft||cfg, days:ovr, mood, schemaVersion:SCHEMA_VERSION, exportedAt:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'salary-mint-' + PR.dkey(new Date()) + '.json';
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  toast('已导出完整 JSON');
};
$('#btnImport').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const j = JSON.parse(r.result);
      if (!j || typeof j !== 'object' || !j.cfg || typeof j.cfg !== 'object' ||
          (j.days != null && (typeof j.days !== 'object' || Array.isArray(j.days))) ||
          (j.mood != null && (typeof j.mood !== 'object' || Array.isArray(j.mood)))) throw new Error('invalid shape');
      const nextCfg = migrateCfg(j.cfg), nextDays = JSON.parse(JSON.stringify(j.days||{}));
      const nextMood = JSON.parse(JSON.stringify(j.mood||{}));
      /* 所有校验、深拷贝完成后才一次性替换，失败不会触碰现有状态。 */
      ovr = nextDays; mood = nextMood; saveMood(); applyCfg(nextCfg,true);
      if ($('#drawer').classList.contains('on')){ draft=JSON.parse(JSON.stringify(cfg));fillForm(); }
      toast('导入成功，数据已恢复');
    }catch(err){ toast('导入失败：文件格式或字段无效'); }
  };
  r.readAsText(f); e.target.value = '';
};
$('#btnClearMood').onclick=()=>confirmBox('清空心情记录','将删除全部心情、难赚感受与原因标签，其他配置保留。',()=>{mood={};saveMood();renderCalendar();renderYear();tick();toast('心情记录已清空');});
$('#btnClearAll').onclick=()=>confirmBox('清空全部本地数据','将删除配置、日历覆盖与所有结算记录，并重新进入初始化。',()=>{[CFG_KEY,OVR_KEY,MOOD_LS,MOOD_DETAIL_LS,META_KEY].forEach(k=>localStorage.removeItem(k));ckSet(MOOD_CK,'');location.reload();});
$('#btnReset').onclick = () => confirmBox('恢复默认参数',
  '将把班次、薪酬、可兑换清单恢复为默认值，并清空所有日历标记。此操作不可撤销。', () => {
    ovr = {}; draft = JSON.parse(JSON.stringify(DEF));
    applyCfg(JSON.parse(JSON.stringify(DEF)), true);
    fillForm(); toast('已恢复默认');
  });

/* 券面翻转 */
const flip = () => $('#note').classList.toggle('flipped');
$('#btnFlip').onclick = flip;
$('#btnFlip2').onclick = flip;

/* 顶栏工具 */
$('#btnTheme').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  cfg.theme = cur === 'night' ? 'day' : 'night';
  applyTheme(); persist();
  toast(cfg.theme === 'night' ? '夜铸' : '日铸');
};
$('#btnPrivacy').onclick = () => {
  const on = document.documentElement.classList.toggle('privacy');
  $('#btnPrivacy').classList.toggle('on', on);
};
$('#btnSound').onclick = () => {
  cfg.sound = !cfg.sound; Flap.setSound(cfg.sound); persist();
  $('#btnSound').classList.toggle('on', cfg.sound);
  if (cfg.sound) Flap.click(0.06);
  toast(cfg.sound ? '翻页牌音效开' : '翻页牌音效关');
};

/* 日历导航 */
$('#calPrev').onclick  = () => { calM--; if (calM<0){ calM=11; calY--; } renderCalendar(); renderHeat(); };
$('#calNext').onclick  = () => { calM++; if (calM>11){ calM=0; calY++; } renderCalendar(); renderHeat(); };
$('#calToday').onclick = () => { const n=new Date(); calY=n.getFullYear(); calM=n.getMonth(); selKey=PR.dkey(n); renderCalendar(); renderHeat(); };

/* 换算所联动 */
['#mtN','#mtM','#mtH','#mtMode','#idM','#idF','#btP','#btBase'].forEach(s => {
  const el = $(s); if (el) el.addEventListener('input', () => tick());
});

/* 战报卡 */
$('#segCardDay').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  cardSel = b.dataset.v; cardAuto = false;
  renderCardDay();
  if ($('#cardPrev').style.display === 'block') drawCard();
};
$('#btnCardPrev').onclick = () => {
  $('#cardPrev').style.display = 'block';
  renderCardDay();
  drawCard();
};
$('#btnCard').onclick = () => {
  renderCardDay();
  const cv = drawCard();
  $('#cardPrev').style.display = 'block';
  const day = cardStats(cardSel).day;
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = '铸币战报-' + PR.dkey(day) + '.png';
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
    toast('战报卡已下载 · ' + cardDayLabel(cardSel));
  }, 'image/png');
};

/* Edition IV 交互 */
$('#viewQuick').onclick=e=>{const b=e.target.closest('button');if(b)setViewMode(b.dataset.v);};
$('#btnSettle').onclick=()=>openSettle();
$('#settleDate').onchange=e=>renderSettle(e.target.value);
['#settleMood','#settleWorth'].forEach(s=>$(s).onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;const [grp,key]=b.dataset.s.split(':');if(settleDraft[grp]===key)settleDraft[grp]=null;else settleDraft[grp]=key;renderSettleChoice();});
function renderSettleChoice(){
  $$('#settleMood [data-s],#settleWorth [data-s]').forEach(b=>{const p=b.dataset.s.split(':');b.classList.toggle('on',settleDraft[p[0]]===p[1]);});
  $$('#settleReasons [data-r]').forEach(b=>b.classList.toggle('on',(settleDraft.reasons||[]).includes(b.dataset.r)));
}
$('#settleReasons').onclick=e=>{const b=e.target.closest('[data-r]');if(!b)return;const a=settleDraft.reasons||(settleDraft.reasons=[]),i=a.indexOf(b.dataset.r);if(i>=0)a.splice(i,1);else if(a.length<2)a.push(b.dataset.r);else return toast('原因标签最多选 2 个');renderSettleChoice();};
$('#btnSettleSave').onclick=()=>{const k=$('#settleDate').value;if(!recordableDate(k))return toast('该日期不可记录');const v={};if(settleDraft.d)v.d=settleDraft.d;if(settleDraft.w)v.w=settleDraft.w;if((settleDraft.reasons||[]).length)v.reasons=settleDraft.reasons.slice(0,2);if(v.d||v.w||v.reasons) mood[k]=v;else delete mood[k];saveMood();$('#settleModal').classList.remove('on');renderCalendar();renderYear();tick();toast('结算已保存');};
$('#btnReport').onclick=openReport;
$('#reportPrivacy').onclick=e=>{const b=e.target.closest('button');if(!b)return;reportMode=b.dataset.v;$$('#reportPrivacy button').forEach(x=>x.classList.toggle('on',x===b));if(!$('#reportPreview').hidden)drawReportCard();};
$('#btnReportPreview').onclick=()=>{$('#reportPreview').hidden=false;drawReportCard();};
$('#btnReportDownload').onclick=()=>{const cv=drawReportCard();$('#reportPreview').hidden=false;cv.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='月度简报-'+PR.dkey(new Date()).slice(0,7)+'-'+reportMode+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/png');};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.remove('on'));

/* 快捷键 */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tn = (e.target.tagName||'').toLowerCase();
  if (tn === 'input' || tn === 'select' || tn === 'textarea') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'escape'){
    if ($('#modal').classList.contains('on')) $('#mkNo').click();
    else if ($('#drawer').classList.contains('on')) closeDrawer();
    return;
  }
  if (k === 't'){ $('#btnTheme').click(); }
  else if (k === 'p'){ $('#btnPrivacy').click(); }
  else if (k === 's'){ $('#btnSound').click(); }
  else if (k === 'c'){ $('#drawer').classList.contains('on') ? closeDrawer() : openDrawer(); }
  else if (k === 'f'){ flip(); }
  else if (/^[1-7]$/.test(k)){
    const a = $$('#navx a')[Number(k)-1];
    if (a) a.click();
  }
});

/* 章节导航高亮 + 阅读进度 */
const secs = ['today','vault','payroll','calendar','exchange','medals','sources'];
function spy(){
  const y = window.scrollY + 90;
  let cur = '';
  secs.forEach(id => { const el = document.getElementById(id); if (el && el.offsetTop <= y) cur = id; });
  $$('#navx a').forEach(a => a.classList.toggle('on', a.dataset.sec === cur));
  const h = document.documentElement.scrollHeight - window.innerHeight;
  $('#prog').style.width = (h > 0 ? Math.min(100, window.scrollY/h*100) : 0) + '%';
}
window.addEventListener('scroll', spy, { passive:true });

/* 金库仅在可见时动画 */
if ('IntersectionObserver' in window){
  new IntersectionObserver(es => {
    es.forEach(en => {
      if (en.isIntersecting){ if (!vaultOn){ vaultOn = true; vault.start(); } }
      else { vaultOn = false; vault.stop(); }
    });
  }, { threshold:0.08 }).observe($('#vaultCv'));
} else { vault.start(); }

let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => { vault.resize(); renderPayroll(); }, 180);
});

/* ============================================================
   12. 启动
   ============================================================ */
function boot(){
  /* 首个计薪月与奖金月选项 */
  $('#fTaxStart').innerHTML = Array.from({length:12}, (_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join('');
  $('#fBonusMonth').innerHTML = Array.from({length:12}, (_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join('');

  /* 来源与口径：默认折叠，展开可逐条追溯 */
  $('#srcList').innerHTML = SOURCES.map(s =>
    `<div class="srow2"><span class="sg">${s.g}</span>
      <span><a href="${s.u}" target="_blank" rel="noopener">${s.t}</a></span>
      <span class="sd">${s.d}</span></div>`).join('');
  $('#caveatList').innerHTML = CAVEATS.map(c => `<li>${c}</li>`).join('');
  $('#srcN').textContent = SOURCES.length;
  $('#cavN').textContent = CAVEATS.length;
  $('#srcGroups').textContent = SOURCES.map(s=>s.g).filter((g,i,a)=>a.indexOf(g)===i).join(' · ');
  $('#ftBuild').textContent = BUILD;
  $('#sigName').textContent = cfg.sig || 'MINT MASTER';

  buildEngraving();
  applyTheme();
  Flap.setSound(cfg.sound);
  $('#btnSound').classList.toggle('on', cfg.sound);

  const now = new Date();
  calY = now.getFullYear(); calM = now.getMonth(); selKey = PR.dkey(now);
  lastDayKey = PR.dkey(now); lastMonthKey = now.getFullYear()+'-'+now.getMonth();

  renderCalendar(); renderHeat(); renderPayroll(); renderGoalSets(); renderCardDay(); renderViewMode();
  tick(); spy();
  setInterval(tick, 100);
  /* 战报默认日随「今天是否已铸满」变化，用户手选后不再自动改 */
  setInterval(() => {
    if (!cardAuto) return;
    const d = cardDefaultDay();
    if (d !== cardSel){ cardSel = d; renderCardDay(); }
  }, 30000);

  if (firstRun){
    setTimeout(initWizard, 180);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* 署名实时同步 */
$('#fSig') && $('#fSig').addEventListener('input', () => {
  $('#sigName').textContent = $('#fSig').value.trim() || 'MINT MASTER';
});

})();
