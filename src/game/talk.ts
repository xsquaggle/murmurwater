/**
 * Conversations: what an NPC says and offers right now, built from the quest state.
 * Pure (no DOM, no three.js) so tests and the voice-line manifest share it with the game.
 */
import { NPCS, QUESTS, handsInTo, npc, npcOffer, questStatus, type QuestDef } from '../core/quests';
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
  /** The speaker used their line about nearly remembering the keeper (said once each tide). */
  deja?: boolean;
}

const q = (id: string) => QUESTS.find((x) => x.id === id)!;
export const introLines = (quest: QuestDef): Line[] => quest.intro.map((text, i) => ({ npc: quest.giver, text, voice: `${quest.giver}/${quest.id}.intro.${i}` }));
/** The outro is spoken by whoever the job is handed in to. */
export const outroLines = (quest: QuestDef): Line[] => quest.outro.map((text, i) => ({ npc: handsInTo(quest), text, voice: `${handsInTo(quest)}/${quest.id}.outro.${i}` }));
export const reminderLine = (quest: QuestDef): Line => ({ npc: quest.giver, text: quest.reminder ?? quest.summary, voice: `${quest.giver}/${quest.id}.reminder` });
export const barkLine = (npcId: string, i: number): Line => {
  const barks = npc(npcId).barks;
  const k = ((i % barks.length) + barks.length) % barks.length;
  return { npc: npcId, text: barks[k], voice: `${npcId}/bark.${k}` };
};

/** What somebody says the first time they meet the keeper after the Bell has turned the tide. */
export const turnedLine = (npcId: string, i: number): Line | null => {
  const lines = npc(npcId).turned ?? [];
  if (!lines.length) return null;
  const k = ((i % lines.length) + lines.length) % lines.length;
  return { npc: npcId, text: lines[k], voice: `${npcId}/turned.${k}` };
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
  for (const n of NPCS) {
    if (n.thing) continue; // a box has no voice
    n.barks.forEach((_, i) => out.push(barkLine(n.id, i)));
    (n.turned ?? []).forEach((_, i) => out.push(turnedLine(n.id, i)!));
  }
  return out.map((l) => ({ ...l, speaker: npc(l.npc).name, voiceStyle: npc(l.npc).voice }));
}

/** Which island the ferry is at, given the player's island. */
export const FERRY_ROUTE: Record<string, { to: string; label: string }> = {
  hearthbay: { to: 'gull-point', label: 'Row me out to Gull Point.' },
  'gull-point': { to: 'hearthbay', label: 'Take me back to Hearthbay.' },
};

function hub(s: GameState, npcId: string, island: string): Choice[] {
  const c: Choice[] = [];
  // Mara buys at her stall, and through the boxes she keeps on other landings: the same prices, the same shelf.
  if (npcId === 'mara' || npcId === 'packet-box') {
    const n = s.hold.length + s.pots.hold.length;
    if (n) c.push({ label: `Sell my catch (${n} fish)`, action: { type: 'sell' } });
    if (s.flags.includes('shop-open')) c.push({ label: npcId === 'mara' ? 'Show me the good shelf.' : 'Look through the shelf in the lid.', action: { type: 'shop' } });
  }
  if (npcId === 'pell') {
    // Pell rows the player about only until they have a boat of their own.
    const relight = questStatus(s, 'hb-06-relight');
    if (!s.boats.owned.length && (relight === 'active' || relight === 'ready' || relight === 'done' || island === 'gull-point')) {
      const r = FERRY_ROUTE[island];
      if (r) c.push({ label: r.label, action: { type: 'ferry', to: r.to } });
    }
  }
  c.push({ label: npc(npcId).thing ? 'Shut the lid.' : 'Bye for now.', action: { type: 'bye' } });
  return c;
}

/**
 * The conversation an NPC starts when the player talks to them. `seq` picks a bark so they don't repeat.
 * `deja`: how many times the Bell has been rung, if this is the first chat with them since: they open with
 * a line about it instead of a bark (story lines come first; the caller marks it said when `deja` comes back set).
 * `met`: the keeper has been here before (a thing's one line is not read twice).
 */
export function converse(s: GameState, npcId: string, island: string, seq = 0, deja = 0, met = false): Conversation {
  // A thing is read once; after that it is only what it does.
  if (npc(npcId).thing) return { npc: npcId, lines: met ? [] : [barkLine(npcId, 0)], choices: hub(s, npcId, island) };
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
    default: {
      const turned = deja > 0 ? turnedLine(npcId, deja - 1) : null;
      return { npc: npcId, lines: [turned ?? barkLine(npcId, seq)], choices: hub(s, npcId, island), deja: !!turned };
    }
  }
}

/** After a hand-in: the same NPC's next quest straight away if there is one, else their hub. */
export function afterTurnIn(s: GameState, npcId: string, island: string): Conversation {
  const offer = npcOffer(s, npcId);
  if (offer.kind === 'offer' || offer.kind === 'turnIn') return converse(s, npcId, island);
  return { npc: npcId, lines: [], choices: hub(s, npcId, island) };
}

/** After a sale: a quest the sale finished if they are the one to hear of it, else whatever else they do. */
export function afterSale(s: GameState, npcId: string, island: string): Conversation {
  if (npcOffer(s, npcId).kind === 'turnIn') return converse(s, npcId, island);
  return { npc: npcId, lines: [], choices: hub(s, npcId, island) };
}

/**
 * After "Not just now": whatever else this person does. Mara still buys fish and keeps her shelf, Pell still
 * rows. Null if that is nothing, and the conversation just ends.
 */
export function afterDecline(s: GameState, npcId: string, island: string): Conversation | null {
  const choices = hub(s, npcId, island);
  return choices.length > 1 ? { npc: npcId, lines: [], choices } : null;
}

export { q as questById };
