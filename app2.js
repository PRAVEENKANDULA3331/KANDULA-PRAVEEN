async function registerCustomer(){try{let x=await rpc("app_register",{p_shop:rshop.value.trim(),p_mobile:rmob.value.trim(),p_pin:rpin.value.trim(),p_owner:rowner.value.trim(),p_address:raddr.value.trim()});setSession(x.token,"customer");await refreshState(false);renderCustomer("home");startPolling()}catch(e){rErr.textContent=e.message}}
async function logout(){try{if(token())await rpc("app_logout",{p_token:token()})}catch{}clearSession();clearInterval(pollTimer);render()}

function adminTabs(active){return `<div class="tabs">${[["dashboard","Home"],["orders","Orders"],["products","Products"],["customers","Customers"],["payments","Payment History"],["reports","Excel Reports"],["settings","Settings"]].map(([k,t])=>`<button class="tab ${active===k?"active":""}" onclick="renderAdmin('${k}')">${t}</button>`).join("")}</div>`}
function renderAdmin(page){currentPage=page;let body=adminTabs(page);if(page==="dashboard")body+=adminDashboard();if(page==="orders")body+=adminOrders();if(page==="products")body+=adminProducts();if(page==="customers")body+=adminCustomers();if(page==="payments")body+=adminPaymentHistory();if(page==="reports")body+=adminReports();if(page==="settings")body+=adminSettings();body+=curdRequirement();app.innerHTML=shell(body,"admin")}

function itemsForOrder(oid){return db.items.filter(i=>i.order_id===oid)}
function paidForOrder(oid){return db.payments.filter(p=>p.order_id===oid&&p.status==="success").reduce((a,p)=>a+Number(p.amount||0),0)}
function orderDue(o){return Math.max(0,Number(o.total||0)-paidForOrder(o.id))}
function customerBalance(cid){return db.orders.filter(o=>o.customer_id===cid&&o.status!=="cancelled").reduce((a,o)=>a+orderDue(o),0)}
function customerById(id){return db.customers.find(c=>c.id===id)}
function priceFor(pid,cid){let sp=db.prices.find(x=>x.product_id===pid&&x.customer_id===cid);let p=db.products.find(x=>x.id===pid);return Number(sp?.price??p?.base_price??0)}

function adminDashboard(){
 let tom=db.orders.filter(o=>o.delivery_date===tomorrow()&&o.status!=="cancelled");
 return `<div class="grid"><div class="card"><div class="muted">Tomorrow Orders</div><div class="stat">${tom.length}</div></div><div class="card"><div class="muted">Customers</div><div class="stat">${db.customers.length}</div></div><div class="card"><div class="muted">Tomorrow Order Value</div><div class="stat">${money(tom.reduce((a,o)=>a+Number(o.total),0))}</div></div><div class="card"><div class="muted">Total Outstanding</div><div class="stat">${money(db.customers.reduce((a,c)=>a+customerBalance(c.id),0))}</div></div></div><br>${stockRequirement()}`;
}
function stockRequirement(){
 let sums={};db.orders.filter(o=>o.delivery_date===tomorrow()&&o.status!=="cancelled").forEach(o=>itemsForOrder(o.id).forEach(i=>sums[i.product_id]=(sums[i.product_id]||0)+Number(i.quantity)));
 return `<div class="card"><div class="between"><h3>Tomorrow Required Quantity</h3><span class="pill">${tomorrow()}</span></div><div class="list">${db.products.filter(p=>p.active).map(p=>`<div class="item between"><div><b>${esc(p.name)}</b><div class="small muted">${esc(p.pack||"")}</div></div><div class="stat">${sums[p.id]||0}</div></div>`).join("")}</div></div>`;
}
function curdRequirement(){
 let ids=db.products.filter(p=>/curd/i.test(p.name)).map(p=>p.id),count=0;
 db.orders.filter(o=>o.delivery_date===tomorrow()&&o.status!=="cancelled").forEach(o=>itemsForOrder(o.id).forEach(i=>{if(ids.includes(i.product_id))count+=Number(i.quantity||0)}));
 return `<div class="bottom-curd"><div class="muted"><b>TOTAL CURD PACKETS REQUIRED FOR TOMORROW</b></div><div class="big">${count} packets</div></div>`;
}

function adminOrders(){
 return `<div class="card"><div class="between"><h3>Orders</h3><button class="btn ghost" onclick="exportOrders()">Export Orders Excel</button></div><div style="overflow:auto"><table><thead><tr><th>Date/Time</th><th>Shop</th><th>Items</th><th>Total</th><th>Due</th><th>Payment</th><th>Status</th></tr></thead><tbody>${db.orders.map(o=>{let c=customerById(o.customer_id),due=orderDue(o);return `<tr><td>${new Date(o.created_at).toLocaleString()}</td><td><b>${esc(c?.shop_name||"")}</b><br>${esc(c?.mobile||"")}</td><td>${itemsForOrder(o.id).map(i=>`${esc(i.product_name)} × ${i.quantity} @ ${money(i.unit_price)}`).join("<br>")}</td><td>${money(o.total)}</td><td><b>${money(due)}</b></td><td>${due>0&&o.status!=="cancelled"?`<button class="btn green" onclick="markBillReceived('${o.id}')">Bill Received</button>`:`<span class="pill">PAID</span>`}</td><td><select onchange="setOrderStatus('${o.id}',this.value)">${["ordered","confirmed","delivered","cancelled"].map(x=>`<option ${o.status===x?"selected":""}>${x}</option>`).join("")}</select></td></tr>`}).join("")||`<tr><td colspan="7">No orders yet.</td></tr>`}</tbody></table></div></div>`;
}
async function markBillReceived(oid){let method=prompt("Payment method: cash / UPI / bank / other","cash")||"cash",reference=prompt("Optional reference number","")||"";try{await rpc("app_admin_bill_received",{p_token:token(),p_order_id:oid,p_method:method,p_reference:reference});await refreshState(false);renderAdmin("orders")}catch(e){alert(e.message)}}
async function setOrderStatus(oid,v){try{await rpc("app_admin_order_status",{p_token:token(),p_order_id:oid,p_status:v});await refreshState(false);renderAdmin("orders")}catch(e){alert(e.message)}}

function adminProducts(){
 return `<div class="card"><div class="between"><h3>Products & Prices</h3><button class="btn primary" onclick="openProductModal()">+ Add Product</button></div><p class="muted small">Edit normal price anytime. Use Customer Prices for shop-specific prices.</p><div class="list">${db.products.map(p=>`<div class="item product-line">${p.image_data?`<img class="product-img" src="${p.image_data}">`:`<div class="product-img" style="display:grid;place-items:center">No image</div>`}<div><b>${esc(p.name)}</b><div class="small muted">${esc(p.pack||"")}</div><div class="price">${money(p.base_price)}</div></div><div class="row"><button class="btn ghost" onclick="openProductModal('${p.id}')">Edit</button><button class="btn orange" onclick="openPriceModal('${p.id}')">Customer Prices</button><button class="btn red" onclick="deleteProduct('${p.id}')">Delete</button></div></div>`).join("")}</div></div>`;
}
