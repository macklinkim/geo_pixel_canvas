# CLAUDE_REVIEW.md - VERIFICATION 재검토 및 후속 작업 지시

작성일: 2026-06-14

대상 문서: `VERIFICATION.md`

목적: `VERIFICATION.md`가 주장하는 완료/검증 상태를 실제 코드와 명령 실행 결과로 대조하고, 부족한 부분을 Claude Code가 바로 작업할 수 있게 정리한다.

## 1. 결론

현재 구현은 핵심 데모 흐름 일부가 실제로 동작한다.

- `pnpm check` 통과.
- `pnpm build` 통과.
- 로컬 dev 서버에서 `/api/health`, `/api/config`, `/api/rooms` 동작 확인.
- `tools/ws-smoke.mjs`로 WebSocket snapshot, paint broadcast, 위치 게이트 reject 확인.
- 지도, 모달, 캔버스, 팔레트 UI 파일은 실제로 구현되어 있다.

하지만 `VERIFICATION.md`는 검증 수준을 과하게 좋게 표현하고 있다. 자동 테스트가 없고, Playwright 검증은 재현 가능한 테스트 파일이 아니라 일회성 산출물에 가깝다. 또한 현재 기능에는 빈 방 생성 UX, 위치 상태 표시, 레이트리밋, 입력 검증, 반응형 모달, 테스트/문서 정합성에서 중요한 빈틈이 있다.

Claude는 아래 작업을 우선순위대로 처리한다. 부족한 점을 문서로 숨기지 말고 실제 구현과 검증으로 보완한다.

## 2. 내가 실제로 확인한 내용

### 2-1. 통과한 것

```txt
pnpm check
결과: svelte-check 0 errors, 0 warnings / worker tsc 통과 / shared tsc 통과
```

```txt
pnpm build
결과: 성공
주의: client JS chunk가 약 1.18MB로 Vite chunk size warning 발생
```

```txt
GET http://127.0.0.1:5173/api/health
결과: { ok: true, version: "0.1.0" }
```

```txt
GET http://127.0.0.1:5173/api/config
결과: { mapStyleUrl: null }
```

```txt
GET /api/rooms?minLat=37.54&minLng=126.96&maxLat=37.57&maxLng=126.99
결과: 서울역 인근 seed room 5개 반환
```

```txt
잘못된 bbox
결과: HTTP 400
```

```txt
node tools/ws-smoke.mjs
결과: 두 클라이언트 snapshot 수신, pixel broadcast 수신, out_of_range/low_accuracy reject 확인
```

### 2-2. 실패하거나 부족한 것

```txt
pnpm test
결과: ERR_PNPM_NO_SCRIPT - Missing script: test
```

- `@playwright/test` dependency 없음.
- `vitest` dependency 없음.
- `playwright.config.ts` 없음.
- `vitest.config.ts` 없음.
- `eslint.config.js` 없음.
- `WORKPLAN.md`에는 위 설정 파일을 남긴다고 되어 있지만 실제로 없다.
- `VERIFICATION.md`의 Playwright 검증은 재실행 가능한 테스트로 체크인되어 있지 않다.
- `docs/screenshots/load.png`는 "초기 로드에서 모달 자동 오픈 없음"이라는 설명과 달리 이미 방 패널이 열린 화면이다. 스크린샷 이름/설명/상태가 불명확하다.

## 3. P0 - 검증 신뢰도부터 복구

### P0-1. 테스트 인프라와 스크립트 추가

현재 `package.json`에는 `test` 관련 스크립트가 없다. `VERIFICATION.md`를 신뢰 가능한 문서로 만들려면 최소 자동 테스트를 추가한다.

대상 파일:

- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/unit/*`
- `tests/worker/*`
- `tests/e2e/*`

추가할 dev dependencies:

- `vitest`
- `@cloudflare/vitest-pool-workers`
- `@playwright/test`
- 필요 시 `eslint`, `typescript-eslint`

필수 scripts:

```json
{
  "test": "pnpm test:unit && pnpm test:worker && pnpm test:e2e",
  "test:unit": "vitest run tests/unit",
  "test:worker": "vitest run -c vitest.config.ts tests/worker",
  "test:e2e": "playwright test",
  "lint": "eslint ."
}
```

수용 기준:

- `pnpm test`가 존재하고 성공해야 한다.
- `pnpm test:unit`은 shared 로직을 검증해야 한다.
- `pnpm test:worker`는 API와 DO/WebSocket 핵심 흐름을 검증해야 한다.
- `pnpm test:e2e`는 브라우저에서 지도/모달/캔버스/위치 모킹/paint를 검증해야 한다.
- README와 `VERIFICATION.md`는 이 명령들을 기준으로 갱신한다.

### P0-2. unit test 필수 항목

대상:

- `shared/geo/geohash.ts`
- `shared/geo/haversine.ts`
- `shared/geo/locationGate.ts`
- `shared/snapshot.ts`
- `shared/protocol.ts`
- `client/src/lib/board/boardMath.ts`

테스트 항목:

- geohash encode/decode golden cases.
- geohash bounds/center가 서울 seed 좌표와 일치하는지.
- Haversine 거리 계산.
- `checkLocationGate`가 ok/out_of_range/low_accuracy를 정확히 반환하는지.
- snapshot encode/decode roundtrip.
- protocol schema가 invalid x/y/color/acc를 거부하는지.
- pointer 좌표가 64x64 cell로 정확히 변환되는지.

수용 기준:

- shared와 board math는 브라우저 없이 테스트 가능해야 한다.
- 좌표 원본을 저장하거나 로그하는 테스트 fixture를 만들지 않는다.

### P0-3. worker/API/WebSocket test 추가

대상:

- `worker/src/rooms.ts`
- `worker/src/index.ts`
- `worker/src/room-do.ts`

테스트 항목:

- `/api/health` 200.
- `/api/config` 200.
- `/api/rooms` bbox 정상 조회.
- 잘못된 bbox 400.
- `POST /api/rooms` 정상 생성.
- `POST /api/rooms` out_of_range/low_accuracy 거부.
- `/ws/:roomId` invalid roomId 400.
- WebSocket join snapshot.
- paint success -> sender and another client both `pixel` 수신.
- cooldown reject.
- rate limit reject(P1-3 구현 후).
- D1 `pixel_count` 신규 칸에서만 증가.

수용 기준:

- 수동 로그가 아니라 test assertion으로 실패/성공이 결정되어야 한다.
- 테스트 실패 시 exit code가 0이면 안 된다.

### P0-4. E2E test 추가

대상:

- `tests/e2e/app.spec.ts`
- `playwright.config.ts`

테스트 항목:

- 앱 로드 후 지도 region, attribution, "내 위치로" 버튼 표시.
- 초기 로드에서 방 모달이 자동으로 열리지 않음.
- seed 핀 클릭 시 중앙 모달이 열림.
- 위치 거부 상태에서 보기 전용.
- geolocation mock으로 방 중심 위치를 주면 "이 장소에서 그릴 수 있어요." 표시.
- canvas 클릭 후 실제 canvas pixel이 바뀜.
- 낮은 accuracy mock 시 쓰기 거부와 경고 문구 표시.
- 반경 밖 mock 시 쓰기 거부와 경고 문구 표시.
- 390x844 모바일 viewport와 1366x768 desktop viewport에서 모달/팔레트/닫기 버튼이 겹치지 않음.

수용 기준:

- 스크린샷은 테스트 산출물로 생성한다.
- `docs/screenshots/*`의 수동 스크린샷 설명과 실제 상태가 맞아야 한다.

### P0-5. `tools/ws-smoke.mjs`를 assertion 기반으로 변경

현재 `tools/ws-smoke.mjs`는 하드코딩된 `localhost:5173`만 사용하고 로그만 출력한다. 포트가 5174로 바뀌면 깨지고, 기대한 메시지가 없어도 명확히 실패하지 않는다.

대상:

- `tools/ws-smoke.mjs`
- `package.json`

작업:

- `WS_URL` 또는 `BASE_URL` 환경 변수를 받게 한다.
- 기본값은 `ws://127.0.0.1:5173`로 둔다.
- 기대한 snapshot/pixel/ack/reject가 없으면 `process.exit(1)` 한다.
- 테스트마다 덮어써도 되는 좌표 또는 랜덤 cell을 사용한다.
- `pnpm smoke:ws` script를 추가한다.

수용 기준:

- `pnpm smoke:ws`가 성공/실패를 exit code로 명확히 표현한다.

## 4. P1 - 기능/UX의 실제 결함 수정

### P1-1. join snapshot에 쓰기 거부 reason 추가

현재 `RoomPanel.svelte`는 위치를 가져오면 먼저 `room.locStatus = "ok"`로 바꾸고 `sendJoin()`을 호출한다. 그런데 서버 snapshot은 `canWrite`만 보내고 거부 reason을 보내지 않는다.

문제:

- 위치 정확도가 낮거나 반경 밖이면 서버는 `canWrite: false` snapshot을 보내지만 클라이언트는 reason을 모른다.
- `PermissionBanner.svelte`는 `locStatus === "ok"`이고 `canWrite === false`이면 아무 배너도 표시하지 않는다.
- 사용자는 왜 그릴 수 없는지 알 수 없다.

대상 파일:

- `shared/protocol.ts`
- `worker/src/room-do.ts`
- `client/src/components/RoomPanel.svelte`
- `client/src/components/PermissionBanner.svelte`

작업:

- `SnapshotMsg`에 `writeReason?: "out_of_range" | "low_accuracy"`를 추가한다.
- `handleJoin()`에서 `gate.reason`을 snapshot에 포함한다.
- 클라이언트는 snapshot 수신 시 `writeReason`을 보고 `room.locStatus`를 `low_accuracy` 또는 `out_of_range`로 설정한다.
- 위치가 아직 없는 sentinel join은 사용자가 직접 위치를 허용하기 전까지 `locStatus`를 `idle`로 유지한다.

수용 기준:

- 위치 정확도 낮음/반경 밖 상태가 join 직후 배너에 표시된다.
- `locStatus ok + canWrite false + no banner` 상태가 없어야 한다.

### P1-2. watchPosition 업데이트 시 쓰기 가능 상태 갱신

현재 `watchPosition`은 `room.lastPosition`만 갱신한다. 사용자가 방 반경 안/밖으로 이동해도 다음 paint 전까지 `canWrite`가 오래된 상태일 수 있다.

대상 파일:

- `client/src/components/RoomPanel.svelte`
- `client/src/lib/geo/browserLocation.ts`
- 필요 시 `shared/geo/locationGate.ts`

작업:

- watchPosition에서 새 위치가 들어오면 일정 debounce/throttle로 `conn.sendJoin()`을 다시 보낸다.
- 너무 자주 보내지 않도록 3~5초 throttle을 둔다.
- 위치가 큰 폭으로 변한 경우 즉시 갱신해도 된다.

수용 기준:

- 위치 mock을 반경 안 -> 밖, 밖 -> 안으로 바꾸면 배너와 `canWrite`가 갱신된다.

### P1-3. DO paint rate limit 구현

`shared/constants.ts`에는 `PAINT_RATE_PER_SEC = 1`이 있고 `shared/protocol.ts`에는 `rate_limited` reason이 있지만, `worker/src/room-do.ts`는 실제 rate limit을 구현하지 않는다.

대상 파일:

- `shared/constants.ts`
- `worker/src/room-do.ts`
- `shared/protocol.ts`
- tests

작업:

- `ConnState`에 `lastPaintAttemptAt` 또는 token bucket 상태를 추가한다.
- 쿨다운과 별개로 connection별 초당 paint 시도 수를 제한한다.
- 너무 빠른 요청은 `{ t: "ack", ok: false, reason: "rate_limited" }` 반환.
- 실패한 rate-limited paint는 DB에 쓰면 안 된다.

수용 기준:

- 같은 WebSocket에서 짧은 시간에 paint를 연속 전송하면 두 번째 이후 일부가 `rate_limited`로 거부된다.
- worker test로 검증한다.

### P1-4. 빈 셀 탭 -> 방 생성 UX 구현

현재 지도 빈 곳을 클릭하면 `app.openRoom(encodeGeohash(...))`만 실행한다. `POST /api/rooms`는 클라이언트에서 호출되지 않는다. 첫 paint가 성공하면 DO의 `syncIndex()`가 D1에 방을 만들 수는 있지만, 이것은 명시적 방 생성 UX가 아니다.

대상 파일:

- `client/src/components/MapView.svelte`
- `client/src/lib/state/appState.svelte.ts`
- `client/src/components/RoomPanel.svelte`
- `worker/src/rooms.ts`
- 필요 시 신규 `client/src/lib/api/rooms.ts`

작업:

- 지도 빈 셀 클릭 시 기존 room인지 확인하고, 없으면 "새 방 만들기" 상태로 연다.
- 사용자가 위치 권한을 허용하고 서버 location gate를 통과하면 `POST /api/rooms`를 호출한다.
- 이미 존재하면 기존 방으로 진입한다.
- 생성 실패 reason(out_of_range/low_accuracy)을 UI에 표시한다.
- 첫 paint에 의존해서 D1 room을 만드는 흐름을 보조 수단으로만 남긴다.

수용 기준:

- 빈 셀에서 위치가 맞으면 paint 전에 D1 room이 생성된다.
- 위치가 틀리면 방 생성이 실패하고 보기 전용으로 유지된다.
- E2E에서 빈 셀 생성 흐름을 검증한다.

### P1-5. lat/lng 입력 검증 강화

현재 HTTP `POST /api/rooms`의 `lat`, `lng`는 단순 `z.number()`이며 범위 제한이 없다. WebSocket `join`/`paint`도 lat/lng 범위를 제한하지 않는다.

대상 파일:

- `shared/protocol.ts`
- `worker/src/rooms.ts`
- `shared/geo/geohash.ts`
- tests

작업:

- `lat`: `-90 <= lat <= 90`
- `lng`: `-180 <= lng <= 180`
- `acc`: finite, nonnegative, 지나치게 큰 값은 허용하되 no-position sentinel 정책과 충돌하지 않게 한다.
- `encodeGeohash()`에도 방어적 validation을 넣거나 호출 전 validation을 보장한다.

수용 기준:

- invalid lat/lng는 HTTP 400 또는 WS invalid ack로 거부된다.
- geohash 계산에 범위 밖 좌표가 들어가지 않는다.

### P1-6. roomId validation을 v1 precision에 맞게 좁히기

현재 `isValidGeohash()`는 길이 1~12를 허용한다. v1 방 ID는 precision 8로 고정되어 있으므로 `/ws/:roomId`와 room API는 기본적으로 길이 8만 받는 편이 안전하다.

대상 파일:

- `shared/room.ts`
- `worker/src/index.ts`
- tests

작업:

- v1에서는 `isValidRoomId(s)`를 별도로 만들고 `s.length === GEOHASH_PRECISION`을 요구한다.
- 일반 geohash helper와 roomId validation을 분리한다.

수용 기준:

- `/ws/a`는 400.
- `/ws/wydm9k95`는 정상.

### P1-7. 모달 반응형 레이아웃 개선

스크린샷에서 desktop 768px 높이에서도 모달 내부 스크롤이 생기고 팔레트 하단이 잘린다. 사용자가 "큰 중앙 모달에서 그리기"를 원했으므로, common desktop/mobile viewport에서 주요 컨트롤이 한 화면에 들어와야 한다.

대상 파일:

- `client/src/components/RoomPanel.svelte`
- `client/src/components/PixelBoard.svelte`
- `client/src/components/Palette.svelte`
- `client/src/app.css`

작업:

- 모달을 `display: grid` 또는 명확한 flex layout으로 바꾼다.
- header/banner/cooldown/palette 높이를 뺀 남은 공간에 board가 맞게 한다.
- 1366x768, 1024x768, 390x844에서 닫기 버튼/배너/보드/팔레트가 겹치지 않게 한다.
- 내부 scrollbar가 생기더라도 팔레트와 주요 액션이 잘리지 않게 한다.

수용 기준:

- Playwright screenshot으로 1366x768과 390x844를 남긴다.
- 텍스트/컨트롤 겹침이 없다.

### P1-8. 첫 진입 랜딩 페이지 추가

사용자 최신 요청: `wplace.live`처럼 처음 들어왔을 때 바로 게임의 정체성과 규칙, 참여 동기를 이해할 수 있는 랜딩/온보딩 화면이 필요하다.

현재 앱은 곧바로 지도 화면으로 들어간다. 기능 데모에는 좋지만, 처음 온 사용자는 "무엇을 하는 서비스인지", "왜 위치 권한이 필요한지", "남의 그림 위에 칠해도 되는지"를 알기 어렵다.

대상 파일:

- `client/src/App.svelte`
- `client/src/components/LandingPage.svelte` 신규
- `client/src/lib/state/appState.svelte.ts`
- `client/src/app.css`
- 필요 시 `README.md`, `VERIFICATION.md`

작업:

- 앱 첫 진입 시 랜딩 페이지를 보여준다.
- 랜딩 페이지의 H1은 서비스 이름 또는 핵심 오퍼로 둔다. 예: `Paint your place`, `Geo Pixel Board`, `Paint the places around you`.
- 랜딩 페이지에는 실제 지도/픽셀 보드 경험을 암시하는 full-bleed 배경 또는 실제 앱 미리보기 이미지를 사용한다. 단순 카드형 설명 페이지로 만들지 않는다.
- 주요 CTA:
  - `지도 열기`
  - `내 위치 주변에서 그리기`
  - `규칙 보기`
- 랜딩에서 위치 권한을 바로 강요하지 않는다. `내 위치 주변에서 그리기`를 누를 때만 위치 권한 요청 흐름으로 연결한다.
- `localStorage`에 `gpb:seenLanding` 또는 명시적 skip 상태를 저장해 재방문 시 바로 지도로 갈 수 있게 하되, 헤더/메뉴에서 랜딩 또는 소개를 다시 열 수 있게 한다.
- 랜딩은 마케팅 과장이 아니라 게임 시작 화면이어야 한다. 첫 화면에서 지도/픽셀/지역 경쟁의 느낌이 보여야 한다.

랜딩에 넣을 핵심 메시지:

- 전 세계 지도 위 장소마다 64x64 픽셀 보드가 열린다.
- 누구나 구경할 수 있다.
- 그 장소 근처에 있을 때만 칠할 수 있다.
- 남의 픽셀 위에 덧칠하고, 지키고, 되찾는 것이 정상 플레이의 일부다.
- 부적절한 콘텐츠와 악의적 방해는 금지된다.

수용 기준:

- 첫 방문자는 랜딩을 먼저 본다.
- `지도 열기`를 누르면 기존 지도 화면으로 들어간다.
- 재방문자는 설정에 따라 바로 지도 진입 가능하다.
- 390x844, 1366x768에서 hero text/CTA가 겹치지 않는다.
- 랜딩 페이지가 기존 지도/RoomPanel 기능을 깨지 않는다.

### P1-9. wplace.live에서 가져올 좋은 게임 요소 반영

참고 대상: `https://wplace.live/`

직접 확인한 좋은 요소:

- 명확한 게임 정체성: `Paint the world`.
- 지도 위 픽셀 칠하기를 바로 시작하게 하는 단순한 핵심 루프.
- 규칙 모달이 명확하다.
- 부적절한 콘텐츠, 혐오, 개인정보 침해, 봇/다중 계정 금지가 분명하다.
- 영토 분쟁은 정상 플레이로 허용하고, 순수 괴롭힘 목적의 파괴만 griefing으로 본다.
- 스팸/부적절한 그림을 지우는 map cleanup을 정상 플레이로 인정한다.
- Leaderboard가 Regions/Countries/Players/Alliances 단위로 나뉜다.
- Droplets/charges로 "얼마나 칠할 수 있는지"를 게임 자원처럼 보여준다.

우리 프로젝트에 맞게 반영할 방식:

- "Paint the world"를 그대로 쓰지 말고 위치 기반 정체성으로 바꾼다. 예: `Paint the places you stand in`, `Paint your block`, `장소마다 하나의 픽셀 보드`.
- v1에서는 계정/결제/상점은 만들지 않는다. Droplets는 유료 재화가 아니라 `charges` 또는 `paint charges` UI 아이디어로만 가져온다.
- 기존 5초 쿨다운을 더 게임스럽게 표시한다. 예: `1 charge ready`, `next charge in 4.2s`.
- 영토 분쟁을 규칙 문서와 UI에 명확히 쓴다. "덧칠 자체는 정상 플레이, 악의적 낙서/괴롭힘은 금지".
- map cleanup을 v1.5 기능으로 설계한다. 현재 팔레트에 투명 픽셀이 없으므로 아래 중 하나를 선택한다:
  - v1은 cleanup을 규칙 문구로만 설명하고 기능은 보류.
  - v1.5에서 `cleanup/erase` 색을 추가하되 cooldown/location gate를 똑같이 적용.
- 리더보드는 v1.5에서 먼저 `Rooms`와 `Nearby` 단위로 시작한다. 계정이 없으므로 Players/Alliances는 v2로 미룬다.
- 국가/지역 리더보드는 지오해시 prefix 또는 bbox aggregation이 필요하므로 v2로 미룬다.
- Rules 모달을 랜딩과 앱 메뉴에서 열 수 있게 한다.

추가 대상 파일:

- `client/src/components/RulesModal.svelte` 신규
- `client/src/components/AppShell.svelte` 또는 기존 `App.svelte`
- `client/src/components/LandingPage.svelte`
- `client/src/components/ChargesIndicator.svelte` 신규 또는 `Cooldown.svelte` 개선
- `project_plan_draft.md`
- `WORKPLAN.md`
- `VERIFICATION.md`

Rules modal 초안:

- Prohibited:
  - 성적/혐오/불법 콘텐츠 금지.
  - 개인정보 노출 금지.
  - 특정 사용자를 괴롭히기 위한 무작위 훼손 금지.
  - 봇/자동화/다중 계정 남용 금지.
- Allowed:
  - 공간 경쟁과 덧칠은 정상 플레이.
  - 자기 그림을 지키거나 되찾는 것도 정상 플레이.
  - 스팸/부적절한 그림을 정리하는 cleanup은 정상 플레이.
- Location rule:
  - 보기는 누구나 가능.
  - 그리기는 해당 장소 근처에서만 가능.
  - 원본 좌표는 저장하지 않는다.

수용 기준:

- 랜딩 또는 앱 메뉴에서 Rules modal을 열 수 있다.
- "territorial disputes allowed"와 "clear griefing prohibited"가 구분되어 설명된다.
- charges/cooldown UI가 현재 그릴 수 있는지 한눈에 보여준다.
- v1에 만들지 않을 것(유료 Store, Droplets 결제, 계정, Alliances, 국가 리더보드)은 문서에 v2로 명확히 분리한다.

## 5. P2 - 운영/문서/품질 정리

### P2-1. `VERIFICATION.md`를 재작성

현재 문서는 수동 검증과 자동 검증을 섞어 말하고 있다. 자동으로 재현 가능한 것과 사람이 봐야 하는 것을 분리한다.

작업:

- `pnpm check`, `pnpm build`, `pnpm test`, `pnpm smoke:ws` 결과를 명확히 적는다.
- Playwright 결과는 테스트 파일 경로와 실행 명령을 적는다.
- 스크린샷은 어떤 테스트가 생성했는지 적는다.
- 실패/한계는 숨기지 않는다.

수용 기준:

- 새 환경에서 문서의 명령을 순서대로 실행하면 같은 결과를 얻을 수 있어야 한다.

### P2-2. `WORKPLAN.md`와 `CLAUDE.md` 정책 정합성 수정

현재 `WORKPLAN.md`는 "Vitest/Playwright 설정 남김"이라고 쓰고, `CLAUDE.md`는 "자동 테스트 최소화"를 강조한다. 사용자의 최신 의도는 부족한 부분을 보완하는 것이므로 테스트 최소화 정책을 완화한다.

작업:

- `CLAUDE.md`에서 "자동 테스트 최소화"를 "핵심 로직/Worker/E2E smoke는 자동화"로 변경한다.
- `WORKPLAN.md` 체크리스트를 실제 완료/미완료 상태와 맞춘다.
- `README.md` 품질 게이트를 `pnpm check + pnpm test + smoke`로 갱신한다.

수용 기준:

- 문서끼리 서로 모순되지 않는다.

### P2-3. 지도 타일 정책 정리

현재 fallback은 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`를 직접 사용한다. 개발/저트래픽 데모는 가능하지만 공개 배포용으로는 위험하다.

작업:

- 공개 배포 전 `MAP_STYLE_URL`을 필수로 요구할지 결정한다.
- README에 dev fallback과 production provider를 분리해 설명한다.
- Playwright/E2E가 외부 타일 네트워크 실패 때문에 흔들리지 않도록 mock style 또는 stable test style을 제공한다.

수용 기준:

- 테스트는 외부 OSM 타일 상태에 의존하지 않는다.
- production 배포 문서에 tile provider 설정이 명확하다.

### P2-4. bundle size warning 처리

`pnpm build`는 성공하지만 client JS chunk가 약 1.18MB라 Vite warning이 난다. MapLibre가 큰 비중일 가능성이 높다.

작업:

- 필요하면 MapLibre 관련 코드를 route/component lazy import로 분리한다.
- 단순 데모에서는 warning을 문서화하고 보류해도 된다.

수용 기준:

- 보류한다면 `VERIFICATION.md` known limitation에 적는다.
- 처리한다면 build warning이 사라지는지 확인한다.

### P2-5. D1 metadata drift 대응

DO paint 저장 후 D1 sync는 best-effort다. D1 sync 실패 시 `pixel_count`가 실제 DO SQLite와 어긋날 수 있다.

작업:

- v1에서는 known limitation으로 명시한다.
- 가능하면 특정 room의 DO pixel count를 기준으로 D1을 복구하는 dev/admin repair script를 만든다.

수용 기준:

- D1 drift 가능성이 문서화되어 있다.
- repair를 만들면 dry-run과 apply 모드가 있어야 한다.

## 6. 수정 후 반드시 실행할 명령

Claude는 작업 종료 전에 아래를 실행하고 결과를 `VERIFICATION.md`와 `history.md`에 기록한다.

```bash
pnpm check
pnpm build
pnpm test
pnpm smoke:ws
```

dev 서버가 필요한 테스트는 테스트 runner가 직접 띄우거나, 문서에 선행 명령을 명시한다.

## 7. 리뷰 기준

후속 작업 완료 후 다시 리뷰할 때 중점적으로 볼 항목:

- Svelte 5 runes 규칙 위반 없음.
- 원본 좌표 저장/로그 없음.
- 서버(DO)가 location gate, cooldown, rate limit을 모두 강제.
- 빈 셀 방 생성이 명시적이고 사용자에게 이유를 설명함.
- 테스트가 실제 실패를 잡을 수 있음.
- `VERIFICATION.md`가 재현 가능한 검증 문서가 됨.
