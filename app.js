// R² Agenda V4 — API privada via Edge Function; sem Supabase Auth e sem chaves secretas no cliente.
const SUPABASE_URL='https://tfkgwrushshoigyudaqi.supabase.co';
const $=id=>document.getElementById(id);
const labels={negociacao:'Em negociação',confirmada:'Confirmada',realizada:'Realizada',cancelada:'Cancelada',nao_iniciada:'Não iniciada',em_criacao:'Em criação',pronta:'Arte pronta',publicada:'Publicada'};
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Normaliza pesquisas, inclusive nomes com acentos e campos vazios.
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
let session=null,membership=null,events=[],currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1),poller=null,view='calendar';
const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const formatDate=s=>s?s.split('-').reverse().join('/'):'—';
const show=(id,yes)=>$(id).classList.toggle('hidden',!yes);
const message=(id,text,bad=false)=>{$(id).textContent=text;$(id).className='notice '+(bad?'error':'')};
const apiUrl=()=>`${(localStorage.getItem('r2_url')||SUPABASE_URL).replace(/\/$/,'')}/functions/v1/r2-api`;
async function call(action,payload={},token=session){
 const res=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:JSON.stringify({action,...payload})});
 const data=await res.json().catch(()=>({error:'Resposta inválida do servidor'}));
 if(!res.ok)throw Error(data.error||`Erro HTTP ${res.status}`);
 return data;
}
async function boot(){
 if(location.protocol==='file:'){show('setup',true);message('setupMsg','Abra pelo GitHub Pages ou em http://localhost:8000. Arquivos file:// não são aceitos por segurança.',true);return}
 const url=localStorage.getItem('r2_url')||SUPABASE_URL;
 if(!/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(url)){show('setup',true);$('sbUrl').value=url;return}
 session=sessionStorage.getItem('r2_token');
 if(session){try{const d=await call('me');membership=d.user;await enterApp();return}catch{sessionStorage.removeItem('r2_token');session=null}}
 show('auth',true);
}
async function enterApp(){
 $('userLabel').textContent=`${membership.name} · ${membership.role==='comercial'?'Comercial':'Marketing'}`;
 show('auth',false);show('setup',false);show('app',true);
 await loadEvents();if(poller)clearInterval(poller);poller=setInterval(()=>{if(!document.hidden)loadEvents()},20000);
}
async function loadEvents(){if(!session)return;try{const d=await call('list');events=d.events||[];$('syncStatus').textContent='Dados sincronizados · atualização a cada 20 segundos';render()}catch(e){$('syncStatus').textContent='Falha ao sincronizar: '+e.message;if(/Sessão|Conta desativada/.test(e.message))logout()}}
async function logout(){try{if(session)await call('logout')}catch{}session=null;membership=null;sessionStorage.removeItem('r2_token');if(poller)clearInterval(poller);poller=null;show('app',false);show('auth',true)}

let activeFilter='all',editMode='commercial',trashOpen=false;
const liveEvents=()=>events.filter(e=>!e.archived_at);
const archivedEvents=()=>events.filter(e=>!!e.archived_at);
const activeArt=e=>['confirmada','realizada'].includes(e.commercial_status)&&!['pronta','publicada'].includes(e.marketing_status);
function matchesStat(e){return activeFilter==='all'||(activeFilter==='art'?activeArt(e):e.commercial_status===activeFilter)}
function render(){const active=liveEvents().filter(e=>e.commercial_status!=='cancelada');$('statAll').textContent=liveEvents().length;$('statConfirmed').textContent=liveEvents().filter(e=>e.commercial_status==='confirmada').length;$('statArt').textContent=active.filter(activeArt).length;$('statNegotiation').textContent=liveEvents().filter(e=>e.commercial_status==='negociacao').length;document.querySelectorAll('[data-stat]').forEach(b=>b.classList.toggle('active',activeFilter!=='all'&&b.dataset.stat===activeFilter));const cities=[...new Set(liveEvents().map(e=>e.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const old=$('cityFilter').value;$('cityFilter').innerHTML='<option value="">Todas as cidades</option>'+cities.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');$('cityFilter').value=cities.includes(old)?old:'';renderCalendar();renderList();renderMarketing();renderTrash()}
function renderCalendar(){
 const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
 $('monthTitle').textContent=currentMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const first=new Date(y,m,1,12).getDay(),total=new Date(y,m+1,0).getDate();
 let html=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((name,i)=>`<div class="weekday ${i===0?'sunday':i===6?'saturday':''}">${name}</div>`).join('');
 for(let i=0;i<first;i++)html+='<div class="day outside" aria-hidden="true"></div>';
 for(let n=1;n<=total;n++){
  const d=new Date(y,m,n,12),day=isoLocal(d),weekday=d.getDay();
  const items=liveEvents().filter(e=>e.start_date<=day&&e.end_date>=day&&matchesStat(e));
  const cls=weekday===0?'sunday':weekday===6?'saturday':'weekday-day';
  html+=`<div class="day ${cls} ${day===isoLocal(new Date())?'today':''}"><div class="day-heading">${n}</div>${items.map(e=>`<button class="eventchip ${escapeHtml(e.commercial_status)}" data-open="${escapeHtml(e.id)}" title="${escapeHtml(e.name+' — '+(e.city||'')+' — '+(labels[e.commercial_status]||''))}">${escapeHtml(e.name)}</button>`).join('')}</div>`;
 }
 $('calendarGrid').innerHTML=html;
}
function pill(text,cls=''){return `<span class="pill ${cls}">${escapeHtml(text)}</span>`}
function itemHtml(e,marketingMode=false){const late=e.art_deadline&&e.art_deadline<isoLocal(new Date())&&activeArt(e);return `<article class="item"><div><h3>${escapeHtml(e.name)}</h3><p>${formatDate(e.start_date)}${e.end_date!==e.start_date?' a '+formatDate(e.end_date):''} · ${escapeHtml([e.venue,e.city,e.state].filter(Boolean).join(' — ')||'Local a definir')}</p><div class="badges">${pill(labels[e.commercial_status],e.commercial_status==='confirmada'?'good':e.commercial_status==='cancelada'?'bad':'')}${pill('Arte: '+labels[e.marketing_status],['pronta','publicada'].includes(e.marketing_status)?'good':'warn')}${e.art_deadline?pill('Prazo: '+formatDate(e.art_deadline),late?'bad':''):''}</div></div><button class="btn" data-open="${escapeHtml(e.id)}" data-mode="${marketingMode?'marketing':'commercial'}">${marketingMode?'Atualizar marketing':'Abrir feira'}</button></article>`}
function renderList(){const term=normalize($('search').value),status=$('statusFilter').value,city=$('cityFilter').value,month=$('monthFilter').value;const found=liveEvents().filter(e=>matchesStat(e)&&(!status||e.commercial_status===status)&&(!city||e.city===city)&&(!month||e.start_date<=month+'-31'&&e.end_date>=month+'-01')&&(!term||normalize([e.name,e.city,e.venue,e.producer].join(' ')).includes(term)));$('eventsList').innerHTML=found.map(e=>itemHtml(e)).join('')||'<div class="empty">Nenhuma feira encontrada.</div>'}
function renderMarketing(){const term=normalize($('marketingSearch').value),status=$('marketingFilter').value;const found=liveEvents().filter(e=>['confirmada','realizada'].includes(e.commercial_status)&&matchesStat(e)&&(!status||e.marketing_status===status)&&(!term||normalize([e.name,e.city].join(' ')).includes(term))).sort((a,b)=>(a.art_deadline||a.start_date).localeCompare(b.art_deadline||b.start_date));$('marketingList').innerHTML=found.map(e=>itemHtml(e,true)).join('')||'<div class="empty">Nenhuma feira confirmada para divulgar.</div>'}
function renderTrash(){
 const archived=archivedEvents();$('trashCount').textContent=`(${archived.length})`;
 $('trashBox').classList.toggle('hidden',!trashOpen);$('toggleTrash').setAttribute('aria-expanded',String(trashOpen));
 $('trashList').innerHTML=archived.map(e=>`<article class="item trash-item"><div><h3>${escapeHtml(e.name)}</h3><p>${formatDate(e.start_date)} · ${escapeHtml([e.city,e.state].filter(Boolean).join(' / '))}</p><small>Arquivada em: ${e.archived_at?new Date(e.archived_at).toLocaleString('pt-BR'):'—'}</small></div><div class="actions"><button class="btn" data-history="${escapeHtml(e.id)}">Histórico</button>${['commercial','comercial','marketing'].includes(membership?.role)?`<button class="btn primary" data-restore="${escapeHtml(e.id)}">Restaurar feira</button>`:''}</div></article>`).join('')||'<div class="empty">A lixeira está vazia.</div>';
}
async function restoreEvent(id){if(!confirm('Restaurar esta feira para o calendário e as listas?'))return;try{await call('restore',{id});await loadEvents()}catch(e){alert('Não foi possível restaurar: '+e.message)}}
async function showArchivedHistory(id){try{const d=await call('history',{id});const lines=(d.history||[]).map(h=>`${new Date(h.created_at).toLocaleString('pt-BR')} · ${h.actor_name} · ${h.action} · ${(h.changed_fields||[]).join(', ')}`).join('\n');alert(lines||'Nenhum registro de histórico.')}catch(e){alert(e.message)}}
function setView(next){view=next;for(const v of ['calendar','events','marketing'])show(v+'View',v===next);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next))}
const fields={eventName:'name',startDate:'start_date',endDate:'end_date',startTime:'start_time',endTime:'end_time',city:'city',state:'state',venue:'venue',producer:'producer',contact:'contact',fee:'fee',commercial:'commercial_status',marketing:'marketing_status',artDeadline:'art_deadline',artLink:'art_link',notes:'notes'};
const marketingIds=['marketing','artDeadline','artLink'];
function openEvent(id,mode='commercial'){const e=events.find(x=>x.id===id);if(mode==='marketing'&&!e){setView('marketing');return}editMode=mode;$('eventForm').reset();$('eventId').value=e?.id||'';$('modalTitle').textContent=mode==='marketing'?'Acompanhamento de Marketing':e?'Editar feira':'Cadastrar feira';$('formMode').textContent=mode==='marketing'?'Área de Marketing · acesso compartilhado':'Área Comercial · acesso compartilhado';for(const [fid,key] of Object.entries(fields))if(e)$(fid).value=e[key]??(fid==='state'?'RJ':'');if(!e){$('startDate').value=isoLocal(new Date());$('endDate').value=isoLocal(new Date())}$('state').value=e?.state||'RJ';const commercialIds=Object.keys(fields).filter(x=>!marketingIds.includes(x));for(const fid of commercialIds)$(fid).closest('.field').classList.toggle('hidden',mode==='marketing');for(const fid of marketingIds)$(fid).closest('.field').classList.toggle('hidden',mode==='commercial');$('notes').closest('.field').classList.toggle('hidden',mode==='marketing');$('deleteEvent').classList.toggle('hidden',!e||mode==='marketing');$('historyBox').classList.toggle('hidden',!e);message('formMsg','');show('modalBack',true);if(e)loadHistory(e.id);else $('historyList').innerHTML='';for(const fid of ['eventName','startDate','endDate'])$(fid).required=mode==='commercial';(mode==='marketing'?$('marketing'):$('eventName')).focus()}
async function loadHistory(id){$('historyList').textContent='Carregando...';try{const d=await call('history',{id});$('historyList').innerHTML=(d.history||[]).map(h=>`<div class="history-entry"><strong>${escapeHtml(h.actor_name||'Usuário')} · ${escapeHtml(h.action)}</strong><small>${new Date(h.created_at).toLocaleString('pt-BR')}</small><small>${escapeHtml((h.changed_fields||[]).join(', ')||'Registro criado')}</small></div>`).join('')||'<div class="notice">Nenhuma alteração registrada nesta versão.</div>'}catch(e){$('historyList').textContent='Não foi possível carregar histórico: '+e.message}}
function closeModal(){show('modalBack',false)}
function payload(){const all={name:$('eventName').value.trim(),start_date:$('startDate').value,end_date:$('endDate').value,start_time:$('startTime').value||null,end_time:$('endTime').value||null,city:$('city').value.trim(),state:$('state').value,venue:$('venue').value.trim(),producer:$('producer').value.trim(),contact:$('contact').value.trim(),fee:$('fee').value===''?null:Number($('fee').value),commercial_status:$('commercial').value,marketing_status:$('marketing').value,art_deadline:$('artDeadline').value||null,art_link:$('artLink').value.trim()||null,notes:$('notes').value.trim()};return editMode==='marketing'?{marketing_status:all.marketing_status,art_deadline:all.art_deadline,art_link:all.art_link}:Object.fromEntries(Object.entries(all).filter(([k])=>!['marketing_status','art_deadline','art_link'].includes(k)))}
async function saveEvent(ev){ev.preventDefault();const p=payload();if(editMode==='commercial'&&(p.end_date<p.start_date||!p.name)){message('formMsg','Informe o nome e datas válidas.',true);return}const id=$('eventId').value;$('saveEvent').disabled=true;try{await call('save',{event:p,id:id||null,mode:editMode});closeModal();await loadEvents()}catch(e){message('formMsg',e.message,true)}finally{$('saveEvent').disabled=false}}
async function deleteEvent(){const id=$('eventId').value;if(!id||!confirm('Arquivar esta feira? Ela poderá ser restaurada pela Lixeira.'))return;try{await call('delete',{id});closeModal();await loadEvents()}catch(e){message('formMsg',e.message,true)}}
$('saveConfig').onclick=()=>{const url=$('sbUrl').value.trim();if(!/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(url)){message('setupMsg','Informe uma URL Supabase válida.',true);return}localStorage.setItem('r2_url',url.replace(/\/$/,''));location.reload()};
$('loginForm').onsubmit=async e=>{e.preventDefault();const username=$('email').value.trim().toLowerCase();message('loginMsg','Entrando...');try{const d=await call('login',{username,password:$('password').value},null);session=d.token;sessionStorage.setItem('r2_token',session);membership=d.user;$('password').value='';message('loginMsg','');await enterApp()}catch(err){message('loginMsg',err.message,true)}};
$('toggleTrash').onclick=()=>{trashOpen=!trashOpen;renderTrash()};$('logout').onclick=logout;$('newEvent').onclick=()=>openEvent(null,'commercial');$('newMarketing').onclick=()=>setView('marketing');$('closeModal').onclick=closeModal;$('cancelModal').onclick=closeModal;$('eventForm').onsubmit=saveEvent;$('deleteEvent').onclick=deleteEvent;$('prevMonth').onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);renderCalendar()};$('todayBtn').onclick=()=>{currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar()};for(const id of ['search','statusFilter','cityFilter','monthFilter'])$(id).addEventListener('input',renderList);for(const id of ['marketingSearch','marketingFilter'])$(id).addEventListener('input',renderMarketing);document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-stat]').forEach(b=>b.onclick=()=>{activeFilter=activeFilter===b.dataset.stat?'all':b.dataset.stat;setView(activeFilter==='art'?'marketing':'events');render()});document.addEventListener('click',e=>{const r=e.target.closest('[data-restore]');if(r){restoreEvent(r.dataset.restore);return}const h=e.target.closest('[data-history]');if(h){showArchivedHistory(h.dataset.history);return}const b=e.target.closest('[data-open]');if(b)openEvent(b.dataset.open,b.dataset.mode||'commercial')});$('modalBack').addEventListener('click',e=>{if(e.target===$('modalBack'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
boot();
