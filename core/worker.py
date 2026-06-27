from __future__ import annotations

import atexit
import gc
import multiprocessing as mp
import os
import queue
import uuid
from concurrent.futures import Future, ProcessPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from typing import Any, Dict, List, Optional


def _safe_progress(progress_queue: Any, message: Dict[str, Any]) -> None:
    try:
        progress_queue.put(message)
    except Exception:
        # Progress is best-effort; a broken queue must not fail the Excel job.
        pass


def _coerce_percent(value: Any) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 0


def run_budget_task(task_id: str, payload: Dict[str, Any], progress_queue: Any) -> Dict[str, Any]:
    """
    Executa o motor Excel em um processo isolado.
    Esta função precisa ficar no topo do módulo para ser picklable no Windows.
    """
    started_at = datetime.utcnow().isoformat()

    def emit(event: Dict[str, Any]) -> None:
        event.setdefault("task_id", task_id)
        event.setdefault("created_at", datetime.utcnow().isoformat())
        _safe_progress(progress_queue, event)

    try:
        from core.excel_handler import OrcamentoEngine

        table_data = list(payload.get("table_data") or [])
        mapping = dict(payload.get("mapping") or {})
        side_data = dict(payload.get("side_data") or {})
        config_data = dict(payload.get("config_data") or {})
        profile = dict(payload.get("profile") or {})
        template_path = profile.get("caminho_template") or profile.get("filepath")

        if not table_data:
            raise ValueError("Nenhuma linha do Excel foi recebida para processamento.")
        if not template_path or not os.path.exists(template_path):
            raise FileNotFoundError("Template do perfil não encontrado no disco.")

        emit({
            "type": "log",
            "level": "INFO",
            "message": "Worker isolado iniciado para geração do orçamento.",
        })

        def progress_callback(percent: int) -> None:
            value = _coerce_percent(percent)
            emit({"type": "progress", "value": value})
            emit({"type": "log", "level": "INFO", "message": f"Processando: {value}%"})

        engine = OrcamentoEngine()
        ok, message, extra_info = engine.gerar_excel_final(
            linhas_aprovadas=table_data,
            modelo_path=template_path,
            mapa_colunas=mapping,
            info={**side_data, **config_data},
            perfil=profile,
            progress_callback=progress_callback,
        )

        if not ok:
            return {
                "status": "erro",
                "mensagem": message,
                "task_id": task_id,
                "started_at": started_at,
                "completed_at": datetime.utcnow().isoformat(),
                "extra_info": extra_info or {},
            }

        pdf_path = None
        if config_data.get("gerar_pdf", False):
            emit({"type": "log", "level": "INFO", "message": "Iniciando geração de PDF..."})
            from utils.pdf_exporter import PDFExporter

            ok_pdf, path_pdf, log_pdf = PDFExporter.converter_para_pdf(message)
            if ok_pdf:
                pdf_path = path_pdf
                emit({"type": "log", "level": "SUCCESS", "message": "PDF gerado com sucesso."})
            else:
                emit({
                    "type": "log",
                    "level": "ERROR",
                    "message": f"Falha na geração do PDF: {log_pdf}",
                })

        emit({"type": "progress", "value": 100})
        return {
            "status": "sucesso",
            "mensagem": "Orçamento finalizado com sucesso.",
            "task_id": task_id,
            "caminho_excel": message,
            "caminho_pdf": pdf_path,
            "started_at": started_at,
            "completed_at": datetime.utcnow().isoformat(),
            "extra_info": extra_info or {},
        }
    except Exception as exc:
        emit({
            "type": "log",
            "level": "ERROR",
            "message": f"Falha no worker isolado: {exc}",
        })
        return {
            "status": "erro",
            "mensagem": str(exc),
            "task_id": task_id,
            "started_at": started_at,
            "completed_at": datetime.utcnow().isoformat(),
        }
    finally:
        try:
            import pythoncom

            pythoncom.CoUninitialize()
        except Exception:
            pass
        gc.collect()


@dataclass
class TaskRecord:
    task_id: str
    payload: Dict[str, Any]
    future: Future
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "processing"
    result: Optional[Dict[str, Any]] = None


class LocalTaskQueue:
    """
    Fila local baseada em processos.
    O servidor web apenas agenda; o motor Excel roda fora do processo FastAPI.
    """

    def __init__(self, max_workers: int = 1):
        self.max_workers = max_workers
        self._lock = Lock()
        self._ctx = mp.get_context("spawn")
        self._manager: Any = None
        self._progress_queue: Any = None
        self._executor: Optional[ProcessPoolExecutor] = None
        self._tasks: Dict[str, TaskRecord] = {}
        self._shutdown = False
        atexit.register(self.shutdown)

    def start(self) -> None:
        with self._lock:
            if self._shutdown:
                raise RuntimeError("Fila de tarefas já foi encerrada.")
            if self._executor is not None:
                return

            self._manager = self._ctx.Manager()
            self._progress_queue = self._manager.Queue()
            self._executor = ProcessPoolExecutor(
                max_workers=self.max_workers,
                mp_context=self._ctx,
            )

    def submit_budget_task(self, payload: Dict[str, Any]) -> str:
        task_id = uuid.uuid4().hex

        for attempt in range(2):
            self.start()

            with self._lock:
                executor = self._executor
                progress_queue = self._progress_queue

            assert executor is not None
            assert progress_queue is not None

            try:
                future = executor.submit(run_budget_task, task_id, payload, progress_queue)
                break
            except Exception:
                if attempt == 1:
                    raise
                self._restart_executor()

        record = TaskRecord(task_id=task_id, payload=payload, future=future)

        with self._lock:
            self._tasks[task_id] = record

        future.add_done_callback(lambda done_future, tid=task_id: self._on_done(tid, done_future))
        return task_id

    def _restart_executor(self) -> None:
        with self._lock:
            old_executor = self._executor
            self._executor = None

        if old_executor is not None:
            try:
                old_executor.shutdown(wait=False, cancel_futures=True)
            except Exception:
                pass

    def _on_done(self, task_id: str, future: Future) -> None:
        try:
            result = future.result()
        except Exception as exc:
            result = {
                "status": "erro",
                "mensagem": str(exc),
                "task_id": task_id,
                "completed_at": datetime.utcnow().isoformat(),
            }

        with self._lock:
            record = self._tasks.get(task_id)
            if record:
                record.result = result
                record.status = "completed" if result.get("status") == "sucesso" else "failed"

        event = {
            "type": "task",
            "task_id": task_id,
            "status": "completed" if result.get("status") == "sucesso" else "failed",
            "message": result.get("mensagem") or "",
            "error": result.get("mensagem") if result.get("status") != "sucesso" else None,
            "file_url": result.get("caminho_excel"),
            "caminho_excel": result.get("caminho_excel"),
            "caminho_pdf": result.get("caminho_pdf"),
            "result": result,
            "created_at": datetime.utcnow().isoformat(),
        }
        _safe_progress(self._progress_queue, event)

    def drain_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        if self._progress_queue is None:
            return []

        events: List[Dict[str, Any]] = []
        for _ in range(limit):
            try:
                events.append(self._progress_queue.get_nowait())
            except queue.Empty:
                break
            except Exception:
                break
        return events

    def get_task_payload(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._tasks.get(task_id)
            return dict(record.payload) if record else None

    def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._tasks.get(task_id)
            return dict(record.result) if record and record.result else None

    def forget_task(self, task_id: str) -> None:
        with self._lock:
            self._tasks.pop(task_id, None)

    def shutdown(self) -> None:
        with self._lock:
            if self._shutdown:
                return
            self._shutdown = True
            executor = self._executor
            manager = self._manager
            self._executor = None
            self._manager = None
            self._progress_queue = None
            self._tasks.clear()

        if executor is not None:
            try:
                if hasattr(executor, "terminate_workers"):
                    executor.terminate_workers()
                else:
                    executor.shutdown(wait=False, cancel_futures=True)
            except Exception:
                try:
                    executor.shutdown(wait=False, cancel_futures=True)
                except Exception:
                    pass

        if manager is not None:
            try:
                manager.shutdown()
            except Exception:
                pass

        gc.collect()


worker_manager = LocalTaskQueue(max_workers=1)
