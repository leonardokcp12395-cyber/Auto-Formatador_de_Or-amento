import logging

class PlanifyError(Exception):
    """Exceção base para todos os erros mapeados do Planify."""
    def __init__(self, message: str, inner_exception: Exception = None):
        super().__init__(message)
        self.inner_exception = inner_exception

class ExcelProcessError(PlanifyError):
    """Erros relacionados a processamento de leitura/escrita com OpenPyxl nativo."""
    pass

class DataExtractionError(PlanifyError):
    """Erros durante extração ou conversão de dados do Pandas/Regex."""
    pass

class Win32ProcessError(PlanifyError):
    """Erros relacionados ao controle OLE/COM do Excel via win32com."""
    pass

class TemplateNotFoundError(PlanifyError):
    """Erro lançado quando o template base de orçamento não é encontrado no sistema."""
    pass
