// The countries the supplier form offers (name as stored, ISO 3166 code for the flag). Sourcing countries first,
// then the rest alphabetically; a stored country outside this list keeps its name and shows no flag.

export type Country = { name: string; code: string };

export const COUNTRIES: Country[] = [
  { name: "China", code: "CN" },
  { name: "India", code: "IN" },
  { name: "Bangladesh", code: "BD" },
  { name: "Vietnam", code: "VN" },
  { name: "Cambodia", code: "KH" },
  { name: "Hong Kong", code: "HK" },
  { name: "Indonesia", code: "ID" },
  { name: "Italy", code: "IT" },
  { name: "Japan", code: "JP" },
  { name: "Malaysia", code: "MY" },
  { name: "Pakistan", code: "PK" },
  { name: "Singapore", code: "SG" },
  { name: "South Korea", code: "KR" },
  { name: "Sri Lanka", code: "LK" },
  { name: "Taiwan", code: "TW" },
  { name: "Thailand", code: "TH" },
  { name: "Turkey", code: "TR" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" },
];

/**
 * The ISO code of a country name in the list ("CN"), drawn as the flag badge next to the name, or "" for an unknown
 * or empty name. A code badge, not a flag emoji: Windows draws flag emoji as bare letters.
 */
export const countryCode = (country: string) => COUNTRIES.find((entry) => entry.name === country)?.code ?? "";
