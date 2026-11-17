import { serve } from "bun";
import index from "./index.html";

// Servidor solo para desarrollo local; en producción el sitio es estático (GitHub Pages).
const server = serve({
  routes: {
    // Fotos de jugadores (public/avatars) en desarrollo
    "/avatars/*": async req => {
      const name = new URL(req.url).pathname.split("/").pop()!;
      const file = Bun.file(new URL(`../public/avatars/${name}`, import.meta.url));
      return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
    },
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
