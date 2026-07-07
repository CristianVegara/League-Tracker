import { exportCompetition, importCompetitionsFromFile } from "../data/importExport.js";
import { COMPETITION_TYPES, isFinished, isTournament } from "../domain/competitions.js";
import { generateFixtures, recommendedRounds, totalMatchesFor } from "../domain/fixtures.js";
import { findPlayoffMatch, generatePlayoffBracket, propagatePlayoffResults } from "../domain/playoffs.js";
import { generateNextSwissRound, generateSwissRound1, swissConfigFor } from "../domain/swiss.js";
import { uid } from "../utils/ids.js";
import { showToast } from "../ui/components/toast.js";
import { getActiveCompetition, navigateHome, openCompetition, saveData, state } from "./state.js";

export function bindEvents(render){
  if(state.wizard){
    bindWizardEvents(render);
    return;
  }

  const competition = getActiveCompetition();
  if(!competition) bindHomeEvents(render);
  else if(isTournament(competition)) bindTournamentEvents(competition, render);
  else bindLeagueEvents(competition, render);
}

function bindHomeEvents(render){
  document.getElementById("new-league-btn").addEventListener("click", () => openWizard(COMPETITION_TYPES.LEAGUE, render));
  document.getElementById("new-tournament-btn").addEventListener("click", () => openWizard(COMPETITION_TYPES.TOURNAMENT, render));

  document.querySelectorAll(".filter-pill").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.closest(".filter-pills").dataset.section;
      state.homeFilters[section] = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll(".open-league").forEach(button => {
    button.addEventListener("click", () => {
      openCompetition(button.dataset.id);
      render();
    });
  });

  document.querySelectorAll(".delete-league").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const competition = state.data.competitions.find(item => item.id === button.dataset.id);
      if(!competition) return;
      if(!confirm(`¿Eliminar "${competition.name}"? Esta acción no se puede deshacer.`)) return;
      state.data.competitions = state.data.competitions.filter(item => item.id !== button.dataset.id);
      saveData();
      render();
    });
  });

  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async event => {
    const file = event.target.files[0];
    if(!file) return;
    try{
      const incoming = await importCompetitionsFromFile(file);
      state.data.competitions.push(...incoming);
      saveData();
      render();
      showToast(`Importada${incoming.length === 1 ? "" : "s"} ${incoming.length} competición${incoming.length === 1 ? "" : "es"}`);
    }catch(error){
      alert("No se pudo importar el archivo: " + error.message);
    }finally{
      event.target.value = "";
    }
  });
}

function openWizard(type, render){
  state.wizard = { step: 1, type, name: "", players: [], numRounds: null };
  render();
}

function bindWizardEvents(render){
  const wizard = state.wizard;
  const overlay = document.getElementById("wizard-overlay");
  overlay.addEventListener("click", event => {
    if(event.target === overlay){
      state.wizard = null;
      render();
    }
  });

  const step1 = document.getElementById("wizard-step1");
  if(step1){
    document.getElementById("wizard-cancel").addEventListener("click", () => {
      state.wizard = null;
      render();
    });
    step1.addEventListener("submit", event => {
      event.preventDefault();
      const value = document.getElementById("wizard-name").value.trim();
      if(!value){
        alert("Ponle un nombre.");
        return;
      }
      wizard.name = value;
      wizard.step = 2;
      render();
    });
  }

  const addPlayerForm = document.getElementById("wizard-add-player");
  if(addPlayerForm){
    addPlayerForm.addEventListener("submit", event => {
      event.preventDefault();
      const input = document.getElementById("wizard-player-name");
      const name = input.value.trim();
      if(!name) return;
      wizard.players.push({ id: uid(), name });
      render();
    });
    document.querySelectorAll(".remove-wizard-player").forEach(button => {
      button.addEventListener("click", () => {
        wizard.players = wizard.players.filter(player => player.id !== button.dataset.id);
        render();
      });
    });
    document.getElementById("wizard-back").addEventListener("click", () => {
      wizard.step = 1;
      render();
    });
    document.getElementById("wizard-next-2").addEventListener("click", () => {
      if(wizard.players.length < 2){
        alert("Añade al menos 2 jugadores.");
        return;
      }
      wizard.step = 3;
      render();
    });
  }

  const genBtn = document.getElementById("wizard-generate");
  if(genBtn){
    document.getElementById("wizard-back2").addEventListener("click", () => {
      wizard.step = 2;
      render();
    });
    genBtn.addEventListener("click", () => generateCompetitionFromWizard(wizard, render));
  }
}

function generateCompetitionFromWizard(wizard, render){
  const n = wizard.players.length;

  if(wizard.type === COMPETITION_TYPES.TOURNAMENT){
    const cfg = swissConfigFor(n);
    const playoffsRadio = document.querySelector('input[name="wizard-playoffs"]:checked');
    const playoffsEnabled = !playoffsRadio || playoffsRadio.value === "on";
    const matches = generateSwissRound1(wizard.players);
    const competition = {
      id: uid(),
      type: "tournament",
      name: wizard.name,
      createdAt: Date.now(),
      status: "active",
      players: wizard.players,
      swissRounds: cfg.rounds,
      playoffSize: cfg.playoffSize,
      playoffsEnabled,
      currentRound: 1,
      matches,
      playoffs: null
    };
    state.data.competitions.push(competition);
    state.data.activeCompetitionId = competition.id;
    state.activeTab = "rondas";
    state.wizard = null;
    saveData();
    render();
    showToast(playoffsEnabled ? `Torneo creado: ${cfg.rounds} rondas suizas + playoffs a ${cfg.playoffSize}` : `Torneo creado: ${cfg.rounds} rondas suizas (sin playoffs)`);
    return;
  }

  const total = totalMatchesFor(n);
  let numRounds = parseInt(document.getElementById("wizard-rounds").value, 10);
  if(!numRounds || numRounds < 1) numRounds = recommendedRounds(n);
  if(numRounds > total) numRounds = total;
  const playerIds = wizard.players.map(player => player.id);
  const matches = generateFixtures(playerIds, numRounds);
  const competition = { id: uid(), type: "league", name: wizard.name, createdAt: Date.now(), status: "active", players: wizard.players, matches };
  state.data.competitions.push(competition);
  state.data.activeCompetitionId = competition.id;
  state.activeTab = "partidos";
  state.wizard = null;
  saveData();
  render();
  showToast(`Liga creada: ${total} partidos en ${numRounds} jornadas`);
}

function bindTopbarEvents(competition, render){
  document.getElementById("back-btn").addEventListener("click", () => {
    navigateHome();
    render();
  });

  const renameBtn = document.getElementById("rename-btn");
  if(renameBtn){
    renameBtn.addEventListener("click", () => {
      const name = prompt("Nuevo nombre:", competition.name);
      if(!name) return;
      competition.name = name.trim();
      saveData();
      render();
    });
  }

  document.getElementById("export-btn").addEventListener("click", () => exportCompetition(competition));

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      render();
    });
  });
}

function bindLeagueEvents(league, render){
  bindTopbarEvents(league, render);

  const finishBtn = document.getElementById("finish-btn");
  if(finishBtn){
    finishBtn.addEventListener("click", () => {
      if(!confirm(`¿Finalizar la liga "${league.name}"? La clasificación actual quedará como definitiva y ya no podrás editar jugadores, partidos ni ajustes. Esta acción no se puede deshacer.`)) return;
      league.status = "finished";
      league.finishedAt = Date.now();
      saveData();
      render();
      showToast("Liga finalizada");
    });
  }

  const addPlayerForm = document.getElementById("add-player-form");
  if(addPlayerForm){
    addPlayerForm.addEventListener("submit", event => {
      event.preventDefault();
      const input = document.getElementById("player-name");
      const name = input.value.trim();
      if(!name) return;
      league.players.push({ id: uid(), name });
      saveData();
      render();
    });
    document.querySelectorAll(".remove-player").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        const usedInMatch = league.matches.some(match => match.playerAId === id || match.playerBId === id);
        if(usedInMatch && !confirm("Este jugador tiene partidos registrados. ¿Eliminarlo y sus partidos asociados?")) return;
        league.players = league.players.filter(player => player.id !== id);
        if(usedInMatch){
          league.matches = league.matches.filter(match => match.playerAId !== id && match.playerBId !== id);
        }
        saveData();
        render();
      });
    });
  }

  const addMatchForm = document.getElementById("add-match-form");
  if(addMatchForm){
    addMatchForm.addEventListener("submit", event => {
      event.preventDefault();
      const jornada = parseInt(document.getElementById("m-jornada").value, 10) || 1;
      const playerAId = document.getElementById("m-playerA").value;
      const playerBId = document.getElementById("m-playerB").value;
      const mapsA = parseInt(document.getElementById("m-mapsA").value, 10) || 0;
      const mapsB = parseInt(document.getElementById("m-mapsB").value, 10) || 0;
      if(playerAId === playerBId){
        alert("El jugador local y el visitante deben ser distintos.");
        return;
      }
      league.matches.push({ id: uid(), jornada, playerAId, mapsA, playerBId, mapsB });
      saveData();
      render();
    });
  }

  const toggleManualBtn = document.getElementById("toggle-manual-form");
  if(toggleManualBtn){
    toggleManualBtn.addEventListener("click", () => {
      state.manualFormOpen = !state.manualFormOpen;
      render();
    });
  }

  const regenBtn = document.getElementById("regen-schedule-btn");
  if(regenBtn){
    regenBtn.addEventListener("click", () => {
      if(league.players.length < 2){
        alert("Necesitas al menos 2 jugadores.");
        return;
      }
      const total = totalMatchesFor(league.players.length);
      const rec = recommendedRounds(league.players.length);
      const input = prompt(`¿En cuántas jornadas quieres repartir los ${total} partidos? (recomendado: ${rec})`, rec);
      if(input === null) return;
      let numRounds = parseInt(input, 10);
      if(!numRounds || numRounds < 1) numRounds = rec;
      if(numRounds > total) numRounds = total;
      if(!confirm("Esto borrará todos los partidos y resultados actuales de esta liga y generará un calendario nuevo. ¿Continuar?")) return;
      const playerIds = league.players.map(player => player.id);
      league.matches = generateFixtures(playerIds, numRounds);
      saveData();
      render();
      showToast("Calendario regenerado");
    });
  }

  document.querySelectorAll(".match-row").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const match = league.matches.find(item => item.id === form.dataset.id);
      if(!match) return;
      const aVal = form.querySelector('[name="mapsA"]').value;
      const bVal = form.querySelector('[name="mapsB"]').value;
      if(aVal === "" || bVal === ""){
        alert("Introduce el resultado de ambos jugadores.");
        return;
      }
      match.mapsA = parseInt(aVal, 10) || 0;
      match.mapsB = parseInt(bVal, 10) || 0;
      saveData();
      render();
    });
  });

  document.querySelectorAll(".delete-match").forEach(button => {
    button.addEventListener("click", () => {
      league.matches = league.matches.filter(match => match.id !== button.dataset.id);
      saveData();
      render();
    });
  });
}

function bindTournamentEvents(tournament, render){
  bindTopbarEvents(tournament, render);

  const finishBtn = document.getElementById("finish-btn");
  if(finishBtn && !finishBtn.disabled){
    finishBtn.addEventListener("click", () => {
      if(!confirm(`¿Finalizar el torneo "${tournament.name}"? La clasificación quedará como definitiva y ya no podrás editar jugadores, resultados ni ajustes. Esta acción no se puede deshacer.`)) return;
      tournament.status = "finished";
      tournament.finishedAt = Date.now();
      saveData();
      render();
      showToast("Torneo finalizado");
    });
  }

  const genNextBtn = document.getElementById("gen-next-round-btn");
  if(genNextBtn){
    genNextBtn.addEventListener("click", () => {
      const generated = generateNextSwissRound(tournament);
      if(!generated){
        showToast("No se pudo generar la ronda sin repetir enfrentamientos.");
        return;
      }
      saveData();
      render();
      showToast(`Ronda ${tournament.currentRound} generada`);
    });
  }

  const genPlayoffsBtn = document.getElementById("gen-playoffs-btn");
  if(genPlayoffsBtn){
    genPlayoffsBtn.addEventListener("click", () => {
      generatePlayoffBracket(tournament);
      saveData();
      render();
      showToast("Playoffs generados");
    });
  }

  document.querySelectorAll(".swiss-match-row").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const match = tournament.matches.find(item => item.id === form.dataset.id);
      if(!match) return;
      const aVal = form.querySelector('[name="mapsA"]').value;
      const bVal = form.querySelector('[name="mapsB"]').value;
      if(aVal === "" || bVal === ""){
        alert("Introduce el resultado de ambos jugadores.");
        return;
      }
      match.mapsA = parseInt(aVal, 10) || 0;
      match.mapsB = parseInt(bVal, 10) || 0;
      saveData();
      render();
    });
  });

  document.querySelectorAll(".playoff-match").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const match = findPlayoffMatch(tournament, form.dataset.id);
      if(!match) return;
      const aInput = form.querySelector('[name="mapsA]');
      const bInput = form.querySelector('[name="mapsB]');
      if(!aInput || !bInput) return;
      const aVal = aInput.value;
      const bVal = bInput.value;
      if(aVal === "" || bVal === ""){
        alert("Introduce el resultado de ambos jugadores.");
        return;
      }
      const mapsA = parseInt(aVal, 10) || 0;
      const mapsB = parseInt(bVal, 10) || 0;
      if(mapsA === mapsB){
        alert("Los playoffs no permiten empates: debe haber un ganador.");
        return;
      }
      match.mapsA = mapsA;
      match.mapsB = mapsB;
      propagatePlayoffResults(tournament);
      saveData();
      render();
    });
  });
}
