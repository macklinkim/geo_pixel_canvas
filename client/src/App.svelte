<script lang="ts">
  import { onMount } from "svelte";
  import MapView from "./components/MapView.svelte";
  import RoomPanel from "./components/RoomPanel.svelte";
  import LandingPage from "./components/LandingPage.svelte";
  import VerifyGate from "./components/VerifyGate.svelte";
  import AdminPanel from "./components/AdminPanel.svelte";
  import { app } from "./lib/state/appState.svelte";

  type Route = "/" | "/verify" | "/app" | "/admin";

  let ready = $state(false);
  let route = $state<Route>(normalize(location.pathname));

  function normalize(path: string): Route {
    if (path === "/verify") return "/verify";
    if (path === "/app") return "/app";
    if (path === "/admin") return "/admin";
    return "/";
  }

  function navigate(path: Route): void {
    if (normalize(location.pathname) !== path) history.pushState({}, "", path);
    route = path;
  }

  // Client-side guard for /app reached via pushState (hard loads are gated by
  // the Worker). Belt-and-suspenders with the server gate.
  async function guardApp(): Promise<void> {
    if (!app.turnstileEnabled) return;
    try {
      const res = await fetch("/api/session");
      const d = (await res.json()) as { enabled: boolean; valid: boolean };
      if (d.enabled && !d.valid) navigate("/verify");
    } catch {
      /* allow; the server still enforces writes */
    }
  }

  onMount(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const d = (await res.json()) as {
          mapStyleUrl: string | null;
          turnstileEnabled?: boolean;
          turnstileSiteKey?: string | null;
        };
        app.mapStyleUrl = d.mapStyleUrl ?? null;
        app.turnstileEnabled = d.turnstileEnabled ?? false;
        app.turnstileSiteKey = d.turnstileSiteKey ?? null;
      }
    } catch {
      /* fall back to defaults */
    }

    // Reflect any existing admin session (drives the "Admin mode" badge).
    try {
      const res = await fetch("/api/admin/session");
      if (res.ok) {
        const d = (await res.json()) as {
          enabled: boolean;
          valid: boolean;
          expiresAt: number | null;
        };
        app.adminEnabled = d.enabled;
        app.adminActive = d.valid;
        app.adminExpiresAt = d.expiresAt;
      }
    } catch {
      /* admin badge simply stays off */
    }
    ready = true;

    addEventListener("popstate", () => (route = normalize(location.pathname)));
  });

  // When entering /app, confirm a human session exists.
  $effect(() => {
    if (ready && route === "/app") void guardApp();
  });
</script>

<main class="app">
  {#if route === "/app"}
    {#if ready}
      <MapView />
      {#if app.selectedRoom}
        {@const rid = app.selectedRoom}
        {#key rid}
          <RoomPanel roomId={rid} />
        {/key}
      {/if}
    {/if}
  {:else if route === "/verify"}
    <VerifyGate onVerified={() => navigate("/app")} onBack={() => navigate("/")} />
  {:else if route === "/admin"}
    <AdminPanel onEnterApp={() => navigate("/app")} />
  {:else}
    <LandingPage onenter={() => navigate("/verify")} />
  {/if}
</main>

<style>
  .app {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
</style>
