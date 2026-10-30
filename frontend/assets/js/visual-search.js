const imageInput = document.getElementById('search-image');
const preview = document.getElementById('preview');
const searchButton = document.getElementById('search-button');
const statusText = document.getElementById('search-status');
const results = document.getElementById('search-results');
const empty = document.getElementById('results-empty');
const panel = document.querySelector('.results-panel');
const productDialog = document.getElementById('product-preview');
const sortInput = document.getElementById('match-sort');
const priceInput = document.getElementById('match-price');
const errorBox = document.getElementById('search-error');
let selectedImage = null;
let previewUrl = '';
let busy = false;
let activeController = null;
let cancelled = false;
let selectionVersion = 0;
let matches = [];
let visibleMatches = [];
let activeProduct = 0;

function clearResults(resetFilters = true) {
  matches = []; visibleMatches = []; results.replaceChildren();
  document.getElementById('browse-collection').hidden = true;
  document.getElementById('match-controls').hidden = true;
  document.getElementById('search-reference').hidden = true;
  document.getElementById('result-count').textContent = '';
  document.getElementById('similarity-note').hidden = true;
  errorBox.hidden = true;
  empty.hidden = false;
  empty.querySelector('h3').textContent = 'Your next find starts here.';
  empty.querySelector('p').textContent = 'Choose a photo and we’ll look through our collection for similar shapes, colors and details.';
  if (resetFilters) { sortInput.value = 'similarity'; priceInput.value = ''; document.querySelector('.search-main').classList.remove('has-visual-results'); }
}

async function chooseImage(file) {
  if (busy) return;
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    imageInput.value = ''; await Alerts.show('Choose an image','Use a JPG, PNG or WebP photo.','warning'); return;
  }
  if (file.size > 5242880) {
    imageInput.value = ''; await Alerts.show('Image too large','Choose an image of 5 MB or smaller.','warning'); return;
  }
  const version = ++selectionVersion;
  const candidate = URL.createObjectURL(file);
  try {
    const check = new Image(); check.src = candidate; await check.decode();
    if (check.naturalWidth * check.naturalHeight > 20000000) throw new Error('Use a photo up to 20 megapixels.');
  } catch (error) {
    URL.revokeObjectURL(candidate);
    if (version === selectionVersion) { imageInput.value = ''; await Alerts.show('Photo could not be opened',error.message === 'Use a photo up to 20 megapixels.' ? error.message : 'Choose another JPG, PNG or WebP image.','warning'); }
    return;
  }
  if (version !== selectionVersion) { URL.revokeObjectURL(candidate); return; }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedImage = file; previewUrl = candidate; preview.src = previewUrl; preview.hidden = false;
  document.getElementById('upload-placeholder').hidden = true;
  document.getElementById('selection').hidden = false;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = file.size < 1048576 ? Math.max(1,Math.round(file.size / 1024))+' KB' : (file.size / 1048576).toFixed(1)+' MB';
  document.getElementById('reference-image').src = previewUrl;
  searchButton.disabled = false;
  clearResults();
  statusText.textContent = 'Photo ready. Find similar pieces when you’re ready.';
  searchButton.querySelector('span').textContent = 'Find similar pieces';
}

imageInput.addEventListener('change',() => { if (imageInput.files[0]) chooseImage(imageInput.files[0]); });
const dropZone = document.getElementById('drop-zone');
['dragenter','dragover'].forEach(event => dropZone.addEventListener(event,e => { e.preventDefault(); if (!busy) dropZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(event => dropZone.addEventListener(event,e => { e.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop',e => { if (e.dataTransfer.files[0]) chooseImage(e.dataTransfer.files[0]); });
function changePhoto() { if (!busy) { imageInput.value = ''; imageInput.click(); } }
document.getElementById('change-image').addEventListener('click',changePhoto);
document.getElementById('reference-change').addEventListener('click',changePhoto);
document.getElementById('remove-image').addEventListener('click',() => {
  if (busy) return;
  selectionVersion++; selectedImage = null; imageInput.value = ''; preview.hidden = true; preview.removeAttribute('src');
  document.getElementById('reference-image').removeAttribute('src');
  URL.revokeObjectURL(previewUrl); previewUrl = '';
  document.getElementById('selection').hidden = true; document.getElementById('upload-placeholder').hidden = false;
  searchButton.disabled = true; clearResults(); statusText.textContent = 'Choose a photo to discover similar pieces.'; imageInput.focus();
});

function productLink(product) {
  const url = new URL('ProductShop.html',location.href); url.searchParams.set('id',String(product.id)); return url.href;
}
function productImage(product) {
  try { const url = new URL(product.image_url,new URL('../',location.href)); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function money(value) { return new Intl.NumberFormat('en-JO',{style:'currency',currency:'JOD'}).format(value); }
function openProduct(index) {
  activeProduct = index;
  const product = visibleMatches[index]; if (!product) return;
  document.getElementById('preview-title').textContent = product.name;
  const photo = document.getElementById('product-photo'); photo.hidden = false; photo.src = productImage(product); photo.alt = product.name;
  document.getElementById('preview-image-error').hidden = true;
  document.getElementById('preview-price').textContent = money(product.price);
  document.getElementById('preview-store-link').href = productLink(product);
  document.getElementById('preview-stock').textContent = product.in_stock === false ? 'Currently out of stock' : product.in_stock === true ? 'Available in the store' : '';
  document.getElementById('preview-position').textContent = (index+1)+' of '+visibleMatches.length;
  document.getElementById('previous-product').disabled = index === 0;
  document.getElementById('next-product').disabled = index === visibleMatches.length-1;
  if (!productDialog.open) productDialog.showModal();
}
document.getElementById('product-photo').addEventListener('error',() => {
  document.getElementById('product-photo').hidden = true; document.getElementById('preview-image-error').hidden = false;
});
document.getElementById('close-preview').addEventListener('click',() => productDialog.close());
productDialog.addEventListener('click',e => { if (e.target === productDialog) productDialog.close(); });
document.getElementById('previous-product').addEventListener('click',() => { if (activeProduct>0) openProduct(activeProduct-1); });
document.getElementById('next-product').addEventListener('click',() => { if (activeProduct<visibleMatches.length-1) openProduct(activeProduct+1); });
productDialog.addEventListener('keydown',e => {
  if (e.key === 'ArrowRight' && activeProduct<visibleMatches.length-1) { e.preventDefault(); openProduct(activeProduct+1); }
  if (e.key === 'ArrowLeft' && activeProduct>0) { e.preventDefault(); openProduct(activeProduct-1); }
});

function renderMatches() {
  if (!priceInput.validity.valid) { priceInput.setAttribute('aria-invalid','true'); document.getElementById('filter-help').textContent = 'Enter a valid price of zero or more.'; return; }
  priceInput.removeAttribute('aria-invalid'); document.getElementById('filter-help').textContent = 'Filters apply to these image matches only.';
  const limit = priceInput.value === '' ? Infinity : Number(priceInput.value);
  visibleMatches = matches.filter(p => Number(p.price)<=limit);
  if (sortInput.value === 'price-asc') visibleMatches.sort((a,b) => Number(a.price)-Number(b.price));
  if (sortInput.value === 'price-desc') visibleMatches.sort((a,b) => Number(b.price)-Number(a.price));
  results.replaceChildren(); empty.hidden = visibleMatches.length>0;
  document.getElementById('result-count').textContent = matches.length ? visibleMatches.length+' / '+matches.length+' pieces' : '';
  document.getElementById('similarity-note').hidden = !visibleMatches.length;
  document.getElementById('clear-match-filters').hidden = priceInput.value === '' && sortInput.value === 'similarity';
  if (matches.length && !visibleMatches.length) {
    empty.querySelector('h3').textContent = 'No matches at this price.';
    empty.querySelector('p').textContent = 'Increase or clear the price limit to see the rest of your image matches.';
    statusText.textContent = 'No pieces within this price limit. Your original matches are still available.';
  } else if (!matches.length) {
    empty.querySelector('h3').textContent = 'No pieces to show yet.';
    empty.querySelector('p').textContent = 'Try another photo or explore the full collection.';
    statusText.textContent = 'No matching pieces are available right now.';
  } else {
    statusText.textContent = sortInput.value === 'similarity' ? 'Your closest match, followed by pieces from the same category.' : 'Same image matches, ordered by price. The closest visual match keeps its badge.';
  }
  visibleMatches.forEach((product,index) => {
    const best = product.id === matches[0]?.id;
    const card = ProductCards.create(product, {
      className:'result-card'+(best?' closest-match':''),
      badge:best?'Closest visual match':'',
      onQuick:()=>openProduct(index)
    });
    results.append(card);
  });
}
sortInput.addEventListener('change',renderMatches);
priceInput.addEventListener('input',renderMatches);
document.getElementById('clear-match-filters').addEventListener('click',() => { sortInput.value='similarity';priceInput.value='';renderMatches(); });
document.getElementById('cancel-search').addEventListener('click',() => { cancelled=true;activeController?.abort(); });
document.getElementById('retry-visual-search').addEventListener('click',() => document.getElementById('search-form').requestSubmit());

document.getElementById('search-form').addEventListener('submit',async e => {
  e.preventDefault();if(!selectedImage||busy)return;
  selectionVersion++;busy=true;cancelled=false;
  searchButton.disabled=true;imageInput.disabled=true;
  ['change-image','remove-image','reference-change'].forEach(id=>document.getElementById(id).disabled=true);
  document.getElementById('cancel-search').hidden=false;panel.setAttribute('aria-busy','true');
  searchButton.querySelector('span').textContent='Finding your pieces…';clearResults(false);
  document.getElementById('search-reference').hidden=false;empty.hidden=true;
  document.getElementById('search-loading').hidden=false;statusText.textContent='Looking through our collection. This may take a moment.';
  const controller=new AbortController();activeController=controller;
  const timeout=setTimeout(()=>controller.abort(),130000);
  const slow=setTimeout(()=>{if(busy)statusText.textContent='Still searching. You can cancel at any time.';},15000);
  try{
    await EcoAuth.ready;await EcoAuth.refresh();if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
    const form=new FormData();form.append('image',selectedImage);
    const response=await fetch('../backend/api/visual-search.php',{method:'POST',body:form,credentials:'same-origin',headers:{'X-CSRF-Token':EcoAuth.token()},signal:controller.signal});
    let data;try{data=await response.json();}catch{throw new Error('The server returned an unexpected response. Please try again.');}
    if(!response.ok||!data.success)throw new Error(data.message||'Visual search is unavailable.');
    if(!Array.isArray(data.products))throw new Error('The search results could not be read.');
    matches=data.products;document.getElementById('search-loading').hidden=true;
    document.getElementById('match-controls').hidden=!matches.length;
    document.getElementById('browse-collection').hidden=false;
    document.querySelector('.search-main').classList.add('has-visual-results');renderMatches();
    const heading=document.getElementById('results-title');heading.focus({preventScroll:true});
    if(matchMedia('(max-width:760px)').matches)panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  }catch(error){
    if(cancelled){statusText.textContent='Search cancelled. Your photo is ready whenever you are.';empty.querySelector('h3').textContent='Ready when you are.';empty.querySelector('p').textContent='Your photo is still selected. Search again or choose a different one.';return;}
    statusText.textContent='Search could not finish. Your photo is ready to try again.';
    errorBox.hidden=false;document.getElementById('search-error-message').textContent=error.name==='AbortError'?'The search took too long. Try again or choose another photo.':error.message;
    await Alerts.show('Search unavailable',document.getElementById('search-error-message').textContent,'error');
  }finally{
    clearTimeout(timeout);clearTimeout(slow);busy=false;activeController=null;
    document.getElementById('search-loading').hidden=true;document.getElementById('cancel-search').hidden=true;
    ['change-image','remove-image','reference-change'].forEach(id=>document.getElementById(id).disabled=false);
    if(!results.children.length)empty.hidden=!errorBox.hidden;
    searchButton.disabled=!selectedImage;imageInput.disabled=false;panel.setAttribute('aria-busy','false');
    searchButton.querySelector('span').textContent=matches.length?'Search again':'Find similar pieces';
    if(cancelled)searchButton.focus();
  }
});
EcoAuth.ready.then(session=>{if(session.user){document.getElementById('account-link').href=EcoAuth.accountUrl;document.getElementById('account-link').textContent='My account';}}).catch(()=>{});
window.addEventListener('pagehide',()=>activeController?.abort());
