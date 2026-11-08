-- Finder dictionary only: no System Events, UI clicking or global Finder defaults.
-- Paths arrive as arguments, never interpolated into AppleScript source.
on run argv
    if (count of argv) is not 2 then error "Uso: dmg-layout.applescript configure|verify mountpoint"
    set layoutMode to item 1 of argv
    set mountPath to item 2 of argv
    if layoutMode is not "configure" and layoutMode is not "verify" then error "Modo de layout inválido"
    set expectedBounds to {120, 120, 760, 622}
    set targetWindow to missing value
    with timeout of 60 seconds
        tell application "Finder"
            try
                -- Resolve this unique mount, not an arbitrary disk named Remote Mouse.
                set volumeRoot to folder ((POSIX file mountPath) as alias)
                open volumeRoot
                set targetWindow to container window of volumeRoot
                if layoutMode is "configure" then
                    set current view of targetWindow to icon view
                    set toolbar visible of targetWindow to false
                    set statusbar visible of targetWindow to false
                    set sidebar width of targetWindow to 0
                    set bounds of targetWindow to expectedBounds
                    set viewOptions to icon view options of targetWindow
                    set arrangement of viewOptions to not arranged
                    set icon size of viewOptions to 72
                    set text size of viewOptions to 12
                    set label position of viewOptions to bottom
                    set shows item info of viewOptions to false
                    -- A Finder file alias relative to the volume root. No host staging
                    -- path is written as a background-image string into .DS_Store.
                    set background picture of viewOptions to file "background.png" of folder ".background" of volumeRoot
                    set position of item "Remote Mouse.app" of volumeRoot to {170, 240}
                    set position of item "Applications" of volumeRoot to {470, 240}
                    update volumeRoot without registering applications
                    close targetWindow
                    delay 1
                    open volumeRoot
                    set targetWindow to container window of volumeRoot
                    -- Force an actual bounds change so Finder persists the window size.
                    set bounds of targetWindow to {120, 120, 750, 612}
                    delay 1
                    set bounds of targetWindow to expectedBounds
                    update volumeRoot without registering applications
                    delay 2
                end if

                -- The same checks also run after unmount + read-only conversion.
                -- In verify mode no setting is rewritten: failures abort the build.
                if current view of targetWindow is not icon view then error "Layout: visualização não é por ícones"
                if toolbar visible of targetWindow then error "Layout: barra de ferramentas visível"
                if statusbar visible of targetWindow then error "Layout: barra de status visível"
                if sidebar width of targetWindow is not 0 then error "Layout: barra lateral visível"
                if bounds of targetWindow is not expectedBounds then error "Layout: tamanho inicial não persistido"
                set viewOptions to icon view options of targetWindow
                set expectedArrangement to not arranged
                if arrangement of viewOptions is not expectedArrangement then error "Layout: organização automática ativada"
                if icon size of viewOptions is not 72 then error "Layout: tamanho dos ícones incorreto"
                if text size of viewOptions is not 12 then error "Layout: tamanho dos nomes incorreto"
                if position of item "Remote Mouse.app" of volumeRoot is not {170, 240} then error "Layout: posição do app incorreta"
                if position of item "Applications" of volumeRoot is not {470, 240} then error "Layout: posição de Applications incorreta"
                set actualBackground to background picture of viewOptions as alias
                set expectedBackground to file "background.png" of folder ".background" of volumeRoot as alias
                if actualBackground is not expectedBackground then error "Layout: fundo não aponta para arquivo deste volume"
                close targetWindow
            on error errorMessage number errorNumber
                if targetWindow is not missing value then
                    try
                        close targetWindow
                    end try
                end if
                error errorMessage number errorNumber
            end try
        end tell
    end timeout
    return "OK"
end run
