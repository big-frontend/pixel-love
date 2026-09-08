/**
 * game.js —— 主入口 / 编排层
 *
 * 职责边界:
 *   这里只做四件事 —— 初始化各模块、维护状态机、处理输入、驱动帧循环。
 *   具体怎么画、什么颜色、什么音效,全部委托给 src/ 下的模块:
 *
 *     src/core.js       画布/缩放/调色板/像素字体/绘制工具/存储/震动
 *     src/config.js     关卡数值、难度档位(速度/数量/轨迹)、评级、判定半径(调参入口)
 *     src/audio.js      程序化 8-bit 音效(零音频资源)
 *     src/sprites.js    掉落物精灵预烘焙(离屏贴图 + 光晕)
 *     src/entities.js   掉落物角色:红心 / 金心 / 彩虹心 / 炸弹
 *     src/fx.js         粒子 / 飘字 / 冲击波 / 涟漪 / 彩纸 / 环境装饰
 *     src/background.js 背景烘焙 / 关卡主题过渡 / 星空流星 / 地面落带
 *     src/hud.js        顶部信息栏(爱心/分数/倒计时/连击)
 *     src/screens.js    菜单(含速度/数量/轨迹档位)/ 过关面板 / 结算面板
 */
'use strict';

var Core = require('./src/core.js');
var Config = require('./src/config.js');
var Sprites = require('./src/sprites.js');
var Entities = require('./src/entities.js');
var Background = require('./src/background.js');
var HUD = require('./src/hud.js');
var Screens = require('./src/screens.js');
var FX = require('./src/fx.js');
var SFX = require('./src/audio.js');

var R = Core.R;
var STATE = Config.STATE;
var clamp = Core.clamp, lerp = Core.lerp;

/* ============================================================
 *  状态
 * ============================================================ */
var state = STATE.MENU;
var g = null;                 // 当前对局数据
var best = 0;                 // 历史最高分
var soundOn = true;           // 音效开关
var speedIdx = 0;             // 难度档位:下落速度
var densityIdx = 0;           // 难度档位:心的数量
var pathIdx = 0;              // 难度档位:移动轨迹
var paused = false;

/* 读取持久化的档位下标;缺失或非法时回落到默认值 */
function loadIdx(key, def, len) {
  var v = parseInt(Core.store.get(key, def), 10);
  if (isNaN(v)) v = def;
  return clamp(v, 0, len - 1);
}

/* ============================================================
 *  初始化
 * ============================================================ */
function boot() {
  Core.boot();
  best = Core.store.get(Config.KEYS.best, 0) || 0;
  soundOn = SFX.isOn();
  speedIdx = loadIdx(Config.KEYS.speed, Config.DEFAULT_SPEED, Config.SPEEDS.length);
  densityIdx = loadIdx(Config.KEYS.density, Config.DEFAULT_DENSITY, Config.DENSITY.length);
  pathIdx = loadIdx(Config.KEYS.path, Config.DEFAULT_PATH, Config.PATHS.length);
  Sprites.build();
  Background.init(Config.LEVELS[0].theme);
  FX.reset();
  bindInput();
  loop();
}

/* ============================================================
 *  对局与关卡流程
 * ============================================================ */
function newGame() {
  g = {
    levelIdx: 0,
    lev: Config.LEVELS[0],
    time: Config.LEVELS[0].time,
    score: 0,
    dispScore: 0,      // 平滑显示的分数
    scorePulse: 0,     // 得分脉冲
    love: 3,
    loveShake: 0,      // 爱心碎裂抖动
    combo: 0,
    comboPulse: 0,
    maxCombo: 0,
    heartSpawned: 0,   // 可接物(红心/金心/彩虹心)生成数
    heartCaught: 0,    // 接住数
    items: [],
    spawnAcc: 0,
    shake: 0,
    flashRed: 0,
    flashWhite: 0,
    sideFlash: [0, 0],
    hintT: 3.4,        // 开局提示剩余时间
    overAt: 0,
    win: false,
    newBest: false
  };
  /* 交给角色回调的能力 */
  g.loseLove = loseLove;
  g.clearBombs = clearBombs;
  g.comboMilestone = comboMilestone;
  FX.reset();
}

function startNewRun() {
  newGame();
  startLevel(0);
}

function startLevel(idx) {
  g.levelIdx = idx;
  g.lev = Config.LEVELS[idx];
  g.time = g.lev.time;
  g.combo = 0;
  g.spawnAcc = 0;
  g.items = [];
  g.shake = 0;
  g.flashRed = 0;
  g.flashWhite = 0.55;
  g.hintT = 3.4;
  g.overAt = 0;
  FX.reset();
  state = STATE.PLAY;
  Background.setTheme(g.lev.theme, idx === 0);
  SFX.start();
}

/* 本关时间到:未满 4 关 → 过关面板;打完第 4 关 → 通关结算 */
function levelTimeUp() {
  if (g.levelIdx < Config.LEVELS.length - 1) {
    g.love = Math.min(Config.MAX_LOVE, g.love + 1);   // 过关奖励一颗爱心
    g.scorePulse = 1;
    state = STATE.CLEAR;
    g.overAt = Core.now();
    FX.confetti(70);
    SFX.level();
    Core.vib('medium');
  } else {
    finishGame(true);
  }
}

/* 终结(win = true 通关 / false 心碎止步) */
function finishGame(win) {
  state = STATE.OVER;
  g.win = win;
  g.overAt = Core.now();
  if (g.score > best) {
    best = g.score;
    Core.store.set(Config.KEYS.best, best);
    g.newBest = true;
  }
  if (win) { FX.confetti(90); Core.vib('medium'); }
  SFX.over(win);
}

/* ---------- 本关难度 ----------
 * 三个维度叠加:
 *   关卡自身随时间爬升(基础值)
 * × 速度档位 SPEEDS   —— 下落多快
 * × 数量档位 DENSITY  —— 一次来多少(生成间隔 + 单侧通道上限)
 * + 轨迹档位 PATHS    —— 横向怎么飘(交给 Item.update)
 */
function diff() {
  var lev = g.lev;
  var sp = Config.SPEEDS[speedIdx];
  var dn = Config.DENSITY[densityIdx];
  var p = clamp(1 - g.time / lev.time, 0, 1);
  return {
    spawnInt: lerp(lev.spawnInt[0], lev.spawnInt[1], p) * sp.spawnMul * dn.mul,
    speed: lerp(lev.speed[0], lev.speed[1], p) * sp.mul,
    laneMax: dn.lane,
    path: Config.PATHS[pathIdx],
    bombW: lev.bombW,
    goldW: lev.goldW,
    rainbowW: lev.rainbowW
  };
}

/* ============================================================
 *  对局规则(供角色回调)
 * ============================================================ */
/* 彩虹心能力:清除全场炸弹 */
function clearBombs() {
  var n = 0;
  for (var i = 0; i < g.items.length; i++) {
    var it = g.items[i];
    if (it.bad && !it.dead) {
      it.dead = true;
      FX.burst(it.x, it.y, Core.COL.bomb, 8);
      FX.ring(it.x, it.y, R(34), Core.COL.bomb, R(2), 0.35);
      n++;
    }
  }
  if (n > 0) FX.pop(Core.W / 2, R(210), '炸弹清除 ×' + n, Core.RAINBOW[3], R(18));
}

/* 10 连击奖励 */
function comboMilestone() {
  if (g.combo > 0 && g.combo % 10 === 0) {
    if (g.love < Config.MAX_LOVE) {
      g.love++;
      FX.pop(Core.W / 2, R(170), g.combo + ' 连击! 爱心 +1', Core.COL.gold, R(19));
    } else {
      FX.pop(Core.W / 2, R(170), g.combo + ' 连击! 完美', Core.COL.gold, R(19));
    }
    g.comboPulse = 1;
    FX.ring(Core.W / 2, R(170), R(150), Core.COL.gold, R(4), 0.6);
    Core.vib('medium');
    SFX.gold();
  }
}

/* 失去一颗心(心碎) */
function loseLove() {
  g.love--;
  g.combo = 0;
  g.flashRed = Math.max(g.flashRed, 0.28);
  g.shake = Math.max(g.shake, 0.24);
  g.loveShake = 0.5;
  Core.vib('heavy');
  SFX.lose();
  if (g.love <= 0) finishGame(false);
}

/* 掉落物落地 */
function landItem(it) {
  it.dead = true;
  it.onLand(g);
}

/* ============================================================
 *  输入
 * ============================================================ */
function bindInput() {
  wx.onTouchStart(function (e) {
    var ts = (e && e.changedTouches) || (e && e.touches) || [];
    for (var i = 0; i < ts.length; i++) {
      tapAt(ts[i].clientX, ts[i].clientY);
    }
    if (!ts.length && e) tapAt(e.clientX, e.clientY);
  });
}

function tapAt(rawX, rawY) {
  /* 小游戏与浏览器的坐标都是 CSS 像素,这里统一按 Core 的坐标系处理 */
  var x = rawX, y = rawY;
  FX.ripple(x, y);

  if (state === STATE.MENU) {
    var hit = Screens.menuHit(x, y);
    if (hit === 'sound') {
      soundOn = SFX.toggle();
      SFX.tap();
      return;
    }
    /* 三个难度档位的选择器;点空白处或开始按钮才开局 */
    if (hit && hit.type === 'speed') {
      speedIdx = hit.index;
      Core.store.set(Config.KEYS.speed, speedIdx);
      SFX.tap();
      return;
    }
    if (hit && hit.type === 'density') {
      densityIdx = hit.index;
      Core.store.set(Config.KEYS.density, densityIdx);
      SFX.tap();
      return;
    }
    if (hit && hit.type === 'path') {
      pathIdx = hit.index;
      Core.store.set(Config.KEYS.path, pathIdx);
      SFX.tap();
      return;
    }
    SFX.start();
    startNewRun();
    return;
  }

  if (state === STATE.OVER) {
    if (Core.now() - g.overAt > 0.55) { SFX.tap(); startNewRun(); }
    return;
  }

  if (state === STATE.CLEAR) {
    if (Core.now() - g.overAt > 0.5) { SFX.tap(); startLevel(g.levelIdx + 1); }
    return;
  }

  if (state !== STATE.PLAY || !g) return;

  /* 命中判定:取距离最近且在判定半径内的掉落物 */
  var bestI = -1, bestD = R(Config.CATCH_R);
  for (var i = 0; i < g.items.length; i++) {
    var it = g.items[i];
    if (it.dead) continue;
    var dx = it.x - x, dy = it.y - y;
    var dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < bestD) { bestD = dd; bestI = i; }
  }
  if (bestI < 0) return;

  var hitItem = g.items[bestI];
  hitItem.dead = true;

  if (hitItem.bad) {
    /* 误点炸弹:爆炸、扣一颗心、连击清零(具体表现由 BombItem 自己负责) */
    hitItem.onCatch(g);
    loseLove();
    return;
  }

  /* 接住红心 / 金心 / 彩虹心 */
  g.score += hitItem.gain;
  g.combo++;
  g.maxCombo = Math.max(g.maxCombo, g.combo);
  g.heartCaught++;
  g.scorePulse = 1;
  g.comboPulse = Math.max(g.comboPulse, 0.6);
  g.sideFlash[hitItem.lane] = 0.34;
  hitItem.onCatch(g);
  comboMilestone();
}

/* ============================================================
 *  帧循环
 * ============================================================ */
var raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame
        : (function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); });
var lastT = 0;

function loop() {
  var n = Date.now();
  var dt = lastT ? clamp((n - lastT) / 1000, 0, 0.05) : 0.016;
  lastT = n;
  Core.setNow(n / 1000);
  if (!paused) {
    update(dt);
    render();
  }
  raf(loop);
}

function update(dt) {
  FX.stepAmbient(dt);
  Background.step(dt);
  FX.step(dt);

  if (g) {
    g.shake = Math.max(0, g.shake - dt);
    g.flashRed = Math.max(0, g.flashRed - dt);
    g.flashWhite = Math.max(0, g.flashWhite - dt);
    g.hintT = Math.max(0, g.hintT - dt);
    g.scorePulse = Math.max(0, g.scorePulse - dt * 2.6);
    g.comboPulse = Math.max(0, g.comboPulse - dt * 2.2);
    g.loveShake = Math.max(0, g.loveShake - dt);
    g.sideFlash[0] = Math.max(0, g.sideFlash[0] - dt * 1.6);
    g.sideFlash[1] = Math.max(0, g.sideFlash[1] - dt * 1.6);
    /* 分数平滑滚动 */
    if (g.dispScore !== g.score) {
      var d = g.score - g.dispScore;
      var stepD = Math.max(Math.abs(d) * 8 * dt, 0.6);
      g.dispScore += (d > 0 ? stepD : -stepD);
      if (Math.abs(g.score - g.dispScore) < 0.6) g.dispScore = g.score;
    }
  }

  if (state !== STATE.PLAY || !g) return;

  g.time -= dt;
  var d = diff();

  /* 生成(用 while 保证大 dt 下不漏生成) */
  g.spawnAcc += dt;
  while (g.spawnAcc > d.spawnInt && state === STATE.PLAY) {
    g.spawnAcc -= d.spawnInt;
    var item = Entities.spawn(g, d);
    if (item) g.items.push(item);
  }

  /* 掉落物移动与落地 */
  for (var i = g.items.length - 1; i >= 0; i--) {
    var it = g.items[i];
    if (it.dead) { g.items.splice(i, 1); continue; }
    it.update(dt);
    if (it.y >= Core.GROUND_Y && g.time > 0) landItem(it);
    /* 本帧内若已结束/过关,不再处理后续掉落物 */
    if (state !== STATE.PLAY) break;
  }

  if (g.time <= 0 && state === STATE.PLAY) levelTimeUp();
}

/* ============================================================
 *  渲染
 * ============================================================ */
function render() {
  var t = Core.now();
  var ctx = Core.ctx;

  ctx.save();
  /* 震动位移 */
  if (g && g.shake > 0) {
    var s = g.shake * 8;
    ctx.translate(Core.rnd(-s, s), Core.rnd(-s, s));
  }

  Background.draw();

  if (state === STATE.MENU) renderMenu(t);
  else if (state === STATE.PLAY) renderPlay(t);
  else if (state === STATE.CLEAR) renderClear(t);
  else renderOver(t);

  ctx.restore();

  /* 心碎红闪 */
  if (g && g.flashRed > 0) {
    ctx.fillStyle = 'rgba(255,40,70,' + (g.flashRed * 1.5).toFixed(3) + ')';
    ctx.fillRect(0, 0, Core.W, Core.H);
  }
  /* 开局/过关白闪 */
  if (g && g.flashWhite > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (g.flashWhite * 0.5).toFixed(3) + ')';
    ctx.fillRect(0, 0, Core.W, Core.H);
  }
  /* 时间告急:边缘红色脉冲 */
  if (state === STATE.PLAY && g && g.time <= 10) {
    var pulse = 0.35 + 0.35 * Math.sin(t * 9);
    var vg = ctx.createRadialGradient(
      Core.W / 2, Core.H / 2, Math.min(Core.W, Core.H) * 0.28,
      Core.W / 2, Core.H / 2, Math.max(Core.W, Core.H) * 0.62
    );
    vg.addColorStop(0, 'rgba(255,40,70,0)');
    vg.addColorStop(1, 'rgba(255,40,70,' + (pulse * 0.55).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, Core.W, Core.H);
  }
}

function renderMenu(t) {
  Background.drawAmbient(t);
  FX.draw();
  Screens.menu(t, {
    best: best,
    curLevel: 0,
    soundOn: soundOn,
    speedIdx: speedIdx,
    densityIdx: densityIdx,
    pathIdx: pathIdx
  });
}

function renderPlay(t) {
  Background.drawAmbient(t);
  Background.drawGround(t, g);
  for (var i = 0; i < g.items.length; i++) g.items[i].draw(t);
  FX.draw();
  HUD.draw(g, t);

  /* 每关开局提示 */
  if (g.hintT > 0) {
    var ctx = Core.ctx;
    var a = clamp(g.hintT / 0.6, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = '700 ' + R(17) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    var tw = ctx.measureText ? ctx.measureText(g.lev.hint).width : 0;
    Core.panel(Core.W / 2 - tw / 2 - R(18), Core.H * 0.5 - R(18), tw + R(36), R(38), R(19),
      'rgba(10,5,25,0.6)', Core.hexA(g.lev.theme.accent, 0.5));
    Core.drawText(g.lev.hint, Core.W / 2, Core.H * 0.5, R(17), Core.COL.white, 'center');
    ctx.globalAlpha = 1;
  }
}

function renderClear(t) {
  Background.drawAmbient(t);
  var ctx = Core.ctx;
  ctx.fillStyle = 'rgba(10,5,25,0.55)';
  ctx.fillRect(0, 0, Core.W, Core.H);
  FX.draw();
  Screens.clear(t, g);
}

function renderOver(t) {
  Background.drawAmbient(t);
  var ctx = Core.ctx;
  ctx.fillStyle = 'rgba(10,5,25,0.6)';
  ctx.fillRect(0, 0, Core.W, Core.H);
  FX.draw();
  Screens.over(t, g);
}

/* ============================================================
 *  生命周期:切后台自动暂停
 * ============================================================ */
if (typeof wx !== 'undefined' && wx.onShow) {
  wx.onShow(function () { paused = false; lastT = 0; });
  wx.onHide(function () { paused = true; });
}

boot();
