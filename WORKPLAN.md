# WORKPLAN.md — Geo Pixel Board 구체화 작업계획서

본 문서는 `project_plan_draft.md`(이하 PLAN 초안)를 **실제 구현 순서로 분해한 실행 계획서**다.
초안이 "무엇을/왜"라면, 이 문서는 "어떤 파일을, 어떤 순서로, 어떤 코드로" 만드는지를 정의한다.

- 작성 기준일: 2026-06-14
- 주 작업자: Claude Code
- 작업 원칙(사용자 지시 반영): **코드 테스트·단위 테스트는 최소화**, **프로그래밍/구현을 최대화**한다.
  - 테스트 인프라(Vitest/Playwright)는 의존성·설정만 남기고, 자동 테스트 파일 작성은 생략한다.
  - 검증은 `pnpm check`(타입체크) + `wrangler dev` 수동 스모크로 대체한다.
- 단일 진실 원천: 기능은 `project_plan_draft.md`, 구현 순서는 본 문서.

---

## 0. 빌드 순서 개요 (의존성 위상 정렬)

```
[A] 인프라/스캐폴딩  →  [B] shared 코어  →  [C] worker(API+DO)  →  [D] client(지도+보드)  →  [E] 통합/마감  →  [F] MCP(선택)
```

의존성 규칙: 아래 계층은 위 계층에만 의존한다.

| 계층 | 디렉터리 | 의존 대상 |
| --- | --- | --- |
| shared | `shared/` | 없음 (순수 TS) |
| worker | `worker/` | shared |
| client | `client/` | shared |
| mcp | `tools/mcp/` | shared (복사 또는 path import) |

핵심: `shared/`는 클라이언트와 워커가 **같은 코드**로 지오해시/거리/프로토콜을 계산해야 하므로 가장 먼저, 가장 정확하게 만든다.

---

## A. 인프라 / 스캐폴딩

### A-1. 모노레포 루트
| ID | 산출물 | 내용 |
| --- | --- | --- |
| A1-1 | `package.json` | 루트 워크스페이스, 공통 scripts (`dev`, `check`, `build`, `deploy`) |
| A1-2 | `pnpm-workspace.yaml` | `client`, `worker`, `shared`, `tools/*` 포함 |
| A1-3 | `tsconfig.base.json` | strict, `moduleResolution: Bundler`, path alias `@shared/*` |
| A1-4 | `.gitignore` | `node_modules`, `dist`, `.wrangler`, `.dev.vars`, `*.local` |
| A1-5 | `.prettierrc`, `eslint.config.js` | 포맷/린트 (가볍게) |

### A-2. 빌드 / 런타임 설정
| ID | 산출물 | 내용 |
| --- | --- | --- |
| A2-1 | `wrangler.toml` | Worker main, assets 바인딩, D1 바인딩, DO 바인딩, migrations |
| A2-2 | `worker/migrations/0001_create_rooms.sql` | D1 `rooms` 테이블 + 인덱스 (초안 §9-1) |
| A2-3 | `vite.config.ts` | Svelte plugin + Cloudflare vite plugin, `@shared` alias |
| A2-4 | `vitest.config.ts` | (설정만, 테스트 파일 작성은 생략) |
| A2-5 | `playwright.config.ts` | (설정만, 테스트 파일 작성은 생략) |
| A2-6 | `client/index.html`, `client/src/main.ts` | SPA 진입점 |

### A-3. 문서/규칙
| ID | 산출물 | 내용 |
| --- | --- | --- |
| A3-1 | `CLAUDE.md` | 초안 §19 규칙 그대로 + 본 작업계획 참조 |
| A3-2 | `history.md` | 작업 이력 로그 시작 |
| A3-3 | `.dev.vars.example` | `MAP_STYLE_URL` 등 환경 변수 예시 |

**검증(A):** `pnpm install` 성공, `pnpm check` 타입 통과, `wrangler dev`로 `/api/health` 200.

---

## B. shared 코어 (가장 먼저 정확하게)

| ID | 파일 | 내보내는 것 | 비고 |
| --- | --- | --- | --- |
| B-1 | `shared/constants.ts` | `BOARD_W=64`, `BOARD_H=64`, `EMPTY=255`, `COOLDOWN_MS=5000`, `WRITE_RADIUS_M=100`, `MAX_ACC_M=100`, `GEOHASH_PRECISION=8`, `PALETTE_VERSION=1` | 게임 규칙 기본값(초안 §11) |
| B-2 | `shared/palette.ts` | `PALETTE: readonly string[]` (16색 hex), 인덱스 0~15 | 단일 출처(초안 §4-4) |
| B-3 | `shared/geo/geohash.ts` | `encodeGeohash(lat,lng,precision)`, `decodeGeohash(hash)→{lat,lng}`, `geohashBounds(hash)→{minLat,...}` | base32, 클라/서버 동일 결과 |
| B-4 | `shared/geo/haversine.ts` | `haversineMeters(a,b)` | 직접 구현(초안 §10-2) |
| B-5 | `shared/geo/locationGate.ts` | `checkLocationGate({roomCenter,lat,lng,acc})→{canWrite,reason,distanceM,accuracyM}` | 서버·MCP 공유 판정 로직 |
| B-6 | `shared/protocol.ts` | Zod 스키마: `JoinMsg`, `PaintMsg`, `PingMsg`(클→서), `SnapshotMsg`, `PixelMsg`, `AckMsg`, `PresenceMsg`, `PongMsg`(서→클) + 타입 추론 | 초안 §12 |
| B-7 | `shared/snapshot.ts` | `encodeSnapshot(Uint8Array)→base64`, `decodeSnapshot(base64,len)→Uint8Array` | 보드 4096바이트 코덱 |
| B-8 | `shared/room.ts` | `RoomMeta` 타입, `isValidGeohash(s)`, `roomCenterFromGeohash(hash)` | 방 헬퍼 |
| B-9 | `shared/index.ts` | 위 모듈 re-export | barrel |

**검증(B):** `pnpm check` 통과. (단위테스트 생략 — 대신 worker/client에서 실사용으로 확인.)

---

## C. worker (Cloudflare Worker + Hono + Durable Object)

### C-1. 기반
| ID | 파일 | 내용 |
| --- | --- | --- |
| C1-1 | `worker/src/env.ts` | `Env` 타입(D1 `DB`, DO `ROOM`, `ASSETS`, vars) |
| C1-2 | `worker/src/errors.ts` | `jsonError(status,code,msg)`, 공통 에러 응답 |
| C1-3 | `worker/src/index.ts` | Hono 앱, 라우트 마운트, `/ws/:roomId` → DO 라우팅, assets fallback |

### C-2. HTTP API
| ID | 파일 | 내용 |
| --- | --- | --- |
| C2-1 | `worker/src/rooms.ts` | `GET /api/health`, `GET /api/rooms?bbox`, `POST /api/rooms` (Zod 검증, D1 prepared stmt, idempotent 생성) |

라우트 상세(초안 §13):
- `GET /api/health` → `{ok,version}`
- `GET /api/rooms` → bbox 4개 파라미터 검증, 범위 내 방 조회
- `POST /api/rooms` → 위치 게이팅 후 geohash 계산, 존재 시 200+기존 반환

### C-3. Durable Object
| ID | 파일 | 내용 |
| --- | --- | --- |
| C3-1 | `worker/src/room-do.ts` | `RoomDurableObject`: WebSocket Hibernation, SQLite `pixels`/`room_meta` 초기화, join/paint/ping 처리, 위치 게이팅 + 쿨다운 강제, snapshot 생성, pixel 브로드캐스트, D1 메타 갱신 |

DO 책임(초안 §14-2):
- `fetch()` → WebSocket upgrade, `acceptWebSocket` (hibernation)
- `webSocketMessage()` → 메시지 파싱(Zod) → 분기
  - `join`: 위치 게이팅 1차 판정 → snapshot 전송 + presence
  - `paint`: 위치 재검증 + 쿨다운 + 좌표/색 범위 → pixel upsert → 브로드캐스트 → D1 `pixel_count`/`last_drawn_at` 갱신
  - `ping`: pong
- `webSocketClose()` → presence 감소 브로드캐스트
- 좌표는 판정 후 즉시 폐기, 로그에 원본 좌표 금지

**검증(C):** `wrangler dev` 기동, `/api/health` 200, `/api/rooms` bbox 검증(400 케이스 포함), `wscat`/브라우저로 `join`→snapshot, `paint`→pixel 브로드캐스트 수동 확인.

---

## D. client (Svelte 5 runes + MapLibre + Canvas)

### D-1. 상태 / 인프라
| ID | 파일 | 내용 |
| --- | --- | --- |
| D1-1 | `client/src/lib/state/appState.svelte.ts` | `$state` 전역: 지도 viewport, 방 목록, 선택 방, 위치 권한 상태 |
| D1-2 | `client/src/lib/state/roomState.svelte.ts` | 방 내부 상태: 접속 상태, snapshot, online, cooldown, canWrite, 선택 색 |
| D1-3 | `client/src/lib/geo/browserLocation.ts` | `getPosition()` (Geolocation Promise 래퍼, accuracy 포함) |

### D-2. 지도
| ID | 파일 | 내용 |
| --- | --- | --- |
| D2-1 | `client/src/lib/map/mapStyle.ts` | `MAP_STYLE_URL` 분리, OSM raster style + attribution |
| D2-2 | `client/src/lib/map/mapController.ts` | MapLibre 초기화(명령형), moveend 디바운스→bbox 조회 콜백, 최신 요청만 반영 |
| D2-3 | `client/src/lib/map/roomLayer.ts` | 방 핀 렌더(HTML marker로 시작), 상태별 스타일 |

### D-3. 보드 / WebSocket
| ID | 파일 | 내용 |
| --- | --- | --- |
| D3-1 | `client/src/lib/board/boardMath.ts` | 클릭 좌표 → 셀 좌표 변환, fit-to-panel scale |
| D3-2 | `client/src/lib/board/boardRenderer.ts` | 단일 canvas 명령형 렌더러: snapshot 그리기, 단일 픽셀 갱신 |
| D3-3 | `client/src/lib/ws/roomSocket.ts` | WebSocket 연결, 메시지 송수신(Zod parse), 콜백 |
| D3-4 | `client/src/lib/ws/reconnect.ts` | 백오프 재연결, 재연결 시 snapshot 재수신 |

### D-4. 컴포넌트 (Svelte 5 runes only)
| ID | 파일 | 내용 |
| --- | --- | --- |
| D4-1 | `client/src/components/MapView.svelte` | 지도 컨테이너 + roomLayer 바인딩 |
| D4-2 | `client/src/components/RoomPanel.svelte` | 방 패널/전체화면 전환, 보드+컨트롤 컨테이너 |
| D4-3 | `client/src/components/PixelBoard.svelte` | canvas 마운트, 클릭→paint 전송 |
| D4-4 | `client/src/components/Palette.svelte` | 16색 선택 |
| D4-5 | `client/src/components/Cooldown.svelte` | 쿨다운 카운트다운 표시 |
| D4-6 | `client/src/components/PermissionBanner.svelte` | 위치 권한/정확도/반경/끊김 상태 배너 |
| D4-7 | `client/src/components/LandingPage.svelte` | 첫 방문 온보딩. 지도 열기/내 위치 주변에서 그리기/규칙 보기 CTA |
| D4-8 | `client/src/components/RulesModal.svelte` | 금지/허용/위치 규칙. 영토 분쟁 허용과 griefing 금지 구분 |
| D4-9 | `client/src/components/ChargesIndicator.svelte` | 쿨다운을 paint charge 개념으로 표시 |
| D4-10 | `client/src/App.svelte` | 랜딩 ↔ 지도 ↔ 방 모달 상태 오케스트레이션 |

**검증(D):** `pnpm dev`로 지도 로드, 핀 표시, 방 입장→snapshot 렌더, 색 선택→paint→캔버스 반영, 권한 거부 시 보기 전용.

---

## E. 통합 / 마감

| ID | 내용 |
| --- | --- |
| E-1 | presence 표시 + 재연결 복구 동작 확인 |
| E-2 | 모바일/데스크톱 반응형, Linear 결 절제 UI 토큰 적용(`client/src/app.css`) |
| E-3 | 오류/빈 상태 정리(초안 §4-9) |
| E-4 | D1 seed SQL(`worker/seed.sql`) — 서울역 등 데모 방 몇 개 |
| E-5 | 타일 attribution 노출 확인, 원본 좌표 로그 부재 확인 |
| E-6 | 첫 진입 랜딩/온보딩 확인. 재방문 시 skip 상태와 다시 보기 동작 확인 |
| E-7 | Rules modal 확인. 영토 분쟁 허용, clear griefing 금지, map cleanup 허용 문구 포함 |
| E-8 | paint charge/cooldown UI 확인. 유료 Droplets/Store로 오해되지 않게 표현 |

---

## F. MCP 서버 (선택 / 후순위)

초안 §20 기준. v1 핵심 앱 동작 후 진행. `tools/mcp/`에 stdio 서버, `geo_hash_preview`/`location_gate_check`/`ws_message_validate`/`privacy_scan`/`svelte_runes_scan` 우선.

---

## G. 환경 변수 / 시크릿

| 키 | 용도 | 위치 |
| --- | --- | --- |
| `MAP_STYLE_URL` | 지도 스타일 JSON URL | `.dev.vars` / wrangler vars |
| (없음) | v1은 외부 시크릿 불필요 | — |

---

## H. 테스트 정책 (사용자 지시: 최소화)

- 자동 테스트 파일은 작성하지 않는다. (`tests/` 디렉터리는 비워두거나 placeholder만.)
- Vitest/Playwright 의존성·설정은 미래 확장을 위해 남긴다.
- 품질 게이트는 다음으로 대체:
  1. `pnpm check` — `svelte-check` + `tsc --noEmit` 타입 검증.
  2. `wrangler dev` 수동 스모크 — health / rooms / ws paint.
  3. 두 브라우저 탭으로 실시간 브로드캐스트 육안 확인.

---

## I. 작업 진행 체크리스트

- [ ] A. 인프라/스캐폴딩
- [ ] B. shared 코어
- [ ] C. worker (API + DO)
- [ ] D. client (지도 + 보드 + 실시간)
- [ ] E. 통합/마감
- [ ] F. MCP (선택)

각 단계 완료 시 `history.md` 상단에 한 줄 로그를 추가한다.
