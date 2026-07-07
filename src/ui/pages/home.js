import { state } from "../../app/state.js";
import { isFinished } from "../../domain/competitions.js";
import { isPlayed } from "../../domain/matches.js";
import { tournamentChampion } from "../../domain/playoffs.js";
import { escapeHtml } from "../../utils/html.js";
import { formatDate } from "../../utils/dates.js";
import { statusBadge } from "../components/common.js";

function renderCompetitionCard(competition){
  const isTournament = competition.type === "tournament";
  let progress;
  if(isTournament){
    const champ = tournamentChampion(competition);
    if(champ) progress = `Campeón: ${escapeHtml(champ)}`;
    else if(competition.playoffs) progress = "Playoffs en curso";
    else progress = `Ronda ${competition.currentRound}/${competition.swissRounds}`;
  } else {
    const played = competition.matches.filter(isPlayed).length;
    progress = `${played}/${competition.matches.length} partidos jugados`;
  }

  const created = formatDate(competition.createdAt);
  return `
    <article class="league-card" data-id="${competition.id}">
      <div class="card-kicker">${isTournament ? "Torneo" : "Liga"}</div>
      <div class="name">${escapeHtml(competition.name)}</div>
      <div class="card-badges">${statusBadge(competition)}</div>
      <div class="meta">${competition.players.length} jugadores &middot; ${progress}</div>
      ${created ? `<div class="meta">Creada el ${created}</div>` : ""}
      <div class="row">
        <button class="btn btn-accent open-league" data-id="${competition.id}">Abrir</button>
        <button class="btn btn-ghost btn-sm delete-league" data-id="${competition.id}" title="Eliminar">Eliminar</button>
      </div>
    </article>
  `;
}

function renderCompetitionSection(title, type, items, filter, newBtnId, newBtnLabel){
  const filtered = items.filter(competition => {
    if(filter === "active") return !isFinished(competition);
    if(filter === "finished") return isFinished(competition);
    return true;
  });
  const emptyLabel = filter === "active" ? "activas" : filter === "finished" ? "finalizadas" : "";
  const cards = filtered.map(renderCompetitionCard).join("")
    || `<div class="empty-state" style="grid-column:1/-1;"><div class="big">${title}</div>No hay ${title.toLowerCase()} ${emptyLabel} todavía.</div>`;

  return `
    <section class="comp-section">
      <div class="section-header">
        <h2>${title}</h2>
        <div class="section-header-actions">
          <div class="filter-pills" data-section="${type}">
            <button class="filter-pill ${filter === "all" ? "active" : ""}" data-filter="all">Todas</button>
            <button class="filter-pill ${filter === "active" ? "active" : ""}" data-filter="active">Activas</button>
            <button class="filter-pill ${filter === "finished" ? "active" : ""}" data-filter="finished">Finalizadas</button>
          </div>
          <button class="btn btn-accent btn-sm" id="${newBtnId}">${newBtnLabel}</button>
        </div>
      </div>
      <div class="league-grid">${cards}</div>
    </section>
  `;
}

export function renderHome(){
  const all = state.data.competitions;
  const leagues = all.filter(competition => competition.type !== "tournament");
  const tournaments = all.filter(competition => competition.type === "tournament");

  return `
    <header class="app-header">
      <div>
        <h1>Liga<span>Tracker</span></h1>
        <p>Gestiona ligas y torneos sin perder el ritmo entre jornadas.</p>
      </div>
      <div class="sub">${all.length} competición${all.length === 1 ? "" : "es"} guardada${all.length === 1 ? "" : "s"}</div>
    </header>
    ${renderCompetitionSection("Ligas", "league", leagues, state.homeFilters.league, "new-league-btn", "+ Nueva liga")}
    ${renderCompetitionSection("Torneos", "tournament", tournaments, state.homeFilters.tournament, "new-tournament-btn", "+ Nuevo torneo")}
    <div class="toolbar">
      <button class="btn btn-sm" id="import-btn">Importar JSON</button>
      <input type="file" id="import-file" accept="application/json">
    </div>
  `;
}
