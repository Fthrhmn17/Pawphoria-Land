const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
let tickets=[];
fetch('/api/tickets').then(r=>r.json()).then(data=>{tickets=data;document.querySelector('#ticket-list').innerHTML=data.map(t=>`<article class="ticket-row"><div><span class="eyebrow">${t.category_name||'TICKET'}</span><h3>${t.name}</h3><p>${t.description||''}</p><strong class="price">${fmt(t.price)}</strong><p>Kuota tersedia: ${t.quota}</p></div><div><label>Jumlah<input class="qty" type="number" min="0" max="10" value="0" data-id="${t.id}"></label></div></article>`).join('')||'Belum ada tiket aktif.'});
document.querySelector('#order-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=Object.fromEntries(new FormData(e.target));
 const items=[...document.querySelectorAll('.qty')].map(x=>({ticket_id:Number(x.dataset.id),qty:Number(x.value)})).filter(x=>x.qty>0);
 if(!items.length){alert('Pilih minimal satu tiket.');return}
 const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,items})});
 const data=await res.json();const out=document.querySelector('#order-result');
 if(!res.ok){out.innerHTML=`<p class="error">${data.error}</p>`;return}
 out.innerHTML=`<div class="order-card"><span class="eyebrow">ORDER CREATED</span><h2>Pesanan berhasil dibuat</h2><p>Kode pesanan: <b>${data.orderCode}</b></p><p>Total: <b>${fmt(data.total)}</b></p><p class="muted">Status awal: menunggu pembayaran. Simpan kode pesanan ini.</p><a class="btn primary" href="/order.html?code=${data.orderCode}">Lihat instruksi pembayaran</a></div>`;
 window.scrollTo({top:out.offsetTop,behavior:'smooth'});
});
