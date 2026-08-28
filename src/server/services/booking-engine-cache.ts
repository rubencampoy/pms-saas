import { cache } from 'react';
import { bookingEngineService } from './booking-engine.service';

/**
 * Versiones deduplicadas por request de las consultas que el motor de reservas
 * repite en cada página: el layout, `generateMetadata` y la propia página
 * resuelven todas la misma propiedad. Sin esto serían tres viajes a la BD para
 * exactamente el mismo dato.
 *
 * `resolveProperty` no usa `this`, así que se puede desligar del objeto servicio.
 */
export const resolvePropertyCached = cache(bookingEngineService.resolveProperty);

export const getBrandingCached = cache(bookingEngineService.getBranding);
