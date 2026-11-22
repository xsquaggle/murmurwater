/**
 * The game's clock. Play time comes only from frames the open game draws: a frame is worth the time it took and
 * never more than MAX_FRAME, however long the window was away (asleep, minimised, held at a breakpoint). That,
 * and that nothing reads the hour a save was made, is why nothing can be earned while the game is closed.
 */
export const MAX_FRAME = 0.1;
/** Seconds of play for a frame that took `realSeconds`. */
export function frameTime(realSeconds: number): number { return Math.min(MAX_FRAME, Math.max(0, realSeconds)); }
