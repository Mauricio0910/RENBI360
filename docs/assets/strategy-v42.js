const $=q=>document.querySelector(q),content=$("#content");
const tenant=JSON.parse(sessionStorage.getItem("renbi_tenant")||"null"),token=sessionStorage.getItem("renbi_token")||"";
if(!tenant||!tenant.api_base||!token)location.href="./";
const API=String(tenant.api_base).replace(/\/$/,"")+"/api/v1";
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const pct=v=>(Number(v)||0).toFixed(2)+"%";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let tab="tax";
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{Accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+token,...(opt.headers||{})},cache:"no-store"});if(r.status===401){location.href="./";throw Error("Sessão expirada")}const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||("HTTP "+r.status));return d}
function section(t,s=""){return `<div class="section"><h2>${t}</h2><p>${s}</p></div>`}
function kpi(t,v,s=""){return `<div class="card kpi"><small>${t}</small><strong>${v}</strong><small>${s}</small></div>`}
function table(h,r){return `<div class="card table-wrap"><table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${r.join("")}</tbody></table></div>`}
async function tax(){
 const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
 content.innerHTML=`${section("Comparador tributário","Simulação gerencial com regras parametrizadas e dados reais de faturamento do ERP.")}
 <div class="card form"><label>Ano<input id="ty" type="number" value="${y}"></label><label>Mês<input id="tm" type="number" min="1" max="12" value="${m}"></label><label>Lucro tributável p/ Lucro Real<input id="rp" type="number" value="0" step=".01"></label><label>Base elegível de créditos PIS/COFINS<input id="rc" type="number" value="0" step=".01"></label><button id="runTax">Simular</button></div><div id="taxResult"></div>`;
 async function run(){
  $("#taxResult").innerHTML='<div class="card">Calculando...</div>';
  const d=await api(`/strategy-v42/tax-comparison?year=${$("#ty").value}&month=${$("#tm").value}&real_taxable_profit=${$("#rp").value}&real_pis_cofins_credit_base=${$("#rc").value}`);
  const s=d.simple_national,p=d.presumed_profit,r=d.real_profit,b=d.lowest_estimated_total;
  $("#taxResult").innerHTML=`<div class="warn">${esc(d.disclaimer)}</div>
  <div class="grid">${kpi("Faturamento mensal",money(d.month_revenue),d.competence)}${kpi("RBT12 anterior",money(d.rbt12_previous_12_months))}${kpi("Menor estimativa",esc(b?.regime||"-"),money(b?.value||0))}${kpi("ICMS registrado no ERP",money(d.actual_erp_tax_values.icms))}</div>
  ${section("Comparação")}
  <div class="grid">
   <div class="card ${b?.regime==="Simples Nacional"?"best":""}"><b>Simples Nacional</b>${s.eligible?`<h2>${money(s.estimated_month_tax)}</h2><div>Alíquota efetiva: ${pct(s.effective_rate_pct)}</div><div>RBT12: ${money(s.rbt12)}</div>`:`<h3>Não simulado</h3><div>${esc(s.reason)}</div>`}<small>${esc(s.note||"")}</small></div>
   <div class="card ${b?.regime==="Lucro Presumido"?"best":""}"><b>Lucro Presumido</b><h2>${money(p.estimated_month_total)}</h2><div>Efetiva equivalente: ${pct(p.effective_month_rate_pct)}</div><div>IRPJ trimestre: ${money(p.irpj_quarter)}</div><div>CSLL trimestre: ${money(p.csll_quarter)}</div><div>PIS mês: ${money(p.pis_month)}</div><div>COFINS mês: ${money(p.cofins_month)}</div><small>${esc(p.note)}</small></div>
   <div class="card ${b?.regime==="Lucro Real"?"best":""}"><b>Lucro Real</b><h2>${money(r.estimated_month_total)}</h2><div>Efetiva: ${pct(r.effective_month_rate_pct)}</div><div>IRPJ: ${money(r.irpj)}</div><div>CSLL: ${money(r.csll)}</div><div>PIS: ${money(r.pis)}</div><div>COFINS: ${money(r.cofins)}</div><small>${esc(r.note)}</small></div>
   <div class="card"><b>Reforma 2026</b><h2>${d.tax_reform_transition.year===2026?"Ano-teste":"-"}</h2><div>CBS teste: ${d.tax_reform_transition.cbs_test_pct??"-"}%</div><div>IBS teste: ${d.tax_reform_transition.ibs_test_pct??"-"}%</div><div>CBS informativa: ${money(d.tax_reform_transition.cbs_test_value)}</div><div>IBS informativo: ${money(d.tax_reform_transition.ibs_test_value)}</div><small>${esc(d.tax_reform_transition.note)}</small></div>
  </div>`;
 }
 $("#runTax").onclick=run;await run()
}
async function dre(){
 content.innerHTML=`${section("DRE estruturada","Mapeie as categorias financeiras do ERP para as linhas da DRE. O mapeamento fica salvo somente no REN-BI.")}
 <div class="card form"><label>De<input id="ds" type="date"></label><label>Até<input id="de" type="date"></label><button id="runDre">Gerar DRE</button><button id="saveMap">Salvar mapeamento</button></div><div id="dreResult"></div><div id="mapResult"></div>`;
 const now=new Date(),a=new Date(now.getFullYear(),now.getMonth(),1);$("#ds").value=a.toISOString().slice(0,10);$("#de").value=now.toISOString().slice(0,10);
 const cats=await api("/strategy-v42/dre/categories");
 const labels={deductions:"Deduções/tributos sobre vendas",selling_expenses:"Despesas de vendas",administrative_expenses:"Despesas administrativas",financial_expenses:"Despesas financeiras",financial_revenues:"Receitas financeiras",other_operating_expenses:"Outras despesas operacionais",other_operating_revenues:"Outras receitas operacionais",income_tax:"IR/CSLL",participations:"Participações",ignore:"Ignorar"};
 $("#mapResult").innerHTML=`${section("Mapeamento do plano financeiro","Classifique as categorias mais relevantes.")}
 ${table(["Categoria ERP","Valor histórico","Lançamentos","Linha DRE"],cats.categories.map((x,i)=>`<tr><td>${esc(x.category)}</td><td class="num">${money(x.total_value)}</td><td>${x.entries}</td><td><select class="map-select" data-cat="${esc(x.category)}"><option value="">Não mapeado</option>${cats.allowed_lines.map(v=>`<option value="${v}" ${x.mapped_to===v?"selected":""}>${esc(labels[v]||v)}</option>`).join("")}</select></td></tr>`))}`;
 $("#saveMap").onclick=async()=>{const mapping={};document.querySelectorAll(".map-select").forEach(s=>{if(s.value)mapping[s.dataset.cat]=s.value});await api("/strategy-v42/dre/mapping",{method:"POST",body:JSON.stringify({mapping})});alert("Mapeamento salvo.")};
 $("#runDre").onclick=async()=>{const d=await api(`/strategy-v42/dre/structured?start=${$("#ds").value}&end=${$("#de").value}`),s=d.statement;$("#dreResult").innerHTML=`<div class="warn ${d.status==="validated"?"ok":""}">Cobertura do mapeamento: <b>${pct(d.mapping_coverage_pct)}</b>. ${esc(d.note)}</div>${table(["Linha","Valor"],[["Receita bruta",s.gross_revenue],["(-) Deduções",s.sales_deductions],["Receita líquida",s.net_revenue],["(-) CMV",s.cogs],["Lucro bruto",s.gross_profit],["Despesas de vendas",s.selling_expenses],["Despesas administrativas",s.administrative_expenses],["Outras despesas operacionais",s.other_operating_expenses],["Outras receitas operacionais",s.other_operating_revenues],["Resultado financeiro",s.financial_result],["Resultado antes IR/CSLL",s.result_before_income_tax],["IR/CSLL",s.income_tax],["Participações",s.participations],["Resultado líquido",s.net_result]].map(x=>`<tr><td>${x[0]}</td><td class="num">${money(x[1])}</td></tr>`))}`};await $("#runDre").onclick()
}
async function payroll(){
 const p=await api("/strategy-v42/payroll/parameters");
 content.innerHTML=`${section("Custo de colaboradores","Parâmetros ajustáveis. Salários vêm do cadastro FUNCIONARIO.")}
 <div class="card form">${[["employer_inss_pct","INSS patronal %"],["fgts_pct","FGTS %"],["rat_pct","RAT %"],["third_parties_pct","Terceiros %"],["thirteenth_provision_pct","Provisão 13º %"],["vacation_provision_pct","Provisão férias + 1/3 %"],["other_monthly_cost","Outros custos mensais R$"]].map(([k,l])=>`<label>${l}<input id="${k}" type="number" step=".0001" value="${p[k]}"></label>`).join("")}<button id="savePayroll">Salvar e calcular</button></div><div id="payResult"></div>`;
 async function calc(){const d=await api("/strategy-v42/payroll/cost"),c=d.components;$("#payResult").innerHTML=`<div class="warn">${esc(d.note)}</div><div class="grid">${kpi("Funcionários ativos",d.employees)}${kpi("Folha salarial",money(c.salary_base))}${kpi("Encargos/provisões",money(d.estimated_total_monthly_cost-c.salary_base))}${kpi("Custo mensal estimado",money(d.estimated_total_monthly_cost))}</div>${table(["Componente","Valor"],Object.entries(c).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`))}`};$("#savePayroll").onclick=async()=>{const body={};["employer_inss_pct","fgts_pct","rat_pct","third_parties_pct","thirteenth_provision_pct","vacation_provision_pct","other_monthly_cost"].forEach(k=>body[k]=Number($("#"+k).value||0));await api("/strategy-v42/payroll/parameters",{method:"POST",body:JSON.stringify(body)});await calc()};await calc()
}
async function prolabore(){
 content.innerHTML=`${section("Pró-labore","Simulador parametrizado; o SUPERSCE não possui valores de pró-labore.")}
 <div class="card form"><label>Pró-labore bruto<input id="pg" type="number" value="0" step=".01"></label><label>INSS sócio %<input id="pi" type="number" value="11" step=".01"></label><label>INSS patronal %<input id="pe" type="number" value="20" step=".01"></label><button id="runPro">Simular</button></div><div id="proResult"></div>`;
 $("#runPro").onclick=async()=>{const d=await api(`/strategy-v42/prolabore/simulate?gross_value=${$("#pg").value}&partner_inss_pct=${$("#pi").value}&employer_inss_pct=${$("#pe").value}`);$("#proResult").innerHTML=`<div class="warn">${esc(d.note)}</div><div class="grid">${kpi("Pró-labore bruto",money(d.gross_prolabore))}${kpi("INSS sócio estimado",money(d.partner_inss_estimate))}${kpi("INSS patronal estimado",money(d.employer_inss_estimate))}${kpi("Custo estimado empresa",money(d.estimated_company_cost))}</div>`};await $("#runPro").onclick()
}
const renders={tax,dre,payroll,prolabore};
async function render(){try{await renders[tab]()}catch(e){content.innerHTML=`<div class="warn"><b>Falha:</b> ${esc(e.message)}</div>`}}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=b.dataset.tab;render()});render();
