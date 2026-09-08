/**
 * core.js —— 运行时核心
 *   负责:主画布/缩放单位/调色板/像素字体,以及所有模块共用的绘制工具。
 *   被其他所有模块依赖,自身不依赖任何模块;需先调用 Core.boot()。
 */
(function () {
  'use strict';

  var isMiniGame = typeof wx !== 'undefined';

  /* ---------- 调色板(复古粉紫夜色) ---------- */
  var COL = {
    bgTop: '#1a0f3c',
    bgBottom: '#2a1455',
    ground: '#33205e',
    line: 'rgba(255,255,255,0.10)',
    pink: '#ff5f8f',        // 红心
    pinkHot: '#ff8fb0',
    gold: '#ffd45a',        // 金心
    bomb: '#a56bff',        // 坏心情炸弹
    bombDark: '#6f3fd6',
    danger: '#ff3b5c',
    white: '#fff4f8',
    dim: 'rgba(255,244,248,0.35)',
    text: '#ffe9f2'
  };
  /* 彩虹心用色 */
  var RAINBOW = ['#ff5f8f', '#ff9a5a', '#ffe35a', '#7fe36f', '#5ad1ff', '#c07fff'];

  /* ---------- 像素贴图 ---------- */
  var MAP_HEART = [
    '0110110',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
    '0001000'
  ];
  var MAP_BOMB = [
    '..XXXX..',
    '.XXXXXX.',
    'XXXXXXXX',
    'XXXXXXXX',
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '...XX...'
  ];
  var MAP_STAR = ['.1.', '111', '.1.'];

  /* ---------- 像素数字字体 3x5 ---------- */
  var FONT = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111']
  };

  /* ---------- 数学 / 颜色工具 ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function hex2rgb(hex) {
    var h = hex.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexA(hex, a) {
    if (hex.charAt(0) !== '#') return hex;
    var c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mixHex(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }

  /* ---------- 核心对象 ---------- */
  var _clock = 0;   // 当前游戏时间(秒),由主循环每帧写入
  var Core = {
    isMiniGame: isMiniGame,
    W: 0, H: 0, dpr: 1, UNIT: 1, SAFE_TOP: 0, GROUND_Y: 0,
    canvas: null, ctx: null,
    COL: COL, RAINBOW: RAINBOW,
    MAP_HEART: MAP_HEART, MAP_BOMB: MAP_BOMB, MAP_STAR: MAP_STAR, FONT: FONT,
    rnd: rnd, clamp: clamp, lerp: lerp, easeOut: easeOut, easeOutBack: easeOutBack,
    pick: pick, hexA: hexA, mixHex: mixHex
  };

  /* 以 390 宽为基准的缩放单位 */
  Core.R = function (v) { return Math.round(v * Core.UNIT); };

  /* 全局游戏时钟(秒):主循环每帧写入,面板动画等依赖它 */
  Core.now = function () { return _clock; };
  Core.setNow = function (v) { _clock = v; };

  /* 初始化:必须在其它模块使用前调用(主画布也由此创建) */
  Core.boot = function () {
    var sys = wx.getSystemInfoSync();
    Core.W = sys.windowWidth;
    Core.H = sys.windowHeight;
    Core.dpr = sys.pixelRatio || 1;
    Core.SAFE_TOP = (sys.safeArea && sys.safeArea.top) || sys.statusBarHeight || 18;
    Core.UNIT = Math.max(0.82, Math.min(1.18, Core.W / 390));
    Core.GROUND_Y = Core.H - Math.max(64, Core.H * 0.085);
    Core.canvas = wx.createCanvas();               // 主画布(必须是第一个创建的画布)
    Core.canvas.width = Math.round(Core.W * Core.dpr);
    Core.canvas.height = Math.round(Core.H * Core.dpr);
    Core.ctx = Core.canvas.getContext('2d');
    Core.ctx.scale(Core.dpr, Core.dpr);
    return Core;
  };

  /* ---------- 离屏画布 ---------- */
  Core.offCanvas = function (w, h) {
    var c = wx.createCanvas();
    c.width = Math.max(1, Math.round(w * Core.dpr));
    c.height = Math.max(1, Math.round(h * Core.dpr));
    var x = c.getContext('2d');
    x.scale(Core.dpr, Core.dpr);
    return { c: c, x: x, w: w, h: h };
  };

  /* ---------- 发光贴图缓存 ---------- */
  var GLOW = {};
  Core.glowCanvas = function (color) {
    if (GLOW[color]) return GLOW[color];
    var s = 96;
    var c = wx.createCanvas();
    c.width = s; c.height = s;
    var x = c.getContext('2d');
    var gd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gd.addColorStop(0, hexA(color, 0.92));
    gd.addColorStop(0.32, hexA(color, 0.42));
    gd.addColorStop(0.62, hexA(color, 0.13));
    gd.addColorStop(1, hexA(color, 0));
    x.fillStyle = gd;
    x.fillRect(0, 0, s, s);
    GLOW[color] = c;
    return c;
  };

  /* ---------- 绘制工具(均基于 Core.ctx) ---------- */
  function ctxOf() { return Core.ctx; }

  /* 往指定 context 画像素贴图 */
  Core.pixMap = function (c2, map, cx, cy, cell, color) {
    var rows = map.length, cols = map[0].length;
    var x0 = Math.round(cx - cols * cell / 2);
    var y0 = Math.round(cy - rows * cell / 2);
    c2.fillStyle = color;
    for (var r = 0; r < rows; r++) {
      var row = map[r];
      for (var c = 0; c < cols; c++) {
        var ch = row.charAt(c);
        if (ch === '1' || ch === 'X') c2.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }
  };

  Core.drawPixMap = function (cx, cy, cell, map, color) {
    Core.pixMap(ctxOf(), map, cx, cy, cell, color);
  };

  /* 光晕(与当前 globalAlpha 相乘,不破坏淡入) */
  Core.drawGlow = function (cx, cy, r, color, alpha) {
    var ctx = ctxOf();
    var prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * (alpha == null ? 1 : alpha);
    ctx.drawImage(Core.glowCanvas(color), cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = prev;
  };

  /* 贴图绘制(spr: 离屏对象) */
  Core.blit = function (spr, cx, cy, scale, alpha, rot) {
    var ctx = ctxOf();
    var w = spr.w * (scale == null ? 1 : scale);
    var h = spr.h * (scale == null ? 1 : scale);
    var prev = ctx.globalAlpha;
    if (alpha != null) ctx.globalAlpha = prev * alpha;
    if (rot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(spr.c, -w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.globalAlpha = prev;
    } else {
      ctx.drawImage(spr.c, cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = prev;
    }
  };

  Core.drawText = function (str, cx, cy, px, color, align, bold) {
    var ctx = ctxOf();
    ctx.font = (bold === false ? '400 ' : '700 ') + px + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, cx, cy);
  };

  Core.drawTextGlow = function (str, cx, cy, px, color, glow, align) {
    var ctx = ctxOf();
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + px + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    if (glow) {
      ctx.fillStyle = glow;
      ctx.fillText(str, cx, cy + Math.max(1, Core.R(1)));
      ctx.fillText(str, cx, cy - Math.max(1, Core.R(1)));
    }
    ctx.fillStyle = color;
    ctx.fillText(str, cx, cy);
  };

  Core.drawPixNum = function (str, cx, cy, cell, color, align) {
    var ctx = ctxOf();
    var tx;
    if (align === 'left') tx = cx;
    else {
      var total = str.length * 4 * cell - cell;
      tx = align === 'right' ? cx - total : cx - total / 2;
    }
    var ty = cy - cell * 2.5;
    ctx.fillStyle = color;
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str.charAt(i)];
      if (!g) { tx += 4 * cell; continue; }
      for (var r = 0; r < 5; r++) {
        var row = g[r];
        for (var c = 0; c < 3; c++) {
          if (row.charAt(c) === '1') ctx.fillRect(tx + c * cell, ty + r * cell, cell, cell);
        }
      }
      tx += 4 * cell;
    }
  };

  /* 像素数字(带阴影底) */
  Core.drawPixelText = function (str, cx, cy, cell, color, align) {
    var o = Math.max(1, Core.R(1));
    Core.drawPixNum(str, cx + o, cy + o, cell, 'rgba(12,4,26,0.5)', align);
    Core.drawPixNum(str, cx, cy, cell, color, align);
  };

  Core.rrPath = function (x, y, w, h, r) {
    var ctx = ctxOf();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  Core.panel = function (x, y, w, h, r, fill, stroke) {
    var ctx = ctxOf();
    Core.rrPath(x, y, w, h, r);
    ctx.fillStyle = fill || 'rgba(18,8,40,0.72)';
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, Core.R(1.5)); ctx.stroke(); }
  };

  /* ---------- 本地存储(带降级) ---------- */
  Core.store = {
    get: function (k, def) {
      try { var v = wx.getStorageSync(k); return v == null ? def : v; } catch (e) { return def; }
    },
    set: function (k, v) {
      try { wx.setStorageSync(k, v); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- 震动 ---------- */
  Core.vib = function (type) {
    try {
      if (isMiniGame && wx.vibrateShort) wx.vibrateShort({ type: type || 'light', fail: function () {} });
      else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === 'heavy' ? 60 : (type === 'medium' ? 25 : 10));
      }
    } catch (e) { /* ignore */ }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['core'] = Core;
})();
