import { getActiveCompetition, state } from "./state.js";
import { bindEvents } from "./events.js";
import { isTournament } from "../domain/competitions.js";
import { renderHome } from "../ui/pages/home.js";
import { renderLeague } from "../ui/pages/league.js";
import { renderTournament } from "../ui/pages/tournament.js";
import { renderWizard } from "../ui/pages/wizard.js";

export function render(){
  const app = document.getElementById("app");

  if(state.wizard){
    app.innerHTML = renderWizard();
    bindEvents(render);
    return;
  }

  const competition = getActiveCompetition();
  if(!competition){
    app.innerHTML = renderHome();
  } else if(isTournament(competition)){
    app.innerHTML = renderTournament(competition);
  } else {
    app.innerHTML = renderLeague(competition);
  }

  bindEvents(render);
}
