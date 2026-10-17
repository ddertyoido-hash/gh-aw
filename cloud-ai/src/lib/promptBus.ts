/**
 * Tiny hand-off used when one screen sends the user to another with a
 * pre-filled prompt (quick actions, action cards, agents, image studio).
 */

export interface PendingPrompt {
  text: string
  mode?: 'chat' | 'summarize' | 'research' | 'create'
  agentId?: string | null
  /** Set when the target screen should act immediately (for example images). */
  action?: 'compose' | 'generate'
}

let pending: PendingPrompt | null = null

export function setPendingPrompt(prompt: PendingPrompt): void {
  pending = prompt
}

/** Reads and clears the pending prompt (single consumer by design). */
export function consumePendingPrompt(): PendingPrompt | null {
  const current = pending
  pending = null
  return current
}
