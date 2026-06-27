from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, create_engine, inspect, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from core.paths import get_app_dir
from utils.logger import Logger


DATABASE_PATH = get_app_dir() / "planify_history.db"
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)


class Base(DeclarativeBase):
    pass


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nome: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    filepath: Mapped[str] = mapped_column(String(1024), nullable=False)
    start_row: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    mapping: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    use_standard_header: Mapped[bool] = mapped_column(default=False, nullable=False)
    footer: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class BudgetHistory(Base):
    __tablename__ = "budget_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    sector: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    total_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    excel_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    profile_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("company_profiles.id"), nullable=True)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_bdi: Mapped[float] = mapped_column(Float, nullable=False, default=0.2882)
    last_profile_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


def init_database() -> None:
    """
    Cria tabelas ausentes e migra histórico legado quando possível.
    SQLite não precisa de um runner externo para esse nível de migração.
    """
    Base.metadata.create_all(bind=engine)
    _migrate_legacy_orcamentos()
    _ensure_preferences()


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_or_create_preferences(session: Session) -> UserPreferences:
    preferences = session.get(UserPreferences, 1)
    if preferences:
        return preferences

    preferences = UserPreferences(id=1)
    session.add(preferences)
    session.commit()
    session.refresh(preferences)
    return preferences


def update_preferences(session: Session, *, last_bdi: Optional[float] = None, last_profile_id: Optional[str] = None) -> UserPreferences:
    preferences = get_or_create_preferences(session)
    if last_bdi is not None:
        preferences.last_bdi = float(last_bdi)
    if last_profile_id is not None:
        preferences.last_profile_id = last_profile_id

    session.add(preferences)
    session.commit()
    session.refresh(preferences)
    return preferences


def record_budget_history(
    session: Session,
    *,
    project_name: str,
    sector: str,
    total_value: float,
    excel_path: str,
    profile_id: Optional[str],
) -> BudgetHistory:
    item = BudgetHistory(
        project_name=project_name or "",
        sector=sector or "",
        total_value=float(total_value or 0.0),
        excel_path=excel_path or "",
        profile_id=profile_id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def _ensure_preferences() -> None:
    with SessionLocal() as session:
        get_or_create_preferences(session)


def _migrate_legacy_orcamentos() -> None:
    inspector = inspect(engine)
    if "orcamentos" not in inspector.get_table_names():
        return

    with SessionLocal() as session:
        has_history = session.scalar(select(BudgetHistory.id).limit(1))
        if has_history:
            return

        connection = engine.connect()
        try:
            rows = connection.exec_driver_sql(
                """
                SELECT data_geracao, nome_obra, local, valor_total, arquivo_saida
                FROM orcamentos
                ORDER BY id ASC
                """
            ).mappings()

            for row in rows:
                parsed_date = _parse_legacy_date(row.get("data_geracao"))
                session.add(BudgetHistory(
                    date=parsed_date,
                    project_name=row.get("nome_obra") or "",
                    sector=row.get("local") or "",
                    total_value=float(row.get("valor_total") or 0.0),
                    excel_path=row.get("arquivo_saida") or "",
                ))

            session.commit()
        except Exception as exc:
            session.rollback()
            Logger.warning(f"Aviso ao migrar histórico legado: {exc}")
        finally:
            connection.close()


def _parse_legacy_date(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value

    if not value:
        return datetime.utcnow()

    text = str(value)
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue

    return datetime.utcnow()


class DatabaseManager:
    """
    Fachada de compatibilidade para código legado.
    Novas chamadas devem usar Session + modelos ORM diretamente.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        init_database()

    def inserir_orcamento(self, dados: Dict[str, Any]) -> None:
        with SessionLocal() as session:
            record_budget_history(
                session,
                project_name=dados.get("nome_obra") or dados.get("project_name") or "",
                sector=dados.get("local") or dados.get("sector") or "",
                total_value=float(dados.get("valor_total") or dados.get("total_value") or 0.0),
                excel_path=dados.get("arquivo_saida") or dados.get("excel_path") or "",
                profile_id=dados.get("profile_id"),
            )

    def buscar_estatisticas(self) -> Dict[str, Any]:
        with SessionLocal() as session:
            items = session.scalars(select(BudgetHistory)).all()
            total_value = sum(item.total_value for item in items)
            last = items[-1] if items else None
            return {
                "total_orcamentos": len(items),
                "valor_total_processado": total_value,
                "media_itens": 0.0,
                "ultimo_orcamento": {"nome": last.project_name} if last else None,
            }

    def buscar_orcamentos(self, limite: int = 20) -> List[Dict[str, Any]]:
        with SessionLocal() as session:
            items = session.scalars(
                select(BudgetHistory).order_by(BudgetHistory.id.desc()).limit(limite)
            ).all()
            return [
                {
                    "id": item.id,
                    "data_geracao": item.date.isoformat(),
                    "nome_obra": item.project_name,
                    "local": item.sector,
                    "valor_total": item.total_value,
                    "arquivo_saida": item.excel_path,
                }
                for item in items
            ]


class LogHandler:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
