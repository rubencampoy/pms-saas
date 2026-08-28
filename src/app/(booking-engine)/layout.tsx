/**
 * El grupo de rutas ya no pinta cabecera ni pie: eso lo hace `BookingChrome`,
 * más abajo en el árbol, donde ya se sabe de qué propiedad es la página y por
 * tanto qué imagen corporativa aplicar.
 */
export default function BookingEngineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
