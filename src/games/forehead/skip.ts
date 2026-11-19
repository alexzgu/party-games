// Tap to skip: a tap anywhere finishes the entrance animations still playing below `root`
// (deck tiles popping in, the results list). A tap on something that has not half appeared
// yet only skips; it does not also press that thing.

const finite = (a: Animation) => 'animationName' in a && a.effect?.getComputedTiming().endTime !== Infinity;

export function tapToSkip() {
  let swallow = false;
  return {
    onpointerdowncapture(e: PointerEvent) {
      const root = e.currentTarget as HTMLElement;
      const target = e.target as Node;
      const running = root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && finite(a));
      swallow = running.some((a) => {
        const el = (a.effect as KeyframeEffect | null)?.target;
        return !!el && el !== root && el.contains(target) && (a.effect?.getComputedTiming().progress ?? 0) < 0.5;
      });
      running.forEach((a) => a.finish());
    },
    onclickcapture(e: MouseEvent) {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
