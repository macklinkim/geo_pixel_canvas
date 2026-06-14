# KICKOFF — 다음 작업(디자인 중심)

목표: 동작은 갖춰졌으니, 이제 **시각 디자인/UX 다듬기**로 이어간다.

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

## 현재 디자인 상태
- **랜딩**: playful clay(크림 #FFF7E8 배경, 굵은 검정 테두리, 하드 오프셋 그림자, 클레이 카드,
  원색 포인트, floating badge + 보드 mock). 토큰은 `LandingPage.svelte` `.landing` 스코프 한정.
- **지도**: 좌하단 `항공/상세/심플` 베이스맵 선택기(기본 항공, 선택 localStorage 기억).
- **앱/보드**: 여전히 **다크 테마** — 모달 보드(흰 도화지·격자), 동작별 커서, 도장, 미니맵, 하단 바.
  → 랜딩(클레이)과 앱(다크)의 톤이 아직 분리돼 있음(아래 후보 1 참고).

## 최근 완료 (2026-06-14, 상세는 history.md)
- 랜딩 다크→클레이 리디자인 / 지도 베이스맵 3종 선택기 + 상세(liberty) 복원 / 파비콘 추가.

## 다음 후보 (택1로 시작)
1. **톤 통일 결정**: 앱(지도 UI·Verify·보드 모달)을 랜딩 클레이로 맞출지, 아니면 랜딩만 밝게 둘지.
   맞춘다면 `app.css` 다크 토큰부터 손대야 함(픽셀 팔레트는 계속 분리 유지).
2. 핀/마커 리디자인(핫/일반/내위치) — 베이스맵 3종(특히 항공) 위에서 가독·일관성 확보.
3. 보드 모달 반응형(모바일 한 손) + 팔레트/도장 정보구조 정리.

## 알려진 미해결
- 로컬 D1 미마이그레이션 시 `/api/rooms` 500(핀 안 뜸) → `pnpm db:migrate:local` + `pnpm db:seed:local`.

## 가드레일 (디자인 중 깨지면 안 됨)
- Svelte 5 runes만. 보드는 단일 canvas.
- 위치 게이트/쿨다운/레이트리밋/Turnstile 서버검증·프라이버시(좌표 미저장) 불변.
- 디자인 토큰과 **픽셀 팔레트는 분리**(UI 색이 아트 팔레트를 덮지 않게).
