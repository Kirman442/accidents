param([string]$Python = '', [string]$Output = '', [string]$DataRoot = '', [switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
if (-not $DataRoot) { $DataRoot = if ($env:UAD_DATA_DIR) { $env:UAD_DATA_DIR } else { Join-Path (Split-Path $taskRoot -Parent) 'UAD_data' } }
$taskInput = Join-Path $DataRoot 'prepared-2020-2025'
if (-not (Test-Path -LiteralPath (Join-Path $taskInput 'manifest.json'))) {
    throw 'Missing prepared dataset: specify -DataRoot or UAD_DATA_DIR'
}
if (-not $Output) {
    $Output = Join-Path $DataRoot ('binary-2020-2025-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
$taskEnvironment = Join-Path $DataRoot '.venv-binary'
$taskExecutable = Join-Path $taskEnvironment 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskExecutable)) {
    if ($Python) { & $Python -m venv $taskEnvironment }
    elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m venv $taskEnvironment }
    elseif (Get-Command python -ErrorAction SilentlyContinue) { & python -m venv $taskEnvironment }
    else { throw 'Install Python 3.10+ or run scripts/run_binary.ps1 -Python FULL_PATH_TO_PYTHON' }
    if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed' }
}
& $taskExecutable -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ required"'
if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ required' }
if (-not $SkipInstall) {
    & $taskExecutable -m pip install -r (Join-Path $PSScriptRoot 'requirements-binary.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
}
$taskLog = Join-Path $DataRoot ('binary-prepare-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -LiteralPath $taskLog
try {
    & $taskExecutable -B -X utf8 (Join-Path $taskRoot 'tests/binary_preparation_test.py')
    if ($LASTEXITCODE -ne 0) { throw 'Export regression checks failed' }
    & $taskExecutable -B -X utf8 (Join-Path $PSScriptRoot 'prepare_binary.py') --input $taskInput --output $Output
    if ($LASTEXITCODE -ne 0) { throw 'Export failed; see the log and staging directory' }
    Write-Host "Ready: $Output"
    Write-Host "Report: $Output/size-report.csv"
} finally { Stop-Transcript }
