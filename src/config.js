/**
 * config.js —— 全部可调参数
 *   关卡数值、下落速度档位、评级、爱心上限、判定半径、存储键。
 *   想调难度/手感,改这个文件就够了。
 */
(function () {
  'use strict';

  /* ---------- 状态机 ---------- */
  var STATE = { MENU: 0, PLAY: 1, OVER: 2, CLEAR: 3, PAUSED: 4 };

  /* ---------- 爱心与判定 ---------- */
  var MAX_LOVE = 5;              // 爱心上限
  var CATCH_R = 56;              // 点击判定半径(基准 390 宽下的 px,会随屏幕缩放)
  var LANE_MAX = 4;              // 单侧通道同时存在的掉落物上限(数量档位会覆盖它)

  /* ============================================================
   *  难度档位(三维:速度 / 数量 / 轨迹,菜单可选并持久化保存)
   *
   *  ① 速度 SPEEDS   —— 下落速度倍率;spawnMul 顺带微调间隔,
   *                     掉得快若不加密,屏幕会显得空
   *  ② 数量 DENSITY  —— 心的数量:生成间隔倍率 + 单侧通道上限
   *  ③ 轨迹 PATHS    —— 横向移动方式(amp/freq/wob 见 entities.js)
   * ============================================================ */
  var SPEEDS = [
    { name: '刺激', mul: 1.75, spawnMul: 0.92 },
    { name: '紧绷', mul: 2.10, spawnMul: 0.85 },
    { name: '狂飙', mul: 2.50, spawnMul: 0.78 },
    { name: '极限', mul: 3.00, spawnMul: 0.70 },
    { name: '神话', mul: 3.60, spawnMul: 0.62 }
  ];
  var DEFAULT_SPEED = 0;         // 默认「刺激」

  var DENSITY = [
    { name: '较密', mul: 1.00, lane: 6 },
    { name: '超密', mul: 0.80, lane: 9 },
    { name: '满屏', mul: 0.62, lane: 12 },
    { name: '极限', mul: 0.48, lane: 15 }
  ];
  var DEFAULT_DENSITY = 0;       // 默认「较密」

  var PATHS = [
    { name: '直落', desc: '垂直落下,好预判',   amp: 0.0, freq: 3.0, wob: 0.0 },
    { name: '摇摆', desc: '左右轻摆',           amp: 1.0, freq: 3.0, wob: 0.0 },
    { name: '蛇形', desc: '大幅 S 形横扫',      amp: 3.4, freq: 3.2, wob: 0.0 },
    { name: '乱流', desc: '毫无规律地乱飘',     amp: 2.0, freq: 2.8, wob: 1.2 }
  ];
  var DEFAULT_PATH = 1;          // 默认「摇摆」
  var WOB_F = 0.41;              // 乱流副波频率(相对主波)

  /* ============================================================
   *  关卡配置:4 关连续挑战,难度递增,掉落物种类不同
   *    spawnInt / speed 为 [开始值, 终值](随时间在本关内爬升)
   *    bombW / goldW / rainbowW 为占生成量的概率权重(红心占剩余)
   * ============================================================ */
  var LEVELS = [
    {
      name: '心动初识', time: 28,
      spawnInt: [0.62, 0.44], speed: [215, 340],
      bombW: 0, goldW: 0, rainbowW: 0,
      hint: '第 1 关热身:接住红心就好!',
      theme: { top: '#4a1360', bottom: '#1d0a35', ground: '#2d1245', accent: '#ff5f8f' }
    },
    {
      name: '甜度加倍', time: 30,
      spawnInt: [0.54, 0.38], speed: [260, 405],
      bombW: 0.10, goldW: 0.10, rainbowW: 0,
      hint: '金心 +3 · 小心炸弹出没!',
      theme: { top: '#5b1057', bottom: '#240a41', ground: '#33104d', accent: '#ffd45a' }
    },
    {
      name: '默契挑战', time: 34,
      spawnInt: [0.46, 0.32], speed: [305, 470],
      bombW: 0.18, goldW: 0.11, rainbowW: 0.045,
      hint: '彩虹心 +5,还能清除全场炸弹!',
      theme: { top: '#1f4a7a', bottom: '#280a45', ground: '#361154', accent: '#5ad1ff' }
    },
    {
      name: '灵魂之约', time: 40,
      spawnInt: [0.42, 0.28], speed: [350, 545],
      bombW: 0.24, goldW: 0.12, rainbowW: 0.055,
      hint: '终极关卡,全力以赴!',
      theme: { top: '#7a1140', bottom: '#2a0a4a', ground: '#3a1259', accent: '#ff8fb0' }
    }
  ];

  /* ---------- 评级 ---------- */
  var RANKS = [
    { min: 210, t: '灵魂伴侣 S', q: '四关圆满,你们的默契连像素都心动' },
    { min: 150, t: '心动大师 A', q: '两颗心,始终同频' },
    { min: 95,  t: '甜蜜恋人 B', q: '爱要及时,也要默契' },
    { min: 50,  t: '默契新人 C', q: '再多练几次,默契加倍' },
    { min: 0,   t: '心跳练习生 D', q: '没关系,在一起就已是满分' }
  ];

  /* ---------- 存储键 ---------- */
  var KEYS = {
    best: 'pixel_heart_best',
    sound: 'pixel_heart_sound',
    speed: 'pixel_heart_speed',
    density: 'pixel_heart_density',
    path: 'pixel_heart_path'
  };

  var Config = {
    STATE: STATE,
    MAX_LOVE: MAX_LOVE,
    CATCH_R: CATCH_R,
    LANE_MAX: LANE_MAX,
    SPEEDS: SPEEDS,
    DENSITY: DENSITY,
    PATHS: PATHS,
    DEFAULT_SPEED: DEFAULT_SPEED,
    DEFAULT_DENSITY: DEFAULT_DENSITY,
    DEFAULT_PATH: DEFAULT_PATH,
    WOB_F: WOB_F,
    LEVELS: LEVELS,
    RANKS: RANKS,
    KEYS: KEYS,
    getRank: function (score) {
      for (var i = 0; i < RANKS.length; i++) {
        if (score >= RANKS[i].min) return RANKS[i];
      }
      return RANKS[RANKS.length - 1];
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Config;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['config'] = Config;
})();
