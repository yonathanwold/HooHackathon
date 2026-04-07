exports.getBricksmith = (req, res) => {
  res.render('bricksmith', {
    title: 'BrickSmith',
    hasRebrickableKey: Boolean(process.env.REBRICKABLE_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
};

exports.postGenerate = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server.' });
    }

    const prompt = String(req.body.prompt || '').trim();
    const pieceCount = Number(req.body.pieceCount || 0);
    const collection = Array.isArray(req.body.collection) ? req.body.collection : [];

    if (!prompt || !pieceCount) {
      return res.status(400).json({ error: 'Missing prompt or pieceCount.' });
    }

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    async function callGemini(shortMode) {
      const partsLimit = shortMode ? 6 : 12;
      const voxelLimit = shortMode ? 20 : 40;
      const userPrompt = [
        'You are BrickSmith, a LEGO set designer.',
        `Create a build plan for: "${prompt}".`,
        `Target piece count: ${pieceCount}.`,
        collection.length
          ? `User collection (prefer these sets/parts): ${collection.map((set) => `${set.name} (${set.id})`).join(', ')}.`
          : 'User collection is empty.',
        'Return ONLY valid JSON with keys: summary, parts, voxels.',
        'summary must include: name (string), theme (string), difficulty (string), pieceCount (number), estimatedCost (number).',
        `parts is an array of up to ${partsLimit} items with: name (string), color (string), qty (number), price (number).`,
        `voxels is an array of up to ${voxelLimit} items, each voxel is an array: [x,y,z,color].`,
        'Use integers for x,y,z and a hex color like #FFAA00.',
        'Do not include markdown or extra text. Minify JSON on a single line and keep it under 1200 characters.'
      ].join(' ');

      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
          maxOutputTokens: shortMode ? 600 : 1200,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part) => part.text || '').join('');
      return text;
    }

    function parseJson(text) {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (err) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            return JSON.parse(text.slice(start, end + 1));
          } catch (innerErr) {
            return null;
          }
        }
        return null;
      }
    }

    let rawText;
    try {
      rawText = await callGemini(false);
    } catch (err) {
      return res.status(502).json({ error: 'Gemini API error', detail: err.message || String(err) });
    }

    let payload = parseJson(rawText);
    if (!payload) {
      try {
        const shortText = await callGemini(true);
        payload = parseJson(shortText);
        if (!payload) {
          return res.status(502).json({ error: 'Gemini response was not valid JSON.', detail: shortText });
        }
      } catch (err) {
        return res.status(502).json({ error: 'Gemini response was not valid JSON.', detail: rawText });
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error generating build.' });
  }
};
