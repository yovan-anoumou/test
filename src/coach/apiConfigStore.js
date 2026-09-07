const KEY = 'poker_trainer_llm_api_config';

// The API key never leaves the browser except in requests the user
// configures the destination for (their own baseUrl). Never hardcode a
// key here - it always comes from this local, user-editable store.
export function getApiConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setApiConfig(cfg) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    // localStorage unavailable (private mode etc.) - silently ignore, the
    // rule-based coach fallback still works without it.
  }
}
