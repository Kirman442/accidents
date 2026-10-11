"""Prepare local Unfallatlas/KBA data. Does not connect to a database."""
import argparse
import collections
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import uuid
import zipfile

import openpyxl

VERSION = 1
YEARS = range(2020, 2026)
LANDS = range(1, 17)
COUNTS = {'motorcycles': 4, 'motorcycles_two_wheeled': 5, 'pkw': 9,
          'buses': 21, 'lkw': 22, 'tractors': 31, 'semitrailer_tractors': 32,
          'other_vehicles': 35, 'commercial_vehicles': 36,
          'vehicles': 37, 'trailers': 39}
FUELS = {'pkw': 4, 'petrol': 5, 'diesel': 6, 'gas': 7, 'hybrid': 8,
         'plug_in_hybrid': 9, 'bev': 10, 'other_fuel': 11}
INTEGER_FIELDS = {'month': ('UMONAT', 1, 12), 'hour': ('USTUNDE', 0, 23),
    'weekday': ('UWOCHENTAG', 1, 7), 'category': ('UKATEGORIE', 1, 3),
    'accident_type': ('UART', 0, 9), 'accident_pattern': ('UTYP1', 1, 7),
    'light': ('ULICHTVERH', 0, 2), 'rad': ('IstRad', 0, 1),
    'pkw': ('IstPKW', 0, 1), 'fuss': ('IstFuss', 0, 1),
    'krad': ('IstKrad', 0, 1), 'gkfz': ('IstGkfz', 0, 1),
    'other_participant': ('IstSonstige', 0, 1)}
FIELDS = ['record_id', 'source_row', 'source_uid', 'source_oid', 'year', 'uland',
    'uregbez', 'ukreis', 'ugemeinde', 'source_district_code', 'source_municipality_code',
    *INTEGER_FIELDS, 'road_condition', 'longitude', 'latitude', 'linref_x',
    'linref_y', 'plst']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value, minimum, maximum):
    require(isinstance(value, str) and re.fullmatch(r'\d+', value) is not None,
            f'Invalid integer: {value!r}')
    number = int(value)
    require(minimum <= number <= maximum, f'Integer out of range: {value!r}')
    return number


def decimal(value):
    number = float(value.replace(',', '.'))
    require(math.isfinite(number), f'Non-finite coordinate: {value!r}')
    return number


def normalize(row, year, ordinal):
    require(0 < ordinal < 1_000_000, 'Source exceeds record-ID allocation')
    require(integer(row['UJAHR'], 2020, 2025) == year, 'Wrong source year')
    uid = row['UIDENTSTLAE']
    require(isinstance(uid, str) and bool(uid.strip()), 'Empty source UID')
    land = integer(row['ULAND'], 1, 16)
    reg = str(integer(row['UREGBEZ'], 0, 9))
    kreis = str(integer(row['UKREIS'], 0, 99)).zfill(2)
    gemeinde = str(integer(row['UGEMEINDE'], 0, 999)).zfill(3)
    code = f'{land:02}{reg}{kreis}'
    output = dict(record_id=year * 1_000_000 + ordinal, source_row=ordinal,
        source_uid=uid, source_oid=row.get('OID_', row.get('OBJECTID', '')),
        year=year, uland=land, uregbez=reg, ukreis=kreis, ugemeinde=gemeinde,
        source_district_code=code, source_municipality_code=code + gemeinde)
    for target, (source, low, high) in INTEGER_FIELDS.items():
        output[target] = integer(row[source], low, high)
    output['road_condition'] = integer(
        row.get('IstStrassenzustand', row.get('STRZUSTAND')), 0, 2)
    output['longitude'] = decimal(row['XGCSWGS84'])
    output['latitude'] = decimal(row['YGCSWGS84'])
    require(-180 <= output['longitude'] <= 180 and -90 <= output['latitude'] <= 90,
            'Coordinate outside WGS84 bounds')
    output['linref_x'] = decimal(row['LINREFX'])
    output['linref_y'] = decimal(row['LINREFY'])
    output['plst'] = row.get('PLST', '')
    return output


def stock_number(value):
    if isinstance(value, str) and value.strip() == '-':
        return 0  # Explicit KBA legend: nothing present.
    require(type(value) in (int, float) and value >= 0 and int(value) == value,
            f'Missing/non-integer KBA count: {value!r}')
    return int(value)


def read_fleet_sheet(rows, columns):
    result = {}
    last_land = None
    for row in rows:
        label = str(row[1] or '').strip()
        district = str(row[3] or '').strip()
        if re.match(r'^\d{5}\s', district):
            code = district[:5]
            last_land = int(code[:2])
            key = ('district', code)
            name = district[5:].strip()
        elif label == 'DEUTSCHLAND INSGESAMT':
            key, name = ('national', 'DE'), label
        elif label == 'SONSTIGE':
            key, name = ('other', 'OTHER'), label
        elif 'INSGESAMT' in label:
            require(last_land in LANDS, 'Land subtotal without district context')
            key, name = ('land', f'{last_land:02}'), label
        else:
            continue
        require(key not in result, f'Duplicate KBA geography: {key}')
        result[key] = {'name': name, **{k: stock_number(row[c]) for k, c in columns.items()}}
    require({k[1] for k in result if k[0] == 'land'} == {f'{l:02}' for l in LANDS},
            'Missing KBA land')
    require(('national', 'DE') in result and ('other', 'OTHER') in result,
            'Missing KBA national/other stock')
    for column in columns:
        districts = sum(v[column] for k, v in result.items() if k[0] == 'district')
        lands = sum(v[column] for k, v in result.items() if k[0] == 'land')
        require(districts == lands, f'District/land totals differ: {column}')
        require(lands + result[('other', 'OTHER')][column] == result[('national', 'DE')][column],
                f'Land/national totals differ: {column}')
        for land in LANDS:
            regional = sum(v[column] for k, v in result.items()
                           if k[0] == 'district' and k[1].startswith(f'{land:02}'))
            require(regional == result[('land', f'{land:02}')][column],
                    f'District totals differ in land {land}: {column}')
    return result


def load_fleet(path, year):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        require(str(workbook['Deckblatt']['A14'].value).strip() == f'1. Januar {year}',
                f'Wrong KBA snapshot: {path.name}')
        counts = read_fleet_sheet(workbook['FZ1.1'].values, COUNTS)
        fuels = read_fleet_sheet(workbook['FZ1.2'].values, FUELS)
        require(counts.keys() == fuels.keys(), 'KBA geography differs between sheets')
        for key, value in counts.items():
            require(value['pkw'] == fuels[key]['pkw'], f'Pkw count differs: {key}')
            fuel = fuels[key]
            require(sum(fuel[k] for k in ['petrol', 'diesel', 'gas', 'hybrid', 'bev', 'other_fuel'])
                    == fuel['pkw'], f'Fuel totals differ: {key}')
            require(fuel['plug_in_hybrid'] <= fuel['hybrid'], 'Plug-in exceeds hybrid total')
            value.update(fuel)
        return counts
    finally:
        workbook.close()


def new_summary():
    return {'count': 0, 'distributions': {k: collections.Counter()
        for k in ['month', 'hour', 'weekday', 'category', 'accident_type',
                  'accident_pattern', 'light', 'road_condition']},
        'participation': collections.Counter()}


def accumulate(summary, row):
    summary['count'] += 1
    for key, counter in summary['distributions'].items():
        counter[row[key]] += 1
    for key in ['rad', 'pkw', 'fuss', 'krad', 'gkfz', 'other_participant']:
        summary['participation'][key] += row[key]


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_csv(path, fields, rows):
    with path.open('w', encoding='utf-8', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def prepare(root, fleet_2026, output):
    require(not output.exists(), f'Output already exists: {output}')
    require(output.parent.resolve() == (root / 'data').resolve(), 'Output must be directly in data/')
    stage = output.parent / ('.analytics-staging-' + uuid.uuid4().hex)
    stage.mkdir()
    manifest = {'schema_version': VERSION, 'status': 'complete', 'sources': [],
                'accident_years': {}, 'fleet_snapshots': {}, 'total_accidents': 0}
    fleet = {}
    stock_rows = []
    for year in range(2020, 2027):
        filename = 'fz1_2020_xlsx.xlsx' if year == 2020 else f'fz1_{year}.xlsx'
        path = fleet_2026 if year == 2026 else root / 'data' / filename
        fleet[year] = load_fleet(path, year)
        manifest['sources'].append({'kind': 'kba', 'year': year, 'file': str(path), 'sha256': sha256(path)})
        manifest['fleet_snapshots'][year] = {'lands': 16,
            'districts': sum(k[0] == 'district' for k in fleet[year]),
            'national_pkw': fleet[year][('national', 'DE')]['pkw']}
        stock_rows.extend({'snapshot_date': f'{year}-01-01', 'geography_level': key[0],
                           'region_code': key[1], **value} for key, value in fleet[year].items())
    write_csv(stage / 'fleet_snapshots.csv', ['snapshot_date', 'geography_level', 'region_code',
              'name', *COUNTS, *(f for f in FUELS if f != 'pkw')], stock_rows)
    summaries = {}
    indicators = []
    for year in YEARS:
        path = root / 'data' / f'Unfallorte{year}_EPSG25832_CSV.zip'
        manifest['sources'].append({'kind': 'unfallatlas', 'year': year, 'file': str(path), 'sha256': sha256(path)})
        national = new_summary()
        lands = {land: new_summary() for land in LANDS}
        uid_counts = collections.Counter()
        source_oids = set()
        with zipfile.ZipFile(path) as archive, (stage / f'accidents_{year}.csv').open('w', encoding='utf-8', newline='') as target:
            entries = [n for n in archive.namelist() if n.lower().endswith(('.csv', '.txt'))]
            require(len(entries) == 1, 'Expected one accident table in archive')
            with archive.open(entries[0]) as source:
                reader = csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig'), delimiter=';')
                require(len(reader.fieldnames) == len(set(reader.fieldnames)), 'Duplicate CSV headers')
                writer = csv.DictWriter(target, fieldnames=FIELDS)
                writer.writeheader()
                for ordinal, raw in enumerate(reader, 1):
                    require(None not in raw and all(v is not None and v.strip() for v in raw.values()),
                            f'Malformed/empty source record {year}:{ordinal}')
                    row = normalize(raw, year, ordinal)
                    if row['source_oid']:
                        require(row['source_oid'] not in source_oids, 'Duplicate source object ID')
                        source_oids.add(row['source_oid'])
                    writer.writerow(row)
                    accumulate(national, row)
                    accumulate(lands[row['uland']], row)
                    uid_counts[row['source_uid']] += 1
        require(all(s['count'] > 0 for s in lands.values()), 'Missing accident land')
        require(sum(s['count'] for s in lands.values()) == national['count'], 'Accident totals differ')
        for summary in [national, *lands.values()]:
            require(all(sum(c.values()) == summary['count'] for c in summary['distributions'].values()),
                    'Distribution totals differ')
        summaries[year] = {'national': national, 'lands': lands}
        manifest['accident_years'][year] = {'rows': national['count'],
            'lands': {land: s['count'] for land, s in lands.items()},
            'repeated_uid_groups': sum(n > 1 for n in uid_counts.values()),
            'repeated_uid_excess_rows': sum(n - 1 for n in uid_counts.values()),
            'non_digit_uid_rows': sum(n for uid, n in uid_counts.items() if not re.fullmatch(r'\d+', uid)),
            'source_object_id_present': bool(source_oids)}
        manifest['total_accidents'] += national['count']
        for level, code, summary in [('national', 'DE', national)] + [('land', f'{land:02}', s) for land, s in lands.items()]:
            beginning = fleet[year][(level, code)]['pkw']
            ending = fleet[year + 1][(level, code)]['pkw']
            average = (beginning + ending) / 2
            require(average > 0, 'Empty Pkw denominator')
            indicators.append({'year': year, 'geography_level': level, 'region_code': code,
                'accidents': summary['count'], 'pkw_accidents': summary['participation']['pkw'],
                'pkw_begin': beginning, 'pkw_end': ending, 'pkw_mean_endpoints': average,
                'pkw_accidents_per_10000_pkw': summary['participation']['pkw'] / average * 10000})
        print(f'{year}: {national["count"]} accidents, 16 lands', flush=True)
    with (stage / 'accident_summaries.json').open('w', encoding='utf-8') as target:
        json.dump({'schema_version': VERSION, 'years': summaries}, target, ensure_ascii=False, indent=2)
    write_csv(stage / 'land_year_indicators.csv', list(indicators[0]), indicators)
    manifest['outputs'] = {p.name: {'bytes': p.stat().st_size, 'sha256': sha256(p)} for p in stage.iterdir()}
    with (stage / 'manifest.json').open('w', encoding='utf-8') as target:
        json.dump(manifest, target, ensure_ascii=False, indent=2)
    stage.rename(output)
    print(f'Completed: {manifest["total_accidents"]} accidents; {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fleet-2026', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    project = Path(__file__).resolve().parent.parent
    prepare(project, args.fleet_2026.resolve(),
            (args.output or project / 'data' / 'prepared-2020-2025').resolve())
