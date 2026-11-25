# Load timeouts: report

Start commit: 3b30bbaa6929f6e6c6adc978cff7fdd9b56d4786
Machine: nproc=4, node v22.23.5 (cloud container)

## Counts
- Baseline `npx vitest run --maxWorkers=2`, twice: 135 files / 1024 tests passed both times, 17 s and 15 s.
- Loaded (8 `yes` processes on 4 cores), 15 runs per file, before the fix:
  - src/lib/room/seats.test.ts: 2 of 15 failed (runs 2 and 14), same assertion each time
    (seats.test.ts:829, expected [null,'joining'], got [null,'stopped']). 192 s for all 30 runs.
  - worker/src/index.test.ts: 0 of 15 failed. (b) did NOT reproduce, so nothing was changed for it.
- Targeted run with temporary tracing (-t that test only, loaded): failed on run 4 of 4.
- After the fix, seats.test.ts loaded 15 runs: 0 failed. Full suite: 135/1024 pass; npm run check 0 errors; npm run build ok.

## Cause of (a): the test, not the product
The test stops its clock at exactly the instant a redial fires.
- far.send/close are made dead, so the phone hears nothing after `heard` (fake time T).
- PhoneLink's watchdog is a 2 s setInterval (phone-link.svelte.ts:154); check() (:286-287) drops the link once
  Date.now() - heard > LINK_TIMEOUT (9000, net.ts:10), so at T+10000. lose() (:262) clears sign; later() (:272) schedules
  the redial after backoff(0)=1000 ms (net.ts:30), so connect() runs at T+11000.
- The test advances LINK_TIMEOUT + 2000 = 11000 (seats.test.ts:828), ending on that very tick.
- Trace of a failing run: link lost at fake +10000 (no conn); at fake +11000 the redial had already completed its
  handshake (about 14 ms real) and the host had answered with a refusal ("This phone can't take that seat by itself...",
  link 'stopped'). Whether the host's reply (async, real-time work the fake timers do not control, and
  advanceTimersByTimeAsync yields real macrotasks between timers) lands before the advance returns depends on CPU load.
  Idle: the redial is still in flight, so 'joining'. Loaded: the answer arrives first, so 'stopped'.
- The product behaves correctly in both orders (a redialled phone is told what the host says). The assertion was
  sampling a race. The unverified part: I did not trace why the host refuses that redial (not needed for the cause).

## Change
src/lib/room/seats.test.ts: advance LINK_TIMEOUT + 1000 instead of + 2000, with a comment. The clock now stops
after the link has gone (sign null, link 'joining') and before the redial is due. The assertion itself is unchanged,
no timeout raised, no retry added. The test still proves the sign is cleared when the link goes silent.

## Not proven
- (b): 0 of 15 loaded failures; the 5050 ms timeout was not reproduced and no cause is claimed. Would need a heavier load
  or the original laptop.
- Only 15 loaded runs after the fix (0 failures); with a 2/15 base rate that is suggestive, but the argument above is the proof.

## Wall time (steps)
npm ci 7 s; baseline 2 runs 32 s; loaded 30 runs 192 s; instrumented repro ~60 s; after-fix 15 loaded runs ~100 s;
full suite 16 s, check 15 s, build 5 s. Total about 7 min.
