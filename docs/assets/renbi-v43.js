const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const content=$("#content"),rangeEl=$("#range"),startEl=$("#start"),endEl=$("#end"),lastUpdate=$("#lastUpdate");
const tenant=JSON.parse(sessionStorage.getItem("renbi_tenant")||"null"),token=sessionStorage.getItem("renbi_token")||"";
if(!tenant||!tenant.api_base||!token)location.href="./";
const API=String(tenant.api_base).replace(/\/$/,"")+"/api/v1";
let currentModule="executivo",lastRows=[],lastHeaders=[];
const titles={
 executivo:["PAINEL EXECUTIVO","Visão Geral"],vendas:["COMERCIAL","Vendas"],compras:["SUPRIMENTOS","Compras"],precos:["RENTABILIDADE","Preços & Margens"],
 clientes:["CRM ANALÍTICO","Clientes"],fornecedores:["SUPRIMENTOS","Fornecedores"],vendedores:["EQUIPE COMERCIAL","Vendedores"],estoque:["AUDITORIA","Estoque & Anomalias"],
 fiscal:["FISCAL","Fiscal"],dre:["CONTÁBIL","DRE"],tributario:["ESTRATÉGIA FISCAL","Comparador Tributário"],pessoas:["GESTÃO DE PESSOAS","Colaboradores"],
 prolabore:["SÓCIOS","Pró-labore"],forecast:["PROJEÇÕES","Forecast"],alertas:["INTELIGÊNCIA","Alertas & Oportunidades"],diagnostico:["SISTEMA","Diagnóstico"]
};
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const num=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(Number(v)||0);
const pct=v=>(Number(v)||0).toFixed(2)+"%";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{Accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+token,...(opt.headers||{})},cache:"no-store"});if(r.status===401){location.href="./";throw Error("Sessão expirada")}const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||("HTTP "+r.status));return d}
function qs(extra=""){let q="range="+encodeURIComponent(rangeEl.value);if(rangeEl.value==="custom")q+="&start="+startEl.value+"&end="+endEl.value;return q+(extra?"&"+extra:"")}
function section(t,s=""){return `<div class="section"><h2>${t}</h2><p>${s}</p></div>`}
function kpi(t,v,s="",cls=""){return `<div class="card kpi ${cls}"><small>${esc(t)}</small><strong>${v}</strong><div class="trend">${s}</div></div>`}
function setExport(headers,rows){lastHeaders=headers;lastRows=rows}
function table(headers,rows,exportRows=[]){if(exportRows.length)setExport(headers,exportRows);return `<div class="card table-wrap"><table class="table"><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`}
function chart(rows,label,value,alt=false){if(!rows?.length)return `<div class="card">Sem dados.</div>`;const max=Math.max(...rows.map(x=>Math.abs(Number(x[value])||0)),1);return `<div class="card"><div class="chart">${rows.map(x=>`<div class="bar ${alt?"alt":""}" style="height:${Math.max(3,Math.abs(Number(x[value])||0)/max*100)}%" data-tip="${esc(x[label])}: ${money(x[value])}"></div>`).join("")}</div></div>`}
function loading(){content.innerHTML='<div class="loading">Carregando informações...</div>';lastRows=[];lastHeaders=[]}
function setTitle(){const t=titles[currentModule]||["REN-BI 360",currentModule];$("#moduleKicker").textContent=t[0];$("#moduleTitle").textContent=t[1]}
function periodEnd(){if(rangeEl.value==="custom"&&endEl.value)return endEl.value;return new Date().toISOString().slice(0,10)}
function periodStart(){if(rangeEl.value==="custom"&&startEl.value)return startEl.value;const d=new Date(),days={"1m":30,"3m":92,"6m":185,"1y":365,"2y":730,"3y":1095,"5y":1825}[rangeEl.value]||92;d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}

async function executivo(){
 const [s,p,c,sp,a]=await Promise.all([
  api("/analytics-v4/sales-history?"+qs()),
  api("/analytics-v4/purchases-history?"+qs()),
  api("/unified-v43/customers-period?"+qs("limit=100")),
  api("/unified-v43/suppliers-period?"+qs("limit=100")),
  api("/unified-v43/alerts?"+qs())
 ]);
 const S=s.summary,P=p.summary,topAlerts=a.items.slice(0,6);
 content.innerHTML=`<div class="grid">${kpi("Faturamento",money(S.revenue),num(S.transactions)+" vendas")}${kpi("Ticket médio",money(S.avg_ticket),num(S.customers)+" clientes")}${kpi("Compras",money(P.purchases),num(P.purchase_docs)+" documentos")}${kpi("Descontos",money(S.discounts),"Concedidos no período")}</div>
 ${section("Evolução do faturamento","Valores diários do período selecionado")}${chart(s.daily,"sale_date","revenue")}
 ${section("Principais alertas","Anomalias e oportunidades identificadas automaticamente")}
 <div class="grid three">${topAlerts.map(x=>`<div class="card alert ${x.severity}"><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div>`).join("")}</div>
 ${section("Relacionamentos mais relevantes")}
 <div class="split">${table(["Cliente","Compras","Ticket","Segmento"],c.items.slice(0,15).map(x=>`<tr><td>${esc(x.customer)}</td><td class="num">${money(x.total_purchased)}</td><td class="num">${money(x.avg_ticket)}</td><td><span class="badge">${esc(x.segment)}</span></td></tr>`),c.items.slice(0,15).map(x=>[x.customer,x.total_purchased,x.avg_ticket,x.segment]))}
 ${table(["Fornecedor","Compras","Participação","Ticket"],sp.items.slice(0,15).map(x=>`<tr><td>${esc(x.supplier)}</td><td class="num">${money(x.total_purchased)}</td><td class="num">${pct(x.purchase_share_pct)}</td><td class="num">${money(x.avg_ticket)}</td></tr>`))}</div>`
}

async function vendas(){
 const [s,pk,sel]=await Promise.all([
  api("/analytics-v4/sales-history?"+qs()),
  api("/analytics-v4/sales-peaks?"+qs()),
  api("/unified-v43/sellers-period?"+qs())
 ]);
 const S=s.summary,week=["","Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
 content.innerHTML=`<div class="grid">${kpi("Receita",money(S.revenue))}${kpi("Quantidade de vendas",num(S.transactions))}${kpi("Ticket médio",money(S.avg_ticket))}${kpi("Clientes únicos",num(S.customers))}</div>
 ${section("Histórico de vendas","O gráfico respeita o período geral selecionado.")}${chart(s.daily,"sale_date","revenue")}
 <div class="split">
  <div>${section("Pico por horário")}${table(["Hora","Vendas","Faturamento","Ticket"],pk.by_hour.map(x=>`<tr><td>${x.sale_hour}:00</td><td class="num">${num(x.transactions)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.avg_ticket)}</td></tr>`))}</div>
  <div>${section("Pico por dia da semana")}${table(["Dia","Vendas","Faturamento","Ticket"],pk.by_weekday.map(x=>`<tr><td>${week[x.weekday_no]||x.weekday_no}</td><td class="num">${num(x.transactions)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.avg_ticket)}</td></tr>`))}</div>
 </div>
 ${section("Desempenho por vendedor","Receita, margem, ticket e descontos no período")}
 ${table(["Vendedor","Vendas","Clientes","Receita","Ticket","Margem","Margem %","Descontos"],sel.items.map(x=>`<tr><td>${esc(x.seller_id)}</td><td class="num">${num(x.sales_count)}</td><td class="num">${num(x.customers)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.avg_ticket)}</td><td class="num">${money(x.gross_margin)}</td><td class="num">${pct(x.margin_pct)}</td><td class="num">${money(x.discounts)}</td></tr>`),sel.items.map(x=>[x.seller_id,x.sales_count,x.customers,x.revenue,x.avg_ticket,x.gross_margin,x.margin_pct,x.discounts]))}`
}

async function compras(){
 const [p,sp,h]=await Promise.all([
  api("/analytics-v4/purchases-history?"+qs()),
  api("/unified-v43/suppliers-period?"+qs("limit=500")),
  api("/unified-v43/price-cost-history?"+qs("limit=500"))
 ]);
 const P=p.summary;
 content.innerHTML=`<div class="grid">${kpi("Compras",money(P.purchases))}${kpi("Documentos",num(P.purchase_docs))}${kpi("Descontos obtidos",money(P.discounts))}${kpi("Fornecedores ativos",num(sp.items.length),"Com compras no período")}</div>
 ${section("Evolução das compras")}${chart(p.daily,"purchase_date","purchases",true)}
 ${section("Fornecedores no período")}
 ${table(["Fornecedor","Compras","Docs","Ticket","Participação","Lucro esperado","Vencido"],sp.items.map(x=>`<tr><td>${esc(x.supplier)}</td><td class="num">${money(x.total_purchased)}</td><td class="num">${num(x.purchase_docs)}</td><td class="num">${money(x.avg_ticket)}</td><td class="num">${pct(x.purchase_share_pct)}</td><td class="num">${money(x.expected_profit)}</td><td class="num negative">${money(x.overdue_payables)}</td></tr>`),sp.items.map(x=>[x.supplier,x.total_purchased,x.purchase_docs,x.avg_ticket,x.purchase_share_pct,x.expected_profit,x.overdue_payables]))}
 ${section("Evolução de custo por produto","Compara custo de compra, custo de venda e preço de venda médios")}
 ${table(["Produto","Custo compra","Custo venda","Preço venda","Margem","Variação custo","Comprado"],h.items.slice(0,250).map(x=>`<tr><td>${esc(x.product)}</td><td class="num">${money(x.avg_purchase_cost)}</td><td class="num">${money(x.avg_sale_cost)}</td><td class="num">${money(x.avg_sale_price)}</td><td class="num">${pct(x.avg_margin_pct)}</td><td class="num ${Number(x.cost_variation_pct)>20?"warning":""}">${pct(x.cost_variation_pct)}</td><td class="num">${money(x.purchased_value)}</td></tr>`))}`
}

async function precos(){
 content.innerHTML=`${section("Precificação e margem","Preço atual, custo, margem e preço recomendado.")}
 <div class="card form"><label>Margem alvo %<input id="tm" type="number" value="25" step=".1"></label><label>Despesas variáveis %<input id="ve" type="number" value="5" step=".1"></label><button id="calcPrice">Calcular preços</button><label>Custos fixos R$<input id="fc" type="number" value="0" step=".01"></label><label>Custo variável %<input id="vc" type="number" value="70" step=".1"></label><button id="calcBE">Ponto de equilíbrio</button></div><div id="priceOut"></div>`;
 async function load(){
  const d=await api(`/analytics-v4/pricing?target_margin_pct=${$("#tm").value}&variable_expense_pct=${$("#ve").value}&limit=1000`);
  $("#priceOut").innerHTML=`${section("Sugestão de preços","Cálculo gerencial por custo e margem alvo.")}
  ${table(["Produto","Compra","Aquisição","Custo venda","Preço atual","Margem","Sugerido","Diferença"],d.items.map(x=>`<tr><td>${esc(x.product)}</td><td class="num">${money(x.purchase_price)}</td><td class="num">${money(x.acquisition_cost)}</td><td class="num">${money(x.sale_cost)}</td><td class="num">${money(x.sale_price)}</td><td class="num">${pct(x.calculated_margin_pct)}</td><td class="num positive">${money(x.suggested_sale_price)}</td><td class="num ${Number(x.price_gap)>0?"negative":"positive"}">${money(x.price_gap)}</td></tr>`),d.items.map(x=>[x.product,x.purchase_price,x.acquisition_cost,x.sale_cost,x.sale_price,x.calculated_margin_pct,x.suggested_sale_price,x.price_gap]))}`
 }
 $("#calcPrice").onclick=load;
 $("#calcBE").onclick=async()=>{const d=await api(`/analytics-v4/break-even-simulator?fixed_costs=${$("#fc").value}&variable_cost_pct=${$("#vc").value}`);$("#priceOut").insertAdjacentHTML("afterbegin",`<div class="grid">${kpi("Ponto de equilíbrio",money(d.break_even_revenue),d.note)}${kpi("Margem de contribuição",pct(d.contribution_margin_pct))}</div>`)}
 await load()
}

async function clientes(){
 const [d,abc]=await Promise.all([
  api("/unified-v43/customers-period?"+qs("limit=1000")),
  api("/analytics-v4/abc?"+qs("dimension=customer&limit=1000"))
 ]);
 content.innerHTML=`<div class="grid">${kpi("Clientes no período",num(d.items.filter(x=>Number(x.purchase_count)>0).length))}${kpi("Inadimplentes",num(d.items.filter(x=>Number(x.overdue_value)>0).length))}${kpi("Para reativação",num(d.items.filter(x=>x.segment==="REATIVAR").length))}${kpi("VIP/Recorrentes",num(d.items.filter(x=>x.segment==="VIP/RECORRENTE").length))}</div>
 ${section("Inteligência de clientes","Recência, frequência, valor, inadimplência e oportunidade no período.")}
 ${table(["Cliente","Compras","Ticket","Qtd.","Última","Intervalo","Recência","Em atraso","Atraso médio","Segmento","Score"],d.items.map(x=>`<tr><td>${esc(x.customer)}</td><td class="num">${money(x.total_purchased)}</td><td class="num">${money(x.avg_ticket)}</td><td class="num">${num(x.purchase_count)}</td><td>${esc(x.last_purchase_date)}</td><td class="num">${num(x.avg_days_between_purchases)}d</td><td class="num">${num(x.recency_days)}d</td><td class="num negative">${money(x.overdue_value)}</td><td class="num">${num(x.avg_payment_delay_days)}d</td><td><span class="badge">${esc(x.segment)}</span></td><td class="num">${num(x.opportunity_score)}</td></tr>`),d.items.map(x=>[x.customer,x.total_purchased,x.avg_ticket,x.purchase_count,x.last_purchase_date,x.avg_days_between_purchases,x.recency_days,x.overdue_value,x.avg_payment_delay_days,x.segment,x.opportunity_score]))}
 ${section("Curva ABC de clientes")}
 ${table(["Classe","Cliente ID","Valor","Participação","Acumulado"],abc.items.slice(0,300).map(x=>`<tr><td><span class="badge ${x.abc_class}">${x.abc_class}</span></td><td>${esc(x.customer_id)}</td><td class="num">${money(x.value)}</td><td class="num">${pct(x.share_pct)}</td><td class="num">${pct(x.cumulative_pct)}</td></tr>`))}`
}

async function fornecedores(){
 const [d,abc]=await Promise.all([
  api("/unified-v43/suppliers-period?"+qs("limit=1000")),
  api("/analytics-v4/abc?"+qs("dimension=supplier&limit=1000"))
 ]);
 content.innerHTML=`<div class="grid">${kpi("Fornecedores no período",num(d.items.length))}${kpi("Top fornecedor",esc(d.items[0]?.supplier||"-"),pct(d.items[0]?.purchase_share_pct||0)+" das compras")}${kpi("Compras do top 5",money(d.items.slice(0,5).reduce((a,x)=>a+Number(x.total_purchased||0),0)))}${kpi("Obrigações vencidas",money(d.items.reduce((a,x)=>a+Number(x.overdue_payables||0),0)),"Base atual")}</div>
 ${section("Análise por fornecedor","Compra, ticket, concentração, custo e lucro esperado.")}
 ${table(["Fornecedor","Compras","Docs","Ticket","Participação","Custo médio","Preço médio","Lucro esperado","Vencido"],d.items.map(x=>`<tr><td>${esc(x.supplier)}</td><td class="num">${money(x.total_purchased)}</td><td class="num">${num(x.purchase_docs)}</td><td class="num">${money(x.avg_ticket)}</td><td class="num">${pct(x.purchase_share_pct)}</td><td class="num">${money(x.avg_purchase_cost)}</td><td class="num">${money(x.avg_sale_price)}</td><td class="num">${money(x.expected_profit)}</td><td class="num negative">${money(x.overdue_payables)}</td></tr>`),d.items.map(x=>[x.supplier,x.total_purchased,x.purchase_docs,x.avg_ticket,x.purchase_share_pct,x.avg_purchase_cost,x.avg_sale_price,x.expected_profit,x.overdue_payables]))}
 ${section("Curva ABC de fornecedores")}
 ${table(["Classe","Fornecedor","Valor","Participação","Acumulado"],abc.items.slice(0,300).map(x=>`<tr><td><span class="badge ${x.abc_class}">${x.abc_class}</span></td><td>${esc(x.name)}</td><td class="num">${money(x.value)}</td><td class="num">${pct(x.share_pct)}</td><td class="num">${pct(x.cumulative_pct)}</td></tr>`))}`
}

async function vendedores(){
 const [d,products,abc]=await Promise.all([
  api("/unified-v43/sellers-period?"+qs()),
  api("/analytics-v4/seller-products?"+qs()),
  api("/analytics-v4/abc?"+qs("dimension=seller&limit=1000"))
 ]);
 content.innerHTML=`${section("Desempenho por vendedor","Do fechamento ao mix de produtos no período selecionado.")}
 ${table(["Vendedor","Vendas","Clientes","Receita","Ticket","Qtd. itens","Margem","Margem %","Desconto"],d.items.map(x=>`<tr><td>${esc(x.seller_id)}</td><td class="num">${num(x.sales_count)}</td><td class="num">${num(x.customers)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.avg_ticket)}</td><td class="num">${num(x.quantity)}</td><td class="num">${money(x.gross_margin)}</td><td class="num">${pct(x.margin_pct)}</td><td class="num">${money(x.discounts)}</td></tr>`),d.items.map(x=>[x.seller_id,x.sales_count,x.customers,x.revenue,x.avg_ticket,x.quantity,x.gross_margin,x.margin_pct,x.discounts]))}
 ${section("Produtos mais vendidos por vendedor")}
 ${table(["Vendedor","Produto","Qtd.","Receita","Margem"],products.items.slice(0,500).map(x=>`<tr><td>${esc(x.seller_id)}</td><td>${esc(x.product)}</td><td class="num">${num(x.quantity)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.margin)}</td></tr>`))}
 ${section("Curva ABC de vendedores")}
 ${table(["Classe","Vendedor","Receita","Participação","Acumulado"],abc.items.map(x=>`<tr><td><span class="badge ${x.abc_class}">${x.abc_class}</span></td><td>${esc(x.seller_id)}</td><td class="num">${money(x.value)}</td><td class="num">${pct(x.share_pct)}</td><td class="num">${pct(x.cumulative_pct)}</td></tr>`))}`
}

async function estoque(){
 const d=await api("/analytics-v4/inventory-anomalies?min_risk=0");
 const bad=d.items.filter(x=>x.risk_level!=="NORMAL");
 content.innerHTML=`<div class="grid">${kpi("Itens analisados",num(d.items.length))}${kpi("Anomalias",num(bad.length))}${kpi("Risco financeiro",money(bad.reduce((a,x)=>a+Number(x.estimated_financial_risk||0),0)))}${kpi("Críticos",num(bad.filter(x=>x.risk_level==="CRITICO").length))}</div>
 <div class="warn">${esc(d.note)}</div>
 ${section("Anomalias de estoque","Compara estoque anterior + entradas - saídas com o estoque atual registrado.")}
 ${table(["Nível","Produto","Anterior","Entradas","Saídas","Teórico","Atual","Diferença","Risco R$"],bad.map(x=>`<tr><td><span class="badge ${x.risk_level==="CRITICO"?"high":"medium"}">${esc(x.risk_level)}</span></td><td>${esc(x.product)}</td><td class="num">${num(x.previous_stock)}</td><td class="num">${num(x.recorded_entries)}</td><td class="num">${num(x.recorded_exits)}</td><td class="num">${num(x.theoretical_stock)}</td><td class="num">${num(x.current_stock)}</td><td class="num negative">${num(x.stock_variance)}</td><td class="num negative">${money(x.estimated_financial_risk)}</td></tr>`),bad.map(x=>[x.risk_level,x.product,x.previous_stock,x.recorded_entries,x.recorded_exits,x.theoretical_stock,x.current_stock,x.stock_variance,x.estimated_financial_risk]))}`
}

async function fiscal(){
 const d=await api("/analytics-v4/fiscal?"+qs());
 content.innerHTML=`<div class="warn">${esc(d.note)}</div>${section("Detalhamento fiscal","NCM, CEST, CFOP, CST, ICMS, PIS e COFINS por combinação fiscal no período.")}
 ${table(["NCM","CEST","CFOP","CST ICMS","CST PIS","CST COFINS","Receita","ICMS","ICMS-ST","PIS","COFINS"],d.items.map(x=>`<tr><td>${esc(x.ncm)}</td><td>${esc(x.cest)}</td><td>${esc(x.cfop)}</td><td>${esc(x.cst_icms)}</td><td>${esc(x.cst_pis)}</td><td>${esc(x.cst_cofins)}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.icms)}</td><td class="num">${money(x.icms_st)}</td><td class="num">${money(x.pis)}</td><td class="num">${money(x.cofins)}</td></tr>`),d.items.map(x=>[x.ncm,x.cest,x.cfop,x.cst_icms,x.cst_pis,x.cst_cofins,x.revenue,x.icms,x.icms_st,x.pis,x.cofins]))}`
}

async function dre(){
 const cats=await api("/strategy-v42/dre/categories");
 const labels={deductions:"Deduções/tributos sobre vendas",selling_expenses:"Despesas de vendas",administrative_expenses:"Despesas administrativas",financial_expenses:"Despesas financeiras",financial_revenues:"Receitas financeiras",other_operating_expenses:"Outras despesas operacionais",other_operating_revenues:"Outras receitas operacionais",income_tax:"IR/CSLL",participations:"Participações",ignore:"Ignorar"};
 content.innerHTML=`${section("DRE legal/gerencial","Mapeamento configurável do plano financeiro para a estrutura de resultado.")}
 <div class="card form"><label>De<input id="ds" type="date" value="${periodStart()}"></label><label>Até<input id="de" type="date" value="${periodEnd()}"></label><button id="runDre">Gerar DRE</button><button id="saveMap">Salvar mapeamento</button></div><div id="dreOut"></div>
 ${section("Mapeamento das categorias","A cobertura deve ser validada com a contabilidade.")}
 ${table(["Categoria ERP","Valor histórico","Lançamentos","Linha DRE"],cats.categories.map(x=>`<tr><td>${esc(x.category)}</td><td class="num">${money(x.total_value)}</td><td class="num">${num(x.entries)}</td><td><select class="map-select" data-cat="${esc(x.category)}"><option value="">Não mapeado</option>${cats.allowed_lines.map(v=>`<option value="${v}" ${x.mapped_to===v?"selected":""}>${esc(labels[v]||v)}</option>`).join("")}</select></td></tr>`))}`;
 $("#saveMap").onclick=async()=>{const mapping={};$$(".map-select").forEach(s=>{if(s.value)mapping[s.dataset.cat]=s.value});await api("/strategy-v42/dre/mapping",{method:"POST",body:JSON.stringify({mapping})});alert("Mapeamento salvo.")};
 $("#runDre").onclick=async()=>{const d=await api(`/strategy-v42/dre/structured?start=${$("#ds").value}&end=${$("#de").value}`),s=d.statement;$("#dreOut").innerHTML=`<div class="${d.status==="validated"?"okbox":"warn"}">Cobertura do mapeamento: <b>${pct(d.mapping_coverage_pct)}</b>. ${esc(d.note)}</div>${table(["Linha","Valor"],[["Receita bruta",s.gross_revenue],["(-) Deduções",s.sales_deductions],["Receita líquida",s.net_revenue],["(-) CMV",s.cogs],["Lucro bruto",s.gross_profit],["Despesas de vendas",s.selling_expenses],["Despesas administrativas",s.administrative_expenses],["Outras despesas operacionais",s.other_operating_expenses],["Outras receitas operacionais",s.other_operating_revenues],["Resultado financeiro",s.financial_result],["Resultado antes IR/CSLL",s.result_before_income_tax],["IR/CSLL",s.income_tax],["Participações",s.participations],["Resultado líquido",s.net_result]].map(x=>`<tr><td>${x[0]}</td><td class="num">${money(x[1])}</td></tr>`))}`};await $("#runDre").onclick()
}

async function tributario(){
 const e=periodEnd(),dt=new Date(e+"T12:00:00"),y=dt.getFullYear(),m=dt.getMonth()+1;
 content.innerHTML=`${section("Comparador tributário","Simulação gerencial. Competência inicial usa o mês final do filtro geral.")}
 <div class="card form"><label>Ano<input id="ty" type="number" value="${y}"></label><label>Mês<input id="tm" type="number" min="1" max="12" value="${m}"></label><label>Lucro tributável Lucro Real<input id="rp" type="number" value="0" step=".01"></label><label>Base de créditos PIS/COFINS<input id="rc" type="number" value="0" step=".01"></label><button id="taxRun">Simular</button></div><div id="taxOut"></div>`;
 $("#taxRun").onclick=async()=>{const d=await api(`/strategy-v42/tax-comparison?year=${$("#ty").value}&month=${$("#tm").value}&real_taxable_profit=${$("#rp").value}&real_pis_cofins_credit_base=${$("#rc").value}`),s=d.simple_national,p=d.presumed_profit,r=d.real_profit,b=d.lowest_estimated_total;$("#taxOut").innerHTML=`<div class="warn">${esc(d.disclaimer)}</div><div class="grid">${kpi("Faturamento",money(d.month_revenue),d.competence)}${kpi("RBT12",money(d.rbt12_previous_12_months))}${kpi("Menor estimativa",esc(b?.regime||"-"),money(b?.value||0))}${kpi("ICMS ERP",money(d.actual_erp_tax_values.icms))}</div><div class="grid three"><div class="card ${b?.regime==="Simples Nacional"?"best":""}"><b>Simples Nacional</b>${s.eligible?`<h2>${money(s.estimated_month_tax)}</h2><p>Efetiva: ${pct(s.effective_rate_pct)}</p>`:`<h3>Não simulado</h3><p>${esc(s.reason)}</p>`}<small>${esc(s.note||"")}</small></div><div class="card ${b?.regime==="Lucro Presumido"?"best":""}"><b>Lucro Presumido</b><h2>${money(p.estimated_month_total)}</h2><p>Efetiva: ${pct(p.effective_month_rate_pct)}</p><p>IRPJ trim.: ${money(p.irpj_quarter)} | CSLL trim.: ${money(p.csll_quarter)}</p><small>${esc(p.note)}</small></div><div class="card ${b?.regime==="Lucro Real"?"best":""}"><b>Lucro Real</b><h2>${money(r.estimated_month_total)}</h2><p>Efetiva: ${pct(r.effective_month_rate_pct)}</p><p>IRPJ ${money(r.irpj)} | CSLL ${money(r.csll)} | PIS ${money(r.pis)} | COFINS ${money(r.cofins)}</p><small>${esc(r.note)}</small></div></div><div class="card"><b>Reforma Tributária / transição</b><p>${esc(d.tax_reform_transition.note)}</p><p>CBS teste: ${d.tax_reform_transition.cbs_test_pct??"-"}% (${money(d.tax_reform_transition.cbs_test_value)}) | IBS teste: ${d.tax_reform_transition.ibs_test_pct??"-"}% (${money(d.tax_reform_transition.ibs_test_value)})</p></div>`};await $("#taxRun").onclick()
}

async function pessoas(){
 const [e,p]=await Promise.all([api("/analytics-v4/employees"),api("/strategy-v42/payroll/parameters")]);
 content.innerHTML=`<div class="warn">${esc(e.note)}</div>${section("Custo estimado de pessoal","Parâmetros ajustáveis e salário vindo do ERP.")}
 <div class="card form">${[["employer_inss_pct","INSS patronal %"],["fgts_pct","FGTS %"],["rat_pct","RAT %"],["third_parties_pct","Terceiros %"],["thirteenth_provision_pct","Provisão 13º %"],["vacation_provision_pct","Provisão férias %"],["other_monthly_cost","Outros R$"]].map(([k,l])=>`<label>${l}<input id="${k}" type="number" step=".0001" value="${p[k]}"></label>`).join("")}<button id="savePayroll">Salvar/calcular</button></div><div id="payOut"></div>
 ${section("Colaboradores")}${table(["Colaborador","Cargo","Loja","Admissão","Demissão","Salário","Comissão"],e.items.map(x=>`<tr><td>${esc(x.employee)}</td><td>${esc(x.job_title)}</td><td>${esc(x.branch_id)}</td><td>${esc(x.admission_date)}</td><td>${esc(x.dismissal_date)}</td><td class="num">${money(x.salary)}</td><td class="num">${pct(x.commission_pct)}</td></tr>`),e.items.map(x=>[x.employee,x.job_title,x.branch_id,x.admission_date,x.dismissal_date,x.salary,x.commission_pct]))}`;
 async function calc(){const d=await api("/strategy-v42/payroll/cost"),c=d.components;$("#payOut").innerHTML=`<div class="grid">${kpi("Ativos",num(d.employees))}${kpi("Folha salarial",money(c.salary_base))}${kpi("Encargos/provisões",money(d.estimated_total_monthly_cost-c.salary_base))}${kpi("Custo mensal",money(d.estimated_total_monthly_cost))}</div>`}
 $("#savePayroll").onclick=async()=>{const body={};["employer_inss_pct","fgts_pct","rat_pct","third_parties_pct","thirteenth_provision_pct","vacation_provision_pct","other_monthly_cost"].forEach(k=>body[k]=Number($("#"+k).value||0));await api("/strategy-v42/payroll/parameters",{method:"POST",body:JSON.stringify(body)});await calc()};await calc()
}

async function prolabore(){
 content.innerHTML=`${section("Pró-labore e retirada dos sócios","Simulador porque o SUPERSCE não possui valores de pró-labore confiáveis.")}
 <div class="card form"><label>Pró-labore bruto<input id="pg" type="number" value="0" step=".01"></label><label>INSS sócio %<input id="pi" type="number" value="11" step=".01"></label><label>INSS patronal %<input id="pe" type="number" value="20" step=".01"></label><button id="proRun">Simular</button></div><div id="proOut"></div>`;
 $("#proRun").onclick=async()=>{const d=await api(`/strategy-v42/prolabore/simulate?gross_value=${$("#pg").value}&partner_inss_pct=${$("#pi").value}&employer_inss_pct=${$("#pe").value}`);$("#proOut").innerHTML=`<div class="warn">${esc(d.note)}</div><div class="grid">${kpi("Pró-labore bruto",money(d.gross_prolabore))}${kpi("INSS sócio",money(d.partner_inss_estimate))}${kpi("INSS patronal",money(d.employer_inss_estimate))}${kpi("Custo empresa",money(d.estimated_company_cost))}</div>`};await $("#proRun").onclick()
}

async function forecast(){
 content.innerHTML=`${section("Forecast","Projeção estatística baseada no histórico mensal real do ERP.")}
 <div class="card form"><label>Histórico (meses)<input id="fh" type="number" min="6" max="60" value="24"></label><label>Projetar (meses)<input id="fa" type="number" min="1" max="18" value="6"></label><button id="forecastRun">Projetar</button></div><div id="forecastOut"></div>`;
 $("#forecastRun").onclick=async()=>{const d=await api(`/unified-v43/forecast?history_months=${$("#fh").value}&months_ahead=${$("#fa").value}`),s=d.summary;$("#forecastOut").innerHTML=`<div class="warn">${esc(d.disclaimer)}</div><div class="grid">${kpi("Média mensal recente",money(s.recent_monthly_average))}${kpi("Receita projetada",money(s.forecast_revenue_total),d.months_ahead+" meses")}${kpi("Período comparável anterior",money(s.previous_comparable_total))}${kpi("Variação projetada",s.forecast_change_pct==null?"-":pct(s.forecast_change_pct),"Base estatística")}</div>${section("Histórico mensal")}${chart(d.history,"month","revenue")}${section("Projeção base / cenários")}${table(["Mês","Conservador","Base","Otimista","Margem bruta","Compras","Margem %"],d.forecast.map(x=>`<tr class="forecast"><td>${x.month}</td><td class="num">${money(x.revenue_conservative)}</td><td class="num">${money(x.revenue_base)}</td><td class="num">${money(x.revenue_optimistic)}</td><td class="num">${money(x.gross_margin_base)}</td><td class="num">${money(x.purchases_base)}</td><td class="num">${pct(x.projected_margin_pct)}</td></tr>`),d.forecast.map(x=>[x.month,x.revenue_conservative,x.revenue_base,x.revenue_optimistic,x.gross_margin_base,x.purchases_base,x.projected_margin_pct]))}`};await $("#forecastRun").onclick()
}

async function alertas(){
 const d=await api("/unified-v43/alerts?"+qs());
 const sev={high:"Crítico",medium:"Atenção",opportunity:"Oportunidade",low:"Baixo"};
 content.innerHTML=`${section("Alertas e oportunidades","Regras gerenciais automáticas; servem para investigação e decisão, não para acusação.")}<div class="grid three">${d.items.map(x=>`<div class="card alert ${x.severity}"><span class="badge ${x.severity}">${sev[x.severity]||x.severity}</span><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div>`).join("")}`;
 setExport(["Tipo","Severidade","Título","Detalhe"],d.items.map(x=>[x.type,x.severity,x.title,x.detail]))
}

async function diagnostico(){
 const d=await api("/unified-v43/health");
 content.innerHTML=`<div class="${d.status==="ok"?"okbox":"warn"}"><b>Status geral: ${esc(d.status.toUpperCase())}</b> — REN-BI Unified ${esc(d.version)}</div>${section("Módulos")}
 <div class="health-grid">${Object.entries(d.modules).map(([k,v])=>`<div class="health"><b>${esc(k)}</b><div class="${v?"positive":"negative"}">${v?"OK":"FALHA"}</div></div>`).join("")}</div>
 ${section("Views analíticas")}
 ${table(["View","Status"],d.views.map(x=>`<tr><td>${esc(x.view)}</td><td><span class="badge ${x.ok?"good":"high"}">${x.ok?"OK":"FALHA"}</span></td></tr>`),d.views.map(x=>[x.view,x.ok?"OK":"FALHA"]))}`
}

const renders={executivo,vendas,compras,precos,clientes,fornecedores,vendedores,estoque,fiscal,dre,tributario,pessoas,prolabore,forecast,alertas,diagnostico};

async function render(){
 loading();setTitle();
 try{
  await renders[currentModule]();
  lastUpdate.textContent="Atualizado em "+new Date().toLocaleTimeString("pt-BR");
 }catch(e){
  content.innerHTML=`<div class="error"><b>Falha ao carregar:</b> ${esc(e.message)}</div>`;
  lastUpdate.textContent="Falha";
 }
}

function exportCSV(){
 if(!lastRows.length){alert("Este módulo não possui tabela exportável carregada.");return}
 const rows=[lastHeaders,...lastRows];
 const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`RENBI_${currentModule}_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)
}

$("#companyBox").innerHTML=`<b>${esc(tenant.name||tenant.code||"Cliente")}</b><br><span>${esc(tenant.code||"")}</span>`;
$$("[data-module]").forEach(b=>b.onclick=()=>{$$("[data-module]").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentModule=b.dataset.module;render();$("#sidebar").classList.remove("open")});
rangeEl.onchange=()=>{$$(".custom").forEach(x=>x.style.display=rangeEl.value==="custom"?"grid":"none");render()};
$("#refreshBtn").onclick=render;$("#printBtn").onclick=()=>window.print();$("#csvBtn").onclick=exportCSV;$("#menuToggle").onclick=()=>$("#sidebar").classList.toggle("open");
$$(".custom").forEach(x=>x.style.display="none");
render();
