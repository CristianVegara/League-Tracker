import { escapeHtml } from "../../utils/html.js";
import { isFinished } from "../../domain/competitions.js";

export function statusBadge(competition){
  const finished = isFinished(competition);
  return `<span class="status-badge ${finished ? "finished" : "active"}">${finished ? "Finalizada" : "Activa"}</span>`;
}

export function pageTopbar(competition, typeLabel, finishHtml){
  const finished = isFinished(competition);
  return `
    <div class="league-topbar">
      <button class="btn btn-sm" id="back-btn">&larr; Competiciones</button>
      <div class="topbar-title">
        <h2>${escapeHtml(competition.name)}</h2>
        <div class="topbar-badges">
          ${typeLabel ? `<span class="type-badge">${typeLabel}</span>` : ""}
          ${statusBadge(competition)}
        </div>
      </div>
      <div class="spacer"></div>
      ${!finished ? `<button class="btn btn-sm" id="rename-btn">Renombrar</button>` : ""}
      <button class="btn btn-sm" id="export-btn">Exportar</button>
      ${finishHtml || ""}
    </div>
  `;
}

export function tabs(items, activeTab){
  return `
    <div class="tabs">
      ${items.map(item => `<button class="tab ${activeTab === item.id ? "active" : ""}" data-tab="${item.id}">${item.label}</button>`).join("")}
    </div>
  `;
}

export function positionBadge(position){
  const posClass = position === 1 ? "pos-1" : position === 2 ? "pos-2" : position === 3 ? "pos-3" : "";
  return posClass ? `<span class="pos-badge ${posClass}">${position}</span>` : position;
}
