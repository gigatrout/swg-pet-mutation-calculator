"use strict";

import {
  REPROCESSING_FINAL_CAP,
  DPS_ARMOR_DISPLAY_RATE,
  calcPurityRange,
  calcMutagenRange,
  createdPurityRange,
  processNote,
  calcIncubation,
  incubationNote,
  fmtNum,
  fmtRange,
} from "./hydro_calc.js";

const PROCESS_KEYS = ["centrifuge", "processor", "reprocessing"];

const PROCESS_DEFAULTS = {
  centrifuge: {
    startPurity: "5",
    startMutagen: "5",
    hardware: "1",
    hardwareMutagen: "1",
    consumable: "1",
    consumableMutagen: "1",
    ge: "100",
  },
  processor: {
    startPurity: "8",
    startMutagen: "8",
    hardware: "1",
    hardwareMutagen: "1",
    consumable: "1",
    consumableMutagen: "1",
    ge: "100",
  },
  reprocessing: {
    elementA: "10",
    elementMutagenA: "10",
    elementB: "10",
    elementMutagenB: "10",
    elementC: "10",
    elementMutagenC: "10",
    elementD: "10",
    elementMutagenD: "10",
    elementE: "10",
    elementMutagenE: "10",
    hardware: "2",
    hardwareMutagen: "2",
    consumable: "1",
    consumableMutagen: "1",
    ge: "100",
  },
};

const INCUBATION_DEFAULTS = {
  fem: "9",
  isomeraseQuality: "89.59",
  incubationQuality: "25",
  stationQuality: "0",
  powerQuality: "1000",
};

function cloneDefaults(defaults) {
  return { ...defaults };
}

function parseNum(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initHydrolaseApp() {
  const root = document.getElementById("hydrolase-tool");
  if (!root) {
    return;
  }

  const state = {
    activeProcess: "centrifuge",
    processValues: {
      centrifuge: cloneDefaults(PROCESS_DEFAULTS.centrifuge),
      processor: cloneDefaults(PROCESS_DEFAULTS.processor),
      reprocessing: cloneDefaults(PROCESS_DEFAULTS.reprocessing),
    },
    incubationValues: cloneDefaults(INCUBATION_DEFAULTS),
    refiningBonusPercent: "0",
    activeRefiningTab: "refining",
  };

  root.innerHTML = `
    <div class="hydrolase-app">
      <nav class="hydrolase-subtabs" id="hydrolase-subtabs" role="tablist" aria-label="Hydrolase calculator sections">
        <button type="button" class="hydrolase-subtab active" data-subtab="refining" role="tab" aria-selected="true">Refining</button>
        <button type="button" class="hydrolase-subtab" data-subtab="incubation" role="tab" aria-selected="false">Focused Enzyme (incubation)</button>
      </nav>

      <section class="hydrolase-panel active" id="hydrolase-refining-panel" role="tabpanel">
        <div class="process-tabs" id="process-tabs" role="tablist" aria-label="Refining process">
          <button type="button" class="process-tab active" data-process="centrifuge" role="tab" aria-selected="true">Centrifuge</button>
          <button type="button" class="process-tab" data-process="processor" role="tab" aria-selected="false">Processor</button>
          <button type="button" class="process-tab" data-process="reprocessing" role="tab" aria-selected="false">Re-processing</button>
        </div>
        <div class="hydrolase-body">
          <div class="hydrolase-card" id="refining-inputs"></div>
          <div class="hydrolase-card hydrolase-results" id="refining-results">
            <h2 class="hydrolase-card-title">Estimated result</h2>
            <p class="hydrolase-range" id="refining-purity-range">Purity: —</p>
            <p class="hydrolase-range" id="refining-mutagen-range">Mutagen: —</p>
            <pre class="hydrolase-detail" id="refining-detail"></pre>
            <p class="hydrolase-note" id="refining-note"></p>
          </div>
        </div>
      </section>

      <section class="hydrolase-panel" id="hydrolase-incubation-panel" role="tabpanel" hidden>
        <div class="hydrolase-body">
          <div class="hydrolase-card" id="incubation-inputs"></div>
          <div class="hydrolase-card hydrolase-results" id="incubation-results">
            <h2 class="hydrolase-card-title">Results</h2>
            <dl class="hydrolase-result-list" id="incubation-result-list"></dl>
            <p class="hydrolase-note" id="incubation-note"></p>
          </div>
        </div>
      </section>
    </div>
  `;

  const refiningInputs = document.getElementById("refining-inputs");
  const incubationInputs = document.getElementById("incubation-inputs");

  function currentProcessValues() {
    return state.processValues[state.activeProcess];
  }

  function saveInputsFromDom(container, values) {
    container.querySelectorAll("[data-field]").forEach((el) => {
      if (el.dataset.field === "bonusPercent") {
        return;
      }
      values[el.dataset.field] = el.value;
    });
  }

  function saveRefiningBonusFromDom() {
    const bonusEl = refiningInputs.querySelector('[data-field="bonusPercent"]');
    if (bonusEl) {
      state.refiningBonusPercent = bonusEl.value;
    }
  }

  function fieldRow(label, name, value, { type = "number", step = "any" } = {}) {
    const id = `hydro-field-${name}`;
    return `
      <label class="hydrolase-field" for="${id}">
        <span>${escapeHtml(label)}</span>
        <input type="${type}" id="${id}" data-field="${name}" value="${escapeHtml(value)}" step="${step}" />
      </label>
    `;
  }

  function geField(value) {
    const id = "hydro-field-ge";
    const options = ["0", "30", "60", "100"]
      .map((opt) => `<option value="${opt}"${opt === value ? " selected" : ""}>${opt}</option>`)
      .join("");
    return `
      <label class="hydrolase-field" for="${id}">
        <span>Genetic Engineering</span>
        <select id="${id}" data-field="ge">${options}</select>
      </label>
    `;
  }

  function renderRefiningInputs() {
    const process = state.activeProcess;
    const values = currentProcessValues();
    let html = `<h2 class="hydrolase-card-title">Inputs</h2>`;

    if (process === "reprocessing") {
      html += `<div class="element-grid">`;
      for (const letter of "ABCDE") {
        html += `
          <fieldset class="element-fieldset">
            <legend>Element ${letter}</legend>
            ${fieldRow("Purity", `element${letter}`, values[`element${letter}`])}
            ${fieldRow("Mutagen", `elementMutagen${letter}`, values[`elementMutagen${letter}`])}
          </fieldset>
        `;
      }
      html += `</div>`;
      html += `<p class="hydrolase-avg" id="avg-purity">Average purity: —</p>`;
      html += `<p class="hydrolase-avg" id="avg-mutagen">Average mutagen: —</p>`;
    } else {
      html += fieldRow("Starting purity", "startPurity", values.startPurity);
      html += fieldRow("Starting mutagen", "startMutagen", values.startMutagen);
    }

    html += fieldRow("Hardware purity", "hardware", values.hardware);
    html += fieldRow("Hardware mutagen", "hardwareMutagen", values.hardwareMutagen);
    html += fieldRow("Consumable purity", "consumable", values.consumable);
    html += fieldRow("Consumable mutagen", "consumableMutagen", values.consumableMutagen);
    html += geField(values.ge);
    html += fieldRow("Bonus % (city, etc.)", "bonusPercent", state.refiningBonusPercent, {
      step: "1",
    });

    refiningInputs.innerHTML = html;
    refiningInputs.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", onRefiningInput);
      el.addEventListener("change", onRefiningInput);
    });
  }

  function renderIncubationInputs() {
    const values = state.incubationValues;
    incubationInputs.innerHTML = `
      <h2 class="hydrolase-card-title">Inputs</h2>
      ${fieldRow("FEM (total)", "fem", values.fem)}
      ${fieldRow("Isomerase quality %", "isomeraseQuality", values.isomeraseQuality)}
      ${fieldRow("Incubation Quality expertise", "incubationQuality", values.incubationQuality)}
      ${fieldRow("Incubator station quality", "stationQuality", values.stationQuality)}
      ${fieldRow("Geothermal power quality", "powerQuality", values.powerQuality)}
    `;
    incubationInputs.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", onIncubationInput);
    });
  }

  function onRefiningInput() {
    saveInputsFromDom(refiningInputs, currentProcessValues());
    saveRefiningBonusFromDom();
    recalcRefining();
  }

  function onIncubationInput() {
    saveInputsFromDom(incubationInputs, state.incubationValues);
    recalcIncubation();
  }

  function switchProcess(nextProcess) {
    if (nextProcess === state.activeProcess) {
      return;
    }
    saveInputsFromDom(refiningInputs, state.processValues[state.activeProcess]);
    saveRefiningBonusFromDom();
    state.activeProcess = nextProcess;
    document.querySelectorAll(".process-tab").forEach((tab) => {
      const active = tab.dataset.process === nextProcess;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderRefiningInputs();
    recalcRefining();
  }

  function switchRefiningTab(subtab) {
    state.activeRefiningTab = subtab;
    const refiningPanel = document.getElementById("hydrolase-refining-panel");
    const incubationPanel = document.getElementById("hydrolase-incubation-panel");
    document.querySelectorAll(".hydrolase-subtab").forEach((tab) => {
      const active = tab.dataset.subtab === subtab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    refiningPanel.classList.toggle("active", subtab === "refining");
    refiningPanel.hidden = subtab !== "refining";
    incubationPanel.classList.toggle("active", subtab === "incubation");
    incubationPanel.hidden = subtab !== "incubation";
  }

  function recalcRefining() {
    const process = state.activeProcess;
    const values = currentProcessValues();
    const ge = parseNum(values.ge);
    const hardware = parseNum(values.hardware);
    const consumable = parseNum(values.consumable);
    const hwMut = parseNum(values.hardwareMutagen);
    const consMut = parseNum(values.consumableMutagen);

    let startPurity;
    let startMutagen;

    if (process === "reprocessing") {
      const purities = "ABCDE".split("").map((c) => parseNum(values[`element${c}`]));
      const mutagens = "ABCDE".split("").map((c) => parseNum(values[`elementMutagen${c}`]));
      if (purities.some((v) => v === null) || mutagens.some((v) => v === null)) {
        startPurity = null;
        startMutagen = null;
      } else {
        startPurity = purities.reduce((a, b) => a + b, 0) / 5;
        startMutagen = mutagens.reduce((a, b) => a + b, 0) / 5;
        const avgPurity = document.getElementById("avg-purity");
        const avgMutagen = document.getElementById("avg-mutagen");
        if (avgPurity) {
          avgPurity.textContent = `Average purity: ${fmtNum(startPurity)}`;
        }
        if (avgMutagen) {
          avgMutagen.textContent = `Average mutagen: ${fmtNum(startMutagen)}`;
        }
      }
    } else {
      startPurity = parseNum(values.startPurity);
      startMutagen = parseNum(values.startMutagen);
    }

    const purityEl = document.getElementById("refining-purity-range");
    const mutagenEl = document.getElementById("refining-mutagen-range");
    const detailEl = document.getElementById("refining-detail");
    const noteEl = document.getElementById("refining-note");

    if ([startPurity, startMutagen, ge, hardware, consumable, hwMut, consMut].some((v) => v === null)) {
      purityEl.textContent = "Purity: —";
      mutagenEl.textContent = "Mutagen: —";
      detailEl.textContent = "";
      noteEl.textContent = "Enter valid numbers in all fields.";
      return;
    }

    const bonusRaw = parseNum(state.refiningBonusPercent);
    const bonusPercent = bonusRaw === null ? 0 : bonusRaw;

    const purity = calcPurityRange(startPurity, hardware, consumable, ge, { bonusPercent });
    const mutagen = calcMutagenRange(startMutagen, hwMut, consMut, ge, { bonusPercent });

    if (!purity || !mutagen) {
      purityEl.textContent = "Purity: —";
      mutagenEl.textContent = "Mutagen: —";
      detailEl.textContent = "";
      noteEl.textContent = "Enter valid numbers in all fields.";
      return;
    }

    const purityLabel = process === "reprocessing" ? "Purity (theoretical)" : "Purity";
    purityEl.textContent = `${purityLabel}: ${fmtRange(purity.min, purity.max)}`;
    mutagenEl.textContent = `Mutagen: ${fmtRange(mutagen.min, mutagen.max)}`;

    const detail = [];
    if (process === "reprocessing") {
      const [createdMin, createdMax] = createdPurityRange(purity);
      detail.push(
        `Created as (max ${REPROCESSING_FINAL_CAP}): ${fmtRange(createdMin, createdMax)}`,
        "",
      );
    }
    detail.push(
      `Bonus on gain factor: ${fmtNum(bonusPercent, 0)}%`,
      "",
      `Start purity: ${fmtNum(purity.start)}`,
      `Purity gain: ${fmtRange(purity.gainMin, purity.gainMax)}`,
      `Purity gain factor: ${fmtNum(purity.gainFactor)}`,
      "",
      `Start mutagen: ${fmtNum(mutagen.start)}`,
      `Mutagen gain: ${fmtRange(mutagen.gainMin, mutagen.gainMax)}`,
      `Mutagen gain factor: ${fmtNum(mutagen.gainFactor)}`,
    );
    detailEl.textContent = detail.join("\n");
    noteEl.textContent = processNote(process, purity, mutagen);
  }

  function recalcIncubation() {
    const values = state.incubationValues;
    const fem = parseNum(values.fem);
    const iso = parseNum(values.isomeraseQuality);
    const incQ = parseNum(values.incubationQuality);
    const station = parseNum(values.stationQuality);
    const power = parseNum(values.powerQuality);
    const listEl = document.getElementById("incubation-result-list");
    const noteEl = document.getElementById("incubation-note");

    if ([fem, iso, incQ, station, power].some((v) => v === null)) {
      listEl.innerHTML = `
        <div><dt>Effective isomerase quality</dt><dd>—</dd></div>
        <div><dt>Quality multiplier</dt><dd>—</dd></div>
        <div><dt>Max DPS/armor points / session</dt><dd>—</dd></div>
        <div><dt>Displayed bonus / session</dt><dd>—</dd></div>
      `;
      noteEl.textContent = "Enter valid incubation values.";
      return;
    }

    const result = calcIncubation(fem, iso, incQ, station, power);
    listEl.innerHTML = `
      <div><dt>Effective isomerase quality</dt><dd>${fmtNum(result.effectiveQuality)}%</dd></div>
      <div><dt>Quality multiplier</dt><dd>×${fmtNum(result.multiplier, 3)}</dd></div>
      <div><dt>Max DPS/armor points / session</dt><dd>${fmtNum(result.sessionPoints)}</dd></div>
      <div><dt>Displayed bonus / session</dt><dd>${fmtNum(result.sessionPoints * DPS_ARMOR_DISPLAY_RATE)}% toward DPS or armor</dd></div>
    `;
    noteEl.textContent = incubationNote(result);
  }

  document.getElementById("process-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-process]");
    if (!tab || !PROCESS_KEYS.includes(tab.dataset.process)) {
      return;
    }
    switchProcess(tab.dataset.process);
  });

  document.getElementById("hydrolase-subtabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-subtab]");
    if (!tab) {
      return;
    }
    switchRefiningTab(tab.dataset.subtab);
  });

  renderRefiningInputs();
  renderIncubationInputs();
  recalcRefining();
  recalcIncubation();
}
