import { MappedSheetColumn } from "./types";

export const SHEET_ID = "1LG0We2pTFZsbFm_k1SKLix8gxSq_9n5R_Ic3G2tVzBg";
export const SHEET_TAB_NAME = `MEGA+List+All+Stats`;
export const SHEET_API_KEY = process.env.AOE4_GOOGLE_SHEET_API_KEY;

// An array of all columns in order as they are found in the sheet
// Tuples indicate that we want to map that column to the given column name (right)
export const COLUMN_MAP: (string | [string, MappedSheetColumn])[] = [
  ["#", "id"],
  ["", "ab"],
  ["", "ch"],
  ["", "de"],
  ["", "en"],
  ["", "fr"],
  ["", "hr"],
  ["", "mo"],
  ["", "ru"],
  ["Name", "displayName"],
  ["Age", "age"],
  ["Category", "occurance"],
  ["Produced/Build by", "producedBy"],
  ["Genre", "genre"],
  ["Class", "class"],
  "ATK Type/CD",
  "Type",
  "Role",
  ["F", "food"],
  ["W", "wood"],
  ["G", "gold"],
  ["S", "stone"],
  ["Total", "totalCost"],
  ["Time", "buildTime"],
  ["Pop.", "population"],
  "Garr.",
  "Speed",
  ["Move", "moveSpeed"],
  ["HP", "hitpoints"],
  ["HP/R", "hitpointsPerResource"],
  ["Mel.", "meleeArmor"],
  ["Rgd", "rangedArmor"],
  ["Fire", "fireArmor"],
  ["ATK", "baseAttack"],
  "# Att. ",
  ["Total", "totalAttack"],
  ["Spd", "attackSpeed"],
  ["DPS", "damagePerSecond"],
  "Rg Max",
  "Rg Min",
  ["IG Max", "maxRange"],
  ["IG Min", "minRange"],
  ["Type", "attackType"],
  "AOE",
  "Radius",
  "IG Rad.",
  ["Bonus", "bonusAttack"],
  ["Bonus Against", "bonusAgainst"],
  ["Torch", "torchAttack"],
  ["Speed", "torchAttackSpeed"],
  ["DPS", "torchDamagePerSecond"],
  ["LoS", "lineOfSight"],
  ["HoS", "heightOfSight"],
  ["Additional Information", "notes"],
  "Military/Activable Abilities",
  "Misc/Passive Abilities",
  ["Text File Classification", "gameClassification"],
  ["Bonus", "descriptionValues"],
  ["File Description", "description"],
  "To-Do / Comment",
  ["Code Name", "gameFileName"],
  "",
  "",
  "Credits, Notes, Legend",
];
