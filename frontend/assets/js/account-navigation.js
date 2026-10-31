(function () {
  const sidebar = document.querySelector('.profile-sidebar[data-account-page]');
  if (!sidebar) return;
  const header = document.querySelector('.public-header');
  if (header) {
    const updateHeaderHeight = function () {
      document.documentElement.style.setProperty('--account-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
    };
    updateHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(updateHeaderHeight).observe(header);
    else window.addEventListener('resize', updateHeaderHeight);
  }
  const base = new URL('../../account/', document.currentScript.src);
  const pages = [
    {key:'overview',label:'Account overview',file:'index.html',icon:'fa-solid fa-house'},
    {key:'personal',label:'Personal information',file:'profile.html',icon:'fa-regular fa-user'},
    {key:'orders',label:'My orders',file:'my-orders.html',icon:'fa-solid fa-box'},
    {key:'wishlist',label:'Wishlist',file:'../customers/wishlist.html',icon:'fa-regular fa-heart'},
    {key:'admin',label:'Admin dashboard',file:'../admin/overveiw.html',icon:'fa-solid fa-gauge-high'}
  ];
  for (const page of pages) {
    const link = document.createElement('a');
    link.href = new URL(page.file, base).href;
    link.className = 'profile-nav-link';
    const icon = document.createElement('i');
    icon.className = page.icon;
    icon.setAttribute('aria-hidden','true');
    link.append(icon, document.createTextNode(page.label));
    if (sidebar.dataset.accountPage === page.key) {
      link.classList.add('is-current');
      link.setAttribute('aria-current','page');
    }
    if (page.key === 'admin') { link.id = 'admin-link'; link.hidden = true; }
    sidebar.append(link);
  }
  const logout = document.createElement('button');
  logout.className = 'profile-logout';
  logout.type = 'button';
  logout.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>Log out';
  logout.addEventListener('click', EcoAuth.logout);
  sidebar.append(logout);
  EcoAuth.ready.then(function (session) {
    if (!session.user) {
      location.replace(EcoAuth.loginUrl + '?next=' + encodeURIComponent(location.pathname + location.search));
      return;
    }
    sidebar.querySelector('#admin-link').hidden = session.user.role !== 'admin';
  }).catch(function () {});
})();
