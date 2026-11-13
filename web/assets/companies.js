/* ============================================================
   薪水铸币厂 · 城市口径与公司预设

   两件事分开：
   1. CITY_PLANS —— 社保 / 公积金参数，全部取自 2026 年度官方通告，
      来源逐条写在 source 字段，渲染到「VII 口径与来源」。
   2. COMPANIES  —— 作息、年薪月数、公积金比例的参考值。这部分没有
      官方公开口径，属于社区常见说法，选中后可自由微调，UI 上明确标注
      「非官方」。禁止把它们当作权威数据引用。

   吉祥物 MASCOTS 是本项目原创的卡通形象，与任何公司的官方标识无关。
   ============================================================ */
'use strict';

/* ---------- 1. 城市社保 / 公积金口径 ---------- */
const CITY_PLANS = {
  sh: {
    id:'sh', name:'上海', short:'沪',
    year:'2026 年度（2026-07-01 起执行）',
    siMin:7546, siMax:37731, avgWage:12577,
    pension:0.08, medical:0.02, unemployment:0.005, medicalAdd:0,
    hfMin:2740, hfMax:37731, hfRateMin:0.05, hfRateMax:0.07,
    source:'上海市人社局 / 上海市公积金管理中心 2026 年度通告'
  },
  bj: {
    id:'bj', name:'北京', short:'京',
    year:'2026 年度（2026-07 起执行）',
    siMin:7270, siMax:36348, avgWage:null,
    pension:0.08, medical:0.02, unemployment:0.005, medicalAdd:3,
    hfMin:2540, hfMax:36348, hfRateMin:0.05, hfRateMax:0.12,
    source:'北京市人社局 / 北京住房公积金管理中心 2026 年度通告'
  },
  sz: {
    id:'sz', name:'深圳', short:'深',
    year:'2026 年度（2026-07-01 起执行）',
    siMin:5521, siMax:27603, avgWage:null,
    pension:0.08, medical:0.02, unemployment:0.003, medicalAdd:0,
    hfMin:2520, hfMax:48471, hfRateMin:0.05, hfRateMax:0.12,
    source:'广东省人社厅 / 深圳市住房公积金管理中心 2026 年度通告'
  },
  hz: {
    id:'hz', name:'杭州', short:'杭',
    year:'2026 年度（2026-01-01 起执行）',
    siMin:5122, siMax:25611, avgWage:null,
    pension:0.08, medical:0.02, unemployment:0.005, medicalAdd:0,
    hfMin:2660, hfMax:42151, hfRateMin:0.05, hfRateMax:0.12,
    source:'浙江省人社厅 / 杭州住房公积金管理中心 2026 年度通告'
  }
};

function cityPlan(id){ return CITY_PLANS[id] || CITY_PLANS.sh; }
function cityList(){ return Object.keys(CITY_PLANS).map(k => CITY_PLANS[k]); }
/** 该城市可选的公积金比例（整数百分点） */
function hfRateOptions(plan){
  const lo = Math.round(plan.hfRateMin * 100), hi = Math.round(plan.hfRateMax * 100);
  const out = [];
  for (let r = lo; r <= hi; r++) out.push(r);
  return out;
}

/* ---------- 2. 吉祥物（原创卡通形象，非官方标识） ---------- */
const MASCOTS = {
  byte: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#E7EFFF"/>
    <rect x="28.5" y="9" width="7" height="7" rx="2.4" fill="#7FA6F5"/>
    <rect x="15.5" y="18" width="33" height="31" rx="10.5" fill="#3D6FE0"/>
    <rect x="22" y="28" width="6" height="7.5" rx="3" fill="#FFF"/>
    <rect x="36" y="28" width="6" height="7.5" rx="3" fill="#FFF"/>
    <path d="M26.5 40.5q5.5 4 11 0" stroke="#FFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="20.5" cy="38" r="2.6" fill="#FFF" opacity=".35"/>
  </svg>`,
  tencent: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#E9F2FA"/>
    <ellipse cx="32" cy="34.5" rx="17.5" ry="19.5" fill="#1E2A36"/>
    <ellipse cx="32" cy="39" rx="10.5" ry="12.5" fill="#FFF"/>
    <ellipse cx="25.2" cy="27.5" rx="3.4" ry="3.9" fill="#FFF"/>
    <ellipse cx="38.8" cy="27.5" rx="3.4" ry="3.9" fill="#FFF"/>
    <circle cx="25.6" cy="28.2" r="1.7" fill="#1E2A36"/>
    <circle cx="39.2" cy="28.2" r="1.7" fill="#1E2A36"/>
    <path d="M27.6 33.4h8.8L32 38z" fill="#F5A623"/>
    <ellipse cx="20" cy="46" rx="4.4" ry="3" fill="#F5A623" transform="rotate(-16 20 46)"/>
    <ellipse cx="44" cy="46" rx="4.4" ry="3" fill="#F5A623" transform="rotate(16 44 46)"/>
  </svg>`,
  alibaba: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#FFF0E2"/>
    <circle cx="32" cy="34" r="19" fill="#F5761A"/>
    <path d="M30 15q2-5 6-3" stroke="#F5761A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="25.4" cy="30.5" rx="2.5" ry="3" fill="#FFF"/>
    <ellipse cx="38.6" cy="30.5" rx="2.5" ry="3" fill="#FFF"/>
    <path d="M25 39q7 5.5 14 0" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="20.5" cy="38" r="2.8" fill="#FFF" opacity=".3"/>
    <circle cx="43.5" cy="38" r="2.8" fill="#FFF" opacity=".3"/>
  </svg>`,
  meituan: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#FFF8DC"/>
    <ellipse cx="23" cy="17" rx="4.2" ry="8.5" fill="#FFD43B" transform="rotate(-20 23 17)"/>
    <ellipse cx="41" cy="17" rx="4.2" ry="8.5" fill="#FFD43B" transform="rotate(20 41 17)"/>
    <ellipse cx="23.5" cy="18" rx="2" ry="5" fill="#FFE9A0" transform="rotate(-20 23.5 18)"/>
    <ellipse cx="40.5" cy="18" rx="2" ry="5" fill="#FFE9A0" transform="rotate(20 40.5 18)"/>
    <ellipse cx="32" cy="36" rx="16.5" ry="17" fill="#FFD43B"/>
    <ellipse cx="26" cy="33" rx="2.4" ry="2.9" fill="#3A2E12"/>
    <ellipse cx="38" cy="33" rx="2.4" ry="2.9" fill="#3A2E12"/>
    <ellipse cx="32" cy="41" rx="3.4" ry="2.6" fill="#3A2E12"/>
    <path d="M29 45q3 2 6 0" stroke="#3A2E12" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`,
  pdd: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#FFECEE"/>
    <path d="M32 48c-9-6-14-11-14-16.5A7.5 7.5 0 0 1 32 26a7.5 7.5 0 0 1 14 5.5C46 37 41 42 32 48z" fill="#E23B4A"/>
    <ellipse cx="26" cy="31" rx="2.2" ry="2.7" fill="#FFF"/>
    <ellipse cx="38" cy="31" rx="2.2" ry="2.7" fill="#FFF"/>
    <path d="M28.5 37q3.5 2.6 7 0" stroke="#FFF" stroke-width="1.9" fill="none" stroke-linecap="round"/>
  </svg>`,
  netease: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#FFEEF4"/>
    <path d="M19 22l-4-7 9 2z" fill="#FFB6CE"/>
    <path d="M45 22l4-7-9 2z" fill="#FFB6CE"/>
    <circle cx="32" cy="35" r="17.5" fill="#FFB6CE"/>
    <ellipse cx="32" cy="38.5" rx="7" ry="5.6" fill="#FF8FB1"/>
    <circle cx="29.4" cy="38.5" r="1.5" fill="#C9557A"/>
    <circle cx="34.6" cy="38.5" r="1.5" fill="#C9557A"/>
    <ellipse cx="24.5" cy="30" rx="2.1" ry="2.6" fill="#7A3350"/>
    <ellipse cx="39.5" cy="30" rx="2.1" ry="2.6" fill="#7A3350"/>
  </svg>`,
  baidu: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#E6F1FF"/>
    <circle cx="18.5" cy="18.5" r="6.6" fill="#3C82E8"/>
    <circle cx="45.5" cy="18.5" r="6.6" fill="#3C82E8"/>
    <circle cx="18.5" cy="18.5" r="3" fill="#8FBBF5"/>
    <circle cx="45.5" cy="18.5" r="3" fill="#8FBBF5"/>
    <circle cx="32" cy="35" r="17" fill="#3C82E8"/>
    <ellipse cx="32" cy="40" rx="8" ry="6.4" fill="#DCEBFF"/>
    <ellipse cx="26" cy="31.5" rx="2.3" ry="2.8" fill="#FFF"/>
    <ellipse cx="38" cy="31.5" rx="2.3" ry="2.8" fill="#FFF"/>
    <ellipse cx="32" cy="38" rx="2.8" ry="2.2" fill="#1E3F70"/>
    <path d="M29.5 43q2.5 2 5 0" stroke="#1E3F70" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  </svg>`,
  jd: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#FFECEC"/>
    <ellipse cx="17.5" cy="34" rx="6" ry="11" fill="#C92F2F"/>
    <ellipse cx="46.5" cy="34" rx="6" ry="11" fill="#C92F2F"/>
    <circle cx="32" cy="34" r="16.5" fill="#E23B3B"/>
    <ellipse cx="32" cy="39.5" rx="8.6" ry="6.6" fill="#FFF3EE"/>
    <ellipse cx="26.5" cy="30" rx="2.2" ry="2.7" fill="#FFF"/>
    <ellipse cx="37.5" cy="30" rx="2.2" ry="2.7" fill="#FFF"/>
    <ellipse cx="32" cy="37.5" rx="3" ry="2.3" fill="#3A1A1A"/>
    <path d="M29 42.5q3 2.4 6 0" stroke="#3A1A1A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`
};

/* ---------- 3. 公司预设 ----------
   作息 / 年薪月数 / 公积金比例为社区常见参考值，非官方数据。
   monthly（月 base）刻意不预设：这是个人隐私，必须自己填。
-------------------------------------- */
const COMPANIES = [
  { id:'byte',     name:'字节跳动', short:'字节', city:'bj', start:'10:00', end:'19:00', lunchAt:'12:00', lunch:120, annualMonths:15,   hfRate:0.12, tag:'弹性 10-19' },
  { id:'tencent',  name:'腾讯',     short:'腾讯', city:'sz', start:'09:30', end:'18:30', lunchAt:'12:00', lunch:90,  annualMonths:16,   hfRate:0.12, tag:'双休 · 16 薪' },
  { id:'alibaba',  name:'阿里巴巴', short:'阿里', city:'hz', start:'09:30', end:'18:00', lunchAt:'12:00', lunch:90,  annualMonths:16,   hfRate:0.12, tag:'双休 · 16 薪' },
  { id:'meituan',  name:'美团',     short:'美团', city:'bj', start:'10:00', end:'19:00', lunchAt:'12:00', lunch:90,  annualMonths:15.5, hfRate:0.12, tag:'弹性 10-19' },
  { id:'pdd',      name:'拼多多',   short:'拼多多', city:'sh', start:'11:00', end:'20:00', lunchAt:'12:00', lunch:90, annualMonths:16,   hfRate:0.07, tag:'11-20 · 16 薪' },
  { id:'netease',  name:'网易',     short:'网易', city:'hz', start:'09:30', end:'18:30', lunchAt:'12:00', lunch:90,  annualMonths:15,   hfRate:0.12, tag:'双休 · 15 薪' },
  { id:'baidu',    name:'百度',     short:'百度', city:'bj', start:'10:00', end:'19:00', lunchAt:'12:00', lunch:90,  annualMonths:15,   hfRate:0.12, tag:'弹性 10-19' },
  { id:'jd',       name:'京东',     short:'京东', city:'bj', start:'09:00', end:'18:00', lunchAt:'12:00', lunch:60,  annualMonths:15,   hfRate:0.12, tag:'09-18 · 15 薪' }
];

function companyById(id){ return COMPANIES.filter(c => c.id === id)[0] || null; }
/** 把公司预设摊平成配置补丁 */
function companyPatch(id){
  const c = companyById(id);
  if (!c) return null;
  return {
    company:c.id, city:c.city,
    start:c.start, end:c.end, lunchAt:c.lunchAt, lunch:c.lunch,
    annualMonths:c.annualMonths, bonusMonths:c.annualMonths - 12, hfRate:c.hfRate
  };
}
