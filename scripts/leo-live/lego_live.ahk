; LeoCAD live brick-by-brick placement (AutoHotkey v2)
; Usage: AutoHotkey.exe lego_live.ahk <placements_csv> <coords_ini> <speed_multiplier>

#Requires AutoHotkey v2.0
SendMode "Input"
SetWorkingDir A_ScriptDir

if (A_Args.Length < 2) {
  MsgBox "Missing arguments.", "LeoCAD Live", "Iconx"
  ExitApp
}

csvPath := A_Args[1]
iniPath := A_Args[2]
speedArg := A_Args.Length >= 3 ? A_Args[3] : "1"
startupDelayArg := A_Args.Length >= 4 ? A_Args[4] : "0"
if (speedArg = "")
  speedArg := "1"
speed := speedArg + 0
if (speed <= 0)
  speed := 1
startupDelay := startupDelayArg + 0
if (startupDelay < 0)
  startupDelay := 0

partFieldX := IniRead(iniPath, "Fields", "part_field_x")
partFieldY := IniRead(iniPath, "Fields", "part_field_y")
partFilterX := IniRead(iniPath, "PartsDialog", "filter_x")
partFilterY := IniRead(iniPath, "PartsDialog", "filter_y")
partTileX := IniRead(iniPath, "PartsDialog", "tile_x")
partTileY := IniRead(iniPath, "PartsDialog", "tile_y")
partOkX := IniRead(iniPath, "PartsDialog", "ok_x")
partOkY := IniRead(iniPath, "PartsDialog", "ok_y")
panelSearchX := IniRead(iniPath, "PartsPanel", "search_x", "")
panelSearchY := IniRead(iniPath, "PartsPanel", "search_y", "")
panelTileX := IniRead(iniPath, "PartsPanel", "tile_x", "")
panelTileY := IniRead(iniPath, "PartsPanel", "tile_y", "")
posXX := IniRead(iniPath, "Fields", "pos_x_x")
posXY := IniRead(iniPath, "Fields", "pos_x_y")
posYX := IniRead(iniPath, "Fields", "pos_y_x")
posYY := IniRead(iniPath, "Fields", "pos_y_y")
posZX := IniRead(iniPath, "Fields", "pos_z_x")
posZY := IniRead(iniPath, "Fields", "pos_z_y")
rotXX := IniRead(iniPath, "Fields", "rot_x_x")
rotXY := IniRead(iniPath, "Fields", "rot_x_y")
rotYX := IniRead(iniPath, "Fields", "rot_y_x")
rotYY := IniRead(iniPath, "Fields", "rot_y_y")
rotZX := IniRead(iniPath, "Fields", "rot_z_x")
rotZY := IniRead(iniPath, "Fields", "rot_z_y")
colorX := IniRead(iniPath, "Fields", "color_x")
colorY := IniRead(iniPath, "Fields", "color_y")

missing := []
if (partFieldX = "")
  missing.Push("Fields.part_field_x")
if (partFieldY = "")
  missing.Push("Fields.part_field_y")
if (posXX = "")
  missing.Push("Fields.pos_x_x")
if (posXY = "")
  missing.Push("Fields.pos_x_y")
if (posYX = "")
  missing.Push("Fields.pos_y_x")
if (posYY = "")
  missing.Push("Fields.pos_y_y")
if (posZX = "")
  missing.Push("Fields.pos_z_x")
if (posZY = "")
  missing.Push("Fields.pos_z_y")
if (rotXX = "")
  missing.Push("Fields.rot_x_x")
if (rotXY = "")
  missing.Push("Fields.rot_x_y")
if (rotYX = "")
  missing.Push("Fields.rot_y_x")
if (rotYY = "")
  missing.Push("Fields.rot_y_y")
if (rotZX = "")
  missing.Push("Fields.rot_z_x")
if (rotZY = "")
  missing.Push("Fields.rot_z_y")
if (colorX = "")
  missing.Push("Fields.color_x")
if (colorY = "")
  missing.Push("Fields.color_y")

hasPartsPanel := (panelSearchX != "" && panelSearchY != "" && panelTileX != "" && panelTileY != "")
hasPartsDialog := (partFilterX != "" && partFilterY != "" && partTileX != "" && partTileY != "" && partOkX != "" && partOkY != "")
if (!hasPartsPanel && !hasPartsDialog)
  missing.Push("PartsPanel.* or PartsDialog.*")

if (missing.Length > 0) {
  msg := "Calibration incomplete. Missing:"
  for index, key in missing {
    msg .= "`n" . key
  }
  MsgBox msg, "LeoCAD Live", "Iconx"
  ExitApp
}

insertMsRaw := IniRead(iniPath, "Delays", "insert_ms", 200)
typeMsRaw := IniRead(iniPath, "Delays", "type_ms", 80)
focusMsRaw := IniRead(iniPath, "Delays", "focus_ms", 150)

insertMs := Round(insertMsRaw / speed)
typeMs := Round(typeMsRaw / speed)
focusMs := Round(focusMsRaw / speed)

global gPaused := false

F8:: {
  global gPaused
  gPaused := !gPaused
}

F9:: {
  MsgBox "Live build aborted.", "LeoCAD Live", "Icon!"
  ExitApp
}

WinActivate "ahk_exe LeoCAD.exe"
if (!WinWaitActive("ahk_exe LeoCAD.exe", , 15)) {
  MsgBox "LeoCAD is not the active window. Bring LeoCAD to the front and try again.", "LeoCAD Live", "Iconx"
  ExitApp
}
Sleep startupDelay

currentPartQuery := ""

checkPause() {
  global gPaused
  while (gPaused) {
    Sleep 200
  }
}

normalizeColor(name) {
  lower := StrLower(name)
  return StrReplace(lower, " ", "_")
}

selectPart(partQuery, panelSearchX, panelSearchY, panelTileX, panelTileY, partFieldX, partFieldY, partFilterX, partFilterY, partTileX, partTileY, partOkX, partOkY, focusMs, typeMs) {
  ; Always use the Parts dialog for reliability.
  Send "{Esc}"
  Sleep focusMs
  ; Double-click the Part value box to ensure the dialog opens.
  MouseClick "left", partFieldX, partFieldY, 2
  Sleep (focusMs + 100)
  MouseClick "left", partFilterX, partFilterY
  Sleep focusMs
  Send "^a"
  Send "{Backspace}"
  SendText partQuery
  Sleep typeMs
  Send "{Enter}"
  Sleep (focusMs + 50)
  MouseClick "left", partTileX, partTileY
  Sleep focusMs
  MouseClick "left", partOkX, partOkY
  Sleep focusMs
}

tryPickColor(colorName, colorFieldX, colorFieldY, focusMs, typeMs, iniPath) {
  norm := normalizeColor(colorName)
  keyX := "color_" norm "_x"
  keyY := "color_" norm "_y"
  coordX := IniRead(iniPath, "Colors", keyX, "")
  coordY := IniRead(iniPath, "Colors", keyY, "")

  MouseClick "left", colorFieldX, colorFieldY
  Sleep focusMs

  if (coordX != "" && coordY != "") {
    MouseClick "left", coordX, coordY
    Sleep focusMs
    return true
  }
  return false
}

Loop Read, csvPath
{
  if (A_Index = 1)
    continue

  line := A_LoopReadLine
  parts := StrSplit(line, ",")
  if (parts.Length < 8)
    continue

  partQuery := StrReplace(parts[1], ".dat", "")
  colorName := parts[2]
  xVal := parts[3]
  yVal := parts[4]
  zVal := parts[5]
  rxVal := parts[6]
  ryVal := parts[7]
  rzVal := parts[8]

  checkPause()

  ; Force part selection every time to avoid getting stuck on a single part.
  selectPart(partQuery, panelSearchX, panelSearchY, panelTileX, panelTileY, partFieldX, partFieldY, partFilterX, partFilterY, partTileX, partTileY, partOkX, partOkY, focusMs, typeMs)
  currentPartQuery := partQuery

  colorPicked := tryPickColor(colorName, colorX, colorY, focusMs, typeMs, iniPath)

  Send "{Insert}"
  Sleep insertMs

  MouseClick "left", posXX, posXY
  Sleep focusMs
  Send "^a"
  SendText xVal
  Send "{Enter}"
  Sleep typeMs

  MouseClick "left", posYX, posYY
  Sleep focusMs
  Send "^a"
  SendText yVal
  Send "{Enter}"
  Sleep typeMs

  MouseClick "left", posZX, posZY
  Sleep focusMs
  Send "^a"
  SendText zVal
  Send "{Enter}"
  Sleep typeMs

  MouseClick "left", rotXX, rotXY
  Sleep focusMs
  Send "^a"
  SendText rxVal
  Send "{Enter}"
  Sleep typeMs

  MouseClick "left", rotYX, rotYY
  Sleep focusMs
  Send "^a"
  SendText ryVal
  Send "{Enter}"
  Sleep typeMs

  MouseClick "left", rotZX, rotZY
  Sleep focusMs
  Send "^a"
  SendText rzVal
  Send "{Enter}"
  Sleep typeMs

  if (!colorPicked) {
    tryPickColor(colorName, colorX, colorY, focusMs, typeMs, iniPath)
  }
  Sleep insertMs
}

MsgBox "Live build complete.", "LeoCAD Live", "Iconi"
ExitApp
