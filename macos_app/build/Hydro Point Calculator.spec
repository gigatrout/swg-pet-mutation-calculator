# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['/Users/michael/git/swg-mutation-calculator/macos_app/build/app.py'],
    pathex=[],
    binaries=[],
    datas=[('/Users/michael/git/swg-mutation-calculator/macos_app/build/web', 'web')],
    hiddenimports=['webview'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Hydro Point Calculator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['/Users/michael/git/swg-mutation-calculator/favicon-32.png'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Hydro Point Calculator',
)
app = BUNDLE(
    coll,
    name='Hydro Point Calculator.app',
    icon='/Users/michael/git/swg-mutation-calculator/favicon-32.png',
    bundle_identifier=None,
)
