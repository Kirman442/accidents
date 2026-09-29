import { useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// // Функция загрузки координат чанками
// async function fetchGeoData(partitionName, batchSize = 20000) {
//     let offset = 0;
//     const featuresWithCoords = [];
//     while (true) {
//         const { data, error } = await supabase
//             .from(partitionName)
//             .select('oid, xgcswgs84, ygcswgs84')
//             .range(offset, offset + batchSize - 1);

//         if (error) throw error;
//         if (!data.length) break;

//         const parsedFeatures = data.map(item => ({
//             type: 'Feature',
//             properties: { oid: item.oid },
//             geometry: { coordinates: [item.xgcswgs84, item.ygcswgs84], type: 'Point' },
//             latitude: parseFloat(item.ygcswgs84),
//             longitude: parseFloat(item.xgcswgs84),
//         }));
//         featuresWithCoords.push(...parsedFeatures);
//         offset += batchSize;
//     }
//     return featuresWithCoords;
// }

// // Функция загрузки координат чанками  2я версия с фильтром по uland
// async function fetchGeoData(partitionName, batchSize = 20000) {
//     let offset = 0;
//     const featuresWithCoords = [];

//     // unfallatlas_uland_01 -> 1
//     // unfallatlas_uland_12 -> 12
//     const uland = parseInt(
//         partitionName.replace('unfallatlas_uland_', ''),
//         10
//     );

//     while (true) {
//         const { data, error } = await supabase
//             .from('unfallatlas_partitioned')
//             .select('oid, xgcswgs84, ygcswgs84')
//             .eq('uland', uland)
//             .order('oid', { ascending: true })
//             .range(offset, offset + batchSize - 1);

//         if (error) {
//             console.error(
//                 `Ошибка загрузки координат для ULand ${uland}:`,
//                 error
//             );
//             throw error;
//         }
//         console.log(
//             `ULand ${uland}: offset=${offset}, requested=${batchSize}, received=${data.length}`
//         );

//         if (!data.length) break;

//         const parsedFeatures = data.map(item => ({
//             type: 'Feature',
//             properties: {
//                 oid: item.oid
//             },
//             geometry: {
//                 coordinates: [
//                     item.xgcswgs84,
//                     item.ygcswgs84
//                 ],
//                 type: 'Point'
//             },
//             latitude: parseFloat(item.ygcswgs84),
//             longitude: parseFloat(item.xgcswgs84),
//         }));

//         featuresWithCoords.push(...parsedFeatures);

//         offset += batchSize;
//     }

//     return featuresWithCoords;
// }


// Функция загрузки координат чанками
async function fetchGeoData(partitionName, batchSize = 20000) {
    let offset = 0;
    let totalCount = null;
    const featuresWithCoords = [];
    const fetchStart = performance.now();
    const uland = parseInt(
        partitionName.replace('unfallatlas_uland_', ''),
        10
    );

    while (totalCount === null || offset < totalCount) {
        const query = supabase
            .from('unfallatlas_partitioned')
            .select(
                'oid, xgcswgs84, ygcswgs84',
                // Count нужен только при первом запросе
                offset === 0 ? { count: 'exact' } : undefined
            )
            .eq('uland', uland)
            .order('oid', { ascending: true })
            .range(offset, offset + batchSize - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error(
                `Ошибка загрузки координат для ULand ${uland}:`,
                error
            );
            throw error;
        }

        // Первый запрос сообщает точное количество строк земли
        if (totalCount === null) {
            totalCount = count ?? 0;

            console.log(
                `ULand ${uland}: всего ${totalCount} записей`
            );
        }

        if (!data.length) break;

        const parsedFeatures = data.map(item => ({
            type: 'Feature',
            properties: {
                oid: item.oid
            },
            geometry: {
                coordinates: [
                    item.xgcswgs84,
                    item.ygcswgs84
                ],
                type: 'Point'
            },
            latitude: parseFloat(item.ygcswgs84),
            longitude: parseFloat(item.xgcswgs84),
        }));

        featuresWithCoords.push(...parsedFeatures);

        // Сдвигаемся на реально полученное количество
        offset += data.length;

        console.log(
            `ULand ${uland}: загружено ${offset} из ${totalCount}`
        );
    }
    const fetchEnd = performance.now();

    console.log(
        `ULand ${String(uland).padStart(2, '0')}: ` +
        `${featuresWithCoords.length} записей, ` +
        `${((fetchEnd - fetchStart) / 1000).toFixed(2)} сек.`
    );
    return featuresWithCoords;
}

// // Функция загрузки атрибутов чанками (аналогично fetchGeoData)
// async function fetchAttributesByRange(partitionName, batchSize = 20000) {
//     let offset = 0;
//     const allAttributes = [];
//     while (true) {
//         const { data, error } = await supabase
//             .from(partitionName)
//             .select('oid, uland, uwochentag, ukategorie, ist_rad, ist_pkw, ist_fuss')
//             .range(offset, offset + batchSize - 1);

//         if (error) {
//             console.error('Ошибка при загрузке атрибутов (по диапазону):', error);
//             throw error;
//         }
//         if (!data.length) break;

//         allAttributes.push(...data);
//         offset += batchSize;
//     }
//     // console.log(`WorkspaceAttributesByRange for ${partitionName}:`, allAttributes.length);
//     return allAttributes; // Массив объектов { oid, uwochentag, ukategorie... }
// }

// // Функция загрузки атрибутов чанками 2я версия с фильтром по uland
// async function fetchAttributesByRange(partitionName, batchSize = 20000) {
//     let offset = 0;
//     const allAttributes = [];

//     // unfallatlas_uland_01 -> 1
//     // unfallatlas_uland_12 -> 12
//     const uland = parseInt(
//         partitionName.replace('unfallatlas_uland_', ''),
//         10
//     );

//     while (true) {
//         const { data, error } = await supabase
//             .from('unfallatlas_partitioned')
//             .select(
//                 'oid, uland, uwochentag, ukategorie, ist_rad, ist_pkw, ist_fuss'
//             )
//             .eq('uland', uland)
//             .order('oid', { ascending: true })
//             .range(offset, offset + batchSize - 1);

//         if (error) {
//             console.error(
//                 `Ошибка при загрузке атрибутов для ULand ${uland}:`,
//                 error
//             );
//             throw error;
//         }

//         if (!data.length) break;

//         allAttributes.push(...data);

//         offset += batchSize;
//     }

//     return allAttributes;
// }

async function fetchAttributesByRange(partitionName, batchSize = 20000) {
    let offset = 0;
    let totalCount = null;
    const allAttributes = [];

    const uland = parseInt(
        partitionName.replace('unfallatlas_uland_', ''),
        10
    );

    while (totalCount === null || offset < totalCount) {
        const query = supabase
            .from('unfallatlas_partitioned')
            .select(
                'oid, uland, uwochentag, ukategorie, ist_rad, ist_pkw, ist_fuss',
                offset === 0 ? { count: 'exact' } : undefined
            )
            .eq('uland', uland)
            .order('oid', { ascending: true })
            .range(offset, offset + batchSize - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error(
                `Ошибка загрузки атрибутов для ULand ${uland}:`,
                error
            );
            throw error;
        }

        if (totalCount === null) {
            totalCount = count ?? 0;

            console.log(
                `Attributes ULand ${uland}: всего ${totalCount} записей`
            );
        }

        if (!data.length) break;

        allAttributes.push(...data);

        offset += data.length;

        console.log(
            `Attributes ULand ${uland}: загружено ${offset} из ${totalCount}`
        );
    }

    return allAttributes;
}

export function usePartitionLoader() {
    const [state, setState] = useState({
        loading: false,
        loadingAttributes: false,
        errors: {},
        initialFeatures: [], // Фичи только с координатами
        fullFeatures: [],     // Фичи с полными данными (координаты + атрибуты)
        initialLoadTime: null, // Время загрузки координат
        fullLoadTime: null,    // Время загрузки всех данных
    });

    const startTimeRef = useRef(null);
    const initialLoadEndTimeRef = useRef(null);
    const fullLoadStartTimeRef = useRef(null);
    const attributesDelay = 3500;

    const loadPartitions = useCallback(async (partitions) => {

        // ---------------------------------------------------------
        // 1. Начальное состояние
        // ---------------------------------------------------------

        setState(prev => ({
            ...prev,

            loading: true,
            loadingAttributes: false,

            // ВАЖНО:
            // очищаем старые данные перед новой загрузкой
            initialFeatures: [],
            fullFeatures: [],

            errors: {}
        }));

        startTimeRef.current = performance.now();

        let allInitialFeatures = [];
        let allFullFeatures = [];

        // Только для логирования progressive loading
        let loadedGeoCount = 0;
        let completedPartitions = 0;

        try {

            // =====================================================
            // GEO
            // =====================================================

            console.log('🌍 GEO loading started');

            // Все 16 земель по-прежнему запускаются параллельно.
            //
            // Но теперь каждая земля после завершения fetchGeoData()
            // СРАЗУ добавляется в initialFeatures.
            //
            // Promise.all всё ещё нужен ниже, чтобы понять,
            // когда ВСЕ Geo полностью загружены.
            const initialFeaturesPromises = partitions.map(
                async (partition) => {

                    const features =
                        await fetchGeoData(partition);

                    // ---------------------------------------------
                    // Земля полностью загружена
                    // ---------------------------------------------

                    loadedGeoCount += features.length;
                    completedPartitions += 1;

                    const elapsed =
                        (
                            (
                                performance.now() -
                                startTimeRef.current
                            ) / 1000
                        ).toFixed(3);

                    // ---------------------------------------------
                    // Первая готовая земля
                    // ---------------------------------------------

                    if (completedPartitions === 1) {

                        console.log(
                            `🚀 FIRST GEO DATA after ${elapsed} сек.`
                        );

                    }

                    // ---------------------------------------------
                    // Лог прогресса
                    // ---------------------------------------------

                    console.log(
                        `🗺️ ${partition} готова: ` +
                        `${features.length} объектов | ` +
                        `всего ${loadedGeoCount} / 269048 | ` +
                        `${completedPartitions}/${partitions.length} земель | ` +
                        `${elapsed} сек.`
                    );

                    // ---------------------------------------------
                    // PROGRESSIVE RENDERING
                    //
                    // Сразу добавляем готовую землю в state.
                    // React / карта уже могут её отрисовать,
                    // не дожидаясь остальных 15 земель.
                    // ---------------------------------------------

                    setState(prev => ({
                        ...prev,

                        initialFeatures: [
                            ...(prev.initialFeatures || []),
                            ...features
                        ]

                    }));

                    // Promise всё равно возвращает features,
                    // чтобы Promise.all ниже собрал полный массив.
                    return features;
                }
            );


            // =====================================================
            // ЖДЁМ ЗАВЕРШЕНИЯ ВСЕХ GEO
            // =====================================================

            const resultsInitialFeatures =
                await Promise.all(initialFeaturesPromises);


            // Получаем окончательный массив в стабильном порядке
            // partitions, независимо от того, в каком порядке
            // земли завершали загрузку.
            allInitialFeatures =
                resultsInitialFeatures.flat();


            initialLoadEndTimeRef.current =
                performance.now();


            const geoTotalTime =
                (
                    (
                        initialLoadEndTimeRef.current -
                        startTimeRef.current
                    ) / 1000
                );


            console.log(
                `✅ ALL GEO completed: ` +
                `${allInitialFeatures.length} объектов | ` +
                `${geoTotalTime.toFixed(3)} сек.`
            );


            // -----------------------------------------------------
            // Финализируем GEO state
            //
            // До этого initialFeatures заполнялись постепенно.
            // Теперь заменяем их окончательным массивом.
            // -----------------------------------------------------

            setState(prev => ({
                ...prev,

                loading: false,

                initialFeatures: allInitialFeatures,

                initialLoadTime: geoTotalTime
            }));


            // =====================================================
            // ATTRIBUTES
            // =====================================================
            //
            // ВАЖНО:
            //
            // Сейчас НЕ используем delay 2000 / 3000 / 3500.
            //
            // Attributes начинаются только после завершения
            // всех Geo.
            //
            // Это специально, чтобы чисто измерить эффект
            // progressive rendering.
            // =====================================================

            setState(prev => ({
                ...prev,
                loadingAttributes: true
            }));


            fullLoadStartTimeRef.current =
                performance.now();


            console.log('📦 Attributes loading started');


            const attributesNetworkStart =
                performance.now();


            // Все 16 Attributes по-прежнему параллельно
            const attributesPromises = partitions.map(
                async (partition) => {

                    return await fetchAttributesByRange(
                        partition
                    );

                }
            );


            const resultsAttributes =
                await Promise.all(attributesPromises);


            const attributesNetworkEnd =
                performance.now();


            console.log(
                `Attributes network: ${(
                    (
                        attributesNetworkEnd -
                        attributesNetworkStart
                    ) / 1000
                ).toFixed(3)} сек.`
            );


            // =====================================================
            // ATTRIBUTES FLAT
            // =====================================================

            const attributesLoadedTime =
                performance.now();


            const allAttributes =
                resultsAttributes.flat();


            const flatEndTime =
                performance.now();


            // =====================================================
            // ATTRIBUTES MAP
            // =====================================================

            const attributesMap =
                new Map(
                    allAttributes.map(attr => [
                        attr.oid,
                        attr
                    ])
                );


            const mapEndTime =
                performance.now();


            // =====================================================
            // MERGE GEO + ATTRIBUTES
            // =====================================================

            allFullFeatures =
                allInitialFeatures.map(feature => {

                    const attribute =
                        attributesMap.get(
                            feature.properties.oid
                        );

                    return {
                        ...feature,

                        properties: {
                            ...feature.properties,
                            ...(attribute || {})
                        }
                    };

                });


            const mergeEndTime =
                performance.now();


            // =====================================================
            // PERFORMANCE LOGS
            // =====================================================

            console.log(
                `Attributes flat: ${(
                    flatEndTime -
                    attributesLoadedTime
                ).toFixed(1)} мс.`
            );


            console.log(
                `Attributes Map: ${(
                    mapEndTime -
                    flatEndTime
                ).toFixed(1)} мс.`
            );


            console.log(
                `Features merge: ${(
                    mergeEndTime -
                    mapEndTime
                ).toFixed(1)} мс.`
            );


            console.log(
                `JS processing total: ${(
                    mergeEndTime -
                    attributesLoadedTime
                ).toFixed(1)} мс.`
            );


            const fullLoadTime =
                (
                    mergeEndTime -
                    fullLoadStartTimeRef.current
                ) / 1000;


            const totalApplicationTime =
                (
                    mergeEndTime -
                    startTimeRef.current
                ) / 1000;


            console.log(
                `📦 Attributes + merge: ` +
                `${fullLoadTime.toFixed(3)} сек.`
            );


            console.log(
                `🏁 FULL completed after ` +
                `${totalApplicationTime.toFixed(3)} сек.`
            );


            // =====================================================
            // FINAL STATE
            // =====================================================

            setState(prev => ({
                ...prev,

                loadingAttributes: false,

                fullFeatures: allFullFeatures,

                fullLoadTime: fullLoadTime
            }));


        } catch (error) {

            console.error(
                'Ошибка загрузки данных:',
                error
            );


            setState(prev => ({
                ...prev,

                loading: false,
                loadingAttributes: false,

                errors: {
                    global: error
                }

            }));

        }

    }, []);

    return { state, loadPartitions };
}