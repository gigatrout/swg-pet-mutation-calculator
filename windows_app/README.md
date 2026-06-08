# Hydro Point Calculator — Windows

Desktop build of the mutation / hydro point planner. The UI is the same web app used in the browser at the project root; this folder packages it as a Windows `.exe` with PyInstaller and pywebview.

## Prerequisites

- **Windows 10 or 11**
- **Python 3.10+** from [python.org](https://www.python.org/downloads/) (check “Add Python to PATH” during install)
- **PowerShell** (included with Windows)

Optional but recommended for syncing the latest UI from the repo:

- **Git Bash** (from [Git for Windows](https://git-scm.com/download/win)) — lets the build script run `sync_web.sh` automatically

## Quick run (no build)

If you only want to try the calculator without creating an `.exe`:

1. Open PowerShell in the **project root** (`swg-mutation-calculator`, parent of this folder).
2. Install dependencies once:

   ```powershell
   python -m pip install -r python_app\requirements.txt
   ```

3. Copy fresh web files into the Python app (or use Git Bash):

   ```powershell
   # From project root, if Git Bash is installed:
   bash python_app/sync_web.sh . python_app/web
   ```

4. Start the desktop window:

   ```powershell
   python python_app\app.py
   ```

Or use the browser version from the project root:

```powershell
python -m http.server 8766
```

Then open `http://localhost:8766/` in your browser.

## Build the `.exe`

All commands below are run from this `windows_app` folder unless noted.

### Option A — double-click

Run `build_windows.bat`. It calls the PowerShell build script.

### Option B — PowerShell

```powershell
cd path\to\swg-mutation-calculator\windows_app
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_windows.ps1
```

### What the build does

1. Copies `python_app/app.py` into `windows_app/build/`
2. Syncs web assets (`index.html`, `app.js`, `incubation_calc.js`, `styles.css`, combo/mutation data, favicons, pet images) from the **project root** into `build/web/`
3. Installs/upgrades `pyinstaller`, `pywebview`, and `pillow`
4. Produces a windowed executable with PyInstaller

### Output

After a successful build:

```
windows_app\dist\Hydro Point Calculator\Hydro Point Calculator.exe
```

Copy that folder wherever you like, or zip it for distribution. The whole `Hydro Point Calculator` directory is required (not just the `.exe`).

## After updates on another machine

Web changes are made in the project root (`app.js`, `incubation_calc.js`, etc.). On Mac/Linux, maintainers often run:

```bash
bash python_app/sync_all_apps.sh
```

That updates `windows_app/web/` but **does not** rebuild the `.exe`. On Windows, run `build_windows.ps1` again to bake the latest UI into a new executable.

If Git Bash is not installed, the build script still copies the main web files from the project root directly; pet images are copied only when that `assets/pet-images` folder exists.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `python` not found | Reinstall Python with “Add to PATH”, or use `py -3` instead of `python` |
| Script execution disabled | Use `-ExecutionPolicy Bypass` as shown above, or run `build_windows.bat` |
| Blank window / missing UI | Rebuild so `build/web/index.html` exists; check antivirus did not quarantine the dist folder |
| `import webview` fails | `python -m pip install pywebview` |
| Old UI after pull | Re-run `build_windows.ps1` (build always syncs from project root) |

## Folder layout

| Path | Purpose |
|------|---------|
| `web/` | Staged web assets (synced from project root; used for reference, build copies fresh files into `build/web/`) |
| `build/` | Temporary PyInstaller output (safe to delete) |
| `dist/` | Final `Hydro Point Calculator.exe` and dependencies |
| `build_windows.ps1` | Main build script |
| `build_windows.bat` | Wrapper that launches the PowerShell script |
