export const API_BASE = import.meta.env?.VITE_API_BASE || "/api";
export const isArcEventMode = import.meta.env?.VITE_ARC_EVENT_MODE === "true";

const SESSION_KEY = "velo-arc:event-session";

export const readArcSession = () => {
  if (!isArcEventMode) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return value && typeof value.sessionToken === "string" && value.session
      ? value
      : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const getArcSessionId = () => readArcSession()?.session?.sessionId || null;
export const getArcSessionAccount = () => readArcSession()?.session?.account || null;

export const storeArcSession = (value) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
};

export const clearArcSession = () => sessionStorage.removeItem(SESSION_KEY);

export const scopedStorageKey = (key) => {
  const sessionId = getArcSessionId();
  return isArcEventMode && sessionId ? `${key}:${sessionId}` : key;
};

export const arcAuthorizationHeaders = (headers = {}) => {
  const result = new Headers(headers);
  if (!isArcEventMode) return result;
  const session = readArcSession();
  if (!session) throw new Error("Open this Velo Arc workspace from Velo first.");
  result.set("X-Arc-Session", session.sessionToken);
  return result;
};

export const arcFetch = (input, init = {}) =>
  fetch(input, { ...init, headers: arcAuthorizationHeaders(init.headers) });
