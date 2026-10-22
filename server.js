require('dotenv').config();
const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const {google}=require('googleapis');
const crypto=require('crypto');
const app=express();const server=http.createServer(app);const io=new Server(server,{cors:{origin:false}});
app.use(express.static('public'));app.disable('x-powered-by');
const ROOT=process.env.GOOGLE_FOLDER_ID;
const oauthConfigured=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN'].every(k=>!!process.env[k]);
let auth;
if(oauthConfigured){auth=new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET);auth.setCredentials({refresh_token:process.env.GOOGLE_REFRESH_TOKEN});}
else if(process.env.GOOGLE_API_KEY) auth=process.env.GOOGLE_API_KEY;
const drive=auth?google.drive({version:'v3',auth}):null;
const allowed=new Map();let lastScan=0;
const videoExt=/\.(mp4|m4v|webm|mov|mkv)$/i;
async function scan(){if(!drive||!ROOT)throw Error('Configure Drive credentials and folder ID in .env');
 const found=[];const visited=new Set();const queue=[{id:ROOT,category:'Movies',depth:0}];
 while(queue.length){const folder=queue.shift();if(visited.has(folder.id)||folder.depth>8)continue;visited.add(folder.id);
 let pageToken;do{const r=await drive.files.list({q:`'${folder.id.replace(/'/g,"\\'")}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,size,parents,shortcutDetails)',pageSize:1000,pageToken,supportsAllDrives:true,includeItemsFromAllDrives:true});
 for(const f of r.data.files||[]){if(f.mimeType==='application/vnd.google-apps.folder'){queue.push({id:f.id,category:folder.depth===0?f.name:folder.category,depth:folder.depth+1});}
 else if(f.mimeType==='application/vnd.google-apps.shortcut'){/* Do not follow shortcuts outside trusted folder tree */}
 else if(videoExt.test(f.name)||f.mimeType?.startsWith('video/'))found.push({id:f.id,name:f.name,category:folder.category,size:f.size||null});}
 pageToken=r.data.nextPageToken;}while(pageToken);
 }allowed.clear();found.forEach(f=>allowed.set(f.id,f));lastScan=Date.now();return found;}
app.get('/api/library',async(req,res)=>{try{res.set('Cache-Control','no-store');res.json({movies:await scan()});}catch(e){console.error('Library:',e.message);res.status(502).json({error:e.message});}});
app.get('/api/video/:id',async(req,res)=>{try{const id=req.params.id;if(!allowed.has(id)){if(Date.now()-lastScan>60000)await scan();if(!allowed.has(id))return res.status(403).json({error:'Select a movie from the library first'});}
 const range=req.headers.range;const response=await drive.files.get({fileId:id,alt:'media',supportsAllDrives:true},{responseType:'stream',headers:range?{Range:range}:{}});
 res.status(response.status);for(const k of ['content-type','content-length','content-range','accept-ranges'])if(response.headers[k])res.set(k,response.headers[k]);res.set('Cache-Control','private, no-store');response.data.on('error',e=>{console.error('Drive stream:',e.message);res.destroy(e);});req.on('close',()=>response.data.destroy());response.data.pipe(res);
 }catch(e){console.error('Video:',e.message);if(!res.headersSent)res.status(e.response?.status||502).json({error:'Unable to stream this movie. Check permissions and file codec.'});}});
const rooms=new Map();const roomCode=()=>crypto.randomBytes(5).toString('hex').toUpperCase();
const clampTime=t=>Number.isFinite(Number(t))?Math.max(0,Math.min(Number(t),86400)):0;
function publicRoom(room){return {mode:room.mode,source:room.source,playing:room.playing,time:room.playing?room.time+(Date.now()-room.updated)/1000:room.time,participants:room.users.size};}
function join(socket,code){const room=rooms.get(code);if(!room)return socket.emit('notice','Room not found');if(room.users.size>=2)return socket.emit('notice','Room full (2 people maximum)');room.users.add(socket.id);socket.join(code);socket.data.room=code;socket.emit('joined',{code,...publicRoom(room)});io.to(code).emit('room-state',publicRoom(room));}
io.on('connection',socket=>{
 socket.on('create',()=>{if(socket.data.room)return;let code;do{code=roomCode()}while(rooms.has(code));rooms.set(code,{users:new Set(),mode:'drive',source:null,playing:false,time:0,updated:Date.now()});join(socket,code);});
 socket.on('join',raw=>{if(socket.data.room)return;join(socket,String(raw||'').trim().toUpperCase());});
 socket.on('source',payload=>{const room=rooms.get(socket.data.room);if(!room||!room.users.has(socket.id))return;let mode=payload?.mode;let source=String(payload?.source||'').slice(0,2000);
 if(mode==='drive'&&!allowed.has(source))return socket.emit('notice','Select a movie from the Drive library');
 if(mode==='youtube'&&!/^[\w-]{11}$/.test(source))return socket.emit('notice','Invalid YouTube video');
 if(mode==='external'){try{const url=new URL(source);if(!['http:','https:'].includes(url.protocol))throw Error();source=url.href;}catch{return socket.emit('notice','Invalid website URL');}}
 if(!['drive','youtube','external'].includes(mode))return;Object.assign(room,{mode,source,time:0,playing:false,updated:Date.now()});io.to(socket.data.room).emit('room-state',publicRoom(room));});
 socket.on('playback',payload=>{const room=rooms.get(socket.data.room);if(!room||room.mode==='external')return;if(!['play','pause','seek'].includes(payload?.action))return;room.time=clampTime(payload.time);room.playing=payload.action==='play'?true:payload.action==='pause'?false:room.playing;room.updated=Date.now();socket.to(socket.data.room).emit('playback',{action:payload.action,time:room.time});});
 socket.on('chat',msg=>{const room=rooms.get(socket.data.room);if(!room)return;const text=String(msg||'').trim().slice(0,500);if(text)io.to(socket.data.room).emit('chat',{from:socket.id===Array.from(room.users)[0]?'User 1':'User 2',text});});
 socket.on('disconnect',()=>{const code=socket.data.room;const room=rooms.get(code);if(!room)return;room.users.delete(socket.id);if(!room.users.size)rooms.delete(code);else io.to(code).emit('room-state',publicRoom(room));});
});
server.listen(Number(process.env.PORT)||3000,()=>console.log('CinemaSync listening on port '+(process.env.PORT||3000)));
