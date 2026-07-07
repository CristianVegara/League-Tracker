import { loadData, saveData as persistData } from "../data/storage.js";

export const state = {
  data: loadData(),
  activeTab: "jugadores",
  wizard: null,
  manualFormOpen: false,
  homeFilters: { league: "all", tournament: "all" }
};

export function getActiveCompetition(){
  return state.data.competitions.find(item => item.id === state.data.activeCompetitionId) || null;
}

export function saveData(){
  try{
    persistData(state.data);
  }catch(error){
    window.dispatchEvent(new CustomEvent("app:toast", { detail: "No se pudo guardar (almacenamiento lleno o bloqueado)" }));
    console.error(error);
  }
}

export function navigateHome(){
  state.data.activeCompetitionId = null;
  saveData();
}

export function openCompetition(id){
  state.data.activeCompetitionId = id;
  state.activeTab = "jugadores";
  saveData();
}
