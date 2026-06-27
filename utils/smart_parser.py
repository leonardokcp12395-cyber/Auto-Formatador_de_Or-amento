import re
from rapidfuzz import process, fuzz


class SmartParser:
    """
    V2: Parser com Normalização de Dados.
    Usa Regex para capturar e Fuzzy Matching (via RapidFuzz) para corrigir baseando-se no histórico.
    """

    @staticmethod
    def parse_whatsapp_text(text: str, autocomplete_mgr=None) -> dict:
        """
        Analisa texto, extrai campos e (se fornecido o gerenciador) padroniza os valores.
        """
        data = {}

        # 1. Limpeza básica pré-processamento
        clean_text = text.replace('*', '')
        lines = clean_text.split('\n')

        def extract_os_number(value: str) -> str:
            patterns = [
                r"\bORDEM\s+DE\s+SERVI[ÇC]O\b.*?(?:N[º°O]?|NR|NRO|NÚMERO|NUMERO|N)?\s*[\(:#º°\-\s]*\s*(\d+)",
                r"\bO\.?S\.?\b.*?(?:N[º°O]?|NR|NRO|NÚMERO|NUMERO|N)?\s*[\(:#º°\-\s]*\s*(\d+)",
            ]
            for pattern in patterns:
                match = re.search(pattern, value, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
            return ""

        def extract_contract_number(value: str) -> str:
            match = re.search(
                r"\b(?:CONTRATO|ATA)\b.*?(?:N[º°O]?\s*)?(\d+(?:/\d{4})?)",
                value,
                re.IGNORECASE,
            )
            return match.group(1).strip() if match else ""

        explicit_os_number = ""
        for candidate_line in lines:
            explicit_os_number = extract_os_number(candidate_line)
            if explicit_os_number:
                break

        # 2. Extração estrita por rótulo. Mantém o padrão antigo do formulário
        # e evita "inteligência" excessiva que captura campos errados.
        label_map = {
            "CAMPUS": "campus",
            "CAMPI": "campus",
            "UNIDADE": "campus",
            "SETOR": "setor",
            "LOCAL": "setor",
            "DEPARTAMENTO": "setor",
            "COORDENACAO": "setor",
            "COORDENAÇÃO": "setor",
            "DESCRICAO": "descricao_header",
            "DESCRIÇÃO": "descricao_header",
            "DISCRIMINACAO": "descricao_header",
            "DISCRIMINAÇÃO": "descricao_header",
            "OBJETO": "descricao_header",
            "SERVICO": "descricao_header",
            "SERVIÇO": "descricao_header",
            "SOLICITANTE": "servidor",
            "DEMANDANTE": "servidor",
            "REQUISITANTE": "servidor",
            "SERVIDOR": "servidor",
            "FISCAL": "fiscal",
            "FISCALIZACAO": "fiscal",
            "FISCALIZAÇÃO": "fiscal",
            "ORCAMENTISTA": "elaborador",
            "ORÇAMENTISTA": "elaborador",
            "RESPONSAVEL": "elaborador",
            "RESPONSÁVEL": "elaborador",
            "ELABORADOR": "elaborador",
            "ELABORADO POR": "elaborador",
            "ESTAGIARIO": "estagiario",
            "ESTAGIÁRIO": "estagiario",
            "APOIO": "estagiario",
            "PROCESSO": "processo",
            "SEI": "processo",
            "SIPAC": "processo",
            "ORCAFASCIO": "orcafascio",
            "ORÇAFASCIO": "orcafascio",
            "OF": "orcafascio",
            "EMPENHO": "empenho",
            "NOTA DE EMPENHO": "empenho",
            "CONTRATO": "contrato",
            "ATA": "contrato",
            "ORDEM DE SERVICO": "num_orcamento",
            "ORDEM DE SERVIÇO": "num_orcamento",
            "OS": "num_orcamento",
            "DATA": "data",
            "DATA ELABORACAO": "data",
            "DATA ELABORAÇÃO": "data",
            "DATA DE ELABORACAO": "data",
            "DATA DE ELABORAÇÃO": "data",
            "DATA EMISSAO": "data_emissao",
            "DATA EMISSÃO": "data_emissao",
            "DATA DE EMISSAO": "data_emissao",
            "DATA DE EMISSÃO": "data_emissao",
            "DATA INICIO": "data_inicio",
            "DATA INÍCIO": "data_inicio",
            "DATA DE INICIO": "data_inicio",
            "DATA DE INÍCIO": "data_inicio",
            "PRAZO": "prazo",
            "VALOR": "valor_simulado",
            "VALOR SIMULADO": "valor_simulado",
            "ORCAMENTO": "descricao_header",
            "ORÇAMENTO": "descricao_header",
            "ESTIMATIVA": "valor_simulado",
            "TOTAL": "valor_simulado",
        }

        def normalize_label(value: str) -> str:
            value = value.strip().upper()
            value = re.sub(r"^(N[º°]\s*)", "", value)
            value = re.sub(r"\s+", " ", value)
            return value

        def clean_value(key: str, value: str) -> str:
            value = value.strip()
            if key == "valor_simulado":
                value = re.sub(r"^R\$\s*", "", value, flags=re.IGNORECASE).strip()
            elif key == "orcafascio":
                match = re.search(r"\d+", value)
                value = match.group(0) if match else ""
            elif key == "num_orcamento":
                value = extract_os_number(value) or re.sub(r"\D+", "", value)
            elif key == "processo":
                value = value.strip()
            elif key == "descricao_header":
                value = value.strip()
            else:
                value = re.sub(r"^(DO |DA |DE |O |A )", "", value.upper()).strip()
            return value

        for line in lines:
            line = line.strip()
            if not line or ":" not in line:
                continue

            raw_label, raw_value = line.split(":", 1)
            label = normalize_label(raw_label)
            key = label_map.get(label)
            if not key:
                continue

            value = clean_value(key, raw_value)
            if len(value) <= 1:
                continue

            if key == "contrato":
                data["contrato"] = value.upper()
            elif key == "descricao_header" and label in {"ORCAMENTO", "ORÇAMENTO"}:
                if not re.match(r"^(R\$|[\d\.,]+$)", value, re.IGNORECASE):
                    data[key] = re.sub(r"\s*[:\-]\s*", ": ", line, count=1).strip()
                else:
                    data["valor_simulado"] = re.sub(r"^R\$\s*", "", value, flags=re.IGNORECASE).strip()
            else:
                data[key] = value

        # 3. Dicionário de Padrões de fallback para mensagens antigas sem rótulo claro.
        patterns = {
            "campus": r"(?:CAMPUS|CAMPI|UNIDADE)\s*[:]?\s*(.*)",
            "setor": r"(?:SETOR|LOCAL|DEPARTAMENTO|COORDENAÇÃO)\s*[:]?\s*(.*)",
            "descricao_header": r"(?:DESCRIÇÃO|DISCRIMINAÇÃO|OBJETO|SERVIÇO)\s*[:]?\s*(.*)",
            "servidor": r"(?:SOLICITANTE|DEMANDANTE|REQUISITANTE|SERVIDOR)\s*[:]?\s*(.*)",
            "fiscal": r"(?:FISCAL|FISCALIZAÇÃO)\s*[:]?\s*(.*)",
            "elaborador": r"(?:ORÇAMENTISTA|RESPONSÁVEL|ELABORADO(?:\s+POR)?)\s*[:]?\s*(.*)",
            "estagiario": r"(?:ESTAGIÁRIO|APOIO)\s*[:]?\s*(.*)",
            "processo": r"(?:PROCESSO|SIPAC|SEI|Nº PROCESSO)\s*[:]?\s*([\d\.\-\/]+)",
            "orcafascio": r"(?:ORÇAFASCIO|OF|CÓDIGO)\s*[:]?\s*(\d+)",
            "empenho": r"(?:EMPENHO|NOTA DE EMPENHO)\s*[:]?\s*(.*)",
            "contrato": r"(?:CONTRATO|ATA)\s*[:]?\s*(.*)",
            "num_orcamento": r"(?:ORDEM\s+DE\s+SERVI[ÇC]O|O\.?S\.?).*?(?:N[º°O]?|NR|NRO|NÚMERO|NUMERO|N)?\s*[\(:#º°\-\s]*\s*(\d+)",
            "valor_simulado": r"(?:VALOR(?:\s+SIMULADO)?|ORÇAMENTO|ESTIMATIVA|TOTAL)\s*[:]?\s*(?:R\$)?\s*([\d\.,]+)"
        }

        # 4. Extração via Regex de fallback
        for line in lines:
            line = line.strip()
            if not line:
                continue

            budget_title = re.match(r"^ORÇAMENTO\s*[:\-]\s*(.+)", line, re.IGNORECASE)
            if budget_title:
                title_value = budget_title.group(1).strip()
                if title_value and not re.match(r"^(R\$|\d)", title_value, re.IGNORECASE):
                    data["descricao_header"] = re.sub(r"\s*[:\-]\s*", ": ", line, count=1).strip()
                    continue

            for key, pattern in patterns.items():
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    val = match.group(1).strip().upper()
                    val = re.sub(r"^(DO |DA |DE |O |A )", "", val)

                    if key == "contrato" and "descricao_header" in data:
                        data["descricao_header"] += f" - {val}"
                    elif key == "contrato":
                        data.setdefault("contrato", val)
                    else:
                        if len(val) > 1 and key not in data:
                            data[key] = val

        if explicit_os_number:
            data["num_orcamento"] = explicit_os_number
        elif "num_orcamento" not in data:
            contract_number = extract_contract_number(clean_text)
            if contract_number:
                data["num_orcamento"] = contract_number

        # 5. NORMALIZAÇÃO INTELIGENTE
        if autocomplete_mgr:
            data = SmartParser._normalizar_dados(data, autocomplete_mgr)

        return data

    @staticmethod
    def _normalizar_dados(data, mgr):
        """
        Tenta encontrar o valor mais próximo no banco de dados para corrigir erros de digitação.
        """
        mapa_chaves = {
            "campus": "campus",
            "setor": "setor",
            "servidor": "servidor",
            "elaborador": "elaborador",
            "fiscal": "fiscal"
        }

        for field_parser, field_db in mapa_chaves.items():
            if field_parser in data:
                valor_extraido = data[field_parser]
                opcoes_validas = mgr.get_list(field_db)

                if not opcoes_validas:
                    continue

                if valor_extraido in opcoes_validas:
                    continue

                match = process.extractOne(
                    valor_extraido, opcoes_validas, scorer=fuzz.ratio)

                if match:
                    sugestao, score, _ = match
                    if score >= 60:  # 60 corresponds to cutoff=0.6 from difflib
                        data[field_parser] = sugestao

        return data
