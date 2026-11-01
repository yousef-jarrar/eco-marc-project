(function () {
  function appendNumbers(parent, value) {
    const text = String(value ?? '');
    const pattern = /\d{4}-\d{2}-\d{2}|(?:JOD\s*)?[+-]?(?:[0-9٠-٩۰-۹]{1,3}(?:[,٬][0-9٠-٩۰-۹]{3})+|[0-9٠-٩۰-۹]+)(?:[.٫][0-9٠-٩۰-۹]+)?(?:\s*(?:%|٪|JOD))?/g;
    let start = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(start,match.index)));
      const span = document.createElement('bdi');
      span.className = /^\d{4}-\d{2}-\d{2}$/.test(match[0]) ? 'answer-inline-date' : 'answer-inline-number';
      span.textContent = match[0];
      span.dir = 'ltr';
      parent.append(span);
      start = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }

  function richLine(parent, text) {
    for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
      if (part.startsWith('**') && part.endsWith('**')) {
        const strong = document.createElement('strong');
        appendNumbers(strong,part.slice(2,-2));
        parent.append(strong);
      } else appendNumbers(parent,part);
    }
  }

  function renderText(container, value) {
    container.replaceChildren();
    container.classList.add('answer-readable');
    container.lang = /[\u0600-\u06ff]/.test(String(value)) ? 'ar' : 'en';
    let list;
    for (const line of String(value ?? '').split(/\r?\n/)) {
      if (!line.trim()) {list=null;continue;}
      const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
      let node;
      if (bullet) {
        if (!list) {list=document.createElement('ul');container.append(list);}
        node=document.createElement('li');list.append(node);richLine(node,bullet[1]);
      } else {
        list=null;
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        node=document.createElement(heading?'h3':'p');richLine(node,heading?heading[1]:line);container.append(node);
      }
    }
  }

  function renderSummary(article, result) {
    if (result.intent !== 'revenue' || !result.summary) return;
    const ar = /[\u0600-\u06ff]/.test(result.answer || '');
    const definitions = [
      ['revenue',ar?'إيراد الطلبات':'Order revenue',true],
      ['eligible_orders',ar?'طلبات مؤهلة':'Eligible orders',false],
      ['average_order_value',ar?'متوسط الطلب':'Average order value',true]
    ];
    const panel=document.createElement('section');panel.className='answer-summary-metrics';panel.dir=ar?'rtl':'ltr';panel.setAttribute('aria-label',ar?'أرقام الفترة':'Period figures');
    for (const [key,label,currency] of definitions) {
      const value=result.summary[key];
      if (value===null || value===undefined || !Number.isFinite(Number(value))) continue;
      const card=document.createElement('div');card.className='answer-summary-metric'+(key==='revenue'?' is-primary':'');
      const name=document.createElement('span');name.textContent=label;
      const strong=document.createElement('strong');const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=currency?formatJOD(value):new Intl.NumberFormat('en-JO').format(value);strong.append(bdi);card.append(name,strong);panel.append(card);
    }
    if(panel.children.length){const text=article.querySelector('.message-text');if(text)text.before(panel);else article.append(panel);}
  }

  function enhanceRecord(item, row, type) {
    let value,unit;
    if(type==='products') {value=row.units_sold;unit='units sold';}
    else if(type==='reviews') {value=row.average_rating;unit='/ 5';}
    else if(type==='orders') {value=row.total;unit='orders';}
    else return;
    if(value===undefined || value===null || !Number.isFinite(Number(value)))return;
    const metric=document.createElement('div');metric.className='answer-record-value';
    const strong=document.createElement('strong');const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=new Intl.NumberFormat('en-JO',{maximumFractionDigits:type==='reviews'?2:0}).format(value);strong.append(bdi);
    const label=document.createElement('span');label.textContent=unit;metric.append(strong,label);
    const description=item.firstElementChild;
    if(description)description.after(metric);else item.append(metric);
    const detail=description?.querySelector('small');
    if(type==='products'&&detail)detail.textContent='Sales in the selected period';
    if(type==='orders'&&detail)detail.textContent='Selected reporting period';
    if(type==='reviews'&&detail){detail.replaceChildren();appendNumbers(detail,number(row.total_reviews)+' approved reviews');}
  }
  window.AdminAnswerView={renderText,renderSummary,enhanceRecord};
})();
