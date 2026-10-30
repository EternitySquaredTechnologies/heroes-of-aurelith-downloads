'use strict';

/**
 * The world view: draws the map, players, and monsters on a canvas; plays turn-based fights
 * on the same tiles; and shows skills, bag, wallet, and sound panels. All truth comes from
 * the server. This file only shows it and turns clicks and keys into requests.
 */
(function () {
  const TILE = 16;
  const BUBBLE_MS = 6000;
  const LOG_LINES = 80;
  const MOVE_STEP_MS = 130;
  const MAX_LEVEL = 100;
  const PANELS = ['panel-skills', 'panel-bag', 'panel-equip', 'panel-stats', 'panel-look', 'panel-sound', 'panel-journal', 'panel-trades'];
  const TOWN_PANELS = ['dialog', 'panel-shop', 'panel-storage', 'panel-station', 'panel-perks', 'panel-anchor'];
  const ROW_LEVELS = [1, 8, 16, 24, 32, 40];
  const TREE_NAMES = ['melee', 'range', 'magic', 'defense'];
  let treeTab = 'melee';
  const SKILLS = ['melee', 'defense', 'range', 'magic', 'mining', 'forestry', 'fishing', 'hunting', 'smithing', 'cooking', 'crafting'];
  /** Name and one-line description for every hero ability (docs/combat-and-gear-draft.md, section 3). */
  const ABILITY_INFO = {
    punch: ['Punch', '100% damage to an adjacent enemy. Fists, since you hold no weapon.'],
    slash: ['Slash', '100% damage to an adjacent enemy.'],
    pine_nut_throw: ['Pine Nut Throw', 'A thrown pine nut. The Mind Goblin never runs out.'],
    pick_throw: ['Pick Throw', 'A mining pick thrown from five tiles away. The Foreman Below has a rack of them.'],
    wretch_bite: ['Wretch Bite', 'A bite that poisons. The venom ticks for three rounds.'],
    crushing_strike: ['Crushing Strike', 'A boss marks tiles after its turn. Anyone still standing on one when its next turn starts loses a quarter of their health, armor or not.'],
    dust_cloud: ['Dust Cloud', 'A choking cloud of rock dust. Halves your mana regeneration for two rounds.'],
    wing_buffet: ['Wing Buffet', 'Leathery wings in your face. Blinded: your attacks lose 30 points of hit chance for two rounds. Spells can miss while you are blinded.'],
    gore: ['Gore', 'A tusk blow. Stone boars charge and strike first.'],
    multi_strike: ['Multi Strike', '60% damage to up to 4 enemies in the 3 by 3 block in front of you.'],
    power_strike: ['Power Strike', '200% damage to an adjacent enemy.'],
    rend: ['Rend', '80% damage now, then bleed for 60% over 3 rounds.'],
    sunder_strike: ['Sunder Strike', '100% damage and 2 stacks of Sunder (5% less armor each, up to 5).'],
    war_cry: ['War Cry', '+15% damage dealt for 5 rounds.'],
    whirlwind: ['Whirlwind', '80% damage to every enemy on the 8 tiles around you.'],
    execute: ['Execute', '150% damage, or 300% against a target under 30% health.'],
    shot: ['Shot', '100% damage to one enemy within 6 tiles.'],
    multi_shot: ['Multi Shot', '60% damage to up to 4 enemies within 6 tiles.'],
    aimed_shot: ['Aimed Shot', '200% damage within 6 tiles. Cannot miss.'],
    poison_arrow: ['Poison Arrow', '60% damage now, then poison for 80% over 3 rounds. Poison ignores armor.'],
    snare: ['Snare', '80% damage; the target moves 2 fewer tiles for 2 turns.'],
    rain_of_arrows: ['Rain of Arrows', '70% damage to every enemy in a 3 by 3 area within 6 tiles.'],
    backstep: ['Backstep', 'Run up to 4 tiles away from the nearest enemy and dodge 20% more until your next turn.'],
    deadeye: ['Deadeye', 'Your next shot deals 350% damage and always crits.'],
    fireball: ['Fireball', '100% fire damage to one enemy within 5 tiles.'],
    ice_storm: ['Ice Storm', '70% damage to every enemy in a 3 by 3 area within 5 tiles; they move 2 fewer tiles next turn.'],
    heal: ['Heal', 'Restore 30% of your max health.'],
    mana_shield: ['Mana Shield', 'For 3 rounds, damage drains mana instead of health (1 mana per 2 damage).'],
    chain_lightning: ['Chain Lightning', '100%, 80%, then 60% damage on up to 3 enemies, each within 4 tiles of the last.'],
    arcane_surge: ['Arcane Surge', 'For 3 rounds: +40% spell damage and triple mana regen. Then you are exhausted (-20% damage) for 3 rounds.'],
    shield_bash: ['Shield Bash', '80% damage; the target cannot move on its next turn (bosses: 50% chance).'],
    fortify: ['Fortify', '15% less damage taken for 10 rounds.'],
    second_wind: ['Second Wind', 'Restore 25% of your max health over 3 rounds.'],
    parry: ['Parry', 'Negate the next melee hit against you and answer it with 100% damage.'],
    stoneskin: ['Stoneskin', 'Absorb damage worth 20% of your max health for 2 rounds.'],
    retaliate: ['Retaliate', 'For 2 rounds, reflect 30% of the damage you take.'],
    unbreakable: ['Unbreakable', 'For 2 rounds take 50% less damage, and you cannot drop below 1 health in the first.'],
  };
  const ABILITY_NAMES = Object.fromEntries(Object.entries(ABILITY_INFO).map(([k, v]) => [k, v[0]]));
  /** The attack every hero has for their weapon, used when nothing else is selected. */
  const BASIC_ATTACKS = ['punch', 'slash', 'shot', 'fireball'];
  const BOSS_SCALE = { mind_goblin: 1.7, foreman_below: 1.6, skrit: 1.5, harl_dunmarsh: 1.5, ghashul: 1.5, ethelgar: 1.6, morwenna_pickman: 1.7, drowned_voice: 1.3, nyth_ael: 1.6, ambrose_silt: 1.6, prince_elrenor: 1.8 };
const DEBUFFS = new Set(['stagger', 'slow', 'bleed', 'poison', 'burn', 'sunder', 'exhaust', 'dust_choked', 'blinded']);
  const TIER_LEVELS = [1, 10, 20, 30];
  /** Equipment layout, three across: the figure's head, body, and legs down the middle. */
  const PAPERDOLL = ['weapon2', 'head', 'amulet', 'weapon', 'body', 'offhand', 'cloak', 'legs', 'belt', 'ring', 'boon', null];
  const SLOT_LABELS = [
    ['weapon', 'Weapon'],
    ['weapon2', 'Swap weapon'],
    ['offhand', 'Offhand'],
    ['head', 'Head'],
    ['body', 'Body'],
    ['legs', 'Legs'],
    ['cloak', 'Cloak'],
    ['amulet', 'Amulet'],
    ['ring', 'Ring'],
    ['belt', 'Belt'],
    ['boon', 'Boon'],
  ];
  const WEAPON_BLURB = {
    blade: 'Deals 20% more damage. Effective against heavy armor.',
    dagger: 'Two actions per turn and +15% critical chance. Enemy armor is 40% more effective against it.',
    bow: 'Range 6 and +8 accuracy.',
    staff: 'Range 5. Enemy armor is only 60% as effective against spells.',
  };
  const CLASS_SKILL = { blade: 'melee', dagger: 'melee', bow: 'range', staff: 'magic' };
  const ERRORS = {
    no_path: "You can't walk there.",
    in_fight: "You can't do that in a fight.",
    cast_cancelled: 'The portal fizzles. Stay still and out of combat to cast it.',
    busy: 'That target is already in a fight.',
    safe_zone: "You can't start a fight in town.",
    not_in_fight: 'You are not in a fight.',
    illegal_action: "You can't do that right now.",
    no_item: "You can't use that.",
    level_too_low: 'Your level is too low to use that.',
    bad_skill: "You can't raise that skill yet.",
    cannot_afford: "You can't afford that.",
    too_far: "You're too far away.",
    no_tool: 'You need a different tool for that.',
    bag_full: 'Your bag is full.',
    storage_full: 'Your storage is full.',
    no_space: 'There is no room for that.',
    missing_items: 'You are missing some of the required materials.',
  };

  const $ = (id) => document.getElementById(id);
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const xpForLevel = (l) => (l <= 1 ? 0 : l <= 20 ? Math.round((25 * Math.pow(l - 1, 2.4)) / 5) * 5 : Math.round((25 * Math.pow(19, 2.4) * Math.pow((l - 1) / 19, 3.6)) / 5) * 5);
  const pretty = (id) => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  /** Your chance to land a weapon swing on a foe of `foeLevel` (spells never miss unless blinded). Null until the gear arrives. */
  function myHitChance(foeLevel) {
    const g = G && G.gearInfo;
    if (!g) return null;
    const lvl = (G.stats && G.stats.combatLevel) || 1;
    const me = G.fight && G.fight.actors.get(G.selfId);
    const pen = me && me.statuses.some((s) => s.id === 'blinded') ? 0.3 : 0;
    if (g.weapon.cls === 'staff') return Math.min(1, Math.max(0.05, 1 - pen));
    const acc = g.accuracy + (g.weapon.cls === 'bow' ? 8 : 0);
    return Math.min(0.95, Math.max(0.05, 0.75 + (acc + lvl - foeLevel) * 0.015 - pen));
  }
  const pctText = (v) => `${Math.round(v * 100)}%`;
  /** Plain text for a foe's standing against you: hit chance, and whether it still teaches you anything. */
  function foeNote(foeLevel) {
    const lvl = (G.stats && G.stats.combatLevel) || 1;
    const hit = myHitChance(foeLevel);
    const parts = [];
    if (hit !== null) parts.push(`${pctText(hit)} chance to hit`);
    if (foeLevel <= lvl - 10) parts.push('too weak to give experience');
    return parts.join(', ');
  }
  const VEC = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

  function dirToward(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
    return dy >= 0 ? 'S' : 'N';
  }

  function front3x3(pos, dir) {
    const [vx, vy] = VEC[dir];
    const px = vy !== 0 ? 1 : 0;
    const py = vx !== 0 ? 1 : 0;
    const tiles = [];
    for (let depth = 1; depth <= 3; depth++) for (let w = -1; w <= 1; w++) tiles.push({ x: pos.x + vx * depth + px * w, y: pos.y + vy * depth + py * w });
    return tiles;
  }

  let G = null; // the running game, if any
  const early = []; // messages that arrive before the game view is ready

  // ---- sprites

  function hash(s) {
    let h = 2166136261;
    for (const c of s) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const SKIN_TONES = ['#f6d3b3', '#e8b98e', '#cf9768', '#a9724a', '#7d4e32', '#553221'];
  const OUTLINE = '#2a1a14';

  /** '#rrggbb' scaled toward black (f < 1) or white (f > 1). */
  function tint(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  function hsl2hex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  /** What a hero looks like: the chosen body shape and skin tone, with clothes and hair picked from the name. */
  function look(name, chosen) {
    const h = hash(name);
    const tone = SKIN_TONES[chosen ? chosen.skin : (h >> 4) % 4] || SKIN_TONES[1];
    const hue = h % 360;
    const hairHue = 10 + ((h >> 8) % 40);
    const hairL = 18 + ((h >> 16) % 28);
    return {
      hat: (h >> 24) % 4,
      g: chosen ? chosen.g : (h >> 20) % 2 ? 'f' : 'm',
      skin: tone,
      skinShade: tint(tone, 0.82),
      body: hsl2hex(hue, 50, 46),
      bodyShade: hsl2hex(hue, 50, 34),
      bodyLight: hsl2hex(hue, 55, 58),
      trim: hsl2hex(hue, 40, 26),
      hair: hsl2hex(hairHue, 45, hairL),
      hairShade: hsl2hex(hairHue, 45, Math.max(6, hairL - 8)),
      hairLight: hsl2hex(hairHue, 50, hairL + 12),
    };
  }

  const spriteCache = new Map();

  /**
   * Paint a sprite on a 20x20 canvas (the 16x16 tile plus a 2 pixel margin) with `paint(r)`, then wrap
   * every filled pixel in a dark outline. Cached by key.
   */
  function sprite(key, paint, size = 20) {
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    paint((x, y, w, h, color) => {
      g.fillStyle = color;
      g.fillRect(x + 2, y + 2, w, h);
    });
    const d = g.getImageData(0, 0, size, size).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < size && y < size && d[(y * size + x) * 4 + 3] > 0;
    const out = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out.push([x, y]);
    g.fillStyle = OUTLINE;
    for (const [x, y] of out) g.fillRect(x, y, 1, 1);
    if (spriteCache.size > 400) spriteCache.clear();
    spriteCache.set(key, c);
    return c;
  }

  function blit(ctx, c, x, y, s, bob) {
    // A sprite canvas has a 2 pixel margin; its inner area always covers one 16 pixel tile, whatever its detail.
    const k = 16 / (c.width - 4);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(20,10,5,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 8 * s, y + 15.2 * s, 5.5 * s, 1.9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(c, Math.round(x - 2 * k * s), Math.round(y + (bob - 2 * k) * s), c.width * k * s, c.width * k * s);
  }

  /**
   * A hero on a 24x24 grid, shown in one tile: a big head, dark eyes with a single highlight, headgear that
   * changes the outline, and the weapon and shield in hand. `step` lifts one foot while walking.
   */
  function drawFigure(ctx, x, y, s, l, step, bob, held) {
    held = held || {};
    const key = ['p4', l.g, l.skin, l.body, l.hair, l.hat, step, held.weapon || '', held.shield ? 1 : 0].join('|');
    const c = sprite(key, (r) => {
      const fem = l.g === 'f';
      const boot = '#4a2e1c';
      const pant = '#3a3048';
      r(9, 18, 3, 3, pant);
      r(13, 18, 3, 3, pant);
      r(8, 21 - (step === 1 ? 1 : 0), 4, 2, boot);
      r(13, 21 - (step === 2 ? 1 : 0), 4, 2, boot);
      if (fem) {
        r(8, 12, 9, 4, l.body);
        r(7, 16, 11, 3, l.body);
        r(7, 18, 11, 1, l.bodyShade);
        r(8, 12, 4, 3, l.bodyLight);
        r(14, 13, 3, 3, l.bodyShade);
        r(8, 15, 9, 1, l.trim);
      } else {
        r(8, 12, 9, 7, l.body);
        r(8, 12, 4, 3, l.bodyLight);
        r(14, 13, 3, 6, l.bodyShade);
        r(8, 18, 9, 1, l.bodyShade);
        r(8, 17, 9, 1, l.trim);
        r(11, 17, 3, 1, '#e8c860');
      }
      r(6, 12, 2, 5, l.body);
      r(17, 12, 2, 5, l.bodyShade);
      r(6, 17, 2, 2, l.skin);
      r(17, 17, 2, 2, l.skinShade);
      // head
      r(6, 3, 12, 9, l.skin);
      r(7, 2, 10, 1, l.skin);
      r(7, 12, 10, 1, l.skinShade);
      r(17, 4, 1, 7, l.skinShade);
      // hair
      r(7, 0, 10, 1, l.hair);
      r(6, 1, 12, 3, l.hair);
      r(5, 3, 1, 5, l.hair);
      r(18, 3, 1, 5, l.hairShade);
      r(8, 1, 4, 1, l.hairLight);
      r(6, 4, 12, 1, l.hair);
      if (fem) {
        r(5, 8, 2, 6, l.hair);
        r(17, 8, 2, 6, l.hairShade);
        r(15, 0, 3, 2, '#e8506a');
      } else {
        r(8, 5, 2, 1, l.hair);
        r(14, 5, 2, 1, l.hair);
      }
      // headgear
      if (l.hat === 1) {
        r(5, 0, 14, 5, l.body);
        r(5, 5, 2, 7, l.body);
        r(17, 5, 2, 7, l.bodyShade);
        r(7, 5, 10, 1, l.trim);
        r(7, 0, 5, 2, l.bodyLight);
      } else if (l.hat === 2) {
        r(5, 1, 14, 3, '#b8402c');
        r(3, 4, 18, 2, '#8a2c1c');
        r(7, 1, 5, 1, '#d86a4c');
        r(17, -1, 2, 5, '#f4f0dc');
        r(19, 0, 1, 3, '#d8d4c0');
      } else if (l.hat === 3) {
        r(6, 0, 12, 5, '#a8aebc');
        r(5, 3, 1, 5, '#8a90a0');
        r(18, 3, 1, 5, '#6e7484');
        r(8, 1, 4, 1, '#d8dce8');
        r(3, 0, 2, 4, '#efe4c4');
        r(19, 0, 2, 4, '#d8caa4');
        r(11, 5, 3, 3, '#8a90a0');
      }
      // face
      r(9, 7, 2, 3, '#1a1426');
      r(14, 7, 2, 3, '#1a1426');
      r(9, 7, 1, 1, '#ffffff');
      r(14, 7, 1, 1, '#ffffff');
      r(11, 10, 3, 1, '#a8705a');
      r(8, 10, 2, 1, '#e89a8a');
      r(15, 10, 2, 1, '#d88a7a');
      // held gear
      if (held.weapon === 'blade') {
        r(4, 4, 2, 13, '#dfe6f2');
        r(4, 4, 1, 2, '#ffffff');
        r(3, 17, 5, 1, '#c89a3c');
        r(4, 18, 2, 2, '#6a4020');
      } else if (held.weapon === 'dagger') {
        r(4, 12, 2, 5, '#dfe6f2');
        r(3, 17, 4, 1, '#c89a3c');
        r(4, 18, 2, 2, '#6a4020');
      } else if (held.weapon === 'bow') {
        r(3, 5, 2, 1, '#8a5a2c');
        r(2, 6, 2, 10, '#8a5a2c');
        r(3, 16, 2, 1, '#8a5a2c');
        r(5, 6, 1, 10, '#ece8d6');
      } else if (held.weapon === 'staff') {
        r(4, 5, 2, 16, '#8a5a2c');
        r(2, 0, 6, 5, '#5ac8ff');
        r(3, 1, 2, 1, '#ffffff');
        r(5, 3, 2, 1, '#2a8ac8');
      }
      if (held.shield) {
        r(17, 13, 5, 7, '#8a5a2c');
        r(17, 13, 5, 1, '#c89a3c');
        r(18, 14, 1, 5, '#a06a34');
        r(19, 15, 1, 3, '#d8d8e0');
      }
    }, 28);
    blit(ctx, c, x, y, s, bob);
  }

  /** Monsters in the same 16x16 tile, rounder and shaded like the people. */
  function drawMonster(ctx, mon, x, y, s, step, bob) {
    const c = sprite(`m|${mon}|${step}`, (r) => {
      if (mon === 'moss_imp') {
        r(4, 13 - (step === 1 ? 1 : 0), 3, 2, '#2c4a24');
        r(9, 13 - (step === 2 ? 1 : 0), 3, 2, '#2c4a24');
        r(12, 11, 3, 1, '#4a8a3c');
        r(14, 9, 1, 3, '#4a8a3c');
        r(3, 6, 10, 8, '#5a9a4a');
        r(3, 6, 4, 4, '#74b862');
        r(10, 8, 3, 6, '#467a38');
        r(1, 7, 2, 4, '#4a8a3c');
        r(13, 7, 2, 4, '#3c6c30');
        r(4, 8, 8, 1, '#6ab056');
        r(4, 1, 8, 6, '#6fb25a');
        r(4, 1, 8, 2, '#86cc70');
        r(10, 3, 2, 4, '#58983f');
        r(2, 2, 2, 3, '#6fb25a');
        r(12, 2, 2, 3, '#58983f');
        r(3, 0, 1, 2, '#e8dcb4');
        r(12, 0, 1, 2, '#d0c498');
        r(5, 3, 2, 2, '#2a1010');
        r(9, 3, 2, 2, '#2a1010');
        r(5, 3, 1, 1, '#ff9a6a');
        r(9, 3, 1, 1, '#ff9a6a');
        r(6, 6, 4, 1, '#2c4a24');
        r(7, 6, 1, 1, '#ffffff');
      } else if (mon === 'glowcap_crawler') {
        r(2, 12, 1, 3 - (step === 1 ? 1 : 0), '#2a2040');
        r(5, 12, 1, 3 - (step === 2 ? 1 : 0), '#2a2040');
        r(9, 12, 1, 3 - (step === 1 ? 1 : 0), '#2a2040');
        r(12, 12, 1, 3 - (step === 2 ? 1 : 0), '#2a2040');
        r(2, 8, 12, 5, '#4a3a6a');
        r(2, 8, 12, 1, '#5e4c82');
        r(3, 12, 10, 1, '#382c52');
        r(1, 3, 14, 6, '#7a5cc8');
        r(3, 2, 10, 2, '#8e70dc');
        r(5, 1, 6, 1, '#a58ae8');
        r(1, 7, 14, 1, '#5c42a4');
        r(4, 4, 2, 2, '#c8f8ff');
        r(9, 3, 2, 2, '#c8f8ff');
        r(12, 5, 2, 1, '#ffeb9a');
        r(2, 6, 1, 1, '#ff8a8a');
        r(5, 10, 2, 2, '#2a1a40');
        r(9, 10, 2, 2, '#2a1a40');
        r(5, 10, 1, 1, '#c8f8ff');
        r(9, 10, 1, 1, '#c8f8ff');
      } else if (mon === 'gnasher') {
        r(3, 13 - (step === 1 ? 1 : 0), 3, 2, '#4a3e32');
        r(10, 13 - (step === 2 ? 1 : 0), 3, 2, '#4a3e32');
        r(0, 8, 3, 1, '#6a5a4a');
        r(0, 7, 1, 2, '#6a5a4a');
        r(2, 6, 10, 8, '#8a7a66');
        r(2, 6, 10, 2, '#a09078');
        r(8, 9, 4, 5, '#706250');
        r(3, 5, 1, 2, '#6a5a4a');
        r(5, 4, 1, 3, '#6a5a4a');
        r(7, 4, 1, 3, '#6a5a4a');
        r(9, 5, 1, 2, '#6a5a4a');
        r(9, 2, 6, 7, '#9a8a76');
        r(9, 2, 6, 2, '#b2a28c');
        r(14, 6, 1, 3, '#7a6a56');
        r(10, 3, 2, 1, '#6a5a4a');
        r(11, 4, 2, 2, '#2a1010');
        r(11, 4, 1, 1, '#ff9a6a');
        r(10, 8, 1, 2, '#ffffff');
        r(13, 8, 1, 2, '#ffffff');
        r(11, 8, 2, 1, '#3a2c22');
      } else if (mon === 'familiar') {
        r(4, 13 - (step === 1 ? 1 : 0), 3, 2, '#4a2e7a');
        r(9, 13 - (step === 2 ? 1 : 0), 3, 2, '#4a2e7a');
        r(4, 6, 8, 8, '#7a5ce0');
        r(4, 6, 4, 3, '#a58aff');
        r(9, 9, 3, 5, '#5a40b0');
        r(3, 1, 3, 4, '#a58aff');
        r(10, 1, 3, 4, '#5a40b0');
        r(4, 3, 8, 5, '#8e72f0');
        r(5, 4, 2, 2, '#fff8c0');
        r(9, 4, 2, 2, '#fff8c0');
        r(6, 7, 4, 1, '#2a1a50');
        r(6, 14, 4, 1, '#c8f0ff');
      } else if (mon === 'sump_rat' || mon === 'skrit') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(0, 10, 4, 1, '#c8908a');
        r(0, 9, 1, 1, '#c8908a');
        r(4, 13 - fl, 2, 2, '#4a3a30');
        r(9, 13 - fr, 2, 2, '#4a3a30');
        r(3, 8, 9, 5, '#7a6a5a');
        r(3, 8, 9, 1, '#968470');
        r(8, 11, 4, 2, '#605246');
        r(11, 7, 4, 4, '#8a7a68');
        r(11, 7, 4, 1, '#a49480');
        r(14, 9, 2, 2, '#e8a0a0');
        r(12, 8, 1, 1, '#ff4a3a');
        r(10, 5, 2, 3, '#c8908a');
        r(14, 8, 2, 1, '#d8d0c0');
        r(13, 10, 1, 1, '#f4ecd0');
        if (mon === 'skrit') {
          r(10, 4, 5, 2, '#d8b040');
          r(10, 3, 1, 1, '#d8b040');
          r(12, 3, 1, 1, '#f4d868');
          r(14, 3, 1, 1, '#d8b040');
        }
      } else if (mon === 'harl_dunmarsh') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#2a2420');
        r(9, 13 - fr, 3, 2, '#2a2420');
        r(4, 6, 8, 8, '#5a5048');
        r(4, 6, 8, 2, '#766a5e');
        r(4, 12, 8, 1, '#3a322c');
        r(7, 7, 2, 6, '#8a7a30');
        r(2, 7, 2, 5, '#c89a78');
        r(12, 6, 2, 5, '#c89a78');
        r(13, 2, 1, 10, '#6a4426');
        r(11, 2, 5, 2, '#9aa0aa');
        r(5, 2, 6, 5, '#c89a78');
        r(5, 5, 6, 3, '#8a8478');
        r(4, 6, 1, 2, '#8a8478');
        r(11, 6, 1, 2, '#8a8478');
        r(6, 3, 1, 1, '#1a1410');
        r(9, 3, 1, 1, '#1a1410');
        r(4, 1, 8, 2, '#6a6258');
        r(7, 0, 2, 2, '#ffe46a');
        r(7, 0, 2, 1, '#ffffff');
        r(2, 13, 3, 1, '#b4a890');
        r(11, 4, 1, 1, '#b4a890');
      } else if (mon === 'cave_bat') {
        const up = step === 1;
        r(6, 6, 4, 6, '#3a2c4a');
        r(6, 6, 4, 1, '#54406a');
        r(5, 3, 6, 4, '#4a3a5c');
        r(5, 1, 1, 3, '#4a3a5c');
        r(10, 1, 1, 3, '#4a3a5c');
        r(6, 4, 1, 1, '#ff5a4a');
        r(9, 4, 1, 1, '#ff5a4a');
        r(7, 6, 1, 1, '#ffffff');
        r(8, 6, 1, 1, '#ffffff');
        r(7, 12, 2, 2, '#2a2038');
        if (up) {
          r(0, 2, 6, 5, '#2c2238');
          r(10, 2, 6, 5, '#2c2238');
          r(0, 2, 2, 3, '#54406a');
          r(14, 2, 2, 3, '#54406a');
          r(2, 6, 3, 2, '#3a2c4a');
          r(11, 6, 3, 2, '#3a2c4a');
        } else {
          r(0, 7, 6, 3, '#2c2238');
          r(10, 7, 6, 3, '#2c2238');
          r(0, 9, 2, 3, '#54406a');
          r(14, 9, 2, 3, '#54406a');
          r(2, 10, 3, 2, '#3a2c4a');
          r(11, 10, 3, 2, '#3a2c4a');
        }
      } else if (mon === 'bog_wretch') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(5, 13 - fl, 2, 2, '#3a4a48');
        r(9, 13 - fr, 2, 2, '#3a4a48');
        r(4, 6, 8, 8, '#5a4a3a');
        r(4, 6, 3, 3, '#7a6650');
        r(4, 12, 8, 1, '#3a2c22');
        r(2, 7, 2, 6, '#8aa8a0');
        r(12, 7, 2, 6, '#6a8880');
        r(2, 12, 2, 2, '#a4c4bc');
        r(12, 12, 2, 2, '#82a49c');
        r(5, 1, 6, 6, '#8aa8a0');
        r(5, 1, 6, 2, '#a4c4bc');
        r(4, 0, 8, 2, '#8a7a3a');
        r(7, 0, 2, 1, '#ffe88a');
        r(6, 3, 2, 2, '#0a1a20');
        r(9, 3, 2, 2, '#0a1a20');
        r(6, 3, 1, 1, '#8affea');
        r(9, 3, 1, 1, '#8affea');
        r(6, 5, 4, 1, '#1a2a2a');
        r(5, 7, 1, 2, '#6ac8e8');
        r(10, 8, 1, 2, '#6ac8e8');
      } else if (mon === 'stone_boar') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(3, 12 - fl, 2, 3, '#4a423a');
        r(6, 12 - fr, 2, 3, '#3a342e');
        r(9, 12 - fl, 2, 3, '#4a423a');
        r(12, 12 - fr, 2, 3, '#3a342e');
        r(1, 7, 1, 3, '#5a524a');
        r(2, 6, 11, 7, '#7a7268');
        r(2, 12, 11, 1, '#5a524a');
        r(3, 5, 9, 2, '#9a9488');
        r(4, 5, 2, 1, '#b4aea2');
        r(3, 4, 2, 1, '#6a6258');
        r(6, 4, 2, 1, '#6a6258');
        r(9, 4, 2, 1, '#6a6258');
        r(11, 6, 4, 6, '#6a625a');
        r(14, 9, 2, 3, '#8a7a70');
        r(15, 10, 1, 1, '#2a1a1a');
        r(13, 11, 1, 2, '#f4ecd0');
        r(14, 12, 1, 1, '#f4ecd0');
        r(12, 7, 1, 1, '#ff6a3a');
        r(11, 4, 2, 2, '#5a524a');
      } else if (mon === 'dire_wolf') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(3, 12 - fl, 2, 3, '#3c3c44');
        r(5, 12 - fr, 2, 3, '#2c2c34');
        r(9, 12 - fr, 2, 3, '#3c3c44');
        r(11, 12 - fl, 2, 3, '#2c2c34');
        r(0, 6, 2, 2, '#5a5a64');
        r(1, 7, 3, 2, '#6a6a74');
        r(2, 6, 10, 7, '#6a6a76');
        r(2, 12, 10, 1, '#4a4a54');
        r(3, 5, 8, 2, '#8a8a96');
        r(4, 4, 2, 1, '#9a9aa6');
        r(7, 4, 2, 1, '#9a9aa6');
        r(5, 8, 5, 2, '#52525c');
        r(11, 5, 4, 6, '#5e5e6a');
        r(14, 8, 2, 3, '#4a4a54');
        r(15, 9, 1, 1, '#14141a');
        r(12, 4, 1, 2, '#46464e');
        r(14, 4, 1, 2, '#46464e');
        r(12, 6, 1, 1, '#ffd23a');
        r(13, 11, 1, 2, '#f4f0e0');
        r(15, 11, 1, 1, '#f4f0e0');
      } else if (mon === 'wisp_hound') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(3, 12 - fl, 2, 3, '#24305a');
        r(5, 12 - fr, 2, 3, '#1c2648');
        r(9, 12 - fr, 2, 3, '#24305a');
        r(11, 12 - fl, 2, 3, '#1c2648');
        r(0, 4 - fl, 2, 4, '#8ee8ff');
        r(1, 6, 2, 2, '#58b8e8');
        r(2, 6, 10, 7, '#34448a');
        r(2, 12, 10, 1, '#222e60');
        r(3, 4, 9, 3, '#8ee8ff');
        r(4, 3, 3, 1, '#c8f8ff');
        r(8, 3, 3, 1, '#c8f8ff');
        r(5, 2 + fr, 2, 1, '#e8fcff');
        r(5, 8, 5, 2, '#4a5ca8');
        r(11, 5, 4, 6, '#3e4e96');
        r(14, 8, 2, 3, '#2a3670');
        r(15, 9, 1, 1, '#0a0e20');
        r(12, 4, 1, 2, '#58b8e8');
        r(12, 6, 2, 1, '#ffffff');
        r(13, 11, 1, 2, '#c8f8ff');
      } else if (mon === 'grave_wolf') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(3, 12 - fl, 2, 3, '#24242c');
        r(5, 12 - fr, 2, 3, '#3a3a42');
        r(9, 12 - fr, 2, 3, '#24242c');
        r(11, 12 - fl, 2, 3, '#3a3a42');
        r(0, 6, 2, 2, '#3a3a42');
        r(1, 7, 3, 2, '#4a4a50');
        r(2, 6, 10, 7, '#4a4a50');
        r(2, 12, 10, 1, '#24242c');
        r(3, 5, 8, 2, '#3a3a42');
        r(5, 8, 5, 2, '#24242c');
        r(11, 5, 4, 6, '#4a4a50');
        r(14, 8, 2, 3, '#3a3a42');
        r(15, 9, 1, 1, '#0a0a10');
        r(12, 4, 1, 2, '#24242c');
        r(14, 4, 1, 2, '#24242c');
        r(12, 6, 1, 1, '#9affb0');
        r(13, 11, 1, 2, '#e8e8d8');
        r(15, 11, 1, 1, '#e8e8d8');
      } else if (mon === 'ghashul') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(3, 12 - fl, 2, 3, '#1a1220');
        r(5, 12 - fr, 2, 3, '#2e2034');
        r(9, 12 - fr, 2, 3, '#1a1220');
        r(11, 12 - fl, 2, 3, '#2e2034');
        r(0, 6, 2, 2, '#2e2034');
        r(1, 7, 3, 2, '#3a2a3e');
        r(2, 6, 10, 7, '#3a2a3e');
        r(2, 12, 10, 1, '#1a1220');
        r(3, 5, 8, 2, '#2e2034');
        r(5, 8, 5, 2, '#1a1220');
        r(11, 5, 4, 6, '#3a2a3e');
        r(14, 8, 2, 3, '#2e2034');
        r(15, 9, 1, 1, '#0a0a10');
        r(12, 4, 1, 2, '#1a1220');
        r(14, 4, 1, 2, '#1a1220');
        r(12, 6, 1, 1, '#c070ff');
        r(13, 11, 1, 2, '#f0e8f0');
        r(15, 11, 1, 1, '#f0e8f0');
      } else if (mon === 'barrow_wight') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#6a7a78');
        r(9, 13 - fr, 3, 2, '#6a7a78');
        r(3, 6, 10, 8, '#3a4a48');
        r(3, 6, 4, 3, '#6a7a78');
        r(3, 12, 10, 1, '#14141a');
        r(7, 8, 2, 5, '#6a7a78');
        r(1, 7, 2, 5, '#c8d0c0');
        r(13, 7, 2, 5, '#c8d0c0');
        r(5, 1, 6, 6, '#c8d0c0');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#0a0a10');
        r(9, 3, 2, 2, '#0a0a10');
        r(6, 3, 1, 1, '#9affb0');
        r(9, 3, 1, 1, '#9affb0');
        r(7, 6, 3, 1, '#0a0a10');
      } else if (mon === 'ethelgar') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#8a8a96');
        r(9, 13 - fr, 3, 2, '#8a8a96');
        r(3, 6, 10, 8, '#5a5a64');
        r(3, 6, 4, 3, '#8a8a96');
        r(3, 12, 10, 1, '#14141a');
        r(7, 8, 2, 5, '#8a8a96');
        r(1, 7, 2, 5, '#d8d8c8');
        r(13, 7, 2, 5, '#d8d8c8');
        r(5, 1, 6, 6, '#d8d8c8');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#0a0a10');
        r(9, 3, 2, 2, '#0a0a10');
        r(6, 3, 1, 1, '#ffd23a');
        r(9, 3, 1, 1, '#ffd23a');
        r(7, 6, 3, 1, '#0a0a10');
        r(0, 4, 2, 9, '#8a8a96');
        r(13, 3, 1, 10, '#c4cad2');
        r(3, 0, 10, 2, '#7a7a86');
      } else if (mon === 'morwenna_pickman') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#e8e0d0');
        r(9, 13 - fr, 3, 2, '#e8e0d0');
        r(3, 6, 10, 8, '#2a2a40');
        r(3, 6, 4, 3, '#e8e0d0');
        r(3, 12, 10, 1, '#14141a');
        r(7, 8, 2, 5, '#e8e0d0');
        r(1, 7, 2, 5, '#e8e0d0');
        r(13, 7, 2, 5, '#e8e0d0');
        r(5, 1, 6, 6, '#e8e0d0');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#0a0a10');
        r(9, 3, 2, 2, '#0a0a10');
        r(6, 3, 1, 1, '#c070ff');
        r(9, 3, 1, 1, '#c070ff');
        r(7, 6, 3, 1, '#0a0a10');
        r(3, 0, 10, 2, '#e8e0d0');
        r(4, 0, 2, 3, '#c8c0b0');
        r(10, 0, 2, 3, '#c8c0b0');
        r(14, 2, 1, 11, '#6a4426');
        r(13, 1, 3, 2, '#9affb0');
      } else if (mon === 'mere_eel') {
        const w = step === 1 ? 1 : 0;
        r(0, 10 - w, 3, 2, '#2a4a52');
        r(2, 9 + w, 3, 3, '#34606a');
        r(4, 8 - w, 3, 3, '#2a4a52');
        r(6, 8 + w, 3, 3, '#34606a');
        r(8, 7 - w, 3, 3, '#2a4a52');
        r(10, 6, 4, 4, '#3e7480');
        r(10, 6, 4, 1, '#6aa8b4');
        r(14, 7, 2, 2, '#2a4a52');
        r(15, 8, 1, 1, '#d8f0f4');
        r(12, 7, 1, 1, '#ffe05a');
        r(2, 11, 8, 1, '#1c343a');
      } else if (mon === 'drowned_sailor') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#506a68');
        r(9, 13 - fr, 3, 2, '#506a68');
        r(3, 6, 10, 8, '#2a4a4a');
        r(3, 6, 4, 3, '#506a68');
        r(3, 12, 10, 1, '#101820');
        r(7, 8, 2, 5, '#506a68');
        r(1, 7, 2, 5, '#8aa89c');
        r(13, 7, 2, 5, '#8aa89c');
        r(5, 1, 6, 6, '#8aa89c');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#081018');
        r(9, 3, 2, 2, '#081018');
        r(6, 3, 1, 1, '#9affd8');
        r(9, 3, 1, 1, '#9affd8');
        r(7, 6, 3, 1, '#081018');
        r(3, 0, 10, 2, '#1c343a');
        r(1, 12, 2, 2, '#506a68');
      } else if (mon === 'drowned_voice') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#7a7aa0');
        r(9, 13 - fr, 3, 2, '#7a7aa0');
        r(3, 6, 10, 8, '#3a3a5a');
        r(3, 6, 4, 3, '#7a7aa0');
        r(3, 12, 10, 1, '#101820');
        r(7, 8, 2, 5, '#7a7aa0');
        r(1, 7, 2, 5, '#b8c0d8');
        r(13, 7, 2, 5, '#b8c0d8');
        r(5, 1, 6, 6, '#b8c0d8');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#081018');
        r(9, 3, 2, 2, '#081018');
        r(6, 3, 1, 1, '#d8e0ff');
        r(9, 3, 1, 1, '#d8e0ff');
        r(7, 6, 3, 1, '#081018');
        r(4, 0, 8, 1, '#7a7aa0');
        r(2, 3, 1, 4, '#b8c0d8');
        r(13, 3, 1, 4, '#b8c0d8');
      } else if (mon === 'nyth_ael') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#d8c878');
        r(9, 13 - fr, 3, 2, '#d8c878');
        r(3, 6, 10, 8, '#1c4a52');
        r(3, 6, 4, 3, '#d8c878');
        r(3, 12, 10, 1, '#101820');
        r(7, 8, 2, 5, '#d8c878');
        r(1, 7, 2, 5, '#7aa8a0');
        r(13, 7, 2, 5, '#7aa8a0');
        r(5, 1, 6, 6, '#7aa8a0');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#081018');
        r(9, 3, 2, 2, '#081018');
        r(6, 3, 1, 1, '#ffe05a');
        r(9, 3, 1, 1, '#ffe05a');
        r(7, 6, 3, 1, '#081018');
        r(3, 0, 10, 2, '#d8c878');
        r(2, 2, 2, 3, '#d8c878');
        r(12, 2, 2, 3, '#d8c878');
        r(14, 3, 1, 10, '#6a4426');
        r(13, 2, 3, 2, '#7ae8d8');
      } else if (mon === 'ambrose_silt') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#8a8a6a');
        r(9, 13 - fr, 3, 2, '#8a8a6a');
        r(3, 6, 10, 8, '#4a4a3a');
        r(3, 6, 4, 3, '#8a8a6a');
        r(3, 12, 10, 1, '#101820');
        r(7, 8, 2, 5, '#8a8a6a');
        r(1, 7, 2, 5, '#c8c8a8');
        r(13, 7, 2, 5, '#c8c8a8');
        r(5, 1, 6, 6, '#c8c8a8');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#081018');
        r(9, 3, 2, 2, '#081018');
        r(6, 3, 1, 1, '#ffd23a');
        r(9, 3, 1, 1, '#ffd23a');
        r(7, 6, 3, 1, '#081018');
        r(3, 0, 10, 2, '#6a6a4a');
        r(0, 6, 2, 8, '#8a8a6a');
        r(3, 13, 10, 1, '#c8c8a8');
      } else if (mon === 'prince_elrenor') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#d8d8f0');
        r(9, 13 - fr, 3, 2, '#d8d8f0');
        r(3, 6, 10, 8, '#1c2a5a');
        r(3, 6, 4, 3, '#d8d8f0');
        r(3, 12, 10, 1, '#101820');
        r(7, 8, 2, 5, '#d8d8f0');
        r(1, 7, 2, 5, '#a8b8d8');
        r(13, 7, 2, 5, '#a8b8d8');
        r(5, 1, 6, 6, '#a8b8d8');
        r(5, 1, 6, 1, '#ffffff');
        r(6, 3, 2, 2, '#081018');
        r(9, 3, 2, 2, '#081018');
        r(6, 3, 1, 1, '#7affe8');
        r(9, 3, 1, 1, '#7affe8');
        r(7, 6, 3, 1, '#081018');
        r(4, 0, 8, 2, '#f0d860');
        r(4, -1, 2, 2, '#f0d860');
        r(7, -1, 2, 2, '#f0d860');
        r(10, -1, 2, 2, '#f0d860');
        r(14, 2, 1, 11, '#c0c8d8');
        r(13, 1, 3, 2, '#7affe8');
      } else if (mon === 'foreman_below') {
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, '#2a3836');
        r(9, 13 - fr, 3, 2, '#2a3836');
        r(3, 6, 10, 8, '#4a4036');
        r(3, 6, 4, 3, '#62564a');
        r(3, 12, 10, 1, '#2a2018');
        r(7, 7, 1, 1, '#c8a050');
        r(7, 9, 1, 1, '#c8a050');
        r(7, 11, 1, 1, '#c8a050');
        r(1, 7, 2, 5, '#7aa49c');
        r(13, 5, 2, 5, '#5a847c');
        r(13, 3, 1, 10, '#6a4426');
        r(11, 2, 5, 2, '#9aa0aa');
        r(11, 2, 5, 1, '#c4cad2');
        r(4, 1, 8, 6, '#7aa49c');
        r(4, 1, 8, 2, '#98c4bc');
        r(10, 3, 2, 4, '#5a847c');
        r(5, 4, 6, 3, '#2a4a3a');
        r(4, 6, 1, 3, '#2a4a3a');
        r(11, 6, 1, 3, '#2a4a3a');
        r(5, 3, 2, 2, '#0a1a20');
        r(9, 3, 2, 2, '#0a1a20');
        r(5, 3, 1, 1, '#8affea');
        r(9, 3, 1, 1, '#8affea');
        r(3, 0, 10, 2, '#8a7a3a');
        r(3, 0, 10, 1, '#a89850');
        r(7, 0, 2, 1, '#ffe88a');
        r(4, 8, 1, 3, '#6ac8e8');
        r(11, 9, 1, 3, '#6ac8e8');
      } else if (mon === 'pinegrub_goblin' || mon === 'nutcracker_goblin' || mon === 'mind_goblin') {
        const boss = mon === 'mind_goblin';
        const pal = boss
          ? { m: '#7a9a3c', l: '#98b850', d: '#566e28', cloth: '#5a3a24', clothL: '#7a5232' }
          : mon === 'pinegrub_goblin'
            ? { m: '#6a9a48', l: '#86b862', d: '#4a7434', cloth: '#6a4a2c', clothL: '#8a6238' }
            : { m: '#8a9a4c', l: '#a6b868', d: '#667432', cloth: '#4a4a5c', clothL: '#62627a' };
        const fl = step === 1 ? 1 : 0;
        const fr = step === 2 ? 1 : 0;
        r(4, 13 - fl, 3, 2, pal.d);
        r(9, 13 - fr, 3, 2, pal.d);
        r(3, 6, 10, 8, pal.cloth);
        r(3, 6, 4, 3, pal.clothL);
        r(3, 12, 10, 1, '#2a1a10');
        if (boss) {
          r(2, 7, 12, 7, pal.m);
          r(2, 7, 5, 3, pal.l);
          r(9, 10, 5, 4, pal.d);
          r(5, 11, 6, 1, '#2a1a10');
          r(7, 10, 2, 2, '#d8b04a');
        }
        r(1, 7, 2, 4, pal.m);
        r(13, 7, 2, 4, pal.d);
        r(0, 2, 4, 3, pal.m);
        r(12, 2, 4, 3, pal.d);
        r(0, 3, 2, 1, pal.l);
        r(4, 1, 8, 6, pal.m);
        r(4, 1, 8, 2, pal.l);
        r(10, 3, 2, 4, pal.d);
        r(4, 3, 3, 2, '#fff2b0');
        r(9, 3, 3, 2, '#fff2b0');
        r(5, 4, 1, 1, '#c82820');
        r(10, 4, 1, 1, '#c82820');
        r(4, 2, 3, 1, '#2a1a10');
        r(9, 2, 3, 1, '#2a1a10');
        r(7, 4, 2, 2, pal.d);
        r(5, 6, 6, 1, '#2a1010');
        r(5, 5, 1, 2, '#f4ecc8');
        r(10, 5, 1, 2, '#f4ecc8');
        if (boss) {
          r(5, 1, 1, 1, pal.d);
          r(9, 0, 2, 1, pal.d);
          r(3, 4, 1, 1, pal.d);
          r(12, 5, 1, 1, pal.l);
          r(13, 9, 3, 3, '#a8764a');
          r(14, 9, 1, 1, '#d8a46a');
          r(13, 8, 2, 1, '#6a4426');
        } else if (mon === 'pinegrub_goblin') {
          r(13, 8, 2, 4, '#a0743c');
          r(12, 7, 4, 2, '#6a4426');
          r(13, 5, 2, 2, '#4a7a34');
        } else {
          r(13, 3, 2, 9, '#8a5a2c');
          r(12, 2, 4, 3, '#6a6a76');
          r(12, 2, 4, 1, '#9a9aa6');
        }
      } else {
        r(3, 3, 10, 10, '#c04040');
        r(3, 3, 10, 2, '#d85a5a');
      }
    });
    if (BOSS_SCALE[mon]) {
      ctx.save();
      const bx = x + 8 * s;
      const by = y + 15 * s;
      ctx.translate(bx, by);
      ctx.scale(BOSS_SCALE[mon], BOSS_SCALE[mon]);
      ctx.translate(-bx, -by);
      blit(ctx, c, x, y, s, bob);
      ctx.restore();
      return;
    }
    blit(ctx, c, x, y, s, bob);
  }

  /** What a hero visibly holds. Only your own gear is known to the client, so others show a plain blade. */

  // ---- people, resources, and stations of the towns

  const HATS = { none: 0, hood: 1, feather: 2, helm: 3 };

  /** The same figure the players use, dressed in the NPC's own colors. */
  function npcLook(def) {
    if (def.figure) return def.figure;
    const k = def.look;
    const tone = SKIN_TONES[k.skin] || SKIN_TONES[1];
    def.figure = {
      hat: HATS[k.hat] || 0, g: k.g, skin: tone, skinShade: tint(tone, 0.82),
      body: k.cloth, bodyShade: tint(k.cloth, 0.75), bodyLight: tint(k.cloth, 1.25), trim: k.accent,
      hair: k.hair, hairShade: tint(k.hair, 0.75), hairLight: tint(k.hair, 1.25),
    };
    return def.figure;
  }

  /** A tile-sized sprite drawn right on its tile, with no ground shadow. */
  function blitTile(ctx, c, x, y, s) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x - 2 * s), Math.round(y - 2 * s), c.width * s, c.height * s);
  }

  function paintNode(r, node, depleted, phase) {
    const base = node.tint;
    const dark = tint(base, 0.6);
    const light = tint(base, 1.35);
    if (node.art === 'tree') {
      const birch = node.id === 'birch_tree';
      const wood = birch ? '#e4e0d4' : '#6a4426';
      const woodDark = birch ? '#a8a49a' : '#4e301a';
      const wide = node.id === 'oak_tree' ? 4 : 3;
      if (depleted) {
        r(8 - wide, 11, wide * 2, 5, wood);
        r(8 - wide, 11, wide * 2, 1, '#d2a870');
        r(7, 11, 3, 1, '#b88850');
        r(8 - wide, 15, wide * 2, 1, woodDark);
        return;
      }
      r(8 - Math.floor(wide / 2) - 1, 9, wide, 7, wood);
      r(8 + Math.floor(wide / 2) - 1, 9, 1, 7, woodDark);
      if (birch) {
        r(7, 11, 1, 1, '#2a2a2a');
        r(8, 13, 1, 1, '#2a2a2a');
      }
      const rows = [[5, 10], [3, 12], [2, 13], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [2, 13], [3, 12]];
      rows.forEach(([a, b], y) => r(a, y, b - a + 1, 1, y >= 8 ? dark : base));
      for (let y = 2; y < 8; y++) r(12, y, 2, 1, dark);
      r(4, 2, 3, 2, light);
      r(8, 1, 3, 1, light);
      r(3, 5, 2, 1, light);
      r(7, 5, 2, 1, dark);
      r(10, 7, 2, 1, dark);
      if (node.id === 'willow_tree') {
        r(2, 10, 1, 4, base);
        r(4, 11, 1, 3, base);
        r(11, 11, 1, 3, base);
        r(13, 10, 1, 4, base);
      }
    } else if (node.art === 'rock') {
      const rows = [[5, 10], [3, 12], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [3, 12], [4, 11]];
      if (depleted) {
        r(3, 12, 10, 3, '#5c5c68');
        r(5, 11, 6, 1, '#6e6e7a');
        r(4, 12, 2, 1, '#8a8a94');
        r(9, 13, 2, 1, '#8a8a94');
        return;
      }
      rows.forEach(([a, b], i) => r(a, 4 + i, b - a + 1, 1, i >= 7 ? '#5c5c68' : '#8a8a94'));
      for (let i = 0; i < 6; i++) r(11, 5 + i, 2, 1, '#5c5c68');
      r(4, 5, 4, 1, '#b4b4be');
      r(3, 6, 2, 2, '#b4b4be');
      for (const [x, y] of [[4, 8], [9, 6], [7, 10], [11, 9]]) {
        r(x, y, 2, 2, base);
        r(x, y, 1, 1, light);
      }
    } else if (node.art === 'fish') {
      r(5, 9, 5, 2, '#2e5a7c');
      r(10, 9, 2, 1, '#2e5a7c');
      r(10, 11, 2, 1, '#2e5a7c');
      r(6, 9, 1, 1, '#9ad0e8');
      const rx = [3, 5, 7][phase];
      const ry = [1, 2, 3][phase];
      const c = phase === 2 ? tint(base, 0.8) : base;
      r(8 - rx + 1, 9 - ry, rx * 2 - 1, 1, c);
      r(8 - rx + 1, 9 + ry + 1, rx * 2 - 1, 1, c);
      r(8 - rx, 9 - ry + 1, 1, ry * 2, c);
      r(8 + rx, 9 - ry + 1, 1, ry * 2, c);
      if (phase === 1) {
        r(7, 4, 3, 1, '#e8f4fa');
        r(6, 5, 1, 1, '#cfe8f0');
        r(10, 5, 1, 1, '#cfe8f0');
      }
    } else {
      const rows = [[5, 10], [3, 12], [2, 13], [2, 13], [2, 13], [2, 13]];
      rows.forEach(([a, b], i) => r(a, 8 + i, b - a + 1, 1, i > 3 ? dark : base));
      r(4, 9, 3, 1, light);
      if (depleted) {
        r(5, 11, 6, 1, dark);
      } else {
        r(5, 11, 6, 3, '#1a1008');
        r(6, 10, 4, 1, '#1a1008');
        r(6, 13, 4, 1, dark);
      }
      r(1, 13, 2, 2, '#4a8a3c');
      r(13, 13, 2, 2, '#4a8a3c');
      r(2, 12, 1, 1, '#6aae54');
    }
  }

  function drawNode(ctx, node, depleted, x, y, s, now) {
    const phase = node.art === 'fish' ? Math.floor(now / 420) % 3 : 0;
    const c = sprite(`n|${node.id}|${depleted ? 1 : 0}|${phase}`, (r) => paintNode(r, node, depleted, phase));
    blitTile(ctx, c, x, y, s);
  }

  function paintStation(r, id, phase) {
    if (id === 'anchor') {
      r(2, 13, 12, 2, '#4a4a56');
      r(3, 11, 10, 3, '#6a6a76');
      r(3, 11, 10, 1, '#8a8a96');
      r(6, 5, 4, 7, '#7a7a86');
      r(6, 5, 1, 7, '#9a9aa6');
      r(7, 7, 2, 1, '#3a3a46');
      r(7, 9, 2, 1, '#3a3a46');
      r(7, 0 + phase, 2, 5, '#5ec8ff');
      r(6, 1 + phase, 4, 3, '#9ae6ff');
      r(7, 1 + phase, 1, 2, '#ffffff');
      r(phase ? 3 : 12, 4, 1, 1, '#bff0ff');
      r(phase ? 12 : 3, 7, 1, 1, '#8fdcff');
    } else if (id === 'furnace') {
      r(2, 3, 12, 12, '#7a7a84');
      r(2, 3, 12, 2, '#9a9aa4');
      r(12, 5, 2, 10, '#5c5c68');
      r(10, 0, 3, 4, '#5c5c68');
      r(5, 7, 6, 8, '#1a1210');
      r(5, 7, 6, 1, '#454552');
      r(6, 10, 4, 4, phase ? '#ff8a2a' : '#ff7a1a');
      r(7, 9 + phase, 2, 3, '#ffd84a');
      r(11, 1 - phase, 1, 1, '#b0b0b8');
    } else if (id === 'anvil') {
      r(4, 11, 8, 5, '#6a4426');
      r(4, 11, 8, 1, '#8a5a30');
      r(2, 6, 12, 3, '#5c6270');
      r(0, 6, 3, 2, '#6c7280');
      r(4, 9, 8, 2, '#454a56');
      r(3, 6, 10, 1, '#a0a8b8');
      r(12, 3, 1, 3, '#8a5a2c');
      r(11, 2, 3, 2, '#9aa0aa');
    } else if (id === 'range') {
      r(2, 5, 12, 10, '#4a4046');
      r(2, 4, 12, 2, '#2a2428');
      r(2, 5, 12, 1, '#5a5058');
      r(5, 9, 6, 5, '#1a1210');
      r(6, 11, 4, 3, phase ? '#ff8a2a' : '#ff7a1a');
      r(7, 10 + phase, 2, 2, '#ffd84a');
      r(4, 1, 8, 3, '#8a8a94');
      r(4, 1, 8, 1, '#b4b4be');
      r(12, 2, 2, 1, '#6a4426');
    } else if (id === 'bench') {
      r(1, 7, 14, 3, '#a8743c');
      r(1, 7, 14, 1, '#c89050');
      r(2, 10, 2, 5, '#6a4426');
      r(12, 10, 2, 5, '#6a4426');
      r(4, 13, 8, 1, '#6a4426');
      r(3, 4, 1, 3, '#8a5a2c');
      r(2, 4, 3, 1, '#9aa0aa');
      r(7, 6, 6, 1, '#c0c4cc');
      r(12, 5, 2, 1, '#8a5a2c');
    } else if (id === 'bellstone') {
      const glow = phase ? '#9aeaff' : '#5ac8e8';
      r(3, 13, 10, 3, '#454a5c');
      r(5, 1, 6, 13, '#5a6a8a');
      r(6, 0, 4, 1, '#5a6a8a');
      r(5, 1, 1, 13, '#7a8aaa');
      r(10, 2, 1, 12, '#3a4666');
      r(7, 3, 2, 1, glow);
      r(7, 6, 2, 1, glow);
      r(6, 9, 4, 1, glow);
      r(7, 11, 2, 1, glow);
    } else if (id === 'crown_stand') {
      r(4, 8, 8, 7, '#8a7a5a');
      r(3, 7, 10, 2, '#c8b078');
      r(3, 7, 10, 1, '#e0cc98');
      r(5, 5, 6, 3, '#7a1a2a');
      r(5, 5, 6, 1, '#9a2a3a');
      r(7, 6, 2, 1, '#5a0a1a');
      r(4, 14, 8, 1, '#6a5a3a');
    } else if (id.startsWith('sign_')) {
      const warn = id === 'sign_warren' || id === 'sign_delve';
      r(7, 7, 2, 8, '#6a4426');
      r(7, 7, 1, 8, '#8a5a30');
      r(2, 2, 12, 6, warn ? '#7a2a22' : '#8a5a2c');
      r(3, 3, 10, 4, warn ? '#c84a3a' : '#c8965a');
      r(4, 4, 8, 1, warn ? '#f4e4c8' : '#5a3a1c');
      r(4, 6, 6, 1, warn ? '#f4e4c8' : '#5a3a1c');
    } else if (id === 'ruin_stone' || id.startsWith('lore_') || id.startsWith('egg_') || id.startsWith('secret_')) {
      r(4, 4, 8, 11, '#8a8680');
      r(4, 4, 8, 2, '#aaa69c');
      r(9, 6, 3, 9, '#6a6660');
      r(5, 8, 5, 1, '#4a4640');
      r(5, 11, 4, 1, '#4a4640');
      r(3, 14, 10, 1, '#5a564e');
    } else if (id === 'signal_stone') {
      r(3, 10, 10, 5, '#6a6660');
      r(3, 10, 10, 1, '#8a867e');
      r(4, 6, 8, 5, '#4a4640');
      r(5, 6, 6, 1, '#2a2622');
      r(5, 7, 6, 3, '#1a1612');
      r(6, 8, 1, 1, '#5a3a24');
      r(9, 7, 1, 1, '#3a2a1c');
      r(2, 13, 1, 2, '#8a5a30');
    } else if (id === 'notice_board' || id === 'dunhollow_board') {
      r(2, 6, 2, 9, '#6a4426');
      r(12, 6, 2, 9, '#6a4426');
      r(1, 1, 14, 9, '#8a5a2c');
      r(2, 2, 12, 7, '#a8743c');
      r(3, 3, 4, 5, '#efe6d0');
      r(8, 3, 4, 3, '#e8dcb8');
      r(9, 7, 4, 1, '#efe6d0');
      r(4, 3, 1, 1, '#c83030');
      r(9, 3, 1, 1, '#c83030');
    } else {
      r(2, 6, 12, 9, '#8a8a94');
      r(2, 6, 12, 2, '#b4b4be');
      r(4, 8, 8, 4, '#3a78c0');
      r(5, 8, 3, 1, '#6aaaf0');
      r(2, 1, 2, 7, '#6a4426');
      r(12, 1, 2, 7, '#6a4426');
      r(1, 0, 14, 2, '#8a5a2c');
      r(8, 2, 1, 4, '#c8b078');
      r(7, 6, 3, 2, '#6a4426');
    }
  }

  function drawStation(ctx, id, x, y, s, now) {
    const phase = Math.floor(now / 260) % 2;
    const moving = id === 'furnace' || id === 'range' || id === 'bellstone' || id === 'anchor';
    const c = sprite(`s|${id}|${moving ? phase : 0}`, (r) => paintStation(r, id, phase));
    blitTile(ctx, c, x, y, s);
  }

  function heldGear(id) {
    if (id !== G.selfId) return { weapon: 'blade' };
    const eq = (G.inv && G.inv.equipment) || {};
    const def = eq.weapon && G.data && G.data.items.get(eq.weapon.id);
    return { weapon: def ? def.weaponClass || 'blade' : null, shield: Boolean(eq.offhand) };
  }

  // ---- state

  function makeEntity(v, now) {
    return {
      id: v.id,
      name: v.name,
      kind: v.kind || 'player',
      level: v.level || 1,
      mon: v.mon,
      ref: v.ref,
      depleted: Boolean(v.depleted),
      title: v.title,
      fight: Boolean(v.fight),
      x: v.x,
      y: v.y,
      fx: v.x,
      fy: v.y,
      tx: v.x,
      ty: v.y,
      start: now,
      look: look(v.name, v.look),
      chosen: v.look,
      say: null,
      sayUntil: 0,
    };
  }

  function worldPos(e, now) {
    const t = Math.min(1, Math.max(0, (now - e.start) / G.tickMs));
    return { x: e.fx + (e.tx - e.fx) * t, y: e.fy + (e.ty - e.fy) * t, moving: t < 1 && (e.fx !== e.tx || e.fy !== e.ty) };
  }

  function zoneAt(map, x, y) {
    let found = null;
    for (const z of map.zones) if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) found = z;
    return found;
  }

  const KIND_LABEL = { safe: 'Safe', road: 'Road', wilds: 'Wilds', dungeon: 'Dungeon' };

  function addLog(text, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    const log = $('chatlog');
    log.appendChild(li);
    while (log.children.length > LOG_LINES) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  // One-time tips for a new hero. Each shows once per install and is remembered in localStorage.
  const HINTS = {
    walk: 'Tip: click the ground to walk. Scroll or press + and - to zoom, M shows the whole map.',
    monster: 'Tip: click a monster to fight it. Shift-click looks at it without attacking.',
    fight: 'Tip: pick an ability, then click your target. An action ends your turn, so choose well.',
    bag: 'Tip: open the Bag to equip gear. Better weapons change your abilities.',
    defeat: 'Tip: defeat costs a tenth of your iron bits. Your gear and skills are safe.',
    town: 'Tip: click a person to talk, a tree or rock to gather, a furnace or anvil to craft. J opens your journal.',
  };
  function hint(key) {
    let seen = {};
    try {
      seen = JSON.parse(localStorage.getItem('coe.hints') || '{}');
    } catch {
      /* storage can be unavailable; hints then show each session */
    }
    if (seen[key] || !HINTS[key]) return;
    seen[key] = 1;
    try {
      localStorage.setItem('coe.hints', JSON.stringify(seen));
    } catch {
      /* ignore */
    }
    addLog(HINTS[key], 'hint');
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  const play = (name) => window.coeAudio && window.coeAudio.play(name);
  const myCombat = () => (G.stats ? G.stats.combatLevel : 1);

  // ---- server messages

  function handle(msg) {
    if (!G) return early.push(msg);
    const now = performance.now();
    switch (msg.t) {
      case 'state':
        return onState(msg, now);
      case 'stats':
        G.stats = msg;
        hint('walk');
        setTimeout(() => hint('monster'), 6000);
        setTimeout(() => hint('town'), 14000);
        renderStats();
        return refreshTown();
      case 'checkpoint':
        return toast(`Checkpoint set: ${msg.name === 'spawn' ? 'Bellstone Plaza' : pretty(msg.name)}. You wake here after a sign-out or a death.`);
      case 'portal':
        return onPortal(msg, now);
      case 'cast':
        openPortal(msg.ticks * G.tickMs, now);
        {
          const secs = Math.round((msg.ticks * 600) / 1000);
          const dest = G.anchorTravel;
          G.anchorTravel = null;
          return toast(dest ? `Travelling to ${dest}. Stay still for ${secs} seconds.` : `Casting the town portal. Stay still for ${secs} seconds.`);
        }
      case 'look': {
        const me = G.self();
        if (me) {
          me.chosen = msg.look;
          me.look = look(me.name, msg.look);
        }
        return;
      }
      case 'inventory':
        G.inv = msg;
        if (msg.items && msg.items.some((i) => i && i.rarity)) hint('bag');
        renderBag();
        renderJournal();
        return refreshTown();
      case 'fight.start':
        hint('fight');
        return startFight(msg, now);
      case 'fight.update':
        return onFightUpdate(msg);
      case 'fight.end':
        if (G.fight) G.fight.end = msg;
        if (msg.outcome === 'defeat') hint('defeat');
        return;
      case 'log':
        return addLog(msg.text, msg.cls);
      case 'dialog':
        return onDialog(msg);
      case 'shop':
        return onShop(msg);
      case 'storage':
        return onStorage(msg);
      case 'station':
        return onStation(msg);
      case 'perks':
        return onPerks(msg);
      case 'anchors':
        G.anchors = msg.list;
        if (G.town && G.town.kind === 'anchor') renderAnchor();
        return;
      case 'anchor_open':
        G.town = { kind: 'anchor', id: msg.id };
        showTown('panel-anchor');
        return renderAnchor();
      case 'busy':
        return onBusy(msg);
      case 'quests':
        return onQuests(msg);
      case 'close':
        return closeTown(false);
      case 'error':
        if (msg.code === 'cast_cancelled' && G.portal && G.portal.stage === 'open') G.portal = null;
        play('error');
        return toast(ERRORS[msg.code] || `Server: ${msg.code}`);
    }
  }

  function onState(msg, now) {
    for (const v of msg.enter) G.entities.set(v.id, makeEntity(v, now));
    for (const m of msg.move) {
      const e = G.entities.get(m.id);
      if (!e) continue;
      const p = worldPos(e, now);
      // A jump of more than a few tiles is a teleport, not a walk: appear there instead of sliding across the map.
      const jump = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 4;
      e.fx = jump ? m.x : p.x;
      e.fy = jump ? m.y : p.y;
      e.tx = m.x;
      e.ty = m.y;
      e.x = m.x;
      e.y = m.y;
      e.start = now;
      if (jump && m.id === G.selfId && G.portal) G.portal.landed = now;
      else if (m.id === G.selfId && !G.fight) play('step');
    }
    for (const id of msg.leave) G.entities.delete(id);
    for (const f of msg.fight) {
      const e = G.entities.get(f.id);
      if (e) e.fight = f.on;
    }
    for (const c of msg.chat) {
      const e = G.entities.get(c.id);
      if (e) {
        e.say = c.text;
        e.sayUntil = now + BUBBLE_MS;
      }
      addLog(`${c.name}: ${c.text}`, c.id === G.selfId ? 'mine' : '');
    }
    if (G.dest) {
      const me = G.self();
      if (me.x === G.dest.x && me.y === G.dest.y) G.dest = null;
    }
  }

  // ---- fights

  const lowerName = (n) => (n.startsWith('The ') ? n.toLowerCase() : n);
  const who = (id) => {
    if (id === G.selfId) return 'You';
    const a = G.fight.actors.get(id);
    if (!a) return 'Something';
    return a.side === 'hero' || / the /.test(a.name) ? a.name : `The ${a.name}`;
  };

  function makeActor(a) {
    return { ...a, mon: a.mon || a.sprite, look: a.side === 'hero' && !a.sprite ? look(a.name, (G.entities.get(a.id) || {}).chosen) : null, anim: null, lunge: null, flash: 0, fade: 1 };
  }

  function syncFromState(state) {
    const f = G.fight;
    for (const a of state.actors) {
      const have = f.actors.get(a.id);
      if (!have) {
        f.actors.set(a.id, makeActor(a));
        continue;
      }
      have.hp = a.hp;
      have.maxHp = a.maxHp;
      have.mana = a.mana;
      have.maxMana = a.maxMana;
      have.alive = a.alive;
      have.statuses = a.statuses;
      have.facing = a.facing;
      if (!have.anim) have.pos = a.pos;
    }
    f.round = state.round;
    f.order = state.order;
    f.turn = state.turn;
    f.outcome = state.outcome;
  }

  function startFight(msg, now) {
    G.fight = { id: msg.id, actors: new Map(), queue: [], until: now, pending: null, selected: null, options: null, end: null, round: 0, order: [], turn: null, outcome: null, hover: null, result: null };
    syncFromState(msg.state);
    G.fight.options = null;
    G.dest = null;
    addLog('A fight begins!', 'round');
    $('turns').classList.remove('hidden');
    $('fightbar').classList.remove('hidden');
    renderFightUi();
  }

  function onFightUpdate(msg) {
    const f = G.fight;
    if (!f) return;
    for (const ev of msg.events) f.queue.push(ev);
    f.pending = { state: msg.state, options: msg.options };
  }

  function eventDuration(ev) {
    switch (ev.type) {
      case 'move':
        return ev.path.length * MOVE_STEP_MS + 60;
      case 'ability':
        return 240;
      case 'hit':
        return 420;
      case 'miss':
        return 330;
      case 'heal':
        return 420;
      case 'death':
        return 520;
      case 'flee':
        return 420;
      case 'guard':
      case 'status':
      case 'swap':
        return 260;
      case 'dot':
        return 420;
      case 'parry':
        return 330;
      case 'end':
        return 300;
      default:
        return 0;
    }
  }

  function floater(id, text, color) {
    const a = G.fight.actors.get(id);
    if (!a) return;
    const p = a.anim ? a.anim.from : a.pos;
    G.floaters.push({ x: p.x, y: p.y, text, color, t0: performance.now() });
  }

  function applyEvent(ev, now) {
    const f = G.fight;
    const act = (id) => f.actors.get(id);
    switch (ev.type) {
      case 'round':
        f.round = ev.round;
        addLog(`Round ${ev.round}`, 'round');
        break;
      case 'mark':
        f.marks = (f.marks || []).concat(ev.tiles.map((t) => ({ owner: ev.owner, x: t.x, y: t.y })));
        addLog(`${who(ev.owner)} raises its weapon: the marked ground will be crushed on its next turn. Step off it.`, 'bad');
        break;
      case 'turn':
        f.marks = (f.marks || []).filter((m) => m.owner !== ev.actor);
        f.turnActor = ev.actor;
        renderTurns();
        break;
      case 'regen': {
        const a = act(ev.actor);
        if (a) {
          a.hp = Math.min(a.maxHp, a.hp + ev.hp);
          a.mana = Math.min(a.maxMana, a.mana + ev.mana);
        }
        break;
      }
      case 'move': {
        const a = act(ev.actor);
        if (!a || ev.path.length === 0) break;
        a.anim = { from: a.pos, path: ev.path, t0: now };
        if (ev.actor === G.selfId || manhattan(act(G.selfId).pos, a.pos) < 12) play('step');
        break;
      }
      case 'ability': {
        const a = act(ev.actor);
        const name = ABILITY_NAMES[ev.ability] || pretty(ev.ability);
        if (a && ev.targets[0] !== undefined) {
          const t = act(ev.targets[0]);
          if (t && (ev.ability === 'pine_nut_throw' || ev.ability === 'pick_throw')) G.shots.push({ from: { ...a.pos }, to: { ...t.pos }, t0: now, kind: ev.ability });
          else if (t) a.lunge = { dir: dirToward(a.pos, t.pos), t0: now };
        }
        if (ev.targets.length === 0) {
          addLog(`${who(ev.actor)} use${ev.actor === G.selfId ? '' : 's'} ${name}.`);
          play('buff');
        } else {
          addLog(`${who(ev.actor)} ${ev.actor === G.selfId ? 'use' : 'uses'} ${name}.`);
          play('swing');
        }
        break;
      }
      case 'hit': {
        const t = act(ev.target);
        if (t) {
          t.hp = ev.hp;
          t.flash = now;
        }
        floater(ev.target, ev.crit ? `${ev.damage}!` : String(ev.damage), ev.target === G.selfId ? '#ff7a7a' : ev.crit ? '#ffb347' : '#ffe066');
        if (ev.ability === 'crushing_strike') {
          addLog(`The marked ground is crushed. ${who(ev.target)} ${ev.target === G.selfId ? 'take' : 'takes'} ${ev.damage}.`, ev.target === G.selfId ? 'bad' : 'mine');
          play(ev.target === G.selfId ? 'hurt' : 'hit');
          break;
        }
        addLog(
          `${who(ev.source)} ${ev.source === G.selfId ? 'hit' : 'hits'} ${ev.target === G.selfId ? 'you' : lowerName(who(ev.target))} for ${ev.damage}${ev.crit ? ' (critical)' : ''}${ev.prevented > 0 ? `, ${ev.prevented} stopped` : ''}.`,
          ev.source === G.selfId ? 'mine' : 'bad',
        );
        play(ev.source === G.selfId ? 'hit' : 'hurt');
        break;
      }
      case 'miss':
        floater(ev.target, ev.dodged ? 'Dodge' : 'Miss', '#c8c0e0');
        addLog(`${who(ev.source)} ${ev.source === G.selfId ? 'miss' : 'misses'} ${ev.target === G.selfId ? 'you' : lowerName(who(ev.target))}${ev.dodged ? ' (dodged)' : ''}.`);
        play('miss');
        break;
      case 'heal': {
        const a = act(ev.actor);
        if (a) a.hp = ev.hp;
        floater(ev.actor, `+${ev.amount}`, '#7bd88f');
        addLog(`${who(ev.actor)} recover${ev.actor === G.selfId ? '' : 's'} ${ev.amount} health.`, 'mine');
        play('heal');
        break;
      }
      case 'status': {
        const a = act(ev.actor);
        if (a) a.statuses = a.statuses.filter((s) => s.id !== ev.status).concat([{ id: ev.status, rounds: ev.rounds }]);
        const you = ev.actor === G.selfId;
        if (ev.status === 'phase_shield') addLog(`${who(ev.actor)} ${you ? 'raise' : 'raises'} a shield. Break it within ${ev.rounds} rounds or it heals.`, you ? 'mine' : 'bad');
        else if (ev.status === 'stagger') addLog(`${who(ev.actor)} ${you ? 'are' : 'is'} staggered.`);
        else if (ev.status === 'enrage') addLog(`${who(ev.actor)} ${you ? 'fly' : 'flies'} into a rage: more damage, more speed.`, you ? 'bad' : 'mine');
        else if (DEBUFFS.has(ev.status)) addLog(`${who(ev.actor)} ${you ? 'are' : 'is'} afflicted: ${pretty(ev.status)}.`, you ? 'bad' : 'mine');
        else addLog(`${who(ev.actor)} ${you ? 'gain' : 'gains'} ${pretty(ev.status)}.`);
        break;
      }
      case 'dot': {
        const a = act(ev.actor);
        if (a) {
          a.hp = ev.hp;
          a.flash = now;
        }
        floater(ev.actor, String(ev.damage), { poison: '#8be28b', bleed: '#ff6b6b', burn: '#ffa24a' }[ev.status] || '#ffe066');
        addLog(`${ev.actor === G.selfId ? 'You take' : `${who(ev.actor)} takes`} ${ev.damage} from ${ev.status}.`, ev.actor === G.selfId ? 'bad' : 'mine');
        play('hurt');
        break;
      }
      case 'parry':
        floater(ev.actor, 'Parry', '#9ec7ff');
        addLog(`${who(ev.actor)} ${ev.actor === G.selfId ? 'parry' : 'parries'} ${who(ev.source)}.`);
        play('guard');
        break;
      case 'swap': {
        const a = act(ev.actor);
        if (a) a.lunge = null;
        addLog(`${who(ev.actor)} ${ev.actor === G.selfId ? 'swap' : 'swaps'} weapons.`);
        play('click');
        break;
      }
      case 'guard':
        floater(ev.actor, 'Guard', '#9ec7ff');
        addLog(`${who(ev.actor)} ${ev.actor === G.selfId ? 'guard' : 'guards'}.`);
        play('guard');
        break;
      case 'spawn':
        if (!G.fight.actors.has(ev.actor.id)) G.fight.actors.set(ev.actor.id, makeActor(ev.actor));
        addLog(`${who(ev.actor.ownerId)} call${ev.actor.ownerId === G.selfId ? '' : 's'} a familiar.`, 'mine');
        play('buff');
        break;
      case 'death': {
        f.marks = (f.marks || []).filter((m) => m.owner !== ev.actor);
        const a = act(ev.actor);
        if (a) a.alive = false;
        addLog(ev.actor === G.selfId ? 'You fall.' : `${who(ev.actor)} falls.`, ev.actor === G.selfId ? 'bad' : 'mine');
        play('death');
        break;
      }
      case 'flee':
        addLog(ev.success ? 'You escaped.' : 'You failed to escape.');
        play('flee');
        break;
      case 'end':
        break;
    }
  }

  function actorPos(a, now) {
    if (a.anim) {
      const e = now - a.anim.t0;
      const i = Math.floor(e / MOVE_STEP_MS);
      if (i >= a.anim.path.length) {
        a.pos = a.anim.path[a.anim.path.length - 1];
        a.anim = null;
      } else {
        const from = i === 0 ? a.anim.from : a.anim.path[i - 1];
        const to = a.anim.path[i];
        const t = (e - i * MOVE_STEP_MS) / MOVE_STEP_MS;
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, moving: true };
      }
    }
    return { x: a.pos.x, y: a.pos.y, moving: false };
  }

  /** Plays queued events one at a time, then hands control back to the player. */
  function runFightQueue(now) {
    const f = G.fight;
    if (now < f.until) return;
    if (f.queue.length) {
      const ev = f.queue.shift();
      applyEvent(ev, now);
      f.until = now + eventDuration(ev);
      return;
    }
    if (f.pending) {
      const { state, options } = f.pending;
      f.pending = null;
      syncFromState(state);
      f.options = options;
      if (options && options.actor === G.selfId) f.selected = basicOf(options);
      renderFightUi();
    }
    if (f.end && !f.options && !f.pending) finishFight();
  }

  function finishFight() {
    const f = G.fight;
    const end = f.end;
    G.fight = null;
    $('turns').classList.add('hidden');
    $('fightbar').classList.add('hidden');
    $('toast').classList.remove('show');

    // The outcome and everything gained go to the chat log, one line each. No window to close.
    const head = end.outcome === 'victory' ? 'Victory!' : end.outcome === 'defeat' ? 'Defeated.' : 'You got away.';
    addLog(head, end.outcome === 'victory' ? 'win' : end.outcome === 'defeat' ? 'bad' : 'round');
    const xp = Object.values(end.xp).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
    if (xp > 0) addLog(`You gain ${xp} experience.`, 'round');
    for (const lu of end.levelUps) addLog(lu.skill === 'combat' ? `You reached combat level ${lu.level}. Press K to spend your skill points.` : `Your ${pretty(lu.skill)} level has increased to ${lu.level}.`, 'levelup');
    if (end.loot.iron_bits > 0) addLog(`You find ${end.loot.iron_bits} iron bits.`, 'loot');
    for (const it of end.loot.items || []) addLog(`You find ${itemName(it)}.`, `loot ${it.rarity || ''}`.trim());
    if (end.penalty && end.penalty.iron_bits > 0) addLog(`You lose ${end.penalty.iron_bits} iron bits.`, 'bad');
    if (end.loot.lost) addLog('Your bag is full. The loot was left behind.', 'bad');
    if (end.outcome === 'defeat') addLog('You wake at the bellstone, weary but whole.', 'round');
    if (end.outcome === 'fled') addLog('You escaped from the fight.', 'round');
    play(end.outcome === 'victory' ? 'victory' : end.outcome === 'defeat' ? 'defeat' : 'flee');
    if (end.levelUps.length) setTimeout(() => play('level'), 700);
    if (end.loot.iron_bits > 0 || (end.loot.items && end.loot.items.length)) setTimeout(() => play('coin'), 400);
  }

  // ---- fight controls

  const isMyTurn = () => Boolean(G.fight && G.fight.options && G.fight.options.actor === G.selfId && !G.fight.queue.length);
  const hero = () => G.fight.actors.get(G.selfId);

  function sendFight(action) {
    if (!isMyTurn()) return;
    G.fight.options = null;
    renderFightUi();
    window.coe.send({ t: 'fight', action });
  }

  const basicOf = (options) => (options.abilities.find((a) => BASIC_ATTACKS.includes(a.id)) || options.abilities[0] || {}).id || null;

  function aimHint(opt) {
    switch (opt.shape) {
      case 'front3x3':
        return 'Click toward the enemies to strike a 3 by 3 area in front of you.';
      case 'area':
        return `Click a tile within ${opt.range} tiles.`;
      case 'ranged':
      case 'chain':
        return `Click an enemy within ${opt.range} tiles.`;
      case 'multi':
        return `Click an enemy within ${opt.range} tiles. The nearest others are hit too.`;
      default:
        return 'Click an adjacent enemy.';
    }
  }

  function selectAbility(id) {
    if (!isMyTurn()) return;
    const opt = G.fight.options.abilities.find((a) => a.id === id);
    if (!opt) return;
    if (!opt.usable) return toast(opt.reason === 'mana' ? 'Not enough mana.' : opt.reason === 'cooldown' ? `Ready in ${opt.cooldown} rounds.` : opt.reason === 'acted' ? 'You have already acted this turn.' : 'No enemy in reach.');
    play('click');
    if (opt.shape === 'self' || opt.shape === 'ring') return sendFight({ t: 'ability', id });
    G.fight.selected = id;
    renderFightUi();
    toast(aimHint(opt));
  }

  function foodSlot() {
    if (!G.inv || !G.data) return -1;
    return G.inv.items.findIndex((s) => s && G.data.items.get(s.id)?.kind === 'food');
  }

  function fightTileClick(t) {
    if (!isMyTurn()) return;
    const f = G.fight;
    const h = hero();
    const target = [...f.actors.values()].find((a) => a.side === 'enemy' && a.alive && a.pos.x === t.x && a.pos.y === t.y);
    let sel = f.options.abilities.find((a) => a.id === f.selected);
    if (!sel || !sel.usable) sel = f.options.abilities.find((a) => a.id === basicOf(f.options) && a.usable);

    if (sel) {
      const range = sel.range || 1;
      switch (sel.shape) {
        case 'front3x3':
          return sendFight({ t: 'ability', id: sel.id, dir: dirToward(h.pos, target ? target.pos : t) });
        case 'area':
          if (manhattan(h.pos, t) > range) return toast(`Out of range. The limit is ${range} tiles.`);
          return sendFight({ t: 'ability', id: sel.id, at: { x: t.x, y: t.y } });
        case 'adjacent':
          if (target) {
            if (manhattan(h.pos, target.pos) !== 1) return toast('Too far away. Move next to the target first.');
            return sendFight({ t: 'ability', id: sel.id, target: target.id });
          }
          break;
        case 'ranged':
        case 'multi':
        case 'chain':
          if (target) {
            if (manhattan(h.pos, target.pos) > range) return toast(`Out of range. The limit is ${range} tiles. Move closer.`);
            return sendFight({ t: 'ability', id: sel.id, target: target.id });
          }
          break;
        default:
          break;
      }
    }
    if (target) return toast(sel ? 'Pick a different ability, or move.' : "You can't attack right now.");
    if (f.options.reach.some((p) => p.x === t.x && p.y === t.y)) return sendFight({ t: 'move', to: { x: t.x, y: t.y } });
    toast("You can't move there.");
  }

  function fightKey(key) {
    if (!isMyTurn()) return false;
    const f = G.fight;
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (/^[0-9]$/.test(k)) {
      const opt = f.options.abilities[k === '0' ? 9 : Number(k) - 1];
      if (opt) selectAbility(opt.id);
      return true;
    }
    if (k === 'q') {
      if (!f.options.canSwap) toast(f.options.acted ? 'You have already acted this turn.' : 'You have no second weapon. Shift-click a weapon in your bag to place it in the swap slot.');
      else sendFight({ t: 'swap' });
      return true;
    }
    if (k === 'g') return sendFight({ t: 'guard' }), true;
    if (k === 'f') return sendFight({ t: 'flee' }), true;
    if (k === ' ') return sendFight({ t: 'end' }), true;
    if (k === 'e') {
      const slot = foodSlot();
      if (slot < 0) toast('You have no food.');
      else sendFight({ t: 'eat', slot });
      return true;
    }
    const dir = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E', w: 'N', s: 'S', a: 'W', d: 'E' }[k];
    if (dir) {
      const h = hero();
      const to = { x: h.pos.x + VEC[dir][0], y: h.pos.y + VEC[dir][1] };
      const enemy = [...f.actors.values()].find((a) => a.side === 'enemy' && a.alive && a.pos.x === to.x && a.pos.y === to.y);
      if (enemy) fightTileClick(to);
      else if (f.options.reach.some((p) => p.x === to.x && p.y === to.y)) sendFight({ t: 'move', to });
      else toast("You can't move there.");
      return true;
    }
    return false;
  }

  // ---- fight and panel UI

  function renderTurns() {
    const f = G.fight;
    if (!f) return;
    const el = $('turns');
    el.textContent = '';
    for (const id of f.order) {
      const a = f.actors.get(id);
      if (!a || !a.alive) continue;
      const chip = document.createElement('span');
      chip.className = 'chip ' + a.side + (id === f.turnActor ? ' active' : '');
      const nm = document.createElement('div');
      nm.textContent = id === G.selfId ? `You (level ${a.level})` : `${a.name} (level ${a.level})`;
      chip.appendChild(nm);
      if (a.side === 'enemy') {
        const note = foeNote(a.level);
        if (note) {
          const sub = document.createElement('div');
          sub.className = 'chip-sub';
          sub.textContent = note;
          chip.appendChild(sub);
        }
      }
      if (a.statuses.length) {
        const row = document.createElement('div');
        row.className = 'chip-status';
        for (const st of a.statuses) {
          const tag = document.createElement('span');
          tag.className = 'st ' + (DEBUFFS.has(st.id) ? 'debuff' : 'buff');
          tag.textContent = `${pretty(st.id)} ${st.rounds}`;
          row.appendChild(tag);
        }
        chip.appendChild(row);
      }
      el.appendChild(chip);
    }
  }

  function renderFightUi() {
    const f = G.fight;
    if (!f) return;
    renderTurns();
    const info = $('fightinfo');
    const h = hero();
    const opts = f.options;
    const statuses = h ? h.statuses.map((s) => `${pretty(s.id)} (${s.rounds})`).join(', ') : '';
    info.textContent =
      `Round ${f.round}: ` +
      (opts && opts.actor === G.selfId ? `Your turn. ${opts.moveLeft} moves left. Taking an action ends your turn.` : 'Waiting for the other side to act.') +
      (statuses ? `  -  ${statuses}` : '');

    const box = $('actions');
    box.textContent = '';
    if (!opts || opts.actor !== G.selfId) return;
    opts.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act' + (a.id === f.selected ? ' selected' : '');
      b.disabled = !a.usable;
      const info = ABILITY_INFO[a.id];
      const why = a.usable ? '' : a.reason === 'mana' ? 'Not enough mana' : a.reason === 'cooldown' ? `Ready in ${a.cooldown} rounds` : a.reason === 'acted' ? 'Already acted' : 'No enemy in reach';
      b.title = [info ? info[1] : '', a.mana ? `Costs ${a.mana} mana.` : '', why].filter(Boolean).join('\n');
      b.textContent = `${i === 9 ? 0 : i < 9 ? i + 1 : '-'} ${a.name}${a.mana ? ` (${a.mana})` : ''}${a.cooldown ? ` ${a.cooldown}r` : ''}`;
      b.addEventListener('click', () => selectAbility(a.id));
      box.appendChild(b);
    });
    const extra = (label, onClick, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act';
      b.textContent = label;
      b.disabled = Boolean(disabled);
      b.addEventListener('click', onClick);
      box.appendChild(b);
    };
    if (opts.canSwap || G.inv?.equipment?.weapon2) extra('Q Swap weapon', () => (opts.canSwap ? sendFight({ t: 'swap' }) : toast('You have already acted this turn.')), !opts.canSwap);
    extra('G Guard', () => sendFight({ t: 'guard' }), opts.acted);
    extra('E Eat', () => (foodSlot() < 0 ? toast('You have no food.') : sendFight({ t: 'eat', slot: foodSlot() })), opts.acted);
    extra('F Flee', () => sendFight({ t: 'flee' }), opts.acted);
    extra('Space End turn', () => sendFight({ t: 'end' }), false);
  }

  function renderStats() {
    const s = G.stats;
    if (!s) return;
    $('w-iron').textContent = String(s.wallet.iron_bits);
    $('w-gold').textContent = String(s.wallet.gold_coins);
    $('w-favor').textContent = String(s.wallet.favor_tokens);
    const xp = (s.skills.combat && s.skills.combat.xp) || 0;
    const cur = xpForLevel(s.combatLevel);
    const next = xpForLevel(s.combatLevel + 1);
    $('combat-level').textContent = s.combatLevel >= MAX_LEVEL ? `Level ${s.combatLevel} (max)` : `Level ${s.combatLevel}: ${xp - cur} / ${next - cur} XP`;
    const vit = $('stats-vitals');
    vit.textContent = '';
    const vh = document.createElement('h3');
    vh.textContent = 'Character';
    const vl = document.createElement('dl');
    for (const [k, v] of [
      ['Level', String(s.combatLevel)],
      ['Experience', String(xp)],
      ['Health', `${s.hp} / ${s.maxHp}`],
      ['Mana', `${s.mana} / ${s.maxMana}`],
      ['Skill points', String(s.points)],
    ]) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      vl.append(dt, dd);
    }
    vit.append(vh, vl);
    $('level-bar').firstElementChild.style.width = s.combatLevel >= MAX_LEVEL ? '100%' : `${Math.min(100, ((xp - cur) / (next - cur)) * 100)}%`;
    renderTree();
    renderTrades();
  }

  /** The Trades window: every gathering and crafting skill with its level and progress. */
  function renderTrades() {
    const s = G.stats;
    const box = $('trades-body');
    if (!s || !box) return;
    box.textContent = '';
    for (const id of Object.keys(SKILL_LABEL)) {
      const e = s.skills[id] || { xp: 0, level: 1 };
      const cap = e.level >= WORK_CAP;
      const cur = xpForLevel(e.level);
      const next = xpForLevel(e.level + 1);
      const row = document.createElement('div');
      row.className = 'trade-row';
      const top = document.createElement('div');
      top.className = 'top';
      const name = document.createElement('span');
      name.textContent = SKILL_LABEL[id];
      const lv = document.createElement('b');
      lv.textContent = cap ? `Level ${e.level} (max)` : `Level ${e.level}`;
      top.append(name, lv);
      const bar = document.createElement('div');
      bar.className = 'trade-bar';
      const fill = document.createElement('div');
      fill.style.width = cap ? '100%' : `${Math.max(0, Math.min(100, ((e.xp - cur) / (next - cur)) * 100))}%`;
      bar.appendChild(fill);
      const note = document.createElement('div');
      note.className = 'muted';
      note.textContent = cap ? `${e.xp} XP` : `${e.xp - cur} / ${next - cur} XP to level ${e.level + 1}`;
      row.append(top, bar, note);
      box.appendChild(row);
    }
  }

  /** The skill tree screen: four tabs, six rows of two skills, a point to spend on each. */
  function renderTree() {
    const s = G.stats;
    if (!s || !G.data) return;
    const trees = G.data.trees || [];
    const ranks = s.ranks || {};
    const byId = new Map(trees.map((t) => [t.id, t]));
    $('skill-points').textContent = `${s.points} skill point${s.points === 1 ? '' : 's'} to spend`;
    const tabs = $('tree-tabs');
    tabs.textContent = '';
    for (const name of TREE_NAMES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = pretty(name);
      b.className = name === treeTab ? 'on' : '';
      b.onclick = () => {
        treeTab = name;
        renderTree();
      };
      tabs.appendChild(b);
    }
    const grid = $('tree-grid');
    grid.textContent = '';
    for (let row = 0; row < 6; row++) {
      const lv = document.createElement('span');
      lv.className = 'lv';
      lv.textContent = `Lv ${ROW_LEVELS[row]}`;
      grid.appendChild(lv);
      for (let col = 0; col < 2; col++) {
        const sk = trees.find((t) => t.tree === treeTab && t.row === row && t.col === col);
        if (!sk) {
          const gap = document.createElement('span');
          gap.className = 'spacer';
          grid.appendChild(gap);
          continue;
        }
        const rank = ranks[sk.id] || 0;
        const rowLocked = s.combatLevel < ROW_LEVELS[row];
        const missing = sk.needs.filter((n) => !(ranks[n] > 0)).map((n) => (byId.get(n) || { name: n }).name);
        const locked = sk.planned || rowLocked || missing.length > 0;
        const canSpend = !locked && s.points > 0 && rank < 10;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'node' + (sk.passive ? ' passive' : '') + (rank > 0 ? ' ranked' : '') + (canSpend ? ' ready' : '') + (locked ? ' locked' : '');
        const name = document.createElement('span');
        name.textContent = sk.name;
        const r = document.createElement('b');
        r.textContent = sk.planned ? 'soon' : `${rank}/10`;
        b.append(name, r);
        const tip = [sk.name + (sk.passive ? ' (passive)' : ''), sk.blurb];
        if (sk.needs.length) tip.push(`Needs: ${sk.needs.map((n) => (byId.get(n) || { name: n }).name).join(', ')}`);
        if (rowLocked) tip.push(`Opens at level ${ROW_LEVELS[row]}`);
        else if (missing.length) tip.push(`Raise first: ${missing.join(', ')}`);
        if (!sk.passive && !sk.planned) tip.push('Each rank adds 6% damage and 3% mana cost. Ranks 5 and 10 shorten the cooldown.');
        b.title = tip.join('\n');
        b.onclick = () => {
          if (G.fight) return toast("You can't change skills in a fight.");
          if (canSpend) window.coe.send({ t: 'spend', skill: sk.id });
          else if (sk.planned) toast('This skill is coming in a future update.');
          else if (rank >= 10) toast('This skill is already at its maximum rank.');
          else if (rowLocked) toast(`Opens at level ${ROW_LEVELS[row]}.`);
          else if (missing.length) toast(`Raise ${missing.join(' and ')} before unlocking this skill.`);
          else toast('You have no skill points to spend.');
        };
        grid.appendChild(b);
      }
    }
    const respec = $('respec');
    respec.textContent = s.respecCost ? `Respec (${s.respecCost} iron bits)` : 'Respec (free)';
    respec.onclick = () => {
      if (G.fight) return toast("You can't change skills in a fight.");
      window.coe.send({ t: 'respec' });
    };
  }

  const itemName = (ref) => {
    const def = G.data && G.data.items.get(ref.id);
    return `${def ? def.name : pretty(ref.id)}${ref.rarity && ref.rarity !== 'basic' ? ` (${ref.rarity})` : ''}`;
  };

  function modText(m) {
    const spec = G.data && G.data.mods && G.data.mods[m.m];
    if (!spec) return `${m.m} tier ${m.t}`;
    return `+${spec.tiers[m.t - 1]}${spec.unit} ${spec.label}`;
  }

  /** Mirrors LEGENDARY_POWERS in the shared gear module. */
  const POWER_TEXT = {
    unmoving: ['Unmoving', 'Immune to stagger and slow.', '-1 tile of movement.'],
    thorns: ['Thorns', 'Reflects 20% of the melee damage you take back at the attacker.', '-15% damage dealt.'],
  };

  function itemTip(ref) {
    const def = G.data && G.data.items.get(ref.id);
    if (!def) return ref.id;
    const lines = [itemName(ref)];
    if (def.kind === 'weapon') {
      lines.push(`${pretty(def.weaponClass || 'blade')}, power ${def.weaponPower}${def.weaponClass === 'dagger' ? ', two actions a turn' : ''}`);
      if (WEAPON_BLURB[def.weaponClass]) lines.push(WEAPON_BLURB[def.weaponClass]);
    }
    if (def.kind === 'armor') {
      lines.push(`${pretty(def.slot || 'armor')}${def.armor ? `, armor ${def.armor}` : ''}`);
      if (def.flatReduction) lines.push(`Blocks ${def.flatReduction} damage from every hit`);
    }
    if (def.kind === 'food') lines.push(`Restores ${def.heal} health`);
    else if (def.kind === 'tool') lines.push(`${pretty(def.toolType)}, tier ${def.tier}. Kept in your bag; it is not worn.`);
    else if (def.kind === 'material') lines.push('Crafting material');
    else {
      lines.push(`Tier ${def.tier}: needs level ${TIER_LEVELS[def.tier - 1]}`);
    }
    if (def.value) lines.push(`Worth ${def.value} iron bits`);
    if (def.bossOnly) lines.push('Dropped only by dungeon bosses.');
    else if (def.dropOnly) lines.push('Monster drop only. Not sold in shops.');
    const power = def.power && POWER_TEXT[def.power];
    if (power) lines.push(`Power, ${power[0]}: ${power[1]} Cost: ${power[2]}`);
    for (const m of ref.mods || []) lines.push(modText(m));
    return lines.join('\n');
  }

  /** The equipment screen's totals: what the worn gear adds up to. */
  function renderGear(g) {
    const box = $('gear-stats');
    box.textContent = '';
    if (!g) return;
    const pct = (v) => `${Math.round(v * 1000) / 10}%`;
    const rows = [
      ['Armor', `${g.armor} (${pct(g.armor / (g.armor + 100))} less damage)`],
      ['Shield block', g.flatReduction ? `${g.flatReduction} off every hit` : 'none'],
      ['Weapon', g.weapon.cls ? `${pretty(g.weapon.cls)}, max hit ${g.weapon.maxHit}${g.weapon.actions > 1 ? ` x${g.weapon.actions}` : ''}` : `Fists, max hit ${g.weapon.maxHit}`],
      ['Damage', `${g.damagePct >= 0 ? '+' : ''}${pct(g.damagePct)}`],
      ['Crit chance', pct(g.critChance)],
      ['Crit damage', `+${pct(g.critDamage)}`],
      ['Accuracy', `+${g.accuracy}`],
      ['Hit chance', g.weapon.cls === 'staff' ? '100% (spells never miss)' : `${pct(myHitChance((G.stats && G.stats.combatLevel) || 1))} against level ${(G.stats && G.stats.combatLevel) || 1}`],
      ['Dodge', pct(g.dodge)],
      ['Life leech', pct(g.leech)],
      ['Bonus health', `+${g.maxHp}`],
      ['Bonus mana', `+${g.maxMana}`],
      ['Speed', `${g.speed > 0 ? '+' : ''}${g.speed}`],
    ];
    const h = document.createElement('h3');
    h.textContent = 'Combat bonuses';
    const dl = document.createElement('dl');
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    box.append(h, dl);
    if (g.weapon.cls && WEAPON_BLURB[g.weapon.cls]) {
      const p = document.createElement('p');
      p.textContent = WEAPON_BLURB[g.weapon.cls];
      box.appendChild(p);
    }
  }

  // ---- item icons: drawn in code, one per item, tinted by material and tier

  const METALS = [
    { l: '#e8a060', m: '#c8803c', d: '#8a5020' }, // bronze
    { l: '#c4cad2', m: '#9aa0aa', d: '#656c78' }, // iron
    { l: '#eef4ff', m: '#c8d4e4', d: '#8494ac' }, // steel
    { l: '#b8e4ff', m: '#6ab8ff', d: '#3a78c0' }, // mithril
  ];
  const LEATHERS = [
    { l: '#c08a52', m: '#9a6a3a', d: '#6a4424' }, // soft leather
    { l: '#a2683c', m: '#7a4a2a', d: '#4e2e18' }, // hardened leather
    { l: '#c4cad2', m: '#9aa0aa', d: '#656c78' }, // chain
    { l: '#b8e4ff', m: '#6ab8ff', d: '#3a78c0' }, // mithril
  ];
  const WOODS = [
    { l: '#e8cc8c', m: '#c8a868', d: '#8a6c38' }, // pine, hazel
    { l: '#f6ecd0', m: '#e0d4b4', d: '#a89c7c' }, // birch, rowan
    { l: '#bc9058', m: '#9a7040', d: '#684a28' }, // oak, yew
    { l: '#a0c078', m: '#7a9a58', d: '#4e6a38' }, // willow, elder
  ];
  const ORBS = ['#ff9a5a', '#ffe66a', '#7ae87a', '#c88aff'];
  const AMULETS = [
    { l: '#f0b090', m: '#c87850', d: '#8a4a30' }, // copper
    { l: '#f4f4fc', m: '#c4c8d8', d: '#8a90a8' }, // silver
    { l: '#fff0a0', m: '#f0c030', d: '#b07818' }, // gold
    { l: '#e8f8ff', m: '#a8d8ff', d: '#6a9ad0' }, // moonsilver
  ];
  const GEMS = ['#e04a4a', '#4a8aff', '#4ae080', '#c85aff'];

  const LOG_COLORS = { pine: '#a0743c', birch: '#e4dcc8', oak: '#8a5a2c', willow: '#b8a070' };
  const ORE_COLORS = { copper: '#c8803c', tin: '#b8c0d0', iron: '#8a6a58', moonsilver: '#bfe4ff', coal: '#38343c' };
  const BAR_METAL = { bronze: 0, iron: 1, steel: 2, moonsilver: 3 };
  const HIDE_COLORS = { soft_leather: '#b88a5a', hard_leather: '#8a5a34', stagskin: '#a07a4a', shadowhide: '#4a3a5a' };
  const FISH_COLORS = { shrimp: '#f08a7a', trout: '#8aa890', salmon: '#f09060', tuna: '#6a88a8' };

  /** Tools, materials, and the food that is not a plain roll. Returns true when it drew something. */
  function paintWorkItem(r, def) {
    const t = Math.max(0, Math.min(3, (def.tier || 1) - 1));
    const id = def.id;
    if (def.kind === 'tool') {
      const m = METALS[t];
      const w = WOODS[t];
      if (def.toolType === 'axe') {
        r(7, 4, 2, 11, w.m);
        r(7, 4, 1, 11, w.l);
        r(8, 1, 5, 6, m.m);
        r(8, 1, 5, 1, m.l);
        r(12, 2, 1, 4, m.l);
        r(8, 6, 5, 1, m.d);
      } else if (def.toolType === 'pickaxe') {
        r(7, 3, 2, 12, w.m);
        r(7, 3, 1, 12, w.l);
        r(2, 2, 12, 2, m.m);
        r(2, 2, 12, 1, m.l);
        r(1, 3, 2, 2, m.m);
        r(13, 3, 2, 2, m.m);
        r(1, 5, 1, 1, m.d);
        r(14, 5, 1, 1, m.d);
      } else if (def.toolType === 'rod') {
        for (let i = 0; i < 12; i++) r(2 + i, 13 - i, 2, 1, i % 4 === 3 ? w.d : w.m);
        r(14, 2, 1, 7, '#ece8d6');
        r(13, 9, 2, 1, '#c0c4cc');
        r(13, 10, 1, 1, '#c0c4cc');
        if (t === 3) {
          r(12, 0, 4, 3, '#ffe66a');
          r(13, 1, 2, 1, '#ffffff');
        }
        r(2, 13, 3, 2, '#6a4020');
      } else {
        const rope = ['#c8a468', '#a8844a', '#d8d4c0', '#7a6a9a'][t];
        if (id.includes('net')) {
          for (let y = 3; y <= 12; y += 3) r(2, y, 12, 1, rope);
          for (let x = 2; x <= 13; x += 3) r(x, 3, 1, 10, rope);
          r(2, 2, 12, 1, '#6a4426');
        } else if (id.includes('pit')) {
          r(2, 6, 12, 7, '#2a1a10');
          r(2, 5, 12, 1, '#8a5a30');
          r(2, 13, 12, 1, '#8a5a30');
          for (let x = 3; x <= 12; x += 3) r(x, 6, 1, 6, rope);
        } else {
          r(4, 3, 8, 1, rope);
          r(3, 4, 1, 8, rope);
          r(12, 4, 1, 8, rope);
          r(4, 12, 8, 1, rope);
          r(7, 12, 2, 3, '#6a4426');
          r(8, 4, 5, 1, rope);
        }
      }
      return true;
    }
    if (def.kind === 'material') {
      if (id.endsWith('_logs')) {
        const col = LOG_COLORS[id.replace('_logs', '')] || '#a0743c';
        for (const [x, y, w] of [[1, 9, 12], [3, 5, 12], [1, 12, 12]]) {
          r(x, y, w, 3, col);
          r(x, y, w, 1, tint(col, 1.25));
          r(x + w - 1, y, 1, 3, '#d8b878');
          r(x + w - 2, y + 1, 1, 1, '#a88858');
        }
        return true;
      }
      if (id.endsWith('_ore') || id === 'coal') {
        const col = ORE_COLORS[id === 'coal' ? 'coal' : id.replace('_ore', '')] || '#8a8a94';
        r(3, 5, 10, 8, '#8a8a94');
        r(5, 3, 6, 2, '#8a8a94');
        r(3, 5, 4, 1, '#b4b4be');
        r(10, 9, 3, 4, '#5c5c68');
        for (const [x, y] of [[4, 7], [8, 6], [6, 10], [10, 8]]) r(x, y, 2, 2, col);
        r(4, 7, 1, 1, tint(col, 1.4));
        r(8, 6, 1, 1, tint(col, 1.4));
        return true;
      }
      if (id.endsWith('_bar')) {
        const m = METALS[BAR_METAL[id.replace('_bar', '')] || 0];
        r(2, 8, 12, 5, m.m);
        r(4, 6, 9, 2, m.l);
        r(2, 8, 12, 1, m.l);
        r(12, 8, 2, 5, m.d);
        r(2, 12, 12, 1, m.d);
        return true;
      }
      if (HIDE_COLORS[id]) {
        const c = HIDE_COLORS[id];
        r(3, 3, 10, 10, c);
        r(2, 5, 12, 6, c);
        r(3, 3, 4, 3, tint(c, 1.25));
        r(9, 9, 4, 4, tint(c, 0.75));
        r(1, 4, 2, 2, c);
        r(13, 4, 2, 2, c);
        r(1, 11, 2, 2, tint(c, 0.75));
        r(13, 11, 2, 2, tint(c, 0.75));
        return true;
      }
      if (id.startsWith('raw_') && FISH_COLORS[id.slice(4)]) {
        const c = FISH_COLORS[id.slice(4)];
        r(2, 6, 9, 5, c);
        r(3, 5, 6, 1, tint(c, 1.2));
        r(11, 5, 3, 7, c);
        r(1, 7, 1, 3, tint(c, 0.7));
        r(4, 8, 1, 1, '#2a1a14');
        r(5, 10, 5, 1, tint(c, 0.75));
        return true;
      }
      if (id === 'raw_rabbit') {
        r(3, 5, 9, 7, '#d86a6a');
        r(4, 4, 6, 1, '#e88a8a');
        r(11, 7, 3, 3, '#f0e8d0');
        r(5, 9, 5, 1, '#b04a4a');
        return true;
      }
      r(3, 3, 10, 10, '#8a8a9a');
      return true;
    }
    if (def.kind === 'food') {
      if (id === 'bread') {
        r(2, 6, 12, 7, '#c88a44');
        r(3, 5, 10, 1, '#d8a460');
        r(2, 12, 12, 1, '#98642c');
        for (const x of [4, 7, 10]) r(x, 7, 1, 3, '#e8c488');
        return true;
      }
      if (id === 'cooked_rabbit') {
        r(3, 5, 8, 7, '#b86a34');
        r(4, 4, 5, 1, '#d88a4a');
        r(10, 8, 4, 2, '#f0e8d0');
        r(13, 7, 2, 4, '#f0e8d0');
        r(5, 9, 4, 1, '#8a4a22');
        return true;
      }
      if (id.startsWith('cooked_')) {
        const c = { shrimp: '#e8884a', trout: '#b88a5a', salmon: '#e8885a', tuna: '#a8745a' }[id.slice(7)] || '#e8884a';
        r(2, 6, 9, 5, c);
        r(3, 5, 6, 1, tint(c, 1.25));
        r(11, 5, 3, 7, tint(c, 0.85));
        r(4, 8, 1, 1, '#2a1a14');
        r(4, 9, 6, 1, tint(c, 0.7));
        r(2, 11, 9, 1, '#f8f4e8');
        return true;
      }
    }
    return false;
  }

  function paintItem(r, def) {
    const t = Math.max(0, Math.min(3, (def.tier || 1) - 1));
    if (paintWorkItem(r, def)) return;
    if (def.kind === 'food') {
      r(3, 7, 10, 5, '#e8884a');
      r(4, 6, 7, 1, '#f4a468');
      r(11, 8, 3, 3, '#e8884a');
      r(5, 9, 6, 1, '#c8602c');
      r(12, 7, 2, 1, '#f4a468');
      r(4, 8, 1, 1, '#2a1a14');
      return;
    }
    if (def.kind === 'weapon') {
      const cls = def.weaponClass || 'blade';
      if (cls === 'blade' || cls === 'dagger') {
        const m = METALS[t];
        const long = cls === 'blade';
        const top = long ? 0 : 3;
        r(7, top, 2, 10 - top, m.m);
        r(7, top, 1, 10 - top, m.l);
        r(8, top + 1, 1, 9 - top, m.d);
        r(7, top - 1 < 0 ? 0 : top - 1, 2, 1, m.l);
        r(4, 10, 8, 1, '#d8b04a');
        r(4, 11, 8, 1, '#8a6a20');
        r(7, 11, 2, 3, '#6a4020');
        r(6, 14, 4, 1, '#d8b04a');
      } else if (cls === 'bow') {
        const w = WOODS[t];
        r(9, 1, 2, 2, w.m);
        r(7, 3, 2, 2, w.m);
        r(6, 5, 2, 6, w.l);
        r(7, 11, 2, 2, w.m);
        r(9, 13, 2, 2, w.d);
        r(11, 3, 1, 10, '#ece8d6');
        r(7, 7, 5, 2, '#a02828');
      } else {
        const w = WOODS[t];
        r(7, 5, 2, 10, w.m);
        r(7, 5, 1, 10, w.l);
        r(5, 0, 6, 5, ORBS[t]);
        r(6, 0, 4, 1, '#ffffff');
        r(5, 3, 6, 2, '#ffffff88');
        r(6, 5, 4, 1, w.d);
      }
      return;
    }
    const slot = def.slot;
    const k = def.id.startsWith('soft_') ? 0 : def.id.startsWith('hard_') ? 1 : def.id.startsWith('chain_') ? 2 : 3;
    const c = slot === 'amulet' || slot === 'ring' || slot === 'belt' || slot === 'boon' ? AMULETS[t] : LEATHERS[k];
    if (slot === 'body') {
      r(4, 3, 8, 11, c.m);
      r(1, 3, 3, 6, c.m);
      r(12, 3, 3, 6, c.d);
      r(6, 3, 4, 2, c.d);
      r(4, 3, 3, 4, c.l);
      r(4, 10, 8, 1, '#4a3020');
      r(7, 10, 2, 1, '#d8b04a');
      r(4, 13, 8, 1, c.d);
    } else if (slot === 'legs') {
      r(4, 1, 8, 3, c.m);
      r(4, 4, 3, 9, c.l);
      r(9, 4, 3, 9, c.d);
      r(7, 4, 2, 4, c.m);
      r(3, 13, 4, 2, '#4a3020');
      r(9, 13, 4, 2, '#4a3020');
    } else if (slot === 'head') {
      r(4, 2, 8, 8, c.m);
      r(3, 4, 1, 6, c.m);
      r(12, 4, 1, 6, c.d);
      r(5, 2, 4, 3, c.l);
      r(3, 10, 10, 2, c.d);
      if (t >= 2) {
        r(7, 5, 2, 6, c.d);
        r(7, 0, 2, 3, '#c83030');
      }
    } else if (slot === 'offhand') {
      if (t < 2) {
        r(3, 3, 10, 10, c.m);
        r(2, 5, 12, 6, c.m);
        r(3, 3, 4, 4, c.l);
        r(8, 8, 5, 5, c.d);
        r(7, 7, 2, 2, '#d8b04a');
      } else {
        r(3, 1, 10, 9, c.m);
        r(4, 10, 8, 2, c.m);
        r(6, 12, 4, 2, c.d);
        r(3, 1, 4, 5, c.l);
        r(9, 4, 4, 6, c.d);
        r(7, 5, 2, 3, '#d8b04a');
      }
    } else if (slot === 'cloak') {
      r(3, 2, 10, 12, c.m);
      r(2, 5, 12, 9, c.m);
      r(3, 2, 3, 8, c.l);
      r(10, 5, 3, 9, c.d);
      r(2, 13, 12, 1, c.d);
      r(7, 2, 2, 2, '#d8b04a');
    } else if (slot === 'amulet') {
      r(4, 1, 1, 5, '#8a7a60');
      r(11, 1, 1, 5, '#8a7a60');
      r(5, 6, 1, 2, '#8a7a60');
      r(10, 6, 1, 2, '#8a7a60');
      r(6, 8, 4, 1, '#8a7a60');
      r(5, 9, 6, 5, c.m);
      r(5, 9, 3, 2, c.l);
      r(8, 11, 3, 3, c.d);
      r(7, 10, 2, 3, GEMS[t]);
    } else if (slot === 'ring') {
      r(5, 6, 6, 1, c.l);
      r(4, 7, 1, 5, c.m);
      r(11, 7, 1, 5, c.d);
      r(5, 12, 6, 1, c.d);
      r(6, 3, 4, 3, GEMS[t]);
      r(7, 3, 2, 1, '#ffffff');
    } else if (slot === 'belt') {
      r(1, 6, 14, 5, '#6a4426');
      r(1, 6, 14, 1, '#8a5a34');
      r(1, 10, 14, 1, '#4a2e18');
      r(5, 5, 6, 7, c.m);
      r(5, 5, 6, 1, c.l);
      r(7, 7, 2, 3, GEMS[t]);
      for (const x of [2, 12]) r(x, 8, 1, 1, c.l);
    } else if (slot === 'boon') {
      r(7, 1, 2, 4, '#8a7a60');
      r(4, 5, 8, 9, c.m);
      r(4, 5, 8, 2, c.l);
      r(10, 8, 2, 6, c.d);
      r(7, 7, 2, 4, GEMS[t]);
      r(6, 9, 4, 1, GEMS[t]);
      r(7, 7, 1, 1, '#ffffff');
    } else {
      r(3, 3, 10, 10, '#8a8a9a');
    }
  }

  /** A 20x20 canvas holding the item's icon, with the usual dark outline. */
  function itemIcon(def) {
    return sprite(`i|${def.id}`, (r) => paintItem(r, def));
  }

  function slotButton(ref, onClick, label, ghost) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (ref ? '' : ' empty') + (ref && ref.rarity ? ` ${ref.rarity}` : '');
    if (ref) {
      const def = G.data && G.data.items.get(ref.id);
      if (def) {
        const src = itemIcon(def);
        const cv = document.createElement('canvas');
        cv.width = src.width;
        cv.height = src.height;
        cv.getContext('2d').drawImage(src, 0, 0);
        cv.className = 'icon';
        b.appendChild(cv);
        b.setAttribute('aria-label', def.name);
      } else {
        b.textContent = pretty(ref.id);
      }
      b.title = itemTip(ref);
      if (ref.qty > 1) {
        const q = document.createElement('i');
        q.textContent = String(ref.qty);
        b.appendChild(q);
      }
      b.addEventListener('click', onClick);
    } else {
      if (ghost) {
        const fake = ghost === 'weapon' || ghost === 'weapon2'
          ? { id: `ghost_${ghost}`, kind: 'weapon', weaponClass: 'blade', tier: 1 }
          : { id: `ghost_${ghost}`, kind: 'armor', slot: ghost, tier: 2 };
        b.appendChild(iconCanvas(fake));
      }
      const t = document.createElement('span');
      t.className = 'slot-name';
      t.textContent = label || '';
      b.appendChild(t);
      b.disabled = true;
    }
    return b;
  }

  function renderBag() {
    const inv = G.inv;
    if (!inv) return;
    const equip = $('equip');
    equip.textContent = '';
    for (const slot of PAPERDOLL) {
      if (!slot) {
        const gap = document.createElement('span');
        equip.appendChild(gap);
        continue;
      }
      const label = (SLOT_LABELS.find((l) => l[0] === slot) || [slot, slot])[1];
      equip.appendChild(slotButton(inv.equipment[slot], () => (G.fight ? toast("You can't change gear in a fight.") : window.coe.send({ t: 'unequip', slot })), label, slot));
    }
    const belt = $('toolbelt');
    if (belt) {
      belt.textContent = '';
      for (const [type, label] of [['axe', 'Axe'], ['pickaxe', 'Pickaxe'], ['rod', 'Rod'], ['snare', 'Snare']]) {
        const ref = inv.toolbelt ? inv.toolbelt[type] : null;
        belt.appendChild(slotButton(ref, () => window.coe.send({ t: 'unbelt', tool: type }), label));
      }
    }
    G.gearInfo = inv.gear || null;
    renderGear(inv.gear);
    const grid = $('bag-grid');
    grid.textContent = '';
    inv.items.forEach((ref, i) => {
      grid.appendChild(
        slotButton(ref, (ev) => {
          const def = G.data && G.data.items.get(ref.id);
          if (!def) return;
          if (def.kind === 'food') {
            if (G.fight) {
              if (isMyTurn() && !G.fight.options.acted) sendFight({ t: 'eat', slot: i });
              else toast('Not your turn to act.');
            } else window.coe.send({ t: 'use', slot: i });
          } else if (def.kind === 'tool') window.coe.send({ t: 'belt', slot: i });
          else if (G.fight) toast("You can't change gear in a fight.");
          else window.coe.send({ t: 'equip', slot: i, ...(ev.shiftKey && def.kind === 'weapon' ? { alt: true } : {}) });
        }),
      );
    });
  }

  /** Free teleport to Bellstone Plaza. The server refuses it in a fight. */
  function goToTown() {
    if (G.fight) return toast("You can't do that in a fight.");
    window.coe.send({ t: 'teleport' });
  }

  function buildLookPanel() {
    const row = $('look-skin');
    row.textContent = '';
    SKIN_TONES.forEach((tone, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = tone;
      b.title = `Skin tone ${i + 1}`;
      b.dataset.skin = String(i);
      b.addEventListener('click', () => chooseLook({ skin: i }));
      row.appendChild(b);
    });
  }

  function chooseLook(change) {
    const me = G.self();
    const cur = (me && me.chosen) || { g: me ? me.look.g : 'm', skin: Math.max(0, SKIN_TONES.indexOf(me ? me.look.skin : SKIN_TONES[1])) };
    const next = { ...cur, ...change };
    me.chosen = next;
    me.look = look(me.name, next);
    renderLook();
    window.coe.send({ t: 'look', look: next });
  }

  function renderLook() {
    const me = G && G.self();
    if (!me) return;
    $('look-gender').textContent = `Body shape: ${me.look.g === 'f' ? 'female' : 'male'}. Chosen at sign-up; it cannot be changed.`;
    for (const b of $('look-skin').querySelectorAll('button')) b.classList.toggle('on', SKIN_TONES[Number(b.dataset.skin)] === me.look.skin);
    const c = $('look-preview');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFigure(ctx, 8, 8, 4, me.look, 0, 0, heldGear(G.selfId));
  }

  // Up to three windows stay open at once. A fourth closes the one opened longest ago.
  const MAX_WINDOWS = 3;
  const WORK_CAP = 30;
  const openOrder = [];
  let zTop = 20;

  function placeWindow(el) {
    if (el.dataset.moved) return;
    const box = el.offsetParent || document.body;
    const slot = Math.max(0, openOrder.indexOf(el.id));
    const w = el.offsetWidth || 260;
    el.style.right = 'auto';
    el.style.left = `${Math.max(0, box.clientWidth - w - 10 - slot * 24)}px`;
    el.style.top = `${56 + slot * 28}px`;
  }

  function raise(el) {
    el.style.zIndex = String(++zTop);
  }

  function togglePanel(id) {
    const el = $(id);
    const i = openOrder.indexOf(id);
    if (i >= 0 || !el.classList.contains('hidden')) {
      if (i >= 0) openOrder.splice(i, 1);
      el.classList.add('hidden');
    } else {
      while (openOrder.length >= MAX_WINDOWS) $(openOrder.shift()).classList.add('hidden');
      openOrder.push(id);
      el.classList.remove('hidden');
      placeWindow(el);
      raise(el);
    }
    play('click');
  }

  function closePanels() {
    for (const p of PANELS) $(p).classList.add('hidden');
    openOrder.length = 0;
  }

  /** Windows drag by their title and resize from the bottom-right corner (CSS resize). */
  function setupWindows() {
    for (const p of [...PANELS, ...TOWN_PANELS]) {
      const el = $(p);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'xbtn';
      x.textContent = '\u00d7';
      x.title = 'Close';
      x.setAttribute('aria-label', 'Close');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', () => {
        if (PANELS.includes(p)) {
          const i = openOrder.indexOf(p);
          if (i >= 0) openOrder.splice(i, 1);
          el.classList.add('hidden');
          play('click');
        } else closeTown(true);
      });
      el.insertBefore(x, el.firstChild);
      if (!el.classList.contains('side')) continue;
      el.addEventListener('mousedown', () => raise(el));
      const bar = el.querySelector('h2');
      if (!bar) continue;
      bar.classList.add('grip');
      bar.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const box = el.offsetParent || document.body;
        const sx = ev.clientX - el.offsetLeft;
        const sy = ev.clientY - el.offsetTop;
        el.style.right = 'auto';
        const move = (e) => {
          el.dataset.moved = '1';
          el.style.left = `${Math.min(Math.max(0, e.clientX - sx), Math.max(0, box.clientWidth - 60))}px`;
          el.style.top = `${Math.min(Math.max(0, e.clientY - sy), Math.max(0, box.clientHeight - 40))}px`;
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }
  }

  function setupSound() {
    const s = window.coeAudio.settings;
    $('vol-master').value = s.master;
    $('vol-sfx').value = s.sfx;
    $('vol-music').value = s.music;
    $('mute').checked = s.muted;
  }

  // ---- talking, shopping, storage, crafting, and the journal

  const SKILL_LABEL = { forestry: 'Forestry', mining: 'Mining', fishing: 'Fishing', hunting: 'Hunting', smithing: 'Smithing', cooking: 'Cooking', crafting: 'Crafting' };
  const CUR_NAME = { iron_bits: 'iron bits', gold_coins: 'gold coins', favor_tokens: 'favor tokens' };
  const CUR_CLASS = { iron_bits: 'iron', gold_coins: 'gold', favor_tokens: 'favor' };
  // Mirrors the server: a shop pays 40% of an item's value, more for rolled gear.
  const SELL_RATE = 0.4;
  const RARITY_VALUE = { basic: 1, magic: 1.6, rare: 3, legendary: 8 };
  const GOLD_RATE = 100;

  const townOpen = () => TOWN_PANELS.some((p) => !$(p).classList.contains('hidden'));
  const skillLevel = (skill) => (G.stats && G.stats.skills[skill] ? G.stats.skills[skill].level : 1);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function iconCanvas(def) {
    const src = itemIcon(def);
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    cv.className = 'icon';
    return cv;
  }

  function price(amount, cur) {
    const span = el('span', 'price');
    span.append(el('span', `coin ${CUR_CLASS[cur]}`), document.createTextNode(String(amount)));
    return span;
  }

  function sellPrice(ref) {
    const def = G.data && G.data.items.get(ref.id);
    if (!def || !def.value) return 0;
    return Math.max(1, Math.floor(def.value * SELL_RATE * (RARITY_VALUE[ref.rarity || 'basic'] || 1)));
  }

  function showTown(id) {
    for (const p of TOWN_PANELS) $(p).classList.toggle('hidden', p !== id);
    if (id !== 'dialog') closePanels();
    play('click');
  }

  /** Hide every town panel. `tell` also lets the server know, so it stops waiting on you. */
  function closeTown(tell) {
    const was = townOpen();
    for (const p of TOWN_PANELS) $(p).classList.add('hidden');
    G.town = null;
    if (was && tell) window.coe.send({ t: 'close' });
  }

  function walletLine() {
    const w = (G.stats && G.stats.wallet) || { iron_bits: 0, gold_coins: 0, favor_tokens: 0 };
    const line = el('div', 'wallet-line');
    for (const cur of ['iron_bits', 'gold_coins', 'favor_tokens']) line.append(price(w[cur], cur));
    return line;
  }

  // dialogue

  function onDialog(msg) {
    const npc = G.data.npcs.get(msg.npc);
    const st = G.data.stations.get(msg.npc);
    $('dlg-name').textContent = npc ? npc.name : st ? st.name : pretty(msg.npc);
    $('dlg-role').textContent = npc ? npc.role : '';
    const lines = $('dlg-lines');
    lines.textContent = '';
    for (const l of msg.lines) lines.appendChild(el('p', '', l));
    const opts = $('dlg-options');
    opts.textContent = '';
    msg.options.forEach((o, i) => {
      const b = el('button', 'opt', `${i + 1}. ${o.label}`);
      b.type = 'button';
      b.dataset.option = o.id;
      b.addEventListener('click', () => {
        play('click');
        window.coe.send({ t: 'choose', option: o.id });
      });
      opts.appendChild(b);
    });
    G.town = { kind: 'dialog', npc: msg.npc };
    showTown('dialog');
  }

  // shop

  function onShop(msg) {
    G.town = { kind: 'shop', shop: msg.shop };
    G.shopTab = 'buy';
    showTown('panel-shop');
    renderShop();
  }

  function renderShop() {
    const shop = G.data.shops.get(G.town.shop);
    if (!shop) return;
    $('shop-title').textContent = shop.name;
    const box = $('shop-body');
    box.textContent = '';
    box.appendChild(walletLine());
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [key, label] of [['buy', 'Buy'], ['sell', 'Sell']]) {
      const t = el('button', '', label);
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(G.shopTab === key));
      t.addEventListener('click', () => {
        if (G.shopTab === key) return;
        G.shopTab = key;
        play('click');
        renderShop();
      });
      tabs.appendChild(t);
    }
    box.appendChild(tabs);
    if (G.shopTab === 'sell') return renderShopSell(box);
    const w = (G.stats && G.stats.wallet) || {};
    for (const e of shop.stock) {
      const def = G.data.items.get(e.item);
      if (!def) continue;
      const row = el('button', 'row-item');
      row.type = 'button';
      row.title = itemTip({ id: e.item, qty: 1 });
      if ((w[e.cur] || 0) < e.price) row.classList.add('poor');
      row.append(iconCanvas(def), el('span', 'name', def.name), price(e.price, e.cur));
      if (G.shopSel === e.item) row.classList.add('sel');
      row.addEventListener('click', () => {
        G.shopSel = e.item;
        renderShop();
      });
      box.appendChild(row);
    }
    const picked = shop.stock.find((e) => e.item === G.shopSel);
    if (picked && G.data.items.get(picked.item)) {
      const pdef = G.data.items.get(picked.item);
      const bar = el('div', '');
      bar.id = 'shop-buy';
      bar.appendChild(el('p', 'buy-title', `${pdef.name}: how many?`));
      const line = el('div', 'buy-row');
      for (const n of [1, 5, 10]) {
        const b = el('button', 'act', `Buy ${n}`);
        b.type = 'button';
        b.addEventListener('click', () => askBuy(picked, pdef, n));
        line.appendChild(b);
      }
      const amount = el('input');
      amount.type = 'number';
      amount.min = '1';
      amount.max = '99';
      amount.value = String(G.shopX || 1);
      amount.setAttribute('aria-label', 'Amount');
      amount.addEventListener('input', () => (G.shopX = amount.value));
      const bx = el('button', 'act', 'Buy X');
      bx.type = 'button';
      bx.addEventListener('click', () => {
        const n = Math.floor(Number(amount.value));
        if (!Number.isFinite(n) || n < 1 || n > 99) return toast('Choose an amount from 1 to 99.');
        askBuy(picked, pdef, n);
      });
      line.append(amount, bx);
      bar.appendChild(line);
      box.appendChild(bar);
    }
    box.appendChild(el('p', 'muted', 'Click an item to choose how many to buy.'));
  }

  function renderShopSell(box) {
    let any = false;
    if (G.inv) {
      G.inv.items.forEach((ref, i) => {
        if (!ref) return;
        const each = sellPrice(ref);
        const def = G.data.items.get(ref.id);
        if (!def || each <= 0) return;
        any = true;
        const row = el('button', 'row-item');
        row.type = 'button';
        row.title = itemTip(ref);
        row.append(iconCanvas(def), el('span', 'name', `${itemName(ref)}${ref.qty > 1 ? ` x${ref.qty}` : ''}`), price(each, 'iron_bits'));
        row.addEventListener('click', (ev) => window.coe.send({ t: 'sell', slot: i, qty: ev.shiftKey ? ref.qty : 1 }));
        box.appendChild(row);
      });
    }
    if (!any) box.appendChild(el('p', 'muted', 'Nothing in your bag sells here.'));
    box.appendChild(el('p', 'muted', 'Click an item to sell one. Shift-click sells the whole stack.'));
  }

  function closeBuyConfirm() {
    $('buy-confirm').classList.add('hidden');
    G.buyPending = null;
  }

  /** Ask before spending: "Do you want to purchase 1 Reed rod for 16 iron bits?" with Yes and No. */
  function askBuy(entry, def, qty) {
    const total = entry.price * qty;
    const have = ((G.stats && G.stats.wallet) || {})[entry.cur] || 0;
    $('bc-text').textContent = `Do you want to purchase ${qty} ${def.name} for ${total} ${CUR_NAME[entry.cur]}?`;
    const poor = have < total;
    $('bc-note').textContent = poor ? `You only have ${have} ${CUR_NAME[entry.cur]}.` : '';
    $('bc-yes').disabled = poor;
    G.buyPending = poor ? null : { item: entry.item, qty };
    $('buy-confirm').classList.remove('hidden');
    play('click');
  }

  // storage

  function onStorage(msg) {
    G.storage = msg;
    G.town = { kind: 'storage' };
    showTown('panel-storage');
    renderStorage();
  }

  function renderStorage() {
    if (!G.storage) return;
    const box = $('storage-body');
    box.textContent = '';
    box.appendChild(walletLine());

    const ex = el('div', 'exchange');
    const w = (G.stats && G.stats.wallet) || { iron_bits: 0, gold_coins: 0 };
    const exBtn = (label, ok, msg) => {
      const b = el('button', 'act', label);
      b.type = 'button';
      b.disabled = !ok;
      b.addEventListener('click', () => window.coe.send(msg));
      ex.appendChild(b);
    };
    exBtn('100 iron to 1 gold', w.iron_bits >= GOLD_RATE, { t: 'exchange', dir: 'up', amount: GOLD_RATE });
    exBtn('All iron to gold', w.iron_bits >= GOLD_RATE, { t: 'exchange', dir: 'up', amount: Math.max(GOLD_RATE, Math.floor(w.iron_bits / GOLD_RATE) * GOLD_RATE) });
    exBtn('1 gold to 100 iron', w.gold_coins >= 1, { t: 'exchange', dir: 'down', amount: 1 });
    exBtn('All gold to iron', w.gold_coins >= 1, { t: 'exchange', dir: 'down', amount: Math.max(1, w.gold_coins) });
    box.appendChild(ex);

    const used = G.storage.items.filter(Boolean).length;
    box.appendChild(el('h3', '', `Storage (${used}/${G.storage.slots})`));
    const grid = el('div', 'slot-grid');
    G.storage.items.forEach((ref, i) => {
      grid.appendChild(slotButton(ref, (ev) => window.coe.send({ t: 'store', dir: 'out', slot: i, qty: ev.shiftKey ? 999 : 1 })));
    });
    box.appendChild(grid);

    box.appendChild(el('h3', '', 'Your bag'));
    const bag = el('div', 'slot-grid');
    if (G.inv) {
      G.inv.items.forEach((ref, i) => {
        bag.appendChild(slotButton(ref, (ev) => window.coe.send({ t: 'store', dir: 'in', slot: i, qty: ev.shiftKey ? 999 : 1 })));
      });
    }
    box.appendChild(bag);
    box.appendChild(el('p', 'muted', 'Click to move one. Shift-click moves the whole stack. Gold coins are lighter to carry than a purse of iron bits.'));
  }

  // crafting stations

  function onStation(msg) {
    const st = G.data.stations.get(msg.station);
    if (!st) return;
    G.town = { kind: 'station', station: msg.station };
    showTown('panel-station');
    renderStation();
  }

  const bagCount = (id) => (G.inv ? G.inv.items.reduce((n, r) => n + (r && r.id === id ? r.qty : 0), 0) : 0);

  function renderStation() {
    const st = G.data.stations.get(G.town.station);
    if (!st) return;
    $('station-title').textContent = st.name;
    const box = $('station-body');
    box.textContent = '';
    for (const line of st.text) box.appendChild(el('p', 'muted', line));
    const list = [...G.data.recipes.values()].filter((r) => r.station === st.id);
    for (const r of list) {
      const out = G.data.items.get(r.output.item);
      if (!out) continue;
      const low = skillLevel(r.skill) < r.level;
      const most = Math.min(28, ...r.inputs.map((i) => Math.floor(bagCount(i.item) / i.qty)));
      const row = el('div', 'recipe' + (low ? ' locked' : ''));
      const head = el('div', 'recipe-head');
      head.append(iconCanvas(out), el('span', 'name', `${out.name}${r.output.qty > 1 ? ` x${r.output.qty}` : ''}`), el('span', 'muted', `${SKILL_LABEL[r.skill]} ${r.level}`));
      row.appendChild(head);
      const need = el('div', 'need');
      for (const i of r.inputs) {
        const have = bagCount(i.item);
        const idef = G.data.items.get(i.item);
        need.appendChild(el('span', have >= i.qty ? 'ok' : 'short', `${idef ? idef.name : pretty(i.item)} ${have}/${i.qty}`));
      }
      row.appendChild(need);
      const btns = el('div', 'recipe-btns');
      for (const [label, n] of [['Make 1', 1], ['Make 5', 5], ['Make all', most]]) {
        const b = el('button', 'act', label);
        b.type = 'button';
        b.disabled = low || most < 1 || n < 1 || (n === 5 && most < 5);
        b.addEventListener('click', () => window.coe.send({ t: 'craft', recipe: r.id, qty: Math.min(28, n) }));
        btns.appendChild(b);
      }
      row.appendChild(btns);
      box.appendChild(row);
    }
    if (!list.length) box.appendChild(el('p', 'muted', 'Nothing can be made here yet.'));
  }

  // the Crown Steward

  function onPerks(msg) {
    G.perks = msg;
    const me = G.self();
    if (me) me.title = msg.title || undefined;
    G.town = { kind: 'perks', npc: msg.npc };
    showTown('panel-perks');
    renderPerks();
  }

  function renderPerks() {
    const npc = G.data.npcs.get(G.perks.npc);
    const svc = npc && npc.services.find((s) => s.kind === 'steward');
    $('perks-title').textContent = npc ? npc.name : 'Steward';
    const box = $('perks-body');
    box.textContent = '';
    box.appendChild(walletLine());
    box.appendChild(el('p', 'muted', 'Favor tokens come from finishing jobs for the people of the Reach. They buy what gold cannot.'));
    if (!svc) return;
    const w = (G.stats && G.stats.wallet) || { favor_tokens: 0 };
    for (const perk of svc.perks) {
      const row = el('div', 'perk');
      const owned = G.perks.owned.includes(perk.id);
      const worn = perk.type === 'title' && G.perks.title === perk.value;
      row.appendChild(el('span', 'name', perk.label));
      const b = el('button', 'act');
      b.type = 'button';
      if (perk.type === 'title' && owned) {
        b.textContent = worn ? 'Worn' : 'Wear';
        b.disabled = worn;
      } else {
        b.append(document.createTextNode('Buy '), price(perk.cost, 'favor_tokens'));
        b.disabled = w.favor_tokens < perk.cost || (perk.type === 'slots' && G.perks.extraSlots >= 60);
      }
      b.addEventListener('click', () => window.coe.send({ t: 'perk', id: perk.id }));
      row.appendChild(b);
      box.appendChild(row);
    }
    box.appendChild(el('p', 'muted', `Extra storage places: ${G.perks.extraSlots}`));
  }

  /** The anchor window: attune this anchor, then travel between the ones you have attuned. */
  function renderAnchor() {
    const list = G.anchors || [];
    const here = list.find((a) => a.id === G.town.id);
    const crystals = ((G.inv && G.inv.items) || []).reduce((n, s) => (s && s.id === 'teleport_crystal' ? n + s.qty : n), 0);
    $('anchor-title').textContent = here ? here.name : 'Teleport anchor';
    const box = $('anchor-body');
    box.textContent = '';
    box.appendChild(el('p', 'muted', 'Early anchors are free to attune. Later anchors need a Teleport Crystal. Once an anchor is attuned, you can travel between your attuned anchors as often as you like, at no cost.'));
    if (here && !here.attuned) {
      const row = el('div', 'perk');
      const b = el('button', 'act');
      b.type = 'button';
      if (here.free) {
        row.appendChild(el('span', 'name', 'This is an early anchor. Attuning it is free.'));
        b.textContent = 'Attune';
      } else {
        row.appendChild(el('span', 'name', `This anchor needs a Teleport Crystal. You have ${crystals}.`));
        b.textContent = 'Place crystal';
        b.disabled = crystals < 1;
      }
      b.addEventListener('click', () => window.coe.send({ t: 'anchor_attune', id: here.id }));
      row.appendChild(b);
      box.appendChild(row);
      if (!here.free && crystals < 1) box.appendChild(el('p', 'muted', 'Teleport Crystals are sold by Magister Edith Crane at the Academy of the Royal Art in Aldmoor.'));
    } else if (here) {
      box.appendChild(el('p', 'muted', 'This anchor is attuned.'));
    }
    box.appendChild(el('h3', '', 'Your anchors'));
    for (const a of list) {
      const row = el('div', 'perk');
      row.appendChild(el('span', 'name', a.name));
      const b = el('button', 'act');
      b.type = 'button';
      if (a.attuned) {
        b.textContent = here && here.id === a.id ? 'You are here' : 'Travel';
        b.disabled = !here || !here.attuned || here.id === a.id;
        b.addEventListener('click', () => {
          G.anchorTravel = a.name;
          window.coe.send({ t: 'anchor_travel', to: a.id });
          closeTown(false);
        });
      } else {
        b.textContent = a.free ? 'Free to attune' : 'Needs crystal';
        b.disabled = true;
      }
      row.appendChild(b);
      box.appendChild(row);
    }
  }

  /** Redraw whichever town panel is open after your bag or purse changed. */
  function refreshTown() {
    if (!G.town) return;
    if (G.town.kind === 'shop') renderShop();
    else if (G.town.kind === 'storage') renderStorage();
    else if (G.town.kind === 'station') renderStation();
    else if (G.town.kind === 'perks' && G.perks) renderPerks();
    else if (G.town.kind === 'anchor') renderAnchor();
  }

  // busy bar

  function onBusy(msg) {
    G.busy = msg.of > 0 ? msg : null;
    const bar = $('busy');
    bar.classList.toggle('hidden', !G.busy);
    if (!G.busy) return;
    $('busy-text').textContent = msg.what;
    $('busy-fill').style.width = `${Math.min(100, Math.round(((msg.done + 1) / (msg.of + 1)) * 100))}%`;
  }

  // jobs

  const questStates = () => new Map((G.quests || []).map((q) => [q.id, q]));

  function needMet(need, st) {
    switch (need.type) {
      case 'none':
        return true;
      case 'kill':
        return st.count >= need.count;
      case 'have':
        return bagCount(need.item) >= need.count;
      case 'skill':
        return skillLevel(need.skill) >= need.level;
      case 'spent':
        return G.stats ? Object.values(G.stats.ranks).reduce((a, b) => a + b, 0) - 4 >= need.points : false;
      default:
        return false;
    }
  }

  /** '!' over someone with a job for you, '?' over someone you can hand a job in to. */
  function questMark(npcId) {
    if (!G.data || !G.quests) return null;
    const states = questStates();
    let mark = null;
    for (const q of G.data.quests.values()) {
      const st = states.get(q.id);
      if (!st) {
        const done = (id) => Boolean(states.get(id) && states.get(id).done);
        if (q.giver === npcId && myCombat() >= q.level && q.after.every(done)) mark = mark || '!';
      } else if (!st.done && q.steps[st.step] && q.steps[st.step].npc === npcId) {
        if (needMet(q.steps[st.step].need, st)) return '?';
      }
    }
    return mark;
  }

  function progressText(need, st) {
    if (need.type === 'kill') return `${pretty(need.monster)} ${Math.min(st.count, need.count)}/${need.count}`;
    if (need.type === 'have') return `${itemName({ id: need.item })} ${Math.min(bagCount(need.item), need.count)}/${need.count}`;
    if (need.type === 'skill') return `${SKILL_LABEL[need.skill]} ${skillLevel(need.skill)}/${need.level}`;
    return '';
  }

  function renderJournal() {
    const box = $('journal-body');
    if (!box || !G.data) return;
    box.textContent = '';
    const states = questStates();
    const active = [...G.data.quests.values()].filter((q) => states.get(q.id) && !states.get(q.id).done);
    const done = [...G.data.quests.values()].filter((q) => states.get(q.id) && states.get(q.id).done);
    if (!active.length && !done.length) box.appendChild(el('p', 'muted', 'No jobs yet. People with a gold ! over their head have work for you.'));
    for (const q of active) {
      const st = states.get(q.id);
      const step = q.steps[st.step];
      const card = el('div', 'quest');
      card.appendChild(el('h3', '', q.name));
      const giver = G.data.npcs.get(step.npc);
      card.appendChild(el('p', '', step.todo));
      const prog = progressText(step.need, st);
      if (prog) card.appendChild(el('p', needMet(step.need, st) ? 'ok' : 'short', prog));
      if (giver) card.appendChild(el('p', 'muted', `Report to ${giver.name}.`));
      box.appendChild(card);
    }
    if (done.length) {
      box.appendChild(el('h3', 'muted', 'Finished'));
      for (const q of done) box.appendChild(el('p', 'muted', q.name));
    }
  }

  function onQuests(msg) {
    G.quests = msg.list;
    renderJournal();
  }

  // ---- drawing

  // ---- the town portal

  const PORTAL_STEP_MS = 700;

  /** A portal opens beside the hero while they cast. */
  function openPortal(durMs, now) {
    const me = G.self();
    if (!me) return;
    const p = worldPos(me, now);
    const open = (x, y) => !blockedTile(Math.round(x), Math.round(y));
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [Math.round(p.x) + dx, Math.round(p.y) + dy]).find(([x, y]) => open(x, y)) || [Math.round(p.x), Math.round(p.y)];
    G.portal = { stage: 'open', x: spot[0], y: spot[1], fromX: p.x, fromY: p.y, t0: now, dur: Math.max(600, durMs) };
  }

  function onPortal(msg, now) {
    const po = G.portal;
    if (msg.stage === 'enter') {
      const me = G.self();
      const p = me ? worldPos(me, now) : { x: 0, y: 0 };
      if (!po) openPortal(1000, now);
      G.portal.stage = 'enter';
      G.portal.t0 = now;
      G.portal.fromX = p.x;
      G.portal.fromY = p.y;
      // Once the hero is through, cover the screen until they stand in town.
      clearTimeout(G.portalTimer);
      G.portalTimer = setTimeout(showLoading, PORTAL_STEP_MS);
      return;
    }
    // arrive: the screen stays covered a moment so the hero is already standing there when it clears
    clearTimeout(G.portalTimer);
    showLoading();
    setTimeout(() => {
      const at = msg.x !== undefined ? { x: msg.x, y: msg.y } : { x: G.self().x, y: G.self().y };
      G.portal = { stage: 'arrive', x: at.x + 1, y: at.y, fromX: at.x, fromY: at.y, t0: performance.now() };
      hideLoading();
      setTimeout(() => {
        if (G.portal && G.portal.stage === 'arrive') G.portal = null;
      }, PORTAL_STEP_MS + 1100);
    }, 900);
  }

  function showLoading() {
    const box = $('loading');
    box.classList.remove('hidden', 'fade');
    if (G.portal && G.portal.stage === 'enter') G.portal.stage = 'wait';
  }

  function hideLoading() {
    const box = $('loading');
    box.classList.add('fade');
    setTimeout(() => {
      if (box.classList.contains('fade')) box.classList.add('hidden');
    }, 520);
  }

  function blockedTile(x, y) {
    const m = G.map;
    if (!m || x < 0 || y < 0 || x >= m.width || y >= m.height) return true;
    return Boolean(m.blocked && m.blocked[y] && m.blocked[y][x] === '1');
  }

  /** The swirling portal, drawn over the ground at a tile. `k` is how open it is, 0 to 1. */
  function drawPortal(ctx, x, y, k, now, offX, offY, px) {
    if (k <= 0) return;
    const cx = offX + (x + 0.5) * px;
    const cy = offY + (y + 0.55) * px;
    const rx = px * 0.42 * k;
    const ry = px * 0.78 * k;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, 'rgba(240, 228, 255, 0.95)');
    g.addColorStop(0.45, 'rgba(150, 100, 255, 0.85)');
    g.addColorStop(1, 'rgba(50, 30, 140, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, px * 0.05);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 1 ? 'rgba(120, 230, 255, 0.9)' : 'rgba(210, 170, 255, 0.9)';
      const a = now / 380 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * (0.45 + i * 0.22), ry * (0.45 + i * 0.22), 0, a, a + Math.PI * 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Everything to draw this frame, world and fight alike. */
  function renderables(now) {
    const list = [];
    const inFight = G.fight;
    for (const e of G.entities.values()) {
      if (inFight && inFight.actors.has(e.id)) continue;
      const p = worldPos(e, now);
      list.push({
        id: e.id, name: e.name, kind: e.kind, level: e.level, mon: e.mon, look: e.look, x: p.x, y: p.y, moving: p.moving,
        ref: e.ref, depleted: e.depleted, title: e.title, self: e.id === G.selfId, say: e.say && now < e.sayUntil ? e.say : null, fighting: e.fight, alpha: 1, ox: 0, oy: 0,
      });
    }
    for (const r of list) {
      if (!r.self || !G.portal) continue;
      const po = G.portal;
      if (po.stage === 'enter' || po.stage === 'wait') {
        const k = po.stage === 'wait' ? 1 : Math.min(1, (now - po.t0) / PORTAL_STEP_MS);
        r.x = po.fromX + (po.x - po.fromX) * k;
        r.y = po.fromY + (po.y - po.fromY) * k;
        r.alpha = 1 - k;
        r.moving = k < 1;
      } else if (po.stage === 'arrive') {
        r.alpha = Math.min(1, (now - po.t0) / PORTAL_STEP_MS);
      }
    }
    if (inFight) {
      for (const a of inFight.actors.values()) {
        const p = actorPos(a, now);
        let ox = 0;
        let oy = 0;
        if (a.lunge) {
          const t = (now - a.lunge.t0) / 220;
          if (t >= 1) a.lunge = null;
          else {
            const k = Math.sin(t * Math.PI) * 0.35;
            ox = VEC[a.lunge.dir][0] * k;
            oy = VEC[a.lunge.dir][1] * k;
          }
        }
        if (!a.alive) a.fade = Math.max(0, a.fade - 0.03);
        list.push({
          id: a.id, name: a.name, kind: a.side === 'hero' && !a.mon ? 'player' : 'monster', level: a.level, mon: a.mon, look: a.look, x: p.x + ox, y: p.y + oy,
          moving: p.moving, self: a.id === G.selfId, say: null, fighting: true, alpha: a.fade, fightActor: a, flash: now - a.flash < 140, active: inFight.turnActor === a.id,
        });
      }
    }
    return list;
  }

  function labelFor(r) {
    if (r.kind === 'monster') return `${r.name} (Lv ${r.level})`;
    if (r.kind === 'node') {
      const def = G.data && G.data.nodes.get(r.ref);
      if (!def) return r.name;
      return r.depleted ? `${r.name} (spent)` : `${r.name} (${SKILL_LABEL[def.skill]} ${def.level})`;
    }
    if (r.title) return `${r.name}, ${r.title}`;
    return r.name;
  }

  function labelColor(r) {
    if (r.self) return '#e6b34a';
    if (r.kind === 'npc') return '#9fe8c8';
    if (r.kind === 'station') return '#f0d890';
    if (r.kind === 'node') {
      const def = G.data && G.data.nodes.get(r.ref);
      return def && skillLevel(def.skill) < def.level ? '#ff9a9a' : '#d8f0c8';
    }
    if (r.kind !== 'monster') return '#efe6d0';
    const d = r.level - myCombat();
    return d > 0 ? '#ff8080' : d === 0 ? '#ffe066' : '#7bd88f';
  }

  function frame() {
    if (!G) return;
    const { canvas, ctx, map, tileset } = G;
    const now = performance.now();
    if (G.fight && !G.modal) runFightQueue(now);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0912';
    ctx.fillRect(0, 0, w, h);

    const base = Math.max(2, Math.min(5, Math.floor(Math.min(w / (TILE * 22), h / (TILE * 13)))));
    const fit = Math.min(w / (TILE * map.width), h / (TILE * map.height));
    // Zoom steps scale by 1.25 each way. Out to the whole map; in to double the usual size.
    let s = Math.max(fit, Math.min(base * 2, base * Math.pow(1.25, G.zoom)));
    if (s >= 2) s = Math.round(s * 4) / 4; // keep tiles on whole or quarter pixels so they do not seam
    G.scale = s;
    const px = TILE * s;
    let cam;
    if (G.fight && hero()) {
      const p = actorPos(hero(), now);
      cam = { x: p.x, y: p.y };
    } else {
      const p = worldPos(G.self(), now);
      cam = { x: p.x, y: p.y };
    }
    const offX = Math.round(w / 2 - (cam.x * TILE + TILE / 2) * s);
    const offY = Math.round(h / 2 - (cam.y * TILE + TILE / 2) * s);
    G.off = { x: offX, y: offY };

    const x0 = Math.max(0, Math.floor(-offX / px));
    const x1 = Math.min(map.width - 1, Math.ceil((w - offX) / px));
    const y0 = Math.max(0, Math.floor(-offY / px));
    const y1 = Math.min(map.height - 1, Math.ceil((h - offY) / px));
    const cols = map.tileset.columns;

    const drawTile = (id, tx, ty) => {
      const i = id - 1;
      ctx.drawImage(tileset, (i % cols) * TILE, Math.floor(i / cols) * TILE, TILE, TILE, offX + tx * px, offY + ty * px, px, px);
    };
    const box = (tx, ty, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(offX + tx * px, offY + ty * px, px, px);
    };

    if (G.ground && x1 >= x0 && y1 >= y0) {
      ctx.drawImage(G.ground, x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE, offX + x0 * px, offY + y0 * px, (x1 - x0 + 1) * px, (y1 - y0 + 1) * px);
    } else {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = map.layers.ground[y * map.width + x];
        if (id) drawTile(id, x, y);
      }
    }

    if (G.fight && G.fight.marks) for (const t of G.fight.marks) box(t.x, t.y, 'rgba(220,40,30,0.4)');
    // Fight overlays go on the ground, under people.
    if (G.fight && isMyTurn()) {
      const o = G.fight.options;
      if (o.moveLeft > 0) for (const t of o.reach) box(t.x, t.y, 'rgba(90,150,255,0.28)');
      const sel = o.abilities.find((a) => a.id === G.fight.selected);
      const hp = hero().pos;
      if (G.fight.hover) {
        const hv = G.fight.hover;
        if (sel && sel.shape === 'front3x3' && sel.usable) {
          for (const t of front3x3(hp, dirToward(hp, hv))) box(t.x, t.y, 'rgba(255,90,90,0.30)');
        } else if (sel && sel.shape === 'area' && sel.usable) {
          if (manhattan(hp, hv) <= (sel.range || 1)) {
            const r = sel.radius || 1;
            for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) box(hv.x + dx, hv.y + dy, 'rgba(255,90,90,0.30)');
          }
        } else if (o.reach.some((p) => p.x === hv.x && p.y === hv.y)) box(hv.x, hv.y, 'rgba(255,255,255,0.28)');
      }
      if (sel && sel.usable && sel.range && (sel.shape === 'ranged' || sel.shape === 'multi' || sel.shape === 'chain' || sel.shape === 'area')) {
        const r = sel.range;
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if ((dx || dy) && Math.abs(dx) + Math.abs(dy) <= r) box(hp.x + dx, hp.y + dy, 'rgba(255,190,70,0.10)');
      }
      for (const a of G.fight.actors.values()) {
        if (a.side === 'enemy' && a.alive && manhattan(a.pos, hp) === 1) {
          ctx.strokeStyle = 'rgba(255,90,90,0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(offX + a.pos.x * px + 1, offY + a.pos.y * px + 1, px - 2, px - 2);
        }
      }
    }

    const po = G.portal;
    if (po) {
      let k = 1;
      if (po.stage === 'open') k = Math.min(1, (now - po.t0) / Math.min(po.dur, 1400));
      else if (po.stage === 'arrive') k = Math.max(0, 1 - Math.max(0, now - po.t0 - PORTAL_STEP_MS) / 900);
      drawPortal(ctx, po.x, po.y, k, now, offX, offY, px);
    }
    const list = renderables(now);
    const rows = new Map();
    for (const r of list) {
      const row = Math.round(r.y);
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(r);
    }
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      if (y >= 0 && y < map.height) {
        for (let x = x0; x <= x1; x++) {
          const id = map.layers.decor[y * map.width + x];
          if (id) {
            const sh = DECOR_SHADOW[id];
            if (sh) {
              ctx.fillStyle = 'rgba(14, 22, 10, 0.3)';
              ctx.beginPath();
              ctx.ellipse(offX + (x + 0.5 + sh[2]) * px, offY + (y + 0.9) * px, sh[0] * px, sh[1] * px, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            drawTile(id, x, y);
          }
        }
      }
      for (const r of rows.get(y) || []) {
        const sx = offX + r.x * px + (px - 12 * s) / 2;
        const sy = offY + r.y * px - (r.kind === 'monster' ? 0 : 2 * s);
        const step = r.moving ? (Math.floor(now / 150) % 2) + 1 : 0;
        const bob = r.moving && step === 1 ? -1 : 0;
        ctx.globalAlpha = r.alpha;
        if (r.kind === 'node' || r.kind === 'station') {
          const def = G.data && (r.kind === 'node' ? G.data.nodes : G.data.stations).get(r.ref);
          if (def && r.kind === 'node') drawNode(ctx, def, r.depleted, offX + r.x * px, offY + r.y * px, s, now);
          else if (def) drawStation(ctx, r.ref, offX + r.x * px, offY + r.y * px, s, now);
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(sx + s), Math.round(sy + (r.kind === 'monster' ? 15 : 15) * s), 10 * s, 2 * s);
        if (r.flash) {
          ctx.filter = 'brightness(2.2)';
        }
        if (r.kind === 'monster') drawMonster(ctx, r.mon, sx, sy, s, step, bob);
        else if (r.kind === 'npc') {
          const def = G.data && G.data.npcs.get(r.ref);
          if (def) drawFigure(ctx, sx, sy, s, npcLook(def), 0, 0, {});
        } else drawFigure(ctx, sx, sy, s, r.look, step, bob, heldGear(r.id));
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
    }

    // Selected destination and turn marker.
    if (G.dest && !G.fight) {
      ctx.fillStyle = '#e6b34a';
      const m = Math.max(2, Math.floor(px / 6));
      ctx.fillRect(offX + G.dest.x * px + px / 2 - m, offY + G.dest.y * px + px / 2 - m, m * 2, m * 2);
    }

    drawRoofs(ctx, offX, offY, px);

    // Names, health bars, speech, and floating numbers on top.
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.max(10, 4 * s)}px "Courier New", monospace`;
    const mp = worldPos(G.self(), now);
    for (const r of list) {
      if (r.alpha <= 0.05) continue;
      if (roofed(Math.round(r.x), Math.round(r.y))) continue;
      if ((r.kind === 'node' || r.kind === 'station') && !(Math.abs(r.x - mp.x) + Math.abs(r.y - mp.y) <= 3 || (G.hover && Math.round(r.x) === G.hover.x && Math.round(r.y) === G.hover.y))) continue;
      const cx = offX + r.x * px + px / 2;
      const top = offY + r.y * px - (r.kind === 'monster' ? 0 : 3 * s) - (r.kind === 'monster' ? 2 * s : 0);
      let y = top;
      if (r.fightActor) {
        const a = r.fightActor;
        const bw = px;
        const by = y - 5 * s;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(cx - bw / 2, by, bw, Math.max(3, s));
        ctx.fillStyle = a.side === 'hero' ? '#6fd28a' : '#e05a5a';
        ctx.fillRect(cx - bw / 2, by, Math.max(0, bw * (a.hp / a.maxHp)), Math.max(3, s));
        y = by - 3;
        if (r.active) {
          ctx.fillStyle = '#e6b34a';
          ctx.beginPath();
          ctx.moveTo(cx - 4 * s / 2, y - 6 * s / 2);
          ctx.lineTo(cx + 4 * s / 2, y - 6 * s / 2);
          ctx.lineTo(cx, y);
          ctx.fill();
          y -= 5 * s / 2 + 2;
        }
      }
      const label = labelFor(r);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = labelColor(r);
      ctx.strokeText(label, cx, y);
      ctx.fillText(label, cx, y);
      if (r.kind === 'npc') {
        const mark = questMark(r.ref);
        if (mark) {
          ctx.fillStyle = '#ffd84a';
          ctx.strokeText(mark, cx, y - Math.max(10, 4 * s));
          ctx.fillText(mark, cx, y - Math.max(10, 4 * s));
        }
      }
      if (r.fighting && !r.fightActor) {
        ctx.fillStyle = '#ff8080';
        ctx.fillText('!', cx, y - Math.max(10, 4 * s));
      }
      if (r.say) {
        const by = y - Math.max(12, 5 * s);
        const tw = ctx.measureText(r.say).width + 12;
        ctx.fillStyle = 'rgba(20,16,28,0.88)';
        ctx.fillRect(cx - tw / 2, by - 14, tw, 20);
        ctx.fillStyle = '#efe6d0';
        ctx.fillText(r.say, cx, by);
      }
    }
    G.shots = G.shots.filter((sh) => now - sh.t0 < 360);
    for (const sh of G.shots) {
      const t = (now - sh.t0) / 360;
      const nx = offX + (sh.from.x + (sh.to.x - sh.from.x) * t) * px + px / 2;
      const ny = offY + (sh.from.y + (sh.to.y - sh.from.y) * t) * px + px / 2 - Math.sin(t * Math.PI) * 6 * s;
      if (sh.kind === 'pick_throw') {
        ctx.save();
        ctx.translate(Math.round(nx), Math.round(ny));
        ctx.rotate(t * Math.PI * 6);
        ctx.fillStyle = '#6a4426';
        ctx.fillRect(-1 * s, -4 * s, 2 * s, 8 * s);
        ctx.fillStyle = '#b4bac4';
        ctx.fillRect(-4 * s, -4 * s, 8 * s, 2 * s);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = '#6a4426';
      ctx.fillRect(Math.round(nx - 2 * s), Math.round(ny - 2 * s), 4 * s, 4 * s);
      ctx.fillStyle = '#c89a5a';
      ctx.fillRect(Math.round(nx - 2 * s), Math.round(ny - 2 * s), 2 * s, 2 * s);
    }
    G.floaters = G.floaters.filter((f) => now - f.t0 < 900);
    ctx.font = `bold ${Math.max(12, 5 * s)}px "Courier New", monospace`;
    for (const f of G.floaters) {
      const t = (now - f.t0) / 900;
      ctx.globalAlpha = 1 - t * t;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = f.color;
      const fx = offX + f.x * px + px / 2;
      const fy = offY + f.y * px - 4 * s - t * 14 * s;
      ctx.strokeText(f.text, fx, fy);
      ctx.fillText(f.text, fx, fy);
    }
    ctx.globalAlpha = 1;

    if (G.inspect && now < G.inspect.until) {
      ctx.strokeStyle = 'rgba(255,216,106,0.95)';
      ctx.lineWidth = 3;
      ctx.strokeRect(offX + G.inspect.x * px + 1, offY + G.inspect.y * px + 1, px - 2, px - 2);
    }

    // Hover tile in the open world.
    if (!G.fight && G.hover && G.hover.x >= 0 && G.hover.y >= 0 && G.hover.x < map.width && G.hover.y < map.height) {
      ctx.strokeStyle = map.blocked[G.hover.y][G.hover.x] === '1' ? 'rgba(255,122,122,0.9)' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(offX + G.hover.x * px + 1, offY + G.hover.y * px + 1, px - 2, px - 2);
    }

    if (now - G.hudAt > 150) {
      G.hudAt = now;
      updateTip();
      const me = G.self();
      const z = zoneAt(map, me.x, me.y);
      if (window.coeAudio) window.coeAudio.music(G.fight ? 'fight' : z && z.kind === 'safe' ? 'town' : 'wilds');
      const others = [...G.entities.values()].filter((e) => e.kind === 'player' && e.id !== G.selfId).length;
      const place = z ? (z.name === map.name ? `${map.name} (${KIND_LABEL[z.kind]})` : `${map.name} - ${z.name} (${KIND_LABEL[z.kind]})`) : map.name;
      $('hud').textContent = `${place}\n` +
        `Position: ${me.x}, ${me.y}\nPlayers nearby: ${others}`;
      const hh = G.fight && hero();
      const hp = hh ? hh.hp : G.stats ? G.stats.hp : 0;
      const maxHp = hh ? hh.maxHp : G.stats ? G.stats.maxHp : 1;
      const mp = hh ? hh.mana : G.stats ? G.stats.mana : 0;
      const maxMp = hh ? hh.maxMana : G.stats ? G.stats.maxMana : 1;
      $('hp-fill').style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
      $('mp-fill').style.width = `${Math.max(0, Math.min(100, (mp / maxMp) * 100))}%`;
      $('hp-text').textContent = `HP ${hp}/${maxHp}`;
      $('mp-text').textContent = `Mana ${mp}/${maxMp}`;
    }
    G.raf = requestAnimationFrame(frame);
  }

  // ---- input

  function loadZoom() {
    try {
      const z = Number(localStorage.getItem('coe.zoom'));
      return Number.isFinite(z) ? Math.max(-12, Math.min(3, z)) : 0;
    } catch {
      return 0;
    }
  }

  function setZoom(z) {
    G.zoom = Math.max(-12, Math.min(3, z));
    try {
      localStorage.setItem('coe.zoom', String(G.zoom));
    } catch {
      /* private mode: the zoom just is not remembered */
    }
  }

  function tileAt(ev) {
    const rect = G.canvas.getBoundingClientRect();
    const px = TILE * G.scale;
    return { x: Math.floor((ev.clientX - rect.left - G.off.x) / px), y: Math.floor((ev.clientY - rect.top - G.off.y) / px) };
  }

  function requestMove(x, y) {
    if (x < 0 || y < 0 || x >= G.map.width || y >= G.map.height) return;
    G.dest = { x, y };
    if (townOpen()) closeTown(false);
    window.coe.send({ t: 'move', x, y });
  }

  function onMouseMove(ev) {
    if (!G) return;
    const t = tileAt(ev);
    if (G.fight) G.fight.hover = t;
    else G.hover = t;
    G.mouse = { x: ev.clientX, y: ev.clientY };
    updateTip();
  }

  /** Shift-click: name what is on a tile and ring it for a few seconds, without attacking or walking. */
  function inspectTile(t) {
    let text = null;
    if (G.fight) {
      const a = [...G.fight.actors.values()].find((x) => x.alive && x.pos.x === t.x && x.pos.y === t.y);
      if (a) text = `${a.name}: ${a.hp}/${a.maxHp} health` + (a.statuses && a.statuses.length ? ` (${a.statuses.map((st) => pretty(st.id)).join(', ')})` : '');
    } else {
      const e = [...G.entities.values()].find((x) => Math.round(x.x) === t.x && Math.round(x.y) === t.y);
      if (e) {
        const def = e.kind === 'monster' && G.data && G.data.monsters.get(e.mon);
        const npc = e.kind === 'npc' && G.data && G.data.npcs.get(e.ref);
        text = e.kind === 'monster' ? `${e.name}, level ${e.level}${def ? `, ${def.maxHp} health, hits up to ${def.maxHit}` : ''}` : npc ? `${e.name}, ${npc.role}` : e.kind === 'node' || e.kind === 'station' ? e.name : `${e.name}, level ${e.level}`;
      }
    }
    G.inspect = { x: t.x, y: t.y, until: performance.now() + 4000 };
    toast(text || `Tile ${t.x}, ${t.y}`);
  }

  function onClick(ev) {
    if (!G || G.modal) return;
    const t = tileAt(ev);
    if (ev.shiftKey) return inspectTile(t);
    if (G.fight) return fightTileClick(t);
    const thing = [...G.entities.values()].find((e) => (e.kind === 'npc' || e.kind === 'node' || e.kind === 'station') && Math.round(e.x) === t.x && Math.round(e.y) === t.y);
    if (thing) {
      G.dest = null;
      return window.coe.send({ t: 'interact', target: thing.id });
    }
    const monster = [...G.entities.values()].find((e) => e.kind === 'monster' && Math.round(e.x) === t.x && Math.round(e.y) === t.y);
    if (monster) {
      if (monster.fight) return toast(ERRORS.busy);
      G.dest = null;
      return window.coe.send({ t: 'attack', target: monster.id });
    }
    requestMove(t.x, t.y);
  }

  function onKey(ev) {
    if (!G) return;
    const typing = document.activeElement === $('chatinput');
    if (G.modal) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') {
        ev.preventDefault();
      }
      return;
    }
    if (typing) {
      if (ev.key === 'Escape') $('chatinput').blur();
      return;
    }
    if (townOpen() && /^[1-9]$/.test(ev.key) && !$('dialog').classList.contains('hidden')) {
      const b = $('dlg-options').children[Number(ev.key) - 1];
      if (b) b.click();
      return;
    }
    if (ev.key === 'Escape') {
      if (!$('buy-confirm').classList.contains('hidden')) return closeBuyConfirm();
      closePanels();
      if (G.busy) window.coe.send({ t: 'stop' });
      closeTown(true);
      return;
    }
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === '+' || k === '=') return setZoom(G.zoom + 1);
    if (k === '-' || k === '_') return setZoom(G.zoom - 1);
    if (k === 'm') return setZoom(G.zoom === -12 ? 0 : -12); // the whole map; press again to come back
    if (k === 'l') {
      togglePanel('panel-look');
      return renderLook();
    }
    if (k === 't') return goToTown();
    if (k === 'k') return togglePanel('panel-skills');
    if (k === 'v') return togglePanel('panel-trades');
    if (k === 'j') {
      togglePanel('panel-journal');
      return renderJournal();
    }
    if (k === 'i') return togglePanel('panel-bag');
    if (k === 'c') return togglePanel('panel-stats');
    if (k === 'e' && !G.fight) return togglePanel('panel-equip');
    if (G.fight) {
      if (fightKey(ev.key)) ev.preventDefault();
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      $('chatinput').focus();
      return;
    }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const me = G.self();
    requestMove(me.x + dir[0], me.y + dir[1]);
  }

  function onChat(ev) {
    ev.preventDefault();
    const input = $('chatinput');
    const text = input.value.trim();
    input.value = '';
    input.blur();
    if (text) window.coe.send({ t: 'chat', text });
  }

  const listeners = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn));
  }

  // ---- lifecycle

  // ---- ground, baked once so no two patches of grass look alike
  // Tile ids: 1 grass, 2 flowers, 3 dirt, 4 water, 10 sand, 21 field. A higher rank spreads over a lower one at the seam.
  const GROUND_RANK = { 4: 0, 10: 1, 3: 2, 21: 2, 1: 3, 2: 3 };
  const BLEND_ODDS = [0.85, 0.55, 0.3, 0.12];

  function hash2(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Smooth value noise: neighbouring pixels agree, so the ground drifts in broad light and dark patches. */
  function smooth(x, y, s, cell) {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const fx = x / cell - gx;
    const fy = y / cell - gy;
    const a = hash2(gx, gy, s);
    const b = hash2(gx + 1, gy, s);
    const c = hash2(gx, gy + 1, s);
    const d = hash2(gx + 1, gy + 1, s);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function bakeGround(map, tileset) {
    const cols = map.tileset.columns;
    const W = map.width * TILE;
    const H = map.height * TILE;
    const tmp = document.createElement('canvas');
    tmp.width = tileset.width;
    tmp.height = tileset.height;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(tileset, 0, 0);
    const sd = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
    const sw = tmp.width;
    const out = new ImageData(W, H);
    const od = out.data;
    const gid = (x, y) => (x < 0 || y < 0 || x >= map.width || y >= map.height ? 0 : map.layers.ground[y * map.width + x]);
    const texel = (id, px, py) => {
      const i = id - 1;
      return ((Math.floor(i / cols) * TILE + py) * sw + (i % cols) * TILE + px) * 4;
    };
    const put = (wx, wy, r, g, b) => {
      if (wx < 0 || wy < 0 || wx >= W || wy >= H) return;
      const o = (wy * W + wx) * 4;
      od[o] = r;
      od[o + 1] = g;
      od[o + 2] = b;
      od[o + 3] = 255;
    };

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const id = gid(x, y);
        if (!id) continue;
        const rank = GROUND_RANK[id];
        const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => {
          const n = gid(x + dx, y + dy);
          return n !== id && GROUND_RANK[n] !== undefined && rank !== undefined && GROUND_RANK[n] > rank ? n : 0;
        });
        for (let py = 0; py < TILE; py++) {
          for (let px = 0; px < TILE; px++) {
            const wx = x * TILE + px;
            const wy = y * TILE + py;
            let src = id;
            if (rank !== undefined) {
              const dist = [py, TILE - 1 - py, px, TILE - 1 - px];
              for (let k = 0; k < 4; k++) {
                if (nb[k] && dist[k] < BLEND_ODDS.length && hash2(wx, wy, 77 + k) < BLEND_ODDS[dist[k]]) {
                  src = nb[k];
                  break;
                }
              }
            }
            const o = texel(src, px, py);
            let r = sd[o];
            let g = sd[o + 1];
            let b = sd[o + 2];
            if (rank !== undefined) {
              const f = 0.9 + 0.2 * smooth(wx, wy, 11, 10) + (hash2(wx, wy, 12) - 0.5) * 0.04;
              r *= f;
              g *= f;
              b *= f;
            } else {
              const f = 0.97 + 0.06 * smooth(wx, wy, 13, 6);
              r *= f;
              g *= f;
              b *= f;
            }
            put(wx, wy, Math.min(255, r), Math.min(255, g), Math.min(255, b));
          }
        }
        // Small things lying on the ground
        const h = hash2(x, y, 31);
        const tx = 2 + Math.floor(hash2(x, y, 32) * 12);
        const ty = 3 + Math.floor(hash2(x, y, 33) * 10);
        const wx = x * TILE + tx;
        const wy = y * TILE + ty;
        if (id === 1 && h < 0.24) {
          put(wx, wy, 52, 100, 44);
          put(wx, wy - 1, 112, 168, 72);
          put(wx - 1, wy - 1, 132, 180, 82);
          put(wx + 1, wy - 1, 132, 180, 82);
        } else if ((id === 1 && h < 0.29) || (id === 3 && h < 0.3) || (id === 10 && h < 0.12)) {
          put(wx, wy, 156, 150, 138);
          put(wx + 1, wy, 176, 170, 156);
          put(wx, wy + 1, 98, 92, 84);
          put(wx + 1, wy + 1, 98, 92, 84);
        }
      }
    }

    // Soft shadows under trees, bushes and crates
    const shade = (cx, cy, rx, ry, k) => {
      for (let wy = Math.floor(cy - ry); wy <= Math.ceil(cy + ry); wy++) {
        for (let wx = Math.floor(cx - rx); wx <= Math.ceil(cx + rx); wx++) {
          if (wx < 0 || wy < 0 || wx >= W || wy >= H) continue;
          const d = ((wx - cx) / rx) ** 2 + ((wy - cy) / ry) ** 2;
          if (d >= 1) continue;
          if (gid(Math.floor(wx / TILE), Math.floor(wy / TILE)) === 4) continue;
          const m = 1 - k * (1 - d);
          const o = (wy * W + wx) * 4;
          od[o] *= m;
          od[o + 1] *= m;
          od[o + 2] *= m;
        }
      }
    };
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const d = map.layers.decor[y * map.width + x];
        if (d === 5) shade(x * TILE + 8, y * TILE + 14, 7.5, 3, 0.34);
        else if (d === 9) shade(x * TILE + 8, y * TILE + 13, 6, 2.4, 0.28);
        else if (d === 16 || d === 18) shade(x * TILE + 8, y * TILE + 14, 6, 2.2, 0.28);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.getContext('2d').putImageData(out, 0, 0);
    return canvas;
  }

  // ---- intro cutscene, shown once to a new hero
  const INTRO_SLIDES = [
    {
      scene: 'seam',
      title: 'The Welling',
      text: 'In the first days of the Wealdmark the hills were green and the rivers ran clear, and far beneath the roots of the mountains there lay a well that was not of water. Men called it the Welling. Where it seeped upward the soil remembered it: toadstools shone with a cold light, wolves cast two shadows, and the beasts of the wood grew wise or cruel as fortune took them.',
    },
    {
      scene: 'seam',
      title: 'The Crown',
      text: 'Of the men who first came into that country, Eldred the Unbroken was the greatest. He went down alone into the dark places and brought up a splinter of the Welling, and of it he made the Crown. Whoever wore it was king, and the land bent to him, stone and root and beast. He reigned three hundred years and died in his sleep, and men wept, for it seemed that the one fixed star had gone out. But he had looked into the deep longer than any man should, and he feared a darker hand would take the Crown. So he broke its true name into five Seals, and hid each beneath the earth with a guardian set over it. Four hundred years the Seals have slept.',
    },
    {
      scene: 'tower',
      title: 'Harvest Eve',
      text: 'Eleven nights ago, on Harvest Eve, Eadwin the Bright was poisoned and stabbed in the Crown Tower at Aldmoor, and the Crown was lifted from its stand. The guard found black ash upon the stair, and upon the floor a white mask, blank and smooth, with its eyeholes sealed. The city says that his daughter Aelwyn died with him. The city is mistaken.',
    },
    {
      scene: 'masks',
      title: 'The Wan Company',
      text: 'No one has claimed the deed. In the lanes they whisper of the Wan Company: masked folk, mostly the lost and the grieving, who teach that fear and self are all that stand between a man and the gifts of the deep. They have a master, but none can say his face. Warden Osric Ashby, who led the guard thirty years, has buried most of those he trusted.',
    },
    {
      scene: 'road',
      title: 'Aldmoor',
      text: 'You come up the south road at dawn, a stranger whose name no one has troubled to learn. The city holds its breath. The Warden has no need of a hero. He has need of someone the Company has not yet noticed, and that someone is you.',
    },
  ];

  function drawIntroScene(ctx, scene, t) {
    const W = 320;
    const H = 180;
    const dawn = scene === 'road';
    const top = dawn ? [34, 28, 70] : [8, 7, 22];
    const bot = dawn ? [236, 160, 112] : [38, 28, 66];
    for (let y = 0; y < H; y++) {
      const k = y / H;
      ctx.fillStyle = `rgb(${Math.round(top[0] + (bot[0] - top[0]) * k)},${Math.round(top[1] + (bot[1] - top[1]) * k)},${Math.round(top[2] + (bot[2] - top[2]) * k)})`;
      ctx.fillRect(0, y, W, 1);
    }
    for (let i = 0; i < 90; i++) {
      const sx = Math.floor(hash2(i, 1, 70) * W);
      const sy = Math.floor(hash2(i, 2, 70) * H * 0.6);
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,248,224,${dawn ? 0.15 * tw : 0.35 + 0.5 * tw})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
    if (!dawn) {
      ctx.fillStyle = '#e8e4d0';
      ctx.beginPath();
      ctx.arc(256, 34, 12, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(8,7,22,0.35)';
      ctx.beginPath();
      ctx.arc(251, 31, 10, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,230,160,0.9)';
      ctx.beginPath();
      ctx.arc(70, 118, 16, 0, 7);
      ctx.fill();
    }
    const hills = (base, amp, freq, color, phase) => {
      ctx.fillStyle = color;
      for (let x = 0; x < W; x++) ctx.fillRect(x, Math.round(base + Math.sin(x / freq + phase) * amp + Math.sin(x / (freq * 0.37) + phase * 2) * amp * 0.3), 1, H);
    };
    if (scene === 'seam') {
      hills(104, 14, 22, '#1c1a3a', 0);
      hills(128, 10, 16, '#121028', 2);
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.6);
      for (let i = 0; i < 30; i++) {
        const x = 150 + Math.round(Math.sin(i * 0.9) * 6);
        ctx.fillStyle = `rgba(90,220,230,${(0.5 + 0.4 * pulse) * (1 - i / 36)})`;
        ctx.fillRect(x, 130 + i, 2, 1);
        ctx.fillStyle = `rgba(90,220,230,${0.08 * pulse})`;
        ctx.fillRect(x - 6, 130 + i, 14, 1);
      }
      const cy = 78 + Math.round(Math.sin(t * 1.4) * 3);
      ctx.fillStyle = '#f4cf5c';
      ctx.fillRect(148, cy + 6, 14, 4);
      for (const dx of [148, 153, 160]) ctx.fillRect(dx, cy, 2, 7);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(149, cy + 6, 12, 1);
      const glow = ctx.createRadialGradient(155, cy + 5, 2, 155, cy + 5, 34);
      glow.addColorStop(0, `rgba(244,207,92,${0.35 * pulse})`);
      glow.addColorStop(1, 'rgba(244,207,92,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(110, cy - 30, 90, 70);
    } else if (scene === 'tower') {
      hills(138, 5, 30, '#14122c', 1);
      for (let i = 0; i < 14; i++) {
        const bx = 8 + i * 22;
        const bh = 20 + Math.floor(hash2(i, 3, 71) * 26);
        ctx.fillStyle = '#0e0c20';
        ctx.fillRect(bx, 150 - bh, 18, bh + 30);
        ctx.fillStyle = `rgba(244,196,96,${0.4 + 0.3 * Math.sin(t * 3 + i * 2)})`;
        if (hash2(i, 4, 71) > 0.4) ctx.fillRect(bx + 5, 150 - bh + 8, 3, 3);
      }
      ctx.fillStyle = '#0a0818';
      ctx.fillRect(138, 40, 44, 150);
      for (let j = 0; j < 14; j++) ctx.fillRect(146 + j, 40 - j, 28 - j * 2 > 0 ? 28 - j * 2 : 0, 1);
      ctx.fillRect(158, 14, 4, 12);
      for (const [wx, wy] of [[150, 60], [166, 60], [150, 90], [166, 90], [158, 120]]) {
        ctx.fillStyle = `rgba(250,206,110,${0.55 + 0.35 * Math.sin(t * 5 + wx + wy)})`;
        ctx.fillRect(wx, wy, 4, 8);
      }
      ctx.fillStyle = 'rgba(30,28,36,0.9)';
      for (let i = 0; i < 46; i++) {
        const ax = (hash2(i, 5, 72) * W + t * 6 * (0.5 + hash2(i, 6, 72))) % W;
        const ay = (hash2(i, 7, 72) * H + t * 14 * (0.5 + hash2(i, 8, 72))) % H;
        ctx.fillRect(Math.floor(ax), Math.floor(ay), 1, 1);
      }
    } else if (scene === 'masks') {
      hills(140, 4, 28, '#0f0d22', 0);
      ctx.fillStyle = 'rgba(120,110,160,0.18)';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, 128 + i * 8 + Math.round(Math.sin(t + i) * 2), W, 5);
      const figures = [[70, 0.8], [110, 0.9], [160, 1.25], [210, 0.9], [250, 0.8]];
      for (const [fx, sc] of figures) {
        const sway = Math.round(Math.sin(t * 1.2 + fx) * 1.5);
        const h = Math.round(64 * sc);
        ctx.fillStyle = '#07060f';
        for (let j = 0; j < h; j++) {
          const w = Math.round((6 + j * 0.32) * sc);
          ctx.fillRect(fx - Math.floor(w / 2) + sway * (1 - j / h), 160 - h + j, w, 1);
        }
        ctx.fillStyle = '#f2f0ea';
        ctx.beginPath();
        ctx.ellipse(fx + sway, 160 - h + 6 * sc, 4.2 * sc, 5.4 * sc, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(fx + sway, 160 - h + 2 * sc, 1, Math.round(8 * sc));
      }
    } else {
      hills(122, 10, 40, '#3a3a5c', 0);
      hills(140, 8, 26, '#26324a', 1);
      ctx.fillStyle = '#1a2036';
      ctx.fillRect(206, 104, 70, 30);
      for (let i = 0; i < 7; i++) ctx.fillRect(206 + i * 11, 100, 6, 4);
      ctx.fillRect(236, 70, 10, 36);
      for (let j = 0; j < 7; j++) ctx.fillRect(237 + j, 70 - j, Math.max(0, 8 - j * 2), 1);
      ctx.fillStyle = 'rgba(250,206,110,0.8)';
      ctx.fillRect(240, 84, 2, 5);
      hills(150, 5, 18, '#1e2a3c', 3);
      ctx.fillStyle = '#9a8460';
      for (let y = 134; y < H; y++) {
        const k = (y - 134) / (H - 134);
        const w = 6 + k * 70;
        const cx = 160 + (1 - k) * 60 - k * 20;
        ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w), 1);
      }
      const k = (Math.sin(t * 0.5) * 0.5 + 0.5) * 0.4 + 0.45;
      const hx = Math.round(160 + (1 - k) * 60 - k * 20);
      const hy = Math.round(134 + k * (H - 134));
      ctx.fillStyle = '#0c0a14';
      ctx.fillRect(hx - 2, hy - 12, 4, 8);
      ctx.fillRect(hx - 3, hy - 14, 6, 3);
      ctx.fillRect(hx - 3, hy - 5 + (Math.floor(t * 4) % 2), 2, 5);
      ctx.fillRect(hx + 1, hy - 5 + ((Math.floor(t * 4) + 1) % 2), 2, 5);
    }
  }

  function playIntro(done) {
    const box = $('intro');
    const canvas = $('intro-canvas');
    const textEl = $('intro-text');
    const titleEl = $('intro-title');
    const ctx = canvas.getContext('2d');
    let index = 0;
    let chars = 0;
    let last = performance.now();
    let raf = 0;
    let over = false;
    box.classList.remove('hidden');

    const finish = () => {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      box.removeEventListener('click', advance);
      $('intro-skip').removeEventListener('click', skip);
      box.classList.add('hidden');
      done();
    };
    const skip = (e) => {
      if (e) e.stopPropagation();
      finish();
    };
    const advance = () => {
      const slide = INTRO_SLIDES[index];
      if (chars < slide.text.length) {
        chars = slide.text.length;
        return;
      }
      index++;
      chars = 0;
      if (index >= INTRO_SLIDES.length) finish();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      }
    };
    const tick = (now) => {
      if (over) return;
      const slide = INTRO_SLIDES[index];
      chars = Math.min(slide.text.length, chars + ((now - last) / 1000) * 46);
      last = now;
      drawIntroScene(ctx, slide.scene, now / 1000);
      titleEl.textContent = slide.title;
      textEl.textContent = slide.text.slice(0, Math.floor(chars));
      $('intro-hint').textContent = chars >= slide.text.length ? (index === INTRO_SLIDES.length - 1 ? 'Space to begin' : 'Space to continue') : 'Space to read faster';
      raf = requestAnimationFrame(tick);
    };
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('click', advance);
    $('intro-skip').addEventListener('click', skip);
    raf = requestAnimationFrame(tick);
  }

  /** Soft ground shadows under standing scenery: [half width, half height, lean to the right], in tiles. */
  const DECOR_SHADOW = { 5: [0.46, 0.13, 0.08], 23: [0.3, 0.1, 0.08], 24: [0.3, 0.1, 0.08], 9: [0.4, 0.11, 0.05], 18: [0.4, 0.12, 0.06], 25: [0.3, 0.09, 0.04], 16: [0.4, 0.1, 0.05], 20: [0.42, 0.11, 0.05], 15: [0.46, 0.12, 0.05], 28: [0.42, 0.09, 0.05], 17: [0.2, 0.07, 0.08], 14: [0.5, 0.14, 0.04], 22: [0.44, 0.11, 0.05], 29: [0.26, 0.08, 0.05] };

  // ---- buildings: painted roofs and fronts, drawn over the walled rooms
  const ROOFS = [[200, 74, 84], [102, 138, 176], [200, 108, 54], [92, 148, 100], [140, 106, 168], [60, 142, 150], [120, 120, 130], [214, 170, 70]];

  /** A building is a ring of wall tiles around a plank or carpet floor. Roofs hide when you step inside. */
  function findBuildings(map) {
    const W = map.width;
    const H = map.height;
    const g = map.layers.ground;
    const seen = new Uint8Array(W * H);
    const out = [];
    for (let sy = 0; sy < H; sy++) {
      for (let sx = 0; sx < W; sx++) {
        if (g[sy * W + sx] !== 6 || seen[sy * W + sx]) continue;
        let x0 = sx;
        let x1 = sx;
        let y0 = sy;
        let y1 = sy;
        const stack = [[sx, sy]];
        seen[sy * W + sx] = 1;
        while (stack.length) {
          const [x, y] = stack.pop();
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || g[ny * W + nx] !== 6) continue;
            seen[ny * W + nx] = 1;
            stack.push([nx, ny]);
          }
        }
        const w = x1 - x0 + 1;
        const h = y1 - y0 + 1;
        if (w < 5 || h < 5 || w > 20 || h > 16) continue;
        let floor = 0;
        for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) if (g[y * W + x] === 11 || g[y * W + x] === 13) floor++;
        if (floor < (w - 2) * (h - 2) * 0.6) continue;
        const doors = [];
        for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (g[y * W + x] !== 6) doors.push({ x, y });
        for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) if (g[y * W + x] !== 6) doors.push({ x, y });
        if (!doors.length) continue;
        const b = { x0, y0, x1, y1, doors, alpha: 1, color: ROOFS[Math.floor(hash2(x0, y0, 55) * ROOFS.length)] };
        b.sprite = paintBuilding(b);
        out.push(b);
      }
    }
    return out;
  }

  /** The sprite reaches past the footprint: eaves 4px out on three sides, and a cast shadow 5px out on the other two. */
  const EAVE = 4;
  const CAST = 5;

  function paintBuilding(b) {
    const w = (b.x1 - b.x0 + 1) * TILE;
    const h = (b.y1 - b.y0 + 1) * TILE;
    const roofH = h - TILE;
    const cw = EAVE + w + Math.max(EAVE, CAST);
    const ch = EAVE + h + CAST;
    const img = new ImageData(cw, ch);
    const d = img.data;
    const door = new Set(b.doors.map((p) => `${p.x - b.x0},${p.y - b.y0}`));
    const put = (u, v, r, g, bl, a = 255) => {
      const cu = u + EAVE;
      const cv = v + EAVE;
      if (cu < 0 || cv < 0 || cu >= cw || cv >= ch) return;
      const o = (cv * cw + cu) * 4;
      d[o] = Math.max(0, Math.min(255, r));
      d[o + 1] = Math.max(0, Math.min(255, g));
      d[o + 2] = Math.max(0, Math.min(255, bl));
      d[o + 3] = a;
    };
    const [cr, cg, cb] = b.color;
    // Roof geometry in sprite-local pixels (u, v from the footprint's top left). The roof spans EAVE past the footprint on three sides.
    const RW = w + 2 * EAVE;
    const RH = roofH + EAVE;
    const rr = Math.round(RH * 0.34);
    const hip = Math.min(RH * 0.55, RW / 2.6);

    // Shadow first, so the building paints over it.
    for (let v = CAST; v < h + CAST; v++) {
      for (let u = CAST; u < w + CAST; u++) {
        if (u < w && v < h) continue;
        put(u, v, 20, 24, 12, 78);
      }
    }

    // Roof: back slope, ridge, front slope, two hips.
    for (let rv = 0; rv < RH; rv++) {
      for (let ru = 0; ru < RW; ru++) {
        const u = ru - EAVE;
        const v = rv - EAVE;
        const row = Math.floor(rv / 4);
        const off = (row % 2) * 4;
        const col = Math.floor((ru + off) / 8);
        let k = 0.9 + hash2(col, row, 56) * 0.2;
        if (rv % 4 === 0) k += 0.12;
        if (rv % 4 === 3 || (ru + off) % 8 === 7) k -= 0.2;
        const dd = rv < rr ? (rr - rv) / rr : (rv - rr) / Math.max(1, RH - 1 - rr);
        const left = ru < hip * (1 - dd);
        const right = ru > RW - 1 - hip * (1 - dd);
        if (left) k *= 0.86;
        else if (right) k *= 0.6;
        else if (rv < rr) k *= 0.72;
        // Ridge cap and hip lines catch the light.
        if (!left && !right && Math.abs(rv - rr) <= 1) k = rv === rr ? 1.5 : 1.28;
        else if (left !== (ru < hip * (1 - dd) + 1.4) || right !== (ru > RW - 1 - hip * (1 - dd) - 1.4)) k += 0.3;
        // Eave edge: a dark lip, and the underside shadow falls on the wall below.
        if (rv >= RH - 2) k = 0.42;
        else if (rv >= RH - 5) k -= 0.1 * (rv - (RH - 6));
        if (ru === 0 || ru === RW - 1 || rv === 0) k = 0.4;
        put(u, v, cr * k, cg * k, cb * k);
      }
    }

    // Front wall: a plank base, a window row, and the eave shadow along the top.
    for (let v = roofH; v < h; v++) {
      for (let u = 0; u < w; u++) {
        const tx = Math.floor(u / TILE);
        const ty = Math.floor(v / TILE);
        const fy = v - roofH;
        if (door.has(`${tx},${ty}`)) {
          const tu = u % TILE;
          if (fy < 3) put(u, v, 96, 62, 36);
          else if (tu < 2 || tu > 13) put(u, v, 120, 80, 46);
          continue;
        }
        const tu = u % TILE;
        const win = tx % 3 === 1 && tu >= 4 && tu <= 11 && fy >= 4 && fy <= 10;
        if (fy < 4) {
          const t = 1 - fy * 0.18;
          put(u, v, 70 * t, 48 * t, 34 * t);
        } else if (fy >= 13) put(u, v, 118 + hash2(u, v, 57) * 20, 106 + hash2(u, v, 57) * 18, 94);
        else if (win) {
          const frame = tu === 4 || tu === 11 || fy === 4 || fy === 10;
          const mull = tu === 7 || tu === 8 || fy === 7;
          if (frame) put(u, v, 250, 243, 221);
          else if (mull) put(u, v, 120, 96, 70);
          else put(u, v, fy < 7 ? 170 : 128, fy < 7 ? 206 : 168, fy < 7 ? 236 : 210);
        } else if (tu === 0 || tu === TILE - 1) put(u, v, 140, 98, 60);
        else {
          const n = hash2(u >> 1, v, 58) * 14;
          const t = fy < 6 ? 0.82 + fy * 0.03 : 1;
          put(u, v, (228 - n) * t, (210 - n) * t, (170 - n) * t);
        }
      }
    }

    // Chimney on the front slope, clear of the hips.
    const cx = Math.floor(w * (0.55 + hash2(b.x0, b.y0, 60) * 0.2));
    if (w >= 6 * TILE && hash2(b.x0, b.y0, 59) > 0.3 && cx > hip + 4 && cx + 10 < w - hip) {
      const top = rr - EAVE - 13;
      for (let v = top; v < rr - EAVE + 7; v++) {
        for (let u = cx; u < cx + 9; u++) {
          const brick = (v + (Math.floor((v - top) / 3) % 2) * 3) % 6 === 0 || (u - cx + (Math.floor((v - top) / 3) % 2) * 2) % 4 === 0;
          let r = 150;
          let g = 88;
          let bl = 70;
          if (u >= cx + 6) {
            r = 112;
            g = 62;
            bl = 52;
          }
          if (brick) {
            r -= 24;
            g -= 16;
            bl -= 14;
          }
          if (v < top + 3) {
            r = 96;
            g = 96;
            bl = 104;
            if (u === cx || u === cx + 8) r = g = bl = 70;
          }
          put(u, v, r, g, bl);
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext('2d').putImageData(img, 0, 0);
    return canvas;
  }

  /** Fade each roof out while the hero stands inside, and draw it over everything else. */
  function drawRoofs(ctx, offX, offY, px) {
    if (!G.buildings) return;
    const me = G.self();
    const mx = Math.round(me.x);
    const my = Math.round(me.y);
    for (const b of G.buildings) {
      const inside = mx > b.x0 && mx < b.x1 && my > b.y0 && my < b.y1;
      b.alpha += ((inside ? 0 : 1) - b.alpha) * 0.18;
      if (b.alpha < 0.03) continue;
      ctx.globalAlpha = b.alpha;
      const sc = px / TILE;
      ctx.drawImage(b.sprite, offX + b.x0 * px - EAVE * sc, offY + b.y0 * px - EAVE * sc, b.sprite.width * sc, b.sprite.height * sc);
    }
    ctx.globalAlpha = 1;
  }

  const roofed = (x, y) => !!G.buildings && G.buildings.some((b) => b.alpha > 0.5 && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1);

  // ---- what is under the mouse
  const TILE_INFO = {
    decor: {
      5: ['Oak tree', 'Scenery. Trees you can chop show their name when you stand close.'],
      23: ['Pine tree', 'Scenery. Tall, dark and narrow.'],
      24: ['Birch tree', 'Scenery. Pale trunk, light leaves.'],
      9: ['Bush', 'Blocks the way.'],
      16: ['Crate', 'Blocks the way.'],
      18: ['Boulder', 'Blocks the way.'],
      19: ['Fence', 'Blocks the way.'],
      20: ['Hay bale', 'Blocks the way.'],
      22: ['Ruined wall', 'Old stonework. Blocks the way.'],
      17: ['Lamp post', 'Blocks the way.'],
      12: ['Town gate', 'The way in and out of the city.'],
      14: ['Fountain', 'Blocks the way.'],
      15: ['Market stall', 'Blocks the way.'],
      25: ['Tree stump', 'Blocks the way.'],
      26: ['Mushrooms', 'Red caps. Not for eating.'],
      27: ['Tall grass', 'You can walk through it.'],
      28: ['Bench', 'Blocks the way.'],
      29: ['Signpost', 'Points the way.'],
    },
    ground: {
      4: ['Water', "You can't walk here. Fishing shoals show in it."],
      6: ['Wall', 'Stone and timber. Blocks the way.'],
      10: ['Sand', ''],
      3: ['Dirt path', ''],
      7: ['Cobblestones', ''],
      11: ['Wooden floor', ''],
      13: ['Carpet', ''],
      21: ['Farm field', ''],
    },
  };

  function tipFor(t) {
    const map = G.map;
    if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height) return null;
    const e = [...G.entities.values()].find((x) => x.id !== G.selfId && Math.round(x.x) === t.x && Math.round(x.y) === t.y && !roofed(t.x, t.y));
    if (e) {
      if (e.kind === 'monster') {
        const def = G.data && G.data.monsters.get(e.mon);
        const tag = def && def.boss ? 'Boss' : def && def.miniboss ? 'Miniboss' : 'Monster';
        return [`${e.name}, level ${e.level}`, foeNote(e.level), tag + (def ? `. ${def.maxHp} health, hits up to ${def.maxHit}.` : '.'), e.fight ? 'Busy fighting.' : 'Click to fight.'];
      }
      if (e.kind === 'npc') {
        const npc = G.data && G.data.npcs.get(e.ref);
        return [e.name, npc ? npc.role : 'Townsperson', 'Click to talk.'];
      }
      if (e.kind === 'node') {
        const def = G.data && G.data.nodes.get(e.ref);
        if (!def) return [e.name];
        const have = skillLevel(def.skill);
        const ok = have >= def.level;
        return [e.name, `${SKILL_LABEL[def.skill] || pretty(def.skill)} level ${def.level}. You have ${have}.`, e.depleted ? 'Depleted. It will grow back soon.' : ok ? 'Click to gather.' : 'Your skill level is too low.'];
      }
      if (e.kind === 'station') return [e.name, 'Click to use.'];
      return [e.name, `Level ${e.level}`];
    }
    const dec = TILE_INFO.decor[map.layers.decor[t.y * map.width + t.x]];
    if (dec) return dec;
    const gr = TILE_INFO.ground[map.layers.ground[t.y * map.width + t.x]];
    if (gr && (map.layers.ground[t.y * map.width + t.x] === 4 || map.layers.ground[t.y * map.width + t.x] === 6)) return gr;
    return null;
  }

  function updateTip() {
    const tip = G && G.tip;
    if (!tip) return;
    const info = G.mouse && !G.modal && !G.fight && G.hover ? tipFor(G.hover) : null;
    if (!info) {
      tip.classList.add('hidden');
      return;
    }
    tip.textContent = '';
    info.forEach((line, i) => {
      if (!line) return;
      const row = document.createElement('div');
      row.className = i === 0 ? 'tip-title' : 'tip-line';
      row.textContent = line;
      tip.appendChild(row);
    });
    tip.classList.remove('hidden');
    const box = G.canvas.getBoundingClientRect();
    const left = Math.min(G.mouse.x - box.left + 16, box.width - tip.offsetWidth - 6);
    const top = Math.min(G.mouse.y - box.top + 16, box.height - tip.offsetHeight - 6);
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${Math.max(4, top)}px`;
  }

  async function start(welcome, map) {
    const img = new Image();
    const url = await window.coe.readImage(map.tileset.image);
    if (!url) throw new Error('missing_tileset');
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('bad_tileset'));
      img.src = url;
    });
    const data = await window.coe.data();
    let ground = null;
    try {
      ground = bakeGround(map, img);
    } catch (e) {
      console.warn('ground bake failed, drawing plain tiles', e);
    }

    let buildings = [];
    try {
      buildings = findBuildings(map);
    } catch (e) {
      console.warn('buildings failed', e);
    }
    const tip = document.createElement('div');
    tip.id = 'hover-tip';
    tip.className = 'hidden';
    $('stage').parentElement.appendChild(tip);

    const canvas = $('stage');
    const now = performance.now();
    G = {
      canvas,
      ctx: canvas.getContext('2d'),
      map,
      tileset: img,
      ground,
      buildings,
      tip,
      mouse: null,
      tickMs: welcome.tickMs,
      selfId: welcome.you.id,
      entities: new Map(),
      data: data ? {
        items: new Map(data.items.map((i) => [i.id, i])),
        monsters: new Map(data.monsters.map((m) => [m.id, m])),
        npcs: new Map((data.npcs || []).map((n) => [n.id, n])),
        shops: new Map((data.shops || []).map((n) => [n.id, n])),
        nodes: new Map((data.nodes || []).map((n) => [n.id, n])),
        stations: new Map((data.stations || []).map((n) => [n.id, n])),
        recipes: new Map((data.recipes || []).map((n) => [n.id, n])),
        quests: new Map((data.quests || []).map((n) => [n.id, n])),
        mods: data.mods || {},
        trees: data.trees || [],
      } : null,
      town: null,
      storage: null,
      perks: null,
      quests: null,
      busy: null,
      stats: null,
      inv: null,
      fight: null,
      floaters: [],
      shots: [],
      modal: false,
      scale: 3,
      zoom: loadZoom(),
      off: { x: 0, y: 0 },
      hover: null,
      dest: null,
      hudAt: 0,
      raf: 0,
      self() {
        return this.entities.get(this.selfId);
      },
    };
    G.entities.set(welcome.you.id, makeEntity(welcome.you, now));
    for (const v of welcome.entities) G.entities.set(v.id, makeEntity(v, now));
    $('chatlog').textContent = '';
    addLog('You enter ' + map.name + '.');
    setupSound();

    on(canvas, 'mousemove', onMouseMove);
    on(canvas, 'mouseleave', () => {
      if (!G) return;
      G.mouse = null;
      updateTip();
    });
    on(canvas, 'click', onClick);
    on(canvas, 'wheel', (ev) => {
      ev.preventDefault();
      setZoom(G.zoom + (ev.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    on(window, 'keydown', onKey);
    on($('chatform'), 'submit', onChat);
    on($('chat-prev'), 'click', () => $('chatlog').scrollBy({ top: -Math.max(40, $('chatlog').clientHeight - 20), behavior: 'smooth' }));
    on($('chat-next'), 'click', () => $('chatlog').scrollBy({ top: Math.max(40, $('chatlog').clientHeight - 20), behavior: 'smooth' }));
    on($('btn-trades'), 'click', () => togglePanel('panel-trades'));
    on($('bc-no'), 'click', closeBuyConfirm);
    on($('bc-yes'), 'click', () => {
      const pending = G.buyPending;
      closeBuyConfirm();
      if (pending) window.coe.send({ t: 'buy', item: pending.item, qty: pending.qty });
    });
    setupWindows();
    on($('btn-skills'), 'click', () => togglePanel('panel-skills'));
    on($('btn-bag'), 'click', () => togglePanel('panel-bag'));
    on($('btn-equip'), 'click', () => togglePanel('panel-equip'));
    on($('btn-stats'), 'click', () => togglePanel('panel-stats'));
    on($('btn-sound'), 'click', () => togglePanel('panel-sound'));
    on($('btn-journal'), 'click', () => {
      togglePanel('panel-journal');
      renderJournal();
    });
    for (const id of ['shop-close', 'storage-close', 'station-close', 'perks-close', 'anchor-close']) on($(id), 'click', () => closeTown(true));
    on($('btn-town'), 'click', goToTown);
    on($('btn-look'), 'click', () => {
      togglePanel('panel-look');
      renderLook();
    });
    buildLookPanel();
    on($('vol-master'), 'input', (e) => window.coeAudio.set('master', e.target.value));
    on($('vol-sfx'), 'input', (e) => window.coeAudio.set('sfx', e.target.value));
    on($('vol-music'), 'input', (e) => window.coeAudio.set('music', e.target.value));
    on($('mute'), 'change', (e) => window.coeAudio.set('muted', e.target.checked));

    for (const m of early.splice(0)) handle(m);
    if (welcome.intro) {
      playIntro(() => {
        window.coe.send({ t: 'intro_done' });
        toast('Talk to Reeve Ivy Penn near the bellstone to learn the basics.');
      });
    }
    G.raf = requestAnimationFrame(frame);
    G.ping = setInterval(() => window.coe.send({ t: 'ping', n: Math.floor(performance.now()) }), 15000);
  }

  function stop() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    clearInterval(G.ping);
    if (window.coeAudio) window.coeAudio.music(null);
    for (const off of listeners.splice(0)) off();
    openOrder.length = 0;
    for (const p of [...PANELS, ...TOWN_PANELS, 'turns', 'fightbar', 'busy']) $(p).classList.add('hidden');
    G = null;
    early.length = 0;
  }

  /** A read-only view of the game for tests and debugging. */
  function debug() {
    if (!G) return null;
    return {
      fighting: Boolean(G.fight),
      myTurn: isMyTurn(),
      animating: Boolean(G.fight && (G.fight.queue.length || G.fight.pending)),
      round: G.fight ? G.fight.round : 0,
      marks: G.fight ? G.fight.marks || [] : [],
      reachTiles: G.fight && G.fight.options ? G.fight.options.reach : [],
      hero: G.fight && hero() ? { hp: hero().hp, maxHp: hero().maxHp, mana: hero().mana, pos: hero().pos } : null,
      enemies: G.fight ? [...G.fight.actors.values()].filter((a) => a.side === 'enemy').map((a) => ({ id: a.id, name: a.name, hp: a.hp, alive: a.alive, pos: a.pos })) : [],
      stats: G.stats,
      inventory: G.inv,
      modal: G.modal,
      town: townOpen() ? G.town : null,
      busy: G.busy,
      quests: G.quests,
      storage: G.storage,
      entities: [...G.entities.values()].map((e) => ({ id: e.id, name: e.name, kind: e.kind, ref: e.ref, depleted: e.depleted, x: e.x, y: e.y, fight: e.fight })),
      scale: G.scale,
      zoom: G.zoom,
      options: G.fight && G.fight.options ? { moveLeft: G.fight.options.moveLeft, acted: G.fight.options.acted, canSwap: G.fight.options.canSwap, selected: G.fight.selected, titles: [...document.querySelectorAll('#actions button')].map((b) => b.title), abilities: G.fight.options.abilities.map((a) => a.id), reach: G.fight.options.reach.length } : null,
    };
  }

  /** Where a tile's centre is on screen, for tests that click on tiles. */
  function tileCenter(x, y) {
    if (!G) return null;
    const rect = G.canvas.getBoundingClientRect();
    const px = TILE * G.scale;
    return { x: rect.left + G.off.x + x * px + px / 2, y: rect.top + G.off.y + y * px + px / 2 };
  }

  window.coeGame = { start, stop, handle, debug, playIntro, tileCenter, isRunning: () => G !== null };
})();
