(function () {
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let observer;
  let scheduled;
  const targets = '.overview-card,.profile-card,.ec-product-card,.lp-section-head,.lp-category-card,.category-card,.auth-form-wrap,.cart-item,.checkout-item,.order-summary,.customer-summary-card,.account-shortcuts>a,.upload-area,.product-details>.details-copy,.profile-heading,.page-heading,.catalog-panel,.settings-card,.reviews-summary';

  function prepare() {
    document.querySelectorAll('button').forEach(button=>{
      if(button.textContent.trim()==='' && button.querySelector('i,svg'))button.classList.add('is-icon-only');
    });
    if(reduced.matches || !observer)return;
    const elements=[...document.querySelectorAll(targets),...document.querySelectorAll('.admin-main tbody>tr:nth-child(-n+12)')];
    elements.slice(0,260).forEach((element,index)=>{
      if(element.dataset.siteMotion)return;
      element.dataset.siteMotion='ready';element.style.setProperty('--reveal-delay',Math.min(index%4*40,120)+'ms');observer.observe(element);
    });
  }

  function start() {
    observer?.disconnect();
    if(reduced.matches || !window.IntersectionObserver){observer=null;prepare();return;}
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        observer.unobserve(entry.target);
        const row=entry.target.tagName==='TR';
        if(typeof entry.target.animate==='function')entry.target.animate([
          {opacity:.2,transform:'translateY('+(row?7:16)+'px)'},
          {opacity:1,transform:'translateY(0)'}
        ],{duration:row?380:650,delay:parseInt(entry.target.style.getPropertyValue('--reveal-delay'))||0,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    },{threshold:.05,rootMargin:'0px 0px 60px 0px'});
    prepare();
  }

  function init() {
    start();
    new MutationObserver(records=>{
      if(records.every(record=>record.target.parentElement?.closest('.message,.chat-log')))return;
      cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(prepare);
    }).observe(document.body,{childList:true,subtree:true});
    let previous=false;
    window.addEventListener('scroll',()=>{const value=scrollY>12;if(value!==previous){document.body.classList.toggle('has-scrolled',value);previous=value;}},{passive:true});
    document.addEventListener('focusin',event=>{
      const target=event.target.closest('[data-site-motion]');
      target?.getAnimations?.().forEach(animation=>animation.finish());
    });
    reduced.addEventListener('change',()=>{
      document.querySelectorAll('[data-site-motion]').forEach(element=>element.getAnimations?.().forEach(animation=>animation.cancel()));start();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
