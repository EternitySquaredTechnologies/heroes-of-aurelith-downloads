'use strict';

/**
 * Sound for the game. Every effect is synthesized with the Web Audio API, so there are no
 * files to ship and no licenses to track. Real recordings can replace any effect later
 * without touching the callers. Music is generated here too: chiptune loops per place (see docs/audio-plan.md).
 */
(function () {
  const KEY = 'coe.audio.v1';
  const defaults = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };

  function load() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return { ...defaults };
    }
  }
  const settings = load();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // storage can be unavailable; the settings just will not persist
    }
  };

  let ctx = null;
  let master = null;
  let sfx = null;
  let noiseBuffer = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      sfx = ctx.createGain();
      sfx.connect(master);
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function apply() {
    if (!ctx) return;
    master.gain.value = settings.muted ? 0 : settings.master;
    sfx.gain.value = settings.sfx;
    if (mus) mus.gain.value = settings.music;
  }

  /** A short pitched blip. `to` slides the pitch over the duration. */
  function tone({ freq, to, dur = 0.12, type = 'square', vol = 0.25, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of filtered noise: footsteps, impacts. */
  function noise({ dur = 0.08, freq = 1200, vol = 0.3, delay = 0, q = 0.8 }) {
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sounds = {
    click: () => tone({ freq: 660, to: 880, dur: 0.05, vol: 0.12 }),
    step: () => noise({ dur: 0.05, freq: 300 + Math.random() * 120, vol: 0.12 }),
    swing: () => noise({ dur: 0.09, freq: 2200, vol: 0.12, q: 0.4 }),
    hit: () => {
      noise({ dur: 0.1, freq: 500, vol: 0.35 });
      tone({ freq: 220, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.25 });
    },
    hurt: () => {
      noise({ dur: 0.12, freq: 380, vol: 0.35 });
      tone({ freq: 160, to: 70, dur: 0.16, type: 'sawtooth', vol: 0.25 });
    },
    miss: () => tone({ freq: 500, to: 300, dur: 0.1, type: 'triangle', vol: 0.12 }),
    heal: () => {
      tone({ freq: 523, dur: 0.1, type: 'triangle', vol: 0.2 });
      tone({ freq: 659, dur: 0.1, type: 'triangle', vol: 0.2, delay: 0.09 });
      tone({ freq: 784, dur: 0.16, type: 'triangle', vol: 0.2, delay: 0.18 });
    },
    guard: () => tone({ freq: 180, to: 120, dur: 0.14, type: 'square', vol: 0.2 }),
    buff: () => {
      tone({ freq: 392, dur: 0.1, type: 'triangle', vol: 0.18 });
      tone({ freq: 587, dur: 0.14, type: 'triangle', vol: 0.18, delay: 0.1 });
    },
    coin: () => {
      tone({ freq: 988, dur: 0.07, vol: 0.18 });
      tone({ freq: 1319, dur: 0.18, vol: 0.18, delay: 0.07 });
    },
    level: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'square', vol: 0.2, delay: i * 0.11 }));
    },
    victory: () => {
      [392, 392, 392, 523].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.2, delay: i * 0.14 }));
    },
    defeat: () => {
      [330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.25, delay: i * 0.22 }));
    },
    death: () => tone({ freq: 300, to: 60, dur: 0.35, type: 'sawtooth', vol: 0.25 }),
    flee: () => tone({ freq: 300, to: 700, dur: 0.2, type: 'triangle', vol: 0.18 }),
    error: () => tone({ freq: 140, dur: 0.12, type: 'square', vol: 0.15 }),
  };

  // ---- music: generative chiptune loops, one per place (see docs/audio-plan.md)

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];

  function rng32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Each track is a chord progression (scale degrees, one chord per bar) plus a feel. `build` turns it into a
   * list of notes for the whole loop, using a seeded random walk for the melody, so a track always plays the
   * same tune. Steps are sixteenth notes; a bar is 16 steps.
   */
  const TRACKS = {
    town: { seed: 11, bpm: 92, root: 60, scale: MAJOR, prog: [0, 5, 3, 4, 0, 5, 3, 4], lead: 0.55, arp: true, bass: 'half', drums: false, vol: 0.9 },
    wilds: { seed: 23, bpm: 74, root: 57, scale: MINOR, prog: [0, 5, 2, 6, 0, 5, 3, 6], lead: 0.35, arp: false, pad: true, bass: 'half', drums: false, vol: 0.85 },
    fight: { seed: 37, bpm: 140, root: 52, scale: MINOR, prog: [0, 5, 6, 0, 0, 3, 6, 4], lead: 0.7, arp: true, bass: 'eighths', drums: true, vol: 1 },
  };

  function build(spec) {
    const rand = rng32(spec.seed);
    const degree = (d, octave = 0) => spec.root + 12 * (octave + Math.floor(d / 7)) + spec.scale[((d % 7) + 7) % 7];
    const notes = []; // { step, len, midi, voice, vol }
    const bars = spec.prog.length;
    let melody = 4;
    for (let bar = 0; bar < bars; bar++) {
      const base = bar * 16;
      const chord = spec.prog[bar];
      const tones = [chord, chord + 2, chord + 4];
      // bass
      if (spec.bass === 'half') {
        notes.push({ step: base, len: 6, midi: degree(chord, -2), voice: 'bass', vol: 0.55 });
        notes.push({ step: base + 8, len: 6, midi: degree(chord + 4, -2), voice: 'bass', vol: 0.5 });
      } else {
        for (let i = 0; i < 8; i++) notes.push({ step: base + i * 2, len: 2, midi: degree(chord + (i % 4 === 3 ? 4 : 0), -2), voice: 'bass', vol: i % 2 ? 0.4 : 0.55 });
      }
      // arpeggio
      if (spec.arp) {
        for (let i = 0; i < 8; i++) notes.push({ step: base + i * 2, len: 2, midi: degree(tones[i % 3], 0), voice: 'arp', vol: 0.16 });
      }
      // pad
      if (spec.pad) {
        for (const t of tones) notes.push({ step: base, len: 16, midi: degree(t, 0), voice: 'pad', vol: 0.12 });
      }
      // melody: a random walk that lands on chord tones on the strong beats
      let step = 0;
      while (step < 16) {
        const len = [2, 2, 4, 4, 6, 8][Math.floor(rand() * 6)];
        if (rand() < spec.lead || step === 0) {
          const strong = step % 8 === 0;
          if (strong) melody = tones[Math.floor(rand() * 3)] + 7;
          else melody += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rand() * 7)];
          melody = Math.max(chord + 2, Math.min(chord + 11, melody));
          notes.push({ step: base + step, len: Math.min(len, 16 - step), midi: degree(melody, 0), voice: 'lead', vol: 0.3 });
        }
        step += len;
      }
      // drums
      if (spec.drums) {
        for (let i = 0; i < 16; i += 4) notes.push({ step: base + i, len: 1, voice: 'kick', vol: 0.6 });
        for (let i = 4; i < 16; i += 8) notes.push({ step: base + i, len: 1, voice: 'snare', vol: 0.4 });
        for (let i = 0; i < 16; i += 2) notes.push({ step: base + i + 1, len: 1, voice: 'hat', vol: 0.12 });
      }
    }
    notes.sort((a, b) => a.step - b.step);
    return { spec, notes, steps: bars * 16 };
  }

  const built = {};
  let mus = null; // music bus
  let current = null; // { name, gain, built, step, next, alive }
  let timer = null;

  function playNote(dest, n, t, stepSec) {
    const dur = n.len * stepSec;
    const g = ctx.createGain();
    g.connect(dest);
    if (n.voice === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(n.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    if (n.voice === 'snare' || n.voice === 'hat') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = n.voice === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = n.voice === 'hat' ? 7000 : 1800;
      const len = n.voice === 'hat' ? 0.04 : 0.12;
      g.gain.setValueAtTime(n.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f).connect(g);
      src.start(t);
      src.stop(t + len + 0.02);
      return;
    }
    const o = ctx.createOscillator();
    o.type = n.voice === 'bass' || n.voice === 'pad' ? 'triangle' : n.voice === 'arp' ? 'square' : 'square';
    o.frequency.value = midiHz(n.midi);
    const attack = n.voice === 'pad' ? 0.25 : 0.01;
    const hold = Math.max(attack + 0.02, dur * (n.voice === 'lead' ? 0.9 : 0.95));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(n.vol, t + attack);
    g.gain.setValueAtTime(n.vol * (n.voice === 'lead' ? 0.7 : 1), t + hold * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold);
    o.connect(g);
    o.start(t);
    o.stop(t + hold + 0.05);
  }

  /** Schedule every note that falls inside the next quarter second. Runs on a short timer. */
  function pump() {
    if (!ctx || !current) return;
    const tr = current;
    const stepSec = 60 / tr.built.spec.bpm / 4;
    while (tr.next < ctx.currentTime + 0.3) {
      const s = tr.step % tr.built.steps;
      for (const n of tr.built.notes) {
        if (n.step === s) playNote(tr.gain, n, tr.next, stepSec);
        else if (n.step > s) break;
      }
      tr.step++;
      tr.next += stepSec;
    }
  }

  function setMusic(name) {
    if (!name || !TRACKS[name]) name = null;
    if ((current && current.name) === name) return;
    if (!ensure()) return;
    if (!mus) {
      mus = ctx.createGain();
      mus.connect(master);
    }
    mus.gain.value = settings.music;
    const old = current;
    if (old) {
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => old.gain.disconnect(), 2200);
    }
    if (!name) {
      current = null;
      return;
    }
    built[name] = built[name] || build(TRACKS[name]);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(TRACKS[name].vol * 0.5, ctx.currentTime + 1.5);
    gain.connect(mus);
    current = { name, gain, built: built[name], step: 0, next: ctx.currentTime + 0.05 };
    if (!timer) timer = setInterval(pump, 80);
    pump();
  }

  window.coeAudio = {
    settings,
    play(name) {
      if (settings.muted || !sounds[name] || !ensure()) return;
      try {
        sounds[name]();
      } catch {
        // a sound that fails to play must never break the game
      }
    },
    set(kind, value) {
      if (!(kind in settings)) return;
      settings[kind] = kind === 'muted' ? Boolean(value) : Math.min(1, Math.max(0, Number(value)));
      save();
      apply();
    },
    names: () => Object.keys(sounds),
    /** Play the loop for a place ('town', 'wilds', 'fight') with a crossfade, or null for silence. */
    music(name) {
      try {
        setMusic(name);
      } catch {
        // music must never break the game
      }
    },
    musicName: () => (current ? current.name : null),
    tracks: () => Object.keys(TRACKS),
    state: () => (ctx ? ctx.state : 'none'),
  };
})();
