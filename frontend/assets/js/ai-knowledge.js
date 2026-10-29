(function(){
  const endpoint=AdminConfig.apiBase+'store-knowledge.php';
  const status=document.getElementById('knowledge-status');
  const productSelect=document.getElementById('knowledge-product');
  const storeForm=document.getElementById('store-knowledge-form');
  const productForm=document.getElementById('product-knowledge-form');
  let productVersion=0;
  async function request(url,method='GET',data=null){
    const options={method};if(data){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
    const response=await EcoAuth.fetch(url,options);const result=await response.json();
    if(!response.ok||!result.success)throw new Error(result.message||'Knowledge could not load.');return result;
  }
  function populate(form,data){Array.from(form.elements).forEach(input=>{if(!input.name)return;if(input.name==='reviewed')input.checked=!!data.reviewed;else input.value=data.content?.[input.name]??'';});}
  function lock(form,busy){form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=busy);}
  async function loadStore(){
    lock(storeForm,true);status.textContent='Loading reviewed information…';
    try{
      const data=await request(endpoint);populate(storeForm,data);productSelect.replaceChildren(new Option('Choose a product',''));
      data.products.forEach(p=>productSelect.append(new Option(p.name,p.id)));
      status.textContent='Only information marked reviewed is used in customer answers. Blank fields stay unknown.';
    }catch(error){status.textContent=error.message;Alerts.show('Knowledge unavailable',error.message,'error');}
    finally{lock(storeForm,false);}
  }
  productSelect.addEventListener('change',async()=>{
    const version=++productVersion;productForm.hidden=!productSelect.value;if(!productSelect.value)return;lock(productForm,true);
    try{const data=await request(endpoint+'?product_id='+encodeURIComponent(productSelect.value));if(version===productVersion)populate(productForm,data);}
    catch(error){Alerts.show('Product details unavailable',error.message,'error');}
    finally{if(version===productVersion)lock(productForm,false);}
  });
  [storeForm,productForm].forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();const data={};new FormData(form).forEach((value,name)=>{if(name!=='reviewed')data[name]=value;});data.reviewed=form.elements.reviewed.checked;
    const url=endpoint+(form===productForm?'?product_id='+encodeURIComponent(productSelect.value):'');lock(form,true);if(form===productForm)productSelect.disabled=true;
    try{await request(url,'PUT',data);Alerts.toast(data.reviewed?'Reviewed knowledge saved':'Draft saved; not used by the assistant');}
    catch(error){Alerts.show('Knowledge was not saved',error.message,'error');}
    finally{lock(form,false);productSelect.disabled=false;}
  }));
  document.getElementById('reload-knowledge').addEventListener('click',loadStore);
  loadStore();
})();
