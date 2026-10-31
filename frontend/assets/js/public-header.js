(function(){
  const scriptUrl=document.currentScript.src;
  const root=new URL('../../../',scriptUrl);
  
  // ================= COOKIE CONSENT =================

  function getCookie(name) {
    const cookies = document.cookie.split("; ");

    for (const cookie of cookies) {
      const [key, ...value] = cookie.split("=");

      if (key === name) {
        return decodeURIComponent(value.join("="));
      }
    }

    return null;
  }

  function setCookie(name, value, days) {
    const maxAge = days * 24 * 60 * 60;
    const secure = location.protocol === "https:" ? "; Secure" : "";

    document.cookie =
      name + "=" + encodeURIComponent(value) +
      "; Max-Age=" + maxAge +
      "; Path=" + root.pathname +
      "; SameSite=Lax" +
      secure;
  }

  function initCookieConsent() {
    const cookieName = "ecomarc_cookie_consent";

    // Don't show the banner if consent already exists
    if (getCookie(cookieName)) return;

    const banner = document.createElement("section");
    banner.className = "cookie-banner";

 banner.innerHTML = `
  <div class="cookie-icon">
    <i class="fa-solid fa-cookie-bite"></i>
  </div>

  <div class="cookie-content">
    <div class="cookie-text">
      <h3>We Value Your Privacy</h3>

      <p>
        We use cookies to improve your browsing experience,
        personalize content, and understand how our website is used.
      </p>

      <a href="#" class="cookie-policy">Cookie Policy</a>
    </div>

    <div class="cookie-actions">
      <button type="button" class="cookie-accept">
        Accept All Cookies
      </button>

      <button type="button" class="cookie-reject">
        Reject Optional
      </button>
    </div>
  </div>
`;
    document.body.appendChild(banner);

    function saveConsent(analytics, marketing) {
      const consent = {
        necessary: true,
        analytics: analytics,
        marketing: marketing,
        updatedAt: new Date().toISOString()
      };

      setCookie(cookieName, JSON.stringify(consent), 180);

      banner.classList.add("cookie-hiding");

      setTimeout(() => banner.remove(), 300);
    }

    banner.querySelector(".cookie-accept").addEventListener("click", () => {
      saveConsent(true, true);
    });

    banner.querySelector(".cookie-reject").addEventListener("click", () => {
      saveConsent(false, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCookieConsent, {
      once: true
    });
  } else {
    initCookieConsent();
  }


  const header=document.querySelector('.public-header');if(!header)return;
  const nav=header.querySelector('.ph-nav');const menu=header.querySelector('.ph-menu-toggle');
  const search=header.querySelector('.ph-search');const toggle=header.querySelector('.ph-search-toggle');
  const field=header.querySelector('[name=q]');
  const shopLink=[...nav.querySelectorAll('a')].find(link=>new URL(link.href).pathname.endsWith('/shop.html')&&!new URL(link.href).search);
  if(shopLink){let previous=shopLink;for(const [value,label] of [['men','Men'],['women','Women']]){const link=document.createElement('a');link.href=new URL('frontend/shop.html?gender='+value,root).href;link.textContent=label;previous.after(link);previous=link;}}

  function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}
  function closeSearch(){search.hidden=true;toggle.setAttribute('aria-expanded','false');}
  menu.onclick=event=>{
    closeSearch();const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));
    if(open&&event.detail===0)nav.querySelector('a').focus();
  };
  toggle.addEventListener('click',()=>{closeMenu();const open=search.hidden;search.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)field.focus();});
  header.querySelector('.ph-search-close').addEventListener('click',()=>{closeSearch();toggle.focus();});
  nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
  header.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!search.hidden){closeSearch();toggle.focus();}else{closeMenu();menu.focus();}}});
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target)){closeMenu();closeSearch();}});
  window.addEventListener('resize',()=>{if(innerWidth>1100)closeMenu();});
  document.getElementById('ph-mobile-logout')?.addEventListener('click',()=>document.getElementById('account-logout')?.click());
  const summaryCount=document.getElementById('items-count');
  if(summaryCount){
    const update=()=>{const count=parseInt(summaryCount.textContent,10)||0;const badge=header.querySelector('.ph-badge');badge.textContent=String(count);badge.hidden=count===0;};
    new MutationObserver(update).observe(summaryCount,{childList:true,characterData:true,subtree:true});
  }
  const current=new URL(location.href);
  header.querySelectorAll('.ph-nav>a').forEach(link=>{
    const target=new URL(link.href);if(target.pathname===current.pathname&&target.search===current.search){link.classList.add('is-active');link.setAttribute('aria-current','page');}
  });
  async function fetchJson(url){const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Unavailable');return response.json();}
  fetchJson(new URL('backend/api/Settings.php',root)).then(settings=>{
    const threshold=Number(settings.free_delivery_at);
    if(settings.free_delivery_at!==null&&Number.isFinite(threshold)&&threshold>0)header.querySelector('.ph-announcement-text').textContent='Considered style. Everyday movement. · Complimentary delivery from '+threshold.toFixed(2)+' JOD';
  }).catch(()=>{});
  EcoAuth.ready.then(async session=>{
    if(session.user?.role==='admin'){
      const dashboard=new URL('frontend/admin/overveiw.html',root).href;
      const desktop=document.createElement('a');
      desktop.className='ph-admin-dashboard';
      desktop.href=dashboard;
      desktop.innerHTML='<i class="fa-solid fa-gauge-high" aria-hidden="true"></i><span>Admin dashboard</span>';
      desktop.title='Back to admin dashboard';
      header.querySelector('.ph-actions')?.prepend(desktop);
      const mobile=document.createElement('a');
      mobile.className='ph-mobile-link ph-admin-mobile';
      mobile.href=dashboard;
      mobile.innerHTML='<i class="fa-solid fa-gauge-high" aria-hidden="true"></i> Admin dashboard';
      mobile.addEventListener('click',closeMenu);
      nav.prepend(mobile);
    }
    header.querySelectorAll('[data-ph-guest]').forEach(link=>link.hidden=!!session.user);
    header.querySelectorAll('[data-ph-user]').forEach(link=>link.hidden=!session.user);
    const account=header.querySelector('.ph-account');
    account.href=new URL(session.user?'frontend/account/profile.html':'frontend/account/login.html',root).href;
    account.setAttribute('aria-label',session.user?'My account':'Sign in');
    if(!session.user||header.classList.contains('top'))return;
    try{
      const response=await EcoAuth.fetch(new URL('backend/api/cart.php?action=items',root));if(!response.ok)return;
      const data=await response.json();const items=Array.isArray(data.data)?data.data:[];
      const count=items.reduce((sum,item)=>sum+Number(item.quantity||0),0);const badge=header.querySelector('.ph-badge');badge.textContent=String(count);badge.hidden=count===0;
    }catch{}
  }).catch(()=>{});
  function load(path){
    const url=new URL(path,root);
    if([...document.scripts].some(script=>script.src&&new URL(script.src).pathname===url.pathname))return Promise.resolve();
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url.href;script.onload=resolve;script.onerror=reject;document.body.append(script);});
  }
  let footer=document.getElementById('site-footer');
  if(!footer){footer=document.createElement('footer');footer.id='site-footer';footer.className='site-footer';footer.setAttribute('aria-label','Site footer');document.body.append(footer);document.querySelector('.store-footer')?.remove();}
  if(!document.querySelector('link[href*="site-footer.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('frontend/assets/css/site-footer.css?v=20261030-audit',root);document.head.append(css);}
  const main=document.querySelector('main');
  if(main&&!document.querySelector('a[href="#'+(main.id||'main')+'"]')){if(!main.id)main.id='main';const skip=document.createElement('a');skip.className='ph-skip';skip.href='#'+main.id;skip.textContent='Skip to content';document.body.prepend(skip);}
  load("frontend/assets/js/product-cards.js?v=20261030-cards").then(()=>(footer?load('frontend/assets/js/site-footer.js?v=20261030-audit'):Promise.resolve()))
    .then(()=>load('frontend/assets/js/customer-chat.js?v=20261030-simplified-ai')).catch(()=>{});
    
})();
