const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const path = require('path');
const db = require('./src-db');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-session-secret-before-production',
  resave:false, saveUninitialized:false,
  cookie:{ httpOnly:true, sameSite:'lax', secure:false, maxAge: 8*60*60*1000 }
}));
app.use(express.static(path.join(__dirname,'public')));

const adminOnly = (req,res,next) => req.session.admin ? next() : res.status(401).json({error:'Silakan login sebagai admin.'});
const money = n => Math.max(0, Number(n)||0);
const code = prefix => prefix + '-' + Math.random().toString(36).slice(2,6).toUpperCase() + Date.now().toString().slice(-5);

app.get('/api/event', (req,res) => res.json(db.prepare('SELECT * FROM event LIMIT 1').get()));
app.get('/api/tickets', (req,res) => {
  const rows = db.prepare(`SELECT t.*, c.name category_name FROM tickets t LEFT JOIN ticket_categories c ON c.id=t.category_id WHERE t.active=1 ORDER BY t.id`).all();
  res.json(rows);
});
app.get('/api/activities', (req,res) => res.json(db.prepare('SELECT * FROM activities WHERE active=1 ORDER BY name').all()));

app.post('/api/orders', (req,res) => {
  const {buyer_name,buyer_email,buyer_phone,items,promo_code} = req.body || {};
  if(!buyer_name || !buyer_email || !buyer_phone || !Array.isArray(items) || !items.length) return res.status(400).json({error:'Lengkapi data pemesan dan pilihan tiket.'});
  let total=0, lines=[];
  const getTicket=db.prepare('SELECT * FROM tickets WHERE id=? AND active=1');
  const insertOrder=db.prepare(`INSERT INTO orders(order_code,buyer_name,buyer_email,buyer_phone,total,promo_code,status,created_at) VALUES(?,?,?,?,?,?,?,datetime('now'))`);
  const insertLine=db.prepare('INSERT INTO order_items(order_id,ticket_id,ticket_name,qty,unit_price,line_total) VALUES(?,?,?,?,?,?)');
  const transaction=db.transaction(()=>{
    for(const item of items){
      const t=getTicket.get(Number(item.ticket_id)), qty=Math.floor(Number(item.qty));
      if(!t || qty<1 || qty>10) throw new Error('Pilihan tiket tidak valid.');
      const sold=db.prepare(`SELECT COALESCE(SUM(oi.qty),0) n FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.ticket_id=? AND o.status IN ('PENDING','PAID')`).get(t.id).n;
      if(t.quota>0 && sold+qty>t.quota) throw new Error('Kuota tiket '+t.name+' tidak mencukupi.');
      lines.push({t,qty}); total += t.price*qty;
    }
    let discount=0, promo=null;
    if(promo_code){
      promo=db.prepare('SELECT * FROM promo_codes WHERE code=? AND active=1').get(String(promo_code).trim().toUpperCase());
      if(!promo) throw new Error('Kode promo tidak valid.');
      const used=db.prepare("SELECT COUNT(*) n FROM orders WHERE promo_code=? AND status!='CANCELLED'").get(promo.code).n;
      if(used>=promo.quota) throw new Error('Kuota kode promo sudah habis.');
      discount=promo.discount_type==='percent' ? Math.round(total*promo.discount_value/100) : Math.min(total,promo.discount_value);
    }
    const orderCode=code('PWL');
    const info=insertOrder.run(orderCode,buyer_name,buyer_email,buyer_phone,Math.max(0,total-discount),promo?promo.code:null,'PENDING');
    for(const l of lines) insertLine.run(info.lastInsertRowid,l.t.id,l.t.name,l.qty,l.t.price,l.t.price*l.qty);
    return {orderCode,total:Math.max(0,total-discount),discount};
  });
  try { res.json(transaction()); } catch(e){ res.status(400).json({error:e.message}); }
});

app.get('/api/orders/:orderCode', async (req,res) => {
  const order=db.prepare('SELECT * FROM orders WHERE order_code=?').get(req.params.orderCode);
  if(!order) return res.status(404).json({error:'Pesanan tidak ditemukan.'});
  const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
  let qr=null;
  if(order.status==='PAID') qr=await QRCode.toDataURL(order.ticket_token || order.order_code);
  res.json({order,items,qr});
});

app.post('/api/orders/:orderCode/payment-reference', (req,res) => {
  const {reference}=req.body||{};
  const o=db.prepare("SELECT * FROM orders WHERE order_code=? AND status='PENDING'").get(req.params.orderCode);
  if(!o) return res.status(404).json({error:'Pesanan tidak ditemukan atau sudah diproses.'});
  db.prepare('UPDATE orders SET payment_reference=? WHERE id=?').run(String(reference||'').slice(0,100),o.id);
  res.json({ok:true,message:'Referensi pembayaran tersimpan. Menunggu verifikasi admin.'});
});

app.post('/api/admin/login', (req,res) => {
  const {username,password}=req.body||{};
  const user=db.prepare('SELECT * FROM admins WHERE username=? AND active=1').get(username);
  if(!user || !bcrypt.compareSync(password||'',user.password_hash)) return res.status(401).json({error:'Username atau password salah.'});
  req.session.admin={id:user.id,username:user.username};
  res.json({ok:true,username:user.username});
});
app.post('/api/admin/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/admin/me',adminOnly,(req,res)=>res.json(req.session.admin));
app.get('/api/admin/summary',adminOnly,(req,res)=>{
  const orders=db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END) paid, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='PAID' THEN total ELSE 0 END) revenue FROM orders").get();
  const tickets=db.prepare('SELECT COUNT(*) n FROM tickets').get().n;
  res.json({...orders,tickets});
});
app.get('/api/admin/orders',adminOnly,(req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 300').all()));
app.post('/api/admin/orders/:id/verify',adminOnly,async(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE id=? AND status='PENDING'").get(req.params.id);
  if(!o) return res.status(404).json({error:'Pesanan tidak tersedia untuk diverifikasi.'});
  const token=code('TIX');
  db.prepare("UPDATE orders SET status='PAID',ticket_token=?,verified_at=datetime('now') WHERE id=?").run(token,o.id);
  db.prepare("INSERT INTO audit_logs(admin_id,action,detail,created_at) VALUES(?,?,?,datetime('now'))").run(req.session.admin.id,'VERIFY_PAYMENT',o.order_code);
  res.json({ok:true});
});
app.post('/api/admin/orders/:id/cancel',adminOnly,(req,res)=>{
  db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=? AND status='PENDING'").run(req.params.id);
  res.json({ok:true});
});
app.get('/api/admin/tickets',adminOnly,(req,res)=>res.json(db.prepare('SELECT t.*,c.name category_name FROM tickets t LEFT JOIN ticket_categories c ON c.id=t.category_id ORDER BY t.id DESC').all()));
app.get('/api/admin/categories',adminOnly,(req,res)=>res.json(db.prepare('SELECT * FROM ticket_categories ORDER BY id').all()));
app.post('/api/admin/categories',adminOnly,(req,res)=>{
  const {name,description=''}=req.body||{};
  if(!name) return res.status(400).json({error:'Nama kategori wajib diisi.'});
  const info=db.prepare('INSERT INTO ticket_categories(name,description) VALUES(?,?)').run(name,description);
  res.json({id:info.lastInsertRowid});
});
app.post('/api/admin/tickets',adminOnly,(req,res)=>{
  const {name,category_id,price,quota,description='',active=true}=req.body||{};
  if(!name || !category_id || Number(price)<0 || Number(quota)<0) return res.status(400).json({error:'Data tiket belum lengkap.'});
  const info=db.prepare('INSERT INTO tickets(name,category_id,price,quota,description,active) VALUES(?,?,?,?,?,?)').run(name,category_id,money(price),Math.floor(quota),description,active?1:0);
  res.json({id:info.lastInsertRowid});
});
app.put('/api/admin/tickets/:id',adminOnly,(req,res)=>{
  const {name,category_id,price,quota,description='',active=true}=req.body||{};
  db.prepare('UPDATE tickets SET name=?,category_id=?,price=?,quota=?,description=?,active=? WHERE id=?').run(name,category_id,money(price),Math.floor(quota),description,active?1:0,req.params.id);
  res.json({ok:true});
});
app.delete('/api/admin/tickets/:id',adminOnly,(req,res)=>{
  const used=db.prepare('SELECT COUNT(*) n FROM order_items WHERE ticket_id=?').get(req.params.id).n;
  if(used) return res.status(409).json({error:'Tiket sudah memiliki riwayat transaksi. Nonaktifkan, jangan hapus.'});
  db.prepare('DELETE FROM tickets WHERE id=?').run(req.params.id); res.json({ok:true});
});
app.get('/api/admin/activities',adminOnly,(req,res)=>res.json(db.prepare('SELECT * FROM activities ORDER BY id DESC').all()));
app.post('/api/admin/activities',adminOnly,(req,res)=>{
  const {name,price=0,quota=0,description=''}=req.body||{};
  if(!name) return res.status(400).json({error:'Nama aktivitas wajib diisi.'});
  const info=db.prepare('INSERT INTO activities(name,price,quota,description) VALUES(?,?,?,?)').run(name,money(price),Math.floor(quota),description);
  res.json({id:info.lastInsertRowid});
});
app.get('/api/admin/promos',adminOnly,(req,res)=>res.json(db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all()));
app.post('/api/admin/promos',adminOnly,(req,res)=>{
  const {code:promo,name,discount_type='fixed',discount_value=0,quota=1}=req.body||{};
  if(!promo || !name) return res.status(400).json({error:'Kode dan nama program wajib diisi.'});
  db.prepare('INSERT INTO promo_codes(code,name,discount_type,discount_value,quota) VALUES(?,?,?,?,?)').run(promo.toUpperCase(),name,discount_type,money(discount_value),Math.floor(quota));
  res.json({ok:true});
});
app.post('/api/admin/checkin',adminOnly,(req,res)=>{
  const {token}=req.body||{};
  const order=db.prepare("SELECT * FROM orders WHERE ticket_token=? AND status='PAID'").get(token);
  if(!order) return res.status(404).json({error:'QR tidak valid atau pembayaran belum diverifikasi.'});
  const existing=db.prepare('SELECT * FROM checkins WHERE order_id=?').get(order.id);
  if(existing) return res.status(409).json({error:'Tiket sudah pernah check-in pada '+existing.checkin_at+'.'});
  db.prepare("INSERT INTO checkins(order_id,checkin_at,admin_id) VALUES(?,datetime('now'),?)").run(order.id,req.session.admin.id);
  res.json({ok:true,buyer:order.buyer_name,order_code:order.order_code});
});
app.get('/api/admin/finance',adminOnly,(req,res)=>{
  const revenue=db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status='PAID'").get().n;
  const expenses=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM expenses').get().n;
  res.json({revenue,expenses,net:revenue-expenses,expensesList:db.prepare('SELECT * FROM expenses ORDER BY id DESC').all()});
});
app.post('/api/admin/expenses',adminOnly,(req,res)=>{
  const {description,amount,category='Operasional'}=req.body||{};
  if(!description || Number(amount)<=0) return res.status(400).json({error:'Isi keterangan dan nominal pengeluaran.'});
  db.prepare('INSERT INTO expenses(description,amount,category,created_at,admin_id) VALUES(?,?,?,datetime(\\'now\\'),?)').run(description,money(amount),category,req.session.admin.id);
  res.json({ok:true});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`PAWPHORIA LAND running on port ${PORT}`));
