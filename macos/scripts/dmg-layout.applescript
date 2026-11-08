-- Finder dictionary only: no System Events, UI clicking or global Finder defaults.
-- Paths arrive as arguments, never interpolated into AppleScript source.
-- Read primitive values outside Finder's terminology scope. Stability is bounded,
-- not a tolerance for wrong dimensions and not an automatic geometry correction.
on rectText(rectValues)
    if rectValues is missing value then return "n/a"
    if (count of rectValues) is not 4 then error "Finder retornou bounds sem quatro coordenadas"
    return (item 1 of rectValues as text) & "," & (item 2 of rectValues as text) & "," & (item 3 of rectValues as text) & "," & (item 4 of rectValues as text)
end rectText

on stableBounds(targetWindow)
    set lastRectangle to missing value
    set consecutive to 0
    repeat 25 times
        tell application "Finder" to set currentRectangle to (get bounds of targetWindow)
        if (my rectText(currentRectangle)) is (my rectText(lastRectangle)) then
            set consecutive to consecutive + 1
        else
            set consecutive to 0
        end if
        set lastRectangle to currentRectangle
        if consecutive is 3 then return currentRectangle
        delay 0.2
    end repeat
    error ("Bounds não estabilizaram em até 25 leituras; último={" & (my rectText(lastRectangle)) & "}")
end stableBounds

on run argv
    if (count of argv) is not 2 then error "Uso: dmg-layout.applescript configure|verify mountpoint"
    set layoutMode to item 1 of argv
    set mountPath to item 2 of argv
    if layoutMode is not "configure" and layoutMode is not "verify" then error "Modo de layout inválido"
    set expectedBounds to {120, 120, 760, 622}
    set targetWindow to missing value
    set afterSet to missing value
    set afterReopen to missing value
    set currentPhase to layoutMode & ":open"
    with timeout of 60 seconds
        tell application "Finder"
            try
                set volumeRoot to folder ((POSIX file mountPath) as alias)
                open volumeRoot
                set targetWindow to container window of volumeRoot
                if layoutMode is "configure" then
                    set currentPhase to "configure:options"
                    set current view of targetWindow to icon view
                    set toolbar visible of targetWindow to false
                    set statusbar visible of targetWindow to false
                    set sidebar width of targetWindow to 0
                    set viewOptions to icon view options of targetWindow
                    set arrangement of viewOptions to not arranged
                    set icon size of viewOptions to 72
                    set text size of viewOptions to 12
                    set label position of viewOptions to bottom
                    set shows item info of viewOptions to false
                    set background picture of viewOptions to file "background.png" of folder ".background" of volumeRoot
                    set position of item "Remote Mouse.app" of volumeRoot to {170, 240}
                    set position of item "Applications" of volumeRoot to {470, 240}
                    -- Apply once after view/chrome changes. Do not leave an intermediate
                    -- shrunken rectangle racing Finder's asynchronous persistence.
                    set currentPhase to "configure:after-set"
                    set bounds of targetWindow to expectedBounds
                    set afterSet to my stableBounds(targetWindow)
                    update volumeRoot without registering applications
                    close targetWindow
                    delay 1
                    set currentPhase to "configure:reopen"
                    open volumeRoot
                    set targetWindow to container window of volumeRoot
                end if

                set currentPhase to layoutMode & ":after-reopen"
                set afterReopen to my stableBounds(targetWindow)
                -- Size vs screen origin is validated separately by Python from these
                -- concrete readbacks. All non-geometry checks remain strict here.
                if current view of targetWindow is not icon view then error "Layout: visualização não é por ícones"
                if toolbar visible of targetWindow then error "Layout: barra de ferramentas visível"
                if statusbar visible of targetWindow then error "Layout: barra de status visível"
                if sidebar width of targetWindow is not 0 then error "Layout: barra lateral visível"
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
                error ("Finder[" & currentPhase & "] pedido={120,120,760,622}; após definir={" & (my rectText(afterSet)) & "}; após reabrir={" & (my rectText(afterReopen)) & "}; " & errorMessage) number errorNumber
            end try
        end tell
    end timeout
    return "OK" & tab & layoutMode & tab & (my rectText(afterSet)) & tab & (my rectText(afterReopen))
end run
