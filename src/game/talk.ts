/**
 * Conversations: what an NPC says and offers right now, built from the quest state.
 * Pure (no DOM, no three.js) so tests and the voice-line manifest share it with the game.
 */
import { QUESTS, npc, npcOffer, questStatus, type QuestDef } from '../core/quests';
import type { GameState } from '../core/state';
import { hashString } from '../core/rng';

export interface Line { npc: string; text: string; /** voice file key: audio/voice/<key>.mp3 */ voice: string }
export type TalkAction =
  | { type: 'accept'; quest: string }
  | { type: 'decline' }
  | { type: 'sell' }
  | { type: 'shop' }
  | { type: 'ferry'; to: string }
  | { type: 'bye' };
export interface Choice { label: string; action: TalkAction }
export interface Conversation {
  npc: string;
  lines: Line[];
  choices: Choice[];
  /** A quest handed in when the lines finish (rewards are granted then). */
  turnIn?: string;
}

const q = (id: string) => QUESTS.find((x) => x.id === id)!;
export const introLines = (quest: QuestDef): Line[] => quest.intro.map((text, i) => ({ npc: quest.giver, text, voice: `${quest.giver}/${quest.id}.intro.${i}` }));
export const outroLines = (quest: QuestDef): Line[] => quest.outro.map((text, i) => ({ npc: quest.giver, text, voice: `${quest.giver}/${quest.id}.outro.${i}` }));
export const reminderLine = (quest: QuestDef): Line => ({ npc: quest.giver, text: quest.reminder ?? quest.summary, voice: `${quest.giver}/${quest.id}.reminder` });
export const barkLine = (npcId: string, i: number): Line => {
  const barks = npc(npcId).barks;
  const k = ((i % barks.length) + barks.length) % barks.length;
  return { npc: npcId, text: barks[k], voice: `${npcId}/bark.${k}` };
};

/**
 * FNV-1a hash of a line's text. The voice index (audio/voice/voiced.json) records the hash each file was
 * recorded from, so a line whose text changes later goes quiet instead of playing the old recording.
 */
export const textHash = (text: string): string => hashString(text).toString(16).padStart(8, '0');

/** Every voiced line in the game, for the voice-generation manifest. */
export function allVoiceLines(): (Line & { speaker: string; voiceStyle: string })[] {
  const out: Line[] = [];
  for (const quest of QUESTS) out.push(...introLines(quest), ...(quest.reminder ? [reminderLine(quest)] : []), ...outroLines(quest));
  for (const id of new Set(QUESTS.map((x) => x.giver).concat(['mara', 'pell', 'wick']))) npc(id).barks.forEach((_, i) => out.push(barkLine(id, i)));
  return out.map((l) => ({ ...l, speaker: npc(l.npc).name, voiceStyle: npc(l.npc).voice }));
}

/** Which island the ferry is at, given the player's island. */
export const FERRY_ROUTE: Record<string, { to: string; label: string }> = {
  hearthbay: { to: 'gull-point', label: 'Row me out to Gull Point.' },
  'gull-point': { to: 'hearthbay', label: 'Take me back to Hearthbay.' },
};

function hub(s: GameState, npcId: string, island: string): Choice[] {
  const c: Choice[] = [];
  if (npcId === 'mara') {
    if (s.hold.length) c.push({ label: `Sell my catch (${s.hold.length} fish)`, action: { type: 'sell' } });
    if (s.flags.includes('shop-open')) c.push({ label: 'Show me the good shelf.', action: { type: 'shop' } });
  }
  if (npcId === 'pell') {
    // Pell rows the player about only until they have a boat of their own.
    const relight = questStatus(s, 'hb-06-relight');
    if (!s.boats.owned.length && (relight === 'active' || relight === 'ready' || relight === 'done' || island === 'gull-point')) {
      const r = FERRY_ROUTE[island];
      if (r) c.push({ label: r.label, action: { type: 'ferry', to: r.to } });
    }
  }
  c.push({ label: 'Bye for now.', action: { type: 'bye' } });
  return c;
}

/** The conversation an NPC starts when the player talks to them. `seq` picks a bark so they don't repeat. */
export function converse(s: GameState, npcId: string, island: string, seq = 0): Conversation {
  const offer = npcOffer(s, npcId);
  switch (offer.kind) {
    case 'turnIn':
      return { npc: npcId, lines: outroLines(offer.quest), choices: [], turnIn: offer.quest.id };
    case 'offer':
      return {
        npc: npcId, lines: introLines(offer.quest),
        choices: [{ label: 'I’ll do it.', action: { type: 'accept', quest: offer.quest.id } }, { label: 'Not just now.', action: { type: 'decline' } }],
      };
    case 'active':
      return { npc: npcId, lines: [reminderLine(offer.quest)], choices: hub(s, npcId, island) };
    default:
      return { npc: npcId, lines: [barkLine(npcId, seq)], choices: hub(s, npcId, island) };
  }
}

/** After a hand-in: the same NPC's next quest straight away if there is one, else their hub. */
export function afterTurnIn(s: GameState, npcId: string, island: string): Conversation {
  const offer = npcOffer(s, npcId);
  if (offer.kind === 'offer' || offer.kind === 'turnIn') return converse(s, npcId, island);
  return { npc: npcId, lines: [], choices: hub(s, npcId, island) };
}

export { q as questById };
