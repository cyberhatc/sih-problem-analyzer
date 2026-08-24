const DATA = window.PROBLEM_DATA || [];

const state = {
  cat: 'All', cmp: 'All', win: 'All', theme: 'All', tech: 'All',
  st: 'All', sort: 'sno', search: '', winMode: false
};

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const THEME_EMOJI = {
  'Disaster Management':'🛡️','Smart Automation':'⚙️','Space Technology':'🚀',
  'MedTech / BioTech / HealthTech':'🩺','Smart Education':'📚',
  'Agriculture, FoodTech & Rural Development':'🌾','Robotics and Drones':'🤖',
  'Transportation & Logistics':'🚚','Fitness & Sports':'🏅','Heritage & Culture':'🏛️',
  'Travel & Tourism':'🧭','Smart Resource Conservation':'🌿','Smart Vehicles':'🚗',
  'Renewable / Sustainable Energy':'⚡','Clean & Green Technology':'♻️','Toys & Games':'🎮',
  'Blockchain & Cybersecurity':'🔐','Miscellaneous':'🧩'
};
const CMP_COLOR = { Easy:'var(--green)', Medium:'var(--amber)', Hard:'var(--red)' };
const CAT_ICON = { Software:'💻', Hardware:'🔧' };

/* ---------- shared status (4 levels, stored in Vercel KV) ---------- */
const STATUS_LEVELS = [
  { key:'rejected', label:'Rejected' },
  { key:'probably', label:'Probably' },
  { key:'maybe',    label:'Maybe' },
  { key:'selected', label:'Selected' }
];
const STATUS_LABEL = Object.fromEntries(STATUS_LEVELS.map(l=>[l.key,l.label]));
const STATUS_COLOR = {
  rejected:'var(--red)', probably:'var(--amber)',
  maybe:'var(--soft)', selected:'var(--green)'
};
const statusMap = {};   // { "PS123": "selected", ... }

function statusControl(ps){
  const cur = statusMap[ps] || '';
  const btns = STATUS_LEVELS.map(l=>
    `<button class="st-btn ${l.key} ${cur===l.key?'active':''}" data-ps="${esc(ps)}" data-status="${l.key}">${l.label}</button>`
  ).join('');
  const clear = cur ? `<button class="st-btn clear" data-ps="${esc(ps)}" data-status="">✕</button>` : '';
  return `<div class="status-seg" data-ps="${esc(ps)}">${btns}${clear}</div>`;
}

async function loadStatus(){
  try{
    const r = await fetch('/api/status');
    const data = await r.json();
    Object.assign(statusMap, data || {});
    apply();
    if(!$('#modal').hidden) refreshModalStatus();
  }catch(e){ /* offline / not configured: statuses just won't show */ }
}

async function setStatus(ps, status){
  statusMap[ps] = status || undefined;
  if(!status) delete statusMap[ps];
  // optimistic UI
  syncStatusButtons(ps);
  applyCardStatus(ps);
  try{
    await fetch('/api/status', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ps, status })
    });
    const r = await fetch('/api/status');
    Object.assign(statusMap, await r.json() || {});
    syncStatusButtons(ps);
    applyCardStatus(ps);
  }catch(e){ /* keep optimistic value if backend unreachable */ }
}

/* colour the card (and open modal) by status so it's identifiable from afar */
function applyCardStatus(ps){
  const st = statusMap[ps] || '';
  const card = $(`.card[data-ps="${cssEscape(ps)}"]`);
  if(card){
    card.classList.remove('st-rejected','st-probably','st-maybe','st-selected');
    if(st){
      card.classList.add('st-'+st);
      card.style.borderLeftColor = STATUS_COLOR[st];
      let f = $('.st-flag', card);
      if(!f){ f = document.createElement('div'); f.className='st-flag'; card.appendChild(f); }
      f.className = 'st-flag '+st; f.textContent = STATUS_LABEL[st];
    }else{
      card.style.borderLeftColor = '';
      const f = $('.st-flag', card); if(f) f.remove();
    }
  }
  const box = $('#modalBody');
  if(box && !$('#modal').hidden){
    box.classList.remove('st-rejected','st-probably','st-maybe','st-selected');
    if(st){ box.classList.add('st-'+st); box.style.borderLeftColor = STATUS_COLOR[st]; }
    else { box.style.borderLeftColor = 'var(--line)'; }
    let f = $('.st-flag', box);
    if(st){ if(!f){ f=document.createElement('div'); f.className='st-flag'; box.insertBefore(f, box.firstChild); } f.className='st-flag '+st; f.textContent=STATUS_LABEL[st]; }
    else if(f){ f.remove(); }
  }
}

function syncStatusButtons(ps){
  $$(`.status-seg[data-ps="${cssEscape(ps)}"] .st-btn`).forEach(b=>{
    b.classList.toggle('active', b.dataset.status === (statusMap[ps]||''));
  });
}
function cssEscape(s){ return (s||'').replace(/["\\]/g,'\\$&'); }

/* ---------- description parser ---------- */
function fixBullets(t){ return t.replace(/\s0\s(?=[A-Z][a-z])/g, ' • '); }

function splitBullets(s){
  const i = s.indexOf('•');
  if(i < 0) return { lead: s.trim(), items: null };
  const lead = s.slice(0, i).trim();
  const items = s.slice(i).split('•').map(x=>x.trim()).filter(x=>x.length>1);
  return { lead, items };
}
function renderBulletSection(s){
  const { lead, items } = splitBullets(s);
  let h = '';
  if(lead) h += `<p>${esc(lead)}</p>`;
  if(items) h += `<ul class="dlist">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`;
  return h;
}
function parseLettered(s){
  const re=/([^a-z0-9])([a-z])\.\s*/g; const pos=[]; let m;
  while((m=re.exec(s))) pos.push(m.index + m[1].length);
  if(pos.length < 2) return null;
  const items=[];
  for(let i=0;i<pos.length;i++){
    const start = pos[i] + 2;
    const end = (i+1<pos.length) ? pos[i+1] : s.length;
    const txt = s.slice(start, end).trim();
    if(txt) items.push(txt);
  }
  return { items, firstIdx: pos[0] };
}
function renderLettered(items){
  const lis = items.map(it=>{
    const { lead, items:bul } = splitBullets(it);
    let inner = lead ? `<span>${esc(lead)}</span>` : '';
    if(bul) inner += `<ul class="dlist nested">${bul.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`;
    return `<li>${inner}</li>`;
  }).join('');
  return `<ol class="dlist lettered">${lis}</ol>`;
}
function formatDesc(raw){
  let t = fixBullets(raw || '');
  const headRe=/(Background|Description|Detailed Description|Problem Description|Expected Solution)\s*:/gi;
  const hs=[]; let mm;
  while((mm=headRe.exec(t))) hs.push({ name:mm[1], start:mm.index, end:mm.index+mm[0].length });
  if(!hs.length) return `<div class="dsec">${renderBulletSection(t)}</div>`;
  let html='';
  for(let i=0;i<hs.length;i++){
    const content = t.slice(hs[i].end, (i+1<hs.length)?hs[i+1].start : t.length).trim();
    const label = hs[i].name.replace(/^(Detailed |Problem )/i,'');
    let body='';
    if(/expected/i.test(hs[i].name)){
      body = renderBulletSection(content);
    } else {
      const res = parseLettered(content);
      if(res){
        const intro = content.slice(0, res.firstIdx).trim();
        body = (intro?`<p>${esc(intro)}</p>`:'') + renderLettered(res.items);
      } else {
        body = renderBulletSection(content);
      }
    }
    html += `<div class="dsec"><h4>${esc(label)}</h4>${body}</div>`;
  }
  return html;
}

/* ---------- selects ---------- */
const themes = [...new Set(DATA.map(d=>d.Theme))].sort();
const techs  = [...new Set(DATA.flatMap(d=>d.tech_stack))].sort();
themes.forEach(t => $('#themeSel').add(new Option(t, t)));
techs.forEach(t => $('#techSel').add(new Option(t.toUpperCase(), t)));

/* ---------- stats ---------- */
function renderStats(){
  const c=DATA.length, sw=DATA.filter(d=>d.Category==='Software').length,
        hw=DATA.filter(d=>d.Category==='Hardware').length,
        ez=DATA.filter(d=>d.complexity_level==='Easy').length,
        md=DATA.filter(d=>d.complexity_level==='Medium').length,
        hd=DATA.filter(d=>d.complexity_level==='Hard').length;
  $('#stats').innerHTML = `
    <div class="stat"><div class="n">${c}</div><div class="l">Total PS</div></div>
    <div class="stat sw"><div class="n">${sw}</div><div class="l">Software</div></div>
    <div class="stat hw"><div class="n">${hw}</div><div class="l">Hardware</div></div>
    <div class="stat ez"><div class="n">${ez}</div><div class="l">Easy</div></div>
    <div class="stat md"><div class="n">${md}</div><div class="l">Medium</div></div>
    <div class="stat hd"><div class="n">${hd}</div><div class="l">Hard</div></div>`;
}

/* ---------- filter + sort ---------- */
function apply(){
  let list = DATA.filter(d=>{
    if(state.cat!=='All' && d.Category!==state.cat) return false;
    if(state.cmp!=='All' && d.complexity_level!==state.cmp) return false;
    if(state.win!=='All' && d.winnability_tier!==state.win) return false;
    if(state.theme!=='All' && d.Theme!==state.theme) return false;
    if(state.tech!=='All' && !d.tech_stack.includes(state.tech)) return false;
    if(state.st==='notselected'){ if((statusMap[d['PS Number']]||'')!=='') return false; }
    else if(state.st!=='All' && (statusMap[d['PS Number']]||'') !== state.st) return false;
    if(state.search){
      const q=state.search.toLowerCase();
      const hay=(d['Problem Statement Title']+' '+d.Organization+' '+d['PS Number']).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters={
    sno:(a,b)=>(+a['S.No.'])-(+b['S.No.']),
    win_desc:(a,b)=>b.winnability_score-a.winnability_score,
    cmp_desc:(a,b)=>b.complexity_score-a.complexity_score,
    cmp_asc:(a,b)=>a.complexity_score-b.complexity_score,
    theme:(a,b)=>a.Theme.localeCompare(b.Theme)
  };
  list.sort(sorters[state.sort]||sorters.sno);
  render(list);
}

/* ---------- win hint ---------- */
function whyWin(d){
  const bits=[];
  bits.push(d.submitted_ideas===0?'Zero submissions → low competition':`${d.submitted_ideas} ideas in`);
  if(d.complexity_level==='Easy') bits.push('Scope is finishable in a hackathon');
  else if(d.complexity_level==='Medium') bits.push('Balanced scope & novelty');
  else bits.push('High novelty, needs deep expertise');
  if(d.requirements_count>=4) bits.push('Clear deliverables defined');
  if(d.winnability_tier==='High') bits.push('→ Strong pick for a focused team');
  return bits.join(' · ');
}

/* ---------- render cards ---------- */
function render(list){
  const grid=$('#grid');
  $('#count').textContent=list.length;
  grid.innerHTML=list.map((d,i)=>{
    const ranked=state.winMode;
    const rank=ranked?`<div class="rank-badge">#${i+1} WIN</div>`:'';
    const chips=d.tech_stack.map(t=>`<span class="chip">${esc(t.toUpperCase())}</span>`).join('');
    const emoji=THEME_EMOJI[d.Theme]||'🧩';
    const acc=CMP_COLOR[d.complexity_level];
    const st = statusMap[d['PS Number']] || '';
  const borderColor = st ? STATUS_COLOR[st] : acc;
  const flag = st ? `<div class="st-flag ${st}">${STATUS_LABEL[st]}</div>` : '';
  return `<article class="card ${ranked?'ranked':''} ${st?'st-'+st:''}" data-ps="${esc(d['PS Number'])}" style="border-left:4px solid ${borderColor}">
      ${rank}
      ${flag}
      <div class="card-head">
        <span class="ic">${CAT_ICON[d.Category]||'💡'}</span>
        <div>
          <div class="psno">${esc(d['PS Number'])} · S.No. ${esc(d['S.No.'])} · ${emoji} ${esc(d.Theme)}</div>
          <div class="title">${esc(d['Problem Statement Title'])}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge b-cat ${esc(d.Category)}">${esc(d.Category)}</span>
        <span class="badge b-cmp ${esc(d.complexity_level)}">${esc(d.complexity_level)} Complexity</span>
        <span class="badge b-win ${esc(d.winnability_tier)}">${esc(d.winnability_tier)} Win</span>
      </div>
      <div class="chips">${chips}</div>
      <div class="meta">
        <span><b>Org:</b> ${esc(d.Organization)}</span>
        <span><b>Deadline:</b> ${esc(d['Deadline for Idea Submission'])} · <b>Entries:</b> ${esc(d['Submitted Idea(s) Count'])}</span>
      </div>
      <div class="scores">
        <span class="slabel">Win</span>
        <span class="bar win"><i style="width:${d.winnability_score}%"></i></span>
        <span class="sval">${d.winnability_score}</span>
      </div>
      <div class="scores">
        <span class="slabel">Complex</span>
        <span class="bar cmp"><i style="width:${d.complexity_score}%"></i></span>
        <span class="sval">${d.complexity_score}</span>
      </div>
      <div class="why">💡 ${whyWin(d)}</div>
      <div class="desc">${formatDesc(d.Description)}</div>
      ${statusControl(d['PS Number'])}
      <div style="display:flex;gap:8px;align-items:center">
        <button class="toggle">Show more ▾</button>
        <button class="open-btn" data-ps="${esc(d['PS Number'])}">Open ⤢</button>
      </div>
    </article>`;
  }).join('');

  $$('.toggle',grid).forEach(btn=>{
    btn.onclick=()=>{
      const card=btn.closest('.card');
      const dd=$('.desc',card);
      const open=dd.classList.toggle('open');
      btn.textContent=open?'Show less ▴':'Show more ▾';
    };
  });
}

/* ---------- top picks ---------- */
function renderTopPicks(){
  const box=$('#topPicks');
  if(!state.winMode){ box.classList.remove('show'); box.innerHTML=''; return; }
  const top=[...DATA].sort((a,b)=>b.winnability_score-a.winnability_score).slice(0,5);
  box.classList.add('show');
  box.innerHTML=`<div style="font-weight:700;margin:6px 0 4px;color:var(--amber)">🏆 Top 5 statements to WIN (by win-rate score)</div>`+
    top.map((d,i)=>`<div class="tp-card" data-ps="${esc(d['PS Number'])}">
      <div class="tp-rank">${i+1}</div>
      <div class="tp-meta"><div class="t">${esc(d['Problem Statement Title'])}</div>
        <div class="s">${esc(d['PS Number'])} · ${esc(d.Category)} · ${esc(d.Theme)} · ${esc(d.complexity_level)}</div></div>
      <div class="tp-score">${d.winnability_score}</div>
    </div>`).join('');
}

/* ---------- detail modal ---------- */
function openModal(d){
  const emoji=THEME_EMOJI[d.Theme]||'🧩';
  const chips=d.tech_stack.map(t=>`<span class="chip">${esc(t.toUpperCase())}</span>`).join('');
  const st = statusMap[d['PS Number']] || '';
  const borderColor = st ? STATUS_COLOR[st] : 'var(--line)';
  const flag = st ? `<div class="st-flag ${st}">${STATUS_LABEL[st]}</div>` : '';
  const box = $('#modalBody');
  box.className = 'modal-body ' + (st ? 'st-'+st : '');
  box.style.borderLeft = `6px solid ${borderColor}`;
  box.innerHTML=`
    ${flag}
    <div class="card-head">
      <span class="ic">${CAT_ICON[d.Category]||'💡'}</span>
      <div>
        <div class="psno">${esc(d['PS Number'])} · S.No. ${esc(d['S.No.'])} · ${emoji} ${esc(d.Theme)}</div>
        <div class="title" style="font-size:18px;margin-top:3px">${esc(d['Problem Statement Title'])}</div>
      </div>
    </div>
    <div class="badges">
      <span class="badge b-cat ${esc(d.Category)}">${esc(d.Category)}</span>
      <span class="badge b-cmp ${esc(d.complexity_level)}">${esc(d.complexity_level)} Complexity</span>
      <span class="badge b-win ${esc(d.winnability_tier)}">${esc(d.winnability_tier)} Win</span>
    </div>
    <div class="chips">${chips}</div>
    <div class="meta">
      <span><b>Organization:</b> ${esc(d.Organization)}</span>
      <span><b>Department:</b> ${esc(d.Department)}</span>
      <span><b>Deadline:</b> ${esc(d['Deadline for Idea Submission'])}</span>
      <span><b>Entries:</b> ${esc(d['Submitted Idea(s) Count'])}</span>
    </div>
    <div class="scores"><span class="slabel">Win</span><span class="bar win"><i style="width:${d.winnability_score}%"></i></span><span class="sval">${d.winnability_score}</span></div>
    <div class="scores"><span class="slabel">Complex</span><span class="bar cmp"><i style="width:${d.complexity_score}%"></i></span><span class="sval">${d.complexity_score}</span></div>
    <div class="why">💡 ${whyWin(d)}</div>
    <div class="desc open" style="max-height:none">${formatDesc(d.Description)}</div>
    ${statusControl(d['PS Number'])}`;
  $('#modal').hidden=false;
  document.body.style.overflow='hidden';
}
function closeModal(){
  $('#modal').hidden=true;
  document.body.style.overflow='';
}

/* delegated open triggers (top picks + card "Open" buttons) */
document.addEventListener('click', e=>{
  if(e.target.closest('.status-seg')) return;
  const trig=e.target.closest('[data-ps]');
  if(trig){
    const rec=DATA.find(d=>d['PS Number']===trig.dataset.ps);
    if(rec){ openModal(rec); return; }
  }
  if(e.target.id==='modalClose' || e.target.id==='modal') closeModal();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#modal').hidden) closeModal(); });

/* ---------- status control clicks ---------- */
document.addEventListener('click', e=>{
  const btn = e.target.closest('.st-btn');
  if(btn){
    e.stopPropagation();
    setStatus(btn.dataset.ps, btn.dataset.status);
  }
});

/* keep modal status control in sync if data changes */
function refreshModalStatus(){
  $$('#modalBody .status-seg').forEach(seg=>syncStatusButtons(seg.dataset.ps));
}

/* ---------- events ---------- */
$('#catSeg').addEventListener('click',e=>{
  if(e.target.tagName!=='BUTTON')return;
  $$('#catSeg button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); state.cat=e.target.dataset.cat; apply();
});
$('#cmpSeg').addEventListener('click',e=>{
  if(e.target.tagName!=='BUTTON')return;
  $$('#cmpSeg button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); state.cmp=e.target.dataset.cmp; apply();
});
$('#statusSeg').addEventListener('click',e=>{
  if(e.target.tagName!=='BUTTON')return;
  $$('#statusSeg button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); state.st=e.target.dataset.st; apply();
});
$('#winSeg').addEventListener('click',e=>{
  if(e.target.tagName!=='BUTTON')return;
  $$('#winSeg button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); state.win=e.target.dataset.win; apply();
});
$('#themeSel').onchange=e=>{ state.theme=e.target.value; apply(); };
$('#techSel').onchange=e=>{ state.tech=e.target.value; apply(); };
$('#sortSel').onchange=e=>{ state.sort=e.target.value; apply(); };
$('#search').oninput=e=>{ state.search=e.target.value.trim(); apply(); };

$('#winModeBtn').onclick=()=>{
  state.winMode=!state.winMode;
  const btn=$('#winModeBtn');
  btn.classList.toggle('on',state.winMode);
  btn.textContent=state.winMode?'🏆 Win Mode: ON':'🏆 Win Mode: OFF';
  if(state.winMode){
    state.sort='win_desc'; $('#sortSel').value='win_desc';
    $$('#winSeg button').forEach(b=>b.classList.remove('active'));
    $('#winSeg [data-win="All"]').classList.add('active'); state.win='All';
  }
  renderTopPicks(); apply();
};

renderStats();
apply();
loadStatus();
