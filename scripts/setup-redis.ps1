$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root '.tools\redis'
if (Test-Path (Join-Path $dest 'redis-server.exe')) { Write-Host "Redis already present at $dest"; exit 0 }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$rel = Invoke-RestMethod https://api.github.com/repos/redis-windows/redis-windows/releases/latest
$asset = $rel.assets | Where-Object { $_.name -match 'msys2\.zip$' -and $_.name -notmatch 'Service' } | Select-Object -First 1
$zip = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name)"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip
$tmp = Join-Path $env:TEMP ('redis-extract-' + [guid]::NewGuid())
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$server = Get-ChildItem -Path $tmp -Recurse -Filter 'redis-server.exe' | Select-Object -First 1
Copy-Item -Path (Join-Path $server.DirectoryName '*') -Destination $dest -Recurse -Force
Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
Write-Host "Redis installed to $dest"
