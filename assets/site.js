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
// Reveal + datasheet bars
const io=new IntersectionObserver((es)=>{
  es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('[data-reveal],.datasheet').forEach(el=>io.observe(el));
// Form demo
const form=document.querySelector('#quoteForm');
if(form){
  form.addEventListener('submit',(e)=>{
    e.preventDefault();
    // don't report success on an empty form — let the browser flag what's missing
    if(!form.reportValidity()) return;
    const b=form.querySelector('button[type=submit]');
    b.textContent='Request received ✓'; b.style.background='#4a6b3f';
    setTimeout(()=>{form.reset();b.textContent='Submit request';b.style.background='';},2600);
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
