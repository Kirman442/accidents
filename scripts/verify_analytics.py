"""Independent round-trip check of the local prepared files against each source row."""
import argparse
import collections
import csv
import hashlib
import io
import itertools
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dataset', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent / 'data'
output = args.dataset or root / 'prepared-2020-2025'
manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['status'] == 'complete'
direct_fields = {'month': 'UMONAT', 'hour': 'USTUNDE', 'weekday': 'UWOCHENTAG',
    'category': 'UKATEGORIE', 'accident_type': 'UART', 'accident_pattern': 'UTYP1',
    'light': 'ULICHTVERH', 'rad': 'IstRad', 'pkw': 'IstPKW', 'fuss': 'IstFuss',
    'krad': 'IstKrad', 'gkfz': 'IstGkfz', 'other_participant': 'IstSonstige',
    'year': 'UJAHR', 'uland': 'ULAND', 'uregbez': 'UREGBEZ',
    'ukreis': 'UKREIS', 'ugemeinde': 'UGEMEINDE'}
total = 0
pkw_counts = collections.Counter()
for year in range(2020, 2026):
    counts = collections.Counter()
    with zipfile.ZipFile(root / f'Unfallorte{year}_EPSG25832_CSV.zip') as archive:
        entry = next(n for n in archive.namelist() if n.endswith(('.csv', '.txt')))
        with archive.open(entry) as source, (output / f'accidents_{year}.csv').open(encoding='utf-8', newline='') as prepared:
            a = csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig'), delimiter=';')
            b = csv.DictReader(prepared)
            count = 0
            for count, (raw, ready) in enumerate(itertools.zip_longest(a, b), 1):
                assert raw is not None and ready is not None, (year, count, 'row lost/added')
                assert ready['source_uid'] == raw['UIDENTSTLAE'], (year, count, 'UID changed')
                assert int(ready['record_id']) == year * 1_000_000 + count
                assert int(ready['source_row']) == count
                assert ready['source_oid'] == raw.get('OID_', raw.get('OBJECTID', ''))
                for target, original in direct_fields.items():
                    assert int(ready[target]) == int(raw[original]), (year, count, target)
                for target, original in [('longitude', 'XGCSWGS84'), ('latitude', 'YGCSWGS84'),
                                          ('linref_x', 'LINREFX'), ('linref_y', 'LINREFY')]:
                    assert float(ready[target]) == float(raw[original].replace(',', '.'))
                assert int(ready['road_condition']) == int(raw.get('IstStrassenzustand', raw.get('STRZUSTAND')))
                assert ready['plst'] == raw.get('PLST', '')
                code = raw['ULAND'].zfill(2) + raw['UREGBEZ'].zfill(1) + raw['UKREIS'].zfill(2)
                assert ready['source_district_code'] == code
                assert ready['source_municipality_code'] == code + raw['UGEMEINDE'].zfill(3)
                counts[int(ready['uland'])] += 1
                pkw_counts[(year, 'land', raw['ULAND'].zfill(2))] += int(raw['IstPKW'])
                pkw_counts[(year, 'national', 'DE')] += int(raw['IstPKW'])
    assert count == manifest['accident_years'][str(year)]['rows']
    assert dict(counts) == {int(k): v for k, v in manifest['accident_years'][str(year)]['lands'].items()}
    total += count
    print(f'Round trip {year}: {count} rows, all source fields matched', flush=True)
assert total == manifest['total_accidents']
with (output / 'fleet_snapshots.csv').open(encoding='utf-8', newline='') as source:
    stocks = {(r['snapshot_date'], r['geography_level'], r['region_code']): int(r['pkw'])
              for r in csv.DictReader(source)}
with (output / 'land_year_indicators.csv').open(encoding='utf-8', newline='') as source:
    indicators = list(csv.DictReader(source))
assert len(indicators) == 102
for r in indicators:
    year = int(r['year'])
    assert int(r['pkw_accidents']) == pkw_counts[(year, r['geography_level'], r['region_code'])]
    a = stocks[(f'{year}-01-01', r['geography_level'], r['region_code'])]
    b = stocks[(f'{year+1}-01-01', r['geography_level'], r['region_code'])]
    assert a == int(r['pkw_begin']) and b == int(r['pkw_end'])
    assert float(r['pkw_mean_endpoints']) == (a+b)/2
    assert float(r['pkw_accidents_per_10000_pkw']) == int(r['pkw_accidents']) / ((a+b)/2) * 10000
checks = [(output / name, info['sha256']) for name, info in manifest['outputs'].items()]
checks += [(Path(s['file']), s['sha256']) for s in manifest['sources']]
for path, expected in checks:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024*1024), b''):
            digest.update(chunk)
    assert digest.hexdigest() == expected, path.name
print(f'PASS: {total} rows, 102 indicators, source/output checksums', flush=True)
