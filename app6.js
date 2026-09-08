function exportCustomer(cid){
 let c=customerById(cid);if(!c)return;
 let events=[];
 db.orders.filter(o=>o.customer_id===cid).forEach(o=>{
   let details=itemsForOrder(o.id).map(i=>`${i.product_name} x ${i.quantity} @ ${money(i.unit_price)}`).join(", ");
   events.push({at:o.created_at,description:o.status==="cancelled"?`Cancelled order - Delivery ${o.delivery_date}`:`Order - Delivery ${o.delivery_date}`,details,debit:o.status==="cancelled"?0:Number(o.total||0),credit:0,status:o.status,reference:o.id});
 });
 db.payments.filter(p=>p.customer_id===cid).forEach(p=>{
   events.push({at:p.created_at,description:p.status==="success"?"Payment Received":p.method==="COD"?"COD Selected":"Payment Submitted",details:p.method||"",debit:0,credit:p.status==="success"?Number(p.amount||0):0,status:p.status,reference:p.reference||p.order_id||""});
 });
 events.sort((a,b)=>new Date(a.at)-new Date(b.at));
 let balance=0;
 let ledgerRows=events.map(e=>{balance=Math.max(0,balance+e.debit-e.credit);return [new Date(e.at).toLocaleDateString(),new Date(e.at).toLocaleTimeString(),e.description,e.details,e.debit||"",e.credit||"",balance,e.status,e.reference]});
 downloadExcel((c.shop_name||"Customer").replace(/[^\w]+/g,"_")+"_Statement",`<h1>${esc(s().agency_name)}</h1><h2>${esc(c.shop_name)} - ${esc(c.mobile)}</h2><p>Current Outstanding: ${money(customerBalance(cid))}</p>${xlsTable("Account Statement",["Date","Time","Description","Details","Debit","Credit","Running Balance","Status","Reference"],ledgerRows)}`)
}
function exportMyStatement(){let c=db.customers[0];if(c)exportCustomer(c.id)}

function adminSettings(){
 let logo=s().company_logo||DEFAULT_COMPANY_LOGO;
 return `<div class="card branding-settings"><h3>Company Branding</h3><p class="small muted">This branding is shown on the main page, Admin portal and Customer portal.</p><label>Company Name</label><input id="companyName" value="${esc(s().company_name||DEFAULT_COMPANY_NAME)}" placeholder="Dodla Dairy Limited"><label>Company Logo</label><input id="companyLogo" type="file" accept="image/*" onchange="previewCompanyLogo(this)"><div class="brand-preview"><img id="companyLogoPreview" src="${esc(logo)}" alt="Company logo preview"><div><b id="companyNamePreview">${esc(s().company_name||DEFAULT_COMPANY_NAME)}</b><div class="small muted">Current company branding</div></div></div><hr class="divider"><h3>Agency Settings</h3><label>Agency Heading</label><input id="agency" value="${esc(s().agency_name||"")}"><label>WhatsApp Alert Number</label><input id="wa" value="${esc(s().whatsapp||"")}"><label>UPI ID</label><input id="upi" value="${esc(s().upi_id||"")}"><label>Order / Delivery Contact</label><input id="contact" value="${esc(s().contact||"")}"><label>Credit Days</label><input id="credit" type="number" value="${s().credit_days||3}"><button class="btn primary block" style="margin-top:12px" onclick="saveSettings()">Save Branding & Settings</button></div>`
}
async function previewCompanyLogo(input){
 try{let f=input.files&&input.files[0];if(!f)return;let data=await fileToSmallDataUrl(f);let p=document.getElementById("companyLogoPreview");if(p)p.src=data}catch(e){alert("Could not preview this image.")}
}
async function saveSettings(){
 try{
  let name=document.getElementById("companyName").value.trim();
  if(!name)return alert("Enter the company name.");
  let file=document.getElementById("companyLogo").files[0];
  let logo=file?await fileToSmallDataUrl(file):null;
  await rpc("app_admin_branding",{p_token:token(),p_company_name:name,p_company_logo:logo});
  await rpc("app_admin_settings",{p_token:token(),p_agency_name:agency.value.trim(),p_whatsapp:wa.value.trim(),p_upi_id:upi.value.trim(),p_contact:contact.value.trim(),p_credit_days:Number(credit.value||3)});
  brandingLoaded=false;
  await loadPublicBranding();
  await refreshState(false);
  renderAdmin("settings");
  alert("Company branding and agency settings saved.")
 }catch(e){alert(e.message)}
}

window.addEventListener("focus",()=>refreshState(true));
render();
