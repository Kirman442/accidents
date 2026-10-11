import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('prepare_analytics',
    Path(__file__).resolve().parents[1] / 'scripts' / 'prepare_analytics.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def source_row(year=2021):
    return dict(UIDENTSTLAE='05211004608100970000', ULAND='5', UREGBEZ='3',
        UKREIS='15', UGEMEINDE='000', UJAHR=str(year), UMONAT='01', USTUNDE='00',
        UWOCHENTAG='1', UKATEGORIE='3', UART='0', UTYP1='1', ULICHTVERH='0',
        IstStrassenzustand='0', IstRad='0', IstPKW='1', IstFuss='0', IstKrad='0',
        IstGkfz='0', IstSonstige='0', LINREFX='574751,5619', LINREFY='6018282,7608',
        XGCSWGS84='10,148875393000026', YGCSWGS84='54,306951053000034')


class PreparationTests(unittest.TestCase):
    def test_duplicate_source_uid_preserves_distinct_events_and_long_text(self):
        first = source_row()
        second = {**first, 'USTUNDE': '01', 'XGCSWGS84': '10,2'}
        a, b = module.normalize(first, 2021, 1), module.normalize(second, 2021, 2)
        self.assertEqual(a['source_uid'], '05211004608100970000')
        self.assertEqual(a['source_uid'], b['source_uid'])
        self.assertNotEqual(a['record_id'], b['record_id'])
        self.assertNotEqual(a['longitude'], b['longitude'])
        self.assertEqual(a['hour'], 0)
        self.assertEqual(a['uland'], 5)
        self.assertEqual(a['source_municipality_code'], '05315000')

    def test_2020_alias_and_object_id_preserve_values(self):
        row = source_row(2020)
        row['STRZUSTAND'] = row.pop('IstStrassenzustand')
        row['OBJECTID'] = '17'
        result = module.normalize(row, 2020, 17)
        self.assertEqual(result['road_condition'], 0)
        self.assertEqual(result['source_oid'], '17')
        self.assertEqual(result['plst'], '')
        self.assertAlmostEqual(result['longitude'], 10.148875393000026, places=13)

    def test_bad_period_and_nonfinite_coordinates_fail(self):
        for field, value in [('UJAHR', '2022'), ('USTUNDE', '24'),
                             ('IstPKW', ''), ('XGCSWGS84', 'nan')]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                module.normalize({**source_row(), field: value}, 2021, 1)

    def test_original_uid_with_internal_spaces_is_preserved(self):
        uid = '16210716      528690'
        result = module.normalize({**source_row(), 'UIDENTSTLAE': uid}, 2021, 1)
        self.assertEqual(result['source_uid'], uid)

    def test_unknown_stock_is_not_silently_zero(self):
        self.assertEqual(module.stock_number('-'), 0)
        self.assertEqual(module.stock_number(0), 0)
        for value in ['.', '/', None, '', -1]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.stock_number(value)


if __name__ == '__main__':
    unittest.main()
