import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { supabase } from "./supabase";
import {
  type Player,
  tournamentConfig,
  type Phase,
  type GroupRound,
} from "./types";
import { ImageCropper } from "./ImageCropper";

export function Admin() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [players, setPlayers] = useState<Player[]>([]);
  const [tournamentStatus, setTournamentStatus] = useState<
    "registration" | "active"
  >("registration");
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([]);
  const [previewGroups, setPreviewGroups] = useState<GroupRound[] | null>(null);

  // Form State
  const [isPlayersSectionOpen, setIsPlayersSectionOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRelatives, setNewPlayerRelatives] = useState<string[]>([]);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const [photoBlobs, setPhotoBlobs] = useState<{
    full: Blob;
    thumb: Blob;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getPhaseStats = (phase: Phase) => {
    const phaseRounds = groupRounds.filter((gr) => gr.phase === phase);
    const playerIdsInPhase = new Set<string>();
    phaseRounds.forEach((gr) =>
      gr.players.forEach((pid) => playerIdsInPhase.add(pid)),
    );
    const stats = Array.from(playerIdsInPhase)
      .map((pid) => {
        const p = players.find((player) => player.id === pid);
        if (!p) return null;
        let total = 0;
        let secondaryTotal = 0;
        phaseRounds.forEach((gr) => {
          if (gr.players.includes(p.id)) {
            const score = gr.scores[p.id];
            if (score !== undefined) {
              total += score;
            }
            const secScore = gr.secondaryScores[p.id];
            if (secScore !== undefined) {
              secondaryTotal += secScore;
            }
          }
        });
        return { p, total, secondaryTotal };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    stats.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.secondaryTotal - a.secondaryTotal;
    });
    return stats;
  };

  const nextStageInfo = useMemo(() => {
    if (groupRounds.length === 0)
      return {
        phase: "groups" as Phase,
        round: 1,
        playersToGroup: players,
        label: "Generar Eliminatorias (Ronda 1)",
      };

    const groupPhase = groupRounds.filter((g) => g.phase === "groups");
    if (groupPhase.length > 0) {
      const maxRound = Math.max(...groupPhase.map((g) => g.roundNumber));
      const allGroupsInMaxRoundFinished = groupPhase
        .filter((g) => g.roundNumber === maxRound)
        .every((g) => g.isFinished);
      if (!allGroupsInMaxRoundFinished) return null;

      if (maxRound < 3)
        return {
          phase: "groups" as Phase,
          round: maxRound + 1,
          playersToGroup: players,
          label: `Generar Eliminatorias (Ronda ${maxRound + 1})`,
        };

      const semiPhase = groupRounds.filter((g) => g.phase === "semifinal");
      if (semiPhase.length === 0) {
        const stats = getPhaseStats("groups");

        const stat7 = stats[7];
        const stat8 = stats[8];
        if (
          stats.length > 8 &&
          stat7 &&
          stat8 &&
          stat7.total === stat8.total &&
          stat7.secondaryTotal === stat8.secondaryTotal
        ) {
          const tiedScore = stat7.total;
          const tiedSecScore = stat7.secondaryTotal;
          const tiedPlayers = stats
            .filter(
              (s) => s.total === tiedScore && s.secondaryTotal === tiedSecScore,
            )
            .map((s) => {
              const lastGroup = groupPhase.find(
                (g) => g.roundNumber === 3 && g.players.includes(s.p.id),
              );
              return {
                ...s,
                lastGroupName: lastGroup?.groupName || "Desconocido",
              };
            });
          return {
            phase: "semifinal" as Phase,
            round: 1,
            isTie: true,
            tiedScore,
            tiedPlayers,
            label: "Empate detectado",
          };
        }

        return {
          phase: "semifinal" as Phase,
          round: 1,
          playersToGroup: stats.slice(0, 8).map((s) => s.p),
          label: "Generar Semifinal",
        };
      }

      const allSemiFinished = semiPhase.every((g) => g.isFinished);
      if (!allSemiFinished) return null;

      const finalPhase = groupRounds.filter((g) => g.phase === "final");
      if (finalPhase.length === 0) {
        const stats = getPhaseStats("semifinal");

        const stat3 = stats[3];
        const stat4 = stats[4];
        if (
          stats.length > 4 &&
          stat3 &&
          stat4 &&
          stat3.total === stat4.total &&
          stat3.secondaryTotal === stat4.secondaryTotal
        ) {
          const tiedScore = stat3.total;
          const tiedSecScore = stat3.secondaryTotal;
          const tiedPlayers = stats
            .filter(
              (s) => s.total === tiedScore && s.secondaryTotal === tiedSecScore,
            )
            .map((s) => {
              const lastGroup = semiPhase.find(
                (g) => g.roundNumber === 1 && g.players.includes(s.p.id),
              );
              return {
                ...s,
                lastGroupName: lastGroup?.groupName || "Desconocido",
              };
            });
          return {
            phase: "final" as Phase,
            round: 1,
            isTie: true,
            tiedScore,
            tiedPlayers,
            label: "Empate detectado",
          };
        }

        return {
          phase: "final" as Phase,
          round: 1,
          playersToGroup: stats.slice(0, 4).map((s) => s.p),
          label: "Generar Final",
        };
      }

      return null;
    }
    return null;
  }, [groupRounds, players]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setSession(session);
        fetchData();
      }
      setIsLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    // 1. Fetch Players
    const { data: playersData } = await supabase.from("players").select("*");
    const { data: relsData } = await supabase
      .from("player_relatives")
      .select("*");

    if (playersData) {
      const parsedPlayers: Player[] = playersData.map((p: any) => ({
        id: p.id,
        name: p.name,
        photo_full_url: p.photo_full_url,
        photo_thumb_url: p.photo_thumb_url,
        relatives: relsData
          ? relsData
              .filter((r: any) => r.player_id === p.id)
              .map((r: any) => r.relative_id)
          : [],
      }));
      setPlayers(parsedPlayers);
    }

    // 2. Fetch Groups & Scores
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .order("round_number");
    const { data: gpData } = await supabase.from("group_players").select("*");

    if (groupsData) {
      const parsedGroups: GroupRound[] = groupsData.map((g: any) => {
        const groupPlayers = gpData
          ? gpData.filter((gp: any) => gp.group_id === g.id)
          : [];
        const scoresMap: Record<string, number> = {};
        const secondaryScoresMap: Record<string, number> = {};
        const playerIds: string[] = [];

        groupPlayers.forEach((gp: any) => {
          playerIds.push(gp.player_id);
          if (gp.score !== null && gp.score !== undefined) {
            scoresMap[gp.player_id] = gp.score;
          }
          if (gp.secondary_score !== null && gp.secondary_score !== undefined) {
            secondaryScoresMap[gp.player_id] = gp.secondary_score;
          }
        });

        return {
          id: g.id,
          phase: g.phase as Phase,
          roundNumber: g.round_number,
          groupName: g.group_name,
          players: playerIds,
          scores: scoresMap,
          secondaryScores: secondaryScoresMap,
          isFinished: g.is_finished,
        };
      });
      setGroupRounds(parsedGroups);

      if (parsedGroups.length > 0) {
        setTournamentStatus("active");
      } else {
        setTournamentStatus("registration");
      }
    }
  };

  // Cropper State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Scoring State
  const [selectedPhaseForScore, setSelectedPhaseForScore] =
    useState<Phase>("groups");
  const [selectedRoundForScore, setSelectedRoundForScore] = useState<number>(1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupScores, setGroupScores] = useState<Record<string, string>>({}); // string to handle empty inputs
  const [groupSecondaryScores, setGroupSecondaryScores] = useState<
    Record<string, string>
  >({});

  // Data for Scoring
  const roundsForPhase = Array.from(
    { length: tournamentConfig.phases[selectedPhaseForScore].totalRounds },
    (_, i) => i + 1,
  );

  const groupsToScore = groupRounds.filter(
    (gr) =>
      gr.phase === selectedPhaseForScore &&
      gr.roundNumber === selectedRoundForScore,
  );

  const activeGroupToScore = groupsToScore.find(
    (gr) => gr.id === selectedGroupId,
  );

  const isScoreFormValid =
    activeGroupToScore &&
    activeGroupToScore.players.every((pid) => {
      const val = groupScores[pid];
      const secVal = groupSecondaryScores[pid];
      const isPrimaryValid =
        val !== undefined && val.trim() !== "" && !isNaN(Number(val));
      const isSecondaryValid =
        secVal !== undefined && secVal.trim() !== "" && !isNaN(Number(secVal));
      return isPrimaryValid && isSecondaryValid;
    });

  const handleSaveScores = async () => {
    if (!activeGroupToScore || !isScoreFormValid) return;

    try {
      // Update each player's score in group_players
      for (const pid of Object.keys(groupScores)) {
        await supabase
          .from("group_players")
          .update({
            score: Number(groupScores[pid]),
            secondary_score: Number(groupSecondaryScores[pid]),
          })
          .match({ group_id: activeGroupToScore.id, player_id: pid });
      }

      // Mark group as finished
      await supabase
        .from("groups")
        .update({ is_finished: true })
        .eq("id", activeGroupToScore.id);

      alert("¡Resultados guardados exitosamente en la base de datos!");
      setGroupScores({});
      setGroupSecondaryScores({});
      setSelectedGroupId("");
      await fetchData();
    } catch (e: any) {
      alert("Error guardando puntajes: " + e.message);
    }
  };

  const handleGroupSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value;
    setSelectedGroupId(gid);

    // Auto-fill existing scores if any
    const group = groupsToScore.find((gr) => gr.id === gid);
    if (group && group.isFinished) {
      const existing: Record<string, string> = {};
      const existingSec: Record<string, string> = {};
      Object.keys(group.scores).forEach((pid) => {
        const score = group.scores[pid];
        if (score !== undefined) {
          existing[pid] = score.toString();
        }
      });
      if (group.secondaryScores) {
        Object.keys(group.secondaryScores).forEach((pid) => {
          const secScore = group.secondaryScores[pid];
          if (secScore !== undefined) {
            existingSec[pid] = secScore.toString();
          }
        });
      }
      setGroupScores(existing);
      setGroupSecondaryScores(existingSec);
    } else {
      setGroupScores({});
      setGroupSecondaryScores({});
    }
  };

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
    setPhotoBlobs({ full: fullBlob, thumb: thumbBlob });
    setCropImageSrc(null);
  };

  const handleSavePlayer = async () => {
    if (!newPlayerName.trim()) return;
    setIsSaving(true);

    try {
      let fullUrl = undefined;
      let thumbUrl = undefined;

      const playerId = editingPlayerId || crypto.randomUUID();

      if (photoBlobs) {
        const fullPath = `${playerId}/full_${Date.now()}.webp`;
        const thumbPath = `${playerId}/thumb_${Date.now()}.webp`;

        await supabase.storage
          .from("avatars")
          .upload(fullPath, photoBlobs.full, { upsert: true });
        await supabase.storage
          .from("avatars")
          .upload(thumbPath, photoBlobs.thumb, { upsert: true });

        fullUrl = supabase.storage.from("avatars").getPublicUrl(fullPath)
          .data.publicUrl;
        thumbUrl = supabase.storage.from("avatars").getPublicUrl(thumbPath)
          .data.publicUrl;
      }

      const playerData = {
        id: playerId,
        name: newPlayerName,
        ...(fullUrl ? { photo_full_url: fullUrl } : {}),
        ...(thumbUrl ? { photo_thumb_url: thumbUrl } : {}),
      };

      const { error: pError } = await supabase
        .from("players")
        .upsert(playerData);
      if (pError) throw pError;

      await supabase
        .from("player_relatives")
        .delete()
        .eq("player_id", playerId);
      await supabase
        .from("player_relatives")
        .delete()
        .eq("relative_id", playerId);

      if (newPlayerRelatives.length > 0) {
        const relInserts = newPlayerRelatives.map((rid) => ({
          player_id: playerId,
          relative_id: rid,
        }));
        const { error: rError } = await supabase
          .from("player_relatives")
          .insert(relInserts);
        if (rError) throw rError;
      }

      await fetchData();
      resetForm();
    } catch (e: any) {
      alert("Error guardando: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setNewPlayerName(p.name);
    setNewPlayerRelatives(p.relatives || []);
    setTempPhotoUrl(null); // Keep original unless new is uploaded
  };

  const handleDeletePlayer = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar a este jugador?")) {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) {
        alert("Error al eliminar: " + error.message);
        return;
      }
      await fetchData();
      if (editingPlayerId === id) resetForm();
    }
  };

  const resetForm = () => {
    setEditingPlayerId(null);
    setNewPlayerName("");
    setNewPlayerRelatives([]);
    setTempPhotoUrl(null);
    setPhotoBlobs(null);
  };

  const toggleRelative = (id: string) => {
    if (newPlayerRelatives.includes(id)) {
      setNewPlayerRelatives(newPlayerRelatives.filter((r) => r !== id));
    } else {
      setNewPlayerRelatives([...newPlayerRelatives, id]);
    }
  };

  const handleGeneratePreview = () => {
    if (!nextStageInfo || !nextStageInfo.playersToGroup) return;
    const targetPlayers = nextStageInfo.playersToGroup;
    if (targetPlayers.length < 4) {
      alert("Se necesitan al menos 4 jugadores para formar grupos.");
      return;
    }

    const numGroups = Math.max(1, Math.floor(targetPlayers.length / 4));

    // Shuffle and distribute
    const shuffled = [...targetPlayers].sort(() => Math.random() - 0.5);
    const groups: Player[][] = Array.from({ length: numGroups }, () => []);
    const maxPerGroup = Math.ceil(targetPlayers.length / numGroups);
    const minPerGroup = Math.floor(targetPlayers.length / numGroups);
    const remainder = targetPlayers.length % numGroups;

    const capacities = Array.from({ length: numGroups }, (_, i) =>
      i < remainder ? maxPerGroup : minPerGroup,
    );

    let warningTriggered = false;

    for (const player of shuffled) {
      let bestGroupIdx = -1;
      let minConflicts = Infinity;

      for (let i = 0; i < numGroups; i++) {
        const currentGroup = groups[i];
        const capacity = capacities[i];

        if (
          currentGroup &&
          capacity !== undefined &&
          currentGroup.length < capacity
        ) {
          const relatives = player.relatives || [];
          const relativesInGroup = currentGroup.filter((p) =>
            relatives.includes(p.id),
          ).length;
          if (relativesInGroup < minConflicts) {
            minConflicts = relativesInGroup;
            bestGroupIdx = i;
          }
        }
      }

      if (minConflicts > 0) warningTriggered = true;
      if (bestGroupIdx !== -1) {
        const targetGroup = groups[bestGroupIdx];
        if (targetGroup) {
          targetGroup.push(player);
        }
      }
    }

    if (warningTriggered) {
      alert(
        "⚠️ Grupos generados. Nota: Debido a las restricciones matemáticas, algunos familiares quedaron en la misma mesa.",
      );
    }

    const newGroups: GroupRound[] = groups.map((g, idx) => ({
      id: `${nextStageInfo.phase}-${nextStageInfo.round}-${idx + 1}`,
      phase: nextStageInfo.phase,
      roundNumber: nextStageInfo.round,
      groupName: `Mesa ${idx + 1}`,
      players: g.map((p) => p.id),
      scores: {},
      secondaryScores: {},
      isFinished: false,
    }));

    setPreviewGroups(newGroups);
  };

  const handleStartTournament = async () => {
    if (!previewGroups) return;

    try {
      // Create groups
      for (const g of previewGroups) {
        const { data: newGroup, error: groupErr } = await supabase
          .from("groups")
          .insert({
            phase: g.phase,
            round_number: g.roundNumber,
            group_name: g.groupName,
            is_finished: false,
          })
          .select()
          .single();

        if (groupErr) throw groupErr;

        // Insert players into this group
        const groupPlayers = g.players.map((pid) => ({
          group_id: newGroup.id,
          player_id: pid,
          score: null,
        }));

        const { error: gpErr } = await supabase
          .from("group_players")
          .insert(groupPlayers);
        if (gpErr) throw gpErr;
      }

      alert(
        "¡Torneo iniciado! Los grupos han sido guardados en la base de datos.",
      );
      setPreviewGroups(null);
      setIsPlayersSectionOpen(false);
      await fetchData();
    } catch (e: any) {
      alert("Error al iniciar el torneo: " + e.message);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-8 w-8 text-purple-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-white/50 text-sm">Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 relative z-10 animate-fade-in">
      <header className="mb-12 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 font-['Outfit']">
            Panel de Administración
          </h1>
          <p className="text-white/60">
            Gestiona jugadores y estructura del torneo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/"
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 transition-all font-medium"
          >
            Ver Torneo
          </a>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 backdrop-blur-md border border-red-500/20 transition-all font-medium flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Salir
          </button>
        </div>
      </header>

      <div className="space-y-12">
        {/* SECCIÓN 1: GESTIÓN DE JUGADORES */}
        <section>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-colors"
            onClick={() => setIsPlayersSectionOpen(!isPlayersSectionOpen)}
          >
            <h2 className="text-2xl font-bold text-white font-['Outfit'] flex items-center gap-3">
              <span className="bg-purple-500/20 text-purple-400 p-2 rounded-lg">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </span>
              Registro y Gestión de Jugadores
            </h2>
            <svg
              className={`w-6 h-6 text-white/50 transition-transform ${isPlayersSectionOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          {isPlayersSectionOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
              {/* Columna Izquierda: Formulario */}
              <section className="lg:col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden h-fit">
                <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit']">
                  {editingPlayerId ? "Editar Jugador" : "Nuevo Jugador"}
                </h2>

                {tournamentStatus === "active" ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                    <svg
                      className="w-16 h-16 text-white/20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <p className="text-white/60 font-medium">
                      La edición de jugadores está bloqueada.
                      <br />
                      El torneo ya está en curso.
                    </p>
                  </div>
                ) : (
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
                        Selecciona a los familiares para evitar que queden en el
                        mismo grupo.
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
                                <span className="text-sm text-white/90">
                                  {p.name}
                                </span>
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
                        disabled={!newPlayerName.trim() || isSaving}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? "Guardando..." : "Guardar Jugador"}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Columna Derecha: Lista de Jugadores */}
              <div className="lg:col-span-2 h-auto lg:h-0 lg:min-h-full flex flex-col">
                <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                    <h2 className="text-2xl font-bold text-white font-['Outfit']">
                      Jugadores Registrados ({players.length})
                    </h2>
                  </div>

                  <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 rounded-xl border border-white/5 bg-black/20">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#1a1a24] z-10 shadow-md">
                        <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                          <th className="p-4 font-bold">Jugador</th>
                          <th className="p-4 font-bold">Familiares</th>
                          {tournamentStatus === "registration" && (
                            <th className="p-4 font-bold text-right">
                              Acciones
                            </th>
                          )}
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
                                {player.relatives &&
                                player.relatives.length > 0 ? (
                                  player.relatives.map((rid) => {
                                    const rel = players.find(
                                      (p) => p.id === rid,
                                    );
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
                                  <span className="text-xs text-white/30">
                                    -
                                  </span>
                                )}
                              </div>
                            </td>
                            {tournamentStatus === "registration" && (
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
                                    onClick={() =>
                                      handleDeletePlayer(player.id)
                                    }
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
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>

        {/* SECCIÓN 2: GESTIÓN DEL TORNEO */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-green-500/20 text-green-400 p-2 rounded-lg">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </span>
            <h2 className="text-2xl font-bold text-white font-['Outfit']">
              Gestión del Torneo
            </h2>
          </div>

          <div className="space-y-8">
            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white font-['Outfit'] mb-2">
                    {tournamentStatus === "registration"
                      ? "Formar Grupos e Iniciar Torneo"
                      : "Gestión de Rondas"}
                  </h2>
                  <p className="text-sm text-white/60 max-w-md">
                    {tournamentStatus === "registration"
                      ? "Genera los grupos aleatorios separando a familiares. Podrás revisar los grupos antes de confirmar e iniciar el torneo."
                      : nextStageInfo
                        ? "La ronda actual ha finalizado. Genera los grupos para la siguiente etapa."
                        : "El torneo está en curso o ha finalizado. Utiliza el panel de carga de resultados."}
                  </p>
                </div>
                {nextStageInfo && !nextStageInfo.isTie && !previewGroups && (
                  <button
                    onClick={handleGeneratePreview}
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
                    {nextStageInfo.label}
                  </button>
                )}
              </div>

              {nextStageInfo && nextStageInfo.isTie && (
                <div className="w-full mt-6 bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-center animate-fade-in">
                  <div className="bg-red-500/20 p-4 rounded-full text-red-400 shrink-0">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-400 mb-2">
                      ¡Empate detectado en el puesto de corte!
                    </h3>
                    <p className="text-red-200/80 mb-3 text-sm">
                      Hay jugadores empatados con{" "}
                      <strong>{nextStageInfo.tiedScore} puntos</strong> luchando
                      por el último cupo. El torneo no puede avanzar hasta que
                      se resuelva.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {nextStageInfo.tiedPlayers?.map((s) => (
                        <div
                          key={s.p.id}
                          className="bg-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-red-500/20"
                        >
                          <img
                            src={
                              s.p.photo_thumb_url ||
                              `https://ui-avatars.com/api/?name=${s.p.name}&background=random`
                            }
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-sm font-bold text-red-100">
                            {s.p.name} - {s.total} pts ({s.lastGroupName})
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-sm text-red-300">
                      <strong>💡 Solución:</strong> Realiza un mini-juego de
                      desempate con ellos. Una vez tengas al ganador, utiliza el
                      panel de abajo ("Cargar Resultados") para ajustar
                      manualmente los puntajes de su grupo en la ronda anterior
                      y sumarle o restarle puntos.
                    </div>
                  </div>
                </div>
              )}

              {previewGroups && (
                <div className="w-full mt-8 bg-black/20 p-6 rounded-2xl border border-white/10 animate-fade-in">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Vista Previa de los Grupos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {previewGroups.map((g) => (
                      <div
                        key={g.id}
                        className="bg-white/5 p-4 rounded-xl border border-white/5"
                      >
                        <h4 className="font-bold text-white/90 mb-3 pb-2 border-b border-white/10">
                          {g.groupName}
                        </h4>
                        <ul className="space-y-2">
                          {g.players.map((pid) => {
                            const p = players.find((x) => x.id === pid);
                            return (
                              <li
                                key={pid}
                                className="flex items-center gap-2 text-sm text-white/70"
                              >
                                <img
                                  src={
                                    p?.photo_thumb_url ||
                                    `https://ui-avatars.com/api/?name=${p?.name}&background=random`
                                  }
                                  className="w-5 h-5 rounded-full"
                                />
                                {p?.name}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {nextStageInfo && nextStageInfo.round > 1 && (
                    <div className="mt-2 mb-8">
                      <h3 className="text-lg font-bold text-white/70 mb-4 border-t border-white/10 pt-6">
                        Grupos de Rondas Anteriores (
                        {nextStageInfo.phase === "groups"
                          ? "Eliminatorias"
                          : nextStageInfo.phase === "semifinal"
                            ? "Semifinal"
                            : "Final"}
                        )
                      </h3>
                      {Array.from(
                        { length: nextStageInfo.round - 1 },
                        (_, i) => i + 1,
                      ).map((roundNum) => {
                        const pastGroups = groupRounds.filter(
                          (g) =>
                            g.phase === nextStageInfo.phase &&
                            g.roundNumber === roundNum,
                        );
                        if (pastGroups.length === 0) return null;
                        return (
                          <div key={roundNum} className="mb-6 last:mb-0">
                            <h4 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wider">
                              Ronda {roundNum}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {pastGroups.map((g) => (
                                <div
                                  key={g.id}
                                  className="bg-black/40 p-3 rounded-xl border border-white/5 opacity-60"
                                >
                                  <h5 className="font-bold text-white/70 mb-2 pb-1 border-b border-white/5 text-sm">
                                    {g.groupName}
                                  </h5>
                                  <ul className="space-y-1">
                                    {g.players.map((pid) => {
                                      const p = players.find(
                                        (x) => x.id === pid,
                                      );
                                      return (
                                        <li
                                          key={pid}
                                          className="flex items-center gap-2 text-xs text-white/50"
                                        >
                                          <img
                                            src={
                                              p?.photo_thumb_url ||
                                              `https://ui-avatars.com/api/?name=${p?.name}&background=random`
                                            }
                                            className="w-4 h-4 rounded-full grayscale opacity-70"
                                          />
                                          {p?.name}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-4 border-t border-white/10 pt-6">
                    <button
                      onClick={handleGeneratePreview}
                      className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all font-bold flex items-center justify-center gap-2"
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Volver a Mezclar
                    </button>
                    <button
                      onClick={handleStartTournament}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {tournamentStatus === "registration"
                        ? "Confirmar e Iniciar Torneo"
                        : "Confirmar y Continuar Torneo"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group/scores">
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -z-10 group-hover/scores:bg-pink-500/20 transition-all"></div>
              <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit'] flex items-center gap-3">
                <span className="bg-pink-500/20 text-pink-400 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                Cargar Resultados
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Fase
                    </label>
                    <select
                      value={selectedPhaseForScore}
                      onChange={(e) => {
                        setSelectedPhaseForScore(e.target.value as Phase);
                        setSelectedRoundForScore(1);
                        setSelectedGroupId("");
                        setGroupScores({});
                        setGroupSecondaryScores({});
                      }}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none"
                    >
                      <option value="groups" className="bg-gray-900">
                        Eliminatorias
                      </option>
                      <option value="semifinal" className="bg-gray-900">
                        Semifinal
                      </option>
                      <option value="final" className="bg-gray-900">
                        Final
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Ronda
                    </label>
                    <select
                      value={selectedRoundForScore}
                      onChange={(e) => {
                        setSelectedRoundForScore(Number(e.target.value));
                        setSelectedGroupId("");
                        setGroupScores({});
                        setGroupSecondaryScores({});
                      }}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none"
                    >
                      {roundsForPhase.map((r) => (
                        <option key={r} value={r} className="bg-gray-900">
                          Ronda {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Mesa / Grupo
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={handleGroupSelection}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none"
                  >
                    <option value="" disabled className="bg-gray-900">
                      Seleccione un grupo...
                    </option>
                    {groupsToScore.map((g) => (
                      <option key={g.id} value={g.id} className="bg-gray-900">
                        {g.groupName} {g.isFinished ? "(Completado)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {activeGroupToScore && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h3 className="text-white font-bold mb-4">
                      Ingresar Puntajes
                    </h3>
                    <div className="space-y-3">
                      {activeGroupToScore.players.map((pid) => {
                        const p = players.find((x) => x.id === pid);
                        if (!p) return null;
                        return (
                          <div
                            key={pid}
                            className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  p.photo_thumb_url ||
                                  `https://ui-avatars.com/api/?name=${p.name}&background=random`
                                }
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="font-medium text-white/90">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <span className="text-[11px] font-bold text-pink-400 mb-1 tracking-wide uppercase">
                                  Pts. Posición
                                </span>
                                <input
                                  type="number"
                                  value={groupScores[pid] || ""}
                                  onChange={(e) =>
                                    setGroupScores({
                                      ...groupScores,
                                      [pid]: e.target.value,
                                    })
                                  }
                                  placeholder="--"
                                  className="w-20 h-11 bg-pink-500/10 border-2 border-pink-500/40 rounded-xl px-2 text-white font-bold text-lg text-center focus:outline-none focus:border-pink-400 focus:shadow-[0_0_15px_rgba(244,114,182,0.3)] transition-all"
                                />
                              </div>
                              <div className="w-[1px] h-10 bg-white/10 mx-1"></div>
                              <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white/50 mb-1">
                                  Pts. Juego
                                </span>
                                <input
                                  type="number"
                                  value={groupSecondaryScores[pid] || ""}
                                  onChange={(e) =>
                                    setGroupSecondaryScores({
                                      ...groupSecondaryScores,
                                      [pid]: e.target.value,
                                    })
                                  }
                                  placeholder="0"
                                  className="w-16 h-9 bg-black/40 border border-white/10 rounded-lg px-2 text-white/80 text-sm text-center focus:outline-none focus:border-white/30 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleSaveScores}
                      disabled={!isScoreFormValid}
                      className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeGroupToScore.isFinished
                        ? "Actualizar Resultados"
                        : "Guardar Resultados"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
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
