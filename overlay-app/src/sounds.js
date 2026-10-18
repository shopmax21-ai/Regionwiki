/* Короткие сигналы без файлов: у каждого события свой мотив, общая громкость задаётся в настройках. */
(() => {
  let ctx = null;
  // [частота Гц, задержка с, длительность с]
  const PATTERNS = {
    new: { wave: "sine", notes: [[740, 0, 0.22], [988, 0.12, 0.3]] },            // новая заявка: два восходящих тона
    ok: { wave: "sine", notes: [[659, 0, 0.18], [784, 0.11, 0.18], [1047, 0.22, 0.34]] }, // выдано: мажорное арпеджио
    bad: { wave: "triangle", notes: [[330, 0, 0.22], [247, 0.16, 0.38]] },       // отказ: нисходящий низкий
    info: { wave: "sine", notes: [[880, 0, 0.26]] },                              // взяли в работу: один мягкий тон
  };

  function play(type, volume) {
    const pattern = PATTERNS[type];
    if (!pattern) return;
    const level = Math.max(0, Math.min(1, Number.isFinite(Number(volume)) ? Number(volume) : 0.6));
    if (level === 0) return;
    try {
      ctx = ctx || new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      for (const [freq, delay, length] of pattern.notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = pattern.wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.32 * level + 0.0001, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + length);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + length + 0.05);
      }
    } catch { /* звук необязателен */ }
  }

  window.OverlaySounds = { play, types: Object.keys(PATTERNS) };
})();
