<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let {
    siteKey,
    onToken,
    onError,
  }: {
    siteKey: string;
    onToken: (token: string) => void;
    onError?: (kind: string) => void;
  } = $props();

  // Minimal shape of the Turnstile global we use.
  type TurnstileApi = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
  };
  const getApi = (): TurnstileApi | undefined =>
    (window as unknown as { turnstile?: TurnstileApi }).turnstile;

  const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  let el: HTMLDivElement;
  let widgetId: string | undefined;

  function loadScript(): Promise<void> {
    if (getApi()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("load")));
        if (getApi()) resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.dataset.turnstile = "1";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("load"));
      document.head.appendChild(s);
    });
  }

  onMount(async () => {
    try {
      await loadScript();
      const api = getApi();
      if (!api) {
        onError?.("load");
        return;
      }
      widgetId = api.render(el, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "error-callback": () => onError?.("error"),
        "expired-callback": () => onError?.("expired"),
        "timeout-callback": () => onError?.("timeout"),
        theme: "dark",
        size: "flexible",
      });
    } catch {
      onError?.("load");
    }
  });

  onDestroy(() => {
    const api = getApi();
    if (api && widgetId) {
      try {
        api.remove(widgetId);
      } catch {
        /* already gone */
      }
    }
  });

  export function reset(): void {
    const api = getApi();
    if (api && widgetId) api.reset(widgetId);
  }
</script>

<div bind:this={el} class="turnstile"></div>

<style>
  .turnstile {
    min-height: 65px;
    display: flex;
    justify-content: center;
  }
</style>
