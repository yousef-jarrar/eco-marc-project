(function () {
  'use strict';
  const instances = new WeakMap();
  let opened = null, nextId = 0;
  const palette = {
    black: '#171717', white: '#ffffff', gray: '#929292', grey: '#929292', red: '#bd343b', blue: '#346aa5', navy: '#172b49',
    green: '#42754a', yellow: '#d9b637', orange: '#d9843d', pink: '#df9bb6', purple: '#865b9b', brown: '#79543d', beige: '#d6c3a4',
    'dark green': '#193d36', burgundy: '#603d4b', 'burgundy red': '#603d4b', chocolate: '#362722', 'chocolate brown': '#362722',
    'grey marl': '#bebfc2', 'gray marl': '#bebfc2', 'navy blue': '#172b49', olive: '#7a8137', 'olive green': '#7a8137', cream: '#f5efdf'
  };
  function text(value) { return String(value).replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
  function swatch(value) {
    const element = document.createElement('span');
    element.className = 'eco-color-swatch';
    element.setAttribute('aria-hidden', 'true');
    const key = String(value).toLowerCase().trim().replace(/[_-]/g, ' ');
    const paint = palette[key] || (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(key) ? key : null);
    if (paint) element.style.backgroundColor = paint;
    else if (key) { element.classList.add('is-unknown'); element.textContent = '?'; }
    else element.classList.add('is-any');
    return element;
  }
  function enhance(select) {
    if (!select) return;
    if (instances.has(select)) { instances.get(select).refresh(); return; }
    const id = 'eco-color-' + (++nextId);
    const wrapper = document.createElement('div');
    wrapper.className = 'eco-color-select';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'eco-color-trigger'; button.id = id;
    button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', id + '-list');
    const list = document.createElement('div');
    list.className = 'eco-color-options'; list.id = id + '-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
    const label = select.labels?.[0];
    if (label) {
      if (!label.id) label.id = id + '-label';
      button.setAttribute('aria-labelledby', label.id + ' ' + id + '-value');
      list.setAttribute('aria-labelledby', label.id);
      label.addEventListener('click', event => { event.preventDefault(); button.focus(); });
    }
    let options = [], active = -1, typed = '', lastTyped = 0;
    function close() {
      list.hidden = true; button.setAttribute('aria-expanded', 'false'); button.removeAttribute('aria-activedescendant'); wrapper.classList.remove('is-open');
      if (opened === instance) opened = null;
    }
    function highlight(index) {
      active = index;
      [...list.children].forEach((option, i) => option.classList.toggle('is-highlighted', i === index));
      if (list.children[index]) {
        button.setAttribute('aria-activedescendant', list.children[index].id);
        list.children[index].scrollIntoView({ block: 'nearest' });
      }
    }
    function choose(index) {
      if (!options[index] || options[index].disabled) return;
      select.value = options[index].value;
      close();
      select.dispatchEvent(new Event('change', { bubbles: true }));
      button.focus({ preventScroll: true });
    }
    function refresh() {
      options = [...select.options].filter(option => !option.hidden && !option.disabled);
      const selected = options.find(option => option.value === select.value) || options[0];
      const name = document.createElement('span'); name.id = id + '-value'; name.className = 'eco-color-value'; name.textContent = selected ? text(selected.textContent) : 'No colors available';
      const chevron = document.createElement('i'); chevron.className = 'fa-solid fa-chevron-down'; chevron.setAttribute('aria-hidden', 'true');
      button.replaceChildren(swatch(selected?.value || ''), name, chevron);
      button.title = name.textContent;
      button.disabled = select.disabled || !options.length;
      list.replaceChildren(...options.map((option, index) => {
        const row = document.createElement('div'); row.className = 'eco-color-option'; row.id = id + '-option-' + index; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.value === select.value));
        const title = document.createElement('span'); title.textContent = text(option.textContent);
        row.append(swatch(option.value), title);
        row.addEventListener('mousedown', event => event.preventDefault());
        row.addEventListener('click', () => choose(index));
        return row;
      }));
      if (!list.hidden) highlight(Math.max(0, options.findIndex(option => option.value === select.value)));
    }
    function open() {
      if (button.disabled) return;
      if (opened && opened !== instance) opened.close();
      refresh(); list.hidden = false; opened = instance; wrapper.classList.add('is-open'); button.setAttribute('aria-expanded', 'true');
      const bounds = button.getBoundingClientRect();
      wrapper.classList.toggle('opens-up', innerHeight - bounds.bottom < Math.min(260, list.scrollHeight) && bounds.top > innerHeight - bounds.bottom);
      highlight(Math.max(0, options.findIndex(option => option.value === select.value)));
    }
    const instance = { refresh, close };
    instances.set(select, instance);
    select.before(wrapper); wrapper.append(select, button, list);
    select.hidden = true; select.setAttribute('aria-hidden', 'true'); select.tabIndex = -1;
    select.addEventListener('change', refresh);
    if (select.required) button.setAttribute('aria-required', 'true');
    select.addEventListener('invalid', event => { event.preventDefault(); button.setAttribute('aria-invalid', 'true'); button.focus(); open(); });
    select.addEventListener('change', () => { if (select.validity.valid) button.removeAttribute('aria-invalid'); });
    button.addEventListener('click', () => list.hidden ? open() : close());
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); event.preventDefault(); return; }
      if (event.key === 'Tab') { close(); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (list.hidden) { open(); if (!['Home', 'End'].includes(event.key)) return; }
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        highlight(next); return;
      }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (list.hidden) open(); else choose(active); return; }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); const now = Date.now(); typed = now - lastTyped > 700 ? event.key : typed + event.key; lastTyped = now;
        if (list.hidden) open();
        const index = options.findIndex(option => option.textContent.toLowerCase().startsWith(typed.toLowerCase()));
        if (index >= 0) highlight(index);
      }
    });
    wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) close(); });
    refresh();
  }
  document.addEventListener('pointerdown', event => { if (opened && !event.target.closest('.eco-color-select')) opened.close(); });
  window.addEventListener('resize', () => opened?.close());
  window.ColorSelect = { enhance, refresh: select => instances.get(select)?.refresh(), close: () => opened?.close() };
})();

