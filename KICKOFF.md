# KICKOFF — 다음 작업

목표: 핵심 동작 + 디자인(랜딩 클레이) + 운영 기능(탐색/보존/admin)까지 갖춰졌다.
다음은 **앱 본화면 톤 통일**과 **운영 배포 마무리**가 중심.

## 실행
- `pnpm dev` → http://localhost:5173 (Turnstile 테스트키 활성, 위젯 자동통과)
- `pnpm check` 통과 유지. 자세한 이력은 `history.md`, 검증은 `VERIFICATION.md`.

## 디자인 진입점
- 토큰/전역 CSS: `client/src/app.css` (`--bg/--surface/--accent/--radius` 등)
- 픽셀 팔레트(32색): `shared/palette.ts` / 보드: `client/src/lib/board/boardRenderer.ts`
- 화면: `LandingPage.svelte`(랜딩), `VerifyGate.svelte`(/verify), `RoomPanel.svelte`(보드 모달),
  `MapView.svelte`(지도+검색/항공/내위치), `PixelBoard.svelte`(줌·팬·커서), `Palette/MiniMap/Cooldown`.
- 지도 스타일: 베이스맵 카탈로그 `client/src/lib/map/mapStyle.ts`(`BASEMAPS`: 항공/상세/심플),
  전환 `mapController.setBaseMap()`. 서버 `wrangler.toml` `MAP_STYLE_URL`(positron) = "심플"용.
- 파비콘/브랜드 마크: `public/favicon.svg`(= 랜딩 헤더 로고와 동일 픽셀 마크).

## 기능/운영 진입점 (디자인 외)
- 최근 그림 탐색: `GET /api/rooms/recent`(worker/src/rooms.ts) + `MapView.svelte` 오버레이.
- 데이터 보존/자동삭제: `worker/src/retention.ts`(cron `scheduled` in index.ts, `[triggers]` in wrangler.toml).
  규칙 = 채움률<50% 2주 / ≥50% 6개월 무활동 시 삭제. DO `purge()` → D1 행 삭제 순.
- Admin Override: `worker/src/admin.ts`(login/logout/session, `gpb_admin` 서명쿠키), DO는 admin이면
  위치 게이트만 우회. UI: `AdminPanel.svelte`(`/admin`) + MapView `Admin mode` 배지. secret은 `.dev.vars`.
  - **진입 방식**: 브라우저에서 `/admin` 직접 접속 → 운영자 코드 입력 → `gpb_admin` 쿠키 발급 →
    `/app`에서 `Admin mode` 배지 표시되고 위치 무관 paint/stamp/rename 가능. 로그아웃은 `/admin`에서.
    (일반 UI엔 admin 링크 없음 — URL을 알아야 진입. 숨은 백도어 아님: 코드+서버검증 필요.)
  - **코드**: 로컬은 `.dev.vars`의 `ADMIN_SECRET_HASH`(dev 코드 `gpbadmin2026`). 운영은
    `wrangler secret put ADMIN_SECRET_HASH`(운영 코드의 sha-256 hex) — secret 없으면 admin 자동 비활성.

## 현재 디자인 상태
- **랜딩**: playful clay(크림 #FFF7E8 배경, 굵은 검정 테두리, 하드 오프셋 그림자, 클레이 카드,
  원색 포인트, floating badge + 보드 mock). 토큰은 `LandingPage.svelte` `.landing` 스코프 한정.
- **지도**: 좌하단 `항공/상세/심플` 베이스맵 선택기(기본 항공, 선택 localStorage 기억).
- **앱/보드**: 여전히 **다크 테마** — 모달 보드(흰 도화지·격자), 동작별 커서, 도장, 미니맵, 하단 바.
  → 랜딩(클레이)과 앱(다크)의 톤이 아직 분리돼 있음(아래 후보 1 참고).

## 최근 완료 (2026-06-14, 상세는 history.md)
- 랜딩 다크→클레이 리디자인 / 지도 베이스맵 3종 선택기 + 상세(liberty) 복원 / 파비콘 추가.
- 최근 그림 탐색 UI(`/api/rooms/recent` + 오버레이).
- 데이터 보존/자동삭제 cron(2주·6개월 규칙).
- 운영자 Admin Override(서버검증, 위치 게이트만 우회).

## 배포 전 운영 TODO (Cloudflare)
- `pnpm deploy` — admin 코드 + retention `scheduled`/cron 트리거가 배포돼야 실제 동작.
- `wrangler secret put ADMIN_SECRET_HASH` — 운영 코드의 sha-256 hex. **없으면 admin 자동 비활성**(안전 기본).
  운영 코드는 dev용 `gpbadmin2026` 쓰지 말 것.
- cron(`0 18 * * *`)은 배포 시 자동 등록 — 대시보드 Triggers에서 확인만.

## 다음 후보 (택1로 시작)
1. **톤 통일 결정**: 앱(지도 UI·Verify·보드 모달)을 랜딩 클레이로 맞출지, 아니면 랜딩만 밝게 둘지.
   맞춘다면 `app.css` 다크 토큰부터 손대야 함(픽셀 팔레트는 계속 분리 유지).
2. 핀/마커 리디자인(핫/일반/내위치) — 베이스맵 3종(특히 항공) 위에서 가독·일관성 확보.
3. 보드 모달 반응형(모바일 한 손) + 팔레트/도장 정보구조 정리.

## 알려진 미해결
- 로컬 D1 미마이그레이션 시 `/api/rooms` 500(핀 안 뜸) → `pnpm db:migrate:local` + `pnpm db:seed:local`.
- admin 로그인 레이트리밋은 isolate 내 in-memory(프로덕션 다중 isolate에선 느슨) — 1차 방어는 고엔트로피 코드.

## 가드레일 (깨지면 안 됨)
- Svelte 5 runes만. 보드는 단일 canvas.
- 위치 게이트/쿨다운/레이트리밋/Turnstile 서버검증·프라이버시(좌표 미저장) 불변.
- 디자인 토큰과 **픽셀 팔레트는 분리**(UI 색이 아트 팔레트를 덮지 않게).
- Admin은 **위치 게이트만** 우회 — WRITE_DISABLED·Zod·human·rate/flood는 유지. secret 클라 미노출, 좌표 미로깅.
