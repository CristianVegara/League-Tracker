import { state } from "../../app/state.js";
import { isFinished, playerName, playoffsOn } from "../../domain/competitions.js";
import { isPlayed, matchResultBadge, matchWinnerId } from "../../domain/matches.js";
import { roundLabel, tournamentChampion } from "../../domain/playoffs.js";
import { computeSwissStandings } from "../../domain/swiss.js";
import { escapeHtml } from "../../utils/html.js";
import { pageTopbar, positionBadge, tabs } from "../components/common.js";

export function renderTournament(tournament){
  const finished = isFinished(tournament);
  let finishHtml = "";

  if(!finished){
    const onLastRound = tournament.currentRound === tournament.swissRounds;
    const lastRoundComplete = onLastRound && tournament.matches.filter(match => match.round === tournament.currentRound).every(isPlayed);
    const eligible = playoffsOn(tournament)
      ? Boolean(tournament.playoffs && tournamentChampion(tournament))
      : lastRoundComplete;
    const title = playoffsOn(tournament)
      ? "Completa la fase suiza y los playoffs para poder finalizar el torneo."
      : "Completa todas las rondas suizas para poder finalizar el torneo.";
    finishHtml = eligible
      ? `<button class="btn btn-sm danger-soft" id="finish-btn">Finalizar torneo</button>`
      : `<button class="btn btn-sm" id="finish-btn" disabled title="${title}">Finalizar torneo</button>`;
  }

  const tabItems = [
    { id: "jugadores", label: "Jugadores" },
    { id: "rondas", label: "Rondas Suizas" },
    { id: "clasificacion", label: "Clasificación" }
  ];
  if(playoffsOn(tournament)) tabItems.push({ id: "playoffs", label: "Playoffs" });

  return `
    ${pageTopbar(tournament, "Torneo", finishHtml)}
    ${tabs(tabItems, state.activeTab)}
    <div id="tab-content">
      ${state.activeTab === "jugadores" ? renderTournamentPlayersTab(tournament) : ""}
      ${state.activeTab === "rondas" ? renderSwissRoundsTab(tournament) : ""}
      ${state.activeTab === "clasificacion" ? renderSwissStandingsTab(tournament) : ""}
      ${(state.activeTab === "playoffs" && playoffsOn(tournament)) ? renderPlayoffsTab(tournament) : ""}
    </div>
  `;
}

function renderTournamentPlayersTab(tournament){
  const chips = tournament.players.map(player => `<div class="player-chip">${escapeHtml(player.name)}</div>`).join("");
  return `
    <div class="panel">
      <h3>Jugadores inscritos</h3>
      <div class="player-list">${chips}</div>
      <p class="hint">La lista de jugadores queda fija una vez creado el torneo, ya que los emparejamientos suizos dependen de ella.</p>
    </div>
  `;
}

function renderSwissMatchRow(match, tournament, readOnly){
  if(match.isBye){
    return `
      <div class="bye-row">
        <div class="pname">${escapeHtml(playerName(tournament, match.playerAId))}</div>
        <span class="badge bye">BYE &middot; 3 pts</span>
      </div>
    `;
  }

  const played = isPlayed(match);
  if(readOnly){
    return `
      <div class="match-row">
        <div class="pname">${escapeHtml(playerName(tournament, match.playerAId))}</div>
        <div class="score-display">${played ? match.mapsA : "-"}</div>
        <div class="dash">&ndash;</div>
        <div class="score-display">${played ? match.mapsB : "-"}</div>
        <div class="pname away">${escapeHtml(playerName(tournament, match.playerBId))}</div>
        ${played ? matchResultBadge(match, tournament) : `<span class="badge pending">Pendiente</span>`}
        <div class="match-actions"></div>
      </div>
    `;
  }

  return `
    <form class="match-row swiss-match-row" data-id="${match.id}">
      <div class="pname">${escapeHtml(playerName(tournament, match.playerAId))}</div>
      <input type="number" class="score-input" name="mapsA" min="0" placeholder="-" value="${played ? match.mapsA : ""}">
      <div class="dash">&ndash;</div>
      <input type="number" class="score-input" name="mapsB" min="0" placeholder="-" value="${played ? match.mapsB : ""}">
      <div class="pname away">${escapeHtml(playerName(tournament, match.playerBId))}</div>
      ${played ? matchResultBadge(match, tournament) : `<span class="badge pending">Pendiente</span>`}
      <div class="match-actions">
        <button type="submit" class="btn btn-accent btn-sm">${played ? "Actualizar" : "Guardar"}</button>
      </div>
    </form>
  `;
}

function renderSwissRoundsTab(tournament){
  const finished = isFinished(tournament);
  const groups = {};
  tournament.matches.forEach(match => {
    (groups[match.round] = groups[match.round] || []).push(match);
  });
  const roundKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const html = roundKeys.map(round => {
    const complete = groups[round].every(isPlayed);
    return `
      <div class="jornada-group">
        <div class="jornada-label">Ronda ${round} ${complete ? '<span class="badge vl inline-badge">Completa</span>' : ""}</div>
        ${groups[round].map(match => renderSwissMatchRow(match, tournament, finished)).join("")}
      </div>
    `;
  }).join("");

  let actionHtml = "";
  if(!finished){
    const lastRound = roundKeys.length ? Math.max(...roundKeys) : 0;
    const lastComplete = lastRound > 0 && groups[lastRound].every(isPlayed);
    if(lastComplete && lastRound < tournament.swissRounds){
      actionHtml = `<button class="btn btn-accent" id="gen-next-round-btn">Generar Ronda ${lastRound + 1}</button>`;
    } else if(lastComplete && lastRound === tournament.swissRounds){
      if(!playoffsOn(tournament)){
        actionHtml = `<div class="hint">Fase suiza completada. Pulsa "Finalizar torneo" arriba para cerrar el torneo.</div>`;
      } else {
        actionHtml = tournament.playoffs
          ? `<div class="hint">Fase suiza completada. Consulta la pestaña Playoffs.</div>`
          : `<button class="btn btn-accent" id="gen-playoffs-btn">Generar Playoffs</button>`;
      }
    } else if(!lastComplete){
      actionHtml = `<div class="hint">Completa todos los partidos de la ronda ${lastRound} para generar la siguiente.</div>`;
    }
  }

  return `
    <div class="panel">
      <div class="matches-toolbar">
        <h3>Fase suiza &middot; Ronda ${tournament.currentRound} de ${tournament.swissRounds}</h3>
      </div>
      <div class="panel-action">${actionHtml}</div>
    </div>
    <div class="panel">${html}</div>
  `;
}

function renderSwissStandingsTab(tournament){
  if(tournament.players.length === 0){
    return `<div class="empty-state"><div class="big">Sin jugadores todavía</div></div>`;
  }

  const body = computeSwissStandings(tournament).map((row, index) => `
    <tr>
      <td>${positionBadge(index + 1)}</td>
      <td>${escapeHtml(row.player.name)}</td>
      <td>${row.PJ}</td>
      <td>${row.Pts}</td>
      <td>${(row.OMW * 100).toFixed(1)}%</td>
      <td>${(row.GW * 100).toFixed(1)}%</td>
    </tr>
  `).join("");

  return `
    <div class="panel table-panel">
      <table class="standings">
        <thead>
          <tr><th>Pos</th><th>Jugador</th><th>PJ</th><th>Pts</th><th>OMW%</th><th>GW%</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <div class="hint">Desempate: Puntos &rarr; % de victorias de los rivales (OMW%) &rarr; % de partidas ganadas (GW%)</div>
    </div>
  `;
}

function renderPlayoffMatch(match, tournament, readOnly){
  const aName = match.playerAId ? escapeHtml(playerName(tournament, match.playerAId)) : "Por determinar";
  const bName = match.playerBId ? escapeHtml(playerName(tournament, match.playerBId)) : "Por determinar";
  const canPlay = match.playerAId && match.playerBId;
  const winner = canPlay ? matchWinnerId(match) : null;
  const played = canPlay && isPlayed(match);
  const showForm = canPlay && !readOnly;

  return `
    <form class="playoff-match" data-id="${match.id}">
      <div class="po-row">
        <div class="po-player ${winner === match.playerAId ? "winner" : ""}">${aName}</div>
        ${showForm ? `<input type="number" class="score-input" name="mapsA" min="0" placeholder="-" value="${played ? match.mapsA : ""}">` : `<span class="score-input placeholder">${canPlay && played ? match.mapsA : "-"}</span>`}
      </div>
      <div class="po-row">
        <div class="po-player ${winner === match.playerBId ? "winner" : ""}">${bName}</div>
        ${showForm ? `<input type="number" class="score-input" name="mapsB" min="0" placeholder="-" value="${played ? match.mapsB : ""}">` : `<span class="score-input placeholder">${canPlay && played ? match.mapsB : "-"}</span>`}
      </div>
      ${showForm ? `<button type="submit" class="btn btn-accent btn-sm">${played ? "Actualizar" : "Guardar"}</button>` : ""}
    </form>
  `;
}

function renderPlayoffsTab(tournament){
  if(!playoffsOn(tournament)){
    return `<div class="empty-state"><div class="big">Sin playoffs</div>Este torneo solo usa fase suiza.</div>`;
  }
  if(!tournament.playoffs){
    return `<div class="empty-state"><div class="big">Playoffs pendientes</div>Se generarán automáticamente al completar la fase suiza.</div>`;
  }

  const finished = isFinished(tournament);
  const champ = tournamentChampion(tournament);
  const totalRounds = tournament.playoffs.rounds.length;
  const columns = tournament.playoffs.rounds.map((round, idx) => `
    <div class="playoff-round">
      <div class="playoff-round-label">${roundLabel(idx, totalRounds)}</div>
      ${round.map(match => renderPlayoffMatch(match, tournament, finished)).join("")}
    </div>
  `).join("");

  return `
    ${champ ? `<div class="champion-banner">&#127942; Campeón: ${escapeHtml(champ)}</div>` : ""}
    <div class="panel">
      <div class="playoff-bracket">${columns}</div>
    </div>
  `;
}
