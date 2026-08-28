import { describe, it, expect } from 'vitest';
import { DARK_HEADER_BACKGROUND, headerLogoUrl, headerPalette } from './booking-header';

describe('headerPalette', () => {
  it('deja la cabecera clara sin paleta: se queda con las clases de Tailwind', () => {
    expect(headerPalette({ headerStyle: 'light', primaryColor: '#137fec' })).toBeNull();
  });

  it('pinta con el color de marca y texto blanco cuando el color es oscuro', () => {
    expect(headerPalette({ headerStyle: 'brand', primaryColor: '#091e93' })).toEqual({
      background: '#091e93',
      foreground: '#ffffff',
      isLightText: true,
    });
  });

  it('usa texto oscuro sobre un color de marca claro', () => {
    const palette = headerPalette({ headerStyle: 'brand', primaryColor: '#facc15' });
    expect(palette?.foreground).toBe('#0f172a');
    expect(palette?.isLightText).toBe(false);
  });

  it('ignora el color de marca en el estilo oscuro', () => {
    expect(headerPalette({ headerStyle: 'dark', primaryColor: '#facc15' })).toEqual({
      background: DARK_HEADER_BACKGROUND,
      foreground: '#ffffff',
      isLightText: true,
    });
  });
});

describe('headerLogoUrl', () => {
  const branding = { logoUrl: '/logo.png', logoInverseUrl: '/logo-blanco.png' };

  it('usa el logo normal en la cabecera clara', () => {
    expect(headerLogoUrl(branding, false)).toBe('/logo.png');
  });

  it('usa la variante inversa en la cabecera pintada', () => {
    expect(headerLogoUrl(branding, true)).toBe('/logo-blanco.png');
  });

  it('cae en el logo normal si no se ha subido variante inversa', () => {
    expect(headerLogoUrl({ logoUrl: '/logo.png', logoInverseUrl: '' }, true)).toBe('/logo.png');
  });
});
