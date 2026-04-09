require('dotenv').config();
const { loadPrompt } = require('../utils/prompt-loader');

const GRADING_SYSTEM_PROMPT = loadPrompt(
  'system/grading.md',
  'You are an expert university exam grader. Return strict, fair grading JSON.'
);

function buildGradingPrompt({ questionNo, questionText, maxMarks, keyPoints, gradingNotes, studentAnswer }) {
  const bullets = (keyPoints || []).map((p, i) =>
    `  ${i + 1}. ${p.point} — [${p.marks} mark${p.marks !== 1 ? 's' : ''}]`
  ).join('\n') || '  (No explicit key points — use your judgment based on question)';
  const notes = (gradingNotes || '').trim();
  const totalKeyMarks = (keyPoints || []).reduce((s, p) => s + (parseFloat(p.marks) || 0), 0);

  return `═══════════════════════════════════════
QUESTION ${questionNo} — Grade this answer
═══════════════════════════════════════

QUESTION TEXT:
${questionText}

MAXIMUM MARKS: ${maxMarks}
${totalKeyMarks !== maxMarks ? `(Key points sum to ${totalKeyMarks} marks)` : ''}

RUBRIC KEY POINTS (grade against each one):
${bullets}
${notes ? `\nSPECIAL GRADING INSTRUCTIONS:\n${notes}` : ''}

═══════════════════════════════════════
STUDENT'S ANSWER (OCR-extracted from PDF):
═══════════════════════════════════════

${studentAnswer}

═══════════════════════════════════════
INSTRUCTIONS: 
1. First, locate and extract ONLY the answer for Question ${questionNo} from the text above
2. Grade each key point individually
3. Sum up the marks
4. Write detailed feedback
5. Return JSON as specified in the system prompt
═══════════════════════════════════════`;
}

class LLMService {
  constructor() {
    this.apiKey = process.env.HF_REASONING_TOKEN || process.env.HF_TOKEN || '';
    this.provider = process.env.HF_REASONING_PROVIDER || process.env.HF_PROVIDER || 'auto';
    this.model = process.env.REASONING_MODEL || process.env.LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
    this.fallbackModels = (
      process.env.REASONING_FALLBACK_MODELS ||
      process.env.LLM_FALLBACK_MODELS ||
      'Qwen/Qwen2.5-3B-Instruct'
    ).split(',').map(s => s.trim()).filter(Boolean);
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '60000', 10);
    this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES || '5', 10);
  }

  async gradeAnswer({ questionNo, questionText, maxMarks, keyPoints, gradingNotes, studentAnswer }) {
    const answer = (studentAnswer || '').trim();
    if (!answer) {
      return {
        score: 0, feedback: 'No readable answer text was extracted.',
        matched_points: [], missing_points: ['No answer text available'],
        confidence: 0.1, raw_response: '',
      };
    }

    if (!this.apiKey) {
      return this._heuristicGrade(maxMarks, keyPoints, answer);
    }

    const prompt = buildGradingPrompt({ questionNo, questionText, maxMarks, keyPoints, gradingNotes, studentAnswer: answer });

    try {
      const raw = await this._callChat([
        { role: 'system', content: GRADING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ], 0, 2000);

      const parsed = this._parseJson(raw);
      if (!parsed) {
        const h = this._heuristicGrade(maxMarks, keyPoints, answer);
        h.feedback += ' LLM returned non-JSON; heuristic fallback applied.';
        h.raw_response = raw.slice(0, 6000);
        return h;
      }

      return {
        score: Math.min(Math.max(parseFloat(parsed.score) || 0, 0), maxMarks),
        feedback: (parsed.feedback || '').trim() || 'No feedback returned.',
        matched_points: Array.isArray(parsed.matched_points) ? parsed.matched_points.map(String) : [],
        missing_points: Array.isArray(parsed.missing_points) ? parsed.missing_points.map(String) : [],
        confidence: Math.min(Math.max(parseFloat(parsed.confidence) || 0.4, 0), 1),
        raw_response: raw.slice(0, 6000),
      };
    } catch (err) {
      const h = this._heuristicGrade(maxMarks, keyPoints, answer);
      h.feedback += ` LLM error: ${err.message}. Heuristic fallback applied.`;
      return h;
    }
  }

  async chat(messages, systemPrompt = '') {
    if (!this.apiKey) {
      throw new Error('LLM API key is missing. Set HF_REASONING_TOKEN or HF_TOKEN in .env.');
    }
    const full = [];
    if (systemPrompt) full.push({ role: 'system', content: systemPrompt });
    full.push(...messages);
    return this._callChat(full, 0.2, 1200);
  }

  async _callChat(messages, temperature, maxTokens) {
    const models = [this.model, ...this.fallbackModels.filter(m => m !== this.model)];

    for (const model of models) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.timeout);

          const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model, provider: this.provider,
              messages, temperature, max_tokens: maxTokens,
            }),
          });

          clearTimeout(timer);
          if (!resp.ok) {
            const status = resp.status;
            if ([408, 429, 500, 502, 503].includes(status) && attempt < this.maxRetries) {
              await this._sleep(Math.min(20000, 2 ** (attempt - 1) * 1000));
              continue;
            }
            throw new Error(`API error ${status}`);
          }

          const json = await resp.json();
          const content = json?.choices?.[0]?.message?.content || '';
          if (content.trim()) return content;
          break;
        } catch (err) {
          if (attempt < this.maxRetries && (err.name === 'AbortError' || err.message.includes('timeout'))) {
            await this._sleep(2 ** (attempt - 1) * 1000);
            continue;
          }
          if (attempt >= this.maxRetries) throw err;
        }
      }
    }
    throw new Error('All models failed.');
  }

  _heuristicGrade(maxMarks, keyPoints, answer) {
    const lower = answer.toLowerCase();
    const matched = [], missing = [];
    let score = 0;

    if (!keyPoints || keyPoints.length === 0) {
      const ratio = Math.min(1, answer.split(/\s+/).length / 100);
      return {
        score: Math.round(maxMarks * ratio * 100) / 100,
        feedback: 'No key points supplied; score estimated from answer length.',
        matched_points: [], missing_points: [],
        confidence: 0.3, raw_response: '',
      };
    }

    for (const kp of keyPoints) {
      const text = (kp.point || '').trim();
      const marks = parseFloat(kp.marks) || 0;
      const keywords = text.toLowerCase().match(/[a-z]{4,}/g) || [];
      const stop = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'into', 'using', 'should', 'which', 'their', 'there', 'about']);
      const filtered = keywords.filter(w => !stop.has(w)).slice(0, 6);

      if (filtered.length && filtered.some(kw => lower.includes(kw))) {
        matched.push(text);
        score += marks;
      } else {
        missing.push(text);
      }
    }

    return {
      score: Math.min(Math.round(score * 100) / 100, maxMarks),
      feedback: 'Heuristic keyword matching was used to estimate marks.',
      matched_points: matched, missing_points: missing,
      confidence: 0.35, raw_response: '',
    };
  }

  _parseJson(text) {
    try {
      let cleaned = (text || '').trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch { return null; }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = LLMService;
