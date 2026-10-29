param(
  [string]$PublishDirectory = (Join-Path $PSScriptRoot "bin/Release/net10.0-windows10.0.19041.0/win-x64/publish"),
  [string]$IdentityName = "MotoTrack.Development",
  [string]$Publisher = "CN=MotoTrack Development",
  [string]$Version = "1.0.0.0"
)
$ErrorActionPreference = "Stop"
$publish = (Resolve-Path -LiteralPath $PublishDirectory).Path
if (!(Test-Path -LiteralPath (Join-Path $publish "MotoTrack.exe"))) { throw "Publish MotoTrack.exe before packaging." }
$layout = Join-Path $PSScriptRoot ("build/msix-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $layout -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $publish "MotoTrack.exe") -Destination $layout
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Assets") -Destination $layout -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "licenses") -Destination $layout -Recurse
[xml]$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot "AppxManifest.xml")
$manifest.Package.Identity.Name = $IdentityName
$manifest.Package.Identity.Publisher = $Publisher
$manifest.Package.Identity.Version = $Version
$manifest.Save((Join-Path $layout "AppxManifest.xml"))
$kits = Join-Path ([Environment]::GetEnvironmentVariable("ProgramFiles(x86)")) "Windows Kits/10/bin"
$makeAppx = Get-ChildItem -LiteralPath $kits -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | ForEach-Object { Join-Path $_.FullName "x64/makeappx.exe" } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$makeAppx) { throw "Install the Windows SDK packaging tools." }
$output = Join-Path $PSScriptRoot "../packages"
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $makeAppx pack /d $layout /p (Join-Path $output "moto-track-windows-x64-unsigned.msix") /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx packaging failed." }
Write-Output "Unsigned package created. Replace development identity with Partner Center identity and sign before distribution."
