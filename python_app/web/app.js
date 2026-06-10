"use strict";

import {
  SKILLS,
  CATEGORIES,
  TEMP_MAX,
  PERFECT_PET_TARGET,
  APPEARANCE_MUTATION_PER_SKILL,
  MAX_APPEARANCE_MUTATIONS,
  countAppearanceMutations,
  maxPlaceableHydro,
  SESSION3_PURITY_AFTER_S2_MUTATION,
  hydroPool,
  gameNutrientPos,
  categoryAllocation,
  categorySpent,
  sessionSpent,
  removePoint,
  fillToIndex,
  canFillToIndex,
  lifetimeBeforeSession,
  lifetimeHydroBeforeSession,
  priorMutationTotals,
  CATEGORY_SKILL_ORDER,
  grandTotals,
  priorSkillSegments,
  priorSegmentLength,
  findBestSlider,
  lifetimeDpsArmor,
  sessionDpsArmorSplit,
  incubatorQualityMultiplier,
  eggBonusDisplay,
  sessionTopIsoPercent,
  MAX_TOP_ISO_PERCENT,
  MAX_TOTAL_POINTS_DPS_ARMOR,
  fmtNum,
} from "./incubation_calc.js";
import { HYDRO_COMBOS } from "./hydro_combos_data.js";
import { PET_MUTATIONS } from "./pet_mutations_data.js";

const PET_IMAGE_DIR = "assets/pet-images/";

function petImageUrl(imageKey) {
  if (!imageKey) {
    return null;
  }
  return `${PET_IMAGE_DIR}300_swgpets-${imageKey}.png`;
}

const ENZYME_COLORS = {
  Purple: "#7b3fbf",
  Violet: "#9b59d4",
  Green: "#2ecc71",
  "Dark Blue": "#1a3a6e",
  "Light Blue": "#5dade2",
  Orange: "#e67e22",
  Red: "#c0392b",
  Yellow: "#f1c40f",
  Teal: "#1abc9c",
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findStageByResult(base, resultSlug, resultName) {
  if (!base?.stages) {
    return null;
  }
  for (const stage of base.stages) {
    if (stage.resultSlug === resultSlug) {
      return stage.stage;
    }
    if (stage.result?.toLowerCase() === resultName?.toLowerCase()) {
      return stage.stage;
    }
  }
  return null;
}

function resolvePetGuide(slug) {
  const pet = PET_MUTATIONS.bySlug[slug];
  if (!pet) {
    return null;
  }
  const imageKey = pet.imageKey ?? null;
  if (pet.kind === "result" && pet.mutatedFrom) {
    const base = PET_MUTATIONS.bySlug[pet.mutatedFrom];
    const highlightStage =
      pet.highlightStage ?? findStageByResult(base, pet.slug, pet.name);
    return {
      displayName: pet.name,
      baseName: base?.name ?? pet.mutatedFrom,
      baseSlug: pet.mutatedFrom,
      stages: base?.stages ?? [],
      highlightStage,
      isResultPet: true,
      family: pet.family ?? base?.family ?? null,
      imageKey,
    };
  }
  return {
    displayName: pet.name,
    baseName: pet.name,
    baseSlug: pet.slug,
    stages: pet.stages ?? [],
    highlightStage: null,
    isResultPet: false,
    family: pet.family ?? null,
    imageKey,
  };
}

function enzymeSwatch(label) {
  if (!label) {
    return "—";
  }
  const color = ENZYME_COLORS[label] ?? "#666";
  return `<span class="enzyme-swatch" title="${escapeHtml(label)}"><span class="enzyme-swatch-dot" style="background:${escapeHtml(color)}"></span><span class="enzyme-swatch-label">${escapeHtml(label)}</span></span>`;
}

function stageLabel(stageNum) {
  if (stageNum === 1) {
    return "1st";
  }
  if (stageNum === 2) {
    return "2nd";
  }
  if (stageNum === 3) {
    return "3rd *";
  }
  return String(stageNum);
}

function renderMutationGuide(slug) {
  const panel = document.getElementById("mutation-guide-panel");
  if (!panel) {
    return;
  }
  if (!slug) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  const guide = resolvePetGuide(slug);
  if (!guide) {
    panel.hidden = false;
    panel.innerHTML = '<p class="mutation-guide-empty">No mutation data for this pet.</p>';
    return;
  }

  if (!guide.stages.length) {
    const imageUrl = petImageUrl(guide.imageKey);
    const imageBlock = imageUrl
      ? `<div class="mutation-guide-image-wrap"><img class="mutation-guide-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(guide.displayName)}" width="300" height="300" loading="lazy" decoding="async" onerror="this.closest('.mutation-guide-image-wrap')?.remove()" /></div>`
      : "";
    panel.hidden = false;
    panel.innerHTML = `
      <div class="mutation-guide-head">
        <div class="mutation-guide-meta">
          <p class="mutation-guide-header"><strong>${escapeHtml(guide.displayName)}</strong></p>
          <p class="mutation-guide-empty">No mutation enzyme table available for this pet.</p>
        </div>
        ${imageBlock}
      </div>`;
    return;
  }

  const hasAppearanceOnly = guide.stages.some((s) => s.appearanceOnly);

  const stageColClass = (stageNum) =>
    guide.highlightStage === stageNum ? " mutation-stage-highlight" : "";

  const stageHeaderCells = guide.stages
    .map(
      (stage) =>
        `<th class="mutation-stage-col${stageColClass(stage.stage)}">${escapeHtml(stageLabel(stage.stage))}</th>`
    )
    .join("");

  const resultCells = guide.stages
    .map((stage) => {
      const resultText =
        stage.resultSlug && stage.result !== "Random Stat"
          ? `<strong>${escapeHtml(stage.result)}</strong>`
          : escapeHtml(stage.result);
      return `<td class="mutation-stage-col${stageColClass(stage.stage)}">${resultText}</td>`;
    })
    .join("");

  const lyaseCells = guide.stages
    .map(
      (stage) =>
        `<td class="mutation-stage-col${stageColClass(stage.stage)}">${enzymeSwatch(stage.lyase)}</td>`
    )
    .join("");

  const isoTopCells = guide.stages
    .map(
      (stage) =>
        `<td class="mutation-stage-col${stageColClass(stage.stage)}">${enzymeSwatch(stage.isomeraseTop)}</td>`
    )
    .join("");

  const isoBottomCells = guide.stages
    .map(
      (stage) =>
        `<td class="mutation-stage-col${stageColClass(stage.stage)}">${enzymeSwatch(stage.isomeraseBottom)}</td>`
    )
    .join("");

  const baseLine = guide.isResultPet
    ? `<p class="mutation-guide-base">Mutated from: <strong>${escapeHtml(guide.baseName)}</strong></p>`
    : "";
  const familyLine = guide.family
    ? ` <span class="mutation-guide-family">(${escapeHtml(guide.family)})</span>`
    : "";
  const imageUrl = petImageUrl(guide.imageKey);
  const imageBlock = imageUrl
    ? `<div class="mutation-guide-image-wrap"><img class="mutation-guide-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(guide.displayName)}" width="300" height="300" loading="lazy" decoding="async" onerror="this.closest('.mutation-guide-image-wrap')?.remove()" /></div>`
    : "";

  panel.hidden = false;
  panel.innerHTML = `
    <div class="mutation-guide-head">
      <div class="mutation-guide-meta">
        <p class="mutation-guide-header"><strong>${escapeHtml(guide.displayName)}</strong>${familyLine}</p>
        ${baseLine}
      </div>
      ${imageBlock}
    </div>
    <div class="mutation-guide-table-wrap">
      <table class="mutation-guide-table">
        <thead>
          <tr>
            <th class="mutation-guide-row-label"></th>
            ${stageHeaderCells}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th class="mutation-guide-row-label">Result</th>
            ${resultCells}
          </tr>
          <tr>
            <th class="mutation-guide-row-label">Lyase</th>
            ${lyaseCells}
          </tr>
          <tr>
            <th class="mutation-guide-row-label">Iso ↑</th>
            ${isoTopCells}
          </tr>
          <tr>
            <th class="mutation-guide-row-label">Iso ↓</th>
            ${isoBottomCells}
          </tr>
        </tbody>
      </table>
    </div>
    ${
      hasAppearanceOnly
        ? '<p class="mutation-guide-footnote">* 3rd column applies only if session 2 was an appearance mutation; otherwise reuse the 2nd column combo.</p>'
        : ""
    }
  `;
}

function renderPetSelect() {
  const select = document.getElementById("pet-mutation-select");
  if (!select) {
    return;
  }

  const basePets = PET_MUTATIONS.pets
    .filter((p) => p.stages?.length)
    .sort((a, b) => a.name.localeCompare(b.name));
  const resultPets = PET_MUTATIONS.pets
    .filter((p) => p.mutatedFrom)
    .sort((a, b) => a.name.localeCompare(b.name));
  const otherPets = PET_MUTATIONS.pets
    .filter((p) => !p.stages?.length && !p.mutatedFrom)
    .sort((a, b) => a.name.localeCompare(b.name));

  select.innerHTML = '<option value="">Select a pet…</option>';

  const addGroup = (label, pets) => {
    if (!pets.length) {
      return;
    }
    const group = document.createElement("optgroup");
    group.label = label;
    pets.forEach((pet) => {
      const opt = document.createElement("option");
      opt.value = pet.slug;
      opt.textContent = pet.name;
      group.appendChild(opt);
    });
    select.appendChild(group);
  };

  addGroup("Base / incubation pets", basePets);
  addGroup("Mutation results", resultPets);
  addGroup("Other", otherPets);
}

const SESSION_COUNT = 3;
/** Read-only tab after session 3 when two appearance mutations are marked. */
const PREVIEW_SESSION_INDEX = 3;

function emptyPoints() {
  return Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
}

function defaultIncubatorBonuses() {
  return {
    powerQuality: "1000",
    expertiseIncubation: "20",
    stationQuality: "4",
    reDpsArmorMod: "9",
    convertedPet: false,
  };
}

function defaultSessions() {
  return Array.from({ length: SESSION_COUNT }, () => ({
    purity: "20",
    slider: 5,
    tempSlider: 5,
    topIsoPct: "90",
    points: emptyPoints(),
    appearanceMutation: false,
  }));
}

function readIncubatorBonuses() {
  const b = state.incubator;
  return {
    powerQuality: Number(b.powerQuality),
    expertiseIncubation: Number(b.expertiseIncubation),
    stationQuality: Number(b.stationQuality),
    reDpsArmorMod: Number(b.reDpsArmorMod),
    convertedPet: Boolean(b.convertedPet),
  };
}

const state = {
  activeSession: 0,
  sessions: defaultSessions(),
  incubator: defaultIncubatorBonuses(),
};

const HYDRO_PRESETS_60 = [
  { label: "20 · 20 · 20", values: ["20", "20", "20"], sliders: [9, 1, 5], mutations: 0 },
  { label: "8 · 20 · 20", values: ["8", "20", "20"], sliders: [9, 1, 5], mutations: 0 },
  { label: "20 · 20 · 12", values: ["20", "20", "12"], sliders: [9, 1, 5], mutations: 0 },
  { label: "12 · 12 · 12", values: ["12", "12", "12"], sliders: [5, 5, 5], mutations: 0 },
];

function applySchedulePreset(preset) {
  state.sessions = defaultSessions();
  preset.values.forEach((v, idx) => {
    state.sessions[idx].purity = v;
    if (preset.sliders) {
      state.sessions[idx].slider = preset.sliders[idx];
    }
    state.sessions[idx].points = emptyPoints();
  });
  if (preset.mutations === 1) {
    state.sessions[1].appearanceMutation = true;
  } else if (preset.mutations === 2) {
    state.sessions[1].appearanceMutation = true;
    state.sessions[2].appearanceMutation = true;
  }
  state.activeSession = 0;
  render();
}

function formatHydroComboLabel(combo) {
  const purities = (combo.purities ?? combo.sessions.map((s) => s.pool)).join("·");
  const splits = combo.sessions.map((s) => s.dia.join("·")).join(" / ");
  return `${purities} — ${splits}`;
}

function syncPurityInput(force = false) {
  const purityInput = document.getElementById("hydro-purity");
  if (!purityInput || isPreviewTab()) {
    return;
  }
  const purity = state.sessions[state.activeSession].purity;
  if (force || document.activeElement !== purityInput) {
    purityInput.value = purity;
  }
}

function applyComboAppearanceMutations(pack, appearanceMutationSession = 1) {
  if (pack.mutations === 1) {
    const idx = appearanceMutationSession === 2 ? 2 : 1;
    state.sessions[idx].appearanceMutation = true;
  } else if (pack.mutations === 2) {
    state.sessions[1].appearanceMutation = true;
    state.sessions[2].appearanceMutation = true;
  }
}

function applyHydroCombo(comboKey, comboIndex, { appearanceMutationSession = 1 } = {}) {
  const pack = HYDRO_COMBOS[comboKey];
  const combo = pack?.combos?.[comboIndex];
  if (!combo) {
    return;
  }

  state.sessions = defaultSessions();
  const purities = combo.purities ?? combo.sessions.map((s) => s.pool);
  combo.sessions.forEach((sess, sessionIdx) => {
    const { ui } = findBestSlider(sess.pool, sess.dia);
    state.sessions[sessionIdx].purity = String(purities[sessionIdx]);
    state.sessions[sessionIdx].slider = ui;
    state.sessions[sessionIdx].points = emptyPoints();
  });

  applyComboAppearanceMutations(pack, appearanceMutationSession);

  state.activeSession = 0;
  render();
  syncPurityInput(true);
}

function renderPresetControls() {
  const root = document.getElementById("hydro-presets");
  if (!root) {
    return;
  }
  root.innerHTML = "";

  const addGroup = (title, build, { showCategory = false } = {}) => {
    const group = document.createElement("div");
    group.className = "preset-group";
    const labelRow = document.createElement("div");
    labelRow.className = "preset-group-label-row";
    const label = document.createElement("span");
    label.className = "preset-group-label";
    label.textContent = title;
    labelRow.appendChild(label);
    let categoryEl = null;
    if (showCategory) {
      categoryEl = document.createElement("span");
      categoryEl.className = "preset-group-category";
      categoryEl.hidden = true;
      labelRow.appendChild(categoryEl);
    }
    group.appendChild(labelRow);
    build(group, categoryEl);
    root.appendChild(group);
  };

  addGroup("60pt hydro", (group) => {
    const row = document.createElement("div");
    row.className = "preset-row";
    HYDRO_PRESETS_60.forEach((preset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      btn.textContent = preset.label;
      btn.addEventListener("click", () => applySchedulePreset(preset));
      row.appendChild(btn);
    });
    group.appendChild(row);
  });

  [
    {
      key: "m48",
      hint: "Choose appearance mutation session (S2 or S3), pick a path, then Apply — you place hydro bubbles yourself.",
      chooseAppearanceSession: true,
    },
    {
      key: "m36",
      hint: "36 hydro total. Apply marks appearance mutations on S2 and S3; place hydro points manually in each session tab.",
    },
  ].forEach(({ key, hint, chooseAppearanceSession = false }) => {
    const pack = HYDRO_COMBOS[key];
    if (!pack) {
      return;
    }
    addGroup(
      pack.title,
      (group, categoryEl) => {
      const row = document.createElement("div");
      row.className = "preset-combo-row";
      let mutSessionSelect = null;
      if (chooseAppearanceSession) {
        const mutPhase = document.createElement("label");
        mutPhase.className = "preset-mut-phase";
        mutPhase.appendChild(document.createTextNode("Appearance "));
        mutSessionSelect = document.createElement("select");
        mutSessionSelect.className = "preset-select preset-mut-select";
        mutSessionSelect.setAttribute("aria-label", "Appearance mutation session for 48pt path");
        [
          { value: "1", label: "Session 2" },
          { value: "2", label: "Session 3" },
        ].forEach(({ value, label }) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          mutSessionSelect.appendChild(opt);
        });
        mutPhase.appendChild(mutSessionSelect);
        row.appendChild(mutPhase);
      }
      const select = document.createElement("select");
      select.className = "preset-select preset-combo-select";
      select.setAttribute("aria-label", `${pack.title} distribution`);
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = `Choose purity path (${pack.combos.length} combos)…`;
      select.appendChild(placeholder);
      const byLabel = new Map();
      pack.combos.forEach((combo, idx) => {
        const label = combo.label || combo.purities?.join("·") || String(idx);
        if (!byLabel.has(label)) {
          byLabel.set(label, []);
        }
        byLabel.get(label).push({ combo, idx });
      });
      byLabel.forEach((entries, label) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = label;
        entries.forEach(({ combo, idx }, variantIdx) => {
          const opt = document.createElement("option");
          opt.value = String(idx);
          const splits = combo.sessions.map((s) => s.dia.join("·")).join(" / ");
          const prefix = entries.length > 1 ? `#${variantIdx + 1} ` : "";
          opt.textContent = `${prefix}${splits}`;
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });
      const syncCategoryBadge = (combo) => {
        if (!categoryEl) {
          return;
        }
        const category = combo?.label || combo?.purities?.join("·") || "";
        categoryEl.textContent = category;
        categoryEl.hidden = !category;
      };
      const syncFromSelect = () => {
        if (select.value === "") {
          syncCategoryBadge(null);
          return;
        }
        const idx = Number(select.value);
        if (Number.isFinite(idx)) {
          syncCategoryBadge(pack.combos[idx]);
        }
      };
      const applySelected = () => {
        if (select.value === "") {
          return;
        }
        const idx = Number(select.value);
        if (!Number.isFinite(idx)) {
          return;
        }
        syncCategoryBadge(pack.combos[idx]);
        const appearanceMutationSession = mutSessionSelect
          ? Number(mutSessionSelect.value)
          : 1;
        applyHydroCombo(key, idx, { appearanceMutationSession });
      };
      select.addEventListener("change", chooseAppearanceSession ? syncFromSelect : applySelected);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn preset-apply";
      btn.textContent = "Apply";
      btn.addEventListener("click", applySelected);
      row.appendChild(select);
      row.appendChild(btn);
      group.appendChild(row);
      const note = document.createElement("p");
      note.className = "preset-hint";
      note.textContent = hint;
      group.appendChild(note);
    },
      { showCategory: true },
    );
  });
}

function isPreviewTab() {
  return state.activeSession === PREVIEW_SESSION_INDEX;
}

function showPreviewTab() {
  return countAppearanceMutations(state.sessions) === MAX_APPEARANCE_MUTATIONS;
}

function ensureActiveSessionValid() {
  if (isPreviewTab() && !showPreviewTab()) {
    state.activeSession = SESSION_COUNT - 1;
  }
}

function active() {
  if (isPreviewTab()) {
    return state.sessions[SESSION_COUNT - 1];
  }
  return state.sessions[state.activeSession];
}

function viewBeforeIndex() {
  return isPreviewTab() ? SESSION_COUNT : state.activeSession;
}

function priorHydroTotals() {
  return lifetimeHydroBeforeSession(state.sessions, viewBeforeIndex());
}

function priorMutTotals() {
  return priorMutationTotals(state.sessions, viewBeforeIndex());
}

function priorTotals() {
  return lifetimeBeforeSession(state.sessions, viewBeforeIndex());
}

function isPoolOverCapacity() {
  if (isPreviewTab()) {
    return false;
  }
  const pool = hydroPool(active().purity);
  const maxPlaceable = maxPlaceableHydro(state.sessions, state.activeSession);
  return pool > maxPlaceable;
}

function sessionContext() {
  const session = active();
  const pool = isPreviewTab() ? 0 : hydroPool(session.purity);
  const alloc = isPreviewTab()
    ? { defensive: 0, intellectual: 0, aggressive: 0, ratios: [0, 0, 0] }
    : categoryAllocation(pool, session.slider);
  const categoryBudget = {
    defensive: alloc.defensive,
    intellectual: alloc.intellectual,
    aggressive: alloc.aggressive,
  };
  return {
    session,
    pool,
    alloc,
    categoryBudget,
    priorTotals: priorTotals(),
    sessionPoints: isPreviewTab() ? emptyPoints() : session.points,
  };
}

/** Per-category skill totals from a full skill map (e.g. grandTotals.totals). */
function categoryTotalsFromSkills(skillTotals) {
  return Object.fromEntries(
    CATEGORIES.map((cat) => [cat.id, categorySpent(skillTotals, cat.id)])
  );
}

function renderSessionTabs() {
  const tabsRoot = document.getElementById("session-tabs");
  if (!tabsRoot) {
    return;
  }
  ensureActiveSessionValid();
  tabsRoot.innerHTML = "";

  for (let idx = 0; idx < SESSION_COUNT; idx += 1) {
    const s = state.sessions[idx];
    const p = hydroPool(s.purity);
    const sp = sessionSpent(s.points);
    const mutTag = s.appearanceMutation ? " ★" : "";
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "session-tab";
    tab.dataset.session = String(idx);
    tab.textContent = `Session ${idx + 1} (${sp}/${p})${mutTag}`;
    tab.classList.toggle("active", state.activeSession === idx);
    tabsRoot.appendChild(tab);
  }

  if (showPreviewTab()) {
    const gt = grandTotals(state.sessions);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "session-tab preview-tab";
    tab.dataset.session = String(PREVIEW_SESSION_INDEX);
    tab.textContent = `Final (${gt.combined}pt${gt.combined === PERFECT_PET_TARGET ? " ✓" : ""})`;
    tab.classList.toggle("active", isPreviewTab());
    tabsRoot.appendChild(tab);
  }
}

function render() {
  renderSessionTabs();
  const preview = isPreviewTab();
  const windowBody = document.getElementById("window-body");
  if (windowBody) {
    windowBody.classList.toggle("preview-mode", preview);
  }

  const ctx = sessionContext();
  const { session, pool, alloc, categoryBudget } = ctx;
  const editSession = preview ? state.sessions[SESSION_COUNT - 1] : session;
  const spent = sessionSpent(editSession.points);
  const remaining = Math.max(0, pool - spent);
  const gt = grandTotals(state.sessions);
  const finalCategoryTotals = preview ? categoryTotalsFromSkills(gt.totals) : null;
  const ptsRemaining = Math.max(0, PERFECT_PET_TARGET - gt.combined);

  const syncInputValue = (el, value) => {
    if (el && document.activeElement !== el) {
      el.value = value;
    }
  };

  const purityInput = document.getElementById("hydro-purity");
  if (purityInput) {
    syncInputValue(purityInput, editSession.purity);
    purityInput.disabled = preview;
  }

  const isoInput = document.getElementById("top-iso-pct");
  if (isoInput) {
    syncInputValue(isoInput, sessionTopIsoPercent(editSession));
    isoInput.disabled = preview;
  }

  document.getElementById("power-quality").value = state.incubator.powerQuality;
  document.getElementById("expertise-incubation").value = state.incubator.expertiseIncubation;
  document.getElementById("station-quality").value = state.incubator.stationQuality;
  document.getElementById("re-dps-armor").value = state.incubator.reDpsArmorMod;
  document.getElementById("converted-pet").checked = state.incubator.convertedPet;
  const maxPlaceable = preview
    ? 0
    : maxPlaceableHydro(state.sessions, state.activeSession);
  const overCapacity = !preview && pool > maxPlaceable;
  purityInput.classList.toggle("over-capacity", overCapacity);

  const slider = document.getElementById("nutrient-slider");
  slider.disabled = preview;
  slider.value = String(editSession.slider);
  document.getElementById("nutrient-value").textContent = String(gameNutrientPos(session.slider));
  if (preview) {
    document.getElementById("pool-total").textContent = String(gt.hydroSpent);
    document.getElementById("pool-spent").textContent = String(gt.combined);
    document.getElementById("pool-remaining").textContent = String(ptsRemaining);
    document.getElementById("ratio-hint").textContent =
      `${finalCategoryTotals.defensive} · ${finalCategoryTotals.intellectual} · ${finalCategoryTotals.aggressive} (final build)`;
  } else {
    document.getElementById("pool-total").textContent = String(pool);
    document.getElementById("pool-remaining").textContent = String(remaining);
    document.getElementById("pool-spent").textContent = String(spent);
    const ratios = alloc.ratios.join(" : ");
    document.getElementById("ratio-hint").textContent =
      `${alloc.defensive} · ${alloc.intellectual} · ${alloc.aggressive} (ratio ${ratios})`;
  }

  const tempSlider = document.getElementById("temp-slider");
  if (tempSlider) {
    tempSlider.disabled = preview;
    tempSlider.value = String(editSession.tempSlider ?? 5);
    document.getElementById("temp-value").textContent = String(editSession.tempSlider ?? 5);
    const bonuses = readIncubatorBonuses();
    const split = sessionDpsArmorSplit(
      sessionTopIsoPercent(editSession),
      editSession.tempSlider ?? 5,
      bonuses,
    );
    const pctArmor = Math.round(split.pctArmor * 100);
    const pctDps = Math.round(split.pctDps * 100);
    document.getElementById("temp-split-hint").textContent =
      `This session: +${fmtNum(split.dps, 1)}% DPS · +${fmtNum(split.armor, 1)}% armor (${pctDps}/${pctArmor} split)`;
  }

  renderPetBonusPanels();

  document.querySelectorAll(".anchor-btn").forEach((btn) => {
    const anchor = categoryAllocation(pool, Number(btn.dataset.slider));
    btn.textContent = `${anchor.defensive}-${anchor.intellectual}-${anchor.aggressive}`;
  });

  const purityHint = document.getElementById("purity-hint");
  if (purityHint) {
    const hints = [];
    if (overCapacity) {
      hints.push(`Only ${maxPlaceable} empty slot(s) left — set purity to ≤ ${maxPlaceable}.`);
    }
    if (preview) {
      if (gt.combined === PERFECT_PET_TARGET && ptsRemaining === 0) {
        hints.push(`Perfect ${PERFECT_PET_TARGET}-point pet — 0 pt remaining.`);
      } else if (ptsRemaining > 0) {
        hints.push(`${ptsRemaining} pt remaining to reach ${PERFECT_PET_TARGET}.`);
      }
      if (gt.mutBonusWasted > 0) {
        hints.push(
          `${gt.mutBonusWasted} mutation pt${gt.mutBonusWasted === 1 ? "" : "s"} had no room (10/skill cap).`
        );
      }
    } else if (
      state.activeSession === 2
      && state.sessions[1]?.appearanceMutation
      && maxPlaceable > 0
    ) {
      hints.push(
        `Session 2 appearance mutation: use ${SESSION3_PURITY_AFTER_S2_MUTATION}pt hydro, center slider → 1 · 10 · 1.`
      );
    }
    purityHint.textContent = hints.join(" ");
    purityHint.classList.toggle("warn", hints.length > 0);
  }

  const skillsHint = document.getElementById("skills-hint");
  if (skillsHint) {
    if (preview) {
      const perfect =
        gt.combined === PERFECT_PET_TARGET && ptsRemaining === 0
          ? ` Perfect ${PERFECT_PET_TARGET}-point pet — 0 pt remaining.`
          : "";
      skillsHint.textContent =
        `Read-only final build — dim = hydro · purple = appearance mutation (+2/skill each).${perfect}`;
    } else {
      const hasPriorMut = SKILLS.some((s) => (priorMutTotals()[s.id] || 0) > 0);
      const mutHint = hasPriorMut
        ? " · purple = prior appearance mutation"
        : "";
      skillsHint.textContent = state.activeSession > 0
        ? `Dim = prior hydro (locked) · click any row left→right · last hydro bubble removes one${mutHint}`
        : `Click any row left→right within that color’s budget · last hydro bubble removes one${mutHint}`;
    }
  }

  const skillsRoot = document.getElementById("skills-root");
  skillsRoot.innerHTML = "";

  const skillById = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

  for (const cat of CATEGORIES) {
    const budget = preview ? finalCategoryTotals[cat.id] : categoryBudget[cat.id];
    const catSpent = preview ? budget : categorySpent(editSession.points, cat.id);

    const block = document.createElement("section");
    block.className = `category-block category-${cat.id}`;
    block.style.setProperty("--cat-color", cat.color);

    const poolBox = document.createElement("div");
    poolBox.className = "category-pool-box";
    poolBox.id = `cat-pool-${cat.id}`;
    poolBox.textContent = String(budget);
    poolBox.classList.toggle("depleted", budget === 0);
    poolBox.classList.toggle("over-budget", catSpent > budget);
    poolBox.setAttribute("aria-label", `${cat.label} points available (${catSpent} placed)`);
    block.appendChild(poolBox);

    const skillsCol = document.createElement("div");
    skillsCol.className = "category-skills";
    const skillIds = CATEGORY_SKILL_ORDER[cat.id];

    skillIds.forEach((skillId) => {
      const skill = skillById[skillId];
      if (!skill) {
        return;
      }
      const priorSegments = priorSkillSegments(state.sessions, viewBeforeIndex(), skill.id);
      const priorLen = priorSegmentLength(priorSegments);
      const priorHydro = priorSegments
        .filter((seg) => seg.type === "hydro")
        .reduce((sum, seg) => sum + seg.count, 0);
      const priorMut = priorSegments
        .filter((seg) => seg.type === "mutation")
        .reduce((sum, seg) => sum + seg.count, 0);
      const current = preview ? 0 : editSession.points[skill.id] || 0;
      const total = Math.min(10, priorLen + current);

      const row = document.createElement("div");
      row.className = "skill-row";

      const name = document.createElement("span");
      name.className = "skill-name";
      name.textContent = skill.label;
      const parts = [];
      if (priorHydro > 0) {
        parts.push(`${priorHydro} prior hydro`);
      }
      if (priorMut > 0) {
        parts.push(`${priorMut} prior mutation`);
      }
      if (current > 0) {
        parts.push(`${current} hydro`);
      }
      name.title = parts.length > 0
        ? `Total ${total} / 10 (${parts.join(" · ")})`
        : `Total ${total} / 10`;
      row.appendChild(name);

      const lane = document.createElement("div");
      lane.className = "skill-lane";
      const bubbles = document.createElement("div");
      bubbles.className = "bubbles";
      bubbles.setAttribute("role", "group");
      bubbles.setAttribute("aria-label", `${skill.label} points`);

      const clickCtx = {
        sessionPoints: session.points,
        priorTotals: ctx.priorTotals,
        categoryBudget,
        pool,
      };
      const hydroStart = priorLen;
      const hydroEnd = hydroStart + current;
      let bubbleIndex = 0;

      for (const seg of priorSegments) {
        for (let k = 0; k < seg.count; k += 1) {
          const pip = document.createElement("button");
          pip.type = "button";
          pip.className = "bubble filled prior-filled";
          pip.dataset.skill = skill.id;
          pip.dataset.index = String(bubbleIndex);
          pip.disabled = true;
          if (seg.type === "mutation") {
            pip.classList.add("mutation-filled");
            pip.setAttribute("aria-label", `${skill.label} point ${bubbleIndex + 1} (prior appearance mutation)`);
          } else {
            pip.setAttribute("aria-label", `${skill.label} point ${bubbleIndex + 1} (prior hydro)`);
          }
          bubbles.appendChild(pip);
          bubbleIndex += 1;
        }
      }

      for (let i = bubbleIndex; i < 10; i += 1) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "bubble";
        pip.dataset.skill = skill.id;
        pip.dataset.index = String(i);

        if (i < hydroEnd) {
          pip.classList.add("filled");
          const removable = !preview && i === hydroEnd - 1;
          pip.disabled = !removable;
          pip.setAttribute("aria-label", `${skill.label} point ${i + 1}`);
        } else {
          pip.classList.add("empty");
          pip.setAttribute("aria-label", `${skill.label} point ${i + 1}`);
          if (preview) {
            pip.disabled = true;
          } else {
            const sessionIndex = i - hydroStart;
            const fillable = !overCapacity
              && canFillToIndex(clickCtx, skill.id, sessionIndex);
            pip.disabled = !fillable;
            if (fillable) {
              pip.classList.add("next");
            }
          }
        }
        bubbles.appendChild(pip);
      }
      lane.appendChild(bubbles);
      row.appendChild(lane);

      skillsCol.appendChild(row);
    });

    block.appendChild(skillsCol);
    skillsRoot.appendChild(block);
  }

  const mutCount = countAppearanceMutations(state.sessions);
  document.querySelectorAll("[data-session-mut]").forEach((input) => {
    const idx = Number(input.dataset.sessionMut);
    input.checked = Boolean(state.sessions[idx]?.appearanceMutation);
    input.disabled = !input.checked && mutCount >= MAX_APPEARANCE_MUTATIONS;
  });

  const summary = document.getElementById("grand-summary");
  summary.innerHTML = SKILLS.map((skill) => {
    const v = gt.totals[skill.id];
    const capped = v >= 10 ? " cap" : "";
    return `<div class="grand-row${capped}"><span>${skill.label}</span><strong>${v}</strong></div>`;
  }).join("");

  document.getElementById("hydro-total").textContent = String(gt.hydroSpent);
  document.getElementById("mut-bonus").textContent = `+${gt.mutBonus}`;
  document.getElementById("combined-total").textContent = String(gt.combined);
  const combinedEl = document.getElementById("combined-total");
  combinedEl.classList.toggle("perfect", gt.combined === PERFECT_PET_TARGET);
  combinedEl.classList.toggle("under", gt.combined < PERFECT_PET_TARGET);
  combinedEl.classList.toggle("over", gt.combined > PERFECT_PET_TARGET);

  let targetNote =
    gt.combined === PERFECT_PET_TARGET
      ? "Perfect 60-point build."
      : gt.combined < PERFECT_PET_TARGET
        ? `${PERFECT_PET_TARGET - gt.combined} points short of 60.`
        : `${gt.combined - PERFECT_PET_TARGET} points over 60.`;
  if (gt.mutBonusWasted > 0) {
    targetNote += ` ${gt.mutBonusWasted} mutation pt${gt.mutBonusWasted === 1 ? "" : "s"} capped (10/skill max).`;
  }
  document.getElementById("target-note").textContent = targetNote;

  const hydroNeeded = Math.max(0, PERFECT_PET_TARGET - gt.mutBonus);
  let mutNote;
  if (preview) {
    mutNote =
      gt.combined === PERFECT_PET_TARGET && ptsRemaining === 0
        ? `Perfect ${PERFECT_PET_TARGET}-point pet — 0 pt remaining (${gt.hydroSpent} hydro + ${gt.mutBonus} mutation).`
        : `${ptsRemaining} pt remaining for a ${PERFECT_PET_TARGET}-point pet (${gt.hydroSpent} hydro + ${gt.mutBonus} mutation).`;
    if (gt.mutBonusWasted > 0) {
      mutNote += ` ${gt.mutBonusWasted} mutation pt${gt.mutBonusWasted === 1 ? "" : "s"} capped at 10/skill.`;
    }
  } else {
    mutNote = mutCount === 0
      ? `No appearance mutations — need ${PERFECT_PET_TARGET} from hydros.`
      : `${mutCount}/${MAX_APPEARANCE_MUTATIONS} marked — +${gt.mutBonus} free (+${APPEARANCE_MUTATION_PER_SKILL}/skill). Hydro for 60: ${hydroNeeded}.`;
    if (showPreviewTab()) {
      mutNote += " Open Final tab to see the completed build.";
    }
  }
  document.getElementById("mut-note").textContent = mutNote;

}

function renderPetBonusPanels() {
  const bonuses = readIncubatorBonuses();
  const life = lifetimeDpsArmor(state.sessions, bonuses);
  const mult = incubatorQualityMultiplier(bonuses);
  const preview = isPreviewTab();
  const highlightIdx = preview ? SESSION_COUNT - 1 : state.activeSession;
  const cappedDps = life.dps >= MAX_TOTAL_POINTS_DPS_ARMOR - 0.05;
  const cappedArmor = life.armor >= MAX_TOTAL_POINTS_DPS_ARMOR - 0.05;

  const strip = document.getElementById("pet-bonus-strip");
  if (strip) {
    strip.innerHTML = `
      <div class="pet-bonus-strip-inner">
        <span class="pet-bonus-strip-label">Pet bonus on egg</span>
        <div class="pet-bonus-strip-stats">
          <span class="pet-bonus-strip-stat"><strong>DPS</strong> ${fmtNum(life.dpsEgg, 1)}${cappedDps ? " capped" : ""}</span>
          <span class="pet-bonus-strip-stat"><strong>Armor</strong> ${fmtNum(life.armorEgg, 1)}${cappedArmor ? " capped" : ""}</span>
        </div>
        <span class="pet-bonus-strip-note">Datapad · 3 sessions · ×${fmtNum(mult, 2)} geo</span>
      </div>`;
  }

  const dpsPanel = document.getElementById("dps-armor-panel");
  if (!dpsPanel) {
    return;
  }

  let html = `<div class="dps-armor-title">DPS / Armor (top iso %, max ${MAX_TOP_ISO_PERCENT})</div>`;
  html += `<div class="pet-bonus-hero">
    <div class="pet-bonus-hero-stat">
      <span class="pet-bonus-hero-label">DPS bonus</span>
      <strong class="pet-bonus-hero-value">${fmtNum(life.dpsEgg, 1)}</strong>
      <span class="pet-bonus-hero-sub">+${fmtNum(life.dps, 1)}% on egg</span>
    </div>
    <div class="pet-bonus-hero-stat">
      <span class="pet-bonus-hero-label">Armor bonus</span>
      <strong class="pet-bonus-hero-value">${fmtNum(life.armorEgg, 1)}</strong>
      <span class="pet-bonus-hero-sub">+${fmtNum(life.armor, 1)}% on egg</span>
    </div>
  </div>`;
  html += `<p class="pet-bonus-session-hint">Per session:</p>`;
  life.perSession.forEach((row, idx) => {
    const active = idx === highlightIdx ? " dps-armor-active" : "";
    const iso = sessionTopIsoPercent(state.sessions[idx]);
    html += `<div class="dps-armor-row${active}">
      <span>Session ${row.session} · ${iso}% iso</span>
      <strong>DPS ${fmtNum(eggBonusDisplay(row.dps), 1)} · Armor ${fmtNum(eggBonusDisplay(row.armor), 1)}</strong>
    </div>`;
  });
  html += `<div class="dps-armor-row dps-armor-total">
    <span>Egg total (cap 2.3 each)</span>
    <strong>DPS ${fmtNum(life.dpsEgg, 1)} · Armor ${fmtNum(life.armorEgg, 1)}</strong>
  </div>`;
  if (life.dpsRaw > life.dps || life.armorRaw > life.armor) {
    html += `<p class="dps-armor-waste">Raw sum ${fmtNum(life.dpsRaw, 1)}% / ${fmtNum(life.armorRaw, 1)}% — capped at 23% per stat.</p>`;
  }
  dpsPanel.innerHTML = html;
}

function bind() {
  document.getElementById("session-tabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest(".session-tab");
    if (!tab || tab.dataset.session === undefined) {
      return;
    }
    state.activeSession = Number(tab.dataset.session);
    render();
    syncPurityInput(true);
  });

  document.getElementById("hydro-purity").addEventListener("input", (e) => {
    if (isPreviewTab()) {
      return;
    }
    active().purity = e.target.value;
    render();
  });

  document.getElementById("top-iso-pct")?.addEventListener("input", (e) => {
    if (isPreviewTab()) {
      return;
    }
    active().topIsoPct = e.target.value;
    render();
  });
  document.getElementById("top-iso-pct")?.addEventListener("blur", (e) => {
    if (isPreviewTab()) {
      return;
    }
    const raw = String(e.target.value).trim();
    if (!raw) {
      active().topIsoPct = "90";
    } else {
      active().topIsoPct = raw;
    }
    render();
  });

  const bindBonusInput = (id, key) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.addEventListener("input", () => {
      state.incubator[key] = el.value;
      render();
    });
  };
  bindBonusInput("power-quality", "powerQuality");
  bindBonusInput("expertise-incubation", "expertiseIncubation");
  bindBonusInput("station-quality", "stationQuality");
  bindBonusInput("re-dps-armor", "reDpsArmorMod");
  document.getElementById("converted-pet")?.addEventListener("change", (e) => {
    state.incubator.convertedPet = e.target.checked;
    render();
  });

  const slider = document.getElementById("nutrient-slider");
  slider.addEventListener("input", (e) => {
    if (isPreviewTab()) {
      return;
    }
    active().slider = Number(e.target.value);
    active().points = emptyPoints();
    render();
  });

  document.getElementById("nutrient-down").addEventListener("click", () => {
    if (isPreviewTab()) {
      return;
    }
    active().slider = Math.max(0, active().slider - 1);
    active().points = emptyPoints();
    render();
  });
  document.getElementById("nutrient-up").addEventListener("click", () => {
    if (isPreviewTab()) {
      return;
    }
    active().slider = Math.min(TEMP_MAX, active().slider + 1);
    active().points = emptyPoints();
    render();
  });

  const tempSliderEl = document.getElementById("temp-slider");
  tempSliderEl?.addEventListener("input", (e) => {
    if (isPreviewTab()) {
      return;
    }
    active().tempSlider = Number(e.target.value);
    render();
  });
  document.getElementById("temp-down")?.addEventListener("click", () => {
    if (isPreviewTab()) {
      return;
    }
    active().tempSlider = Math.max(0, (active().tempSlider ?? 5) - 1);
    render();
  });
  document.getElementById("temp-up")?.addEventListener("click", () => {
    if (isPreviewTab()) {
      return;
    }
    active().tempSlider = Math.min(TEMP_MAX, (active().tempSlider ?? 5) + 1);
    render();
  });

  document.getElementById("skills-root").addEventListener("click", (e) => {
    if (isPreviewTab()) {
      return;
    }
    const btn = e.target.closest(".bubble");
    if (!btn || btn.disabled) {
      return;
    }
    const skillId = btn.dataset.skill;
    const ctx = sessionContext();
    const priorSegments = priorSkillSegments(state.sessions, viewBeforeIndex(), skillId);
    const hydroStart = priorSegmentLength(priorSegments);
    const current = active().points[skillId] || 0;
    const index = Number(btn.dataset.index);
    const clickCtx = {
      sessionPoints: active().points,
      priorTotals: ctx.priorTotals,
      categoryBudget: ctx.categoryBudget,
      pool: ctx.pool,
    };
    if (index < hydroStart) {
      return;
    }
    const sessionIndex = index - hydroStart;

    if (index < hydroStart + current) {
      if (index === hydroStart + current - 1) {
        active().points = removePoint(clickCtx, skillId).sessionPoints;
      }
    } else if (!isPoolOverCapacity()) {
      active().points = fillToIndex(clickCtx, skillId, sessionIndex).sessionPoints;
    }
    render();
  });

  document.querySelectorAll("[data-session-mut]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.sessionMut);
      if (input.checked) {
        const others = state.sessions.filter((s, i) => i !== idx && s.appearanceMutation).length;
        if (others >= MAX_APPEARANCE_MUTATIONS) {
          input.checked = false;
          return;
        }
      }
      state.sessions[idx].appearanceMutation = input.checked;
      ensureActiveSessionValid();
      render();
    });
  });

  document.getElementById("reset-session").addEventListener("click", () => {
    if (isPreviewTab()) {
      return;
    }
    active().points = emptyPoints();
    render();
  });

  document.getElementById("reset-all").addEventListener("click", () => {
    state.sessions = defaultSessions();
    state.incubator = defaultIncubatorBonuses();
    state.activeSession = 0;
    render();
  });

  renderPresetControls();
  renderPetSelect();

  const petSelect = document.getElementById("pet-mutation-select");
  if (petSelect) {
    petSelect.addEventListener("change", () => {
      renderMutationGuide(petSelect.value);
    });
  }

  document.querySelectorAll(".anchor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isPreviewTab()) {
        return;
      }
      active().slider = Number(btn.dataset.slider);
      active().points = emptyPoints();
      render();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bind();
  render();
});
