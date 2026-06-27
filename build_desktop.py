from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Sequence


PROJECT_ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DIST_DIR = PROJECT_ROOT / "dist"
SPEC_FILE = PROJECT_ROOT / "PlanifyV5.spec"
EXE_PATH = DIST_DIR / "PlanifyV5" / "PlanifyV5.exe"


def log(message: str) -> None:
    print(message, flush=True)


def fail(message: str, exit_code: int = 1) -> None:
    log(f"\nERRO: {message}")
    raise SystemExit(exit_code)


def run_command(
    command: Sequence[str],
    *,
    cwd: Path = PROJECT_ROOT,
    env: dict[str, str] | None = None,
) -> None:
    printable = " ".join(f'"{part}"' if " " in part else part for part in command)
    log(f"> {printable}")

    try:
        subprocess.run(
            list(command),
            cwd=str(cwd),
            env=env,
            check=True,
        )
    except FileNotFoundError as exc:
        fail(f"Comando não encontrado: {command[0]}. Detalhes: {exc}")
    except subprocess.CalledProcessError as exc:
        fail(f"Comando falhou com exit code {exc.returncode}: {printable}")


def resolve_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable:
        return executable

    if os.name == "nt":
        executable = shutil.which(f"{name}.cmd") or shutil.which(f"{name}.exe")
        if executable:
            return executable

    fail(f"'{name}' não está disponível no PATH.")
    return name


def assert_paths_exist(paths: Iterable[Path], context: str) -> None:
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        fail(f"{context}: paths obrigatórios ausentes: {', '.join(missing)}")


def clean_build_folders() -> None:
    log("\nPreparando diretórios de build...")
    shutil.rmtree(PROJECT_ROOT / "build", ignore_errors=True)
    shutil.rmtree(DIST_DIR / "PlanifyV5", ignore_errors=True)


def build_frontend() -> None:
    log("\nPasso 1/2: Compilando o Frontend Vite/React...")
    assert_paths_exist([FRONTEND_DIR / "package.json"], "Frontend")

    npm = resolve_executable("npm")
    run_command([npm, "run", "build"], cwd=FRONTEND_DIR)

    frontend_dist = FRONTEND_DIR / "dist"
    assert_paths_exist([frontend_dist / "index.html"], "Build do frontend")
    log("Frontend compilado em frontend/dist.")


def build_executable() -> None:
    log("\nPasso 2/2: Empacotando executável com PyInstaller...")
    assert_paths_exist([SPEC_FILE, PROJECT_ROOT / "app.py"], "PyInstaller")

    run_command([
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        str(SPEC_FILE),
    ])

    assert_paths_exist([EXE_PATH], "Executável final")
    log(f"Executável gerado em {EXE_PATH}.")


def main() -> None:
    log("Iniciando build do Planify v5.0...")
    clean_build_folders()
    build_frontend()
    build_executable()

    log("\n" + "=" * 60)
    log("BUILD CONCLUIDO")
    log(f"Executável final: {EXE_PATH}")
    log("Backend empacotado diretamente a partir do código-fonte.")
    log("=" * 60)


if __name__ == "__main__":
    main()
