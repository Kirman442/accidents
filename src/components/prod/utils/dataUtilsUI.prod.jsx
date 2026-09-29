import { useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchGeoData(partitionName, batchSize = 20000) {
    let offset = 0;
    let totalCount = null;

    const featuresWithCoords = [];

    const uland = parseInt(
        partitionName.replace('unfallatlas_uland_', ''),
        10
    );

    while (totalCount === null || offset < totalCount) {
        const { data, error, count } = await supabase
            .from('unfallatlas_partitioned')
            .select(
                'oid, xgcswgs84, ygcswgs84',
                offset === 0 ? { count: 'exact' } : undefined
            )
            .eq('uland', uland)
            .order('oid', { ascending: true })
            .range(offset, offset + batchSize - 1);

        if (error) {
            throw error;
        }

        if (totalCount === null) {
            totalCount = count ?? 0;
        }

        if (!data.length) {
            break;
        }

        const parsedFeatures = data.map(item => ({
            type: 'Feature',

            properties: {
                oid: item.oid
            },

            geometry: {
                type: 'Point',
                coordinates: [
                    item.xgcswgs84,
                    item.ygcswgs84
                ]
            },

            latitude: parseFloat(item.ygcswgs84),
            longitude: parseFloat(item.xgcswgs84)
        }));

        featuresWithCoords.push(...parsedFeatures);

        offset += data.length;
    }

    return featuresWithCoords;
}

async function fetchAttributesByRange(
    partitionName,
    batchSize = 20000
) {
    let offset = 0;
    let totalCount = null;

    const allAttributes = [];

    const uland = parseInt(
        partitionName.replace('unfallatlas_uland_', ''),
        10
    );

    while (totalCount === null || offset < totalCount) {
        const { data, error, count } = await supabase
            .from('unfallatlas_partitioned')
            .select(
                'oid, uland, uwochentag, ukategorie, ist_rad, ist_pkw, ist_fuss',
                offset === 0 ? { count: 'exact' } : undefined
            )
            .eq('uland', uland)
            .order('oid', { ascending: true })
            .range(offset, offset + batchSize - 1);

        if (error) {
            throw error;
        }

        if (totalCount === null) {
            totalCount = count ?? 0;
        }

        if (!data.length) {
            break;
        }

        allAttributes.push(...data);

        offset += data.length;
    }

    return allAttributes;
}

export function usePartitionLoader() {
    const [state, setState] = useState({
        loading: false,
        loadingAttributes: false,
        errors: {},
        initialFeatures: [],
        fullFeatures: [],
        initialLoadTime: null,
        fullLoadTime: null
    });

    const startTimeRef = useRef(null);

    const loadPartitions = useCallback(async partitions => {
        setState(prev => ({
            ...prev,
            loading: true,
            loadingAttributes: false,
            initialFeatures: [],
            fullFeatures: [],
            initialLoadTime: null,
            fullLoadTime: null,
            errors: {}
        }));

        startTimeRef.current = performance.now();

        try {
            const initialFeaturesPromises = partitions.map(
                async partition => {
                    const features = await fetchGeoData(partition);

                    setState(prev => ({
                        ...prev,

                        initialFeatures: [
                            ...prev.initialFeatures,
                            ...features
                        ]
                    }));

                    return features;
                }
            );

            const resultsInitialFeatures = await Promise.all(
                initialFeaturesPromises
            );

            const allInitialFeatures =
                resultsInitialFeatures.flat();

            const initialLoadEndTime = performance.now();

            const initialLoadTime =
                (initialLoadEndTime - startTimeRef.current) / 1000;

            setState(prev => ({
                ...prev,
                loading: false,
                initialFeatures: allInitialFeatures,
                initialLoadTime
            }));

            setState(prev => ({
                ...prev,
                loadingAttributes: true
            }));

            const fullLoadStartTime = performance.now();

            const attributesPromises = partitions.map(
                partition =>
                    fetchAttributesByRange(partition)
            );

            const resultsAttributes = await Promise.all(
                attributesPromises
            );

            const allAttributes = resultsAttributes.flat();

            const attributesMap = new Map(
                allAttributes.map(attribute => [
                    attribute.oid,
                    attribute
                ])
            );

            const allFullFeatures = allInitialFeatures.map(
                feature => {
                    const attribute = attributesMap.get(
                        feature.properties.oid
                    );

                    return {
                        ...feature,

                        properties: {
                            ...feature.properties,
                            ...(attribute || {})
                        }
                    };
                }
            );

            const fullLoadTime =
                (performance.now() - fullLoadStartTime) / 1000;

            setState(prev => ({
                ...prev,
                loadingAttributes: false,
                fullFeatures: allFullFeatures,
                fullLoadTime
            }));
        } catch (error) {
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

    return {
        state,
        loadPartitions
    };
}