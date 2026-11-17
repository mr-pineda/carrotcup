/**
 * Exportación única de los datos del torneo a un JSON estático.
 *
 * Lee el respaldo de Supabase (pg_dump en texto, opcionalmente .gz) y genera
 * src/data/tournament.json con jugadores y mesas.
 *
 * Uso: bun run scripts/export-data.ts "supabase/db-backup/<archivo>.backup.gz"
 *
 * Las fotos vivían en Supabase Storage y no vienen en el respaldo; si existe
 * public/avatars/<playerId>-thumb.webp (o -full.webp) se usa, si no, la vista
 * muestra un avatar con las iniciales.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Uso: bun run scripts/export-data.ts <ruta-al-respaldo>");
  process.exit(1);
}

const raw = await readFile(backupPath);
const sql = (backupPath.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");

/** Extrae las filas de un bloque `COPY schema.table (...) FROM stdin;`. */
function copyRows(table: string): Record<string, string | null>[] {
  const lines = sql.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`COPY ${table} (`));
  if (start === -1) throw new Error(`No se encontró la tabla ${table} en el respaldo`);
  const cols = lines[start]!.match(/\(([^)]*)\)/)![1]!.split(",").map((c) => c.trim());
  const rows: Record<string, string | null>[] = [];
  for (let i = start + 1; lines[i] !== "\\."; i++) {
    const values = lines[i]!.split("\t");
    rows.push(Object.fromEntries(cols.map((c, j) => [c, values[j] === "\\N" ? null : unescape(values[j]!)])));
  }
  return rows;
}

function unescape(v: string) {
  return v.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r", "\\": "\\" })[c as string] ?? c);
}

/**
 * Devuelve la ruta local de la foto. Si aún no está en public/avatars, intenta
 * descargarla desde la URL original de Supabase Storage (si sigue disponible).
 */
async function localAvatar(id: string, kind: "full" | "thumb", remoteUrl: string | null) {
  const file = `avatars/${id}-${kind}.webp`;
  const dest = path.join("public", file);
  if (existsSync(dest)) return file;
  if (!remoteUrl) return undefined;
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, new Uint8Array(await res.arrayBuffer()));
    return file;
  } catch (err) {
    console.warn(`  ! sin foto ${kind} para ${id}: ${(err as Error).message}`);
    return undefined;
  }
}

const players = [];
for (const p of copyRows("public.players")) {
  players.push({
    id: p.id!,
    name: p.name!,
    photo_full_url: await localAvatar(p.id!, "full", p.photo_full_url!),
    photo_thumb_url: await localAvatar(p.id!, "thumb", p.photo_thumb_url!),
  });
}
players.sort((a, b) => a.name.localeCompare(b.name, "es"));

const groupPlayers = copyRows("public.group_players");
const groupRounds = copyRows("public.groups")
  .sort((a, b) => Number(a.round_number) - Number(b.round_number) || a.group_name!.localeCompare(b.group_name!))
  .map((g) => {
    const gp = groupPlayers.filter((x) => x.group_id === g.id);
    const scores: Record<string, number> = {};
    const secondaryScores: Record<string, number> = {};
    for (const x of gp) {
      if (x.score != null) scores[x.player_id!] = Number(x.score);
      if (x.secondary_score != null) secondaryScores[x.player_id!] = Number(x.secondary_score);
    }
    return {
      id: g.id!,
      phase: g.phase!,
      roundNumber: Number(g.round_number),
      groupName: g.group_name!,
      players: gp.map((x) => x.player_id!),
      scores,
      secondaryScores,
      isFinished: g.is_finished === "t",
    };
  });

await mkdir(path.join("src", "data"), { recursive: true });
await writeFile(
  path.join("src", "data", "tournament.json"),
  JSON.stringify({ source: path.basename(backupPath), players, groupRounds }, null, 2) + "\n",
);
console.log(
  `Jugadores: ${players.length}, mesas: ${groupRounds.length}, filas group_players: ${groupPlayers.length}, ` +
    `con foto local: ${players.filter((p) => p.photo_thumb_url).length}`,
);
