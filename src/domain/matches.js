import { escapeHtml } from "../utils/html.js";
import { playerName } from "./competitions.js";

export function isPlayed(match){
  if(match.isBye) return true;
  return match.mapsA !== null && match.mapsA !== undefined && match.mapsB !== null && match.mapsB !== undefined;
}

export function matchWinnerId(match){
  if(match.mapsA === null || match.mapsA === undefined || match.mapsB === null || match.mapsB === undefined) return null;
  if(match.mapsA > match.mapsB) return match.playerAId;
  if(match.mapsB > match.mapsA) return match.playerBId;
  return null;
}

export function matchResultBadge(match, competition){
  if(match.mapsA > match.mapsB) return `<span class="badge vl">${escapeHtml(playerName(competition, match.playerAId))} gana</span>`;
  if(match.mapsA < match.mapsB) return `<span class="badge vv">${escapeHtml(playerName(competition, match.playerBId))} gana</span>`;
  return `<span class="badge e">Empate</span>`;
}
