# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
import sys


PROJECT_ROOT = Path(SPECPATH).resolve()
ENTRY_SCRIPT = PROJECT_ROOT / "app.py"

if not ENTRY_SCRIPT.exists():
    raise SystemExit(
        "Entrada app.py não encontrada. Execute o build a partir da raiz do projeto."
    )

sys.path.insert(0, str(PROJECT_ROOT))


def data_if_exists(source: str, target: str):
    path = PROJECT_ROOT / source
    return [(str(path), target)] if path.exists() else []


a = Analysis(
    [str(ENTRY_SCRIPT)],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[
        *data_if_exists("frontend/dist", "frontend/dist"),
        *data_if_exists("assets", "assets"),
        *data_if_exists("config", "config"),
        *data_if_exists("MODELO SUP.xlsx", "."),
        *data_if_exists("MODELO PRUMO.xlsx", "."),
    ],
    hiddenimports=[
        "server",
        "core",
        "core.database",
        "core.excel_handler",
        "core.exceptions",
        "core.paths",
        "core.sanitizer",
        "core.worker",
        "utils",
        "utils.autocomplete_manager",
        "utils.config_manager",
        "utils.helpers",
        "utils.logger",
        "utils.pdf_exporter",
        "utils.smart_parser",
        "utils.template_manager",
        "pandas",
        "openpyxl",
        "xlrd",
        "lxml",
        "lxml.etree",
        "html5lib",
        "bs4",
        "soupsieve",
        "rapidfuzz",
        "pydantic",
        "pydantic_core",
        "psutil",
        "sqlalchemy",
        "loguru",
        "uvicorn",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.loops.auto",
        "uvicorn.logging",
        "fastapi",
        "starlette",
        "websockets",
        "multipart",
        "webview",
        "webview.platforms.winforms",
        "webview.platforms.edgechromium",
        "win32com",
        "win32com.client",
        "win32timezone",
        "pythoncom",
        "pywintypes",
        "multiprocessing",
        "concurrent.futures.process",
    ],
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
    name="PlanifyV5",
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
    icon=[str(PROJECT_ROOT / "assets" / "icon.ico")],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="PlanifyV5",
)
