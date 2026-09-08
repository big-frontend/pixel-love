/**
 * hud.js —— 游戏内顶部信息栏
 *   爱心、平滑滚动的分数、倒计时、时间条、关卡名、连击提示。
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var Config = require('./config.js');
  var R = Core.R, COL = Core.COL, RAINBOW = Core.RAINBOW, clamp = Core.clamp;

  var HUD = {};

  /* 交互区(暂停按钮) */
  HUD.ui = {
    pause: { x: 0, y: 0, r: 0 }
  };

  HUD.draw = function (g, t) {
    var ctx = Core.ctx, W = Core.W;
    var y = Core.SAFE_TOP + R(16);

    /* 背衬渐变条 */
    var hg = ctx.createLinearGradient(0, 0, 0, Core.SAFE_TOP + R(96));
    hg.addColorStop(0, 'rgba(10,4,26,0.55)');
    hg.addColorStop(1, 'rgba(10,4,26,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, Core.SAFE_TOP + R(96));

    /* 爱心 */
    for (var i = 0; i < Config.MAX_LOVE; i++) {
      var hx = R(20) + i * R(30);
      var on = i < g.love;
      var sh = (g.loveShake > 0 && i === g.love) ? Math.sin(t * 60) * R(3) : 0;
      var bob = on ? Math.sin(t * 3 + i * 0.7) * R(1.5) : 0;
      if (on) Core.drawGlow(hx, y + bob, R(15), COL.pink, 0.35);
      Core.drawPixMap(hx + sh, y + bob, R(4), Core.MAP_HEART, on ? COL.pink : 'rgba(255,255,255,0.16)');
    }

    /* 分数(平滑滚动 + 命中脉冲) */
    var txt = String(Math.round(g.dispScore));
    var sp = 1 + g.scorePulse * 0.28;
    ctx.save();
    ctx.translate(W - R(14), y + R(1));
    ctx.scale(sp, sp);
    Core.drawPixelText(txt, 0, 0, R(5), COL.gold, 'right');
    ctx.restore();
    Core.drawText('分', W - R(14) - (txt.length * 4 - 1) * R(5) - R(8), y + R(2), R(11), 'rgba(255,255,255,0.45)', 'right', false);

    /* 倒计时 */
    var sec = Math.max(0, Math.ceil(g.time));
    var danger = sec <= 10;
    ctx.save();
    ctx.translate(W / 2, y + R(2));
    var ps = danger ? 1 + 0.12 * Math.sin(t * 12) : 1;
    ctx.scale(ps, ps);
    Core.drawPixelText(String(sec), 0, 0, R(6), danger ? '#ff5f6d' : COL.white, 'center');
    ctx.restore();

    /* 时间条 */
    var bw = W - R(56), bx = R(28), by = y + R(30);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    Core.rrPath(bx, by, bw, R(7), R(4)); ctx.fill();
    var pr = clamp(g.time / g.lev.time, 0, 1);
    if (pr > 0) {
      var tg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      if (danger) { tg.addColorStop(0, '#ff3b5c'); tg.addColorStop(1, '#ff9a5a'); }
      else { tg.addColorStop(0, COL.pink); tg.addColorStop(0.5, '#c07fff'); tg.addColorStop(1, RAINBOW[4]); }
      ctx.fillStyle = tg;
      Core.rrPath(bx, by, Math.max(R(7), bw * pr), R(7), R(4)); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(bx + Math.max(R(7), bw * pr) - R(3), by, R(3), R(7));
    }

    /* 当前关卡 */
    Core.drawText(
      '第 ' + (g.levelIdx + 1) + ' / 4 关 · ' + g.lev.name,
      W / 2, by + R(24), R(13), Core.hexA(g.lev.theme.accent, 0.9), 'center'
    );

    /* 连击 */
    if (g.combo >= 5) {
      var cp = 1 + g.comboPulse * 0.35;
      var ccol = g.combo >= 20 ? RAINBOW[Math.floor(t * 8) % RAINBOW.length] : (g.combo >= 10 ? COL.gold : COL.pinkHot);
      ctx.save();
      ctx.translate(W / 2, by + R(56));
      ctx.scale(cp, cp);
      Core.drawTextGlow('❤ ' + g.combo + ' 连击', 0, 0, R(22), ccol, 'rgba(30,8,50,0.55)', 'center');
      ctx.restore();
    }
  };

  /* 暂停按钮(右上角,PLAY 态由 renderPlay 调用) */
  HUD.drawPause = function (t) {
    var ctx = Core.ctx, W = Core.W;
    var r = R(14);
    var x = W - R(28), y = Core.SAFE_TOP + R(24);
    HUD.ui.pause.x = x; HUD.ui.pause.y = y; HUD.ui.pause.r = r + R(8);
    /* 背衬圆 */
    ctx.fillStyle = 'rgba(10,4,26,0.55)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, R(1.5));
    ctx.stroke();
    /* 两条竖条 ‖ */
    var bw = R(3), bh = R(11), gap = R(3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - bw - gap / 2, y - bh / 2, bw, bh);
    ctx.fillRect(x + gap / 2, y - bh / 2, bw, bh);
  };

  HUD.pauseHit = function (x, y) {
    var p = HUD.ui.pause;
    if (!p.r) return false;
    var dx = x - p.x, dy = y - p.y;
    return dx * dx + dy * dy < p.r * p.r;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HUD;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['hud'] = HUD;
})();
