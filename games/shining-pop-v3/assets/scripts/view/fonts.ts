import { Font, Label, resources } from 'cc';

// Sugar Rush uses three families (theme.ts `THEME.fonts`):
//   body=Fredoka (UI) · display=LuckiestGuy (numbers/headers) · mono=SpaceMono (micro-labels).
// `mono` degrades gracefully: if resources/fonts/SpaceMono is absent the load errors,
// the slot stays null, and applyFont() simply leaves the label on its prior font.
type FontKind = 'body' | 'display' | 'mono';

const fonts: Record<FontKind, Font | null> = { body: null, display: null, mono: null };

export function loadFonts(): Promise<void> {
  const one = (path: string, kind: FontKind) =>
    new Promise<void>((res) =>
      resources.load(path, Font, (err, f) => {
        if (!err && f) fonts[kind] = f;
        res();
      }),
    );
  return Promise.all([
    one('fonts/Fredoka', 'body'),
    one('fonts/LuckiestGuy', 'display'),
    one('fonts/SpaceMono', 'mono'),
  ]).then(() => undefined);
}

export function applyFont(label: Label, kind: FontKind = 'body'): void {
  const f = fonts[kind];
  if (f) {
    label.font = f;
    label.useSystemFont = false;
  }
}
