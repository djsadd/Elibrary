export interface UsefulLink {
  title: string;
  url: string;
}

export const USEFUL_LINK_CATEGORY_IDS = ["misc", "periodicals", "official_kz", "e_libraries"] as const;
export type UsefulLinkCategoryId = (typeof USEFUL_LINK_CATEGORY_IDS)[number];

export const USEFUL_LINK_CATEGORIES: Array<{ id: UsefulLinkCategoryId; labelKey: string }> = [
  { id: "misc", labelKey: "publicHome.usefulLinks.categories.misc" },
  { id: "periodicals", labelKey: "publicHome.usefulLinks.categories.periodicals" },
  { id: "official_kz", labelKey: "publicHome.usefulLinks.categories.officialKz" },
  { id: "e_libraries", labelKey: "publicHome.usefulLinks.categories.eLibraries" },
];

export const USEFUL_LINKS_BY_CATEGORY: Record<UsefulLinkCategoryId, UsefulLink[]> = {
  misc: [
    { title: "Международный казахский сервер", url: "http://www.kazakh.ru" },
    { title: 'Портал "История Казахстана"', url: "http://e-history.kz" },
    { title: "Шежіре: генеология казахов", url: "http://www.elim.kz" },
    { title: "История и культура Казахстана", url: "http://www.heritagenet.unesco.kz" },
    { title: "Литературный портал", url: "http://adebiportal.kz" },
    { title: "Портал «Жизнь замечательных людей Казахстана»", url: "http://www.zzl.kz" },
    { title: "Культурное наследие Казахстана", url: "http://www.madenimura.kz" },
    { title: "Отүкен — казахская культура и мифология", url: "http://www.otuken.kz" },
    { title: "Онлайн переводчик", url: "http://www.sozdik.kz" },
    {
      title:
        '«Литературный Казахстан» (народная площадка литературно-художественного журнала "Простор")',
      url: "http://almaty-lit.ucoz.ru",
    },
    { title: "Казахское географическое общество", url: "http://kazgeo.kz" },
  ],
  periodicals: [],
  official_kz: [],
  e_libraries: [],
};

export function isUsefulLinkCategoryId(value: string | undefined): value is UsefulLinkCategoryId {
  return !!value && (USEFUL_LINK_CATEGORY_IDS as readonly string[]).includes(value);
}

