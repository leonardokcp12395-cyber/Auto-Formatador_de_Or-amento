import sys
import os
import shutil
from pathlib import Path


def get_app_dir() -> Path:
    """
    Diretório PERSISTENTE e GRAVÁVEL (DB, configs, Output/).

    - .EXE: usa %LOCALAPPDATA%/Planify no Windows. Evita falhas de permissão
      quando o app é instalado em pastas protegidas (Program Files), que
      exigem privilégio de Administrador para escrita.
    - Script (dev): pasta raiz do projeto, como antes.
    """
    if getattr(sys, 'frozen', False):
        local_appdata = os.getenv('LOCALAPPDATA')
        if local_appdata:
            app_dir = Path(local_appdata) / "Planify"
        else:
            # Fallback de segurança (ambiente sem LOCALAPPDATA)
            app_dir = Path(os.path.dirname(sys.executable))

        app_dir.mkdir(parents=True, exist_ok=True)
        (app_dir / "config" / "templates").mkdir(parents=True, exist_ok=True)
        (app_dir / "Output").mkdir(parents=True, exist_ok=True)
        return app_dir
    else:
        return Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_resource_path(relative_path: str) -> Path:
    """
    Diretório de recursos SOMENTE LEITURA (templates Excel base, ícones,
    frontend compilado).

    - .EXE: pasta empacotada do PyInstaller (_MEIPASS).
    - Script: pasta raiz.

    NUNCA escreva arquivos aqui — em builds --onefile o _MEIPASS é uma
    pasta temporária apagada ao fechar o programa.
    """
    if getattr(sys, 'frozen', False):
        base_path = Path(sys._MEIPASS)
    else:
        base_path = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    return base_path / relative_path


def migrate_legacy_data() -> None:
    """
    Migração de segurança: versões antigas salvavam DB/config ao lado do
    .exe. Agora vivem em %LOCALAPPDATA%/Planify. Esta função copia os
    arquivos antigos (se existirem) para o novo local na primeira execução
    da nova versão, evitando perda de histórico e listas de autocomplete.
    """
    if not getattr(sys, 'frozen', False):
        return

    novo_dir = get_app_dir()
    legacy_dir = Path(os.path.dirname(sys.executable))

    if legacy_dir == novo_dir:
        return

    for nome_db in ('planify_history.db', 'sisorc_history.db'):
        origem = legacy_dir / nome_db
        destino = novo_dir / nome_db
        if origem.exists() and not destino.exists():
            try:
                shutil.copy2(origem, destino)
            except Exception:
                pass

    origem_cfg = legacy_dir / 'config'
    destino_cfg = novo_dir / 'config'
    if origem_cfg.exists() and not any(destino_cfg.glob('*.json')):
        try:
            shutil.copytree(origem_cfg, destino_cfg, dirs_exist_ok=True)
        except Exception:
            pass