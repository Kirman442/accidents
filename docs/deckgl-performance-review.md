# deck.gl: разбор производительности эксперимента

14.10.2026. По просьбе пользователя прочитаны WebGLAggregator, Aggregator Interface и Performance Optimization. Сверено с исходниками установленных @deck.gl/*9.1.8. Изменений кода по этому разбору пока нет.

Источники: [performance](https://deck.gl/docs/developer-guide/performance), [Aggregator](https://deck.gl/docs/api-reference/aggregation-layers/aggregator), [WebGLAggregator](https://deck.gl/docs/api-reference/aggregation-layers/webgl-aggregator), дополнительно [HexagonLayer](https://deck.gl/docs/api-reference/aggregation-layers/hexagon-layer), [H3HexagonLayer](https://deck.gl/docs/api-reference/geo-layers/h3-hexagon-layer).

## Наблюдения нашего кода

Эксперимент пока использует H3 JavaScript/WASM в worker и PolygonLayer. Нативный GPU HexagonLayer вообще не сравнивался. Поэтому время H3-индекса не доказывает медленную работу GPU-агрегации deck.gl или непригодность hexagon.

В hex-worker при каждом вычислении окна создаются новые cells, polygon, center; даже попадание в кеш индекса не сохраняет объект data для renderer. Worker делает structured clone списка объектов, не transferable вывод. PolygonLayer на основном потоке вызывает getPolygon с map и получает новые вложенные массивы для зазора. Обновление геометрии окна вновь меняет data. Тесселяция/генерация буферов и GPU-upload отдельно не измерены; 1.3с индекса — лишь один этап.

В layers useMemo общий binary descriptor создаётся заново при зависимостях selection, hex, theme, opacity, gap, хотя positions могут быть теми же. Дескриптор надо мемоизировать отдельно по snapshot; создание нового экземпляра Layer с тем же id само по себе допустимо. Сейчас hex/points/heat условно удаляются из массива, поэтому переключение режима теряет внутренние ресурсы удалённого слоя. Проверить visible с учётом дополнительной GPU-памяти, не держать автоматически любые тяжёлые ресурсы навсегда.

ready=false возвращает пустой массив всех layers. Для filter/load/error это отдельная причина исчезновения, хотя последняя правка устранила очистку hex при zoom. Границы/picking надо отделить от жизненного цикла загрузки статистики.

Индекс кешируется только для текущего сжатого snapshot после фильтра. При новом фильтре пересоздаётся worker и заново считаются point→H3. Дальнейший кандидат: фиксированные позиции исходного года и кеш point→cell на разрешение, а при фильтре суммировать по маске. Учитывать реальную память индексов и LRU; не обещать сохранение точного крупного географического биннинга через простое объединение parent-id без проверки пограничных точек.

DPR/useDevicePixels, hover picking, overdraw и долгие задачи main thread сейчас не измерены. Отдельный эксперимент DPR1 сравнить по качеству и FPS. Подложка/network тоже должны быть отделены от времени deck renderer.

## Пути сравнения

1. Нативный HexagonLayer с gpuAggregation=true, COUNT или SUM веса1, без CPU-only getColorValue/getElevationValue/hexagonAggregator. В установленной9.1.8 эти функции приводят к CPU fallback. Показать реально выбранный GPU/CPU путь; проверить device support. Это регулярная hex-сетка, не H3, определения ячеек различаются.
2. H3-индекс + H3HexagonLayer/instancing: готовые id/count вместо ручных polygon. У H3-layer есть компромисс точности геометрии и instancing; coarse res0–5 при auto обычно требуют high precision. Не выставлять false молча для аналитических границ.
3. H3 + заранее подготовленные бинарные геометрические атрибуты в worker. Для Polygon/SolidPolygon нужны корректные индексы/структура переменных полигонов, нельзя просто копировать пример Scatterplot attributes. Стабильные чанки/окна/идентификаторы и точечные updateTriggers важнее дополнительных useMemo поверх постоянно новых массивов.

WebGLAggregator выполняет GPU-биннинг/редукцию и отдаёт бинарные результаты. У GPU getBin нет автоматического списка pointIndices; в9.1.8 чтение выбранного bin использует readPixels. Для карточки ячейки нужен отдельный путь к исходным handle; не вычитывать GPU-bin каждое движение hover и не обещать прямую замену latLngToCell простым включением gpuAggregation.

## Следующая проверка

Сначала стабильность data и видимости; затем A/B нативный GPU HexagonLayer против H3-renderer на одинаковых точках и фильтрах. Измерить первый расчёт, повторный фильтр, pan без смены разрешения, zoom через пороги, переключение режимов; отдельно worker, сериализация, main-thread/attributes, GPU/frame и память. Проверить count, выбранную ячейку и CPU fallback. Дебаунс сохраняет управляемость, но не заменяет устранение лишних обновлений. Не считать прочитанные рекомендации уже применёнными.
