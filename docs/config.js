/* REN-BI 360 v3.2.15 - portal multiempresa com Central */
window.RENBI_PUBLIC_API_BASE = "";
window.RENBI_TENANT_REGISTRY = "./tenants.json";
window.RENBI_API_BASE = "";

/*
 * Registro central de clientes.
 * O portal consulta primeiro a Central; tenants.json fica como contingencia.
 */
window.RENBI_CENTRAL_REGISTRY = "https://gestao.renbibase.com/api/portal/tenant";
