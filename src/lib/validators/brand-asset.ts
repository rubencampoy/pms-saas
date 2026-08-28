import { z } from 'zod';

/**
 * Assets de imagen corporativa que el cliente puede subir para su motor de
 * reservas. Cada tipo tiene su propio límite: un favicon no debería pesar lo
 * mismo que una foto de portada.
 */
export const BRAND_ASSET_KINDS = ['logo', 'logoInverse', 'favicon', 'cover'] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];

interface BrandAssetRule {
  /** Tamaño máximo en bytes */
  maxSize: number;
  /** MIME types aceptados */
  types: readonly string[];
}

export const BRAND_ASSET_RULES: Record<BrandAssetKind, BrandAssetRule> = {
  logo: {
    maxSize: 500 * 1024,
    types: ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'],
  },
  logoInverse: {
    // Va sobre la cabecera pintada, así que tiene que poder ser transparente:
    // fuera JPG, que siempre trae un fondo opaco pegado.
    maxSize: 500 * 1024,
    types: ['image/png', 'image/svg+xml', 'image/webp'],
  },
  favicon: {
    // Se sirve tal cual como <link rel="icon">, así que conviene que sea diminuto.
    maxSize: 100 * 1024,
    types: ['image/png', 'image/x-icon', 'image/svg+xml'],
  },
  cover: {
    maxSize: 3 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

export const uploadBrandAssetSchema = z.object({
  propertyId: z.string().uuid('ID de propiedad inválido'),
  kind: z.enum(BRAND_ASSET_KINDS),
});

export type UploadBrandAssetInput = z.infer<typeof uploadBrandAssetSchema>;
