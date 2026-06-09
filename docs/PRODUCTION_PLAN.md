# ARTEST | BrainRocket — План продакшна (скиллы → задачи → игры)

Карта: какой локальный скилл Claude Code где использовать, в какой игре, ради чего —
до состояния **production-ready / award-winner**. Две игры:

- **Shining Pop** — PixiJS v8 (`games/shining-pop`), флагман, запускается на :5173.
- **Shining Pop V2** (бывш. slot-cocos-1) — Cocos Creator 3.8.8 (`games/shining-pop-v2`), запускается только в редакторе (:7456).

Причины реджекта Stake (1.00/3), которые надо закрыть: **inconsistent art · low-quality/AI assets · poor bet UI · shallow gameplay**.

Легенда: ✅ уже применял · 🎯 ключевой · ⏳ дальше.

---

## Фаза 0 — Аудит и оркестрация

| Скилл                                                                                                                 | Где / зачем                                                                                             | Игра    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------- |
| `/casino-ui-ux-audit` 🎯                                                                                              | 30-точечный аудит слот-UI: бар, спин, селектор ставок, баланс, paytable, автоплей, max-win → список дыр | обе     |
| `/design-review`, `/scope-check`, `/gate-check`                                                                       | ревью состояния, границы скоупа, гейты качества                                                         | обе     |
| `using-superpowers`, `dispatching-parallel-agents`, `subagent-driven-development`, `writing-plans`, `executing-plans` | оркестрация параллельных агентов (Workflow) для каждого этапа                                           | процесс |
| `systematic-debugging`                                                                                                | дисциплина дебага (как с багом content-length у фона)                                                   | процесс |

## Фаза 1 — Единый стиль / тема (реджект: inconsistent art + AI assets)

| Скилл                               | Где / зачем                                                             | Игра        |
| ----------------------------------- | ----------------------------------------------------------------------- | ----------- |
| `anthropic-skills:theme-factory` 🎯 | единая тема/палитра как система токенов                                 | обе         |
| `/pixi-design-tokens` 🎯            | мост дизайн-токенов → PixiJS theme.ts / фильтры                         | Shining Pop |
| `/ui-ux-pro-max`                    | база палитр/шрифтовых пар/UX-правил (питает токены)                     | обе         |
| `/art-bible` 🎯                     | арт-библия: один стиль для фон↔символы↔бар (гейт всей графики)          | обе         |
| `/asset-spec` 🎯                    | пер-ассет спеки + промпты для генерации (твой набор артов для Cocos)    | обе         |
| `/pascal-symbols`, `/asset-audit`   | качество/консистентность символов, аудит ассетов (без Pascal-брендинга) | обе         |
| `/brandkit`                         | финальный лого/брендборд ARTEST (по желанию)                            | бренд       |

## Фаза 2 — Бар / UX до экспертного (реджект: poor bet UI)

| Скилл                                                                                                                    | Где / зачем                                                                | Игра        |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------- |
| `/ui-slot-ux-designer` ✅                                                                                                | контракт UX бара, иерархия, состояния спина                                | обе         |
| `/slot-ui-studio` 🎯                                                                                                     | компонентная система бара, паттерны состояний, gates продакшна             | обе         |
| `/turbo-spin-designer`, `/autoplay-system-designer`                                                                      | турбо 3-state, автоплей со stop-условиями (count, stop-on-feature/big-win) | обе         |
| `/mobile-safe-area-canvas` 🎯, `/pascal-slots-responsive-positioning`, `anthropic-skills:pixijs-responsive-mobile-first` | мобайл без обрезов/налеганий, safe-area                                    | обе         |
| `/web-design-guidelines`, `/pixijs-accessibility`                                                                        | a11y/читаемость, ARIA                                                      | Shining Pop |
| `/game-info-author`                                                                                                      | paytable / правила / дисклеймер (Stake-обязательно)                        | обе         |

## Фаза 3 — VFX / церемонии (реджект: low quality; твоя жалоба на bonus/ceremony)

| Скилл                                                                                                                    | Где / зачем                                                              | Игра        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------- |
| `/slot-vfx-artist` 🎯 + `/pascal-vfx` 🎯                                                                                 | редизайн церемоний (3-beat: anticipation→count→savour), win-VFX, big-win | обе         |
| `/pascal-slots-pixi-visuals` 🎯                                                                                          | референс визуального слоя Pixi (bloom/haze/частицы/shake/кнопки)         | Shining Pop |
| `/pixijs-filters`, `/pixijs-scene-particle-container`, `/pixijs-blend-modes`, `/pixijs-scene-graphics`                   | реализация эффектов (фильтры/частицы/additive/вектор)                    | Shining Pop |
| `anthropic-skills:pixi-v8-shader-fx-engineering`                                                                         | inline-GLSL шейдер-фx (refraction/bloom/heat) — Stake-safe               | Shining Pop |
| `/pascal-slots-spine`, `/spine-pixi-integration`, `/spine`, `/spine-asset-optimizer`                                     | спайн-символы (crown rig), оптимизация атласов                           | обе         |
| `event-animation-designer`, `anthropic-skills:web-animations`, GSAP ✅, `/pixijs-ticker`                                 | тайминги/easing/секвенсинг, моушн на GSAP                                | обе         |
| фиксы Shining Pop: убрать «плохой фильтр» бонуса, краун-на-чёрном, переделать церемонии (есть точные line-refs из scout) |                                                                          | Shining Pop |

## Фаза 4 — Глубина геймплея (реджект: shallow gameplay)

| Скилл                                                    | Где / зачем                                                                    | Игра |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| `/slot-mechanics-designer`, `/ai-slot-game-developer` 🎯 | новые механики: множитель/стрик/прогресс, фичи удержания                       | обе  |
| `/game-math-director`, `/senior-game-math-engineer` 🎯   | мат-модель, ~96% RTP, дисперсия                                                | обе  |
| `/slot-rng-math-architecture`, `/rng-crypto-specialist`  | RNG-архитектура                                                                | обе  |
| `/rtp-optimizer`, `/auto-balancer`, `/balance-check`     | калибровка RTP/весов (Cocos сейчас ≈94.27% — нужен ребаланс)                   | обе  |
| `/book-generator` 🎯                                     | outcome books (`books_*.jsonl` + `lookUpTable_*.csv` + `index.json`) для Stake | обе  |
| `/ux-retention-designer`                                 | хуки удержания                                                                 | обе  |

## Фаза 5 — Аудио (твоя жалоба)

| Скилл                                                              | Где / зачем                                                                             | Игра  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----- |
| `/slot-audio-engineer` ✅🎯, `/team-audio`                         | элегантный саунд-дизайн, 5-bus, ducking, синк под анимации                              | обе   |
| `/music`, `/sound-effects` ✅ (ElevenLabs)                         | музыка-лупы + SFX (сделал 26 SFX + элегантные лупы; нужно врезать луп в startIdleMusic) | обе   |
| Cocos: своя `AudioManager` сейчас заглушка → завести реальный звук |                                                                                         | Cocos |

## Фаза 6 — Cocos (отдельная игра, экспертный нативный код)

| Скилл                                                                                                  | Где / зачем                                                                         | Игра  |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----- |
| перенос знаний Shining Pop (church/scout) + методология `/pascal-slots-*` (БЕЗ Pascal/Stake брендинга) | церемонии/символы/спин/бонус на Cocos-нативе (cc.Graphics / particle / spine-cocos) | Cocos |
| `/asset-spec` + твой набор артов (256×256 PNG, имена `sym_*`)                                          | дроп-ин символов + фон                                                              | Cocos |
| паритет с Shining Pop: scatter, FS-ретриггер, мульти-турбо, реальный автоплей                          |                                                                                     | Cocos |

## Фаза 7 — Производительность

| Скилл                                                                                | Где / зачем                                                   | Игра |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---- |
| `/pixijs-performance` 🎯, `/perf-profile`, `anthropic-skills:pixi-v8-object-pooling` | FPS/draw-calls/память, пулы объектов, не уронить перф полишем | обе  |

## Фаза 8 — QA / верификация / релиз (production-ready)

| Скилл                                                                                                       | Где / зачем                                                                         | Игра        |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- |
| `/webapp-testing` 🎯 (Playwright)                                                                           | прогон всех состояний + 7 пресетов, скриншоты, лог консоли (обход залипшего превью) | Shining Pop |
| `/slot-qa-engineer`, `/qa-plan`, `/regression-suite`, `/smoke-check`, `/soak-test`                          | тест-планы, регрессии, smoke/soak                                                   | обе         |
| `verification-before-completion`, `/test-evidence-review`                                                   | дисциплина «проверено, а не на словах»                                              | процесс     |
| `/stake-game-developer` 🎯, `/stake-engine-architect`, `/stake-platform-architect`, `/provider-integration` | Stake-комплаенс, single-file билд, RGS, гейты                                       | обе         |
| `/localize` 🎯                                                                                              | i18n (en/es/fr/de/pt) — Stake требует в первой сабмишн                              | обе         |
| `/security-audit`, brand-lint (наш)                                                                         | без внешних ресурсов, тихая консоль, без Stake/Pascal токенов в шипнутом            | обе         |
| `/release-checklist`, `/launch-checklist`, `/day-one-patch`, `/gate-check`                                  | финальные чек-листы перед сабмишн                                                   | обе         |

---

## Порядок (рекоменд.)

0. Аудит (`/casino-ui-ux-audit`) → дыры.
1. **Тема/арты** (theme-factory + art-bible + asset-spec) — закрывает «inconsistent/AI» → ты генеришь арты.
2. **Бар/UX** (slot-ui-studio + responsive) — закрывает «poor bet UI».
3. **VFX/церемонии** (slot-vfx-artist + pixijs-filters/particles) — закрывает «low quality» + твою жалобу.
4. **Глубина** (mechanics + math + book-generator) — закрывает «shallow gameplay».
5. **Аудио** (врезать элегантные лупы).
6. **Перф** (performance/pooling).
7. **QA/Stake/i18n/релиз** (webapp-testing + stake-\* + localize + checklists).
8. **Cocos** — параллельно после артов (свой набор), экспертный нативный код + паритет.

Каждая фаза = отдельный Workflow (fan-out + adversarial verify), результат проверяется live (Pixi) или в редакторе (Cocos).
