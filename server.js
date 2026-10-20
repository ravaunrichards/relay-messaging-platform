'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname, PUBLIC = path.join(ROOT, 'public'), DATA = path.join(ROOT, 'data', 'store.json');
const PORT = Number(process.env.PORT || 3000), SECRET = process.env.APP_SECRET || 'development-only-change-this-secret';
let store = { users: [], chats: [], messages: [], sessions: [] };
try { store = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch {}
function save() { fs.mkdirSync(path.dirname(DATA), {recursive:true}); fs.writeFileSync(DATA, JSON.stringify(store, null, 2)); }
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
function body(req) { return new Promise((resolve,reject)=>{let s=''; req.on('data',c=>{s+=c; if(s.length>1e6) reject(new Error('Body too large'));}); req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(new Error('Invalid JSON'));}}); req.on('error',reject);}); }
function hash(p,salt=crypto.randomBytes(16).toString('hex')) { return {salt, hash:crypto.scryptSync(p,salt,64).toString('hex')}; }
function tokenFor(id) { const payload=Buffer.from(JSON.stringify({id,exp:Date.now()+7*86400000})).toString('base64url'); const sig=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url'); return payload+'.'+sig; }
function auth(req) { const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,''); const [p,s]=t.split('.'); if(!p||!s) return null; const sig=crypto.createHmac('sha256',SECRET).update(p).digest('base64url'); if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sig))) return null; try {const x=JSON.parse(Buffer.from(p,'base64url').toString()); return x.exp>Date.now()?store.users.find(u=>u.id===x.id)||null:null;}catch{return null;} }
function publicUser(u) { return {id:u.id,username:u.username,displayName:u.displayName,bio:u.bio||'',online:!!u.online}; }
function chatForUser(c,id) { return c.members.includes(id); }
function serializeChat(c,id) { const other=c.members.filter(x=>x!==id).map(x=>store.users.find(u=>u.id===x)).filter(Boolean); const last=store.messages.filter(m=>m.chatId===c.id).at(-1); return {...c,title:c.title||(other[0]?.displayName||other[0]?.username||'Saved Messages'),other:other[0]?publicUser(other[0]):null,lastMessage:last?{text:last.text,createdAt:last.createdAt,senderId:last.senderId}:null,unread:store.messages.filter(m=>m.chatId===c.id&&m.senderId!==id&&!m.readBy.includes(id)).length}; }
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'); const p=url.pathname;
 if(req.method==='GET' && (p==='/'||p.startsWith('/assets/'))){const f=p==='/'?'index.html':p.replace('/assets/',''); const file=path.join(PUBLIC,f); if(!file.startsWith(PUBLIC)){res.writeHead(403);return res.end();} try{const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[ext]||'application/octet-stream')});return fs.createReadStream(file).pipe(res);}catch{return json(res,404,{error:'Not found'});}}
 try {
  if(req.method==='GET'&&p==='/api/health') return json(res,200,{ok:true,service:'Relay',users:store.users.length});
  if(req.method==='POST'&&p==='/api/auth/register'){const b=await body(req), username=String(b.username||'').trim().toLowerCase(), displayName=String(b.displayName||username).trim(), password=String(b.password||''); if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<8||password.length>200)return json(res,400,{error:'Use a 3–24 character username and password of at least 8 characters.'}); if(store.users.some(u=>u.username===username))return json(res,409,{error:'Username is already taken.'}); const h=hash(password), u={id:crypto.randomUUID(),username,displayName:displayName.slice(0,50)||username,bio:'',passwordHash:h.hash,salt:h.salt,online:true,createdAt:new Date().toISOString()};store.users.push(u);store.sessions.push({userId:u.id,createdAt:new Date().toISOString()});save();return json(res,201,{token:tokenFor(u.id),user:publicUser(u)});}
  if(req.method==='POST'&&p==='/api/auth/login'){const b=await body(req),username=String(b.username||'').trim().toLowerCase(),password=String(b.password||''),u=store.users.find(x=>x.username===username);if(!u||hash(password,u.salt).hash!==u.passwordHash)return json(res,401,{error:'Invalid username or password.'});u.online=true;save();return json(res,200,{token:tokenFor(u.id),user:publicUser(u)});}
  const me=auth(req); if(!me)return json(res,401,{error:'Please sign in.'});
  if(req.method==='GET'&&p==='/api/me')return json(res,200,{user:publicUser(me)});
  if(req.method==='PATCH'&&p==='/api/me'){const b=await body(req);if(typeof b.displayName==='string')me.displayName=b.displayName.trim().slice(0,50)||me.username;if(typeof b.bio==='string')me.bio=b.bio.slice(0,160);save();return json(res,200,{user:publicUser(me)});}
  if(req.method==='GET'&&p==='/api/users'){const q=String(url.searchParams.get('q')||'').toLowerCase();return json(res,200,{users:store.users.filter(u=>u.id!==me.id&&(!q||u.username.includes(q)||u.displayName.toLowerCase().includes(q))).slice(0,50).map(publicUser)});}
  if(req.method==='GET'&&p==='/api/chats')return json(res,200,{chats:store.chats.filter(c=>chatForUser(c,me.id)).map(c=>serializeChat(c,me.id)).sort((a,b)=>(b.lastMessage?.createdAt||'').localeCompare(a.lastMessage?.createdAt||''))});
  if(req.method==='POST'&&p==='/api/chats'){const b=await body(req),ids=Array.isArray(b.members)?[...new Set([me.id,...b.members.filter(x=>typeof x==='string')])]:[me.id];if(ids.length>50||ids.some(id=>!store.users.some(u=>u.id===id)))return json(res,400,{error:'Invalid members.'});if(ids.length<2&&!b.title)return json(res,400,{error:'Add someone or name a group.'});let c;if(ids.length===2&&!b.title)c=store.chats.find(x=>!x.title&&x.members.length===2&&ids.every(id=>x.members.includes(id)));if(!c){c={id:crypto.randomUUID(),title:String(b.title||'').trim().slice(0,80)||null,members:ids,createdBy:me.id,createdAt:new Date().toISOString()};store.chats.push(c);}save();return json(res,201,{chat:serializeChat(c,me.id)});}
  const chatMatch=p.match(/^\/api\/chats\/([^/]+)\/messages$/); if(chatMatch){const c=store.chats.find(x=>x.id===chatMatch[1]&&chatForUser(x,me.id));if(!c)return json(res,404,{error:'Chat not found.'});if(req.method==='GET'){const after=url.searchParams.get('after');return json(res,200,{messages:store.messages.filter(m=>m.chatId===c.id&&(!after||m.createdAt>after)).map(m=>({...m,readBy:undefined}))});}if(req.method==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text||text.length>4000)return json(res,400,{error:'Message must be 1–4000 characters.'});const m={id:crypto.randomUUID(),chatId:c.id,senderId:me.id,text,createdAt:new Date().toISOString(),readBy:[me.id]};store.messages.push(m);save();return json(res,201,{message:m});}}
  if(req.method==='POST'&&p==='/api/logout'){me.online=false;save();return json(res,200,{ok:true});}
  return json(res,404,{error:'Not found'});
 }catch(e){return json(res,400,{error:e.message||'Request failed'});}
});
server.listen(PORT,()=>console.log(`Relay messaging platform running at http://localhost:${PORT}`));
module.exports={server,hash,tokenFor};
