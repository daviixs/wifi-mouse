<#
.SYNOPSIS
  Compila o ConnectMouse para Windows e gera o instalador com assistente
  (Inno Setup): windows\dist\ConnectMouse-Setup-<versão>.exe

.DESCRIPTION
  1. Lê a versão de windows\Cargo.toml (ou use -Version).
  2. cargo build --release --locked para o alvo (x64 ou arm64).
  3. Chama o ISCC.exe do Inno Setup 6 (ou 7) com windows\installer\ConnectMouse.iss.

  Pré-requisitos: os mesmos do app (Rust + Visual Studio Build Tools) e o
  Inno Setup 6: https://jrsoftware.org/isdl.php (ou: winget install JRSoftware.InnoSetup).

.EXAMPLE
  .\windows\installer\build-installer.ps1

.EXAMPLE
  # ARM64, sem recompilar, com o ISCC em um caminho próprio
  .\windows\installer\build-installer.ps1 -Arch arm64 -SkipBuild -Iscc "D:\Inno Setup 6\ISCC.exe"
#>
[CmdletBinding()]
param(
  [ValidateSet("x64", "arm64")]
  [string]$Arch = "x64",
  # Padrão: [package] version de windows\Cargo.toml (ex.: 1.0.0).
  [ValidatePattern('^\d+(\.\d+){0,3}$')]
  [string]$Version,
  [string]$Iscc,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$InstallerDir = $PSScriptRoot
$WindowsDir = Split-Path -Parent $InstallerDir
$Script = Join-Path $InstallerDir "ConnectMouse.iss"
$Triple = if ($Arch -eq "arm64") { "aarch64-pc-windows-msvc" } else { "x86_64-pc-windows-msvc" }

function Get-CargoVersion {
  $inPackage = $false
  foreach ($line in Get-Content -Encoding UTF8 (Join-Path $WindowsDir "Cargo.toml")) {
    if ($line -match '^\s*\[(.+)\]\s*$') { $inPackage = $Matches[1] -eq "package"; continue }
    if ($inPackage -and $line -match '^\s*version\s*=\s*"([^"]+)"') { return $Matches[1] }
  }
  throw "Versão não encontrada em windows\Cargo.toml."
}

function Find-Iscc {
  if ($Iscc) {
    if (-not (Test-Path $Iscc)) { throw "ISCC.exe não encontrado em $Iscc" }
    return (Resolve-Path $Iscc).Path
  }
  $command = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @()
  # Local registrado pelo próprio instalador do Inno Setup (por máquina ou por usuário).
  foreach ($root in "HKLM:", "HKCU:") {
    foreach ($view in "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall") {
      foreach ($id in "Inno Setup 6_is1", "Inno Setup 7_is1", "Inno Setup 7 (64-bit)_is1") {
        $key = Join-Path "$root\$view" $id
        if (-not (Test-Path -LiteralPath $key)) { continue }
        $props = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
        if (-not $props) { continue }
        $prop = $props.PSObject.Properties["InstallLocation"]
        if ($prop -and $prop.Value) { $candidates += Join-Path $prop.Value "ISCC.exe" }
      }
    }
  }
  foreach ($base in ${env:ProgramFiles(x86)}, $env:ProgramFiles, (Join-Path $env:LOCALAPPDATA "Programs")) {
    if (-not $base) { continue }
    foreach ($name in "Inno Setup 6", "Inno Setup 7") { $candidates += Join-Path $base "$name\ISCC.exe" }
  }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  throw @"
ISCC.exe (Inno Setup) não encontrado.
Instale o Inno Setup 6: https://jrsoftware.org/isdl.php  (ou: winget install JRSoftware.InnoSetup)
ou informe o caminho com -Iscc "C:\...\ISCC.exe".
"@
}

if (-not $Version) { $Version = Get-CargoVersion }

if (-not $SkipBuild) {
  Write-Host "==> cargo build --release ($Triple)"
  & cargo build --release --locked --target $Triple --manifest-path (Join-Path $WindowsDir "Cargo.toml")
  if ($LASTEXITCODE -ne 0) { throw "cargo build falhou." }
}
$Exe = Join-Path $WindowsDir "target\$Triple\release\RemoteMouse.exe"
if (-not (Test-Path $Exe)) { throw "Executável ausente: $Exe (rode sem -SkipBuild)" }

$Compiler = Find-Iscc
Write-Host "==> $Compiler (ConnectMouse $Version, $Arch)"
& $Compiler "/DAppVersion=$Version" "/DArch=$Arch" "/DExeSource=$Exe" $Script
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou (código $LASTEXITCODE)." }

$Suffix = if ($Arch -eq "arm64") { "-arm64" } else { "" }
$Output = Join-Path $WindowsDir "dist\ConnectMouse-Setup-$Version$Suffix.exe"
Write-Host ""
Write-Host "Instalador pronto: $Output"
Write-Host "Instalação silenciosa: `"$Output`" /VERYSILENT /TASKS=`"autostart`""
