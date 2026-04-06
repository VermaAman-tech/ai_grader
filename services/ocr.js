const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

class OCRService {
  constructor() {
    this.minTextChars = parseInt(process.env.OCR_MIN_TEXT_CHARS || '20', 10);
    this.apiKey = process.env.HF_TOKEN || '';
    this.ocrModel = process.env.OCR_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';
    this.ocrTimeout = parseInt(process.env.OCR_TIMEOUT || '90000', 10);
    this.provider = process.env.HF_PROVIDER || 'auto';
  }

  async extractPages(pdfPath) {
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);

    const rawText = data.text || '';
    const pageTexts = this._splitByPages(rawText, data.numpages);

    const pages = [];
    for (let i = 0; i < data.numpages; i++) {
      let text = (pageTexts[i] || '').trim();
      if (text.length < this.minTextChars && this.apiKey) {
        const visionText = await this._ocrWithVision(buffer, i + 1);
        if (visionText.trim().length > text.length) text = visionText.trim();
      }
      pages.push({ pageNumber: i + 1, text: this._normalize(text) });
    }
    return pages;
  }

  _splitByPages(fullText, numPages) {
    if (numPages <= 1) return [fullText];
    const lines = fullText.split('\n');
    const perPage = Math.ceil(lines.length / numPages);
    const pages = [];
    for (let i = 0; i < numPages; i++) {
      pages.push(lines.slice(i * perPage, (i + 1) * perPage).join('\n'));
    }
    return pages;
  }

  detectQuestionPages(pages, questionNo) {
    const patterns = this._buildPatterns(questionNo);
    const detected = [];
    for (const page of pages) {
      const lower = page.text.toLowerCase();
      if (patterns.some(p => p.test(lower))) {
        detected.push(page.pageNumber);
      }
    }
    return detected;
  }

  collectAnswerText(pages, pageNumbers) {
    const lookup = Object.fromEntries(pages.map(p => [p.pageNumber, p.text]));
    const chunks = [];
    for (const num of [...new Set(pageNumbers)].sort((a, b) => a - b)) {
      const text = (lookup[num] || '').trim();
      if (text) chunks.push(`[Page ${num}]\n${text}`);
    }
    return chunks.join('\n\n');
  }

  async _ocrWithVision(pdfBuffer, pageNum) {
    if (!this.apiKey) return '';
    try {
      const base64 = pdfBuffer.toString('base64');
      const url = `https://router.huggingface.co/v1/chat/completions`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.ocrTimeout);

      const resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ocrModel,
          provider: this.provider,
          temperature: 0,
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `Extract all readable text from page ${pageNum} of this document. Return plain text only. Preserve line breaks and answer structure. Do not summarize.` },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          }],
        }),
      });

      clearTimeout(timeout);
      if (!resp.ok) return '';
      const json = await resp.json();
      return json?.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }

  _buildPatterns(questionNo) {
    const normalized = questionNo.trim().toLowerCase().replace(/\s+/g, '');
    const token = normalized.startsWith('q') ? normalized.slice(1) : normalized;
    return [
      new RegExp(`\\b${this._escapeRegex(normalized)}\\b`, 'i'),
      new RegExp(`\\bq\\s*${this._escapeRegex(token)}\\b`, 'i'),
      new RegExp(`\\bquestion\\s*${this._escapeRegex(token)}\\b`, 'i'),
    ];
  }

  _escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  _normalize(t) { return (t || '').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
}

module.exports = OCRService;
