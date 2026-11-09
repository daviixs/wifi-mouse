<#
.SYNOPSIS
  Compila o Remote Mouse para Windows e gera um pacote MSIX.

.DESCRIPTION
  1. cargo build --release --locked para o alvo escolhido (x64 ou arm64).
  2. Monta windows\dist\msix-<arch>\ com RemoteMouse.exe, Assets\ e o
     AppxManifest.xml com os marcadores substituídos.
  3. MakeAppx pack -> windows\dist\RemoteMouse_<versão>_<arch>.msix
  4. Opcional: assina com um certificado .pfx (-CertificatePath) ou com um
     certificado de teste autoassinado (-SelfSign) para instalar localmente.

  Para a Microsoft Store NÃO assine: envie o .msix sem assinatura no Partner
  Center (a Store assina). Use -IdentityName/-Publisher/-PublisherDisplayName
  exatamente como em Partner Center -> Product identity.

.EXAMPLE
  # Teste local (cria e confia um certificado de teste; pede elevação uma vez)
  .\windows\scripts\package-msix.ps1 -SelfSign

.EXAMPLE
  # Pacote para a Store
  .\windows\scripts\package-msix.ps1 -Version 1.0.0.0 `
    -IdentityName "12345Carlos.RemoteMouse" `
    -Publisher "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" `
    -PublisherDisplayName "Carlos Costa" `
    -DisplayName "Remote Mouse Wi-Fi"
#>
[CmdletBinding()]
param(
  [ValidateSet("x64", "arm64")]
  [string]$Arch = "x64",
  [ValidatePattern('^\d+\.\d+\.\d+\.0$')]
  [string]$Version = "1.0.0.0",
  [string]$IdentityName = "RemoteMouse.Local",
  [string]$Publisher = "CN=RemoteMouseLocalTest",
  [string]$PublisherDisplayName = "Remote Mouse",
  # Deve ser idêntico ao nome reservado no Partner Center.
  [ValidateLength(1, 256)]
  [string]$DisplayName = "Remote Mouse",
  [switch]$SelfSign,
  [string]$CertificatePath,
  [string]$CertificatePassword,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$WindowsDir = Split-Path -Parent $PSScriptRoot
$Triple = if ($Arch -eq "arm64") { "aarch64-pc-windows-msvc" } else { "x86_64-pc-windows-msvc" }
$Dist = Join-Path $WindowsDir "dist"
$Stage = Join-Path $Dist "msix-$Arch"
$Package = Join-Path $Dist "RemoteMouse_$($Version)_$Arch.msix"

function Find-SdkTool([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $programFiles = ${env:ProgramFiles(x86)}
  if (-not $programFiles) { throw "$Name não encontrado: rode este script no Windows com o Windows SDK." }
  $kits = Join-Path $programFiles "Windows Kits\10\bin"
  $found = Get-ChildItem -Path $kits -Filter $Name -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\' } |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $found) {
    throw "$Name não encontrado. Instale o Windows SDK (Visual Studio Installer -> Windows 11 SDK)."
  }
  return $found.FullName
}

if ($Publisher -notmatch '^CN=') { throw "-Publisher deve começar com CN= (copie de Partner Center)." }
if ($SelfSign -and $CertificatePath) { throw "Use -SelfSign OU -CertificatePath, não os dois." }

if (-not $SkipBuild) {
  Write-Host "==> cargo build --release ($Triple)"
  & cargo build --release --locked --target $Triple --manifest-path (Join-Path $WindowsDir "Cargo.toml")
  if ($LASTEXITCODE -ne 0) { throw "cargo build falhou." }
}
$Exe = Join-Path $WindowsDir "target\$Triple\release\RemoteMouse.exe"
if (-not (Test-Path $Exe)) { throw "Executável ausente: $Exe" }

Write-Host "==> Montando $Stage"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "Assets") | Out-Null
Copy-Item $Exe (Join-Path $Stage "RemoteMouse.exe")
Copy-Item (Join-Path $WindowsDir "packaging\Assets\*.png") (Join-Path $Stage "Assets")
$Manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $WindowsDir "packaging\AppxManifest.xml")
$Replacements = [ordered]@{
  "__IDENTITY_NAME__" = [Security.SecurityElement]::Escape($IdentityName)
  "__PUBLISHER_DISPLAY_NAME__" = [Security.SecurityElement]::Escape($PublisherDisplayName)
  "__PUBLISHER__" = [Security.SecurityElement]::Escape($Publisher)
  "__DISPLAY_NAME__" = [Security.SecurityElement]::Escape($DisplayName)
  "__VERSION__" = $Version
  "__ARCH__" = $Arch
}
foreach ($entry in $Replacements.GetEnumerator()) {
  $Manifest = $Manifest.Replace($entry.Key, $entry.Value)
}
if ($Manifest -match "__[A-Z_]+__") { throw "Marcador não substituído no manifesto: $($Matches[0])" }
[IO.File]::WriteAllText((Join-Path $Stage "AppxManifest.xml"), $Manifest, (New-Object Text.UTF8Encoding($false)))

$MakeAppx = Find-SdkTool "makeappx.exe"
Write-Host "==> MakeAppx pack -> $Package"
& $MakeAppx pack /o /d $Stage /p $Package
if ($LASTEXITCODE -ne 0) { throw "MakeAppx falhou." }

if ($SelfSign) {
  $Cer = Join-Path $Dist "RemoteMouse-teste.cer"
  $Cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq $Publisher -and $_.NotAfter -gt (Get-Date) } | Select-Object -First 1
  if (-not $Cert) {
    Write-Host "==> Criando certificado de teste $Publisher (somente para esta máquina)"
    $Cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher -KeyUsage DigitalSignature `
      -FriendlyName "Remote Mouse (teste local)" -CertStoreLocation "Cert:\CurrentUser\My" `
      -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
  }
  Export-Certificate -Cert $Cert -FilePath $Cer | Out-Null
  $SignTool = Find-SdkTool "signtool.exe"
  & $SignTool sign /fd SHA256 /sha1 $Cert.Thumbprint /s My $Package
  if ($LASTEXITCODE -ne 0) { throw "signtool falhou." }
  Write-Host ""
  Write-Host "Pacote de teste assinado: $Package"
  Write-Host "Confie no certificado UMA vez (PowerShell como Administrador):"
  Write-Host "  Import-Certificate -FilePath `"$Cer`" -CertStoreLocation Cert:\LocalMachine\TrustedPeople"
  Write-Host "Depois instale:  Add-AppxPackage `"$Package`""
} elseif ($CertificatePath) {
  $SignTool = Find-SdkTool "signtool.exe"
  $arguments = @("sign", "/fd", "SHA256", "/f", $CertificatePath)
  if ($CertificatePassword) { $arguments += @("/p", $CertificatePassword) }
  & $SignTool @arguments $Package
  if ($LASTEXITCODE -ne 0) { throw "signtool falhou." }
  Write-Host "Pacote assinado: $Package"
} else {
  Write-Host ""
  Write-Host "Pacote sem assinatura (para enviar à Microsoft Store): $Package"
}
