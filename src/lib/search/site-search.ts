import {
  type Business,
  businessTitle,
  formatPrice as formatBusinessPrice,
} from "@/app/(main)/(dashboard)/business/_data/businesses";
import { type Job, jobKinds, jobText } from "@/app/(main)/(dashboard)/jobs/_data/jobs";
import type { MapPlace } from "@/app/(main)/(dashboard)/map/_components/map-data";
import {
  formatPrice as formatRealtyPrice,
  type Realty,
  realtyTitle,
} from "@/app/(main)/(dashboard)/real-estate/_data/realties";
import { terms } from "@/app/(main)/(dashboard)/rp-terms/_data/terms";
import { getSearchIndex } from "@/app/(main)/(dashboard)/rules/_components/rules-content";
import {
  articleHref,
  formatRuleRef,
  ruleExtraText,
  ruleGroups,
} from "@/app/(main)/(dashboard)/rules/_components/rules-meta";
import {
  formatPrice as formatVehiclePrice,
  type Vehicle,
  vehicleTitle,
} from "@/app/(main)/(dashboard)/transport/_data/vehicles";
import { isPathVisible } from "@/lib/auth/protected-paths";
import { getBusinessesVersion, listBusinesses } from "@/lib/businesses/store";
import { getJobsVersion, listJobs } from "@/lib/jobs/store";
import { getMapPlacesVersion, listMapPlaces } from "@/lib/map/store";
import { getRealtiesVersion, listRealties } from "@/lib/realties/store";
import { getRulesVersion } from "@/lib/rules/store";
import { getVehiclesVersion, listVehicles } from "@/lib/vehicles/store";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

import { normalizeText as normalize, toSearchTerms } from "./terms";
import { type SearchGroup, type SearchHit, type SearchKind, searchKindLabels, searchKindOrder } from "./types";

/**
 * Поиск по всем разделам сайта. Работает только на сервере: полный текст правил не уходит в браузер.
 * Индекс собирается один раз при первом запросе и дальше живёт в памяти процесса.
 */

type IndexEntry = SearchHit & {
  /** Заголовок для поиска (в нижнем регистре, без «ё») */
  titleKey: string;
  /** Полный текст для поиска (в нижнем регистре, без «ё») */
  bodyKey: string;
  /** Исходный текст для фрагмента */
  body: string;
  /** Базовый вес вида: разделы выше пунктов правил */
  weight: number;
};

function entry(hit: SearchHit, options: { body?: string; extraKeys?: string; weight?: number } = {}): IndexEntry {
  const body = options.body ?? "";
  return {
    ...hit,
    titleKey: normalize(`${hit.title} ${hit.subtitle ?? ""} ${options.extraKeys ?? ""}`),
    bodyKey: normalize(body),
    body,
    weight: options.weight ?? 0,
  };
}

function buildSections(): IndexEntry[] {
  const result: IndexEntry[] = [];
  for (const group of sidebarItems) {
    for (const item of group.items) {
      if (item.disabled) continue;
      if ("url" in item && item.url) {
        result.push(
          entry(
            { id: `section-${item.id}`, kind: "section", title: item.title, subtitle: group.label, href: item.url },
            { weight: 30 },
          ),
        );
      }
    }
  }
  return result;
}

async function buildRules(): Promise<IndexEntry[]> {
  const result: IndexEntry[] = [];

  for (const group of ["general", "government"] as const) {
    for (const article of ruleGroups[group].articles) {
      result.push(
        entry(
          {
            id: `rule-article-${group}-${article.slug}`,
            kind: "rule",
            title: article.title,
            subtitle: `${ruleGroups[group].title} · раздел`,
            href: articleHref(group, article.slug),
          },
          { body: article.description, extraKeys: article.tag, weight: 25 },
        ),
      );
    }

    for (const rule of await getSearchIndex(group)) {
      const body = [rule.text, ruleExtraText(rule), rule.punishments.join(" ")].filter(Boolean).join(" ");
      const ref = formatRuleRef(rule.tag, rule.number);
      result.push(
        entry(
          {
            id: `rule-${group}-${rule.slug}-${rule.anchor}`,
            kind: "rule",
            title: `${ref}. ${rule.text.length > 110 ? `${rule.text.slice(0, 107).trimEnd()}…` : rule.text}`,
            subtitle: `${rule.articleTitle} · ${rule.sectionTitle}`,
            href: `${articleHref(group, rule.slug)}#${rule.anchor}`,
          },
          { body, extraKeys: `${ref} ${rule.number}`, weight: 0 },
        ),
      );
    }
  }

  return result;
}

function buildJobs(jobs: Job[]): IndexEntry[] {
  return jobs.map((job) =>
    entry(
      {
        id: `job-${job.slug}`,
        kind: "job",
        title: job.title,
        subtitle: `${jobKinds[job.kind].title} · ${job.tagline}`,
        href: `/jobs/${job.slug}`,
      },
      { body: jobText(job), weight: 20 },
    ),
  );
}

function buildVehicles(vehicles: Vehicle[]): IndexEntry[] {
  return vehicles.map((vehicle) =>
    entry(
      {
        id: `vehicle-${vehicle.code}`,
        kind: "vehicle",
        title: vehicleTitle(vehicle),
        subtitle: `${vehicle.category} · ${formatVehiclePrice(vehicle.price)}`,
        href: `/transport/${vehicle.code}`,
      },
      {
        body: [vehicle.code, vehicle.fuel, ...vehicle.sources, ...(vehicle.upgrades?.map((u) => u.name) ?? [])].join(
          " ",
        ),
        weight: 15,
      },
    ),
  );
}

function buildBusinesses(businesses: Business[]): IndexEntry[] {
  return businesses.map((business) => {
    const title = businessTitle(business);
    return entry(
      {
        id: `business-${business.category}-${business.id}`,
        kind: "business",
        title,
        subtitle: formatBusinessPrice(business.price),
        href: `/business?q=${encodeURIComponent(title)}`,
      },
      { weight: 5 },
    );
  });
}

function buildRealties(realties: Realty[]): IndexEntry[] {
  return realties.map((realty) => {
    const title = realtyTitle(realty);
    return entry(
      {
        id: `realty-${realty.id}`,
        kind: "realty",
        title,
        subtitle: `${formatRealtyPrice(realty.price)} · гаражей: ${realty.garage}${realty.residents ? ` · жильцов: ${realty.residents}` : ""}`,
        href: `/real-estate?q=${encodeURIComponent(String(realty.id))}`,
      },
      { extraKeys: realty.category, weight: 5 },
    );
  });
}

function buildTerms(): IndexEntry[] {
  return terms.map((item) =>
    entry(
      {
        id: `term-${item.id}`,
        kind: "term",
        title: item.term,
        subtitle: item.title,
        href: `/rp-terms?q=${encodeURIComponent(item.term)}`,
      },
      { body: `${item.description} ${item.example ?? ""}`, weight: 10 },
    ),
  );
}

function buildPlaces(places: MapPlace[]): IndexEntry[] {
  return places.map((place) =>
    entry(
      { id: `place-${place.id}`, kind: "place", title: place.name, subtitle: "Метка на карте", href: "/map" },
      { body: place.description, weight: 12 },
    ),
  );
}

let cache: { sections: IndexEntry[]; after: IndexEntry[] } | null = null;
let jobCache: { version: number; at: number; entries: IndexEntry[] } | null = null;
let rulesCache: { version: string; entries: IndexEntry[] } | null = null;
let vehicleCache: { version: number; at: number; entries: IndexEntry[] } | null = null;
let placeCache: { version: number; at: number; entries: IndexEntry[] } | null = null;
let businessCache: { version: number; at: number; entries: IndexEntry[] } | null = null;
let realtyCache: { version: number; at: number; entries: IndexEntry[] } | null = null;

const VEHICLE_CACHE_MS = 60_000;

// Работы тоже лежат в базе и меняются администратором: индекс обновляется после любой записи и раз в минуту.
async function getJobEntries(): Promise<IndexEntry[]> {
  const version = getJobsVersion();
  if (jobCache && jobCache.version === version && Date.now() - jobCache.at < VEHICLE_CACHE_MS) return jobCache.entries;
  const { jobs } = await listJobs();
  jobCache = { version, at: Date.now(), entries: buildJobs(jobs) };
  return jobCache.entries;
}

// Транспорт лежит в базе и меняется администратором, поэтому его записи обновляются отдельно от остального индекса.
async function getVehicleEntries(): Promise<IndexEntry[]> {
  const version = getVehiclesVersion();
  if (vehicleCache && vehicleCache.version === version && Date.now() - vehicleCache.at < VEHICLE_CACHE_MS) {
    return vehicleCache.entries;
  }
  const { vehicles } = await listVehicles();
  vehicleCache = { version, at: Date.now(), entries: buildVehicles(vehicles) };
  return vehicleCache.entries;
}

// Бизнесы и недвижимость тоже лежат в базе и меняются администрацией: индекс обновляется после любой записи и раз в минуту.
async function getBusinessEntries(): Promise<IndexEntry[]> {
  const version = getBusinessesVersion();
  if (businessCache && businessCache.version === version && Date.now() - businessCache.at < VEHICLE_CACHE_MS) {
    return businessCache.entries;
  }
  const { businesses } = await listBusinesses();
  businessCache = { version, at: Date.now(), entries: buildBusinesses(businesses) };
  return businessCache.entries;
}

async function getRealtyEntries(): Promise<IndexEntry[]> {
  const version = getRealtiesVersion();
  if (realtyCache && realtyCache.version === version && Date.now() - realtyCache.at < VEHICLE_CACHE_MS) {
    return realtyCache.entries;
  }
  const { realties } = await listRealties();
  realtyCache = { version, at: Date.now(), entries: buildRealties(realties) };
  return realtyCache.entries;
}

// Метки карты лежат в базе и меняются администрацией, поэтому их записи тоже обновляются отдельно.
async function getPlaceEntries(): Promise<IndexEntry[]> {
  const version = getMapPlacesVersion();
  if (placeCache && placeCache.version === version && Date.now() - placeCache.at < VEHICLE_CACHE_MS) {
    return placeCache.entries;
  }
  const { places } = await listMapPlaces();
  placeCache = { version, at: Date.now(), entries: buildPlaces(places) };
  return placeCache.entries;
}

// Правила лежат в собственной базе и обновляются фоновой проверкой: индекс пересобирается, когда меняется версия набора правил.
async function getRuleEntries(): Promise<IndexEntry[]> {
  const version = await getRulesVersion().catch(() => "");
  if (rulesCache && rulesCache.version === version) return rulesCache.entries;
  rulesCache = { version, entries: await buildRules() };
  return rulesCache.entries;
}

async function getIndex(): Promise<IndexEntry[]> {
  cache ??= {
    sections: buildSections(),
    after: buildTerms(),
  };
  return [
    ...cache.sections,
    ...(await getRuleEntries()),
    ...(await getJobEntries()),
    ...(await getVehicleEntries()),
    ...(await getPlaceEntries()),
    ...(await getBusinessEntries()),
    ...(await getRealtyEntries()),
    ...cache.after,
  ];
}

function score(item: IndexEntry, terms: string[], phrase: string): number {
  let total = item.weight;
  if (item.titleKey === phrase) total += 120;
  else if (item.titleKey.startsWith(phrase)) total += 70;
  else if (item.titleKey.includes(phrase)) total += 45;

  for (const term of terms) {
    if (item.titleKey.includes(term)) total += 14;
    // слово целиком, а не кусок слова
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`, "u").test(item.titleKey)) total += 8;
  }
  return total;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Кусок текста вокруг первого найденного слова */
function makeSnippet(body: string, terms: string[]): string | undefined {
  if (!body) return undefined;
  const key = normalize(body);
  let at = -1;
  for (const term of terms) {
    const index = key.indexOf(term);
    if (index !== -1 && (at === -1 || index < at)) at = index;
  }
  if (at === -1) return undefined;

  const start = Math.max(0, at - 60);
  const end = Math.min(body.length, at + 110);
  const text = body.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${end < body.length ? "…" : ""}`;
}

export async function searchSite(
  query: string,
  perGroup = 6,
  {
    authorized = false,
    isAdmin = false,
    permissions = [],
  }: { authorized?: boolean; isAdmin?: boolean; permissions?: readonly string[] } = {},
): Promise<{ total: number; groups: SearchGroup[] }> {
  const phrase = normalize(query.trim().replace(/\s+/g, " "));
  const terms = toSearchTerms(query);
  if (terms.length === 0) return { total: 0, groups: [] };

  const found = new Map<SearchKind, { item: IndexEntry; score: number }[]>();

  for (const item of await getIndex()) {
    if (!item.external && !isPathVisible(item.href, { authorized, isAdmin, permissions })) continue;
    const haystack = `${item.titleKey} ${item.bodyKey}`;
    if (!terms.every((term) => haystack.includes(term))) continue;
    const list = found.get(item.kind) ?? [];
    list.push({ item, score: score(item, terms, phrase) });
    found.set(item.kind, list);
  }

  const groups: SearchGroup[] = [];
  const topScore = new Map<SearchKind, number>();
  let total = 0;

  for (const kind of searchKindOrder) {
    const list = found.get(kind);
    if (!list?.length) continue;
    list.sort((a, b) => b.score - a.score);
    total += list.length;
    topScore.set(kind, list[0].score);

    groups.push({
      kind,
      label: searchKindLabels[kind],
      total: list.length,
      hits: list.slice(0, perGroup).map(({ item }) => {
        const inTitle = terms.every((term) => item.titleKey.includes(term));
        return {
          id: item.id,
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          snippet: inTitle ? undefined : makeSnippet(item.body, terms),
          href: item.href,
          external: item.external,
        };
      }),
    });
  }

  // Сверху — группа с самым подходящим результатом; при равенстве сохраняется обычный порядок
  groups.sort((a, b) => (topScore.get(b.kind) ?? 0) - (topScore.get(a.kind) ?? 0));

  return { total, groups };
}
