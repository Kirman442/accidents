# UAD: standalone land-table experiment

Isolated accidents branch based on commit 457de74; corrected filtering is carried over from 6a743a3. The current accidents checkout and source Supabase are not modified.

## Run locally

Copy .env.example to .env.local and enter the new project URL and publishable key. Never put a database password or service-role key in a VITE variable.

Run npm ci, npm test and npm run dev -- --port 5175. Open http://127.0.0.1:5175/accidents/.

## Loading

The application reads unfallatlas_uland_01 through unfallatlas_uland_16 directly. These must be standalone tables with a unique oid index and public read access. No parent table or API view is needed. Coordinates load before attributes. Each completed land is shown immediately as points; aggregation starts only after all coordinates are complete, with four concurrent land tasks and requested pages of 20000 rows. Rows are ordered by oid, offset advances by the actual response length, and an empty page ends a land. No exact count or automatic retries are used by the map. Dataset must remain unchanged during a load.

Filters preserve Alle / Mit / Ohne: null is All and zero is Without. They are disabled until the attribute merge is complete. Request failures are displayed with a retry button; obsolete loads are cancelled.

## Data transfer

The scripts are guarded to the original and new project references for this experiment. Credentials are read only from ignored local files.

- scripts/transfer-data.mjs export reads the source sibling accidents/.env and exports all columns to data/transfer.
- scripts/transfer-data.mjs import reads data/uad_settings.txt and creates standalone tables in the new project in one transaction. It refuses existing table names; do not rerun after a successful import.
- scripts/transfer-data.mjs verify compares the actual production loader results with the export, per row and land.
- scripts/db-check.mjs checks the target connection and schema.

Use node --use-system-ca when required by the Windows certificate configuration. Import requires psql; UAD_PSQL can override the default local executable. Geometry is transferred through GeoJSON into PostGIS. Source count/export/verification files remain local and are not committed.

See docs/loader-audit.md and docs/validation.md for findings and verified results.

## Analytics preparation

See docs/analytics-dataset.md for local preparation of Unfallatlas 2020-2025 and KBA FZ 1 snapshots 2020-2026. Generated datasets stay under ignored data/; preparation does not modify Supabase or the published map.

## Binary data preparation

Run RUN_PREPARE_BINARY.cmd for local desktop export of the audited dataset to Parquet and Arrow. See docs/binary-dataset.md for compression profiles, five-decimal runtime coordinates, full-precision archives, validation and recorded loader proposals. No database or production changes.

## Local file-loader comparison

A separate diagnostic page compares actual Parquet and Arrow decoding, progressive land display, four-worker filtering, analytics and fleet rates. Run npm run build and npm run preview -- --host 127.0.0.1 --port 5186 --strictPort, then open http://127.0.0.1:5186/accidents/benchmark.html. See docs/file-benchmark.md for setup, measured results and limits. Generated data stays local; production remains unchanged.

## Step 01 — Loader and cache (2026-10-11)

The current file-loader entry point is /accidents/files.html: selected-year Arrow+Brotli or Parquet, four persistent workers, progressive land display and an LRU data-buffer budget of 100/32 MiB. Source data now lives outside Git in the adjacent UAD_data folder. Run the preview on port 5187. No Supabase environment is needed for this page.

See README_01_step_Loader_and_cache.md for the step report and archive workflow, and docs/progress.md for the overall journal. Archives stay local in UAD_data/NN_step_Name.zip; data, credentials, dependencies and build output are excluded. The existing Supabase map and benchmark remain separate entry points.

## Step 02 — Overview and fleet (2026-10-11)

The file page now starts with a 26 KB public summary bundle: annual Unfallatlas totals for 2020–2025, severity, overlapping participant groups, land comparisons and crashes involving Pkw per 10,000 registered Pkw. All 119 national/land fleet snapshots from 2020–2026 are included. The overview remains available independently of map loading and LRU clearing. Selected land persists when switching year/source/budget.

Regenerate the small tracked public bundle with `node scripts/prepare-overview.mjs <complete binary export folder>`, then test and build. Full source datasets stay outside Git in UAD_data. See README_02_step_Overview_and_fleet.md for inputs, checksum validation, formulas, browser checks and the local archive `02_step_Overview_and_fleet.zip`. Arbitrary combined filters remain step 03; publication requires separate approval.

## Step 03 — Analytics mockups (2026-10-11)

Standalone review screens are saved in `prototypes/overview-mockup.html` and `prototypes/time-mockup.html`. The second screen uses verified joint time aggregates, calendar-adjusted weekday/weekend profiles and participant/period selection. These are design prototypes; the application loader and map remain at step 02.

The proposed generic filter implementation was deferred pending analytics decisions. See `docs/analytics-candidates.md` for the appendable candidate register and `README_03_step_Analytics_mockups.md` for scope, data checks and local archive `03_step_Analytics_mockups.zip`.

## Step 04 — Severity and conditions (2026-10-11)

The third standalone prototype is `prototypes/severity-mockup.html`: outcome categories, annual shares, lighting/road comparisons and joint cells with actual counts. All three prototypes now retain the header controls while scrolling. Candidate C17 records weekday/hour maxima and minima for later discussion. See README_04_step_Severity_and_conditions.md and docs/analytics-candidates.md. Local archive: `04_step_Severity_and_conditions.zip`.


## Шаг 05 — Map mockup · 2026-10-11

База `efebdda`. Четвёртый макет с настоящими точками, рабочими годом и землёй; переходы сохраняют контекст исследования. Header закреплён, дополнительные фильтры и карточка пока для обсуждения. C18 «Сравнения и рейтинги» отложен. Проверены сборка, ESLint, 30 тестов, числа карты, переходы и узкий экран. Ограничения iframe/кеша и локального запуска: `README_05_step_Map_mockup.md`. Полный локальный снимок: `UAD_data/05_step_Map_mockup.zip`.


## Шаг 06 — Map filters and cache · 2026-10-12

База 5e9679b. Реальные фильтры, фасетные счётчики, маски workers и GPU-отбор. Смена земли без повторной загрузки, годы из LRU 100/32 МиБ; актуальный год из каталога. 36 тестов, сборка, ESLint и CSV/браузерные сверки прошли. Правила: docs/map-filters.md. Проверки и ограничения: README_06_step_Map_filters_and_cache.md. Локальный архив: UAD_data/06_step_Map_filters_and_cache.zip.


## Шаг 07 — Accident card · 2026-10-12

База 21b5a91. Лёгкая карточка, выбор/кольцо, SVG-участники, время/последствия/сценарии/условия. Окрестность 50 м по запросу без индекса, текущие фильтры, ограниченная выдача. 42 теста, сборка, ESLint, реальные CSV/Arrow и браузерные проверки прошли. Адреса/названия населённых пунктов пока не подключены; похожие ДТП в районе отложены. Подробности: docs/record-card.md и README_07_step_Accident_card.md. Архив: UAD_data/07_step_Accident_card.zip.


## Шаг 08 — App shell and shared cache · 2026-10-12

База eb0e870. Единое приложение app.html, четыре раздела, нативная карта и один общий загрузчик/кеш. Переходы сохраняют карту, фильтры и карточку; стартовый обзор не загружает полные точки. Аналитика пока встроенные сохранённые макеты; её перенос запланирован отдельно. 50 тестов, ESLint, сборка и браузерные переходы прошли. Подробности: docs/app-shell.md и README_08_step_App_shell_and_shared_cache.md. Архив: UAD_data/08_step_App_shell_and_shared_cache.zip.


## Передача проекта после шага 08 · 2026-10-12

Подробный актуальный отчёт: docs/HANDOFF_2026-10-12_after_step08.md. Сверены remote refs, живой GitHub Pages, новая Supabase-схема/16 таблиц, внешние данные и архивы. Supabase-версия уже опубликована; файловая ветка со шагами 01–08 пока локальная. Нового функционального шага или публикации в рамках отчёта не выполнялось.


## Netlify preview после шага08 · 2026-10-12

Отдельная release-ветка codex/uad-netlify-step08. Подготовлены publication adapter, выбранные Arrow/Parquet всех лет, generation URL, Edge encoding и reproducible data source. Подробности/актуальный статус: README_08_release_Netlify_preview.md. Прежний Supabase-сайт сохраняется; шаг09 native-analytics ещё не выполнялся.


Публикация завершена: https://kirman442-uad-step08.netlify.app/. Ветка codex/uad-netlify-step08 наGitHub; новый live-check отчёт вREADME_08_release_Netlify_preview.md. Это отдельный CLI-deploy; automatic Git-trigger ещё не включён. Исходный Supabase-site сохранён.

## Дополнение после шага 08 — тема карты · 2026-10-12

База `8080a2b`. В общем header после «Показать на карте →» добавлен выбор тёмной CARTO Dark Matter (по умолчанию) и светлой Positron. Выбор сохраняется в браузере; карта, карточка, фильтры и кеш сохраняются при переключении. Проверки и границы: `README_08_map_theme.md`. Локальный снимок: `UAD_data/08_step_Map_theme.zip`. Шаг 09 не начат; push/deploy не выполнялись.

## Дополнение после шага 08 — кнопки темы карты · 2026-10-12

База `00216d0`. По образцу charging-points выпадающий список заменён луной и солнцем в общем блоке с выделением активной темы. Проверки: 53 Node-теста, ESLint, local/Netlify builds и реальные переключения подложки в браузере; count и кеш сохраняются, console errors нет. Подробности: `README_08_map_theme_buttons.md`. Архив: `UAD_data/08_step_Map_theme_buttons.zip`. Шаг 09 не начат.

## Подготовка UI/UX обзора после шага 08 · 2026-10-12

База `4c4d684`. Отдельный `prototypes/overview-layout-lab.html`: три варианта размещения, ограниченная ширина, перетаскивание/кнопки порядка, линия/столбцы/таблицы, исходные реальные сводки. URL: http://127.0.0.1:5189/overview-layout-lab.html?region=5&year=2025. Браузерные проверки данных, вариантов, reorder, mobile и console прошли. Подробности: `README_08_overview_layout_lab.md`; снимок: `UAD_data/08_step_Overview_layout_lab.zip`. Приложение и Netlify не менялись; шаг 09 React-port не выполнен.

## Уточнение раскладки · 2026-10-12

По скриншоту пользователя добавлен `variant=columns` / «Структура слева, земли справа»: слева Участники → Последствия с зазором 18 px, справа один высокий блок Сравнение земель. Независимая левая колонка устраняет пустой промежуток от высоты правого блока. Карточки и динамика выше, источники ниже. На мобильном участники → последствия → земли одним столбцом. При ручной перестановке/смене ширины группировка разворачивается в свободную сетку; выбор варианта/reset восстанавливает колонки. Проверены Hamburg2025, геометрия блоков, переключение вариантов, reset/reorder, отсутствие console errors и horizontal overflow на 390×844. Скриншот: UAD_data/08-overview-layout-columns.jpg. Новый архив: UAD_data/08_step_Overview_layout_columns.zip. Приложение/Netlify не менялись.

## Уточнение 45/55 и независимых показателей · 2026-10-12

База `ae66c30`. В варианте columns левая колонка занимает 45%, правая 55% доступной ширины без зазора. Сравнение земель получило собственный переключатель количества ДТП / доли тяжёлых последствий / на 10 000 Pkw. Его выбор управляет полосами, порядком таблицы и национальным ориентиром независимо от динамики; переключатель динамики подписан отдельно. Проверено в браузере в обе стороны: rate земель сохраняется при выборе severity динамики и count динамики сохраняется при выборе rate земель. Измеренная доля левой колонки 0.44999, console errors нет. Снимок: UAD_data/08-overview-layout-45-55.jpg. Архив: UAD_data/08_step_Overview_layout_45_55.zip. Приложение и Netlify не менялись.

## Шаг 09 — Native overview · 2026-10-12

База `319bc80`. Согласованный обзор перенесён из iframe в React: ограниченная ширина, 45/55, участники → последствия слева, земли справа, независимые показатели, графики/таблицы и методика. Контекст и данные принадлежат AppShell; существующий 26 КБ overview-бандл валидируется по generation, без загрузки полных точек. 56 тестов, ESLint, build и реальные browser-сценарии/mobile/history/card/cache прошли. Подробности: `README_09_step_Native_overview.md`. Снимок: `UAD_data/09_step_Native_overview.zip`. Время/тяжесть остаются iframe; шаги 10/11 отдельно. Push/deploy не выполнялись, Netlify пока версия после шага08 с кнопками темы.

## Подготовка UI/UX времени после шага09 · 2026-10-12

База `79ff7eb`. Отдельный mockup `prototypes/time-layout-lab.html` с CSS/controls: три порядка, ширина1190/1440, перестановка, четыре периода/24часа/столбцы дней, месяцы по годам с числами/таблицей, числовые шкалы и календарные детали. Общие filters territory/years/group; локальные day/hour и season/year-view не имитируют отсутствующий joint month×weekday×hour. Исходные агрегаты сохранены. Проверены календарь/суммы, browser filters/reorder/mobile; console errors нет. Документация `README_09_time_layout_lab.md`, архив `UAD_data/09_step_Time_layout_lab.zip`. Приложение/Netlify не менялись; React-шаг10 не начат.

## Сезонный профиль линией · 2026-10-12

База `36cf494`. По прямому уточнению пользователя месячные столбцы заменены адаптивной линией с 12 точками. Убраны min-width560px и горизонтальный scroll блока; viewBox рассчитывается по фактическому контейнеру. На узкой ширине оставлены четыре подписи месяцев, точные значения доступны на точках при hover/focus/click и Enter/Space, включая count и календарный знаменатель. Режимы count/daily/share и данные сохранены. Проверено: Hamburg2020–2025 июнь4454 ДТП/180дней=24.74, доля10.84%; 12точек; при390×844 panelWidth=panelScrollWidth317, document375/375; console errors нет. Снимок UAD_data/09-time-seasonal-line.jpg; архив UAD_data/09_step_Time_seasonal_line.zip. Приложение/Netlify не менялись.

## Вечерняя фиксация после шага09 · 2026-10-12

Передача для продолжения завтра: docs/HANDOFF_2026-10-12_evening_after_step09.md. Шаг09 готов локально; макет времени обсуждён до варианта tables с адаптивной сезонной линией, последний код4d7c8c3. React-шаг10 не начинать автоматически; Netlify ещё после08 с кнопками темы, новые push/deploy не выполнялись. Архив вечернего снимка: UAD_data/UAD_handoff_evening_2026-10-12_after_step09.zip.

## Динамика по годам вместо будней/выходных · 2026-10-13

База `4187fd1`. По запросу пользователя в лаборатории времени блок «Будни и выходные» заменён «Динамикой по годам»: count выбранной территории/группы, либо индекс2020=100. Для земли в индексном режиме показан пунктир Германии с отдельным национальным знаменателем; абсолютные количества страны и земли на одной шкале не смешиваются. Выбор all2020–2025/selected-period; выбранные годы крупными точками, значения по hover/focus/click/Enter/Space. График имеет собственный показатель и не меняется от global count/daily/share либо локальных day/hour/season. Смена территории/участника его обновляет. Перестановка сохранена. Попутно исправлено скрытие цветовых шкал в режимах обычных столбцов/таблиц.

Проверки: синтаксис JS; Germany2025=273007, Hamburg2025=7057, индексыHamburg115.76/Germany114.71; selected2025=1точка, Hamburg/Pkw2025=4441; console errors0. Данные/подготовка/app/Netlify не менялись. Снимок UAD_data/09-time-year-trend.jpg, архив UAD_data/09_step_Time_year_trend.zip. Это макет перед React-шагом10.

## Шаг 10 — Native time and seasonality · 2026-10-13

База `7b9756d`. По согласованию перенесены три карточки и три блока времени в React: сезонная линия, дни/часы, месяцы каждого года. Начальный вид — столбцы дней и таблица месяцев, доступны матрицы и count/daily/share. AppShell владеет контекстом и проверенным time.json383047байт;714 срезов сверены с overview, календарные знаменатели и суммы проверены. Годовая динамика удалена из лаборатории и отложена кандидатомC20. 60 тестов, ESLint, build и браузер/390px прошли. Детали README_10_step_Native_time_and_seasonality.md; архив UAD_data/10_step_Native_time_and_seasonality.zip. Тяжесть/условия остаётся iframe, UI/UX шага11 обсуждаем следующим. Push/deploy не выполнялись.

## Макет тяжести и условий после шага10 · 2026-10-13

База956eb63. По согласованию отдельный severity-layout-lab.html: понятные подписи долей/оснований, числа возле долей условий, явная область переключателя, выбранные годы фоном, сочетания матрица/точки с подробностями. Существующая структура и данные сохранены, max-width1190; общий UI/UX отложен. Browser Germany/Hamburg/Pkw, девять сочетаний, scope переключателей, 1280/390px и console errors0 проверены. README_10_severity_layout_lab.md, архив UAD_data/10_step_Severity_layout_lab.zip. App/Netlify не менялись; React-шаг11 после просмотра макета.

## Шаг11 — Native severity and conditions · 2026-10-13

База4f68206. Согласованный макет тяжести/условий перенесён в React: четыре карточки, динамика, отдельные условия, сочетания матрица/точки, таблица и методика. Контекст и проверенный severity.json90864байт принадлежат AppShell;714срезов сверены с overview, joint categories и земли проверены. Последний аналитический iframe убран: все аналитические разделы нативные. 64 теста, ESLint, build, browser filters/dialogs/persistence/map/history/390px прошли. README_11_step_Native_severity_and_conditions.md, архив UAD_data/11_step_Native_severity_and_conditions.zip. Общий UI/UX далее отдельно, Netlify не обновлялся.

## Публикация шагов09–11 · 2026-10-13

По прямому разрешению пользователя все накопленные коммиты запушены в codex/uad-netlify-step08 и опубликованы на существующем kirman442-uad-step08.netlify.app. Release code6db7683, deploy6ace008c94632ca6679e2e2e. 64 теста/build и208HTTP/hash проверок, включая195payloads/70151851байт иBrotli headers, прошли. Live native overview/time/severity/map проверены. README_11_release_Netlify_steps09_11.md; архив UAD_data/11_step_Netlify_release_steps09_11.zip. Нет Supabase/БД/merge изменений, автодеплой поpush не подключён. Следующий этап — общий UI/UX.

## Подготовка карты: сетка часов · 2026-10-13

Базаb7bf015. Согласован отдельный map-hours-lab.html:6×4часа, тумблеры рядов00–05/06–11/12–17/18–23, произвольные отдельные часы и последовательные диапазоны протягиванием, partial/full/off, подтверждение после отпускания и точные подписи. Два теста и browser drag/cross-row/remove/keyboard/390px прошли. README_12_map_hours_lab.md, архив UAD_data/12_step_Map_hours_lab.zip. В основной карте контрол ещё не заменён. Отдельно удалена согласованная сдвигающая надпись обновления счётчиков из всех dropdown; локальная сборка5187 обновлена. Netlify/push не выполнялись; общий UI/UX отложен.
