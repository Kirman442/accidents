import { useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Функция загрузки координат чанками
async function fetchGeoData(partitionName, batchSize = 20000) {
    let offset = 0;
    const featuresWithCoords = [];
    while (true) {
        const { data, error } = await supabase
            .from(partitionName)
            .select('oid, xgcswgs84, ygcswgs84')
            .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data.length) break;

        const parsedFeatures = data.map(item => ({
            type: 'Feature',
            properties: { oid: item.oid },
            geometry: { coordinates: [item.xgcswgs84, item.ygcswgs84], type: 'Point' },
            latitude: parseFloat(item.ygcswgs84),
            longitude: parseFloat(item.xgcswgs84),
        }));
        featuresWithCoords.push(...parsedFeatures);
        offset += batchSize;
    }
    return featuresWithCoords;
}

// Функция загрузки атрибутов чанками (аналогично fetchGeoData)
async function fetchAttributesByRange(partitionName, batchSize = 20000) {
    let offset = 0;
    const allAttributes = [];
    while (true) {
        const { data, error } = await supabase
            .from(partitionName)
            .select('oid, uland, uwochentag, ukategorie, ist_rad, ist_pkw, ist_fuss')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Ошибка при загрузке атрибутов (по диапазону):', error);
            throw error;
        }
        if (!data.length) break;

        allAttributes.push(...data);
        offset += batchSize;
    }
    // console.log(`WorkspaceAttributesByRange for ${partitionName}:`, allAttributes.length);
    return allAttributes; // Массив объектов { oid, uwochentag, ukategorie... }
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

    const loadPartitions = useCallback(async (partitions) => {
        setState(prev => ({ ...prev, loading: true, loadingAttributes: false, errors: {} }));
        startTimeRef.current = performance.now();
        let allInitialFeatures = [];
        let allFullFeatures = [];

        try {
            const initialFeaturesPromises = partitions.map(async (partition) => {
                return await fetchGeoData(partition);
            });

            const resultsInitialFeatures = await Promise.all(initialFeaturesPromises);
            allInitialFeatures = resultsInitialFeatures.flat();
            initialLoadEndTimeRef.current = performance.now();
            setState(prev => ({
                ...prev,
                loading: false,
                initialFeatures: allInitialFeatures,
                initialLoadTime: (initialLoadEndTimeRef.current - startTimeRef.current) / 1000,
            }));

            setState(prev => ({ ...prev, loadingAttributes: true }));
            fullLoadStartTimeRef.current = performance.now();

            const attributesPromises = partitions.map(async (partition) => {
                return await fetchAttributesByRange(partition);
            });

            const resultsAttributes = await Promise.all(attributesPromises);
            const allAttributes = resultsAttributes.flat();

            // карта поиска для атрибутов на основе oid
            const attributesMap = new Map(allAttributes.map(attr => [attr.oid, attr]));

            allFullFeatures = allInitialFeatures.map(feature => {
                const attribute = attributesMap.get(feature.properties.oid);
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        ...(attribute || {}),
                    },
                };
            });

            const fullLoadEndTime = performance.now();
            setState(prev => ({
                ...prev,
                loadingAttributes: false,
                fullFeatures: allFullFeatures,
                fullLoadTime: (fullLoadEndTime - fullLoadStartTimeRef.current) / 1000,
            }));

        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                loadingAttributes: false,
                errors: { global: error }
            }));
        }
    }, []);

    return { state, loadPartitions };
}