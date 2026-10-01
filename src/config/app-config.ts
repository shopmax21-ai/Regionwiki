import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Region WIKI",
  version: packageJson.version,
  copyright: `© ${currentYear}, Region WIKI.`,
  meta: {
    title: "Region WIKI",
    description: "Region WIKI — сервис для управления региональной информацией.",
  },
};
