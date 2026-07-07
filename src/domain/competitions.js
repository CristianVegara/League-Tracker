export const COMPETITION_TYPES = {
  LEAGUE: "league",
  TOURNAMENT: "tournament"
};

export function isFinished(competition){
  return competition.status === "finished";
}

export function isTournament(competition){
  return competition.type === COMPETITION_TYPES.TOURNAMENT;
}

export function playoffsOn(tournament){
  return tournament.playoffsEnabled !== false;
}

export function playerName(competition, id){
  const player = competition.players.find(p => p.id === id);
  return player ? player.name : "?";
}
