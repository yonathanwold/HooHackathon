# AI LEGO Builder

Prompt + image to LDraw (.ldr) mosaic generator that opens in LeoCAD.

## Setup
1. Install dependencies:
   ```
   npm install
   ```
2. Set environment variables:
   - `GROQ_API_KEY`
   - `GROQ_VISION` (example: `meta-llama/llama-4-scout-17b-16e-instruct`)
   - `LEOCAD_PATH` (default: `C:\Program Files\LeoCAD\LeoCAD.exe`)
   - `LEOCAD_LIVE_AUTOMATION=1` (uses UI automation to open the model in LeoCAD)
   - `AUTOHOTKEY_PATH` (path to AutoHotkey.exe)
   - `LEOCAD_PARTS_DIR` (LeoCAD parts folder; used to scan the full parts catalog)

## Run
```
npm start
```

Open:
```
http://localhost:8080/ai/lego-builder
```

## Parts Catalog
Click "Scan Parts Library" once to load the full LeoCAD parts catalog.

## Live Build Controls
- `F8` pause/resume
- `F9` abort
