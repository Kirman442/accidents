const dayOptions = [
    { label: 'Alle Wochentage', value: 0 },
    { label: 'Sonntag', value: 1 },
    { label: 'Montag', value: 2 },
    { label: 'Dienstag', value: 3 },
    { label: 'Mittwoch', value: 4 },
    { label: 'Donnerstag', value: 5 },
    { label: 'Freitag', value: 6 },
    { label: 'Samstag', value: 7 }
];

const landOptions = [
    { label: 'Alle Länder', value: 0 },
    { label: 'Schleswig-Holstein', value: 1 },
    { label: 'Hamburg', value: 2 },
    { label: 'Niedersachsen', value: 3 },
    { label: 'Bremen', value: 4 },
    { label: 'Nordrhein-Westfalen', value: 5 },
    { label: 'Hessen', value: 6 },
    { label: 'Rheinland-Pfalz', value: 7 },
    { label: 'Baden-Württemberg', value: 8 },
    { label: 'Bayern', value: 9 },
    { label: 'Saarland', value: 10 },
    { label: 'Berlin', value: 11 },
    { label: 'Brandenburg', value: 12 },
    { label: 'Mecklenburg-Vorpommern', value: 13 },
    { label: 'Sachsen', value: 14 },
    { label: 'Sachsen-Anhalt', value: 15 },
    { label: 'Thüringen', value: 16 }
];

const categoryOptions = [
    { label: 'Alle Unfallkategorien', value: 0 },
    { label: 'mit Getöteten', value: 1 },
    { label: 'mit Schwerverletzten', value: 2 },
    { label: 'mit Leichtverletzten', value: 3 }
];

export const selectLandOptions = landOptions.map(land => ({
    value: land.value,
    label: land.label
}));

export const selectDayOptions = dayOptions.map(day => ({
    value: day.value,
    label: day.label
}));

export const selectCategoryOptions = categoryOptions.map(category => ({
    value: category.value,
    label: category.label
}));

export const Legend = () => (
    <>
        <div className="legend-gradient">
            {['#0198bd', '#49e3ce', '#d8feb5', '#feedb1', '#fead54', '#d1374e'].map((color) => (
                <div
                    key={color}
                    className="legend-step"
                    style={{ backgroundColor: color, width: '16.666%' }}
                />
            ))}
        </div>
        <p className="legend-labels">
            <span className="label-left">Weniger Unfälle</span>
            <span className="label-right">Mehr Unfälle</span>
        </p>
    </>
);


export const LAYER_DESCRIPTIONS = {
    hexagon: {
        title: "Hexagon Layer",
        description: "The layer aggregates accident density within each hexagon cell (1km radius). Provides spatial overview of high-risk zones.",
        small_desc: "Die Ebene zeigt die Unfalldichte innerhalb jeder hexagon",
        methodology: [
            "Hexagon radius: 1km",
            "Color scale: Quantile (6 classes)",
            "Upper percentile: 100",
            "Elevation range: 1-3000",
            "Elevation scale: dynamic",
            "Coverage: 0.7"
        ]
    },
    heatmap: {
        title: "Heatmap Layer",
        description: "The heatmap shows accident intensity with smooth gradients. Better for identifying precise hotspots.",
        small_desc: "Die Ebene visualisiert die Unfallintensität als Farbverläufe",
        methodology: [
            "Aggregation: SUM",
            "Color scale: Quantile (6 classes)",
            "Intensity: 1.3",
            "Radius: 35px",
            "Threshold: 0.15"
        ]
    }
};