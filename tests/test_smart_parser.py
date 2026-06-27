import pytest
import sys
import os

# Adds core/utils to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.smart_parser import SmartParser

class DummyAutocomplete:
    def get_list(self, key):
        return ["Campus São Desidério", "Campus Orizona"]

def test_parse_whatsapp_text():
    texto = """
    Orçamento: Manutenção Telhado
    Setor: TI
    Valor Simulado: R$ 5.432,10
    """
    dummy_ac = DummyAutocomplete()
    resultado = SmartParser.parse_whatsapp_text(texto, dummy_ac)
    assert resultado["descricao_header"] == "Orçamento: Manutenção Telhado"
    assert resultado["setor"] == "TI"
    assert resultado["valor_simulado"] == "5.432,10"


def test_parse_whatsapp_prioriza_ordem_de_servico_sobre_contrato():
    texto = """
    DESCRIÇÃO: SERVIÇOS DE PINTURA - NTPC
    Contrato: PRUMO - Nº 14/2025
    Dados para Ordem de serviço (nº 142)
    Orçafascio: NÃO TEM (FAZER NO ORÇAFASCIO DE ACORDO COM O ARQUIVO ANEXO)
    """

    resultado = SmartParser.parse_whatsapp_text(texto)

    assert resultado["num_orcamento"] == "142"
    assert resultado["contrato"] == "PRUMO - Nº 14/2025"
    assert "orcafascio" not in resultado


def test_parse_whatsapp_fallback_contrato_quando_nao_ha_os():
    texto = """
    DESCRIÇÃO: SERVIÇOS DE PINTURA - NTPC
    Contrato: PRUMO - (Nº 14/2025)
    Processo: 23073.007939/2026-94
    """

    resultado = SmartParser.parse_whatsapp_text(texto)

    assert resultado["num_orcamento"] == "14/2025"
