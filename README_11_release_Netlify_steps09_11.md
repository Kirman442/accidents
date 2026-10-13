# Публикация шагов09–11 на Netlify

Дата2026-10-13. Разрешение пользователя: закоммитить, запушить все изменения и задеплоить на существующий Netlify. Release code: `6db7683`, ветка `codex/uad-netlify-step08`.

## Результат

Опубликованы накопленные изменения после8080a2b: нативный React-обзор (09), время/сезонность (10), тяжесть/условия (11), согласованные подписи и представления графиков, подготовительные макеты и документация. Аналитические экраны больше не используют iframe. Общий UI/UX остаётся следующим согласуемым этапом.

Сайт: https://kirman442-uad-step08.netlify.app/

Deploy: `6ace008c94632ca6679e2e2e`.
Immutable URL: https://6ace008c94632ca6679e2e2e--kirman442-uad-step08.netlify.app/
Site ID: `1c970989-a6c6-4e65-b4d8-44c476014846`.

## Проверки

64 Node-теста passed. `npm run build:netlify` прошёл, прежнее предупреждение loaders.gl о spawn осталось. Сборка использует отдельный .netlify/publish; локальный dist/preview5187 сохранён. 195payloads/70151851байт сверены по SHA256 при сборке. Generation данных прежняя404fc8c681334561911392783520c8f2. Новые небольшие time.json/severity.json включены как обычные аналитические assets, без подробных записей в Git.

Публикация выполнена кешированным Netlify CLI27 с --use-system-ca, deploy --no-build --prod на существующий siteID. TLS-проверка не отключалась. Git push8080a2b→6db7683 выполнен, запись результата релиза добавлена отдельным коммитом и также запушена.

После публикации208HTTP/hash проверок: app.html, сохранённый supabase.html, три analyticsJSON, подключённые JS/CSS, manifest и все195файлов данных. Все тела совпадают с локальной публикацией и checksums manifest; у всех .br Content-Encoding:br. Неизвестный data path даёт404. Отчёт UAD_data/netlify-step09-11-http.json, воспроизводимая проверка UAD_data/verify-netlify-step09-11.mjs.

Live browser: обзор Hamburg2025=7057/21/8.36%/54.9; время Hamburg2020–2025=41087/18.74/июнь24.74; тяжесть Hamburg/Pkw2025=4441/17/320/7.59%; точки/диалог сумерки+зимняя скользкость=1из3=33.33%. Единственный iframe в live DOM — служебный Netlify badge, аналитических frames нет. Передача контекста из тяжести на карту сохраняет Hamburg2025/Pkw. Снимок и результаты UAD_data/netlify-step09-11-desktop.jpg, netlify-step09-11-browser.json.

## Границы

Существующий GitHub Pages/Supabase сайт, БД и ветка master/main не менялись. Автоматический deploy по push не подключён: это отдельная CLI-публикация. Исходный HTML-мост сохранён для истории, но не используется React-приложением. Архив исходников релиза UAD_data/11_step_Netlify_release_steps09_11.zip, commit в STEP_SNAPSHOT.txt, SHA256 рядом. Подробные данные/auth/dependencies/build output в архив не входят.
