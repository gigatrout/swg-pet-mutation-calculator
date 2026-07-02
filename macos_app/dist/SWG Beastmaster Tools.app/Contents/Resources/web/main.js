"use strict";

import { initMutationApp } from "./app.js";
import { initHydrolaseApp } from "./hydrolase_app.js";

function initToolTabs() {
  const tabs = document.querySelectorAll(".tool-tab");
  const panels = {
    "hydro-distribution": document.getElementById("hydro-distribution-tool"),
    hydrolase: document.getElementById("hydrolase-tool"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tool = tab.dataset.tool;
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) {
          return;
        }
        const active = key === tool;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initToolTabs();
  initMutationApp();
  initHydrolaseApp();
});
