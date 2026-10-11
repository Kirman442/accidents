# Local analytics dataset: Unfallatlas 2020–2025 and KBA 2020–2026

The preparation script reads the six official Unfallatlas ZIPs and seven KBA FZ 1 snapshots. It creates local CSV files and summary JSON. It does not connect to Supabase or change the published application. All source archives and generated data remain ignored by Git under `data/`; only the script, tests and documentation are committed.

## Prepare

Requires Python 3 with openpyxl. Use the bundled workspace Python runtime or an equivalent installed environment.

```powershell
python -B scripts/prepare_analytics.py --fleet-2026 "M:/projekte/Ladesaeulenregister/data/Bestand an Kraftfahrzeugen und Kraftfahrzeuganhängern nach Zulassungsbezirken.xlsx"
python -B tests/analytics_preparation_test.py
python -B scripts/verify_analytics.py
```

Expected local inputs: `data/UnfallorteYYYY_EPSG25832_CSV.zip` for 2020–2025; `data/fz1_YYYY.xlsx` for 2021–2025; `data/fz1_2020_xlsx.xlsx`. The existing 2026 workbook is passed explicitly. The default output is `data/prepared-2020-2025/`. Existing output is never overwritten. Use `--output data/prepared-2020-2025-v2` for a separate rebuild. Failed preparation leaves an identifiable `.analytics-staging-*` directory without publishing it as a completed dataset.

## Outputs

- `accidents_2020.csv` … `accidents_2025.csv`: every source row, normalized to the same schema; original UID, object ID and source-row position retained. Includes coordinates, year, land, territorial codes, month, hour, weekday, severity category, accident type/pattern, light, road condition and participant flags. Original `PLST` is retained when available; blank means unavailable in that edition.
- `fleet_snapshots.csv`: published stocks on January 1 of 2020–2026, at national, land, registration-district and separate `OTHER` levels. Includes vehicle categories and Pkw fuel categories. Levels must be filtered before summing to avoid counting subtotals twice.
- `accident_summaries.json`: national and land counts and distributions by year; participant counts can overlap because one crash can involve several modes.
- `land_year_indicators.csv`: 102 rows, six years × (Germany + 16 lands). The numerator is crashes with Pkw involvement, not the number of involved vehicles or victims. The denominator is the arithmetic mean of published Pkw stocks at the beginning and end of that year. This is an endpoint approximation, not a measured annual mean, mileage-adjusted risk or probability for a resident driver.
- `manifest.json`: schema version, input/output SHA-256, source counts, UID repetition diagnostics and stock controls. A completed folder must contain this manifest with `status: complete`.

## Identity and formats

`record_id = year * 1,000,000 + source_row` is a unique JavaScript-safe integer in this dataset. Source files are limited to fewer than one million rows per year. It is reproducible for identical input bytes and ordering, not guaranteed stable across revised source editions. Preserve manifest checksums with any import. The original `source_uid` is text: it contains leading zeros and exceeds JavaScript's exact integer range. Never import it as a floating-point number.

In 2021, NRW source UIDs repeat for distinct crashes. They are retained, not deduplicated. One original UID contains internal spaces, which are also preserved verbatim and reported in the manifest. Object-ID column names differ (`OBJECTID`, `OID_`) and the 2025 source lacks one. The 2021 table is a semicolon-delimited `.txt`; decimal commas are converted without coordinate rounding. `STRZUSTAND` in 2020 is normalized to `road_condition`. `ULAND=5` and `ULAND=05` both become numeric land 5.

## Validation and interpretation

The script validates domains and coordinates, source year, nonempty source cells, object-ID uniqueness when present, all 16 lands, each marginal distribution, fleet stocks by district/land/nation, Pkw counts across both FZ 1 sheets, fuel composition and Plug-in as a subset of Hybrid. `-` in KBA means zero according to the source legend; unknown or suppressed counts fail instead of becoming zero. Germany's published total includes `Sonstige`, which is preserved separately rather than assigned to a land.

The map source represents geolocated crashes with personal injury, not all police-recorded crashes. Severity category 1 counts crashes with fatalities, not people killed. Fuel composition is regional context; Unfallatlas does not identify vehicle powertrains, so these files cannot calculate EV-specific crash rates. The 2025 filename refers to BasisDLM; review official metadata before interpreting small spatial movements between editions.

Territorial codes are preserved as source codes and are not automatically treated as KBA registration districts. Hamburg/Berlin subdivisions and combined registration districts need a reviewed crosswalk for district analysis. Registration-district counts change over time. The first indicators join only on stable land codes; there is no unverified district join. Approximate fleet-average rates do not adjust for through traffic, commuting or vehicle mileage. Stock categories such as Krafträder and accident involvement such as IstKrad need a definition check before extending normalized rates beyond Pkw.

Official sources: [Unfallatlas](https://unfallatlas.statistikportal.de/), [KBA FZ 1 catalog](https://www.kba.de/DE/Statistik/Produktkatalog/produkte/Fahrzeuge/fz1_b_uebersicht.html).

## Observed preparation — 2026-10-11

All 1,543,886 accidents were retained: 237,994 (2020), 238,826 (2021), 256,492 (2022), 269,048 (2023), 268,519 (2024), 273,007 (2025). Every year includes all 16 lands. Seven stock snapshots provide both endpoints for each accident year at national and land levels. All fleet count/fuel controls passed. The 2021 source has 823 repeated UID groups (866 excess UID occurrences) and one UID containing internal spaces; every associated record remains separate. Five regression tests passed. Independent read-back checks compare each prepared source field with its original row, all 102 indicator numerators/denominators with sources, and input/output checksums.
