import React, { useEffect, useState } from "react";
import {
  API_BASE,
  arcFetch,
  clearArcSession,
  isArcEventMode,
  readArcSession,
  storeArcSession,
} from "../services/arcSession";

let bootstrapPromise = null;

function errorFromResponse(response, fallback) {
  return response.json()
    .then((body) => new Error(body?.error || fallback))
    .catch(() => new Error(fallback));
}

function bootstrapSession() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    let session = readArcSession();
    if (session) {
      const response = await arcFetch(`${API_BASE}/session`, { cache: "no-store" });
      if (!response.ok) {
        clearArcSession();
        throw await errorFromResponse(response, "This Arc session is no longer active.");
      }
      session = { ...session, session: await response.json() };
      storeArcSession(session);
      return session;
    }

    const url = new URL(window.location.href);
    const ticket = url.searchParams.get("launch_ticket");
    if (!ticket) throw new Error("Open Velo Arc from a registered project in Velo.");

    const response = await fetch(`${API_BASE}/launch/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
      cache: "no-store",
    });
    if (!response.ok) throw await errorFromResponse(response, "Velo could not start this Arc session.");

    session = await response.json();
    storeArcSession(session);
    url.searchParams.delete("launch_ticket");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return session;
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

export default function ArcEventGate({ children }) {
  const [state, setState] = useState({ ready: !isArcEventMode, error: null, session: null });

  useEffect(() => {
    if (!isArcEventMode) return undefined;
    let current = true;
    bootstrapSession()
      .then((session) => {
        if (current) setState({ ready: true, error: null, session: session.session });
      })
      .catch((error) => {
        if (current) setState({ ready: false, error: error.message, session: null });
      });
    return () => {
      current = false;
    };
  }, []);

  if (!isArcEventMode) return children;
  if (!state.ready) {
    return (
      <main className="arc-event-gate" role="status" aria-live="polite">
        <section>
          <h1>{state.error ? "Arc session unavailable" : "Opening Velo Arc…"}</h1>
          <p>{state.error || "Verifying your Velo project access."}</p>
          {state.error ? <a href={import.meta.env.VITE_VELO_URL || "https://velo.app"}>Return to Velo</a> : null}
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="arc-event-return">
        <a href={import.meta.env.VITE_VELO_URL || "https://velo.app"}>← Back to Velo</a>
        <span>{state.session?.projectName}</span>
      </div>
      {children}
    </>
  );
}
