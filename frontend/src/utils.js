// Country name -> ISO-3166 alpha-2. Covers every country in the coalition data
// (plus a few common extras that show up in events).
export const ISO2 = {
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  Canada: "CA",
  Italy: "IT",
  Spain: "ES",
  Poland: "PL",
  Turkey: "TR",
  Netherlands: "NL",
  Belgium: "BE",
  Norway: "NO",
  Denmark: "DK",
  Portugal: "PT",
  Greece: "GR",
  "Czech Republic": "CZ",
  Romania: "RO",
  Hungary: "HU",
  Bulgaria: "BG",
  Slovakia: "SK",
  Slovenia: "SI",
  Croatia: "HR",
  Albania: "AL",
  Montenegro: "ME",
  "North Macedonia": "MK",
  Estonia: "EE",
  Latvia: "LV",
  Lithuania: "LT",
  Luxembourg: "LU",
  Iceland: "IS",
  Finland: "FI",
  Sweden: "SE",
  Austria: "AT",
  Ireland: "IE",
  Malta: "MT",
  Cyprus: "CY",
  Brazil: "BR",
  Russia: "RU",
  India: "IN",
  China: "CN",
  "South Africa": "ZA",
  Iran: "IR",
  Egypt: "EG",
  Ethiopia: "ET",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  Argentina: "AR",
  Pakistan: "PK",
  Kazakhstan: "KZ",
  Uzbekistan: "UZ",
  Kyrgyzstan: "KG",
  Tajikistan: "TJ",
  Belarus: "BY",
  Qatar: "QA",
  Kuwait: "KW",
  Bahrain: "BH",
  Oman: "OM",
  Indonesia: "ID",
  Malaysia: "MY",
  Philippines: "PH",
  Singapore: "SG",
  Thailand: "TH",
  Vietnam: "VN",
  Myanmar: "MM",
  Cambodia: "KH",
  Laos: "LA",
  Brunei: "BN",
  Nigeria: "NG",
  Kenya: "KE",
  Ghana: "GH",
  Tanzania: "TZ",
  Algeria: "DZ",
  Morocco: "MA",
  Senegal: "SN",
  Japan: "JP",
  Australia: "AU",
  Iraq: "IQ",
  Jordan: "JO",
  Lebanon: "LB",
  Syria: "SY",
  Yemen: "YE",
  Libya: "LY",
  Tunisia: "TN",
  Sudan: "SD",
  // common extras
  Ukraine: "UA",
  Israel: "IL",
  Mexico: "MX",
  "North Korea": "KP",
  "South Korea": "KR",
  Taiwan: "TW",
};

// Turn an ISO-3166 alpha-2 code into a flag emoji via regional indicators.
const iso2ToFlag = (code) =>
  code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

export function getFlagEmoji(countryName) {
  if (countryName === "European Union") return "🇪🇺";
  const code = ISO2[countryName];
  return code ? iso2ToFlag(code) : "🏳️";
}

// -1..1 sentiment -> color.
export const sentimentColor = (s) => {
  if (s > 0.3) return "#16a34a"; // friendly
  if (s < -0.3) return "#dc2626"; // hostile
  return "#94a3b8"; // neutral
};

export const EVENT_BADGE = {
  TRADE: { label: "TRADE", bg: "#dbeafe", text: "#1e40af" },
  DIPLOMACY: { label: "DIPLOMACY", bg: "#dcfce7", text: "#166534" },
  CONFLICT: { label: "CONFLICT", bg: "#fee2e2", text: "#991b1b" },
  OTHER: { label: "OTHER", bg: "#f1f5f9", text: "#475569" },
};

export const eventBadge = (type) => EVENT_BADGE[type] || EVENT_BADGE.OTHER;
