 
const footer = document.getElementById("site-footer");
if (footer) {
  footer.innerHTML = `
    <div class="site-footer-grid">
      <div class="site-footer-brand">
        <a class="site-footer-logo" href="login.html" aria-label="LUMIÈRE">
          <img src="../../assets/lumiere-icon-light.svg" width="44" height="44" alt="">
          <span>LUMIÈRE</span>
        </a>
        <p>Find Your Style, Your Way.<br>Considered fashion and footwear for your everyday.</p>
        <span class="site-footer-signature">By Lumeirec</span>
      </div>
      <nav aria-label="Footer account links">
        <h2>Your LUMIÈRE</h2>
        <a href="index.html">My account</a>
        <a href="login.html">Sign in</a>
        <a href="register.html">Create an account</a>
      </nav>
      <div class="site-footer-help">
        <h2>A little help</h2>
        <details>
          <summary>How do I sign in?</summary>
          <p>Use your email and password, or continue with a Google account you have linked.</p>
          <a href="login.html#login-form">Go to sign in</a>
        </details>
        <details>
          <summary>Can I use Google?</summary>
          <p>Yes. Choose “Sign in with Google”. If you already use a password, sign in first and link Google from My account.</p>
          <a href="login.html#google-button">Continue with Google</a>
        </details>
      </div>
    </div>
    <div class="site-footer-bottom">
      <span>© ${new Date().getFullYear()} LUMIÈRE. All rights reserved.</span>
      <span>Fashion &amp; footwear, thoughtfully selected.</span>
      <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
    </div>
  `;
}
