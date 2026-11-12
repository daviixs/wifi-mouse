; ConnectMouse — instalador com assistente (Inno Setup 6.3+ ou 7).
;
; Gere com windows\installer\build-installer.ps1 (compila o app e chama o
; ISCC). Manualmente, depois de `cargo build --release`:
;   ISCC.exe /DAppVersion=1.0.0 windows\installer\ConnectMouse.iss
; Defines opcionais: /DArch=arm64, /DExeSource=<caminho do RemoteMouse.exe>.
; Saída: windows\dist\ConnectMouse-Setup-<versão>.exe (arm64: -arm64.exe).
;
; Instala por usuário (sem UAC) em %LOCALAPPDATA%\Programs\ConnectMouse. O
; assistente oferece "Instalar para todos os usuários" (pede administrador);
; só nesse modo ele também cria as regras do Firewall do Windows.

#ifndef Arch
  #define Arch "x64"
#endif
#if Arch != "x64" && Arch != "arm64"
  #error Arch deve ser x64 ou arm64
#endif
#ifndef ExeSource
  #if Arch == "arm64"
    #define ExeSource AddBackslash(SourcePath) + "..\target\aarch64-pc-windows-msvc\release\RemoteMouse.exe"
  #else
    #define ExeSource AddBackslash(SourcePath) + "..\target\x86_64-pc-windows-msvc\release\RemoteMouse.exe"
  #endif
#endif
#if !FileExists(ExeSource)
  #error RemoteMouse.exe não encontrado. Rode antes: cargo build --release --target x86_64-pc-windows-msvc (ou use build-installer.ps1)
#endif
#ifndef AppVersion
  ; build-installer.ps1 passa a versão do windows\Cargo.toml.
  #define AppVersion GetVersionNumbersString(ExeSource)
#endif

#define AppName "ConnectMouse"
#define AppPublisher "Society Avid"
#define AppURL "https://connectmouse.davixs.com.br/"
#define AppExe "RemoteMouse.exe"
; Mesmo nome de valor que o app usa (windows/src/autostart.rs, RUN_VALUE).
#define RunKey "Software\Microsoft\Windows\CurrentVersion\Run"
#define ApprovedKey "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
#define RunValue "ConnectMouse"
#define FirewallTcp "ConnectMouse (TCP 8765)"
#define FirewallUdp "ConnectMouse (UDP 5353 mDNS)"

[Setup]
; Nunca mude o AppId: é ele que liga atualizações e desinstalação.
AppId={{9300D9AA-309A-495A-BE1C-3D5522E8D5FD}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
AppCopyright=© {#AppPublisher}
VersionInfoVersion={#AppVersion}
VersionInfoProductName={#AppName}
VersionInfoDescription={#AppName} Setup
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
DisableReadyPage=no
; Por usuário por padrão; o assistente deixa escolher "todos os usuários".
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline
; A chave Run e o idioma ficam em HKCU de propósito (o app lê/escreve lá).
UsedUserAreasWarning=no
#if Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
OutputBaseFilename=ConnectMouse-Setup-{#AppVersion}-arm64
#else
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=ConnectMouse-Setup-{#AppVersion}
#endif
; Windows 10 1809 ou superior, igual ao pacote MSIX.
MinVersion=10.0.17763
OutputDir=..\dist
SetupIconFile=..\resources\RemoteMouse.ico
WizardSmallImageFile=WizardSmallImage-55.png,WizardSmallImage-69.png,WizardSmallImage-83.png,WizardSmallImage-110.png
WizardStyle=modern
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
; O [Code] fecha o app pela mensagem dele; o Restart Manager é o plano B.
CloseApplications=yes
RestartApplications=no
SetupMutex=ConnectMouseSetup,Global\ConnectMouseSetup
ShowLanguageDialog=auto

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[CustomMessages]
ptbr.AutoStartTask=Iniciar o ConnectMouse quando o Windows iniciar
en.AutoStartTask=Start ConnectMouse when Windows starts
es.AutoStartTask=Iniciar ConnectMouse al iniciar Windows
ptbr.StartupGroup=Inicialização:
en.StartupGroup=Startup:
es.StartupGroup=Inicio:
ptbr.FirewallTask=Liberar o ConnectMouse no Firewall do Windows (redes privadas)
en.FirewallTask=Allow ConnectMouse through Windows Firewall (private networks)
es.FirewallTask=Permitir ConnectMouse en el Firewall de Windows (redes privadas)
ptbr.NetworkGroup=Rede:
en.NetworkGroup=Network:
es.NetworkGroup=Red:
ptbr.FirewallStatus=Configurando o Firewall do Windows...
en.FirewallStatus=Configuring Windows Firewall...
es.FirewallStatus=Configurando el Firewall de Windows...
ptbr.CloseAppFailed=Não foi possível fechar o ConnectMouse. Feche-o pelo ícone da área de notificação (botão direito → Sair) e tente de novo.
en.CloseAppFailed=ConnectMouse could not be closed. Quit it from the notification area icon (right-click → Quit) and try again.
es.CloseAppFailed=No se pudo cerrar ConnectMouse. Ciérralo desde el icono del área de notificación (clic derecho → Salir) e inténtalo de nuevo.
; Idioma inicial do app = idioma escolhido no instalador (o app pode trocar).
ptbr.AppLanguageTag=pt-BR
en.AppLanguageTag=en
es.AppLanguageTag=es

[Tasks]
Name: "autostart"; Description: "{cm:AutoStartTask}"; GroupDescription: "{cm:StartupGroup}"
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "firewall"; Description: "{cm:FirewallTask}"; GroupDescription: "{cm:NetworkGroup}"; Check: IsAdminInstallMode

[Files]
Source: "{#ExeSource}"; DestDir: "{app}"; DestName: "{#AppExe}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; "Iniciar com o Windows": exatamente o que o menu da bandeja grava.
Root: HKCU; Subkey: "{#RunKey}"; ValueType: string; ValueName: "{#RunValue}"; ValueData: """{app}\{#AppExe}"" --autostart"; Tasks: autostart; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\RemoteMouse"; ValueType: string; ValueName: "Language"; ValueData: "{cm:AppLanguageTag}"; Flags: createvalueifdoesntexist

[Run]
; Firewall (só na instalação para todos os usuários, que roda como admin).
; Apaga antes para não duplicar ao reinstalar/atualizar.
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#FirewallTcp}"""; Flags: runhidden; Tasks: firewall
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#FirewallUdp}"""; Flags: runhidden; Tasks: firewall
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""{#FirewallTcp}"" dir=in action=allow protocol=TCP localport=8765 profile=private,domain program=""{app}\{#AppExe}"" enable=yes"; Flags: runhidden; StatusMsg: "{cm:FirewallStatus}"; Tasks: firewall
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""{#FirewallUdp}"" dir=in action=allow protocol=UDP localport=5353 profile=private,domain program=""{app}\{#AppExe}"" enable=yes"; Flags: runhidden; StatusMsg: "{cm:FirewallStatus}"; Tasks: firewall
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#FirewallTcp}"""; Flags: runhidden; RunOnceId: "DeleteFirewallTcp"; Tasks: firewall
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#FirewallUdp}"""; Flags: runhidden; RunOnceId: "DeleteFirewallUdp"; Tasks: firewall

[Code]
const
  // windows/src/ui.rs: CLASS_NAME e WM_QUIT_APP (WM_APP + 4).
  AppWindowClass = 'RemoteMouseTrayPopup';
  WM_QUIT_APP = $8004;

// Pede ao app para sair (para o servidor, tira o ícone) e espera até 8 s.
function CloseRunningApp(): Boolean;
var
  Attempt: Integer;
begin
  if FindWindowByClassName(AppWindowClass) <> 0 then
  begin
    PostMessage(FindWindowByClassName(AppWindowClass), WM_QUIT_APP, 0, 0);
    for Attempt := 1 to 80 do
    begin
      if FindWindowByClassName(AppWindowClass) = 0 then
        Break;
      Sleep(100);
    end;
  end;
  Result := FindWindowByClassName(AppWindowClass) = 0;
end;

procedure RemoveAutostart();
begin
  RegDeleteValue(HKEY_CURRENT_USER, '{#RunKey}', '{#RunValue}');
  RegDeleteValue(HKEY_CURRENT_USER, '{#ApprovedKey}', '{#RunValue}');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not CloseRunningApp() then
    Result := CustomMessage('CloseAppFailed');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if WizardIsTaskSelected('autostart') then
      // Reativa se tinha sido desligado em Configurações → Aplicativos → Inicialização.
      RegDeleteValue(HKEY_CURRENT_USER, '{#ApprovedKey}', '{#RunValue}')
    else
      RemoveAutostart();
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if not CloseRunningApp() then
  begin
    MsgBox(CustomMessage('CloseAppFailed'), mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  // Também remove o valor criado pelo menu "Iniciar com o Windows" do app.
  if CurUninstallStep = usUninstall then
    RemoveAutostart();
end;
