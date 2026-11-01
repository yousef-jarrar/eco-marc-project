(function () {
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const active = new Set();
  const badgeValues = new WeakMap();
  let observer;
  let scheduled;
  let progress;
  let scrollFrame;
  let scrollRange = 0;
  const targets = [
    '.overview-card','.profile-card','.ec-product-card','.lp-section-heading',
    '.lp-section-head','.lp-category-card','.lp-category-tile','.category-card',
    '.auth-form-wrap','.cart-item','.checkout-item','.order-summary',
    '.customer-summary-card','.account-shortcuts>a','.upload-area',
    '.product-details>.details-copy','.profile-heading','.page-heading',
    '.checkout-heading','.search-intro','.catalog-panel','.settings-card',
    '.reviews-summary','.admin-main>.panel','.gallery-main>img'
  ].join(',');

  function play(element, frames, options = {}) {
    if(reduced.matches || !element?.isConnected || typeof element.animate !== 'function')return;
    const animation=element.animate(frames,{duration:550,easing:'cubic-bezier(.22,1,.36,1)',...options});
    active.add(animation);
    animation.finished.then(()=>active.delete(animation),()=>active.delete(animation));
    return animation;
  }

  function reveal(element) {
    const product=element.matches('.ec-product-card');
    const image=element.tagName==='IMG';
    const row=element.tagName==='TR';
    const type=product?'product':image?'image':row?'row':'content';
    element.dataset.motionType=type;
    const beginning=image?{opacity:.6,transform:'scale(1.045)'}:
      product?{opacity:.15,transform:'translateY(24px) scale(.985)'}:
      row?{opacity:.25,transform:'translateY(7px)'}:
      {opacity:.2,transform:'translateY(18px)'};
    play(element,[beginning,{opacity:1,transform:'none'}],{
      duration:image?850:product?720:row?380:620,
      delay:parseInt(element.style.getPropertyValue('--reveal-delay'))||0
    });
  }

  function prepare() {
    document.querySelectorAll('button').forEach(button=>{
      if(button.textContent.trim()==='' && button.querySelector('i,svg'))button.classList.add('is-icon-only');
    });
    document.querySelectorAll('.ph-badge,.bag-count').forEach(badge=>{
      const value=badge.textContent.trim();
      if(badgeValues.has(badge) && badgeValues.get(badge)!==value && !badge.hidden) {
        play(badge,[{scale:1},{scale:1.24,offset:.45},{scale:1}],{duration:380});
      }
      badgeValues.set(badge,value);
    });
    if(reduced.matches || !observer)return;
    const elements=[...document.querySelectorAll(targets),...document.querySelectorAll('.admin-main tbody>tr:nth-child(-n+12)')];
    elements.slice(0,350).forEach((element,index)=>{
      if(element.dataset.siteMotion || element.closest('.look-stage,.lp-story-composition,.swal2-popup'))return;
      element.dataset.siteMotion='observing';
      element.style.setProperty('--reveal-delay',Math.min(index%4*65,195)+'ms');
      observer.observe(element);
    });
  }

  function start() {
    observer?.disconnect();
    document.querySelectorAll('[data-site-motion="observing"]').forEach(element=>delete element.dataset.siteMotion);
    if(reduced.matches || !window.IntersectionObserver){observer=null;prepare();return;}
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        observer.unobserve(entry.target);
        entry.target.dataset.siteMotion='done';
        reveal(entry.target);
      }
    },{threshold:.05,rootMargin:'0px 0px 65px 0px'});
    prepare();
  }

  function updateProgress() {
    scrollFrame=null;
    const value=scrollRange>0?Math.max(0,Math.min(1,scrollY/scrollRange)):0;
    progress.style.transform='scaleX('+value+')';
    document.body.classList.toggle('has-scrolled',scrollY>12);
  }

  function measurePage() {
    scrollRange=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    if(!scrollFrame)scrollFrame=requestAnimationFrame(updateProgress);
  }

  function init() {
    progress=document.createElement('div');
    progress.className='site-scroll-progress';
    progress.setAttribute('aria-hidden','true');
    document.body.append(progress);
    start();
    measurePage();
    if(window.ResizeObserver)new ResizeObserver(measurePage).observe(document.body);
    window.addEventListener('resize',measurePage,{passive:true});
    window.addEventListener('scroll',()=>{
      if(!scrollFrame)scrollFrame=requestAnimationFrame(updateProgress);
    },{passive:true});

    new MutationObserver(records=>{
      if(records.every(record=>record.target.parentElement?.closest('.message,.chat-log')))return;
      cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(prepare);
      for(const record of records){
        const target=record.target.nodeType===1?record.target:record.target.parentElement;
        const number=target?.closest('.line-total,#total,#subtotal,.overview-card-value');
        if(number && !number.closest('.message'))play(number,[{opacity:.4},{opacity:1}],{duration:400});
      }
    }).observe(document.body,{childList:true,subtree:true,characterData:true});

    document.addEventListener('toggle',event=>{
      const details=event.target;
      if(details.tagName!=='DETAILS' || !details.open || details.closest('.look-stage'))return;
      [...details.children].filter(child=>child.tagName!=='SUMMARY').slice(0,8).forEach((child,index)=>{
        play(child,[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:320,delay:index*30});
      });
    },true);

    document.addEventListener('load',event=>{
      const image=event.target;
      if(image.tagName==='IMG' && image.matches('.gallery-main>img,#gallery-main,.gallery-main,#preview-image')) {
        play(image,[{opacity:.35,scale:.985},{opacity:1,scale:1}],{duration:420});
      }
    },true);

    document.addEventListener('focusin',event=>{
      event.target.closest('[data-site-motion]')?.getAnimations?.().forEach(animation=>animation.finish());
    });
    reduced.addEventListener('change',()=>{
      active.forEach(animation=>animation.cancel());active.clear();start();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
