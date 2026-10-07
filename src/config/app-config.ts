import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

/** Адрес сайта берётся из SITE_URL (например, https://wiki.example.com), без завершающего слэша. */
const siteUrl = (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

export const APP_CONFIG = {
  name: "Region WIKI",
  version: packageJson.version,
  siteUrl,
  copyright: `© ${currentYear}, Region WIKI.`,
  meta: {
    title: "Region WIKI",
    description: "База знаний для игроков проекта Region: правила, работы, транспорт, недвижимость, карта.",
  },
};
