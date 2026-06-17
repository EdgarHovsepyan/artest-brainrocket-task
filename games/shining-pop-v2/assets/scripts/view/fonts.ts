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

export function applyFont(label: Label, kind: FontKind = 'body'): void {
  const f = fonts[kind];
  if (f) {
    label.font = f;
    label.useSystemFont = false;
  }
}
