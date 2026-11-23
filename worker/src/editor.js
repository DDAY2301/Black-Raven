/* Authenticated editor UI. Served only after Cloudflare Access JWT verification. */
export const editorHtml = String.raw`<!doctype html>
<html lang="sl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Black Raven — uredništvo</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,sans-serif;font-size:16px;background:#0e1d15;color:#f3f5ef}
*{box-sizing:border-box}body{margin:0}header{background:#13291c;border-bottom:1px solid #35513b;padding:1.4rem max(1.2rem,calc((100% - 1100px)/2))}
header span{color:#b2c3ad;font-size:.85rem;letter-spacing:.14em;text-transform:uppercase}
h1{margin:.2rem 0;font-family:Georgia,serif;font-size:2rem}
main{max-width:1100px;margin:1.8rem auto;padding:0 1.2rem 3rem}
a{color:#e6ba85}button,input,textarea,select{font:inherit}button{cursor:pointer}
.tabs{display:flex;gap:.7rem;margin-bottom:1rem;flex-wrap:wrap}
.tabs button,.primary,.secondary,.danger{border:1px solid #6b8c70;border-radius:7px;color:#f4f6ec;background:#25462c;padding:.75rem 1rem}
.tabs button[aria-selected=true],.primary{background:#b77a46;border-color:#b77a46;color:#121e15;font-weight:800}
.secondary{background:#29402f}.danger{background:#67302c;border-color:#9c4f45}
.layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(270px,.8fr);gap:1rem}
.panel{border:1px solid #3e5843;border-radius:12px;background:#193023;padding:1.5rem}
.panel h2{margin:0 0 1rem;font-size:1.3rem}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}
label{display:grid;gap:.4rem;font-size:.93rem;font-weight:650}
label.wide{grid-column:1/-1}
input:not([type=checkbox]),textarea,select{width:100%;min-height:2.7rem;padding:.65rem;background:#0e2117;border:1px solid #69816e;border-radius:7px;color:#fff}
textarea{min-height:7rem;resize:vertical}
label.check{display:flex;align-items:center;gap:.5rem}
label.check input{width:1.2rem;height:1.2rem}
.actions{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.25rem}
#status{min-height:1.5rem;color:#f6d3a3}
.entries{display:grid;gap:.75rem}
.entry{border:1px solid #43644a;border-radius:8px;padding:1rem;display:grid;gap:.6rem}
.entry strong{display:block;font-size:1rem}
.entry span{color:#b5c7b7;font-size:.82rem}
.entry div{display:flex;gap:.45rem;flex-wrap:wrap}
.entry button{font-size:.86rem;padding:.45rem .7rem;border:1px solid #819982;background:transparent;border-radius:6px;color:#fff}
.intro{line-height:1.65;color:#bbcbbd;margin:0 0 1.1rem}
@media(max-width:760px){.layout{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}}
</style></head><body>
<header><span>BLACK RAVEN / PRIVATE EDITOR</span><h1>Uredništvo in koledar</h1></header>
<main>
<p class="intro">Dostop je dovoljen samo potrjenim urednikom prek Cloudflare Access. Objavljeni zapisi se prikazujejo na spletni strani, osnutki ostajajo zasebni. Ne objavljaj nepotrjenih Facebook terminov.</p>
<div class="tabs" role="tablist" aria-label="Vrsta vsebine">
<button id="tab-events" type="button" role="tab" aria-selected="true">Dogodki in tečaji</button>
<button id="tab-posts" type="button" role="tab" aria-selected="false">Blog in novice</button>
</div>
<div class="layout">
<section class="panel" aria-labelledby="form-title">
<h2 id="form-title">Dodaj dogodek</h2>
<form id="entry-form"><div class="form-grid" id="form-fields"></div>
<div class="actions"><button class="primary" type="submit">Dodaj v seznam</button><button class="secondary" id="reset-form" type="button">Počisti obrazec</button><button class="secondary" id="save-list" type="button">Shrani vse spremembe</button></div></form>
<p id="status" role="status" aria-live="polite"></p>
</section>
<section class="panel"><h2>Pripravljeni zapisi</h2><p class="intro">Shrani spremembe po dodajanju, urejanju ali odstranitvi. Pred objavo preveri termin, lokacijo in vir.</p><div id="entries" class="entries"></div></section>
</div></main>
<script>
(() => {
  'use strict';
  const schemas = {
    events: [
      ['titleSl','Naslov (SL)','text',true],['titleEn','Title (EN)','text'],
      ['startDate','Začetek','date',true],['endDate','Konec','date'],
      ['location','Lokacija','text'],
      ['descriptionSl','Opis (SL)','textarea'],['descriptionEn','Description (EN)','textarea'],
      ['sourceUrl','Vir (https)','url'],['registrationUrl','Povezava za prijavo (https)','url'],
      ['confirmed','Organizator je potrdil termin','checkbox']
    ],
    posts: [
      ['titleSl','Naslov (SL)','text',true],['titleEn','Title (EN)','text'],
      ['publishedAt','Datum objave','date',true],
      ['excerptSl','Povzetek (SL)','textarea'],['excerptEn','Summary (EN)','textarea'],
      ['bodySl','Besedilo članka (SL)','textarea'],
      ['bodyEn','Article body (EN)','textarea'],
      ['coverUrl','Fotografija — licenciran https URL','url'],
      ['sourceUrl','Vir ali podrobnosti (https)','url']
    ]
  };
  const $ = id => document.getElementById(id);
  let type = 'events', list = [], version = '', editId = '';
  const fields = $('form-fields'), status = $('status'), entries = $('entries');
  function message(s) { status.textContent = s; }
  function renderForm() {
    fields.replaceChildren();
    const statusLabel = document.createElement('label');
    statusLabel.className = 'wide'; statusLabel.textContent = 'Status';
    const select = document.createElement('select'); select.name = 'status';
    [['draft','Osnutek'],['published','Objavljeno']].forEach(pair => {
      const option = document.createElement('option'); option.value=pair[0]; option.textContent=pair[1]; select.append(option);
    });
    statusLabel.append(select); fields.append(statusLabel);
    schemas[type].forEach(spec => {
      const [name, title, inputType, required] = spec;
      const label = document.createElement('label');
      label.className = inputType === 'textarea' || inputType === 'checkbox' ? 'wide' : '';
      if (inputType === 'checkbox') label.classList.add('check');
      let input;
      if (inputType === 'textarea') { input=document.createElement('textarea'); input.rows=5; }
      else { input=document.createElement('input'); input.type=inputType; }
      input.name=name;
      if (required) input.required=true;
      if (inputType === 'checkbox') { label.append(input,document.createTextNode(title)); }
      else { label.append(document.createTextNode(title),input); }
      fields.append(label);
    });
  }
  function fillForm(item) {
    const form = $('entry-form'); editId = item?.id || '';
    form.reset();
    if (item) Object.keys(item).forEach(key => {
      const control = form.elements.namedItem(key);
      if (control && 'value' in control) {
        if (control.type === 'checkbox') control.checked = item[key] === true;
        else control.value = item[key] ?? '';
      }
    });
    $('form-title').textContent = editId ? 'Uredi zapis' : (type==='events' ? 'Dodaj dogodek' : 'Dodaj članek');
    form.querySelector('button[type=submit]').textContent=editId?'Posodobi v seznamu':'Dodaj v seznam';
  }
  function renderList() {
    entries.replaceChildren();
    if (!list.length) { entries.textContent='Za zdaj ni dodanih zapisov.'; return; }
    list.forEach(item => {
      const wrapper=document.createElement('article'); wrapper.className='entry';
      const title=document.createElement('strong'); title.textContent=item.titleSl||'(brez naslova)';
      const detail=document.createElement('span');
      detail.textContent=(item.startDate||item.publishedAt||'')+' · '+(item.status==='published'?'Objavljeno':'Osnutek');
      const controls=document.createElement('div');
      const edit=document.createElement('button');edit.type='button';edit.textContent='Uredi';
      edit.addEventListener('click',()=>{fillForm(item);window.scrollTo({top:0,behavior:'smooth'});});
      const remove=document.createElement('button');remove.type='button';remove.textContent='Odstrani';
      remove.addEventListener('click',()=>{if(confirm('Res odstranim ta zapis iz uredniškega seznama?')){list=list.filter(x=>x.id!==item.id);renderList();message('Odstranjeno lokalno — še shrani spremembe.');}});
      controls.append(edit,remove);wrapper.append(title,detail,controls);entries.append(wrapper);
    });
  }
  async function load() {
    message('Nalagam ...');
    try {
      const response=await fetch('/admin/'+type,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok) throw Error('HTTP '+response.status+' — preveri Cloudflare Access in CONTENT_KV');
      const data=await response.json();list=Array.isArray(data.items)?data.items:[];version=data.version||'';
      renderList();message('Prijavljen urednik. Naloženih zapisov: '+list.length+'.');
    } catch(error){list=[];renderList();message('Napaka pri branju: '+error.message);}
  }
  function switchType(next) {
    type=next;editId='';renderForm();fillForm(null);
    ['events','posts'].forEach(t=>$('tab-'+t).setAttribute('aria-selected',String(t===type)));
    load();
  }
  $('tab-events').addEventListener('click',()=>switchType('events'));
  $('tab-posts').addEventListener('click',()=>switchType('posts'));
  $('reset-form').addEventListener('click',()=>fillForm(null));
  $('entry-form').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const values={id:editId||crypto.randomUUID()};
    new FormData(form).forEach((value,key)=>{values[key]=String(value);});
    values.confirmed=Boolean(form.elements.namedItem('confirmed')?.checked);
    if (!values.endDate && type==='events') values.endDate=values.startDate;
    if(editId) list=list.map(x=>x.id===editId?values:x); else list.push(values);
    renderList();fillForm(null);message('Zapis je v seznamu. Klikni »Shrani vse spremembe« za trajno shranjevanje.');
  });
  $('save-list').addEventListener('click',async()=>{
    message('Shranjujem ...');
    try{
      const response=await fetch('/admin/'+type,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,items:list})});
      const data=await response.json();
      if(!response.ok) throw Error(data.error||'HTTP '+response.status);
      version=data.version;
      message('Uspešno shranjeno. Objavljene vsebine so dostopne obiskovalcem po objavi Workerja.');
      await load();
    }catch(error){message('Shranjevanje ni uspelo: '+error.message);}
  });
  switchType('events');
})();
</script></body></html>
`;
