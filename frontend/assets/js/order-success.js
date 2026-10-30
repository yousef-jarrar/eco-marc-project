(async function () {
  const message = document.getElementById('success-message');
  const id = new URLSearchParams(location.search).get('order');
  const money = value => new Intl.NumberFormat('en-JO', {style:'currency',currency:'JOD'}).format(Number(value) || 0);
  try {
    await EcoAuth.ready;
    if (!/^\d+$/.test(id || '') || Number(id) < 1) throw new Error('Choose an order from My orders to see its confirmation.');
    const url = new URL('../../backend/api/cart.php', location.href);
    url.searchParams.set('action', 'my_order_details');
    url.searchParams.set('order_id', id);
    const response = await EcoAuth.fetch(url);
    const result = await response.json();
    if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'This order could not be loaded.');
    const order = result.data;
    document.getElementById('order-number').textContent = '#' + order.order_id;
    document.getElementById('success-status').textContent = 'is ' + order.status;
    for (const [element, field] of [['os-subtotal','subtotal'],['os-discount','discount_amount'],['os-delivery','delivery_fee'],['os-total','total']]) document.getElementById(element).textContent = money(order[field]);
    document.getElementById('os-address').textContent = order.shipping_address || 'Address not provided';
    document.getElementById('order-summary').hidden = false;
    message.hidden = true;
    sessionStorage.removeItem('last_order');
  } catch (error) {
    message.textContent = error.message || 'Open My orders to check your order.';
    Alerts.show('Order confirmation unavailable', message.textContent, 'error');
  }
})();
