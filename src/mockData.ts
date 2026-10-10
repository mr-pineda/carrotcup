export type Phase = "groups" | "semifinal" | "final";

export const tournamentConfig = {
  name: "Copa Zanahoria 2026",
  phases: {
    groups: {
      numGroups: 8,
      playersPerGroup: 4,
      totalRounds: 3,
      advancingPlayers: 8,
    },
    semifinal: {
      numGroups: 2,
      playersPerGroup: 4,
      totalRounds: 3,
      advancingPlayers: 4,
    },
    final: {
      numGroups: 1, // just one table
      playersPerGroup: 4,
      totalRounds: 1,
      advancingPlayers: 1,
    },
  },
};

export interface Player {
  id: string;
  name: string;
  photo_thumb_url?: string;
  relatives?: string[];
}

export interface GroupRound {
  id: string;
  phase: Phase;
  roundNumber: number;
  groupName: string;
  players: string[]; // player IDs
  scores: Record<string, number>; // playerId -> score
  isFinished: boolean;
}

// Generate 32 mock players
export const mockPlayers: Player[] = Array.from({ length: 19 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Jugador ${i + 1}`,
  photo_thumb_url: `https://i.pravatar.cc/100?img=${(i % 70) + 1}`,
}));

export const mockGroupRounds: GroupRound[] = [];

const groupNamesGroups = ["A", "B", "C", "D", "E", "F", "G", "H"];
const groupNamesSemi = ["Semi 1", "Semi 2"];
const groupNamesFinal = ["Gran Final"];

// Helper to generate scores
const generateScores = (players: string[], isFinished: boolean) => {
  const scores: Record<string, number> = {};
  if (isFinished) {
    players.forEach((pid) => {
      scores[pid] = Math.floor(Math.random() * 50) + 10;
    });
  }
  return scores;
};

// --- 1. MOCK FASE DE GRUPOS ---
let groupsTotalScores: Record<string, number> = {};

const numPlayers = mockPlayers.length;
const dynamicNumGroups = Math.max(1, Math.floor(numPlayers / 4));
tournamentConfig.phases.groups.numGroups = dynamicNumGroups;

for (let r = 1; r <= tournamentConfig.phases.groups.totalRounds; r++) {
  const shuffledPlayers = [...mockPlayers].sort(() => 0.5 - Math.random());

  // Distribuir dinámicamente los jugadores en `dynamicNumGroups` grupos
  const groupPartitions: string[][] = Array.from(
    { length: dynamicNumGroups },
    () => [],
  );
  shuffledPlayers.forEach((p, idx) => {
    groupPartitions[idx % dynamicNumGroups].push(p.id);
  });

  for (let g = 0; g < dynamicNumGroups; g++) {
    const groupPlayers = groupPartitions[g];

    const isFinished = true; // Make groups completely finished for this mock
    const scores = generateScores(groupPlayers, isFinished);

    Object.keys(scores).forEach((pid) => {
      groupsTotalScores[pid] = (groupsTotalScores[pid] || 0) + scores[pid];
    });

    const groupLetter = String.fromCharCode(65 + g); // A, B, C, D...

    mockGroupRounds.push({
      id: `groups-r${r}-g${g}`,
      phase: "groups",
      roundNumber: r,
      groupName: `Grupo ${groupLetter}`,
      players: groupPlayers,
      scores,
      isFinished,
    });
  }
}

// --- 2. MOCK SEMIFINAL ---
// Get top 8 from groups phase
const top8 = Object.entries(groupsTotalScores)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map((entry) => entry[0]);

let semiTotalScores: Record<string, number> = {};

for (let r = 1; r <= tournamentConfig.phases.semifinal.totalRounds; r++) {
  const shuffledTop8 = [...top8].sort(() => 0.5 - Math.random());

  for (let g = 0; g < tournamentConfig.phases.semifinal.numGroups; g++) {
    const groupPlayers = shuffledTop8.slice(
      g * tournamentConfig.phases.semifinal.playersPerGroup,
      (g + 1) * tournamentConfig.phases.semifinal.playersPerGroup,
    );

    // Let's make round 1 & 2 finished, round 3 pending
    const isFinished = r < 3;
    const scores = generateScores(groupPlayers, isFinished);

    if (isFinished) {
      Object.keys(scores).forEach((pid) => {
        semiTotalScores[pid] = (semiTotalScores[pid] || 0) + scores[pid];
      });
    }

    mockGroupRounds.push({
      id: `semi-r${r}-g${g}`,
      phase: "semifinal",
      roundNumber: r,
      groupName: groupNamesSemi[g],
      players: groupPlayers,
      scores,
      isFinished,
    });
  }
}

// --- 3. MOCK FINAL ---
// Get top 4 from semifinal phase
const top4 = Object.entries(semiTotalScores)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4)
  .map((entry) => entry[0]);

mockGroupRounds.push({
  id: `final-r1-g0`,
  phase: "final",
  roundNumber: 1,
  groupName: groupNamesFinal[0],
  players: top4,
  scores: {}, // Not played yet
  isFinished: false,
});
