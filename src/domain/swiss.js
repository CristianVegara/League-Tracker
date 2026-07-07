import { uid } from "../utils/ids.js";
import { isPlayed } from "./matches.js";

export function swissConfigFor(n){
  let rounds;
  let playoffSize;
  if(n <= 8){
    rounds = 3;
    playoffSize = 4;
  } else if(n <= 16){
    rounds = 4;
    playoffSize = 4;
  } else if(n <= 32){
    rounds = 5;
    playoffSize = 8;
  } else if(n <= 64){
    rounds = 6;
    playoffSize = 8;
  } else if(n <= 128){
    rounds = 7;
    playoffSize = 8;
  } else {
    rounds = 8;
    playoffSize = 8;
  }
  while(playoffSize > n) playoffSize = playoffSize / 2;
  if(playoffSize < 2) playoffSize = Math.min(2, n);
  return { rounds, playoffSize };
}

export function pairKey(a, b){
  return [a, b].sort().join("__");
}

export function generateSwissRound1(players){
  const ids = players.map(player => player.id);
  for(let i = ids.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  let byePlayerId = null;
  if(ids.length % 2 !== 0) byePlayerId = ids.pop();

  const matches = [];
  for(let i = 0; i < ids.length; i += 2){
    matches.push({ id: uid(), round: 1, playerAId: ids[i], playerBId: ids[i + 1], isBye: false, mapsA: null, mapsB: null });
  }
  if(byePlayerId){
    matches.push({ id: uid(), round: 1, playerAId: byePlayerId, playerBId: null, isBye: true, mapsA: null, mapsB: null });
  }
  return matches;
}

export function computeSwissStandings(tournament){
  const stats = {};
  tournament.players.forEach(player => {
    stats[player.id] = {
      player,
      Pts: 0,
      PJ: 0,
      W: 0,
      D: 0,
      L: 0,
      gamesWon: 0,
      gamesPlayed: 0,
      opponents: [],
      hasHadBye: false
    };
  });

  tournament.matches.forEach(match => {
    if(match.isBye){
      const row = stats[match.playerAId];
      if(row){
        row.Pts += 3;
        row.PJ += 1;
        row.W += 1;
        row.hasHadBye = true;
      }
      return;
    }
    if(!isPlayed(match)) return;
    const a = stats[match.playerAId];
    const b = stats[match.playerBId];
    if(!a || !b) return;

    a.PJ++;
    b.PJ++;
    a.gamesWon += match.mapsA;
    a.gamesPlayed += match.mapsA + match.mapsB;
    b.gamesWon += match.mapsB;
    b.gamesPlayed += match.mapsA + match.mapsB;
    a.opponents.push(match.playerBId);
    b.opponents.push(match.playerAId);

    if(match.mapsA > match.mapsB){
      a.W++;
      a.Pts += 3;
      b.L++;
    } else if(match.mapsA < match.mapsB){
      b.W++;
      b.Pts += 3;
      a.L++;
    } else {
      a.D++;
      b.D++;
      a.Pts += 1;
      b.Pts += 1;
    }
  });

  function matchWinPct(id){
    const row = stats[id];
    if(!row || row.PJ === 0) return 0;
    return row.W / row.PJ;
  }

  Object.values(stats).forEach(row => {
    if(row.opponents.length === 0){
      row.OMW = 0;
    } else {
      const pcts = row.opponents.map(id => Math.max(matchWinPct(id), 1 / 3));
      row.OMW = pcts.reduce((sum, value) => sum + value, 0) / pcts.length;
    }
    row.GW = row.gamesPlayed > 0 ? row.gamesWon / row.gamesPlayed : 0;
  });

  const rows = Object.values(stats);
  rows.sort((x, y) => y.Pts - x.Pts || y.OMW - x.OMW || y.GW - x.GW || x.player.name.localeCompare(y.player.name));
  return rows;
}

export function solveRoundPairing(order, playedSet, hasHadByeMap){
  const n = order.length;
  const used = new Array(n).fill(false);
  const pairs = [];

  function tryMatch(startIdx){
    let i = startIdx;
    while(i < n && used[i]) i++;
    if(i === n) return true;
    used[i] = true;
    for(let j = i + 1; j < n; j++){
      if(used[j]) continue;
      if(playedSet.has(pairKey(order[i], order[j]))) continue;
      used[j] = true;
      pairs.push([i, j]);
      if(tryMatch(i + 1)) return true;
      pairs.pop();
      used[j] = false;
    }
    used[i] = false;
    return false;
  }

  if(n % 2 === 0){
    if(tryMatch(0)) return { pairs, byeIdx: -1 };
    return null;
  }

  for(let i = n - 1; i >= 0; i--){
    if(hasHadByeMap[order[i]]) continue;
    used[i] = true;
    if(tryMatch(0)) return { pairs, byeIdx: i };
    used[i] = false;
  }

  used[n - 1] = true;
  if(tryMatch(0)) return { pairs, byeIdx: n - 1 };
  return null;
}

export function generateNextSwissRound(tournament){
  const roundNum = tournament.currentRound + 1;
  const standings = computeSwissStandings(tournament);
  const order = standings.map(row => row.player.id);
  const hasHadByeMap = {};
  standings.forEach(row => {
    hasHadByeMap[row.player.id] = row.hasHadBye;
  });

  const playedSet = new Set();
  tournament.matches.forEach(match => {
    if(!match.isBye) playedSet.add(pairKey(match.playerAId, match.playerBId));
  });

  const solution = solveRoundPairing(order, playedSet, hasHadByeMap);
  if(!solution) return false;

  const newMatches = solution.pairs.map(([i, j]) => ({
    id: uid(),
    round: roundNum,
    playerAId: order[i],
    playerBId: order[j],
    isBye: false,
    mapsA: null,
    mapsB: null
  }));

  if(solution.byeIdx !== -1){
    newMatches.push({ id: uid(), round: roundNum, playerAId: order[solution.byeIdx], playerBId: null, isBye: true, mapsA: null, mapsB: null });
  }

  tournament.matches.push(...newMatches);
  tournament.currentRound = roundNum;
  return true;
}
