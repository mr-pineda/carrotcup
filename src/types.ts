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
      totalRounds: 1,
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
  photo_full_url?: string;
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
  secondaryScores: Record<string, number>; // playerId -> secondary score
  isFinished: boolean;
}
