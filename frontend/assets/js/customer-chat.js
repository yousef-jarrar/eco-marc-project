(function () {
  if (document.getElementById('customer-chat-launcher')) return;
  const projectRoot = new URL('../../../', document.currentScript.src);
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href.includes('/fontawesome.min.css'))) {
    const icons = document.createElement('link'); icons.rel = 'stylesheet'; icons.href = new URL('frontend/assets/vendor/fontawesome.min.css',projectRoot); document.head.append(icons);
  }
  function icon(name) { const element = document.createElement('i'); element.className = 'fa-solid fa-' + name + ' chat-icon'; element.setAttribute('aria-hidden','true'); return element; }
  function iconLabel(element,name,text) { element.replaceChildren(icon(name),document.createTextNode(text)); }
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('frontend/assets/css/customer-chat.css?v=20261029-box', projectRoot);
  document.head.append(css);
  const launcher = document.createElement('button');
  launcher.id = 'customer-chat-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open shopping assistant');
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.innerHTML = '<i class="fa-solid fa-comment-dots chat-icon" aria-hidden="true"></i><span>Ask LUMIÈRE</span>';
  const dialog = document.createElement('dialog');
  dialog.id = 'customer-chat';
  dialog.setAttribute('aria-labelledby', 'chat-title');
  dialog.innerHTML = `
    <div class="chat-header"><span class="chat-avatar" aria-hidden="true">✦</span><div class="chat-heading"><h2 id="chat-title">Your shopping assistant</h2><p>LUMIÈRE · Made for your next find</p></div><button type="button" id="chat-expand" aria-label="Expand chat" aria-pressed="false"><i class="fa-solid fa-expand chat-icon" aria-hidden="true"></i></button><button type="button" id="chat-close" aria-label="Close shopping assistant"><i class="fa-solid fa-xmark chat-icon" aria-hidden="true"></i></button></div>
    <div class="chat-toolbar"><a class="chat-preferences-link" href="${new URL("frontend/account/index.html#shopping-preferences-title", projectRoot).href}"><i class="fa-solid fa-sliders chat-icon" aria-hidden="true"></i>Your preferences</a><button type="button" id="chat-clear"><i class="fa-solid fa-rotate-left chat-icon" aria-hidden="true"></i>New chat</button></div>
    <div id="chat-log" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions"></div>
    <button id="chat-latest" type="button" hidden><i class="fa-solid fa-arrow-down chat-icon" aria-hidden="true"></i>Latest reply</button>
    <div id="chat-compare-bar" hidden><span id="chat-compare-count" aria-live="polite"></span><button id="chat-compare-go" type="button" disabled><i class="fa-solid fa-scale-balanced chat-icon" aria-hidden="true"></i>Compare selected</button><button id="chat-compare-clear" type="button" aria-label="Clear comparison"><i class="fa-solid fa-xmark chat-icon" aria-hidden="true"></i></button></div>
    <div id="chat-prompts" class="chat-prompts"><button type="button">Shoes under 80 JOD</button><button type="button">How much is delivery?</button><button type="button" lang="ar" dir="rtl">بدي أختار قطعة حسب ميزانيتي</button></div>
    <div class="chat-status" id="chat-status" role="status"></div>
    <button id="chat-retry" type="button" hidden><i class="fa-solid fa-rotate-left chat-icon" aria-hidden="true"></i>Retry last message</button>
    <form id="chat-form"><label class="chat-label" for="chat-input">Ask about our collection</label><div id="chat-pending-photo" hidden><img width="48" height="48" alt="Selected inspiration"><span></span><button id="chat-remove-photo" type="button" aria-label="Remove selected photo"><i class="fa-solid fa-xmark chat-icon" aria-hidden="true"></i></button></div><input id="chat-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="chat-composer"><button id="chat-attach" type="button" aria-label="Search with a photo" title="Search with a photo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 5l2-2h4l2 2h4v15H4V5z"/><circle cx="12" cy="12" r="4"/></svg></button><textarea id="chat-input" rows="1" maxlength="700" placeholder="Ask about a piece, size or budget…" dir="auto"></textarea><button id="chat-send" type="submit" aria-label="Send message" disabled><i class="fa-solid fa-paper-plane chat-icon" aria-hidden="true"></i></button></div><div class="chat-form-bottom"><span id="chat-keyboard-hint">Enter to send · Shift + Enter for a new line</span><span id="chat-counter" hidden>0 / 700</span><button id="chat-stop" type="button" hidden><i class="fa-solid fa-stop chat-icon" aria-hidden="true"></i>Stop waiting</button></div></form>
    <p class="chat-note">Check product details before buying. Keep payment details private.</p>`;
  document.body.append(launcher, dialog);
  const log = dialog.querySelector('#chat-log');
  const input = dialog.querySelector('#chat-input');
  const send = dialog.querySelector('#chat-send');
  const status = dialog.querySelector('#chat-status');
  const prompts = dialog.querySelector('#chat-prompts');
  const retry = dialog.querySelector('#chat-retry');
  let history = [];
  let busy = false;
  let controller = null;
  let stopped = false;
  let failedMessage = '';
  const latest = dialog.querySelector('#chat-latest');
  let lastReply = null;
  function atBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 70; }
  function scrollToLatest() { log.scrollTop = log.scrollHeight; latest.hidden = true; }
  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 116) + 'px';
    send.disabled = busy || (!input.value.trim() && !selectedPhoto);
    const counter = dialog.querySelector('#chat-counter');
    counter.textContent = input.value.length + ' / 700';
    counter.hidden = input.value.length < 550;
  }
  function scrollToReply(bubble) {
    const top = bubble.getBoundingClientRect().top - log.getBoundingClientRect().top;
    log.scrollTop += top - parseFloat(getComputedStyle(log).paddingTop);
    latest.hidden = true;
  }
  log.addEventListener('scroll', () => {
    if (!lastReply) { latest.hidden = true; return; }
    const top = lastReply.getBoundingClientRect().top - log.getBoundingClientRect().top;
    latest.hidden = top >= 0 && top < log.clientHeight;
  });
  latest.addEventListener('click', () => { if (lastReply) scrollToReply(lastReply); });
  const expand = dialog.querySelector('#chat-expand');
  expand.addEventListener('click', () => {
    const expanded = dialog.classList.toggle('expanded');
    expand.setAttribute('aria-pressed', String(expanded));
    expand.setAttribute('aria-label', expanded ? 'Reduce chat size' : 'Expand chat');
    expand.replaceChildren(icon(expanded ? 'compress' : 'expand'));
  });
  function fitViewport() {
    if (!dialog.open) return;
    if (matchMedia('(max-width:600px)').matches && window.visualViewport) {
      dialog.classList.toggle('keyboard-open', visualViewport.height < document.documentElement.clientHeight * 0.8);
      dialog.style.top = (visualViewport.offsetTop + 8) + 'px';
      dialog.style.height = Math.max(240, visualViewport.height - 16) + 'px';
    } else { dialog.classList.remove('keyboard-open'); dialog.style.removeProperty('top'); dialog.style.removeProperty('height'); }
  }
  window.visualViewport?.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('scroll', fitViewport);
  window.addEventListener('resize', fitViewport);

  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-message ' + role;
    bubble.dir = 'auto';
    const name = document.createElement('span');
    name.className = 'chat-speaker';
    name.textContent = role === 'user' ? 'You' : 'LUMIÈRE';
    const content = document.createElement('p');
    content.textContent = text;
    bubble.append(name, content);
    log.append(bubble);
    if (role === 'user') scrollToLatest();
    return bubble;
  }

  function greeting() {
    addMessage('assistant', 'A little help finding your next favorite. Tell me what you have in mind, or choose a question below.\nاحكي معي بالعربي أو بالإنجليزي.');
  }

  function showSuggestions(messages) {
    prompts.replaceChildren();
    messages.forEach(text => {
      const button = document.createElement('button');
      button.type = 'button'; button.dir = 'auto'; iconLabel(button,/مقاس|size/iu.test(text)?'ruler':/توصيل|delivery/iu.test(text)?'truck':/ارخص|أرخص|cheaper/iu.test(text)?'tag':'comment-dots',text);
      button.addEventListener('click', () => ask(text)); prompts.append(button);
    });
    prompts.hidden = false;
  }

  function storeLink(page) {
    const allowed = ['Landing.html#shop', 'visual-search.html', 'account/index.html', 'account/index.html#shopping-preferences-title'];
    return new URL('frontend/' + (allowed.includes(page) ? page : 'Landing.html#shop'), projectRoot).href;
  }

  function colorSwatches(colors) {
    const group = document.createElement('span'); group.className = 'chat-swatches';
    const palette = {black:'#171717',white:'#ffffff',red:'#c73535',blue:'#346aa5','navy blue':'#172b49',navy:'#172b49',beige:'#d6c3a4',brown:'#79543d',green:'#42754a',olive:'#737c45',gray:'#8a8a8a',grey:'#8a8a8a',pink:'#e697b1',purple:'#865b9b',yellow:'#e5c94b',orange:'#d9843d',cream:'#f5efdf',ivory:'#fffff0',burgundy:'#7b293d',khaki:'#b6aa80',tan:'#c39669',اسود:'#171717','أسود':'#171717',ابيض:'#ffffff','أبيض':'#ffffff',احمر:'#c73535','أحمر':'#c73535',ازرق:'#346aa5','أزرق':'#346aa5',بيج:'#d6c3a4',بني:'#79543d',اخضر:'#42754a','أخضر':'#42754a',رمادي:'#8a8a8a',كحلي:'#172b49'};
    [...new Set(colors)].forEach(color => {
      const value = String(color).trim(); const key = value.toLowerCase();
      const swatch = document.createElement('span'); swatch.className = 'chat-swatch';
      swatch.title = value; swatch.setAttribute('role','img'); swatch.setAttribute('aria-label',value); swatch.tabIndex = 0;
      let paint = palette[key];
      if (!paint && /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(key) && !['inherit','initial','unset','currentcolor','transparent'].includes(key) && CSS.supports('color',key)) paint = key;
      if (paint) swatch.style.backgroundColor = paint;
      else { swatch.classList.add('unknown'); swatch.textContent = '?'; }
      const hint = document.createElement('span'); hint.className = 'chat-color-hint'; hint.textContent = value; hint.setAttribute('aria-hidden','true'); swatch.append(hint);
      group.append(swatch);
    });
    return group;
  }

  function addProducts(bubble, products) {
    const list = document.createElement('div');
    list.className = 'chat-products';
    products.forEach(product => {
      const card = document.createElement('article');
      const image = document.createElement('img');
      try {
        const url = new URL(product.image_url, projectRoot);
        if (['http:', 'https:'].includes(url.protocol)) image.src = url;
      } catch {}
      image.alt = product.name;
      image.width = 88; image.height = 110;
      image.loading = 'lazy';
      image.addEventListener('error', () => { image.hidden = true; card.classList.add('no-photo'); }, {once:true});
      const details = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = product.name;
      const price = document.createElement('strong');
      price.textContent = new Intl.NumberFormat('en-JO', {style:'currency',currency:'JOD'}).format(product.price);
      price.prepend(icon('tag'));
      details.append(title, price);
      addReasons(details, product);
      if (product.review_count > 0 && product.average_rating != null) {
        const rating = document.createElement('p');
        rating.className = 'chat-rating';
        rating.textContent = ' ' + Number(product.average_rating).toFixed(2) + '/5 · ' + product.review_count + ' reviews';
        rating.prepend(icon('star'));
        details.append(rating);
      }
      const variants = document.createElement('p');
      const variantDetails = document.createElement('details');
      const variantTitle = document.createElement('summary');
      iconLabel(variantTitle,'ruler','Sizes & colors');
      variantDetails.append(variantTitle, variants);
      variants.textContent = 'Sizes: ' + [...new Set(product.variants.map(v => v.size))].join(', ');
      variants.append(document.createElement('br'),colorSwatches(product.variants.map(v => v.color)));
      const link = document.createElement('a');
      const productUrl = new URL('frontend/Landing.html', projectRoot);
      productUrl.searchParams.set('product', String(product.id));
      productUrl.hash = 'shop';
      link.href = productUrl;
      iconLabel(link,'arrow-up-right-from-square','View in store');
      const compare = document.createElement('button');
      compare.type = 'button'; compare.className = 'chat-compare-pick'; compare.dataset.compareId = String(product.id);
      compare.setAttribute('aria-label', 'Compare ' + product.name);
      compare.addEventListener('click', () => {
        if (compareIds.has(product.id)) compareIds.delete(product.id);
        else if (compareIds.size < 2) compareIds.add(product.id);
        else status.textContent = 'Choose at most two pieces. Clear a selection to choose another.';
        updateCompare();
      });
      details.append(variantDetails, link, compare);
      const photoLink = document.createElement('a');
      photoLink.className = 'chat-product-photo';
      photoLink.href = productUrl;
      photoLink.setAttribute('aria-label', 'View ' + product.name + ' in store');
      photoLink.append(image);
      card.append(photoLink, details); list.append(card);
    });
    if (products.length) bubble.append(list);
    updateCompare();
  }

  const compareIds = new Set();
  let selectedPhoto = null;
  let visualContext = null;
  let failedOptions = {};
  const photoUrls = [];
  const attach = dialog.querySelector('#chat-attach');
  const photoInput = dialog.querySelector('#chat-photo');
  const pendingPhoto = dialog.querySelector('#chat-pending-photo');
  const compareBar = dialog.querySelector('#chat-compare-bar');
  const compareGo = dialog.querySelector('#chat-compare-go');
  function updateCompare() {
    compareBar.hidden = compareIds.size === 0;
    dialog.querySelector('#chat-compare-count').textContent = compareIds.size + ' / 2 selected';
    compareGo.disabled = busy || compareIds.size !== 2;
    dialog.querySelectorAll('[data-compare-id]').forEach(button => {
      const selected = compareIds.has(Number(button.dataset.compareId));
      button.setAttribute('aria-pressed', String(selected));
      iconLabel(button,selected?'check':'scale-balanced',selected?'Selected':'Compare');
    });
  }
  function resetShopping() {
    compareIds.clear(); updateCompare(); visualContext = null; selectedPhoto = null; failedOptions = {};
    pendingPhoto.hidden = true; photoInput.value = '';
    photoUrls.forEach(url => URL.revokeObjectURL(url)); photoUrls.length = 0;
  }
  attach.addEventListener('click', () => { if (!busy) { photoInput.value = ''; photoInput.click(); } });
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0]; if (!file || busy) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5242880) {
      dialog.close(); await Alerts.show('Choose a photo', 'Use JPG, PNG or WebP up to 5 MB.', 'warning'); dialog.showModal(); fitViewport(); return;
    }
    const url = URL.createObjectURL(file);
    try {
      const check = new Image(); check.src = url; await check.decode();
      if (check.naturalWidth * check.naturalHeight > 20000000) throw new Error('Use a photo up to 20 megapixels.');
      selectedPhoto = {file,url}; photoUrls.push(url);
      pendingPhoto.querySelector('img').src = url;
      pendingPhoto.querySelector('span').textContent = file.name;
      pendingPhoto.hidden = false; resizeInput();
    } catch (error) {
      URL.revokeObjectURL(url); dialog.close(); await Alerts.show('Photo could not be opened', 'Use a valid image up to 20 megapixels.', 'warning'); dialog.showModal(); fitViewport();
    }
  });
  dialog.querySelector('#chat-remove-photo').addEventListener('click', () => { selectedPhoto = null; pendingPhoto.hidden = true; photoInput.value = ''; resizeInput(); });
  dialog.querySelector('#chat-compare-clear').addEventListener('click', () => { compareIds.clear(); updateCompare(); });
  compareGo.addEventListener('click', () => {
    const previous = history.filter(row => row.role === 'user').at(-1)?.content || '';
    if (compareIds.size === 2 && !busy) ask(/\p{Script=Arabic}/u.test(previous) ? 'قارن هالمنتجين' : 'Compare these two products', false, {action:'compare',product_ids:[...compareIds]});
  });
  function addReasons(details, product) {
    if (!Array.isArray(product.recommendation_reasons) || !product.recommendation_reasons.length) return;
    const reasons = document.createElement('ul'); reasons.className = 'chat-reasons';
    product.recommendation_reasons.forEach(text => { const li = document.createElement('li'); li.textContent = text; reasons.append(li); });
    details.append(reasons);
  }
  function addComparison(bubble, products) {
    if (!Array.isArray(products) || products.length !== 2) return;
    const arabic = /\p{Script=Arabic}/u.test(bubble.querySelector('p').textContent);
    const wrapper = document.createElement('div'); wrapper.className = 'chat-comparison'; wrapper.tabIndex = 0; wrapper.dir = arabic ? 'rtl' : 'ltr';
    wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','Product comparison');
    const table = document.createElement('table');
    const caption = document.createElement('caption'); caption.textContent = arabic ? 'مقارنة جنباً إلى جنب' : 'Side by side'; table.append(caption);
    const head = document.createElement('thead'); const row = document.createElement('tr');
    [arabic ? 'التفصيل' : 'Detail', ...products.map(p => p.name)].forEach(text => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; row.append(th); }); head.append(row); table.append(head);
    const body = document.createElement('tbody');
    const money = value => new Intl.NumberFormat('en-JO',{style:'currency',currency:'JOD'}).format(value);
    const rows = [
      ['Price', p => money(p.price)],
      ['Rating', p => p.review_count ? Number(p.average_rating).toFixed(2)+'/5 · '+p.review_count+' reviews' : 'No reviews'],
      ['Sizes', p => [...new Set(p.variants.map(v => v.size))].join(', ') || 'Out of stock'],
      ['Colors', p => [...new Set(p.variants.map(v => v.color))].join(', ') || 'Out of stock'],
    ];
    const labels = {Price:'السعر',Rating:'التقييم',Sizes:'المقاسات',Colors:'الألوان',Material:'الخامة',Brand:'العلامة',Care:'العناية','Size guide':'دليل المقاسات'};
    rows.forEach(([label,value]) => {
      const tr = document.createElement('tr'); const th = document.createElement('th'); th.scope = 'row'; iconLabel(th,({Price:'tag',Rating:'star',Sizes:'ruler',Colors:'palette'})[label],arabic ? labels[label] : label); tr.append(th);
      products.forEach(product => { const td = document.createElement('td'); const text = value(product); if (label === 'Colors' && product.variants.length) { td.append(colorSwatches(product.variants.map(v => v.color))); tr.append(td); return; } td.textContent = arabic ? text.replace('Not provided','غير مسجل').replace('No reviews','لا يوجد تقييم معتمد').replace('reviews','تقييم معتمد').replace('Out of stock','غير متوفر') : text; tr.append(td); }); body.append(tr);
    });
    table.append(body); wrapper.append(table); bubble.append(wrapper);
  }
  function addOutfit(bubble, outfit) {
    if (!outfit) return;
    const summary = document.createElement('div'); summary.className = 'chat-outfit';
    const money = value => new Intl.NumberFormat('en-JO',{style:'currency',currency:'JOD'}).format(value);
    const title = document.createElement('strong'); title.textContent = 'Complete outfit · '+money(outfit.total);
    const info = document.createElement('p'); info.textContent = 'Budget '+money(outfit.budget)+' · Remaining '+money(outfit.remaining)+' · Delivery excluded';
    summary.append(title,info); bubble.append(summary);
  }

  async function ask(message, retrying = false, extra = {}) {
    if (busy || !message.trim()) return;
    busy = true; stopped = false; failedMessage = '';
    attach.disabled = true; updateCompare();
    retry.hidden = true;
    prompts.hidden = true;
    send.disabled = true;
    dialog.querySelector('#chat-clear').disabled = true;
    dialog.querySelector('#chat-stop').hidden = false;
    if (!retrying) {
      const userBubble = addMessage('user', message);
      if (extra.file) { const photo = document.createElement('img'); photo.className = 'chat-user-photo'; photo.src = extra.previewUrl; photo.alt = 'Your visual search photo'; photo.width = 150; photo.height = 150; userBubble.append(photo); scrollToLatest(); }
    }
    status.textContent = /\p{Script=Arabic}/u.test(message) ? 'عم أراجع معلومات المتجر…' : 'Checking our collection…';
    status.classList.add('thinking');
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 110000);
    try {
      await EcoAuth.ready;
      await EcoAuth.refresh();
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      let action = extra.action || 'message';
      let visualIds = visualContext?.ids || [];
      if (extra.file) {
        status.textContent = 'Finding pieces from your photo…';
        const form = new FormData(); form.append('image', extra.file);
        const imageResponse = await fetch(new URL('backend/api/visual-search.php', projectRoot), {method:'POST',body:form,credentials:'same-origin',headers:{'X-CSRF-Token':EcoAuth.token()},signal:controller.signal});
        let imageData;
        try { imageData = await imageResponse.json(); } catch { throw new Error('The photo search returned an unexpected response. Please try again.'); }
        if (!imageResponse.ok || !imageData.success) throw new Error(imageData.message || 'The photo search could not finish.');
        visualIds = imageData.products.map(p => Number(p.id)); action = 'visual';
      }
      const response = await fetch(new URL('backend/api/customer-chat.php', projectRoot), {
        method:'POST', credentials:'same-origin', signal:controller.signal,
        headers:{'Content-Type':'application/json','X-CSRF-Token':EcoAuth.token()},
        body:JSON.stringify({message,history:history.slice(-8),action,product_ids:extra.product_ids||[],visual_ids:visualIds,visual_anchor_id:visualContext?.anchor_id||null})
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('The server returned an unexpected response. Please try again.'); }
      if (!response.ok || !data.success) throw new Error(data.message || 'The assistant is unavailable.');
      const followLatest = atBottom();
      const bubble = addMessage('assistant', data.reply);
      addOutfit(bubble, data.outfit);
      addComparison(bubble, data.comparison);
      if (data.comparison) { compareIds.clear(); updateCompare(); }
      addProducts(bubble, data.products || []);
      if (Object.hasOwn(data, 'visual_context')) visualContext = data.visual_context;
      (data.links || []).forEach(item => {
        const link = document.createElement('a'); link.className = 'chat-action'; link.href = storeLink(item.page); link.textContent = item.label; bubble.append(link);
      });
      history.push({role:'user',content:message}, {role:'assistant',content:(data.reply + '\n' + (data.products || []).map(p=>p.name+' ('+p.price+' JOD)').join(', ')).slice(0,1000)});
      history = history.slice(-8);
      const followUps = /\p{Script=Arabic}/u.test(message)
        ? ['خيارات أرخص', 'شو المقاسات المتوفرة؟', 'قديش التوصيل؟']
        : ['Show cheaper options', 'What sizes are available?', 'Delivery fees'];
      showSuggestions(visualContext ? (/\p{Script=Arabic}/u.test(message) ? ['خيارات أرخص من الصورة','نفس النوع بالأسود','قديش التوصيل؟'] : ['Cheaper from this photo','Same type in black','Delivery fees']) : followUps);
      lastReply = bubble;
      if (followLatest) requestAnimationFrame(() => scrollToReply(bubble)); else latest.hidden = false;
      status.textContent = data.mode === 'catalog_fallback' ? 'Direct catalog lookup · Limited interpretation' : data.mode === 'catalog' ? 'Checked against current store data' : 'Based on current store information';
    } catch(error) {
      failedMessage = message;
      failedOptions = extra;
      retry.hidden = false;
      status.textContent = stopped ? 'Stopped waiting. You can retry or ask another question.' : 'Message not answered. Your conversation is still here.';
      if (!stopped && dialog.open) {
        dialog.close();
        await Alerts.show('Assistant unavailable', error.name === 'AbortError' ? 'The assistant took too long. Please try again.' : error.message, 'error');
        dialog.showModal(); fitViewport();
      }
    } finally {
      clearTimeout(timer);
      busy = false;
      attach.disabled = false; updateCompare();
      controller = null;
      dialog.querySelector('#chat-clear').disabled = false;
      resizeInput();
      status.classList.remove('thinking');
      dialog.querySelector('#chat-stop').hidden = true;
    }
  }

  launcher.addEventListener('click', () => { dialog.showModal(); fitViewport(); resizeInput(); if (matchMedia('(min-width:761px)').matches) input.focus(); });
  dialog.querySelector('#chat-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector('#chat-form').addEventListener('submit', event => {
    event.preventDefault();
    const photo = selectedPhoto;
    const message = input.value.trim() || (photo ? 'Find similar pieces from this photo' : '');
    if (!message || busy) return;
    selectedPhoto = null; pendingPhoto.hidden = true;
    input.value = ''; resizeInput();
    ask(message, false, photo ? {file:photo.file,previewUrl:photo.url} : {});
  });
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && matchMedia('(pointer:fine)').matches) { event.preventDefault(); dialog.querySelector('#chat-form').requestSubmit(); }
  });
  prompts.querySelectorAll('button').forEach(button => button.addEventListener('click', () => ask(button.textContent)));
  retry.addEventListener('click', () => ask(failedMessage, true, failedOptions));
  dialog.querySelector('#chat-stop').addEventListener('click', () => { stopped = true; controller?.abort(); });
  dialog.querySelector('#chat-clear').addEventListener('click', async () => {
    if (busy) { status.textContent = 'Wait for the reply or stop waiting before starting a new chat.'; return; }
    if (!history.length && !failedMessage && !input.value.trim()) return;
    dialog.close();
    const answer = await Alerts.confirm('Start a new chat?', 'This clears the conversation on this page.');
    dialog.showModal();
    if (!answer.isConfirmed) return;
    resetShopping();
    history = []; failedMessage = ''; lastReply = null; log.replaceChildren(); greeting(); showSuggestions(['Shoes under 80 JOD', 'How much is delivery?', 'بدي أختار قطعة حسب ميزانيتي']); retry.hidden = true; status.textContent = ''; input.value = ''; resizeInput(); input.focus(); scrollToLatest();
  });
  window.addEventListener('pagehide', () => { controller?.abort(); photoUrls.forEach(url => URL.revokeObjectURL(url)); });
  greeting();
})();
