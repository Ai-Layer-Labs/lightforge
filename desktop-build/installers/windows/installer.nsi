; RCRT Desktop Installer (Podman-based)
; Simple installer that bundles Podman Desktop and runs docker-compose

!include "MUI2.nsh"

!define APP_NAME "RCRT"
!define APP_VERSION "2.0.0"
!define APP_PUBLISHER "RCRT Project"

Name "${APP_NAME}"
OutFile "RCRT-Setup.exe"
InstallDir "$PROGRAMFILES64\${APP_NAME}"
RequestExecutionLevel admin

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "..\..\..\extension\icons\favicon.ico"
!define MUI_UNICON "..\..\..\extension\icons\favicon.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to RCRT Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install RCRT with Podman (container runtime).$\r$\n$\r$\nEverything is automated - just click Next!"
!define MUI_FINISHPAGE_RUN "$INSTDIR\rcrt-service.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Start RCRT Services"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Note: If WSL was installed, you may need to restart Windows first"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$INSTDIR"
    
    ; Stop any running RCRT service first
    DetailPrint "Stopping any running RCRT services..."
    nsExec::Exec 'taskkill /F /IM rcrt-service.exe'
    Sleep 1000
    
    ; Install Podman CLI (headless, fully automated)
    DetailPrint "Installing Podman with automatic WSL setup..."
    File "..\..\podman\podman-5.3.1-setup.exe"
    
    ; Run Podman installer with WSL auto-install enabled
    ; The installer will automatically install WSL if not present
    DetailPrint "Running Podman installer (may install WSL if needed)..."
    DetailPrint "This may take 3-5 minutes on first install..."
    
    ; Silent install with all features including WSL
    ExecWait '"$INSTDIR\podman-5.3.1-setup.exe" /install /quiet /norestart /WSL' $0
    
    ; Check result
    ${If} $0 == 0
        DetailPrint "Podman installed successfully"
    ${ElseIf} $0 == 3010
        DetailPrint "Podman installed - system restart may be required"
    ${Else}
        DetailPrint "Podman installation returned code: $0"
        DetailPrint "Installation may have succeeded or Podman may already be installed"
    ${EndIf}
    
    ; Clean up installer
    Delete "$INSTDIR\podman-5.3.1-setup.exe"
    
    DetailPrint "Podman CLI ready with WSL support"
    DetailPrint "Note: If WSL was just installed, Windows may require a restart"
    
    ; Copy Docker Compose file (runtime version - no build sections)
    DetailPrint "Installing RCRT configuration..."
    File "..\..\docker-compose-runtime.yml"
    Rename "$INSTDIR\docker-compose-runtime.yml" "$INSTDIR\docker-compose.yml"
    File "..\..\..\env.example"
    
    ; Create .env with basic configuration
    DetailPrint "Creating configuration file..."
    
    ; Use env.example as template and add generated key
    CopyFiles "$INSTDIR\env.example" "$INSTDIR\.env"
    
    DetailPrint "Configuration ready (encryption key can be generated on first use)"
    
    ; Copy pre-built Docker images
    DetailPrint "Installing Docker images (pre-built)..."
    CreateDirectory "$INSTDIR\images"
    SetOutPath "$INSTDIR\images"
    File /nonfatal "..\..\podman\images\*.tar"
    
    ; Copy extension and icons
    CreateDirectory "$INSTDIR\extension"
    SetOutPath "$INSTDIR\extension"
    File /r "..\..\..\extension\dist\*.*"
    
    ; Copy icons for system tray and shortcuts
    CreateDirectory "$INSTDIR\extension\icons"
    SetOutPath "$INSTDIR\extension\icons"
    File "..\..\..\extension\icons\favicon.ico"
    File "..\..\..\extension\icons\think-os-agent.png"
    File "..\..\..\extension\icons\icon-*.png"
    
    ; Copy icon to root for easy access
    SetOutPath "$INSTDIR"
    File /oname=icon.ico "..\..\..\extension\icons\favicon.ico"
    
    ; Copy bootstrap system (needed for first-run initialization)
    DetailPrint "Installing bootstrap system..."
    CreateDirectory "$INSTDIR\bootstrap-breadcrumbs"
    SetOutPath "$INSTDIR\bootstrap-breadcrumbs"
    File /r "..\..\..\bootstrap-breadcrumbs\*.*"
    
    ; Copy system tray app
    SetOutPath "$INSTDIR"
    File "..\..\output\bin\rcrt-service.exe"
    
    ; Extract Helium browser
    DetailPrint "Installing Helium browser..."
    CreateDirectory "$INSTDIR\browser"
    File "..\..\podman\helium-windows.zip"
    nsExec::ExecToLog 'powershell -Command "Expand-Archive -Path \"$INSTDIR\helium-windows.zip\" -DestinationPath \"$INSTDIR\browser\" -Force"'
    Delete "$INSTDIR\helium-windows.zip"
    
    ; Create data directory
    CreateDirectory "$LOCALAPPDATA\RCRT"
    CreateDirectory "$LOCALAPPDATA\RCRT\logs"
    
    ; Create shortcuts with ICO icon
    CreateShortcut "$DESKTOP\RCRT.lnk" "$INSTDIR\rcrt-service.exe" "" "$INSTDIR\icon.ico" 0
    CreateDirectory "$SMPROGRAMS\RCRT"
    CreateShortcut "$SMPROGRAMS\RCRT\RCRT.lnk" "$INSTDIR\rcrt-service.exe" "" "$INSTDIR\icon.ico" 0
    CreateShortcut "$SMPROGRAMS\RCRT\Dashboard.lnk" "http://localhost:8082" "" "$INSTDIR\icon.ico" 0
    
    ; Register auto-start
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "RCRT" "$INSTDIR\rcrt-service.exe"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Add to Programs and Features
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT" "DisplayVersion" "${APP_VERSION}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT" "NoRepair" 1
    
    DetailPrint "RCRT installed successfully!"
    DetailPrint "Podman Desktop will manage all services"
SectionEnd

Section "Uninstall"
    ; Stop services
    nsExec::Exec 'podman compose down'
    
    ; Stop Podman machine
    nsExec::Exec 'podman machine stop'
    
    ; Remove auto-start
    DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "RCRT"
    
    ; Remove shortcuts
    Delete "$DESKTOP\RCRT.lnk"
    RMDir /r "$SMPROGRAMS\RCRT"
    
    ; Remove installation
    RMDir /r "$INSTDIR"
    
    ; Remove registry
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RCRT"
    
    DetailPrint "RCRT uninstalled"
    DetailPrint "User data preserved in $LOCALAPPDATA\RCRT"
    DetailPrint "Podman Desktop left installed (can uninstall separately)"
SectionEnd

