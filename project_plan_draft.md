# PLAN.md - 위치 기반 픽셀 드로잉 작업 계획서

이 문서는 위치 기반 픽셀 드로잉 프로젝트의 단일 진실 원천(single source of truth)이다. 주 작업자는 Claude Code이며, Claude는 코드를 작성하기 전에 반드시 이 문서와 `CLAUDE.md`를 읽고 현재 Phase 범위 안에서만 작업한다.

작성 기준일: 2026-06-14

## 0. 운영 원칙

- 주 작업자: Claude Code.
- 보조 역할: Codex/GPT 등 다른 에이전트는 기획 보강, 리뷰, 테스트 설계, 문서 정리 보조로만 둔다.
- 구현 단위: 한 번에 한 Phase만 진행한다. "Phase N만 구현"이라고 명시해서 Claude에게 넘긴다.
- 문서 우선: 기능을 바꾸면 `PLAN.md`, AI 규칙을 바꾸면 `CLAUDE.md`, 작업 이력을 바꾸면 `history.md`를 갱신한다.
- 신뢰 경계: 위치 게이팅, 쿨다운, 메시지 검증은 서버(Durable Object)에서 강제한다. 클라이언트 UI는 힌트일 뿐이다.
- 프라이버시: 원본 좌표와 원본 IP는 저장하지 않는다. 위치는 권한 판정 순간에만 쓰고 버린다. 저장 식별자는 지오해시 셀 ID만 사용한다.
- 비용 원칙: v1은 Cloudflare 무료/저비용 구조로 데모 가능한 수준을 목표로 한다. 실제 공개 전에 Cloudflare 및 지도 타일 정책을 다시 확인한다.

## 1. 한 줄 정의

지도 위의 한 지점이 곧 하나의 픽셀 보드 방이 되고, 여러 명이 동시에 같은 보드에 픽셀을 찍는 위치 기반 실시간 멀티플레이어 낙서 서비스.

## 2. 핵심 컨셉

- 장소 = 방 = Durable Object 인스턴스.
- 지도 위 한 지점(식당, 골목, 광장, 지하철역 등)이 하나의 픽셀 보드 방이다.
- 읽기는 오픈이다. 누구나 지도를 돌아다니며 전 세계의 낙서를 구경할 수 있다.
- 쓰기는 위치 게이팅이다. 새 방을 만들거나 기존 방에 픽셀을 찍으려면 사용자가 그 위치에 실제로 있어야 한다.
- 방은 어디서나 생긴다. 명소든 골목이든 좌표만 있으면 방이 된다.
- 분탕과 음란물 억제는 단일 기능이 아니라 여러 장벽의 합으로 달성한다.
- 픽셀 단위라 정교한 이미지 제작이 어렵다.
- 쿨다운 때문에 혼자 빠르게 완성하기 어렵다.
- 위치 게이팅 때문에 원거리 무차별 공격이 어렵다.
- 남이 덮어쓸 수 있으므로 시간이 지나면 자연 정화된다.
- 신고/관리 기능은 v2로 미루되, v1 구조가 나중에 관리 기능을 막지 않게 만든다.

## 2-1. 참고 서비스에서 가져올 좋은 점

참고 대상: `wplace.live`

가져올 방향:

- 첫인상이 명확해야 한다. `Paint the world`처럼 한 문장으로 게임의 정체성을 보여준다. 이 프로젝트는 위치 기반이므로 `Paint your place`, `Paint the places around you`, `장소마다 하나의 픽셀 보드` 같은 방향으로 잡는다.
- 지도 자체가 게임판이어야 한다. 랜딩 이후 첫 플레이 화면은 실제 지도와 방 핀, 그리고 픽셀 보드로 이어져야 한다.
- 공간 경쟁을 재미로 인정한다. 남의 그림 위에 덧칠하고, 지키고, 되찾는 것은 정상 플레이의 일부다.
- griefing의 기준을 분명히 한다. 순수하게 괴롭히거나 무작위로 망치는 행동은 금지하고, 영토 분쟁/스타일 변경/정화 활동과 구분한다.
- map cleanup을 좋은 플레이로 인정한다. 스팸, 부적절한 그림, 반복 패턴을 지우는 행위는 정상적인 커뮤니티 정화로 본다.
- 규칙을 숨기지 않는다. 첫 방문 또는 메뉴에서 Rules modal을 열 수 있어야 한다.
- leaderboard는 장기 동기부여가 된다. v1.5는 방/근처 지역 기준, v2는 국가/플레이어/동맹 기준으로 확장한다.
- charges/droplets 같은 자원 UI는 쿨다운을 게임처럼 이해시키는 데 좋다. v1에서는 유료 재화가 아니라 `paint charge` 또는 `charge ready` UI로만 사용한다.

그대로 가져오지 않을 것:

- v1에서 결제/상점/Droplets 유료 충전은 만들지 않는다.
- v1에서 계정, 플레이어 랭킹, 동맹 시스템은 만들지 않는다.
- v1에서 국가 단위 리더보드는 만들지 않는다.
- 타 서비스의 문구/브랜드/시각 요소를 복제하지 않는다. 위치 기반 서비스의 고유한 표현으로 바꾼다.

## 3. 사용자와 핵심 시나리오

### 3-1. 사용자 유형

- 구경하는 사람: 지도 위의 여러 방을 둘러보고 인기 있는 보드를 열람한다.
- 현장 참여자: 실제 위치 근처에서 방을 만들거나 픽셀을 찍는다.
- 이벤트/장소 운영자(v2): 특정 장소의 보드를 고정하거나 보호하고 싶어 한다.
- 관리자(v2): 신고된 보드를 숨기거나 제한한다.

### 3-2. 핵심 사용자 흐름

1. 사용자가 앱을 연다.
2. 첫 방문자에게 랜딩/온보딩 화면을 보여주고, 지도 열기/내 위치 주변에서 그리기/규칙 보기 CTA를 제공한다.
3. 지도 화면이 뜨고 현재 viewport 안의 방 목록을 조회한다.
4. 방 핀을 누르거나 빈 위치를 눌러 방에 들어간다.
5. 방 Durable Object에 WebSocket으로 연결한다.
6. 서버가 현재 보드 스냅샷과 접속자 수, 쓰기 가능 여부, 쿨다운 상태를 보낸다.
7. 사용자가 위치 권한을 허용하고 반경 안에 있으면 픽셀을 찍을 수 있다.
8. 픽셀 변경은 같은 방에 접속한 모두에게 즉시 브로드캐스트된다.
9. 연결이 끊기면 자동 재연결하고, 재연결 후 스냅샷으로 상태를 복구한다.

## 4. v1 기능 상세

### 4-0. 랜딩 / 온보딩

- 첫 방문자는 곧바로 지도에 던져지지 않고, 서비스 정체성을 보여주는 랜딩 화면을 먼저 본다.
- 랜딩은 마케팅 페이지가 아니라 게임 시작 화면이다.
- H1은 서비스명 또는 핵심 오퍼다. 예: `Geo Pixel Board`, `Paint your place`, `장소마다 하나의 픽셀 보드`.
- 배경은 실제 지도/픽셀 보드 미리보기 또는 몰입형 앱 장면을 사용한다. 순수 gradient/SVG 장식만으로 만들지 않는다.
- 주요 CTA:
- `지도 열기`
- `내 위치 주변에서 그리기`
- `규칙 보기`
- 위치 권한은 랜딩 진입 즉시 요구하지 않는다. `내 위치 주변에서 그리기`를 누를 때 요청한다.
- 재방문자는 localStorage의 `seenLanding` 상태에 따라 바로 지도로 들어갈 수 있다.
- 앱 안 메뉴에서 소개/규칙을 다시 열 수 있어야 한다.
- 랜딩에서 전달할 메시지:
- 누구나 전 세계 장소의 보드를 볼 수 있다.
- 그 장소 근처에 있을 때만 그릴 수 있다.
- 덧칠과 영토 싸움은 정상 플레이의 일부다.
- 악의적 훼손, 부적절한 콘텐츠, 봇은 금지된다.
- 원본 좌표는 저장하지 않는다.

### 4-1. 지도 탐색

- 초기 진입 시 현재 위치 권한을 요청하지 않는다. 읽기는 오픈이므로 지도부터 보여준다.
- 초기 지도 중심은 기본값(예: 서울역 또는 최근 본 위치를 localStorage에 저장한 값)으로 둔다.
- 지도 이동/줌 후 300~500ms 디바운스로 `GET /api/rooms?bbox=...`를 호출한다.
- 방 핀은 최소 세 상태를 가진다.
- 일반 방: pixel_count가 낮거나 최근 활동이 적은 방.
- 핫 방: 최근 활동이 있거나 접속자가 많은 방.
- 빈 셀 후보: 사용자가 지도를 탭했지만 아직 방이 없는 셀.
- 핀 렌더링은 MapLibre 레이어 또는 HTML marker 중 하나로 시작한다. v1은 구현 단순성을 우선하고, 핀이 수백 개 이상으로 늘면 GeoJSON source + symbol/circle layer로 전환한다.
- 지도를 너무 빠르게 움직일 때 이전 요청 결과가 늦게 도착하면 최신 bbox 요청만 반영한다.

### 4-2. 방 입장

- 방 ID는 지오해시 precision 8 기본값을 사용한다.
- 사용자가 기존 핀을 누르면 해당 roomId로 들어간다.
- 사용자가 빈 위치를 누르면 해당 좌표를 지오해시로 변환하고 "새 방 만들기" 흐름으로 들어간다.
- 방 화면은 지도 위 패널 또는 전체 화면 보드 모드로 전환한다.
- 입장 직후에는 보기 전용 상태이며, Geolocation 확인 후에만 쓰기 가능 상태로 바뀐다.
- Geolocation 권한 거부, 낮은 accuracy, 반경 밖, 쿨다운 중, 서버 오류를 각각 다른 상태로 보여준다.

### 4-3. 픽셀 보드

- 보드는 64 x 64 칸으로 시작한다.
- 픽셀 데이터는 DOM 엘리먼트가 아니라 단일 `<canvas>`에 그린다.
- 캔버스 렌더러는 Svelte 바깥의 명령형 모듈로 두고, Svelte는 상태와 컨트롤만 담당한다.
- 보드 확대/축소는 CSS transform 또는 캔버스 내부 scale로 처리한다. v1은 단순성을 위해 "fit to panel + 클릭 좌표 변환"부터 구현한다.
- 빈 픽셀은 `EMPTY = 255`로 표현한다.
- 색상은 0~15 팔레트 인덱스만 허용한다.
- 클라이언트는 optimistic paint를 하지 않는다. 서버 `ack.ok=true` 또는 `pixel` 브로드캐스트를 받은 뒤 반영한다. 데모 체감이 느리면 본인에게만 pending overlay를 추가한다.

### 4-4. 색 팔레트

- v1 팔레트는 16색 고정이다.
- 자유 RGB, 투명도, 브러시 크기, fill tool은 금지한다.
- 팔레트는 어둡고 밝은 색을 섞어 지도와 분리되게 만든다.
- `shared/palette.ts`를 단일 출처로 두고 클라이언트 렌더러, 테스트, MCP preview 도구가 함께 사용한다.
- 색상 토큰은 디자인 시스템 토큰과 분리한다. UI 색상 변경이 픽셀 아트 팔레트를 바꾸면 안 된다.

### 4-5. 쓰기 게이팅

- join 시 위치를 한 번 전송해 `canWrite`를 판단한다.
- paint 시 위치를 다시 전송하고 서버가 다시 검증한다.
- 기본 쓰기 반경은 방 중심에서 100m 이내다.
- 기본 accuracy 요구는 `accuracy <= 100m`이다.
- accuracy가 100m보다 크면 `reason: "low_accuracy"`로 거부한다.
- 반경 밖이면 `reason: "out_of_range"`로 거부한다.
- 위치 값은 로그에도 남기지 않는다. 디버그가 필요하면 거리/정확도 판정 결과만 남긴다.
- 브라우저 위치 위조는 v1에서 완전히 막지 않는다. v2에서 추가 방어를 설계한다.

### 4-6. 쿨다운

- 기본값은 5초/픽셀이다.
- UI에서는 쿨다운을 단순 타이머가 아니라 `paint charge` 개념으로 보여줄 수 있다. 예: `1 charge ready`, `next charge in 4.2s`.
- v1의 charge는 결제 재화가 아니다. 서버 쿨다운 상태를 사용자가 이해하기 쉽게 표현하는 UI일 뿐이다.
- 쿨다운은 DO 메모리/스토리지에서 connection 또는 ephemeral session 단위로 관리한다.
- 로그인 없는 v1에서는 완전한 사용자 식별이 없으므로 쿨다운은 best-effort이다.
- 새로고침으로 쿨다운을 쉽게 우회하지 않도록 WebSocket connection에 임시 sessionId를 부여하고, 필요하면 `localStorage`의 익명 sessionId를 함께 사용한다.
- 익명 sessionId는 보안 식별자가 아니며 남용 방지 보조 수단으로만 취급한다.

### 4-7. 방 생성

- 빈 셀 탭 시 지오해시를 계산하고 D1에 방이 없으면 생성 후보로 보여준다.
- 쓰기 가능 위치가 확인되어야 방 생성이 가능하다.
- 방 생성 시 D1 `rooms`에 먼저 insert하고, DO는 첫 입장 또는 첫 paint 때 내부 SQLite를 초기화한다.
- 방 이름은 v1에서 선택 사항이다.
- 기본 이름은 `Cell {geohash}` 또는 근처 장소명이 없으면 빈 값으로 둔다.
- 장소명 자동 조회는 v1에서 하지 않는다. 외부 geocoding API 정책/비용이 끼어들기 때문이다.
- 방 생성 스팸 방지는 v1에서 "위치 게이팅 + UI 확인 + 쿨다운"으로 시작하고, 필요하면 v1.5에 Cloudflare Turnstile을 추가한다.

### 4-8. 실시간 협업

- WebSocket은 `/ws/:roomId`로 연결하고 Worker가 해당 DO로 라우팅한다.
- 입장 시 스냅샷은 1회 전송한다.
- 이후 변경은 `{ t: "pixel", x, y, color }` 한 칸 메시지만 브로드캐스트한다.
- 접속자 수는 join/close/reconnect 때 `{ t: "presence", online }`로 전송한다.
- 재연결 시 클라이언트는 마지막 상태를 믿지 말고 snapshot을 다시 받는다.
- WebSocket Hibernation을 사용해 유휴 연결 비용을 줄인다.

### 4-9. 오류와 빈 상태

- 위치 권한 거부: 보기는 가능, 쓰기 불가.
- 위치 정확도 낮음: "정확도가 낮아 쓰기 불가" 상태. 재시도 버튼 제공.
- 반경 밖: "이 장소 근처에서만 그릴 수 있음" 상태.
- WebSocket 끊김: 자동 재연결, 재연결 중에는 그리기 비활성화.
- D1 조회 실패: 지도는 유지하고 핀만 오류 상태로 둔다.
- 타일 로드 실패: 지도 영역에 재시도/대체 문구 표시.
- 방이 비어 있음: 빈 캔버스와 첫 픽셀 유도 UI.

### 4-10. 반응형과 접근성

- 모바일 우선으로 설계한다. 실제 위치 기반 앱이라 모바일 사용이 더 자연스럽다.
- 방 화면에서는 캔버스, 팔레트, 쿨다운, 권한 상태가 한 화면에서 보여야 한다.
- 데스크톱에서는 지도와 보드를 나란히 두는 split layout을 허용한다.
- 버튼에는 텍스트만 긴 문장으로 넣지 말고 아이콘 + tooltip 또는 짧은 라벨을 사용한다.
- 캔버스에는 스크린리더용 요약 텍스트를 별도 제공한다.
- 색상만으로 상태를 구분하지 않는다.

### 4-11. 규칙 모달

- 랜딩과 앱 메뉴에서 Rules modal을 열 수 있다.
- 규칙은 짧고 명확해야 하며, 금지/허용을 구분한다.
- Prohibited:
- 성적/혐오/불법 콘텐츠 금지.
- 개인정보 노출 금지.
- 특정 사용자를 괴롭히기 위한 무작위 훼손 금지.
- 봇/자동화/다중 계정 남용 금지.
- Allowed:
- 공간 경쟁과 덧칠은 정상 플레이.
- 자기 그림을 지키거나 되찾는 것도 정상 플레이.
- 스팸/부적절한 그림 정화는 정상 플레이.
- Location rule:
- 보기는 누구나 가능.
- 그리기는 해당 장소 근처에서만 가능.
- 원본 좌표는 저장하지 않는다.

## 5. v2로 미루는 기능

- 명소 앵커 핀 사전 등록.
- 지하철역/학교/공원 같은 장소 카탈로그.
- 건물주/장소 운영자 인증.
- 방 보호 또는 그리기 제한.
- R2 썸네일 PNG 캐싱.
- undo 또는 제한적 되돌리기.
- 신고/관리자 대시보드.
- 음란물/혐오 이미지 자동 감지.
- 위치 위변조 방어 강화.
- 이벤트 모드(특정 시간 동안만 열리는 보드).
- 계정, 프로필, 랭킹.
- 플레이어/동맹/국가 단위 leaderboard.
- Store, 결제, 유료 Droplets/charges.
- 동맹(Alliance), Discord 연동, 커뮤니티 조직 기능.
- 투명 픽셀 또는 cleanup 전용 도구. 단, 규칙 문구로는 v1에서 먼저 설명할 수 있다.
- push 알림.

## 6. 기술 스택

| 영역 | 선택 | 메모 |
| --- | --- | --- |
| 언어 | TypeScript strict | 클라이언트/워커/공유 타입 통일 |
| 패키지 매니저 | pnpm 권장 | Claude가 lockfile을 안정적으로 관리하게 함 |
| 프론트 | Svelte 5 runes | `$state`, `$derived`, `$effect`, `$props`만 사용 |
| 빌드 | Vite | SPA + Worker 개발 통합 |
| 지도 | MapLibre GL JS | WebGL 기반 인터랙티브 지도 |
| 지도 타일 | OSM 데이터 기반 타일 | `tile.openstreetmap.org`는 데모/저트래픽에서만 신중히 사용 |
| 픽셀 보드 | Canvas API | 단일 canvas 직접 렌더 |
| 백엔드 | Cloudflare Workers + Hono | 정적 파일, API, WebSocket 라우팅 |
| 방 로직 | Cloudflare Durable Objects | 방 단위 직렬화, WebSocket, SQLite |
| 전역 인덱스 | Cloudflare D1 | 방 목록과 지도 핀 조회 |
| 배포 | Wrangler | local dev, migration, deploy |
| 테스트 | Vitest + Cloudflare Workers Vitest pool + Playwright | 유닛/워커 통합/E2E |
| 런타임 검증 | Zod + @hono/zod-validator | API/WS 메시지 검증 |
| 아이콘 | lucide-svelte | UI 버튼/상태 아이콘 |
| AI 작업자 | Claude Code | Phase 단위 구현, MCP 보조 |

## 7. 권장 라이브러리와 도구

### 7-1. 필수 패키지 후보

```txt
typescript
vite
svelte
@sveltejs/vite-plugin-svelte
@cloudflare/vite-plugin
wrangler
hono
zod
@hono/zod-validator
maplibre-gl
lucide-svelte
vitest
@cloudflare/vitest-pool-workers
@playwright/test
svelte-check
eslint
prettier
typescript-eslint
```

### 7-2. MCP 서버 개발 패키지 후보

```txt
@modelcontextprotocol/sdk
zod
tsx
vitest
pngjs
```

`pngjs`는 MCP의 보드 preview 도구가 PNG를 만들 때만 사용한다. v1 앱 런타임에는 넣지 않는다.

### 7-3. 신중히 쓸 것

- Tailwind CSS: 빠른 UI 구현에는 좋지만, 작은 앱에서는 CSS custom properties와 일반 CSS만으로 충분할 수 있다. 도입하면 디자인 토큰과 컴포넌트 규칙을 먼저 정한다.
- Drizzle ORM: D1 스키마가 커질 때만 검토한다. v1은 SQL이 단순하므로 raw prepared statements가 낫다.
- geohash 외부 라이브러리: 클라이언트/서버 결과가 완전히 같아야 하므로 `shared/geo/geohash.ts`에 작은 구현을 두고 golden test를 작성한다. 필요하면 `latlon-geohash` 같은 라이브러리는 테스트 비교용 dev dependency로만 쓴다.
- Turf.js: 거리 계산 하나 때문에 넣기엔 무겁다. v1은 Haversine 함수를 직접 구현한다.
- Yjs/Automerge: 이 프로젝트는 CRDT가 필요 없다. 한 칸 last-write-wins로 충분하다.
- PartyKit/PartyServer: DO/WebSocket 학습 비용을 줄여주지만, v1은 Cloudflare DO 구조를 직접 이해하고 구현하는 것이 목적에 맞다.

### 7-4. 외부 서비스 후보

- Cloudflare Turnstile: 방 생성/그리기 남용이 보이면 v1.5에 추가한다.
- Sentry 또는 Highlight.io: 공개 테스트 이후 오류 추적용. v1 로컬 데모에는 필수 아님.
- MapTiler, Stadia, Geoapify, OpenFreeMap 등 타일 제공자: 공개 배포 전에 약관과 무료 한도를 비교한다.

## 8. 지도 타일 정책

- OpenStreetMap 데이터는 자유롭게 사용할 수 있지만, OpenStreetMap Foundation의 공개 타일 서버는 무료 CDN이 아니다.
- `tile.openstreetmap.org`는 저트래픽 개발/데모에서만 조심해서 사용한다.
- 공개 서비스 또는 반복 테스트 트래픽이 생기면 별도 타일 제공자, 자체 tile cache, 또는 OSM 기반 vector tile 서비스를 사용한다.
- 지도에는 반드시 OSM 및 타일 제공자 attribution을 표시한다.
- Claude는 타일 URL을 하드코딩할 때 제공자 약관을 확인한 뒤 `MAP_STYLE_URL` 환경 변수 또는 설정 파일로 분리한다.

## 9. 스토리지 2층 구조

이 프로젝트의 핵심 설계 포인트다. 두 층의 역할이 명확히 다르다.

### 9-1. 전역 방 인덱스 - D1

- "어떤 지오해시 셀에 방이 있는지"를 가진 전역 테이블.
- 지도에 핀을 뿌릴 때 현재 보는 영역(bounding box) 단위로 조회한다.
- 방의 픽셀 데이터 자체는 여기 두지 않는다.
- 핀 표현에 필요한 가벼운 메타데이터만 둔다.

```sql
CREATE TABLE rooms (
  geohash       TEXT PRIMARY KEY,
  precision     INTEGER NOT NULL DEFAULT 8,
  center_lat    REAL NOT NULL,
  center_lng    REAL NOT NULL,
  name          TEXT,
  pixel_count   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_drawn_at INTEGER NOT NULL,
  last_seen_at  INTEGER
);

CREATE INDEX idx_rooms_bbox ON rooms (center_lat, center_lng);
CREATE INDEX idx_rooms_recent ON rooms (last_drawn_at DESC);
```

필드 메모:

- `geohash`: 방 ID. D1 PK이자 DO name.
- `precision`: 나중에 precision 7/8 실험을 쉽게 하기 위한 값.
- `center_lat`, `center_lng`: 셀 중심 좌표. 원본 사용자 좌표가 아니라 지오해시 셀에서 계산한 대표 좌표다.
- `name`: v1에서는 nullable.
- `pixel_count`: 칠해진 고유 칸 수. overwrite는 count 증가 없음.
- `last_seen_at`: 선택. 사용자가 방을 열어본 시각 기반 핫스팟에 쓸 수 있으나 v1에서는 없어도 된다.

### 9-2. 방별 픽셀 데이터 - 각 방 DO의 SQLite

- 방마다 격리된다.
- 해당 방에 WebSocket으로 입장해야만 로드한다.
- 같은 칸 재입력은 last-write-wins다.

```sql
CREATE TABLE IF NOT EXISTS pixels (
  x          INTEGER NOT NULL,
  y          INTEGER NOT NULL,
  color      INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (x, y)
);

CREATE TABLE IF NOT EXISTS room_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL
);
```

`room_meta`는 schema version, board size, palette version 같은 아주 작은 값만 둔다.

## 10. 지오해시와 위치 계산

### 10-1. 방 ID 규칙

- 좌표를 지오해시 precision 8로 양자화한 문자열을 방 ID로 사용한다.
- precision 8은 대략 건물 앞/가게 앞 단위로 시작하기 좋다.
- 더 넓은 골목/광장 단위를 원하면 precision 7로 바꾼다.
- `DurableObjectNamespace.idFromName(geohash)`로 DO를 특정한다.

### 10-2. 거리 계산

- 서버에서 Haversine 거리 계산을 수행한다.
- 입력값은 `lat`, `lng`, `acc`다.
- `acc`는 브라우저 Geolocation `coords.accuracy` 값(미터)을 사용한다.
- 쓰기 허용 조건 기본값:

```txt
acc <= 100m
distance(user_position, room_center) <= 100m
```

### 10-3. 좌표 저장 금지

- D1에는 지오해시 셀 중심 좌표만 저장한다.
- DO SQLite에도 사용자 원본 좌표를 저장하지 않는다.
- 로그에도 `lat`, `lng` 원본을 쓰지 않는다.
- 디버깅 로그가 필요하면 `distance_bucket`, `accuracy_bucket`, `decision` 정도만 남긴다.

## 11. 게임 규칙 기본값

| 항목 | 기본값 | 메모 |
| --- | --- | --- |
| 보드 크기 | 64 x 64 | 4,096 픽셀 |
| 빈 픽셀 값 | 255 | 팔레트 인덱스 0~15와 충돌 방지 |
| 색 팔레트 | 16색 고정 | 자유 RGB 금지 |
| 쿨다운 | 5초/픽셀 | 데모 체감 우선 |
| 쓰기 반경 | 100m | Geolocation 오차 감안 |
| accuracy 요구 | 100m 이하 | 부정확한 측위 거부 |
| 최대 메시지 크기 | 16KB 이하 목표 | snapshot도 작게 유지 |
| paint rate limit | connection별 초당 1개 이하 | 쿨다운 외 flood 방지 |

## 12. WebSocket 메시지 프로토콜

JSON 텍스트 프레임을 사용한다. `t`는 타입이다.

### 12-1. 클라이언트 -> 서버

```json
{ "t": "join", "lat": 37.5547, "lng": 126.9706, "acc": 24.0 }
```

```json
{ "t": "paint", "x": 12, "y": 30, "color": 7, "lat": 37.5547, "lng": 126.9706, "acc": 24.0 }
```

```json
{ "t": "ping", "clientTime": 1781449200000 }
```

### 12-2. 서버 -> 클라이언트

```json
{
  "t": "snapshot",
  "w": 64,
  "h": 64,
  "paletteVersion": 1,
  "pixels": "<base64-encoded Uint8Array, length 4096>",
  "canWrite": true,
  "cooldownMs": 0,
  "online": 5
}
```

```json
{ "t": "pixel", "x": 12, "y": 30, "color": 7, "updatedAt": 1781449200000 }
```

```json
{ "t": "ack", "ok": true, "cooldownMs": 5000 }
```

```json
{ "t": "ack", "ok": false, "reason": "cooldown", "cooldownMs": 3200 }
```

```json
{ "t": "ack", "ok": false, "reason": "out_of_range" }
```

```json
{ "t": "ack", "ok": false, "reason": "low_accuracy" }
```

```json
{ "t": "presence", "online": 6 }
```

```json
{ "t": "pong", "serverTime": 1781449200100 }
```

### 12-3. 메시지 검증 규칙

- `x`, `y`는 정수이며 `0 <= x < BOARD_W`, `0 <= y < BOARD_H`여야 한다.
- `color`는 정수이며 `0 <= color <= 15`여야 한다.
- `lat`, `lng`, `acc`는 paint 메시지마다 필요하다.
- 알 수 없는 `t`는 무시하지 말고 error ack를 보낸다.
- Zod schema를 `shared/protocol.ts`에 두고 클라이언트/서버/MCP가 같이 쓴다.

## 13. HTTP API

### 13-1. Health

```http
GET /api/health
```

응답:

```json
{ "ok": true, "version": "0.1.0" }
```

### 13-2. 방 조회

```http
GET /api/rooms?minLat=...&minLng=...&maxLat=...&maxLng=...
```

응답:

```json
{
  "rooms": [
    {
      "geohash": "wydm9q8h",
      "precision": 8,
      "centerLat": 37.5547,
      "centerLng": 126.9706,
      "name": null,
      "pixelCount": 18,
      "lastDrawnAt": 1781449200000
    }
  ]
}
```

### 13-3. 방 생성

```http
POST /api/rooms
```

요청:

```json
{ "lat": 37.5547, "lng": 126.9706, "acc": 24.0, "name": null }
```

응답:

```json
{ "ok": true, "geohash": "wydm9q8h" }
```

주의:

- 방 생성 API도 위치 게이팅을 적용한다.
- 이미 존재하면 200 또는 409 중 하나를 정한다. v1은 idempotent하게 200 + 기존 geohash 반환을 권장한다.

### 13-4. WebSocket 라우트

```http
GET /ws/:roomId
Upgrade: websocket
```

Worker는 roomId를 검증하고 해당 DO로 request를 전달한다.

## 14. Worker와 Durable Object 구조

### 14-1. Worker 책임

- 정적 asset 서빙.
- `/api/health`.
- `/api/rooms` D1 조회.
- `/api/rooms` 생성.
- `/ws/:roomId`를 해당 Durable Object로 라우팅.
- API input validation.
- 공통 error response.

### 14-2. Durable Object 책임

- WebSocket accept.
- WebSocket Hibernation API 사용.
- join/paint/ping 메시지 처리.
- 위치 게이팅과 쿨다운 강제.
- DO SQLite 초기화.
- snapshot 생성.
- pixel upsert.
- 같은 방 연결들에 브로드캐스트.
- D1 room metadata 갱신(pixel_count, last_drawn_at).

### 14-3. D1 갱신 방식

- DO는 paint 성공 시 D1을 갱신한다.
- overwrite인지 신규 칸인지 확인한 뒤 신규 칸이면 `pixel_count += 1`.
- 모든 성공 paint는 `last_drawn_at = now` 갱신.
- D1 갱신이 실패해도 픽셀 저장은 이미 성공했을 수 있다. 이 경우 DO 로그에 metadata sync 실패만 남기고, 나중에 repair 도구로 복구 가능하게 한다.

## 15. 프로젝트 구조

```txt
geo-pixel-board/
├── PLAN.md
├── DESIGN.md
├── CLAUDE.md
├── history.md
├── package.json
├── pnpm-workspace.yaml
├── wrangler.toml
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .mcp.json
│
├── client/
│   └── src/
│       ├── lib/
│       │   ├── map/
│       │   │   ├── mapController.ts
│       │   │   ├── roomLayer.ts
│       │   │   └── mapStyle.ts
│       │   ├── board/
│       │   │   ├── boardRenderer.ts
│       │   │   ├── boardMath.ts
│       │   │   └── snapshotCodec.ts
│       │   ├── ws/
│       │   │   ├── roomSocket.ts
│       │   │   └── reconnect.ts
│       │   ├── geo/
│       │   │   └── browserLocation.ts
│       │   └── state/
│       │       ├── appState.svelte.ts
│       │       └── roomState.svelte.ts
│       ├── components/
│       │   ├── MapView.svelte
│       │   ├── RoomPanel.svelte
│       │   ├── PixelBoard.svelte
│       │   ├── Palette.svelte
│       │   ├── Cooldown.svelte
│       │   └── PermissionBanner.svelte
│       ├── App.svelte
│       └── main.ts
│
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── rooms.ts
│   │   ├── room-do.ts
│   │   ├── env.ts
│   │   └── errors.ts
│   └── migrations/
│       └── 0001_create_rooms.sql
│
├── shared/
│   ├── constants.ts
│   ├── palette.ts
│   ├── protocol.ts
│   ├── geo.ts
│   └── room.ts
│
├── tests/
│   ├── unit/
│   ├── worker/
│   └── e2e/
│
└── tools/
    └── mcp/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── server.ts
            ├── tools/
            │   ├── geo.ts
            │   ├── protocol.ts
            │   ├── schema.ts
            │   ├── boardPreview.ts
            │   ├── privacyScan.ts
            │   └── phaseGuard.ts
            └── resources.ts
```

## 16. 테스트 전략

### 16-1. 유닛 테스트

- 지오해시 encode/decode golden cases.
- 지오해시 center/bounds 계산.
- Haversine 거리 계산.
- location gate 판정.
- cooldown 계산.
- snapshot encode/decode.
- board coordinate transform.
- Zod protocol schema.
- D1 SQL helper.

### 16-2. Worker 통합 테스트

Cloudflare Workers Vitest integration을 사용한다.

- `/api/health` 응답.
- `/api/rooms` bbox validation.
- rooms migration 적용.
- 방 생성 idempotency.
- WebSocket upgrade 라우팅.
- DO snapshot 초기화.
- paint 성공/실패 reason.
- 신규 픽셀과 overwrite의 pixel_count 차이.

### 16-3. E2E 테스트

Playwright를 사용한다.

- 앱 로드 후 지도 컨테이너 렌더.
- mock geolocation으로 쓰기 가능 상태 진입.
- 두 브라우저 context가 같은 방에 접속.
- 한쪽에서 픽셀을 찍으면 다른 쪽 canvas 픽셀이 바뀜.
- 위치 권한 거부 시 보기 전용.
- 낮은 accuracy mock 시 쓰기 거부.
- 모바일 viewport에서 UI 겹침 없음.

### 16-4. 수동 검증

- 로컬 `wrangler dev` 또는 Vite dev 서버 실행.
- 실제 브라우저 두 개로 같은 방 접속.
- 네트워크 탭에서 snapshot 1회 + pixel delta 흐름 확인.
- 콘솔에 원본 좌표 로그가 없는지 확인.
- 타일 attribution이 보이는지 확인.

## 17. 보안, 프라이버시, 남용 방지

### 17-1. v1 보안 기준

- 모든 API input은 Zod 또는 명시적 validator로 검증한다.
- WebSocket 메시지는 parse 실패 시 연결 종료 또는 error ack.
- roomId는 지오해시 문자셋/길이 검증 후 사용한다.
- SQL은 prepared statement만 사용한다.
- 좌표 원본은 저장하지 않는다.
- 서버 로그에 좌표 원본을 남기지 않는다.
- CORS는 필요할 때만 좁게 연다.
- `wrangler.toml`에 secret을 넣지 않는다.

### 17-2. 남용 방지 기준

- 픽셀은 서버 쿨다운 통과 시에만 저장.
- paint 메시지는 connection별 rate limit.
- 너무 큰 메시지는 즉시 거부.
- 방 생성은 위치 게이팅 통과 시에만 허용.
- 같은 지오해시 방 생성은 idempotent 처리.
- 신고/관리 기능은 v2지만, D1에 `hidden_at`, `hidden_reason`을 나중에 추가할 수 있게 room 조회 코드를 분리한다.

### 17-3. 위치 위조에 대한 현실적 기준

- 브라우저 Geolocation은 신뢰할 수 있는 보안 증명이 아니다.
- v1은 "캐주얼 남용 억제" 수준으로 정의한다.
- v2 후보:
- Cloudflare Turnstile로 자동화 난이도 상승.
- 이벤트 장소 QR/PIN으로 현장성 강화.
- 짧은 시간에 먼 지역 이동 시 soft block.
- 신고 기반 숨김.
- 특정 장소 운영자 보호 모드.

## 18. 디자인 방향

- 사용자 최신 요청에 따라 첫 방문자에게 랜딩/온보딩 화면을 제공한다.
- 랜딩은 별도 마케팅 사이트가 아니라 게임 시작 화면이다. 서비스 정체성, 지도/픽셀 경험, 규칙, CTA가 첫 화면에서 보여야 한다.
- 랜딩 이후의 주요 앱 화면은 실제 지도와 방 핀이다.
- 지도/보드가 주인공이고 UI는 조용하게 보조한다.
- Linear 느낌의 절제된 패널, 버튼, 배너를 참고하되 지도 타일과 픽셀 팔레트는 디자인 토큰으로 덮지 않는다.
- 패널은 8px 이하 radius.
- 카드 안에 카드를 중첩하지 않는다.
- 색상 팔레트가 한 가지 hue로만 보이지 않게 한다.
- 모바일에서 팔레트, 쿨다운, 권한 상태 텍스트가 서로 겹치지 않아야 한다.
- 아이콘은 `lucide-svelte`를 우선한다.
- "사용법 설명문"을 앱 안에 길게 넣지 않는다. 상태와 컨트롤 자체가 이해되게 만든다.

## 19. Claude Code 작업 규칙

이 내용은 `CLAUDE.md`에 그대로 옮긴다.

```md
# CLAUDE.md - Geo Pixel Board

You are the main coding worker for this project.

Read PLAN.md before making code changes. Work only within the requested Phase.

Hard rules:
- Use Svelte 5 runes only: $state, $derived, $effect, $props.
- Do not use Svelte 3/4 syntax: export let, $:, store auto-subscription patterns in component scripts.
- Render the pixel board with one canvas. Never create one DOM element per pixel.
- Keep map rendering and board rendering imperative; let Svelte own UI state and controls.
- Store no raw user coordinates. Use coordinates only for write permission checks, then discard.
- Do not log raw lat/lng.
- Shared protocol types live in shared/protocol.ts and are used by both client and worker.
- Server-side DO enforces location gate and cooldown. Client-side disabled buttons are only UX.
- Implement only the current Phase. Do not build future features early.
- After work, run the relevant checks and append a short entry to history.md.

Default commands:
- pnpm install
- pnpm check
- pnpm test
- pnpm test:worker
- pnpm test:e2e
- pnpm dev
- pnpm deploy
```

### 19-1. Claude handoff prompt template

```txt
Read PLAN.md and CLAUDE.md first.
Implement Phase {N} only.
Do not add v2 features.
Use Svelte 5 runes only.
Preserve privacy rules: do not store or log raw coordinates.
Before finishing, run the checks listed for this Phase and update history.md.
```

### 19-2. Claude 리뷰 prompt template

```txt
Review the current diff against PLAN.md and CLAUDE.md.
Focus on bugs, privacy leaks, Svelte 5 syntax violations, DO/WebSocket correctness, and missing tests.
Do not refactor unrelated code.
Return findings with file/line references first.
```

### 19-3. Claude가 자주 실수할 지점

- Svelte 5 대신 `export let` 또는 `$:`를 쓰는 것.
- 픽셀 칸을 DOM grid로 만드는 것.
- `console.log(lat, lng)`를 남기는 것.
- 클라이언트에서만 쿨다운을 막고 서버 검증을 빠뜨리는 것.
- join 때만 위치를 검증하고 paint 때 재검증하지 않는 것.
- D1에 픽셀 데이터를 저장하는 것.
- R2 썸네일을 v1에 미리 구현하는 것.
- 지도 타일 attribution을 빼먹는 것.

## 20. 프로젝트 전용 MCP 서버 설계

Claude가 주 작업자이므로 프로젝트 전용 MCP 서버를 두면 좋다. 목적은 Claude가 반복적으로 실수하기 쉬운 규칙을 도구화하고, 지오해시/거리/프로토콜/스키마 같은 결정적 계산을 문맥이 아니라 실행 결과로 확인하게 하는 것이다.

서버 이름: `geo-pixel-dev`

실행 방식:

- v1은 local stdio MCP server로 시작한다.
- 프로젝트 루트 밖 파일 접근 금지.
- 외부 네트워크 접근 금지.
- 좌표가 들어오는 tool은 결과에 원본 좌표를 되돌려주지 않거나, 요청자가 명시한 경우에만 echo한다.
- 쓰기 동작은 기본 dry-run이고 `apply: true`가 있을 때만 파일을 수정한다.

### 20-1. MCP resources

| URI | 내용 |
| --- | --- |
| `geo-pixel://plan` | `PLAN.md` 요약과 현재 Phase |
| `geo-pixel://claude-rules` | `CLAUDE.md`의 핵심 금지/필수 규칙 |
| `geo-pixel://protocol/ws` | WebSocket 메시지 schema 요약 |
| `geo-pixel://schema/d1` | D1 rooms schema |
| `geo-pixel://schema/do-sqlite` | DO SQLite schema |
| `geo-pixel://palette/v1` | 16색 팔레트 |
| `geo-pixel://fixtures/seoul` | 서울 테스트 좌표와 예시 geohash |

### 20-2. MCP tools

| Tool | 목적 | 입력 | 출력 | Side effect |
| --- | --- | --- | --- | --- |
| `phase_guard_check` | 요청/변경 파일이 현재 Phase 범위를 벗어나는지 확인 | `phase`, `task`, `changedFiles` | 허용/경고/금지 사유 | 없음 |
| `geo_hash_preview` | 좌표를 room geohash로 변환하고 셀 중심/bounds 계산 | `lat`, `lng`, `precision` | `geohash`, `center`, `bounds` | 없음 |
| `location_gate_check` | 서버와 같은 규칙으로 쓰기 가능 여부 계산 | `roomGeohash`, `lat`, `lng`, `acc` | `canWrite`, `reason`, `distanceM`, `accuracyM` | 없음 |
| `ws_message_validate` | WS 메시지가 schema를 통과하는지 확인 | `direction`, `message` | valid 여부와 오류 목록 | 없음 |
| `snapshot_codec_check` | 픽셀 배열 base64/RLE 인코딩 디코딩 검증 | `w`, `h`, `pixels` | encoded, decoded hash, stats | 없음 |
| `board_preview_png` | snapshot을 PNG preview로 렌더 | `w`, `h`, `pixels`, `scale` | PNG 경로 또는 image bytes | 파일 생성 가능 |
| `d1_schema_check` | migration SQL이 계획의 rooms schema와 맞는지 확인 | `migrationPath` | 차이점과 위험 | 없음 |
| `wrangler_binding_audit` | wrangler.toml의 D1/DO/assets 바인딩 확인 | `wranglerPath` | 누락/오타 목록 | 없음 |
| `privacy_scan` | raw 좌표 저장/로그 패턴 탐지 | `paths` | 파일/라인 findings | 없음 |
| `svelte_runes_scan` | 금지된 Svelte 3/4 문법 탐지 | `paths` | 파일/라인 findings | 없음 |
| `tile_policy_scan` | 타일 URL/attribution 위험 확인 | `paths` | provider, attribution, warning | 없음 |
| `history_append` | 작업 완료 로그를 history.md 상단에 추가 | `summary`, `phase`, `checks`, `apply` | 작성될 markdown 또는 적용 결과 | apply=true일 때 파일 수정 |

### 20-3. MCP prompts

| Prompt | 용도 |
| --- | --- |
| `phase-implement` | Phase 구현 시작용 표준 지시문 생성 |
| `phase-review` | diff 리뷰용 표준 지시문 생성 |
| `privacy-audit` | 좌표 저장/로그 금지 검사용 |
| `protocol-change` | WebSocket protocol 변경 시 체크리스트 생성 |
| `release-check` | 배포 전 확인 목록 생성 |

### 20-4. MCP 서버 구조

```txt
tools/mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts
│   ├── resources.ts
│   ├── prompts.ts
│   ├── projectRoot.ts
│   ├── tools/
│   │   ├── phaseGuard.ts
│   │   ├── geo.ts
│   │   ├── locationGate.ts
│   │   ├── protocol.ts
│   │   ├── snapshotCodec.ts
│   │   ├── boardPreview.ts
│   │   ├── schemaCheck.ts
│   │   ├── wranglerAudit.ts
│   │   ├── privacyScan.ts
│   │   └── history.ts
│   └── shared/
│       └── safePaths.ts
└── tests/
```

### 20-5. `.mcp.json` 예시

처음에는 개인 local scope로 설치하고, 안정화되면 project scope `.mcp.json`에 커밋한다.

```json
{
  "mcpServers": {
    "geo-pixel-dev": {
      "command": "node",
      "args": ["tools/mcp/dist/server.js"],
      "env": {
        "GEO_PIXEL_PROJECT_ROOT": "${CLAUDE_PROJECT_DIR:-.}"
      },
      "timeout": 60000
    }
  }
}
```

### 20-6. Claude에서 MCP를 쓰는 기준

- 지오해시, 거리, snapshot codec처럼 계산 결과가 중요한 작업은 MCP tool을 우선 사용한다.
- Phase 범위가 애매하면 `phase_guard_check`를 먼저 호출한다.
- 마무리 전 `privacy_scan`, `svelte_runes_scan`, `wrangler_binding_audit`를 돌린다.
- MCP 결과가 계획과 다르면 계획이 틀렸는지 코드가 틀렸는지 먼저 판단하고, 둘 중 하나를 명시적으로 고친다.

## 21. 단계별 구현 계획

Claude Code에는 "Phase N만 해라"로 떼어서 지시한다. 한 번에 전체를 시키지 않는다.

### Phase 0 - 스캐폴딩과 개발 파이프라인

산출물:

- pnpm workspace.
- Svelte 5 + Vite client.
- Cloudflare Worker + Hono hello route.
- wrangler.toml.
- D1 binding.
- Durable Object binding.
- D1 migration `0001_create_rooms.sql`.
- `CLAUDE.md`.
- `history.md`.
- 기본 lint/check/test 스크립트.

검증:

- `pnpm install`.
- `pnpm check`.
- `pnpm test`.
- `pnpm dev` 또는 `wrangler dev`에서 빈 페이지 로드.
- `/api/health` 응답.

### Phase 1 - 지도 + 방 인덱스 읽기

산출물:

- MapLibre 지도 표시.
- 지도 스타일 URL 설정 분리.
- OSM/tile attribution 표시.
- `GET /api/rooms?bbox=...` 구현.
- D1 seed script 또는 수동 seed SQL.
- 지도 viewport 변경 시 디바운스 조회.
- 방 핀 렌더.

검증:

- 지도 이동 시 bbox 요청 발생.
- seed된 방만 viewport 안에서 보임.
- 잘못된 bbox query는 400.
- tile attribution 표시.

### Phase 2 - 방 DO + 픽셀 보드 실시간

산출물:

- RoomDurableObject.
- WebSocket 연결.
- DO SQLite `pixels` 초기화.
- snapshot 생성/전송.
- canvas snapshot 렌더.
- paint 메시지 처리.
- pixel 브로드캐스트.
- 16색 팔레트 UI.
- 쿨다운 서버 검증.

검증:

- 두 브라우저에서 같은 방 접속.
- 한쪽 paint가 다른 쪽에 즉시 반영.
- 쿨다운 중 paint는 reject.
- 잘못된 color/x/y reject.
- D1 pixel_count는 신규 칸에서만 증가.

### Phase 3 - 위치 게이팅 + 방 생성

산출물:

- Geolocation 권한 요청 UX.
- join/paint 위치 검증.
- accuracy 체크.
- 빈 셀 탭 -> 방 생성.
- `/api/rooms` POST.
- 반경 밖 보기 전용.

검증:

- mock geolocation으로 반경 안 paint 성공.
- 반경 밖 paint 실패.
- 낮은 accuracy paint 실패.
- 위치 권한 거부 시 보기 가능/쓰기 불가.
- 원본 좌표 로그 없음.

### Phase 4 - presence, 재연결, UI 마감

산출물:

- presence 표시.
- WebSocket 재연결.
- reconnect 후 snapshot 복구.
- 랜딩/온보딩 화면.
- Rules modal.
- cooldown을 paint charge처럼 보여주는 UI 개선.
- 모바일/데스크톱 responsive layout.
- Linear 결 UI 표면 적용.
- 오류/빈 상태 정리.

검증:

- 접속자 수가 join/close에 맞게 변함.
- 연결 끊김 후 재연결 가능.
- 첫 방문자는 랜딩을 보고, CTA로 지도 화면에 진입함.
- Rules modal에서 금지/허용/위치 규칙을 확인할 수 있음.
- 모바일 viewport에서 컨트롤 겹침 없음.
- Playwright E2E 통과.

### Phase 5 - 프로젝트 전용 MCP 서버

산출물:

- `tools/mcp` TypeScript MCP server.
- resources, tools, prompts 구현.
- `geo_hash_preview`, `location_gate_check`, `ws_message_validate`.
- `privacy_scan`, `svelte_runes_scan`.
- local install 문서.

검증:

- Claude Code에서 MCP server 연결.
- geohash/거리 결과가 앱 `shared/geo.ts` 테스트와 일치.
- privacy scan이 의도적 fixture를 잡아냄.
- svelte scan이 `export let` fixture를 잡아냄.

### Phase 6 - 배포와 공개 데모 준비

산출물:

- production wrangler config.
- D1 remote migration.
- tile provider 결정.
- basic analytics/logging.
- README.
- 배포 checklist.

검증:

- `pnpm build`.
- `wrangler deploy`.
- 공개 URL에서 지도/방/paint smoke test.
- 무료 한도/타일 약관 재확인.

## 22. 향후 데이터 모델 확장

v2에서 필요해지면 D1에 다음 필드를 추가한다.

```sql
ALTER TABLE rooms ADD COLUMN hidden_at INTEGER;
ALTER TABLE rooms ADD COLUMN hidden_reason TEXT;
ALTER TABLE rooms ADD COLUMN protected_at INTEGER;
ALTER TABLE rooms ADD COLUMN owner_claim_id TEXT;
ALTER TABLE rooms ADD COLUMN thumbnail_r2_key TEXT;
```

신고 시스템을 붙이면 별도 테이블:

```sql
CREATE TABLE reports (
  id           TEXT PRIMARY KEY,
  geohash      TEXT NOT NULL,
  reason       TEXT NOT NULL,
  note         TEXT,
  created_at   INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open'
);
```

사용자 계정이 없는 v1에서는 reports를 만들지 않는다.

## 23. 무료 티어와 운영 주의

- Durable Objects는 Workers Free에서도 SQLite backend 기준으로 사용 가능하다고 문서화되어 있으나, 정책은 바뀔 수 있으므로 시작/배포 전에 다시 확인한다.
- WebSocket Hibernation은 유휴 연결 비용을 줄이는 핵심 기능이므로 일반 WebSocket accept 방식으로 구현하지 않는다.
- D1 local development와 remote migration 흐름을 구분한다.
- 공개 데모 전에는 타일 제공자 정책과 attribution을 확인한다.
- 비용과 한도는 `docs/ops-notes.md` 같은 파일에 날짜와 함께 기록한다.

## 24. 미해결 결정

- 지오해시 precision 최종값: 8로 시작하되 실제 지도에서 방 밀도를 보고 7과 비교한다.
- 보드 크기: 64로 시작. 데모 후 48/64/96 비교.
- 쿨다운: 5초로 시작. 사람이 많은 테스트에서 3/5/10초 비교.
- 팔레트: 16색 초안 필요.
- 지도 타일 제공자: 개발용과 공개용을 분리할지 결정.
- 방 생성 UX: 빈 곳 어디나 허용할지, 근처 기존 방과 최소 거리 제한을 둘지 결정.
- D1 pixel_count repair 도구: Phase 6 또는 v2에서 필요.

## 25. 참고 링크(2026-06-14 확인)

- Svelte runes docs: https://svelte.dev/docs/svelte/$state
- MapLibre GL JS docs: https://www.maplibre.org/maplibre-gl-js/docs/
- Hono Cloudflare Workers docs: https://hono.dev/docs/getting-started/cloudflare-workers
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare DO WebSocket Hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare D1 local development: https://developers.cloudflare.com/d1/best-practices/local-development/
- Cloudflare Workers Vitest integration: https://developers.cloudflare.com/workers/testing/vitest-integration/
- Zod docs: https://zod.dev/
- MCP intro: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude Code MCP docs: https://code.claude.com/docs/en/mcp
- Claude Code skills docs: https://code.claude.com/docs/en/skills
- OSM tile usage policy: https://operations.osmfoundation.org/policies/tiles/
