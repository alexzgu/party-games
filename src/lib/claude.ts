// Live generation with Claude ("Fizzwick the Wizard" to players), straight from the phone. Two
// ways in: the key an invite link stored on the phone (called directly), or the session token
// the magic words earned, sent to the wizard server (wizardServer.ts), which holds its own key.
// The SDK is imported lazily so it costs nothing until someone actually generates.
import { settings, saveSettings } from './settings.svelte';
import { canFallBack, modelFor, SERVER_MAX_TOKENS, WIZARD_BETAS } from './wizard';
import { WIZARD_SERVER } from './wizardServer';

export class ClaudeError extends Error {}

/** True when the wizard goes through the server: no key of its own, but the magic words were said. */
function viaPass(): boolean {
  return !settings.apiKey.trim() && !!WIZARD_SERVER && settings.wizardPass.trim().length > 0;
}

export function hasKey(): boolean {
  return settings.apiKey.trim().length > 0 || viaPass();
}

/** What a make page says when the wizard is not on this phone. */
export const NOT_HERE = WIZARD_SERVER
  ? "Fizzwick isn't on this phone yet: say the magic words in Settings."
  : "Fizzwick isn't on this phone yet. Ask the host.";

/** `pass` is the magic-words pass to send to the wizard server, or '' for the phone's own key. */
async function client(pass: string) {
  if (!hasKey()) throw new ClaudeError(NOT_HERE);
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (!pass) return new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
  return new Anthropic({ apiKey: pass, baseURL: WIZARD_SERVER, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

/**
 * The wizard's words for an API status, or null to fall through to the general cases. `reason`
 * is the wizard server's `x-wizard-reason` header (401: expired, revoked, invalid; 429: phone, party).
 */
export function statusMessage(status: number | undefined, pass: boolean, reason: string | null = null): string | null {
  if (pass && status === 401 && reason === 'expired') return "Fizzwick's pass expired. Say the magic words again.";
  if (pass && status === 401) return 'The magic words have changed. Ask the host for the new ones.';
  if (pass && status === 429 && reason === 'phone') return 'Fizzwick needs a nap: this phone has had its share of magic today. Try again tomorrow.';
  if (pass && status === 429) return "Fizzwick needs a nap: the party's wizard allowance is used up for now. Try again later.";
  if (status === 401) return "Fizzwick's magic stopped working on this phone. In Settings, send him away, then say the magic words again.";
  if (status === 429) return 'Fizzwick is swamped. Give him a moment, then try again.';
  if (status === 529 || (status && status >= 500)) return "Fizzwick's crystal ball is overloaded. Try again shortly.";
  return null;
}

/** `pass` is the pass the failed request used ('' for the phone's own key). */
function friendly(err: unknown, pass: string): ClaudeError {
  if (err instanceof ClaudeError) return err;
  const status = (err as { status?: number })?.status;
  const reason = (err as { headers?: Headers })?.headers?.get?.('x-wizard-reason') ?? null;
  // The server no longer takes this pass (words changed or removed, or it expired). A newer pass,
  // saved while this request was out, stays.
  if (pass && status === 401 && settings.wizardPass.trim() === pass) {
    settings.wizardPass = '';
    saveSettings();
  }
  const known = statusMessage(status, !!pass, reason);
  if (known) return new ClaudeError(known);
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
  const pass = viaPass() ? settings.wizardPass.trim() : '';
  const anthropic = await client(pass);
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
    const model = modelFor(settings.model);
    const stream = anthropic.beta.messages.stream(
      {
        model,
        // The wizard server takes at most SERVER_MAX_TOKENS; a phone's own key is not capped.
        max_tokens: pass ? Math.min(opts.maxTokens ?? 8000, SERVER_MAX_TOKENS) : opts.maxTokens ?? 8000,
        // Lists like these need speed more than deep reasoning.
        output_config: { effort: 'low' },
        // A phone's own key may fall back to another model; the wizard server allows no
        // fallback, so each request it pays for is one model run.
        // Haiku has no server-side fallback, so it never asks for one.
        ...(pass || !canFallBack(model) ? {} : { betas: [...WIZARD_BETAS], fallbacks: 'default' as const }),
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
    throw friendly(err, pass);
  }
}

/** Strips list markers and quotes Claude sometimes adds despite instructions. */
export function cleanItem(line: string): string {
  return line
    .replace(/^\s*(?:[-*•–—]|\d+[.)])\s+/, '')
    .replace(/^["“']|["”']$/g, '')
    .trim();
}
