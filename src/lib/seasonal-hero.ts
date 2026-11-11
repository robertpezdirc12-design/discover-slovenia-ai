/**
 * Sezonska afiniteta heroja
 *
 * Raziskava: Switzerland Tourism vrne vsebino po rigidnem sezonskem koledarju
 * (Partner Winter / Summer / Autumn kampanje), Tourism Ireland pa izkorišča
 * mikro-dogodek z izvornostjo ("Home of Halloween"). Ta modul naredi oboje za
 * Slovenijo: 4 sezonska okna (MMDD, z ovitkom čez leto) + izvorne SI
 * mikro-dogodke (martinovanje, kurentovanje, december).
 *
 * Sezona se reši izključno na strežniku (SSR) → ni CLS, ni flicker.
 * V produkciji strani dodaj `export const revalidate = 3600`, da ISR ne
 * zamrzne sezone čez polnoč.
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Izvorni SI mikro-dogodki — okenski overlay na sezono. */
export type MicroEvent = 'martinovanje' | 'kurentovanje' | 'december' | null;

export interface SeasonalHeroVariant {
  season: Season;
  /** Nalepka nad naslovom (npr. "Zimska sezona"). */
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  /** Pot do hero slike (v /public). */
  image: string;
  /** Kratka oznaka tematike za badge ob hero-ju. */
  badge: string;
}

export const SEASONAL_HERO: Record<Season, SeasonalHeroVariant> = {
  winter: {
    season: 'winter',
    eyebrow: 'Zimska sezona',
    title: 'Slovenija v snežni belini',
    subtitle:
      'Zimske čarobile pri Blejskem jezeru, pobočja Julijskih Alp in termalne oaze — najbolj tiha stran Slovenije.',
    ctaLabel: 'Razišči zimske destinacije',
    secondaryCtaLabel: 'Termalne in smučarske poti',
    image: '/images/hero-winter.png',
    badge: 'Alpe · terme · pravljična mesta',
  },
  spring: {
    season: 'spring',
    eyebrow: 'Pomladanska sezona',
    title: 'Slovenija se prebuja',
    subtitle:
      'Doline cvetijo, Ljubljanica živi na prostem, panoramske poti so spet odprte — idealen čas za počasno odkrivanje.',
    ctaLabel: 'Razišči pomladanske poti',
    secondaryCtaLabel: 'Mestni izleti in doline',
    image: '/images/hero-spring.png',
    badge: 'Cvetje · mesta · panorame',
  },
  summer: {
    season: 'summer',
    eyebrow: 'Poletna sezona',
    title: 'Sledi smaragdni Soči',
    subtitle:
      'Kajakaštvo na smaragdni reki, planšarske poti nad dolinami in sidrišča primorskih mest.',
    ctaLabel: 'Razišči poletne destinacije',
    secondaryCtaLabel: 'Soča · Primorska · planine',
    image: '/images/hero-summer.png',
    badge: 'Soča · morje · planine',
  },
  autumn: {
    season: 'autumn',
    eyebrow: 'Jesenska sezona',
    title: 'Slovenija v zlatu',
    subtitle:
      'Vinogradniške terase Štajerske, kostanjevi gaji in topla barva dolin — sezona okusov in panoram.',
    ctaLabel: 'Razišči jesenske destinacije',
    secondaryCtaLabel: 'Vinske ceste in kostanj',
    image: '/images/hero-autumn.png',
    badge: 'Vinogradi · kostanj · panorame',
  },
};

/** Mikro-dogodek → prepis nekaterih polj hero variantе (izvornost, ne kloniranje). */
export const MICRO_EVENT_OVERRIDES: Record<
  Exclude<MicroEvent, null>,
  Partial<Pick<SeasonalHeroVariant, 'eyebrow' | 'badge'>>
> = {
  martinovanje: {
    eyebrow: 'Martinovanje · 11. november',
    badge: 'Mlato vino · zabetiniran kostanj',
  },
  kurentovanje: {
    eyebrow: 'Kurentovanje · Ptuj',
    badge: 'Pustna izvornost na Dravskem polju',
  },
  december: {
    eyebrow: 'Decembra v Sloveniji',
    badge: 'Svetleče mesta · božične poti',
  },
};

/** Okna sezon kot MMDD števila (z ovitkom čez novo leto). */
export function resolveSeason(date: Date = new Date()): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1201 || md <= 315) return 'winter'; // 1. 12. – 15. 3.
  if (md <= 531) return 'spring'; // 16. 3. – 31. 5.
  if (md <= 914) return 'summer'; // 1. 6. – 14. 9.
  return 'autumn'; // 15. 9. – 30. 11.
}

/** Izvorni SI mikro-dogodki (okna v dneh). */
export function resolveMicroEvent(date: Date = new Date()): MicroEvent {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1108 && md <= 1114) return 'martinovanje';
  if (md >= 202 && md <= 205) return 'kurentovanje';
  if (md >= 1201 && md <= 1226) return 'december';
  return null;
}

const VALID_SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];

export interface HeroVariantInput {
  /** Samo za DEMO/preverjanje (?season=...). V produkciji pusti null. */
  seasonOverride?: string | null;
  now?: Date;
}

/** SSR vhodna točka: vrne končno hero variantо (sezona + mikro-dogodek). */
export function getHeroVariant({
  seasonOverride,
  now = new Date(),
}: HeroVariantInput): { variant: SeasonalHeroVariant; microEvent: MicroEvent } {
  const season: Season = VALID_SEASONS.includes(seasonOverride as Season)
    ? (seasonOverride as Season)
    : resolveSeason(now);

  const microEvent = VALID_SEASONS.includes(seasonOverride as Season)
    ? null // demo override ne sproža mikro-dogodkov
    : resolveMicroEvent(now);

  const base = SEASONAL_HERO[season];
  const variant: SeasonalHeroVariant =
    microEvent && MICRO_EVENT_OVERRIDES[microEvent]
      ? { ...base, ...MICRO_EVENT_OVERRIDES[microEvent] }
      : base;

  return { variant, microEvent };
}
