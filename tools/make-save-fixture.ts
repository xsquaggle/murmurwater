// Writes a representative save of the CURRENT version to tests/fixtures/saves/v<N>.json.
// Run once per SAVE_VERSION bump (before changing the shape) so old saves stay tested forever.
import { writeFileSync } from 'node:fs';
import { newGame, SAVE_VERSION } from '../src/core/state';
import { serialize } from '../src/core/save';
const s = newGame(2026);
s.coins = 1530; s.playTime = 3600; s.hold.push({ uid: 1, fishId: 'kettle-carp', weight: 2.1, trait: 'glimmering', value: 40, perfect: true });
s.journal['kettle-carp'] = { caught: 3, bestWeight: 2.1, traits: ['glimmering'], firstAt: 120 };
s.flags.push('board-open');
// v2: story quest progress and generated board jobs.
s.quests.done.push('hb-01-salt');
s.quests.active['hb-02-supper'] = { 0: 3 };
s.quests.board = { quests: [{ id: 'board-1', title: 'Wanted: Butterperch', objective: { type: 'catch', fish: 'butterperch', count: 3, label: 'Catch 3 Butterperch' }, reward: { coins: 40 }, accepted: true, progress: 1, done: false }], timer: 120, serial: 1 };
// v3: an owned boat left at a mooring, places on the chart, the player aboard.
s.quests.done.push('hb-02-supper', 'hb-03-proper-rod', 'hb-05-dark-lamp', 'hb-06-relight');
delete s.quests.active['hb-02-supper'];
s.flags.push('lamp-lit', 'hb-lighthouse-lit');
s.boats = { owned: ['skiff'], current: 'skiff', upgrades: {}, at: { x: -319, z: 28, heading: -1.5708 } };
s.world.charted = ['hearthbay', 'gull-point', 'kettle-isle'];
s.world.onBoat = true; s.world.pos = [-319, 0.2, 28];
writeFileSync(`tests/fixtures/saves/v${SAVE_VERSION}.json`, serialize(s, new Date('2026-11-12T00:00:00Z')));
console.log('wrote fixture v' + SAVE_VERSION);
