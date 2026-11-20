// Live generation with Claude ("Fizzwick the Wizard" to players), straight from the phone using
// the key an invite link stored on it. The SDK is imported lazily so it costs nothing until
// someone actually generates.
import { settings } from './settings.svelte';
import { modelFor } from './wizard';

export class ClaudeError extends Error {}

export function hasKey(): boolean {
  return settings.apiKey.trim().length > 0;
}

async function client() {
  if (!hasKey()) throw new ClaudeError("Fizzwick isn't on this phone yet: open the invite link the host sent you.");
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function friendly(err: unknown): ClaudeError {
  if (err instanceof ClaudeError) return err;
  const status = (err as { status?: number })?.status;
  if (status === 401) return new ClaudeError("Fizzwick's magic stopped working on this phone. Ask the host for a fresh invite link.");
  if (status === 429) return new ClaudeError('Fizzwick is swamped. Give him a moment, then try again.');
  if (status === 529 || (status && status >= 500)) return new ClaudeError("Fizzwick's crystal ball is overloaded. Try again shortly.");
  if (!navigator.onLine) return new ClaudeError('No internet, so no magic. The built-in packs still work offline.');
  const msg = (err as Error)?.message ?? String(err);
  return new ClaudeError('The spell fizzled: ' + (msg.length > 160 ? msg.slice(0, 160) + '…' : msg));
}

export interface StreamOptions {
  system: string;
  prompt: string;
  /** Called once per completed line of output, as it arrives. */
  onLine: (line: string) => void;
  signal?: AbortSignal;
  maxTokens?: number;
}

/**
 * Streams a plain one-item-per-line answer and hands each line over the moment it is
 * complete, so results appear within a second or two instead of after the whole list.
 */
export async function streamLines(opts: StreamOptions): Promise<void> {
  const anthropic = await client();
  let buffer = '';
  const flush = (final: boolean) => {
    const parts = buffer.split('\n');
    buffer = final ? '' : parts.pop() ?? '';
    for (const p of parts) {
      const line = p.trim();
      if (line) opts.onLine(line);
    }
  };
  try {
    const stream = anthropic.beta.messages.stream(
      {
        model: modelFor(settings.model),
        max_tokens: opts.maxTokens ?? 8000,
        // Lists like these need speed more than deep reasoning.
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      },
      { signal: opts.signal },
    );
    stream.on('text', (delta) => {
      buffer += delta;
      if (delta.includes('\n')) flush(false);
    });
    const message = await stream.finalMessage();
    flush(true);
    if (message.stop_reason === 'refusal') throw new ClaudeError('Fizzwick refused that one. Try a different theme.');
  } catch (err) {
    if (opts.signal?.aborted) return;
    throw friendly(err);
  }
}

/** Strips list markers and quotes Claude sometimes adds despite instructions. */
export function cleanItem(line: string): string {
  return line
    .replace(/^\s*(?:[-*•–—]|\d+[.)])\s+/, '')
    .replace(/^["“']|["”']$/g, '')
    .trim();
}
