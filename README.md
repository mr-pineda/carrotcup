# Copa Zanahoria 2026

Página del torneo de cartas familiar. El torneo ya terminó, así que el sitio es **estático y de solo lectura**:
los resultados están congelados en `src/data/tournament.json` y no se consulta ninguna base de datos.

## Desarrollo

```bash
bun install
bun dev          # servidor local con hot reload
bun run build    # genera el sitio estático en dist/
```

Se publica en GitHub Pages (rama `gh-pages`) con el contenido de `dist/`:

```bash
bunx gh-pages -d dist
```

## Datos

`src/data/tournament.json` se generó una sola vez desde el respaldo de Supabase:

```bash
bun run scripts/export-data.ts "supabase/db-backup/<archivo>.backup.gz"
```

El respaldo (`supabase/db-backup/`) **no se sube al repo** porque incluye usuarios de Supabase Auth.
Las fotos de los jugadores se descargaron desde Supabase Storage a `public/avatars/`
(`<playerId>-full.webp` 400×400 y `<playerId>-thumb.webp` 100×100) y se copian a `dist/` al compilar.
Si falta alguna, la página muestra un avatar con las iniciales.

El esquema original de la base de datos queda como referencia en `supabase/migrations/`.
El panel de administración (Supabase Auth + edición) sigue disponible en la rama `main`.
