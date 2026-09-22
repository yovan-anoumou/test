import { useRef, useState } from "preact/hooks";
import { settings, setTheme, patchSettings } from "../../store";
import { exportBackup, downloadBackup, importBackup, parseBackupFile } from "../../utils/export-import";
import { addUserQuestions } from "../../domain/questionBank";
import { syncCardsWithQuestionBank } from "../../db/seed";

export function SettingsScreen() {
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const questionsInputRef = useRef<HTMLInputElement>(null);
  const s = settings.value;

  async function handleExport() {
    const backup = await exportBackup();
    downloadBackup(backup);
    setMessage("Sauvegarde téléchargée.");
  }

  async function handleImportBackup(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm("Importer cette sauvegarde remplacera toutes tes données actuelles. Continuer ?")) {
      return;
    }
    try {
      const text = await file.text();
      const backup = parseBackupFile(text);
      await importBackup(backup);
      setMessage("Sauvegarde restaurée. Recharge la page pour voir les données à jour.");
    } catch (err) {
      setMessage(`Échec de l'import : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  async function handleImportQuestions(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      if (!Array.isArray(data)) throw new Error("Le fichier doit contenir un tableau JSON.");
      addUserQuestions(data);
      const { added } = await syncCardsWithQuestionBank();
      setMessage(`${data.length} question(s) importée(s), ${added} nouvelle(s) carte(s) créée(s).`);
    } catch (err) {
      setMessage(`Échec de l'import : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    } finally {
      setImporting(false);
      if (questionsInputRef.current) questionsInputRef.current.value = "";
    }
  }

  return (
    <div class="screen stack">
      <h1>Réglages</h1>

      {message && (
        <div class="card">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}

      <div class="card stack">
        <h3>Apparence</h3>
        <div class="segmented-control">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              class={`segmented-control-option${s.theme === t ? " active" : ""}`}
              onClick={() => void setTheme(t)}
            >
              {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Système"}
            </button>
          ))}
        </div>
      </div>

      <div class="card stack">
        <h3>Répétition espacée</h3>
        <label class="stack" style={{ gap: 4 }}>
          <span class="text-muted" style={{ fontSize: 13 }}>
            Rétention cible : {Math.round(s.retentionTarget * 100)}%
          </span>
          <input
            type="range"
            min={70}
            max={97}
            value={Math.round(s.retentionTarget * 100)}
            onInput={(e) =>
              void patchSettings({
                retentionTarget: Number((e.target as HTMLInputElement).value) / 100,
              })
            }
          />
        </label>
        <p class="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Plus la rétention cible est haute, plus les révisions reviennent souvent.
        </p>
      </div>

      <p class="text-muted" style={{ fontSize: 13, margin: "0 0 -4px 4px", textTransform: "uppercase" }}>
        Session
      </p>
      <div class="list">
        <div class="list-row">
          <span>Mode chronométré par défaut</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={s.timedModeDefault}
              onChange={(e) =>
                void patchSettings({ timedModeDefault: (e.target as HTMLInputElement).checked })
              }
            />
            <span class="switch-track" />
          </label>
        </div>
      </div>

      <div class="card stack">
        <h3>Questions personnalisées</h3>
        <p class="text-muted" style={{ fontSize: 13 }}>
          Ajoute tes propres questions au format JSON (voir public/questions/SCHEMA.md pour le
          format exact).
        </p>
        <button
          class="btn btn-secondary btn-block"
          disabled={importing}
          onClick={() => questionsInputRef.current?.click()}
        >
          {importing ? "Import en cours…" : "Importer un fichier de questions"}
        </button>
        <input
          ref={questionsInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => void handleImportQuestions(e)}
        />
      </div>

      <div class="card stack">
        <h3>Sauvegarde des données</h3>
        <p class="text-muted" style={{ fontSize: 13 }}>
          Toutes tes données (progression, historique) sont stockées uniquement sur cet appareil.
          Exporte régulièrement une sauvegarde pour ne rien perdre.
        </p>
        <button class="btn btn-secondary btn-block" onClick={() => void handleExport()}>
          Exporter mes données
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => backupInputRef.current?.click()}>
          Restaurer une sauvegarde
        </button>
        <input
          ref={backupInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => void handleImportBackup(e)}
        />
      </div>
    </div>
  );
}
