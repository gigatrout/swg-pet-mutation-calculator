"use strict";

/** Matches incubator.TEMP_SCALE_MAX_RANGE */
export const TEMP_MAX = 10;

/** Matches incubator.MAX_SESSION_SKILL_INCREMENT */
export const MAX_PER_SKILL_SESSION = 10;

/** Matches incubator.MAX_TOTAL_SKILL_INCREMENT */
export const MAX_PER_SKILL_TOTAL = 10;

/** Free points per skill when a session rolls appearance mutation */
export const APPEARANCE_MUTATION_PER_SKILL = 2;

/** Max appearance mutation sessions per egg (in-game cap). */
export const MAX_APPEARANCE_MUTATIONS = 2;

export const PERFECT_PET_TARGET = 60;

export const CATEGORIES = [
  {
    id: "defensive",
    label: "Defensive",
    hint: "Survival & Bestial Resilience",
    color: "#6bcb77",
  },
  {
    id: "intellectual",
    label: "Intellectual",
    hint: "Cunning & Intelligence",
    color: "#e8c547",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    hint: "Aggression & Hunter's Instinct",
    color: "#e8925b",
  },
];

export const SKILLS = [
  { id: "survival", label: "Survival", category: "defensive" },
  { id: "beastialResilience", label: "Bestial Resilience", category: "defensive" },
  { id: "cunning", label: "Cunning", category: "intellectual" },
  { id: "intelligence", label: "Intelligence", category: "intellectual" },
  { id: "aggression", label: "Aggression", category: "aggressive" },
  { id: "huntersInstinct", label: "Hunter's Instinct", category: "aggressive" },
];

/** Max free points per appearance mutation if every skill has room */
export const APPEARANCE_MUTATION_BONUS =
  APPEARANCE_MUTATION_PER_SKILL * SKILLS.length;

/** Top row then bottom row per category; points fill bottom row first. */
export const CATEGORY_SKILL_ORDER = {
  defensive: ["survival", "beastialResilience"],
  intellectual: ["cunning", "intelligence"],
  aggressive: ["aggression", "huntersInstinct"],
};

export function categorySkillIds(categoryId) {
  const [topId, bottomId] = CATEGORY_SKILL_ORDER[categoryId];
  return { topId, bottomId };
}

/**
 * Nutrient gauge positions (0–10) at pool=20.
 * 0 = slider all the way up (defensive), 10 = bottom (aggressive).
 * Symmetric around center (5): each step down from center inverts on the ends.
 */
const NUTRIENT_TABLE_POOL20 = [
  [20, 0, 0],   // 0  top
  [17, 3, 0],   // 1
  [13, 6, 1],   // 2  ← inverse of 8
  [8, 9, 3],    // 3  ← inverse of 7
  [4, 13, 3],   // 4  ← inverse of 6
  [3, 14, 3],   // 5  center
  [3, 13, 4],   // 6
  [3, 9, 8],    // 7
  [1, 6, 13],   // 8
  [0, 3, 17],   // 9
  [0, 0, 20],   // 10 bottom
];

export function hydroPool(purity) {
  const p = Number(purity);
  if (!Number.isFinite(p) || p < 0) {
    return 0;
  }
  return Math.floor(p);
}

export function splitPool(total, ratios) {
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) {
    return [0, 0, 0];
  }
  const raw = ratios.map((r) => (total * r) / sum);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < remainder; k += 1) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}

/** Map range-input value to nutrient position (0=top/defensive … 10=bottom/aggressive). */
export function gameNutrientPos(sliderPos) {
  const ui = Math.min(TEMP_MAX, Math.max(0, Math.round(Number(sliderPos) || 0)));
  return TEMP_MAX - ui;
}

export function nutrientPosToUi(gamePos) {
  const pos = Math.min(TEMP_MAX, Math.max(0, Math.round(Number(gamePos) || 0)));
  return TEMP_MAX - pos;
}

export function nutrientRatios(sliderPos) {
  return [...NUTRIENT_TABLE_POOL20[gameNutrientPos(sliderPos)]];
}

/** Center notch (3·14·3): end boxes floor, middle absorbs remainder (matches 12pt → 1·10·1). */
function splitPoolCenter(pool, ratios) {
  const sum = ratios.reduce((a, b) => a + b, 0);
  if (pool <= 0 || sum <= 0) {
    return [0, 0, 0];
  }
  const end = Math.floor((pool * ratios[0]) / sum);
  const intellectual = Math.max(0, pool - 2 * end);
  return [end, intellectual, end];
}

/** Trim excess from ratios in repeating order (def, int, agg indices). */
function trimCycle(pool, ratios, order) {
  const vals = [...ratios];
  let excess = vals.reduce((a, b) => a + b, 0) - pool;
  let orderIdx = 0;
  let idle = 0;
  while (excess > 0) {
    const idx = order[orderIdx++ % order.length];
    if (vals[idx] > 0) {
      vals[idx]--;
      excess--;
      idle = 0;
    } else {
      idle++;
      if (idle >= order.length) {
        const fallback = vals.findIndex((v) => v > 0);
        if (fallback < 0) {
          break;
        }
        vals[fallback]--;
        excess--;
        idle = 0;
      }
    }
  }
  return vals;
}

/**
 * Intellectual-heavy with aggressive second: trim int then def, shift def→agg when agg is smallest.
 * e.g. pool 17 @ 3·9·8 → 2·7·8; pool 17 @ 3·13·4 → 2·11·4 (in-game validated).
 */
function splitPoolIntAggSecond(pool, ratios) {
  const [defRatio, intRatio, aggRatio] = ratios;
  const excess = defRatio + intRatio + aggRatio - pool;
  const result = trimCycle(pool, ratios, [1, 1, 0]);
  if (aggRatio < defRatio && aggRatio < intRatio && excess > 1) {
    const shifts = Math.floor((excess - 1) / 2);
    for (let k = 0; k < shifts && result[0] > 0; k++) {
      result[0]--;
      result[2]++;
    }
  }
  return result;
}

/**
 * Intellectual-heavy notches below 20pt: trim from int, shift to the heavier end.
 * e.g. pool 19 @ 8·9·3 → 9·8·2; pool 19 @ 3·9·8 → 2·8·9 (in-game validated).
 */
function splitPoolIntelHeavy(pool, ratios) {
  const [defRatio, intRatio, aggRatio] = ratios;
  if (intRatio <= defRatio || intRatio <= aggRatio) {
    return null;
  }
  let defensive = defRatio;
  let intellectual = intRatio;
  let aggressive = aggRatio;
  let excess = defensive + intellectual + aggressive - pool;
  if (excess <= 0) {
    return [defensive, intellectual, aggressive];
  }
  while (excess > 0) {
    if (defensive > aggressive) {
      defensive += 1;
      intellectual -= 1;
      aggressive -= 1;
    } else if (defensive < aggressive) {
      defensive -= 1;
      intellectual -= 1;
      aggressive += 1;
    } else {
      intellectual -= 1;
      aggressive -= 1;
    }
    excess -= 1;
  }
  if (defensive < 0 || intellectual < 0 || aggressive < 0) {
    return null;
  }
  if (defensive + intellectual + aggressive !== pool) {
    return null;
  }
  return [defensive, intellectual, aggressive];
}

export function categoryAllocation(pool, sliderPos) {
  const ratios = nutrientRatios(sliderPos);
  const pos = gameNutrientPos(sliderPos);
  let parts;
  if (pos === 5 && ratios[0] === ratios[2]) {
    parts = splitPoolCenter(pool, ratios);
  } else if (pool < 20) {
    const [defRatio, intRatio, aggRatio] = ratios;
    const excess = defRatio + intRatio + aggRatio - pool;
    if (intRatio > defRatio && intRatio > aggRatio && aggRatio > defRatio && excess > 1) {
      parts = splitPoolIntAggSecond(pool, ratios);
    } else {
      parts = splitPoolIntelHeavy(pool, ratios) ?? splitPool(pool, ratios);
    }
  } else {
    parts = splitPool(pool, ratios);
  }
  const [defensive, intellectual, aggressive] = parts;
  return { defensive, intellectual, aggressive, ratios };
}

export function categorySpent(skillPoints, categoryId) {
  return SKILLS.filter((s) => s.category === categoryId).reduce(
    (sum, s) => sum + (skillPoints[s.id] || 0),
    0
  );
}

export function sessionSpent(skillPoints) {
  return SKILLS.reduce((sum, s) => sum + (skillPoints[s.id] || 0), 0);
}

export function canAddPoint(state, skillId) {
  const skill = SKILLS.find((s) => s.id === skillId);
  if (!skill) {
    return false;
  }
  const current = state.sessionPoints[skillId] || 0;
  const prior = state.priorTotals[skillId] || 0;
  const catSpent = categorySpent(state.sessionPoints, skill.category);
  const catBudget = state.categoryBudget[skill.category] || 0;
  if (current >= MAX_PER_SKILL_SESSION) {
    return false;
  }
  if (prior + current >= MAX_PER_SKILL_TOTAL) {
    return false;
  }
  if (catSpent >= catBudget) {
    return false;
  }
  if (sessionSpent(state.sessionPoints) >= state.pool) {
    return false;
  }
  return true;
}

export function addPoint(state, skillId) {
  if (!canAddPoint(state, skillId)) {
    return state;
  }
  return {
    ...state,
    sessionPoints: {
      ...state.sessionPoints,
      [skillId]: (state.sessionPoints[skillId] || 0) + 1,
    },
  };
}

export function removePoint(state, skillId) {
  const current = state.sessionPoints[skillId] || 0;
  if (current <= 0) {
    return state;
  }
  return {
    ...state,
    sessionPoints: {
      ...state.sessionPoints,
      [skillId]: current - 1,
    },
  };
}

/** Max session points reachable for a skill given pool/category/caps. */
export function maxReachableCount(state, skillId) {
  let next = {
    ...state,
    sessionPoints: { ...state.sessionPoints },
  };
  while (canAddPoint(next, skillId)) {
    next = addPoint(next, skillId);
  }
  return next.sessionPoints[skillId] || 0;
}

/** Fill session bubbles left-to-right through index (inclusive). */
export function fillToIndex(state, skillId, index) {
  const target = index + 1;
  let next = {
    ...state,
    sessionPoints: { ...state.sessionPoints },
  };
  while ((next.sessionPoints[skillId] || 0) < target) {
    const before = next.sessionPoints[skillId] || 0;
    next = addPoint(next, skillId);
    if ((next.sessionPoints[skillId] || 0) === before) {
      break;
    }
  }
  return next;
}

export function canFillToIndex(state, skillId, sessionIndex) {
  const after = fillToIndex(state, skillId, sessionIndex);
  return (after.sessionPoints[skillId] || 0) >= sessionIndex + 1;
}

/** +2 per skill for a marked session; capped by remaining room to 10/skill (hydro + prior mutations). */
export function mutationBonusForSession(sessions, sessionIndex) {
  const session = sessions[sessionIndex];
  const bonus = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
  if (!session?.appearanceMutation) {
    return bonus;
  }

  const prior = lifetimeBeforeSession(sessions, sessionIndex);
  const points = session.points || {};

  for (const skill of SKILLS) {
    const afterHydro = (prior[skill.id] || 0) + (points[skill.id] || 0);
    const room = Math.max(0, MAX_PER_SKILL_TOTAL - afterHydro);
    bonus[skill.id] = Math.min(APPEARANCE_MUTATION_PER_SKILL, room);
  }
  return bonus;
}

export function countAppearanceMutations(sessions) {
  return sessions.filter((s) => s.appearanceMutation).length;
}

/** Hydro-only totals from sessions before sessionIndex. */
export function lifetimeHydroBeforeSession(sessions, sessionIndex) {
  const totals = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
  for (let i = 0; i < sessionIndex; i += 1) {
    const pts = sessions[i].points || {};
    for (const skill of SKILLS) {
      totals[skill.id] += pts[skill.id] || 0;
    }
  }
  return totals;
}

/** Mutation bonus from earlier sessions only (never the session being edited). */
export function priorMutationTotals(sessions, sessionIndex) {
  const bonus = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
  for (let i = 0; i < sessionIndex; i += 1) {
    if (!sessions[i]?.appearanceMutation) {
      continue;
    }
    const mut = mutationBonusForSession(sessions, i);
    for (const skill of SKILLS) {
      bonus[skill.id] += mut[skill.id] || 0;
    }
  }
  return bonus;
}

/** Hydro + mutation totals from completed sessions before sessionIndex. */
export function lifetimeBeforeSession(sessions, sessionIndex) {
  const totals = lifetimeHydroBeforeSession(sessions, sessionIndex);
  const mut = priorMutationTotals(sessions, sessionIndex);
  for (const skill of SKILLS) {
    totals[skill.id] += mut[skill.id] || 0;
  }
  return totals;
}

/** Empty bubble slots still available this session (prior hydro + prior mutations). */
export function maxPlaceableHydro(sessions, sessionIndex) {
  const prior = lifetimeBeforeSession(sessions, sessionIndex);
  return SKILLS.reduce(
    (sum, skill) => sum + Math.max(0, MAX_PER_SKILL_TOTAL - (prior[skill.id] || 0)),
    0
  );
}

/** Purity after a session-2 appearance mutation on a standard 60pt build. */
export const SESSION3_PURITY_AFTER_S2_MUTATION = 12;

export function grandTotals(sessions) {
  const totals = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
  let hydroSpent = 0;
  let mutBonus = 0;
  let mutBonusWasted = 0;

  for (let i = 0; i < sessions.length; i += 1) {
    const points = sessions[i].points || {};
    hydroSpent += sessionSpent(points);
    for (const skill of SKILLS) {
      totals[skill.id] += points[skill.id] || 0;
    }
    const mut = mutationBonusForSession(sessions, i);
    for (const skill of SKILLS) {
      const offered = mut[skill.id] || 0;
      const room = Math.max(0, MAX_PER_SKILL_TOTAL - totals[skill.id]);
      const applied = Math.min(offered, room);
      mutBonusWasted += offered - applied;
      mutBonus += applied;
      totals[skill.id] += applied;
    }
  }

  for (const skill of SKILLS) {
    totals[skill.id] = Math.min(MAX_PER_SKILL_TOTAL, totals[skill.id]);
  }

  const skillSum = Object.values(totals).reduce((a, b) => a + b, 0);
  return {
    totals,
    hydroSpent,
    mutBonus,
    mutBonusWasted,
    combined: skillSum,
  };
}

export function fmtNum(n, digits = 0) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

/** Spread category budget across two skills (bottom row filled first). */
export function diaToSkillPoints(defensive, intellectual, aggressive) {
  const points = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));

  function fillCategory(categoryId, budget) {
    const { topId, bottomId } = categorySkillIds(categoryId);
    let left = Math.max(0, Math.round(budget));
    const bottom = Math.min(left, MAX_PER_SKILL_SESSION);
    points[bottomId] = bottom;
    left -= bottom;
    points[topId] = Math.min(left, MAX_PER_SKILL_SESSION);
  }

  fillCategory("defensive", defensive);
  fillCategory("intellectual", intellectual);
  fillCategory("aggressive", aggressive);
  return points;
}

/** Place category budget respecting 10/skill lifetime caps (bottom row first). */
export function distributeCategoryBudget(priorTotals, categoryId, budget) {
  const { topId, bottomId } = categorySkillIds(categoryId);
  const points = { [topId]: 0, [bottomId]: 0 };
  let left = Math.max(0, Math.round(Number(budget) || 0));

  const bottomPrior = priorTotals[bottomId] || 0;
  const bottomRoom = Math.max(0, MAX_PER_SKILL_TOTAL - bottomPrior);
  const bottomAdd = Math.min(left, MAX_PER_SKILL_SESSION, bottomRoom);
  points[bottomId] = bottomAdd;
  left -= bottomAdd;

  const topPrior = priorTotals[topId] || 0;
  const topRoom = Math.max(0, MAX_PER_SKILL_TOTAL - topPrior);
  const topAdd = Math.min(left, MAX_PER_SKILL_SESSION, topRoom);
  points[topId] = topAdd;
  left -= topAdd;

  return { points, unplaced: left };
}

/** Apply D·I·A for one session using lifetime totals from earlier sessions. */
export function applySessionDia(sessions, sessionIndex, defensive, intellectual, aggressive) {
  const prior = lifetimeBeforeSession(sessions, sessionIndex);
  const points = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));

  for (const [categoryId, budget] of [
    ["defensive", defensive],
    ["intellectual", intellectual],
    ["aggressive", aggressive],
  ]) {
    const { points: catPts } = distributeCategoryBudget(prior, categoryId, budget);
    for (const [skillId, count] of Object.entries(catPts)) {
      points[skillId] = count;
    }
  }
  return points;
}

/** Prior hydro/mutation segments per skill, session order (mutation after that session's hydro). */
export function priorSkillSegments(sessions, sessionIndex, skillId) {
  const segments = [];
  for (let j = 0; j < sessionIndex; j += 1) {
    const hydro = sessions[j].points?.[skillId] || 0;
    if (hydro > 0) {
      segments.push({ type: "hydro", count: hydro, session: j });
    }
    if (sessions[j].appearanceMutation) {
      const mut = mutationBonusForSession(sessions, j)[skillId] || 0;
      if (mut > 0) {
        segments.push({ type: "mutation", count: mut, session: j });
      }
    }
  }
  return segments;
}

export function priorSegmentLength(segments) {
  return segments.reduce((sum, seg) => sum + seg.count, 0);
}

/** UI slider that reproduces target D·I·A at pool, if any notch matches. */
export function findExactSlider(pool, targetDia) {
  const target = targetDia.map((n) => Math.round(Number(n) || 0));
  for (let ui = 0; ui <= TEMP_MAX; ui += 1) {
    const alloc = categoryAllocation(pool, ui);
    const got = [alloc.defensive, alloc.intellectual, alloc.aggressive];
    if (got.every((v, i) => v === target[i])) {
      return ui;
    }
  }
  return null;
}

/** UI slider that best matches a target D·I·A split at the given pool. */
export function findBestSlider(pool, targetDia) {
  const target = targetDia.map((n) => Math.round(Number(n) || 0));
  let bestUi = 5;
  let bestScore = Infinity;
  let exact = false;

  const exactUi = findExactSlider(pool, target);
  if (exactUi != null) {
    const got = categoryAllocation(pool, exactUi);
    return {
      ui: exactUi,
      exact: true,
      got: [got.defensive, got.intellectual, got.aggressive],
    };
  }

  for (let ui = 0; ui <= TEMP_MAX; ui += 1) {
    const alloc = categoryAllocation(pool, ui);
    const got = [alloc.defensive, alloc.intellectual, alloc.aggressive];
    const score = got.reduce((sum, v, i) => sum + Math.abs(v - target[i]), 0);
    if (score < bestScore) {
      bestScore = score;
      bestUi = ui;
    }
  }

  const got = categoryAllocation(pool, bestUi);
  return {
    ui: bestUi,
    exact,
    got: [got.defensive, got.intellectual, got.aggressive],
  };
}

/** From incubator.java — temperature / slot-1 quality → DPS & armor % on the pet. */
export const MAX_POINTS_PER_SESSION_DPS_ARMOR = 5;
export const MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR = 8;
export const MAX_TOTAL_POINTS_DPS_ARMOR = 23;
export const MAX_INCUBATOR_POWER_QUALITY = 1000;
export const MAX_BONUS_FOR_POWER_QUALITY = 11;
export const MAX_RE_EXOTIC_DPS_ARMOR_SKILLMOD = 10;
export const CONVERTED_PET_QUALITY_BONUS = 5;
export const TEMP_PERCENT_PER_STEP = 0.1;
/** Matches incubator.MAX_QUALITY_RANGE — top isomerase purity cap (shown as %). */
export const MAX_TOP_ISO_PERCENT = 90;
export const MIN_TOP_ISO_PERCENT = 1;

/** Normalize top isomerase % (1–90) to the quality value the server uses in slot 1. */
export function topIsoPercentToQuality(isoPercent) {
  const pct = Number(isoPercent);
  if (!Number.isFinite(pct)) {
    return 0;
  }
  return Math.min(MAX_TOP_ISO_PERCENT, Math.max(0, pct));
}

/** Read top iso % from a session object (supports legacy OQ fields). */
export function sessionTopIsoPercent(session) {
  if (session.topIsoPct != null && session.topIsoPct !== "") {
    return session.topIsoPct;
  }
  const legacy = session.topIsoOQ ?? session.qualityOQ;
  if (legacy != null && legacy !== "") {
    return String(Math.min(MAX_TOP_ISO_PERCENT, Number(legacy) || 0));
  }
  return String(MAX_TOP_ISO_PERCENT);
}

/**
 * @typedef {object} IncubatorBonuses
 * @property {number} powerQuality Geothermal power OQ in station (0–1000)
 * @property {number} expertiseIncubation expertise_bm_incubation_quality
 * @property {number} stationQuality Incubator station quality (-12…4)
 * @property {number} reDpsArmorMod Focused Enzyme Manipulation / bm_incubator_dps_armor (0–10, doubled server-side)
 * @property {boolean} convertedPet +5 slot-1 quality when converting old pet
 */

/** Shared quality multiplier from expertise, station, power, and RE mod. */
export function incubatorQualityMultiplier(bonuses) {
  const powerQ = Math.max(0, Math.min(MAX_INCUBATOR_POWER_QUALITY, Number(bonuses.powerQuality) || 0));
  const powerBonus = (powerQ / MAX_INCUBATOR_POWER_QUALITY) * MAX_BONUS_FOR_POWER_QUALITY;
  let reMod = Math.max(0, Number(bonuses.reDpsArmorMod) || 0);
  if (reMod > MAX_RE_EXOTIC_DPS_ARMOR_SKILLMOD) {
    reMod = MAX_RE_EXOTIC_DPS_ARMOR_SKILLMOD;
  }
  const exoticBonus = reMod * 2;
  const expertise = Math.max(0, Number(bonuses.expertiseIncubation) || 0);
  const stationQ = Number(bonuses.stationQuality) || 0;
  const sum = expertise + stationQ + powerBonus + exoticBonus;
  return sum > 0 ? 1 + 0.01 * sum : 1;
}

/**
 * One session’s DPS/armor % from top isomerase % (1–90) and temperature (0–10).
 * Server: temp×10% → DPS, (10−temp)×10% → armor; each side capped at 8/session.
 * Points on the egg are % bonuses (beast_lib multiplies damage/armor by 1 + value/100).
 */
export function sessionDpsArmorSplit(topIsoPercent, tempSlider, bonuses = {}) {
  const temp = Math.min(TEMP_MAX, Math.max(0, Math.round(Number(tempSlider) || 0)));
  let quality = topIsoPercentToQuality(topIsoPercent);
  if (bonuses.convertedPet) {
    quality += CONVERTED_PET_QUALITY_BONUS;
  }
  const multiplier = incubatorQualityMultiplier(bonuses);
  const effectiveQuality = quality * multiplier;
  const pool = (effectiveQuality * 0.01) * MAX_POINTS_PER_SESSION_DPS_ARMOR;
  const pctDps = temp * TEMP_PERCENT_PER_STEP;
  const pctArmor = (TEMP_MAX - temp) * TEMP_PERCENT_PER_STEP;
  let dps = pool * pctDps;
  let armor = pool * pctArmor;
  if (dps > MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR) {
    dps = MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR;
  }
  if (armor > MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR) {
    armor = MAX_ADJUSTED_POINTS_PER_SESSION_DPS_ARMOR;
  }
  return {
    dps,
    armor,
    pool,
    pctDps,
    pctArmor,
    effectiveQuality,
    multiplier,
    baseQuality: quality,
    topIsoPercent: topIsoPercentToQuality(topIsoPercent),
  };
}

/** Egg/datapad bonus label (server % ÷ 10, rounded like hatch). */
export function eggBonusDisplay(percent) {
  return Math.round(percent) / 10;
}

/** Cumulative DPS/armor % across all sessions (each side capped at 23 on the egg). */
export function lifetimeDpsArmor(sessions, bonuses = {}) {
  let dps = 0;
  let armor = 0;
  const perSession = [];

  for (let i = 0; i < sessions.length; i += 1) {
    const sess = sessions[i];
    const split = sessionDpsArmorSplit(sessionTopIsoPercent(sess), sess.tempSlider ?? 5, bonuses);
    dps += split.dps;
    armor += split.armor;
    perSession.push({
      session: i + 1,
      cumulativeDps: dps,
      cumulativeArmor: armor,
      ...split,
    });
  }

  const dpsCapped = Math.min(dps, MAX_TOTAL_POINTS_DPS_ARMOR);
  const armorCapped = Math.min(armor, MAX_TOTAL_POINTS_DPS_ARMOR);
  return {
    dps: dpsCapped,
    armor: armorCapped,
    dpsRaw: dps,
    armorRaw: armor,
    dpsEgg: eggBonusDisplay(dpsCapped),
    armorEgg: eggBonusDisplay(armorCapped),
    perSession,
  };
}
