const SB_URL="https://kabnvbwddqnckakgzwzd.supabase.co";
const SB_KEY="sb_publishable_Q6inwMqqLhE37Jgpw5ZdKQ_H4HPJ_qC";
let db={settings:{agency_name:"GANTALAMMA MILK AGENCY",whatsapp:"9573916154",upi_id:"9573916154@ybl",contact:"9908679198",credit_days:3},products:[],customers:[],prices:[],orders:[],items:[],payments:[]};
let currentPage="home", pollTimer=null, syncing=false;

const token=()=>sessionStorage.getItem("gma_token")||"";
const role=()=>sessionStorage.getItem("gma_role")||"";
function setSession(t,r){sessionStorage.setItem("gma_token",t);sessionStorage.setItem("gma_role",r)}
function clearSession(){sessionStorage.removeItem("gma_token");sessionStorage.removeItem("gma_role")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function money(n){return "₹"+Number(n||0).toFixed(2).replace(".00","")}
function today(){return new Date().toISOString().slice(0,10)}
function tomorrow(){let d=new Date();d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
function s(){return db.settings||{}}
function route(){let q=new URLSearchParams(location.search).get("view");if(q)return q;let p=location.pathname.toLowerCase();if(p.includes("/admin"))return"admin";if(p.includes("/customer"))return"customer";return"home"}

async function rpc(fn,payload){
 const r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(payload||{})});
 const txt=await r.text();
 if(!r.ok){let msg=txt;try{let j=JSON.parse(txt);msg=j.message||j.error||txt}catch{}throw new Error(msg)}
 return txt?JSON.parse(txt):null;
}

async function refreshState(repaint=true){
 if(!token()||syncing)return;
 syncing=true;
 try{
   const next=await rpc("app_state",{p_token:token()});
   db=normalize(next);
   const editingOrder=role()==="customer"&&currentPage==="order";
   if(repaint && !editingOrder && !document.querySelector(".modal")){
      if(role()==="admin") renderAdmin(currentPage);
      else if(role()==="customer") renderCustomer(currentPage);
   }
 }catch(e){if(String(e.message).includes("Unauthorized")){clearSession();render()}}
 finally{syncing=false}
}
function normalize(x){
 x=x||{}; return {
  settings:x.settings||db.settings,
  products:x.products||[],
  customers:x.customers||[],
  prices:x.prices||[],
  orders:x.orders||[],
  items:x.items||[],
  payments:x.payments||[]
 }
}
function startPolling(){clearInterval(pollTimer);if(token())pollTimer=setInterval(()=>refreshState(true),2500)}

function shell(body,kind){
 return `<div class="top"><div class="wrap between"><div><div class="brand">${esc(s().agency_name||"GANTALAMMA MILK AGENCY")}</div><div class="sub">${kind==="admin"?"ADMIN / DISTRIBUTOR":"CUSTOMER / SHOP OWNER"} • <span class="sync">Shared Supabase database</span></div></div><button class="btn ghost" onclick="logout()">Logout</button></div></div><div class="wrap">${body}</div><div class="footer">${esc(s().agency_name||"GANTALAMMA MILK AGENCY")} • ${esc(s().contact||"")}</div>`;
}

async function render(){
 let r=route();
 if(r==="admin"){if(role()==="admin"&&token()){await refreshState(false);renderAdmin("dashboard");startPolling()}else adminLogin();return}
 if(r==="customer"){if(role()==="customer"&&token()){await refreshState(false);renderCustomer("home");startPolling()}else customerLogin();return}
 document.getElementById("app").innerHTML=`<div class="top"><div class="wrap"><div class="brand">GANTALAMMA MILK AGENCY</div><div class="sub">Shared online ordering & accounts</div></div></div><div class="wrap login"><div class="card"><h3>Select Portal</h3><div class="grid"><button class="btn primary" onclick="location.href='?view=admin'">Admin Login</button><button class="btn green" onclick="location.href='?view=customer'">Customer Login / Register</button></div></div></div>`;
}

function adminLogin(){
 app.innerHTML=`<div class="top"><div class="wrap"><div class="brand">GANTALAMMA MILK AGENCY</div><div class="sub">Admin Login</div></div></div><div class="wrap login"><div class="card"><label>Mobile / User ID</label><input id="au" value="9573916154"><label>Password</label><input id="ap" type="password"><button class="btn primary block" style="margin-top:12px" onclick="doAdminLogin()">Login</button><div id="loginErr" class="error"></div><p class="small muted">Customer? <a href="?view=customer">Open customer portal</a></p></div></div>`;
}
async function doAdminLogin(){
 try{let x=await rpc("app_login",{p_role:"admin",p_user:au.value.trim(),p_password:ap.value});setSession(x.token,"admin");await refreshState(false);renderAdmin("dashboard");startPolling()}
 catch(e){loginErr.textContent=e.message}
}
function customerLogin(){
 app.innerHTML=`<div class="top"><div class="wrap"><div class="brand">GANTALAMMA MILK AGENCY</div><div class="sub">Customer Portal</div></div></div><div class="wrap login"><div class="card">
 <div class="tabs"><button class="tab active" onclick="showBox('login')">Login</button><button class="tab" onclick="showBox('register')">Register New Account</button></div>
 <div id="loginBox"><label>Mobile Number</label><input id="cm" maxlength="10" inputmode="numeric"><label>4-digit PIN</label><input id="cp" type="password" maxlength="4" inputmode="numeric"><button class="btn green block" style="margin-top:12px" onclick="customerSignIn()">Login</button><div id="cErr" class="error"></div></div>
 <div id="registerBox" class="hidden"><label>Shop Name *</label><input id="rshop"><label>Owner Name</label><input id="rowner"><label>Mobile Number *</label><input id="rmob" maxlength="10" inputmode="numeric"><label>Landmark / Address</label><input id="raddr"><label>Create 4-digit PIN *</label><input id="rpin" type="password" maxlength="4" inputmode="numeric"><button class="btn primary block" style="margin-top:12px" onclick="registerCustomer()">Create Account</button><div id="rErr" class="error"></div></div>
 </div></div>`;
}
function showBox(k){loginBox.classList.toggle("hidden",k!=="login");registerBox.classList.toggle("hidden",k!=="register")}
async function customerSignIn(){try{let x=await rpc("app_login",{p_role:"customer",p_user:cm.value.trim(),p_password:cp.value});setSession(x.token,"customer");await refreshState(false);renderCustomer("home");startPolling()}catch(e){cErr.textContent=e.message}}
