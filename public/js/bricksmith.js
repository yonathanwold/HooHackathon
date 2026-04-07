(function () {
  const presets = {
    'Castle': 'A fortified medieval castle with towers, a drawbridge, and a courtyard',
    'Sports Car': 'A low profile sports car with a sleek spoiler and wide stance',
    'Space Station': 'A modular space station with docking bays and solar wings',
    'House': 'A cozy two story house with a garden and front porch',
    'Train': 'A classic steam train with a passenger car and coal tender',
    'Dragon': 'A winged dragon perched on a rocky arch with glowing eyes'
  };

  const sets = [
    { id: '10265', name: 'Ford Mustang', theme: 'Creator', pieces: 1471 },
    { id: '21318', name: 'Tree House', theme: 'Ideas', pieces: 3036 },
    { id: '31200', name: 'The Sith', theme: 'Art', pieces: 3395 },
    { id: '75314', name: 'The Bad Batch Attack Shuttle', theme: 'Star Wars', pieces: 969 },
    { id: '21325', name: 'Medieval Blacksmith', theme: 'Ideas', pieces: 2164 },
    { id: '31120', name: 'Medieval Castle', theme: 'Creator', pieces: 1426 },
    { id: '10283', name: 'NASA Space Shuttle Discovery', theme: 'Icons', pieces: 2354 },
    { id: '10316', name: 'The Lord of the Rings Rivendell', theme: 'Icons', pieces: 6167 },
    { id: '42141', name: 'McLaren Formula 1', theme: 'Technic', pieces: 1434 },
    { id: '76405', name: 'Hogwarts Express', theme: 'Harry Potter', pieces: 5129 },
    { id: '31134', name: 'Space Shuttle', theme: 'Creator', pieces: 144 },
    { id: '60415', name: 'Police Station', theme: 'City', pieces: 668 }
  ];

  const dom = {
    setSearch: document.getElementById('setSearch'),
    searchResults: document.getElementById('searchResults'),
    collectionList: document.getElementById('collectionList'),
    promptInput: document.getElementById('promptInput'),
    promptHistory: document.getElementById('promptHistory'),
    clearPromptHistory: document.getElementById('clearPromptHistory'),
    pieceCount: document.getElementById('pieceCount'),
    pieceCountInput: document.getElementById('pieceCountInput'),
    pieceCountValue: document.getElementById('pieceCountValue'),
    generateBtn: document.getElementById('generateBtn'),
    copyPromptBtn: document.getElementById('copyPromptBtn'),
    summaryName: document.getElementById('summaryName'),
    summaryTheme: document.getElementById('summaryTheme'),
    summaryDifficulty: document.getElementById('summaryDifficulty'),
    summaryPieces: document.getElementById('summaryPieces'),
    summaryCost: document.getElementById('summaryCost'),
    partsTable: document.getElementById('partsTable'),
    exportXml: document.getElementById('exportXml'),
    exportCsv: document.getElementById('exportCsv'),
    viewerCanvas: document.getElementById('viewerCanvas'),
    viewerStatus: document.getElementById('viewerStatus')
  };

  const storageKey = 'bricksmith.collection';
  const promptHistoryKey = 'bricksmith.promptHistory';

  function getCollection() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (err) {
      return [];
    }
  }

  function setCollection(next) {
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function renderCollection() {
    const collection = getCollection();
    dom.collectionList.innerHTML = '';
    if (!collection.length) {
      const item = document.createElement('li');
      item.className = 'list-group-item bg-transparent text-muted';
      item.textContent = 'No sets added.';
      dom.collectionList.appendChild(item);
      return;
    }
    collection.forEach((set) => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent d-flex justify-content-between align-items-center';
      li.innerHTML = `<span>${set.name} <span class="text-muted">(${set.id})</span></span>`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost';
      btn.textContent = 'Remove';
      btn.addEventListener('click', () => {
        const next = getCollection().filter((entry) => entry.id !== set.id);
        setCollection(next);
        renderCollection();
      });
      li.appendChild(btn);
      dom.collectionList.appendChild(li);
    });
  }

  function renderSearchResults(matches) {
    dom.searchResults.innerHTML = '';
    if (!matches.length) {
      const item = document.createElement('li');
      item.className = 'list-group-item bg-transparent text-muted';
      item.textContent = 'No results yet.';
      dom.searchResults.appendChild(item);
      return;
    }
    matches.forEach((set) => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent d-flex justify-content-between align-items-center';
      li.innerHTML = `<span>${set.name} <span class="text-muted">(${set.id})</span></span>`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost';
      btn.textContent = 'Add';
      btn.addEventListener('click', () => {
        const collection = getCollection();
        if (!collection.some((entry) => entry.id === set.id)) {
          collection.push(set);
          setCollection(collection);
          renderCollection();
        }
      });
      li.appendChild(btn);
      dom.searchResults.appendChild(li);
    });
  }

  function getDifficulty(pieceCount) {
    if (pieceCount < 120) return 'Easy';
    if (pieceCount < 250) return 'Medium';
    if (pieceCount < 400) return 'Hard';
    return 'Expert';
  }

  function generateParts(pieceCount) {
    const palette = [
      { name: 'Brick 2x4', color: 'Red', price: 0.12 },
      { name: 'Plate 2x4', color: 'Dark Blue', price: 0.08 },
      { name: 'Tile 1x2', color: 'Light Gray', price: 0.06 },
      { name: 'Slope 2x2', color: 'Sand Green', price: 0.14 },
      { name: 'Brick 1x2', color: 'Black', price: 0.05 },
      { name: 'Plate 1x1', color: 'Tan', price: 0.04 }
    ];
    let remaining = pieceCount;
    return palette.map((part, index) => {
      const qty = index === palette.length - 1 ? remaining : Math.max(4, Math.floor(pieceCount / (palette.length + 2)));
      remaining -= qty;
      return { ...part, qty };
    });
  }

  function renderParts(parts) {
    dom.partsTable.innerHTML = '';
    let total = 0;
    parts.forEach((part) => {
      const line = part.qty * part.price;
      total += line;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${part.name}</td>
        <td>${part.color}</td>
        <td>${part.qty}</td>
        <td>$${part.price.toFixed(2)}</td>
        <td>$${line.toFixed(2)}</td>
      `;
      dom.partsTable.appendChild(row);
    });
    return total;
  }

  function createDownloads(parts) {
    const xmlItems = parts.map((part) => {
      return `  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>${part.name.replace(/\s+/g, '_')}</ITEMID>
    <COLOR>${part.color}</COLOR>
    <MINQTY>${part.qty}</MINQTY>
  </ITEM>`;
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<INVENTORY>\n${xmlItems}\n</INVENTORY>`;
    const csvLines = ['part,color,quantity,est_unit_price'];
    parts.forEach((part) => {
      csvLines.push(`${part.name},${part.color},${part.qty},${part.price}`);
    });
    const csv = csvLines.join('\n');

    const xmlBlob = new Blob([xml], { type: 'application/xml' });
    const csvBlob = new Blob([csv], { type: 'text/csv' });
    dom.exportXml.href = URL.createObjectURL(xmlBlob);
    dom.exportCsv.href = URL.createObjectURL(csvBlob);
  }

  let scene;
  let camera;
  let renderer;
  let group;
  let viewerEl;
  let controls;

  function getViewerSize() {
    if (!viewerEl) return { width: 0, height: 0 };
    const width = viewerEl.clientWidth || 600;
    const height = viewerEl.clientHeight || 360;
    return { width, height };
  }

  function initViewer() {
    if (!window.THREE) {
      dom.viewerStatus.textContent = 'Three.js not loaded';
      return;
    }
    viewerEl = dom.viewerCanvas.parentElement;
    scene = new THREE.Scene();
    const size = getViewerSize();
    camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 1000);
    camera.position.set(10, 10, 14);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ canvas: dom.viewerCanvas, antialias: true, alpha: true });
    renderer.setSize(size.width, size.height, false);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x0b1220, 0.95);

    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(8, 12, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    group = new THREE.Group();
    scene.add(group);

    const grid = new THREE.GridHelper(16, 16, 0x334155, 0x1f2937);
    grid.position.y = -2;
    scene.add(grid);

    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, dom.viewerCanvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.minDistance = 3;
      controls.maxDistance = 40;
      controls.target.set(0, 0, 0);
      controls.update();
    }

    animate();
  }

  function animate() {
    if (!renderer) return;
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  function normalizeVoxel(voxel) {
    if (Array.isArray(voxel) && voxel.length >= 4) {
      return { x: voxel[0], y: voxel[1], z: voxel[2], color: voxel[3] };
    }
    return voxel || {};
  }

  function updateViewer(voxels, pieceCount, options = {}) {
    if (!group) return;
    while (group.children.length) {
      group.remove(group.children[0]);
    }
    const fallbackCount = Math.min(70, Math.max(18, Math.floor(pieceCount / 6)));
    const list = Array.isArray(voxels) && voxels.length ? voxels : Array.from({ length: fallbackCount }, (_, i) => ({
      x: (i % 6) - 2,
      y: Math.floor(i / 12),
      z: ((i % 12) / 2) - 2,
      color: ['#f97316', '#38bdf8', '#a3e635', '#facc15', '#f472b6', '#e2e8f0'][i % 6]
    }));
    const synced = syncVoxelCount(list, pieceCount, options);
    const bbox = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    synced.forEach((raw) => {
      const voxel = normalizeVoxel(raw);
      const vx = Number(voxel.x) || 0;
      const vy = Number(voxel.y) || 0;
      const vz = Number(voxel.z) || 0;
      bbox.minX = Math.min(bbox.minX, vx);
      bbox.minY = Math.min(bbox.minY, vy);
      bbox.minZ = Math.min(bbox.minZ, vz);
      bbox.maxX = Math.max(bbox.maxX, vx);
      bbox.maxY = Math.max(bbox.maxY, vy);
      bbox.maxZ = Math.max(bbox.maxZ, vz);

      const baseColor = voxel.color || '#f97316';
      const material = new THREE.MeshStandardMaterial({ color: baseColor });
      const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        vx * 0.8,
        vy * 0.8,
        vz * 0.8
      );
      group.add(mesh);

      // Add a simple LEGO stud on top for readability
      const studMaterial = new THREE.MeshStandardMaterial({ color: lightenColor(baseColor, 0.18) });
      const studGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.18, 16);
      const stud = new THREE.Mesh(studGeometry, studMaterial);
      stud.position.set(
        mesh.position.x,
        mesh.position.y + 0.45,
        mesh.position.z
      );
      group.add(stud);
    });
    if (Number.isFinite(bbox.minX)) {
      const centerX = (bbox.minX + bbox.maxX) / 2;
      const centerY = (bbox.minY + bbox.maxY) / 2;
      const centerZ = (bbox.minZ + bbox.maxZ) / 2;
      group.position.set(-centerX * 0.8, -centerY * 0.8, -centerZ * 0.8);

      const span = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, bbox.maxZ - bbox.minZ) + 4;
      camera.position.set(span * 0.7, span * 0.5, span * 0.9);
      camera.lookAt(0, 0, 0);
    }
    dom.viewerStatus.textContent = `Generated ${synced.length} voxels`;
  }

  function syncVoxelCount(list, target, options = {}) {
    const desired = Number(target) || list.length;
    if (list.length === desired) return list;
    if (list.length > desired) return list.slice(0, desired);

    const next = list.slice();
    const occupied = new Set();
    const sortedByHeight = list.slice().sort((a, b) => {
      const av = normalizeVoxel(a);
      const bv = normalizeVoxel(b);
      return (Number(bv.y) || 0) - (Number(av.y) || 0);
    });
    const bbox = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    list.forEach((raw) => {
      const voxel = normalizeVoxel(raw);
      const vx = Number(voxel.x) || 0;
      const vy = Number(voxel.y) || 0;
      const vz = Number(voxel.z) || 0;
      occupied.add(`${vx},${vy},${vz}`);
      bbox.minX = Math.min(bbox.minX, vx);
      bbox.minY = Math.min(bbox.minY, vy);
      bbox.minZ = Math.min(bbox.minZ, vz);
      bbox.maxX = Math.max(bbox.maxX, vx);
      bbox.maxY = Math.max(bbox.maxY, vy);
      bbox.maxZ = Math.max(bbox.maxZ, vz);
    });

    if (options.internalFill && Number.isFinite(bbox.minX)) {
      for (let y = bbox.minY + 1; y <= bbox.maxY - 1 && next.length < desired; y += 1) {
        for (let x = bbox.minX + 1; x <= bbox.maxX - 1 && next.length < desired; x += 1) {
          for (let z = bbox.minZ + 1; z <= bbox.maxZ - 1 && next.length < desired; z += 1) {
            const key = `${x},${y},${z}`;
            if (!occupied.has(key)) {
              next.push({ x, y, z, color: options.fillColor || '#b36b3c' });
              occupied.add(key);
            }
          }
        }
      }
      if (next.length >= desired) return next;
    }

    const maxPadY = Number.isFinite(options.maxPadY) ? options.maxPadY : bbox.maxY + 1;
    let layer = Math.min(bbox.maxY + 1, maxPadY);
    let index = 0;
    while (next.length < desired) {
      const source = normalizeVoxel(sortedByHeight[index % sortedByHeight.length]);
      next.push({
        x: Number(source.x || 0),
        y: layer,
        z: Number(source.z || 0),
        color: source.color || '#d62828'
      });
      index += 1;
      if (index % list.length === 0) {
        layer = Math.min(layer + 1, maxPadY);
      }
    }
    return next;
  }

  async function handleGenerate() {
    const pieceCount = Number(dom.pieceCount.value);
    const prompt = dom.promptInput.value.trim() || 'Custom build';
    dom.viewerStatus.textContent = 'Generating with Gemini...';
    savePromptToHistory(prompt);

    try {
      const response = await fetch('/bricksmith/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.BRICKSMITH_CSRF
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          _csrf: window.BRICKSMITH_CSRF,
          prompt,
          pieceCount,
          collection: getCollection()
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Request failed');
      }

      const data = await response.json();
      const summary = data.summary || {};
      const parts = Array.isArray(data.parts) ? data.parts : generateParts(pieceCount);
      const voxels = Array.isArray(data.voxels) ? data.voxels : [];
      const totalCost = renderParts(parts);
      createDownloads(parts);
      const final = chooseVoxelsForPrompt(voxels, prompt);
      updateViewer(final.voxels, pieceCount, final.options);

      dom.summaryName.textContent = summary.name || 'Custom Build';
      dom.summaryTheme.textContent = summary.theme || 'Custom';
      dom.summaryDifficulty.textContent = summary.difficulty || getDifficulty(pieceCount);
      dom.summaryPieces.textContent = summary.pieceCount || pieceCount;
      dom.summaryCost.textContent = `$${Number(summary.estimatedCost || totalCost).toFixed(2)}`;
    } catch (err) {
      dom.viewerStatus.textContent = 'Generation failed. Check console.';
      console.error(err);
    }
  }

  function chooseVoxelsForPrompt(voxels, prompt) {
    const text = (prompt || '').toLowerCase();
    const wantsCar = text.includes('car') || text.includes('sports');
    const wantsHouse = text.includes('house') || text.includes('home') || text.includes('cottage');
    if (wantsCar) {
      return { voxels: buildCarVoxels(), options: {} };
    }
    if (wantsHouse) {
      const style = parseHouseStyle(prompt);
      style.prompt = prompt;
      if (style.variant === 'townhouse') {
        const townhouse = buildTownhouseVoxels(style);
        const maxY = townhouse.reduce((acc, v) => Math.max(acc, Number(normalizeVoxel(v).y) || 0), 0);
        return { voxels: townhouse, options: { maxPadY: maxY } };
      }
      const house = buildHouseVoxels(style);
      const maxY = house.reduce((acc, v) => Math.max(acc, Number(normalizeVoxel(v).y) || 0), 0);
      return {
        voxels: house,
        options: {
          maxPadY: maxY - 1,
          internalFill: true,
          fillColor: style.wallColor || '#b36b3c'
        }
      };
    }
    return { voxels, options: {} };
  }

  function buildCarVoxels() {
    const voxels = [];
    const body = '#d62828';
    const cabin = '#ef4444';
    const wheel = '#111827';
    const glass = '#60a5fa';
    const trim = '#facc15';
    const width = 6;
    const maxZ = width - 1;

    function add(x, y, z, color) {
      voxels.push([x, y, z, color]);
    }

    function addSym(x, y, z, color) {
      add(x, y, z, color);
      const mirrorZ = maxZ - z;
      if (mirrorZ !== z) add(x, y, mirrorZ, color);
    }

    // Wider low-profile chassis (length 16, width 6)
    for (let x = 0; x <= 15; x += 1) {
      for (let z = 0; z <= 5; z += 1) {
        add(x, 0, z, body);
      }
    }

    // Hood taper
    for (let x = 1; x <= 4; x += 1) {
      addSym(x, 1, 1, cabin);
      addSym(x, 1, 2, cabin);
    }

    // Cabin block
    for (let x = 5; x <= 10; x += 1) {
      addSym(x, 1, 1, cabin);
      addSym(x, 1, 2, cabin);
    }
    for (let x = 6; x <= 9; x += 1) {
      addSym(x, 2, 2, glass);
    }
    for (let x = 7; x <= 8; x += 1) {
      addSym(x, 2, 1, glass);
    }

    // Trunk + spoiler
    for (let x = 11; x <= 14; x += 1) {
      addSym(x, 1, 1, cabin);
      addSym(x, 1, 2, cabin);
    }
    addSym(15, 2, 1, cabin);

    // Headlights and taillights
    addSym(0, 1, 1, trim);
    addSym(15, 1, 1, '#b91c1c');

    // Wheels (2x2 lowered)
    const wheelPositions = [
      [3, 0],
      [12, 0]
    ];
    wheelPositions.forEach(([x, z]) => {
      addSym(x, -1, z, wheel);
      addSym(x + 1, -1, z, wheel);
      addSym(x, -1, z + 1, wheel);
      addSym(x + 1, -1, z + 1, wheel);
    });
    return voxels;
  }

  function parseHouseStyle(prompt) {
    const text = (prompt || '').toLowerCase();
    const isTwoStory = text.includes('two story') || text.includes('two-story') || text.includes('2 story') || text.includes('two storey');
    const isTownhouse = text.includes('townhouse') || text.includes('town house');
    const isCozy = text.includes('cozy') || text.includes('cottage');
    const hasGarden = text.includes('garden');
    const hasPorch = text.includes('porch') || text.includes('front porch');
    let roof = 'gable';
    if (text.includes('flat roof') || text.includes('modern')) roof = 'flat';
    if (text.includes('dormer')) roof = 'dormer';
    if (text.includes('sloped') || text.includes('gable')) roof = 'gable';
    let wallColor = '#b36b3c';
    if (text.includes('brick')) wallColor = '#b45309';
    if (text.includes('red brick')) wallColor = '#b91c1c';
    if (text.includes('white')) wallColor = '#f3f4f6';
    let width = 6;
    let depth = 5;
    if (isTownhouse) {
      width = 5;
      depth = 4;
    }
    const variant = isTownhouse ? 'townhouse' : isCozy ? 'cozy' : 'classic';
    return {
      stories: isTwoStory || isTownhouse ? 2 : 1,
      roof,
      wallColor,
      width,
      depth,
      variant,
      hasGarden,
      hasPorch
    };
  }

  function buildHouseVoxels(style = {}) {
    const voxels = [];
    const base = '#2f7d32';
    const wall = style.wallColor || '#b36b3c';
    const roof = '#9ca3af';
    const door = '#7c3f1f';
    const window = '#93c5fd';
    const porch = '#a16207';
    const garden = '#16a34a';

    const width = style.width || 6;
    const depth = style.depth || 5;
    const storyHeight = 3;
    const stories = style.stories || 1;
    const height = storyHeight * stories;
    const variant = style.variant || 'classic';

    const seed = hashPrompt(String(style.prompt || ''));
    const doorX = variant === 'townhouse' ? 2 : 3;
    const doorZ = 1;
    const windowOffset = seed % 2 === 0 ? 1 : 2;

    function add(x, y, z, color) {
      voxels.push([x, y, z, color]);
    }

    // Base plate (mini footprint)
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        add(x, 0, z, base);
      }
    }

    // House walls (hollow, two stories)
    for (let y = 1; y <= height; y += 1) {
      for (let x = 1; x <= width - 2; x += 1) {
        add(x, y, 1, wall);
        add(x, y, depth - 2, wall);
      }
      for (let z = 1; z <= depth - 2; z += 1) {
        add(1, y, z, wall);
        add(width - 2, y, z, wall);
      }
    }

    // Door (front center)
    add(doorX, 1, doorZ, door);
    add(doorX, 2, doorZ, door);

    // Windows (front + sides, first floor)
    add(doorX - windowOffset, 2, 1, window);
    add(doorX + windowOffset, 2, 1, window);
    add(1, 2, 2, window);
    add(1, 2, 3, window);
    add(width - 2, 2, 2, window);
    add(width - 2, 2, 3, window);

    if (stories > 1) {
      // Windows (second floor)
      const upperY = storyHeight + 2;
      add(doorX - windowOffset, upperY, 1, window);
      add(doorX + windowOffset, upperY, 1, window);
      add(1, upperY, 2, window);
      add(1, upperY, 3, window);
      add(width - 2, upperY, 2, window);
      add(width - 2, upperY, 3, window);
    }

    // Porch / garden (for cozy prompts)
    if (style.hasPorch) {
      add(doorX - 1, 1, 0, porch);
      add(doorX, 1, 0, porch);
      add(doorX + 1, 1, 0, porch);
    }
    if (style.hasGarden) {
      add(0, 1, depth - 1, garden);
      add(width - 1, 1, depth - 1, garden);
      add(0, 1, 0, garden);
      add(width - 1, 1, 0, garden);
    }

    // Roof styles
    if (style.roof === 'flat') {
      for (let x = 0; x < width; x += 1) {
        for (let z = 0; z < depth; z += 1) {
          add(x, height + 1, z, roof);
        }
      }
    } else if (style.roof === 'dormer') {
      for (let x = 0; x < width; x += 1) {
        for (let z = 0; z < depth; z += 1) {
          add(x, height + 1, z, roof);
        }
      }
      for (let x = 2; x <= 3; x += 1) {
        add(x, height + 2, 2, roof);
      }
      add(2, height + 3, 2, roof);
    } else {
      // Gable roof
      for (let x = 0; x < width; x += 1) {
        for (let z = 0; z < depth; z += 1) {
          add(x, height + 1, z, roof);
        }
      }
      for (let x = 1; x < width - 1; x += 1) {
        add(x, height + 2, Math.floor(depth / 2), roof);
      }
    }

    return voxels;
  }

  function buildTownhouseVoxels(style = {}) {
    const voxels = [];
    const base = '#2f7d32';
    const wall = style.wallColor || '#b45309';
    const trim = '#e5e7eb';
    const roof = '#4b5563';
    const door = '#7c2d12';
    const glass = '#93c5fd';

    const width = 6;
    const depth = 4;
    const storyHeight = 3;
    const stories = 2;
    const height = storyHeight * stories;

    function add(x, y, z, color) {
      voxels.push([x, y, z, color]);
    }

    // Base plate (narrow rowhouse lot)
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        add(x, 0, z, base);
      }
    }

    // Solid back wall
    for (let y = 1; y <= height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        add(x, y, depth - 1, wall);
      }
    }

    // Party walls on sides
    for (let y = 1; y <= height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        add(0, y, z, wall);
        add(width - 1, y, z, wall);
      }
    }

    // Front facade (recess upper story by 1 voxel)
    for (let y = 1; y <= height; y += 1) {
      const frontZ = y > storyHeight ? 1 : 0;
      for (let x = 1; x < width - 1; x += 1) {
        add(x, y, frontZ, wall);
      }
    }

    // Recessed doorway + stoop
    add(2, 1, 0, door);
    add(2, 2, 0, door);
    add(2, 1, 1, door);

    // Stoop
    add(1, 1, 0, trim);
    add(3, 1, 0, trim);
    add(4, 1, 0, trim);

    // Windows (front)
    add(1, 2, 0, glass);
    add(4, 2, 0, glass);
    add(1, 5, 1, glass);
    add(4, 5, 1, glass);

    // Side trim columns
    for (let y = 1; y <= height; y += 1) {
      add(0, y, 1, trim);
      add(width - 1, y, 1, trim);
    }

    // Cornice band between stories
    for (let x = 1; x < width - 1; x += 1) {
      add(x, storyHeight + 1, 0, trim);
    }

    // Flat roof with parapet
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        add(x, height + 1, z, roof);
      }
    }
    for (let x = 0; x < width; x += 1) {
      add(x, height + 2, 0, roof);
      add(x, height + 2, depth - 1, roof);
    }
    for (let z = 0; z < depth; z += 1) {
      add(0, height + 2, z, roof);
      add(width - 1, height + 2, z, roof);
    }

    return voxels;
  }

  function hashPrompt(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function lightenColor(hex, amount) {
    const value = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.round(((value >> 16) & 255) + 255 * amount));
    const g = Math.min(255, Math.round(((value >> 8) & 255) + 255 * amount));
    const b = Math.min(255, Math.round((value & 255) + 255 * amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function handleCopyPrompt() {
    const text = dom.promptInput.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function getPromptHistory() {
    try {
      return JSON.parse(localStorage.getItem(promptHistoryKey) || '[]');
    } catch (err) {
      return [];
    }
  }

  function renderPromptHistory() {
    if (!dom.promptHistory) return;
    const history = getPromptHistory();
    dom.promptHistory.innerHTML = '';
    if (!history.length) {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent text-muted';
      li.textContent = 'No history yet.';
      dom.promptHistory.appendChild(li);
      return;
    }
    history.forEach((prompt) => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-transparent d-flex justify-content-between align-items-center';
      const span = document.createElement('span');
      span.textContent = prompt;
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost';
      btn.textContent = 'Use';
      btn.addEventListener('click', () => {
        dom.promptInput.value = prompt;
      });
      li.appendChild(span);
      li.appendChild(btn);
      dom.promptHistory.appendChild(li);
    });
  }

  function savePromptToHistory(prompt) {
    const text = (prompt || '').trim();
    if (!text) return;
    const history = getPromptHistory();
    const next = [text, ...history.filter((item) => item !== text)].slice(0, 8);
    localStorage.setItem(promptHistoryKey, JSON.stringify(next));
    renderPromptHistory();
  }

  function handlePresetClick(event) {
    const preset = event.target.getAttribute('data-preset');
    if (!preset) return;
    dom.promptInput.value = presets[preset];
  }

  function handleSearchInput() {
    const term = dom.setSearch.value.trim().toLowerCase();
    if (!term) {
      renderSearchResults([]);
      return;
    }
    const matches = sets.filter((set) => {
      return set.name.toLowerCase().includes(term) || set.id.includes(term);
    });
    renderSearchResults(matches.slice(0, 6));
  }

  function handlePieceCount() {
    dom.pieceCountValue.textContent = dom.pieceCount.value;
    if (dom.pieceCountInput) {
      dom.pieceCountInput.value = dom.pieceCount.value;
    }
  }

  function handlePieceCountInput() {
    if (!dom.pieceCountInput) return;
    const value = Math.max(30, Math.min(500, Number(dom.pieceCountInput.value || 0)));
    dom.pieceCount.value = String(value);
    dom.pieceCountValue.textContent = String(value);
  }

  function init() {
    renderCollection();
    dom.pieceCount.addEventListener('input', handlePieceCount);
    if (dom.pieceCountInput) {
      dom.pieceCountInput.addEventListener('input', handlePieceCountInput);
    }
    dom.setSearch.addEventListener('input', handleSearchInput);
    dom.generateBtn.addEventListener('click', handleGenerate);
    dom.copyPromptBtn.addEventListener('click', handleCopyPrompt);
    if (dom.clearPromptHistory) {
      dom.clearPromptHistory.addEventListener('click', () => {
        localStorage.removeItem(promptHistoryKey);
        renderPromptHistory();
      });
    }
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', handlePresetClick);
    });

    handlePieceCount();
    renderPromptHistory();
    initViewer();
  }

  window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    const size = getViewerSize();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height, false);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
