 
const footerRoot = new URL("../../../", document.currentScript.src);
const footerLinks = {
    home: new URL("frontend/Landing.html", footerRoot).pathname,
    shop: new URL("frontend/shop.html", footerRoot).pathname,
    orders: new URL("frontend/account/my-orders.html", footerRoot).pathname,
    wishlist: new URL("frontend/customers/wishlist.html", footerRoot).pathname,
    account: new URL("frontend/account/index.html", footerRoot).pathname,
    login: new URL("frontend/account/login.html", footerRoot).pathname,
    register: new URL("frontend/account/register.html", footerRoot).pathname,
    logo: new URL("assets/lumiere-icon-light.svg", footerRoot).pathname
};
const footer = document.getElementById("site-footer");
if (footer) {
  footer.innerHTML = `
    <div class="site-footer-grid">
      <div class="site-footer-brand">
        <a class="site-footer-logo" href="${footerLinks.home}" aria-label="LUMIÈRE home">
          <img src="${footerLinks.logo}" width="44" height="44" alt="">
          <span>LUMIÈRE</span>
        </a>
        <p>Find Your Style, Your Way.<br>Considered fashion and footwear for your everyday.</p>
        <span class="site-footer-signature">LUMIÈRE</span>
      </div>
      <nav aria-label="Footer account links">
        <h2>Your LUMIÈRE</h2>
        <a href="${footerLinks.shop}">Shop the collection</a><a href="${footerLinks.wishlist}">Wishlist</a><a href="${footerLinks.orders}">My orders</a>
        <a href="${footerLinks.account}">My account</a>
        <a href="${footerLinks.login}">Sign in</a>
        <a href="${footerLinks.register}">Create an account</a>
      </nav>
      <div class="site-footer-help">
        <h2>A little help</h2>
        <details>
          <summary>How do I sign in?</summary>
          <p>Use your email and password, or continue with a Google account you have linked.</p>
          <a href="${footerLinks.login}#login-form">Go to sign in</a>
        </details>
        <details>
          <summary>Can I use Google?</summary>
          <p>Yes. Choose “Sign in with Google”. If you already use a password, sign in first and link Google from My account.</p>
          <a href="${footerLinks.login}#google-button">Continue with Google</a>
        </details>
      </div>
    </div>
    <div class="site-footer-bottom">
      <span>© ${new Date().getFullYear()} LUMIÈRE. All rights reserved.</span>
      <span>Fashion &amp; footwear, thoughtfully selected.</span>
      <a href="#" data-footer-top>Back to top <span aria-hidden="true">↑</span></a>
    </div>
  `;
}

footer?.querySelector('[data-footer-top]')?.addEventListener('click',event=>{event.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});});
const customerChatScript = document.createElement("script");
customerChatScript.src = new URL("frontend/assets/js/customer-chat.js?v=20261101-comparison-images", footerRoot).href;
document.body.append(customerChatScript);
