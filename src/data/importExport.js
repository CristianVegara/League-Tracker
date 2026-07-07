import { uid } from "../utils/ids.js";
import { exportCompetitionPayload, readCompetitionImportPayload } from "./migrations.js";

export function exportCompetition(competition){
  const blob = new Blob([JSON.stringify(exportCompetitionPayload(competition), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${competition.name.replace(/[^a-z0-9]+/gi, "_")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importCompetitionsFromFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const incoming = readCompetitionImportPayload(parsed);
        if(!incoming) throw new Error("Formato no reconocido");
        incoming.forEach(competition => {
          competition.id = uid();
        });
        resolve(incoming);
      }catch(error){
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
