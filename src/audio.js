/**
 * audio.js —— 程序化 8-bit 音效
 *   用 WebAudio 实时合成方波/三角波/噪声,零音频资源。
 *   微信小游戏走 wx.createWebAudioContext,浏览器降级 AudioContext,
 *   任一环节失败都静默降级,不影响游戏。
 */
(function () {
  'use strict';
  var Core = require('./core.js');

  var AC = null, AC_FAIL = false;
  var soundOn = Core.store.get('pixel_heart_sound', true) !== false;

  function ac() {
    if (AC || AC_FAIL) return AC;
    try {
      if (Core.isMiniGame && wx.createWebAudioContext) AC = wx.createWebAudioContext();
      else if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
      } else AC = null;
    } catch (e) { AC = null; AC_FAIL = true; }
    return AC;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!soundOn) return;
    var a = ac(); if (!a) return;
    try {
      if (a.state === 'suspended' && a.resume) a.resume();
      var t0 = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.07, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { /* ignore */ }
  }

  function noise(dur, vol, delay) {
    if (!soundOn) return;
    var a = ac(); if (!a) return;
    try {
      if (a.state === 'suspended' && a.resume) a.resume();
      var t0 = a.currentTime + (delay || 0);
      var len = Math.max(1, Math.floor(a.sampleRate * dur));
      var buf = a.createBuffer ? a.createBuffer(1, len, a.sampleRate) : null;
      if (!buf) return;
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = a.createBufferSource(); src.buffer = buf;
      var g = a.createGain(); g.gain.value = vol || 0.14;
      var f = a.createBiquadFilter ? a.createBiquadFilter() : null;
      if (f) {
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2200, t0);
        f.frequency.exponentialRampToValueAtTime(220, t0 + dur);
        src.connect(f); f.connect(g);
      } else src.connect(g);
      g.connect(a.destination);
      src.start(t0); src.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  var Audio = {
    isOn: function () { return soundOn; },
    setOn: function (on) {
      soundOn = !!on;
      Core.store.set('pixel_heart_sound', soundOn);
    },
    toggle: function () { Audio.setOn(!soundOn); return soundOn; },
    tone: tone,
    noise: noise,
    /* 接住红心:音阶随连击升高 */
    catch: function (combo) {
      var f = 520 + Math.min(combo, 18) * 26;
      tone(f, 0.08, 'square', 0.055, f * 1.5);
      tone(f * 2, 0.05, 'square', 0.03, f * 2.4, 0.03);
    },
    gold: function () {
      tone(784, 0.07, 'square', 0.06);
      tone(1046, 0.07, 'square', 0.055, null, 0.06);
      tone(1318, 0.12, 'square', 0.05, null, 0.12);
    },
    rainbow: function () {
      var ns = [523, 659, 784, 988, 1175, 1568];
      for (var i = 0; i < ns.length; i++) tone(ns[i], 0.1, 'square', 0.05, null, i * 0.06);
    },
    bomb: function () {
      noise(0.34, 0.2);
      tone(180, 0.3, 'sawtooth', 0.09, 46);
    },
    lose: function () {
      tone(330, 0.16, 'triangle', 0.09, 180);
      tone(160, 0.28, 'triangle', 0.07, 80, 0.1);
    },
    level: function () {
      var ns = [523, 659, 784, 1046];
      for (var i = 0; i < ns.length; i++) tone(ns[i], 0.14, 'square', 0.06, null, i * 0.09);
    },
    start: function () {
      tone(440, 0.08, 'square', 0.06);
      tone(660, 0.1, 'square', 0.06, null, 0.08);
      tone(880, 0.14, 'square', 0.05, null, 0.16);
    },
    over: function (win) {
      if (win) {
        var ns = [523, 659, 784, 1046, 1318];
        for (var i = 0; i < ns.length; i++) tone(ns[i], 0.18, 'square', 0.06, null, i * 0.12);
      } else {
        var ms = [440, 392, 330, 262];
        for (var j = 0; j < ms.length; j++) tone(ms[j], 0.22, 'triangle', 0.07, null, j * 0.14);
      }
    },
    tap: function () { tone(880, 0.04, 'square', 0.03); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Audio;
  else if (typeof window !== 'undefined') (window.__MODS__ = window.__MODS__ || {})['audio'] = Audio;
})();
