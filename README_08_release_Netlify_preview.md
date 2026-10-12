# Публикация после шага 08 — Netlify preview

Дата: 2026-10-12. База: fd231ba (код шага08:975ead2). Отдельная ветка: codex/uad-netlify-step08.

Пользователь разрешил пуш новой ветки и публикацию всего сделанного, включая шаг08. Это отдельный файловый preview, прежний Supabase-сайт GitHub Pages не заменяется. Функциональный следующий шаг09 остаётся переносом аналитики, а не этой публикацией.

## Подготовлено

- netlify.toml, отдельный npm run build:netlify, собственный ignored publish-dir .netlify/publish. Обычная dist/локальный preview5187 сохраняются.
- Корень нового сайта открывает app.html. /accidents/ тоже открывает единую оболочку; старый Supabase entry сохранён как /accidents/supabase.html, диагностические files.html/benchmark.html доступны.
- 195 фактически публикуемых файлов данных,70 151 851 байт:96 Arrow+Brotli,96 ParquetZSTD10, оба fleet-варианта и JSON summaries. Все2020–2025/16земель сохранены. Identity IPC entries — metadata_only для checksum/reserve, а не дополнительный скачиваемый набор. Нормализованные CSV/полные архивы/дубликаты/локальные настройки не выкладываются.
- Generation в URL:404fc8c681334561911392783520c8f2. Manifest с точным списком опубликованных файлов; каждый payload до копирования сверяется по размеру/SHA256. Неизвестные пути отвечают404.
- Netlify Edge Function только меняет streaming headers для .br; не распаковывает/не буферизует файл. Распаковку делает браузер. Content-Encoding нельзя надёжно задать обычным _headers: https://docs.netlify.com/manage/routing/headers/.
- Cache для immutable generation —1год/no-transform. HTML revalidate. Обе карты/benchmark используют один явно заданный dataBase.
- deployment/source.json позволяет сборку на компьютере без UAD_data: скачивает тот же опубликованный проверенный набор. Raw HTTPS сохраняет сжатые .br bytes. Первое размещение выполняется из локального экспорта; обновления данных требуют отдельного нового completed export/generation.

## Проверки перед публикацией

53 Node-теста прошли: прежние50 плюс safety/all-formats/hash checks deployment adapter. Targeted ESLint и отдельная production-сборка прошли. Прежнее предупреждение loaders.gl spawn сохраняется. Netlify CLI существующий вход Kirman442; TLS проверяется через системные доверенные сертификаты, не отключается.

Создан отдельный project1c970989-a6c6-4e65-b4d8-44c476014846, kirman442-uad-step08. Live URL: https://kirman442-uad-step08.netlify.app/. Статус на момент первого коммита: подготовлено к публикации; свежий результат деплоя/HTTP/браузера будет дописан после проверки. Не считать наличие пустого project готовым сайтом.

## Повторный запуск

После npm ci использовать npm run build:netlify. Из Netlify CLI27+ выполнить deploy --no-build --dir .netlify/publish --site1c970989-a6c6-4e65-b4d8-44c476014846 --prod только по разрешению пользователя. Для прототипов prebuild:netlify обязателен. Секреты не входят в Git; legacy Supabase entry при сборке на другом компьютере требует прежних публичных VITE-переменных, основная файловая оболочка от них не зависит.

Первый деплой выполняется CLI из этой ветки. Это ещё не автоматический GitHub-triggered deploy: отдельная настройка continuous deployment/GitHub integration не выдаётся за уже подключённую. Код/Netlify config/data source в ветке достаточны для повторяемой сборки; GitHub source push и Netlify publication проверяются отдельно.

Исходники публикационного дополнения сохраняются отдельно в08_step_Netlify_preview.zip после окончательной фиксации. ZIP08 App_shell_and_shared_cache не перезаписывается. В архиве исходников нет195больших payloads; они находятся в исходном UAD_data и на новом сайте.
