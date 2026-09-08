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
 return `<div class="card"><h3>My Orders</h3><p class="small muted">Payment is attached to each order. The amount is automatically the exact unpaid order balance.</p><div class="list">${db.orders.map(o=>{let due=orderDue(o);return `<div class="item"><div class="between"><div><b>Delivery: ${o.delivery_date}</b><div class="small muted">${new Date(o.created_at).toLocaleString()}</div></div><span class="pill">${o.status}</span></div><div style="margin:8px 0">${itemsForOrder(o.id).map(i=>`${esc(i.product_name)} × ${i.quantity} @ ${money(i.unit_price)}`).join("<br>")}</div><div class="between"><div><b>Total ${money(o.total)}</b><br><span class="small">Balance: <b>${money(due)}</b></span></div>${due>0&&o.status!=="cancelled"?`<button class="btn green" onclick="payOrder('${o.id}')">Proceed to Payment</button>`:`<span class="pill">PAID</span>`}</div></div>`}).join("")||"<p>No orders yet.</p>"}</div></div>`;
}
function payOrder(oid){
 let o=db.orders.find(x=>x.id===oid),due=o?orderDue(o):0;
 if(!o||due<=0)return;
 modal.innerHTML=`<div class="modal"><div class="modalbox"><div class="between"><h3>Pay ${money(due)}</h3><button class="btn ghost" onclick="closeModal()">Close</button></div>
 <p><b>Delivery:</b> ${o.delivery_date}<br><b>Exact amount due:</b> ${money(due)}<br><b>UPI ID:</b> ${esc(s().upi_id||"")}</p>
 <div class="payapps"><button class="payapp phonepe" onclick="openUpi('${oid}','phonepe')">PhonePe</button><button class="payapp gpay" onclick="openUpi('${oid}','gpay')">Google Pay</button><button class="payapp paytm" onclick="openUpi('${oid}','paytm')">Paytm</button><button class="payapp upi" onclick="openUpi('${oid}','generic')">Any UPI App</button></div>
 <div class="notice" style="margin-top:12px">If a UPI app shows <b>failed for security reasons</b>, use the button below, open your UPI app manually, and pay the exact amount to the shown UPI ID.</div>
 <button class="btn ghost block" style="margin-top:10px" onclick="copyUpiDetails('${oid}')">Copy UPI ID & Amount</button>
 <p class="small muted">After you actually make the payment, tap the button below. Your payment will appear as Pending until Admin confirms receipt.</p>
 <button class="btn primary block" style="margin-top:10px" onclick="submitPaid('${oid}')">I COMPLETED PAYMENT</button></div></div>`;
}
function upiData(oid){
 let o=db.orders.find(x=>x.id===oid),due=o?orderDue(o):0,c=db.customers[0];
 if(!o||due<=0)return null;
 let ref=`GMA${String(o.id||"").replace(/[^A-Za-z0-9]/g,"").slice(-8)}${Date.now().toString().slice(-8)}`;
 let note=`Order ${String(o.id||"").slice(-12)} - ${String(c?.shop_name||"Shop").slice(0,45)}`.slice(0,80);
 let q=new URLSearchParams({pa:String(s().upi_id||"").trim(),pn:String(s().agency_name||"GANTALAMMA MILK AGENCY").trim(),tr:ref,tn:note,am:Number(due).toFixed(2),cu:"INR"}).toString();
 return {q,due,ref};
}
function openUpi(oid,app="generic"){
 let d=upiData(oid);if(!d)return alert("Nothing is due on this order.");
 let prefix="upi://pay?";
 if(app==="phonepe")prefix="phonepe://pay?";
 else if(app==="gpay")prefix="gpay://upi/pay?";
 else if(app==="paytm")prefix="paytmmp://pay?";
 location.href=prefix+d.q;
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
   let x=await rpc("app_customer_payment_submit",{p_token:token(),p_order_id:oid,p_reference:ref.trim()});
   closeModal();
   await refreshState(false);
   renderCustomer("payments");
   alert(`Payment of ${money(x.amount)} submitted to Admin for confirmation.`);
 }catch(e){alert(e.message)}
}
function customerPaymentHistory(c){return `<div class="card"><h3>Payment History</h3><div class="list">${db.payments.map(p=>`<div class="item between"><div><b>${money(p.amount)}</b><div class="small">${esc(p.method||"")}</div><div class="small muted">${new Date(p.created_at).toLocaleString()}</div><div class="small muted">Order: ${esc(p.order_id||"")}</div></div><span class="pill">${esc(p.status)}</span></div>`).join("")||"<p>No payment history yet.</p>"}</div></div>`}
function customerAccount(c){return `<div class="card"><h3>My Account</h3><p><b>${esc(c.shop_name)}</b></p><p>${esc(c.owner_name||"")}<br>${esc(c.mobile)}<br>${esc(c.address||"")}</p><p>Agency contact: <a href="tel:${esc(s().contact||"")}">${esc(s().contact||"")}</a></p><p>WhatsApp: ${esc(s().whatsapp||"")}</p><p>UPI: ${esc(s().upi_id||"")}</p></div>`}

function xlsTable(title,headers,rows){let head=headers.map(h=>`<th>${esc(h)}</th>`).join(""),body=rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("");return `<h2>${esc(title)}</h2><table border="1"><tr>${head}</tr>${body}</table>`}
function downloadExcel(name,html){let blob=new Blob([`<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`],{type:"application/vnd.ms-excel"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".xls";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function exportOrders(){let rows=[];db.orders.forEach(o=>{let c=customerById(o.customer_id);itemsForOrder(o.id).forEach(i=>rows.push([new Date(o.created_at).toLocaleDateString(),new Date(o.created_at).toLocaleTimeString(),c?.shop_name||"",c?.mobile||"",o.delivery_date,o.id,i.product_name,i.quantity,i.unit_price,Number(i.quantity)*Number(i.unit_price),o.total,orderDue(o),o.status]))});downloadExcel("Gantalamma_All_Orders",xlsTable("All Orders",["Order Date","Time","Shop","Mobile","Delivery Date","Order ID","Product","Quantity","Unit Price","Line Amount","Order Total","Balance","Status"],rows))}
function exportPayments(){let rows=db.payments.map(p=>{let c=customerById(p.customer_id);return [new Date(p.created_at).toLocaleDateString(),new Date(p.created_at).toLocaleTimeString(),c?.shop_name||"",c?.mobile||"",p.order_id||"",p.amount,p.method||"",p.status,p.reference||""]});downloadExcel("Gantalamma_Payments",xlsTable("Payment History",["Date","Time","Shop","Mobile","Order ID","Amount","Method","Status","Reference"],rows))}
