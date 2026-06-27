import json
import os
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import CompanyProfile, SessionLocal, init_database
from core.paths import get_app_dir, get_resource_path


DEFAULT_OUTPUT_COLUMNS = {
    "ITEM": "A",
    "CODIGO": "B",
    "BANCO": "C",
    "DESCRICAO": "D",
    "UNID": "E",
    "QUANT": "F",
    "UNIT": "G",
    "TOTAL": "H",
}

REQUIRED_OUTPUT_COLUMNS = {"CODIGO", "DESCRICAO", "UNID", "QUANT", "UNIT"}
OPTIONAL_OUTPUT_COLUMNS = {"ITEM", "BANCO", "TOTAL"}
TEMPLATE_EXTENSIONS = {".xlsx", ".xlsm"}


class TemplateManager:
    """
    CRUD dos perfis do Universal Mapper usando SQLAlchemy.
    Arquivos Excel ficam na pasta gravável do app; metadados ficam no SQLite.
    """

    def __init__(self, session: Optional[Session] = None):
        init_database()
        self.models_dir = get_app_dir() / "config" / "templates"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.session = session or SessionLocal()
        self._owns_session = session is None
        self._copy_embedded_templates()
        self._migrate_legacy_json_profiles()
        self._seed_builtin_profiles_if_empty()

    def close(self) -> None:
        if self._owns_session:
            self.session.close()

    def list_profiles(self) -> List[Dict]:
        profiles = self.session.scalars(
            select(CompanyProfile).order_by(CompanyProfile.nome.asc())
        ).all()

        valid_profiles = []
        changed = False
        for profile in profiles:
            if not Path(profile.filepath).exists():
                self.session.delete(profile)
                changed = True
                continue
            valid_profiles.append(profile)

        if changed:
            self.session.commit()

        return [self._to_api(profile) for profile in valid_profiles]

    def get_profile(self, profile_id: str) -> Optional[Dict]:
        if not profile_id:
            return None

        profile = self.session.get(CompanyProfile, profile_id)
        if not profile or not Path(profile.filepath).exists():
            return None

        return self._to_api(profile)

    def add_profile(self, source: BinaryIO, original_filename: str, profile: Dict) -> Tuple[bool, str, Optional[Dict]]:
        suffix = Path(original_filename or "").suffix.lower()
        if suffix not in TEMPLATE_EXTENSIONS:
            return False, "Extensão de template não suportada. Use .xlsx ou .xlsm.", None

        ok, message = self._validate_new_profile(profile)
        if not ok:
            return False, message, None

        profile_id = uuid.uuid4().hex
        filename = self._safe_template_filename(profile_id, original_filename)
        destination = self.models_dir / filename

        try:
            try:
                source.seek(0)
            except Exception:
                pass

            with destination.open("wb") as output:
                shutil.copyfileobj(source, output)
        except Exception as exc:
            return False, f"Erro ao salvar template: {exc}", None

        db_profile = CompanyProfile(
            id=profile_id,
            nome=str(profile["nome_empresa"]).strip(),
            filepath=str(destination),
            start_row=int(profile["linha_inicio"]),
            mapping=self._normalize_column_map(profile.get("mapa_colunas") or profile.get("mapping") or {}),
            use_standard_header=bool(profile.get("usa_cabecalho_padrao", False)),
            footer=self._normalize_footer(profile.get("rodape") or profile.get("footer")),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.session.add(db_profile)
        self.session.commit()
        self.session.refresh(db_profile)
        return True, "Perfil salvo com sucesso.", self._to_api(db_profile)

    def add_profile_from_path(self, source_path: str, profile: Dict) -> Tuple[bool, str, Optional[Dict]]:
        template_path = Path(source_path or "")
        if not template_path.exists() or not template_path.is_file():
            return False, "Template enviado para preview não foi encontrado. Faça o upload novamente.", None

        if template_path.suffix.lower() not in TEMPLATE_EXTENSIONS:
            return False, "Extensão de template não suportada. Use .xlsx ou .xlsm.", None

        try:
            preview_dir = (get_app_dir() / "Output" / "temp" / "templates").resolve()
            resolved_template = template_path.resolve()
            if not resolved_template.is_relative_to(preview_dir):
                return False, "Caminho de template inválido. Faça o upload pelo Estúdio Visual.", None
        except Exception:
            return False, "Não foi possível validar o caminho temporário do template.", None

        with template_path.open("rb") as source:
            ok, message, saved_profile = self.add_profile(source, template_path.name, profile)

        if ok:
            try:
                template_path.unlink()
            except Exception:
                pass

        return ok, message, saved_profile


    def remove_profile(self, profile_id: str) -> bool:
        profile = self.session.get(CompanyProfile, profile_id)
        if not profile:
            return False

        filepath = profile.filepath
        self.session.delete(profile)
        self.session.commit()

        try:
            template_path = Path(filepath)
            if template_path.exists() and template_path.is_file():
                os.remove(template_path)
        except Exception:
            pass

        return True

    def get_template_names(self):
        return [profile["nome_empresa"] for profile in self.list_profiles()]

    def get_template_path(self, name):
        profile = self._find_by_name_or_id(name)
        return profile.filepath if profile else None

    def get_template_info(self, name):
        profile = self._find_by_name_or_id(name)
        return self._to_api(profile) if profile else {}

    def add_template(self, name, source_path, start_line=25):
        with open(source_path, "rb") as source:
            return self.add_profile(source, source_path, {
                "nome_empresa": name,
                "linha_inicio": start_line,
                "mapa_colunas": DEFAULT_OUTPUT_COLUMNS,
            })[:2]

    def remove_template(self, name):
        profile = self._find_by_name_or_id(name)
        return self.remove_profile(profile.id) if profile else False

    def _to_api(self, profile: CompanyProfile) -> Dict:
        mapping = dict(profile.mapping or {})
        footer = dict(profile.footer or {}) if profile.footer else None

        return {
            "id": profile.id,
            "nome": profile.nome,
            "filepath": profile.filepath,
            "start_row": profile.start_row,
            "mapping": mapping,
            "nome_empresa": profile.nome,
            "caminho_template": profile.filepath,
            "linha_inicio": profile.start_row,
            "mapa_colunas": mapping,
            "usa_cabecalho_padrao": profile.use_standard_header,
            "rodape": footer,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }

    def _find_by_name_or_id(self, value: str) -> Optional[CompanyProfile]:
        if not value:
            return None

        profile = self.session.get(CompanyProfile, value)
        if profile:
            return profile

        return self.session.scalar(select(CompanyProfile).where(CompanyProfile.nome == value))

    def _copy_embedded_templates(self) -> None:
        seed_dir = get_resource_path("config/templates")
        if seed_dir.exists():
            for source in seed_dir.glob("*.xls*"):
                target = self.models_dir / source.name
                if not target.exists():
                    try:
                        shutil.copy2(source, target)
                    except Exception:
                        pass

        for filename in ("MODELO SUP.xlsx", "MODELO PRUMO.xlsx"):
            source = get_resource_path(filename)
            target = self.models_dir / filename
            if source.exists() and not target.exists():
                try:
                    shutil.copy2(source, target)
                except Exception:
                    pass

    def _seed_builtin_profiles_if_empty(self) -> None:
        has_profile = self.session.scalar(select(CompanyProfile.id).limit(1))
        if has_profile:
            return

        candidates = self._legacy_template_candidates() or [
            ("sup-2025", "SUP 2025", "MODELO_SUP(2025).xlsx", 25),
            ("prumo-2025-26", "PRUMO 2025-26", "MODELO_PRUMO(2025-26).xlsx", 25),
            ("sup-legado", "SUP Legado", "MODELO SUP.xlsx", 25),
            ("prumo-legado", "PRUMO Legado", "MODELO PRUMO.xlsx", 25),
        ]

        for profile_id, name, filename, start_row in candidates:
            path = self.models_dir / filename
            if not path.exists():
                continue

            self.session.merge(CompanyProfile(
                id=profile_id,
                nome=name,
                filepath=str(path),
                start_row=int(start_row or 25),
                mapping=dict(DEFAULT_OUTPUT_COLUMNS),
                use_standard_header=True,
                footer={"inicio": 26, "fim": 51},
            ))

        self.session.commit()

    def _legacy_template_candidates(self) -> List[Tuple[str, str, str, int]]:
        legacy_file = self.models_dir / "templates.json"
        if not legacy_file.exists():
            legacy_file = get_resource_path("config/templates/templates.json")

        if not legacy_file.exists():
            return []

        try:
            with open(legacy_file, "r", encoding="utf-8") as file:
                data = json.load(file)
        except Exception:
            return []

        candidates = []
        for name, info in (data or {}).items():
            if not isinstance(info, dict):
                continue
            candidates.append((
                self._slugify(name),
                str(name),
                str(info.get("filename") or f"{name}.xlsx"),
                int(info.get("start_line", 25)),
            ))
        return candidates

    def _migrate_legacy_json_profiles(self) -> None:
        legacy_file = self.models_dir / "profiles.json"
        if not legacy_file.exists():
            return

        already_has_profiles = self.session.scalar(select(CompanyProfile.id).limit(1))
        if already_has_profiles:
            return

        try:
            with open(legacy_file, "r", encoding="utf-8") as file:
                data = json.load(file)
        except Exception:
            return

        raw_profiles = data.get("perfis") if isinstance(data, dict) else data
        if not isinstance(raw_profiles, list):
            return

        for raw_profile in raw_profiles:
            if not isinstance(raw_profile, dict):
                continue

            sanitized = self._sanitize_profile(raw_profile)
            if not sanitized:
                continue

            self.session.merge(CompanyProfile(
                id=sanitized["id"],
                nome=sanitized["nome_empresa"],
                filepath=sanitized["caminho_template"],
                start_row=sanitized["linha_inicio"],
                mapping=sanitized["mapa_colunas"],
                use_standard_header=sanitized["usa_cabecalho_padrao"],
                footer=sanitized.get("rodape"),
            ))

        self.session.commit()

    def _sanitize_profile(self, profile: Dict) -> Optional[Dict]:
        try:
            profile_id = str(profile.get("id") or uuid.uuid4().hex)
            name = str(profile.get("nome_empresa") or profile.get("nome") or "").strip()
            template_path = str(profile.get("caminho_template") or profile.get("filepath") or "")
            start_row = int(profile.get("linha_inicio") or profile.get("start_row") or 1)
            output_map = self._normalize_column_map(profile.get("mapa_colunas") or profile.get("mapping") or {})

            if not name or not template_path or start_row < 1:
                return None

            return {
                "id": profile_id,
                "nome_empresa": name,
                "caminho_template": template_path,
                "linha_inicio": start_row,
                "mapa_colunas": output_map,
                "usa_cabecalho_padrao": bool(profile.get("usa_cabecalho_padrao", profile.get("use_standard_header", False))),
                "rodape": self._normalize_footer(profile.get("rodape") or profile.get("footer")),
            }
        except Exception:
            return None

    def _validate_new_profile(self, profile: Dict) -> Tuple[bool, str]:
        if not str(profile.get("nome_empresa", "")).strip():
            return False, "Informe o nome da empresa."

        try:
            if int(profile.get("linha_inicio", 0)) < 1:
                return False, "A linha de início deve ser maior que zero."
        except (TypeError, ValueError):
            return False, "A linha de início deve ser numérica."

        output_map = self._normalize_column_map(profile.get("mapa_colunas") or profile.get("mapping") or {})
        missing = sorted(REQUIRED_OUTPUT_COLUMNS - set(output_map.keys()))
        if missing:
            return False, f"Mapeamento incompleto. Campos obrigatórios ausentes: {', '.join(missing)}."

        return True, ""

    def _normalize_column_map(self, raw_map: Dict) -> Dict[str, str]:
        normalized: Dict[str, str] = {}
        allowed = REQUIRED_OUTPUT_COLUMNS | OPTIONAL_OUTPUT_COLUMNS

        for key, value in (raw_map or {}).items():
            canonical = str(key).upper().strip()
            if canonical not in allowed:
                continue

            column = self._normalize_column_letter(value)
            if column:
                normalized[canonical] = column

        return normalized

    def _normalize_footer(self, footer: Optional[Dict]) -> Optional[Dict]:
        if not isinstance(footer, dict):
            return None

        try:
            footer_start = int(footer.get("inicio") or footer.get("start") or 0)
            footer_end = int(footer.get("fim") or footer.get("end") or 0)
        except (TypeError, ValueError):
            return None

        if footer_start > 0 and footer_end >= footer_start:
            return {"inicio": footer_start, "fim": footer_end}
        return None

    def _normalize_column_letter(self, value) -> Optional[str]:
        column = str(value or "").strip().upper()
        if not re.fullmatch(r"[A-Z]{1,3}", column):
            return None
        return column

    def _safe_template_filename(self, profile_id: str, original_filename: str) -> str:
        suffix = Path(original_filename or "").suffix.lower()
        if suffix not in TEMPLATE_EXTENSIONS:
            suffix = ".xlsx"

        base_name = Path(original_filename or "template.xlsx").stem
        base_name = re.sub(r"[^A-Za-z0-9._ -]", "_", base_name).strip(" .") or "template"
        return f"{profile_id}_{base_name}{suffix}"

    def _slugify(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return slug or uuid.uuid4().hex
