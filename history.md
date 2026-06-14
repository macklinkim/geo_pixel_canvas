# history.md — 작업 이력

최신 항목을 위에 추가한다.

## 2026-06-14 (11) — 공개 배포 하드닝 (어뷰즈 방어 + 외부 서비스 정책)

대중 공개 준비. Turnstile 봇 게이트(항목 10)와 직교하는 하드닝:

- **입력 범위 검증**: `protocol.ts`의 lat(-90~90)/lng(-180~180)/acc(0~100k)를 모든 WS 쓰기 메시지에
  강제, `rooms.ts` createBody 동일. `index.ts`에서 roomId 길이를 `GEOHASH_PRECISION`(8)으로 고정 →
  임의 정밀도 geohash로 stray DO 생성 차단.
- **셀 단위 토큰버킷 플러드 가드**: `room-do.ts`에 연결당 버킷(`WRITE_BURST_CELLS=1500`,
  `WRITE_REFILL_CELLS_PER_SEC=300`). paint=1셀, stamp=cells.length 차감. 0.1s 펜 느낌은 그대로 두면서
  scripted stamp 도배/보드 와이프를 차단. 부족 시 `rate_limited` ack.
- **긴급 킬 스위치**: env `WRITE_DISABLED="true"` → paint/stamp/rename + `POST /api/rooms` 거부
  (`write_disabled` ack/403). 대시보드에서 즉시 토글(코드 재배포 불필요).
- **방 이름 새니타이즈**: `sanitizeRoomName`(제어/zero-width/bidi/줄구분자/BOM 제거 + 공백 정리).
- **지오코더 캐시**: `GET /api/geocode`를 Cloudflare Cache API로 1일 캐싱 → 반복 검색이 rate-limited
  Nominatim을 재호출하지 않음(검색은 submit-only).
- **타일 제공자 교체**: `MAP_STYLE_URL`을 OpenFreeMap `positron`(키리스·공개사용 가능)으로 →
  OSM 표준 타일서버 정책 블로커 제거. attribution 유지. 다크 베이스맵은 키 있는 스타일로 1줄 교체 가능(주석).
- **클라 알림**: RoomPanel에 `rate_limited`/`write_disabled` 트랜지언트 안내(3초 자동 해제).
- 팔레트 32색화에 맞춰 랜딩 facts/카피의 색 수를 `PALETTE.length` 동적 표기로 수정.
- 검증: `pnpm check` 0 errors, `pnpm build` 성공. 브라우저(chrome-devtools): 랜딩→/verify(테스트키 자동통과)
  →/app 진입, positron 타일 로드(스프라이트 경고 해소, attribution 유지), 콘솔 에러 0.
- 미적용(배포 시 본인 Cloudflare 계정 필요): D1 `database_id` 생성/치환, `db:migrate:remote`, `wrangler login`.

## 2026-06-14 (10) — Cloudflare Turnstile 사람 확인 (진입 게이트 + 쓰기 경로 서버 검증)

- 진입 게이트: 라우팅 `/`(랜딩) → `/verify`(Turnstile) → `/app`. `POST /api/verify`가 Siteverify 검증 후
  HMAC 서명 httpOnly 쿠키(human session, 30분) 발급. `/app`은 Worker가 쿠키 확인, 없으면 302 → /verify(서버 강제).
- 쓰기 경로 서버 검증(보안): WS `paint/stamp/rename` + `POST /api/rooms`. WS 업그레이드 쿠키 → DO `humanVerifiedUntil`.
  세션 없으면 `ack human_required` → 클라 인라인 Turnstile 토큰 재전송 → 서버 Siteverify. AckReason에 human_required/turnstile_failed.
- 신규 파일: worker `turnstile.ts`(config+siteverify), `session.ts`(HMAC 쿠키), client `Turnstile.svelte`/`VerifyGate.svelte`.
  env: TURNSTILE_ENABLED/SITE_KEY/SECRET_KEY/SESSION_TTL_MS. /api/config·/api/session 추가. .dev.vars(.example) 테스트키 안내.
- 위치 게이트·쿨다운·레이트리밋 불변. 둘 다 통과해야 쓰기. out_of_range가 Turnstile보다 우선.
- 검증: `pnpm check`/`pnpm build` 통과. 서버 `/app` 302(무쿠키)/200(쿠키), `POST /api/verify`→세션 valid,
  `tools/ws-turnstile-test.mjs`로 human_required→(token)ok→out_of_range 확인. 브라우저 게이트→그리기(추가 CAPTCHA 없음) 확인.
- 문서: docs/TURNSTILE.md(설정/검증/보안 의도). 상세는 그 문서 참조.

## 2026-06-14 (9) — 방 이름 편집 + 하단 정리 + 국기 테두리 + 한국 국기

- **방 이름 편집 + 기본 주소 표시**: snapshot에 `name` 포함(DO가 D1에서 조회) → 모달이 기본적으로 주소명 표시.
  헤더에 연필 버튼→인풋으로 이름 수정, WS `rename`(위치 게이트) → D1 갱신 + `meta` 브로드캐스트로 전원 동기화.
  검증: "서울역 앞"(기본 주소) → "서울역 광장 낙서판"으로 변경 후 D1 저장 확인.
- **하단 레이아웃 정리**: 팔레트 16열×2행 그리드, 도장 스트립 가로 스크롤, 미니맵 축소(92px), 모달 gap/padding 축소.
  bottom-bar 높이 81px로 컴팩트.
- **흰 바탕 국기 회색 테두리**: 가장자리가 흰색/투명인 국기(JP/KR/ID/SG/US/PH 등)에 회색 프레임 자동 추가 → 흰 도화지에서 구분.
- **한국 국기 추가**: 태극(상 빨강/하 파랑) + 4괘(검정) + 회색 테두리. 도장 목록 스마일 다음에 배치.
- `pnpm check` 0 errors, `pnpm build` 성공. 스크린샷 docs/screenshots/rename-kr-layout.png.

## 2026-06-14 (8) — 동작별 커서 디자인 (그리기 / 도장 / 드래그)

- 보드 상호작용마다 다른 커서: 펜=픽셀 조준 십자선(가운데 셀+점), 도장=도장 글리프(누름점 핫스폿),
  드래그(팬)=사방 화살표(move). 액센트 블루 + 흰 후광으로 흰 도화지/어두운 지도 양쪽에서 가독.
- 구현: `PixelBoard`에서 SVG를 `encodeURIComponent` 데이터 URI로 런타임 생성 + 네이티브 폴백(crosshair/copy/move).
  상태(`disabled`/`tool`/`dragging`)에 따라 `$derived`로 커서 전환. `tool` prop을 RoomPanel→PixelBoard로 전달.
- 검증: `pnpm check` 0 errors, `pnpm build` 성공. 브라우저: 펜→PAINT, 도장→STAMP, 드래그 중→MOVE 커서 전환 확인.

## 2026-06-14 (7) — 줌 선명화 + 위치 그리기 수정 + 32색 + 국기 도장

- **줌인 깨짐 수정**: 캔버스를 CSS `transform: scale`로 확대하면 GPU 보간으로 흐려짐 →
  팬은 translate만, 줌은 캔버스 표시 width 변경(레이아웃)으로 전환해 `image-rendering:pixelated` 유지.
  검증: 201%에서 backing 192×128 / display 1095×729, transform=translate-only → 선명.
- **내 위치에서 그리기 안 됨 수정**:
  - "내 위치에 그리기" 버튼 추가: 현재 위치의 셀 방을 열고 위치를 pre-seed → 즉시 그리기 가능(재허용 불필요).
  - 정확도 게이트 완화 `MAX_ACCURACY_M 100→500`(거리 게이트로 지역성은 유지, v1 캐주얼 기준). 탭/드래그 임계 9px.
  - 검증: 모킹 위치로 "내 위치에 그리기" → "이 장소에서 그릴 수 있어요" + canDraw=true.
- **색상 32색 확장**: `PALETTE`(원색 중심 32색), `MAX_COLOR 15→31`, `PALETTE_VERSION 2`. 팔레트 32 스와치 표시.
- **국기 도장**: 도구를 펜/도장으로, 도장 선택 스트립(스마일 + 10개국 국기 CN/JP/TW/US/HK/PH/VN/SG/ID/TH).
  `stamps.ts`에 절차적 국기 빌더(다색 셀) + `stamp` 메시지로 단일 쿨다운 일괄 적용.
  검증: 일본(흰+빨강 원), 베트남(빨강+노랑별) 다색 도장 확인.
- `pnpm check` 0 errors, `pnpm build` 성공. 스크린샷 docs/screenshots/{satellite.jpeg,flags-zoom.png}.

## 2026-06-14 (6) — 항공사진 토글 + 주소 검색 이동 (둘 다 무료/무키)

- **항공사진 토글**: Esri World Imagery(무료·무키) 래스터 레이어를 지도에 추가, "항공/지도" 버튼으로 표시 토글.
  `mapStyle.ts`(SATELLITE_SOURCE) + `mapController` addSatelliteLayer/toggleSatellite. attribution 표기.
- **주소·장소 검색 이동**: Worker `GET /api/geocode?q=`(Nominatim forward geocode, 무료) → 클라 검색창 → `map.flyTo`.
  서버 경유라 CORS/UA 정책 안전, 추가 과금 없음.
- 검증: `pnpm check` 0 errors, `pnpm build` 성공. 브라우저: 항공 타일 로드 확인(스크린샷 docs/screenshots/satellite.jpeg),
  "남산타워" 검색 → 지도 [126.9883, 37.5513] z17 이동 확인. `/api/geocode` 응답 정상.

## 2026-06-14 (5) — 주소 네이밍 + 드래그팬/줌 전용 + 보드 2배 + 스마일 도장 + 미니맵

- 사용자 요청 반영:
  - **방 이름 = 구역 주소(역지오코딩)**: `worker/src/geocode.ts`(Nominatim, 셀 중심만 사용 → 원본 좌표 미사용).
    새 방 첫 생성 시 1회 호출 후 D1에 영구 저장, name 누락 시 1회 backfill. `GEOCODE_URL` env로 on/off.
    검증: `wydm9k7s`에 그리기 → 이름 "후암로57길" 자동 저장 확인.
  - **스크롤바 제거, 드래그 팬 + 줌 전용**: PixelBoard를 transform 기반(overflow:hidden)으로 교체.
    탭=그리기/드래그=이동 구분(6px 임계), 휠·버튼 줌(100~1200%), 팬 클램프. 검증: 휠 132%·드래그 팬 OK.
  - **보드 픽셀 2배**: `BOARD_W=192 / BOARD_H=128`.
  - **스마일 도장**: `stamp` 프로토콜 메시지(셀 배치, 단일 쿨다운) + DO `handleStamp` + `stamps.ts`(절차적 스마일).
    검증: 한 번 탭에 77셀 도장.
  - **미니맵**: `boardView` 공유 스토어 + `MiniMap.svelte`(보드 축소 미러 + 현재 뷰 사각형, 클릭 시 뷰 이동).
    팔레트 왼쪽(우측 하단)에 배치.
- 검증: `pnpm check` 0 errors, `pnpm build` 성공, 브라우저 실검증(콘솔 에러 0).
  스크린샷 `docs/screenshots/stamp-minimap.png`.

## 2026-06-14 (4) — 첫 진입 랜딩 페이지 (P1-8 / D4-7)

- 사용자 요청: "Geo Pixel Board" 랜딩 페이지 구현 (영문 디자인 브리프 기반).
- 신규 `client/src/components/LandingPage.svelte`:
  - full-bleed 다크 히어로. H1 "Turn real places into pixel canvases" + 서브타이틀.
  - 제품 UI 목업: CSS 미니맵(펄스 룸 핀) + 중앙 보드 모달. 모달의 미니 보드는
    하드룰대로 **단일 `<canvas>`**로 렌더(스프라이트 점진 공개 애니메이션, 16색 팔레트,
    "N online"/"Nearby painting enabled"/"100m radius" 라벨). `prefers-reduced-motion` 존중.
  - 보드 치수·반경은 `@shared/constants`(BOARD_W/BOARD_H/WRITE_RADIUS_M)를 그대로 읽음.
  - 섹션: Live map rooms / Nearby-only / Real-time board / Privacy / Use cases + 하단 CTA·푸터.
  - CTA: "Start painting"·"Explore rooms"·"Skip intro" → `onenter` 콜백. 위치 권한은 즉시 요구하지 않음.
- `appState`: `showLanding`(localStorage `gpb:seenLanding`로 재방문 skip) + `enterApp()`/`openLanding()`.
- `App.svelte`: 지도 위 오버레이로 랜딩 마운트, `onenter`→`app.enterApp()`.
- 검증: `pnpm check` 0 errors. 브라우저 실검증(chrome-devtools, 1366×768 & 390×844):
  히어로/섹션/CTA 정상, 콘솔 에러 0, "Start painting"→랜딩 해제 후 실제 지도 노출 +
  `gpb:seenLanding=1` 저장 확인. 기존 지도/RoomPanel 기능 영향 없음.
- 참고: `shared/constants.ts`가 현재 `BOARD_W=192 / BOARD_H=128`로 되어 있어 항목(3)의
  96×64 기록과 불일치(랜딩은 상수를 동적으로 읽으므로 192×128로 표기됨). 별도 확인 필요.

## 2026-06-14 (3) — 보드/팔레트/쿨다운 튜닝 + 확대축소

- 사용자 요청 반영:
  - 팔레트 축소: 24px 스와치, 가운데 정렬, 최대폭 320px.
  - 보드를 직사각형 도화지 비율로: `BOARD_W=96 x BOARD_H=64` (3:2), 흰색 종이.
  - 처음 전부 흰색: 빈 셀을 흰색으로 렌더(`BOARD_BG=#fff`), 그리드는 어두운 선.
  - 쿨다운 0.1초: `COOLDOWN_MS=100` (체감 불가).
  - 쿨다운 progress bar 제거(레이아웃 흔들림 방지) — `Cooldown` 모달에서 제외.
  - 캔버스 2배 확대: 모달 폭 min(96vw,900px), 보드 기본 폭 ~847px.
  - 확대/축소 기능: 뷰포트 overflow:auto + 줌(100%~800%), +/−/원래크기 버튼, 줌 시 팬(스크롤).
- 브라우저 재검증: 96×64 흰 보드, 0.1초 쿨다운으로 44셀 연속 채색, 줌 100%→150%(1248px, 팬 가능) 확인. 콘솔 에러 0.

## 2026-06-14 (2) — UX 재설계 + 브라우저 실검증

- 사용자 요청 반영:
  - 핀 클릭 시 보드를 **지도 위 중앙 모달**로 표시(backdrop + Esc/백드롭 닫기). `RoomPanel` 재설계.
  - **"내 위치로 이동" 버튼** + MapLibre `GeolocateControl`/`NavigationControl` 추가.
  - 빈 보드 가시성 개선: 격자 그리드 + 프레임/그림자.
- 버그 수정:
  - OSM z20 over-zoom 타일 에러 → 래스터 `maxzoom:19` + 지도 `maxZoom:19` (콘솔 에러 0).
  - localStorage 과도 줌 저장으로 핀이 화면 밖 → 저장 줌 19 클램프.
- 브라우저 실검증(Playwright, 포트 5174): 핀 클릭→모달→위치 허용(모킹)→그리기 성공.
  캔버스 (31,31) `#b13e53` 1셀, 서버 `pixel_count` 39→40 확인. 상세는 VERIFICATION.md.

## 2026-06-14 — 초기 구현 (인프라 → shared → worker → client)

- WORKPLAN.md 작성: project_plan_draft.md를 빌드 순서로 분해.
- 인프라: pnpm + Vite + @cloudflare/vite-plugin, wrangler.toml(D1/DO/assets), TS strict, D1 migration 0001.
- shared 코어: constants, palette(16색), geohash(encode/decode/bounds), haversine, locationGate, snapshot codec, Zod protocol, room 헬퍼.
- worker: Hono 앱(`/api/health`, `/api/config`, `/api/rooms` GET/POST), `/ws/:roomId` → DO 라우팅;
  RoomDurableObject(WebSocket Hibernation, 픽셀 SQLite, join/paint/ping, 위치 게이팅+쿨다운 서버 강제,
  snapshot/브로드캐스트, D1 인덱스 best-effort 동기화).
- client: Svelte 5 runes SPA — MapLibre 지도 + 방 핀 레이어 + 디바운스 bbox 조회, 단일 canvas 보드 렌더러,
  방 WebSocket(자동 재연결 + 재join), 위치 권한 UX, 16색 팔레트, 쿨다운 표시, 권한/상태 배너,
  모바일 바텀시트 + 데스크톱 사이드 패널.
- 테스트는 지시에 따라 최소화: 자동 테스트 미작성, `pnpm check`(타입) + 수동 스모크로 검증.
- 검증 결과(2026-06-14):
  - `pnpm check` 0 errors (svelte-check + worker tsc + shared tsc).
  - `pnpm build` 성공 (client + worker 번들).
  - `pnpm db:migrate:local` + `pnpm db:seed:local` (서울역 인근 5개 방).
  - API: `/api/health`, `/api/config`, `/api/rooms`(bbox) 정상, 잘못된 bbox → 400.
  - WebSocket(`tools/ws-smoke.mjs`): join→snapshot(canWrite=true), paint→두 클라이언트 모두 pixel 브로드캐스트 수신,
    presence online=2, ack ok cd=5000; 원거리 → out_of_range, 저정확도 → low_accuracy 거부 확인.
  - D1 인덱스 동기화: paint 후 pixel_count 0→1, last_drawn_at 갱신 확인.
  - 프라이버시: 소스 코드에 원본 좌표 로그 없음.

## 2026-06-14 — 랜딩 리디자인 (다크 → playful clay)

- `client/src/components/LandingPage.svelte` 전면 리스타일: 다크 해커톤 톤 →
  밝은 크림(#FFF7E8) 배경 + 굵은 검정 테두리 + 하드 오프셋 그림자(`6px 6px 0`) +
  둥근 클레이 카드 + 원색 포인트(blue/yellow/green/red/purple)의 "playful clay interface".
  참조 교육플랫폼의 디자인 *언어*만 차용(크림 배경/검정 테두리/클레이 카드/floating badge/
  product mock), 교육 카피·Courses/Pricing 등 정보구조는 의도적으로 제외.
- 구성: Hero(브랜드+핵심문장+CTA 2종+stat chips+지도패턴 위 보드 mock+floating badge) →
  "How it works" 4카드(Pick a place / Paint nearby / Watch it live / Privacy by design,
  lucide-svelte 아이콘) → "One canvas per place" 칩 → 하단 CTA 카드 → footer.
- 디자인 토큰은 **`.landing` 스코프 내부에만** 정의 → VerifyGate/RoomPanel/MapView 등
  나머지 다크 테마 화면과 `app.css`는 일절 미수정. 픽셀 아트 팔레트는 그대로 사용.
- 실제 상수 사용: 보드 `192×128`(BOARD_W/H), `32 colors`(PALETTE.length), `100m`(WRITE_RADIUS_M).
  (브리프의 "96×64 / 16 colors"는 구버전 수치 → 실제 상수로 표기.)
- props 계약 유지: `onenter("paint")` / `onenter("explore")` 그대로. CTA→/verify→(테스트키 자동통과)→/app 확인.
- 접근성: 장식 요소 `aria-hidden`, `prefers-reduced-motion` 시 애니메이션 정지.
- 검증: `pnpm check` 0 errors, `pnpm build` 성공. Playwright로 desktop(1280)·mobile(390) 첫 화면 +
  하위 섹션 스크린샷 확인(가로 스크롤 없음, CTA 첫 화면 노출), "Start painting" 클릭 → /app 진입 확인.
