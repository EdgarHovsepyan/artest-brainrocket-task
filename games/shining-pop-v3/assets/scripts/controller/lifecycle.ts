import { game } from 'cc';

export interface LifecycleHooks {
  onSuspend(): void;
  onResume(): void;
  onResize(): void;
  onNetwork(online: boolean): void;
}

export interface LifecycleHandle {
  dispose(): void;
}

const RESIZE_DEBOUNCE_MS = 120;

export function installLifecycle(hooks: LifecycleHooks): LifecycleHandle {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { dispose: () => undefined };
  }

  let frozenFps = 0;
  let suspended = false;
  const suspend = (): void => {
    if (suspended) return;
    suspended = true;
    frozenFps = game.frameRate as number;
    game.frameRate = 0;
    hooks.onSuspend();
  };
  const resume = (): void => {
    if (!suspended) return;
    suspended = false;
    game.frameRate = frozenFps || 60;
    hooks.onResume();
  };

  const onVis = (): void => {
    if (document.visibilityState === 'hidden') suspend();
    else resume();
  };
  const onBlur = (): void => suspend();
  const onFocus = (): void => resume();
  const onPageHide = (): void => suspend();
  const onPageShow = (): void => resume();

  let resizeTok = 0;
  const onResize = (): void => {
    const tok = ++resizeTok;
    setTimeout(() => {
      if (tok === resizeTok) hooks.onResize();
    }, RESIZE_DEBOUNCE_MS);
  };

  const onOnline = (): void => hooks.onNetwork(true);
  const onOffline = (): void => hooks.onNetwork(false);

  document.addEventListener('visibilitychange', onVis, true);
  window.addEventListener('blur', onBlur, true);
  window.addEventListener('focus', onFocus, true);
  window.addEventListener('pagehide', onPageHide, true);
  window.addEventListener('pageshow', onPageShow, true);
  window.addEventListener('resize', onResize, { capture: true, passive: true });
  window.addEventListener('orientationchange', onResize, true);
  window.addEventListener('online', onOnline, true);
  window.addEventListener('offline', onOffline, true);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) hooks.onNetwork(false);

  return {
    dispose: () => {
      document.removeEventListener('visibilitychange', onVis, true);
      window.removeEventListener('blur', onBlur, true);
      window.removeEventListener('focus', onFocus, true);
      window.removeEventListener('pagehide', onPageHide, true);
      window.removeEventListener('pageshow', onPageShow, true);
      window.removeEventListener('resize', onResize, true);
      window.removeEventListener('orientationchange', onResize, true);
      window.removeEventListener('online', onOnline, true);
      window.removeEventListener('offline', onOffline, true);
      if (suspended) {
        game.frameRate = frozenFps || 60;
      }
    },
  };
}
