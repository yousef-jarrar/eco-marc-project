(function(){
  const form=document.getElementById('shopping-preferences-form');
  if(!form)return;
  const endpoint=new URL('../../backend/api/shopping-preferences.php',location.href);
  const fields=['clothing_size','shoe_size','style','budget'];
  const status=document.getElementById('preferences-status');
  let busy=false;
  function lock(value){busy=value;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=value);}
  async function request(method,data){
    const options={method};
    if(data){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
    const response=await EcoAuth.fetch(endpoint,options);const result=await response.json();
    if(!response.ok||!result.success)throw new Error(result.message||'Preferences are unavailable.');
    return result;
  }
  async function load(){
    lock(true);
    try{
      const session=await EcoAuth.ready;if(!session.user)return;
      const result=await request('GET');
      fields.forEach(name=>form.elements[name].value=result.preferences?.[name]??'');
      form.elements.consent.checked=!!result.preferences;
      status.textContent=result.preferences?'Saved with your permission. You can edit or remove these at any time.':'Nothing saved. Saving is optional and requires your permission.';
    }catch(error){status.textContent=error.message;Alerts.toast('Preferences could not load','error');}
    finally{lock(false);}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const data={consent:form.elements.consent.checked};
    fields.forEach(name=>data[name]=form.elements[name].value);
    data.budget=data.budget===''?null:Number(data.budget);
    lock(true);
    try{await request('PUT',data);status.textContent='Preferences saved. The assistant can use these when you have not specified different choices.';Alerts.toast('Shopping preferences saved');}
    catch(error){Alerts.show('Preferences were not saved',error.message,'error');}
    finally{lock(false);}
  });
  document.getElementById('delete-preferences').addEventListener('click',async()=>{
    if(busy)return;
    const answer=await Alerts.confirm('Remove shopping preferences?','The assistant will stop using these saved preferences.');if(!answer.isConfirmed)return;
    lock(true);
    try{await request('DELETE');form.reset();status.textContent='Preferences removed. Nothing is saved.';Alerts.toast('Preferences removed');}
    catch(error){Alerts.show('Could not remove preferences',error.message,'error');}
    finally{lock(false);}
  });
  document.getElementById('reload-preferences').addEventListener('click',load);
  load();
})();
