const API_BASE = (window.RENBI_API_BASE || '').replace(/\/$/, '');
const API = API_BASE ? `${API_BASE}/api/v1` : '';
const DEMO_MAP = window.RENBI_DEMO_MAP || {};
const content = document.getElementById('content');
const title = document.getElementById('pageTitle');
const appShell = document.getElementById('appShell');
const loginScreen = document.getElementById('loginScreen');
const blockedScreen = document.getElementById('blockedScreen');
const granularitySelect = document.getElementById('granularitySelect');
const referenceInput = document.getElementById('referenceInput');
const filterSummary = document.getElementById('filterSummary');
let currentPage = 'overview';
let currentUser = null;
let authToken = sessionStorage.getItem('renbi_token') || '';
let currentLicense = null;

// REN-BI 360 v2.2.0 - atualização automática completa a cada 60 segundos.
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshTimer = null;
let autoRefreshBusy = false;

const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(v)||0);
const num = v => new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const pct = v => `${Number(v||0).toFixed(1)}%`;
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const ROLE_PAGES = {
  superadmin:['overview','sales','projections','inventory','finance','team','suppliers','analytics','market','users','integration'],
  admin:['overview','sales','projections','inventory','finance','team','suppliers','analytics','market','users','integration'],
  manager:['overview','sales','projections','inventory','finance','team','suppliers','analytics','market','integration'],
  sales:['overview','sales','projections','team'],
  finance:['overview','projections','finance','suppliers'],
  viewer:['overview','sales','projections','inventory','finance','team','suppliers','analytics','market']
};
const roleLabels={superadmin:'Administrador SaaS',admin:'Administrador',manager:'Gestor',sales:'Comercial',finance:'Financeiro',viewer:'Consulta'};

const DEMO_USERS_KEY='renbi_demo_users_v2';
const DEMO_LICENSE_KEY='renbi_demo_license_v2';
const defaultDemoUsers=[
  {id:'U001',username:'admin',name:'Administrador RenBI',password:'RenBI@2026',role:'superadmin',active:true},
  {id:'U002',username:'gestor',name:'Gestor Demonstração',password:'Gestor@2026',role:'manager',active:true},
  {id:'U003',username:'financeiro',name:'Financeiro Demonstração',password:'Finance@2026',role:'finance',active:true}
];
const defaultLicense={status:'active',plan:'RenBI 360 Business',company:'Empresa Demonstração',due_date:'2026-08-10',grace_until:'2026-08-15',reason:'',billing_contact:'financeiro@empresa.com.br'};
function initDemoState(){if(!localStorage.getItem(DEMO_USERS_KEY))localStorage.setItem(DEMO_USERS_KEY,JSON.stringify(defaultDemoUsers));if(!localStorage.getItem(DEMO_LICENSE_KEY))localStorage.setItem(DEMO_LICENSE_KEY,JSON.stringify(defaultLicense));}
function demoUsers(){initDemoState();return JSON.parse(localStorage.getItem(DEMO_USERS_KEY)||'[]')}
function saveDemoUsers(v){localStorage.setItem(DEMO_USERS_KEY,JSON.stringify(v))}
function demoLicense(){initDemoState();return JSON.parse(localStorage.getItem(DEMO_LICENSE_KEY)||JSON.stringify(defaultLicense))}
function saveDemoLicense(v){localStorage.setItem(DEMO_LICENSE_KEY,JSON.stringify(v))}

function canonicalPath(path, remove=[]){
  const u=new URL(path,'https://renbi.local');
  remove.forEach(k=>u.searchParams.delete(k));
  const entries=[...u.searchParams.entries()].sort((a,b)=>a[0].localeCompare(b[0])||String(a[1]).localeCompare(String(b[1])));
  const qs=new URLSearchParams(entries).toString();
  return u.pathname+(qs?`?${qs}`:'');
}
const DEMO_INDEX=new Map(Object.entries(DEMO_MAP).map(([k,v])=>[canonicalPath(k),v]));
function resolveDemoFile(path){
  const candidates=[canonicalPath(path),canonicalPath(path,['granularity','reference']),canonicalPath(path,['granularity','reference','period'])];
  for(const c of candidates) if(DEMO_INDEX.has(c)) return DEMO_INDEX.get(c);
  return null;
}
async function api(path){
  try{
    let url,headers={'Accept':'application/json'};
    if(API_BASE){url=API+path;if(authToken)headers.Authorization=`Bearer ${authToken}`;}
    else{const f=resolveDemoFile(path);if(!f)throw new Error('Snapshot de demonstração não encontrado: '+path);url='./data/'+f;}
    const r=await fetch(url,{headers,cache:API_BASE?'no-store':'default'});
    if(r.status===401){logout();throw new Error('Sessão expirada');}
    if(r.status===402||r.status===423){const info=await r.json().catch(()=>({}));showBlocked(info.detail||info);throw new Error('Licença bloqueada');}
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  }catch(e){console.warn('Fonte de dados indisponível',e);return null;}
}
async function apiRequest(path,method='GET',body=null){
  if(!API_BASE) return null;
  const headers={'Accept':'application/json','Content-Type':'application/json'};if(authToken)headers.Authorization=`Bearer ${authToken}`;
  const r=await fetch(API+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail||`HTTP ${r.status}`);return data;
}

function periodKey(){return {day:'7d',month:'30d',year:'12m'}[granularitySelect.value]||'30d'}
function setReferenceInput(){
  const g=granularitySelect.value,now=new Date();
  if(g==='day'){referenceInput.type='date';if(!/^\d{4}-\d{2}-\d{2}$/.test(referenceInput.value))referenceInput.value=now.toISOString().slice(0,10);}
  else if(g==='month'){referenceInput.type='month';if(!/^\d{4}-\d{2}$/.test(referenceInput.value))referenceInput.value=now.toISOString().slice(0,7);}
  else{referenceInput.type='number';referenceInput.min='2000';referenceInput.max='2100';referenceInput.step='1';if(!/^\d{4}$/.test(referenceInput.value))referenceInput.value=String(now.getFullYear());}
  updateFilterSummary();
}
function updateFilterSummary(){const g=granularitySelect.value,v=referenceInput.value;const labels={day:'Dia',month:'Mês',year:'Ano'};filterSummary.textContent=`${labels[g]} de referência: ${v}`;}
function filteredPath(path,extra={}){
  const u=new URL(path,'https://renbi.local');
  Object.entries(extra).forEach(([k,v])=>{if(v!==undefined&&v!==null)u.searchParams.set(k,v)});
  if(!u.searchParams.has('period'))u.searchParams.set('period',periodKey());
  u.searchParams.set('granularity',granularitySelect.value);u.searchParams.set('reference',referenceInput.value);
  return u.pathname+'?'+u.searchParams.toString();
}

function kpi(label,value,sub='',cls='',extra=''){return `<div class="card kpi ${extra}"><div class="label">${label}</div><div class="value ${cls}">${value}</div><div class="sub">${sub}</div></div>`}
function section(h,p=''){return `<div class="section-title"><h2>${h}</h2><p>${p}</p></div>`}
function bars(series,compact=false){if(!series?.length)return '<div class="empty">Sem dados</div>';const max=Math.max(...series.map(x=>Math.abs(Number(x.value)||0)),1);return `<div class="chart-wrap ${compact?'compact':''}">${series.map(x=>`<div class="bar ${(Number(x.value)||0)<0?'negative':''}" style="height:${Math.max(8,Math.abs(Number(x.value)||0)/max*100)}%" data-tip="${esc(x.label||x.month||x.date||'')}: ${money(x.value)}"></div>`).join('')}</div>`}
function pill(text,type='blue'){return `<span class="pill ${type}">${text}</span>`}
function table(headers,rows,reportTitle='Relatório'){return `<div class="card table-card report-block" data-report-title="${esc(reportTitle)}"><div class="report-toolbar"><strong>${esc(reportTitle)}</strong><div class="report-toolbar-actions"><button class="mini-btn" data-report-export="xlsx">Excel</button><button class="mini-btn" data-report-export="pdf">PDF</button></div></div><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}

async function renderOverview(){
 const [d,fin]=await Promise.all([api(filteredPath('/dashboard/summary')),api(filteredPath('/finance/obligations'))]);if(!d)return offline();const k=d.kpis;
 const strip=fin?`<div class="finance-strip"><div class="finance-alert payable clickable" data-go="finance"><strong>A PAGAR HOJE</strong><div class="amount down">${money(fin.summary.payables_today)}</div><small>${fin.summary.payables_today_count} compromissos vencendo hoje</small></div><div class="finance-alert receivable clickable" data-go="finance"><strong>A RECEBER HOJE</strong><div class="amount up">${money(fin.summary.receivables_today)}</div><small>${fin.summary.receivables_today_count} recebimentos previstos</small></div><div class="finance-alert overdue clickable" data-go="finance"><strong>RECEBÍVEIS EM ATRASO</strong><div class="amount warning-text">${money(fin.summary.overdue_receivables)}</div><small>${fin.summary.overdue_customers} devedores em acompanhamento</small></div></div>`:'';
 content.innerHTML=`${strip}<div class="grid kpi-grid">${kpi('Faturamento',money(k.revenue),`Variação <span class="up">+${pct(k.sales_growth_pct)}</span>`)}${kpi('Vendas',money(k.sales),'Receita comercial líquida')}${kpi('Lucro líquido',money(k.net_profit),`Margem ${pct(k.net_margin_pct)}`,'up')}${kpi('Estoque',money(k.inventory_value),`${k.coverage_days} dias de cobertura`)}${kpi('Compras',money(k.purchases),'Aquisições no período')}${kpi('Despesas',money(k.expenses),`Variação <span class="down">+${pct(k.expense_growth_pct)}</span>`)}${kpi('Caixa disponível',money(k.cash),'Caixa e equivalentes')}${kpi('Giro de estoque',`${k.stock_turnover}x`,'Indicador anualizado')}</div>${section('Evolução do faturamento','Histórico consolidado conforme filtro')}<div class="grid two"><div class="card">${bars(d.revenue_history)}</div><div class="card"><strong>Alertas inteligentes</strong>${d.alerts.map(a=>`<div class="alert ${a.severity}"><i class="alert-icon"></i><div><strong>${a.title}</strong><p>${a.message}</p></div></div>`).join('')}${fin?`<div class="alert danger"><i class="alert-icon"></i><div><strong>Inadimplência</strong><p>${fin.summary.overdue_customers} clientes possuem títulos vencidos.</p></div></div>`:''}</div></div>`;
}

async function renderSales(){
 const [o,top,bottom,daily]=await Promise.all([api(filteredPath('/sales/overview')),api(filteredPath('/sales/products',{ranking:'top',limit:7})),api(filteredPath('/sales/products',{ranking:'bottom',limit:7})),api(filteredPath('/sales/daily'))]);if(!o)return offline();
 const today=daily?.today||{};
 content.innerHTML=`<div class="grid kpi-grid">${kpi('Vendas',money(o.total_sales),'Período selecionado')}${kpi('Pedidos',num(o.orders),'Pedidos aprovados')}${kpi('Ticket médio',money(o.avg_ticket),'Por pedido')}${kpi('Devoluções',pct(o.return_rate_pct),'Taxa sobre vendas')}${daily?kpi('Vendas de hoje',money(today.sales),`${num(today.orders)} pedidos`,'up'):''}${daily?kpi('Meta diária',money(today.target),`Atingimento ${pct(today.achievement_pct)}`,today.achievement_pct>=100?'up':'warning-text'):''}</div>${daily?`${section('Resultado diário de vendas','Acompanhamento dia a dia de realizado, meta e diferença')}<div class="grid two"><div class="card">${bars(daily.items.map(x=>({label:x.date,value:x.sales})),true)}</div>${table(['Data','Vendas','Meta','Diferença','Pedidos','Ticket'],daily.items.map(x=>`<tr><td>${x.date}</td><td class="num">${money(x.sales)}</td><td class="num">${money(x.target)}</td><td class="num ${x.sales>=x.target?'up':'down'}">${money(x.sales-x.target)}</td><td class="num">${num(x.orders)}</td><td class="num">${money(x.avg_ticket)}</td></tr>`),'Vendas diárias')}</div>`:''}${section('Tendência de vendas','Histórico consolidado')}<div class="card">${bars(o.history)}</div>${section('Ranking de produtos','Geral — quantidade e margem')}<div class="grid two">${productTable(top,'Mais vendidos')}${productTable(bottom,'Menos vendidos')}</div>${section('Canais de venda')}<div class="grid three">${o.channels.map(c=>kpi(c.name,money(c.value),'Participação no período')).join('')}</div>`;
}
function productTable(data,label){if(!data)return '<div class="card">Sem dados</div>';return `<div>${table(['Produto','Qtd.','Receita','Margem'],data.items.map(x=>`<tr><td>${x.product}</td><td class="num">${num(x.quantity)}</td><td class="num">${money(x.revenue)}</td><td class="num">${pct(x.margin_pct)}</td></tr>`),label)}</div>`}


function projectionPeriodLabel(key){return {month:'Mês',quarter:'Trimestre',semester:'Semestre',year:'Ano'}[key]||key}
function projectionHorizonLabel(key){return {week:'Semana',month:'Mês',year:'Ano'}[key]||key}
function projectionScenarioType(key){return key==='optimistic'?'green':key==='conservative'?'orange':'blue'}
function projectionDualBars(items){
 if(!items?.length)return '<div class="empty">Sem dados</div>';
 const max=Math.max(...items.flatMap(x=>[Number(x.actual)||0,Number(x.projected)||0]),1);
 return `<div class="projection-chart">${items.map(x=>`<div class="projection-col"><div class="projection-bars"><span class="projection-bar actual" style="height:${Math.max(5,(Number(x.actual)||0)/max*100)}%" title="Realizado: ${money(x.actual)}"></span><span class="projection-bar projected" style="height:${Math.max(5,(Number(x.projected)||0)/max*100)}%" title="Projetado: ${money(x.projected)}"></span></div><small>${esc(x.label)}</small></div>`).join('')}</div><div class="projection-legend"><span><i class="legend-dot actual-dot"></i>Realizado</span><span><i class="legend-dot projected-dot"></i>Projetado</span></div>`;
}
function projectionPeriodCards(periods){return ['month','quarter','semester','year'].map(key=>{const x=periods[key];return `<div class="card projection-period-card"><div class="projection-period-head"><span>${projectionPeriodLabel(key)}</span>${pill(`Margem ${pct(x.margin_pct)}`,x.result>=0?'green':'red')}</div><strong class="projection-main-value">${money(x.revenue)}</strong><small>Receita projetada</small><div class="projection-mini-grid"><div><span>Despesas + custos</span><b class="down">${money(x.expenses)}</b></div><div><span>Resultado</span><b class="${x.result>=0?'up':'down'}">${money(x.result)}</b></div></div></div>`}).join('')}
function projectionScenarioTable(scenarios){return table(['Cenário','Receita anual','Despesas + custos','Resultado anual','Margem','Crescimento vendas'],scenarios.map(x=>{const a=x.periods.year;return `<tr><td>${pill(x.label,projectionScenarioType(x.key))}</td><td class="num">${money(a.revenue)}</td><td class="num down">${money(a.expenses)}</td><td class="num ${a.result>=0?'up':'down'}"><strong>${money(a.result)}</strong></td><td class="num">${pct(a.margin_pct)}</td><td class="num ${x.sales_growth_pct>=0?'up':'down'}">${x.sales_growth_pct>=0?'+':''}${pct(x.sales_growth_pct)}</td></tr>`}),'Cenários de projeção')}
function projectionAssumptions(items){return `<div class="card"><strong>Premissas da projeção</strong><div class="assumption-list">${items.map(x=>`<div><span>${esc(x.label)}</span><b>${esc(x.value)}</b><small>${esc(x.detail||'')}</small></div>`).join('')}</div></div>`}
function projectionInsights(items){return `<div class="card"><strong>Insights e ações sugeridas</strong><div class="insight-list">${items.map(x=>`<div class="projection-insight ${esc(x.severity||'info')}"><i></i><div><b>${esc(x.title)}</b><p>${esc(x.message)}</p></div></div>`).join('')}</div></div>`}
function renderProjectionFocus(d,scenarioKey,horizonKey){
 const sc=d.scenarios.find(x=>x.key===scenarioKey)||d.scenarios.find(x=>x.key==='base')||d.scenarios[0];
 const h=sc.sales[horizonKey];
 const p=horizonKey==='week'?sc.periods.month:horizonKey==='month'?sc.periods.month:sc.periods.year;
 const gap=h.projected-h.target;
 document.getElementById('projectionFocus').innerHTML=`<div class="projection-focus-card"><div><p class="eyebrow">CENÁRIO ${esc(sc.label).toUpperCase()} • ${projectionHorizonLabel(horizonKey).toUpperCase()}</p><strong>${money(h.projected)}</strong><span>Projeção de vendas</span></div><div class="projection-focus-metrics"><div><span>Meta</span><b>${money(h.target)}</b></div><div><span>Gap</span><b class="${gap>=0?'up':'down'}">${gap>=0?'+':''}${money(gap)}</b></div><div><span>Confiança</span><b>${pct(h.confidence_pct)}</b></div><div><span>Resultado associado</span><b class="${p.result>=0?'up':'down'}">${money(p.result)}</b></div></div></div>`;
 document.getElementById('projectionPeriods').innerHTML=projectionPeriodCards(sc.periods);
 document.querySelectorAll('[data-scenario-card]').forEach(el=>el.classList.toggle('selected',el.dataset.scenarioCard===sc.key));
}
async function renderProjections(){
 const d=await api(filteredPath('/projections/overview'));if(!d)return offline();
 const base=d.scenarios.find(x=>x.key==='base')||d.scenarios[0];
 content.innerHTML=`<div class="card projection-toolbar"><div><p class="eyebrow">PLANEJAMENTO E PREVISIBILIDADE</p><strong>Projeções de Vendas e Resultados</strong><p class="note">Estimativas calculadas a partir do ritmo atual de vendas, receitas, despesas, custos, sazonalidade e tendência recente.</p></div><div class="form-row"><label class="compact-label">Cenário<select id="projectionScenario">${d.scenarios.map(x=>`<option value="${x.key}" ${x.key==='base'?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label><label class="compact-label">Horizonte<select id="projectionHorizon"><option value="week">Semana</option><option value="month" selected>Mês</option><option value="year">Ano</option></select></label></div></div><div id="projectionFocus"></div><div class="grid kpi-grid projection-current-grid">${kpi('Receita atual',money(d.current.revenue_30d),'Base móvel dos últimos 30 dias')}${kpi('Vendas atuais',money(d.current.sales_30d),`Média diária ${money(d.current.avg_daily_sales)}`)}${kpi('Despesas + custos',money(d.current.operating_costs_30d),`Índice sobre receita ${pct(d.current.cost_ratio_pct)}`,'down')}${kpi('Resultado atual',money(d.current.result_30d),`Margem ${pct(d.current.margin_pct)}`,d.current.result_30d>=0?'up':'down')}</div>${section('Projeção consolidada','Mês, trimestre, semestre e ano — cenário selecionado')}<div id="projectionPeriods" class="grid four projection-period-grid"></div>${section('Realizado x projetado','Evolução recente e próximos períodos')}<div class="grid two"><div class="card">${projectionDualBars(d.sales_trend)}</div><div class="card projection-health"><strong>Indicadores de tendência</strong><div class="projection-health-grid"><div><span>Crescimento mensal estimado</span><b class="up">+${pct(d.health.estimated_monthly_growth_pct)}</b></div><div><span>Crescimento anual estimado</span><b class="up">+${pct(d.health.estimated_annual_growth_pct)}</b></div><div><span>Ponto de equilíbrio mensal</span><b>${money(d.health.break_even_revenue)}</b></div><div><span>Risco de queda</span>${pill(d.health.decline_risk,d.health.decline_risk==='Baixo'?'green':d.health.decline_risk==='Médio'?'orange':'red')}</div><div><span>Margem projetada</span><b>${pct(base.periods.year.margin_pct)}</b></div><div><span>Saldo projetado em caixa</span><b class="up">${money(d.health.projected_ending_cash)}</b></div></div></div></div>${section('Cenários','Compare impacto de crescimento ou retração')}${projectionScenarioTable(d.scenarios)}${section('Projeção de caixa','Entradas, saídas e saldo acumulado')}<div class="grid two"><div>${table(['Mês','Entradas','Saídas','Geração líquida','Saldo projetado'],d.cash_projection.map(x=>`<tr><td>${x.label}</td><td class="num up">${money(x.inflows)}</td><td class="num down">${money(x.outflows)}</td><td class="num ${x.net>=0?'up':'down'}">${money(x.net)}</td><td class="num"><strong>${money(x.ending_cash)}</strong></td></tr>`),'Projeção de caixa')}</div><div class="card"><strong>Composição dos custos projetados</strong><div class="expense-mix">${d.expense_mix.map(x=>`<div><span><i style="--w:${Math.max(3,x.share_pct)}%"></i>${esc(x.label)}</span><b>${pct(x.share_pct)}</b><small>${money(x.value)}</small></div>`).join('')}</div></div></div>${section('Premissas e recomendações','Base utilizada para a previsão e ações sugeridas')}<div class="grid two">${projectionAssumptions(d.assumptions)}${projectionInsights(d.insights)}</div>`;
 const scenario=document.getElementById('projectionScenario'),horizon=document.getElementById('projectionHorizon');
 const apply=()=>renderProjectionFocus(d,scenario.value,horizon.value);scenario.onchange=apply;horizon.onchange=apply;apply();
}

async function renderInventory(){
 const [inv,pur,buy,noBuy]=await Promise.all([api(filteredPath('/inventory/overview')),api(filteredPath('/purchases/overview')),api(filteredPath('/inventory/purchase-suggestions',{kind:'buy'})),api(filteredPath('/inventory/purchase-suggestions',{kind:'do-not-buy'}))]);if(!inv)return offline();
 content.innerHTML=`<div class="grid kpi-grid">${kpi('Valor em estoque',money(inv.inventory_value),`${num(inv.sku_count)} SKUs`)}${kpi('Giro',`${inv.turnover}x`,'Velocidade anual')}${kpi('Risco de ruptura',num(inv.stockout_risk_items),'Itens críticos','down')}${kpi('Estoque parado',money(inv.dead_stock_value),`${inv.overstock_items} itens acima do ideal`)}</div>${section('Compras','Eficiência do abastecimento')}<div class="grid kpi-grid">${kpi('Compras no período',money(pur.total_purchases),`${num(pur.orders)} pedidos`)}${kpi('Lead time médio',`${pur.avg_lead_time_days} dias`,'Prazo fornecedor → recebimento')}${kpi('Economia potencial',money(pur.saving_opportunity),'Comparação de fornecedores','up')}${kpi('Variação de preço',pct(pur.price_variation_pct),'Média ponderada')}</div>${section('Sugestão de compra','Baseada em giro, cobertura e risco de ruptura')}${suggestionTable(buy,true)}${section('Sugestão de não compra','Evita excesso de estoque e capital parado')}${suggestionTable(noBuy,false)}`;
}
function suggestionTable(d,buy){return table(['Produto','Estoque','Venda/dia','Cobertura','Sugestão','Motivo'],d.items.map(x=>`<tr><td>${x.product}</td><td class="num">${num(x.stock)}</td><td class="num">${x.avg_daily_sales}</td><td class="num">${x.coverage_days} dias</td><td class="num">${buy?pill(num(x.suggested_qty),'green'):pill('NÃO COMPRAR','red')}</td><td>${x.reason}</td></tr>`),buy?'Sugestão de compra':'Sugestão de não compra')}

async function renderFinance(){
 const [dre,dmpl,bal,forecast,costs,ob,deb]=await Promise.all([api(filteredPath('/finance/dre')),api(filteredPath('/finance/dmpl')),api(filteredPath('/finance/balance-sheet')),api(filteredPath('/finance/cash-forecast',{months:12})),api(filteredPath('/cost-centers')),api(filteredPath('/finance/obligations')),api(filteredPath('/finance/debtors'))]);if(!dre)return offline();
 const net=dre.lines[dre.lines.length-1]?.value||0;const strip=ob?`<div class="finance-strip"><div class="finance-alert payable"><strong>CONTAS A PAGAR</strong><div class="amount down">${money(ob.summary.payables_total)}</div><small>Hoje: ${money(ob.summary.payables_today)} • Vencidas: ${money(ob.summary.overdue_payables)}</small></div><div class="finance-alert receivable"><strong>CONTAS A RECEBER</strong><div class="amount up">${money(ob.summary.receivables_total)}</div><small>Hoje: ${money(ob.summary.receivables_today)}</small></div><div class="finance-alert overdue"><strong>INADIMPLÊNCIA</strong><div class="amount warning-text">${money(ob.summary.overdue_receivables)}</div><small>${ob.summary.overdue_customers} clientes devedores</small></div></div>`:'';
 content.innerHTML=`${strip}<div class="grid kpi-grid">${kpi('Lucro líquido',money(net),`Margem ${pct(dre.margins.net_pct)}`,'up')}${kpi('Margem bruta',pct(dre.margins.gross_pct),'Após CMV/CPV')}${kpi('Margem EBITDA',pct(dre.margins.ebitda_pct),'Resultado operacional')}${kpi('Custo mensal',money(costs.total),'Centros de custos')}</div>${ob?`${section('Contas a pagar','Agenda de compromissos e vencimentos')}${table(['Vencimento','Fornecedor / Favorecido','Descrição','Valor','Status'],ob.payables.map(x=>`<tr class="${x.status==='Vencido'?'row-overdue':''}"><td>${x.due_date}</td><td>${x.counterparty}</td><td>${x.description}</td><td class="num">${money(x.value)}</td><td>${pill(x.status,x.status==='Vencido'?'red':x.status==='Hoje'?'orange':'blue')}</td></tr>`),'Contas a pagar')}${section('Contas a receber','Recebimentos previstos e vencidos')}${table(['Vencimento','Cliente','Documento','Valor','Status'],ob.receivables.map(x=>`<tr class="${x.status==='Vencido'?'row-overdue':''}"><td>${x.due_date}</td><td>${x.counterparty}</td><td>${x.description}</td><td class="num">${money(x.value)}</td><td>${pill(x.status,x.status==='Vencido'?'red':x.status==='Hoje'?'green':'blue')}</td></tr>`),'Contas a receber')}`:''}${deb?`${section('Acompanhamento de devedores','Priorize cobrança por valor, atraso e risco')}${table(['Cliente','Em atraso','Dias','Títulos','Último contato','Risco','Ação recomendada'],deb.items.map(x=>`<tr class="row-overdue"><td><strong>${x.customer}</strong></td><td class="num down">${money(x.amount)}</td><td class="num">${x.days_overdue}</td><td class="num">${x.open_titles}</td><td>${x.last_contact}</td><td>${pill(x.risk,x.risk==='Alto'?'red':x.risk==='Médio'?'orange':'blue')}</td><td>${x.recommended_action}</td></tr>`),'Devedores')}`:''}${section('DRE Gerencial','Estrutura gerencial do período')}${table(['Conta','Valor'],dre.lines.map(x=>`<tr><td style="padding-left:${10+x.level*18}px"><strong>${x.level===0?x.label:''}</strong>${x.level?x.label:''}</td><td class="num ${x.value<0?'down':''}">${money(x.value)}</td></tr>`),'DRE Gerencial')}${section('Balanço Patrimonial','Ativo x passivo + patrimônio líquido')}<div class="grid two"><div>${table(['Ativo','Valor'],bal.assets.map(x=>`<tr><td>${x.label}</td><td class="num">${money(x.value)}</td></tr>`),'Balanço — Ativo')}</div><div>${table(['Passivo / PL','Valor'],[...bal.liabilities,...bal.equity].map(x=>`<tr><td>${x.label}</td><td class="num">${money(x.value)}</td></tr>`),'Balanço — Passivo e PL')}</div></div>${section('DMPL','Movimentação do patrimônio líquido')}${table(['Evento',...dmpl.columns],dmpl.rows.map(r=>`<tr><td>${r.event}</td>${r.values.map(v=>`<td class="num">${money(v)}</td>`).join('')}</tr>`),'DMPL')}${section('Previsão de caixa','12 meses — cenário base')}<div class="card">${bars(forecast.months.map(x=>({month:x.month,value:x.ending_cash})))}</div>${section('Centros de custos','Orçamento x realizado')}${table(['Centro','Fixo','Variável','Orçamento','Realizado','Uso'],costs.items.map(c=>`<tr><td>${c.code} — ${c.name}</td><td class="num">${money(c.fixed)}</td><td class="num">${money(c.variable)}</td><td class="num">${money(c.budget)}</td><td class="num">${money(c.actual)}</td><td class="num">${pill(pct(c.usage_pct),c.usage_pct>100?'red':'green')}</td></tr>`),'Centros de custos')}${section('Boas práticas financeiras')}<div class="card note"><ul>${forecast.guidance.map(g=>`<li>${g}</li>`).join('')}</ul></div>`;
}

async function renderTeam(){
 const t=await api(filteredPath('/sales-team/performance'));if(!t)return offline();const ach=t.team_actual/t.team_target*100;
 content.innerHTML=`<div class="grid kpi-grid">${kpi('Meta da equipe',money(t.team_target),'Meta consolidada')}${kpi('Realizado',money(t.team_actual),`${pct(ach)} da meta`,'up')}${kpi('A realizar',money(Math.max(0,t.team_target-t.team_actual)),'Gap consolidado')}${kpi('Forecast',money(t.sellers.reduce((a,x)=>a+x.forecast,0)),'Projeção de fechamento')}</div>${section('Performance por vendedor','Meta, realizado, produtividade e conversão')}${table(['Vendedor','Meta','Realizado','A realizar','Atingimento','Forecast','Ticket','Conversão'],t.sellers.map(s=>`<tr><td><strong>${s.name}</strong></td><td class="num">${money(s.target)}</td><td class="num">${money(s.actual)}</td><td class="num">${money(s.remaining)}</td><td class="num">${pill(pct(s.achievement_pct),s.achievement_pct>=100?'green':'orange')}</td><td class="num">${money(s.forecast)}</td><td class="num">${money(s.avg_ticket)}</td><td class="num">${pct(s.conversion_pct)}</td></tr>`),'Performance por vendedor')}${section('Produtos por vendedor','Selecione o vendedor para cruzar ranking')}<div class="card"><div class="form-row"><select id="sellerSelect">${t.sellers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select><button class="primary" id="sellerRun">Analisar</button></div><div id="sellerProducts" style="margin-top:16px"></div></div>`;
 document.getElementById('sellerRun').onclick=renderSellerProducts;await renderSellerProducts();
}
async function renderSellerProducts(){const el=document.getElementById('sellerSelect');if(!el)return;const id=el.value;const [a,b]=await Promise.all([api(filteredPath('/sales/products',{ranking:'top',seller_id:id,limit:5})),api(filteredPath('/sales/products',{ranking:'bottom',seller_id:id,limit:5}))]);const target=document.getElementById('sellerProducts');if(target)target.innerHTML=`<div class="grid two">${productTable(a,'Mais vendidos do vendedor')}${productTable(b,'Menos vendidos do vendedor')}</div>`}

async function renderSuppliers(){const d=await api(filteredPath('/suppliers/ranking'));if(!d)return offline();content.innerHTML=`<div class="grid kpi-grid">${kpi('Fornecedores avaliados',num(d.items.length),'Base ativa')}${kpi('Melhor score',d.items[0].score,'Avaliação ponderada','up')}${kpi('Maior volume',money(Math.max(...d.items.map(x=>x.spend))),'Compras acumuladas')}${kpi('Critério principal','38% preço','Peso da metodologia')}</div>${section('Ranking e qualificação','Preço, entrega, qualidade e condição comercial')}${table(['Fornecedor','Compras','Preço','Entrega','Qualidade','Condição','Score','Classe'],d.items.map(s=>`<tr><td><strong>${s.name}</strong></td><td class="num">${money(s.spend)}</td><td class="num">${s.price_index}</td><td class="num">${s.delivery}</td><td class="num">${s.quality}</td><td class="num">${s.terms}</td><td class="num"><strong>${s.score}</strong></td><td class="num">${pill(s.classification,s.classification==='A'?'green':'orange')}</td></tr>`),'Ranking de fornecedores')}<div class="card note" style="margin-top:16px">Metodologia: ${d.method}. O peso pode ser parametrizado por empresa, categoria ou filial.</div>`}

async function renderAnalytics(){content.innerHTML=`<div class="card"><div class="split"><div><strong>Cruzamento gerencial</strong><p class="note">Combine dimensões e indicadores para identificar relações e exceções.</p></div><div class="form-row"><select id="dim"><option value="seller">Vendedor</option><option value="product">Produto</option><option value="supplier">Fornecedor</option><option value="cost_center">Centro de custo</option></select><select id="met"><option value="revenue">Receita / Valor</option><option value="margin">Margem</option><option value="growth">Crescimento</option><option value="cost">Custo</option></select><button class="primary" id="crossRun">Cruzar</button></div></div></div><div id="crossResult"></div>`;document.getElementById('crossRun').onclick=runCross;await runCross();}
async function runCross(){const dim=document.getElementById('dim')?.value||'seller',met=document.getElementById('met')?.value||'revenue';const d=await api(filteredPath('/analytics/cross',{dimension:dim,metric:met}));const el=document.getElementById('crossResult');if(el&&d)el.innerHTML=`${section('Resultado do cruzamento','Valor principal + indicador secundário')}${table(['Dimensão','Valor','Indicador secundário'],d.rows.map(r=>`<tr><td>${r.dimension}</td><td class="num">${money(r.value)}</td><td class="num">${r.secondary}</td></tr>`),'Cruzamento gerencial')}`}

async function renderMarket(){const d=await api(filteredPath('/market/opportunities'));if(!d)return offline();content.innerHTML=`<div class="grid kpi-grid">${kpi('Melhor oportunidade',d.items[0].city,`${d.items[0].state} — score ${d.items[0].score}`)}${kpi('Potencial estimado',money(d.items[0].potential),'Mercado endereçável demonstrativo')}${kpi('Tendência',`+${pct(d.items[0].trend)}`,'Índice de crescimento','up')}${kpi('Regiões analisadas',num(d.items.length),'Ranking demonstrativo')}</div>${section('Mapa de oportunidades nacionais','Ranking por potencial e competição')}${table(['Região','UF','Cidade','Score','Potencial','Competição','Tendência'],d.items.map(x=>`<tr><td>${x.region}</td><td>${x.state}</td><td><strong>${x.city}</strong></td><td class="num">${pill(x.score,'green')}</td><td class="num">${money(x.potential)}</td><td>${x.competition}</td><td class="num up">+${pct(x.trend)}</td></tr>`),'Oportunidades de mercado')}<div class="card note" style="margin-top:16px"><strong>Metodologia:</strong> ${d.methodology}<br>${d.note}</div>`}

async function getLicenseStatus(){if(!API_BASE)return demoLicense();try{return await apiRequest('/license/status')}catch(e){console.warn(e);return {status:'blocked',reason:e.message}}}
async function getUsers(){if(!API_BASE)return demoUsers().map(({password,...x})=>x);try{return await apiRequest('/users')}catch(e){return []}}
async function renderUsers(){
 const license=await getLicenseStatus(),users=await getUsers();currentLicense=license;const canManage=['superadmin','admin'].includes(currentUser?.role);const canLicense=currentUser?.role==='superadmin';
 content.innerHTML=`<div class="card license-panel ${license.status==='blocked'?'blocked':''}"><div class="split"><div><p class="eyebrow">LICENÇA DA EMPRESA</p><strong>${esc(license.company||'Empresa')}</strong></div>${pill(license.status==='active'?'ATIVA':license.status==='grace'?'EM CARÊNCIA':'BLOQUEADA',license.status==='active'?'green':license.status==='grace'?'orange':'red')}</div><div class="license-grid"><div><small>Plano</small><strong>${esc(license.plan||'-')}</strong></div><div><small>Vencimento</small><strong>${esc(license.due_date||'-')}</strong></div><div><small>Carência até</small><strong>${esc(license.grace_until||'-')}</strong></div><div><small>Contato financeiro</small><strong>${esc(license.billing_contact||'-')}</strong></div></div>${canLicense&&!API_BASE?`<div class="form-row" style="margin-top:16px"><select id="licenseStatus"><option value="active" ${license.status==='active'?'selected':''}>Ativa</option><option value="grace" ${license.status==='grace'?'selected':''}>Carência</option><option value="blocked" ${license.status==='blocked'?'selected':''}>Bloqueada</option></select><button class="primary" id="saveLicense">Aplicar status (demonstração)</button></div>`:'<p class="note" style="margin-top:14px">Em produção, o bloqueio deve ser controlado no servidor de licenças; o cliente não deve conseguir se auto-liberar.</p>'}</div>${section('Controle de usuários','Perfis, status e acesso à aplicação')}<div class="card"><div class="user-list">${users.map(u=>`<div class="user-row" data-user="${esc(u.username)}"><div><strong>${esc(u.name)}</strong><small><br>${esc(u.username)}</small></div><div>${pill(roleLabels[u.role]||u.role,'blue')}</div><div>${pill(u.active?'Ativo':'Bloqueado',u.active?'green':'red')}</div><div>${canManage?`<button class="mini-btn" data-user-toggle="${esc(u.username)}">${u.active?'Bloquear':'Ativar'}</button>`:''}</div></div>`).join('')}</div></div>${canManage?`${section('Novo usuário','Crie acessos separados por perfil')}<div class="card"><div class="form-row"><input id="newUserName" placeholder="Nome completo"><input id="newUsername" placeholder="Usuário"><input id="newPassword" type="password" placeholder="Senha inicial"><select id="newRole"><option value="manager">Gestor</option><option value="sales">Comercial</option><option value="finance">Financeiro</option><option value="viewer">Consulta</option><option value="admin">Administrador</option></select><button class="primary" id="createUser">Criar usuário</button></div><p id="userActionMsg" class="note"></p></div>`:''}`;
 if(document.getElementById('saveLicense'))document.getElementById('saveLicense').onclick=async()=>{const v=demoLicense();v.status=document.getElementById('licenseStatus').value;v.reason=v.status==='blocked'?'Bloqueio administrativo por falta de pagamento':'';saveDemoLicense(v);currentLicense=v;if(v.status==='blocked')showBlocked(v);else await renderUsers();};
 document.querySelectorAll('[data-user-toggle]').forEach(b=>b.onclick=()=>toggleUser(b.dataset.userToggle));
 if(document.getElementById('createUser'))document.getElementById('createUser').onclick=createUser;
}
async function toggleUser(username){if(API_BASE){try{await apiRequest(`/users/${encodeURIComponent(username)}`,'PATCH',{toggle_active:true});await renderUsers()}catch(e){alert(e.message)}return;}const users=demoUsers();const u=users.find(x=>x.username===username);if(u){u.active=!u.active;saveDemoUsers(users);await renderUsers();}}
async function createUser(){const name=document.getElementById('newUserName').value.trim(),username=document.getElementById('newUsername').value.trim(),password=document.getElementById('newPassword').value,role=document.getElementById('newRole').value,msg=document.getElementById('userActionMsg');if(!name||!username||password.length<6){msg.textContent='Informe nome, usuário e senha com pelo menos 6 caracteres.';return}if(API_BASE){try{await apiRequest('/users','POST',{name,username,password,role});msg.textContent='Usuário criado.';await renderUsers()}catch(e){msg.textContent=e.message}return;}const users=demoUsers();if(users.some(x=>x.username===username)){msg.textContent='Este usuário já existe.';return}users.push({id:`U${String(users.length+1).padStart(3,'0')}`,name,username,password,role,active:true});saveDemoUsers(users);await renderUsers();}

async function renderIntegration(){
 const [s,sql]=await Promise.all([api(filteredPath('/integration/last-sync')),api('/sql/status')]);
 const q=sql||{enabled:false,ready:false,data_source:'demo',mapping_exists:false,configured_entities:0,entities:[],errors:['Backend SQL não conectado no modo demonstração.']};
 const isAdmin=['superadmin','admin'].includes(currentUser?.role);
 const entityRows=(q.entities||[]).map(x=>`<tr><td><strong>${esc(x.label||x.entity)}</strong><br><small>${esc(x.entity)}</small></td><td>${pill(x.enabled?'Ativa':'Desativada',x.enabled?'green':'orange')}</td><td class="num">${num(x.last_rows||0)}</td><td>${esc(x.last_sync_at||'-')}</td><td><small>${esc(x.description||'')}</small></td></tr>`).join('');
 content.innerHTML=`<div class="grid kpi-grid">${kpi('Fonte ativa',q.data_source==='sqlserver'?'SQL Server':(s?.source_system||'Demonstração'),q.ready?'Pronta para dados reais':'Aguardando configuração')}${kpi('Status SQL',q.ready?'Pronto':q.enabled?'Configurar':'Desativado',q.database||'Sem banco configurado',q.ready?'up':'')}${kpi('Entidades mapeadas',num(q.configured_entities||0),`${num((q.entities||[]).length)} disponíveis no catálogo`)}${kpi('Última sincronização',q.last_sync_at?new Date(q.last_sync_at).toLocaleString('pt-BR'):'Ainda não executada',`${num(s?.records_processed||0)} registros no último ciclo`)}</div>
 ${section('Integração direta com Microsoft SQL Server','A API lê o banco com usuário somente-leitura; navegador e GitHub Pages nunca recebem usuário ou senha do SQL.')}
 <div class="grid two"><div class="card sql-status-card"><div class="split"><div><p class="eyebrow">PONTE SQL SEGURA</p><strong>${q.ready?'SQL Server pronto para sincronização':'Configuração do SQL Server'}</strong></div>${pill(q.ready?'PRONTA':q.enabled?'INCOMPLETA':'DESATIVADA',q.ready?'green':q.enabled?'orange':'red')}</div><div class="sql-config-grid"><div><small>Servidor</small><b>${esc(q.server||'Não configurado')}</b></div><div><small>Banco</small><b>${esc(q.database||'Não configurado')}</b></div><div><small>Driver</small><b>${esc(q.driver||'ODBC Driver 18')}</b></div><div><small>Criptografia</small><b>${esc(q.encrypt||'-')}</b></div><div><small>Usuário</small><b>${q.username_configured?'Configurado':'Não configurado'}</b></div><div><small>Senha</small><b>${q.password_configured?'Configurada no servidor':'Não configurada'}</b></div></div>${(q.errors||[]).map(x=>`<div class="alert warning"><i class="alert-icon"></i><div><strong>Atenção</strong><p>${esc(x)}</p></div></div>`).join('')}<div class="form-row sql-actions"><button class="secondary" id="sqlTestBtn" ${!API_BASE||!isAdmin?'disabled':''}>Testar conexão</button><button class="primary" id="sqlSyncBtn" ${!API_BASE||!isAdmin||!q.ready?'disabled':''}>Sincronizar agora</button><button class="secondary" id="sqlRefreshBtn">Atualizar status</button></div><p id="sqlActionMsg" class="note">${API_BASE?'Credenciais permanecem apenas nas variáveis de ambiente do backend.':'No GitHub Pages esta área é demonstrativa. Para SQL real, conecte o front-end a uma API RenBI hospedada.'}</p></div>
 <div class="card note"><strong>Fluxo de dados recomendado</strong><ol><li><b>SQL Server do ERP</b> continua sendo a fonte operacional.</li><li><b>Backend RenBI</b> usa conexão ODBC somente-leitura.</li><li>As <b>Views dbo.vw_renbi_*</b> isolam os nomes reais das tabelas do ERP.</li><li><b>sql_mapping.json</b> lê somente essas Views canônicas e gera a fotografia gerencial.</li><li>Uma sincronização cria uma fotografia gerencial segura no backend.</li><li>Dashboard, vendas, estoque, financeiro e projeções passam a consumir os dados SQL.</li></ol><div class="sql-security-banner"><strong>Regra de segurança:</strong> nunca coloque IP, usuário ou senha do SQL em <code>docs/config.js</code>, JavaScript ou GitHub Pages.</div></div></div>
 ${section('Mapeamento das informações do ERP','Mapeie as tabelas reais somente nas Views Base dbo.vw_renbi_*; depois ative as entidades já validadas.')}
 <div class="card table-card"><table><thead><tr><th>Entidade</th><th>Status</th><th>Registros</th><th>Última carga</th><th>Finalidade</th></tr></thead><tbody>${entityRows||'<tr><td colspan="5">Nenhum mapeamento carregado. Copie backend/sql_mapping.example.json para sql_mapping.json no servidor da API.</td></tr>'}</tbody></table></div>
 <div class="card note sql-security-banner"><strong>Camada de Views SQL v1.5</strong><p>Execute <code>database/sqlserver/01_views_renbi_adapter.sql</code>. Os pontos que devem receber os nomes reais das tabelas e campos do ERP estão comentados com <b>MAPEAMENTO DO ERP</b>. As Views Analíticas são calculadas sobre essa camada e não precisam conhecer a estrutura interna do sistema.</p></div>${section('Diagnóstico e pré-visualização','Permite conferir o resultado de uma View antes de usar os dados nos relatórios.')}
 <div class="card"><div class="form-row"><select id="sqlPreviewEntity">${(q.entities||[]).filter(x=>x.enabled).map(x=>`<option value="${esc(x.entity)}">${esc(x.label||x.entity)}</option>`).join('')||'<option value="">Nenhuma entidade ativa</option>'}</select><button class="secondary" id="sqlPreviewBtn" ${!API_BASE||!isAdmin||!(q.entities||[]).some(x=>x.enabled)?'disabled':''}>Pré-visualizar 20 linhas</button></div><div id="sqlPreviewResult" class="sql-preview empty">Nenhuma consulta executada.</div></div>
 ${section('Configuração no servidor da API','Variáveis necessárias — a senha não deve ser versionada no GitHub')}<div class="code">${escapeHtml(`RENBI_DATA_SOURCE=sqlserver\nSQL_ENABLED=true\nSQL_DRIVER=ODBC Driver 18 for SQL Server\nSQL_SERVER=SEU_SERVIDOR_OU_IP\nSQL_PORT=1433\nSQL_DATABASE=SEU_BANCO\nSQL_USERNAME=renbi_readonly\nSQL_PASSWORD=********\nSQL_ENCRYPT=yes\nSQL_TRUST_SERVER_CERTIFICATE=no`)}</div>
 ${section('Integração alternativa pelo Delphi','O modelo REST/JSON permanece disponível se você preferir que o próprio ERP envie os dados.')}<div class="grid two"><div class="card note"><strong>Quando usar SQL direto</strong><p>Ideal quando a API RenBI consegue acessar o servidor SQL pela rede/VPN e você deseja leitura automatizada sem alterar o ERP.</p></div><div class="card note"><strong>Quando usar Delphi → API</strong><p>Ideal quando o banco não pode ser acessado externamente. O Delphi extrai localmente e envia lotes idempotentes pela API.</p></div></div>
 ${section('Exemplo de lote Delphi','POST /api/v1/integration/batches')}<div class="code">${escapeHtml(JSON.stringify({source_system:'delphi-erp',company_id:'EMP001',branch_id:'FIL001',idempotency_key:'2026-08-05T10:00:00Z-001',items:[{entity:'sale',external_id:'VENDA-10293',operation:'upsert',occurred_at:'2026-08-05T10:00:00-03:00',data:{customer_id:'CLI001',seller_id:'V003',gross_total:1280.50,discount:30,net_total:1250.50}}]},null,2))}</div>`;
 const msg=document.getElementById('sqlActionMsg');
 const test=document.getElementById('sqlTestBtn');if(test)test.onclick=async()=>{msg.textContent='Testando conexão segura com o SQL Server...';try{const r=await apiRequest('/sql/test','POST',{});msg.textContent=`Conexão OK — ${r.server||''} / ${r.database||''} — ${r.latency_ms||0} ms.`}catch(e){msg.textContent='Falha: '+e.message}};
 const sync=document.getElementById('sqlSyncBtn');if(sync)sync.onclick=async()=>{msg.textContent='Sincronizando dados do SQL Server...';try{const r=await apiRequest('/sql/sync','POST',{entities:[]});msg.textContent=`Sincronização ${r.status}: ${num(r.records_processed)} registros processados.`;await renderIntegration()}catch(e){msg.textContent='Falha: '+e.message}};
 const ref=document.getElementById('sqlRefreshBtn');if(ref)ref.onclick=()=>renderIntegration();
 const prev=document.getElementById('sqlPreviewBtn');if(prev)prev.onclick=async()=>{const entity=document.getElementById('sqlPreviewEntity').value,out=document.getElementById('sqlPreviewResult');if(!entity)return;out.textContent='Consultando...';try{const r=await apiRequest(`/sql/preview/${encodeURIComponent(entity)}?limit=20`);if(!r.rows?.length){out.innerHTML='<div class="empty">Consulta válida, porém sem registros.</div>';return;}const headers=Object.keys(r.rows[0]);out.innerHTML=`<div class="sql-preview-table"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr>${headers.map(h=>`<td>${esc(row[h]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}catch(e){out.textContent='Falha: '+e.message}};
}
function escapeHtml(s){return String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
function offline(){content.innerHTML='<div class="card empty"><strong>Dados indisponíveis.</strong><br>Verifique o modo demonstração, a sessão ou a URL do backend em config.js.</div>'}

const pages={overview:['Visão Geral',renderOverview],sales:['Vendas',renderSales],projections:['Projeções',renderProjections],inventory:['Compras & Estoque',renderInventory],finance:['Financeiro & Contábil',renderFinance],team:['Equipe & Metas',renderTeam],suppliers:['Fornecedores',renderSuppliers],analytics:['Cruzamentos',renderAnalytics],market:['Oportunidades de Mercado',renderMarket],users:['Usuários & Licença',renderUsers],integration:['Integrações / SQL',renderIntegration]};
function allowedPages(){return ROLE_PAGES[currentUser?.role]||ROLE_PAGES.viewer}
function applyPermissions(){document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('permission-hidden',!allowedPages().includes(x.dataset.page)))}
async function go(page){if(!allowedPages().includes(page))page='overview';currentPage=page;let activeNav=null;document.querySelectorAll('.nav-item').forEach(x=>{const active=x.dataset.page===page;x.classList.toggle('active',active);if(active)activeNav=x});if(activeNav&&activeNav.scrollIntoView)activeNav.scrollIntoView({block:'nearest',inline:'nearest'});title.textContent=pages[page][0];await pages[page][1]();}

document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)go(b.dataset.page)});
content.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)go(g.dataset.go);const b=e.target.closest('[data-report-export]');if(b){const block=b.closest('.report-block');exportSingleTable(block,b.dataset.reportExport)}});
granularitySelect.onchange=setReferenceInput;
document.getElementById('applyFilterBtn').onclick=async()=>{updateFilterSummary();await go(currentPage)};
document.getElementById('refreshBtn').onclick=()=>go(currentPage);
document.getElementById('logoutBtn').onclick=logout;document.getElementById('blockedLogout').onclick=logout;

function showLoading(text='Preparando...'){document.getElementById('loadingText').textContent=text;document.getElementById('loadingOverlay').classList.remove('hidden')}
function hideLoading(){document.getElementById('loadingOverlay').classList.add('hidden')}
function tableMatrix(tableEl){return [...tableEl.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim()))}
function sanitizeSheetName(s){return String(s||'Relatorio').replace(/[\\\/?*\[\]:]/g,' ').slice(0,31)||'Relatorio'}
function downloadBlob(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function exportSingleTable(block,format){if(!block)return;const tableEl=block.querySelector('table'),name=block.dataset.reportTitle||'Relatorio';if(format==='xlsx')exportTablesExcel([{title:name,node:block}],`RenBI_${name}.xlsx`);else exportTablesPdf([{title:name,node:block}],`RenBI_${name}.pdf`)}
async function collectExportSnapshots(scope){
 const original=currentPage;const reportPages=scope==='all'?allowedPages().filter(p=>!['users','integration'].includes(p)):[currentPage];const snaps=[];showLoading('Consolidando relatórios...');
 for(const p of reportPages){await go(p);await sleep(30);snaps.push({title:pages[p][0],node:content.cloneNode(true)});}
 await go(original);return snaps;
}
function exportTablesExcel(snaps,filename='RenBI_Relatorios.xlsx'){
 if(window.XLSX){const wb=XLSX.utils.book_new();let count=0;snaps.forEach(s=>{const kpis=[...s.node.querySelectorAll('.kpi')].map(k=>[k.querySelector('.label')?.innerText||'',k.querySelector('.value')?.innerText||'',k.querySelector('.sub')?.innerText||'']);if(kpis.length){const ws=XLSX.utils.aoa_to_sheet([[s.title],['Indicador','Valor','Detalhe'],...kpis]);XLSX.utils.book_append_sheet(wb,ws,sanitizeSheetName(`${++count}-${s.title}`));}s.node.querySelectorAll('.report-block').forEach((b,i)=>{const m=tableMatrix(b.querySelector('table'));const ws=XLSX.utils.aoa_to_sheet(m);XLSX.utils.book_append_sheet(wb,ws,sanitizeSheetName(`${++count}-${b.dataset.reportTitle||'Relatorio'}`));});});XLSX.writeFile(wb,filename);return;}
 const html=`<html><meta charset="utf-8"><body>${snaps.map(s=>`<h2>${esc(s.title)}</h2>${s.node.innerHTML}`).join('<hr>')}</body></html>`;downloadBlob(filename.replace(/\.xlsx$/i,'.xls'),html,'application/vnd.ms-excel');
}
function exportTablesPdf(snaps,filename='RenBI_Relatorios.pdf'){
 const JsPDF=window.jspdf?.jsPDF;if(!JsPDF){printSnapshots(snaps);return;}const doc=new JsPDF({orientation:'landscape',unit:'pt',format:'a4'});let first=true;
 snaps.forEach(s=>{if(!first)doc.addPage();first=false;doc.setFontSize(16);doc.text(`RenBI 360 - ${s.title}`,35,35);doc.setFontSize(9);doc.text(filterSummary.textContent,35,52);let y=70;const kpis=[...s.node.querySelectorAll('.kpi')];if(kpis.length){const rows=kpis.map(k=>[k.querySelector('.label')?.innerText||'',k.querySelector('.value')?.innerText||'',k.querySelector('.sub')?.innerText||'']);doc.autoTable({startY:y,head:[['Indicador','Valor','Detalhe']],body:rows,styles:{fontSize:7},theme:'grid'});y=doc.lastAutoTable.finalY+14;}s.node.querySelectorAll('.report-block').forEach(b=>{const matrix=tableMatrix(b.querySelector('table'));if(!matrix.length)return;if(y>500){doc.addPage();y=35;}doc.setFontSize(10);doc.text(b.dataset.reportTitle||'Relatório',35,y);y+=7;doc.autoTable({startY:y,head:[matrix[0]],body:matrix.slice(1),styles:{fontSize:6,cellPadding:3},theme:'grid',margin:{left:35,right:35}});y=doc.lastAutoTable.finalY+16;});});doc.save(filename);
}
function printSnapshots(snaps){const w=window.open('','_blank');w.document.write(`<html><head><title>RenBI Relatórios</title><style>body{font-family:Arial;font-size:11px}table{width:100%;border-collapse:collapse;margin:8px 0 24px}th,td{border:1px solid #ccc;padding:6px}h1{page-break-before:always}h1:first-child{page-break-before:auto}.report-toolbar,button{display:none}</style></head><body>${snaps.map(s=>`<h1>${esc(s.title)}</h1>${s.node.innerHTML}`).join('')}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),300)}
document.getElementById('exportBtn').onclick=async()=>{try{const scope=document.getElementById('exportScope').value,format=document.getElementById('exportFormat').value,snaps=await collectExportSnapshots(scope);if(format==='xlsx')exportTablesExcel(snaps,scope==='all'?'RenBI_Todos_Relatorios.xlsx':`RenBI_${pages[currentPage][0]}.xlsx`);else exportTablesPdf(snaps,scope==='all'?'RenBI_Todos_Relatorios.pdf':`RenBI_${pages[currentPage][0]}.pdf`);}finally{hideLoading()}};


function stopAutoRefresh(){
  if(autoRefreshTimer){
    clearInterval(autoRefreshTimer);
    autoRefreshTimer=null;
  }
}

async function refreshCurrentPageAutomatically(){
  if(autoRefreshBusy || !currentUser || !API_BASE || document.hidden) return;
  if(appShell.classList.contains('hidden')) return;
  autoRefreshBusy=true;
  try{
    const s=await api(filteredPath('/integration/last-sync'));
    if(s){
      const syncStatus=document.getElementById('syncStatus');
      const syncDetail=document.getElementById('syncDetail');
      if(syncStatus) syncStatus.textContent=s.status==='healthy'?'Conectado':'Atenção';
      if(syncDetail) syncDetail.textContent=`Defasagem ${s.lag_seconds||0}s • atualização automática 60s`;
    }
    await go(currentPage);
  }catch(e){
    console.warn('Atualização automática REN-BI',e);
  }finally{
    autoRefreshBusy=false;
  }
}

function startAutoRefresh(){
  stopAutoRefresh();
  if(!API_BASE) return;
  autoRefreshTimer=setInterval(refreshCurrentPageAutomatically,AUTO_REFRESH_MS);
}


function installPasswordRecoveryUI(){
  const loginForm=document.getElementById('loginForm');
  if(!loginForm || document.getElementById('recoveryToggleBtn')) return;

  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.id='recoveryToggleBtn';
  toggle.className='secondary auth-submit';
  toggle.style.marginTop='10px';
  toggle.textContent='Esqueci minha senha';

  const panel=document.createElement('div');
  panel.id='passwordRecoveryPanel';
  panel.className='hidden';
  panel.style.marginTop='14px';
  panel.innerHTML=`
    <div style="border-top:1px solid rgba(127,127,127,.25);padding-top:14px">
      <p class="eyebrow">RECUPERAÇÃO DE SENHA</p>
      <p class="auth-help">Informe o usuário, a chave de recuperação do REN-BI e a nova senha.</p>
      <form id="recoveryForm">
        <label>Usuário<input id="recoveryUser" autocomplete="username" required /></label>
        <label>Chave de recuperação<input id="recoveryKey" type="password" autocomplete="off" required /></label>
        <label>Nova senha<input id="recoveryPassword" type="password" autocomplete="new-password" minlength="6" required /></label>
        <label>Confirmar nova senha<input id="recoveryPassword2" type="password" autocomplete="new-password" minlength="6" required /></label>
        <button class="primary auth-submit" type="submit">Trocar senha</button>
      </form>
      <div id="recoveryMessage" class="form-error"></div>
    </div>`;

  loginForm.insertAdjacentElement('afterend', toggle);
  toggle.insertAdjacentElement('afterend', panel);

  toggle.onclick=()=>{
    panel.classList.toggle('hidden');
    if(!panel.classList.contains('hidden')){
      document.getElementById('recoveryUser').value=document.getElementById('loginUser').value.trim();
    }
  };

  document.getElementById('recoveryForm').onsubmit=async e=>{
    e.preventDefault();
    const msg=document.getElementById('recoveryMessage');
    msg.style.color='';
    msg.textContent='';
    if(!API_BASE){
      msg.textContent='Recuperação disponível apenas quando o portal está conectado à API REN-BI.';
      return;
    }
    const username=document.getElementById('recoveryUser').value.trim();
    const recovery_key=document.getElementById('recoveryKey').value;
    const new_password=document.getElementById('recoveryPassword').value;
    const confirm=document.getElementById('recoveryPassword2').value;
    if(new_password!==confirm){
      msg.textContent='As duas senhas não conferem.';
      return;
    }
    if(new_password.length<6){
      msg.textContent='A nova senha deve ter pelo menos 6 caracteres.';
      return;
    }
    try{
      const r=await fetch(`${API}/auth/recover-password`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        cache:'no-store',
        body:JSON.stringify({username,recovery_key,new_password})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.detail||`HTTP ${r.status}`);
      document.getElementById('loginUser').value=username;
      document.getElementById('loginPassword').value='';
      document.getElementById('recoveryKey').value='';
      document.getElementById('recoveryPassword').value='';
      document.getElementById('recoveryPassword2').value='';
      msg.style.color='#0a7a3d';
      msg.textContent='Senha alterada. Agora entre com a nova senha.';
    }catch(ex){
      msg.textContent=ex.message||'Não foi possível trocar a senha.';
    }
  };
}

async function login(username,password){
 if(API_BASE){const r=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'Usuário ou senha inválidos');authToken=d.access_token;currentUser={...(d.user||{}),role:d.user?.role||d.user?.roles?.[0]||'viewer'};sessionStorage.setItem('renbi_token',authToken);sessionStorage.setItem('renbi_user',JSON.stringify(currentUser));return;}
 const u=demoUsers().find(x=>x.username===username&&x.password===password);if(!u||!u.active)throw new Error('Usuário, senha ou status de acesso inválido.');currentUser={id:u.id,username:u.username,name:u.name,role:u.role};authToken='demo-session';sessionStorage.setItem('renbi_token',authToken);sessionStorage.setItem('renbi_user',JSON.stringify(currentUser));
}
async function startApp(){currentLicense=await getLicenseStatus();if(['blocked','suspended'].includes(currentLicense?.status)){showBlocked(currentLicense);return;}loginScreen.classList.add('hidden');blockedScreen.classList.add('hidden');appShell.classList.remove('hidden');document.getElementById('userName').textContent=currentUser?.name||currentUser?.username||'Usuário';document.getElementById('userRole').textContent=roleLabels[currentUser?.role]||currentUser?.role||'Perfil';applyPermissions();setReferenceInput();const s=await api(filteredPath('/integration/last-sync'));if(s){document.getElementById('syncStatus').textContent=s.status==='healthy'?'Conectado':'Atenção';document.getElementById('syncDetail').textContent=`Defasagem ${s.lag_seconds||0}s • atualização automática 60s`;}await go(allowedPages()[0]||'overview');startAutoRefresh();}
function showBlocked(info){currentLicense=typeof info==='object'?info:{status:'blocked',reason:String(info)};appShell.classList.add('hidden');loginScreen.classList.add('hidden');blockedScreen.classList.remove('hidden');document.getElementById('blockedMessage').textContent=currentLicense.reason||'A licença está bloqueada por pendência financeira ou administrativa.';document.getElementById('blockedDetails').innerHTML=`<strong>Empresa:</strong> ${esc(currentLicense.company||'-')}<br><strong>Vencimento:</strong> ${esc(currentLicense.due_date||'-')}<br><strong>Carência:</strong> ${esc(currentLicense.grace_until||'-')}<br><strong>Contato:</strong> ${esc(currentLicense.billing_contact||'-')}`;const b=document.getElementById('demoUnblock');b.classList.toggle('hidden',!!API_BASE||currentUser?.role!=='superadmin');b.onclick=async()=>{const v=demoLicense();v.status='active';v.reason='';saveDemoLicense(v);currentLicense=v;await startApp();};}
function logout(){stopAutoRefresh();sessionStorage.removeItem('renbi_token');sessionStorage.removeItem('renbi_user');authToken='';currentUser=null;appShell.classList.add('hidden');blockedScreen.classList.add('hidden');loginScreen.classList.remove('hidden');document.getElementById('loginPassword').value='';}
document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const err=document.getElementById('loginError');err.textContent='';try{await login(document.getElementById('loginUser').value.trim(),document.getElementById('loginPassword').value);await startApp()}catch(ex){err.textContent=ex.message}};

(async function boot(){initDemoState();installPasswordRecoveryUI();document.getElementById('demoCredentials').innerHTML=API_BASE?'Autenticação conectada ao servidor RenBI.':'<strong>Modo demonstração:</strong><br>admin / RenBI@2026<br>gestor / Gestor@2026<br>financeiro / Finance@2026<br><small>Estas credenciais são públicas e servem somente para demonstração no GitHub Pages.</small>';const saved=sessionStorage.getItem('renbi_user');if(saved&&authToken){try{currentUser=JSON.parse(saved);await startApp();return}catch(e){logout()}}loginScreen.classList.remove('hidden');})();
