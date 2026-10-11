"""Regression checks for real Parquet/Arrow exports, compression and identities."""
import argparse
import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/prepare_binary.py'
if not SCRIPT.exists():
    SCRIPT = Path(__file__).with_name('prepare_binary.py')
spec = importlib.util.spec_from_file_location('binary_export', SCRIPT)
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class BinaryExportTest(unittest.TestCase):
    def fixture(self, root):
        source = root / 'input'
        source.mkdir()
        rows = []
        for ordinal in range(1, 8):
            row = {n: '' if n in export.STRINGS else 0 for n in export.SOURCE_FIELDS}
            row.update(record_id=2025_000_000 + ordinal, source_row=ordinal,
                       source_uid='00123456789012345678' if ordinal != 7 else '16210716      528690',
                       year=2025, uland=1 if ordinal <= 4 else 5,
                       uregbez='0', ukreis='01', ugemeinde='001',
                       source_district_code='01001', source_municipality_code='01001001',
                       longitude=6.860271239000042, latitude=49.242967504000035,
                       linref_x=123.456789, linref_y=987.654321,
                       month=1, weekday=1, category=1, accident_pattern=1)
            rows.append(row)
        with (source / 'accidents_2025.csv').open('w', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, export.SOURCE_FIELDS)
            writer.writeheader(); writer.writerows(rows)
        (source / 'fleet_snapshots.csv').write_text('snapshot_date,geography_level,region_code,name,pkw\n2026-01-01,land,01,Test,100\n', encoding='utf-8')
        (source / 'land_year_indicators.csv').write_text('year,geography_level,region_code,accidents,pkw_mean_endpoints,pkw_accidents_per_10000_pkw\n2025,land,01,4,100.5,1.2\n', encoding='utf-8')
        (source / 'accident_summaries.json').write_text('{}', encoding='utf-8')
        manifest = {'schema_version': 1, 'status': 'complete',
                    'accident_years': {'2025': {'rows': 7, 'lands': {'1': 4, '5': 3}}},
                    'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': export.sha256(p)}
                                for p in source.iterdir()}}
        (source / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
        return argparse.Namespace(input=source, output=root / 'out', years=[2025], lands=[1, 5],
                                  coordinate_decimals=5, batch_size=2, row_group_size=2,
                                  parquet_profiles=list(export.PARQUET_PROFILES),
                                  arrow_kinds=['file', 'stream'], arrow_encodings=['gzip', 'br'],
                                  brotli_quality=6)

    def test_all_variants_rounding_batches_and_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.fixture(Path(directory))
            source_hash = export.sha256(args.input / 'accidents_2025.csv')
            report = export.prepare(args)
            self.assertEqual(report['runtime_rows'], 7)
            self.assertEqual(sum(e['scope'] == 'runtime' for e in report['files']), 18)
            self.assertTrue(all(e['verified'] for e in report['files']))
            arrow = args.output / 'arrow/file/2025/uland_05.arrow'
            reader = export.ipc.open_file(export.pa.BufferReader(arrow.read_bytes()))
            self.assertEqual(reader.num_record_batches, 2)
            self.assertEqual(reader.get_batch(1).num_rows, 1)
            table = reader.read_all()
            self.assertEqual(table['geometry'][0].as_py(), [6.86027, 49.24297])
            self.assertEqual(table['geometry'].type.value_type, export.pa.float64())
            self.assertEqual(table['source_uid'][2].as_py(), '16210716      528690')
            self.assertEqual(table['source_uid'][0].as_py(), '00123456789012345678')
            self.assertEqual(table['record_id'].to_pylist(), [2025000005, 2025000006, 2025000007])
            self.assertEqual(table['hour'].to_pylist(), [0, 0, 0])
            archive = export.pq.ParquetFile(args.output / 'archive/accidents_2025_full.parquet').read()
            self.assertEqual(archive['longitude'][0].as_py(), 6.860271239000042)
            fleet = export.read_arrow((args.output / 'arrow/file/analytics/fleet_snapshots.arrow').read_bytes(), 'file')
            self.assertEqual(fleet['region_code'][0].as_py(), '01')
            self.assertEqual(export.sha256(args.input / 'accidents_2025.csv'), source_hash)
            with self.assertRaisesRegex(ValueError, 'already exists'):
                export.prepare(args)

    def test_tampered_source_rejected_before_staging(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.fixture(Path(directory))
            with (args.input / 'accidents_2025.csv').open('a') as handle:
                handle.write('corrupt')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                export.prepare(args)
            self.assertFalse(args.output.exists())
            self.assertFalse(list(Path(directory).glob('.binary-staging-*')))

    def test_input_tree_cannot_be_used_for_output(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.fixture(Path(directory))
            args.output = args.input / 'generated'
            with self.assertRaisesRegex(ValueError, 'separate'):
                export.prepare(args)

    def test_duplicate_record_id_rejected_even_with_valid_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.fixture(Path(directory))
            path = args.input / 'accidents_2025.csv'
            path.write_text(path.read_text(encoding='utf-8').replace('2025000002', '2025000001'), encoding='utf-8')
            manifest_path = args.input / 'manifest.json'
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            manifest['outputs'][path.name] = {'bytes': path.stat().st_size, 'sha256': export.sha256(path)}
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate record_id'):
                export.prepare(args)
            self.assertFalse(args.output.exists())


if __name__ == '__main__':
    unittest.main()
