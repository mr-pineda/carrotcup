import type { Player } from "./types";

const COLORS = ["#f97316", "#eab308", "#8b5cf6", "#3b82f6", "#ec4899", "#10b981", "#ef4444", "#14b8a6"];

/** Foto local del jugador si existe; si no, un avatar SVG con sus iniciales (sin servicios externos). */
export function avatarSrc(player: Player, size: "full" | "thumb") {
  const photo = size === "full" ? player.photo_full_url || player.photo_thumb_url : player.photo_thumb_url;
  if (photo) return photo;

  const initials = player.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  let hash = 0;
  for (const c of player.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const color = COLORS[hash % COLORS.length];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${color}"/>` +
    `<text x="50" y="50" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="700" fill="#fff">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
