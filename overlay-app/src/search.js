/* Поиск по правилам: номер пункта («ОП 1.19», «1.19») и обычные слова с учётом окончаний. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RuleSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9.\s-]/g, " ");

  /* Неверная раскладка: «jkhjkj» ↔ «огрбление» (QWERTY ↔ ЙЦУКЕН). Конвертируем сырой запрос до normalize, пока знаки ; ' , [ ] ещё на месте. */
  const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,`";
  const RU = "йцукенгшщзхъфывапролджэячсмитьбё";
  const EN_TO_RU = new Map([...EN].map((ch, i) => [ch, RU[i]]));
  const RU_TO_EN = new Map([...RU].map((ch, i) => [ch, EN[i]]));
  const isLatin = (ch) => /[a-z]/i.test(ch || "");

  /** Запрос, набранный в другой раскладке, или null, если менять нечего (цифры, смешанный ввод). */
  function swapLayout(rawQuery) {
    const text = String(rawQuery || "").toLowerCase();
    const hasLatin = /[a-z]/.test(text);
    const hasCyrillic = /[а-яё]/.test(text);
    if (hasLatin === hasCyrillic) return null;
    let out = "";
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (hasLatin) {
        // «.» и «,» в середине слова — это «ю» и «б»; рядом с цифрами остаются знаками (1.19)
        if ((ch === "." || ch === ",") && !(isLatin(text[i - 1]) || isLatin(text[i + 1]))) out += ch;
        else if (ch === "." && !(isLatin(text[i - 1]) && isLatin(text[i + 1]))) out += ch;
        else out += ch === "." ? "ю" : (EN_TO_RU.get(ch) ?? ch);
      } else {
        out += RU_TO_EN.get(ch) ?? ch;
      }
    }
    return out === text ? null : out;
  }

  /** Оставляем запрос как есть; конвертируем раскладку, только если иначе ничего не найдётся. */
  function pickQuery(rawQuery, haystacks) {
    const alt = swapLayout(rawQuery);
    if (!alt) return rawQuery;
    const hits = (query) => {
      const words = tokenize(query).filter((word) => !STOP.has(word)).map(stem);
      return words.length > 0 && haystacks.some((hay) => words.every((word) => normalize(hay).includes(word)));
    };
    return hits(rawQuery) ? rawQuery : hits(alt) ? alt : rawQuery;
  }

  /* Грубая основа: отбрасываем окончание у длинных слов, чтобы «грабёж» находил «ограбление». */
  const stem = (word) => {
    if (/^\d/.test(word) || word.length <= 3) return word;
    return word.slice(0, Math.max(3, Math.min(5, word.length - 1)));
  };

  const tokenize = (value) =>
    normalize(value)
      .split(/\s+/)
      .map((word) => word.replace(/^[-.]+|[-.]+$/g, ""))
      .filter(Boolean);

  const STOP = new Set(["и", "в", "на", "по", "за", "не", "что", "как", "это", "из", "от", "до", "для", "при", "или", "с", "к", "у", "о", "а", "но"]);

  function buildIndex(rules) {
    return rules.map((rule) => {
      const notes = (rule.notes || []).map((note) => `${note.label} ${note.text}`).join(" ");
      const items = (rule.items || []).join(" ");
      const punishments = (rule.punishments || []).join(" ");
      return {
        rule,
        tag: normalize(rule.tag),
        number: String(rule.number || ""),
        text: normalize(rule.text),
        items: normalize(items),
        punishments: normalize(punishments),
        notes: normalize(notes),
        section: normalize(`${rule.section} ${rule.article}`),
      };
    });
  }

  const REF = /^([a-zа-я]{0,6})?\s*(\d+(?:\.\d+)*)$/;

  function searchOne(index, rawQuery, limit) {
    const query = normalize(rawQuery).trim();
    if (!query) return [];

    const ref = query.match(REF);
    if (ref) {
      const tag = ref[1] || "";
      const number = ref[2];
      const hits = [];
      for (const entry of index) {
        if (tag && !entry.tag.startsWith(tag)) continue;
        let score = 0;
        if (entry.number === number) score = 100;
        else if (entry.number.startsWith(`${number}.`)) score = 60;
        else if (!number.includes(".") && entry.number.startsWith(number)) score = 30;
        if (score) hits.push({ rule: entry.rule, score: score + (tag && entry.tag === tag ? 5 : 0) });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    const words = tokenize(query).filter((word) => !STOP.has(word));
    if (words.length === 0) return [];
    const stems = words.map(stem);

    const hits = [];
    for (const entry of index) {
      let score = 0;
      let matched = 0;
      for (const s of stems) {
        let best = 0;
        if (entry.text.includes(s)) best = 10;
        else if (entry.punishments.includes(s)) best = 6;
        else if (entry.items.includes(s)) best = 5;
        else if (entry.notes.includes(s)) best = 4;
        else if (entry.section.includes(s)) best = 2;
        if (best) matched += 1;
        score += best;
      }
      if (matched === 0) continue;
      // Нужны все слова запроса; если слов много, допускаем один промах
      if (matched < stems.length - (stems.length >= 4 ? 1 : 0)) continue;
      if (entry.text.includes(normalize(query))) score += 15;
      hits.push({ rule: entry.rule, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  function search(index, rawQuery, limit = 40) {
    const first = searchOne(index, rawQuery, limit);
    if (first.length > 0) return first;
    const alt = swapLayout(rawQuery);
    return alt ? searchOne(index, alt, limit) : first;
  }

  function highlightPattern(rawQuery) {
    const alt = swapLayout(rawQuery);
    const words = tokenize(alt ? `${rawQuery} ${alt}` : rawQuery).filter((word) => !STOP.has(word) && !/^\d/.test(word));
    if (words.length === 0) return null;
    const parts = words.map((word) => stem(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]"));
    return new RegExp(`(${parts.join("|")})[а-яёa-z0-9]*`, "gi");
  }

  const ruleRef = (rule) => (rule.tag ? `${rule.tag} ${rule.number}` : rule.number);

  return { buildIndex, search, highlightPattern, ruleRef, normalize, stem, swapLayout, pickQuery };
});
