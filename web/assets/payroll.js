/* ============================================================
   薪水铸币厂 · 计薪引擎（纯函数，可单独测试）
   口径：午休不计薪
   ============================================================ */
'use strict';

const PR = (() => {

  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
  const mins  = t => { const p = String(t||'0:0').split(':').map(Number); return (p[0]||0)*60 + (p[1]||0); };
  const pad   = n => String(n).padStart(2,'0');
  const dkey  = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const hhmm  = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m/60)) + ':' + pad(m%60); };

  /* ---------- 年薪月数（多薪）口径 ----------
     annualMonths : 年薪月数，默认 15（12 个月 base + 3 个月年终奖）
     bonusSpread  : 是否把年终奖摊进日薪
     只对「按月薪」模式生效；时薪模式无年终奖概念。
  --------------------------------- */
  function annual(cfg){
    const monthly = Math.max(0, Number(cfg.monthly)||0);
    /* annualMonths 只作为旧数据兼容输入；Edition IV 的事实源是 bonusMonths + bonusFactor。 */
    const legacyMonths = clamp(Number(cfg.annualMonths)||12, 12, 24);
    const bonusM = Math.max(0, cfg.bonusMonths == null ? legacyMonths - 12 : Number(cfg.bonusMonths)||0);
    const bonusFactor = Math.max(0, cfg.bonusFactor == null ? 1 : Number(cfg.bonusFactor)||0);
    const bonus = monthly * bonusM * bonusFactor;
    const months = 12 + bonusM;
    const annualized = (cfg.viewMode || (cfg.bonusSpread === false ? 'actual' : 'annualized')) === 'annualized';
    const spread = annualized && bonus > 0 && cfg.mode === 'month';
    return {
      monthly, months, bonusM, bonusFactor, bonus, spread,
      package: monthly * 12 + bonus,
      factor: spread ? (monthly * 12 + bonus) / Math.max(monthly * 12, 1) : 1
    };
  }

  /* ---------- 班次模型 ---------- */
  function shift(cfg){
    const s = mins(cfg.start), e = mins(cfg.end);
    let span = e - s; if (span <= 0) span += 1440;
    const lunch = clamp(Number(cfg.lunch)||0, 0, span - 1);
    const paid  = Math.max(span - lunch, 1);
    let lRel = mins(cfg.lunchAt) - s; if (lRel < 0) lRel += 1440;
    lRel = clamp(lRel, 0, span - lunch);
    const A = annual(cfg);
    const days  = Math.max(Number(cfg.workDays)||1, 0.01);
    /* 月薪模式：日薪 = 月薪 × 年化系数 ÷ 每月计薪天数（默认把年终奖摊进来） */
    const base  = cfg.mode === 'month'
      ? A.monthly / days
      : (Number(cfg.hourly)||0) * paid / 60;
    const daily = cfg.mode === 'month' ? base * A.factor : base;
    const perHour = daily / (paid / 60);
    return { s, e, span, lunch, paid, lRel, daily, baseDaily: base, perHour, perSec: perHour/3600,
             annualMonths: A.months, bonusMonths: A.bonusM, bonusSpread: A.spread, factor: A.factor };
  }

  /* ---------- 日历日类型 ----------
     返回 { type, label, mult, holiday, forced }
     type: 'work' | 'rest' | 'off' | 'legal' | 'leave' | 'ot'
       work  正常计薪工作日（含调休上班）
       rest  普通周末
       off   放假日（节假日调休放假，非法定）
       legal 法定节假日（不上班）
       leave 请假／不计薪
       ot    非工作日加班计薪
  --------------------------------- */
  function dayPlan(d, cfg, ovr){
    const k   = typeof d === 'string' ? d : dkey(d);
    const dow = typeof d === 'string' ? new Date(k + 'T00:00:00').getDay() : d.getDay();
    const yr  = Number(k.slice(0,4));
    const h   = (typeof arrangementKnown === 'function' && arrangementKnown(yr)) ? CAL_INDEX[k] : null;
    const o   = ovr[k] || null;

    let base, holiday = h ? h.name : null, mult = 1;

    if (h && h.kind === 'legal')       { base = 'legal';  mult = OT.legal; }
    else if (h && h.kind === 'off')    { base = 'off';    mult = OT.restday; }
    else if (h && h.kind === 'makeup') { base = 'work';   mult = 1; }
    else if (cfg.week.includes(dow))   { base = 'work';   mult = 1; }
    else                               { base = 'rest';   mult = OT.restday; }

    let type = base, forced = false;
    if (o){
      if (o.st === 'off'  && base === 'work') { type = 'leave'; forced = true; }
      if (o.st === 'work' && base !== 'work') { type = 'work';  forced = true; mult = 1; }
      if (o.st === 'ot'   && base !== 'work') { type = 'ot';    forced = true; }
    }

    const otHours = (o && base === 'work' && type === 'work') ? Math.max(Number(o.ot)||0, 0) : 0;
    return { key:k, dow, type, base, mult, holiday, forced, otHours,
             isLegal: !!(h && h.kind === 'legal'),
             isMakeup: !!(h && h.kind === 'makeup'),
             known: (typeof arrangementKnown === 'function') ? arrangementKnown(yr) : true };
  }

  /* 某日应铸金额（税前，含加班倍率） */
  function dayAmount(plan, M){
    if (plan.type === 'work') return M.daily + M.perHour * OT.weekday * plan.otHours;
    if (plan.type === 'ot')   return M.daily * plan.mult;
    return 0;
  }

  /* ---------- 日内进度 ---------- */
  function relNow(now, M){
    let r = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60 + now.getMilliseconds()/60000 - M.s;
    if (r < -720) r += 1440;
    return r;
  }
  /* 已计薪分钟（午休扣除） */
  function paidElapsed(rel, M){
    const r = clamp(rel, 0, M.span);
    const inLunch = clamp(r - M.lRel, 0, M.lunch);
    return clamp(r - inLunch, 0, M.paid);
  }
  /* 由已计薪分钟反推班次内相对分钟 */
  function relAtPaid(pm, M){ return pm <= M.lRel ? pm : pm + M.lunch; }

  /* 日内状态：pre / work / lunch / off / rest / holiday / leave */
  function todayState(now, cfg, ovr, M){
    const p = dayPlan(now, cfg, ovr);
    if (p.type === 'leave') return { s:'leave', plan:p };
    if (p.type === 'legal') return { s:'legal', plan:p };
    if (p.type === 'off')   return { s:'holiday', plan:p };
    if (p.type === 'rest')  return { s:'rest', plan:p };
    const r = relNow(now, M);
    if (r < 0)        return { s:'pre',   plan:p, rel:r };
    if (r >= M.span)  return { s:'off',   plan:p, rel:r };
    if (M.lunch > 0 && r >= M.lRel && r < M.lRel + M.lunch) return { s:'lunch', plan:p, rel:r };
    return { s:'work', plan:p, rel:r };
  }

  /* 下一个计薪日的开工时刻（毫秒） */
  function nextWorkStart(now, cfg, ovr, M){
    for (let i=0;i<420;i++){
      const c = new Date(now.getFullYear(), now.getMonth(), now.getDate()+i, 0,0,0,0);
      const p = dayPlan(c, cfg, ovr);
      if (p.type !== 'work' && p.type !== 'ot') continue;
      const t = c.getTime() + M.s*60000;
      if (t > now.getTime()) return t;
    }
    return now.getTime();
  }

  /* ---------- 月度统计 ---------- */
  function monthStats(now, cfg, ovr, M, y, m){
    const Y = (y == null) ? now.getFullYear() : y;
    const Mo = (m == null) ? now.getMonth()  : m;
    const days = new Date(Y, Mo+1, 0).getDate();
    let expected = 0, minted = 0, workDays = 0, doneDays = 0, otDays = 0, restDays = 0, legalDays = 0;
    const list = [];
    for (let i=1;i<=days;i++){
      const d = new Date(Y, Mo, i);
      const p = dayPlan(d, cfg, ovr);
      const amt = dayAmount(p, M);
      expected += amt;
      if (p.type === 'work') workDays++;
      if (p.type === 'ot')   otDays++;
      if (p.type === 'rest' || p.type === 'off') restDays++;
      if (p.type === 'legal') legalDays++;

      let got = 0;
      const isToday = d.toDateString() === now.toDateString();
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) { got = amt; if (amt>0) doneDays++; }
      else if (isToday && amt > 0){
        const rel = relNow(now, M);
        const pm  = paidElapsed(rel, M);
        const unit = (p.type === 'ot') ? M.daily * p.mult : M.daily;
        got = unit * (pm / M.paid);
        if (rel >= M.span) { got = amt; doneDays++; }
      }
      minted += got;
      list.push({ ...p, amt, got, day:i, isToday });
    }
    const A = annual(cfg);
    const bonusMonth = clamp(Number(cfg.bonusMonth)||12, 1, 12) - 1;
    const actualBonus = cfg.mode === 'month' && (cfg.viewMode || 'annualized') === 'actual' && Mo === bonusMonth ? A.bonus : 0;
    expected += actualBonus;
    /* 实际发薪视角下，奖金月集中显示；到该月最后一个计薪日收工后计入已铸。 */
    if (actualBonus && (Y < now.getFullYear() || (Y === now.getFullYear() && Mo < now.getMonth()) ||
        (Y === now.getFullYear() && Mo === now.getMonth() && doneDays >= workDays))) minted += actualBonus;
    return { year:Y, month:Mo, days, expected, minted, workDays, doneDays, otDays, restDays, legalDays, bonus:actualBonus, list };
  }

  /* ---------- 个税：累计预扣法 ---------- */
  function bracket(cum){
    for (const b of IIT_BRACKETS) if (cum <= b.upTo) return b;
    return IIT_BRACKETS[IIT_BRACKETS.length-1];
  }
  function iitOnCumulative(cum){
    if (cum <= 0) return 0;
    const b = bracket(cum);
    return Math.max(0, cum * b.rate - b.quick);
  }
  /** 按月换算后的综合所得税率表（财税〔2018〕164号附件），用于全年一次性奖金 */
  function monthBracket(v){
    for (const b of IIT_MONTH_BRACKETS) if (v <= b.upTo) return b;
    return IIT_MONTH_BRACKETS[IIT_MONTH_BRACKETS.length-1];
  }
  /** 全年一次性奖金单独计税：奖金 ÷ 12 查月度税率表 */
  function bonusTaxApart(bonus){
    if (bonus <= 0) return { tax:0, rate:0, quick:0, per:0, next:null, distance:null };
    const per = bonus / 12;
    const b = monthBracket(per);
    const i = IIT_MONTH_BRACKETS.indexOf(b);
    const next = i < IIT_MONTH_BRACKETS.length - 1 ? b.upTo * 12 : null;
    /* 边界按“当前档上限 - 奖金”计算；恰在边界时距离为 0，增加 0.01 元即进入下一档。 */
    const distance = next == null ? null : Math.max(0, next - bonus);
    return { tax: Math.max(0, bonus * b.rate - b.quick), rate:b.rate, quick:b.quick, per, next, distance };
  }

  /** 单月五险一金（个人部分）· 口径按 cfg.city 取，缺省上海 */
  function insurance(gross, cfg){
    const S = typeof cityPlan === 'function' ? cityPlan(cfg.city) : SI_SH;
    const siMin = S.siMin != null ? S.siMin : S.baseMin;
    const siMax = S.siMax != null ? S.siMax : S.baseMax;
    const hfMin = S.hfMin != null ? S.hfMin : S.hfBaseMin;
    const hfMax = S.hfMax != null ? S.hfMax : S.hfBaseMax;
    const hfRateMin = S.hfRateMin != null ? S.hfRateMin : SI_SH.hfRateMin;
    const hfRateMax = S.hfRateMax != null ? S.hfRateMax : SI_SH.hfRateMax;
    const siBase = clamp(Number(cfg.siBase) > 0 ? Number(cfg.siBase) : gross, siMin, siMax);
    const hfBase = clamp(Number(cfg.hfBase) > 0 ? Number(cfg.hfBase) : gross, hfMin, hfMax);
    const rate   = clamp(Number(cfg.hfRate) || hfRateMin, hfRateMin, hfRateMax);
    const pension      = siBase * S.pension;
    const medical      = siBase * S.medical;
    const unemployment = siBase * S.unemployment;
    const medicalAdd   = Number(S.medicalAdd) || 0;
    const hf           = hfBase * rate;
    return { siBase, hfBase, hfRate:rate, pension, medical, unemployment, medicalAdd,
             si: pension + medical + unemployment + medicalAdd, hf,
             total: pension + medical + unemployment + medicalAdd + hf };
  }

  /** 全年 12 个月累计预扣推演（假设月薪不变）· 带记忆化 */
  let _tyKey = '', _tyVal = null;
  function taxYear(cfg){
    const key = [cfg.city, cfg.mode, cfg.monthly, cfg.hourly, cfg.workDays, cfg.start, cfg.end,
                 cfg.lunch, cfg.lunchAt, cfg.siBase, cfg.hfBase, cfg.hfRate, cfg.taxStartMonth,
                 cfg.annualMonths, cfg.bonusMonths, cfg.bonusFactor, cfg.viewMode, cfg.bonusMonth].join('|');
    if (key === _tyKey && _tyVal) return _tyVal;
    const gross = cfg.mode === 'month'
      ? (Number(cfg.monthly)||0)
      : shift(cfg).daily * (Number(cfg.workDays)||21.75);
    const ins = insurance(gross, cfg);
    const startM = clamp(Number(cfg.taxStartMonth)||1, 1, 12);
    const rows = [];
    let cumInc = 0, cumDed = 0, cumSpe = 0, paid = 0, n = 0;
    for (let m=1;m<=12;m++){
      if (m < startM){ rows.push({ m, active:false, gross:0, tax:0, net:0, ins:null, cumTaxable:0, rate:0 }); continue; }
      n++;
      cumInc += gross; cumDed += IIT_BASIC_MONTHLY; cumSpe += ins.total;
      const cumTaxable = Math.max(0, cumInc - cumDed - cumSpe);
      const totalTax = iitOnCumulative(cumTaxable);
      const tax = Math.max(0, totalTax - paid);
      paid = totalTax;
      rows.push({ m, active:true, gross, ins, tax, net: gross - ins.total - tax,
                  cumTaxable, rate: bracket(cumTaxable).rate, months:n });
    }
    const active = rows.filter(r=>r.active);
    const sum = {
      gross: active.reduce((a,r)=>a+r.gross,0),
      ins:   active.reduce((a,r)=>a+r.ins.total,0),
      tax:   active.reduce((a,r)=>a+r.tax,0),
      net:   active.reduce((a,r)=>a+r.net,0),
      months: active.length
    };

    /* 年终奖（年薪月数超出 12 的部分），按全年一次性奖金单独计税；
       同时算一遍并入综合所得的口径做对照，不替用户下结论。 */
    const A = annual(cfg);
    const lastCum = active.length ? active[active.length-1].cumTaxable : 0;
    const apart = bonusTaxApart(A.bonus);
    const merged = A.bonus > 0
      ? Math.max(0, iitOnCumulative(lastCum + A.bonus) - iitOnCumulative(lastCum))
      : 0;
    const chosenTax = Math.min(apart.tax, merged);
    const bonus = {
      months: A.bonusM, factor:A.bonusFactor, amount: A.bonus, spread: A.spread,
      apart, merged,
      tax: chosenTax,
      better: A.bonus <= 0 ? null : (apart.tax <= merged ? 'apart' : 'merged'),
      gap: Math.abs(apart.tax - merged),
      net: A.bonus - chosenTax
    };
    const year = {
      months: A.months,
      gross: sum.gross + A.bonus,
      ins:   sum.ins,
      tax:   sum.tax + bonus.tax,
      net:   sum.net + bonus.net,
      base:  sum.gross
    };
    year.ratio   = year.gross > 0 ? year.net / year.gross : 1;
    year.avgNet  = year.net / 12;

    _tyKey = key;
    _tyVal = { gross, ins, rows, sum, startM, bonus, year, annual: A };
    return _tyVal;
  }
  /** 当月税后（用于「按到手计」折算）
      年终奖摊入日薪时，券面上的钱是年化的，折算比例也应用年化到手率。 */
  function netNow(cfg, monthIdx){
    const ty = taxYear(cfg);
    const row = ty.rows[clamp(monthIdx,0,11)];
    if (ty.bonus && ty.bonus.spread) return { ratio: ty.year.ratio, row: row && row.active ? row : null, ty, annualized:true };
    if (!row || !row.active) return { ratio:1, row:null, ty };
    return { ratio: row.gross > 0 ? row.net / row.gross : 1, row, ty };
  }

  return { clamp, mins, pad, dkey, hhmm, shift, annual, dayPlan, dayAmount, relNow, paidElapsed,
           relAtPaid, todayState, nextWorkStart, monthStats, insurance, taxYear, netNow,
           iitOnCumulative, bracket, monthBracket, bonusTaxApart };
})();
