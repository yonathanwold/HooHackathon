; LeoCAD live placement calibration (AutoHotkey v2)
; Usage: AutoHotkey.exe calibrate.ahk <output_ini_path>

#Requires AutoHotkey v2.0
SendMode "Input"
SetWorkingDir A_ScriptDir

if (A_Args.Length < 1) {
  MsgBox "Missing output INI path.", "LeoCAD Calibration", "Iconx"
  ExitApp
}

iniPath := A_Args[1]

MsgBox "We will record key UI points in LeoCAD.`n`nOpen LeoCAD now, then click OK.", "LeoCAD Calibration", "Iconi"

WinActivate "LeoCAD"
WinWaitActive "LeoCAD", , 5

CoordMode "Mouse", "Screen"

MsgBox "Click INSIDE the Part value box (Piece section), then press F9.", "Step 1", "Iconi"
KeyWait "F9", "D"
MouseGetPos &pfx, &pfy
IniWrite pfx, iniPath, "Fields", "part_field_x"
IniWrite pfy, iniPath, "Fields", "part_field_y"

MsgBox "Click the Parts panel Search box (right-side Parts list), then press F9.", "Step 1a", "Iconi"
KeyWait "F9", "D"
MouseGetPos &psx, &psy
IniWrite psx, iniPath, "PartsPanel", "search_x"
IniWrite psy, iniPath, "PartsPanel", "search_y"

MsgBox "Click the first Part tile in the Parts panel list, then press F9.", "Step 1b", "Iconi"
KeyWait "F9", "D"
MouseGetPos &ptx, &pty
IniWrite ptx, iniPath, "PartsPanel", "tile_x"
IniWrite pty, iniPath, "PartsPanel", "tile_y"

MsgBox "Click the Parts dialog Filter input (opens after clicking Part). Press F9.", "Step 1b", "Iconi"
KeyWait "F9", "D"
MouseGetPos &pdx, &pdy
IniWrite pdx, iniPath, "PartsDialog", "filter_x"
IniWrite pdy, iniPath, "PartsDialog", "filter_y"

MsgBox "Click the first Part tile in the Parts dialog, then press F9.", "Step 1c", "Iconi"
KeyWait "F9", "D"
MouseGetPos &ptx, &pty
IniWrite ptx, iniPath, "PartsDialog", "tile_x"
IniWrite pty, iniPath, "PartsDialog", "tile_y"

MsgBox "Click the OK button in the Parts dialog, then press F9.", "Step 1d", "Iconi"
KeyWait "F9", "D"
MouseGetPos &pokx, &poky
IniWrite pokx, iniPath, "PartsDialog", "ok_x"
IniWrite poky, iniPath, "PartsDialog", "ok_y"

MsgBox "Click INSIDE the Color value box (Piece section), then press F9.", "Step 2", "Iconi"
KeyWait "F9", "D"
MouseGetPos &cfx, &cfy
IniWrite cfx, iniPath, "Fields", "color_x"
IniWrite cfy, iniPath, "Fields", "color_y"

MsgBox "Click INSIDE the Position X value box, then press F9.", "Step 3", "Iconi"
KeyWait "F9", "D"
MouseGetPos &xfx, &xfy
IniWrite xfx, iniPath, "Fields", "pos_x_x"
IniWrite xfy, iniPath, "Fields", "pos_x_y"

MsgBox "Click INSIDE the Position Y value box, then press F9.", "Step 4", "Iconi"
KeyWait "F9", "D"
MouseGetPos &yfx, &yfy
IniWrite yfx, iniPath, "Fields", "pos_y_x"
IniWrite yfy, iniPath, "Fields", "pos_y_y"

MsgBox "Click INSIDE the Position Z value box, then press F9.", "Step 5", "Iconi"
KeyWait "F9", "D"
MouseGetPos &zfx, &zfy
IniWrite zfx, iniPath, "Fields", "pos_z_x"
IniWrite zfy, iniPath, "Fields", "pos_z_y"

MsgBox "Click INSIDE the Rotation X value box, then press F9.", "Step 6", "Iconi"
KeyWait "F9", "D"
MouseGetPos &rxx, &rxy
IniWrite rxx, iniPath, "Fields", "rot_x_x"
IniWrite rxy, iniPath, "Fields", "rot_x_y"

MsgBox "Click INSIDE the Rotation Y value box, then press F9.", "Step 7", "Iconi"
KeyWait "F9", "D"
MouseGetPos &ryx, &ryy
IniWrite ryx, iniPath, "Fields", "rot_y_x"
IniWrite ryy, iniPath, "Fields", "rot_y_y"

MsgBox "Click INSIDE the Rotation Z value box, then press F9.", "Step 8", "Iconi"
KeyWait "F9", "D"
MouseGetPos &rzx, &rzy
IniWrite rzx, iniPath, "Fields", "rot_z_x"
IniWrite rzy, iniPath, "Fields", "rot_z_y"

choice := MsgBox("Teach the color palette now?`n`nColors in LeoCAD are picked by clicking squares (no typing).`nWe will record the exact square for each color.", "Color Teaching", "YesNo Iconi")
if (choice = "Yes") {
  colors := ["white","black","red","green","blue","yellow","light gray","dark gray","orange","brown","tan"]
  for index, colorName in colors {
    MsgBox "Open the color palette, click the '" colorName "' square, then press F9.", "Color " index, "Iconi"
    KeyWait "F9", "D"
    MouseGetPos &cx, &cy
    keyBase := StrReplace(StrLower(colorName), " ", "_")
    IniWrite cx, iniPath, "Colors", "color_" keyBase "_x"
    IniWrite cy, iniPath, "Colors", "color_" keyBase "_y"
  }
}

IniWrite 200, iniPath, "Delays", "insert_ms"
IniWrite 80, iniPath, "Delays", "type_ms"
IniWrite 150, iniPath, "Delays", "focus_ms"

MsgBox "Calibration saved.`n`nYou can now run Live Build.", "Done", "Iconi"
ExitApp
