/**
 * screens.js —— 各个界面
 *   菜单(含音效开关与下落速度档位选择)、过关面板、结算面板。
 *   面板自带弹性入场动画;菜单按钮的命中区域由 menuHit() 暴露给 game.js。
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var Config = require('./config.js');
  var Sprites = require('./sprites.js');
  var FX = require('./fx.js');
  var R = Core.R, COL = Core.COL, RAINBOW = Core.RAINBOW;

  var Screens = {};
  /* 菜单交互区域(绘制时更新) */
  var ui = {
    sound: { x: 0, y: 0, r: 0 },
    groups: { speed: [], density: [], path: [] }
  };

  /* ---------- 小工具 ---------- */
  function drawSoundBtn(t, soundOn) {
    var x = Core.W - R(28), y = Core.SAFE_TOP + R(24), r = R(17);
    ui.sound.x = x; ui.sound.y = y; ui.sound.r = r + R(8);
    var ctx = Core.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = Core.hexA(soundOn ? COL.pinkHot : '#ffffff', 0.45);
    ctx.lineWidth = Math.max(1, R(1.5));
    ctx.stroke();
    var c = Math.max(2, R(2.6));
    ctx.fillStyle = soundOn ? COL.pinkHot : 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - c * 2.4, y - c * 0.5, c, c);
    ctx.fillRect(x - c * 1.4, y - c * 1.5, c, c * 3);
    ctx.fillRect(x - c * 1.4, y - c * 2.5, c, c);
    ctx.fillRect(x - c * 1.4, y + c * 1.5, c, c);
    if (soundOn) {
      ctx.fillRect(x + c * 0.6, y - c * 0.5, c, c);
      ctx.fillRect(x + c * 1.8, y - c * 1.5, c, c * 3);
    } else {
      ctx.fillRect(x + c * 0.4, y - c * 0.5, c * 3, c * 0.9);
    }
    Core.drawText(soundOn ? '音效开' : '音效关', x - R(2), y + r + R(12), R(10), 'rgba(255,255,255,0.4)', 'center', false);
  }

  /* 通用档位选择器:把按钮矩形记进 store,供 menuHit 命中测试 */
  function drawPicker(list, idx, y, store, h) {
    var ctx = Core.ctx, W = Core.W;
    var pad = R(24), gap = R(8);
    var bw = (W - pad * 2 - gap * (list.length - 1)) / list.length;
    var bh = h;
    for (var i = 0; i < list.length; i++) {
      var x = pad + i * (bw + gap);
      var on = i === idx;
      store[i] = { x: x, y: y, w: bw, h: bh };
      if (on) {
        var g = ctx.createLinearGradient(x, y, x + bw, y + bh);
        g.addColorStop(0, Core.hexA(COL.pink, 0.92));
        g.addColorStop(1, Core.hexA('#c07fff', 0.92));
        Core.panel(x, y, bw, bh, R(12), g, 'rgba(255,255,255,0.6)');
      } else {
        Core.panel(x, y, bw, bh, R(12), 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.22)');
      }
      Core.drawText(list[i].name, x + bw / 2, y + bh / 2, R(13),
        on ? '#ffffff' : 'rgba(255,255,255,0.55)', 'center');
    }
  }

  /* ---------- 菜单 ---------- */
  Screens.menu = function (t, opt) {
    var W = Core.W, H = Core.H;
    var best = opt.best, curLevel = opt.curLevel, soundOn = opt.soundOn;
    var speedIdx = opt.speedIdx, densityIdx = opt.densityIdx, pathIdx = opt.pathIdx;

    drawSoundBtn(t, soundOn);

    /* ---------- 自适应布局 ----------
     * 先把内容按理想间距量一遍,屏幕不够高就整体压缩间距;
     * 压缩过头再依次砍掉次要提示行,保证任何机型都不重叠。 */
    var tips = [
      '4 关连续挑战 · 难度与掉落物逐关升级',
      '你守左边 · TA 守右边 · 双手可同时操作',
      '红心 +1 · 金心 +3 · 彩虹心 +5 清炸弹',
      '坏心情炸弹千万别点 · 误点爆炸扣爱心',
      '每 10 连击 / 每过一关,爱心 +1'
    ];
    var HEAD = R(196), TIP = R(28), LV = R(58), ROW = R(64), GAP = R(22);
    var PICK = R(36), BEST = R(30), BTN = R(56);
    var top = Core.SAFE_TOP + R(16), bottom = H - R(30);
    var avail = bottom - top;
    var u = 1, total = 0;
    for (;;) {
      total = HEAD + tips.length * TIP + GAP + LV + GAP
            + (ROW * 2 + R(18) + PICK) + R(24) + BEST + R(28) + BTN;
      u = Math.min(1, avail / total);
      if (u >= 0.82 || tips.length <= 3) break;
      tips.pop();                       // 实在放不下就少一行提示
    }
    var y = top + Math.max(0, (avail - total * u) / 2);

    /* 标题爱心 */
    var heartY = y + HEAD * u * 0.46;
    var bob = Math.sin(t * 2) * R(8);
    var pulse = 1 + 0.06 * Math.sin(t * 3);
    Core.drawGlow(W / 2, heartY + bob, R(120) * pulse, COL.pink, 0.42);
    Core.blit(Sprites.heart, W / 2, heartY + bob, 1.5 * pulse, 1, Math.sin(t * 1.2) * 0.12);

    y += HEAD * u;
    Core.drawTextGlow('心 动 像 素', W / 2, y - R(24) * u, R(38), COL.text, Core.hexA(COL.pink, 0.55), 'center');
    Core.drawText('P I X E L   H E A R T', W / 2, y - R(24) * u + R(26), R(12), COL.pinkHot, 'center', false);

    /* 玩法提示 */
    for (var i = 0; i < tips.length; i++) {
      y += TIP * u;
      Core.drawText(tips[i], W / 2, y, R(13),
        i === 3 ? '#c9a4ff' : 'rgba(255,255,255,0.72)', 'center', false);
    }

    /* 关卡一览 */
    y += GAP * u + R(6) * u;
    var lvY = y;
    var names = ['心动初识', '甜度加倍', '默契挑战', '灵魂之约'];
    for (var k = 0; k < 4; k++) {
      var cx = W * (0.20 + k * 0.20);
      Core.drawPixMap(cx, lvY, R(3), Core.MAP_HEART, k < curLevel ? RAINBOW[(k * 3) % RAINBOW.length] : 'rgba(255,255,255,0.18)');
      Core.drawText(String(k + 1), cx, lvY + R(18), R(11), 'rgba(255,255,255,0.5)', 'center', false);
    }
    y = lvY + R(30);
    Core.drawText(names.join(' · '), W / 2, y, R(11), 'rgba(255,255,255,0.38)', 'center', false);

    /* ---------- 三档难度 ---------- */
    y += GAP * u;
    var rows = [
      {
        key: 'speed', list: Config.SPEEDS, idx: speedIdx,
        label: '下落速度 · 当前「' + Config.SPEEDS[speedIdx].name + ' ×' + Config.SPEEDS[speedIdx].mul.toFixed(2) + '」'
      },
      {
        key: 'density', list: Config.DENSITY, idx: densityIdx,
        label: '心的数量 · 当前「' + Config.DENSITY[densityIdx].name + '」单侧最多 ' + Config.DENSITY[densityIdx].lane + ' 个'
      },
      {
        key: 'path', list: Config.PATHS, idx: pathIdx,
        label: '移动轨迹 · 当前「' + Config.PATHS[pathIdx].name + '」' + Config.PATHS[pathIdx].desc
      }
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      Core.drawText(row.label, W / 2, y, R(12), 'rgba(255,255,255,0.6)', 'center', false);
      drawPicker(row.list, row.idx, y + R(18) * u, ui.groups[row.key], PICK * u);
      y += ROW * u;
    }
    y += (R(18) + PICK) * u - ROW * u;   // 末行高度补偿

    /* 历史最高 */
    y += R(24) * u;
    var bestY = y;
    if (best > 0) {
      Core.drawTextGlow('历史最高 · ' + best, W / 2, bestY, R(16), COL.gold, 'rgba(255,180,60,0.35)', 'center');
    }

    /* 开始按钮 */
    y += R(28) * u;
    var btnW = W - R(96), btnH = BTN * u;
    var bx = R(48), by = y;
    var pulseB = 0.5 + 0.5 * Math.sin(t * 3);
    var ctx = Core.ctx;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * pulseB;
    Core.drawGlow(W / 2, by + btnH / 2, R(120), COL.pink, 0.5);
    ctx.restore();
    var bg = ctx.createLinearGradient(bx, by, bx + btnW, by + btnH);
    bg.addColorStop(0, Core.hexA(COL.pink, 0.9));
    bg.addColorStop(1, Core.hexA('#c07fff', 0.9));
    Core.panel(bx, by, btnW, btnH, R(26), bg, 'rgba(255,255,255,0.55)');
    Core.drawText('▶  开 始 游 戏  ◀', W / 2, by + btnH / 2, R(19), '#ffffff', 'center');
  };

  /* 菜单点击命中:返回 'sound' | {type:'speed'|'density'|'path', index} | null(其余区域即开始游戏) */
  Screens.menuHit = function (x, y) {
    var dx = x - ui.sound.x, dy = y - ui.sound.y;
    if (dx * dx + dy * dy < ui.sound.r * ui.sound.r) return 'sound';
    var keys = ['speed', 'density', 'path'];
    for (var k = 0; k < keys.length; k++) {
      var list = ui.groups[keys[k]];
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s) continue;
        if (x >= s.x - R(4) && x <= s.x + s.w + R(4) && y >= s.y - R(6) && y <= s.y + s.h + R(6)) {
          return { type: keys[k], index: i };
        }
      }
    }
    return null;
  };

  /* ---------- 过关面板 ---------- */
  Screens.clear = function (t, g) {
    var ctx = Core.ctx, W = Core.W, H = Core.H;
    var e = Core.clamp((Core.now() - g.overAt) / 0.5, 0, 1);
    var sc = 0.8 + 0.2 * Core.easeOutBack(e);
    ctx.save();
    ctx.globalAlpha = Core.easeOut(e);
    ctx.translate(W / 2, H * 0.46);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H * 0.46);

    var pw = W - R(56), ph = R(250), px = R(28), py = H * 0.46 - ph / 2;
    Core.panel(px, py, pw, ph, R(22), 'rgba(24,10,52,0.86)', Core.hexA(g.lev.theme.accent, 0.65));

    Core.drawGlow(W / 2, py + R(46), R(70), COL.gold, 0.5);
    Core.drawTextGlow('第 ' + (g.levelIdx + 1) + ' 关 通 关!', W / 2, py + R(46), R(28), COL.gold, 'rgba(255,190,60,0.5)', 'center');
    Core.drawText('「' + g.lev.name + '」完成', W / 2, py + R(78), R(15), 'rgba(255,255,255,0.7)', 'center', false);

    var cy = py + R(118);
    for (var k = 0; k < 4; k++) {
      var cx = W / 2 - R(66) + k * R(44);
      var on = k <= g.levelIdx;
      if (on) Core.drawGlow(cx, cy, R(20), RAINBOW[(k * 3) % RAINBOW.length], 0.5);
      Core.drawPixMap(cx, cy, R(4), Core.MAP_HEART, on ? RAINBOW[(k * 3) % RAINBOW.length] : 'rgba(255,255,255,0.18)');
      Core.drawText(String(k + 1), cx, cy + R(20), R(10), 'rgba(255,255,255,0.5)', 'center', false);
    }

    Core.drawText('累计得分 ' + g.score + ' · 剩余爱心 ' + g.love, W / 2, py + R(166), R(16), COL.text, 'center', false);
    Core.drawText('通关奖励:爱心 +1,继续出发', W / 2, py + R(196), R(13), COL.dim, 'center', false);
    ctx.restore();

    var blink = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.globalAlpha = 0.45 + 0.55 * blink;
    Core.drawTextGlow('▶ 点击进入第 ' + (g.levelIdx + 2) + ' 关 ◀', W / 2, py + ph + R(40), R(19), COL.pinkHot, Core.hexA(COL.pink, 0.4), 'center');
    ctx.globalAlpha = 1;
  };

  /* ---------- 结算 ---------- */
  Screens.over = function (t, g) {
    var ctx = Core.ctx, W = Core.W, H = Core.H;
    var rk = Config.getRank(g.score);
    var e = Core.clamp((Core.now() - g.overAt) / 0.55, 0, 1);
    var sc = 0.82 + 0.18 * Core.easeOutBack(e);
    ctx.save();
    ctx.globalAlpha = Core.easeOut(e);
    ctx.translate(W / 2, H * 0.48);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H * 0.48);

    var pw = W - R(48), ph = R(392), px = R(24), py = H * 0.48 - ph / 2;
    Core.panel(px, py, pw, ph, R(24), 'rgba(24,10,52,0.88)', Core.hexA(g.win ? COL.gold : COL.pink, 0.6));

    if (g.win) Core.drawGlow(W / 2, py + R(44), R(80), COL.gold, 0.45);
    Core.drawTextGlow(g.win ? '全 部 通 关' : '心 碎 了', W / 2, py + R(44), R(28),
      g.win ? COL.gold : '#ffb0c4', Core.hexA(g.win ? COL.gold : COL.pink, 0.45), 'center');
    Core.drawText(g.win ? '4 关全通 · 默契满分' : ('闯到第 ' + (g.levelIdx + 1) + ' 关 · 下次一定!'),
      W / 2, py + R(76), R(14), 'rgba(255,255,255,0.6)', 'center', false);

    Core.drawPixelText(String(g.score), W / 2, py + R(122), R(13), COL.gold, 'center');
    Core.drawText('总得分', W / 2, py + R(158), R(13), 'rgba(255,255,255,0.6)', 'center', false);

    var by = py + R(206);
    Core.drawGlow(W / 2, by, R(58), g.win ? COL.gold : COL.pink, 0.5);
    Core.blit(g.win ? Sprites.miniGold : Sprites.miniPink, W / 2, by, 4.2, 1, Math.sin(t * 1.6) * 0.12);
    for (var s = 0; s < 6; s++) {
      var ang = t * 1.1 + s * 1.047;
      Core.drawPixMap(W / 2 + Math.cos(ang) * R(46), by + Math.sin(ang) * R(46),
        Math.max(1, Math.round(R(1.8))), Core.MAP_STAR,
        Core.hexA(COL.gold, (0.45 + 0.45 * Math.sin(t * 6 + s)).toFixed(3)));
    }
    Core.drawTextGlow(rk.t, W / 2, py + R(252), R(28), COL.pinkHot, Core.hexA(COL.pink, 0.4), 'center');
    Core.drawText('“' + rk.q + '”', W / 2, py + R(286), R(14), 'rgba(255,255,255,0.75)', 'center', false);

    var rate = g.heartSpawned > 0 ? Math.round(g.heartCaught / g.heartSpawned * 100) : 0;
    Core.drawText('最高连击 ' + g.maxCombo + '   命中率 ' + rate + '%', W / 2, py + R(322), R(15), COL.text, 'center', false);

    if (g.newBest) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6);
      Core.drawTextGlow('★ 新 纪 录 ★', W / 2, py + R(352), R(17), COL.gold, 'rgba(255,190,60,0.5)', 'center');
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    var blink = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.globalAlpha = 0.45 + 0.55 * blink;
    Core.drawTextGlow('▶ 点击任意处 · 再来一局 ◀', W / 2, Math.min(H - R(30), py + ph + R(38)), R(18), COL.text, 'rgba(255,255,255,0.25)', 'center');
    ctx.globalAlpha = 1;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Screens;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['screens'] = Screens;
})();
