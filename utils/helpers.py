"""
Planify - Helper Functions
Funções auxiliares e utilitárias
"""

from pathlib import Path
from typing import Optional, Union
import json
import re

class ConfigLoader:
    """Carregador de configurações JSON"""
    
    @staticmethod
    def carregar(caminho: str) -> dict:
        """
        Carrega arquivo JSON de configuração
        
        Args:
            caminho: Caminho do arquivo JSON
            
        Returns:
            Dicionário com configurações
            
        Raises:
            FileNotFoundError: Se arquivo não existir
            json.JSONDecodeError: Se JSON for inválido
        """
        caminho_path = Path(caminho)
        
        if not caminho_path.exists():
            raise FileNotFoundError(f"Arquivo de configuração não encontrado: {caminho}")
        
        with open(caminho_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def salvar(caminho: str, dados: dict):
        """
        Salva configurações em arquivo JSON
        
        Args:
            caminho: Caminho do arquivo JSON
            dados: Dicionário a ser salvo
        """
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=4)

class FileValidator:
    """Validador de arquivos"""
    
    @staticmethod
    def validar_excel(caminho: str) -> tuple[bool, str]:
        """
        Valida se arquivo Excel existe e é válido
        
        Args:
            caminho: Caminho do arquivo
            
        Returns:
            Tupla (valido, mensagem_erro)
        """
        caminho_path = Path(caminho)
        
        # Verifica existência
        if not caminho_path.exists():
            return False, "Arquivo não encontrado"
        
        # Verifica extensão
        if caminho_path.suffix.lower() not in ['.xlsx', '.xls']:
            return False, "Arquivo deve ser .xlsx ou .xls"
        
        # Verifica tamanho (não pode ser vazio)
        if caminho_path.stat().st_size == 0:
            return False, "Arquivo está vazio"
        
        return True, ""
    
    @staticmethod
    def validar_caminho_escrita(caminho: str) -> tuple[bool, str]:
        """
        Valida se é possível escrever no caminho
        
        Args:
            caminho: Caminho a validar
            
        Returns:
            Tupla (valido, mensagem_erro)
        """
        try:
            caminho_path = Path(caminho)
            
            # Verifica se diretório pai existe
            if not caminho_path.parent.exists():
                return False, "Diretório não existe"
            
            # Verifica permissões de escrita
            if not os.access(caminho_path.parent, os.W_OK):
                return False, "Sem permissão de escrita"
            
            return True, ""
        except Exception as e:
            return False, str(e)

class StringFormatter:
    """Formatador de strings"""
    
    @staticmethod
    def limpar_nome_arquivo(nome: str, max_chars: int = 50) -> str:
        """
        Limpa string para ser usada como nome de arquivo
        
        Args:
            nome: String original
            max_chars: Número máximo de caracteres
            
        Returns:
            String limpa e segura
        """
        # Remove caracteres especiais
        nome_limpo = re.sub(r'[<>:"/\\|?*]', '', nome)
        
        # Remove espaços extras
        nome_limpo = ' '.join(nome_limpo.split())
        
        # Limita tamanho
        if len(nome_limpo) > max_chars:
            nome_limpo = nome_limpo[:max_chars].strip()
        
        return nome_limpo
    
    @staticmethod
    def formatar_moeda(valor: float, simbolo: str = "R$") -> str:
        """
        Formata valor como moeda
        
        Args:
            valor: Valor numérico
            simbolo: Símbolo da moeda
            
        Returns:
            String formatada
        """
        return f"{simbolo} {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    @staticmethod
    def formatar_numero(valor: float, casas_decimais: int = 2) -> str:
        """
        Formata número com separadores
        
        Args:
            valor: Valor numérico
            casas_decimais: Número de casas decimais
            
        Returns:
            String formatada
        """
        formato = f"{{:,.{casas_decimais}f}}"
        return formato.format(valor).replace(",", "X").replace(".", ",").replace("X", ".")

class DataValidator:
    """Validador de dados de entrada"""
    
    @staticmethod
    def validar_bdi(bdi: Union[str, float]) -> tuple[bool, float, str]:
        """
        Valida valor de BDI
        
        Args:
            bdi: Valor do BDI (string ou float)
            
        Returns:
            Tupla (valido, valor_numerico, mensagem_erro)
        """
        try:
            # Converte para float
            if isinstance(bdi, str):
                bdi_str = bdi.replace(',', '.').replace('%', '').strip()
                bdi_num = float(bdi_str)
            else:
                bdi_num = float(bdi)
            
            # Valida range
            if bdi_num < 0:
                return False, 0, "BDI não pode ser negativo"
            
            if bdi_num > 100:
                return False, 0, "BDI não pode ser maior que 100%"
            
            return True, bdi_num, ""
            
        except ValueError:
            return False, 0, "BDI deve ser um número válido"
    
    @staticmethod
    def validar_nome_obra(nome: str, max_chars: int = 100) -> tuple[bool, str]:
        """
        Valida nome da obra
        
        Args:
            nome: Nome da obra
            max_chars: Tamanho máximo permitido
            
        Returns:
            Tupla (valido, mensagem_erro)
        """
        if not nome or nome.strip() == "":
            return False, "Nome da obra não pode estar vazio"
        
        if len(nome) > max_chars:
            return False, f"Nome da obra muito longo (máximo {max_chars} caracteres)"
        
        return True, ""

class ProgressTracker:
    """Rastreador de progresso de operações"""
    
    def __init__(self, total_steps: int):
        """
        Inicializa rastreador
        
        Args:
            total_steps: Número total de etapas
        """
        self.total_steps = total_steps
        self.current_step = 0
        self.callbacks = []
    
    def adicionar_callback(self, callback):
        """Adiciona callback para receber atualizações"""
        self.callbacks.append(callback)
    
    def atualizar(self, step: Optional[int] = None):
        """
        Atualiza progresso
        
        Args:
            step: Etapa atual (None = incrementa)
        """
        if step is not None:
            self.current_step = step
        else:
            self.current_step += 1
        
        percentual = (self.current_step / self.total_steps) * 100
        
        for callback in self.callbacks:
            try:
                callback(percentual)
            except Exception:
                pass
    
    def resetar(self):
        """Reseta progresso"""
        self.current_step = 0
        self.atualizar(0)

import os  # Necessário para FileValidator