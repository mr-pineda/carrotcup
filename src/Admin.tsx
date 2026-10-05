import { useState } from "react";
import { mockPlayers, type Player, tournamentConfig } from "./mockData";
import { ImageCropper } from "./ImageCropper";

export function Admin() {
  const [players, setPlayers] = useState<Player[]>(mockPlayers);

  // Form State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRelatives, setNewPlayerRelatives] = useState<string[]>([]);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);

  // Cropper State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (fullBlob: Blob, thumbBlob: Blob) => {
    const thumbUrl = URL.createObjectURL(thumbBlob);
    setTempPhotoUrl(thumbUrl);
    setCropImageSrc(null);
  };

  const handleSavePlayer = () => {
    if (!newPlayerName.trim()) return;

    let updatedPlayers = [...players];
    const newId = editingPlayerId || Math.random().toString(36).substr(2, 9);

    if (editingPlayerId) {
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === editingPlayerId
          ? {
              ...p,
              name: newPlayerName,
              relatives: newPlayerRelatives,
              photo_thumb_url: tempPhotoUrl || p.photo_thumb_url,
            }
          : p,
      );
    } else {
      updatedPlayers.push({
        id: newId,
        name: newPlayerName,
        relatives: newPlayerRelatives,
        photo_thumb_url: tempPhotoUrl || undefined,
      });
    }

    // Asegurar que la relación sea bidireccional para los demás jugadores
    updatedPlayers = updatedPlayers.map((p) => {
      if (p.id === newId) return p; // El jugador actual ya tiene la lista correcta

      const pRelatives = p.relatives || [];
      const isSelectedAsRelative = newPlayerRelatives.includes(p.id);
      const alreadyHasRelative = pRelatives.includes(newId);

      if (isSelectedAsRelative && !alreadyHasRelative) {
        // Agregar la relación recíproca
        return { ...p, relatives: [...pRelatives, newId] };
      } else if (!isSelectedAsRelative && alreadyHasRelative) {
        // Quitar la relación recíproca si fue deseleccionado
        return { ...p, relatives: pRelatives.filter((id) => id !== newId) };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    resetForm();
  };

  const handleEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setNewPlayerName(p.name);
    setNewPlayerRelatives(p.relatives || []);
    setTempPhotoUrl(null); // Keep original unless new is uploaded
  };

  const handleDeletePlayer = (id: string) => {
    if (confirm("¿Estás seguro de eliminar a este jugador?")) {
      // Eliminar al jugador y limpiar su ID de los parentescos de otros jugadores
      setPlayers(
        players
          .filter((p) => p.id !== id)
          .map((p) => ({
            ...p,
            relatives: (p.relatives || []).filter((relId) => relId !== id),
          })),
      );
      if (editingPlayerId === id) resetForm();
    }
  };

  const resetForm = () => {
    setEditingPlayerId(null);
    setNewPlayerName("");
    setNewPlayerRelatives([]);
    setTempPhotoUrl(null);
  };

  const toggleRelative = (id: string) => {
    if (newPlayerRelatives.includes(id)) {
      setNewPlayerRelatives(newPlayerRelatives.filter((r) => r !== id));
    } else {
      setNewPlayerRelatives([...newPlayerRelatives, id]);
    }
  };

  const generateGroups = () => {
    alert(
      "Algoritmo de formación de grupos en desarrollo. Considerará los parentescos para separarlos.",
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 relative z-10 animate-fade-in">
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 font-['Outfit']">
            Panel de Administración
          </h1>
          <p className="text-white/60">
            Gestiona jugadores y estructura del torneo.
          </p>
        </div>
        <a
          href="#/"
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 transition-all font-medium"
        >
          Ver Torneo
        </a>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Formulario */}
        <section className="lg:col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden h-fit">
          <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit']">
            {editingPlayerId ? "Editar Jugador" : "Nuevo Jugador"}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Nombre
              </label>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Foto de Perfil
              </label>

              {tempPhotoUrl ||
              (editingPlayerId &&
                players.find((p) => p.id === editingPlayerId)
                  ?.photo_thumb_url) ? (
                <div className="flex items-center gap-4 mb-3">
                  <img
                    src={
                      tempPhotoUrl ||
                      players.find((p) => p.id === editingPlayerId)
                        ?.photo_thumb_url
                    }
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/50"
                    alt="Vista previa"
                  />
                  <button
                    onClick={() => setTempPhotoUrl(null)}
                    className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Quitar Foto
                  </button>
                </div>
              ) : null}

              <label className="flex items-center justify-center w-full h-24 px-4 transition bg-black/20 border-2 border-white/10 border-dashed rounded-xl appearance-none cursor-pointer hover:border-purple-400/50 hover:bg-black/40 focus:outline-none group">
                <span className="flex flex-col items-center space-y-1 text-white/50 group-hover:text-purple-300">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span className="font-medium text-sm">
                    Seleccionar imagen...
                  </span>
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Familiares Directos (Parentesco)
              </label>
              <p className="text-xs text-white/40 mb-3">
                Selecciona a los familiares para evitar que queden en el mismo
                grupo.
              </p>
              <div className="max-h-40 overflow-y-auto bg-black/20 rounded-xl border border-white/10 p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                {players
                  .filter((p) => p.id !== editingPlayerId)
                  .map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newPlayerRelatives.includes(p.id)}
                        onChange={() => toggleRelative(p.id)}
                        className="w-4 h-4 rounded bg-black/40 border-white/20 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-0"
                      />
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            p.photo_thumb_url ||
                            `https://ui-avatars.com/api/?name=${p.name}&background=random`
                          }
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="text-sm text-white/90">{p.name}</span>
                      </div>
                    </label>
                  ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              {editingPlayerId && (
                <button
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all font-bold"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSavePlayer}
                disabled={!newPlayerName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar Jugador
              </button>
            </div>
          </div>
        </section>

        {/* Columna Derecha: Lista de Jugadores y Grupos */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white font-['Outfit']">
                Jugadores Registrados ({players.length})
              </h2>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 rounded-xl border border-white/5 bg-black/20">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#1a1a24] z-10 shadow-md">
                  <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Jugador</th>
                    <th className="p-4 font-bold">Familiares</th>
                    <th className="p-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              player.photo_thumb_url ||
                              `https://ui-avatars.com/api/?name=${player.name}&background=random`
                            }
                            className="w-8 h-8 rounded-full border border-white/10"
                          />
                          <span className="font-bold text-white/90">
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {player.relatives && player.relatives.length > 0 ? (
                            player.relatives.map((rid) => {
                              const rel = players.find((p) => p.id === rid);
                              return rel ? (
                                <span
                                  key={rid}
                                  className="px-2 py-1 bg-white/10 rounded-md text-xs text-white/70"
                                >
                                  {rel.name}
                                </span>
                              ) : null;
                            })
                          ) : (
                            <span className="text-xs text-white/30">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditPlayer(player)}
                            className="p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-6 items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white font-['Outfit'] mb-2">
                Formar Grupos Aleatorios
              </h2>
              <p className="text-sm text-white/60 max-w-md">
                Genera los grupos para la ronda eliminatoria. El algoritmo se
                encargará de distribuir a los jugadores manteniendo separados a
                sus familiares directos.
              </p>
            </div>
            <button
              onClick={generateGroups}
              className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold transition-all shadow-lg shadow-green-500/25 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Generar Grupos
            </button>
          </section>
        </div>
      </div>

      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCrop={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
