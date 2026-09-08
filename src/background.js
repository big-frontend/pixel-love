/**
 * background.js —— 场景背景
 *   离屏烘焙渐变/极光/网格背景,关卡主题色平滑过渡;
 *   三层视差星空、随机流星、漂浮爱心,以及地面两条落带。
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var FX = require('./fx.js');
  var R = Core.R, W = 0, H = 0, GROUND_Y = 0, SAFE_TOP = 0;
  var clamp = Core.clamp;

  var BG = { top: '#1a0f3c', bottom: '#2a1455', ground: '#33205e' };
  var bgFrom = null, bgTo = null, bgT = 1;
  var bgCanvas = null;
  var stars = [];

  function buildBg() {
    var b = bgCanvas.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.scale(Core.dpr, Core.dpr);
    b.clearRect(0, 0, W, H);
    var gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.55, Core.mixHex(BG.top, BG.bottom, 0.6));
    gr.addColorStop(1, BG.bottom);
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);

    /* 顶部柔光 */
    var gt = b.createRadialGradient(W * 0.5, -H * 0.12, 0, W * 0.5, -H * 0.12, H * 0.55);
    gt.addColorStop(0, 'rgba(255,150,200,0.32)');
    gt.addColorStop(1, 'rgba(255,150,200,0)');
    b.fillStyle = gt;
    b.fillRect(0, 0, W, H * 0.7);

    /* 两条斜向极光带 */
    b.save();
    b.translate(W * 0.5, H * 0.42);
    b.rotate(-0.32);
    for (var i = 0; i < 2; i++) {
      var y = -R(40) + i * R(120);
      var ga = b.createLinearGradient(-W, y, W, y + R(70));
      ga.addColorStop(0, 'rgba(255,255,255,0)');
      ga.addColorStop(0.45, i === 0 ? 'rgba(120,220,255,0.10)' : 'rgba(255,120,200,0.10)');
      ga.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = ga;
      b.fillRect(-W, y, W * 2, R(80));
    }
    b.restore();

    /* 像素网格 */
    b.fillStyle = 'rgba(255,255,255,0.028)';
    var step = R(30);
    for (var x = 0; x < W; x += step) b.fillRect(x, 0, 1, H);
    for (var y2 = 0; y2 < GROUND_Y; y2 += step) b.fillRect(0, y2, W, 1);
  }

  var Background = {};

  /* Core.boot() 之后调用 */
  Background.init = function (theme) {
    W = Core.W; H = Core.H; GROUND_Y = Core.GROUND_Y; SAFE_TOP = Core.SAFE_TOP;
    bgCanvas = wx.createCanvas();
    bgCanvas.width = Math.round(W * Core.dpr);
    bgCanvas.height = Math.round(H * Core.dpr);
    BG.top = theme.top; BG.bottom = theme.bottom; BG.ground = theme.ground;
    buildBg();
    /* 三层视差星空 */
    stars = [];
    for (var i = 0; i < 74; i++) {
      var layer = i % 3;
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: [1, 1.6, 2.4][layer] * Core.UNIT,
        ph: Math.random() * 6.28,
        sp: [0.5, 0.9, 1.4][layer],
        a: [0.35, 0.55, 0.8][layer]
      });
    }
    FX.initAmbient();
  };

  /* 切换关卡主题(过渡 0.7s) */
  Background.setTheme = function (th, instant) {
    if (instant) {
      BG.top = th.top; BG.bottom = th.bottom; BG.ground = th.ground;
      bgT = 1; bgFrom = null; bgTo = null;
      buildBg();
    } else {
      bgFrom = { top: BG.top, bottom: BG.bottom, ground: BG.ground };
      bgTo = { top: th.top, bottom: th.bottom, ground: th.ground };
      bgT = 0;
    }
  };
  Background.step = function (dt) {
    if (bgT >= 1 || !bgFrom || !bgTo) return;
    bgT = Math.min(1, bgT + dt / 0.7);
    var t = Core.easeOut(bgT);
    BG.top = Core.mixHex(bgFrom.top, bgTo.top, t);
    BG.bottom = Core.mixHex(bgFrom.bottom, bgTo.bottom, t);
    BG.ground = Core.mixHex(bgFrom.ground, bgTo.ground, t);
    buildBg();
    if (bgT >= 1) { bgFrom = null; bgTo = null; }
  };
  Background.draw = function () {
    Core.ctx.drawImage(bgCanvas, 0, 0, W, H);
  };

  /* 星空 / 流星 / 漂浮爱心 */
  Background.drawAmbient = function (t) {
    var ctx = Core.ctx, i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp * 2 + s.ph)));
      ctx.fillStyle = '#ffffff';
      var sz = Math.max(1, Math.round(s.r));
      ctx.fillRect(Math.round(s.x + Math.sin(t * 0.25 + s.ph) * 2), Math.round(s.y), sz, sz);
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < FX.meteors.length; i++) {
      var m = FX.meteors[i];
      var k = clamp(m.t / m.life, 0, 1);
      var al = Math.sin(k * Math.PI) * 0.85;
      var nl = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, R(1.6));
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx / nl * m.len, m.y - m.vy / nl * m.len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,250,' + al.toFixed(3) + ')';
      ctx.fillRect(Math.round(m.x) - R(1), Math.round(m.y) - R(1), Math.max(2, R(2.4)), Math.max(2, R(2.4)));
    }

    for (i = 0; i < FX.floaters.length; i++) {
      var f = FX.floaters[i];
      Core.blit(f.spr, f.x + Math.sin(f.ph) * R(10), f.y, f.sc, f.a, Math.sin(f.ph * 0.6) * 0.35);
    }
  };

  /* 地面:两条落带 + 判定线 + 命中闪光 */
  Background.drawGround = function (t, g) {
    var ctx = Core.ctx;
    var gh = H - GROUND_Y;
    var gr = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,0.25)');
    gr.addColorStop(1, BG.ground);
    ctx.fillStyle = gr;
    ctx.fillRect(0, GROUND_Y, W, gh);

    /* 落带柔光(左右不同色调) */
    var lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, Core.hexA(Core.COL.pink, 0.10));
    lg.addColorStop(0.5, 'rgba(255,255,255,0)');
    lg.addColorStop(1, Core.hexA(Core.RAINBOW[4], 0.10));
    ctx.fillStyle = lg;
    ctx.fillRect(0, SAFE_TOP + R(96), W, GROUND_Y - SAFE_TOP - R(96));

    /* 判定线 */
    Core.drawGlow(W / 2, GROUND_Y, R(120), g.lev.theme.accent, 0.28);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, GROUND_Y, W, Math.max(1, R(1.5)));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (var x = R(6); x < W; x += R(22)) ctx.fillRect(x, GROUND_Y - R(5), Math.max(1, R(1.5)), R(4));

    /* 中缝虚线 */
    for (var y = GROUND_Y + R(8); y < H; y += R(14)) ctx.fillRect(W / 2 - 1, y, 2, R(7));

    /* 命中半屏闪光 */
    for (var s = 0; s < 2; s++) {
      if (!g.sideFlash[s] || g.sideFlash[s] <= 0) continue;
      var sg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      var c = s === 0 ? Core.COL.pink : Core.RAINBOW[4];
      sg.addColorStop(0, Core.hexA(c, 0));
      sg.addColorStop(1, Core.hexA(c, (g.sideFlash[s] * 0.5).toFixed(3)));
      ctx.fillStyle = sg;
      ctx.fillRect(s === 0 ? 0 : W / 2, GROUND_Y, W / 2, gh);
    }

    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
    Core.drawText('你 守 左 边', W * 0.25, GROUND_Y + gh / 2, R(13), 'rgba(255,255,255,0.55)', 'center', false);
    Core.drawText('TA 守 右 边', W * 0.75, GROUND_Y + gh / 2, R(13), 'rgba(255,255,255,0.55)', 'center', false);
    ctx.globalAlpha = 1;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Background;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['background'] = Background;
})();
