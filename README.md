# Chamelio PMS

SaaS PMS (Property Management System) multi-tenant para gestión hotelera.

- **Producción:** https://pms.chamelioguest.com
- **Motor de reservas (guest-facing):** https://book.chamelioguest.com
- **CDN de widgets:** https://cdn.chamelioguest.com *(pendiente: no hay `widget.js` publicado todavía)*

### Dominios

El backoffice y el motor de reservas son la **misma app**. El motor vive bajo
`/book/{orgSlug}/{propertyCode}`, y `src/middleware.ts` reescribe las peticiones
cuyo `Host` coincide con `NEXT_PUBLIC_BOOKING_HOST`:

```
book.chamelioguest.com/koala-hostel/KHE  →  /book/koala-hostel/KHE
```

En ese host el backoffice no se expone (`/login` y demás devuelven 404). Para
usarlo en local, `book.localhost:3000` funciona sin tocar `/etc/hosts`.

Al añadir el subdominio en Vercel hay que apuntarlo al mismo proyecto y definir
`NEXT_PUBLIC_BOOKING_HOST` / `NEXT_PUBLIC_BOOKING_URL` en sus variables de
entorno (son `NEXT_PUBLIC_*`: se inyectan en build, así que hay que redeployar
tras cambiarlas).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 + Shadcn/UI · Drizzle ORM + PostgreSQL · Auth.js v5 · next-intl (ES/EN).

## Puesta en marcha

```bash
cp .env.local.example .env.local   # y rellena los valores
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

La app queda en http://localhost:3000.

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run db:generate` | Genera migración de Drizzle |
| `npm run db:migrate` | Aplica migraciones |
| `npm run db:seed` | Carga datos de demo |
| `npm run db:studio` | Abre Drizzle Studio |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript strict |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |

## Documentación

Las reglas del proyecto viven en `docs/constitution/`: `STACK.md`, `FUNCTIONAL.md`, `GUIDELINES.md` y `DESIGN_GUIDE.md`. Léelas antes de escribir código.
