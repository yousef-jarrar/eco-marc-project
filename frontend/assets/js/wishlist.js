(async function(){
  const grid=document.getElementById('wishlist-grid');const status=document.getElementById('wishlist-status');if(!grid)return;
  const C=StoreCommon;
  async function load(){
    status.textContent='Loading your saved pieces…';
    try{
      if(!await C.requireLogin())return;
      const response=await C.request('wishlist.php');const products=C.getArray(response);
      grid.innerHTML=products.map(product=>C.card(product,{wishlist:true,detailsPage:'../ProductShop.html'})).join('');
      C.attachImageFallback(grid);status.textContent=products.length?products.length+' saved pieces':'Your wishlist is empty. Explore the collection to save a favorite.';
    }catch(error){status.textContent=error.message;Alerts.show('Wishlist unavailable',error.message,'error');}
  }
  grid.addEventListener('click',async event=>{
    const button=event.target.closest('[data-remove-wishlist]');if(!button)return;
    const answer=await Alerts.confirm('Remove this piece?','You can save it again from the collection.');if(!answer.isConfirmed)return;
    button.disabled=true;
    try{await C.removeWishlist(button.dataset.removeWishlist);await load();}
    catch(error){Alerts.show('Could not remove this piece',error.message,'error');button.disabled=false;}
  });
  document.addEventListener("eco:wishlist-changed",event=>{if(event.detail.removed)load();});
  await load();
})();
