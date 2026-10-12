# Публикация после шага 08 — Netlify preview

Дата: 2026-10-12. База: fd231ba (код шага 08:975ead2). Отдельная ветка: codex/uad-netlify-step08.

Пользователь разрешил пуш новой ветки и публикацию всего сделанного, включая шаг 08. Это отдельный файловый preview, прежний Supabase-сайт GitHub Pages не заменяется. Функциональный следующий шаг 09 остаётся переносом аналитики, а не этой публикацией.

## Подготовлено

- netlify.toml, отдельный npm run build:netlify, собственный ignored publish-dir .netlify/publish. Обычная dist/локальный preview5187 сохраняются.
- Корень нового сайта открывает app.html. /accidents/ тоже открывает единую оболочку; старый Supabase entry сохранён как /accidents/supabase.html, диагностические files.html/benchmark.html доступны.
- 195 фактически публикуемых файлов данных,70 151 851 байт:96 Arrow+Brotli,96 ParquetZSTD10, оба fleet-варианта и JSON summaries. Все 2020–2025/16 земель сохранены. Identity IPC entries — metadata_only для checksum/reserve, а не дополнительный скачиваемый набор. Нормализованные CSV/полные архивы/дубликаты/локальные настройки не выкладываются.
- Generation в URL:404fc8c681334561911392783520c8f2. Manifest с точным списком опубликованных файлов; каждый payload до копирования сверяется по размеру/SHA256. Неизвестные пути отвечают 404.
- Netlify Edge Function только меняет streaming headers для .br; не распаковывает/не буферизует файл. Распаковку делает браузер. Content-Encoding нельзя надёжно задать обычным _headers: https://docs.netlify.com/manage/routing/headers/.
- Cache для immutable generation —1 год/no-transform. HTML revalidate. Обе карты/benchmark используют один явно заданный dataBase.
- deployment/source.json позволяет сборку на компьютере без UAD_data: скачивает тот же опубликованный проверенный набор. Raw HTTPS сохраняет сжатые .br bytes. Первое размещение выполняется из локального экспорта; обновления данных требуют отдельного нового completed export/generation.

## Проверки перед публикацией

53 Node-теста прошли: прежние 50 плюс safety/all-formats/hash checks deployment adapter. Targeted ESLint и отдельная production-сборка прошли. Прежнее предупреждение loaders.gl spawn сохраняется. Netlify CLI существующий вход Kirman442; TLS проверяется через системные доверенные сертификаты, не отключается.

Создан отдельный project1c970989-a6c6-4e65-b4d8-44c476014846, kirman442-uad-step08. Live URL: https://kirman442-uad-step08.netlify.app/. Статус: **опубликовано и проверено**. Окончательный deploy:6accf8a8a1755d1347ef51db, release-code commit:4a25c53. Ветка запушена. Постоянный URL выше; immutable deployment URL: https://6accf8a8a1755d1347ef51db--kirman442-uad-step08.netlify.app/.

## Повторный запуск

После npm ci использовать npm run build:netlify. Из Netlify CLI27+ выполнить deploy --no-build --dir .netlify/publish --site 1c970989-a6c6-4e65-b4d8-44c476014846 --prod только по разрешению пользователя. Для прототипов prebuild:netlify обязателен. Секреты не входят в Git; legacy Supabase entry при сборке на другом компьютере требует прежних публичных VITE-переменных, основная файловая оболочка от них не зависит.

Первый деплой выполняется CLI из этой ветки. Это ещё не автоматический GitHub-triggered deploy: отдельная настройка continuous deployment/GitHub integration не выдаётся за уже подключённую. Код/Netlify config/data source в ветке достаточны для повторяемой сборки; GitHub source push и Netlify publication проверяются отдельно.

Исходники публикационного дополнения сохраняются отдельно в 08_step_Netlify_preview.zip после окончательной фиксации. ZIP08 App_shell_and_shared_cache не перезаписывается. В архиве исходников нет 195 больших payloads; они находятся в исходном UAD_data и на новом сайте.


## Результат живых проверок

Все 195 файлов проверены поHTTP: status200, исходный size/SHA256. У .br проверены Content-Encoding:br и checksum распакованного IPC. Все 10entry/prototype/WASMстраниц доступны, неизвестный data path даёт 404. Отчёт:UAD_data/netlify-step08-http.json.

Главное приложение: стартовый обзор без полных точек;2025 Германия 273007/NRW61521; фильтр category3 поГермании 230100; карточка с кольцом открывается, survivesmenu, и сохранённый query/cache не повторяются. Раскрытие 50 м прошло; его пиксельные кандидаты не приравниваются к радиусу 50 м. Time2020–2024/Pkw950740; явный переход наMap2024/Pkw/category3 —169153; cached2025+2024=53.88 МиБ. Back/Forward, Severity и 32 МиБ (текущий 2024=26.72 МиБ) прошли. Console errors нет. Физический телефон/полная мобильная UX-проверка остаются отдельным этапом.

Бенчмарк действительно прочитал 2025 вобоихформатах. Во всех четырёх сценариях совпали 273007/61521/25508/13162, включая ID/coordinates/statistics/fleet. По одному прогону: Parquet first-frame2623 мс/all-data6571 мс; Arrow1871/7556 мс. Это шумные отдельные сетевые прогоны, не доказательство превосходства формата. Raw report:UAD_data/netlify-step08-benchmark.json. Workers/WASM/GPU memory не измерены целиком.

Remote-data build тоже прошёл: UAD_BINARY_DATA был намеренно задан несуществующим путём, сборка скачала 195 файлов с immutable опубликованного base, сверила SHA256 и воспроизвела те же имена bundles. На Windows использованы Node24 и --use-system-ca из-за локального доверенного CA; сертификатная проверка не отключалась. Новая sourcebranch/config позволяют сборку без исходныхCSV/XLSX/полного 605 МБэкспорта.

Документация/publication metadata после размещения добавлены отдельным коммитом. Существующий GitHub Pages/Supabase сайт не менялся. Нет merge вmaster/main, нет новых таблиц/настроек БД. Automatic Git-triggered deployment не подключён: это явная CLI-публикация проверенной новой ветки.

Архив исходников:UAD_data/08_step_Netlify_preview.zip, с точным HEAD вSTEP_SNAPSHOT и .sha256. Снимки:netlify-step08-desktop.png (карта/карточка), netlify-step08-cache32.png (32 МиБ). Данные/Netlify auth/.netlify/builds остаются внеGit.
