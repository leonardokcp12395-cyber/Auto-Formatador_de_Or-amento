import gc
import time
from pathlib import Path


class PDFExporter:
    @staticmethod
    def converter_para_pdf(caminho_excel):
        """
        Converte Excel para PDF com uma instância COM isolada do Excel.

        Regras de resiliência:
        - usa DispatchEx para não anexar a uma janela Excel do usuário;
        - sempre fecha o workbook sem salvar;
        - sempre encerra a instância COM criada por este processo;
        - sempre desinicializa COM na thread atual.
        """
        try:
            import pythoncom
            import win32com.client
        except ImportError:
            return False, "", "Biblioteca pywin32 não instalada ou erro de importação."

        workbook = None
        excel_app = None
        com_initialized = False

        try:
            path_obj = Path(caminho_excel).resolve(strict=True)
            caminho_abs_excel = str(path_obj)
            caminho_pdf = str(path_obj.with_suffix(".pdf"))
        except Exception as exc:
            return False, "", f"Erro de caminho: {exc}"

        # Dá ao filesystem tempo de liberar o arquivo salvo pelo OpenPyXL.
        time.sleep(1)

        try:
            pythoncom.CoInitialize()
            com_initialized = True

            excel_app = win32com.client.DispatchEx("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            excel_app.ScreenUpdating = False
            excel_app.EnableEvents = False

            workbook = excel_app.Workbooks.Open(
                caminho_abs_excel,
                UpdateLinks=0,
                ReadOnly=True,
                IgnoreReadOnlyRecommended=True,
                AddToMru=False,
            )
            workbook.Worksheets(1).Activate()
            workbook.ExportAsFixedFormat(0, caminho_pdf)

            return True, caminho_pdf, "PDF gerado com sucesso"

        except Exception as exc:
            err_msg = str(exc)
            if hasattr(exc, "excepinfo") and exc.excepinfo:
                err_msg = f"{exc.excepinfo[2]} (Código: {exc.excepinfo[5]})"
            return False, "", f"Erro na conversão PDF: {err_msg}"

        finally:
            if workbook is not None:
                try:
                    workbook.Close(False)
                except Exception:
                    pass

            if excel_app is not None:
                try:
                    excel_app.DisplayAlerts = False
                    excel_app.Quit()
                except Exception:
                    pass

            try:
                del workbook
            except Exception:
                pass

            try:
                del excel_app
            except Exception:
                pass

            if com_initialized:
                try:
                    pythoncom.CoUninitialize()
                except Exception:
                    pass

            gc.collect()
