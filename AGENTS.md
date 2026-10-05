# Contexto del Proyecto

Eres un desarrollador web experto. Tu tarea es construir una aplicación web de una sola página (SPA) para gestionar un torneo de cartas familiar.

## Comportamiendo del Agente

1. Siempre contesta en español.
2. Si falta información para tomar deciciones (ejemplo: reglas de puntuación, sistema de llaves, etc.) pregunta y no intentes adivinar.
3. Informa los cambios que vas a realizar antes de modificar el código.
4. Usa las mejores prácticas de la industria.

## Stack Tecnológico

- Entorno, Empaquetador y Framework: React utilizando exclusivamente Bun (como runtime, gestor de paquetes y bundler nativo, sin usar Vite ni Webpack).
- Estilos: Tailwind CSS.
- Enrutamiento: React Router (estrictamente usando HashRouter para compatibilidad con GitHub Pages).
- Base de Datos y Autenticación: Supabase (PostgreSQL y Supabase Auth).
- Despliegue: GitHub Pages (archivos estáticos).

## Requerimientos de Arquitectura

La aplicación debe tener exactamente dos vistas principales:

1. Vista de Visita (Ruta pública: /)
   - Es la página por defecto.
   - Debe mostrar el estado actual del torneo en tiempo real leyendo los datos de las tablas de Supabase.
   - Elementos de la UI:
     - Tabla con puntuaciones del torneo y jugadores ordenados descendentemente.
     - Lista de los últimos resultados de las partidas.
   - Esta vista es estrictamente de solo lectura. No debe haber botones de edición o modificación de estado visibles.

2. Vista de Administración (Ruta protegida: /admin)
   - Accesible únicamente mediante autenticación (correo y contraseña vía Supabase Auth).
   - Si un usuario no autenticado intenta entrar, debe ser redirigido a una pantalla de login (/login).
   - Elementos de la UI (Panel de Control):
     - Formulario para registrar nuevos jugadores.
     - Interfaz para crear o actualizar partidas (asignar puntajes, definir quién pasa a la siguiente ronda).
     - Botones para ejecutar las mutaciones (Insert/Update) en la base de datos de Supabase.

### Requerimientos Específicos para la Vista de Administración

1. Interfaz de Carga y Recorte:
   - En el formulario de registro/edición de jugadores, añade un input de tipo file para imágenes.
   - Al seleccionar una imagen, debe abrirse un modal con la herramienta de recorte fijada en una relación de aspecto de 1:1 (cuadrada).
   - El usuario debe poder arrastrar y hacer zoom para encuadrar la foto.

2. Procesamiento en el Cliente (Canvas):
   - Una vez que el usuario confirma el recorte, utiliza la API de HTML5 "canvas" para generar dos versiones de la imagen recortada antes de subirla:
     - Tamaño Completo: Redimensionada a un máximo estricto de 400x400 píxeles (formato WebP o JPEG comprimido).
     - Miniatura (Thumbnail): Redimensionada a 100x100 píxeles.

3. Carga a Supabase Storage:
   - Crea un bucket público en Supabase Storage llamado avatars.
   - Sube ambos archivos (tamaño completo y miniatura) al bucket. Asegúrate de generar nombres de archivo únicos (por ejemplo, usando crypto.randomUUID() o el ID del jugador).

4. Actualización de la Base de Datos:
   - Modifica el código SQL de inicialización para que la tabla players incluya dos nuevas columnas: photo_full_url (text) y photo_thumb_url (text).
   - Una vez que las imágenes se suban a Storage, obtén sus URLs públicas y guárdalas en el registro del jugador en la base de datos.
