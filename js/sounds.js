/**
 * SPACE INVADERS: ZAYD EDITION
 * Sound Engine — Web Audio API synthesized sounds
 * No external files needed!
 */

const SFX = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    } catch (e) {
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone({ type = 'square', freq = 440, freq2 = null, duration = 0.15,
                       attack = 0.01, decay = 0.05, sustain = 0.3, release = 0.1,
                       vol = 0.5, detune = 0 }) {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + duration);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.linearRampToValueAtTime(vol * sustain, now + attack + decay);
    gain.gain.setValueAtTime(vol * sustain, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  function noise({ duration = 0.1, vol = 0.3, bandFreq = 1000 }) {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = bandFreq;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(now);
  }

  return {
    init,
    resume,

    shoot() {
      playTone({ type: 'square', freq: 880, freq2: 220, duration: 0.12, vol: 0.4, attack: 0.005 });
    },

    enemyShoot() {
      playTone({ type: 'sawtooth', freq: 660, freq2: 110, duration: 0.18, vol: 0.25, attack: 0.005 });
    },

    hit() {
      noise({ duration: 0.12, vol: 0.6, bandFreq: 800 });
      playTone({ type: 'square', freq: 200, freq2: 50, duration: 0.15, vol: 0.3, attack: 0.005 });
    },

    bigExplosion() {
      noise({ duration: 0.45, vol: 0.9, bandFreq: 300 });
      noise({ duration: 0.3, vol: 0.5, bandFreq: 100 });
    },

    playerHit() {
      noise({ duration: 0.4, vol: 0.8, bandFreq: 250 });
      playTone({ type: 'sawtooth', freq: 120, freq2: 40, duration: 0.4, vol: 0.5 });
    },

    levelUp() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone({ type: 'square', freq: f, duration: 0.18, vol: 0.4, attack: 0.01, sustain: 0.5 });
        }, i * 120);
      });
    },

    gameOver() {
      const notes = [440, 392, 349, 294, 262, 220, 196, 165];
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone({ type: 'sawtooth', freq: f, duration: 0.22, vol: 0.35 });
        }, i * 130);
      });
    },

    win() {
      const notes = [523,659,784,880,1047,880,1047,1319];
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone({ type: 'square', freq: f, duration: 0.2, vol: 0.4, sustain: 0.6 });
        }, i * 100);
      });
    },

    ufoPass() {
      playTone({ type: 'sine', freq: 800, freq2: 1200, duration: 0.8, vol: 0.3 });
    },

    shieldHit() {
      noise({ duration: 0.06, vol: 0.4, bandFreq: 2000 });
    },

    marchTick(phase) {
      // Classic invader march — alternating tones
      const freqs = [160, 130, 100, 80];
      playTone({ type: 'square', freq: freqs[phase % 4], duration: 0.06, vol: 0.15, attack: 0.005 });
    }
  };
})();

SFX.init();
