export function buildLogoUrl(
  img: string | undefined | null,
  uploadsBase: string
): string {
  if (!img) return '';
  const base = uploadsBase.replace(/\/+$/, '');
  const file = img.replace(/^\/+/, '');
  return `${base}/${file}`;
}
