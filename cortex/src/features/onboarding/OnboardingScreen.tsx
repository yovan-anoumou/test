import { patchSettings } from "../../store";
import { navigate } from "../../router";

export function OnboardingScreen() {
  async function finish() {
    await patchSettings({ onboardingDone: true });
    navigate({ name: "home" });
  }

  return (
    <div class="screen stack">
      <h1>CORTEX</h1>
      <p class="text-muted">
        Un entraînement ciblé pour le TAGE 2, l'anglais, la culture générale et le raisonnement —
        pas un jeu de brain-training.
      </p>

      <div class="card stack">
        <h3>3 principes</h3>
        <p>
          <strong>Retrieval practice.</strong> Tu es toujours testé, jamais en train de relire
          passivement.
        </p>
        <p>
          <strong>Répétition espacée (FSRS).</strong> Chaque question revient au moment optimal
          pour ta mémoire, selon ta propre courbe d'oubli.
        </p>
        <p>
          <strong>Interleaving.</strong> Les matières sont mélangées dans chaque session, jamais en
          blocs par thème.
        </p>
      </div>

      <div class="card stack">
        <h3>Le temps compte</h3>
        <p class="text-muted">
          Le vrai piège du TAGE 2, c'est le temps — pas la difficulté. Le mode chronométré est
          activé par défaut sur chaque question.
        </p>
      </div>

      <button class="btn btn-primary btn-block" onClick={() => void finish()}>
        Commencer
      </button>
    </div>
  );
}
