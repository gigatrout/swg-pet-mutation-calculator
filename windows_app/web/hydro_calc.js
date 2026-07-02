/** Hydrolase refining and incubation formulas (matches enzyme_crafting_base.java). */

export const SINGLE_STAGE_CAP = 4.6;
export const REPROCESSING_FINAL_CAP = 20.0;
export const MAX_FEM_SKILLMOD = 10;
export const MAX_POWER_QUALITY_BONUS = 11;
export const MAX_POWER_QUALITY = 1000;
export const MAX_POINTS_PER_SESSION_DPS_ARMOR = 5;
export const MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR = 8;
export const DPS_ARMOR_DISPLAY_RATE = 0.1;

export function calcGainFactor(
  hardware,
  consumable,
  ge,
  { purityCap = null, bonusPercent = 0 } = {},
) {
  let base = (hardware / 2 + consumable * 1.5) / 2;
  if (purityCap !== null) {
    base = Math.min(base, purityCap);
  }
  const bonus = Number(bonusPercent) || 0;
  return base * (1 + ge / 100) * (1 + bonus / 100);
}

export function calcStatRange(
  startValue,
  hardware,
  consumable,
  ge,
  { finalCap = null, purityCap = null, bonusPercent = 0 } = {},
) {
  const gainFactor = calcGainFactor(hardware, consumable, ge, { purityCap, bonusPercent });
  const gainMin = gainFactor / 2;
  const gainMax = gainFactor;
  let minVal = startValue + gainMin;
  let maxVal = startValue + gainMax;
  let capped = false;
  if (finalCap !== null) {
    capped = startValue + gainMin >= finalCap;
    minVal = Math.min(minVal, finalCap);
    maxVal = Math.min(maxVal, finalCap);
  }
  return {
    start: startValue,
    gainMin,
    gainMax,
    gainFactor,
    min: minVal,
    max: maxVal,
    cappedAtFinal: capped,
  };
}

export function calcPurityRange(
  start,
  hardware,
  consumable,
  ge,
  { finalCap = null, bonusPercent = 0 } = {},
) {
  return calcStatRange(start, hardware, consumable, ge, {
    finalCap,
    purityCap: SINGLE_STAGE_CAP,
    bonusPercent,
  });
}

export function calcMutagenRange(
  start,
  hardwareMutagen,
  consumableMutagen,
  ge,
  { bonusPercent = 0 } = {},
) {
  return calcStatRange(start, hardwareMutagen, consumableMutagen, ge, { bonusPercent });
}

export function createdPurityRange(theoretical, cap = REPROCESSING_FINAL_CAP) {
  return [Math.min(theoretical.min, cap), Math.min(theoretical.max, cap)];
}

export function processNote(processKey, purity, mutagen) {
  if (!purity || !mutagen) {
    return "Enter valid numbers in all fields.";
  }
  const parts = [];
  if (processKey === "centrifuge") {
    parts.push("Centrifuge creates two elements; each gets independent purity and mutagen rolls.");
  } else if (processKey === "reprocessing") {
    parts.push("Combines five processed elements (A–E) and one Enzyme Re-processor Capsule.");
    parts.push(
      `Purity above is the theoretical roll; hydrolase purity is capped at ${REPROCESSING_FINAL_CAP} when created (stopCombiner).`,
    );
    parts.push("Mutagen has no final cap — the mutagen range is what you receive.");
  } else {
    parts.push("Element is marked processed after this step.");
  }
  parts.push("Mutagen gain uses mutagen potential and is not capped at 4.6.");
  return parts.join(" ");
}

export function calcIncubationQualityMultiplier(fem, incubationQuality, stationQuality, powerQuality) {
  const cappedFem = Math.min(Math.max(0, fem), MAX_FEM_SKILLMOD);
  const exoticBonus = cappedFem * 2;
  const powerBonus = (Math.max(0, powerQuality) / MAX_POWER_QUALITY) * MAX_POWER_QUALITY_BONUS;
  const total = Math.max(0, incubationQuality) + stationQuality + powerBonus + exoticBonus;
  return total > 0 ? 1 + total * 0.01 : 1.0;
}

export function calcIsomeraseSessionPoints(isomeraseQuality, multiplier) {
  const boosted = isomeraseQuality * multiplier;
  const raw = (boosted * 0.01) * MAX_POINTS_PER_SESSION_DPS_ARMOR;
  return Math.min(raw, MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR);
}

export function calcIncubation(fem, isomeraseQuality, incubationQuality, stationQuality, powerQuality) {
  const multiplier = calcIncubationQualityMultiplier(
    fem,
    incubationQuality,
    stationQuality,
    powerQuality,
  );
  const effectiveQuality = isomeraseQuality * multiplier;
  const sessionPoints = calcIsomeraseSessionPoints(isomeraseQuality, multiplier);
  return {
    femRaw: fem,
    multiplier,
    effectiveQuality,
    sessionPoints,
  };
}

export function incubationNote(result) {
  const femNote =
    result.femRaw > MAX_FEM_SKILLMOD ? ` Values above ${MAX_FEM_SKILLMOD} FEM are capped in game.` : "";
  return (
    "Used when committing an incubation session with Isomerase in slot 1. " +
    "Hydrolase (slot 4) purity is spent on combat-stat bubbles via the nutrient gauge — " +
    "FEM does not alter refining purity." +
    femNote
  );
}

export function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function fmtRange(minVal, maxVal, digits = 2) {
  return `${fmtNum(minVal, digits)} – ${fmtNum(maxVal, digits)}`;
}
