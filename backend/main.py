from datetime import date, datetime, timedelta
from typing import Any, Literal, Optional
import os
import random
import secrets
import hmac

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(*args, **kwargs):
        return False

from sql_bridge import SQLBridge, SQLBridgeError

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
SQL_BRIDGE = SQLBridge(os.path.dirname(__file__))

APP_NAME = "RenBI 360"
API_PREFIX = "/api/v1"
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
API_TOKEN = os.getenv("API_TOKEN", "demo-token-change-me")
LICENSE_STATUS = os.getenv("LICENSE_STATUS", "active").lower()
LICENSE_DUE_DATE = os.getenv("LICENSE_DUE_DATE", "2026-08-10")
LICENSE_GRACE_UNTIL = os.getenv("LICENSE_GRACE_UNTIL", "2026-08-15")
SESSIONS: dict[str, dict[str, Any]] = {}
APP_USERS: dict[str, dict[str, Any]] = {
    "admin": {"name": "Administrador RenBI", "password": os.getenv("ADMIN_PASSWORD", "RenBI@2026"), "role": "superadmin", "active": True},
    "gestor": {"name": "Gestor", "password": os.getenv("MANAGER_PASSWORD", "Gestor@2026"), "role": "manager", "active": True},
    "financeiro": {"name": "Financeiro", "password": os.getenv("FINANCE_PASSWORD", "Finance@2026"), "role": "finance", "active": True},
    "integracao": {"name": "Integração Delphi", "password": os.getenv("INTEGRATION_PASSWORD", "change-me"), "role": "integration", "active": True},
}

app = FastAPI(
    title=f"{APP_NAME} API",
    version="1.5.0",
    description="API-first management intelligence platform with Delphi REST/JSON, responsive executive UI and SQL Server integration through canonical REN-BI views.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE = {
    "revenue": 1284900.0,
    "sales": 1117400.0,
    "purchases": 653820.0,
    "gross_profit": 431880.0,
    "expenses": 286450.0,
    "net_profit": 145430.0,
    "inventory": 914300.0,
    "receivables": 389700.0,
    "payables": 271900.0,
    "cash": 522800.0,
}


def _reference_window(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None) -> tuple[date, date]:
    today = date.today()
    try:
        if granularity == "day" and reference:
            d = datetime.strptime(reference[:10], "%Y-%m-%d").date(); return d, d
        if granularity == "month" and reference:
            first = datetime.strptime(reference[:7] + "-01", "%Y-%m-%d").date()
            next_month = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
            return first, next_month - timedelta(days=1)
        if granularity == "year" and reference:
            y = int(str(reference)[:4]); return date(y, 1, 1), date(y, 12, 31)
    except Exception:
        pass
    days = {"7d": 7, "30d": 30, "90d": 90, "12m": 365}.get(period, 30)
    return today - timedelta(days=days-1), today

def _effective_base(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None) -> dict[str, float]:
    """Retorna KPIs do período solicitado usando SQL diário quando disponível."""
    result = dict(BASE)
    if SQL_BRIDGE.data_source != "sqlserver":
        return result
    daily = SQL_BRIDGE.entity_rows("management_daily")
    if daily:
        start, end = _reference_window(period, granularity, reference)
        chosen = [x for x in daily if (d := _parse_sql_date(x.get("date"))) and start <= d <= end]
        if chosen:
            flows = ("revenue", "sales", "purchases", "gross_profit", "expenses", "net_profit")
            balances = ("inventory", "receivables", "payables", "cash")
            for key in flows:
                vals=[]
                for row in chosen:
                    if row.get(key) is not None:
                        try: vals.append(float(row.get(key) or 0))
                        except (TypeError,ValueError): pass
                if vals: result[key]=sum(vals)
            chosen_sorted=sorted(chosen,key=lambda x:str(x.get("date","")))
            last=chosen_sorted[-1]
            for key in balances:
                if last.get(key) is not None:
                    try: result[key]=float(last.get(key) or 0)
                    except (TypeError,ValueError): pass
            if not any(row.get("net_profit") is not None for row in chosen):
                result["net_profit"] = result.get("revenue",0)-result.get("purchases",0)-result.get("expenses",0)
            return result
    override = SQL_BRIDGE.summary_override()
    result.update(override)
    if "net_profit" not in override and any(k in override for k in ("revenue", "purchases", "expenses")):
        result["net_profit"] = result.get("revenue", 0) - result.get("purchases", 0) - result.get("expenses", 0)
    return result

def _sql_rows(entity: str) -> list[dict[str, Any]]:
    if SQL_BRIDGE.data_source != "sqlserver":
        return []
    return SQL_BRIDGE.entity_rows(entity)

def _parse_sql_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    text = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None

def _remaining_value(row: dict[str, Any]) -> float:
    try:
        return max(0.0, float(row.get("value", 0) or 0) - float(row.get("paid_value", 0) or 0))
    except (TypeError, ValueError):
        return 0.0

SELLERS = [
    {"id": "V001", "name": "Ana Souza", "target": 230000.0, "actual": 247500.0},
    {"id": "V002", "name": "Carlos Lima", "target": 210000.0, "actual": 193800.0},
    {"id": "V003", "name": "Marina Alves", "target": 200000.0, "actual": 221200.0},
    {"id": "V004", "name": "Paulo Mendes", "target": 190000.0, "actual": 176900.0},
    {"id": "V005", "name": "Juliana Reis", "target": 180000.0, "actual": 194000.0},
]

PRODUCTS = [
    ("P001", "Arroz Premium 5kg", 18420, 28.90, 18.35),
    ("P002", "Feijão Carioca 1kg", 13980, 9.79, 6.11),
    ("P003", "Óleo de Soja 900ml", 12630, 7.49, 5.28),
    ("P004", "Café Tradicional 500g", 11390, 18.90, 12.77),
    ("P005", "Açúcar Cristal 2kg", 9960, 8.59, 5.61),
    ("P006", "Macarrão Espaguete 500g", 9420, 5.29, 3.10),
    ("P007", "Leite Integral 1L", 9180, 6.39, 4.32),
    ("P008", "Biscoito Integral 140g", 1120, 7.20, 4.69),
    ("P009", "Molho Especial 320g", 890, 11.90, 7.86),
    ("P010", "Chá Premium 20un", 540, 16.90, 10.75),
    ("P011", "Tempero Gourmet 60g", 410, 12.50, 8.71),
    ("P012", "Granola Zero 250g", 290, 19.90, 13.62),
]

SUPPLIERS = [
    {"id": "F001", "name": "Distribuidora Norte", "price_index": 94, "delivery": 97, "quality": 96, "terms": 88, "spend": 258400.0},
    {"id": "F002", "name": "Atacado Brasil", "price_index": 97, "delivery": 91, "quality": 92, "terms": 94, "spend": 221900.0},
    {"id": "F003", "name": "Central Alimentos", "price_index": 91, "delivery": 95, "quality": 94, "terms": 86, "spend": 189700.0},
    {"id": "F004", "name": "Prime Supply", "price_index": 89, "delivery": 88, "quality": 99, "terms": 90, "spend": 143820.0},
    {"id": "F005", "name": "Rota Distribuição", "price_index": 92, "delivery": 84, "quality": 90, "terms": 96, "spend": 117300.0},
]

REGIONS = [
    {"region": "Norte", "state": "PA", "city": "Marabá", "score": 91, "potential": 1850000, "competition": "Média", "trend": 12.4},
    {"region": "Norte", "state": "TO", "city": "Gurupi", "score": 88, "potential": 1120000, "competition": "Baixa", "trend": 10.8},
    {"region": "Nordeste", "state": "MA", "city": "Imperatriz", "score": 87, "potential": 1690000, "competition": "Média", "trend": 9.9},
    {"region": "Centro-Oeste", "state": "GO", "city": "Rio Verde", "score": 85, "potential": 2100000, "competition": "Alta", "trend": 8.7},
    {"region": "Nordeste", "state": "PI", "city": "Teresina", "score": 82, "potential": 2410000, "competition": "Alta", "trend": 7.6},
]

COST_CENTERS = [
    {"code": "ADM", "name": "Administrativo", "fixed": 51200.0, "variable": 11400.0, "budget": 65000.0},
    {"code": "COM", "name": "Comercial", "fixed": 43800.0, "variable": 22900.0, "budget": 70000.0},
    {"code": "LOG", "name": "Logística", "fixed": 36700.0, "variable": 26400.0, "budget": 68000.0},
    {"code": "OPS", "name": "Operações", "fixed": 58900.0, "variable": 18200.0, "budget": 80000.0},
    {"code": "MKT", "name": "Marketing", "fixed": 18100.0, "variable": 9800.0, "budget": 30000.0},
]

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    name: str
    username: str
    password: str = Field(min_length=6)
    role: Literal["admin", "manager", "sales", "finance", "viewer"] = "viewer"

class UserUpdate(BaseModel):
    active: Optional[bool] = None
    role: Optional[Literal["admin", "manager", "sales", "finance", "viewer"]] = None
    password: Optional[str] = Field(default=None, min_length=6)
    toggle_active: bool = False

class LicenseUpdate(BaseModel):
    status: Literal["active", "grace", "blocked"]
    due_date: Optional[str] = None
    grace_until: Optional[str] = None
    reason: Optional[str] = None

class SyncItem(BaseModel):
    entity: Literal[
        "sale", "sale_item", "purchase", "purchase_item", "product", "inventory",
        "supplier", "customer", "seller", "expense", "cost_center", "accounting_entry"
    ]
    external_id: str = Field(min_length=1, max_length=100)
    operation: Literal["upsert", "delete"] = "upsert"
    occurred_at: datetime
    data: dict[str, Any] = Field(default_factory=dict)

class SyncBatch(BaseModel):
    source_system: str = "delphi-erp"
    company_id: str
    branch_id: Optional[str] = None
    idempotency_key: str
    items: list[SyncItem]


class SQLSyncRequest(BaseModel):
    entities: list[str] = Field(default_factory=list)



def _factor(period: str) -> float:
    return {"7d": 0.24, "30d": 1.0, "90d": 2.86, "12m": 11.7}.get(period, 1.0)


def _money(v: float) -> float:
    return round(v, 2)


def _growth_series(base: float, months: int = 12, growth: float = 0.018) -> list[dict[str, Any]]:
    today = date.today().replace(day=1)
    items = []
    value = base
    for i in range(months):
        d = today - timedelta(days=30 * (months - 1 - i))
        seasonal = 1 + (0.045 if d.month in (11, 12) else -0.025 if d.month in (2, 3) else 0)
        noise = 1 + ((i % 4) - 1.5) * 0.009
        value = value * (1 + growth) * noise
        items.append({"month": d.strftime("%Y-%m"), "value": _money(value * seasonal)})
    return items


def _license_payload() -> dict[str, Any]:
    return {
        "status": LICENSE_STATUS,
        "plan": os.getenv("LICENSE_PLAN", "RenBI 360 Business"),
        "company": os.getenv("LICENSE_COMPANY", "Empresa Licenciada"),
        "due_date": LICENSE_DUE_DATE,
        "grace_until": LICENSE_GRACE_UNTIL,
        "reason": "Pendência financeira" if LICENSE_STATUS == "blocked" else "",
        "billing_contact": os.getenv("BILLING_CONTACT", "financeiro@empresa.com.br"),
    }

def _require_token(authorization: Optional[str], check_license: bool = True) -> dict[str, Any]:
    if DEMO_MODE:
        return {"username": "admin", "name": "Administrador RenBI", "role": "superadmin"}
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    user = SESSIONS.get(token)
    # Mantém compatibilidade com o token de integração configurado por variável de ambiente.
    if not user and hmac.compare_digest(token, API_TOKEN):
        user = {"username": "integracao", "name": "Integração Delphi", "role": "integration"}
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if check_license and LICENSE_STATUS == "blocked" and user.get("role") != "superadmin":
        raise HTTPException(status_code=402, detail=_license_payload())
    return user

def _require_admin(authorization: Optional[str], superadmin: bool = False) -> dict[str, Any]:
    user = _require_token(authorization, check_license=False)
    allowed = {"superadmin"} if superadmin else {"superadmin", "admin"}
    if user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Administrator permission required")
    return user


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", f"req-{int(datetime.now().timestamp()*1000)}")
    response.headers["X-API-Version"] = "1.4"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "service": APP_NAME, "time": datetime.now().isoformat(), "data_source": SQL_BRIDGE.data_source, "sql_enabled": SQL_BRIDGE.enabled}


@app.post(f"{API_PREFIX}/auth/login")
def login(payload: LoginRequest):
    user = APP_USERS.get(payload.username)
    if not user or not user.get("active") or not hmac.compare_digest(str(user.get("password", "")), payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = secrets.token_urlsafe(32)
    session = {"username": payload.username, "name": user["name"], "role": user["role"]}
    SESSIONS[token] = session
    lic = _license_payload()
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600, "user": session, "license": lic}

@app.get(f"{API_PREFIX}/auth/me")
def auth_me(authorization: Optional[str] = Header(None)):
    return _require_token(authorization, check_license=False)

@app.get(f"{API_PREFIX}/license/status")
def license_status(authorization: Optional[str] = Header(None)):
    _require_token(authorization, check_license=False)
    return _license_payload()

@app.post(f"{API_PREFIX}/license/status")
def update_license(payload: LicenseUpdate, authorization: Optional[str] = Header(None)):
    _require_admin(authorization, superadmin=True)
    global LICENSE_STATUS, LICENSE_DUE_DATE, LICENSE_GRACE_UNTIL
    LICENSE_STATUS = payload.status
    if payload.due_date: LICENSE_DUE_DATE = payload.due_date
    if payload.grace_until: LICENSE_GRACE_UNTIL = payload.grace_until
    result = _license_payload()
    if payload.reason: result["reason"] = payload.reason
    return result

@app.get(f"{API_PREFIX}/users")
def list_users(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    return [{"username": k, "name": v["name"], "role": v["role"], "active": v["active"]} for k, v in APP_USERS.items() if v["role"] != "integration"]

@app.post(f"{API_PREFIX}/users")
def create_user(payload: UserCreate, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    if payload.username in APP_USERS:
        raise HTTPException(status_code=409, detail="Username already exists")
    APP_USERS[payload.username] = {"name": payload.name, "password": payload.password, "role": payload.role, "active": True}
    return {"username": payload.username, "name": payload.name, "role": payload.role, "active": True}

@app.patch(f"{API_PREFIX}/users/{{username}}")
def update_user(username: str, payload: UserUpdate, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    if username not in APP_USERS:
        raise HTTPException(status_code=404, detail="User not found")
    user = APP_USERS[username]
    if payload.toggle_active: user["active"] = not user["active"]
    if payload.active is not None: user["active"] = payload.active
    if payload.role is not None: user["role"] = payload.role
    if payload.password is not None: user["password"] = payload.password
    return {"username": username, "name": user["name"], "role": user["role"], "active": user["active"]}


@app.get(f"{API_PREFIX}/dashboard/summary")
def dashboard_summary(period: str = Query("30d", pattern="^(7d|30d|90d|12m)$"), granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    f = 1.0 if SQL_BRIDGE.data_source == "sqlserver" else _factor(period)
    revenue = b["revenue"] * f
    sales = b["sales"] * f
    purchases = b["purchases"] * f
    expenses = b["expenses"] * f
    net = b["net_profit"] * f
    return {
        "period": period,
        "kpis": {
            "revenue": _money(revenue),
            "sales": _money(sales),
            "purchases": _money(purchases),
            "gross_margin_pct": 33.6,
            "net_profit": _money(net),
            "net_margin_pct": round((net / revenue) * 100, 1),
            "inventory_value": b["inventory"],
            "cash": b["cash"],
            "expenses": _money(expenses),
            "sales_growth_pct": 8.7,
            "expense_growth_pct": 3.1,
            "stock_turnover": 5.4,
            "coverage_days": 37,
        },
        "revenue_history": _growth_series(890000, 12, 0.022),
        "alerts": [
            {"severity": "warning", "title": "Estoque acima do ideal", "message": "18 itens têm cobertura superior a 90 dias."},
            {"severity": "success", "title": "Meta comercial", "message": "Equipe está em 103,4% da meta consolidada."},
            {"severity": "info", "title": "Oportunidade de compra", "message": "23 itens têm risco de ruptura em até 12 dias."},
        ],
    }


@app.get(f"{API_PREFIX}/sales/overview")
def sales_overview(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    f = 1.0 if SQL_BRIDGE.data_source == "sqlserver" else _factor(period)
    total = b["sales"] * f
    return {
        "period": period,
        "total_sales": _money(total),
        "orders": int(6320 * f),
        "avg_ticket": 176.81,
        "customers": int(4280 * f),
        "return_rate_pct": 1.7,
        "discount_pct": 2.9,
        "channels": [
            {"name": "Loja física", "value": _money(total * .71)},
            {"name": "E-commerce", "value": _money(total * .17)},
            {"name": "Televendas", "value": _money(total * .08)},
            {"name": "Marketplace", "value": _money(total * .04)},
        ],
        "history": _growth_series(770000, 12, 0.021),
    }


@app.get(f"{API_PREFIX}/sales/daily")
def sales_daily(period: str = "30d", granularity: str = "month", reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    sql_rows = _sql_rows("sales_daily")
    if sql_rows:
        rows = []
        for x in sql_rows:
            try:
                sales = float(x.get("sales", 0) or 0)
                target = float(x.get("target", 0) or 0)
                orders = int(x.get("orders", 0) or 0)
                avg_ticket = float(x.get("avg_ticket", 0) or (sales / orders if orders else 0))
                rows.append({"date": str(x.get("date", "")), "sales": _money(sales), "target": _money(target), "orders": orders, "avg_ticket": _money(avg_ticket), "achievement_pct": round(sales / target * 100, 1) if target else 0.0})
            except Exception:
                continue
        rows.sort(key=lambda r: str(r.get("date", "")))
        if rows:
            return {"period": period, "granularity": granularity, "reference": reference, "today": rows[-1], "items": rows, "average_daily_sales": _money(sum(float(r["sales"]) for r in rows)/len(rows)), "source": "sqlserver"}
    start = date.today() - timedelta(days=13)
    values = [36500,42100,39800,47500,51200,33800,29600,45500,48900,52700,50100,44800,56300,61250]
    rows = []
    for i, value in enumerate(values):
        d = start + timedelta(days=i)
        target = 50000 if d.weekday() < 5 else 35000
        orders = max(1, round(value / 176.5))
        rows.append({
            "date": d.strftime("%d/%m/%Y"), "sales": float(value), "target": float(target),
            "orders": orders, "avg_ticket": _money(value / orders),
            "achievement_pct": round(value / target * 100, 1),
        })
    return {"period": period, "granularity": granularity, "reference": reference, "today": rows[-1], "items": rows, "average_daily_sales": _money(sum(values)/len(values))}




def _projection_period(revenue: float, costs: float, months: int) -> dict[str, float]:
    r = _money(revenue * months)
    c = _money(costs * months)
    result = _money(r - c)
    return {"revenue": r, "expenses": c, "result": result, "margin_pct": round((result / r) * 100, 1) if r else 0.0}

def _project_months(base_revenue: float, base_costs: float, sales_factor: float = 1.0, cost_efficiency: float = 1.0, months: int = 12) -> list[dict[str, Any]]:
    today = date.today().replace(day=1)
    fixed_share = 0.38
    variable_share = 1 - fixed_share
    rows = []
    for i in range(months):
        d = (today + timedelta(days=32 * i)).replace(day=1)
        trend = (1.017 ** (i + 1))
        seasonality = 1.0
        if d.month in (11, 12): seasonality = 1.065
        elif d.month in (2, 3): seasonality = 0.965
        elif d.month in (5, 6): seasonality = 1.018
        revenue = base_revenue * trend * seasonality * sales_factor
        fixed = base_costs * fixed_share * (1.005 ** (i + 1))
        variable = base_costs * variable_share * trend * seasonality * sales_factor * cost_efficiency
        costs = fixed + variable
        rows.append({"month": d.strftime("%Y-%m"), "label": d.strftime("%m/%Y"), "revenue": _money(revenue), "expenses": _money(costs), "result": _money(revenue-costs), "margin_pct": round((revenue-costs)/revenue*100,1)})
    return rows

def _period_from_rows(rows: list[dict[str, Any]], n: int) -> dict[str, float]:
    selected = rows[:n]
    revenue = sum(x["revenue"] for x in selected)
    expenses = sum(x["expenses"] for x in selected)
    result = revenue-expenses
    return {"revenue": _money(revenue), "expenses": _money(expenses), "result": _money(result), "margin_pct": round(result/revenue*100,1) if revenue else 0.0}

def _scenario_projection(key: str, label: str, sales_factor: float, cost_efficiency: float, sales_growth_pct: float, base_revenue: float, base_sales: float, base_costs: float) -> dict[str, Any]:
    rows = _project_months(base_revenue, base_costs, sales_factor, cost_efficiency, 12)
    month = _period_from_rows(rows, 1)
    quarter = _period_from_rows(rows, 3)
    semester = _period_from_rows(rows, 6)
    year = _period_from_rows(rows, 12)
    monthly_sales = base_sales * 1.017 * sales_factor
    weekly_sales = monthly_sales / 30.4 * 7
    annual_sales = sum(base_sales * (1.017 ** (i+1)) * sales_factor * (1.06 if (date.today().month+i-1)%12+1 in (11,12) else 1.0) for i in range(12))
    target_month = base_sales * 1.045
    target_year = target_month * 12 * 1.03
    return {
        "key": key, "label": label, "sales_growth_pct": sales_growth_pct,
        "sales": {
            "week": {"projected": _money(weekly_sales), "target": _money(target_month/30.4*7), "confidence_pct": 84.0 if key=="base" else 72.0},
            "month": {"projected": _money(monthly_sales), "target": _money(target_month), "confidence_pct": 88.0 if key=="base" else 76.0},
            "year": {"projected": _money(annual_sales), "target": _money(target_year), "confidence_pct": 78.0 if key=="base" else 68.0},
        },
        "periods": {"month": month, "quarter": quarter, "semester": semester, "year": year},
    }

@app.get(f"{API_PREFIX}/projections/overview")
def projections_overview(period: str = "30d", granularity: str = "month", reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    base_revenue = b["revenue"]
    base_sales = b["sales"]
    operating_costs = b["purchases"] + b["expenses"]
    current_result = base_revenue - operating_costs
    avg_daily_sales = base_sales / 30.4
    scenarios = [
        _scenario_projection("conservative", "Conservador", .92, 1.015, -8.0, base_revenue, base_sales, operating_costs),
        _scenario_projection("base", "Realista", 1.00, 1.000, 8.7, base_revenue, base_sales, operating_costs),
        _scenario_projection("optimistic", "Otimista", 1.10, .985, 18.5, base_revenue, base_sales, operating_costs),
    ]
    base = next(x for x in scenarios if x["key"] == "base")
    actuals = [
        {"label":"Mar", "actual": 986000, "projected": 0},
        {"label":"Abr", "actual": 1048000, "projected": 0},
        {"label":"Mai", "actual": 1095000, "projected": 0},
        {"label":"Jun", "actual": 1127000, "projected": 0},
        {"label":"Jul", "actual": 1164000, "projected": 0},
    ]
    future = [{"label": r["label"][:2], "actual": 0, "projected": r["revenue"]} for r in _project_months(base_revenue, operating_costs, 1.0, 1.0, 6)]
    cash = b["cash"]
    cash_rows=[]
    for r in _project_months(base_revenue, operating_costs, 1.0, 1.0, 6):
        inflows = r["revenue"] * .955
        outflows = r["expenses"] * .985
        net = inflows-outflows
        cash += net
        cash_rows.append({"label":r["label"],"inflows":_money(inflows),"outflows":_money(outflows),"net":_money(net),"ending_cash":_money(cash)})
    mix_values = [
        ("Compras / CMV", b["purchases"]),
        ("Despesas operacionais", b["expenses"] * .62),
        ("Comercial e marketing", b["expenses"] * .16),
        ("Administrativas", b["expenses"] * .14),
        ("Financeiras e outras", b["expenses"] * .08),
    ]
    total_mix=sum(v for _,v in mix_values)
    expense_mix=[{"label":k,"value":_money(v),"share_pct":round(v/total_mix*100,1)} for k,v in mix_values]
    break_even = operating_costs / .735
    return {
        "period": period, "granularity": granularity, "reference": reference,
        "methodology": "Run-rate móvel de 30 dias + tendência + sazonalidade + estrutura fixa/variável de custos",
        "current": {
            "revenue_30d": _money(base_revenue), "sales_30d": _money(base_sales), "operating_costs_30d": _money(operating_costs),
            "result_30d": _money(current_result), "margin_pct": round(current_result/base_revenue*100,1),
            "avg_daily_sales": _money(avg_daily_sales), "cost_ratio_pct": round(operating_costs/base_revenue*100,1),
        },
        "scenarios": scenarios,
        "sales_trend": actuals + future,
        "cash_projection": cash_rows,
        "expense_mix": expense_mix,
        "health": {
            "estimated_monthly_growth_pct": 1.7, "estimated_annual_growth_pct": 22.4,
            "break_even_revenue": _money(break_even), "decline_risk": "Baixo",
            "projected_ending_cash": cash_rows[-1]["ending_cash"],
        },
        "assumptions": [
            {"label":"Base histórica","value":"Últimos 30 dias","detail":"Receita, vendas, compras e despesas consolidadas."},
            {"label":"Tendência mensal","value":"+1,7%","detail":"Aplicada progressivamente à receita e à parcela variável dos custos."},
            {"label":"Sazonalidade","value":"Mensal","detail":"Ajustes positivos em novembro/dezembro e conservadores em fevereiro/março."},
            {"label":"Custos fixos","value":"38% da estrutura","detail":"Reajuste estimado de 0,5% ao mês."},
            {"label":"Custos variáveis","value":"62% da estrutura","detail":"Acompanham o volume projetado de receita."},
            {"label":"Conversão em caixa","value":"95,5%","detail":"Estimativa de recebimento efetivo sobre a receita projetada."},
        ],
        "insights": [
            {"severity":"success","title":"Crescimento sustentável no cenário realista","message":f"A projeção anual indica receita de R$ {base['periods']['year']['revenue']:,.2f} com margem estimada de {base['periods']['year']['margin_pct']}%."},
            {"severity":"info","title":"Semana como sensor de tendência","message":"Compare a projeção semanal com a meta para antecipar desvios antes do fechamento mensal."},
            {"severity":"warning","title":"Controle de custos é decisivo","message":"Compras/CMV concentram a maior parcela das saídas; pequenos ganhos de negociação afetam fortemente o resultado anual."},
            {"severity":"success","title":"Caixa projetado positivo","message":"Mantidas as premissas atuais, o saldo acumulado permanece positivo ao longo do horizonte de seis meses."},
        ],
    }


@app.get(f"{API_PREFIX}/sales/products")
def sales_products(
    ranking: Literal["top", "bottom"] = "top",
    seller_id: Optional[str] = None,
    limit: int = Query(8, ge=1, le=100),
    authorization: Optional[str] = Header(None),
):
    _require_token(authorization)
    sql_products = _sql_rows("products")
    if sql_products:
        rows = []
        for x in sql_products:
            if seller_id and x.get("seller_id") not in (None, "", seller_id):
                continue
            try:
                qty = float(x.get("quantity", 0) or 0)
                revenue = float(x.get("revenue", 0) or 0)
                cost = float(x.get("cost", 0) or 0)
                margin = ((revenue-cost)/revenue*100) if revenue else 0.0
                rows.append({"product_id": str(x.get("product_id", "")), "product": str(x.get("product", x.get("name", "Produto"))), "quantity": qty, "revenue": _money(revenue), "cost": _money(cost), "margin_pct": round(margin,1)})
            except Exception:
                continue
        rows.sort(key=lambda x: x["quantity"], reverse=(ranking == "top"))
        return {"ranking": ranking, "seller_id": seller_id, "items": rows[:limit], "source": "sqlserver"}
    seller_multiplier = 1.0
    if seller_id:
        idx = next((i for i, s in enumerate(SELLERS) if s["id"] == seller_id), 0)
        seller_multiplier = 0.15 + idx * 0.017
    rows = []
    for code, name, qty, price, cost in PRODUCTS:
        q = max(1, int(qty * seller_multiplier)) if seller_id else qty
        rows.append({
            "product_id": code,
            "product": name,
            "quantity": q,
            "revenue": _money(q * price),
            "cost": _money(q * cost),
            "margin_pct": round(((price - cost) / price) * 100, 1),
        })
    rows.sort(key=lambda x: x["quantity"], reverse=(ranking == "top"))
    return {"ranking": ranking, "seller_id": seller_id, "items": rows[:limit]}


@app.get(f"{API_PREFIX}/sales-team/performance")
def sales_team_performance(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    sql_sellers = _sql_rows("sellers")
    source_rows = sql_sellers if sql_sellers else SELLERS
    rows = []
    for raw in source_rows:
        s = {"id": raw.get("seller_id", raw.get("id", "")), "name": raw.get("name", "Vendedor"), "target": float(raw.get("target", 0) or 0), "actual": float(raw.get("actual", 0) or 0)}
        pct = s["actual"] / s["target"] * 100 if s["target"] else 0.0
        rows.append({
            **s,
            "remaining": _money(max(0, s["target"] - s["actual"])),
            "achievement_pct": round(pct, 1),
            "forecast": _money(s["actual"] * 1.08),
            "avg_ticket": _money(146 + (int(str(s["id"])[-1]) if str(s["id"])[-1:].isdigit() else 1) * 9.7),
            "conversion_pct": round(27.4 + (int(str(s["id"])[-1]) if str(s["id"])[-1:].isdigit() else 1) * 1.8, 1),
        })
    return {
        "team_target": _money(sum(x["target"] for x in rows)),
        "team_actual": _money(sum(x["actual"] for x in rows)),
        "sellers": rows,
        "source": "sqlserver" if sql_sellers else "demo",
    }


@app.get(f"{API_PREFIX}/purchases/overview")
def purchases_overview(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    f = 1.0 if SQL_BRIDGE.data_source == "sqlserver" else _factor(period)
    return {
        "total_purchases": _money(b["purchases"] * f),
        "orders": int(428 * f),
        "avg_lead_time_days": 5.8,
        "saving_opportunity": _money(42750 * f),
        "price_variation_pct": 2.6,
        "history": _growth_series(450000, 12, 0.012),
    }


@app.get(f"{API_PREFIX}/inventory/overview")
def inventory_overview(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    inv = _sql_rows("inventory")
    if inv:
        total = sum(float(x.get("cost_value", 0) or 0) for x in inv)
        coverages = []
        stockout = overstock = 0
        dead = 0.0
        for x in inv:
            stock = float(x.get("stock", 0) or 0); daily = float(x.get("avg_daily_sales", 0) or 0)
            cov = stock/daily if daily > 0 else (999 if stock > 0 else 0)
            coverages.append(min(cov, 365))
            if 0 < cov < 12: stockout += 1
            if cov > 90: overstock += 1
            if daily <= 0 and stock > 0: dead += float(x.get("cost_value", 0) or 0)
        return {"inventory_value": _money(total or b["inventory"]), "sku_count": len(inv), "turnover": 0.0, "coverage_days": round(sum(coverages)/len(coverages),1) if coverages else 0, "stockout_risk_items": stockout, "overstock_items": overstock, "dead_stock_value": _money(dead), "loss_pct": 0.0, "abc": [], "source": "sqlserver"}
    return {
        "inventory_value": b["inventory"],
        "sku_count": 4862,
        "turnover": 5.4,
        "coverage_days": 37,
        "stockout_risk_items": 23,
        "overstock_items": 18,
        "dead_stock_value": 48620.0,
        "loss_pct": 0.74,
        "abc": [
            {"class": "A", "sku_pct": 18, "revenue_pct": 72},
            {"class": "B", "sku_pct": 29, "revenue_pct": 20},
            {"class": "C", "sku_pct": 53, "revenue_pct": 8},
        ],
    }


@app.get(f"{API_PREFIX}/inventory/purchase-suggestions")
def purchase_suggestions(kind: Literal["buy", "do-not-buy"] = "buy", authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    inv = _sql_rows("inventory")
    if inv:
        derived = []
        for x in inv:
            try:
                stock=float(x.get("stock",0) or 0); daily=float(x.get("avg_daily_sales",0) or 0); min_stock=float(x.get("min_stock",0) or 0); max_stock=float(x.get("max_stock",0) or 0)
                coverage=stock/daily if daily>0 else (999 if stock>0 else 0)
                if kind=="buy" and ((daily>0 and coverage<12) or (min_stock>0 and stock<min_stock)):
                    suggested=max(0, (max_stock if max_stock>0 else daily*30)-stock)
                    derived.append({"product":x.get("product",x.get("product_id","Produto")),"stock":stock,"avg_daily_sales":daily,"coverage_days":round(coverage,1),"suggested_qty":round(suggested,3),"reason":"Cobertura abaixo do mínimo"})
                elif kind=="do-not-buy" and (coverage>90 or (max_stock>0 and stock>max_stock)):
                    derived.append({"product":x.get("product",x.get("product_id","Produto")),"stock":stock,"avg_daily_sales":daily,"coverage_days":round(coverage,1),"suggested_qty":0,"reason":"Estoque acima do máximo / giro baixo"})
            except Exception:
                continue
        derived.sort(key=lambda x:x["coverage_days"], reverse=(kind=="do-not-buy"))
        return {"kind":kind,"items":derived[:100],"source":"sqlserver"}
    if kind == "buy":
        items = [
            {"product": "Arroz Premium 5kg", "stock": 210, "avg_daily_sales": 72, "coverage_days": 2.9, "suggested_qty": 1800, "reason": "Ruptura iminente"},
            {"product": "Óleo de Soja 900ml", "stock": 360, "avg_daily_sales": 61, "coverage_days": 5.9, "suggested_qty": 1200, "reason": "Cobertura abaixo do mínimo"},
            {"product": "Café Tradicional 500g", "stock": 290, "avg_daily_sales": 44, "coverage_days": 6.6, "suggested_qty": 900, "reason": "Demanda crescente"},
            {"product": "Leite Integral 1L", "stock": 410, "avg_daily_sales": 52, "coverage_days": 7.9, "suggested_qty": 1000, "reason": "Lead time elevado"},
        ]
    else:
        items = [
            {"product": "Granola Zero 250g", "stock": 870, "avg_daily_sales": 9, "coverage_days": 96.7, "suggested_qty": 0, "reason": "Excesso de cobertura"},
            {"product": "Tempero Gourmet 60g", "stock": 610, "avg_daily_sales": 8, "coverage_days": 76.3, "suggested_qty": 0, "reason": "Giro baixo"},
            {"product": "Chá Premium 20un", "stock": 780, "avg_daily_sales": 12, "coverage_days": 65.0, "suggested_qty": 0, "reason": "Estoque acima do máximo"},
        ]
    return {"kind": kind, "items": items}


@app.get(f"{API_PREFIX}/finance/obligations")
def finance_obligations(period: str = "30d", granularity: str = "month", reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    sql_pay = _sql_rows("accounts_payable")
    sql_rec = _sql_rows("accounts_receivable")
    if sql_pay or sql_rec:
        today = date.today()
        def normalize(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
            out=[]
            for x in rows:
                remaining=_remaining_value(x)
                if remaining <= 0:
                    continue
                due=_parse_sql_date(x.get("due_date"))
                status_raw=str(x.get("status","") or "").lower()
                if due and due < today: status="Vencido"
                elif due == today: status="Hoje"
                else: status="A vencer"
                if any(k in status_raw for k in ("pago","quitado","baixado","liquidado")):
                    continue
                out.append({"due_date": due.strftime("%d/%m/%Y") if due else str(x.get("due_date", "")), "counterparty": str(x.get("counterparty", "")), "description": str(x.get("description", "")), "value": _money(remaining), "status": status})
            out.sort(key=lambda r: datetime.strptime(r["due_date"], "%d/%m/%Y") if r["due_date"] and "/" in r["due_date"] else datetime.max)
            return out
        payables=normalize(sql_pay); receivables=normalize(sql_rec)
        p_today=[x for x in payables if x["status"]=="Hoje"]; r_today=[x for x in receivables if x["status"]=="Hoje"]
        p_over=[x for x in payables if x["status"]=="Vencido"]; r_over=[x for x in receivables if x["status"]=="Vencido"]
        debtors=len({x["counterparty"] for x in r_over if x["counterparty"]})
        return {"period":period,"granularity":granularity,"reference":reference,"summary":{
            "payables_total":_money(sum(x["value"] for x in payables)),"receivables_total":_money(sum(x["value"] for x in receivables)),
            "payables_today":_money(sum(x["value"] for x in p_today)),"payables_today_count":len(p_today),
            "receivables_today":_money(sum(x["value"] for x in r_today)),"receivables_today_count":len(r_today),
            "overdue_payables":_money(sum(x["value"] for x in p_over)),"overdue_receivables":_money(sum(x["value"] for x in r_over)),
            "overdue_customers":debtors,"net_working_position":_money(sum(x["value"] for x in receivables)-sum(x["value"] for x in payables))},
            "payables":payables[:500],"receivables":receivables[:500],"source":"sqlserver"}
    return {
        "period": period, "granularity": granularity, "reference": reference,
        "summary": {
            "payables_total": 271900.0, "receivables_total": 389700.0,
            "payables_today": 48750.0, "payables_today_count": 7,
            "receivables_today": 62100.0, "receivables_today_count": 11,
            "overdue_payables": 18300.0, "overdue_receivables": 84300.0,
            "overdue_customers": 12, "net_working_position": 117800.0,
        },
        "payables": [
            {"due_date":"04/08/2026","counterparty":"Distribuidora Norte","description":"NF 98231","value":22500.0,"status":"Hoje"},
            {"due_date":"04/08/2026","counterparty":"Energia Regional","description":"Energia elétrica","value":8900.0,"status":"Hoje"},
            {"due_date":"02/08/2026","counterparty":"Atacado Brasil","description":"NF 77401","value":18300.0,"status":"Vencido"},
            {"due_date":"06/08/2026","counterparty":"Central Alimentos","description":"NF 55618","value":31800.0,"status":"A vencer"},
        ],
        "receivables": [
            {"due_date":"04/08/2026","counterparty":"Mercado União","description":"Duplicata 18291","value":18400.0,"status":"Hoje"},
            {"due_date":"04/08/2026","counterparty":"Comercial Tocantins","description":"Duplicata 18322","value":24300.0,"status":"Hoje"},
            {"due_date":"25/07/2026","counterparty":"Varejão Popular","description":"Duplicata 17652","value":28600.0,"status":"Vencido"},
            {"due_date":"18/07/2026","counterparty":"Comercial Araguaia","description":"Duplicata 17208","value":24100.0,"status":"Vencido"},
        ],
    }

@app.get(f"{API_PREFIX}/finance/debtors")
def finance_debtors(period: str = "30d", granularity: str = "month", reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    sql_rec = _sql_rows("accounts_receivable")
    if sql_rec:
        today=date.today(); grouped: dict[str,dict[str,Any]]={}
        for x in sql_rec:
            due=_parse_sql_date(x.get("due_date")); remaining=_remaining_value(x)
            if not due or due >= today or remaining <= 0:
                continue
            name=str(x.get("counterparty", "Cliente não identificado"))
            g=grouped.setdefault(name,{"customer":name,"amount":0.0,"days_overdue":0,"open_titles":0,"last_contact":"-"})
            g["amount"] += remaining; g["open_titles"] += 1; g["days_overdue"] = max(g["days_overdue"], (today-due).days)
        items=[]
        for g in grouped.values():
            days=g["days_overdue"]; risk="Alto" if days>=21 else "Médio" if days>=8 else "Baixo"
            action="Bloquear novo crédito e negociar regularização" if risk=="Alto" else "Contato de cobrança e confirmação de pagamento" if risk=="Médio" else "Lembrete de vencimento e retorno em 48h"
            items.append({**g,"amount":_money(g["amount"]),"risk":risk,"recommended_action":action})
        items.sort(key=lambda x:(x["days_overdue"],x["amount"]), reverse=True)
        return {"total_overdue":_money(sum(x["amount"] for x in items)),"customers":len(items),"items":items,"source":"sqlserver"}
    return {
        "total_overdue": 84300.0, "customers": 12,
        "items": [
            {"customer":"Varejão Popular","amount":28600.0,"days_overdue":10,"open_titles":2,"last_contact":"03/08/2026","risk":"Médio","recommended_action":"Contato comercial + proposta de regularização"},
            {"customer":"Comercial Araguaia","amount":24100.0,"days_overdue":17,"open_titles":3,"last_contact":"01/08/2026","risk":"Alto","recommended_action":"Bloquear novo crédito e negociar parcelamento"},
            {"customer":"Mercado Bom Preço","amount":13750.0,"days_overdue":28,"open_titles":1,"last_contact":"30/07/2026","risk":"Alto","recommended_action":"Escalonar cobrança e revisar limite"},
            {"customer":"Empório Avenida","amount":9820.0,"days_overdue":7,"open_titles":2,"last_contact":"04/08/2026","risk":"Baixo","recommended_action":"Lembrete de vencimento e retorno em 48h"},
            {"customer":"Casa do Varejo","amount":8030.0,"days_overdue":13,"open_titles":1,"last_contact":"02/08/2026","risk":"Médio","recommended_action":"Contato financeiro e confirmação de pagamento"},
        ]
    }


@app.get(f"{API_PREFIX}/finance/dre")
def dre(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    f = 1.0 if SQL_BRIDGE.data_source == "sqlserver" else _factor(period)
    gross = b["revenue"] * f
    deductions = gross * .072
    net_revenue = gross - deductions
    cogs = net_revenue * .604
    gross_profit = net_revenue - cogs
    operating = gross_profit * .493
    ebitda = gross_profit - operating
    depreciation = ebitda * .064
    ebit = ebitda - depreciation
    financial = ebit * .082
    taxes = (ebit - financial) * .138
    net = ebit - financial - taxes
    return {
        "period": period,
        "lines": [
            {"code": "01", "label": "Receita Bruta", "value": _money(gross), "level": 0},
            {"code": "02", "label": "(-) Deduções e impostos sobre vendas", "value": _money(-deductions), "level": 1},
            {"code": "03", "label": "Receita Líquida", "value": _money(net_revenue), "level": 0},
            {"code": "04", "label": "(-) CMV/CPV", "value": _money(-cogs), "level": 1},
            {"code": "05", "label": "Lucro Bruto", "value": _money(gross_profit), "level": 0},
            {"code": "06", "label": "(-) Despesas Operacionais", "value": _money(-operating), "level": 1},
            {"code": "07", "label": "EBITDA", "value": _money(ebitda), "level": 0},
            {"code": "08", "label": "(-) Depreciação/Amortização", "value": _money(-depreciation), "level": 1},
            {"code": "09", "label": "EBIT", "value": _money(ebit), "level": 0},
            {"code": "10", "label": "Resultado Financeiro", "value": _money(-financial), "level": 1},
            {"code": "11", "label": "IR/CSLL estimados", "value": _money(-taxes), "level": 1},
            {"code": "12", "label": "Lucro Líquido", "value": _money(net), "level": 0},
        ],
        "margins": {"gross_pct": round(gross_profit / net_revenue * 100, 1), "ebitda_pct": round(ebitda / net_revenue * 100, 1), "net_pct": round(net / net_revenue * 100, 1)},
    }


@app.get(f"{API_PREFIX}/finance/dmpl")
def dmpl(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    return {
        "columns": ["Capital Social", "Reservas", "Lucros Acumulados", "Patrimônio Líquido"],
        "rows": [
            {"event": "Saldo inicial", "values": [500000, 82500, 164300, 746800]},
            {"event": "Lucro do período", "values": [0, 0, 145430, 145430]},
            {"event": "Dividendos distribuídos", "values": [0, 0, -58000, -58000]},
            {"event": "Reserva legal", "values": [0, 7272, -7272, 0]},
            {"event": "Saldo final", "values": [500000, 89772, 244458, 834230]},
        ],
    }


@app.get(f"{API_PREFIX}/finance/balance-sheet")
def balance_sheet(period: str = "30d", granularity: Optional[str] = None, reference: Optional[str] = None, authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    b = _effective_base(period, granularity, reference)
    current_assets = b["cash"] + b["receivables"] + b["inventory"]
    fixed_assets = 685300.0
    total_assets = current_assets + fixed_assets
    current_liab = b["payables"] + 218400.0
    long_liab = 794270.0
    equity = total_assets - current_liab - long_liab
    return {
        "assets": [
            {"label": "Caixa e equivalentes", "value": b["cash"]},
            {"label": "Contas a receber", "value": b["receivables"]},
            {"label": "Estoques", "value": b["inventory"]},
            {"label": "Imobilizado e outros", "value": fixed_assets},
        ],
        "liabilities": [
            {"label": "Fornecedores", "value": b["payables"]},
            {"label": "Obrigações de curto prazo", "value": 218400.0},
            {"label": "Passivos de longo prazo", "value": long_liab},
        ],
        "equity": [{"label": "Patrimônio líquido", "value": _money(equity)}],
        "totals": {"assets": _money(total_assets), "liabilities_equity": _money(total_assets)},
    }


@app.get(f"{API_PREFIX}/finance/cash-forecast")
def cash_forecast(months: int = Query(12, ge=3, le=36), authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    rows = []
    cash = _effective_base()["cash"]
    start = date.today().replace(day=1)
    for i in range(months):
        d = start + timedelta(days=31 * i)
        rev = 1170000 * ((1.012) ** i) * (1.09 if d.month in (11, 12) else 1)
        exp = 875000 * ((1.008) ** i) * (1.04 if d.month in (11, 12) else 1)
        net = rev - exp
        cash += net
        rows.append({
            "month": d.strftime("%Y-%m"),
            "inflows": _money(rev),
            "outflows": _money(exp),
            "net": _money(net),
            "ending_cash": _money(cash),
            "scenario": "base",
        })
    return {
        "assumptions": {"revenue_monthly_growth_pct": 1.2, "expense_monthly_growth_pct": 0.8, "seasonality_applied": True},
        "months": rows,
        "guidance": [
            "Definir limite mínimo de caixa operacional e gatilho de contingência.",
            "Revisar despesas variáveis por centro de custo mensalmente.",
            "Separar orçamento, realizado e forecast para evitar decisões por saldo bancário.",
            "Acompanhar capital de giro, prazo médio de recebimento e prazo médio de pagamento em conjunto.",
        ],
    }


@app.get(f"{API_PREFIX}/cost-centers")
def cost_centers(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    rows = []
    for c in COST_CENTERS:
        actual = c["fixed"] + c["variable"]
        rows.append({**c, "actual": _money(actual), "variance": _money(c["budget"] - actual), "usage_pct": round(actual / c["budget"] * 100, 1)})
    return {"items": rows, "total": _money(sum(x["actual"] for x in rows))}


@app.get(f"{API_PREFIX}/suppliers/ranking")
def suppliers_ranking(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    sql_suppliers = _sql_rows("suppliers")
    source_suppliers = sql_suppliers if sql_suppliers else SUPPLIERS
    rows = []
    for raw in source_suppliers:
        s = {
            "id": raw.get("supplier_id", raw.get("id", "")), "name": raw.get("name", "Fornecedor"),
            "price_index": float(raw.get("price_index", 0) or 0), "delivery": float(raw.get("delivery", 0) or 0),
            "quality": float(raw.get("quality", 0) or 0), "terms": float(raw.get("terms", 0) or 0), "spend": float(raw.get("spend", 0) or 0)
        }
        score = s["price_index"] * .38 + s["delivery"] * .24 + s["quality"] * .24 + s["terms"] * .14
        rows.append({**s, "score": round(score, 1), "classification": "A" if score >= 93 else "B" if score >= 88 else "C"})
    rows.sort(key=lambda x: x["score"], reverse=True)
    return {"method": "Preço 38% + Entrega 24% + Qualidade 24% + Condições 14%", "items": rows, "source": "sqlserver" if sql_suppliers else "demo"}


@app.get(f"{API_PREFIX}/market/opportunities")
def market_opportunities(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    return {
        "methodology": "Score demonstrativo: potencial 35%, crescimento 25%, competição 20%, aderência logística 20%.",
        "items": REGIONS,
        "note": "Para produção, conectar fontes públicas/licenciadas (IBGE, Receita, dados setoriais e dados internos) e registrar data/fonte de cada indicador.",
    }


@app.get(f"{API_PREFIX}/analytics/cross")
def analytics_cross(
    dimension: Literal["seller", "product", "supplier", "cost_center"] = "seller",
    metric: Literal["revenue", "margin", "growth", "cost"] = "revenue",
    authorization: Optional[str] = Header(None),
):
    _require_token(authorization)
    if dimension == "seller":
        rows = [{"dimension": s["name"], "value": s["actual"], "secondary": round(s["actual"] / s["target"] * 100, 1)} for s in SELLERS]
    elif dimension == "product":
        rows = [{"dimension": p[1], "value": p[2] * p[3], "secondary": round((p[3]-p[4])/p[3]*100, 1)} for p in PRODUCTS[:8]]
    elif dimension == "supplier":
        rows = [{"dimension": s["name"], "value": s["spend"], "secondary": s["price_index"]} for s in SUPPLIERS]
    else:
        rows = [{"dimension": c["name"], "value": c["fixed"] + c["variable"], "secondary": round((c["fixed"] + c["variable"]) / c["budget"] * 100, 1)} for c in COST_CENTERS]
    return {"dimension": dimension, "metric": metric, "rows": rows}


@app.get(f"{API_PREFIX}/sql/status")
def sql_status(authorization: Optional[str] = Header(None)):
    _require_token(authorization, check_license=False)
    return SQL_BRIDGE.status()


@app.post(f"{API_PREFIX}/sql/test")
def sql_test(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    try:
        return SQL_BRIDGE.test_connection()
    except SQLBridgeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post(f"{API_PREFIX}/sql/sync")
def sql_sync(payload: SQLSyncRequest, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    try:
        return SQL_BRIDGE.sync(payload.entities or None)
    except SQLBridgeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.get(f"{API_PREFIX}/sql/preview/{{entity}}")
def sql_preview(entity: str, limit: int = Query(20, ge=1, le=100), authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    try:
        return SQL_BRIDGE.preview(entity, limit=limit)
    except SQLBridgeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get(f"{API_PREFIX}/sql/snapshot/{{entity}}")
def sql_snapshot(entity: str, limit: int = Query(100, ge=1, le=5000), authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    rows = SQL_BRIDGE.entity_rows(entity)[:limit]
    return {"entity": entity, "count": len(rows), "rows": rows, "source": "sqlserver-snapshot"}


@app.post(f"{API_PREFIX}/integration/batches")
def integration_batch(payload: SyncBatch, authorization: Optional[str] = Header(None), x_idempotency_key: Optional[str] = Header(None)):
    _require_token(authorization)
    if x_idempotency_key and x_idempotency_key != payload.idempotency_key:
        raise HTTPException(status_code=400, detail="Header and body idempotency keys differ")
    accepted = len(payload.items)
    return {
        "batch_id": f"batch-{int(datetime.now().timestamp())}",
        "status": "accepted",
        "accepted": accepted,
        "rejected": 0,
        "idempotency_key": payload.idempotency_key,
        "received_at": datetime.now().isoformat(),
    }


@app.get(f"{API_PREFIX}/integration/last-sync")
def last_sync(authorization: Optional[str] = Header(None)):
    _require_token(authorization)
    if SQL_BRIDGE.data_source == "sqlserver":
        snap = SQL_BRIDGE.load_snapshot()
        last = snap.get("last_sync_at")
        total = sum(int(v.get("count", 0) or 0) for v in snap.get("entities", {}).values() if isinstance(v, dict))
        lag = 0
        if last:
            try:
                lag = max(0, int((datetime.now() - datetime.fromisoformat(last)).total_seconds()))
            except Exception:
                lag = 0
        return {"source_system": "sqlserver", "last_success_at": last, "records_processed": total, "status": "healthy" if last else "attention", "lag_seconds": lag}
    return {
        "source_system": "delphi-erp",
        "last_success_at": (datetime.now() - timedelta(minutes=8)).isoformat(),
        "records_processed": 18342,
        "status": "healthy",
        "lag_seconds": 14,
    }


frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.isdir(frontend_dir):
    app.mount("/assets", StaticFiles(directory=frontend_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def root():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
