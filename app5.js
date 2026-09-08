async function placeOrder(){
 let c=db.customers[0],items=[];
 db.products.filter(p=>p.active).forEach(p=>{
   let e=document.getElementById("q_"+p.id);
   let q=e?Math.max(0,Math.floor(Number(e.value||0))):draftQty(p.id);
   orderDraft[p.id]=q;
   if(q>0)items.push({product_id:p.id,quantity:q});
 });
 if(!items.length)return alert("Select at least one product.");
 try{
   let result=await rpc("app_customer_order",{p_token:token(),p_delivery_date:tomorrow(),p_items:items});
   Object.keys(orderDraft).forEach(k=>delete orderDraft[k]);
   await refreshState(false);
   let lines=items.map(x=>{let p=db.products.find(z=>z.id===x.product_id);return `${p?.name||x.product_id} - ${x.quantity}`}).join("\n");
   let msg=`${s().agency_name}\nNEW ORDER\nShop: ${c.shop_name}\nMobile: ${c.mobile}\nDelivery: ${tomorrow()}\n${lines}\nTotal: ${money(result.total)}`;
   alert("Order placed successfully.");
   renderCustomer("orders");
   setTimeout(()=>{location.href=`https://wa.me/91${String(s().whatsapp||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`},250);
 }catch(e){alert(e.message)}
}
function customerOrders(c){
 return `<div class="card"><h3>My Orders</h3><p class="small muted">Payment is attached to each order. The amount is automatically the exact unpaid order balance.</p><div class="list">${db.orders.map(o=>{let due=orderDue(o);let pending=db.payments.find(p=>p.order_id===o.id&&p.status==="pending");return `<div class="item"><div class="between"><div><b>Delivery: ${o.delivery_date}</b><div class="small muted">${new Date(o.created_at).toLocaleString()}</div></div><span class="pill">${o.status}</span></div><div style="margin:8px 0">${itemsForOrder(o.id).map(i=>`${esc(i.product_name)} × ${i.quantity} @ ${money(i.unit_price)}`).join("<br>")}</div><div class="between"><div><b>Total ${money(o.total)}</b><br><span class="small">Balance: <b>${money(due)}</b></span>${pending?`<br><span class="small muted">Payment option: ${esc(pending.method)} • Pending</span>`:""}</div>${due>0&&o.status!=="cancelled"&&!pending?`<button class="btn green" onclick="payOrder('${o.id}')">Proceed to Payment</button>`:pending?`<span class="pill">${esc(pending.method)} PENDING</span>`:`<span class="pill">PAID</span>`}</div></div>`}).join("")||"<p>No orders yet.</p>"}</div></div>`;
}
function payOrder(oid){
 let o=db.orders.find(x=>x.id===oid),due=o?orderDue(o):0;
 if(!o||due<=0)return;
 modal.innerHTML=`<div class="modal"><div class="modalbox"><div class="between"><h3>Choose Payment</h3><button class="btn ghost" onclick="closeModal()">Close</button></div>
 <p><b>Delivery:</b> ${o.delivery_date}<br><b>Exact amount due:</b> ${money(due)}<br><b>UPI ID:</b> ${esc(s().upi_id||"")}</p>
 <div class="grid">
   <button class="btn primary" onclick="showQr('${oid}')">Pay by QR</button>
   <button class="btn orange" onclick="openUpi('${oid}')">Open UPI App</button>
   <button class="btn green" onclick="selectCOD('${oid}')">Cash on Delivery</button>
 </div>
 <button class="btn ghost block" style="margin-top:10px" onclick="copyUpiDetails('${oid}')">Copy UPI ID & Amount</button>
 <div class="notice" style="margin-top:12px">If the UPI app blocks the website link, use QR or copy the UPI ID and pay manually.</div>
 </div></div>`;
}
function upiData(oid){
 let o=db.orders.find(x=>x.id===oid),due=o?orderDue(o):0,c=db.customers[0];
 if(!o||due<=0)return null;
 let ref=`GMA${String(o.id||"").replace(/[^A-Za-z0-9]/g,"").slice(-8)}${Date.now().toString().slice(-8)}`;
 let note=`Order ${String(o.id||"").slice(-12)} - ${String(c?.shop_name||"Shop").slice(0,45)}`.slice(0,80);
 let q=new URLSearchParams({pa:String(s().upi_id||"").trim(),pn:String(s().agency_name||"GANTALAMMA MILK AGENCY").trim(),tr:ref,tn:note,am:Number(due).toFixed(2),cu:"INR"}).toString();
 return {q,due,ref,uri:"upi://pay?"+q};
}
function openUpi(oid){let d=upiData(oid);if(!d)return alert("Nothing is due on this order.");location.href=d.uri}
function showQr(oid){
 let d=upiData(oid);if(!d)return alert("Nothing is due on this order.");
 modal.innerHTML=`<div class="modal"><div class="modalbox" style="text-align:center"><div class="between"><h3>Scan UPI QR</h3><button class="btn ghost" onclick="closeModal()">Close</button></div><p>Pay exactly <b>${money(d.due)}</b></p><div id="qrbox" style="display:flex;justify-content:center;margin:16px 0"></div><p class="small">UPI ID: <b>${esc(s().upi_id||"")}</b></p><div class="notice">Scan this QR using PhonePe, Google Pay, Paytm or any UPI app. After payment, tap the button below.</div><button class="btn primary block" style="margin-top:12px" onclick="submitPaid('${oid}')">I COMPLETED QR/UPI PAYMENT</button><button class="btn ghost block" style="margin-top:8px" onclick="copyUpiDetails('${oid}')">Copy UPI ID & Amount</button></div></div>`;
 let box=document.getElementById("qrbox");
 if(typeof QRCode==="function")new QRCode(box,{text:d.uri,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
 else box.innerHTML=`<div class="error">QR could not load. Use Copy UPI ID & Amount.</div>`;
}
async function copyUpiDetails(oid){
 let o=db.orders.find(x=>x.id===oid),due=o?orderDue(o):0;
 let text=`UPI ID: ${s().upi_id||""}\nAmount: ₹${Number(due).toFixed(2)}\nAgency: ${s().agency_name||"GANTALAMMA MILK AGENCY"}`;
 try{await navigator.clipboard.writeText(text);alert("UPI ID and exact amount copied. Open your UPI app and pay manually.")}
 catch{prompt("Copy these payment details:",text)}
}
async function submitPaid(oid){
 let ref=prompt("Enter UPI transaction/reference ID if available (optional)","")||"";
 try{
   let x=await rpc("app_customer_payment_option",{p_token:token(),p_order_id:oid,p_method:"UPI",p_reference:ref.trim()});
   closeModal();await refreshState(false);renderCustomer("payments");alert(`Payment of ${money(x.amount)} submitted to Admin for confirmation.`)
 }catch(e){alert(e.message)}
}
async function selectCOD(oid){
 if(!confirm("Choose Cash on Delivery for this order? You can pay the distributor when the order is delivered."))return;
 try{
   let x=await rpc("app_customer_payment_option",{p_token:token(),p_order_id:oid,p_method:"COD",p_reference:"Pay on delivery"});
   closeModal();await refreshState(false);renderCustomer("orders");alert(`Cash on Delivery selected for ${money(x.amount)}. Admin can mark it received after collection.`)
 }catch(e){alert(e.message)}
}
function customerPaymentHistory(c){return `<div class="card"><h3>Payment History</h3><div class="list">${db.payments.map(p=>`<div class="item between"><div><b>${money(p.amount)}</b><div class="small"><b>${esc(p.method||"")}</b></div><div class="small muted">${new Date(p.created_at).toLocaleString()}</div><div class="small muted">Order: ${esc(p.order_id||"")}</div></div><span class="pill">${esc(p.status)}</span></div>`).join("")||"<p>No payment history yet.</p>"}</div></div>`}
function customerAccount(c){return `<div class="card"><h3>My Account</h3><p><b>${esc(c.shop_name)}</b></p><p>${esc(c.owner_name||"")}<br>${esc(c.mobile)}<br>${esc(c.address||"")}</p><p>Agency contact: <a href="tel:${esc(s().contact||"")}">${esc(s().contact||"")}</a></p><p>WhatsApp: ${esc(s().whatsapp||"")}</p><p>UPI: ${esc(s().upi_id||"")}</p></div>`}

function xlsTable(title,headers,rows){let head=headers.map(h=>`<th>${esc(h)}</th>`).join(""),body=rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("");return `<h2>${esc(title)}</h2><table border="1"><tr>${head}</tr>${body}</table>`}
function downloadExcel(name,html){let blob=new Blob([`<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`],{type:"application/vnd.ms-excel"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".xls";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function exportOrders(){let rows=[];db.orders.forEach(o=>{let c=customerById(o.customer_id);itemsForOrder(o.id).forEach(i=>rows.push([new Date(o.created_at).toLocaleDateString(),new Date(o.created_at).toLocaleTimeString(),c?.shop_name||"",c?.mobile||"",o.delivery_date,o.id,i.product_name,i.quantity,i.unit_price,Number(i.quantity)*Number(i.unit_price),o.total,orderDue(o),o.status]))});downloadExcel("Gantalamma_All_Orders",xlsTable("All Orders",["Order Date","Time","Shop","Mobile","Delivery Date","Order ID","Product","Quantity","Unit Price","Line Amount","Order Total","Balance","Status"],rows))}
function exportPayments(){let rows=db.payments.map(p=>{let c=customerById(p.customer_id);return [new Date(p.created_at).toLocaleDateString(),new Date(p.created_at).toLocaleTimeString(),c?.shop_name||"",c?.mobile||"",p.order_id||"",p.amount,p.method||"",p.status,p.reference||""]});downloadExcel("Gantalamma_Payments",xlsTable("Payment History",["Date","Time","Shop","Mobile","Order ID","Amount","Method","Status","Reference"],rows))}
