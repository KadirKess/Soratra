import { z } from 'zod'

export const catalogLanguages = [
  { code: 'ar', label: 'Arabic' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ca', label: 'Catalan' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fa', label: 'Persian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'mg', label: 'Malagasy' },
  { code: 'nl', label: 'Dutch' },
  { code: 'no', label: 'Norwegian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'zh', label: 'Chinese' },
] as const

export const catalogLanguageSchema = z.enum(catalogLanguages.map(({ code }) => code) as [string, ...string[]])
export type CatalogLanguage = z.infer<typeof catalogLanguageSchema>

export function catalogLanguageLabel(language: CatalogLanguage) {
  return catalogLanguages.find((candidate) => candidate.code === language)?.label ?? language
}

const openLibraryLanguageCodes: Record<CatalogLanguage, readonly string[]> = {
  ar: ['ara'], bn: ['ben'], ca: ['cat'], cs: ['cze', 'ces'], da: ['dan'], de: ['ger', 'deu'],
  el: ['gre', 'ell'], en: ['eng'], es: ['spa'], fa: ['per', 'fas'], fi: ['fin'], fr: ['fre', 'fra'],
  he: ['heb'], hi: ['hin'], hu: ['hun'], id: ['ind'], it: ['ita'], ja: ['jpn'], ko: ['kor'],
  mg: ['mlg'], nl: ['dut', 'nld'], no: ['nor'], pl: ['pol'], pt: ['por'], ro: ['rum', 'ron'],
  ru: ['rus'], sv: ['swe'], th: ['tha'], tr: ['tur'], uk: ['ukr'], vi: ['vie'], zh: ['chi', 'zho'],
}

export function openLibraryLanguageMatches(language: CatalogLanguage, values: string[] | undefined) {
  const accepted = new Set([language, ...openLibraryLanguageCodes[language]])
  return values?.some((value) => accepted.has(value.toLowerCase())) ?? false
}
