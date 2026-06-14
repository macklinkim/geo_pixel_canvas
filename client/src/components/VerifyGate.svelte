<script lang="ts">
  import { onMount } from "svelte";
  import Turnstile from "./Turnstile.svelte";
  import { app } from "../lib/state/appState.svelte";

  let { onVerified, onBack }: { onVerified: () => void; onBack: () => void } = $props();

  let status = $state<"loading" | "challenge" | "verifying" | "error">("loading");
  let errorMsg = $state("");

  onMount(async () => {
    // If the gate is off or a session already exists, pass straight through.
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const d = (await res.json()) as { enabled: boolean; valid: boolean };
        if (!d.enabled || d.valid) {
          onVerified();
          return;
        }
      }
    } catch {
      /* fall through to challenge */
    }
    status = "challenge";
  });

  async function handleToken(token: string): Promise<void> {
    status = "verifying";
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && d.ok) {
        onVerified();
        return;
      }
      errorMsg = "확인에 실패했어요. 다시 시도해 주세요.";
      status = "error";
    } catch {
      errorMsg = "네트워크 오류로 확인하지 못했어요.";
      status = "error";
    }
  }

  function handleError(kind: string): void {
    errorMsg = kind === "load" ? "보안 확인을 불러오지 못했어요." : "확인이 만료되었어요.";
    status = "error";
  }

  function retry(): void {
    errorMsg = "";
    status = "challenge";
  }
</script>

<div class="gate">
  <div class="card">
    <h1>사람인지 확인</h1>
    <p class="lead">그림을 그리기 전에 잠깐만 확인할게요. 위치 정보와는 관계없어요.</p>

    {#if status === "challenge" && app.turnstileSiteKey}
      <Turnstile siteKey={app.turnstileSiteKey} onToken={handleToken} onError={handleError} />
    {:else if status === "verifying"}
      <p class="muted">확인 중…</p>
    {:else if status === "error"}
      <p class="err">{errorMsg}</p>
      <button class="btn primary" onclick={retry}>다시 시도</button>
    {:else}
      <p class="muted">불러오는 중…</p>
    {/if}

    <button class="btn ghost" onclick={onBack}>← 돌아가기</button>
  </div>
</div>

<style>
  .gate {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: radial-gradient(120% 120% at 50% 0%, #161a24 0%, var(--bg) 60%);
  }
  .card {
    width: min(92vw, 420px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow);
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 20px;
  }
  .lead {
    margin: 0;
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.5;
  }
  .muted {
    color: var(--text-dim);
  }
  .err {
    color: var(--danger);
    font-size: 14px;
    margin: 0;
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 600;
    justify-content: center;
  }
  .btn.ghost {
    background: none;
    border: none;
    color: var(--text-dim);
  }
</style>
