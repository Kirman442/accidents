import { useState, useEffect, useMemo } from 'react';
import { filterCoordinates } from '../utils/filterData.js';
import DeckGL from '@deck.gl/react';
import { Map } from '@vis.gl/react-maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';
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
    const { state, loadPartitions, cancelLoading } = usePartitionLoader();
    const { loading, errors, initialFeatures, loadingAttributes, fullFeatures } = state;

    const [showHex, setShowHex] = useState(true);
    const [elevation, setElevation] = useState(0);
    const [filters, setFilters] = useState({});


    useEffect(() => {
        const loadData = async () => {

            const partitions = Array.from({ length: 16 }, (_, i) => `unfallatlas_uland_${String(i + 1).padStart(2, '0')}`);
            await loadPartitions(partitions);
        };

        loadData();
        const timer = setTimeout(() => setElevation(50), 2500);
        return () => { clearTimeout(timer); cancelLoading(); };
    }, [loadPartitions, cancelLoading]);

    const dataToRender = state.attributesComplete ? fullFeatures : initialFeatures;
    const filteredData = useMemo(() => filterCoordinates(dataToRender, filters), [dataToRender, filters]);

    const layers = useMemo(() => {
        if (!state.geoComplete) return [new ScatterplotLayer({id:"loading-points",data:[],getPosition:d=>[d.longitude,d.latitude]})];
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
    }, [filteredData, showHex, elevation, state.geoComplete]); // filteredData already depends on filters

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

                {loadingAttributes && <div style={{position:'absolute',top:60,left:20,color:'white'}}>Attribute werden geladen…</div>}
                {errors.global && <div role="alert" style={{position:'absolute',top:20,left:20,background:'#222',color:'white',padding:12,zIndex:101}}>
                  Daten konnten nicht vollständig geladen werden: {errors.global.message}
                  <button onClick={() => loadPartitions(Array.from({length:16},(_,i)=>'unfallatlas_uland_'+String(i+1).padStart(2,'0')))}>Erneut laden</button>
                </div>}
                <LegendPanel
                    showHex={showHex}
                    setShowHex={setShowHex}
                    filters={filters}
                    setFilters={setFilters}
                    disabled={!state.attributesComplete}
                    dataStats={{
                        total: dataToRender.length,
                        filtered: filteredData.length
                    }}
                />
                <div className="rotate-shift">Hold down shift to rotate <br />Zum Drehen Umschalttaste gedrückt halten</div>

            </DeckGL>

        </div>
    );
};

export default SupaBaseUI;
