// Header shadow
const header = document.querySelector('header.site');
if (header){
  const s=()=>header.classList.toggle('scrolled',window.scrollY>8);
  s(); addEventListener('scroll',s,{passive:true});
}
// Mobile menu
const burger=document.querySelector('.burger'),links=document.querySelector('.navlinks');
if(burger&&links){
  burger.addEventListener('click',()=>links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')));
}
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
