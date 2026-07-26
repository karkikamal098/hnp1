// tel: links are a silent no-op on any desktop with no calling app registered
// — expected browser behaviour, not a bug, but it reads as "broken" because
// nothing visible happens and the number is never shown. On click, copy the
// number and confirm it with a toast; this never calls preventDefault, so a
// phone or a desktop with a calling handler still gets the native tel: dial.
document.querySelectorAll('a[href^="tel:"]').forEach(a => {
  a.addEventListener('click', () => {
    const number = a.getAttribute('title')?.match(/[\d()+\- ]{7,}/)?.[0].trim()
      || a.getAttribute('href').replace('tel:', '');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(number).then(() => {
      let toast = document.querySelector('.tel-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'tel-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
      }
      toast.textContent = `${number} copied to clipboard`;
      toast.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove('show'), 2600);
    }).catch(() => {});
  });
});

// Pre-fill the RFQ form from a "Featured design" card link
// (?project=...&material=...) — arrives from tools/sync-catalogue.js output.
// No cart, no checkout: this is the only conversion path on the site.
const quoteForm = document.querySelector('#quoteForm');
if (quoteForm) {
  const qs = new URLSearchParams(location.search);
  const project = qs.get('project'), material = qs.get('material');
  if (project) {
    const f = quoteForm.querySelector('#q-project');
    if (f) f.value = project;
  }
  if (material) {
    const f = quoteForm.querySelector('#q-material');
    if (f && [...f.options].some(o => o.value === material)) f.value = material;
  }
  if (project) {
    const details = quoteForm.querySelector('#q-details');
    if (details && !details.value) details.placeholder = `Requesting: ${project}. Add dimensions, finish, load case, timeline…`;
  }
}

// Header shadow
const header = document.querySelector('header.site');
if (header){
  const s=()=>header.classList.toggle('scrolled',window.scrollY>8);
  s(); addEventListener('scroll',s,{passive:true});
}
// Mobile menu
const burger=document.querySelector('.burger'),links=document.querySelector('.navlinks');
if(burger&&links){
  const setMenu=(open)=>{
    links.classList.toggle('open',open);
    burger.setAttribute('aria-expanded',String(open));
  };
  setMenu(false);
  burger.addEventListener('click',()=>setMenu(!links.classList.contains('open')));
  // any real navigation closes the drawer — but a submenu trigger only expands it
  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    if(a.parentElement.classList.contains('has-sub')) return;
    setMenu(false);
  }));
  addEventListener('keydown',e=>{ if(e.key==='Escape') setMenu(false); });
  // a resize past the breakpoint must not leave the drawer state stuck on
  addEventListener('resize',()=>{ if(innerWidth>1180) setMenu(false); },{passive:true});
}

// Dropdown menus — hover is handled in CSS; this adds keyboard, touch and Escape.
document.querySelectorAll('.has-sub').forEach(sub=>{
  const trigger=sub.querySelector(':scope > a'), panel=sub.querySelector('.subpanel');
  if(!trigger||!panel) return;
  const close=()=>{sub.classList.remove('open');trigger.setAttribute('aria-expanded','false');};
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-haspopup','true');
  // In the drawer (and on touch), the trigger expands its submenu rather than
  // navigating; the panel's own heading links through to the parent page.
  trigger.addEventListener('click',e=>{
    const drawer=links&&links.classList.contains('open');
    if(!drawer&&!matchMedia('(hover:none)').matches) return;
    e.preventDefault();
    const open=!sub.classList.contains('open');
    document.querySelectorAll('.has-sub.open').forEach(o=>o!==sub&&o.classList.remove('open'));
    sub.classList.toggle('open',open);
    trigger.setAttribute('aria-expanded',String(open));
  });
  sub.addEventListener('keydown',e=>{ if(e.key==='Escape'){close();trigger.focus();} });
  document.addEventListener('click',e=>{ if(!sub.contains(e.target)) close(); });
});
// Photography: fade in once decoded, and fall back to the drawn plate if the
// CDN ever fails to serve an image, so a slot is never blank.
document.querySelectorAll('.ph img').forEach(img=>{
  const done=()=>img.classList.add('loaded');
  if(img.complete&&img.naturalWidth) done();
  else img.addEventListener('load',done,{once:true});
  img.addEventListener('error',()=>{
    img.remove();
    const ph=img.closest('.ph');
    if(ph) ph.classList.remove('has-img');   // restores the gradient + perforation
  },{once:true});
});

// Reveal + datasheet bars
const io=new IntersectionObserver((es)=>{
  es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('[data-reveal],.datasheet').forEach(el=>io.observe(el));
/* ---------------------------------------------------------------------------
   QUOTE FORM
   Set QUOTE_ENDPOINT to your form service (Formspree, Basin, Netlify Forms,
   or your own POST URL) and submissions are sent there over fetch.
   Until it is set, the form opens a pre-filled email to sales@ instead — so a
   real enquiry always reaches you rather than being silently swallowed.
--------------------------------------------------------------------------- */
const QUOTE_ENDPOINT = '';                       // e.g. 'https://formspree.io/f/xxxxxxxx'
const QUOTE_MAILBOX  = 'sales@hnpbuilding.com';

const form=document.querySelector('#quoteForm');
if(form){
  const btn=form.querySelector('button[type=submit]');
  const label=btn?btn.textContent:'';
  let status=form.querySelector('.formstatus');
  if(!status){
    status=document.createElement('p');
    status.className='formstatus';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    btn.insertAdjacentElement('afterend',status);
  }
  const say=(msg,kind)=>{ status.textContent=msg; status.className='formstatus '+(kind||''); };

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    if(form.website && form.website.value) return;   // honeypot tripped — silently drop
    if(!form.reportValidity()) return;           // never report success on an invalid form
    const data=new FormData(form);
    data.delete('website');

    if(QUOTE_ENDPOINT){
      btn.disabled=true; btn.textContent='Sending…'; say('');
      try{
        const r=await fetch(QUOTE_ENDPOINT,{method:'POST',body:data,headers:{Accept:'application/json'}});
        if(!r.ok) throw new Error(r.status);
        form.reset();
        btn.textContent='Request received ✓';
        say('Thanks — we’ll respond within 1–2 business days.','ok');
      }catch(err){
        btn.textContent=label;
        say('That didn’t send. Email '+QUOTE_MAILBOX+' or call (720) 609-9307 and we’ll pick it up.','err');
      }finally{
        btn.disabled=false;
        setTimeout(()=>{btn.textContent=label;},4000);
      }
      return;
    }

    // No endpoint configured: hand the enquiry to the user's mail client.
    const line=(k,v)=>v?k+': '+v+'\n':'';
    const body=
      line('Name',data.get('name'))+line('Company',data.get('company'))+
      line('Email',data.get('email'))+line('Phone',data.get('phone'))+
      line('Project',data.get('project'))+line('Material',data.get('material'))+
      '\n'+(data.get('details')||'');
    const href='mailto:'+QUOTE_MAILBOX
      +'?subject='+encodeURIComponent('Quote request — '+(data.get('project')||data.get('company')||'new enquiry'))
      +'&body='+encodeURIComponent(body);
    window.location.href=href;
    say('Opening your email app with this request pre-filled. If nothing happens, email '
        +QUOTE_MAILBOX+' directly.','ok');
  });
}

// FAQ accordion
document.querySelectorAll('.qa button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const qa=btn.closest('.qa'); const body=qa.querySelector('.qbody');
    const open=qa.classList.toggle('open');
    body.style.maxHeight = open ? body.scrollHeight+'px' : '0';
  });
});
// Gallery filter
const fbar=document.querySelector('.filterbar');
if(fbar){
  fbar.addEventListener('click',(e)=>{
    const b=e.target.closest('button'); if(!b) return;
    fbar.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const f=b.dataset.filter;
    document.querySelectorAll('.gitem').forEach(g=>{
      g.classList.toggle('hide', f!=='all' && !g.dataset.cat.split(' ').includes(f));
    });
  });
}
