<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "../lib/state/appState.svelte";
  import { ShieldCheck } from "lucide-svelte";

  let { onEnterApp }: { onEnterApp: () => void } = $props();

  let status = $state<"loading" | "disabled" | "active" | "form" | "submitting">("loading");
  let code = $state("");
  let errorMsg = $state("");

  function applySession(d: { enabled: boolean; valid: boolean; expiresAt: number | null }): void {
    app.adminEnabled = d.enabled;
    app.adminActive = d.valid;
    app.adminExpiresAt = d.expiresAt;
    status = !d.enabled ? "disabled" : d.valid ? "active" : "form";
  }

  onMount(async () => {
    try {
      const res = await fetch("/api/admin/session");
      applySession(
        (await res.json()) as { enabled: boolean; valid: boolean; expiresAt: number | null },
      );
    } catch {
      status = "form";
    }
  });

  async function login(e: Event): Promise<void> {
    e.preventDefault();
    if (!code.trim() || status === "submitting") return;
    status = "submitting";
    errorMsg = "";
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; expiresAt?: number; error?: { code: string } };
      if (res.ok && d.ok) {
        app.adminEnabled = true;
        app.adminActive = true;
        app.adminExpiresAt = d.expiresAt ?? null;
        code = "";
        status = "active";
        return;
      }
      errorMsg =
        d.error?.code === "rate_limited"
          ? "시도가 너무 많아요. 잠시 후 다시 시도해 주세요."
          : "코드가 올바르지 않아요.";
      status = "form";
    } catch {
      errorMsg = "네트워크 오류로 로그인하지 못했어요.";
      status = "form";
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore — cookie clears server-side; reflect locally regardless */
    }
    app.adminActive = false;
    app.adminExpiresAt = null;
    status = "form";
  }

  function expiryText(ts: number | null): string {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }
</script>

<div class="gate">
  <div class="card">
    <h1><ShieldCheck size={18} /> 관리자 모드</h1>

    {#if status === "loading"}
      <p class="muted">불러오는 중…</p>
    {:else if status === "disabled"}
      <p class="lead">이 환경에서는 관리자 오버라이드가 비활성화되어 있어요.</p>
    {:else if status === "active"}
      <p class="lead">관리자 모드가 활성화되었어요. 위치와 무관하게 모든 방에서 그릴 수 있어요.</p>
      <p class="muted">만료: {expiryText(app.adminExpiresAt)}</p>
      <button class="btn primary" onclick={onEnterApp}>앱으로 가기</button>
      <button class="btn ghost" onclick={logout}>로그아웃</button>
    {:else}
      <p class="lead">운영자 코드를 입력하면 위치 게이트 없이 그릴 수 있어요.</p>
      <form onsubmit={login}>
        <input
          type="password"
          bind:value={code}
          placeholder="운영자 코드"
          aria-label="운영자 코드"
          autocomplete="off"
        />
        <button class="btn primary" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "확인 중…" : "로그인"}
        </button>
      </form>
      {#if errorMsg}<p class="err">{errorMsg}</p>{/if}
    {/if}

    <button class="btn ghost" onclick={onEnterApp}>← 앱으로</button>
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .lead {
    margin: 0;
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.5;
  }
  .muted {
    color: var(--text-dim);
    font-size: 13px;
    margin: 0;
  }
  .err {
    color: var(--danger);
    font-size: 14px;
    margin: 0;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 11px 12px;
    color: var(--text);
    font: inherit;
    outline: none;
  }
  input:focus {
    border-color: var(--accent);
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
