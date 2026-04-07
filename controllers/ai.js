const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const multer = require('multer');

const LEGO_OUTPUT_DIR = path.join(__dirname, '../public/lego');
const LEGO_LIVE_DIR = path.join(__dirname, '../scripts/leo-live');
const LEGO_PARTS_CATALOG = path.join(LEGO_LIVE_DIR, 'parts_catalog.json');
const LEGO_PROFILE_DIR = path.join(LEGO_LIVE_DIR, 'profiles');
const DEFAULT_LEGO_SIZE = 32;
const MIN_LEGO_SIZE = 8;
const MAX_LEGO_SIZE = 64;

const legoColorPalette = [
  { id: 15, name: 'white', rgb: [242, 243, 242] },
  { id: 0, name: 'black', rgb: [27, 42, 52] },
  { id: 4, name: 'red', rgb: [196, 40, 27] },
  { id: 2, name: 'green', rgb: [0, 143, 54] },
  { id: 1, name: 'blue', rgb: [13, 105, 171] },
  { id: 14, name: 'yellow', rgb: [245, 205, 47] },
  { id: 7, name: 'light_gray', rgb: [161, 165, 162] },
  { id: 8, name: 'dark_gray', rgb: [99, 95, 98] },
  { id: 25, name: 'orange', rgb: [218, 133, 65] },
  { id: 6, name: 'brown', rgb: [106, 57, 9] },
  { id: 19, name: 'tan', rgb: [215, 197, 153] },
];

const defaultBrickCatalog = [
  { part: '3001.dat', name: 'brick 2x4', w: 4, h: 2 },
  { part: '3003.dat', name: 'brick 2x2', w: 2, h: 2 },
  { part: '3010.dat', name: 'brick 1x4', w: 4, h: 1 },
  { part: '3622.dat', name: 'brick 1x3', w: 3, h: 1 },
  { part: '3004.dat', name: 'brick 1x2', w: 2, h: 1 },
  { part: '3005.dat', name: 'brick 1x1', w: 1, h: 1 },
];

let cachedBrickCatalog = null;

const detectPartsDir = () => {
  const configured = process.env.LEOCAD_PARTS_DIR;
  if (configured && fs.existsSync(configured)) return configured;
  const candidates = [
    'C:\\Users\\Public\\Documents\\LeoCAD\\parts',
    'C:\\Program Files\\LeoCAD\\parts',
    'C:\\Program Files (x86)\\LeoCAD\\parts',
    'C:\\Users\\Public\\Documents\\LDraw\\parts',
    'C:\\LDraw\\parts',
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const parsePartSizeFromName = (name) => {
  if (!name) return null;
  const lower = name.toLowerCase();
  const typeMatch = lower.match(/\b(brick|plate|tile)\b/);
  if (!typeMatch) return null;
  const sizeMatch = lower.match(/(\d+)\s*x\s*(\d+)/);
  if (!sizeMatch) return null;
  const w = parseInt(sizeMatch[1], 10);
  const h = parseInt(sizeMatch[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h, type: typeMatch[1] };
};

const loadPartsCatalog = () => {
  if (cachedBrickCatalog) return cachedBrickCatalog;
  if (fs.existsSync(LEGO_PARTS_CATALOG)) {
    try {
      const data = JSON.parse(fs.readFileSync(LEGO_PARTS_CATALOG, 'utf8'));
      if (Array.isArray(data) && data.length) {
        cachedBrickCatalog = data;
        return cachedBrickCatalog;
      }
    } catch (err) {
      console.warn('Failed to read parts catalog. Falling back to defaults.');
    }
  }
  cachedBrickCatalog = defaultBrickCatalog;
  return cachedBrickCatalog;
};

const scanPartsLibrary = () => {
  ensureLegoLiveDir();
  const partsDir = detectPartsDir();
  if (!partsDir) {
    throw new Error('LeoCAD parts folder not found. Set LEOCAD_PARTS_DIR.');
  }

  const entries = fs.readdirSync(partsDir).filter((file) => file.toLowerCase().endsWith('.dat'));
  const catalog = [];

  entries.forEach((file) => {
    const fullPath = path.join(partsDir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/).slice(0, 40);
      const nameLine = lines.find((line) => line.startsWith('0 Name:')) || '';
      const rawName = nameLine.replace('0 Name:', '').trim() || '';
      const descLine = lines.find((line) => line.startsWith('0 ') && !line.startsWith('0 Name:')) || '';
      const descName = descLine.replace(/^0\s+/, '').trim();
      const name = rawName && rawName !== file ? rawName : (descName || file);
      const sizeInfo = parsePartSizeFromName(descName) || parsePartSizeFromName(name);
      if (!sizeInfo) return;
      catalog.push({
        part: file,
        name,
        w: sizeInfo.w,
        h: sizeInfo.h,
        type: sizeInfo.type,
      });
    } catch (err) {
      // ignore unreadable parts
    }
  });

  if (!catalog.length) {
    throw new Error('No parsable bricks found in parts library.');
  }

  catalog.sort((a, b) => {
    const areaDiff = b.w * b.h - a.w * a.h;
    if (areaDiff !== 0) return areaDiff;
    return a.name.localeCompare(b.name);
  });

  fs.writeFileSync(LEGO_PARTS_CATALOG, JSON.stringify(catalog, null, 2), 'utf8');
  cachedBrickCatalog = catalog;
  return { count: catalog.length, partsDir };
};

const ensureLegoOutputDir = () => {
  if (!fs.existsSync(LEGO_OUTPUT_DIR)) {
    fs.mkdirSync(LEGO_OUTPUT_DIR, { recursive: true });
  }
};

const ensureLegoLiveDir = () => {
  if (!fs.existsSync(LEGO_LIVE_DIR)) {
    fs.mkdirSync(LEGO_LIVE_DIR, { recursive: true });
  }
};

const ensureProfileDir = () => {
  ensureLegoLiveDir();
  if (!fs.existsSync(LEGO_PROFILE_DIR)) {
    fs.mkdirSync(LEGO_PROFILE_DIR, { recursive: true });
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const extractSizeFromText = (text) => {
  if (!text) return null;
  const match = text.match(/(\d{1,3})\s*[xX]\s*(\d{1,3})/);
  if (match) {
    return {
      width: clamp(parseInt(match[1], 10), MIN_LEGO_SIZE, MAX_LEGO_SIZE),
      height: clamp(parseInt(match[2], 10), MIN_LEGO_SIZE, MAX_LEGO_SIZE),
    };
  }
  const widthMatch = text.match(/width\s*(\d{1,3})/i);
  const heightMatch = text.match(/height\s*(\d{1,3})/i);
  if (widthMatch && heightMatch) {
    return {
      width: clamp(parseInt(widthMatch[1], 10), MIN_LEGO_SIZE, MAX_LEGO_SIZE),
      height: clamp(parseInt(heightMatch[1], 10), MIN_LEGO_SIZE, MAX_LEGO_SIZE),
    };
  }
  return null;
};

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const colorDistance = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const normalizeColorName = (value) => {
  if (!value) return '';
  return value.toString().trim().toLowerCase().replace(/\s+/g, '_');
};

const normalizePartQuery = (value) => {
  if (!value) return '';
  return value.toString().trim().replace(/\.dat$/i, '');
};

const mapColorToLdrawId = (value) => {
  if (!value) return legoColorPalette[0].id;
  const normalized = normalizeColorName(value);
  const direct = legoColorPalette.find((entry) => entry.name === normalized);
  if (direct) return direct.id;

  if (normalized.startsWith('#')) {
    const rgb = hexToRgb(normalized);
    if (rgb) {
      let closest = legoColorPalette[0];
      let best = Number.POSITIVE_INFINITY;
      legoColorPalette.forEach((entry) => {
        const dist = colorDistance(rgb, entry.rgb);
        if (dist < best) {
          best = dist;
          closest = entry;
        }
      });
      return closest.id;
    }
  }

  const fallback = legoColorPalette.find((entry) => normalized.includes(entry.name));
  return fallback ? fallback.id : legoColorPalette[0].id;
};

const normalizeGrid = (grid, width, height, defaultColor = 'white') => {
  const result = [];
  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    const rowRaw = grid[rowIndex] ?? [];
    let row = rowRaw;
    if (typeof rowRaw === 'string') {
      row = rowRaw.split(/[\s,]+/).filter(Boolean);
    }
    if (!Array.isArray(row)) {
      row = [];
    }
    const normalizedRow = [];
    for (let colIndex = 0; colIndex < width; colIndex++) {
      normalizedRow.push(row[colIndex] ?? defaultColor);
    }
    result.push(normalizedRow);
  }
  return result;
};

const createLegoVisionPrompt = (promptText, width, height) =>
  `Prompt: ${promptText || 'No prompt provided.'}\n` +
  `Desired size: ${width}x${height}\n\n` +
  'Output JSON only using this schema:\n' +
  '{\n  "width": number,\n  "height": number,\n  "palette": ["red","white",...],\n  "grid": [ ["red","white",...], ... ]\n}\n' +
  'Rules:\n' +
  '- Use only basic color names from this list: white, black, red, green, blue, yellow, light_gray, dark_gray, orange, brown, tan.\n' +
  '- Keep width/height exactly as requested.\n' +
  '- grid must be height rows, each with width entries.\n' +
  '- Do not include any extra text.';

const parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    return { mimeType: 'image/png', data: '' };
  }
  return { mimeType: match[1], data: match[2] };
};

const createGeminiContents = (dataUrl, promptText, width, height) => {
  const { mimeType, data } = parseDataUrl(dataUrl);
  return [
    {
      role: 'user',
      parts: [
        { text: createLegoVisionPrompt(promptText, width, height) },
        { inlineData: { mimeType, data } },
      ],
    },
  ];
};

const createGeminiContentsTextOnly = (promptText, width, height) => [
  {
    role: 'user',
    parts: [{ text: createLegoVisionPrompt(promptText, width, height) }],
  },
];

const extractJsonFromContent = (content) => {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    console.error('Failed to parse JSON from LEGO vision response:', err);
    return null;
  }
};

const fallbackLegoSpec = (width, height) => {
  const grid = [];
  for (let row = 0; row < height; row++) {
    const rowColors = [];
    for (let col = 0; col < width; col++) {
      const isEven = (row + col) % 2 === 0;
      rowColors.push(isEven ? 'red' : 'white');
    }
    grid.push(rowColors);
  }
  return {
    width,
    height,
    palette: ['red', 'white'],
    grid,
  };
};

const randomLegoSpec = (width, height) => {
  const palette = ['red', 'white', 'blue', 'yellow', 'black', 'green'];
  const grid = [];
  for (let row = 0; row < height; row++) {
    const rowColors = [];
    for (let col = 0; col < width; col++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      rowColors.push(color);
    }
    grid.push(rowColors);
  }
  return {
    width,
    height,
    palette,
    grid,
  };
};

const BRICK_HEIGHT = 24;
const STUD = 20;

const buildTreeDemoPlacements = () => {
  const placements = [];
  const trunkHeight = 6;
  const trunkPart = { part: '3004.dat', name: 'Brick 1 x 2' };
  const leafPart = { part: '3011.dat', name: 'Brick 4 x 4' };
  const leafSmall = { part: '3003.dat', name: 'Brick 2 x 2' };

  for (let level = 0; level < trunkHeight; level++) {
    placements.push({
      part: trunkPart.part,
      partName: trunkPart.name,
      partQuery: trunkPart.part.replace('.dat', ''),
      colorName: 'brown',
      x: 0,
      y: level * BRICK_HEIGHT,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    });
  }

  const canopyY = trunkHeight * BRICK_HEIGHT;
  placements.push({
    part: leafPart.part,
    partName: leafPart.name,
    partQuery: leafPart.part.replace('.dat', ''),
    colorName: 'green',
    x: 0,
    y: canopyY,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
  });

  const offsets = [-STUD * 2, 0, STUD * 2];
  offsets.forEach((dx) => {
    offsets.forEach((dz) => {
      if (dx === 0 && dz === 0) return;
      placements.push({
        part: leafSmall.part,
        partName: leafSmall.name,
        partQuery: leafSmall.part.replace('.dat', ''),
        colorName: 'green',
        x: dx,
        y: canopyY + BRICK_HEIGHT,
        z: dz,
        rx: 0,
        ry: 0,
        rz: 0,
      });
    });
  });

  return placements;
};

const buildStackDemoPlacements = (count = 5, color = 'blue', part = '3005.dat') => {
  const placements = [];
  const safeCount = Math.max(1, Math.min(50, Number.parseInt(count, 10) || 5));
  for (let i = 0; i < safeCount; i++) {
    placements.push({
      part,
      partName: 'Brick 1 x 1',
      partQuery: part.replace('.dat', ''),
      colorName: color,
      x: 0,
      y: i * BRICK_HEIGHT,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
    });
  }
  return placements;
};

const buildLdrawFromPlacements = (placements) => {
  const lines = [];
  const colorUsage = {};
  lines.push('0 LEGO Model generated by AI LEGO Builder');
  lines.push('0 Name: ai-lego-build');
  lines.push('0 Author: hackathon-starter');
  lines.push('0 !LDRAW_ORG Unofficial_Model');
  lines.push('0 !LEOCAD MODEL NAME AI LEGO Builder');
  lines.push('0 !LEOCAD MODEL AUTHOR AI LEGO Builder');
  lines.push('0 !LEOCAD MODEL DESCRIPTION Generated placements');

  placements.forEach((placement) => {
    const colorId = mapColorToLdrawId(placement.colorName);
    colorUsage[colorId] = (colorUsage[colorId] || 0) + 1;
    lines.push(`1 ${colorId} ${placement.x} ${placement.y} ${placement.z} 1 0 0 0 1 0 0 0 1 ${placement.part}`);
    lines.push('0 STEP');
  });

  return {
    text: `${lines.join('\n')}\n`,
    colorUsage,
    placements,
  };
};

const buildLdrawFromMpd = (mpdPath, targetModelName) => {
  const content = fs.readFileSync(mpdPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const targetHeader = `0 FILE ${targetModelName}`;
  let inTarget = false;
  const output = [];
  for (const line of lines) {
    if (line.startsWith('0 FILE ')) {
      inTarget = line.trim() === targetHeader;
      if (inTarget) {
        output.push(line);
      }
      continue;
    }
    if (inTarget) {
      output.push(line);
    }
  }
  if (!output.length) {
    throw new Error('Target model not found in MPD.');
  }
  return `${output.join('\n')}\n`;
};

const ldrawColorIdToName = (id) => {
  const map = {
    0: 'black',
    1: 'blue',
    2: 'green',
    4: 'red',
    6: 'brown',
    7: 'light gray',
    8: 'dark gray',
    14: 'yellow',
    15: 'white',
    19: 'tan',
    25: 'orange',
    43: 'trans light blue',
    256: 'main color',
  };
  return map[id] || 'white';
};

const deg = (rad) => (rad * 180) / Math.PI;

const clampUnit = (value) => Math.max(-1, Math.min(1, value));

// Convert rotation matrix to Euler angles (XYZ order) in degrees.
const rotationMatrixToEulerXYZ = (m) => {
  const r00 = m[0][0];
  const r01 = m[0][1];
  const r02 = m[0][2];
  const r10 = m[1][0];
  const r11 = m[1][1];
  const r12 = m[1][2];
  const r20 = m[2][0];
  const r21 = m[2][1];
  const r22 = m[2][2];

  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  let x;
  let y;
  let z;

  if (sy > 1e-6) {
    x = Math.atan2(r21, r22);
    y = Math.atan2(-r20, sy);
    z = Math.atan2(r10, r00);
  } else {
    x = Math.atan2(-r12, r11);
    y = Math.atan2(-r20, sy);
    z = 0;
  }

  return {
    x: deg(x),
    y: deg(y),
    z: deg(z),
  };
};

const multiplyMatrix = (a, b) => {
  const out = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return out;
};

const applyMatrixToVector = (m, v) => ({
  x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
  y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
  z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
});

const axisMapMatrix = (axisUp) => {
  if (axisUp === 'Z') {
    // Rotate -90 deg around X: Y->Z, Z->-Y
    const c = Math.cos(-Math.PI / 2);
    const s = Math.sin(-Math.PI / 2);
    return [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c],
    ];
  }
  if (axisUp === 'X') {
    // Rotate +90 deg around Z: X<-Y, Y->X
    const c = Math.cos(Math.PI / 2);
    const s = Math.sin(Math.PI / 2);
    return [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1],
    ];
  }
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
};

const parseMpdToPlacements = (mpdPath, targetModelName, axisUp = 'Y') => {
  const content = fs.readFileSync(mpdPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const targetHeader = `0 FILE ${targetModelName}`;
  let inTarget = false;
  const placements = [];
  const axisMatrix = axisMapMatrix(axisUp);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('0 FILE ')) {
      inTarget = line === targetHeader;
      continue;
    }
    if (!inTarget) continue;
    if (!line.startsWith('1 ')) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 15) continue;

    const colorId = parseInt(parts[1], 10);
    const x = parseFloat(parts[2]);
    const y = parseFloat(parts[3]);
    const z = parseFloat(parts[4]);
    const m = [
      [parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7])],
      [parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10])],
      [parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13])],
    ];
    const partFile = parts[14];

    const posMapped = applyMatrixToVector(axisMatrix, { x, y, z });
    const rotMapped = multiplyMatrix(axisMatrix, m);
    const euler = rotationMatrixToEulerXYZ(rotMapped);

    placements.push({
      part: partFile,
      partName: partFile.replace('.dat', '').replace(/_/g, ' '),
      partQuery: partFile.replace('.dat', ''),
      colorName: ldrawColorIdToName(colorId),
      x: posMapped.x,
      y: posMapped.y,
      z: posMapped.z,
      rx: euler.x,
      ry: euler.y,
      rz: euler.z,
    });
  }

  return placements;
};

const buildLdrawFromGrid = (grid, width, height) => {
  const lines = [];
  const stud = 20;
  const offsetX = -((width - 1) * stud) / 2;
  const offsetZ = -((height - 1) * stud) / 2;
  const colorUsage = {};
  const placements = [];
  const occupied = Array.from({ length: height }, () => Array(width).fill(false));
  const brickCatalog = loadPartsCatalog();

  lines.push('0 LEGO Mosaic generated by AI LEGO Builder');
  lines.push('0 Name: ai-lego-build');
  lines.push('0 Author: hackathon-starter');
  lines.push('0 !LDRAW_ORG Unofficial_Model');
  lines.push('0 !LEOCAD MODEL NAME AI LEGO Builder');
  lines.push('0 !LEOCAD MODEL AUTHOR AI LEGO Builder');
  lines.push('0 !LEOCAD MODEL DESCRIPTION Generated mosaic');

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (occupied[row][col]) continue;
      const colorName = grid[row][col];
      const normalizedColor = normalizeColorName(colorName);
      const colorId = mapColorToLdrawId(colorName);

      let placed = false;
      for (const brick of brickCatalog) {
        const fitsWidth = col + brick.w <= width;
        const fitsHeight = row + brick.h <= height;
        if (!fitsWidth || !fitsHeight) continue;

        let canPlace = true;
        for (let r = row; r < row + brick.h; r++) {
          for (let c = col; c < col + brick.w; c++) {
            if (occupied[r][c] || normalizeColorName(grid[r][c]) !== normalizedColor) {
              canPlace = false;
              break;
            }
          }
          if (!canPlace) break;
        }

        if (!canPlace) continue;

        for (let r = row; r < row + brick.h; r++) {
          for (let c = col; c < col + brick.w; c++) {
            occupied[r][c] = true;
          }
        }

        const centerX = offsetX + (col + (brick.w - 1) / 2) * stud;
        const centerZ = offsetZ + (row + (brick.h - 1) / 2) * stud;
        const y = 0;

        lines.push(`1 ${colorId} ${centerX} ${y} ${centerZ} 1 0 0 0 1 0 0 0 1 ${brick.part}`);
        lines.push('0 STEP');
        placements.push({
          part: brick.part,
          partName: brick.name,
          partQuery: brick.part.replace('.dat', ''),
          colorName: normalizedColor.replace(/_/g, ' '),
          x: centerX,
          y,
          z: centerZ,
          rx: 0,
          ry: 0,
          rz: 0,
        });
        colorUsage[colorId] = (colorUsage[colorId] || 0) + 1;
        placed = true;
        break;
      }

      if (!placed) {
        occupied[row][col] = true;
      }
    }
  }

  return {
    text: `${lines.join('\n')}\n`,
    colorUsage,
    placements,
  };
};

const openInLeoCad = (filePath) => {
  const leoCadPath = process.env.LEOCAD_PATH || 'C:\\Program Files\\LeoCAD\\LeoCAD.exe';
  const libPath = process.env.LEOCAD_PARTS_DIR;
  if (!fs.existsSync(leoCadPath)) {
    console.error(`LeoCAD not found at ${leoCadPath}. Set LEOCAD_PATH to the correct location.`);
    return;
  }
  const argList = libPath
    ? `"--libpath","${escapePowerShellString(libPath)}","${escapePowerShellString(filePath)}"`
    : `"${escapePowerShellString(filePath)}"`;
  const command = `Start-Process -FilePath "${escapePowerShellString(leoCadPath)}" -ArgumentList ${argList}`;
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
};

const escapeSendKeys = (value) => value.replace(/([+^%~(){}[\]])/g, '{$1}');

const escapePowerShellString = (value) => value.replace(/`/g, '``').replace(/"/g, '`"');

const openInLeoCadLive = (filePath) => {
  const leoCadPath = process.env.LEOCAD_PATH || 'C:\\Program Files\\LeoCAD\\LeoCAD.exe';
  const libPath = process.env.LEOCAD_PARTS_DIR;
  if (!fs.existsSync(leoCadPath)) {
    console.error(`LeoCAD not found at ${leoCadPath}. Set LEOCAD_PATH to the correct location.`);
    return;
  }

  const escapedPathForSendKeys = escapeSendKeys(filePath);
  const escapedLibPath = libPath ? escapePowerShellString(libPath) : null;
  const argList = libPath
    ? `"--libpath","${escapedLibPath}","${escapePowerShellString(filePath)}"`
    : `"${escapePowerShellString(filePath)}"`;
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$wshell = New-Object -ComObject WScript.Shell',
    `Start-Process -FilePath "${escapePowerShellString(leoCadPath)}" -ArgumentList ${argList}`,
    'Start-Sleep -Milliseconds 1200',
    '$wshell.AppActivate("LeoCAD") | Out-Null',
    'Start-Sleep -Milliseconds 300',
    '[System.Windows.Forms.SendKeys]::SendWait("^o")',
    'Start-Sleep -Milliseconds 300',
    `[System.Windows.Forms.SendKeys]::SendWait("${escapePowerShellString(escapedPathForSendKeys)}")`,
    'Start-Sleep -Milliseconds 200',
    '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
  ].join('; ');

  const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
};

const getAutoHotkeyPath = () => {
  const configured = process.env.AUTOHOTKEY_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const candidates = [
    'C:\\Program Files\\AutoHotkey\\AutoHotkey.exe',
    'C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe',
    'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe',
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const runAutoHotkey = (scriptPath, args = []) => {
  const ahkPath = getAutoHotkeyPath();
  if (!ahkPath) {
    throw new Error('AutoHotkey not found. Install AutoHotkey and set AUTOHOTKEY_PATH.');
  }
  const child = spawn(ahkPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
};

const sanitizeProfileName = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'default';
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'default';
};

const listProfiles = () => {
  ensureProfileDir();
  return fs
    .readdirSync(LEGO_PROFILE_DIR)
    .filter((file) => file.endsWith('.ini'))
    .map((file) => path.basename(file, '.ini'));
};

const getCalibrationPathForProfile = (profileName) => {
  ensureProfileDir();
  const safe = sanitizeProfileName(profileName);
  return path.join(LEGO_PROFILE_DIR, `${safe}.ini`);
};

const parseIniFile = (filePath) => {
  const data = {};
  const content = fs.readFileSync(filePath, 'utf8');
  let section = null;
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (!data[section]) data[section] = {};
      return;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1 || !section) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    data[section][key] = value;
  });
  return data;
};

const validateCalibrationIni = (iniPath) => {
  const requiredFields = [
    'part_field_x',
    'part_field_y',
    'pos_x_x',
    'pos_x_y',
    'pos_y_x',
    'pos_y_y',
    'pos_z_x',
    'pos_z_y',
    'rot_x_x',
    'rot_x_y',
    'rot_y_x',
    'rot_y_y',
    'rot_z_x',
    'rot_z_y',
    'color_x',
    'color_y',
  ];

  const data = parseIniFile(iniPath);
  const missing = [];
  requiredFields.forEach((key) => {
    if (!data.Fields || !data.Fields[key]) {
      missing.push(`Fields.${key}`);
    }
  });

  const hasPartsPanel =
    data.PartsPanel &&
    data.PartsPanel.search_x &&
    data.PartsPanel.search_y &&
    data.PartsPanel.tile_x &&
    data.PartsPanel.tile_y;

  const hasPartsDialog =
    data.PartsDialog &&
    data.PartsDialog.filter_x &&
    data.PartsDialog.filter_y &&
    data.PartsDialog.tile_x &&
    data.PartsDialog.tile_y &&
    data.PartsDialog.ok_x &&
    data.PartsDialog.ok_y;

  if (!hasPartsPanel && !hasPartsDialog) {
    missing.push('PartsPanel.search_x/search_y/tile_x/tile_y or PartsDialog.filter_x/filter_y/tile_x/tile_y/ok_x/ok_y');
  }

  return missing;
};

const runLeoCadCalibration = (profileName) => {
  ensureProfileDir();
  const scriptPath = path.join(LEGO_LIVE_DIR, 'calibrate.ahk');
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Calibration script missing.');
  }
  runAutoHotkey(scriptPath, [getCalibrationPathForProfile(profileName)]);
};

const runLeoCadLivePlacement = (csvPath, speedMultiplier, profileName, startupDelayMs = 0) => {
  ensureLegoLiveDir();
  const scriptPath = path.join(LEGO_LIVE_DIR, 'lego_live.ahk');
  const calibrationPath = getCalibrationPathForProfile(profileName);
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Live placement script missing.');
  }
  if (!fs.existsSync(calibrationPath)) {
    throw new Error('Calibration file missing. Run calibration first.');
  }
  const speedArg = speedMultiplier ? speedMultiplier.toString() : '1';
  const delayArg = startupDelayMs ? startupDelayMs.toString() : '0';
  runAutoHotkey(scriptPath, [csvPath, calibrationPath, speedArg, delayArg]);
};

let geminiClient = null;
let geminiClientKey = null;

const getGeminiClient = async (apiKey) => {
  if (!geminiClient || geminiClientKey !== apiKey) {
    const mod = await import('@google/genai');
    const GoogleGenAI = mod.GoogleGenAI || (mod.default && mod.default.GoogleGenAI);
    if (!GoogleGenAI) {
      throw new Error('Google GenAI SDK not available. Install @google/genai.');
    }
    geminiClient = new GoogleGenAI({ apiKey });
    geminiClientKey = apiKey;
  }
  return geminiClient;
};

const callGeminiApi = async ({ apiKey, model, contents }) => {
  const client = await getGeminiClient(apiKey);
  const response = await client.models.generateContent({
    model,
    contents,
  });
  return response;
};

const createImageUploader = () => {
  const memoryStorage = multer.memoryStorage();
  return multer({
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single('image');
};

exports.imageUploadMiddleware = (req, res, next) => {
  const uploadToMemory = createImageUploader();
  uploadToMemory(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: err.message });
    }
    next();
  });
};

const createImageDataUrl = (file) => {
  const base64Image = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64Image}`;
};

exports.getLegoBuilder = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result: null,
    error: null,
    info: null,
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: '',
    size: `${DEFAULT_LEGO_SIZE}x${DEFAULT_LEGO_SIZE}`,
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: false,
  });
};

exports.getLegoBuilderDemo = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result: null,
    error: null,
    info: 'Demo mode enabled. This will place random bricks without an API key.',
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: 'Demo random build',
    size: '8x8',
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: true,
    demoType: 'random',
    autoRun: true,
  });
};

exports.getLegoBuilderDemoTree = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result: null,
    error: null,
    info: 'Tree demo enabled. This will build a simple 3D tree.',
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: 'Demo tree build',
    size: '8x8',
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: true,
    demoType: 'tree',
    autoRun: true,
  });
};

exports.getLegoBuilderDemoStack = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  const stackCount = Number.parseInt(req.query.stackCount, 10) || 5;
  const stackColor = req.query.stackColor || 'blue';
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result: null,
    error: null,
    info: 'Stack demo enabled. This will place a vertical stack of bricks.',
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: 'Demo stack build',
    size: '1x1',
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: true,
    demoType: 'stack',
    stackCount: stackCount.toString(),
    stackColor,
    autoRun: true,
  });
};

exports.getLegoBuilderDemo1477 = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  let error = null;
  let info = null;
  let result = null;
  try {
    const mpdPath = 'C:\\Users\\Yonat\\Downloads\\1477-1.mpd';
    if (!fs.existsSync(mpdPath)) {
      throw new Error('1477-1.mpd not found.');
    }
    ensureLegoOutputDir();
    const fileName = `demo-1477-${Date.now()}.ldr`;
    const filePath = path.join(LEGO_OUTPUT_DIR, fileName);
    const ldraw = buildLdrawFromMpd(mpdPath, '1477 - Red Devil Racer.ldr');
    fs.writeFileSync(filePath, ldraw, 'utf8');
    openInLeoCad(filePath);
    info = 'Loaded 1477-1 model directly into LeoCAD.';
    result = {
      fileName,
      fileUrl: `/lego/${fileName}`,
    };
  } catch (err) {
    error = err.message || 'Failed to load 1477-1 model.';
  }

  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result,
    error,
    info,
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: 'Demo 1477-1 Red Devil Racer',
    size: '8x8',
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: false,
  });
};

exports.getLegoBuilderDemo1477Live = (req, res) => {
  const profileName = sanitizeProfileName(req.query.profile);
  const axisUp = (req.query.axisUp || 'Z').toUpperCase();
  let error = null;
  let info = null;
  let result = null;
  try {
    const mpdPath = 'C:\\Users\\Yonat\\Downloads\\1477-1.mpd';
    if (!fs.existsSync(mpdPath)) {
      throw new Error('1477-1.mpd not found.');
    }
    const placements = parseMpdToPlacements(mpdPath, '1477 - Red Devil Racer.ldr', axisUp);
    const { text, colorUsage } = buildLdrawFromPlacements(placements);
    ensureLegoOutputDir();
    const fileName = `demo-1477-live-${Date.now()}.ldr`;
    const filePath = path.join(LEGO_OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, text, 'utf8');

    const csvName = fileName.replace('.ldr', '-placements.csv');
    const csvPath = path.join(LEGO_OUTPUT_DIR, csvName);
    const csvLines = ['part_query,color,x,y,z,rx,ry,rz'];
    placements.forEach((placement) => {
      const partQueryRaw = placement.partQuery || placement.partName || placement.part;
      const partQuery = normalizePartQuery(partQueryRaw);
      const rx = placement.rx ?? 0;
      const ry = placement.ry ?? 0;
      const rz = placement.rz ?? 0;
      csvLines.push(`${partQuery},${placement.colorName},${placement.x},${placement.y},${placement.z},${rx},${ry},${rz}`);
    });
    fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8');

    openInLeoCad(filePath);
    info = '1477-1 demo opened in LeoCAD.';

    result = {
      fileName,
      fileUrl: `/lego/${fileName}`,
      csvUrl: `/lego/${csvName}`,
      colorUsage,
    };
  } catch (err) {
    error = err.message || 'Failed to run live 1477-1 demo.';
  }

  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result,
    error,
    info,
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: 'Live demo 1477-1 Red Devil Racer',
    size: '8x8',
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: false,
  });
};

// Calibration reset removed: no calibration profiles are required.

// Calibration removed: live placement no longer requires UI coordinate training.

exports.getLegoBuilderScanParts = (req, res) => {
  let error = null;
  let info = null;
  const profileName = sanitizeProfileName(req.query.profile);
  try {
    const result = scanPartsLibrary();
    info = `Parts library scanned from ${result.partsDir}. ${result.count} parts loaded.`;
  } catch (err) {
    error = err.message || 'Failed to scan parts library.';
  }
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result: null,
    error,
    info,
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    prompt: '',
    size: `${DEFAULT_LEGO_SIZE}x${DEFAULT_LEGO_SIZE}`,
    liveSpeed: '1',
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode: false,
  });
};

exports.postLegoBuilder = async (req, res) => {
  const promptText = (req.body.prompt || '').slice(0, 800);
  const sizeInput = (req.body.size || '').trim();
  const speedInput = parseFloat(req.body.speed || '1');
  const liveSpeed = Number.isFinite(speedInput) ? clamp(speedInput, 0.25, 2) : 1;
  const profileName = sanitizeProfileName(req.body.profile || req.query.profile);
  const axisUp = (req.body.axisUp || req.query.axisUp || 'Z').toUpperCase();
  const openAfter = true;
  let error = null;
  let result = null;
  let info = null;
  let csvPreview = null;
  const demoMode = req.body.demoMode === '1';
  const demoType = (req.body.demoType || 'random').toLowerCase();
  const stackCount = req.body.stackCount || req.query.stackCount || '5';
  const stackColor = req.body.stackColor || req.query.stackColor || 'blue';

  if (!demoMode && !promptText) {
    error = 'Please provide a prompt (image optional).';
  }

  const sizeFromPrompt = extractSizeFromText(promptText) || extractSizeFromText(sizeInput);
  const width = sizeFromPrompt?.width || DEFAULT_LEGO_SIZE;
  const height = sizeFromPrompt?.height || DEFAULT_LEGO_SIZE;

  if (!error) {
    try {
      let spec = null;
      let placementsOverride = null;
      if (demoMode) {
        if (demoType === 'tree') {
          placementsOverride = buildTreeDemoPlacements();
          info = 'Tree demo: building a simple 3D tree (no API key required).';
        } else if (demoType === 'stack') {
          const stackCount = req.body.stackCount || req.query.stackCount || 5;
          const stackColor = req.body.stackColor || req.query.stackColor || 'blue';
          placementsOverride = buildStackDemoPlacements(stackCount, stackColor);
          info = `Stack demo: ${stackCount} ${stackColor} bricks (no API key required).`;
        } else {
          spec = randomLegoSpec(width, height);
          info = 'Demo mode: using random bricks (no API key required).';
        }
      } else {
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        if (!geminiApiKey) {
          throw new Error('Gemini API key is not set in environment variables.');
        }
        const contents = req.file
          ? createGeminiContents(createImageDataUrl(req.file), promptText, width, height)
          : createGeminiContentsTextOnly(promptText, width, height);
        const data = await callGeminiApi({ apiKey: geminiApiKey, model: geminiModel, contents });
        const content =
          data?.text ||
          data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') ||
          '';
        spec = extractJsonFromContent(content) || fallbackLegoSpec(width, height);
      }

      let text = '';
      let colorUsage = {};
      let placements = [];
      if (placementsOverride) {
        ({ text, colorUsage, placements } = buildLdrawFromPlacements(placementsOverride));
      } else {
        const normalizedGrid = normalizeGrid(spec.grid || [], width, height, 'white');
        ({ text, colorUsage, placements } = buildLdrawFromGrid(normalizedGrid, width, height));
      }

      ensureLegoOutputDir();
      const fileName = `lego-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.ldr`;
      const filePath = path.join(LEGO_OUTPUT_DIR, fileName);
      fs.writeFileSync(filePath, text, 'utf8');

      const csvName = fileName.replace('.ldr', '-placements.csv');
      const csvPath = path.join(LEGO_OUTPUT_DIR, csvName);
      const csvLines = ['part_query,color,x,y,z,rx,ry,rz'];
      placements.forEach((placement) => {
        const partQueryRaw = placement.partQuery || placement.partName || placement.part;
        const partQuery = normalizePartQuery(partQueryRaw);
        let px = placement.x;
        let py = placement.y;
        let pz = placement.z;
        if (axisUp === 'Z') {
          py = placement.z;
          pz = placement.y;
        } else if (axisUp === 'X') {
          px = placement.y;
          py = placement.z;
          pz = placement.x;
        }
        const rx = placement.rx ?? 0;
        const ry = placement.ry ?? 0;
        const rz = placement.rz ?? 0;
        csvLines.push(`${partQuery},${placement.colorName},${px},${py},${pz},${rx},${ry},${rz}`);
      });
      fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8');
      csvPreview = csvLines.slice(0, 4).join('\n');

      if (openAfter) {
        openInLeoCad(filePath);
        info = 'Model opened in LeoCAD.';
      }

      result = {
        fileName,
        fileUrl: `/lego/${fileName}`,
        width,
        height,
        palette: spec.palette || [],
        colorUsage,
        csvUrl: `/lego/${csvName}`,
        partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
      };
    } catch (err) {
      console.error('LEGO Builder error:', err);
      error = err.message || 'Failed to generate LEGO build.';
    }
  }

  if (info && csvPreview) {
    info = `${info}\nCSV preview:\n${csvPreview}`;
  }
  res.render('ai/lego-builder', {
    title: 'AI LEGO Builder',
    result,
    error,
    info,
    partsInfo: cachedBrickCatalog ? `${cachedBrickCatalog.length} parts loaded` : 'Default parts only',
    profiles: listProfiles(),
    profileName,
    axisUp,
    prompt: promptText,
    size: `${width}x${height}`,
    liveSpeed: liveSpeed.toString(),
    openInLeoCad: true,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    demoMode,
    demoType,
    stackCount,
    stackColor,
  });
};
