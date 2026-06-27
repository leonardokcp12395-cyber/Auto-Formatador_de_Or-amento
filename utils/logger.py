import logging
import sys
import os
from datetime import datetime
from pathlib import Path


class LogLevel:
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR


class Logger:
    """
    Sistema de Logging Híbrido (Instância + Singleton)
    Permite ser instanciado pela GUI e chamado estaticamente pelo Core.
    """
    _instance = None

    def __init__(self, nome="Planify", nivel_minimo=LogLevel.INFO, arquivo_log="planify_log.txt"):
        Logger._instance = self
        self.callbacks = []

        # Limpeza do ficheiro de log antigo (rebranding SISORC → Planify)
        self._limpar_log_antigo()

        # Configuração do Logging Nativo
        self._logger = logging.getLogger(nome)
        self._logger.setLevel(nivel_minimo)
        self._logger.handlers = []  # Limpa handlers anteriores

        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s: %(message)s',
            datefmt='%H:%M:%S'
        )

        # Handler Arquivo com Rotatividade (Max 5MB, 3 backups)
        try:
            from logging.handlers import RotatingFileHandler
            file_handler = RotatingFileHandler(
                arquivo_log, maxBytes=5*1024*1024, backupCount=3, encoding='utf-8'
            )
            file_handler.setFormatter(formatter)
            self._logger.addHandler(file_handler)
        except Exception as e:
            print(f"Erro ao criar log em arquivo: {e}")

        # Handler Console (Terminal)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        self._logger.addHandler(console_handler)

    @staticmethod
    def _limpar_log_antigo():
        """Remove o ficheiro de log antigo (sisorc_log.txt) se existir."""
        try:
            antigo = Path("sisorc_log.txt")
            if antigo.exists():
                os.remove(antigo)
        except Exception:
            pass

    def adicionar_callback(self, callback):
        """Adiciona função para receber logs na interface"""
        self.callbacks.append(callback)

    def limpar_historico(self):
        """Limpa o histórico visual (placeholder)"""
        pass

    # --- MÉTODOS DE LOG (Funcionam na Instância E na Classe) ---

    @classmethod
    def _emit(cls, nivel, msg):
        # Garante que existe uma instância
        if cls._instance is None:
            cls._instance = Logger()

        # Log Nativo
        if nivel == LogLevel.INFO:
            cls._instance._logger.info(msg)
        elif nivel == LogLevel.DEBUG:
            cls._instance._logger.debug(msg)
        elif nivel == LogLevel.WARNING:
            cls._instance._logger.warning(msg)
        elif nivel == LogLevel.ERROR:
            cls._instance._logger.error(msg)

        # Log para Interface (Callbacks)
        timestamp = datetime.now().strftime('%H:%M:%S')
        msg_fmt = f"[{timestamp}] {msg}"

        for cb in cls._instance.callbacks:
            try:
                cb(nivel, msg_fmt)
            except:
                pass

    @classmethod
    def info(cls, msg): cls._emit(LogLevel.INFO, msg)

    @classmethod
    def debug(cls, msg): cls._emit(LogLevel.DEBUG, msg)

    @classmethod
    def warning(cls, msg): cls._emit(LogLevel.WARNING, msg)

    @classmethod
    def error(cls, msg): cls._emit(LogLevel.ERROR, msg)

    @classmethod
    def titulo(cls, msg):
        cls.info("=" * 40)
        cls.info(f"  {msg}")
        cls.info("=" * 40)

    @classmethod
    def separador(cls):
        cls.info("-" * 40)