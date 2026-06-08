import { Game } from './game';

const g = globalThis as unknown as { __err?: string; __booted?: boolean };
window.addEventListener('error', (e) => (g.__err = String(e.error?.stack ?? e.message)));
window.addEventListener(
  'unhandledrejection',
  (e) => (g.__err = String(e.reason?.stack ?? e.reason)),
);

const mount = document.getElementById('app');
if (mount) {
  new Game()
    .boot(mount)
    .then(() => (g.__booted = true))
    .catch((e) => (g.__err = String(e?.stack ?? e)));
}
