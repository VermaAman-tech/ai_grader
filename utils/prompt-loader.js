const fs = require('fs');
const path = require('path');

function loadPrompt(relativePath, fallback = '') {
  const filePath = path.resolve(__dirname, '..', 'prompts', relativePath);
  try {
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (text) return text;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[prompt-loader] Could not load ${relativePath}: ${err.message}`);
    }
  }
  return (fallback || '').trim();
}

module.exports = { loadPrompt };
