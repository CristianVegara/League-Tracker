export const STORAGE_KEY = "liga-tracker-data-v2";
export const LEGACY_STORAGE_KEY = "liga-tracker-data-v1";
export const CURRENT_SCHEMA_VERSION = 1;

export function emptyData(){
  return {
    version: CURRENT_SCHEMA_VERSION,
    competitions: [],
    activeCompetitionId: null
  };
}
