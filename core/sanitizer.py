import pandas as pd
import os
from typing import Tuple, Dict, Any, Optional
from utils.logger import Logger
from core.exceptions import DataExtractionError

class ExcelSanitizer:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config: Dict[str, Any] = config or {}

    def sanitizar_arquivo(self, input_path: str) -> Tuple[bool, str, int]:
        """
        Localiza automaticamente onde os dados começam.
        Retorna: (Sucesso, CaminhoArquivo, LinhaDoCabecalho)
        """
        Logger.info(f"Analisando estrutura do arquivo: {input_path}")
        
        try:
            if not os.path.exists(input_path):
                raise DataExtractionError("Arquivo Excel não encontrado no disco.")

            # 1. Varredura Inteligente
            # Lê as primeiras 50 linhas sem cabeçalho para tentar encontrar onde a tabela comeca
            df_temp = pd.read_excel(input_path, header=None, nrows=50)
            
            linha_cabecalho = -1
            
            for idx, row in df_temp.iterrows():
                linha_str = row.fillna("").astype(str).str.upper().values
                
                # Critério: Tem que ter "ITEM" e ("DESCRIÇÃO" ou "DISCRIMINAÇÃO")
                tem_item = any('ITEM' in str(x) for x in linha_str)
                tem_desc = any('DESCRI' in str(x) or 'DISCRIM' in str(x) or 'SERVIÇO' in str(x) for x in linha_str)
                
                if tem_item and tem_desc:
                    linha_cabecalho = int(idx) # Pandas usa base-0
                    Logger.info(f"Cabeçalho detectado na linha Excel: {linha_cabecalho + 1}")
                    break
            
            if linha_cabecalho == -1:
                Logger.warning("Cabeçalho não detectado explicitamente. Usando linha 1.")
                linha_cabecalho = 0

            return True, input_path, linha_cabecalho

        except DataExtractionError as e:
            Logger.error(str(e))
            return False, str(e), 0
        except Exception as e:
            msg = f"Erro na sanitização de dados: {str(e)}"
            Logger.error(msg)
            return False, msg, 0

    def limpar_arquivos_temp(self) -> None:
        """Limpeza de arquivos temporários, reservado para expansões futuras."""
        pass