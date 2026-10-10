import { useState, useMemo, useEffect } from "react";
import {
  tournamentConfig,
  type Phase,
  type Player,
  type GroupRound,
} from "./types";
import { supabase } from "./supabase";

export function Home() {
  const [activePhase, setActivePhase] = useState<Phase>("groups");
  const [selectedRound, setSelectedRound] = useState<number>(1);

  const [players, setPlayers] = useState<Player[]>([]);
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([]);

  const [hasInitialPhaseSet, setHasInitialPhaseSet] = useState(false);

  useEffect(() => {
    fetchData();

    // Suscripción en tiempo real a cualquier cambio en la base de datos
    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        fetchData(); // Refrescar datos al detectar cambios
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: playersData } = await supabase.from("players").select("*");

    if (playersData) {
      const parsedPlayers: Player[] = playersData.map((p: any) => ({
        id: p.id,
        name: p.name,
        photo_full_url: p.photo_full_url,
        photo_thumb_url: p.photo_thumb_url,
        relatives: [],
      }));
      setPlayers(parsedPlayers);
    }

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

      if (!hasInitialPhaseSet) {
        const checkUnlocked = (phase: Phase) => {
          if (phase === "groups") return true;
          if (phase === "semifinal") {
            const round3Groups = parsedGroups.filter(
              (gr) => gr.phase === "groups" && gr.roundNumber === 3,
            );
            if (round3Groups.length === 0) return false;
            return round3Groups.every((gr) => gr.isFinished);
          }
          if (phase === "final") {
            const semiGroups = parsedGroups.filter(
              (gr) => gr.phase === "semifinal",
            );
            if (semiGroups.length === 0) return false;
            return semiGroups.every((gr) => gr.isFinished);
          }
          return false;
        };

        if (checkUnlocked("final")) setActivePhase("final");
        else if (checkUnlocked("semifinal")) setActivePhase("semifinal");

        setHasInitialPhaseSet(true);
      }
    }
  };

  const handlePhaseChange = (phase: Phase) => {
    setActivePhase(phase);
    setSelectedRound(1);
  };

  const currentPhaseConfig = tournamentConfig.phases[activePhase];
  const roundsArray = Array.from(
    { length: currentPhaseConfig.totalRounds },
    (_, i) => i + 1,
  );

  const getTopPlayersFromPhase = (phase: Phase, limit: number) => {
    const pRounds = groupRounds.filter((gr) => gr.phase === phase);
    const ids = new Set<string>();
    pRounds.forEach((gr) => gr.players.forEach((pid) => ids.add(pid)));
    const stats = Array.from(ids).map((pid) => {
      let total = 0;
      let secondaryTotal = 0;
      pRounds.forEach((gr) => {
        if (gr.players.includes(pid)) {
          const score = gr.scores[pid];
          if (score !== undefined) total += score;
          const secScore = gr.secondaryScores[pid];
          if (secScore !== undefined) secondaryTotal += secScore;
        }
      });
      return { pid, total, secondaryTotal };
    });
    stats.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.secondaryTotal - a.secondaryTotal;
    });
    return stats.slice(0, limit).map((s) => s.pid);
  };

  const playersStats = useMemo(() => {
    const phaseRounds = groupRounds.filter((gr) => gr.phase === activePhase);
    const playerIdsInPhase = new Set<string>();

    if (phaseRounds.length > 0) {
      phaseRounds.forEach((gr) => {
        gr.players.forEach((pid) => playerIdsInPhase.add(pid));
      });
    } else {
      if (activePhase === "semifinal") {
        getTopPlayersFromPhase("groups", 8).forEach((pid) =>
          playerIdsInPhase.add(pid),
        );
      } else if (activePhase === "final") {
        getTopPlayersFromPhase("semifinal", 4).forEach((pid) =>
          playerIdsInPhase.add(pid),
        );
      }
    }

    const stats = Array.from(playerIdsInPhase).map((pid) => {
      const p = players.find((player) => player.id === pid);
      if (!p) return null;
      let r1 = 0,
        r2 = 0,
        r3 = 0,
        secondaryTotal = 0;

      phaseRounds.forEach((gr) => {
        const score = gr.scores[p.id];
        if (gr.players.includes(p.id) && score !== undefined) {
          if (gr.roundNumber === 1) r1 = score;
          if (gr.roundNumber === 2) r2 = score;
          if (gr.roundNumber === 3) r3 = score;
        }
        const secScore = gr.secondaryScores[p.id];
        if (gr.players.includes(p.id) && secScore !== undefined) {
          secondaryTotal += secScore;
        }
      });
      return {
        ...p,
        r1,
        r2,
        r3,
        total: r1 + r2 + r3,
        secondaryTotal,
      };
    });

    return stats
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.secondaryTotal - a.secondaryTotal;
      });
  }, [activePhase, groupRounds, players]);

  const groupsInSelectedRound = useMemo(() => {
    return groupRounds.filter(
      (gr) => gr.phase === activePhase && gr.roundNumber === selectedRound,
    );
  }, [activePhase, selectedRound, groupRounds]);

  const isPhaseUnlocked = (phase: Phase) => {
    if (phase === "groups") return true;
    if (phase === "semifinal") {
      const round3Groups = groupRounds.filter(
        (gr) => gr.phase === "groups" && gr.roundNumber === 3,
      );
      if (round3Groups.length === 0) return false;
      return round3Groups.every((gr) => gr.isFinished);
    }
    if (phase === "final") {
      const semiGroups = groupRounds.filter((gr) => gr.phase === "semifinal");
      if (semiGroups.length === 0) return false;
      return semiGroups.every((gr) => gr.isFinished);
    }
    return false;
  };

  const getPhaseName = (phase: Phase) => {
    if (phase === "groups") return "Eliminatorias";
    if (phase === "semifinal") return "Semifinal";
    return "Final";
  };

  const isRound1Finished = useMemo(() => {
    const round1Groups = groupRounds.filter(
      (gr) => gr.phase === activePhase && gr.roundNumber === 1,
    );
    if (round1Groups.length === 0) return false;
    return round1Groups.every((gr) => gr.isFinished);
  }, [activePhase, groupRounds]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 relative z-10 animate-fade-in">
      <header className="text-center mb-12 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px] -z-10"></div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 tracking-tight font-['Outfit'] mb-4 drop-shadow-sm">
          {tournamentConfig.name}
        </h1>

        {/* Phase Selector */}
        <div className="flex justify-center mt-8">
          <div className="flex w-full sm:w-fit bg-black/40 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
            {(["groups", "semifinal", "final"] as Phase[]).map((phase) => {
              const unlocked = isPhaseUnlocked(phase);
              return (
                <button
                  key={phase}
                  onClick={() => unlocked && handlePhaseChange(phase)}
                  disabled={!unlocked}
                  className={`flex-1 sm:flex-none px-2 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-base transition-all ${
                    !unlocked
                      ? "opacity-40 cursor-not-allowed text-white/40"
                      : activePhase === phase
                        ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-black shadow-lg sm:scale-105 scale-100"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {getPhaseName(phase)}
                  {!unlocked && <span className="ml-1 text-xs">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-12">
        {/* Clasificación Global - Full Width */}
        {activePhase === "final" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {playersStats.map((player, index) => {
              let cardBg = "bg-white/5";
              let borderColor = "border-white/10";
              let placeName = "";
              let textColor = "text-white/70";

              if (isRound1Finished) {
                if (index === 0) {
                  cardBg =
                    "bg-gradient-to-br from-yellow-400/20 to-yellow-600/10";
                  borderColor =
                    "border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.3)]";
                  placeName = "1er Lugar 🏆";
                  textColor = "text-yellow-400";
                } else if (index === 1) {
                  cardBg = "bg-gradient-to-br from-gray-300/20 to-gray-400/10";
                  borderColor =
                    "border-gray-300/50 shadow-[0_0_20px_rgba(209,213,219,0.2)]";
                  placeName = "2do Lugar 🥈";
                  textColor = "text-gray-300";
                } else if (index === 2) {
                  cardBg =
                    "bg-gradient-to-br from-amber-700/20 to-amber-900/10";
                  borderColor =
                    "border-amber-700/50 shadow-[0_0_20px_rgba(180,83,9,0.3)]";
                  placeName = "3er Lugar 🥉";
                  textColor = "text-amber-600";
                } else if (index === 3) {
                  cardBg = "bg-white/10";
                  borderColor = "border-white/20";
                  placeName = "4to Lugar";
                  textColor = "text-white/90";
                }
              }

              return (
                <div
                  key={player.id}
                  className={`flex flex-col items-center justify-center p-8 rounded-3xl border ${cardBg} ${borderColor} backdrop-blur-xl transition-transform hover:scale-105`}
                >
                  <div
                    className={`text-sm font-bold mb-4 uppercase tracking-widest ${textColor}`}
                  >
                    {placeName}
                  </div>
                  <img
                    src={
                      player.photo_full_url ||
                      player.photo_thumb_url ||
                      `https://ui-avatars.com/api/?name=${player.name}&background=random`
                    }
                    alt={player.name}
                    className={`w-32 h-32 rounded-full object-cover border-4 ${borderColor} mb-6 shadow-xl`}
                  />
                  <h3 className="text-2xl font-bold text-white text-center mb-6 font-['Outfit']">
                    {player.name}
                  </h3>
                  <div className="flex gap-6 w-full justify-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest mb-1">
                        Pts. Juego
                      </span>
                      <span className="text-2xl font-black text-white">
                        {isRound1Finished ? player.secondaryTotal : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white font-['Outfit']">
                {getPhaseName(activePhase)}
              </h2>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 bg-[#161616] backdrop-blur-md z-30 shadow-md">
                  <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Jugador</th>
                    {currentPhaseConfig.totalRounds > 1 && (
                      <th className="p-4 font-bold text-center text-xs md:hidden">
                        Rondas
                      </th>
                    )}
                    {currentPhaseConfig.totalRounds >= 1 && (
                      <th className="p-4 font-bold text-center hidden md:table-cell">
                        Ronda 1
                      </th>
                    )}
                    {currentPhaseConfig.totalRounds >= 2 && (
                      <th className="p-4 font-bold text-center hidden md:table-cell">
                        Ronda 2
                      </th>
                    )}
                    {currentPhaseConfig.totalRounds >= 3 && (
                      <th className="p-4 font-bold text-center hidden md:table-cell">
                        Ronda 3
                      </th>
                    )}
                    <th className="p-4 font-bold text-right text-white">
                      Pts.
                      <br />
                      <span className="text-[10px] font-normal text-white/40">
                        Juego
                      </span>
                    </th>
                    <th className="p-4 font-bold text-right text-white">
                      Pts.
                      <br />
                      <span className="text-[10px] font-normal text-white/40">
                        Posición
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {playersStats.map((player, index) => {
                    let rowBg = "";
                    let glowColor = "";
                    let imgBorder = "border border-white/10";
                    let nameColor = "text-white group-hover:text-amber-100";
                    let scoreColor = "from-white to-white/50";
                    let showGlow = false;

                    const isAdvancing =
                      isRound1Finished &&
                      index < currentPhaseConfig.advancingPlayers;

                    if (isAdvancing) {
                      rowBg = "bg-amber-500/5";
                      glowColor = "bg-amber-400/20";
                      imgBorder =
                        "border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]";
                      nameColor = "text-amber-200";
                      scoreColor = "from-amber-200 to-amber-500";
                      showGlow = true;
                    }

                    return (
                      <tr
                        key={player.id}
                        className={`hover:bg-white/5 transition-colors group ${rowBg}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="relative shrink-0">
                              {showGlow && (
                                <div
                                  className={`absolute -inset-1 rounded-full blur-sm opacity-50 ${glowColor}`}
                                ></div>
                              )}
                              <img
                                src={
                                  player.photo_thumb_url ||
                                  `https://ui-avatars.com/api/?name=${player.name}&background=random`
                                }
                                alt={player.name}
                                className={`w-10 h-10 rounded-full object-cover relative z-10 ${imgBorder}`}
                              />
                            </div>
                            <span
                              className={`font-bold transition-colors ${nameColor}`}
                            >
                              {player.name}
                            </span>
                          </div>
                        </td>
                        {currentPhaseConfig.totalRounds > 1 && (
                          <td className="p-4 text-center font-medium text-white/50 text-xs md:hidden tracking-wider whitespace-nowrap">
                            {[
                              currentPhaseConfig.totalRounds >= 1
                                ? player.r1 > 0
                                  ? player.r1
                                  : "---"
                                : null,
                              currentPhaseConfig.totalRounds >= 2
                                ? player.r2 > 0
                                  ? player.r2
                                  : "---"
                                : null,
                              currentPhaseConfig.totalRounds >= 3
                                ? player.r3 > 0
                                  ? player.r3
                                  : "---"
                                : null,
                            ]
                              .filter((val) => val !== null)
                              .join(", ")}
                          </td>
                        )}
                        {currentPhaseConfig.totalRounds >= 1 && (
                          <td className="p-4 text-center font-medium text-white/70 hidden md:table-cell">
                            {player.r1 > 0 ? player.r1 : "---"}
                          </td>
                        )}
                        {currentPhaseConfig.totalRounds >= 2 && (
                          <td className="p-4 text-center font-medium text-white/70 hidden md:table-cell">
                            {player.r2 > 0 ? player.r2 : "---"}
                          </td>
                        )}
                        {currentPhaseConfig.totalRounds >= 3 && (
                          <td className="p-4 text-center font-medium text-white/70 hidden md:table-cell">
                            {player.r3 > 0 ? player.r3 : "---"}
                          </td>
                        )}
                        <td className="p-4 text-right">
                          <div
                            className={`text-lg font-bold text-transparent bg-clip-text bg-gradient-to-br from-white/50 to-white/30`}
                          >
                            {player.secondaryTotal}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div
                            className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br ${scoreColor}`}
                          >
                            {player.total}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Phase / Round details - Only show for groups phase since others are 1 round */}
        {activePhase === "groups" && (
          <div className="mt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <h2 className="text-3xl font-bold text-white font-['Outfit'] flex items-center gap-3">
                Resultados de Grupos
              </h2>

              {currentPhaseConfig.totalRounds > 1 && (
                <div className="flex w-full md:w-fit bg-black/40 p-1 rounded-xl border border-white/10 overflow-hidden">
                  {roundsArray.map((roundNum) => (
                    <button
                      key={roundNum}
                      onClick={() => setSelectedRound(roundNum)}
                      className={`flex-1 md:flex-none px-2 md:px-6 py-2.5 md:py-2 rounded-lg font-bold text-sm md:text-base transition-all ${
                        selectedRound === roundNum
                          ? "bg-white/20 text-white shadow-lg"
                          : "text-white/40 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      Ronda {roundNum}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {groupsInSelectedRound.map((group) => {
                const groupPlayers = group.players
                  .map((pid) => {
                    const playerObj = players.find((p) => p.id === pid);
                    if (!playerObj) return null;
                    return {
                      ...playerObj,
                      score: group.scores[pid] || 0,
                      secondaryScore: group.secondaryScores[pid] || 0,
                    };
                  })
                  .filter((p): p is NonNullable<typeof p> => p !== null)
                  .sort((a, b) =>
                    b.score !== a.score
                      ? b.score - a.score
                      : b.secondaryScore - a.secondaryScore,
                  );

                return (
                  <div
                    key={group.id}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors shadow-xl"
                  >
                    <div className="p-4 bg-black/20 border-b border-white/10 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-white">
                        {group.groupName}
                      </h3>
                      {group.isFinished ? (
                        <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 rounded-md border border-green-500/20">
                          Completado
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 rounded-md border border-orange-500/20">
                          Pendiente
                        </span>
                      )}
                    </div>

                    <div className="p-2">
                      {groupPlayers.map((p, idx) => (
                        <div
                          key={p?.id}
                          className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="font-medium text-white/90 text-sm truncate max-w-[150px]"
                              title={p?.name}
                            >
                              {p?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="font-medium text-white/50 bg-black/30 px-2 py-1 rounded-md text-xs border border-white/5"
                              title="Pts. Juego"
                            >
                              {p?.secondaryScore > 0 || group.isFinished
                                ? p?.secondaryScore
                                : "-"}
                            </span>
                            <span
                              className="font-bold text-white bg-white/10 px-2.5 py-1 rounded-md text-sm border border-white/5"
                              title="Pts. Posición"
                            >
                              {p?.score > 0 || group.isFinished
                                ? p?.score
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
