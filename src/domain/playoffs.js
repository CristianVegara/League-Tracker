import { uid } from "../utils/ids.js";
import { playerName, playoffsOn } from "./competitions.js";
import { matchWinnerId, isPlayed } from "./matches.js";
import { computeSwissStandings } from "./swiss.js";

export function generatePlayoffBracket(tournament){
  const standings = computeSwissStandings(tournament);
  const size = tournament.playoffSize;
  const seeds = standings.slice(0, size).map(row => row.player.id);
  let firstRoundPairs;

  if(size === 4) firstRoundPairs = [[0, 3], [1, 2]];
  else if(size === 8) firstRoundPairs = [[0, 7], [3, 4], [1, 6], [2, 5]];
  else {
    firstRoundPairs = [];
    for(let i = 0; i < size / 2; i++) firstRoundPairs.push([i, size - 1 - i]);
  }

  const firstRound = firstRoundPairs.map(([ia, ib]) => ({
    id: uid(),
    playerAId: seeds[ia],
    playerBId: seeds[ib],
    mapsA: null,
    mapsB: null,
    sourceAId: null,
    sourceBId: null
  }));

  const rounds = [firstRound];
  let previous = firstRound;
  while(previous.length > 1){
    const next = [];
    for(let i = 0; i < previous.length; i += 2){
      next.push({
        id: uid(),
        playerAId: null,
        playerBId: null,
        mapsA: null,
        mapsB: null,
        sourceAId: previous[i].id,
        sourceBId: previous[i + 1].id
      });
    }
    rounds.push(next);
    previous = next;
  }

  tournament.playoffs = { size, rounds };
}

export function findPlayoffMatch(tournament, id){
  for(const round of tournament.playoffs.rounds){
    const match = round.find(item => item.id === id);
    if(match) return match;
  }
  return null;
}

export function propagatePlayoffResults(tournament){
  const rounds = tournament.playoffs.rounds;
  for(let r = 1; r < rounds.length; r++){
    rounds[r].forEach(match => {
      if(match.sourceAId){
        const source = findPlayoffMatch(tournament, match.sourceAId);
        match.playerAId = (source && matchWinnerId(source)) || null;
      }
      if(match.sourceBId){
        const source = findPlayoffMatch(tournament, match.sourceBId);
        match.playerBId = (source && matchWinnerId(source)) || null;
      }
    });
  }
}

export function tournamentChampion(tournament){
  if(!playoffsOn(tournament)){
    if(tournament.status !== "finished") return null;
    const standings = computeSwissStandings(tournament);
    return standings.length ? standings[0].player.name : null;
  }
  if(!tournament.playoffs) return null;
  const rounds = tournament.playoffs.rounds;
  const finalRound = rounds[rounds.length - 1];
  if(!finalRound || finalRound.length !== 1) return null;
  const match = finalRound[0];
  if(!isPlayed(match)) return null;
  const winnerId = matchWinnerId(match);
  if(!winnerId) return null;
  return playerName(tournament, winnerId);
}

export function roundLabel(idx, totalRounds){
  const fromEnd = totalRounds - idx;
  if(fromEnd === 1) return "Final";
  if(fromEnd === 2) return "Semifinal";
  if(fromEnd === 3) return "Cuartos de final";
  return `Ronda ${idx + 1}`;
}
