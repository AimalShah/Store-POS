export type ThemeId = 'mono' | 'b3cUgBI8FX';

export const THEME_IDS: ThemeId[] = ['mono', 'b3cUgBI8FX'];

export const THEME_LABELS: Record<ThemeId, string> = {
  mono: 'Black & White',
  'b3cUgBI8FX': 'Green',
};

export const DEFAULT_THEME: ThemeId = 'b3cUgBI8FX';

export function isThemeId(value: string | undefined | null): value is ThemeId {
  return value === 'mono' || value === 'b3cUgBI8FX';
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id);
}
