(function () {
  'use strict';
  const root = new URL('../../../', document.currentScript.src);
  const api = new URL('backend/api/', root);
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat('en-JO', { style: 'currency', currency: 'JOD' }).format(Number(value) || 0);
  let products = [], categories = [], categoriesReady = false, productsReady = false;
  let productsLoading = false, categoriesLoading = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  async function getJSON(file) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(new URL(file, api), { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Collection unavailable');
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function rows(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    throw new Error('Unexpected collection response');
  }
  function imageURL(value) {
    if (!value) return '';
    try {
      const base = /^(frontend\/|backend\/|assets\/products\/)/.test(value) ? root : new URL('frontend/', root);
      const url = new URL(value, base);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }
  function loading(container, label) {
    container.setAttribute('aria-busy', 'true');
    const status = node('p', 'lp-loading', label);
    status.setAttribute('role', 'status');
    container.replaceChildren(status);
    for (let i = 0; i < 4; i++) {
      const skeleton = node('div', 'lp-skeleton');
      skeleton.setAttribute('aria-hidden', 'true');
      container.append(skeleton);
    }
  }
  function state(container, message, retry) {
    const box = node('div', 'lp-state');
    box.setAttribute('role', 'status');
    box.append(node('p', '', message));
    if (retry) {
      const button = node('button', '', 'Try again');
      button.type = 'button';
      button.addEventListener('click', retry);
      box.append(button);
    }
    container.replaceChildren(box);
    container.setAttribute('aria-busy', 'false');
  }
  function drawCategories() {
    if (!categoriesReady) return;
    const container = $('#landing-categories');
    if (!categories.length) { state(container, 'New collections are on their way. Explore the shop for more.'); return; }
    const tiles = categories.slice(0, 4).map((category, index) => {
      const link = node('a', 'lp-category');
      link.href = 'shop.html?category=' + encodeURIComponent(category.id);
      const media = node('div', 'lp-category-media');
      const image = node('img');
      const matching = products.filter(product => String(product.category_id) === String(category.id));
      image.src = imageURL(category.image_url || matching[0]?.image_url) || imageURL('assets/images/auth-collection.jpg');
      image.alt = category.name;
      image.width = 600; image.height = 800; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => { image.src = imageURL('assets/images/auth-collection.jpg'); }, { once: true });
      media.append(image, node('span', 'lp-category-index', String(index + 1).padStart(2, '0')));
      const title = node('div', 'lp-category-title');
      const arrow = node('i', 'fa-solid fa-arrow-up-right-from-square');
      arrow.setAttribute('aria-hidden', 'true');
      title.append(node('h3', '', category.name), arrow);
      const note = productsReady ? matching.length + (matching.length === 1 ? ' piece to discover' : ' pieces to discover') : 'Explore the collection';
      link.append(media, title, node('p', 'lp-category-note', note));
      return link;
    });
    container.replaceChildren(...tiles);
    container.setAttribute('aria-busy', 'false');
  }
  async function loadCategories() {
    if (categoriesLoading) return;
    categoriesLoading = true;
    loading($('#landing-categories'), 'Loading collections…');
    try {
      categories = rows(await getJSON('categories.php')).filter(item => (item.status === undefined || item.status === 'active') && (item.is_active === undefined || Number(item.is_active) === 1));
      categoriesReady = true;
      drawCategories();
      updateLookLinks();
    } catch {
      state($('#landing-categories'), 'We couldn’t load the collections. Please try again.', loadCategories);
    } finally { categoriesLoading = false; }
  }
  function drawProducts(container, items) {
    if (!items.length) { state(container, 'There are no pieces to show here yet. Check back soon.'); return; }
    container.replaceChildren(...items.map(product => ProductCards.create(product)));
    container.setAttribute('aria-busy', 'false');
  }
  function saleRate(product) {
    const original = Number(product.original_price ?? product.price);
    const percent = Number(product.discount_id) > 0 ? Math.max(0, Math.min(100, Number(product.discount_percentage) || 0)) : 0;
    const price = product.original_price !== undefined ? Number(product.price) : original * (1 - percent / 100);
    return Number.isFinite(original) && Number.isFinite(price) && original > 0 && price >= 0 && price < original ? Math.round((1 - price / original) * 1000000) / 10000 : 0;
  }
  function drawSaleProducts() {
    const items = products.filter(product => saleRate(product) > 0).sort((a, b) => saleRate(b) - saleRate(a));
    const savings = $('#sale-savings');
    savings.hidden = !items.length;
    if (!items.length) {
      state($('#sale-grid'), 'There are no sale pieces right now. Explore the collection for your next favourite.');
      return;
    }
    const largest = Math.floor(saleRate(items[0]) * 10 + .00001) / 10;
    savings.textContent = 'Up to ' + largest.toLocaleString('en', { maximumFractionDigits: 1 }) + '% off';
    $('#sale-grid').style.setProperty('--sale-columns', Math.max(2, Math.min(4, items.length)));
    drawProducts($('#sale-grid'), items.slice(0, 4));
  }
  async function loadProducts() {
    if (productsLoading) return;
    productsLoading = true;
    const arrivals = $('#grid'), edit = $('#featured-grid');
    loading(arrivals, 'Loading new arrivals…'); loading(edit, 'Loading the collection…'); loading($('#look-grid'), 'Loading the collection…');
    loading($('#sale-grid'), 'Loading sale pieces…');
    $('#sale-savings').hidden = true;
    try {
      products = rows(await getJSON('Products.php')).filter(item => item.is_active === undefined || Number(item.is_active) === 1);
      products.sort((a, b) => ((Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)) || Number(b.id) - Number(a.id));
      const count = products.length > 4 ? 4 : Math.ceil(products.length / 2);
      drawProducts(arrivals, products.slice(0, count));
      const remainder = products.slice(count), selected = [], seen = new Set();
      remainder.forEach(product => { if (!seen.has(product.category_id) && selected.length < 4) { selected.push(product); seen.add(product.category_id); } });
      remainder.forEach(product => { if (!selected.includes(product) && selected.length < 4) selected.push(product); });
      drawProducts(edit, selected);
      drawSaleProducts();
      productsReady = true;
      drawCategories();
      drawLookProducts();
    } catch {
      [arrivals, edit, $('#look-grid'), $('#sale-grid')].forEach(container => state(container, 'The collection couldn’t be loaded. Please try again.', loadProducts));
    } finally { productsLoading = false; }
  }

  function updateLookLinks() {
    document.querySelectorAll('[data-look-category]').forEach(link => {
      const category = categories.find(item => String(item.name).toLowerCase() === link.dataset.lookCategory.toLowerCase());
      link.href = category ? 'shop.html?category=' + encodeURIComponent(category.id) : 'shop.html';
    });
  }
  function drawLookProducts() {
    const selected = [];
    [['Outerwear', 'jacket.jpg'], ['Tops', 'tee.jpg'], ['Footwear', 'court.jpg'], ['Accessories', 'tote.jpg']].forEach(([name, reference]) => {
      const matches = products.filter(product => String(product.category_name || product.category || '').toLowerCase() === name.toLowerCase());
      const match = matches.find(product => String(product.image_url || '').split('?')[0].endsWith('/' + reference)) || matches.find(product => product.variants?.some(variant => Number(variant.quantity) > 0)) || matches[0];
      if (match) selected.push(match);
    });
    if (!selected.length) selected.push(...products.slice(0, 4));
    drawProducts($('#look-grid'), selected);
    if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  const stage = $('#outfit-stage');
  const header = $('.public-header');
  let headerHeight = 109;
  function measureHeader() {
    headerHeight = Math.round(header.getBoundingClientRect().height);
    document.body.style.setProperty('--landing-header-height', headerHeight + 'px');
  }
  measureHeader();
  if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
  const chapterButtons = [...document.querySelectorAll('[data-look-chapter]')];
  let activeTimeline = null;
  chapterButtons.forEach(button => button.addEventListener('click', () => {
    if (!activeTimeline?.scrollTrigger) { $('#look-products').scrollIntoView({ behavior: 'auto', block: 'start' }); return; }
    const points = [.015, .49, .985];
    const trigger = activeTimeline.scrollTrigger;
    window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * points[Number(button.dataset.lookChapter)], behavior: motion.matches ? 'auto' : 'smooth' });
  }));
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width:901px)', tablet: '(min-width:601px) and (max-width:900px)', mobile: '(max-width:600px)', reduced: '(prefers-reduced-motion:reduce)', short: '(max-height:700px)' }, context => {
      const { mobile, tablet, reduced, short } = context.conditions;
      if (reduced || short) return;
      stage.classList.add('is-animated');
      const pieces = ['jacket', 'top', 'accessory', 'shoes'].map(name => document.querySelector('[data-look-layer="' + name + '"]'));
      const opening = mobile ? [[49, 58, 84, 0], [60, 58, 66, 3], [22, 80, 43, -6], [73, 82, 57, 5]] : tablet ? [[68, 44, 48, 0], [75, 43, 37, 3], [51, 76, 26, -6], [80, 77, 34, 5]] : [[67, 42, 39, 0], [75, 42, 30, 3], [52, 74, 22, -6], [79, 75, 28, 5]];
      const exploded = mobile ? [[26, 46, 56, -10], [75, 43, 47, 9], [24, 72, 37, -8], [75, 72, 52, 8]] : tablet ? [[24, 53, 39, -10], [75, 39, 32, 9], [47, 67, 24, 10], [79, 60, 31, -8]] : [[23, 53, 31, -12], [76, 36, 27, 10], [49, 64, 21, 10], [79, 60, 25, -9]];
      const final = mobile ? [[25, 43, 47, 0], [75, 43, 47, 0], [25, 76, 44, 0], [75, 76, 47, 0]] : [[16, 55, 23, 0], [39, 55, 23, 0], [61, 55, 23, 0], [84, 55, 23, 0]];
      pieces.forEach((piece, index) => {
        const [left, top, width, rotation] = opening[index];
        gsap.set(piece, { left: 0, top: 0, width: width + '%', x: () => stage.clientWidth * left / 100, y: () => stage.clientHeight * top / 100, xPercent: -50, yPercent: -50, rotation, transformPerspective: 1100, transformOrigin: '50% 50%' });
      });
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro.fromTo('.look-art', { clipPath: 'inset(8% 0% 92% 0%)', scale: .92 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.35, clearProps: 'clipPath,scale' }, 0)
        .fromTo('.look-line > span', { yPercent: 112, rotation: 3 }, { yPercent: 0, rotation: 0, stagger: .12, duration: .95 }, .15);
      let lastChapter = -1;
      const timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: {
        trigger: '.look-section', pin: stage, start: () => 'top top+=' + headerHeight,
        end: () => '+=' + Math.round(innerHeight * (mobile ? 1.65 : tablet ? 2.1 : 2.6)), scrub: mobile ? .32 : .65,
        invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: trigger => {
          const chapter = trigger.progress < .23 ? 0 : trigger.progress < .77 ? 1 : 2;
          pieces.forEach(piece => piece.tabIndex = trigger.progress > .36 ? 0 : -1);
          if (chapter !== lastChapter) {
            chapterButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === chapter)));
            stage.dataset.chapter = String(chapter);lastChapter = chapter;
          }
        }
      }});
      activeTimeline = timeline;
      timeline.to('.look-opening', { autoAlpha: 0, x: mobile ? 0 : -30, y: mobile ? -15 : 0, duration: 1.25 }, .25)
        .to('.look-watermark', { opacity: .1, scale: 1.08, duration: 3 }, .4)
        .fromTo('.look-exploded-copy', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .8 }, 1.4);
      pieces.forEach((piece, index) => {
        const [left, top, width, rotation] = exploded[index];
        const initial = opening[index];
        timeline.fromTo(piece, { x: () => stage.clientWidth * initial[0] / 100, y: () => stage.clientHeight * initial[1] / 100, scale: 1, rotation: initial[3], rotationY: 0, z: 0 }, { x: () => stage.clientWidth * left / 100, y: () => stage.clientHeight * top / 100, scale: width / initial[2], rotation, rotationY: mobile ? 0 : [-8, 8, -5, 7][index], z: mobile ? 0 : [45, -25, 30, 65][index], duration: 3.1 }, 1 + index * .15);
        timeline.to(piece.querySelector('.look-tag'), { scale: initial[2] / width, duration: 3.1 }, 1 + index * .15);
      });
      timeline.to('.look-tag', { autoAlpha: 1, y: 0, duration: .7, stagger: .08 }, 3.8)
        .to('.look-exploded-copy', { autoAlpha: 0, y: -15, duration: .7 }, 5.4)
        .fromTo('.look-final-copy', { autoAlpha: 0, y: 25 }, { autoAlpha: 1, y: 0, duration: 1 }, 6.2);
      pieces.forEach((piece, index) => {
        const [left, top, width, rotation] = final[index];
        timeline.to(piece, { x: () => stage.clientWidth * left / 100, y: () => stage.clientHeight * top / 100, scale: width / opening[index][2], rotation, rotationY: 0, z: 0, duration: 2.4 }, 6 + index * .12);
        timeline.to(piece.querySelector('.look-tag'), { scale: opening[index][2] / width, duration: 2.4 }, 6 + index * .12);
      });
      timeline.to('.look-progress > span', { scaleX: 1, duration: 10, ease: 'none' }, 0);
      const images = [...stage.querySelectorAll('img')];
      Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => { if (stage.isConnected && stage.classList.contains('is-animated')) ScrollTrigger.refresh(); });
      pieces.forEach(piece => piece.tabIndex = timeline.scrollTrigger.progress > .36 ? 0 : -1);
      return () => { intro.kill(); activeTimeline = null; pieces.forEach(piece => piece.removeAttribute('tabindex')); stage.classList.remove('is-animated'); delete stage.dataset.chapter; };
    });
    window.addEventListener('pagehide', event => { if (!event.persisted) media.revert(); });
    window.addEventListener('pageshow', event => { if (event.persisted) ScrollTrigger.refresh(); });
  }


  EcoAuth.ready.then(async session => {
    if (!session.user) {
      $('#cartBtn').href = EcoAuth.loginUrl + '?next=' + encodeURIComponent(new URL('frontend/account/cart.html', root).pathname);
      return;
    }
    $('#landing-dashboard').hidden = session.user.role !== 'admin';
    const response = await EcoAuth.fetch(new URL('cart.php?action=items', api));
    if (!response.ok) return;
    const result = await response.json();
    const count = (Array.isArray(result.data) ? result.data : []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    $('#cbadge').textContent = String(count);
    $('#cbadge').hidden = !count;
  }).catch(() => {});
  const chatButton = $('#chatOpen');
  chatButton.addEventListener('click', () => document.getElementById('customer-chat-launcher')?.click());
  chatButton.disabled = !document.getElementById('customer-chat-launcher');
  if (chatButton.disabled) {
    const chatObserver = new MutationObserver(() => {
      if (document.getElementById('customer-chat-launcher')) { chatButton.disabled = false; chatObserver.disconnect(); }
    });
    chatObserver.observe(document.body, { childList: true });
  }
  getJSON('Settings.php').then(settings => {
    const fee = Number(settings.delivery_fee);
    const free = settings.free_delivery_at == null ? null : Number(settings.free_delivery_at);
    if (Number.isFinite(fee)) $('#deliveryText').textContent = 'Delivery is ' + money(fee) + (free > 0 ? ', and free on orders over ' + money(free) + '.' : '.');
  }).catch(() => {});
  loadProducts();
  loadCategories();
})();


