import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from '@vis.gl/react-maplibre';
import { HexagonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import { usePartitionLoader } from '../utils/dataUtilsUI.prod'; //fetchFilteredData,
import { lightingEffect, colorRange } from '../utils/SupabaseEffects.prod';
import LegendPanel from '../utils/LegendPanel.prod.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../../../css/tooltip.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
// const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const mapStyle = `${MAP_STYLE}`;
const INITIAL_VIEW_STATE = {
    longitude: 10.4,
    latitude: 51.1,
    zoom: 5.5,
    maxZoom: 16,
    minZoom: 6,
    pitch: 33,
    bearing: 0
};

const SupaBaseUI = () => {
    const { state, loadPartitions } = usePartitionLoader();
    const { loading, errors, initialFeatures, initialLoadTime, loadingAttributes, fullFeatures, fullLoadTime } = state;
    const [startTime, setStartTime] = useState(null);
    const [showHex, setShowHex] = useState(true);
    const [elevation, setElevation] = useState(0);
    const [filters, setFilters] = useState({});
    const [renderFullData, setRenderFullData] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setStartTime(performance.now());
            const partitions = Array.from({ length: 16 }, (_, i) => `unfallatlas_uland_${String(i + 1).padStart(2, '0')}`);
            await loadPartitions(partitions);
        };

        loadData();
        const timer = setTimeout(() => setElevation(50), 2500);
        return () => clearTimeout(timer);
    }, [loadPartitions]);

    useEffect(() => {
        if (fullFeatures && fullFeatures.length > 0) {
            setRenderFullData(true);
        }
    }, [fullFeatures]);

    const dataToRender = useMemo(() => {
        return renderFullData ? fullFeatures : initialFeatures;
    }, [renderFullData, fullFeatures, initialFeatures]);

    const filteredData = useMemo(() => {
        if (!filters.uland && !filters.uwochentag && !filters.ukategorie && !filters.ist_rad && !filters.ist_pkw && !filters.ist_fuss) {
            return dataToRender.map(f => ({ latitude: f.latitude, longitude: f.longitude }));
        }
        return dataToRender
            .filter(f => {
                const props = f.properties;
                const landMatch = !filters.uland || Number(props.uland) === Number(filters.uland);
                const dayMatch = !filters.uwochentag || Number(props.uwochentag) === Number(filters.uwochentag);
                const catMatch = !filters.ukategorie || Number(props.ukategorie) === Number(filters.ukategorie);
                const radMatch = !filters.ist_rad || Number(props.ist_rad) === Number(filters.ist_rad);
                const pkwMatch = !filters.ist_pkw || Number(props.ist_pkw) === Number(filters.ist_pkw);
                const fussMatch = !filters.ist_fuss || Number(props.ist_fuss) === Number(filters.ist_fuss);
                return landMatch && dayMatch && catMatch && radMatch && pkwMatch && fussMatch;
            })
            .map(f => ({ latitude: f.latitude, longitude: f.longitude }));
    }, [dataToRender, filters]);

    const layers = useMemo(() => {
        const commonProps = {
            data: filteredData,
            getPosition: d => [d.longitude, d.latitude],
            colorRange,
            updateTriggers: {
                getPosition: [filteredData ? filteredData.length : 0],
                // getColorValue might depend on filters or other attributes
                elevationScale: [elevation]
            }
        };

        return showHex ? [
            new HexagonLayer({
                id: 'hexagon-layer',
                ...commonProps,
                coverage: .8,
                gpuAggregation: true,
                radius: 1000,
                elevationRange: [1, 3000],
                elevationScale: elevation,
                extruded: true,
                pickable: true,
                upperPercentile: 100,
                material: { ambient: 0.64, diffuse: 0.6, shininess: 32, specularColor: [51, 51, 51] },
                transitions: { elevationScale: 3000 },
            })
        ] : [
            new HeatmapLayer({
                id: 'heatmap-layer',
                ...commonProps,
                radiusPixels: 35,
                intensity: 1.3,
                threshold: 0.15
            })
        ];
    }, [filteredData, showHex, elevation /*, filters */]); // filteredData already depends on filters

    function getTooltip(info) {
        // 1. Проверка наличия самого info и его структуры
        if (!info || typeof info !== 'object') {
            return null;
        }

        const hasValidCoords = (
            Array.isArray(info.coordinate) &&
            info.coordinate.length === 2 &&
            !isNaN(info.coordinate[0]) &&
            !isNaN(info.coordinate[1]) &&
            Math.abs(info.coordinate[0]) <= 180 &&
            Math.abs(info.coordinate[1]) <= 90
        );

        const hasValidPixel = (
            Array.isArray(info.pixel) &&
            info.pixel.length === 2 &&
            info.pixel[0] >= 0 &&
            info.pixel[1] >= 0
        );

        if (!hasValidCoords || !hasValidPixel) {
            return null;
        }

        const count = info.object?.points?.length || info.object?.count || 0;
        if (count <= 0) {
            return null;
        }

        const accidentText = count === 1 ? 'Unfall' : 'Unfälle';

        return {
            html: `<div className="tooltip-container">${count} ${accidentText}</div>`,
        };
    }

    return (
        <div style={{ display: 'flex', height: '70vh' }}>
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                getTooltip={getTooltip}
                effects={[lightingEffect]}
            >
                <Map reuseMaps mapStyle={mapStyle} />

                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        zIndex: 100
                    }}>
                        Data loading...
                    </div>
                )}

                <LegendPanel
                    showHex={showHex}
                    setShowHex={setShowHex}
                    filters={filters}
                    setFilters={setFilters}
                    dataStats={{
                        total: fullFeatures.length,
                        filtered: filteredData.length
                    }}
                />
                <div className="rotate-shift">Hold down shift to rotate <br />Zum Drehen Umschalttaste gedrückt halten</div>

            </DeckGL>
            {/* <div style={{ position: 'absolute', top: 20, left: 20, backgroundColor: 'white', padding: 10, borderRadius: 5, zIndex: 1 }}>
                <h1>Тестирование загрузки данных</h1>
                {loading && <p>Загрузка геоданных...</p>}
                {!loading && initialFeatures.length > 0 && (
                    <p>Геоданные (координаты) загружены за: {initialLoadTime !== null ? initialLoadTime.toFixed(2) : '...'} секунд. Количество: {initialFeatures.length}</p>
                )}
                {loadingAttributes && <p>Загрузка атрибутов...</p>}
                {!loadingAttributes && fullFeatures && fullFeatures.length > 0 && (
                    <p>Атрибуты загружены и объединены за: {fullLoadTime !== null ? fullLoadTime.toFixed(2) : '...'} секунд. Количество: {fullFeatures.length}</p>
                )}
                {errors.global && <p style={{ color: 'red' }}>Ошибка: {errors.global.message}</p>}
            </div> */}
        </div>
    );
};

export default SupaBaseUI;

// // Вариант с использованием ParquetLoader
// import { ParquetLoader } from '@loaders.gl/parquet';
// import { load } from '@loaders.gl/core';
// const SupaBaseUI = () => {
//     const [loading, setLoading] = useState(false);
//     const [parquetData, setParquetData] = useState([]);
//     const [loadTime, setLoadTime] = useState("");
//     const [isMapReady, setIsMapReady] = useState(false);
//     const [elevation, setElevation] = useState(1); // Начинаем с 1
//     const [showHex, setShowHex] = useState(true);
//     const [filters, setFilters] = useState({
//         uland: null,
//         uwochentag: null,
//         ukategorie: null,
//         ist_rad: null,
//         ist_pkw: null,
//         ist_fuss: null
//     });
//     const INITIAL_VIEW_STATE = {
//         longitude: 10.4,
//         latitude: 51.1,
//         zoom: 5.5,
//         maxZoom: 16,
//         minZoom: 6,
//         pitch: 33,
//         bearing: 0
//     };
//     const testFiles = [
//         {
//             name: 'Данные с brotli',
//             url: 'https://cdn.jsdelivr.net/gh/Kirman442/deckgl@main/geoarrow/accidents_brotli.parquet'
//         },
//         {
//             name: 'Данные с brotli ', //OID_;ULAND;UWOCHENTAG;UKATEGORIE;IstRad;IstPKW;IstFuss;XGCSWGS84;YGCSWGS84
//             url: 'https://cdn.jsdelivr.net/gh/Kirman442/deckgl@main/geoarrow/accidents_de_brotli.parquet'
//         }
//     ];

//     const [selectedFile, setSelectedFile] = useState(testFiles[1]);

//     const loadParquet = async () => {
//         setLoading(true);
//         try {
//             const startTime = performance.now();

//             const rawData = await load(
//                 selectedFile.url,
//                 ParquetLoader,
//                 {
//                     parquet: {
//                         type: 'array-row-table',
//                         preserveBinary: true
//                     }
//                 }
//             );


//             // Преобразование данных в нужный формат
//             const formattedData = rawData.data.map(item => ({
//                 latitude: parseFloat(item.YGCSWGS84),
//                 longitude: parseFloat(item.XGCSWGS84),
//                 properties: {
//                     ist_fuss: item.IstFuss,
//                     ist_pkw: item.IstPKW,
//                     ist_rad: item.IstRad,
//                     oid: item.OID_,
//                     ukategorie: item.UKATEGORIE,
//                     uwochentag: item.UWOCHENTAG,
//                     uland: item.ULAND,
//                 }
//             }));

//             const calculateMemoryUsage = (data) => {
//                 const jsonString = JSON.stringify(data);
//                 const sizeInBytes = new Blob([jsonString]).size;
//                 return (sizeInBytes / (1024 * 1024)).toFixed(2) + " МБ";
//             };

//             setParquetData(formattedData);
//             // console.log('Formatted Features:', formattedData.length); // Логируем все данные
//             // console.log("Размер в памяти:", calculateMemoryUsage(formattedData));

//             const endTime = performance.now();
//             setLoadTime(`${(endTime - startTime).toFixed(2)} мс`);

//             // console.log(`Parquet loaded in ${(endTime - startTime).toFixed(2)}ms`);
//             return formattedData;
//         } catch (error) {
//             console.error('Error loading parquet file:', error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     // 2.  применяем фильтры
//     const filteredData = useMemo(() => {
//         if (!parquetData || parquetData.length === 0) return [];

//         if (!filters.uland && !filters.uwochentag && !filters.ukategorie && !filters.ist_rad &&
//             !filters.ist_pkw && !filters.ist_fuss) {
//             return parquetData.map(f => ({ latitude: f.latitude, longitude: f.longitude }));
//         }

//         return parquetData
//             .filter(f => {
//                 const props = f.properties;
//                 const landMatch = !filters.uland || Number(props.uland) === Number(filters.uland);
//                 const dayMatch = !filters.uwochentag || Number(props.uwochentag) === Number(filters.uwochentag);
//                 const catMatch = !filters.ukategorie || Number(props.ukategorie) === Number(filters.ukategorie);
//                 const radMatch = !filters.ist_rad || Number(props.ist_rad) === Number(filters.ist_rad);
//                 const pkwMatch = !filters.ist_pkw || Number(props.ist_pkw) === Number(filters.ist_pkw);
//                 const fussMatch = !filters.ist_fuss || Number(props.ist_fuss) === Number(filters.ist_fuss);
//                 return landMatch && dayMatch && catMatch && radMatch && pkwMatch && fussMatch;
//             })
//             .map(f => ({ latitude: f.latitude, longitude: f.longitude }));
//     }, [parquetData, filters]);
//     // Инициализация карты
//     useEffect(() => {
//         setIsMapReady(true);

//         if (selectedFile) loadParquet();

//         const timer = setTimeout(() => setElevation(50), 4000);
//         return () => clearTimeout(timer);
//     }, [selectedFile]);


//     const layers = useMemo(() => {
//         const commonProps = {
//             data: filteredData,
//             getPosition: d => [d.longitude, d.latitude],
//             colorRange,
//             updateTriggers: {
//                 getPosition: [filteredData.length],
//                 getColorValue: [filters],
//                 elevationScale: [elevation]
//             }
//         };
//         // Определчем слои и их переключение
//         return showHex
//             ? [new HexagonLayer({
//                 id: 'hexagon-layer',
//                 ...commonProps,
//                 coverage: .8,
//                 gpuAggregation: true,
//                 radius: 1000,
//                 elevationRange: [0, 3000],
//                 elevationScale: elevation,
//                 extruded: true,
//                 pickable: true,
//                 upperPercentile: 100,
//                 material: {
//                     ambient: 0.64,
//                     diffuse: 0.6,
//                     shininess: 32,
//                     specularColor: [51, 51, 51]
//                 },
//                 transitions: {
//                     elevationScale: 3000
//                 },
//             })]
//             : [new HeatmapLayer({
//                 id: 'heatmap-layer',
//                 ...commonProps,
//                 radiusPixels: 50,
//                 intensity: 1,
//                 threshold: 0.15
//             })];
//     }, [filteredData, showHex, elevation, filters]);

//     function getTooltip(info) {
//         // 1. Проверка наличия самого info и его структуры
//         if (!info || typeof info !== 'object') {
//             return null;
//         }

//         const hasValidCoords = (
//             Array.isArray(info.coordinate) &&
//             info.coordinate.length === 2 &&
//             !isNaN(info.coordinate[0]) &&
//             !isNaN(info.coordinate[1]) &&
//             Math.abs(info.coordinate[0]) <= 180 &&
//             Math.abs(info.coordinate[1]) <= 90
//         );

//         const hasValidPixel = (
//             Array.isArray(info.pixel) &&
//             info.pixel.length === 2 &&
//             info.pixel[0] >= 0 &&
//             info.pixel[1] >= 0
//         );

//         if (!hasValidCoords || !hasValidPixel) {
//             return null;
//         }

//         const count = info.object?.points?.length || info.object?.count || 0;
//         if (count <= 0) {
//             return null;
//         }

//         const accidentText = count === 1 ? 'Unfall' : 'Unfälle';

//         return {
//             html: `<div className="tooltip-container">${count} ${accidentText}</div>`,
//         };
//     }

//     return (
//         <div style={{ display: 'flex', height: '70vh' }}>
//             {isMapReady && (
//                 <DeckGL
//                     initialViewState={INITIAL_VIEW_STATE}
//                     controller={true}
//                     layers={layers}
//                     effects={[lightingEffect]}
//                 // getTooltip={getTooltip}
//                 >
//                     <Map reuseMaps mapStyle={mapStyle} />

//                     {loading && (
//                         <div style={{
//                             position: 'absolute',
//                             top: '20px',
//                             left: '50%',
//                             transform: 'translateX(-50%)',
//                             background: 'rgba(0,0,0,0.7)',
//                             color: 'white',
//                             padding: '10px',
//                             borderRadius: '5px',
//                             zIndex: 100
//                         }}>
//                             Загрузка данных...
//                         </div>
//                     )}

//                     <LegendPanel
//                         showHex={showHex}
//                         setShowHex={setShowHex}
//                         filters={filters}
//                         setFilters={setFilters}
//                         dataStats={{
//                             total: parquetData.length,
//                             filtered: filteredData.length
//                         }}
//                     />
//                     <div className="rotate-shift">Hold down shift to rotate <br />Zum Drehen Umschalttaste gedrückt halten</div>
//                 </DeckGL>
//             )}
//         </div>
//     );
// };


// export default SupaBaseUI;