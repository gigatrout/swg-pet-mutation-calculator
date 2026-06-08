# Build Hydro Point Calculator.exe on Windows (run in PowerShell).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$CalcRoot = Split-Path -Parent $Root
$Src = Join-Path $CalcRoot "python_app"
$Build = Join-Path $Root "build"
$Dist = Join-Path $Root "dist"
$AppName = "Hydro Point Calculator"
$Icon = Join-Path $CalcRoot "favicon-32.png"
$WebDest = Join-Path $Build "web"

if (Test-Path $Build) { Remove-Item -Recurse -Force $Build }
if (Test-Path $Dist) { Remove-Item -Recurse -Force $Dist }
New-Item -ItemType Directory -Path $WebDest -Force | Out-Null

Copy-Item (Join-Path $Src "app.py") $Build

$sync = Join-Path $Src "sync_web.sh"
if (Get-Command bash -ErrorAction SilentlyContinue) {
    & bash $sync $CalcRoot $WebDest
} else {
    foreach ($name in @(
        "index.html", "app.js", "incubation_calc.js", "styles.css", "hydro_combos_data.js", "pet_mutations_data.js",
        "favicon.ico", "favicon-16.png", "favicon-32.png"
    )) {
        $file = Join-Path $CalcRoot $name
        if (Test-Path $file) { Copy-Item $file $WebDest }
    }
    $petImages = Join-Path $CalcRoot "assets\pet-images"
    if (Test-Path $petImages) {
        $destImages = Join-Path $WebDest "assets\pet-images"
        New-Item -ItemType Directory -Path $destImages -Force | Out-Null
        Copy-Item (Join-Path $petImages "*") $destImages -Force
    }
}

python -m pip install --upgrade pyinstaller pywebview pillow

$pyArgs = @(
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--windowed",
    "--name", $AppName,
    "--distpath", $Dist,
    "--workpath", (Join-Path $Build "pyinstaller-work"),
    "--specpath", $Build,
    "--add-data", "$WebDest;web",
    "--hidden-import", "webview",
    (Join-Path $Build "app.py")
)

if (Test-Path $Icon) {
    $pyArgs = @(
        "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--windowed",
        "--name", $AppName,
        "--icon", $Icon,
        "--distpath", $Dist,
        "--workpath", (Join-Path $Build "pyinstaller-work"),
        "--specpath", $Build,
        "--add-data", "$WebDest;web",
        "--hidden-import", "webview",
        (Join-Path $Build "app.py")
    )
}

python @pyArgs

Write-Host "Built: $(Join-Path $Dist "$AppName\$AppName.exe")"
