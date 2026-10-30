(function(){
  if(window.ProductCards)return;
  const root=new URL('../../../',document.currentScript.src);
  if(![...document.querySelectorAll('link[rel=stylesheet]')].some(link=>link.href.includes('/product-cards.css'))){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('frontend/assets/css/product-cards.css?v=20261030-cards',root);document.head.append(css);}
  const registry=new Map();const ratings=new Map();const saved=new Set();let revision=0;
  function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function icon(name){const el=node('i','fa-solid fa-'+name);el.setAttribute('aria-hidden','true');return el;}
  function money(value){return new Intl.NumberFormat('en-JO',{style:'currency',currency:'JOD'}).format(Number(value)||0);}
  function href(id){const url=new URL('frontend/ProductShop.html',root);url.searchParams.set('id',String(id));return url.href;}
  function imageUrl(value){
    if(!value)return '';
    try{const base=['frontend/','backend/','assets/products/'].some(prefix=>String(value).startsWith(prefix))?root:document.baseURI;const url=new URL(value,base);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
  }
  function variants(product){return Array.isArray(product.variants)?product.variants:[];}
  function colors(product){return [...new Set((product.colors||variants(product).map(v=>v.color)).filter(Boolean).map(String))];}
  function swatches(values){
    const row=node('div','pc-swatches');const palette={black:'#171717',white:'#fff',beige:'#d6c3a4',brown:'#79543d',red:'#c73535',blue:'#346aa5',navy:'#172b49','navy blue':'#172b49',green:'#42754a',olive:'#737c45',gray:'#888',grey:'#888',cream:'#f5efdf',pink:'#e697b1',purple:'#865b9b',yellow:'#e5c94b',orange:'#d9843d',اسود:'#171717','أسود':'#171717',ابيض:'#fff','أبيض':'#fff',بيج:'#d6c3a4',بني:'#79543d',احمر:'#c73535','أحمر':'#c73535',كحلي:'#172b49',رمادي:'#888'};
    values.slice(0,6).forEach(value=>{
      const el=node('span','pc-swatch');const key=value.toLowerCase().trim();let paint=palette[key];
      if(!paint&&/^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(key)&&!['inherit','initial','unset','currentcolor','transparent'].includes(key)&&CSS.supports('color',key))paint=key;
      if(paint)el.style.backgroundColor=paint;else{el.textContent='?';el.classList.add('is-unknown');}
      el.title=value;el.setAttribute('aria-label',value);el.setAttribute('role','img');row.append(el);
    });
    if(values.length>6)row.append(node('span','pc-more-colors','+'+(values.length-6)));
    return row;
  }
  function pricing(p){
    const original=Number(p.original_price??p.price)||0;
    const percent=Number(p.discount_id)>0?Math.max(0,Math.min(100,Number(p.discount_percentage)||0)):0;
    const final=p.original_price!==undefined?Number(p.price)||0:original*(1-percent/100);
    return {original,final,discounted:original>final};
  }
  function ratingElement(product){
    const data=ratings.get(Number(product.id))||product;const el=node('span','pc-rating');
    if(Number(data.review_count)>0&&data.average_rating!=null){el.append(icon('star'),document.createTextNode(Number(data.average_rating).toFixed(1)+' ('+data.review_count+')'));el.setAttribute('aria-label',Number(data.average_rating).toFixed(1)+' out of 5 from '+data.review_count+' reviews');}else el.hidden=true;
    return el;
  }
  function create(product,options={}){
    const id=Number(product.id);const p={...(registry.get(id)||{}),...product,id};registry.set(id,p);
    const card=node('article','ec-product-card'+(options.compact?' pc-compact':'')+(options.className?' '+options.className:''));card.dataset.productId=String(id);card.dataset.cardProduct=String(id);
    const media=node('div','pc-media');const imageLink=node('a','pc-image-link');imageLink.href=href(id);imageLink.setAttribute('aria-label','View '+p.name);
    const image=node('img','pc-image');const source=imageUrl(options.image||p.image_url||(p.images?.[0]?.image_url)||'');if(source)image.src=source;else image.hidden=true;image.alt=p.name||'Product';image.loading='lazy';image.width=400;image.height=500;
    image.dataset.productImage='';image.addEventListener('error',()=>{image.hidden=true;imageLink.append(node('span','pc-image-fallback','Image unavailable'));},{once:true});imageLink.append(image);if(!source)imageLink.append(node('span','pc-image-fallback','Image unavailable'));media.append(imageLink);
    const heart=node('button','pc-heart');heart.type='button';heart.dataset.pcWishlist=String(id);heart.dataset.pcRemove=options.wishlist?'1':'0';
    const active=options.wishlist||saved.has(id);heart.setAttribute('aria-pressed',String(active));heart.setAttribute('aria-label',(active?'Remove ':'Save ')+p.name+(active?' from wishlist':' to wishlist'));heart.title=active?'Remove from wishlist':'Save to wishlist';
    const heartIcon=node('i','fa-'+(active?'solid':'regular')+' fa-heart');heartIcon.setAttribute('aria-hidden','true');heart.append(heartIcon);media.append(heart);
    const amount=pricing(p);const stock=p.in_stock!==undefined?p.in_stock:(Array.isArray(p.variants)?p.variants.some(v=>v.quantity===undefined||Number(v.quantity)>0):null);
    const tag=options.badge||(stock===false?'Out of stock':amount.discounted?'−'+Math.round((1-amount.final/amount.original)*100)+'%':'');
    if(tag)media.append(node('span','pc-badge',tag));
    const quick=node('button','pc-quick');quick.type='button';quick.append(document.createTextNode('Quick view'),icon('plus'));quick.setAttribute('aria-label','Quick view '+p.name);quick.dataset.pcQuick=String(id);
    if(options.onQuick){quick.dataset.customQuick='1';quick.addEventListener('click',options.onQuick);}media.append(quick);
    const meta=node('div','pc-meta');meta.append(node('div','pc-label',p.brand_name||p.metadata?.brand||p.category_name||p.category||''));
    const title=node('h3','pc-name');const titleLink=node('a');titleLink.href=href(id);titleLink.textContent=p.name||'Untitled product';title.append(titleLink);meta.append(title);
    const price=node('div','pc-price-row');price.append(node('span','pc-price',money(amount.final)));if(amount.discounted)price.append(node('s','pc-old-price',money(amount.original)));price.append(ratingElement(p));meta.append(price);
    const shades=colors(p);if(shades.length)meta.append(swatches(shades));
    const extra=node('div','pc-extra');meta.append(extra);card.append(media,meta);return card;
  }
  async function notify(title,text,type,confirm=false){
    const dialogs=[...document.querySelectorAll('dialog[open]')];dialogs.forEach(dialog=>dialog.close());
    try{return await (confirm?Alerts.confirm(title,text):Alerts.show(title,text,type));}
    finally{dialogs.forEach(dialog=>{if(dialog.isConnected&&!dialog.open)dialog.showModal();});}
  }
  function syncHearts(){document.querySelectorAll('[data-pc-wishlist]').forEach(button=>{const id=Number(button.dataset.pcWishlist);const active=saved.has(id);const p=registry.get(id);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Remove ':'Save ')+(p?.name||'product')+(active?' from wishlist':' to wishlist'));button.title=active?'Remove from wishlist':'Save to wishlist';button.querySelector('i').className='fa-'+(active?'solid':'regular')+' fa-heart';});}
  async function toggleWishlist(button){
    button.disabled=true;
    try{
      const session=await EcoAuth.refresh();if(!session.user){const login=new URL(EcoAuth.loginUrl,location.href);login.searchParams.set('next',location.pathname+location.search);location.href=login.href;return;}
      const id=Number(button.dataset.pcWishlist);const remove=button.dataset.pcRemove==='1'||saved.has(id);
      if(remove){const answer=await notify('Remove this piece?','You can save it again from the collection.','warning',true);if(!answer.isConfirmed)return;}
      const response=await EcoAuth.fetch(new URL('backend/api/wishlist.php',root),{method:remove?'DELETE':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id})});const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Wishlist could not be updated.');
      revision++;if(remove)saved.delete(id);else saved.add(id);syncHearts();
      document.dispatchEvent(new CustomEvent('eco:wishlist-changed',{detail:{id,removed:remove}}));
      if(!document.querySelector('dialog[open]'))Alerts.toast(remove?'Removed from wishlist':'Saved to wishlist');
    }catch(error){await notify('Wishlist unavailable',error.message,'error');}
    finally{button.disabled=false;}
  }
  let quickDialog=null;
  async function openQuick(id){
    if(!quickDialog){
      quickDialog=node('dialog','ec-quick-dialog');quickDialog.setAttribute('aria-labelledby','ec-quick-title');
      quickDialog.innerHTML='<button type="button" class="pc-dialog-close" aria-label="Close quick view"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button><div class="pc-dialog-layout"><div class="pc-dialog-photo"><img width="400" height="500" alt=""></div><div class="pc-dialog-copy"><p class="pc-label"></p><h2 id="ec-quick-title"></h2><p class="pc-dialog-price"></p><p class="pc-dialog-stock" role="status"></p><p class="pc-dialog-variants"></p><div class="pc-dialog-colors"></div><a class="pc-dialog-link">Choose options</a></div></div>';
      document.body.append(quickDialog);quickDialog.querySelector('.pc-dialog-close').addEventListener('click',()=>quickDialog.close());quickDialog.addEventListener('click',e=>{if(e.target===quickDialog)quickDialog.close();});
    }
    let p=registry.get(id);if(!p)return;
    const label=quickDialog.querySelector('.pc-label');label.textContent=p.category_name||p.category||'';
    quickDialog.querySelector('h2').textContent=p.name;const image=quickDialog.querySelector('img');image.src=imageUrl(p.image_url||p.images?.[0]?.image_url);image.alt=p.name;
    quickDialog.querySelector('.pc-dialog-price').textContent=money(pricing(p).final);const details=quickDialog.querySelector('.pc-dialog-variants');details.textContent='Loading available options…';
    quickDialog.querySelector('.pc-dialog-stock').textContent='';quickDialog.querySelector('.pc-dialog-colors').replaceChildren();quickDialog.querySelector('.pc-dialog-link').href=href(id);quickDialog.showModal();
    try{
      if(!Array.isArray(p.variants)){
        const url=new URL('backend/api/Products.php',root);url.searchParams.set('id',String(id));const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Available options could not be loaded. Open the product page to try again.');
        const full=await response.json();p={...p,...full,id};registry.set(id,p);quickDialog.querySelector('.pc-dialog-price').textContent=money(pricing(p).final);
      }
      const available=variants(p).filter(v=>v.quantity===undefined||Number(v.quantity)>0);details.textContent=available.length?'Sizes: '+[...new Set(available.map(v=>v.size))].join(', '):'No available variants right now.';
      quickDialog.querySelector('.pc-dialog-stock').textContent=available.length?'Available':'Currently out of stock';quickDialog.querySelector('.pc-dialog-colors').replaceChildren(swatches(colors(p)));
    }catch(error){details.textContent=error.message;}
  }
  document.addEventListener('click',event=>{
    const heart=event.target.closest('[data-pc-wishlist]');if(heart){event.preventDefault();toggleWishlist(heart);return;}
    const quick=event.target.closest('[data-pc-quick]');if(quick&&quick.dataset.customQuick!=='1'){event.preventDefault();openQuick(Number(quick.dataset.pcQuick));}
  });
  fetch(new URL('backend/api/product-card-data.php',root),{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data?.success)return;data.data.forEach(row=>ratings.set(Number(row.id),row));
    document.querySelectorAll('.ec-product-card').forEach(card=>{const p=registry.get(Number(card.dataset.productId));if(p)card.querySelector('.pc-rating')?.replaceWith(ratingElement(p));});
  }).catch(()=>{});
  function hydrateWishlist(){if(typeof EcoAuth==='undefined')return;EcoAuth.ready.then(async session=>{
    if(!session.user)return;const before=revision;const response=await EcoAuth.fetch(new URL('backend/api/wishlist.php',root));if(!response.ok)return;const data=await response.json();
    if(before!==revision||!data.success||!Array.isArray(data.data))return;data.data.forEach(p=>saved.add(Number(p.id)));syncHearts();
  }).catch(()=>{});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrateWishlist,{once:true});else hydrateWishlist();
  window.ProductCards={create,html:(p,options)=>create(p,options).outerHTML,swatches,openQuick};
})();
