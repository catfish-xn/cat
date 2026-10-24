param(
    [string]$Python = 'python',
    [string]$GameDir = ''
)
$ErrorActionPreference = 'Stop'
$trialRoot = Split-Path $PSScriptRoot -Parent
Push-Location $trialRoot
try {
    New-Item -ItemType Directory -Force .local/tools | Out-Null
    & $Python -m pip install --target .local/python 'cdtb==1.3.0'
    if ($LASTEXITCODE -ne 0) { throw 'CDTB install failed' }
    $env:PYTHONPATH = Join-Path $trialRoot '.local/python'
    $env:CDTB_HASHES_DIR = Join-Path $trialRoot '.local/hashes'
    & $Python -m cdtb fetch-hashes
    if ($LASTEXITCODE -ne 0) { throw 'Hash download failed' }
    $tool = Join-Path $trialRoot '.local/tools/lol2gltf.exe'
    if (!(Test-Path -LiteralPath $tool)) {
        Invoke-WebRequest 'https://github.com/Crauzer/lol2gltf/releases/download/2025-02-28-d36a532/lol2gltf.exe' -OutFile $tool
    }
    if ((Get-FileHash -LiteralPath $tool -Algorithm SHA256).Hash -ne 'CD5DFE49E869FE7C6A1E44D3EE31534CBFC3FD5808FBA630019AA2128FEC45FF') {
        throw 'lol2gltf release SHA256 mismatch'
    }
    & node tools/fetch-assets.mjs
    if ($LASTEXITCODE -ne 0) { throw 'CDragon download failed' }
    if ($GameDir) { & $Python tools/extract-wad.py --local-game $GameDir }
    else { & $Python tools/extract-wad.py }
    if ($LASTEXITCODE -ne 0) { throw 'WAD extraction failed' }
    & node tools/convert-assets.mjs
    if ($LASTEXITCODE -ne 0) { throw 'glTF conversion failed' }
} finally { Pop-Location }
