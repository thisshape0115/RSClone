# Rolling Sky — Web Port (Three.js)

Unity로 만들어진 Rolling Sky 1.0.0 오픈소스 프로젝트를 브라우저에서 바로 즐길 수 있게
Three.js로 새로 구현한 웹 포트입니다.

## 실행
`index.html`을 열거나 GitHub Pages로 배포하면 바로 플레이할 수 있습니다. 별도 빌드 과정 없음.

## 조작
- ← → / A D / 화면 드래그: 좌우 이동
- Space / 탭: 점프

## 구현된 장애물 (원작 SegmentType / PrefabName 기반)
- Gap (구멍), Wall (틈새 벽), Pyramid (피라미드 램프)
- Spikes (가시), TallTree (나무, 점프 불가·회피 전용)
- Riser (오르내리는 기둥), Crusher (내려찍는 해머)
- Slasher (회전 블레이드), Roller (좌우로 구르는 통)
- Binary (좌/우 번갈아 막히는 블록), Laser (점멸 레이저)
- Turbine (밀어내는 팬, 논-리썰), Fragile (밟으면 갈라지는 바닥)
- Boost (부스터 패드)

## 에셋 출처
`assets/` 폴더의 배경 아트웍, 공 텍스처, 효과음/음악은 원작
Rolling-Sky-1.0.0-Public 프로젝트에서 가져온 리소스입니다.

## 구조
```
index.html      진입점
css/style.css   HUD/오버레이 스타일
js/game.js      게임 로직 (Three.js)
assets/         원작 텍스처 & 오디오
```
