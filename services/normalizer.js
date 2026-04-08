function linearScale(scores, targetMin, targetMax) {
  const min = Math.min(...scores.map(s => s.pct));
  const max = Math.max(...scores.map(s => s.pct));
  if (max === min) return scores.map(s => ({ ...s, normalizedPct: targetMin }));

  return scores.map(s => {
    const normalized = targetMin + ((s.pct - min) / (max - min)) * (targetMax - targetMin);
    return { ...s, normalizedPct: Math.round(normalized * 100) / 100 };
  });
}

function stdDevCurve(scores, targetMean, targetStd) {
  const mean = scores.reduce((s, x) => s + x.pct, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, x) => s + (x.pct - mean) ** 2, 0) / scores.length) || 1;

  return scores.map(s => {
    const z = (s.pct - mean) / std;
    const normalized = Math.max(0, Math.min(100, targetMean + z * targetStd));
    return { ...s, normalizedPct: Math.round(normalized * 100) / 100 };
  });
}

function percentileBased(scores) {
  const sorted = [...scores].sort((a, b) => a.pct - b.pct);
  const n = sorted.length;
  return sorted.map((s, i) => ({
    ...s,
    normalizedPct: Math.round(((i + 1) / n) * 100 * 100) / 100,
    percentileRank: Math.round(((i + 1) / n) * 100),
  }));
}

function applyBoundaries(scores, boundaries) {
  return scores.map(s => {
    const pct = s.normalizedPct !== undefined ? s.normalizedPct : s.pct;
    const grade = boundaries.find(b => pct >= b.min_pct && pct <= b.max_pct);
    return { ...s, grade: grade?.label || 'N/A', gradeColor: grade?.color || '#666' };
  });
}

function getDefaultBoundaries() {
  return [
    { label: 'A+', min_pct: 90, max_pct: 100, color: '#1a7d3f' },
    { label: 'A',  min_pct: 80, max_pct: 89.99, color: '#2d8f4e' },
    { label: 'B+', min_pct: 70, max_pct: 79.99, color: '#3a9d5c' },
    { label: 'B',  min_pct: 60, max_pct: 69.99, color: '#5b8fd9' },
    { label: 'C',  min_pct: 50, max_pct: 59.99, color: '#b08600' },
    { label: 'D',  min_pct: 40, max_pct: 49.99, color: '#d4760a' },
    { label: 'F',  min_pct: 0,  max_pct: 39.99, color: '#ba1a1a' },
  ];
}

module.exports = { linearScale, stdDevCurve, percentileBased, applyBoundaries, getDefaultBoundaries };
