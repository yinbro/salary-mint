/* ============================================================
   薪水铸币厂 · 桌面外壳桥接层
   只读取页面已经算好并渲染到 DOM 的数字，不复制计薪逻辑，
   避免与页面口径产生漂移。
   ============================================================ */
(function () {
  'use strict';

  function pick(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return String(el.textContent || '').replace(/\s+/g, '').trim();
  }

  function num(text) {
    if (!text) return 0;
    var n = parseFloat(String(text).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function todayValue() {
    var board = document.getElementById('boardMain');
    if (!board) return { value: 0, text: '' };
    var attr = board.getAttribute('data-v') || '';
    if (attr) return { value: num(attr), text: attr };
    // 翻牌组件异常时退回逐字读取
    return { value: num(board.textContent), text: String(board.textContent || '') };
  }

  function snap() {
    var tv = todayValue();
    var dayTarget = pick('mDay');
    var pctText = pick('mPct');
    return {
      today: tv.value,
      todayText: tv.text,
      todayFull: num(dayTarget),
      todayFullText: dayTarget,
      progress: pctText ? num(pctText) / 100 : 0,
      progressText: pctText,
      state: ((document.getElementById('dayState') || {}).className || '').indexOf('live') >= 0 ? 'work' : 'idle',
      stateText: pick('dayState'),
      monthMinted: pick('moMint'),
      monthExpected: pick('moExp'),
      countdown: pick('cdVal'),
      countdownTitle: pick('cdTitle'),
      perSec: pick('mRate'),
      netMode: !(document.getElementById('netFlag') || {}).hidden,
      theme: document.documentElement.getAttribute('data-theme') || 'day',
      at: Date.now()
    };
  }

  function ready() {
    var board = document.getElementById('boardMain');
    var target = document.getElementById('mDay');
    return !!board && (board.getAttribute('data-v') || board.textContent) &&
           !!target && String(target.textContent || '').trim() !== '—';
  }

  function post() {
    var bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mint;
    if (!bridge) return;
    try {
      if (!ready()) { bridge.postMessage({ pending: true }); return; }
      bridge.postMessage(snap());
    } catch (e) {
      try { bridge.postMessage({ error: String((e && e.message) || e) }); } catch (_) {}
    }
  }

  window.__mintSnapshot = function () {
    try { return ready() ? snap() : { error: 'not-ready' }; } catch (e) { return { error: String(e) }; }
  };
  window.__mintPost = post;

  setInterval(post, 2000);
  setTimeout(post, 300);
  setTimeout(post, 1500);
  document.addEventListener('visibilitychange', post);
})();
