import { LEGACY_STORAGE_KEY, STORAGE_KEY, emptyData } from "./schema.js";
import { migrateData } from "./migrations.js";

function readJson(key){
  const raw = localStorage.getItem(key);
  if(!raw) return null;
  return JSON.parse(raw);
}

export function loadData(){
  try{
    const current = readJson(STORAGE_KEY);
    if(current) return migrateData(current);

    const legacy = readJson(LEGACY_STORAGE_KEY);
    if(legacy) return migrateData(legacy);

    return emptyData();
  }catch(error){
    console.error("No se pudo leer el almacenamiento local", error);
    return emptyData();
  }
}

export function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
