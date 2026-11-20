// This phone's tilt calibration: the thresholds learned from the last player's practice tilts
// (see src/lib/calibration.ts), or none, in which case the defaults apply.
import { load, save, remove } from '../../lib/storage';
import { DEFAULT_TILT, type TiltThresholds } from '../../lib/tilt';

const KEY = 'forehead:calibration';

export const calibration = $state<{ th: TiltThresholds | null }>({ th: load<TiltThresholds | null>(KEY, null) });

export function saveCalibration(th: TiltThresholds): void {
  calibration.th = th;
  save(KEY, th);
}

export function clearCalibration(): void {
  calibration.th = null;
  remove(KEY);
}

export function tiltThresholds(): TiltThresholds {
  return calibration.th ?? DEFAULT_TILT;
}
