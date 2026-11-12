// Outils semaines ISO 8601 (lundi → dimanche), en UTC pour éviter les décalages d'heure d'été.

const DAY = 86400000;

export function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // jeudi de la semaine
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return { year, week };
}

export function isoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  return new Date(Date.UTC(year, 0, 4 - dow + 1 + (week - 1) * 7));
}

export function weeksInYear(year) {
  return isoWeekOf(new Date(Date.UTC(year, 11, 28))).week;
}

export function weekId(year, week) {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekId(id) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(id).trim());
  if (!m) throw new Error(`Identifiant de semaine invalide : "${id}" (attendu : AAAA-Wss, ex. 2026-W45)`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > weeksInYear(year)) throw new Error(`La semaine ${week} n'existe pas en ${year}`);
  return { year, week };
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Liste des semaines ISO entre deux identifiants inclus. */
export function weekRange(fromId, toId) {
  const from = parseWeekId(fromId);
  const to = parseWeekId(toId);
  const out = [];
  let cur = isoWeekStart(from.year, from.week);
  const end = isoWeekStart(to.year, to.week);
  while (cur <= end) {
    const { year, week } = isoWeekOf(cur);
    const start = new Date(cur);
    const sunday = new Date(cur.getTime() + 6 * DAY);
    const thursday = new Date(cur.getTime() + 3 * DAY);
    out.push({ id: weekId(year, week), year, week, start: isoDate(start), end: isoDate(sunday), month: thursday.getUTCMonth() });
    cur = new Date(cur.getTime() + 7 * DAY);
  }
  return out;
}

/** Dernière semaine complète (terminée) par rapport à une date. */
export function lastCompleteWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - 7 * DAY);
  const { year, week } = isoWeekOf(d);
  return weekId(year, week);
}
