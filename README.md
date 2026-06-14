# Geo Pixel Board

지도 위의 한 지점이 곧 하나의 픽셀 보드 방이 되는, 위치 기반 실시간 멀티플레이어 낙서 서비스.

- 읽기는 오픈: 누구나 지도를 돌아다니며 전 세계의 낙서를 구경한다.
- 쓰기는 위치 게이팅: 그 장소 근처(기본 100m)에 실제로 있어야 픽셀을 찍을 수 있다.
- 장소 = 방 = Cloudflare Durable Object 인스턴스.

자세한 기획은 [`project_plan_draft.md`](./project_plan_draft.md), 구현 순서는
[`WORKPLAN.md`](./WORKPLAN.md), 작업 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 기술 스택

- 프론트엔드: Svelte 5 (runes) + Vite + MapLibre GL JS + Canvas
- 백엔드: Cloudflare Workers + Hono + Durable Objects (WebSocket Hibernation)
- 전역 방 인덱스: Cloudflare D1 (핀 메타데이터만)
- 방별 픽셀 데이터: 각 방 DO의 SQLite
- 공유 타입/검증: TypeScript + Zod (`shared/`)

## 디렉터리

```
shared/   순수 TS 코어 (geohash, haversine, location gate, snapshot codec, Zod protocol)
worker/   Hono API + RoomDurableObject + D1 migration
client/   Svelte 5 SPA (지도, 보드, WebSocket, 상태)
tools/    seed 생성기, WebSocket 스모크 스크립트
```

## 개발

```bash
pnpm install
pnpm db:migrate:local      # 로컬 D1 마이그레이션
pnpm db:seed:local         # 데모 방 시드 (서울역 인근)
pnpm dev                   # http://localhost:5173
```

`pnpm dev`는 Vite(클라이언트 HMR) + Cloudflare 플러그인(Worker + DO + 로컬 D1)을 한 번에 띄운다.

### 스모크 테스트 (수동)

```bash
node tools/ws-smoke.mjs    # join → paint → 브로드캐스트 / 게이트 거부 확인
```

## 품질 게이트

프로젝트 방침상 자동 테스트는 최소화한다. 대신:

```bash
pnpm check                 # svelte-check + tsc 타입 검증
```

와 두 개의 브라우저 탭/`tools/ws-smoke.mjs`로 실시간 동작을 수동 확인한다.

## 배포 (요약)

1. Cloudflare에 D1 데이터베이스 생성 후 `wrangler.toml`의 `database_id` 교체.
2. `pnpm db:migrate:remote`.
3. 타일 제공자/약관 확인 후 `MAP_STYLE_URL` 설정(미설정 시 OSM 래스터 폴백 — 저트래픽 전용).
4. `pnpm deploy`.

## 사람 확인 (Cloudflare Turnstile)

쓰기 작업(픽셀/도장/이름변경/방생성)에만 사람 확인을 요구한다. 랜딩 → `/verify`(Turnstile) →
`/app` 진입 게이트 + 쓰기 경로 서버 검증의 2계층. 설정·검증·보안 설계는
[`docs/TURNSTILE.md`](docs/TURNSTILE.md) 참고. 로컬은 테스트 키로 바로 동작하며,
운영은 `wrangler secret put TURNSTILE_SECRET_KEY`로 secret을 주입한다.

## 프라이버시

원본 좌표와 원본 IP는 저장하지 않는다. 위치는 쓰기 권한 판정 순간에만 쓰고 버리며,
저장 식별자는 지오해시 셀 ID만 사용한다. 좌표는 로그에도 남기지 않는다.

지도에는 OSM 및 타일 제공자 attribution이 항상 표시된다.
