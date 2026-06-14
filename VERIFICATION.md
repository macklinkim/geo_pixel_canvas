# VERIFICATION.md — 작업 완료/검증 기록

작성일: 2026-06-14
대상: Geo Pixel Board v1 (중간 산출물 + 브라우저 실검증)

이 문서는 "지금까지 만든 것"과 "실제로 동작함을 어떻게 확인했는지"를 한 곳에 정리한다.
이전 단계까지의 백엔드 검증(Node 스크립트)에 더해, **실제 브라우저(Playwright)로 화면 렌더링과
그리기 동작까지 확인**한 결과를 포함한다.

---

## 1. 현재까지 완성된 것 (요약)

### 1-1. 백엔드 / 인프라
- pnpm + Vite 6 + `@cloudflare/vite-plugin`, TypeScript strict.
- `wrangler.toml`: D1(`DB`), Durable Object(`ROOM`), 정적 assets(`ASSETS`), `/api`·`/ws`만 Worker first.
- D1 마이그레이션 `0001_create_rooms.sql`, 시드 5개 방(서울역 인근).
- Hono API: `/api/health`, `/api/config`, `GET/POST /api/rooms`.
- `RoomDurableObject`: WebSocket Hibernation, 픽셀 SQLite, 서버측 위치 게이팅 + 쿨다운, snapshot/브로드캐스트, D1 인덱스 best-effort 동기화.

### 1-2. 프론트엔드 (Svelte 5 runes)
- MapLibre 지도 + 방 핀 레이어 + 디바운스 bbox 조회.
- 단일 canvas 픽셀 보드 렌더러(명령형) + WebSocket(자동 재연결 + 재join).
- 위치 권한 UX, 16색 팔레트, 쿨다운 표시, 상태 배너.

### 1-3. 이번 라운드에서 사용자 요청으로 추가/변경한 것
| 요청 | 반영 |
| --- | --- |
| 핀 클릭 시 지도 위에 **모달(중앙 큰 창)** 로 보드 표시, 거기서 그림 | `RoomPanel`을 backdrop + 중앙 모달로 재설계. Esc/백드롭 클릭으로 닫기. |
| **"내 위치로 이동" 버튼** (그릴 수 있는 영역으로 복귀) | 지도에 MapLibre `GeolocateControl` + 커스텀 "내 위치로" 버튼 추가. `NavigationControl`(줌)도 추가. |
| 그림판이 안 보임 | 보드에 **격자 그리드 + 프레임/그림자**를 넣어 빈 보드도 그리기 영역으로 명확히 보이게 함. |

### 1-4. 함께 고친 버그
- **지도 타일 z20 over-zoom 에러(콘솔 48개+)**: 래스터 소스 `maxzoom: 19` + 지도 `maxZoom: 19`로 차단 → 콘솔 에러 0.
- **이전 세션의 과도 줌 뷰가 localStorage에 저장되어 핀이 화면 밖**: 저장 줌을 19로 클램프. (기본 줌 16에서 핀 정상 표시 확인.)

---

## 2. 검증 방법과 결과

### 2-1. 정적 검증
| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 체크 | `pnpm check` | **0 errors, 0 warnings** (svelte-check + worker tsc + shared tsc) |
| 프로덕션 빌드 | `pnpm build` | **성공** (client + worker 번들 생성) |

### 2-2. 백엔드 동작 검증 (로컬 `pnpm dev`)
| 항목 | 결과 |
| --- | --- |
| `GET /api/health` | `{ok:true, version:"0.1.0"}` |
| `GET /api/config` | `{mapStyleUrl:null}` |
| `GET /api/rooms?bbox` | 시드 5개 방 반환 |
| 잘못된 bbox | **HTTP 400** |
| WebSocket join | snapshot 수신(canWrite, online, 4096바이트 base64) |
| WebSocket paint | 두 클라이언트 모두 `pixel` 브로드캐스트 수신, `ack ok cd=5000` |
| 위치 게이트 | 원거리 → `out_of_range`, 저정확도 → `low_accuracy` 거부 |
| D1 동기화 | paint 후 `pixel_count` 증가 확인 |

(스크립트: `tools/ws-smoke.mjs`)

### 2-3. 브라우저 실검증 (Playwright, `http://localhost:5174`)
> 주의: 포트 5173이 점유되어 dev 서버가 **5174**로 떴음. 사용자가 5173에서 빈 화면을 본 원인 중 하나일 수 있음(죽은/이전 서버).

| 단계 | 확인 내용 | 결과 |
| --- | --- | --- |
| 최초 로드 | 지도 렌더, 방 핀 표시, 모달 자동 오픈 없음, 콘솔 에러 0, "내 위치로" 버튼 존재 | ✅ |
| 핀 클릭 | 지도 위 **중앙 모달** 오픈, 제목/접속자수/닫기, **격자 보드** 표시, 팔레트 표시 | ✅ ([modal-open.png](docs/screenshots/modal-open.png)) |
| 위치 허용(모킹: 남대문로 셀 중심) | 배너 "이 장소에서 그릴 수 있어요." + 보드 활성화(`disabled` 해제) | ✅ |
| 보드 클릭(그리기) | 중앙 셀에 픽셀 렌더 | ✅ ([painted.png](docs/screenshots/painted.png)) |
| 캔버스 픽셀 데이터 검사 | 칠해진 셀 1개, 좌표 (31,31), rgb [177,62,83] = `#b13e53`(팔레트 2번) | ✅ |
| 서버 영속성 | D1 `wydm9hpe`(남대문로) `pixel_count` 39 → **40** | ✅ |

스크린샷:
- 초기 로드: `docs/screenshots/load.png`
- 모달 + 보드: `docs/screenshots/modal-open.png`
- 그리기 후: `docs/screenshots/painted.png`

---

## 3. 의도 대비 충족 여부

| 사용자 의도 | 충족 |
| --- | --- |
| 현재 위치에서 픽셀 보드 **수정** | ✅ 위치가 방 반경(100m) 안일 때만 서버가 그리기 허용 (게이트 검증됨) |
| 현재 위치가 아닌 곳의 보드 **구경** | ✅ 위치 없이도 접속 시 snapshot 수신(보기 전용), 핀 클릭으로 다른 곳 보드 열람 |
| 핀 클릭 → 모달 큰 창에 보드, 거기서 그리기 | ✅ 재설계 완료, 브라우저 검증 |
| 내 위치로 이동 버튼 | ✅ "내 위치로" 버튼 + 표준 위치 컨트롤 |

---

## 4. 알려진 한계 / 남은 작업
- **데스크톱 실측위 한계**: 데스크톱 브라우저는 IP 기반 대략 위치라 시드 방(서울) 반경 밖이면 실제로는 그리기 불가. 위 그리기 검증은 위치를 셀 중심으로 모킹하여 수행함. 실사용은 모바일 현장 또는 해당 위치에서 동작.
- **타일 정책**: 현재 OSM 래스터 폴백(저트래픽 전용). 공개 배포 전 타일 제공자/약관 확정 후 `MAP_STYLE_URL` 설정 필요.
- **테스트 자동화**: 지시에 따라 자동 테스트는 미작성. 품질 게이트는 `pnpm check` + 수동/Playwright 스모크.
- **Phase F (프로젝트 전용 MCP 서버)**: 미착수(후순위).
- **배포**: 실제 D1 `database_id` 교체 + remote 마이그레이션 후 `pnpm deploy` 필요.

---

## 5. 재현 방법
```bash
pnpm install
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev                      # http://localhost:5173 (점유 시 5174)
# 브라우저에서 핀 클릭 → 모달 → (현장 위치면) 그리기
node tools/ws-smoke.mjs       # 백엔드 실시간 스모크
```
