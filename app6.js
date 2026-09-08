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

window.addEventListener("focus",()=>refreshState(true));
render();
