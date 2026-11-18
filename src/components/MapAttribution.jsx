import { useControl } from '@vis.gl/react-maplibre';

// DeckGL puts the basemap in a negative stacking context. Keep MapLibre's
// attribution lifecycle, but mount its element in a sibling overlay.
export default function MapAttribution({ containerRef }) {
    useControl(({ mapLib }) => {
        const attribution = new mapLib.AttributionControl({
            compact: true,
            customAttribution: '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>',
        });
        let placeholder;
        let observer;
        return {
            onAdd(map) {
                const element = attribution.onAdd(map);
                const inner = element.querySelector('.maplibregl-ctrl-attrib-inner');
                const legal = element.ownerDocument.createElement('span');
                legal.className = 'map-attribution-legal';
                legal.lang = 'de';
                legal.innerHTML = ' | <a href="#impressum" aria-haspopup="dialog">Impressum</a> · ' +
                    '<a href="#datenschutz" aria-haspopup="dialog">Datenschutz</a>';
                // MapLibre replaces the attribution contents as sources change.
                // Restore the final links without changing source text or styles.
                const appendLegal = () => {
                    if (inner.lastChild !== legal) inner.appendChild(legal);
                };
                appendLegal();
                observer = new MutationObserver(appendLegal);
                observer.observe(inner, { childList: true });
                containerRef.current.appendChild(element);
                placeholder = element.ownerDocument.createElement('div');
                placeholder.hidden = true;
                return placeholder;
            },
            onRemove() {
                observer?.disconnect();
                attribution.onRemove();
                placeholder?.remove();
            },
            getDefaultPosition() { return 'bottom-right'; },
        };
    });
    return null;
}
