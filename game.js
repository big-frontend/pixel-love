/**
 * ============================================================
 *  心动像素 Pixel Heart —— 情侣双人合作 · 微信小游戏
 * ============================================================
 *  玩法: 4 关连续挑战,每关难度递增、掉落物种类不同。
 *        双人同屏各守一边(左/右),用指尖接住爱心得分;
 *        千万别碰到「坏心情炸弹」。一人守左边,一人守右边,
 *        双手可同时操作(多点触控),每关限时,爱心用尽或
 *        四关全通即结算,按总分给出默契评级。
 *
 *  关卡:
 *    第 1 关 心动初识 —— 只有红心,热身上手
 *    第 2 关 甜度加倍 —— 新增金心(+3)与坏心情炸弹
 *    第 3 关 默契挑战 —— 新增彩虹心(+5,可清除全场炸弹)
 *    第 4 关 灵魂之约 —— 全掉落物,高速度高密度终极考验
 *
 *  说明: 本文件同时兼容微信小游戏运行时(wx.*)与浏览器预览
 *        (通过 preview/wx-shim.js 提供 wx 全局对象)。
 * ============================================================
 */
'use strict';

var isMiniGame = typeof wx !== 'undefined';

/* ---------- 系统信息与画布初始化 ---------- */
var sys = wx.getSystemInfoSync();
var W = sys.windowWidth;          // 逻辑宽(如 390)
var H = sys.windowHeight;         // 逻辑高(如 844)
var dpr = sys.pixelRatio || 1;    // 像素密度(预览环境下含缩放系数)
var SAFE_TOP = (sys.safeArea && sys.safeArea.top) || (sys.statusBarHeight) || 18;

var canvas = wx.createCanvas();   // 主画布(全屏)
canvas.width = Math.round(W * dpr);
canvas.height = Math.round(H * dpr);
var ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);

/* 以 390 宽为基准的缩放单位,保证不同机型下布局比例一致 */
var UNIT = Math.max(0.82, Math.min(1.18, W / 390));
function R(v) { return Math.round(v * UNIT); }          // 长度缩放
function rnd(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }

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
  white: '#fff4f8',
  dim: 'rgba(255,244,248,0.35)',
  text: '#ffe9f2'
};
/* 彩虹心用色(按像素位置循环取色) */
var RAINBOW = ['#ff5f8f', '#ff9a5a', '#ffe35a', '#7fe36f', '#5ad1ff', '#c07fff'];

/* ---------- 像素贴图 ---------- */
/* 红心 7x6 */
var MAP_HEART = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000'
];
/* 炸弹 8x8(圆滚滚的黑紫球) */
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

/* ---------- 像素数字字体 3x5(0-9) ---------- */
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

/* 绘制像素贴图: cx,cy 为中心 */
function drawPixMap(cx, cy, cell, map, color) {
  var rows = map.length, cols = map[0].length;
  var x0 = Math.round(cx - cols * cell / 2);
  var y0 = Math.round(cy - rows * cell / 2);
  ctx.fillStyle = color;
  for (var r = 0; r < rows; r++) {
    var row = map[r];
    for (var c = 0; c < cols; c++) {
      if (row.charAt(c) === '1') {
        ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }
  }
}

/* 彩虹心: 每个像素块按行列循环取彩虹色 + 四角星光 */
function drawRainbowHeart(cx, cy, cell) {
  var rows = MAP_HEART.length, cols = MAP_HEART[0].length;
  var x0 = Math.round(cx - cols * cell / 2);
  var y0 = Math.round(cy - rows * cell / 2);
  for (var r = 0; r < rows; r++) {
    var row = MAP_HEART[r];
    for (var c = 0; c < cols; c++) {
      if (row.charAt(c) === '1') {
        ctx.fillStyle = RAINBOW[(r + c) % RAINBOW.length];
        ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }
  }
  /* 星光点缀 */
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(x0 - cell, y0 - cell, Math.max(2, Math.round(cell * 0.7)), Math.max(2, Math.round(cell * 0.7)));
  ctx.fillRect(x0 + cols * cell + Math.round(cell * 0.3), y0 + rows * cell - cell, Math.max(2, Math.round(cell * 0.7)), Math.max(2, Math.round(cell * 0.7)));
  ctx.fillRect(x0 + cols * cell - cell * 2, y0 - cell, Math.max(2, Math.round(cell * 0.6)), Math.max(2, Math.round(cell * 0.6)));
}

/* 绘制像素数字文本 */
function drawPixelText(str, cx, cy, cell, color, align) {
  var tx;
  if (align === 'left') {
    tx = cx;
  } else {
    var total = str.length * 4 * cell - cell;
    tx = align === 'right' ? cx - total : cx - total / 2;
  }
  var ty = cy - cell * 2.5;
  ctx.fillStyle = color;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charAt(i);
    var g = FONT[ch];
    if (!g) continue;
    for (var r = 0; r < 5; r++) {
      var row = g[r];
      for (var c = 0; c < 3; c++) {
        if (row.charAt(c) === '1') {
          ctx.fillRect(tx + c * cell, ty + r * cell, cell, cell);
        }
      }
    }
    tx += 4 * cell;
  }
}

/* 中文字体文本 */
function drawText(str, cx, cy, px, color, align, bold) {
  ctx.font = (bold === false ? '400 ' : '700 ') + px + 'px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, cx, cy);
}

/* ---------- 背景(离屏缓存渐变,每关主题可换) ---------- */
var bgTop = COL.bgTop, bgBottom = COL.bgBottom, bgGround = COL.ground;
var bgCanvas = wx.createCanvas();
bgCanvas.width = Math.round(W * dpr);
bgCanvas.height = Math.round(H * dpr);
function buildBg() {
  var bctx = bgCanvas.getContext('2d');
  bctx.scale(dpr, dpr);
  var g = bctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bgTop);
  g.addColorStop(1, bgBottom);
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, W, H);
}
buildBg();

/* 星星(用于菜单/游戏中背景点缀) */
var stars = [];
for (var i = 0; i < 60; i++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H, r: rnd(1, 2.4), ph: Math.random() * 6.28 });
}
function drawStars(t) {
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    var a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.max(1, Math.round(s.r)), Math.max(1, Math.round(s.r)));
  }
  ctx.globalAlpha = 1;
}

/* ---------- 震动反馈(wx 真机 / 浏览器降级) ---------- */
function vib(type) {
  try {
    if (isMiniGame) {
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: type || 'light', fail: function () {} });
      }
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(type === 'heavy' ? 60 : (type === 'medium' ? 25 : 10));
    }
  } catch (e) { /* ignore */ }
}

/* ---------- 本地最高分 ---------- */
var BEST_KEY = 'pixel_heart_best';
function loadBest() {
  try { var v = wx.getStorageSync(BEST_KEY); return v || 0; } catch (e) { return 0; }
}
function saveBest(v) {
  try { wx.setStorageSync(BEST_KEY, v); } catch (e) { /* ignore */ }
}

/* ============================================================
 *  关卡配置:4 关连续挑战,难度递增,掉落物种类不同
 *    spawnInt / speed 为 [开始值, 终值](随时间在本关内爬升)
 *    bombW / goldW / rainbowW 为该物品占生成量的概率权重(红心占剩余)
 * ============================================================ */
var LEVELS = [
  {
    name: '心动初识', time: 28,
    spawnInt: [0.74, 0.56], speed: [115, 175],
    bombW: 0, goldW: 0, rainbowW: 0,
    hint: '第 1 关热身:接住红心就好!',
    theme: { top: '#3b124f', bottom: '#1d0a35', ground: '#2d1245' }
  },
  {
    name: '甜度加倍', time: 30,
    spawnInt: [0.64, 0.46], speed: [140, 225],
    bombW: 0.10, goldW: 0.10, rainbowW: 0,
    hint: '金心 +3 · 小心炸弹出没!',
    theme: { top: '#3d1052', bottom: '#240a41', ground: '#33104d' }
  },
  {
    name: '默契挑战', time: 34,
    spawnInt: [0.56, 0.40], speed: [170, 275],
    bombW: 0.18, goldW: 0.11, rainbowW: 0.045,
    hint: '彩虹心 +5,还能清除全场炸弹!',
    theme: { top: '#400f58', bottom: '#280a45', ground: '#361154' }
  },
  {
    name: '灵魂之约', time: 40,
    spawnInt: [0.52, 0.34], speed: [200, 340],
    bombW: 0.24, goldW: 0.12, rainbowW: 0.055,
    hint: '终极关卡,全力以赴!',
    theme: { top: '#430b60', bottom: '#2a0a4a', ground: '#3a1259' }
  }
];

/* ============================================================
 *  游戏状态
 * ============================================================ */
var STATE = { MENU: 0, PLAY: 1, OVER: 2, CLEAR: 3 };
var state = STATE.MENU;
var best = loadBest();

/* 游戏局数据 */
var g = null;
function newGame() {
  g = {
    levelIdx: 0,
    lev: LEVELS[0],
    time: LEVELS[0].time,
    score: 0,
    love: 3,
    combo: 0,
    maxCombo: 0,
    heartSpawned: 0,   // 可接物(红心/金心/彩虹心)生成数
    heartCaught: 0,    // 接住数
    items: [],
    parts: [],         // 粒子
    pops: [],          // 飘字
    spawnAcc: 0,
    shake: 0,
    flashRed: 0,
    hintT: 3.4,
    overAt: 0,
    win: false,
    newBest: false
  };
}

/* ---------- 布局常量 ---------- */
var MAX_LOVE = 5;                    // 爱心上限
var GROUND_Y = H - Math.max(64, H * 0.085);   // 落地判定线
var CATCH_R = function () { return R(56); };  // 点击判定半径

/* ---------- 关卡切换 ---------- */
function startNewRun() {
  newGame();
  startLevel(0);
}
function startLevel(idx) {
  g.levelIdx = idx;
  g.lev = LEVELS[idx];
  g.time = g.lev.time;
  g.combo = 0;
  g.spawnAcc = 0;
  g.items = [];
  g.pops = [];
  g.parts = [];
  g.shake = 0;
  g.flashRed = 0;
  g.hintT = 3.4;
  g.overAt = 0;
  state = STATE.PLAY;
  /* 切换本关主题背景 */
  bgTop = g.lev.theme.top;
  bgBottom = g.lev.theme.bottom;
  bgGround = g.lev.theme.ground;
  buildBg();
}
/* 本关时间到:未满 4 关 → 过关面板;打完第 4 关 → 通关结算 */
function levelTimeUp() {
  if (g.levelIdx < LEVELS.length - 1) {
    g.love = Math.min(MAX_LOVE, g.love + 1);   // 过关奖励一颗爱心
    state = STATE.CLEAR;
    g.overAt = nowT;
  } else {
    finishGame(true);
  }
}
/* 终结(win=true 通关 / false 心碎止步) */
function finishGame(win) {
  state = STATE.OVER;
  g.win = win;
  g.overAt = nowT;
  if (g.score > best) {
    best = g.score;
    saveBest(best);
    g.newBest = true;
  }
}

/* ---------- 本关难度(随时间在本关内爬升) ---------- */
function diff() {
  var lev = g.lev;
  var p = clamp(1 - g.time / lev.time, 0, 1);
  return {
    spawnInt: lerp(lev.spawnInt[0], lev.spawnInt[1], p),  // 生成间隔(两带合计)
    speed: lerp(lev.speed[0], lev.speed[1], p),           // 下落速度 px/s
    bombW: lev.bombW,
    goldW: lev.goldW,
    rainbowW: lev.rainbowW
  };
}

/* ---------- 生成一个掉落物 ---------- */
function spawnItem() {
  var cnt = [0, 0];
  for (var i = 0; i < g.items.length; i++) cnt[g.items[i].lane]++;
  var lane = cnt[0] <= cnt[1] ? 0 : 1;
  if (cnt[lane] >= 3) return;

  var d = diff();
  var roll = Math.random();
  var type = 'heart';
  if (roll < d.bombW) type = 'bomb';
  else if (roll < d.bombW + d.goldW) type = 'gold';
  else if (roll < d.bombW + d.goldW + d.rainbowW) type = 'rainbow';

  var laneW = W / 2;
  var x = lane * laneW + laneW * rnd(0.32, 0.68);
  g.items.push({
    lane: lane,
    x: x,
    y: -R(30),
    v: d.speed * rnd(0.9, 1.15),
    type: type,
    w: rnd(0, 6.28),        // 摇摆相位
    dead: false
  });
  if (type !== 'bomb') g.heartSpawned++;
}

/* ---------- 掉落物落地 ---------- */
function landItem(it) {
  it.dead = true;
  if (it.type === 'bomb') {
    /* 炸弹没被点,安全落地,但连击清零 */
    g.combo = 0;
    burst(it.x, it.y, COL.bomb, 10);
  } else {
    /* 红心/金心/彩虹心落地未接住:心碎 */
    burst(it.x, it.y, it.type === 'gold' ? COL.gold : (it.type === 'rainbow' ? RAINBOW[3] : COL.pink), 8);
    loseLove();
  }
}

/* 彩虹心能力:清除全场炸弹 */
function clearBombs() {
  var n = 0;
  for (var i = 0; i < g.items.length; i++) {
    var it = g.items[i];
    if (it.type === 'bomb' && !it.dead) {
      it.dead = true;
      burst(it.x, it.y, COL.bomb, 6);
      n++;
    }
  }
  if (n > 0) pop(W / 2, R(210), '炸弹清除 ×' + n, RAINBOW[3], R(18));
}

/* 10 连击奖励 */
function comboMilestone() {
  if (g.combo > 0 && g.combo % 10 === 0) {
    if (g.love < MAX_LOVE) {
      g.love++;
      pop(W / 2, R(170), g.combo + ' 连击! 爱心 +1', COL.gold, R(19));
    } else {
      pop(W / 2, R(170), g.combo + ' 连击! 完美', COL.gold, R(19));
    }
    vib('medium');
  }
}

/* ---------- 点击判定 ---------- */
function tapAt(x, y) {
  if (state === STATE.MENU) {
    startNewRun();
    return;
  }
  if (state === STATE.OVER) {
    if (nowT - g.overAt > 0.55) startNewRun();
    return;
  }
  if (state === STATE.CLEAR) {
    if (nowT - g.overAt > 0.5) startLevel(g.levelIdx + 1);
    return;
  }
  if (state !== STATE.PLAY || !g) return;

  var bestI = -1, bestD = CATCH_R();
  for (var i = 0; i < g.items.length; i++) {
    var it = g.items[i];
    if (it.dead) continue;
    var dx = it.x - x, dy = it.y - y;
    var dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < bestD) { bestD = dd; bestI = i; }
  }
  if (bestI < 0) return;
  var hit = g.items[bestI];
  hit.dead = true;

  if (hit.type === 'bomb') {
    /* 误点炸弹: 爆炸,扣一颗心,连击清零 */
    burst(hit.x, hit.y, COL.bomb, 18);
    burst(hit.x, hit.y, COL.bombDark, 10);
    pop(hit.x, hit.y - R(30), '别碰炸弹!', COL.bomb, R(15));
    g.combo = 0;
    g.shake = Math.max(g.shake, 0.3);
    vib('heavy');
    loseLove();
    return;
  }

  /* 接住红心 / 金心 / 彩虹心 */
  var gain = hit.type === 'gold' ? 3 : (hit.type === 'rainbow' ? 5 : 1);
  var col = hit.type === 'gold' ? COL.gold : (hit.type === 'rainbow' ? RAINBOW[2] : COL.pink);
  var txtCol = hit.type === 'gold' ? COL.gold : (hit.type === 'rainbow' ? RAINBOW[1] : COL.pinkHot);
  g.score += gain;
  g.combo++;
  g.maxCombo = Math.max(g.maxCombo, g.combo);
  g.heartCaught++;
  if (hit.type === 'rainbow') {
    /* 彩虹心: 多彩爆花 + 清炸弹 */
    burstPal(hit.x, hit.y, RAINBOW, 14);
    burst(hit.x, hit.y, '#ffffff', 6);
    vib('medium');
    clearBombs();
  } else {
    burst(hit.x, hit.y, col, 10);
    vib('light');
  }
  pop(hit.x, hit.y, '+' + gain, txtCol, R(16));
  comboMilestone();
}

/* 失去一颗心(心碎) */
function loseLove() {
  g.love--;
  g.combo = 0;
  g.flashRed = 0.28;
  g.shake = Math.max(g.shake, 0.22);
  vib('heavy');
  if (g.love <= 0) finishGame(false);
}

/* ---------- 粒子 / 飘字 ---------- */
function burst(x, y, color, n) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.28, sp = rnd(30, 160);
    g.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rnd(0.3, 0.6), t: 0, size: rnd(2, 4), color: color });
  }
}
function burstPal(x, y, pal, n) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.28, sp = rnd(30, 170);
    g.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rnd(0.3, 0.65), t: 0, size: rnd(2, 4), color: pal[(Math.random() * pal.length) | 0] });
  }
}
function pop(x, y, text, color, px) {
  g.pops.push({ x: x, y: y, text: text, color: color, px: px, t: 0, life: 0.9 });
}

/* ============================================================
 *  帧循环
 * ============================================================ */
var raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame
        : (function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); });
var hidden = false;
var lastT = Date.now();
var nowT = Date.now() / 1000;

function loop() {
  var n = Date.now();
  var dt = clamp((n - lastT) / 1000, 0, 0.05);
  lastT = n;
  nowT = n / 1000;
  if (!hidden) {
    update(dt);
    render();
  }
  raf(loop);
}

/* ---------- 更新 ---------- */
function update(dt) {
  if (g) {
    g.shake = Math.max(0, g.shake - dt);
    g.flashRed = Math.max(0, g.flashRed - dt);
    g.hintT = Math.max(0, g.hintT - dt);
  }

  if (state === STATE.PLAY && g) {
    g.time -= dt;
    var d = diff();

    /* 生成 */
    g.spawnAcc += dt;
    while (g.spawnAcc > d.spawnInt && state === STATE.PLAY) {
      g.spawnAcc -= d.spawnInt;
      spawnItem();
    }

    /* 掉落物移动 */
    for (var i = g.items.length - 1; i >= 0; i--) {
      var it = g.items[i];
      if (it.dead) { g.items.splice(i, 1); continue; }
      it.w += dt * 3;
      it.y += it.v * dt;
      it.x += Math.sin(it.w) * 0.4;
      if (it.y >= GROUND_Y && g.time > 0) landItem(it);
      /* 本帧内若已结束/过关,不再处理后续掉落物 */
      if (state !== STATE.PLAY) break;
    }

    /* 粒子/飘字 */
    stepFx(dt);

    if (g.time <= 0 && state === STATE.PLAY) levelTimeUp();
  } else if (g) {
    stepFx(dt);
  }
}

function stepFx(dt) {
  if (!g) return;
  for (var i = g.parts.length - 1; i >= 0; i--) {
    var p = g.parts[i];
    p.t += dt;
    if (p.t > p.life) { g.parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
  }
  for (var j = g.pops.length - 1; j >= 0; j--) {
    var q = g.pops[j];
    q.t += dt;
    if (q.t > q.life) { g.pops.splice(j, 1); continue; }
    q.y -= 46 * dt;
  }
}

/* ============================================================
 *  渲染
 * ============================================================ */
function render() {
  var t = nowT;

  ctx.save();
  /* 震动位移 */
  if (g && g.shake > 0) {
    var s = g.shake * 7;
    ctx.translate(rnd(-s, s), rnd(-s, s));
  }

  /* 背景 */
  ctx.drawImage(bgCanvas, 0, 0, W, H);

  if (state === STATE.MENU) renderMenu(t);
  else if (state === STATE.PLAY) renderPlay(t);
  else if (state === STATE.CLEAR) renderClear(t);
  else renderOver(t);

  ctx.restore();

  /* 心碎红闪 */
  if (g && g.flashRed > 0) {
    ctx.fillStyle = 'rgba(255,40,70,' + (g.flashRed * 1.6).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* 画地面区(两条落带的分隔提示) */
function drawGround() {
  ctx.fillStyle = bgGround;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = COL.line;
  ctx.fillRect(0, GROUND_Y, W, 2);
  /* 中缝 */
  var cy = GROUND_Y + (H - GROUND_Y) / 2;
  ctx.fillStyle = COL.line;
  for (var y = GROUND_Y + 6; y < H; y += 12) ctx.fillRect(W / 2 - 1, y, 2, 6);
  /* 左右玩家提示 */
  drawText('你 守 左 边', W * 0.25, cy, R(13), 'rgba(255,255,255,0.45)', 'center', false);
  drawText('TA 守 右 边', W * 0.75, cy, R(13), 'rgba(255,255,255,0.45)', 'center', false);
}

/* 顶部 HUD */
function drawHud() {
  var y = SAFE_TOP + R(14);
  /* 爱心 */
  for (var i = 0; i < MAX_LOVE; i++) {
    var hx = R(22) + i * R(34);
    var on = i < g.love;
    drawPixMap(hx, y, R(4), MAP_HEART, on ? COL.pink : 'rgba(255,255,255,0.14)');
  }
  /* 分数(右上) */
  drawPixelText(String(g.score), W - R(14), y + R(1), R(5), COL.gold, 'right');
  /* 倒计时(顶部中间) */
  var sec = Math.max(0, Math.ceil(g.time));
  drawPixelText(String(sec), W / 2, y + R(1), R(6), sec <= 10 ? '#ff7a5c' : COL.white, 'center');
  /* 当前关卡(计时下方小字) */
  drawText('第 ' + (g.levelIdx + 1) + ' / 4 关 · ' + g.lev.name, W / 2, y + R(38), R(13), 'rgba(255,255,255,0.5)', 'center', false);
}

/* ---------- 菜单 ---------- */
function renderMenu(t) {
  drawStars(t);
  var bob = Math.sin(t * 2) * R(6);
  drawPixMap(W / 2, H * 0.26 + bob, R(9), MAP_HEART, COL.pink);
  drawPixMap(W / 2, H * 0.26 + bob - R(4), R(3), MAP_HEART, COL.pinkHot);

  drawText('心 动 像 素', W / 2, H * 0.46, R(40), COL.text, 'center');
  drawText('PIXEL  HEART', W / 2, H * 0.46 + R(34), R(14), COL.pinkHot, 'center', false);

  var tips = [
    '4 关连续挑战 · 难度与掉落物逐关升级',
    '你守左边 · TA 守右边 · 双手可同时操作',
    '红心 +1 · 金心 +3 · 彩虹心 +5 清炸弹',
    '坏心情炸弹千万别点 · 误点爆炸扣爱心',
    '每 10 连击 / 每过一关,爱心 +1'
  ];
  var ty = H * 0.62;
  for (var i = 0; i < tips.length; i++) {
    drawText(tips[i], W / 2, ty + i * R(34), R(15), i === 3 ? '#c9a4ff' : 'rgba(255,255,255,0.72)', 'center', false);
  }

  /* 关卡一览 */
  var lvY = H * 0.62 + tips.length * R(34) + R(8);
  var names = ['心动初识', '甜度加倍', '默契挑战', '灵魂之约'];
  var curLevel = (g ? g.levelIdx : 0) + 1;
  for (var k = 0; k < 4; k++) {
    drawPixMap(W * (0.20 + k * 0.20), lvY, R(3), MAP_HEART, k < curLevel ? RAINBOW[(k * 3) % RAINBOW.length] : 'rgba(255,255,255,0.18)');
    drawText(String(k + 1), W * (0.20 + k * 0.20), lvY + R(22), R(12), 'rgba(255,255,255,0.55)', 'center', false);
  }
  drawText(names.join(' · '), W / 2, lvY + R(44), R(12), 'rgba(255,255,255,0.4)', 'center', false);

  if (best > 0) drawText('历史最高 · ' + best, W / 2, H * 0.845, R(16), COL.gold, 'center');

  var blink = Math.floor(t * 2) % 2 === 0;
  if (blink) drawText('▶ 点击屏幕任意处开始 ◀', W / 2, H * 0.92, R(20), COL.text, 'center');
}

/* ---------- 游戏中 ---------- */
function renderPlay(t) {
  drawStars(t);
  drawGround();
  drawHud();

  /* 掉落物 */
  for (var i = 0; i < g.items.length; i++) {
    var it = g.items[i];
    var cell = R(5);
    if (it.type === 'heart') {
      drawPixMap(it.x, it.y, cell, MAP_HEART, COL.pink);
      drawPixMap(it.x - cell, it.y - cell, Math.max(1, Math.round(cell * 0.5)), MAP_HEART, COL.pinkHot);
    } else if (it.type === 'gold') {
      var s = 1 + 0.12 * Math.sin(it.w * 3);
      drawPixMap(it.x, it.y, Math.round(cell * s), MAP_HEART, COL.gold);
    } else if (it.type === 'rainbow') {
      drawRainbowHeart(it.x, it.y, Math.max(1, Math.round(cell * 0.94)));
    } else {
      drawPixMap(it.x, it.y, cell, MAP_BOMB, COL.bombDark);
      drawPixMap(it.x, it.y, Math.round(cell * 0.82), MAP_BOMB, COL.bomb);
      /* 引线火花 */
      ctx.fillStyle = COL.gold;
      ctx.fillRect(it.x - cell, it.y - cell * 3, cell, cell);
    }
  }

  /* 粒子 */
  for (var p = 0; p < g.parts.length; p++) {
    var pt = g.parts[p];
    ctx.globalAlpha = clamp(1 - pt.t / pt.life, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, Math.round(pt.size), Math.round(pt.size));
  }
  ctx.globalAlpha = 1;

  /* 飘字 */
  for (var q = 0; q < g.pops.length; q++) {
    var po = g.pops[q];
    ctx.globalAlpha = clamp(1 - po.t / po.life, 0, 1);
    drawText(po.text, po.x, po.y, po.px, po.color, 'center', true);
  }
  ctx.globalAlpha = 1;

  /* 连击提示 */
  if (g.combo >= 5) {
    drawText('❤ ' + g.combo + ' 连击', W / 2, SAFE_TOP + R(104), R(22), COL.gold, 'center');
  }

  /* 每关开局提示 */
  if (g.hintT > 0) {
    var a = clamp(g.hintT / 0.6, 0, 1);
    ctx.globalAlpha = a;
    /* 提示文字加一个半透明底条,保证可读 */
    ctx.font = '700 ' + R(18) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    var tw = ctx.measureText ? ctx.measureText(g.lev.hint).width : 0;
    ctx.fillStyle = 'rgba(10,5,25,0.55)';
    ctx.fillRect(W / 2 - tw / 2 - R(14), H * 0.5 - R(16), tw + R(28), R(34));
    drawText(g.lev.hint, W / 2, H * 0.5, R(18), COL.white, 'center');
    ctx.globalAlpha = 1;
  }
}

/* ---------- 过关面板(第 1~3 关之间) ---------- */
function renderClear(t) {
  drawStars(t);
  ctx.fillStyle = 'rgba(10,5,25,0.6)';
  ctx.fillRect(0, 0, W, H);

  drawText('第 ' + (g.levelIdx + 1) + ' 关 通 关!', W / 2, H * 0.30, R(30), COL.gold, 'center');
  drawText('「' + g.lev.name + '」完成', W / 2, H * 0.30 + R(40), R(16), 'rgba(255,255,255,0.7)', 'center', false);

  /* 关卡进度点 */
  var cy = H * 0.44;
  for (var k = 0; k < 4; k++) {
    var cx = W / 2 - R(66) + k * R(44);
    drawPixMap(cx, cy, R(4), MAP_HEART, k <= g.levelIdx ? RAINBOW[(k * 3) % RAINBOW.length] : 'rgba(255,255,255,0.18)');
  }

  drawText('累计得分 ' + g.score + ' · 剩余爱心 ' + g.love, W / 2, H * 0.56, R(17), COL.text, 'center', false);
  drawText('通关奖励:爱心 +1,继续出发', W / 2, H * 0.56 + R(34), R(14), COL.dim, 'center', false);

  var blink = Math.floor(t * 2) % 2 === 0;
  if (blink) drawText('▶ 点击进入第 ' + (g.levelIdx + 2) + ' 关 ◀', W / 2, H * 0.78, R(20), COL.pinkHot, 'center');
}

/* ---------- 结算(通关 / 心碎止步) ---------- */
var RANKS = [
  { min: 210, t: '灵魂伴侣 S', q: '四关圆满,你们的默契连像素都心动' },
  { min: 150, t: '心动大师 A', q: '两颗心,始终同频' },
  { min: 95,  t: '甜蜜恋人 B', q: '爱要及时,也要默契' },
  { min: 50,  t: '默契新人 C', q: '再多练几次,默契加倍' },
  { min: 0,   t: '心跳练习生 D', q: '没关系,在一起就已是满分' }
];
function getRank(score) {
  for (var i = 0; i < RANKS.length; i++) {
    if (score >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[RANKS.length - 1];
}

function renderOver(t) {
  drawStars(t);
  ctx.fillStyle = 'rgba(10,5,25,0.55)';
  ctx.fillRect(0, 0, W, H);

  var rk = getRank(g.score);
  /* 标题:通关 / 止步 */
  drawText(g.win ? '全 部 通 关' : '心 碎 了', W / 2, H * 0.14, R(30), g.win ? COL.gold : COL.dim, 'center');
  drawText(
    g.win ? '4 关全通 · 默契满分' : ('闯到第 ' + (g.levelIdx + 1) + ' 关 · 下次一定!'),
    W / 2, H * 0.14 + R(32), R(15), 'rgba(255,255,255,0.55)', 'center', false
  );

  /* 得分 */
  drawPixelText(String(g.score), W / 2, H * 0.31, R(14), COL.gold, 'center');
  drawText('总得分', W / 2, H * 0.31 + R(34), R(14), 'rgba(255,255,255,0.6)', 'center', false);

  drawPixMap(W / 2, H * 0.47, R(6), MAP_HEART, g.win ? RAINBOW[2] : COL.pink);
  drawText(rk.t, W / 2, H * 0.55, R(30), COL.pinkHot, 'center');
  drawText('“' + rk.q + '”', W / 2, H * 0.555 + R(26), R(15), 'rgba(255,255,255,0.75)', 'center', false);

  /* 数据 */
  var rate = g.heartSpawned > 0 ? Math.round(g.heartCaught / g.heartSpawned * 100) : 0;
  var line2 = '最高连击 ' + g.maxCombo + '   命中率 ' + rate + '%';
  drawText(line2, W / 2, H * 0.68, R(16), COL.text, 'center', false);

  if (g.newBest) drawText('★ 新纪录! ★', W / 2, H * 0.74, R(18), COL.gold, 'center');

  var blink = Math.floor(t * 2) % 2 === 0;
  if (blink) drawText('▶ 点击任意处 · 再来一局 ◀', W / 2, H * 0.86, R(20), COL.text, 'center');
}

/* ============================================================
 *  输入(wx 多点触控)
 * ============================================================ */
wx.onTouchStart(function (e) {
  if (!e.changedTouches) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    var tc = e.changedTouches[i];
    tapAt(tc.clientX, tc.clientY);
  }
});

/* ---------- 前后台切换时暂停 ---------- */
if (wx.onShow) wx.onShow(function () { hidden = false; lastT = Date.now(); });
if (wx.onHide) wx.onHide(function () { hidden = true; });

/* 启动 */
loop();
