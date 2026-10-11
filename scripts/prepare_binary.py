"""Export the audited local dataset to Parquet and browser-compatible Arrow IPC.

No network, database, application or source-file mutations. One year is processed
at a time. Every output is read back before the staging folder is published.
"""
import argparse
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import time
import uuid

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pacsv
import pyarrow.ipc as ipc
import pyarrow.parquet as pq

STRINGS = {'source_uid', 'source_oid', 'uregbez', 'ukreis', 'ugemeinde',
           'source_district_code', 'source_municipality_code', 'plst'}
FLOATS = {'longitude', 'latitude', 'linref_x', 'linref_y'}
DOMAINS = {'uland': (1, 16), 'month': (1, 12), 'hour': (0, 23),
           'weekday': (1, 7), 'category': (1, 3), 'accident_type': (0, 9),
           'accident_pattern': (1, 7), 'light': (0, 2), 'road_condition': (0, 2),
           **{k: (0, 1) for k in ('rad', 'pkw', 'fuss', 'krad', 'gkfz', 'other_participant')}}
SOURCE_FIELDS = ['record_id', 'source_row', 'source_uid', 'source_oid', 'year',
                 'uland', 'uregbez', 'ukreis', 'ugemeinde', 'source_district_code',
                 'source_municipality_code', 'month', 'hour', 'weekday', 'category',
                 'accident_type', 'accident_pattern', 'light', 'rad', 'pkw', 'fuss',
                 'krad', 'gkfz', 'other_participant', 'road_condition', 'longitude',
                 'latitude', 'linref_x', 'linref_y', 'plst']
RUNTIME_FIELDS = ['record_id', 'source_uid', 'year', 'uland', 'source_district_code',
                  'source_municipality_code', 'month', 'hour', 'weekday', 'category',
                  'accident_type', 'accident_pattern', 'light', 'road_condition',
                  'rad', 'pkw', 'fuss', 'krad', 'gkfz', 'other_participant']
PARQUET_PROFILES = {'zstd3': ('zstd', 3), 'zstd10': ('zstd', 10),
                    'snappy': ('snappy', None)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def column_type(name):
    if name in STRINGS:
        return pa.string()
    if name in FLOATS:
        return pa.float64()
    if name in ('record_id', 'source_row'):
        return pa.uint32()
    return pa.uint16() if name == 'year' else pa.uint8()


def read_accidents(path, year, expected):
    table = pacsv.read_csv(path, convert_options=pacsv.ConvertOptions(
        column_types={n: column_type(n) for n in SOURCE_FIELDS},
        strings_can_be_null=False, null_values=[]))
    require(table.column_names == SOURCE_FIELDS, 'Unexpected accident columns/order')
    require(table.num_rows == expected and expected > 0, 'Unexpected source row count')
    require(all(c.null_count == 0 for c in table.columns), 'Null source value')
    require(pc.all(pc.equal(table['year'], year)).as_py(), 'Wrong year in source')
    require(pc.count_distinct(table['record_id']).as_py() == expected, 'Duplicate record_id')
    require(pc.all(pc.equal(table['source_row'], pa.array(range(1, expected + 1), pa.uint32()))).as_py(),
            'Source row order changed')
    require(pc.all(pc.equal(table['record_id'], pc.add(table['source_row'], year * 1_000_000))).as_py(),
            'Record ID does not match source row')
    for name, (low, high) in DOMAINS.items():
        bounds = pc.min_max(table[name]).as_py()
        require(low <= bounds['min'] <= bounds['max'] <= high, f'Invalid {name}')
    for name in FLOATS:
        require(pc.all(pc.is_finite(table[name])).as_py(), f'Non-finite {name}')
    for name, limit in [('longitude', 180), ('latitude', 90)]:
        require(pc.all(pc.less_equal(pc.abs(table[name]), limit)).as_py(), f'Invalid {name}')
    require(pc.all(pc.greater(pc.utf8_length(table['source_uid']), 0)).as_py(), 'Empty source UID')
    return table


def runtime_table(source, metadata, digits):
    # Float64 retains the rounded decimals without adding Float32 quantization.
    lon = pc.round(source['longitude'], ndigits=digits, round_mode='half_to_even').combine_chunks()
    lat = pc.round(source['latitude'], ndigits=digits, round_mode='half_to_even').combine_chunks()
    coordinates = [value for pair in zip(lon.to_pylist(), lat.to_pylist()) for value in pair]
    positions = pa.FixedSizeListArray.from_arrays(pa.array(coordinates, pa.float64()),
        type=pa.list_(pa.field('element', pa.float64()), 2))
    table = source.select(RUNTIME_FIELDS).append_column('geometry', positions).combine_chunks()
    return table.replace_schema_metadata(metadata)


def rounding_report(source, runtime):
    max_lon = max_lat = max_shift = 0.0
    for x, y, pair in zip(source['longitude'].to_pylist(), source['latitude'].to_pylist(),
                          runtime['geometry'].to_pylist()):
        dx, dy = abs(x - pair[0]), abs(y - pair[1])
        max_lon, max_lat = max(max_lon, dx), max(max_lat, dy)
        # Spherical local estimate, explicitly not a surveyed displacement.
        max_shift = max(max_shift, math.hypot(dx * math.cos(math.radians(y)), dy)
                        * math.pi / 180 * 6_371_008.8)
    return {'max_longitude_delta_degrees': max_lon, 'max_latitude_delta_degrees': max_lat,
            'max_estimated_shift_m': max_shift}


def equal_tables(expected, actual, label):
    require(expected.schema.equals(actual.schema, check_metadata=True), f'Schema mismatch: {label}')
    require(expected.equals(actual), f'Value/order mismatch: {label}')


def write_parquet(path, table, profile, rows):
    codec, level = PARQUET_PROFILES[profile]
    kwargs = {'compression_level': level} if level is not None else {}
    pq.write_table(table, path, compression=codec, row_group_size=rows,
                   use_dictionary=[n for n in table.column_names if n in DOMAINS
                                   or n in ('year', 'source_district_code', 'source_municipality_code')],
                   write_statistics=True, version='2.6', data_page_version='1.0', **kwargs)


def write_arrow(path, table, kind, rows):
    # IPC body compression stays OFF for compatibility with Arrow JS 19.
    factory = ipc.new_file if kind == 'file' else ipc.new_stream
    with pa.OSFile(str(path), 'wb') as sink, factory(sink, table.schema,
            options=ipc.IpcWriteOptions(compression=None)) as writer:
        writer.write_table(table, max_chunksize=rows)


def read_arrow(payload, kind):
    reader = ipc.open_file if kind == 'file' else ipc.open_stream
    return reader(pa.BufferReader(payload)).read_all()


def emit_variants(stage, stem, table, args, outputs, scope):
    entries = []
    for profile in args.parquet_profiles:
        path = stage / 'parquet' / profile / (stem + '.parquet')
        path.parent.mkdir(parents=True, exist_ok=True)
        started = time.perf_counter()
        write_parquet(path, table, profile, args.row_group_size)
        write_ms = (time.perf_counter() - started) * 1000
        started = time.perf_counter()
        equal_tables(table, pq.ParquetFile(path).read(), path.name)
        entry = register(path, stage, outputs, scope, table, 'parquet', profile,
                         write_ms, (time.perf_counter() - started) * 1000)
        entry['row_groups'] = pq.ParquetFile(path).metadata.num_row_groups
        entries.append(entry)
    for kind in args.arrow_kinds:
        path = stage / 'arrow' / kind / (stem + '.arrow')
        path.parent.mkdir(parents=True, exist_ok=True)
        started = time.perf_counter()
        write_arrow(path, table, kind, args.batch_size)
        write_ms = (time.perf_counter() - started) * 1000
        payload = path.read_bytes()
        started = time.perf_counter()
        equal_tables(table, read_arrow(payload, kind), path.name)
        entries.append(register(path, stage, outputs, scope, table, 'arrow-' + kind,
                                'identity', write_ms, (time.perf_counter() - started) * 1000))
        for encoding in args.arrow_encodings:
            started = time.perf_counter()
            if encoding == 'gzip':
                packed = gzip.compress(payload, compresslevel=9, mtime=0)
                unpack = gzip.decompress
                suffix = '.gz'
            else:
                codec = pa.Codec('brotli', compression_level=args.brotli_quality)
                packed = bytes(codec.compress(payload))
                unpack = lambda data: bytes(codec.decompress(data, len(payload)))
                suffix = '.br'
            compressed = Path(str(path) + suffix)
            compressed.write_bytes(packed)
            compression_ms = (time.perf_counter() - started) * 1000
            started = time.perf_counter()
            recovered = unpack(packed)
            require(recovered == payload, f'Compression round trip failed: {compressed}')
            equal_tables(table, read_arrow(recovered, kind), compressed.name)
            entries.append(register(compressed, stage, outputs, scope, table, 'arrow-' + kind,
                                    encoding, compression_ms, (time.perf_counter() - started) * 1000))
    return entries


def register(path, stage, outputs, scope, table, format_name, compression, write_ms, read_ms):
    entry = {'path': path.relative_to(stage).as_posix(), **scope,
             'rows': table.num_rows, 'bytes': path.stat().st_size, 'sha256': sha256(path),
             'format': format_name, 'compression': compression,
             'logical_arrow_bytes': table.nbytes, 'write_or_compress_ms': write_ms,
             'local_readback_ms': read_ms, 'verified': True}
    outputs.append(entry)
    return entry


def verify_input(source):
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    require(manifest.get('schema_version') == 1 and manifest.get('status') == 'complete',
            'Input dataset is not a completed supported generation')
    require(manifest.get('outputs'), 'Input has no output checksums')
    for name, spec in manifest['outputs'].items():
        path = source / name
        require(path.parent.resolve() == source, 'Unsafe input manifest filename')
        require(path.is_file() and path.stat().st_size == spec['bytes']
                and sha256(path) == spec['sha256'], f'Input checksum mismatch: {name}')
    return manifest


def convert_small_csv(path):
    # Explicit types preserve date/level/region codes; no geography inference.
    with path.open(encoding='utf-8', newline='') as handle:
        names = next(csv.reader(handle))
    types = {n: (pa.string() if n in ('snapshot_date', 'geography_level', 'region_code', 'name')
                 else pa.float64() if n in ('pkw_mean_endpoints', 'pkw_accidents_per_10000_pkw')
                 else pa.uint16() if n == 'year' else pa.uint32()) for n in names}
    return pacsv.read_csv(path, convert_options=pacsv.ConvertOptions(
        column_types=types, strings_can_be_null=False, null_values=[]))


def prepare(args):
    source, output = args.input.resolve(), args.output.resolve()
    require(source.is_dir(), f'Missing input directory: {source}')
    require(not output.exists(), f'Output already exists; choose a new folder: {output}')
    require(output != source and source not in output.parents and output not in source.parents,
            'Output must be separate from the input tree')
    manifest = verify_input(source)
    years = args.years or sorted(map(int, manifest['accident_years']))
    require(set(years) <= set(map(int, manifest['accident_years'])), 'Unavailable year')
    for codec in {'zstd', 'snappy', 'brotli'}:
        require(pa.Codec.is_available(codec), f'PyArrow codec unavailable: {codec}')
    generation = uuid.uuid4().hex
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = output.parent / ('.binary-staging-' + generation)
    stage.mkdir()
    report = {'schema_version': 1, 'status': 'complete', 'generation': generation,
              'created_utc': datetime.now(timezone.utc).isoformat(),
              'pyarrow_version': pa.__version__, 'input_manifest_sha256': sha256(source / 'manifest.json'),
              'years': years, 'lands': args.lands, 'coordinate_decimals': args.coordinate_decimals,
              'batch_size': args.batch_size, 'row_group_size': args.row_group_size,
              'brotli_quality': args.brotli_quality, 'files': [], 'shards': [],
              'notes': ['Logical Arrow bytes are NOT peak browser/worker/GPU memory.',
                        'Readback timings are local checks, NOT network or first-map timings.',
                        'Arrow uses uncompressed IPC bodies; br/gzip require HTTP Content-Encoding or explicit decompression.',
                        'Runtime geometry is FixedSizeList<Float64,2> [longitude,latitude], CRS EPSG:4326. This is application Parquet, not certified GeoParquet.',
                        'Source UIDs remain text and may repeat. record_id is the unique source-row-based identity.',
                        'Only runtime geometry is rounded. Archive fields preserve the prepared source values.']}
    outputs = report['files']
    for year in years:
        source_table = read_accidents(source / f'accidents_{year}.csv', year,
                                      manifest['accident_years'][str(year)]['rows'])
        meta = {b'uad.schema_version': b'1', b'uad.generation': generation.encode(),
                b'uad.input_manifest_sha256': report['input_manifest_sha256'].encode(),
                b'uad.year': str(year).encode()}
        archive = stage / 'archive' / f'accidents_{year}_full.parquet'
        archive.parent.mkdir(exist_ok=True)
        original = source_table.replace_schema_metadata({**meta, b'uad.profile': b'full-source'})
        started = time.perf_counter()
        write_parquet(archive, original, 'zstd10', args.row_group_size)
        write_ms = (time.perf_counter() - started) * 1000
        started = time.perf_counter()
        equal_tables(original, pq.ParquetFile(archive).read(), archive.name)
        register(archive, stage, outputs, {'scope': 'archive', 'year': year}, original,
                 'parquet', 'zstd10', write_ms, (time.perf_counter() - started) * 1000)
        for land in args.lands:
            selected = source_table.filter(pc.equal(source_table['uland'], land))
            expected = manifest['accident_years'][str(year)]['lands'][str(land)]
            require(selected.num_rows == expected and expected > 0, f'Missing/wrong land {year}:{land}')
            runtime = runtime_table(selected, {**meta, b'uad.profile': b'browser-v1',
                    b'uad.land': str(land).encode(), b'uad.crs': b'EPSG:4326',
                    b'uad.coordinate_decimals': str(args.coordinate_decimals).encode(),
                    b'uad.geometry_layout': b'FixedSizeList<Float64,2>:longitude,latitude'}, args.coordinate_decimals)
            # Invariants: rounding cannot affect IDs, attributes, or row order.
            equal_tables(selected.select(RUNTIME_FIELDS), runtime.select(RUNTIME_FIELDS).replace_schema_metadata(None),
                         f'Runtime attributes {year}:{land}')
            scope = {'scope': 'runtime', 'year': year, 'land': land}
            entries = emit_variants(stage, f'{year}/uland_{land:02}', runtime, args, outputs, scope)
            report['shards'].append({**scope, 'rows': expected, **rounding_report(selected, runtime),
                                     'geometry_columns': ['geometry'],
                                     'attribute_columns': RUNTIME_FIELDS, 'files': [e['path'] for e in entries]})
            print(f'{year} land {land:02}: {expected} rows, {len(entries)} verified variants', flush=True)
        del source_table, original, selected, runtime
    for name in ('fleet_snapshots', 'land_year_indicators'):
        table = convert_small_csv(source / (name + '.csv')).replace_schema_metadata({
            b'uad.schema_version': b'1', b'uad.generation': generation.encode(), b'uad.profile': name.encode()})
        emit_variants(stage, 'analytics/' + name, table, args, outputs, {'scope': name})
    for name in ('accident_summaries.json', 'land_year_indicators.csv', 'fleet_snapshots.csv'):
        target = stage / 'analytics' / name
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(source / name, target)
        require(sha256(target) == manifest['outputs'][name]['sha256'], 'Summary copy mismatch')
        outputs.append({'path': target.relative_to(stage).as_posix(), 'scope': 'analytics-copy',
                        'bytes': target.stat().st_size, 'sha256': sha256(target), 'verified': True})
    require(sha256(source / 'manifest.json') == report['input_manifest_sha256'],
            'Input manifest changed during export')
    verify_input(source)
    totals = {}
    for entry in outputs:
        key = '/'.join((entry['scope'], entry.get('format', 'source'), entry.get('compression', 'identity')))
        totals[key] = totals.get(key, 0) + entry['bytes']
    report['size_totals_bytes'] = totals
    report['runtime_rows'] = sum(s['rows'] for s in report['shards'])
    report['file_count'] = len(outputs)
    fields = ['path', 'scope', 'year', 'land', 'rows', 'format', 'compression', 'bytes',
              'logical_arrow_bytes', 'write_or_compress_ms', 'local_readback_ms', 'sha256', 'verified']
    with (stage / 'size-report.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(outputs)
    (stage / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    stage.rename(output)
    print(f'COMPLETE: {report["runtime_rows"]} runtime rows, {len(outputs)} files; {output}', flush=True)
    return report


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=root / 'data/prepared-2020-2025')
    parser.add_argument('--output', type=Path, default=root / 'data/binary-2020-2025-v1')
    parser.add_argument('--years', type=int, nargs='+')
    parser.add_argument('--lands', type=int, nargs='+', default=list(range(1, 17)))
    parser.add_argument('--coordinate-decimals', type=int, choices=(5, 6), default=5)
    parser.add_argument('--row-group-size', type=int, default=16384)
    parser.add_argument('--batch-size', type=int, default=16384)
    parser.add_argument('--parquet-profiles', nargs='+', choices=PARQUET_PROFILES, default=list(PARQUET_PROFILES))
    parser.add_argument('--arrow-kinds', nargs='+', choices=('file', 'stream'), default=['file', 'stream'])
    parser.add_argument('--arrow-encodings', nargs='*', choices=('gzip', 'br'), default=['gzip', 'br'])
    parser.add_argument('--brotli-quality', type=int, choices=range(12), default=6)
    args = parser.parse_args()
    require(args.batch_size > 0 and args.row_group_size > 0, 'Batch sizes must be positive')
    require(all(1 <= land <= 16 for land in args.lands), 'Land must be 1..16')
    for name in ('lands', 'years', 'parquet_profiles', 'arrow_kinds', 'arrow_encodings'):
        values = getattr(args, name)
        require(values is None or len(values) == len(set(values)), f'Duplicate {name}')
    prepare(args)


if __name__ == '__main__':
    main()
