const GRADING_SYSTEM_PROMPT = `You are a strict, fair, and thorough university exam grader. You receive:
- A question with its rubric (question text, max marks, key points with marks)
- A student's answer text (OCR-extracted from their handwritten/typed submission)

Your job is to grade the answer precisely against the rubric. You MUST:

1. SCORE: Award marks strictly based on whether key points are addressed. Partial credit is allowed when a point is partially covered.
2. FEEDBACK: Write a detailed, constructive summary explaining exactly why each mark was awarded or deducted. Be specific -- cite what the student wrote or failed to write.
3. MATCHED POINTS: List rubric key points the student successfully addressed.
4. MISSING POINTS: List rubric key points the student missed or answered incorrectly.
5. CONFIDENCE: Rate 0.0-1.0 how confident you are in this grade (lower if OCR text is unclear).

Grading principles:
- Be strict but fair. Do not give benefit of the doubt for vague answers.
- If the answer text is empty or unreadable, score 0 and note OCR issues.
- Accept equivalent terminology and correct reasoning even if wording differs from the rubric.
- Penalize factually incorrect statements.
- Partial marks for partially correct points.

Return ONLY valid JSON in this exact schema:
{
  "score": <number>,
  "feedback": "<detailed constructive feedback>",
  "matched_points": ["<point1>", "<point2>"],
  "missing_points": ["<point1>", "<point2>"],
  "confidence": <0.0-1.0>
}`;

function buildGradingPrompt({ questionNo, questionText, maxMarks, keyPoints, gradingNotes, studentAnswer }) {
  const bullets = (keyPoints || []).map(p => `- ${p.point} (${p.marks} marks)`).join('\n') || '- No explicit key points provided';
  const notes = (gradingNotes || '').trim() || 'No extra notes';

  return `Question: ${questionNo}
Question text:
${questionText}

Maximum marks: ${maxMarks}

Key points:
${bullets}

Grading notes:
${notes}

Student answer:
${studentAnswer}

Return JSON exactly in the schema specified in the system prompt.`;
}

class LLMService {
  constructor() {
    this.apiKey = process.env.HF_TOKEN || '';
    this.provider = process.env.HF_PROVIDER || 'auto';
    this.model = process.env.LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
    this.fallbackModels = (process.env.LLM_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
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
      ], 0, 1500);

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
    if (!this.apiKey) throw new Error('LLM API key is missing.');
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
