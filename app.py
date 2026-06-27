import threading
import time
import socket
import sys
import os
import gc
import multiprocessing

_shutdown_started = False


def get_free_port(start_port=8000, max_port=8050):
    """Encontra uma porta livre para evitar falhas se a 8000 estiver ocupada."""
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return start_port


def run_server(port, server_instance):
    """Executa o servidor Uvicorn."""
    server_instance.run()


def wait_for_server(port, timeout_seconds=20):
    """Aguarda o Uvicorn aceitar conexões antes de abrir a janela."""
    deadline = time.time() + timeout_seconds
    last_error = None

    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError as exc:
            last_error = exc
            time.sleep(0.2)

    print(f"Servidor não respondeu na porta {port}: {last_error}")
    return False


def _watchdog_force_exit(timeout_seconds=6):
    """
    Rede de segurança: se o encerramento normal travar por qualquer
    motivo (thread Uvicorn presa, COM do Excel travado, etc.), este
    watchdog mata o processo Python à força depois de alguns segundos.
    """
    time.sleep(timeout_seconds)
    print("⏱️ Watchdog: encerramento normal demorou demais. Forçando saída.")
    os._exit(1)


def shutdown(server, server_thread):
    """
    Encerramento à prova de balas, acionado ao fechar a janela:
      1. Sinaliza parada ao Uvicorn.
    2. Força coleta de memória Python para soltar handles locais restantes.
    3. Garante a morte do processo Python mesmo que algo trave.
    """
    global _shutdown_started
    if _shutdown_started:
        return
    _shutdown_started = True

    print("A encerrar o Planify v5.0...")

    watchdog = threading.Thread(target=_watchdog_force_exit, args=(6,), daemon=True)
    watchdog.start()

    try:
        server.should_exit = True
        server_thread.join(timeout=4)
    except Exception as e:
        print(f"Aviso ao parar o Uvicorn: {e}")

    try:
        from core.worker import worker_manager

        worker_manager.shutdown()
    except Exception as e:
        print(f"Aviso ao encerrar worker isolado: {e}")

    gc.collect()

    os._exit(0)


if __name__ == '__main__':
    # Primeira chamada obrigatória em executáveis PyInstaller com multiprocessing.
    # Ela intercepta o bootstrap dos processos filhos antes de importar FastAPI,
    # PyWebView ou qualquer módulo do projeto.
    multiprocessing.freeze_support()

    import uvicorn
    import webview

    from core.paths import migrate_legacy_data

    # Migração de dados de versões antigas (DB, config) para %LOCALAPPDATA%
    migrate_legacy_data()

    # NOTA: o antigo `os.chdir(sys._MEIPASS)` foi REMOVIDO de propósito.
    # Cada módulo resolve seus próprios paths via core/paths.py.
    from server import app

    port = get_free_port()

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="info")
    server = uvicorn.Server(config)

    server_thread = threading.Thread(target=run_server, args=(port, server), daemon=True)
    server_thread.start()

    wait_for_server(port)

    window = webview.create_window(
        title="Planify v5.0",
        url=f"http://127.0.0.1:{port}",
        width=1280,
        height=800,
        text_select=True
    )

    # Garante shutdown completo independentemente de como a janela foi
    # fechada (botão X, Alt+F4, etc.)
    window.events.closed += lambda: shutdown(server, server_thread)

    webview.start(debug=False)

    # Fallback: caso o evento 'closed' não tenha disparado por algum
    # motivo, ainda assim garantimos o encerramento.
    shutdown(server, server_thread)
