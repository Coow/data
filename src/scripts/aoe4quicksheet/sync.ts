import fetch from "node-fetch";
import { Item, PhysicalItem, Building, Technology, Unit, ItemClass, Upgrade, Modifier } from "../../types/items";
import { CIVILIZATIONS } from "../../lib/config/civs";
import { civAbbr } from "../../types/civs";
import { COLUMN_MAP, SHEET_ID, SHEET_TAB_NAME, SHEET_API_KEY, attackTypeMap, bonusDamageMap } from "./config";
import { MappedSheetColumn, MappedSheetItem } from "./types";
import { mergeItem, writeJson } from "../../lib/files/writeData";
import { slugify, getStringWithAlphanumericLike, getStringOutsideParenthesis, getStringBetweenParenthesis } from "../../lib/utils/string";
import { transformRomanAgeToNumber, interpolateGameString } from "../../lib/utils/game";
import { filterOutUnsupportedRows, ignoredIds, mapItemProducedBy, transformSheetUnitWithWorkaround } from "./workarounds";
import { ITEM_TYPES } from "../../lib/config";
import { readJsonFile } from "../../lib/files/readData";
import { round } from "../../lib/utils/number";

const typeMap = {
  unit: ITEM_TYPES.UNITS,
  technology: ITEM_TYPES.TECHNOLOGIES,
  building: ITEM_TYPES.BUILDINGS,
  upgrade: ITEM_TYPES.UPGRADES,
};

getItemData().then((data) => {
  const items = data
    .filter(filterOutUnsupportedRows)
    .flatMap(transformSheetUnitWithWorkaround)
    .map(mapSheetItemToItem)
    .filter((x) => !ignoredIds.includes(x.id));

  console.log(`Imported ${items.length} items`);
  items.forEach((item) => mergeItem(item, typeMap[item.type], { merge: false, log: false }));
});

async function getItemData(useLocalCache = false): Promise<MappedSheetItem[]> {
  if (useLocalCache)
    try {
      return readJsonFile("./.temp/quicksheet.json");
    } catch {}
  try {
    if (!SHEET_API_KEY) throw new Error("No sheet api key provided, set as env variable `AOE4_GOOGLE_SHEET_API_KEY`");
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_TAB_NAME}?key=${SHEET_API_KEY}&valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`
    );
    if (!res.ok) {
      try {
        const { error } = await res.json();
        throw new Error(error?.message);
      } catch (e) {
        throw new Error(`Could not fetch sheet ${res.statusText}`);
      }
    }

    const data = await res.json();
    const columns = data["values"][0];

    if (!COLUMN_MAP.every((x, i) => x == columns[i] || x[0] == columns[i]))
      throw new Error("Column config does not match columns in sheet, please review and update the positions of columns in ./config.ts");

    const formattedData = data["values"]
      .slice(1) //exclude header row
      .map((row: (string | number)[]): MappedSheetItem => {
        let itemData: Record<MappedSheetColumn, string | number> = {} as any;
        columns.forEach((_, index: number) => {
          // If the collumn is configured to be mapped, take the data out
          if (Array.isArray(COLUMN_MAP[index])) itemData[COLUMN_MAP[index][1] as MappedSheetColumn] = row[index];
        });
        return itemData;
      });
    console.log(formattedData);
    writeJson("./.temp/quicksheet.json", formattedData);
    return formattedData;
  } catch (e) {
    throw new Error(`Failed to import sheet ${e}`);
  }
}

function mapSheetItemToItem(data: MappedSheetItem): Unit | Technology | Item {
  // Todo, classes should be parsed and matched against a list of classes
  const displayClasses = (data.gameClassification as string).split(",").map((x) => x.trim());
  const classes = displayClasses.flatMap((x) =>
    x
      .split(" ")
      .map((y) => getStringWithAlphanumericLike(y.trim()).toLowerCase())
      .filter((x) => !["-", "13", "23", "33"].includes(x) && !!x)
  ) as ItemClass[];

  const normalizedName = getStringWithAlphanumericLike(getStringOutsideParenthesis(data.displayName));
  const civs = Object.values(CIVILIZATIONS).reduce((acc, civ) => ((data[civ.abbr as MappedSheetColumn] as string)?.length > 1 ? [...acc, civ.abbr] : acc), [] as civAbbr[]);
  const age = transformRomanAgeToNumber(data.age as string);
  const id = getUniqueID(data, normalizedName, civs);
  let baseId = data.strongId ? (data.strongId as string).match(/([a-z-]*)-/)?.[1] ?? slugify(normalizedName) : slugify(normalizedName);
  if (String(data.strongId).startsWith("upgrade-")) baseId = String(data.strongId).match(/.*-\d/)?.[0] ?? baseId;
  let item: Item = {
    id: id,
    baseId,
    type: "unit",
    name: normalizedName,
    age,
    civs,

    description: interpolateGameString(data.description as string, String(data.descriptionValues ?? "")?.split(",")),
    classes,
    displayClasses,

    unique: ["Unique"].includes(data.occurance as string) || civs.length == 1,

    costs: {
      food: +data.food,
      wood: +data.wood,
      stone: +data.stone,
      gold: +data.gold,
      total: +data.totalCost,
      popcap: +data.population,
      time: +data.buildTime,
    },

    producedBy: [slugify(getStringWithAlphanumericLike(data.producedBy))],
  };

  if (["Land Unit", "Water Unit"].includes(data.genre as string)) {
    const unit: Unit = {
      ...parseObjectProperties(item, data),
      type: "unit",
      movement: {
        speed: round(+data.moveSpeed, 2),
      },
    };

    if (data.torchAttack)
      unit.weapons.push({
        type: "fire",
        damage: +data.torchAttack,
        speed: +data.torchAttackSpeed,
        range: {
          max: 4,
          min: 0,
        },
        modifiers: [],
      });

    return addUnitSpecificData(unit, data);
  } else if (["Structure"].includes(data.genre as string)) {
    const unit: Building = {
      ...parseObjectProperties(item, data),
      type: "building",
    };

    if (+data.garrison > 0) unit.garrison = { capacity: +data.garrison };

    // Somehow the popcap increase is stored in the same columns as the popcap costs
    if (+data.population > 0) {
      unit.popcapIncrease = +data.population;
      unit.costs.popcap = undefined;
    }

    return unit;
  } else if (["Upgrade"].includes(data.genre as string)) {
    item.type = "upgrade";
    const upgrade: Upgrade = {
      ...item,
      type: "upgrade",
      unlocks: id.replace("upgrade-", ""),
    };
    return upgrade;
  } else if (["Technology", "Empl."].includes(data.genre as string)) {
    item.producedBy = mapItemProducedBy(data, item.producedBy);

    let tech: Technology = {
      ...item,
      type: "technology",
    };
    return tech;
  } else {
    return item;
  }
}

function parseObjectProperties(item: Item, data: MappedSheetItem): PhysicalItem {
  return {
    ...item,
    hitpoints: +data.hitpoints,

    weapons: +data.totalAttack
      ? [
          {
            type: attackTypeMap[data.attackType as string],
            damage: +data.totalAttack,
            speed: +data.attackSpeed,
            range: +data.maxRange
              ? {
                  min: round(+data.minRange, 1),
                  max: round(+data.maxRange, 1),
                }
              : undefined,
            ...(data.bonusAttack && { modifiers: getBonusAttackModifiers(data.bonusAgainst as string, data.bonusAttack as string, data.attackType as string) }),
          },
        ]
      : [],

    armor: [
      +data.rangedArmor && { type: "ranged", value: +data.rangedArmor },
      +data.meleeArmor && { type: "melee", value: +data.meleeArmor },
      +data.fireArmor && { type: "fire", value: +data.fireArmor },
    ].filter((x) => x) as Unit["armor"],

    sight: {
      line: +data.lineOfSight,
      height: +data.heightOfSight,
    },
  };
}

const ids = new Set<string>();

function getUniqueID(u: MappedSheetItem, normalizedName: string, civs: civAbbr[]): string {
  const baseId =
    (u.strongId as string) ?? // strongly provided ID from sheet or transformation, always attempt this first
    `${slugify(normalizedName)}-${transformRomanAgeToNumber(u.age as string)}`; // Otherwise format id using lowercase-slugified-{age} 'horse-archer-3
  if (ids.has(baseId)) {
    // If we already have this unit, attempt some variations
    let id = baseId;
    const variation = getStringWithAlphanumericLike(getStringBetweenParenthesis(u.displayName));
    // 'bombard-2-clocktower`
    if (variation.length) id = `${baseId}-${slugify(variation)}`;
    // 'dock-2-chinese'
    else if (u.producedBy == "Villager" && civs.length == 1) id = `${baseId}-${CIVILIZATIONS[civs[0]].slug}`;
    else id = `${baseId}-${slugify(getStringWithAlphanumericLike(u.producedBy))}`; // `trader-2-silver-tree`

    if (ids.has(id)) {
      // otherwise we're out of options, use 'horse-archer-3-2'
      console.warn(`Duplicate id ${id}`);
      let i = 1;
      while (ids.has(id)) {
        id = `${baseId}-${i}`;
        i++;
      }
      console.log(`Using ${id} instead`);
    }
    ids.add(id);
    return id;
  } else {
    ids.add(baseId);
    return baseId;
  }
}

function addUnitSpecificData(unit: Unit, raw: MappedSheetItem): Unit {
  // Season 2 Villagers Torch Bonus damage vs Siege reduced from +10 to +2
  if (unit.baseId == "villager") {
    const weapon = unit.weapons.find((x) => x.type == "fire");
    if (weapon) {
      weapon.modifiers ??= [];
      weapon.modifiers.push({
        property: "fireAttack",
        target: { class: [["siege"]] },
        effect: "change",
        value: 2,
        type: "passive",
      });
    }
  }

  return unit;
}

function getBonusAttackModifiers(bonusAgainst: string, bonusAttack: string, attackType: string): Modifier[] {
  const target = bonusAgainst.split(",").map((x) => x.trim());
  const damage = bonusAttack.split(",").map((x) => +x);
  return target.map((t, i) => ({
    property: `${attackTypeMap[attackType]}Attack`,
    target: bonusDamageMap[t] ?? {},
    effect: "change",
    value: +damage[i],
    type: "passive",
  }));
}
