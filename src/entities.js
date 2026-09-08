/**
 * entities.js —— 掉落物「角色」
 *   每个角色自己负责:下落与摇摆、拖尾与发光绘制、被接住的反馈、
 *   落地的后果。game.js 只负责生成与调度,不关心具体角色长什么样。
 *
 *   HeartItem    红心    +1
 *   GoldItem     金心    +3
 *   RainbowItem  彩虹心  +5 并清除全场炸弹
 *   BombItem     坏心情炸弹 误点爆炸扣爱心,安全落地只清连击
 */
(function () {
  'use strict';
  var Core = require('./core.js');
  var Config = require('./config.js');
  var Sprites = require('./sprites.js');
  var FX = require('./fx.js');
  var Audio = require('./audio.js');
  var R = Core.R, COL = Core.COL, RAINBOW = Core.RAINBOW;

  /* ================= 基类 =================
   *   mo —— 移动轨迹配置(Config.PATHS 里的某一档),
   *         决定横向怎么飘:直落 / 摇摆 / 蛇形 / 乱流
   */
  function Item(type, lane, x, y, v, mo) {
    this.type = type;
    this.lane = lane;
    this.x = x;
    this.y = y;
    this.v = v;
    this.mo = mo || Config.PATHS[Config.DEFAULT_PATH];
    this.w = Core.rnd(0, 6.28);      // 摇摆相位
    this.ph = Core.rnd(0, 6.28);     // 乱流副波相位
    this.rot = Core.rnd(-0.18, 0.18);
    this.tr = [];                    // 拖尾采样
    this.dead = false;
    this.bad = false;                // 是否是有害角色
    this.gain = 0;                   // 接住得分
  }

  Item.prototype.sprite = function () { return Sprites.heart; };

  Item.prototype.update = function (dt) {
    var mo = this.mo;
    this.w += dt * mo.freq;
    this.y += this.v * dt;

    /* 横向位移(px/s):主波 + 乱流副波 */
    var dx = Math.sin(this.w) * mo.amp;
    if (mo.wob) dx += Math.sin(this.w * Config.WOB_F + this.ph) * mo.wob;
    dx *= 60;
    this.x += dx * dt;

    /* 夹在本侧通道内,避免飘到对面「串台」 */
    var laneW = Core.W / 2;
    var c = this.lane * laneW + laneW / 2;
    var lim = laneW * 0.44;
    if (this.x < c - lim) this.x = c - lim;
    else if (this.x > c + lim) this.x = c + lim;

    /* 朝移动方向倾斜 */
    this.rot = Math.sin(this.w * 0.7) * 0.12 + Core.clamp(dx * 0.0016, -0.3, 0.3);

    this.tr.unshift({ x: this.x, y: this.y });
    if (this.tr.length > 5) this.tr.pop();
  };

  /* 接近判定线时在地面投出光斑,帮助预判落点 */
  Item.prototype.groundMark = function (color) {
    var near = Core.clamp(1 - (Core.GROUND_Y - this.y) / R(200), 0, 1);
    if (this.y > Core.GROUND_Y - R(260)) {
      Core.drawGlow(this.x, Core.GROUND_Y, R(26 + 14 * near), color, 0.10 + 0.35 * near);
    }
    return near;
  };

  Item.prototype.draw = function (t) {
    var spr = this.sprite(t);
    for (var k = this.tr.length - 1; k >= 1; k--) {
      var p = this.tr[k];
      Core.blit(spr, p.x, p.y, 0.72 - k * 0.06, 0.16 * (1 - k / this.tr.length), this.rot);
    }
    this.drawBody(t);
  };

  /* 子类实现:本体绘制 */
  Item.prototype.drawBody = function () {};
  /* 子类实现:被接住(g 为游戏局数据,提供 combo / clearBombs 等) */
  Item.prototype.onCatch = function () {};
  /* 子类实现:落地未接住 */
  Item.prototype.onLand = function () {};

  /* ================= 红心 ================= */
  function HeartItem(lane, x, y, v, mo) { Item.call(this, 'heart', lane, x, y, v, mo); this.gain = 1; }
  HeartItem.prototype = Object.create(Item.prototype);
  HeartItem.prototype.constructor = HeartItem;
  HeartItem.prototype.sprite = function () { return Sprites.heart; };
  HeartItem.prototype.drawBody = function (t) {
    var near = this.groundMark(COL.pink);
    var p = 1 + 0.06 * Math.sin(t * 6 + this.w);
    Core.drawGlow(this.x, this.y, R(30) * p, COL.pink, 0.28 + 0.22 * near);
    Core.blit(Sprites.heart, this.x, this.y, p, 1, this.rot);
  };
  HeartItem.prototype.onCatch = function (g) {
    FX.burst(this.x, this.y, COL.pink, 12, Sprites.miniPink);
    FX.ring(this.x, this.y, R(80), COL.pink, R(3), 0.45);
    FX.pop(this.x, this.y, '+1', COL.pinkHot, R(17));
    Core.vib('light');
    Audio.catch(g.combo);
  };
  HeartItem.prototype.onLand = function (g) {
    FX.burst(this.x, this.y, COL.pink, 10, Sprites.miniPink);
    FX.ring(this.x, this.y, R(46), COL.pink, R(3), 0.4);
    g.loseLove();
  };

  /* ================= 金心 ================= */
  function GoldItem(lane, x, y, v, mo) { Item.call(this, 'gold', lane, x, y, v, mo); this.gain = 3; }
  GoldItem.prototype = Object.create(Item.prototype);
  GoldItem.prototype.constructor = GoldItem;
  GoldItem.prototype.sprite = function () { return Sprites.gold; };
  GoldItem.prototype.drawBody = function (t) {
    var near = this.groundMark(COL.gold);
    var p = 1 + 0.10 * Math.sin(t * 8 + this.w * 2);
    Core.drawGlow(this.x, this.y, R(34) * p, COL.gold, 0.4);
    Core.blit(Sprites.gold, this.x, this.y, p, 1, this.rot);
    /* 环绕星光 */
    for (var s = 0; s < 3; s++) {
      var ang = t * 2.4 + s * 2.094;
      Core.drawPixMap(
        this.x + Math.cos(ang) * R(24), this.y + Math.sin(ang) * R(24),
        Math.max(1, Math.round(R(1.6))), Core.MAP_STAR,
        Core.hexA('#ffffff', (0.5 + 0.5 * Math.sin(t * 8 + s)).toFixed(3))
      );
    }
    if (near > 0) { /* 预留 */ }
  };
  GoldItem.prototype.onCatch = function () {
    FX.burst(this.x, this.y, COL.gold, 12, Sprites.miniGold);
    FX.ring(this.x, this.y, R(110), COL.gold, R(3), 0.45);
    FX.pop(this.x, this.y, '+3', COL.gold, R(17));
    Core.vib('light');
    Audio.gold();
  };
  GoldItem.prototype.onLand = function (g) {
    FX.burst(this.x, this.y, COL.gold, 10, Sprites.miniGold);
    FX.ring(this.x, this.y, R(46), COL.gold, R(3), 0.4);
    g.loseLove();
  };

  /* ================= 彩虹心 ================= */
  function RainbowItem(lane, x, y, v, mo) { Item.call(this, 'rainbow', lane, x, y, v, mo); this.gain = 5; }
  RainbowItem.prototype = Object.create(Item.prototype);
  RainbowItem.prototype.constructor = RainbowItem;
  RainbowItem.prototype.sprite = function (t) {
    return Sprites.rainbow[Math.floor((t || 0) * 9) % Sprites.rainbow.length];
  };
  RainbowItem.prototype.drawBody = function (t) {
    this.groundMark('#ffffff');
    Core.drawGlow(this.x, this.y, R(40), '#ffffff', 0.3);
    Core.blit(this.sprite(t), this.x, this.y, 1 + 0.07 * Math.sin(t * 7), 1, this.rot);
    /* 彩虹弧环 */
    var ctx = Core.ctx;
    ctx.lineWidth = Math.max(1, R(2));
    for (var c = 0; c < 3; c++) {
      ctx.strokeStyle = Core.hexA(RAINBOW[(c * 2 + Math.floor(t * 4)) % RAINBOW.length], 0.5);
      ctx.beginPath();
      ctx.arc(this.x, this.y, R(20 + c * 5), t * 2 + c, t * 2 + c + 2.1);
      ctx.stroke();
    }
  };
  RainbowItem.prototype.onCatch = function (g) {
    FX.burstPal(this.x, this.y, RAINBOW, 18);
    FX.burst(this.x, this.y, '#ffffff', 8);
    FX.burst(this.x, this.y, '#ffffff', 5, Sprites.miniWhite);
    FX.ring(this.x, this.y, R(150), '#ffffff', R(4), 0.55);
    FX.ring(this.x, this.y, R(110), RAINBOW[2], R(3), 0.5);
    FX.pop(this.x, this.y, '+5', RAINBOW[1], R(17));
    Core.vib('medium');
    Audio.rainbow();
    g.clearBombs();
  };
  RainbowItem.prototype.onLand = function (g) {
    FX.burst(this.x, this.y, RAINBOW[3], 10, Sprites.miniGold);
    FX.ring(this.x, this.y, R(46), RAINBOW[3], R(3), 0.4);
    g.loseLove();
  };

  /* ================= 坏心情炸弹 ================= */
  function BombItem(lane, x, y, v, mo) { Item.call(this, 'bomb', lane, x, y, v, mo); this.bad = true; this.gain = 0; }
  BombItem.prototype = Object.create(Item.prototype);
  BombItem.prototype.constructor = BombItem;
  BombItem.prototype.sprite = function () { return Sprites.bomb; };
  BombItem.prototype.drawBody = function (t) {
    var near = this.groundMark(COL.bomb);
    var p = 1 + 0.06 * Math.sin(t * 10 + this.w);
    Core.drawGlow(this.x, this.y, R(30) * p, COL.bomb, 0.35 + 0.2 * near);
    Core.blit(Sprites.bomb, this.x, this.y, p, 1, this.rot);
    /* 危险环:8 个旋转小方块 */
    var ctx = Core.ctx, rr = R(24), rot0 = t * 2.2 + this.w;
    ctx.fillStyle = Core.hexA(COL.danger, (0.5 + 0.35 * Math.sin(t * 8 + this.w)).toFixed(3));
    for (var d = 0; d < 8; d++) {
      var ang = rot0 + d * 0.7854;
      var s = Math.max(2, R(2.6));
      ctx.fillRect(this.x + Math.cos(ang) * rr - s / 2, this.y + Math.sin(ang) * rr - s / 2, s, s);
    }
    /* 引线火花 */
    ctx.globalAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 22 + this.w * 3));
    ctx.fillStyle = COL.gold;
    ctx.fillRect(this.x + R(11), this.y - R(19), Math.max(2, R(3)), Math.max(2, R(3)));
    ctx.globalAlpha = 1;
  };
  BombItem.prototype.onCatch = function (g) {
    FX.burst(this.x, this.y, COL.bomb, 20);
    FX.burst(this.x, this.y, COL.bombDark, 12);
    FX.burst(this.x, this.y, '#ffffff', 6);
    FX.ring(this.x, this.y, R(120), COL.bomb, R(4), 0.5);
    FX.ring(this.x, this.y, R(80), COL.danger, R(3), 0.4);
    FX.pop(this.x, this.y - R(30), '别碰炸弹!', COL.bomb, R(15));
    g.combo = 0;
    g.shake = Math.max(g.shake, 0.36);
    g.flashRed = Math.max(g.flashRed, 0.3);
    g.sideFlash[this.lane] = 0.45;
    Core.vib('heavy');
    Audio.bomb();
  };
  BombItem.prototype.onLand = function (g) {
    /* 安全落地:无害,但连击清零 */
    g.combo = 0;
    FX.burst(this.x, this.y, COL.bomb, 10);
  };

  /* ================= 工厂 ================= */
  var Entities = {
    Heart: HeartItem,
    Gold: GoldItem,
    Rainbow: RainbowItem,
    Bomb: BombItem,
    Item: Item,

    /* 按当前难度权重随机生成一个掉落物;返回 null 表示该侧已满
     *   d.laneMax 决定单侧通道上限(数量档位),d.path 决定移动轨迹 */
    spawn: function (g, d) {
      var cnt = [0, 0];
      for (var i = 0; i < g.items.length; i++) cnt[g.items[i].lane]++;
      var lane = cnt[0] <= cnt[1] ? 0 : 1;
      var laneMax = d.laneMax || Config.LANE_MAX;
      if (cnt[lane] >= laneMax) return null;

      var roll = Math.random();
      var type = 'heart';
      if (roll < d.bombW) type = 'bomb';
      else if (roll < d.bombW + d.goldW) type = 'gold';
      else if (roll < d.bombW + d.goldW + d.rainbowW) type = 'rainbow';

      var laneW = Core.W / 2;
      var x = lane * laneW + laneW * Core.rnd(0.32, 0.68);
      var v = d.speed * Core.rnd(0.9, 1.15);
      var mo = d.path;
      var item;
      if (type === 'bomb') item = new BombItem(lane, x, -R(30), v, mo);
      else if (type === 'gold') item = new GoldItem(lane, x, -R(30), v, mo);
      else if (type === 'rainbow') item = new RainbowItem(lane, x, -R(30), v, mo);
      else item = new HeartItem(lane, x, -R(30), v, mo);

      if (!item.bad) g.heartSpawned++;
      return item;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Entities;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['entities'] = Entities;
})();
