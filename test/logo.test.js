import { buildLogoUrl } from '../src/lib/branding';

describe('Logo URL building', () => {
  test('returns empty string when no logo is set', () => {
    expect(buildLogoUrl('', 'http://x/uploads')).toBe('');
    expect(buildLogoUrl(undefined, 'http://x/uploads')).toBe('');
    expect(buildLogoUrl(null, 'http://x/uploads')).toBe('');
  });

  test('joins the uploads base with the stored filename', () => {
    expect(buildLogoUrl('logo.png', 'http://x/uploads')).toBe('http://x/uploads/logo.png');
  });

  test('tolerates stray slashes on either side', () => {
    expect(buildLogoUrl('/logo.png', 'http://x/uploads/')).toBe('http://x/uploads/logo.png');
  });
});
