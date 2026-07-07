import { state } from "../../app/state.js";
import { isFinished, playerName } from "../../domain/competitions.js";
import { generateFixtures, recommendedRounds, totalMatchesFor } from "../../domain/fixtures.js";
import { isPlayed, matchResultBadge } from "../../domain/matches.js";
import { computeStandings } from "../../domain/standings.js";
import { escapeHtml } from "../../utils/html.js";
import { pageTopbar, positionBadge, tabs } from "../components/common.js";

export function renderLeague(league){
  const finished = isFinished(league);
  const finishHtml = !finished ? `<button class="btn btn-sm danger-soft" id="finish-btn">Finalizar liga</button>` : "";
  const tabItems = [
    { id: "jugadores", label: "Jugadores" },
    { id: "partidos", label: "Partidos" },
    { id: "clasificacion", label: "Clasificación" }
  ];

  return `
    ${pageTopbar(league, "", finishHtml)}
    ${tabs(tabItems, state.activeTab)}
    <div id="tab-content">
      ${state.activeTab === "jugadores" ? renderPlayersTab(league) : ""}
      ${state.activeTab === "partidos" ? renderMatchesTab(league) : ""}
      ${state.activeTab === "clasificacion" ? renderStandingsTab(league) : ""}
    </div>
  `;
}

function renderPlayersTab(league){
  const finished = isFinished(league);
  const chips = league.players.map(player => `
    <div class="player-chip">
      ${escapeHtml(player.name)}
      ${finished ? "" : `<button class="remove-player" data-id="${player.id}" title="Eliminar jugador">&times;</button>`}
    </div>
  `).join("") || `<span class="hint">Todavía no hay jugadores.</span>`;

  if(finished){
    return `<div class="panel"><h3>Jugadores</h3><div class="player-list">${chips}</div></div>`;
  }

  return `
    <div class="panel">
      <h3>Añadir jugador</h3>
      <form id="add-player-form" class="form-row">
        <div class="field">
          <label for="player-name">Nombre</label>
          <input type="text" id="player-name" placeholder="Nombre del jugador" required>
        </div>
        <button class="btn btn-accent" type="submit">Añadir</button>
      </form>
      <div class="player-list">${chips}</div>
    </div>
  `;
}

export function renderMatchRow(match, league, readOnly){
  const played = isPlayed(match);
  if(readOnly){
    return `
      <div class="match-row">
        <div class="pname">${escapeHtml(playerName(league, match.playerAId))}</div>
        <div class="score-display">${played ? match.mapsA : "-"}</div>
        <div class="dash">&ndash;</div>
        <div class="score-display">${played ? match.mapsB : "-"}</div>
        <div class="pname away">${escapeHtml(playerName(league, match.playerBId))}</div>
        ${played ? matchResultBadge(match, league) : `<span class="badge pending">Pendiente</span>`}
        <div class="match-actions"></div>
      </div>
    `;
  }

  return `
    <form class="match-row" data-id="${match.id}">
      <div class="pname">${escapeHtml(playerName(league, match.playerAId))}</div>
      <input type="number" class="score-input" name="mapsA" min="0" placeholder="-" value="${played ? match.mapsA : ""}">
      <div class="dash">&ndash;</div>
      <input type="number" class="score-input" name="mapsB" min="0" placeholder="-" value="${played ? match.mapsB : ""}">
      <div class="pname away">${escapeHtml(playerName(league, match.playerBId))}</div>
      ${played ? matchResultBadge(match, league) : `<span class="badge pending">Pendiente</span>`}
      <div class="match-actions">
        <button type="submit" class="btn btn-accent btn-sm">${played ? "Actualizar" : "Guardar"}</button>
        <button type="button" class="btn btn-ghost btn-sm delete-match" data-id="${match.id}">Eliminar</button>
      </div>
    </form>
  `;
}

function renderMatchesTab(league){
  if(league.players.length < 2){
    return `<div class="empty-state"><div class="big">Añade al menos 2 jugadores</div>Ve a la pestaña Jugadores para empezar.</div>`;
  }

  const finished = isFinished(league);
  const options = league.players.map(player => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("");
  const maxJornada = league.matches.reduce((max, match) => Math.max(max, match.jornada || 1), 0);
  const playedCount = league.matches.filter(isPlayed).length;
  const groups = {};
  league.matches.forEach(match => {
    (groups[match.jornada] = groups[match.jornada] || []).push(match);
  });
  const jornadaKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const matchesHtml = jornadaKeys.map(jornada => `
    <div class="jornada-group">
      <div class="jornada-label">Jornada ${jornada}</div>
      ${groups[jornada].map(match => renderMatchRow(match, league, finished)).join("")}
    </div>
  `).join("") || `<div class="hint">Todavía no hay partidos programados. Usa "Regenerar calendario" o añade partidos manualmente.</div>`;

  return `
    <div class="panel">
      <div class="matches-toolbar">
        <h3>Calendario</h3>
        <div class="matches-toolbar-actions">
          <span class="hint">${playedCount}/${league.matches.length} jugados</span>
          ${finished ? "" : `
            <button class="btn btn-sm" id="regen-schedule-btn">Regenerar calendario</button>
            <button class="btn btn-sm" id="toggle-manual-form">${state.manualFormOpen ? "Ocultar formulario" : "+ Partido manual"}</button>
          `}
        </div>
      </div>
      ${(!finished && state.manualFormOpen) ? `
        <form id="add-match-form" class="form-row compact-form">
          <div class="field">
            <label for="m-jornada">Jornada</label>
            <input type="number" id="m-jornada" min="1" value="${maxJornada + 1 || 1}" required>
          </div>
          <div class="field">
            <label for="m-playerA">Jugador local</label>
            <select id="m-playerA" required>${options}</select>
          </div>
          <div class="field score-field">
            <label for="m-mapsA">Mapas</label>
            <input type="number" id="m-mapsA" min="0" value="0" required>
          </div>
          <div class="field score-field">
            <label for="m-mapsB">Mapas</label>
            <input type="number" id="m-mapsB" min="0" value="0" required>
          </div>
          <div class="field">
            <label for="m-playerB">Jugador visitante</label>
            <select id="m-playerB" required>${options}</select>
          </div>
          <button class="btn btn-accent" type="submit">Añadir partido</button>
        </form>
      ` : ""}
    </div>
    <div class="panel">${matchesHtml}</div>
  `;
}

function renderStandingsTab(league){
  if(league.players.length === 0){
    return `<div class="empty-state"><div class="big">Sin jugadores todavía</div>La clasificación aparecerá aquí cuando añadas jugadores y partidos.</div>`;
  }

  const body = computeStandings(league).map((row, index) => `
    <tr>
      <td>${positionBadge(index + 1)}</td>
      <td>${escapeHtml(row.player.name)}</td>
      <td>${row.PJ}</td>
      <td>${row.G}</td>
      <td>${row.E}</td>
      <td>${row.P}</td>
      <td>${row.MF}</td>
      <td>${row.MC}</td>
      <td>${row.DM > 0 ? `+${row.DM}` : row.DM}</td>
      <td>${row.Pts}</td>
    </tr>
  `).join("");

  return `
    <div class="panel table-panel">
      <table class="standings">
        <thead>
          <tr>
            <th>Pos</th><th>Jugador</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
            <th>MF</th><th>MC</th><th>DM</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <div class="hint">Desempate: Puntos &rarr; Diferencia de mapas (DM) &rarr; Mapas a favor (MF)</div>
    </div>
  `;
}

export function regenerateLeagueSchedule(league, numRounds){
  const playerIds = league.players.map(player => player.id);
  league.matches = generateFixtures(playerIds, numRounds);
}

export function suggestedLeagueRounds(league){
  const total = totalMatchesFor(league.players.length);
  const rec = recommendedRounds(league.players.length);
  return { total, rec };
}
