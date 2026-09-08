/**
 * wx-shim.js —— 浏览器试玩适配层
 * 把微信小游戏运行时 API(wx.*)映射到浏览器 DOM,
 * 使 pixel-love/game.js 无需任何改动即可在浏览器中试玩。
 *
 * 使用方式: 在 preview.html 中先引入本文件,再引入 game.js。
 */
(function () {
  'use strict';

  if (typeof wx !== 'undefined') return; // 已存在(真机/开发者工具)则跳过

  /* ---------- CommonJS 桥接 ----------
   * 微信小游戏原生支持 require();浏览器没有,这里做一个映射:
   * src/*.js 在浏览器里执行时会把自己挂到 window.__MODS__[name],
   * require('./src/xxx.js') 直接返回它。因此各模块源码无需任何改动。 */
  window.__MODS__ = window.__MODS__ || {};
  window.require = function (path) {
    var name = String(path).replace(/^.*\//, '').replace(/\.js$/, '');
    var mod = window.__MODS__[name];
    if (!mod) throw new Error('[wx-shim] 模块未加载: ' + path + ' —— 请在 preview.html 中先引入对应 src 文件');
    return mod;
  };

  var DESIGN_W = 390;
  var DESIGN_H = 844;

  function fit() {
    var iw = window.innerWidth, ih = window.innerHeight;
    var s = Math.min(iw / DESIGN_W, ih / DESIGN_H);
    if (s <= 0) s = 1;
    return { cssW: Math.floor(DESIGN_W * s), cssH: Math.floor(DESIGN_H * s), s: s };
  }

  var mainCanvas = null;
  var extraIndex = 0;

  function applyCanvasSize(cv) {
    var f = fit();
    cv.style.width = f.cssW + 'px';
    cv.style.height = f.cssH + 'px';
    /* 只负责 CSS 尺寸适配窗口,不再把 CSS 缩放混进像素比。
       画布缓冲固定为 390x844 × devicePixelRatio,由 CSS 完成整体适配。 */
  }

  /* ---------- 触摸/鼠标事件 → wx 触控事件 ---------- */
  var startCbs = [], moveCbs = [], endCbs = [];

  function makeTouch(ev) {
    var rect = mainCanvas.getBoundingClientRect();
    var cssScale = rect.width / DESIGN_W;
    return {
      clientX: (ev.clientX - rect.left) / cssScale,
      clientY: (ev.clientY - rect.top) / cssScale
    };
  }
  function fire(list, evs) {
    var touches = evs.map(makeTouch);
    var payload = { touches: touches, changedTouches: touches };
    for (var i = 0; i < list.length; i++) list[i](payload);
  }
  function on(evName, cb) {
    if (evName === 'onTouchStart') startCbs.push(cb);
    else if (evName === 'onTouchMove') moveCbs.push(cb);
    else if (evName === 'onTouchEnd') endCbs.push(cb);
  }

  function bindInput() {
    var down = false;
    /* 真触屏设备: 用 touch 事件支持多点 */
    document.addEventListener('touchstart', function (e) {
      fire(startCbs, Array.prototype.slice.call(e.touches.length ? e.changedTouches : e.touches));
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      fire(moveCbs, Array.prototype.slice.call(e.touches));
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', function (e) {
      fire(endCbs, Array.prototype.slice.call(e.changedTouches));
      e.preventDefault();
    }, { passive: false });

    /* 桌面端: 鼠标模拟单击(便于在电脑上试玩) */
    document.addEventListener('mousedown', function (e) {
      down = true;
      fire(startCbs, [e]);
    });
    document.addEventListener('mousemove', function (e) {
      if (down) fire(moveCbs, [e]);
    });
    window.addEventListener('mouseup', function (e) {
      if (!down) return;
      down = false;
      fire(endCbs, [e]);
    });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', function () { down = false; });
  }

  function vibrateShort(opts) {
    try {
      var ms = (opts && opts.type === 'heavy') ? 60 : ((opts && opts.type === 'medium') ? 25 : 10);
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 暴露 wx 全局对象 ---------- */
  window.wx = {
    createCanvas: function () {
      if (!mainCanvas) {
        mainCanvas = document.getElementById('game');
        if (!mainCanvas) {
          mainCanvas = document.createElement('canvas');
          mainCanvas.id = 'game';
          document.body.appendChild(mainCanvas);
        }
        applyCanvasSize(mainCanvas);
        return mainCanvas;
      }
      // 离屏画布(用于背景缓存)
      var off = document.createElement('canvas');
      off.id = 'off-' + (extraIndex++);
      off.style.position = 'absolute';
      off.style.left = '-9999px';
      off.style.top = '-9999px';
      document.body.appendChild(off);
      return off;
    },
    getSystemInfoSync: function () {
      return {
        windowWidth: DESIGN_W,
        windowHeight: DESIGN_H,
        pixelRatio: (window.devicePixelRatio || 1),
        statusBarHeight: 0,
        safeArea: { top: 0, left: 0, right: DESIGN_W, bottom: DESIGN_H, width: DESIGN_W, height: DESIGN_H },
        platform: 'web-preview'
      };
    },
    onTouchStart: function (cb) { on('onTouchStart', cb); },
    onTouchMove: function (cb) { on('onTouchMove', cb); },
    onTouchEnd: function (cb) { on('onTouchEnd', cb); },
    onShow: function (cb) {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) cb();
      });
    },
    onHide: function (cb) {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) cb();
      });
    },
    vibrateShort: vibrateShort,
    getStorageSync: function (k) {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    },
    setStorageSync: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };

  function onReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { boot(); });
    } else {
      boot();
    }
  }
  function boot() {
    if (!mainCanvas) {
      mainCanvas = document.getElementById('game');
      applyCanvasSize(mainCanvas);
    }
    bindInput();
    /* 窗口尺寸变化时只同步 CSS 尺寸,绝不重置画布缓冲 */
    window.addEventListener('resize', function () {
      applyCanvasSize(mainCanvas);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
