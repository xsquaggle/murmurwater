import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { accept, onQuestEvent, turnIn, QUESTS } from '../src/core/quests';
import { REGIONS } from '../src/core/content';
import { Heightfield } from '../src/core/world';
import { dockDeckAt } from '../src/core/dock';
import { BOATYARD_FLAG, afterDecline, afterTurnIn, allVoiceLines, converse, textHash } from '../src/game/talk';

describe('conversations', () => {
  it('turning a job down leaves the stall open: Mara still buys the catch and shows the shelf', () => {
    const s = newGame(1);
    // The flounder is handed in; Mara has two more jobs to offer, and the hold is full of fish to sell.
    s.quests.done.push('hb-01-salt', 'hb-02-supper', 'hb-03-proper-rod', 'hb-04-sketch', 'hb-05-ferry', 'hb-06-relight', 'hb-07-kettle', 'hb-08-teeth');
    s.flags.push('shop-open');
    for (let i = 0; i < 5; i++) s.hold.push({ uid: s.nextUid++, fishId: 'butterperch', weight: 0.4, trait: null, value: 12, perfect: false });
    const offer = converse(s, 'mara', 'hearthbay');
    expect(offer.choices.map((c) => c.action.type)).toEqual(['accept', 'decline']);
    const rest = afterDecline(s, 'mara', 'hearthbay');
    expect(rest?.choices.map((c) => c.action.type)).toEqual(['sell', 'shop', 'bye']);
    expect(rest?.lines).toHaveLength(0);
    // Someone with nothing else to offer just says goodbye.
    expect(afterDecline(s, 'wick', 'hearthbay')).toBeNull();
  });

  it('Mara opens with the first job, then reminds, then hands in and offers the next', () => {
    const s = newGame(1);
    const c1 = converse(s, 'mara', 'hearthbay');
    expect(c1.lines[0].voice).toBe('mara/hb-01-salt.intro.0');
    expect(c1.choices.map((c) => c.action.type)).toEqual(['accept', 'decline']);
    accept(s, 'hb-01-salt');
    const c2 = converse(s, 'mara', 'hearthbay');
    expect(c2.lines).toHaveLength(1);
    expect(c2.lines[0].voice).toBe('mara/hb-01-salt.reminder');
    for (let i = 0; i < 3; i++) onQuestEvent(s, { type: 'catch', fishId: 'butterperch', weight: 1, trait: null, perfect: false });
    const c3 = converse(s, 'mara', 'hearthbay');
    expect(c3.turnIn).toBe('hb-01-salt');
    turnIn(s, 'hb-01-salt');
    const next = afterTurnIn(s, 'mara', 'hearthbay');
    expect(next.lines[0].voice).toBe('mara/hb-02-supper.intro.0');
  });

  it('only offers selling when there is something to sell, and the shop once it is open', () => {
    const s = newGame(1);
    s.quests.done.push('hb-01-salt'); accept(s, 'hb-02-supper');
    expect(converse(s, 'mara', 'hearthbay').choices.some((c) => c.action.type === 'sell')).toBe(false);
    s.hold.push({ uid: 1, fishId: 'butterperch', weight: 1, trait: null, value: 5, perfect: false });
    expect(converse(s, 'mara', 'hearthbay').choices.some((c) => c.action.type === 'sell')).toBe(true);
    expect(converse(s, 'mara', 'hearthbay').choices.some((c) => c.action.type === 'shop')).toBe(false);
    s.flags.push('shop-open');
    expect(converse(s, 'mara', 'hearthbay').choices.some((c) => c.action.type === 'shop')).toBe(true);
  });

  it('Pell only ferries once the relight is under way, and always ferries you home from Gull Point', () => {
    const s = newGame(1);
    const ferry = (island: string) => converse(s, 'pell', island).choices.find((c) => c.action.type === 'ferry');
    expect(ferry('hearthbay')).toBeUndefined();
    s.quests.done.push('hb-01-salt', 'hb-02-supper', 'hb-03-proper-rod', 'hb-05-dark-lamp');
    accept(s, 'hb-06-relight');
    expect(ferry('hearthbay')?.action).toEqual({ type: 'ferry', to: 'gull-point' });
    expect(ferry('gull-point')?.action).toEqual({ type: 'ferry', to: 'hearthbay' });
  });

  it('Pell keeps a boatyard at the home dock once the Puffin is found, and nowhere else', () => {
    const s = newGame(1);
    s.boats.owned.push('skiff'); s.boats.current = 'skiff';
    const yard = (island: string) => converse(s, 'pell', island).choices.find((c) => c.action.type === 'boatyard');
    expect(yard('hearthbay')).toBeUndefined();
    s.flags.push(BOATYARD_FLAG);
    expect(yard('hearthbay')?.label).toBe('About the Puffin.');
    expect(yard('gull-point')).toBeUndefined();
    s.boats.owned.push('puffin');
    expect(yard('hearthbay')?.label).toBe('About the boats.');
    // He rows nobody who has a boat of their own.
    expect(converse(s, 'pell', 'hearthbay').choices.some((c) => c.action.type === 'ferry')).toBe(false);
  });

  it('what the crew and the pots have landed is sold with the catch, at the stall and at the box', () => {
    const s = newGame(1);
    s.quests.done.push('hb-01-salt'); accept(s, 'hb-02-supper');
    const sell = (who: string) => converse(s, who, 'hearthbay', 0, 0, true).choices.find((c) => c.action.type === 'sell');
    expect(sell('mara')).toBeUndefined();
    s.crew.hold.push({ uid: 1, fishId: 'butterperch', weight: 1, trait: null, value: 5, perfect: false });
    expect(sell('mara')?.label).toBe('Sell my catch (1 fish)');
    s.pots.hold.push({ uid: 2, fishId: 'butterperch', weight: 1, trait: null, value: 5, perfect: false });
    s.hold.push({ uid: 3, fishId: 'butterperch', weight: 1, trait: null, value: 5, perfect: false });
    expect(sell('mara')?.label).toBe('Sell my catch (3 fish)');
    expect(sell('packet-box')?.label).toBe('Sell my catch (3 fish)');
  });

  it('barks rotate without repeating back to back', () => {
    const s = newGame(1);
    const a = converse(s, 'wick', 'hearthbay', 1).lines[0].text;
    const b = converse(s, 'wick', 'hearthbay', 2).lines[0].text;
    expect(a).not.toBe(b);
  });

  it('every line has a unique voice file key', () => {
    const lines = allVoiceLines();
    expect(lines.length).toBeGreaterThan(30);
    expect(new Set(lines.map((l) => l.voice)).size).toBe(lines.length);
    for (const l of lines) expect(l.voice).toMatch(/^[a-z]+\/[a-z0-9.-]+$/);
    expect(QUESTS.every((q) => lines.some((l) => l.voice === `${q.giver}/${q.id}.intro.0`))).toBe(true);
  });
});

describe('world layout', () => {
  it('every NPC spot and interaction point is on walkable ground or the dock', () => {
    for (const r of REGIONS) {
      const hf = new Heightfield(r);
      const walkable = (x: number, z: number) => dockDeckAt(r.landmarks.dock, x, z) !== null || (hf.height(x, z) >= 0.15 && hf.normal(x, z, 0.8)[1] >= 0.62);
      for (const sp of r.npcSpots ?? []) expect(walkable(sp.x, sp.z), `npc ${sp.npc} on ${sp.island}`).toBe(true);
      for (const p of (r.places ?? []).filter((x) => !x.fromBoat)) expect(walkable(p.x, p.z), `place ${p.id}`).toBe(true);
      for (const [k, f] of Object.entries(r.ferry ?? {})) expect(walkable(f.x, f.z), `ferry landing ${k}`).toBe(true);
      for (const c of r.critters ?? []) expect(walkable(c.x, c.z), `critter ${c.id} home`).toBe(true);
    }
  });
});

describe('voice lines', () => {
  it('hashes text stably so recordings can be matched to their lines', () => {
    expect(textHash('Three fish, love.')).toBe(textHash('Three fish, love.'));
    expect(textHash('Three fish, love.')).not.toBe(textHash('Three fish, love!'));
    expect(textHash('')).toBe('811c9dc5');
  });
});
