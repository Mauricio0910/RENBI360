"""RenBI 360 - ponte segura de leitura para Microsoft SQL Server.

O front-end NUNCA se conecta diretamente ao SQL Server. Esta camada roda no
backend FastAPI e utiliza uma credencial somente-leitura. As consultas são
configuradas em sql_mapping.json e devem retornar aliases canônicos esperados
pelo RenBI.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional
import json
import os
import re
import time

try:
    import pyodbc  # type: ignore
except Exception:  # pragma: no cover - ambiente sem driver ODBC
    pyodbc = None


CANONICAL_SUMMARY_FIELDS = {
    "revenue", "sales", "purchases", "gross_profit", "expenses", "net_profit",
    "inventory", "receivables", "payables", "cash",
}


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "sim", "on"}


def _json_safe(value: Any) -> Any:
    if isinstance(value, (datetime,)):
        return value.isoformat()
    try:
        # date, Decimal e tipos do driver costumam aceitar isoformat/float.
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if hasattr(value, "as_integer_ratio") and not isinstance(value, int):
            return float(value)
    except Exception:
        pass
    return value


class SQLBridgeError(RuntimeError):
    pass


class SQLBridge:
    def __init__(self, base_dir: str | Path):
        self.base_dir = Path(base_dir)
        self.mapping_file = Path(os.getenv("SQL_MAPPING_FILE", str(self.base_dir / "sql_mapping.json")))
        self.snapshot_file = Path(os.getenv("SQL_SNAPSHOT_FILE", str(self.base_dir / "data" / "sql_snapshot.json")))
        self.snapshot_file.parent.mkdir(parents=True, exist_ok=True)

    @property
    def enabled(self) -> bool:
        return _truthy(os.getenv("SQL_ENABLED", "false"))

    @property
    def data_source(self) -> str:
        return os.getenv("RENBI_DATA_SOURCE", "demo").strip().lower()

    def _connection_settings(self) -> dict[str, Any]:
        return {
            "driver": os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server"),
            "server": os.getenv("SQL_SERVER", ""),
            "port": os.getenv("SQL_PORT", "1433"),
            "database": os.getenv("SQL_DATABASE", ""),
            "username": os.getenv("SQL_USERNAME", ""),
            "password": os.getenv("SQL_PASSWORD", ""),
            "encrypt": os.getenv("SQL_ENCRYPT", "yes"),
            "trust_server_certificate": os.getenv("SQL_TRUST_SERVER_CERTIFICATE", "no"),
            "connection_timeout": int(os.getenv("SQL_CONNECTION_TIMEOUT", "8")),
            "query_timeout": int(os.getenv("SQL_QUERY_TIMEOUT", "30")),
        }

    def safe_config(self) -> dict[str, Any]:
        c = self._connection_settings()
        return {
            "enabled": self.enabled,
            "data_source": self.data_source,
            "driver": c["driver"],
            "server": c["server"],
            "port": c["port"],
            "database": c["database"],
            "username_configured": bool(c["username"]),
            "password_configured": bool(c["password"]),
            "encrypt": c["encrypt"],
            "trust_server_certificate": c["trust_server_certificate"],
            "mapping_file": self.mapping_file.name,
            "mapping_exists": self.mapping_file.exists(),
            "snapshot_exists": self.snapshot_file.exists(),
        }

    def _connection_string(self) -> str:
        c = self._connection_settings()
        if not c["server"] or not c["database"]:
            raise SQLBridgeError("SQL_SERVER e SQL_DATABASE precisam estar configurados no backend.")
        server = c["server"]
        if c["port"] and "," not in server:
            server = f"{server},{c['port']}"
        parts = [
            f"DRIVER={{{c['driver']}}}",
            f"SERVER={server}",
            f"DATABASE={c['database']}",
            f"Encrypt={c['encrypt']}",
            f"TrustServerCertificate={c['trust_server_certificate']}",
            f"Connection Timeout={c['connection_timeout']}",
            "ApplicationIntent=ReadOnly",
            "APP=RenBI360",
        ]
        if c["username"]:
            parts += [f"UID={c['username']}", f"PWD={c['password']}"]
        else:
            # Útil para servidor Windows com identidade do processo.
            parts += ["Trusted_Connection=yes"]
        return ";".join(parts) + ";"

    def connect(self):
        if not self.enabled:
            raise SQLBridgeError("Integração SQL está desativada. Defina SQL_ENABLED=true no backend.")
        if pyodbc is None:
            raise SQLBridgeError("pyodbc não está instalado ou o driver ODBC do SQL Server não está disponível.")
        try:
            conn = pyodbc.connect(self._connection_string(), autocommit=True)
            conn.timeout = self._connection_settings()["query_timeout"]
            return conn
        except Exception as exc:
            raise SQLBridgeError(f"Falha ao conectar no SQL Server: {exc}") from exc

    def load_mapping(self) -> dict[str, Any]:
        if not self.mapping_file.exists():
            return {"version": 1, "entities": {}}
        try:
            data = json.loads(self.mapping_file.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                raise ValueError("raiz deve ser um objeto JSON")
            data.setdefault("entities", {})
            return data
        except Exception as exc:
            raise SQLBridgeError(f"Arquivo de mapeamento SQL inválido: {exc}") from exc

    def entity_catalog(self) -> list[dict[str, Any]]:
        mapping = self.load_mapping()
        entities = []
        snapshot = self.load_snapshot()
        snap_entities = snapshot.get("entities", {})
        for name, cfg in mapping.get("entities", {}).items():
            if not isinstance(cfg, dict):
                continue
            snap = snap_entities.get(name, {}) if isinstance(snap_entities, dict) else {}
            entities.append({
                "entity": name,
                "label": cfg.get("label", name),
                "enabled": bool(cfg.get("enabled", False)),
                "max_rows": int(cfg.get("max_rows", 5000)),
                "last_rows": int(snap.get("count", 0) or 0),
                "last_sync_at": snap.get("synced_at"),
                "description": cfg.get("description", ""),
            })
        return entities

    @staticmethod
    def _validate_read_query(query: str) -> None:
        q = re.sub(r"^\s*(--[^\n]*\n|/\*.*?\*/\s*)*", "", query or "", flags=re.S).strip().lower()
        if not (q.startswith("select") or q.startswith("with")):
            raise SQLBridgeError("Por segurança, o RenBI aceita somente consultas SELECT/CTE no mapeamento SQL.")
        forbidden = re.compile(r"\b(insert|update|delete|drop|alter|truncate|merge|exec(?:ute)?|grant|revoke|create)\b", re.I)
        if forbidden.search(q):
            raise SQLBridgeError("Consulta rejeitada: somente leitura é permitida.")

    def _execute(self, query: str, max_rows: int = 5000) -> list[dict[str, Any]]:
        self._validate_read_query(query)
        with self.connect() as conn:
            cur = conn.cursor()
            cur.timeout = self._connection_settings()["query_timeout"]
            cur.execute(query)
            cols = [c[0] for c in (cur.description or [])]
            rows: list[dict[str, Any]] = []
            for idx, row in enumerate(cur):
                if idx >= max_rows:
                    break
                rows.append({cols[i]: _json_safe(row[i]) for i in range(len(cols))})
            return rows

    def test_connection(self) -> dict[str, Any]:
        started = time.perf_counter()
        with self.connect() as conn:
            cur = conn.cursor()
            cur.execute("SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name, @@VERSION AS server_version")
            row = cur.fetchone()
        elapsed = round((time.perf_counter() - started) * 1000, 1)
        return {
            "ok": True,
            "latency_ms": elapsed,
            "database": row[0] if row else self._connection_settings()["database"],
            "server": row[1] if row else self._connection_settings()["server"],
            "server_version": str(row[2]).split("\n")[0] if row and row[2] else "",
            "checked_at": datetime.now().isoformat(),
        }

    def preview(self, entity: str, limit: int = 20) -> dict[str, Any]:
        mapping = self.load_mapping().get("entities", {})
        cfg = mapping.get(entity)
        if not isinstance(cfg, dict):
            raise SQLBridgeError(f"Entidade SQL não mapeada: {entity}")
        if not cfg.get("enabled", False):
            raise SQLBridgeError(f"Entidade SQL está desativada no mapeamento: {entity}")
        rows = self._execute(str(cfg.get("query", "")), max_rows=max(1, min(limit, 100)))
        return {"entity": entity, "count": len(rows), "rows": rows}

    def load_snapshot(self) -> dict[str, Any]:
        if not self.snapshot_file.exists():
            return {"version": 1, "last_sync_at": None, "entities": {}}
        try:
            return json.loads(self.snapshot_file.read_text(encoding="utf-8"))
        except Exception:
            return {"version": 1, "last_sync_at": None, "entities": {}}

    def _save_snapshot(self, payload: dict[str, Any]) -> None:
        temp = self.snapshot_file.with_suffix(".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(self.snapshot_file)

    def sync(self, entities: Optional[Iterable[str]] = None) -> dict[str, Any]:
        mapping = self.load_mapping().get("entities", {})
        requested = set(entities or [])
        snapshot = self.load_snapshot()
        snapshot.setdefault("entities", {})
        results = []
        total = 0
        started = datetime.now()
        for name, cfg in mapping.items():
            if not isinstance(cfg, dict) or not cfg.get("enabled", False):
                continue
            if requested and name not in requested:
                continue
            try:
                max_rows = max(1, min(int(cfg.get("max_rows", 5000)), int(os.getenv("SQL_MAX_ROWS_PER_ENTITY", "50000"))))
                rows = self._execute(str(cfg.get("query", "")), max_rows=max_rows)
                entry = {"count": len(rows), "synced_at": datetime.now().isoformat(), "rows": rows}
                snapshot["entities"][name] = entry
                total += len(rows)
                results.append({"entity": name, "status": "ok", "rows": len(rows)})
            except Exception as exc:
                results.append({"entity": name, "status": "error", "rows": 0, "error": str(exc)})
        snapshot["version"] = 1
        snapshot["last_sync_at"] = datetime.now().isoformat()
        snapshot["source"] = "sqlserver"
        self._save_snapshot(snapshot)
        return {
            "status": "completed" if all(x["status"] == "ok" for x in results) else "partial",
            "started_at": started.isoformat(),
            "finished_at": datetime.now().isoformat(),
            "records_processed": total,
            "entities": results,
        }

    def entity_rows(self, entity: str) -> list[dict[str, Any]]:
        snapshot = self.load_snapshot()
        entry = snapshot.get("entities", {}).get(entity, {})
        rows = entry.get("rows", []) if isinstance(entry, dict) else []
        return rows if isinstance(rows, list) else []

    def summary_override(self) -> dict[str, float]:
        rows = self.entity_rows("summary")
        if not rows:
            return {}
        first = rows[0]
        result: dict[str, float] = {}
        for key in CANONICAL_SUMMARY_FIELDS:
            if key in first and first[key] is not None:
                try:
                    result[key] = float(first[key])
                except (TypeError, ValueError):
                    pass
        return result

    def status(self) -> dict[str, Any]:
        safe = self.safe_config()
        snapshot = self.load_snapshot()
        catalog = self.entity_catalog()
        configured = [x for x in catalog if x["enabled"]]
        errors: list[str] = []
        if self.enabled and not safe["mapping_exists"]:
            errors.append("Crie backend/sql_mapping.json a partir do arquivo sql_mapping.example.json.")
        if self.enabled and not safe["server"]:
            errors.append("SQL_SERVER não configurado.")
        if self.enabled and not safe["database"]:
            errors.append("SQL_DATABASE não configurado.")
        return {
            **safe,
            "ready": self.enabled and safe["mapping_exists"] and bool(safe["server"]) and bool(safe["database"]) and bool(configured),
            "last_sync_at": snapshot.get("last_sync_at"),
            "entities": catalog,
            "configured_entities": len(configured),
            "errors": errors,
            "security": {
                "browser_direct_sql": False,
                "read_only_recommended": True,
                "credentials_exposed": False,
            },
        }
