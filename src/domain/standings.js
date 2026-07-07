import { isPlayed } from "./matches.js";

export function computeStandings(league){
  const stats = {};
  league.players.forEach(player => {
    stats[player.id] = { player, PJ: 0, G: 0, E: 0, P: 0, MF: 0, MC: 0, DM: 0, Pts: 0 };
  });

  league.matches.forEach(match => {
    if(!isPlayed(match)) return;
    const a = stats[match.playerAId];
    const b = stats[match.playerBId];
    if(!a || !b) return;

    a.PJ++;
    b.PJ++;
    a.MF += match.mapsA;
    a.MC += match.mapsB;
    b.MF += match.mapsB;
    b.MC += match.mapsA;

    if(match.mapsA > match.mapsB){
      a.G++;
      b.P++;
      a.Pts += 3;
    } else if(match.mapsA < match.mapsB){
      b.G++;
      a.P++;
      b.Pts += 3;
    } else {
      a.E++;
      b.E++;
      a.Pts += 1;
      b.Pts += 1;
    }
  });

  const rows = Object.values(stats).map(row => ({ ...row, DM: row.MF - row.MC }));
  rows.sort((x, y) => y.Pts - x.Pts || y.DM - x.DM || y.MF - x.MF || x.player.name.localeCompare(y.player.name));
  return rows;
}
