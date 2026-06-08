# SWG Pet Mutation / Hydro Point Calculator

Plan beast incubator sessions for **Star Wars Galaxies** (Legends-style pet mutation). Set hydrolase purity per session, split points across Defensive · Intellectual · Aggressive with the nutrient slider, place hydro on each skill, and track appearance mutations (+2 per skill) toward a **60-point** perfect pet build.

Repository: [github.com/gigatrout/swg-pet-mutation-calculator](https://github.com/gigatrout/swg-pet-mutation-calculator)

---

## What it does

| Area | Purpose |
|------|---------|
| **Hydro pool** | Spendable points per session = `floor(hydrolase purity)` from slot 4 |
| **Nutrient slider** | Splits the pool across Defensive / Intellectual / Aggressive (matches in-game gauge) |
| **Temperature slider** | Splits slot-1 isomerase quality into DPS vs armor % on the egg |
| **Skill bubbles** | Click to place hydro; bottom row in each category fills first |
| **Appearance mutation** | +2 free points per skill when that session rolls appearance (+12 max per session if nothing is capped) |
| **Combo schedules** | Preset paths from *Hydro Combos.xls* (48pt / 36pt / 60pt purity layouts) |
| **Pet mutation guide** | Enzyme table per pet (data from [swgpets.com](https://swgpets.com)) |

**Category → skills**

- **Defensive** — Survival, Bestial Resilience  
- **Intellectual** — Cunning, Intelligence  
- **Aggressive** — Aggression, Hunter's Instinct  

Each skill caps at **10** total (hydro + mutation bonus). Each skill accepts at most **10 hydro in a single session**.

---

## Install and run

No build is required for the web version. Pick one option below.

### Option 1 — Browser (recommended for quick use)

**Requirements:** Python 3 (for a local static server)

```bash
git clone https://github.com/gigatrout/swg-pet-mutation-calculator.git
cd swg-pet-mutation-calculator
./start.sh
```

Opens `http://localhost:8766/` (override with `PORT=8080 ./start.sh`). Stop with `./stop.sh`.

Or manually:

```bash
python3 -m http.server 8766
```

Then open `http://localhost:8766/` in any modern browser.

### Option 2 — Python desktop window

**Requirements:** Python 3.10+, `pywebview`

```bash
cd swg-pet-mutation-calculator
python3 -m pip install -r python_app/requirements.txt
python3 python_app/app.py
```

`python_app/run.sh` syncs web assets and launches the same UI in a native window.

### Option 3 — macOS app

Build a `.app` and DMG (macOS only):

```bash
cd macos_app
./build_macos.sh
```

**Output**

- `macos_app/dist/Hydro Point Calculator.app`
- `macos_app/Hydro-Point-Calculator.dmg`

Open the DMG and drag the app to Applications.

### Option 4 — Windows executable

See **[windows_app/README.md](windows_app/README.md)** for full steps.

Summary:

```powershell
cd windows_app
.\build_windows.ps1
```

Run `dist\Hydro Point Calculator\Hydro Point Calculator.exe`.

---

## How to use

### 1. Work session by session

Use the tabs **Session 1**, **Session 2**, and **Session 3**. Each session has its own:

- Hydrolase purity (your slot-4 enzyme purity for that incubation)
- Top isomerase % (slot 1; affects DPS/armor only, not hydro pool)
- Temperature and nutrient sliders
- Skill bubble grid

The **Pool / Allocated / Unplaced** banner shows how many hydro points you can still place in the active session.

### 2. Set purity and sliders

- **Hydrolase purity** — enter the purity you will use (e.g. `19.9` → **19** spendable points; purity does not round up).
- **Nutrient slider** — moves the Def · Int · Agg split. The ratio label (e.g. `8 · 9 · 3`) updates as you drag. Quick **anchor buttons** jump to common splits.
- **Temperature** — 0 favors armor, 10 favors DPS on the egg bonus.

Adjust **Geothermal power OQ**, **Expertise**, **Station quality**, and **FEM** if you want accurate DPS/armor estimates in the summary panel.

### 3. Place hydro points

In each colored category box:

1. The number on the right is that category’s **budget** from the nutrient slider.
2. **Click a bubble** to fill through that position (left → right within a row).
3. Click the **last filled** bubble in a row to remove one point.

**Bubble colors**

- **Dim** — hydro from earlier sessions (locked)
- **Purple** — appearance mutation bonus from an earlier session (+2/skill where room remains)
- **Bright green** — hydro you placed in the **current** session

Points fill the **bottom** skill row first (e.g. Bestial Resilience before Survival).

### 4. Appearance mutations

In the right sidebar, check **S1 / S2 / S3** when that incubation session rolled an **appearance** mutation (not a stat-only mutation). Each checked session adds up to **+2 per skill** (+12 if every skill has room).

- **48pt (1 mutation)** paths: one appearance session — usually **S2** or **S3** (see combos below).
- **36pt (2 mutations)** paths: appearance on **S2 and S3** (S1 is typically stat-only).

When both appearance mutations are marked, a read-only **Final** tab shows the completed 60-point picture.

### 5. Combo schedules (sidebar)

Presets from *Hydro Combos.xls* configure purity and sliders; **you still place hydro bubbles yourself**.

**60pt hydro** — quick purity presets (`20·20·20`, `8·20·20`, etc.).

**48pt (1 mutation)**

1. Choose **Appearance → Session 2** or **Session 3**.
2. Pick a combo path from the dropdown (grouped by purity layout, e.g. `11·17·20`).
3. Click **Apply**.

Sets hydrolase purity per session, nutrient slider positions, and the appearance checkbox. Does not auto-fill hydro.

**36pt (2 mutations)**

1. Pick a combo path (selecting applies immediately, or use **Apply**).
2. Appearance mutations are set on **S2** and **S3**.

The purity label (e.g. `19·2·15`) stays visible beside the section title after you select a path.

**Clear session** — wipes hydro in the active tab only. **Reset all** — new plan from scratch.

### 6. Pet mutation enzyme guide

Choose a pet from the dropdown to view lyase / isomerase requirements by mutation stage (sourced from swgpets.com mirror data). Use this alongside your in-game enzyme crafting; it does not change hydro math.

### 7. Read the summary

Right column tracks:

- Per-skill totals (highlight at 10)
- **Hydro placed** / **Mutation bonus** / **Combined / 60**
- Cumulative **DPS** and **Armor** % on the egg from isomerase + temperature

Aim for **60 combined** on a perfect pet (48 hydro + 12 mutation bonus with two appearance mutations, or other valid splits).

---

## Regenerating data (developers)

Combo and pet tables are generated offline:

```bash
# Hydro combo paths (needs Hydro Combos.xls)
python3 build_hydro_combos.py "/path/to/Hydro Combos.xls"

# Pet mutation guide (~275 pets from swgpets HTML mirror)
python3 build_pet_mutations.py /path/to/swgPets/mirror/pet

# Pet portrait images (optional)
python3 build_pet_images.py
```

After editing web files (`app.js`, `incubation_calc.js`, etc.), sync bundled copies:

```bash
bash python_app/sync_all_apps.sh
```

Then rebuild desktop apps if needed (`macos_app/build_macos.sh` or `windows_app/build_windows.ps1`).

---

## Project layout

| Path | Description |
|------|-------------|
| `index.html`, `app.js`, `incubation_calc.js`, `styles.css` | Main web UI |
| `hydro_combos_data.js` | Generated 48pt / 36pt combo paths |
| `pet_mutations_data.js` | Generated pet enzyme guide |
| `start.sh` / `stop.sh` | Local browser server |
| `python_app/` | pywebview desktop launcher |
| `macos_app/` | macOS `.app` / DMG build |
| `windows_app/` | Windows `.exe` build ([README](windows_app/README.md)) |
| `build_*.py` | Data generation scripts |

---

## Tips

- If a combo split does not match any nutrient notch, drag the slider manually — the combo still sets the correct **category budgets**; small pools (e.g. 19pt) use the same gauge math as in-game.
- Session 3 after an S2 appearance mutation often uses **12pt** hydro with a center nutrient split (`1·10·1`) when following classic 60pt guides — the app shows a hint when relevant.
- FEM affects **DPS/armor** quality multiplier, not hydrolase purity from refining.

---

## Contributing

Pull requests welcome on [github.com/gigatrout/swg-pet-mutation-calculator](https://github.com/gigatrout/swg-pet-mutation-calculator).

Game mechanics are inferred from SWG Legends server scripts and player-validated combo sheets; always verify critical builds in-game before committing expensive enzymes.
