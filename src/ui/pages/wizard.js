import { state } from "../../app/state.js";
import { recommendedRounds, totalMatchesFor } from "../../domain/fixtures.js";
import { swissConfigFor } from "../../domain/swiss.js";
import { escapeHtml } from "../../utils/html.js";

export function renderWizard(){
  const wizard = state.wizard;
  let inner;
  if(wizard.step === 1) inner = wizardStepName(wizard);
  else if(wizard.step === 2) inner = wizardStepPlayers(wizard);
  else inner = wizardStepSettings(wizard);
  return `
    <div class="modal-overlay" id="wizard-overlay">
      <div class="modal-panel">${inner}</div>
    </div>
  `;
}

function wizardStepName(wizard){
  const label = wizard.type === "tournament" ? "Nuevo torneo" : "Nueva liga";
  const placeholder = wizard.type === "tournament" ? "Ej. Torneo de Verano" : "Ej. Liga de Verano";
  return `
    <div class="wizard-header"><h3>${label}</h3><span class="wizard-progress">Paso 1 de 3</span></div>
    <form id="wizard-step1">
      <div class="field">
        <label for="wizard-name">Nombre</label>
        <input type="text" id="wizard-name" value="${escapeHtml(wizard.name)}" placeholder="${placeholder}" autofocus>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="wizard-cancel">Cancelar</button>
        <button type="submit" class="btn btn-accent">Continuar</button>
      </div>
    </form>
  `;
}

function wizardStepPlayers(wizard){
  const chips = wizard.players.map(player => `
    <div class="player-chip">
      ${escapeHtml(player.name)}
      <button type="button" class="remove-wizard-player" data-id="${player.id}" title="Quitar">&times;</button>
    </div>
  `).join("") || `<span class="hint">Añade jugadores para empezar.</span>`;

  return `
    <div class="wizard-header"><h3>${escapeHtml(wizard.name)}</h3><span class="wizard-progress">Paso 2 de 3</span></div>
    <form id="wizard-add-player" class="form-row">
      <div class="field">
        <label for="wizard-player-name">Jugador</label>
        <input type="text" id="wizard-player-name" placeholder="Nombre del jugador" autofocus>
      </div>
      <button class="btn btn-accent" type="submit">Añadir</button>
    </form>
    <div class="player-list">${chips}</div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="wizard-back">Atrás</button>
      <button type="button" class="btn btn-accent" id="wizard-next-2">Continuar</button>
    </div>
  `;
}

function wizardStepSettings(wizard){
  if(wizard.type === "tournament") return wizardStepTournamentSettings(wizard);
  return wizardStepLeagueSettings(wizard);
}

function wizardStepLeagueSettings(wizard){
  const n = wizard.players.length;
  const total = totalMatchesFor(n);
  const rec = recommendedRounds(n);
  const avg = (total / rec).toFixed(1);
  return `
    <div class="wizard-header"><h3>${escapeHtml(wizard.name)}</h3><span class="wizard-progress">Paso 3 de 3</span></div>
    <p class="hint">Con ${n} jugadores, cada uno se enfrenta a todos los demás una vez: <strong>${total} partidos</strong> en total.</p>
    <div class="field">
      <label for="wizard-rounds">Número de jornadas</label>
      <input type="number" id="wizard-rounds" min="1" max="${total}" value="${wizard.numRounds ?? rec}">
    </div>
    <p class="hint">Recomendado: <strong>${rec} jornadas</strong> (~${avg} partidos por jornada, sin repetir jugador en la misma jornada).</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="wizard-back2">Atrás</button>
      <button type="button" class="btn btn-accent" id="wizard-generate">Generar calendario</button>
    </div>
  `;
}

function wizardStepTournamentSettings(wizard){
  const n = wizard.players.length;
  const cfg = swissConfigFor(n);
  const playoffsChecked = wizard.playoffsEnabled !== false;
  return `
    <div class="wizard-header"><h3>${escapeHtml(wizard.name)}</h3><span class="wizard-progress">Paso 3 de 3</span></div>
    <p class="hint">Con ${n} jugadores, el torneo usará el sistema suizo con <strong>${cfg.rounds} rondas</strong>.</p>
    ${n % 2 !== 0 ? `<p class="hint">Como el número de jugadores es impar, cada ronda habrá un Bye (3 pts) para un jugador distinto.</p>` : ""}
    <div class="field">
      <label>Formato</label>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="wizard-playoffs" value="on" ${playoffsChecked ? "checked" : ""}>
          Suiza + Playoffs (Top ${cfg.playoffSize})
        </label>
        <label class="radio-option">
          <input type="radio" name="wizard-playoffs" value="off" ${!playoffsChecked ? "checked" : ""}>
          Solo fase suiza (sin playoffs)
        </label>
      </div>
    </div>
    <p class="hint">Sin playoffs, al terminar la última ronda suiza podrás finalizar el torneo directamente.</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="wizard-back2">Atrás</button>
      <button type="button" class="btn btn-accent" id="wizard-generate">Crear torneo</button>
    </div>
  `;
}
