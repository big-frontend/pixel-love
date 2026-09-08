/**
 * fx.js —— 特效池
 *   粒子 / 飘字 / 冲击波圆环 / 触摸涟漪 / 彩纸。
 *   全局共享(菜单态也能出涟漪),FX.reset() 清空。
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var Sprites = require('./sprites.js');
  var R = Core.R, clamp = Core.clamp, lerp = Core.lerp, easeOut = Core.easeOut, easeOutBack = Core.easeOutBack;

  var FX = {
    parts: [], pops: [], rings: [], ripples: [], confs: []
  };

  FX.reset = function () {
    FX.parts.length = 0; FX.pops.length = 0; FX.rings.length = 0;
    FX.ripples.length = 0; FX.confs.length = 0;
  };

  FX.burst = function (x, y, color, n, spr) {
    n = n || 10;
    if (FX.parts.length > 240) n = Math.min(n, 4);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = Core.rnd(40, 190);
      FX.parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        life: Core.rnd(0.35, 0.7), t: 0, size: Core.rnd(2, 4.4), color: color,
        spr: spr || null, rot: Core.rnd(0, 6.28), vr: Core.rnd(-7, 7)
      });
    }
  };

  FX.burstPal = function (x, y, pal, n) {
    n = n || 12;
    if (FX.parts.length > 240) n = Math.min(n, 4);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = Core.rnd(40, 210);
      FX.parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        life: Core.rnd(0.35, 0.75), t: 0, size: Core.rnd(2, 4.4), color: Core.pick(pal),
        spr: null, rot: Core.rnd(0, 6.28), vr: Core.rnd(-7, 7)
      });
    }
  };

  FX.pop = function (x, y, text, color, px) {
    FX.pops.push({ x: x, y: y, text: text, color: color, px: px, t: 0, life: 1.0 });
  };

  FX.ring = function (x, y, maxR, color, width, life) {
    FX.rings.push({ x: x, y: y, r0: R(6), maxR: maxR, color: color, w: width || R(3), t: 0, life: life || 0.45 });
  };

  FX.ripple = function (x, y) {
    FX.ripples.push({ x: x, y: y, t: 0, life: 0.42, maxR: R(52) });
  };

  FX.confetti = function (n) {
    var pal = Core.RAINBOW.concat(['#ffffff', '#ffd45a', '#ff5f8f']);
    for (var i = 0; i < n; i++) {
      FX.confs.push({
        x: Core.rnd(0, Core.W), y: Core.rnd(-Core.H * 0.3, -R(10)),
        vx: Core.rnd(-40, 40), vy: Core.rnd(120, 300),
        w: Core.rnd(R(4), R(9)), h: Core.rnd(R(6), R(13)),
        color: Core.pick(pal), rot: Core.rnd(0, 6.28), vr: Core.rnd(-8, 8),
        t: 0, life: Core.rnd(2.2, 3.6)
      });
    }
  };

  FX.step = function (dt) {
    var i, p;
    for (i = FX.parts.length - 1; i >= 0; i--) {
      p = FX.parts[i];
      p.t += dt;
      if (p.t > p.life) { FX.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 460 * dt;
      p.vx *= 0.985; p.rot += p.vr * dt;
    }
    for (i = FX.rings.length - 1; i >= 0; i--) {
      p = FX.rings[i]; p.t += dt;
      if (p.t > p.life) FX.rings.splice(i, 1);
    }
    for (i = FX.ripples.length - 1; i >= 0; i--) {
      p = FX.ripples[i]; p.t += dt;
      if (p.t > p.life) FX.ripples.splice(i, 1);
    }
    for (i = FX.pops.length - 1; i >= 0; i--) {
      p = FX.pops[i]; p.t += dt; p.y -= 52 * dt;
      if (p.t > p.life) FX.pops.splice(i, 1);
    }
    for (i = FX.confs.length - 1; i >= 0; i--) {
      p = FX.confs[i]; p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.rot += p.vr * dt;
      if (p.t > p.life || p.y > Core.H + R(40)) FX.confs.splice(i, 1);
    }
  };

  FX.draw = function () {
    var ctx = Core.ctx, i, p, k, a;
    /* 冲击波圆环 */
    for (i = 0; i < FX.rings.length; i++) {
      p = FX.rings[i];
      k = p.t / p.life;
      a = (1 - k) * 0.9;
      ctx.strokeStyle = Core.hexA(p.color, a.toFixed(3));
      ctx.lineWidth = Math.max(1, p.w * (1 - k * 0.6));
      ctx.beginPath();
      ctx.arc(p.x, p.y, lerp(p.r0, p.maxR, easeOut(k)), 0, 6.2832);
      ctx.stroke();
    }
    /* 粒子 */
    for (i = 0; i < FX.parts.length; i++) {
      p = FX.parts[i];
      a = clamp(1 - p.t / p.life, 0, 1);
      if (p.spr) Core.blit(p.spr, p.x, p.y, 1, a, p.rot);
      else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        var s = Math.max(1, Math.round(p.size * (0.4 + 0.6 * a)));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
        ctx.globalAlpha = 1;
      }
    }
    /* 飘字(弹出 + 淡出) */
    for (i = 0; i < FX.pops.length; i++) {
      p = FX.pops[i];
      k = p.t / p.life;
      a = k > 0.6 ? (1 - (k - 0.6) / 0.4) : 1;
      var sc = k < 0.18 ? lerp(0.4, 1.18, easeOutBack(k / 0.18)) : lerp(1.18, 1, clamp((k - 0.18) / 0.3, 0, 1));
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.scale(sc, sc);
      Core.drawText(p.text, 0, -R(2), p.px, 'rgba(20,6,32,0.55)', 'center', true);
      Core.drawText(p.text, 0, 0, p.px, p.color, 'center', true);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    /* 触摸涟漪 */
    for (i = 0; i < FX.ripples.length; i++) {
      p = FX.ripples[i];
      k = p.t / p.life;
      a = (1 - k) * 0.75;
      var rr = lerp(R(4), p.maxR, easeOut(k));
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, R(2));
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.35).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, rr * 0.35), 0, 6.2832); ctx.fill();
    }
    /* 彩纸 */
    for (i = 0; i < FX.confs.length; i++) {
      p = FX.confs[i];
      a = clamp(1 - (p.t - p.life + 0.8) / 0.8, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.6)));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* 背景漂浮的小爱心(菜单/游戏通用装饰) */
  FX.floaters = [];
  FX.meteors = [];
  FX.initAmbient = function () {
    FX.floaters.length = 0;
    for (var k = 0; k < 9; k++) {
      FX.floaters.push({
        x: Core.rnd(0.08, 0.92) * Core.W, y: Core.rnd(0.1, 1.0) * Core.H,
        v: Core.rnd(9, 26), sc: Core.rnd(0.5, 1.1), a: Core.rnd(0.10, 0.26),
        sw: Core.rnd(0.6, 1.6), ph: Core.rnd(0, 6.28),
        spr: Math.random() < 0.25 ? Sprites.miniGold : Sprites.miniPink
      });
    }
  };
  FX.stepAmbient = function (dt) {
    var i;
    for (i = 0; i < FX.floaters.length; i++) {
      var f = FX.floaters[i];
      f.y -= f.v * dt;
      f.ph += dt * f.sw;
      if (f.y < -R(30)) {
        f.y = Core.H + R(30);
        f.x = Core.rnd(0.08, 0.92) * Core.W;
        f.spr = Math.random() < 0.25 ? Sprites.miniGold : Sprites.miniPink;
      }
    }
    for (i = FX.meteors.length - 1; i >= 0; i--) {
      var m = FX.meteors[i];
      m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.t > m.life) FX.meteors.splice(i, 1);
    }
    if (Math.random() < dt * 0.32 && FX.meteors.length < 3) {
      var fromLeft = Math.random() < 0.5;
      FX.meteors.push({
        x: fromLeft ? Core.rnd(-Core.W * 0.1, Core.W * 0.4) : Core.rnd(Core.W * 0.6, Core.W * 1.1),
        y: Core.rnd(-Core.H * 0.05, Core.H * 0.35),
        vx: (fromLeft ? 1 : -1) * Core.rnd(260, 420),
        vy: Core.rnd(120, 220),
        len: Core.rnd(60, 130), t: 0, life: Core.rnd(0.8, 1.4)
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FX;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['fx'] = FX;
})();
