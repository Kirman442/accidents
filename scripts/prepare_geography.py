"""Prepare independent map and population assets from validated population Parquet.
Run with UAD_data/.venv-boundaries/Scripts/python.exe; source Parquet is preserved.
"""
import hashlib
import json
from pathlib import Path
import pyarrow.parquet as pq
import shapely
from shapely.geometry import mapping

root = Path(__file__).resolve().parents[1]
source = root.parent / 'UAD_data/population-boundaries-2025'
output = root.parent / 'UAD_data/geography-2025-v1'
output.mkdir(exist_ok=True)
states = pq.read_table(source / 'states_population_2025_display_100m.parquet').to_pylist()
districts = pq.read_table(source / 'districts_population_2025_original.parquet').to_pylist()
assert len(states) == 16 and len(districts) == 400
assert sum(r['population'] for r in states) == sum(r['population'] for r in districts) == 83467117
geometry = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'state_code': r['state_code'], 'state_name': r['state_name']},
     'geometry': mapping(shapely.from_wkb(r['geometry']))} for r in states]}
population = {'schema_version': 1, 'population_date': '2025-12-31', 'national_population': 83467117,
              'states': [{k: r[k] for k in ('state_code', 'state_name', 'population', 'population_quality')} for r in states],
              'districts': [{k: r[k] for k in ('district_code', 'district_name', 'state_code', 'population', 'population_quality')} for r in districts]}
manifest = {'schema_version': 1, 'population_date': '2025-12-31', 'geometry_source_date': '2026-01-01',
            'note': 'BKG 2026 geometry adjusted to 2025 district composition; display only.',
            'sources': {'geometry': '© BKG (2026), dl-de/by-2-0', 'population': 'Destatis GENESIS 12411-0011/0016'}, 'files': {}}
for key, data in [('states', geometry), ('population', population)]:
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    digest = hashlib.sha256(payload).hexdigest()
    name = f'{key}-{digest[:16]}.json'
    (output / name).write_bytes(payload)
    manifest['files'][key] = {'path': name, 'sha256': digest, 'bytes': len(payload)}
(output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(output)
