const rupiah=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
fetch('/api/tickets').then(r=>r.json()).then(tickets=>{
 const el=document.querySelector('#ticket-preview');
 el.innerHTML=tickets.slice(0,3).map(t=>`<article class="ticket-card"><span class="eyebrow">${t.category_name||'TICKET'}</span><h3>${t.name}</h3><p class="muted">${t.description||''}</p><div class="price">${rupiah(t.price)}</div><a class="btn primary" href="/booking.html">Pilih tiket</a></article>`).join('')||'<p>Tiket akan segera tersedia.</p>';
}).catch(()=>{document.querySelector('#ticket-preview').textContent='Tiket belum tersedia.'});
