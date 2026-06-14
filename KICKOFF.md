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
- 지도 스타일: `wrangler.toml` `MAP_STYLE_URL`(현재 OpenFreeMap liberty) / `client/src/lib/map/mapStyle.ts`

## 현재 디자인 상태
- 다크 테마, 모달 보드(흰 도화지·격자), 동작별 커서(펜/도장/이동), 국기·스마일 도장, 미니맵, 하단 컴팩트 바.

## 다음 후보 (택1로 시작)
1. 다크 지도 스타일 + 핀/마커 리디자인(핫/일반/내위치) 일관화
2. 랜딩/Verify/앱 비주얼 톤 통일(타이포·여백·모션 절제)
3. 보드 모달 반응형(모바일 한 손) + 팔레트/도장 정보구조 정리

## 가드레일 (디자인 중 깨지면 안 됨)
- Svelte 5 runes만. 보드는 단일 canvas.
- 위치 게이트/쿨다운/레이트리밋/Turnstile 서버검증·프라이버시(좌표 미저장) 불변.
- 디자인 토큰과 **픽셀 팔레트는 분리**(UI 색이 아트 팔레트를 덮지 않게).
