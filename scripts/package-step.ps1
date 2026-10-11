param(
    [Parameter(Mandatory=$true)][ValidateRange(1,99)][int]$Step,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_]+$')][string]$Name,
    [string]$DataRoot = ''
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
if (-not $DataRoot) { $DataRoot = if ($env:UAD_DATA_DIR) { $env:UAD_DATA_DIR } else { Join-Path (Split-Path $taskRoot -Parent) 'UAD_data' } }
$taskDestination = Join-Path $DataRoot ('{0:D2}_step_{1}.zip' -f $Step,$Name)
if (Test-Path -LiteralPath $taskDestination) { throw "Archive already exists: $taskDestination" }
$taskStatus = & git -C $taskRoot status --porcelain
if ($LASTEXITCODE -ne 0 -or $taskStatus) { throw 'Commit all project changes before packaging this step.' }
$taskCommit = & git -C $taskRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Git commit lookup failed.' }
$taskFiles = & git -C $taskRoot -c core.quotepath=false ls-files
if ($LASTEXITCODE -ne 0) { throw 'Git file inventory failed.' }
$taskStage = Join-Path ([System.IO.Path]::GetTempPath()) ('uad-step-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null
try {
    foreach ($taskRelative in $taskFiles) {
        if ($taskRelative -match '(^|/)(data|node_modules|dist|\.git)/' -or
            ($taskRelative -match '(^|/)\.env($|\.)' -and $taskRelative -ne '.env.example') -or
            $taskRelative -match '(^|/)uad_settings\.txt$') { throw "Excluded private/generated file is tracked: $taskRelative" }
        $taskSource = [System.IO.Path]::GetFullPath((Join-Path $taskRoot $taskRelative))
        $taskTarget = [System.IO.Path]::GetFullPath((Join-Path $taskStage $taskRelative))
        if (-not $taskSource.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or
            -not $taskTarget.StartsWith($taskStage + [System.IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Unsafe archive file path.'
        }
        New-Item -ItemType Directory -Path (Split-Path $taskTarget -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $taskSource -Destination $taskTarget
    }
    @("Step: $Step", "Name: $Name", "Commit: $taskCommit", "Created: $([DateTime]::UtcNow.ToString('o'))",
        'Full tracked project snapshot. Source datasets, credentials, dependencies and build output are excluded.',
        'Place datasets in adjacent UAD_data or set UAD_DATA_DIR. Read README and the step report before running.') |
        Set-Content -LiteralPath (Join-Path $taskStage 'STEP_SNAPSHOT.txt') -Encoding utf8
    New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($taskStage,$taskDestination,[System.IO.Compression.CompressionLevel]::Optimal,$false)
    $taskHash = (Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash.ToLowerInvariant()
    "$taskHash  $([System.IO.Path]::GetFileName($taskDestination))" | Set-Content -LiteralPath ($taskDestination + '.sha256') -Encoding ascii
    Write-Host "Archive: $taskDestination"
    Write-Host "SHA256: $taskHash"
} finally {
    $taskResolvedStage = [System.IO.Path]::GetFullPath($taskStage)
    $taskResolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($taskResolvedStage.StartsWith($taskResolvedTemp,[StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($taskResolvedStage).StartsWith('uad-step-')) {
        Remove-Item -LiteralPath $taskResolvedStage -Recurse -Force
    }
}
