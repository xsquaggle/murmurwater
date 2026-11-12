// Writes a representative save of the CURRENT version to tests/fixtures/saves/v<N>.json.
// Run once per SAVE_VERSION bump (before changing the shape) so old saves stay tested forever.
import { writeFileSync } from 'node:fs';
import { newGame, SAVE_VERSION } from '../src/core/state';
import { serialize } from '../src/core/save';
const s = newGame(2026);
s.coins = 1530; s.playTime = 3600; s.hold.push({ uid: 1, fishId: 'kettle-carp', weight: 2.1, trait: 'glimmering', value: 40, perfect: true });
s.journal['kettle-carp'] = { caught: 3, bestWeight: 2.1, traits: ['glimmering'], firstAt: 120 };
s.flags.push('hb-intro-done');
writeFileSync(`tests/fixtures/saves/v${SAVE_VERSION}.json`, serialize(s, new Date('2026-11-12T00:00:00Z')));
console.log('wrote fixture v' + SAVE_VERSION);
