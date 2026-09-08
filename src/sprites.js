/**
 * sprites.js —— 掉落物精灵预烘焙
 *   启动时把红心/金心/彩虹心(6 相位)/炸弹烘焙成带光晕的离屏贴图,
 *   运行时只做 drawImage,保证低端机也能跑满帧。
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var R = Core.R, COL = Core.COL, RAINBOW = Core.RAINBOW;
  var MAP_HEART = Core.MAP_HEART, MAP_BOMB = Core.MAP_BOMB;

  var Sprites = {
    heart: null, gold: null, rainbow: [], bomb: null,
    miniPink: null, miniGold: null, miniWhite: null
  };

  function makeHeart(color, hi, cell, noGlow) {
    var pad = noGlow ? R(1) : R(24);
    var w = 7 * cell + pad * 2, h = 6 * cell + pad * 2;
    var o = Core.offCanvas(w, h);
    if (!noGlow) o.x.drawImage(Core.glowCanvas(color), 0, 0, w, h);
    Core.pixMap(o.x, MAP_HEART, w / 2, h / 2, cell, color);
    /* 高光:左上小爱心 + 一点反光 */
    o.x.globalAlpha = 0.55;
    Core.pixMap(o.x, MAP_HEART, w / 2 - cell * 2.1, h / 2 - cell * 1.7, Math.max(1, Math.round(cell * 0.42)), hi);
    o.x.globalAlpha = 1;
    o.x.fillStyle = 'rgba(255,255,255,0.85)';
    o.x.fillRect(w / 2 + cell * 1.2, h / 2 - cell * 1.6, Math.max(1, Math.round(cell * 0.5)), Math.max(1, Math.round(cell * 0.5)));
    return o;
  }

  function makeRainbow(cell, phase) {
    var pad = R(24);
    var w = 7 * cell + pad * 2, h = 6 * cell + pad * 2;
    var o = Core.offCanvas(w, h);
    o.x.drawImage(Core.glowCanvas('#ffffff'), 0, 0, w, h);
    var rows = MAP_HEART.length, cols = MAP_HEART[0].length;
    var x0 = Math.round(w / 2 - cols * cell / 2), y0 = Math.round(h / 2 - rows * cell / 2);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (MAP_HEART[r].charAt(c) !== '1') continue;
        o.x.fillStyle = RAINBOW[(r + c + phase) % RAINBOW.length];
        o.x.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }
    o.x.fillStyle = 'rgba(255,255,255,0.95)';
    o.x.fillRect(x0 + cell * 1.4, y0 + cell * 0.6, Math.max(1, Math.round(cell * 0.55)), Math.max(1, Math.round(cell * 0.55)));
    return o;
  }

  function makeBomb(cell) {
    var pad = R(22);
    var w = 8 * cell + pad * 2, h = 8 * cell + pad * 2;
    var o = Core.offCanvas(w, h);
    o.x.drawImage(Core.glowCanvas(COL.bomb), 0, 0, w, h);
    /* 引线 */
    o.x.strokeStyle = '#c9a4ff';
    o.x.lineWidth = Math.max(1, Math.round(cell * 0.35));
    o.x.beginPath();
    o.x.moveTo(w / 2 + cell * 0.4, h / 2 - cell * 3.4);
    o.x.quadraticCurveTo(w / 2 + cell * 2.2, h / 2 - cell * 4.6, w / 2 + cell * 2.6, h / 2 - cell * 3.2);
    o.x.stroke();
    /* 球体 */
    Core.pixMap(o.x, MAP_BOMB, w / 2, h / 2, cell, COL.bombDark);
    Core.pixMap(o.x, MAP_BOMB, w / 2, h / 2, Math.round(cell * 0.78), COL.bomb);
    o.x.fillStyle = 'rgba(255,255,255,0.55)';
    o.x.fillRect(w / 2 - cell * 2, h / 2 - cell * 2.4, Math.max(1, Math.round(cell * 0.7)), Math.max(1, Math.round(cell * 0.7)));
    return o;
  }

  /* 必须在 Core.boot() 之后调用 */
  Sprites.build = function () {
    Sprites.heart = makeHeart(COL.pink, COL.pinkHot, R(5));
    Sprites.gold = makeHeart(COL.gold, '#fff6cf', R(5.4));
    Sprites.rainbow = [];
    for (var i = 0; i < RAINBOW.length; i++) Sprites.rainbow.push(makeRainbow(R(5.2), i));
    Sprites.bomb = makeBomb(R(5));
    Sprites.miniPink = makeHeart(COL.pink, COL.pinkHot, R(2), true);
    Sprites.miniGold = makeHeart(COL.gold, '#fff6cf', R(2), true);
    Sprites.miniWhite = makeHeart('#ffffff', '#ffffff', R(2), true);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Sprites;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['sprites'] = Sprites;
})();
