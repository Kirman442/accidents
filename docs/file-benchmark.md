# Local file-loader comparison

Branch: `codex/uad-file-benchmark`. This is a separate diagnostic entry point; the normal Supabase map remains at `/accidents/`. No database, deployment or production configuration changes.

## Run

1. Prepare the complete binary dataset with `RUN_PREPARE_BINARY.cmd` (see `binary-dataset.md`).
2. Run `npm ci`, `npm test`, `npm run build`.
3. Run `npm run preview -- --host 127.0.0.1 --port 5186 --strictPort`.
4. Open `http://127.0.0.1:5186/accidents/benchmark.html`.

The local server chooses the latest `data/binary-2020-2025-*` directory. To select another export, set `UAD_BINARY_DATA` to its absolute path before starting the server. The export must be complete and contain all 96 land/year shards. Generated files are ignored and are not copied into `dist` or Git.

## What is actually measured

Four fresh workers per trial read all 16 land files of the chosen year plus the fleet snapshot file. Parquet ZSTD 10 uses parquet-wasm 0.6.1 followed by Arrow IPC decoding. Arrow IPC file + Brotli uses browser HTTP decompression followed by apache-arrow 19.0.1 decoding. The server supplies `Content-Encoding: br`; simply uploading `.br` files to a host without that header will not work with this loader. A static deployment adapter is a separate step.

Each file is downloaded completely, checked by SHA-256, decoded and validated. Geometry and attributes remain together. Each completed land is displayed progressively. This baseline does not read Parquet columns by HTTP Range or display coordinates before decoding attributes within the same file.

Workers retain Arrow columns and apply AND filters, calculate monthly/category/participant distributions, and prepare transferable ID/coordinate buffers. Main thread renders binary scatterplot layers, hexagons or a heatmap. These display buffers are newly allocated snapshots; the complete pipeline is not zero-copy. Hexagon and heatmap preparation also combines coordinate buffers on the main thread.

Fleet rates use the mean of published Pkw stock on January 1 of the selected year and the next year. The numerator is accidents involving Pkw, not involved vehicles or casualties. Filters change the numerator; only choosing a land changes the regional denominator. National stock includes the KBA Sonstige group. District comparisons remain deferred until a geographical crosswalk is audited.

The automated series alternates Parquet/Arrow/Arrow/Parquet/Parquet/Arrow. Every trial runs four real selections: Germany, NRW, NRW/category 3/Pkw without Rad or Fuß, and Monday with Rad. Initial distributions are compared to audited source summaries. Repeated selections are compared by ID and coordinate hashes, full statistics and fleet rate. Unit tests cover zero/null filter semantics, combined and empty selections, duplicate textual source UIDs, cancellation and worker queue ordering.

JSON reports separate first data-bearing deck.gl frame, all-data readiness, complete-selection frame, worker decoding/validation/filter timings, file bytes, observed HTTP transfer bytes and logical Arrow bytes. Timings begin at the run button, after page/catalog initialization. A frame callback is not a GPU completion/presentation fence. In hexagon/heatmap mode the field `firstPointsFrameMs` means the first data-bearing frame of that layer. Initialization timings overlap downloading/checksums and must not be summed as elapsed startup. The optional main-thread heap sample excludes workers, WASM and GPU and is not total peak memory. Observed transfer bytes cover dataset files, not page bundles/WASM/map tiles.

## Verified local baseline, 2026-10-11

Dataset: `binary-2020-2025-20261011-143536`, five-decimal Float64 coordinates, 2025 = 273,007 accidents. All 891 generated file sizes and checksums had been verified before these browser trials. See `file-benchmark-results.json` for raw browser measurements.

Six points-mode trials without HTTP data caching, three per format:

| Format | Dataset files incl. fleet | Median first frame | Median all-data readiness | Median full-selection frame |
| --- | ---: | ---: | ---: | ---: |
| Parquet ZSTD 10 | 5.94 MiB | 667 ms | 3,199 ms | 3,223 ms |
| Arrow + Brotli | 6.40 MiB | 372 ms | 2,839 ms | 2,861 ms |

The first Parquet trial was slower (4.54 s data readiness), so these are observations rather than an isolated causal estimate of format speed. Localhost, browser scheduling, existing code/WASM caches and validation overhead affect the numbers. Both formats include decoding, integrity checks, scanning, statistics and preparing map buffers; neither merely renders precomputed aggregates.

Six points-mode cache-enabled trials also passed. First cache-enabled requests populated the HTTP cache; later trials reported zero dataset transfer bytes. In the two fully cached repeats per format, all-data readiness was 2.35–2.52 s for Parquet and 1.92–3.09 s for Arrow. One full-frame interval contained a 1.57 s scheduling delay: do not confuse that delay with data decoding.

All 2025 scenarios matched between formats/repeats: 273,007 / 61,521 / 25,508 / 13,162 accidents. A separate Python scan of normalized source CSVs verified these counts independently of the shared JavaScript filtering code. That scan also recorded the other years:

| Year | Germany | NRW | NRW/category 3/Pkw without Rad/Foot | Monday/Rad |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 237,994 | 49,328 | 19,453 | 11,780 |
| 2021 | 238,826 | 50,057 | 20,016 | 11,349 |
| 2022 | 256,492 | 53,057 | 21,420 | 12,254 |
| 2023 | 269,048 | 59,640 | 24,649 | 13,268 |
| 2024 | 268,519 | 59,035 | 24,948 | 13,184 |
| 2025 | 273,007 | 61,521 | 25,508 | 13,162 |

## Next decision

Parquet is smaller and works as an ordinary static file. Arrow+Brotli is a promising fast-display option but needs a compatible decompression/hosting path. Before selecting production storage, compare the same scenarios with realistic network conditions and measure workers/WASM/GPU memory separately. The current implementation is a correctness and real-workload baseline, not a finished replacement for the production app.

Additional browser checks passed: all six years (2020/2023 Parquet, 2022/2024 Arrow, 2021/2025 both); all four source-CSV selections matched for every year. Both formats passed hexagon and heatmap trials for 2025. The saved report contains 22 completed trials. UI stop/restart was checked separately: stopping disables attribute filters and a fresh run completes normally. All 17 Node tests, targeted ESLint and the production build passed. The build retains the existing loaders.gl browser-external spawn warning.
