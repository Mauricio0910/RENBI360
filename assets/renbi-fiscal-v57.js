/* RENBI360 — extensão fiscal para interface V57. Não altera os módulos existentes. */
(()=>{'use strict';
 const escape=v=>String(v??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const n=v=>Number(v||0).toLocaleString('pt-BR');
 const table=(cols,rows)=>`<div style="overflow:auto;max-width:100%"><table style="width:100%;border-collapse:collapse"><thead><tr>${cols.map(x=>`<th style="padding:9px;text-align:left;border-bottom:1px solid #aaa">${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td style="padding:9px;border-bottom:1px solid #ddd">${escape(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const request=async(path,method='GET',payload)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
   try{
    const response=await fetch(API+path,{method,headers:{'Accept':'application/json','Authorization':'Bearer '+token,...(payload===undefined?{}:{'Content-Type':'application/json'})},body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:`HTTP ${response.status}`);
    return data;
   }finally{clearTimeout(timer)}
 };
 const content=()=>document.getElementById('content');
 const show=(title,body)=>{content().innerHTML=`<div class="card"><div class="card-head"><div class="card-title">${escape(title)}</div></div>${body}</div>`};
 const error=e=>{content().innerHTML=`<div class="card"><h3>Não foi possível carregar o módulo</h3><p>${escape(e.message||e)}</p><p>Confira se a API possui as rotas fiscais /api/v1/v670/sped/ e se o usuário tem acesso.</p></div>`};
 async function sped(){
   show('Auditoria SPED','<p>Consulta fiscal operacional. Os dados não comprovam geração ou transmissão de arquivo SPED.</p><p id="fiscal-msg">Carregando...</p><div id="fiscal-table"></div>');
   try{
    const data=await request('/v670/sped/availability');
    document.getElementById('fiscal-msg').textContent=`Documentos disponíveis: ${n(data.documents)}. Período: ${data.first_date||'—'} até ${data.last_date||'—'}.`;
    document.getElementById('fiscal-table').innerHTML='<p>Para análise detalhada, acesse Compras & Estoque → Auditoria SPED (aba do módulo fiscal existente).</p>';
   }catch(e){error(e)}
 }
 async function sped_pendencias(){
   show('Gestão de Pendências','<p>Ocorrências registradas no DW. Alterações exigem autorização da API.</p><p id="fiscal-msg">Carregando...</p><div id="fiscal-table"></div>');
   const load=async()=>{try{
     const d=await request('/v670/sped/treatment');const rows=d.items||[];
     document.getElementById('fiscal-msg').textContent=`${rows.length} ocorrência(s) registrada(s).`;
     document.getElementById('fiscal-table').innerHTML=table(['ID','Competência','Filial','Verificação','Situação','Prioridade','Responsável'],rows.map(r=>[r.id,r.competencia,r.filial,r.verificacao,r.status,r.prioridade,r.responsavel]));
   }catch(e){error(e)}};await load();
 }
 async function sped_painel(){
   show('Painel Gerencial Fiscal','<p>Indicadores de pendências persistidas no DW.</p><label>Competência <input id="fiscal-period" type="month"></label> <button id="fiscal-refresh" class="secondary">Consultar</button><p id="fiscal-msg">Carregando...</p><div id="fiscal-table"></div>');
   const load=async()=>{try{
     const period=document.getElementById('fiscal-period').value;
     const d=await request('/v670/sped/management'+(period?'?competencia='+encodeURIComponent(period):''));
     document.getElementById('fiscal-msg').textContent=`Total: ${n(d.total)} | Tempo médio: ${d.average_resolution_days??'—'} dias.`;
     const section=(title,obj)=>`<h3>${escape(title)}</h3>`+table(['Categoria','Quantidade'],Object.entries(obj||{}).map(([k,v])=>[k,n(v)]));
     document.getElementById('fiscal-table').innerHTML=section('Por situação',d.status)+section('Por prioridade',d.priority)+section('Por responsável',d.responsibles)+section('Por competência',d.monthly);
   }catch(e){error(e)}};
   document.getElementById('fiscal-refresh').onclick=load;await load();
 }
 R.sped=sped;R.sped_pendencias=sped_pendencias;R.sped_painel=sped_painel;
 titles.sped=['Auditoria SPED','Consulta e disponibilidade dos documentos fiscais.'];
 titles.sped_pendencias=['Gestão de Pendências','Ocorrências fiscais registradas no DW.'];
 titles.sped_painel=['Painel Gerencial Fiscal','Indicadores de acompanhamento fiscal.'];
})();
