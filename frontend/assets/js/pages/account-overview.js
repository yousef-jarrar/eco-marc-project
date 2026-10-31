(function () {
  const ordersStatus = document.getElementById('account-orders-status');
  const ordersRetry = document.getElementById('account-orders-retry');
  const profileStatus = document.getElementById('account-profile-status');
  const profileRetry = document.getElementById('account-profile-retry');
  const ordersList = document.getElementById('account-recent-orders');

  async function getAccountData(path) {
    const response = await EcoAuth.fetch(new URL(path, location.href));
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Please try again in a moment.');
    return result.data;
  }

  async function loadDetails() {
    profileRetry.hidden = true;
    profileStatus.hidden = true;
    try {
      const user = await getAccountData('../../backend/api/profile.php');
      if (!user || typeof user !== 'object') throw new Error('Your details could not be loaded.');
      document.getElementById('account-email').textContent = user.email || 'Email not available';
      document.getElementById('account-phone').textContent = user.phone || 'No phone number saved. Add one before your next order.';
      document.getElementById('account-address').textContent = user.address || 'No address saved yet. Add your delivery address in Personal information.';
    } catch (error) {
      document.getElementById('account-phone').textContent = 'Phone unavailable';
      document.getElementById('account-address').textContent = 'Address unavailable';
      profileStatus.textContent = 'Your saved details could not be loaded.';
      profileStatus.hidden = false;
      profileRetry.hidden = false;
    }
  }

  async function loadOrders() {
    ordersRetry.hidden = true;
    ordersStatus.hidden = false;
    ordersStatus.textContent = 'Loading your recent orders…';
    ordersList.setAttribute('aria-busy', 'true');
    ordersList.replaceChildren();
    try {
      const orders = await getAccountData('../../backend/api/cart.php?action=my_orders&page=1');
      if (!Array.isArray(orders)) throw new Error('Orders could not be loaded.');
      if (!orders.length) {
        ordersStatus.textContent = 'Your first find is waiting. Explore the collection to start your first order.';
        const shop = document.createElement('a');
        shop.href = '../shop.html';
        shop.className = 'profile-button';
        shop.textContent = 'Explore the collection';
        ordersList.append(shop);
        return;
      }
      ordersStatus.hidden = true;
      for (const order of orders.slice(0, 3)) {
        const row = document.createElement('a');
        row.className = 'account-order-row';
        row.href = 'Order-success.html?order=' + encodeURIComponent(order.order_id);
        const identity = document.createElement('div');
        const number = document.createElement('strong');
        number.textContent = 'Order #' + order.order_id;
        const date = document.createElement('span');
        const placed = new Date(String(order.placed_at || '').replace(' ', 'T'));
        date.textContent = Number.isNaN(placed.getTime()) ? 'Date unavailable' : placed.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
        identity.append(number, date);
        const status = document.createElement('span');
        const known = ['pending','confirmed','processing','shipped','delivered','cancelled'];
        const value = String(order.status || '').toLowerCase();
        status.className = 'account-order-status' + (known.includes(value) ? ' is-' + value : '');
        status.textContent = known.includes(value) ? value[0].toUpperCase() + value.slice(1) : 'Status unavailable';
        const total = document.createElement('strong');
        total.className = 'account-order-total';
        total.textContent = new Intl.NumberFormat('en-JO', {style:'currency',currency:'JOD'}).format(Number(order.total) || 0);
        const arrow = document.createElement('i');
        arrow.className = 'fa-solid fa-arrow-up-right-from-square';
        arrow.setAttribute('aria-hidden', 'true');
        row.append(identity, status, total, arrow);
        ordersList.append(row);
      }
    } catch (error) {
      ordersStatus.textContent = 'Your recent orders could not be loaded. Try again or open My orders.';
      ordersRetry.hidden = false;
    } finally {
      ordersList.removeAttribute('aria-busy');
    }
  }

  ordersRetry.addEventListener('click', loadOrders);
  profileRetry.addEventListener('click', loadDetails);
  EcoAuth.ready.then(function (session) {
    if (!session.user) return;
    loadDetails();
    loadOrders();
  }).catch(function () {
    ordersStatus.textContent = 'Your session could not be loaded. Reload this page to try again.';
    document.getElementById('account-phone').textContent = 'Phone unavailable';
    document.getElementById('account-address').textContent = 'Address unavailable';
  });
})();
