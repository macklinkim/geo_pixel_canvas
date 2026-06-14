# Cloudflare Turnstile — 사람 확인 (human verification)

geo_pixel_board의 **쓰기 작업**에 "사람임을 확인하는 최소한의 장치"를 추가한다.
읽기(지도/방/보드 보기)는 영향이 없다.

참고 문서: https://developers.cloudflare.com/turnstile/

## 1. 동작 개요 (두 계층)

1. **진입 게이트(UX)**: `랜딩(/) → /verify(Turnstile) → /app`.
   - `/verify`에서 Turnstile 통과 → `POST /api/verify`가 Siteverify로 서버 검증 → **HMAC 서명 httpOnly 쿠키**(human session, 기본 30분) 발급.
   - `/app`은 **서버(Worker)** 가 쿠키를 확인한다. 없으면 `302 → /verify`. (클라 라우팅만으로 막지 않음)
2. **쓰기 경로(보안, 항상 강제)**: WebSocket `paint`/`stamp`/`rename`, `POST /api/rooms`.
   - WS 업그레이드 시 Worker가 쿠키를 검증해 `humanVerifiedUntil`을 DO에 전달 → 게이트 통과자는 추가 CAPTCHA 없이 그린다.
   - 세션이 없거나 만료면 서버가 `ack reason=human_required`를 보내고, 클라가 **인라인 Turnstile**로 토큰을 받아 같은 쓰기를 재전송 → 서버가 토큰을 Siteverify로 검증 후 수행.

위치 게이트(거리/정확도)와 쿨다운/레이트리밋은 **그대로** 유지된다. 사람 확인과 위치 확인은 **둘 다** 통과해야 쓰기가 된다. (`out_of_range`는 Turnstile 성공 여부와 무관하게 먼저 거부)

## 2. 환경 변수

| 변수 | 위치 | 설명 |
| --- | --- | --- |
| `TURNSTILE_ENABLED` | `wrangler.toml [vars]` | `"true"`면 사용 |
| `TURNSTILE_SITE_KEY` | `wrangler.toml [vars]` | 공개 site key (클라에 노출됨) |
| `TURNSTILE_SESSION_TTL_MS` | `wrangler.toml [vars]` | human session 수명(ms), 기본 1800000(30분) |
| `TURNSTILE_SECRET_KEY` | **secret** | 서버 전용. 로컬은 `.dev.vars`, 운영은 `wrangler secret put` |

`enabled`의 **유효 조건**: `TURNSTILE_ENABLED==="true"` **그리고** site key·secret이 모두 존재.
플래그만 true이고 키가 없으면(개발 미설정) **차단하지 않고**(fail-open) 콘솔에 에러를 남긴다.

### 로컬(dev)

테스트 키(항상 통과) — https://developers.cloudflare.com/turnstile/troubleshooting/testing/

```
# wrangler.toml [vars] (이미 설정됨)
TURNSTILE_ENABLED = "true"
TURNSTILE_SITE_KEY = "1x00000000000000000000AA"

# .dev.vars (커밋 금지)
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### 운영(prod)

```
wrangler secret put TURNSTILE_SECRET_KEY   # 실제 secret 입력
# wrangler.toml의 TURNSTILE_SITE_KEY를 실제 site key로 교체
```

## 3. 서버 API

- `GET /api/config` → `{ turnstileEnabled, turnstileSiteKey, sessionTtlMs, ... }` (site key만 노출)
- `GET /api/session` → `{ enabled, valid, expiresAt }`
- `POST /api/verify { token }` → Siteverify 검증 성공 시 세션 쿠키 발급
- `POST /api/rooms` → 세션 쿠키 또는 token 필요(enabled일 때)
- `GET /app` → 세션 없으면 `302 /verify`
- `GET /ws/:roomId` → 쿠키 검증 후 `humanVerifiedUntil`을 DO에 전달
- WS `paint/stamp/rename` → DO가 `humanVerifiedUntil` 확인, 없으면 `ack human_required`, token 오면 Siteverify 후 세션 갱신

## 4. 수동 검증 방법

```bash
pnpm check                 # 타입
pnpm db:migrate:local && pnpm db:seed:local
pnpm dev                   # http://localhost:5173
```

1. 브라우저에서 `http://localhost:5173/app` 직접 열기 → `/verify`로 리다이렉트되는지 확인(서버 게이트).
2. 테스트 위젯이 자동 통과 → `/app` 진입, 지도 표시.
3. "내 위치에 그리기"(데스크톱은 mock geolocation) → 추가 CAPTCHA 없이 그려지는지 확인(쿠키 세션이 WS 커버).
4. 서버 강제 확인(쿠키 없는 WS 클라이언트):
   ```bash
   node tools/ws-turnstile-test.mjs
   # 기대: human_required → (token) ok → 원거리 out_of_range
   ```
5. API 게이트:
   ```bash
   curl -i http://localhost:5173/app           # 302 Location: /verify
   curl -c jar -X POST -H 'content-type: application/json' -d '{"token":"x"}' http://localhost:5173/api/verify
   curl -b jar -o /dev/null -w '%{http_code}\n' http://localhost:5173/app   # 200
   ```
6. **disabled 환경**: `wrangler.toml`의 `TURNSTILE_ENABLED="false"`로 바꾸고 재시작 → 게이트/쓰기 검증이 비활성, 기존 개발 플로우 그대로 동작.

## 5. 보안상 의도적으로 하지 않은 것

- **클라이언트 토큰을 신뢰하지 않음**: 모든 토큰은 서버에서 Siteverify(`success===true`)로 검증. 토큰은 단일 사용·재사용하지 않음.
- **secret key를 클라이언트에 노출하지 않음**: site key만 `/api/config`로 노출. secret은 `.dev.vars`/`wrangler secret`에만.
- **좌표/IP를 Turnstile 경로에서 저장하지 않음**: Siteverify에 `remoteip`도 보내지 않음. 세션 쿠키는 만료 시각만 서명해 담음(좌표·신원 없음).
- **매 픽셀마다 CAPTCHA 요구하지 않음**: 1회 검증 후 30분 human session. 게이트 통과 쿠키가 WS까지 커버.
- **위치/쿨다운/레이트리밋 약화하지 않음**: Turnstile은 "사람 여부"만 추가. 거리·정확도·쿨다운은 그대로, `out_of_range`가 항상 우선.
- **진입 게이트를 보안 경계로 신뢰하지 않음**: `/app` 클라 라우팅은 UX, 실제 쓰기는 항상 서버에서 재검증.

## 6. 한계 / 후속

- human session은 **연결/쿠키 단위**다. WS 재연결 시 만료된 세션이면 첫 쓰기에서 1회 재검증(인라인)이 발생할 수 있다(과도하지 않음).
- 쿠키 세션은 익명·서명 기반이라 동일 브라우저에서 30분 유효. 더 강한 결속(디바이스 바인딩 등)은 v2 후보.
