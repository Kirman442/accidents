import React, { useState, useRef } from 'react';
import '../../../css/LegendPanel.css';
import DarkSelect from './darkSelect.prod';
import { selectLandOptions, selectDayOptions, selectCategoryOptions, Legend, LAYER_DESCRIPTIONS } from './legendSelectOptions.prod.jsx';

const LegendPanel = ({ showHex, setShowHex, filters, setFilters, dataStats }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [isDatasetExpanded, setIsDatasetExpanded] = useState(false);
    const [resetAnimating, setResetAnimating] = useState(false);
    const toggleRef = useRef(null);
    const knobRef = useRef(null);
    const currentDescription = showHex ? LAYER_DESCRIPTIONS.hexagon : LAYER_DESCRIPTIONS.heatmap;
    const SwitchButton = () => (
        <button className="legend-button" onClick={() => setShowHex(!showHex)}>
            {showHex ? 'Switch to Heatmap' : 'Switch to Hexagon'}
        </button>
    );
    // Функция для переключения панелей с автоматическим закрытием другой
    const toggleInfoPanel = () => {
        setIsInfoExpanded(!isInfoExpanded);
        if (!isInfoExpanded) {
            setIsFiltersExpanded(false);
            setIsDatasetExpanded(false);
        }
    };

    const toggleFiltersPanel = () => {
        setIsFiltersExpanded(!isFiltersExpanded);
        if (!isFiltersExpanded) {
            setIsInfoExpanded(false);
            setIsDatasetExpanded(false);
        }
    };

    const toggleDatasetPanel = () => {
        setIsDatasetExpanded(!isDatasetExpanded);
        if (!isDatasetExpanded) {
            setIsInfoExpanded(false);
            setIsFiltersExpanded(false);
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';

        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    };

    const handleReset = () => {
        if (!toggleRef.current || !knobRef.current) return;

        // 1. Рассчитываем расстояние для анимации
        const containerWidth = toggleRef.current.offsetWidth;
        const knobWidth = knobRef.current.offsetWidth;
        const travelDistance = containerWidth - knobWidth - 8; // 8px - отступы

        // 2. Задаем CSS-переменную
        toggleRef.current.style.setProperty('--travel-distance', `${travelDistance}px`);

        setResetAnimating(true);

        setFilters({
            uland: null,
            uwochentag: null,
            ukategorie: null,
            ist_rad: null,
            ist_pkw: null,
            ist_fuss: null
        });

        setTimeout(() => setResetAnimating(false), 1200);
    };

    return (
        <div className="panel-container">
            {/* Информационный блок */}
            <div className="panel-block">
                <div className="panel-header" onClick={toggleInfoPanel}>
                    <div className="panel-title">Deutschland Verkehrsunfälle</div>
                    <div className="panel-expander">
                        {isInfoExpanded ? '×' : 'i'}
                    </div>
                </div>

                {isInfoExpanded && (
                    <div className="panel-content">
                        <div className="description-block">
                            <h2 className="dataset-title">{currentDescription.title}</h2>
                            <p className='dataset'>{currentDescription.small_desc}</p>

                            <Legend />

                            <h4 className='dataset'>Methodologie</h4>
                            <ul className='dataset'>
                                {currentDescription.methodology.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>


                        </div>
                        <SwitchButton />
                    </div>
                )}
            </div>

            {/* Блок фильтров */}
            <div className="panel-block filters-block">
                <div className="panel-header" onClick={toggleFiltersPanel}>
                    <div className="panel-title">Filter</div>
                    <div className="panel-expander">
                        {isFiltersExpanded ? '×' : '⚙️'}
                    </div>
                </div>

                {isFiltersExpanded && (
                    <div className="panel-content">
                        <Legend />
                        <h2 className='data-stats-accidents'>Unfälle</h2>
                        <div className="stats-grid">

                            <div className="stat-item">
                                <div className="stat-label">Gesamt </div>
                                <div className="stat-value">{formatNumber(dataStats.total)}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Gefiltert</div>
                                <div className="stat-value">{formatNumber(dataStats.filtered)}</div>
                            </div>
                            {/* <div className="stat-item">
                                <div className="stat-label">Filtered of total shown</div>
                                <div className="stat-value">{Math.round((dataStats.filtered / dataStats.total) * 100)}%</div>
                            </div> */}
                        </div>
                        <div className="description-block">

                            <div className="filter-group">
                                <label>Land:</label>
                                <DarkSelect
                                    options={selectLandOptions}
                                    value={filters.uland ? selectLandOptions.find(opt => opt.value === filters.uland) : null}
                                    onChange={(selected) =>
                                        setFilters(prev => ({
                                            ...prev,
                                            uland: selected ? selected.value : null
                                        }))
                                    }
                                    placeholder="Alle Länder"
                                />
                            </div>


                            <div className="filter-group">
                                <label>Wochentag:</label>
                                <DarkSelect
                                    options={selectDayOptions}
                                    value={filters.uwochentag ? selectDayOptions.find(opt => opt.value === filters.uwochentag) : null}
                                    onChange={(selected) =>
                                        setFilters(prev => ({
                                            ...prev,
                                            uwochentag: selected ? selected.value : null
                                        }))
                                    }
                                    placeholder="Alle Wochentagen"
                                />
                            </div>

                            <div className="filter-group">
                                <label>Unfallkategorien:</label>
                                <DarkSelect
                                    options={selectCategoryOptions}
                                    value={filters.ukategorie ? selectCategoryOptions.find(opt => opt.value === filters.ukategorie) : null}
                                    onChange={(selected) =>
                                        setFilters(prev => ({
                                            ...prev,
                                            ukategorie: selected ? selected.value : null
                                        }))
                                    }
                                    placeholder="Alle Unfallkategorien"
                                />
                            </div>

                            <div className="filter-group">
                                <label>Unfall mit Rad:</label>
                                <div
                                    className={`toggle-switch ${filters.ist_rad === 1 ? 'active' : ''}`}
                                    onClick={() => setFilters({
                                        ...filters,
                                        ist_rad: filters.ist_rad === 1 ? 0 : 1
                                    })}
                                >
                                    <div className="toggle-knob" />
                                    <span className="toggle-label">
                                        {filters.ist_rad === 1 ? 'mit Fahrradbeteiligung' : 'ohne Fahrradbeteiligung'}
                                    </span>
                                </div>
                            </div>
                            <div className="filter-group">
                                <label>Unfall mit Pkw:</label>
                                <div
                                    className={`toggle-switch ${filters.ist_pkw === 1 ? 'active' : ''}`}
                                    onClick={() => setFilters({
                                        ...filters,
                                        ist_pkw: filters.ist_pkw === 1 ? 0 : 1
                                    })}
                                >
                                    <div className="toggle-knob" />
                                    <span className="toggle-label">
                                        {filters.ist_pkw === 1 ? 'mit PKW-Beteiligung' : 'ohne PKW-Beteiligung'}
                                    </span>
                                </div>
                            </div>
                            <div className="filter-group">
                                <label>Unfall mit Fußgänger:</label>
                                <div
                                    className={`toggle-switch ${filters.ist_fuss === 1 ? 'active' : ''}`}
                                    onClick={() => setFilters({
                                        ...filters,
                                        ist_fuss: filters.ist_fuss === 1 ? 0 : 1
                                    })}
                                >
                                    <div className="toggle-knob" />
                                    <span className="toggle-label">
                                        {filters.ist_fuss === 1 ? 'mit Fußgängerbeteiligung' : 'ohne Fußgängerbeteiligung'}
                                    </span>
                                </div>
                            </div>
                            <div
                                className="reset-toggle-container"
                                ref={toggleRef}
                                style={{ '--travel-distance': '0px' }} // Инициализация переменной
                            >
                                <div
                                    className={`reset-toggle ${resetAnimating ? 'animating' : ''}`}
                                    onClick={handleReset}
                                >
                                    <div className="reset-toggle-track">
                                        <div className="reset-toggle-knob" ref={knobRef} />
                                        <span className="reset-toggle-label">Filter zurücksetzen</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* <div className="data-stats">
                            Showing: {dataStats.filtered} of {dataStats.total} accidents ({Math.round((dataStats.filtered / dataStats.total) * 100)}%)
                        </div> */}

                        <SwitchButton />

                    </div>
                )}
            </div>
            {/* Dataset блок */}
            <div className="panel-block">
                <div className="panel-header" onClick={toggleDatasetPanel}>
                    <div className="panel-title">Infos zum Datensatz</div>
                    <div className="panel-expander">
                        {isDatasetExpanded ? '×' : 'i'}
                    </div>
                </div>

                {isDatasetExpanded && (
                    <div className="panel-content">
                        <div className="description-block">
                            <h4>Über den Datensatz</h4>
                            <p className="dataset">
                                In der Straßenverkehrsunfallstatistik werden alle polizeilich erfassten Unfälle mit Personen- oder Sachschäden auf öffentlichen Straßen und Plätzen erfasst. <br /><br />Der Datensatz enthält Daten über Unfallopfer nach Alter, Fahrzeugtyp (z. B. Auto-, Motorrad- oder Busunfälle) und Unfallursachen. Fahrerbedingte Gründe wie Alkoholfahrten oder Raserei weisen wir ebenso nach wie Verkehrsunfälle durch Eisglätte, Nebel oder Wildunfälle. <br /><br /> Neben den Straßenverkehrsunfällen veröffentlichen wir auch Daten zu Unfällen mit Fußgängern, Radfahrern und neuerdings auch zu Unfällen mit Elektrorollern.<br /><br />

                                Es wurden nicht alle Felder für die Filterung angewandt, es fehlen Vorfälle mit Kraftrad, Güterkraftfahrzeug, Sonstigen sowie gibt es keine Filterung nach den folgenden Werten: Straßenzustand, Lichtverhältnisse, Unfalltyp und Unfallart.</p>

                            <p>Datenquelle: <a href="https://www.destatis.de/DE/Home/_inhalt.html" target="_blank" rel="noopener noreferrer">Destatis</a></p>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LegendPanel;