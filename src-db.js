const Database=require('better-sqlite3');
const bcrypt=require('bcryptjs');
const path=require('path');
const fs=require('fs');
const dir=process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname,'data');
if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
const db=new Database(process.env.DB_PATH || path.join(dir,'pawphoria.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS event(id INTEGER PRIMARY KEY, name TEXT, venue TEXT, city TEXT, start_date TEXT, end_date TEXT, description TEXT);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS ticket_categories(id INTEGER PRIMARY KEY, name TEXT, description TEXT);
CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY, name TEXT, category_id INTEGER, price INTEGER, quota INTEGER, description TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS activities(id INTEGER PRIMARY KEY, name TEXT, price INTEGER DEFAULT 0, quota INTEGER DEFAULT 0, description TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS promo_codes(id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, discount_type TEXT, discount_value INTEGER, quota INTEGER, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, order_code TEXT UNIQUE, buyer_name TEXT, buyer_email TEXT, buyer_phone TEXT, total INTEGER, promo_code TEXT, status TEXT, payment_reference TEXT, ticket_token TEXT, created_at TEXT, verified_at TEXT);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER, ticket_id INTEGER, ticket_name TEXT, qty INTEGER, unit_price INTEGER, line_total INTEGER);
CREATE TABLE IF NOT EXISTS checkins(id INTEGER PRIMARY KEY, order_id INTEGER UNIQUE, checkin_at TEXT, admin_id INTEGER);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY, description TEXT, amount INTEGER, category TEXT, created_at TEXT, admin_id INTEGER);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY, admin_id INTEGER, action TEXT, detail TEXT, created_at TEXT);
`);
if(!db.prepare('SELECT id FROM event LIMIT 1').get()) db.prepare('INSERT INTO event(name,venue,city,start_date,end_date,description) VALUES(?,?,?,?,?,?)').run('PAWPHORIA LAND','SPIKE Air Dome, PIK 2','Tangerang, Banten','2026-12-24','2026-12-27','Pet & Family Festival');
if(!db.prepare('SELECT id FROM admins LIMIT 1').get()) db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run('admin',bcrypt.hashSync('admin',10));
if(!db.prepare('SELECT id FROM ticket_categories LIMIT 1').get()){
  const c=db.prepare('INSERT INTO ticket_categories(name,description) VALUES(?,?)');
  c.run('General Admission','Akses masuk festival'); c.run('Activity Pass','Tiket aktivitas pilihan'); c.run('Bundling','Paket gabungan'); c.run('VIP / Special Access','Akses khusus');
  const ids=db.prepare('SELECT id FROM ticket_categories').all().map(x=>x.id);
  const t=db.prepare('INSERT INTO tickets(name,category_id,price,quota,description) VALUES(?,?,?,?,?)');
  t.run('Festival Entry Day Pass',ids[0],50000,1000,'Tiket masuk festival untuk satu hari.');
  t.run('Pet Agility Challenge',ids[1],75000,200,'Akses mengikuti aktivitas Pet Agility Challenge.');
  t.run('Family Package',ids[2],150000,100,'Paket bundling keluarga.');
}
module.exports=db;
