// Shared font registry — the flagship's typographic voice in Cocos. Fredoka
// (rounded body) and Luckiest Guy (heavy display) are the same families the
// PixiJS game uses; converted woff2 -> TTF offline and loaded once here. Every
// label factory routes through applyFont so the whole game speaks one type voice
// instead of the system font.

import { Font, Label, resources } from 'cc';

type FontKind = 'body' | 'display';

const fonts: Record<FontKind, Font | null> = { body: null, display: null };

export function loadFonts(): Promise<void> {
  const one = (path: string, kind: FontKind) =>
    new Promise<void>((res) =>
      resources.load(path, Font, (err, f) => {
        if (!err && f) fonts[kind] = f;
        res();
      }),
    );
  return Promise.all([one('fonts/Fredoka', 'body'), one('fonts/LuckiestGuy', 'display')]).then(
    () => undefined,
  );
}

/** Dress a label in the brand font. Body = Fredoka (default), display = Luckiest
 *  Guy (logos, money, win amounts). No-ops to the system font until fonts land. */
export function applyFont(label: Label, kind: FontKind = 'body'): void {
  const f = fonts[kind];
  if (f) {
    label.font = f;
    label.useSystemFont = false;
  }
}
