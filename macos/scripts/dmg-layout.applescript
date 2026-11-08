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

-- Window item positions are not desktop positions. Always address the open
-- container window, and serialize every relevant option before any validation.
on pointText(pointValues)
    if pointValues is missing value then return "n/a"
    if (count of pointValues) is not 2 then error "Finder retornou posição sem duas coordenadas"
    return (item 1 of pointValues as text) & "," & (item 2 of pointValues as text)
end pointText

on flagText(flagValue)
    if flagValue then return "1"
    return "0"
end flagText

on arrangementName(arrangementValue)
    tell application "Finder"
        set arrangementValues to {not arranged, snap to grid, arranged by name, arranged by modification date, arranged by creation date, arranged by size, arranged by kind, arranged by label}
    end tell
    set arrangementNames to {"not arranged", "snap to grid", "arranged by name", "arranged by modification date", "arranged by creation date", "arranged by size", "arranged by kind", "arranged by label"}
    repeat with valueIndex from 1 to count of arrangementValues
        if arrangementValue is (item valueIndex of arrangementValues) then return item valueIndex of arrangementNames
    end repeat
    return "unknown Finder enum"
end arrangementName

on snapshotText(targetWindow, volumeRoot)
    tell application "Finder"
        set windowRectangle to (get bounds of targetWindow)
        set appPoint to (get position of item "Remote Mouse.app" of targetWindow)
        set applicationsPoint to (get position of item "Applications" of targetWindow)
        set opts to icon view options of targetWindow
        set iconViewFlag to ((get current view of targetWindow) is icon view)
        set arrangementValue to (get arrangement of opts)
        set expectedArrangement to not arranged
        set arrangementFlag to (arrangementValue is expectedArrangement)
        set arrangementText to my arrangementName(arrangementValue)
        set iconSizeValue to (get icon size of opts)
        set textSizeValue to (get text size of opts)
        set toolbarFlag to (get toolbar visible of targetWindow)
        set statusbarFlag to (get statusbar visible of targetWindow)
        set sidebarValue to (get sidebar width of targetWindow)
        set labelsFlag to ((get label position of opts) is bottom)
        set infoFlag to (get shows item info of opts)
        set backgroundFlag to false
        try
            set actualBackground to (get background picture of opts) as alias
            set expectedBackground to file "background.png" of folder ".background" of volumeRoot as alias
            set backgroundFlag to (actualBackground is expectedBackground)
        end try
    end tell
    set snapshot to "bounds=" & (my rectText(windowRectangle))
    set snapshot to snapshot & ";app=" & (my pointText(appPoint)) & ";applications=" & (my pointText(applicationsPoint))
    set snapshot to snapshot & ";view_icon=" & (my flagText(iconViewFlag)) & ";arrangement_none=" & (my flagText(arrangementFlag))
    set snapshot to snapshot & ";arrangement_text=" & arrangementText & ";icon_size=" & iconSizeValue & ";text_size=" & textSizeValue
    set snapshot to snapshot & ";toolbar=" & (my flagText(toolbarFlag)) & ";statusbar=" & (my flagText(statusbarFlag)) & ";sidebar=" & sidebarValue
    set snapshot to snapshot & ";labels_bottom=" & (my flagText(labelsFlag)) & ";item_info=" & (my flagText(infoFlag)) & ";background=" & (my flagText(backgroundFlag))
    return snapshot
end snapshotText

-- Compare the previous folder selector only for diagnostics. These optional
-- values never drive a write, verification, or the layout stability criterion.
on folderDiagnostics(volumeRoot)
    set folderAppPointText to "n/a"
    set folderApplicationsPointText to "n/a"
    tell application "Finder"
        try
            set folderPointValues to (get position of item "Remote Mouse.app" of volumeRoot)
            set folderAppPointText to my pointText(folderPointValues)
        end try
        try
            set folderPointValues to (get position of item "Applications" of volumeRoot)
            set folderApplicationsPointText to my pointText(folderPointValues)
        end try
    end tell
    return ";folder_app=" & folderAppPointText & ";folder_applications=" & folderApplicationsPointText
end folderDiagnostics

on stableSnapshot(targetWindow, volumeRoot)
    set lastSnapshot to "n/a"
    set consecutive to 0
    repeat 25 times
        set currentSnapshot to my snapshotText(targetWindow, volumeRoot)
        if currentSnapshot is lastSnapshot then
            set consecutive to consecutive + 1
        else
            set consecutive to 0
        end if
        set lastSnapshot to currentSnapshot
        if consecutive is 3 then return currentSnapshot & (my folderDiagnostics(volumeRoot))
        delay 0.2
    end repeat
    error ("Layout não estabilizou em até 25 leituras; último=" & lastSnapshot)
end stableSnapshot

on run argv
    if (count of argv) is not 2 then error "Uso: dmg-layout.applescript configure|verify mountpoint"
    set layoutMode to item 1 of argv
    set mountPath to item 2 of argv
    if layoutMode is not "configure" and layoutMode is not "verify" then error "Modo de layout inválido"
    set expectedBounds to {120, 120, 760, 622}
    set targetWindow to missing value
    set afterSet to "n/a"
    set afterReopen to "n/a"
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
                    set currentPhase to "configure:geometry"
                    set bounds of targetWindow to expectedBounds
                    my stableBounds(targetWindow)
                    -- Geometry first; both icons use the same concrete window context.
                    -- Never write desktop position or target the Applications destination.
                    set currentPhase to "configure:icons"
                    set position of item "Remote Mouse.app" of targetWindow to {170, 240}
                    set position of item "Applications" of targetWindow to {470, 240}
                    update volumeRoot without registering applications
                    set currentPhase to "configure:after-set"
                    set afterSet to my stableSnapshot(targetWindow, volumeRoot)
                    close targetWindow
                    delay 1
                    set currentPhase to "configure:reopen"
                    open volumeRoot
                    set targetWindow to container window of volumeRoot
                end if
                set currentPhase to layoutMode & ":after-reopen"
                set afterReopen to my stableSnapshot(targetWindow, volumeRoot)
                close targetWindow
            on error errorMessage number errorNumber
                if targetWindow is not missing value then
                    try
                        close targetWindow
                    end try
                end if
                error ("Finder[" & currentPhase & "] pedido bounds={120,120,760,622}, app={170,240}, Applications={470,240}; após definir=" & afterSet & "; após reabrir=" & afterReopen & "; " & errorMessage) number errorNumber
            end try
        end tell
    end timeout
    -- v2 includes full snapshots; Python aggregates ALL mismatches in one error.
    return "OK" & tab & "v2" & tab & layoutMode & tab & afterSet & tab & afterReopen
end run
