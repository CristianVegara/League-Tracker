import { CURRENT_SCHEMA_VERSION, emptyData } from "./schema.js";

export function migrateData(rawData){
  if(!rawData || typeof rawData !== "object") return emptyData();

  if(Array.isArray(rawData.competitions)){
    return {
      version: rawData.version || CURRENT_SCHEMA_VERSION,
      competitions: rawData.competitions,
      activeCompetitionId: rawData.activeCompetitionId || rawData.activeLeagueId || null
    };
  }

  if(Array.isArray(rawData.leagues)){
    return {
      version: CURRENT_SCHEMA_VERSION,
      competitions: rawData.leagues,
      activeCompetitionId: rawData.activeLeagueId || null
    };
  }

  return emptyData();
}

export function exportCompetitionPayload(competition){
  return { version: CURRENT_SCHEMA_VERSION, competitions: [competition] };
}

export function readCompetitionImportPayload(payload){
  if(Array.isArray(payload?.competitions)) return payload.competitions;
  if(Array.isArray(payload?.leagues)) return payload.leagues;
  if(payload?.id) return [payload];
  return null;
}
