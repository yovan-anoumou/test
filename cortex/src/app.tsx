import { useEffect } from "preact/hooks";
import { currentRoute, type Route } from "./router";
import { appReady, appError, settings, initApp } from "./store";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./features/home/HomeScreen";
import { OnboardingScreen } from "./features/onboarding/OnboardingScreen";
import { SessionScreen } from "./features/session/SessionScreen";
import { MockExamScreen } from "./features/mock-exam/MockExamScreen";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { HistoryScreen } from "./features/review-history/HistoryScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { FichesIndexScreen } from "./features/fiches/FichesIndexScreen";
import { FicheDomainScreen } from "./features/fiches/FicheDomainScreen";
import { FicheDetailScreen } from "./features/fiches/FicheDetailScreen";
import { DiagnosticScreen } from "./features/diagnostic/DiagnosticScreen";
import { DiagnosticResultScreen } from "./features/diagnostic/DiagnosticResultScreen";
import { PlanScreen } from "./features/plan/PlanScreen";

export function App() {
  useEffect(() => {
    void initApp();
  }, []);

  if (appError.value) {
    return (
      <div class="screen">
        <div class="card">
          <h2>Erreur de chargement</h2>
          <p class="text-muted">{appError.value}</p>
        </div>
      </div>
    );
  }

  if (!appReady.value) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement…</p>
      </div>
    );
  }

  if (!settings.value.onboardingDone && currentRoute.value.name !== "onboarding") {
    return <OnboardingScreen />;
  }

  const route = currentRoute.value;
  const hideNav =
    route.name === "onboarding" ||
    route.name === "session" ||
    route.name === "mock-exam" ||
    route.name === "diagnostic";
  return (
    <>
      {renderScreen(route)}
      {!hideNav && <BottomNav />}
    </>
  );
}

function renderScreen(route: Route) {
  switch (route.name) {
    case "onboarding":
      return <OnboardingScreen />;
    case "session":
      return <SessionScreen spec={route.spec} />;
    case "mock-exam":
      return <MockExamScreen />;
    case "dashboard":
      return <DashboardScreen />;
    case "history":
      return <HistoryScreen />;
    case "settings":
      return <SettingsScreen />;
    case "fiches":
      return <FichesIndexScreen />;
    case "fiches-domain":
      return <FicheDomainScreen domain={route.domain} />;
    case "fiche":
      return <FicheDetailScreen id={route.id} />;
    case "diagnostic":
      return <DiagnosticScreen />;
    case "diagnostic-result":
      return <DiagnosticResultScreen id={route.id} />;
    case "plan":
      return <PlanScreen />;
    case "home":
    default:
      return <HomeScreen />;
  }
}
