/**
 * Simple locale strings for Explorer components.
 * No full i18n framework — just a typed object per locale.
 */

export type Locale = "no" | "en";

export interface ExplorerStrings {
  explore: string;
  exploreProject: (name: string) => string;
  placesVisible: (visible: number, total: number) => string;
  loadingPlaces: string;
  updating: string;
  onFoot: string;
  bicycle: string;
  car: string;
  allDays: string;
  save: string;
  saved: string;
  enableLocation: string;
  enableLocationDesc: string;
  enable: string;
  later: string;
  gettingLocation: string;
  yourPosition: string;
  routesFromYou: string;
  away: string;
  accurate: string;
  approximate: string;
  showAll: string;
  hideAll: string;
  showRoute: string;
  moreInfo: string;
  readMore: string;
  myCollection: string;
  savePlacesHint: string;
  placesSaved: (count: number) => string;
  noPlacesYet: string;
  createCollection: (count: number) => string;
  creatingCollection: string;
  collectionReady: string;
  continueExploring: string;
  copyLink: string;
  copied: string;
  emailOptional: string;
  panToDiscover: string;
  zoomToDiscover: (count: number) => string;
  placesInArea: (count: number, category: string) => string;
  placesInView: (count: number) => string;
  // Kompass
  kompass: string;
  whatToExperience: string;
  selectCategories: string;
  selectAll: string;
  removeAll: string;
  whichDay: string;
  selectDayOrAll: string;
  wholeFestival: string;
  whenAvailable: string;
  selectTimeOrAll: string;
  wholeDay: string;
  showAllTimes: string;
  back: string;
  next: string;
  seeMyProgram: string;
  exploreFree: string;
  allEvents: string;
  noEventsMatch: string;
  tryOtherFilters: string;
  changeFilter: string;
  unknownTime: string;
  // Time of day
  morning: string;
  morningDesc: string;
  afternoon: string;
  afternoonDesc: string;
  evening: string;
  eveningDesc: string;
  stepOf: (step: number, total: number) => string;
}

export const STRINGS_NO: ExplorerStrings = {
  explore: "Utforsk",
  exploreProject: (name) => `Utforsk ${name}`,
  placesVisible: (v, t) => `${v} av ${t} steder synlige`,
  loadingPlaces: "Laster steder\u2026",
  updating: "Oppdaterer\u2026",
  onFoot: "Til fots",
  bicycle: "Sykkel",
  car: "Bil",
  allDays: "Alle dager",
  save: "Lagre",
  saved: "Lagret",
  enableLocation: "Aktiver posisjon",
  enableLocationDesc: "Se avstander fra der du er n\u00e5, og f\u00e5 ruter til steder du vil bes\u00f8ke.",
  enable: "Aktiver",
  later: "Senere",
  gettingLocation: "Henter posisjon\u2026",
  yourPosition: "Din posisjon",
  routesFromYou: "Ruter fra din posisjon",
  away: "unna",
  accurate: "N\u00f8yaktig",
  approximate: "Omtrentlig",
  showAll: "Vis alle",
  hideAll: "Skjul alle",
  showRoute: "Vis rute",
  moreInfo: "Mer info",
  readMore: "Les mer",
  myCollection: "Min samling",
  savePlacesHint: "Lagre steder du liker med +",
  placesSaved: (n) => `${n} ${n === 1 ? "sted" : "steder"} lagret`,
  noPlacesYet: "Ingen steder lagt til enn\u00e5",
  createCollection: (n) => `Opprett min samling (${n})`,
  creatingCollection: "Oppretter samling\u2026",
  collectionReady: "Samlingen er klar!",
  continueExploring: "Fortsett \u00e5 utforske",
  copyLink: "Kopier lenke",
  copied: "Kopiert!",
  emailOptional: "E-post (valgfritt)",
  panToDiscover: "Panorer kartet for \u00e5 oppdage steder",
  zoomToDiscover: (n) => `Zoom inn for \u00e5 oppdage ${n}+ steder til`,
  placesInArea: (n, cat) => `${n} ${cat.toLowerCase()} i dette omr\u00e5det`,
  placesInView: (n) => `${n} steder i synsfeltet`,
  kompass: "Kompass",
  whatToExperience: "Hva vil du oppleve?",
  selectCategories: "Velg kategorier du er interessert i",
  selectAll: "Velg alle",
  removeAll: "Fjern alle",
  whichDay: "Hvilken dag?",
  selectDayOrAll: "Velg en dag, eller se hele festivalen",
  wholeFestival: "Hele festivalen",
  whenAvailable: "N\u00e5r er du ledig?",
  selectTimeOrAll: "Velg tidspunkt, eller se hele dagen",
  wholeDay: "Hele dagen",
  showAllTimes: "Vis alle tidspunkter",
  back: "Tilbake",
  next: "Neste",
  seeMyProgram: "Se mitt program",
  exploreFree: "Utforsk fritt",
  allEvents: "Alle events",
  noEventsMatch: "Ingen events matcher",
  tryOtherFilters: "Pr\u00f8v \u00e5 velge flere temaer, en annen dag, eller et annet tidspunkt.",
  changeFilter: "Endre filter",
  unknownTime: "Ukjent tid",
  morning: "Formiddag",
  morningDesc: "F\u00f8r kl. 12",
  afternoon: "Ettermiddag",
  afternoonDesc: "12:00\u201317:00",
  evening: "Kveld",
  eveningDesc: "Etter kl. 17",
  stepOf: (s, t) => `${s} av ${t}`,
};

export const STRINGS_EN: ExplorerStrings = {
  explore: "Explore",
  exploreProject: (name) => `Explore ${name}`,
  placesVisible: (v, t) => `${v} of ${t} places visible`,
  loadingPlaces: "Loading places\u2026",
  updating: "Updating\u2026",
  onFoot: "Walking",
  bicycle: "Bicycle",
  car: "Car",
  allDays: "All days",
  save: "Save",
  saved: "Saved",
  enableLocation: "Enable location",
  enableLocationDesc: "See distances from where you are and get routes to places you want to visit.",
  enable: "Enable",
  later: "Later",
  gettingLocation: "Getting location\u2026",
  yourPosition: "Your position",
  routesFromYou: "Routes from your position",
  away: "away",
  accurate: "Accurate",
  approximate: "Approximate",
  showAll: "Show all",
  hideAll: "Hide all",
  showRoute: "Show route",
  moreInfo: "More info",
  readMore: "Read more",
  myCollection: "My collection",
  savePlacesHint: "Save places you like with +",
  placesSaved: (n) => `${n} ${n === 1 ? "place" : "places"} saved`,
  noPlacesYet: "No places added yet",
  createCollection: (n) => `Create my collection (${n})`,
  creatingCollection: "Creating collection\u2026",
  collectionReady: "Collection is ready!",
  continueExploring: "Continue exploring",
  copyLink: "Copy link",
  copied: "Copied!",
  emailOptional: "Email (optional)",
  panToDiscover: "Pan the map to discover places",
  zoomToDiscover: (n) => `Zoom in to discover ${n}+ more places`,
  placesInArea: (n, cat) => `${n} ${cat.toLowerCase()} in this area`,
  placesInView: (n) => `${n} places in view`,
  kompass: "Compass",
  whatToExperience: "What do you want to experience?",
  selectCategories: "Choose categories you\u2019re interested in",
  selectAll: "Select all",
  removeAll: "Remove all",
  whichDay: "Which day?",
  selectDayOrAll: "Choose a day, or see the whole festival",
  wholeFestival: "Whole festival",
  whenAvailable: "When are you available?",
  selectTimeOrAll: "Choose a time, or see the whole day",
  wholeDay: "Whole day",
  showAllTimes: "Show all times",
  back: "Back",
  next: "Next",
  seeMyProgram: "See my schedule",
  exploreFree: "Explore freely",
  allEvents: "All events",
  noEventsMatch: "No events match",
  tryOtherFilters: "Try selecting more categories, a different day, or a different time.",
  changeFilter: "Change filter",
  unknownTime: "Unknown time",
  morning: "Morning",
  morningDesc: "Before 12pm",
  afternoon: "Afternoon",
  afternoonDesc: "12pm\u20135pm",
  evening: "Evening",
  eveningDesc: "After 5pm",
  stepOf: (s, t) => `${s} of ${t}`,
};

export function getStrings(locale: Locale): ExplorerStrings {
  return locale === "en" ? STRINGS_EN : STRINGS_NO;
}
