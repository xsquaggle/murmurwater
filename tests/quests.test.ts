import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import {
  QUESTS, abandonBoard, accept, acceptBoard, arriveIn, currentGoal, generateBoardQuest, npcOffer, onQuestEvent, questStatus, refreshBoard,
  relicBonus, tickBoard, turnIn, validateQuests, BOARD,
} from '../src/core/quests';
import { FISH, REGIONS, inHours } from '../src/core/content';
import { buyEcho } from '../src/core/bell';
import { Rng } from '../src/core/rng';

const places = new Set(REGIONS.flatMap((r) => (r.places ?? []).map((p) => p.id)));
const catchEv = (fishId: string, weight = 1, perfect = false, trait: string | null = null) => ({ type: 'catch' as const, fishId, weight, perfect, trait });

describe('quest content', () => {
  it('is valid and fully reachable', () => {
    expect(validateQuests(places)).toEqual([]);
  });
  it('every story quest has a reminder line for while it is in progress', () => {
    for (const q of QUESTS) expect(q.reminder, q.id).toBeTruthy();
  });
});

describe('story quests', () => {
  it('a new game points the player at Mara', () => {
    const s = newGame(1);
    expect(currentGoal(s)).toMatchObject({ npc: 'mara' });
    expect(npcOffer(s, 'mara')).toMatchObject({ kind: 'offer', quest: { id: 'hb-01-salt' } });
    expect(npcOffer(s, 'pell').kind).toBe('none');
  });

  it('accept → progress → ready → turn in grants rewards once', () => {
    const s = newGame(1);
    expect(accept(s, 'hb-01-salt')).toBe(true);
    expect(accept(s, 'hb-01-salt')).toBe(false);
    expect(currentGoal(s).text).toContain('(0/3)');
    onQuestEvent(s, catchEv('butterperch'));
    onQuestEvent(s, catchEv('pebble-goby'));
    expect(questStatus(s, 'hb-01-salt')).toBe('active');
    const u = onQuestEvent(s, catchEv('butterperch'));
    expect(u.ready).toEqual(['hb-01-salt']);
    expect(questStatus(s, 'hb-01-salt')).toBe('ready');
    expect(currentGoal(s)).toMatchObject({ npc: 'mara' });
    expect(turnIn(s, 'hb-01-salt')).toMatchObject({ coins: 25 });
    expect(s.coins).toBe(25);
    expect(turnIn(s, 'hb-01-salt')).toBeNull();
    expect(s.coins).toBe(25);
    // Unlocks the next quests in the chain.
    expect(questStatus(s, 'hb-02-supper')).toBe('available');
    expect(questStatus(s, 'hb-04-drawing')).toBe('available');
  });

  it('species objectives ignore other fish; extra catches never overflow', () => {
    const s = newGame(1);
    s.quests.done.push('hb-01-salt');
    accept(s, 'hb-04-drawing');
    onQuestEvent(s, catchEv('butterperch'));
    expect(questStatus(s, 'hb-04-drawing')).toBe('active');
    onQuestEvent(s, catchEv('coral-snapper'));
    onQuestEvent(s, catchEv('coral-snapper'));
    expect(s.quests.active['hb-04-drawing'][0]).toBe(1);
    turnIn(s, 'hb-04-drawing');
    expect(s.relics).toContain('wicks-drawing');
    expect(relicBonus(s, 'luck')).toBeCloseTo(0.03);
  });

  it('own objectives read the state live (buying the rod completes it)', () => {
    const s = newGame(1);
    s.quests.done.push('hb-01-salt', 'hb-02-supper');
    accept(s, 'hb-03-proper-rod');
    expect(questStatus(s, 'hb-03-proper-rod')).toBe('active');
    s.gear.rods.push('harbour-rod');
    expect(questStatus(s, 'hb-03-proper-rod')).toBe('ready');
    turnIn(s, 'hb-03-proper-rod');
    expect(s.gear.baits.sandworm).toBe(20);
  });

  it('sell objectives count fish sold, the relight grants the skiff and lights the lamp', () => {
    const s = newGame(1);
    s.quests.done.push('hb-01-salt');
    accept(s, 'hb-02-supper');
    onQuestEvent(s, { type: 'sell', count: 5, coins: 40 });
    onQuestEvent(s, { type: 'sell', count: 5, coins: 40 });
    expect(questStatus(s, 'hb-02-supper')).toBe('ready');
    turnIn(s, 'hb-02-supper');
    expect(s.flags).toEqual(expect.arrayContaining(['shop-open', 'board-open']));
    s.quests.done.push('hb-03-proper-rod', 'hb-05-dark-lamp');
    accept(s, 'hb-06-relight');
    onQuestEvent(s, { type: 'visit', place: 'somewhere-else' });
    expect(questStatus(s, 'hb-06-relight')).toBe('active');
    onQuestEvent(s, { type: 'visit', place: 'lighthouse-lamp' });
    turnIn(s, 'hb-06-relight');
    expect(s.flags).toContain('hb-lighthouse-lit');
    expect(s.boats.owned).toEqual(['skiff']);
    expect(s.boats.current).toBe('skiff');
    expect(s.moonpearls).toBe(1);
  });

  it('the whole story so far can be finished in order: Hearthbay, the lamp, the road and the Fen', () => {
    const s = newGame(7);
    const play: Record<string, () => void> = {
      'hb-01-salt': () => { for (let i = 0; i < 3; i++) onQuestEvent(s, catchEv('butterperch')); },
      'hb-02-supper': () => onQuestEvent(s, { type: 'sell', count: 8, coins: 80 }),
      'hb-03-proper-rod': () => { s.gear.rods.push('harbour-rod'); },
      'hb-04-drawing': () => onQuestEvent(s, catchEv('coral-snapper')),
      'hb-05-dark-lamp': () => onQuestEvent(s, catchEv('lampjaw')),
      'hb-06-relight': () => onQuestEvent(s, { type: 'visit', place: 'lighthouse-lamp' }),
      'hb-07-kettle': () => onQuestEvent(s, { type: 'visit', place: 'keepers-kettle' }),
      'hb-08-teeth': () => onQuestEvent(s, catchEv('twofold-flounder')),
      'hb-08b-stall': () => onQuestEvent(s, { type: 'sell', count: 30, coins: 6000 }),
      'hb-p1-pots': () => { expect(s.pots.owned).toBe(1); onQuestEvent(s, { type: 'haul', count: 3 }); },
      'hb-09-bell': () => onQuestEvent(s, { type: 'visit', place: 'drowned-bell' }),
      'hb-10-turning': () => onQuestEvent(s, { type: 'ring' }),
      'hb-11-lamp': () => { s.echoes = 8; expect(buyEcho(s, 'fog-lamp')).toBe(true); },
      // Sedge Landing goes on the chart as the boat comes out of the fog: that is the visit.
      'hb-12-road': () => { s.flags.push('reached:mossglass-fen'); s.world.charted.push('sedge-landing'); onQuestEvent(s, { type: 'visit', place: 'sedge-landing' }); },
      'fen-01-scale': () => { onQuestEvent(s, catchEv('butterperch')); expect(s.quests.active['fen-01-scale'][0] ?? 0).toBe(0); for (const f of ['reedling', 'mudlark', 'glassfin', 'reedling', 'sedge-pike', 'mudlark']) onQuestEvent(s, catchEv(f)); },
      'fen-02-glass': () => onQuestEvent(s, catchEv('glassfin')),
      'fen-03-tape': () => onQuestEvent(s, { type: 'visit', place: 'survey-stake' }),
      'fen-04-glows': () => onQuestEvent(s, catchEv('glowbelly')),
      'fen-05-sump': () => onQuestEvent(s, catchEv('bottomless-eel')),
      'fen-06-post': () => onQuestEvent(s, { type: 'visit', place: 'ear-trumpet' }),
    };
    for (let guard = 0; guard < 40 && s.quests.done.length < QUESTS.length; guard++) {
      const q = QUESTS.find((x) => questStatus(s, x.id) === 'available');
      if (!q) break;
      accept(s, q.id); play[q.id](); expect(turnIn(s, q.id), q.id).not.toBeNull();
    }
    expect(s.quests.done.length).toBe(QUESTS.length);
    expect(currentGoal(s).text).toMatch(/journal/i);
    expect(s.flags).toEqual(expect.arrayContaining(['pots-open', 'bell-found', 'tide-turned']));
    expect(s.gear.wearables).toEqual(expect.arrayContaining(['keepers-souwester', 'keepers-whistle', 'field-hat']));
    expect(s.relics).toContain('isolde-log-fen');
  });

  it('a job for somebody else is handed in to them: Pell sends the keeper to the doctor', () => {
    const s = newGame(7);
    s.quests.done.push(...QUESTS.filter((q) => q.id.startsWith('hb-') && q.id !== 'hb-12-road').map((q) => q.id));
    expect(npcOffer(s, 'pell')).toMatchObject({ kind: 'offer', quest: { id: 'hb-12-road' } });
    expect(npcOffer(s, 'calloway').kind).toBe('none'); // nobody has been to the Fen yet
    accept(s, 'hb-12-road');
    expect(currentGoal(s)).toMatchObject({ place: 'sedge-landing' });
    onQuestEvent(s, { type: 'visit', place: 'sedge-landing' });
    expect(questStatus(s, 'hb-12-road')).toBe('ready');
    // Pell still talks about it; the doctor is the one to see.
    expect(npcOffer(s, 'pell')).toMatchObject({ kind: 'active', quest: { id: 'hb-12-road' } });
    expect(npcOffer(s, 'calloway')).toMatchObject({ kind: 'turnIn', quest: { id: 'hb-12-road' } });
    expect(currentGoal(s)).toMatchObject({ npc: 'calloway' });
    expect(currentGoal(s).text).toContain('Dr. Ines Calloway');
    expect(turnIn(s, 'hb-12-road')).toMatchObject({ coins: 300 });
    // Her own first job waits on the keeper having reached the Fen.
    expect(npcOffer(s, 'calloway').kind).toBe('none');
    s.flags.push('reached:mossglass-fen');
    expect(npcOffer(s, 'calloway')).toMatchObject({ kind: 'offer', quest: { id: 'fen-01-scale' } });
  });

  it('the Fog Lamp is a thing a job can ask for, and it is bought with Echoes', () => {
    const s = newGame(7);
    s.quests.done.push('hb-10-turning');
    accept(s, 'hb-11-lamp');
    expect(questStatus(s, 'hb-11-lamp')).toBe('active');
    s.echoes = 7; expect(buyEcho(s, 'fog-lamp')).toBe(false);
    s.echoes = 8; expect(buyEcho(s, 'fog-lamp')).toBe(true);
    expect(questStatus(s, 'hb-11-lamp')).toBe('ready');
  });
});

describe('notice board', () => {
  it('stays closed until unlocked, then fills on a play-time timer', () => {
    const s = newGame(3);
    expect(tickBoard(s, 1)).toBe(false);
    s.flags.push('board-open');
    expect(tickBoard(s, 1)).toBe(true);
    expect(s.quests.board.quests.length).toBe(BOARD.slots);
    expect(tickBoard(s, 10)).toBe(false);
    expect(tickBoard(s, BOARD.refreshEvery)).toBe(true);
  });

  it('keeps accepted jobs across a refresh and pays out on completion', () => {
    const s = newGame(3);
    s.flags.push('board-open');
    refreshBoard(s);
    const job = s.quests.board.quests[0];
    job.objective = { type: 'perfect', count: 2, label: 'Land 2 perfect hooks' };
    job.reward = { coins: 50 };
    acceptBoard(s, job.id);
    refreshBoard(s);
    expect(s.quests.board.quests.find((q) => q.id === job.id)).toBeTruthy();
    onQuestEvent(s, catchEv('butterperch', 1, true));
    expect(s.coins).toBe(0);
    const u = onQuestEvent(s, catchEv('butterperch', 1, true));
    expect(u.boardDone.map((b) => b.id)).toEqual([job.id]);
    expect(s.coins).toBe(50);
    onQuestEvent(s, catchEv('butterperch', 1, true));
    expect(s.coins).toBe(50);
  });

  it('generated jobs are deterministic, sane and only ask for catchable fish', () => {
    const s = newGame(9);
    const a = generateBoardQuest(s, new Rng(5), 'x');
    const b = generateBoardQuest(s, new Rng(5), 'x');
    expect(a).toEqual(b);
    for (let i = 0; i < 300; i++) {
      const q = generateBoardQuest(s, new Rng(i), 'q' + i);
      expect(q.reward.coins!).toBeGreaterThanOrEqual(10);
      expect(q.objective.label.length).toBeGreaterThan(4);
      expect(q.objective.fish).not.toBe('manyeye'); // needs the lighthouse lit
      expect(q.objective.fish).not.toBe('hollow-lantern'); // epic: not a board job
    }
    // In the Fen the board asks for Fen fish, and never for the one that waits on the Listening Post.
    s.world.region = 'mossglass-fen';
    let species = 0;
    for (let i = 0; i < 300; i++) {
      const q = generateBoardQuest(s, new Rng(i), 'f' + i);
      if (!q.objective.fish) continue;
      species++;
      expect(FISH.find((f) => f.id === q.objective.fish)!.region).toBe('mossglass-fen');
      expect(q.objective.fish).not.toBe('the-listener');
      expect(q.objective.fish).not.toBe('bottomless-eel');
    }
    expect(species).toBeGreaterThan(50);
  });

  it('has the work of the waters the keeper is in: untaken jobs change on arrival, taken ones are kept', () => {
    const s = newGame(21);
    s.flags.push('board-open');
    refreshBoard(s);
    const fishOf = (region: string) => s.quests.board.quests.filter((q) => q.objective.fish && !q.accepted).every((q) => FISH.find((f) => f.id === q.objective.fish)!.region === region);
    expect(fishOf('hearthbay')).toBe(true);
    const taken = s.quests.board.quests[0];
    acceptBoard(s, taken.id);
    const serial = s.quests.board.serial;
    expect(arriveIn(s, 'mossglass-fen')).toBe(true);
    expect(s.world.region).toBe('mossglass-fen');
    expect(s.world.discovered).toContain('mossglass-fen');
    expect(s.flags).toContain('reached:mossglass-fen');
    expect(s.quests.board.quests.length).toBe(BOARD.slots);
    expect(s.quests.board.quests.find((q) => q.id === taken.id)?.accepted).toBe(true);
    expect(s.quests.board.serial).toBe(serial + BOARD.slots - 1);
    expect(fishOf('mossglass-fen')).toBe(true);
    // Coming again is not a first time, and arriving where she already is changes nothing.
    const before = JSON.stringify(s.quests.board);
    expect(arriveIn(s, 'mossglass-fen')).toBe(false);
    expect(JSON.stringify(s.quests.board)).toBe(before);
    expect(arriveIn(s, 'hearthbay')).toBe(false);
    expect(fishOf('hearthbay')).toBe(true);
    expect(s.flags.filter((f) => f === 'reached:mossglass-fen').length).toBe(1);
    // Before the board is open there is nothing to change.
    const fresh = newGame(22);
    arriveIn(fresh, 'mossglass-fen');
    expect(fresh.quests.board.quests.length).toBe(0);
  });
});

describe('quest fish can be reached', () => {
  const flagsGranted = new Set(QUESTS.flatMap((q) => q.rewards.flags ?? []).concat(REGIONS.flatMap((r) => (r.places ?? []).flatMap((p) => (p.flag ? [p.flag] : [])))));
  it('every gated fish waits on a flag some quest grants or some place sets', () => {
    for (const f of FISH) if (f.requires) expect(flagsGranted.has(f.requires), `${f.id} requires "${f.requires}"`).toBe(true);
  });
  it('every fish a story quest asks for before the skiff bites off the Hearthbay dock', () => {
    // Quests that come after the Relight (which hands over the skiff) may send you out to sea.
    const afterSkiff = (id: string): boolean => id === 'hb-06-relight' || QUESTS.find((x) => x.id === id)!.requires.some(afterSkiff);
    let checked = 0, atSea = 0;
    for (const q of QUESTS) for (const o of q.objectives) {
      if (o.type !== 'catch' || !o.fish) continue;
      const f = FISH.find((x) => x.id === o.fish)!;
      if (q.requires.some(afterSkiff) || f.region !== 'hearthbay') { atSea++; continue; }
      checked++;
      expect(f.zones, `${q.id} wants ${f.id}`).toContain('hb-dock');
    }
    expect(checked).toBeGreaterThan(1);
    expect(atSea).toBeGreaterThan(0);
  });
  it('the relics a quest gives exist and say what they do', () => {
    const s = newGame(2);
    s.relics.push('keepers-kettle');
    expect(relicBonus(s, 'biteSpeed')).toBeCloseTo(0.06);
  });
  it('the Lampjaw is a night fish', () => {
    const f = FISH.find((x) => x.id === 'lampjaw')!;
    expect(inHours(21, f.hours)).toBe(true);
    expect(inHours(12, f.hours)).toBe(false);
  });
});

describe('giving up a board job', () => {
  it('returns it to the board with its progress cleared', () => {
    const s = newGame(3);
    s.flags.push('board-open');
    refreshBoard(s);
    const job = s.quests.board.quests[0];
    expect(abandonBoard(s, job.id)).toBe(false); // not taken yet
    acceptBoard(s, job.id);
    job.progress = 1;
    expect(abandonBoard(s, job.id)).toBe(true);
    expect(job.accepted).toBe(false);
    expect(job.progress).toBe(0);
    // An abandoned job no longer survives a refresh.
    refreshBoard(s);
    expect(s.quests.board.quests.some((q) => q.id === job.id)).toBe(false);
  });
});
