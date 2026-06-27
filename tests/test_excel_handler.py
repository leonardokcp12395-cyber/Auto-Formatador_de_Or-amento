import pytest
import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.excel_handler import OrcamentoEngine

def test_parse_num():
    engine = OrcamentoEngine({})
    
    # Int and Float native detection
    assert engine._parse_num(5) == Decimal("5")
    assert engine._parse_num(10.55) == Decimal("10.55")
    
    # String conversions
    assert engine._parse_num("R$ 1.500,20") == Decimal("1500.20")
    assert engine._parse_num("  R$  30 ") == Decimal("30")
    assert engine._parse_num("1.234.567,89") == Decimal("1234567.89")
    
    # Edge cases (nan, none, empty)
    assert engine._parse_num("nan") is None
    assert engine._parse_num("None") is None
    assert engine._parse_num("") is None
    assert engine._parse_num(None) is None
    
def test_aplicar_precisao():
    engine = OrcamentoEngine({})
    
    assert engine._aplicar_precisao(10.559, "TRUNC") == Decimal("10.55")
    assert engine._aplicar_precisao(10.559, "ROUND") == Decimal("10.56")
    assert engine._aplicar_precisao(10.559, "EXACT") == Decimal("10.559")


def test_resolver_total_item_escolhe_formula_que_bate_com_original():
    engine = OrcamentoEngine({})

    assert engine._resolver_total_item(
        qtd_final=1,
        unit_final=1.239,
        total_original=1.24,
        quant_ref="F10",
        unit_ref="G10",
        calc_mode="EXACT",
    ) == "=ROUND(F10*G10, 2)"

    assert engine._resolver_total_item(
        qtd_final=1,
        unit_final=1.239,
        total_original=1.23,
        quant_ref="F11",
        unit_ref="G11",
        calc_mode="EXACT",
    ) == "=ROUNDDOWN(F11*G11, 2)"


def test_header_value_usa_placeholders_para_campos_vazios():
    engine = OrcamentoEngine({})
    engine.info = {"campus": "", "orcafascio": None, "descricao_header": "obra teste"}

    assert engine._header_value("campus") == "XXXXX"
    assert engine._header_value("orcafascio", default="XX") == "XX"
    assert engine._header_value("descricao_header", upper=True) == "OBRA TESTE"
