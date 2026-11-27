import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.__aq = true;
const gsap = window.gsap;
const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const V = (x,y,z)=>new THREE.Vector3(x,y,z);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = Math.min(innerWidth, innerHeight) < 700;
const LITE = window.__lite===true; if(LITE) window.gsap.ticker.lagSmoothing(0);

/* deterministic random */
let seed = 1337; const rand = ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const rr = (a,b)=>a+rand()*(b-a);

/* ============ UI: stage + text splitting ============ */
const stage = $('#stage');
function fit(){ const s=Math.min(innerWidth/1920, innerHeight/1080); stage.style.transform=`translate(${-960*s}px,${-540*s}px) scale(${s})`; }
fit(); addEventListener('resize', fit);
$$('.split').forEach(h=>{ (function walk(node){ Array.from(node.childNodes).forEach(n=>{
  if(n.nodeType===3){ const f=document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach(p=>{ if(!p) return; if(/^\s+$/.test(p)){f.appendChild(document.createTextNode(p));return;} const w=document.createElement('span'); w.className='w'; const i=document.createElement('span'); i.textContent=p; w.appendChild(i); f.appendChild(w); }); n.replaceWith(f); }
  else if(n.nodeType===1 && n.tagName!=='BR') walk(n); }); })(h); });
$$('.split-ch').forEach(h=>{ h.innerHTML=h.textContent.split('').map(c=>`<span class="w"><span class="ch">${c}</span></span>`).join(''); });
$('#introWord').innerHTML=$('#introWord').textContent.split('').map(c=>`<span>${c}</span>`).join('');
const slides=$$('.slide'), N=slides.length;

/* ============ renderer ============ */
const canvas=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
const DPR=LITE?1:Math.min(devicePixelRatio||1, isSmall?1.5:1.75);
renderer.setPixelRatio(DPR); renderer.setSize(innerWidth,innerHeight,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.6;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const ANISO=renderer.capabilities.getMaxAnisotropy();

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xcfd9e0, 0.000065);
const camera=new THREE.PerspectiveCamera(35, innerWidth/innerHeight, 0.05, 60000);
const camPos=V(90,60,120), camTgt=V(0,0,0);

const composer=new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth*DPR, innerHeight*DPR, {type:THREE.HalfFloatType, samples:LITE?0:4}));
composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), .3, .55, .88);
composer.addPass(bloom); composer.addPass(new OutputPass());
addEventListener('resize',()=>{ renderer.setSize(innerWidth,innerHeight,false); composer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });

/* ============ procedural textures ============ */
function ctex(w,h,draw,{srgb=true,rep=null,rot=0}={}){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=ANISO; t.wrapS=t.wrapT=THREE.RepeatWrapping; if(rep) t.repeat.set(rep[0],rep[1]); if(rot){t.center.set(.5,.5); t.rotation=rot;} return t; }
function planks(g,w,h,{n=16,hue=[24,32],sat=[38,52],lit=[26,36],gap='rgba(15,8,4,.95)',gapW=4,joints=true,grainA=.16}){
  const ph=h/n;
  for(let i=0;i<n;i++){ const y=i*ph; let x0=0; const segs=joints?[0,rr(.2,.5),rr(.6,.95),1]:[0,1];
    for(let s=0;s<segs.length-1;s++){ const xa=segs[s]*w, xb=segs[s+1]*w;
      const H=rr(...hue), S=rr(...sat), L=rr(...lit); const gr=g.createLinearGradient(0,y,0,y+ph); gr.addColorStop(0,`hsl(${H},${S}%,${L+2}%)`); gr.addColorStop(1,`hsl(${H},${S}%,${L-2}%)`); g.fillStyle=gr; g.fillRect(xa,y,xb-xa,ph);
      for(let k=0;k<ph*1.4;k++){ const yy=y+rr(1,ph-1); g.strokeStyle=`hsla(${H-6},${S+8}%,${L-12}%,${rr(.03,grainA)})`; g.lineWidth=rr(.5,1.6); g.beginPath(); g.moveTo(xa,yy); const f=rr(.002,.01), a=rr(.5,2.5), p=rr(0,6); for(let x=xa;x<=xb;x+=12) g.lineTo(x,yy+Math.sin(x*f+p)*a); g.stroke(); }
      if(rand()<.25){ const kx=rr(xa+30,xb-30), ky=y+ph*rr(.3,.7); const rg=g.createRadialGradient(kx,ky,0,kx,ky,ph*.35); rg.addColorStop(0,`hsla(${H-8},50%,${L-16}%,.8)`); rg.addColorStop(1,'hsla(0,0%,0%,0)'); g.fillStyle=rg; g.beginPath(); g.ellipse(kx,ky,ph*.5,ph*.25,0,0,7); g.fill(); }
      if(s>0){ g.fillStyle=gap; g.fillRect(xa-1,y,2.5,ph); } }
    g.fillStyle=gap; g.fillRect(0,y+ph-gapW,w,gapW); }
}
const T={};
T.teak=ctex(2048,2048,(g,w,h)=>planks(g,w,h,{n:16}),{rep:[3,2.2]});
T.sauna=ctex(1024,1024,(g,w,h)=>planks(g,w,h,{n:14,hue:[30,36],sat:[42,55],lit:[56,66],gap:'rgba(90,50,20,.7)',gapW:3,joints:false,grainA:.12}));
T.thermo=ctex(1024,1024,(g,w,h)=>planks(g,w,h,{n:12,hue:[20,26],sat:[40,50],lit:[30,38],gap:'rgba(20,10,5,.8)',gapW:3,joints:false}));
T.oak=ctex(1024,1024,(g,w,h)=>planks(g,w,h,{n:10,hue:[30,36],sat:[28,36],lit:[44,52],gap:'rgba(50,30,15,.6)',gapW:2}));
T.floor=ctex(1024,1024,(g,w,h)=>planks(g,w,h,{n:8,hue:[28,34],sat:[20,30],lit:[52,60],gap:'rgba(60,40,25,.5)',gapW:2}),{rep:[3,1.5]});
T.marble=ctex(1024,1024,(g,w,h)=>{ g.fillStyle='#ECE9E4'; g.fillRect(0,0,w,h); g.filter='blur(1.5px)'; for(let i=0;i<46;i++){ g.strokeStyle=`rgba(${rr(110,160)|0},${rr(110,150)|0},${rr(110,150)|0},${rr(.08,.35)})`; g.lineWidth=rr(.6,3); g.beginPath(); let x=rr(0,w), y=rr(0,h); g.moveTo(x,y); for(let k=0;k<6;k++){ x+=rr(-200,260); y+=rr(-160,200); g.quadraticCurveTo(x+rr(-80,80),y+rr(-80,80),x,y); } g.stroke(); } g.filter='none'; });
T.fabric=ctex(256,256,(g,w,h)=>{ g.fillStyle='#d6ccbb'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2){ const v=rr(-14,14)+((x+y)%4?6:-6); g.fillStyle=`rgb(${214+v},${204+v},${187+v})`; g.fillRect(x,y,2,2);} },{rep:[4,4]});
T.rug=ctex(1024,1024,(g,w,h)=>{ g.fillStyle='#bfb19a'; g.fillRect(0,0,w,h); for(let i=0;i<40000;i++){ g.fillStyle=`rgba(${rr(150,220)|0},${rr(140,205)|0},${rr(120,180)|0},.35)`; g.fillRect(rr(0,w),rr(0,h),2,2);} g.strokeStyle='#8a7a62'; g.lineWidth=14; g.strokeRect(50,50,w-100,h-100); g.lineWidth=4; g.strokeRect(84,84,w-168,h-168); });
T.solar=ctex(600,1000,(g,w,h)=>{ g.fillStyle='#d9dde3'; g.fillRect(0,0,w,h); const cw=w/6, chh=h/10; for(let i=0;i<6;i++) for(let j=0;j<10;j++){ const x=i*cw+3, y=j*chh+3, a=cw-6, b=chh-6, c=9; const gr=g.createLinearGradient(x,y,x+a,y+b); gr.addColorStop(0,'#101a2c'); gr.addColorStop(1,'#0b1322'); g.fillStyle=gr; g.beginPath(); g.moveTo(x+c,y); g.lineTo(x+a-c,y); g.lineTo(x+a,y+c); g.lineTo(x+a,y+b-c); g.lineTo(x+a-c,y+b); g.lineTo(x+c,y+b); g.lineTo(x,y+b-c); g.lineTo(x,y+c); g.closePath(); g.fill(); g.fillStyle='rgba(190,200,215,.55)'; for(let k=1;k<5;k++) g.fillRect(x+a*k/5-1,y,1.6,b); g.fillStyle='rgba(120,140,170,.12)'; for(let k=2;k<b;k+=5) g.fillRect(x,y+k,a,.6);} });
T.logo=ctex(2048,256,(g,w,h)=>{ g.clearRect(0,0,w,h); g.save(); g.translate(120,128); g.strokeStyle='#E8C88E'; g.lineWidth=9; g.beginPath(); g.moveTo(0,-74); g.bezierCurveTo(-58,-12,-52,18,-52,30); g.arc(0,30,52,Math.PI,0,true); g.bezierCurveTo(52,18,58,-12,0,-74); g.stroke(); g.beginPath(); g.arc(0,30,30,Math.PI*.55,Math.PI*.95); g.stroke(); g.restore(); g.font='600 128px "Inter", Arial, sans-serif'; g.fillStyle='#E8C88E'; g.textBaseline='middle'; g.fillText('AQUAVAPOR',230,136); });
T.leaf=ctex(128,256,(g,w,h)=>{ g.clearRect(0,0,w,h); const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#1f5a2c'); gr.addColorStop(.5,'#3f8a46'); gr.addColorStop(1,'#1f5a2c'); g.fillStyle=gr; g.beginPath(); g.moveTo(w/2,4); g.bezierCurveTo(w*1.05,h*.3,w*.85,h*.8,w/2,h-4); g.bezierCurveTo(w*.15,h*.8,-w*.05,h*.3,w/2,4); g.fill(); g.strokeStyle='rgba(190,230,170,.55)'; g.lineWidth=2.5; g.beginPath(); g.moveTo(w/2,8); g.lineTo(w/2,h-8); g.stroke(); g.lineWidth=1; for(let y=30;y<h-20;y+=18){ g.beginPath(); g.moveTo(w/2,y); g.lineTo(w*.15,y-14); g.moveTo(w/2,y); g.lineTo(w*.85,y-14); g.stroke(); } });
T.buoy=ctex(512,64,(g,w,h)=>{ for(let i=0;i<4;i++){ g.fillStyle='#F05A24'; g.fillRect(i*w/4,0,w/8,h); g.fillStyle='#F4F1EA'; g.fillRect(i*w/4+w/8,0,w/8,h);} });
function facade(base,line,kind){ return ctex(256,512,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,base[0]); gr.addColorStop(1,base[1]); g.fillStyle=gr; g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16){ g.fillStyle=line; g.fillRect(0,y,w,kind==='stone'?5:2); }
  for(let x=0;x<w;x+=kind==='stone'?16:12){ g.fillStyle=line; g.fillRect(x,0,kind==='stone'?4:1.5,h); }
  if(kind!=='stone') for(let i=0;i<120;i++){ g.fillStyle=`rgba(255,255,255,${rr(.02,.12)})`; g.fillRect((rr(0,w/12)|0)*12,(rr(0,h/16)|0)*16,12,16); } }); }
function windows(p){ return ctex(256,512,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=16){ const floorLit=rand()<.12; for(let x=0;x<w;x+=12){ if(floorLit||rand()<p){ const warm=rand()<.7; g.fillStyle=warm?`rgba(255,${rr(190,225)|0},${rr(130,170)|0},${rr(.5,1)})`:`rgba(${rr(200,235)|0},${rr(225,245)|0},255,${rr(.5,1)})`; g.fillRect(x+2,y+4,8,9);} } } }); }
T.f1=facade(['#6e8ea7','#9ab3c6'],'rgba(30,45,60,.55)','glass'); T.f2=facade(['#c9bba3','#d8cbb4'],'rgba(70,82,96,.7)','stone'); T.f3=facade(['#34475a','#4c6175'],'rgba(15,22,30,.6)','glass'); T.f4=facade(['#a9b8c4','#cfd9e1'],'rgba(60,72,86,.5)','glass');
T.w1=windows(.32); T.w2=windows(.42); T.w3=windows(.22);

/* ============ materials ============ */
const M=(o)=>new THREE.MeshStandardMaterial(o), P=(o)=>new THREE.MeshPhysicalMaterial(o);
const mats={
  hull:P({color:0x0f1922,metalness:.55,roughness:.3,clearcoat:1,clearcoatRoughness:.06,transparent:true,opacity:1}),
  gold:M({color:0xcaa465,metalness:1,roughness:.22}),
  logo:M({map:T.logo,transparent:true,metalness:.9,roughness:.25,color:0xffffff,emissive:0x6b4f22,emissiveIntensity:.25,depthWrite:false}),
  rubber:M({color:0x141619,roughness:.7}),
  teak:M({map:T.teak,bumpMap:T.teak,bumpScale:1.2,roughness:.62}),
  oak:M({map:T.oak,bumpMap:T.oak,bumpScale:.6,roughness:.55}),
  floor:M({map:T.floor,roughness:.5}),
  sauna:M({map:T.sauna,bumpMap:T.sauna,bumpScale:.8,roughness:.8}),
  thermo:M({map:T.thermo,bumpMap:T.thermo,bumpScale:.8,roughness:.75}),
  alu:M({color:0xcfd4d9,metalness:1,roughness:.28}),
  black:M({color:0x16191d,metalness:.75,roughness:.32}),
  steel:M({color:0xb9bdc2,metalness:1,roughness:.22}),
  charcoal:M({color:0x2a2c2f,metalness:.85,roughness:.35}),
  glass:P({color:0xd7e8ef,metalness:.0,roughness:.02,transparent:true,opacity:.14,envMapIntensity:2.2,side:THREE.DoubleSide,depthWrite:false}),
  tint:P({color:0x7a8f9b,metalness:.85,roughness:.04,transparent:true,opacity:.42,envMapIntensity:1.6,side:THREE.DoubleSide,depthWrite:false}),
  window:P({color:0xc9dde6,metalness:.4,roughness:.03,transparent:true,opacity:.2,envMapIntensity:1.8,side:THREE.DoubleSide,depthWrite:false}),
  mirror:M({color:0xffffff,metalness:1,roughness:.02}),
  marble:M({map:T.marble,roughness:.18}),
  fabric:P({map:T.fabric,bumpMap:T.fabric,bumpScale:.4,roughness:.95,sheen:.6,sheenColor:0xffffff,color:0xffffff}),
  cushion:P({color:0xf2efe8,roughness:.9,sheen:.5,sheenColor:0xffffff}),
  towel:P({color:0xfaf8f3,roughness:1,sheen:1,sheenColor:0xffffff}),
  towelTeal:P({color:0x2f7173,roughness:1,sheen:1,sheenColor:0x9fe0dc}),
  pGold:P({color:0xc79d63,roughness:.9,sheen:.6,sheenColor:0xffe2b0}),
  pTeal:P({color:0x2d6668,roughness:.9,sheen:.6,sheenColor:0x9fe0dc}),
  rug:M({map:T.rug,roughness:1}),
  ceramic:M({color:0xf4f2ee,roughness:.25}),
  brass:M({color:0xc89b52,metalness:1,roughness:.3}),
  stone:[M({color:0x3d3f42,roughness:.92}),M({color:0x55575a,roughness:.9}),M({color:0x2b2c2e,roughness:.95}),M({color:0x6b6a66,roughness:.9})],
  led:M({color:0x000000,emissive:0xffa75e,emissiveIntensity:3}),
  ledCool:M({color:0x000000,emissive:0xfff1dc,emissiveIntensity:2}),
  display:M({color:0x000000,emissive:0xff7a2a,emissiveIntensity:3}),
  displayBlue:M({color:0x000000,emissive:0x6fb8ff,emissiveIntensity:2.5}),
  solar:P({map:T.solar,metalness:.2,roughness:.12,clearcoat:1,clearcoatRoughness:.04}),
  canvasF:P({color:0xebe2d2,roughness:.95,sheen:.4,sheenColor:0xffffff,side:THREE.DoubleSide}),
  plunge:P({color:0x5fd4d2,roughness:.04,metalness:.05,envMapIntensity:2.4,transparent:true,opacity:.9,emissive:0x0d5e60,emissiveIntensity:.25}),
  water2:P({color:0x9fe3ec,roughness:.05,transparent:true,opacity:.55}),
  leaf:M({map:T.leaf,alphaTest:.5,side:THREE.DoubleSide,roughness:.6}),
  grass:M({color:0x6f8f4a,side:THREE.DoubleSide,roughness:.8}),
  pot:M({color:0x2b2d30,roughness:.55}),
  potLight:M({color:0xd9d3c7,roughness:.8}),
  soil:M({color:0x3a2a1c,roughness:1}),
  buoy:M({map:T.buoy,roughness:.5}),
  red:M({color:0x330000,emissive:0xff2020,emissiveIntensity:3}),
  green:M({color:0x003300,emissive:0x20ff60,emissiveIntensity:3}),
  navW:M({color:0x222222,emissive:0xffffff,emissiveIntensity:3}),
  batt:M({color:0x2b3036,metalness:.6,roughness:.4}),
  battLed:M({color:0x000000,emissive:0x3be3d2,emissiveIntensity:2}),
  tankW:P({color:0xf2f4f5,roughness:.35,transparent:true,opacity:.92}),
  tankG:M({color:0x8b9198,roughness:.4}),
  tankB:M({color:0x303338,roughness:.45}),
  waterBlue:M({color:0x2f86c9,roughness:.2,emissive:0x0b3c66,emissiveIntensity:.4}),
  cableO:M({color:0xe06a20,roughness:.5}),
  white:M({color:0xf1efe9,roughness:.45}),
  yellow:M({color:0xf2c230,roughness:.5}),
  fruitO:M({color:0xf08a24,roughness:.5}), fruitG:M({color:0x8fbf3a,roughness:.45}), fruitR:M({color:0xb3202a,roughness:.35}), lemon:M({color:0xf4dd4a,roughness:.5}),
  juice:P({color:0xffa640,roughness:.1,transparent:true,opacity:.85})
};
mats.teak.map.repeat.set(3,2.2); mats.teak.bumpMap=T.teak;

/* ============ helpers ============ */
function rb(w,h,d,r,mat,x,y,z,par,o={}){ r=Math.min(r,Math.min(w,h,d)/2-.0005); const g=r>.003?new RoundedBoxGeometry(w,h,d,o.seg||3,r):new THREE.BoxGeometry(w,h,d); const m=new THREE.Mesh(g,mat); m.position.set(x,y,z); if(o.rx)m.rotation.x=o.rx; if(o.ry)m.rotation.y=o.ry; if(o.rz)m.rotation.z=o.rz; m.castShadow=o.cs!==false; m.receiveShadow=true; par.add(m); return m; }
function cyl(rt,rbm,h,mat,x,y,z,par,o={}){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rbm,h,o.seg||24,1,!!o.open),mat); m.position.set(x,y,z); if(o.rx)m.rotation.x=o.rx; if(o.ry)m.rotation.y=o.ry; if(o.rz)m.rotation.z=o.rz; m.castShadow=o.cs!==false; m.receiveShadow=true; par.add(m); return m; }
function sph(r,mat,x,y,z,par,o={}){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,o.seg||20,o.seg?o.seg/2:14),mat); m.position.set(x,y,z); if(o.s) m.scale.set(...o.s); m.castShadow=o.cs!==false; par.add(m); return m; }
function scaleUV(geo,sx,sy){ const uv=geo.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy); uv.needsUpdate=true; return geo; }
function leafGeo(){ const g=new THREE.PlaneGeometry(.14,.46,1,6); const p=g.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i)+.23; p.setZ(i, y*y*.55); p.setY(i,p.getY(i)+.23); } g.computeVertexNormals(); return g; }
const LEAF=leafGeo();
function plant(par,x,y,z,s=1,potMat=mats.pot,n=22){ const g=new THREE.Group(); cyl(.2*s,.15*s,.42*s,potMat,0,.21*s,0,g,{seg:28}); cyl(.185*s,.185*s,.02,mats.soil,0,.41*s,0,g,{cs:false});
  for(let i=0;i<n;i++){ const l=new THREE.Mesh(LEAF,mats.leaf); const a=rand()*Math.PI*2, tilt=rr(.25,1.05), sc=s*rr(.75,1.3); l.scale.setScalar(sc); l.position.set(Math.cos(a)*.04*s,.42*s+rr(0,.25)*s,Math.sin(a)*.04*s); l.rotation.set(0,-a+Math.PI/2,0); l.rotateX(-tilt); l.castShadow=true; g.add(l); }
  g.position.set(x,y,z); par.add(g); return g; }
function grassPlanter(par,x,y,z,len,ry=0){ const g=new THREE.Group(); rb(len,.38,.32,.03,mats.potLight,0,.19,0,g); for(let i=0;i<70;i++){ const b=new THREE.Mesh(new THREE.PlaneGeometry(.018,rr(.3,.6)),mats.grass); b.position.set(rr(-len/2+.05,len/2-.05),.38+.15,rr(-.1,.1)); b.rotation.set(rr(-.4,.4),rr(0,3),rr(-.3,.3)); g.add(b);} g.position.set(x,y,z); g.rotation.y=ry; par.add(g); }

/* ============ SKY + SEA ============ */
const sky=new Sky(); sky.scale.setScalar(45000); scene.add(sky);
const su=sky.material.uniforms;
const envScene=new THREE.Scene(); const envSky=new Sky(); envSky.scale.setScalar(9000); envScene.add(envSky);
const pmrem=new THREE.PMREMGenerator(renderer); let envRT=null;
function regenEnv(){ const eu=envSky.material.uniforms; ['turbidity','rayleigh','mieCoefficient','mieDirectionalG'].forEach(k=>eu[k].value=su[k].value); eu.sunPosition.value.copy(su.sunPosition.value); const rt=pmrem.fromScene(envScene,0,1,20000); if(envRT) envRT.dispose(); envRT=rt; scene.environment=rt.texture; }

const waterNormals=new THREE.TextureLoader().load('assets/waternormals.jpg', t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; });
waterNormals.wrapS=waterNormals.wrapT=THREE.RepeatWrapping;
const water=new Water(new THREE.PlaneGeometry(60000,60000),{textureWidth:isSmall?512:1024,textureHeight:isSmall?512:1024,waterNormals,sunDirection:V(0,1,0),sunColor:0xffffff,waterColor:0x0b5560,distortionScale:2.6,fog:true});
water.rotation.x=-Math.PI/2; water.material.uniforms.size.value=3.2; scene.add(water);
const wu=water.material.uniforms;

/* stars */
{ const n=2200, pos=new Float32Array(n*3); for(let i=0;i<n;i++){ const th=rand()*Math.PI*2, ph=Math.acos(rr(.04,1)); pos[i*3]=Math.sin(ph)*Math.cos(th)*30000; pos[i*3+1]=Math.cos(ph)*30000; pos[i*3+2]=Math.sin(ph)*Math.sin(th)*30000; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var starMat=new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
  scene.add(new THREE.Points(g,starMat)); }

/* lights */
const hemi=new THREE.HemisphereLight(0xbfd8ff,0x1a3a44,.2); scene.add(hemi);
const sunL=new THREE.DirectionalLight(0xffffff,3); sunL.castShadow=true; sunL.shadow.mapSize.set(LITE||isSmall?2048:4096,LITE||isSmall?2048:4096);
Object.assign(sunL.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:1,far:200}); sunL.shadow.bias=-.0003; sunL.shadow.normalBias=.02; sunL.shadow.radius=3;
scene.add(sunL, sunL.target);

/* ============ THE COAST: Dubai Marina, JBR, Bluewaters, Downtown ============ */
const city=new THREE.Group(); scene.add(city);
const cityMats=[
  M({map:T.f1,emissiveMap:T.w1,emissive:0xffffff,emissiveIntensity:0,metalness:.55,roughness:.22}),
  M({map:T.f2,emissiveMap:T.w2,emissive:0xffffff,emissiveIntensity:0,metalness:.05,roughness:.7}),
  M({map:T.f3,emissiveMap:T.w3,emissive:0xffffff,emissiveIntensity:0,metalness:.6,roughness:.18}),
  M({map:T.f4,emissiveMap:T.w1,emissive:0xffffff,emissiveIntensity:0,metalness:.5,roughness:.25})
];
const crownMat=M({color:0xd9dee2,metalness:.7,roughness:.3});
const roofLightMat=M({color:0x000000,emissive:0xff3030,emissiveIntensity:0});
function tower(x,z,w,d,h,kind,mi){
  const mat=cityMats[mi]; let geo;
  if(kind==='cyl'){ geo=new THREE.CylinderGeometry(w/2,w/2,h,28,1); scaleUV(geo,Math.PI*w/64,h/128); }
  else if(kind==='twist'){ geo=new THREE.BoxGeometry(w,h,d,1,40,1); const p=geo.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i), a=(y/h+.5)*Math.PI/2, X=p.getX(i), Z=p.getZ(i); p.setX(i,X*Math.cos(a)-Z*Math.sin(a)); p.setZ(i,X*Math.sin(a)+Z*Math.cos(a)); } geo.computeVertexNormals(); scaleUV(geo,w/64,h/128); }
  else { geo=new THREE.BoxGeometry(w,h,d); scaleUV(geo,w/64,h/128); }
  const m=new THREE.Mesh(geo,mat); m.position.set(x,h/2,z); m.rotation.y=rr(-.3,.3); city.add(m);
  if(kind==='box' && rand()<.45){ const c=new THREE.Mesh(new THREE.BoxGeometry(w*.6,h*.06,d*.6),crownMat); c.position.set(x,h+h*.03,z); c.rotation.y=m.rotation.y; city.add(c); }
  if(h>200 && rand()<.6){ const s=new THREE.Mesh(new THREE.CylinderGeometry(.4,1.5,h*.12,8),crownMat); s.position.set(x,h+h*.06,z); city.add(s); const l=new THREE.Mesh(new THREE.SphereGeometry(2.2,8,6),roofLightMat); l.position.set(x,h+h*.12,z); city.add(l); }
}
// shoreline land
{ const land=new THREE.Mesh(new THREE.PlaneGeometry(80000,30000),M({color:0xb7a184,roughness:1})); land.rotation.x=-Math.PI/2; land.position.set(0,.6,-2200-15000); city.add(land);
  const beach=new THREE.Mesh(new THREE.PlaneGeometry(80000,70),M({color:0xe8d6b6,roughness:1})); beach.rotation.x=-Math.PI/2; beach.position.set(0,.9,-2190); city.add(beach); }
// JBR beachfront towers
for(let i=0;i<34;i++){ const x=rr(-3400,-300), z=rr(-2300,-2500); tower(x,z,rr(28,42),rr(24,36),rr(120,210),rand()<.2?'cyl':'box',(rand()*4)|0); }
// Dubai Marina skyline behind
for(let i=0;i<120;i++){ const x=rr(-4200,900), z=rr(-2600,-3600); const h=Math.pow(rand(),.8)*240+120; const r=rand(); tower(x,z,rr(26,46),rr(24,42),h, r<.08?'twist':r<.28?'cyl':'box',(rand()*4)|0); }
// a few landmark-scale Marina towers
[[-1900,-3000,52,400,'twist'],[-1300,-3200,50,420,'box'],[-2500,-3100,48,390,'cyl'],[-800,-3000,46,360,'box']].forEach(([x,z,w,h,k])=>tower(x,z,w,w,h,k,2));
// low-rise along the coast east and west
for(let i=0;i<160;i++){ const x=rand()<.5?rr(-11000,-4300):rr(900,11000), z=rr(-2250,-3200); tower(x,z,rr(30,70),rr(30,60),rr(15,90),'box',1); }
// Bluewaters island + observation wheel
const wheel=new THREE.Group(); wheel.position.set(-1100,0,-1700); wheel.rotation.y=.28; city.add(wheel);
{ const isl=new THREE.Mesh(new THREE.BoxGeometry(520,4,300),M({color:0xcab79a,roughness:1})); isl.position.set(0,2,30); wheel.add(isl);
  for(let i=0;i<18;i++){ const b=new THREE.Mesh(scaleUV(new THREE.BoxGeometry(rr(30,60),rr(18,45),rr(30,50)),.6,.3),cityMats[1]); b.position.set(rr(-220,220),b.geometry.parameters.height/2+4,rr(-60,140)); wheel.add(b);} }
const wheelMat=M({color:0xeef1f3,metalness:.6,roughness:.35,emissive:0x9fd8ff,emissiveIntensity:0});
const wheelLed=M({color:0x111111,emissive:0xb68cff,emissiveIntensity:0});
const wheelRot=new THREE.Group(); wheelRot.position.set(0,140,0); wheel.add(wheelRot);
{ [-5,5].forEach(dz=>{ const t=new THREE.Mesh(new THREE.TorusGeometry(126,2,10,220),wheelMat); t.position.z=dz; wheelRot.add(t); const l=new THREE.Mesh(new THREE.TorusGeometry(127.8,.7,6,220),wheelLed); l.position.z=dz; wheelRot.add(l); });
  for(let i=0;i<48;i++){ const a=i/48*Math.PI*2; const sp=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,126,4),wheelMat); sp.position.set(Math.cos(a)*63,Math.sin(a)*63,i%2?5:-5); sp.rotation.z=a-Math.PI/2; wheelRot.add(sp);
    const cab=new THREE.Mesh(new THREE.CapsuleGeometry(2.6,7,4,10),M({color:0xdde6ec,metalness:.4,roughness:.15,emissive:0xfff0d0,emissiveIntensity:0})); cab.position.set(Math.cos(a)*131,Math.sin(a)*131,0); cab.rotation.x=Math.PI/2; cab.userData.cab=true; wheelRot.add(cab); }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(9,9,24,24),wheelMat); hub.rotation.x=Math.PI/2; wheelRot.add(hub);
  [[-70,-28],[70,-28],[-70,28],[70,28]].forEach(([lx,lz])=>{ const a=V(lx,0,lz), b=V(0,140,lz*.3), len=a.distanceTo(b); const leg=new THREE.Mesh(new THREE.CylinderGeometry(2.2,4.5,len,12),wheelMat); leg.position.copy(a).add(b).multiplyScalar(.5); leg.lookAt(b); leg.rotateX(Math.PI/2); wheel.add(leg); }); }
// Downtown on the horizon with the world's tallest tower
const downtown=new THREE.Group(); downtown.position.set(6500,0,-17000); city.add(downtown);
{ const bm=M({color:0xc3ccd4,metalness:.8,roughness:.18,emissive:0xffe8c0,emissiveIntensity:0}); downtown.userData.mat=bm;
  for(let i=0;i<30;i++){ const tier=V(0,0,0); const y=i*24, L=Math.max(8,70*(1-i/31)), wW=Math.max(6,22*(1-i/40)); for(let k=0;k<3;k++){ const b=new THREE.Mesh(new THREE.BoxGeometry(L,24,wW),bm); b.position.set(Math.cos(k*2.094+i*.05)*L/2,y+12,Math.sin(k*2.094+i*.05)*L/2); b.rotation.y=-(k*2.094+i*.05); downtown.add(b);} }
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.6,7,140,10),bm); sp.position.y=720+70; downtown.add(sp);
  for(let i=0;i<34;i++){ const t=new THREE.Mesh(new THREE.BoxGeometry(rr(30,60),1,rr(30,60)),cityMats[(rand()*4)|0]); const h=rr(90,330); t.scale.y=h; t.position.set(rr(-1600,1600),h/2,rr(-900,900)); if(Math.hypot(t.position.x,t.position.z)>120) downtown.add(t);} }

/* yachts on the water */
function hullShape(L,H,bow=.28){ const s=new THREE.Shape(); s.moveTo(-L/2,H*.15); s.lineTo(L/2-L*bow,-H*.4); s.quadraticCurveTo(L/2,-H*.35,L/2,H*.5); s.lineTo(-L/2,H*.5); s.closePath(); return s; }
function yacht(L,x,z,ry){ const g=new THREE.Group(); const W=L*.24, H=L*.12;
  const hg=new THREE.ExtrudeGeometry(hullShape(L,H),{depth:W,bevelEnabled:true,bevelThickness:W*.08,bevelSize:H*.12,bevelSegments:4,curveSegments:12}); hg.translate(0,0,-W/2);
  const hm=new THREE.Mesh(hg,P({color:0xf5f6f6,roughness:.18,clearcoat:1})); g.add(hm);
  rb(L*.45,H*.55,W*.8,H*.12,P({color:0xf3f4f4,roughness:.2,clearcoat:1}),-L*.05,H*.8,0,g,{cs:false});
  rb(L*.42,H*.18,W*.82,H*.05,M({color:0x1a2530,metalness:.8,roughness:.1,emissive:0xffd6a0,emissiveIntensity:0}),-L*.05,H*.85,0,g,{cs:false}).userData.win=true;
  rb(L*.26,H*.45,W*.7,H*.1,P({color:0xf3f4f4,roughness:.2,clearcoat:1}),-L*.1,H*1.3,0,g,{cs:false});
  g.position.set(x,H*.1,z); g.rotation.y=ry; scene.add(g); return g; }
const yachts=[yacht(34,-420,-700,.4),yacht(26,380,-980,-.3),yacht(22,-820,-420,1.2),yacht(40,700,-1250,.1),yacht(18,160,-520,2.2)];

/* ============ THE PLATFORM ============ */
const boat=new THREE.Group(); scene.add(boat);
const hullG=new THREE.Group(), deckG=new THREE.Group(), cabinG=new THREE.Group(), roofG=new THREE.Group(), flowG=new THREE.Group();
boat.add(hullG,deckG,cabinG,roofG,flowG);
const FL=.9, CL=3.33;

/* hull */
{ const s=new THREE.Shape(); s.moveTo(-5.3,-.38); s.lineTo(5.65,-.38); s.quadraticCurveTo(6.1,-.38,6.12,.02); s.lineTo(6.12,.82); s.lineTo(-6.12,.82); s.lineTo(-6.12,.6); s.quadraticCurveTo(-6.02,-.28,-5.3,-.38);
  const g=new THREE.ExtrudeGeometry(s,{depth:4.26,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:4,curveSegments:24}); g.translate(0,0,-2.13);
  const hull=new THREE.Mesh(g,mats.hull); hull.castShadow=true; hull.receiveShadow=true; hullG.add(hull);
  [2.19,-2.19].forEach((z,i)=>{ const lg=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.575),mats.logo); lg.position.set(-1.6,.36,z+(i?-.012:.012)); if(i) lg.rotation.y=Math.PI; hullG.add(lg);
    rb(12.2,.03,.02,0,mats.gold,0,.08,z+(i?-.01:.01),hullG,{cs:false}); rb(12.3,.12,.12,.05,mats.rubber,0,.82,z,hullG); });
  rb(.06,.11,.04,0,mats.yellow,6.16,.45,1.6,hullG,{cs:false});
  // structure + systems inside (seen in the x-ray view)
  for(let x=-5;x<=5;x+=1){ rb(.05,.06,4.0,0,mats.alu,x,-.28,0,hullG,{cs:false}); rb(.05,1.0,.06,0,mats.alu,x,.25,2.02,hullG,{cs:false}); rb(.05,1.0,.06,0,mats.alu,x,.25,-2.02,hullG,{cs:false}); }
  for(let i=0;i<5;i++) for(let j=0;j<2;j++){ const x=-2.1+i*.6, z=j?.42:-.42; rb(.52,.44,.66,.025,mats.batt,x,.2,z,hullG,{cs:false}); rb(.44,.025,.01,0,mats.battLed,x,.33,z+(j?.335:-.335),hullG,{cs:false}); rb(.06,.05,.5,0,mats.cableO,x+.29,.44,z,hullG,{cs:false}); }
  rb(.72,.56,.26,.03,mats.white,1.35,.35,-.95,hullG,{cs:false}); rb(.2,.12,.01,0,mats.displayBlue,1.35,.45,-.815,hullG,{cs:false});
  const fw=rb(1.7,.62,1.0,.12,mats.tankW,-4.25,.22,-1.0,hullG,{cs:false}); rb(1.6,.36,.9,.08,mats.waterBlue,-4.25,.1,-1.0,hullG,{cs:false});
  rb(1.7,.62,1.0,.12,mats.tankG,-4.25,.22,1.0,hullG,{cs:false});
  rb(.9,.52,.62,.1,mats.tankB,3.95,.18,-1.3,hullG,{cs:false});
  cyl(.09,.09,.22,mats.black,2.7,.05,.9,hullG,{rz:Math.PI/2,cs:false}); cyl(.09,.09,.22,M({color:0x1e5fa8,roughness:.4}),2.7,.05,1.2,hullG,{rz:Math.PI/2,cs:false});
}
/* deck */
rb(12.2,.1,4.3,.03,mats.teak,0,FL-.05,0,deckG);
[[0,FL-.05,2.16,12.22,.1,.03],[0,FL-.05,-2.16,12.22,.1,.03]].forEach(([x,y,z,w,h,d])=>rb(w,h,d,0,mats.alu,x,y,z,deckG,{cs:false}));
// loungers
[[.3],[1.4]].forEach(([z])=>{ const x=4.45; rb(2.0,.1,.7,.03,mats.thermo,x,FL+.3,z,deckG); [[-.85,-.28],[-.85,.28],[.85,-.28],[.85,.28]].forEach(([dx,dz])=>rb(.06,.28,.06,.01,mats.thermo,x+dx,FL+.14,z+dz,deckG)); rb(1.45,.09,.64,.04,mats.cushion,x+.27,FL+.39,z,deckG); const b=rb(.7,.09,.64,.04,mats.cushion,x-.82,FL+.56,z,deckG); b.rotation.z=-.62; rb(.42,.05,.34,.02,mats.towelTeal,x+.55,FL+.46,z,deckG); });
cyl(.22,.22,.03,mats.thermo,4.4,FL+.5,.85,deckG); cyl(.03,.03,.48,mats.steel,4.4,FL+.25,.85,deckG); cyl(.032,.028,.13,mats.juice,4.33,FL+.58,.8,deckG,{cs:false}); cyl(.032,.028,.13,mats.juice,4.47,FL+.58,.92,deckG,{cs:false});
// cold plunge tub
{ const px=5.12, pz=-1.22, h=.82; const outer=cyl(.72,.72,h,mats.thermo,px,FL+h/2,pz,deckG,{seg:48}); outer.material=mats.thermo.clone(); outer.material.map=T.thermo.clone(); outer.material.map.repeat.set(1,6); outer.material.map.rotation=Math.PI/2; outer.material.map.needsUpdate=true;
  [.18,.62].forEach(y=>{ const t=new THREE.Mesh(new THREE.TorusGeometry(.725,.012,8,64),mats.steel); t.rotation.x=Math.PI/2; t.position.set(px,FL+y,pz); deckG.add(t); });
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.7,.035,10,64),mats.thermo); rim.rotation.x=Math.PI/2; rim.position.set(px,FL+h,pz); deckG.add(rim);
  const w=new THREE.Mesh(new THREE.CircleGeometry(.68,48),mats.plunge); w.rotation.x=-Math.PI/2; w.position.set(px,FL+h-.07,pz); deckG.add(w);
  rb(.5,.3,.7,.03,mats.thermo,px-.98,FL+.15,pz,deckG); rb(.4,.15,.7,.03,mats.thermo,px-1.35,FL+.075,pz,deckG); }
// balustrades, ladder, buoy, planters
{ const gH=.95; const panel=(w,x,z,ry)=>{ rb(w,gH,.015,0,mats.glass,x,FL+gH/2+.03,z,deckG,{ry,cs:false}); const hr=cyl(.025,.025,w,mats.steel,x,FL+gH+.05,z,deckG,{rz:Math.PI/2,cs:false}); hr.rotation.set(0,ry,Math.PI/2); };
  panel(4.2,6.05,0,Math.PI/2); panel(.9,3.5,2.13,0); panel(1.4,5.35,2.13,0); panel(3.0,4.55,-2.13,0);
  [[3.05,2.13],[4.0,2.13],[4.65,2.13],[6.05,2.13],[6.05,-2.13],[3.05,-2.13]].forEach(([x,z])=>cyl(.03,.03,gH,mats.steel,x,FL+gH/2,z,deckG,{cs:false}));
  [4.12,4.52].forEach(x=>{ cyl(.022,.022,1.9,mats.steel,x,FL-.5,2.26,deckG,{cs:false}); const hnd=new THREE.Mesh(new THREE.TorusGeometry(.18,.02,8,20,Math.PI),mats.steel); hnd.position.set(x,FL+.42,2.26-.18); hnd.rotation.y=Math.PI/2; deckG.add(hnd); });
  for(let y=-1.2;y<=.6;y+=.3) cyl(.018,.018,.4,mats.steel,4.32,FL+y,2.26,deckG,{rz:Math.PI/2,cs:false});
  const bu=new THREE.Mesh(new THREE.TorusGeometry(.3,.085,14,40),mats.buoy); bu.position.set(3.3,FL+.62,2.17); deckG.add(bu);
  grassPlanter(deckG,5.78,FL,1.25,1.1,Math.PI/2); plant(deckG,3.35,FL,1.75,1.1); }
// mast + nav lights at the bow
cyl(.025,.025,2.6,mats.black,-6.0,FL+1.3,1.9,deckG,{cs:false}); sph(.06,mats.navW,-6.0,FL+2.62,1.9,deckG,{cs:false});

/* cabin shell */
{ const x0=-5.9,x1=3.0,z1=1.95,H=CL-FL, yc=FL+H/2;
  rb(x1-x0,.02,3.9,0,mats.floor,(x0+x1)/2,FL+.01,0,cabinG,{cs:false});
  [-5.9,-3.9,-1.9,.6,1.8,3.0].forEach(x=>{ rb(.09,H,.09,.015,mats.black,x,yc,z1,cabinG); rb(.09,H,.09,.015,mats.black,x,yc,-z1,cabinG); });
  rb(.09,H,.09,.015,mats.black,x0,yc,0,cabinG);
  [[-4.9,2.0],[-2.9,2.0],[-.65,2.5],[1.2,1.2],[2.4,1.2]].forEach(([x,w])=>rb(w,H-.04,.02,0,mats.tint,x,yc,z1,cabinG,{cs:false}));
  rb(6.5,H,.08,0,mats.oak,-2.65,yc,-z1,cabinG);
  rb(1.2,H-.04,.02,0,mats.window,1.2,yc,-z1,cabinG,{cs:false}); rb(1.2,H-.04,.02,0,mats.window,2.4,yc,-z1,cabinG,{cs:false});
  rb(.02,H-.04,3.9,0,mats.tint,x0,yc,0,cabinG,{cs:false});
  rb(.02,H-.04,2.6,0,mats.window,x1,yc,-.65,cabinG,{cs:false});
  rb(.03,H-.04,1.25,0,mats.glass,x1,yc,1.3,cabinG,{cs:false}); rb(.03,.6,.03,0,mats.steel,x1+.04,FL+1.1,.8,cabinG,{cs:false});
  rb(x1-x0,.03,3.9,0,mats.oak,(x0+x1)/2,CL-.015,0,cabinG,{cs:false});
  for(let x=-5.3;x<=2.6;x+=1.1) for(const z of [-1,1]){ cyl(.05,.05,.01,mats.ledCool,x,CL-.035,z*.95,cabinG,{cs:false}); }
  rb(x1-x0-.1,.015,.03,0,mats.led,(x0+x1)/2,CL-.05,1.88,cabinG,{cs:false});
}
/* lounge */
{ rb(2.9,.012,2.0,0,mats.rug,-4.3,FL+.02,.05,cabinG,{cs:false});
  rb(3.0,.36,.95,.06,mats.fabric,-4.35,FL+.18,-1.42,cabinG);
  [-5.35,-4.35,-3.35].forEach(x=>{ rb(.97,.16,.86,.07,mats.fabric,x,FL+.44,-1.38,cabinG); rb(.94,.5,.2,.09,mats.fabric,x,FL+.78,-1.78,cabinG,{rx:-.12}); });
  rb(.95,.36,1.6,.06,mats.fabric,-5.38,FL+.18,-.15,cabinG); rb(.86,.16,1.5,.07,mats.fabric,-5.38,FL+.44,-.13,cabinG); rb(.2,.5,1.45,.09,mats.fabric,-5.76,FL+.78,-.13,cabinG,{rz:.12});
  rb(.44,.44,.14,.08,mats.pGold,-5.0,FL+.78,-1.6,cabinG,{rx:-.3,ry:.3}); rb(.42,.42,.14,.08,mats.pTeal,-3.7,FL+.76,-1.62,cabinG,{rx:-.3,ry:-.2}); rb(.4,.4,.14,.08,mats.cushion,-5.55,FL+.76,.35,cabinG,{ry:1.4,rx:-.2});
  cyl(.46,.46,.035,mats.marble,-4.2,FL+.42,.15,cabinG,{seg:48}); cyl(.05,.05,.38,mats.brass,-4.2,FL+.2,.15,cabinG); cyl(.22,.24,.02,mats.brass,-4.2,FL+.01,.15,cabinG);
  rb(.52,.02,.34,.01,mats.thermo,-4.3,FL+.45,.2,cabinG,{ry:.3});
  sph(.075,mats.ceramic,-4.42,FL+.53,.24,cabinG,{s:[1,.8,1]}); cyl(.012,.008,.09,mats.ceramic,-4.33,FL+.55,.26,cabinG,{rz:-1}); cyl(.035,.03,.06,mats.ceramic,-4.18,FL+.49,.12,cabinG); cyl(.035,.03,.06,mats.ceramic,-4.12,FL+.49,.3,cabinG);
  const bowl=new THREE.Mesh(new THREE.SphereGeometry(.14,28,12,0,Math.PI*2,Math.PI/2,Math.PI/2),mats.thermo); bowl.position.set(-3.95,FL+.58,-.05); bowl.rotation.x=Math.PI; cabinG.add(bowl);
  [[0,0,mats.fruitO],[.07,.03,mats.fruitG],[-.06,.04,mats.fruitR],[.02,-.07,mats.fruitO],[-.03,-.04,mats.lemon]].forEach(([dx,dz,m])=>sph(.045,m,-3.95+dx,FL+.5,-.05+dz,cabinG,{cs:false}));
  cyl(.055,.05,.24,mats.water2,-4.5,FL+.56,-.08,cabinG,{cs:false});
  plant(cabinG,-5.45,FL,1.45,1.5,mats.potLight,30);
  cyl(.015,.015,1.5,mats.brass,-2.25,FL+.75,-1.55,cabinG); cyl(.16,.2,.25,M({color:0xf6eedf,emissive:0xffcf8a,emissiveIntensity:1,roughness:.9}),-2.25,FL+1.55,-1.55,cabinG,{open:true});
  rb(1.0,.3,.22,.05,mats.white,-3.1,CL-.3,-1.82,cabinG); rb(.9,.02,.02,0,mats.black,-3.1,CL-.42,-1.71,cabinG,{cs:false});
}
/* shower + vanity + robes */
{ rb(2.4,CL-FL,.03,0,mats.marble,-.7,FL+(CL-FL)/2,-1.89,cabinG);
  rb(.02,2.2,1.2,0,mats.glass,-.6,FL+1.1,-1.3,cabinG,{cs:false}); rb(.7,2.2,.02,0,mats.glass,-.25,FL+1.1,-.7,cabinG,{cs:false});
  rb(1.15,.03,1.18,.01,mats.stone[2],-.02,FL+.02,-1.3,cabinG,{cs:false}); rb(.34,.02,.34,.005,mats.steel,0,CL-.12,-1.3,cabinG); cyl(.012,.012,.1,mats.steel,0,CL-.07,-1.3,cabinG);
  rb(.9,.08,.48,.02,mats.oak,-1.35,FL+.86,-1.66,cabinG); cyl(.17,.13,.11,mats.ceramic,-1.35,FL+.95,-1.62,cabinG,{seg:32}); cyl(.012,.012,.2,mats.steel,-1.35,FL+1.0,-1.84,cabinG); cyl(.01,.01,.12,mats.steel,-1.35,FL+1.1,-1.78,cabinG,{rx:Math.PI/2});
  const mir=new THREE.Mesh(new THREE.CircleGeometry(.34,48),mats.mirror); mir.position.set(-1.35,FL+1.62,-1.865); cabinG.add(mir); const mf=new THREE.Mesh(new THREE.TorusGeometry(.345,.012,8,64),mats.brass); mf.position.copy(mir.position); cabinG.add(mf);
  cyl(.02,.02,1.7,mats.thermo,-1.55,FL+.85,1.25,cabinG); cyl(.02,.02,1.7,mats.thermo,-1.55,FL+.85,1.75,cabinG); cyl(.02,.02,.6,mats.thermo,-1.55,FL+1.68,1.5,cabinG,{rx:Math.PI/2});
  rb(.5,1.05,.13,.06,mats.towel,-1.55,FL+1.15,1.35,cabinG,{ry:Math.PI/2}); rb(.5,1.05,.13,.06,mats.towel,-1.55,FL+1.15,1.66,cabinG,{ry:Math.PI/2+.1});
  for(let i=0;i<3;i++) rb(.4,.07,.3,.03,i===1?mats.towelTeal:mats.towel,-1.0,FL+.04+i*.075,1.6,cabinG,{ry:.05*i});
}
/* SAUNA */
const saunaG=new THREE.Group(); cabinG.add(saunaG);
{ const sx0=.6, sx1=3.0, sz0=-1.95, sz1=.65, H=CL-FL;
  rb(.08,H,1.6,0,mats.sauna,sx0,FL+H/2,-1.15,saunaG); rb(.04,2.0,.92,0,mats.glass,sx0,FL+1.0,.13,saunaG,{cs:false}); rb(.06,2.0,.05,0,mats.sauna,sx0,FL+1.0,.62,saunaG); rb(.05,.6,.05,.02,mats.thermo,sx0+.05,FL+1.05,.48,saunaG);
  rb(sx1-sx0,H,.08,0,mats.sauna,(sx0+sx1)/2,FL+H/2,sz1,saunaG);
  rb(sx1-sx0,.04,sz1-sz0,0,mats.sauna,(sx0+sx1)/2,CL-.25,(sz0+sz1)/2,saunaG,{cs:false});
  rb(sx1-sx0,.02,sz1-sz0,0,mats.thermo,(sx0+sx1)/2,FL+.02,(sz0+sz1)/2,saunaG,{cs:false});
  rb(sx1-sx0-.05,.02,.03,0,mats.led,(sx0+sx1)/2,CL-.28,sz1-.06,saunaG,{cs:false});
  // benches: upper and lower tiers, slatted
  const L=sx1-sx0-.08, cx=(sx0+sx1)/2;
  for(let i=0;i<7;i++) rb(L,.035,.068,.012,mats.sauna,cx,FL+1.0,.08+i*.083,saunaG);
  rb(L,.95,.03,0,mats.sauna,cx,FL+.52,.04,saunaG);
  for(let i=0;i<6;i++) rb(L,.035,.068,.012,mats.sauna,cx,FL+.5,-.48+i*.083,saunaG);
  rb(L,.48,.03,0,mats.sauna,cx,FL+.25,-.52,saunaG);
  rb(L,.012,.02,0,mats.led,cx,FL+.97,.03,saunaG,{cs:false}); rb(L,.012,.02,0,mats.led,cx,FL+.47,-.53,saunaG,{cs:false});
  [1.42,1.57,1.72].forEach(y=>rb(L,.06,.025,.01,mats.sauna,cx,FL+y,.6,saunaG));
  [1.0,2.3].forEach(x=>rb(.32,.05,.2,.02,mats.sauna,x,FL+1.06,.5,saunaG,{rx:-.5}));
  rb(.46,.06,.3,.025,mats.towel,1.6,FL+1.05,.35,saunaG); rb(.46,.06,.3,.025,mats.towel,2.15,FL+1.05,.38,saunaG,{ry:.2});
  // electric heater with stones and a wooden guard
  const hx=2.62, hz=-1.52; rb(.48,.72,.46,.03,mats.charcoal,hx,FL+.36,hz,saunaG); rb(.5,.05,.48,.01,mats.steel,hx,FL+.73,hz,saunaG);
  for(let i=0;i<55;i++){ const s=new THREE.Mesh(new THREE.DodecahedronGeometry(rr(.035,.06),0),mats.stone[i%4]); s.position.set(hx+rr(-.2,.2),FL+.78+rr(0,.12),hz+rr(-.19,.19)); s.rotation.set(rr(0,3),rr(0,3),rr(0,3)); s.scale.set(1,rr(.6,.9),rr(.8,1.1)); s.castShadow=true; saunaG.add(s); }
  for(let i=0;i<7;i++) rb(.04,.75,.025,.01,mats.sauna,hx-.3+i*.085,FL+.42,hz+.36,saunaG);
  for(let i=0;i<5;i++) rb(.025,.75,.04,.01,mats.sauna,hx-.36,FL+.42,hz+.3-i*.085,saunaG);
  rb(.14,.22,.03,.01,mats.black,sx0+.06,FL+1.25,-.75,saunaG,{ry:Math.PI/2}); rb(.09,.04,.01,0,mats.display,sx0+.078,FL+1.3,-.75,saunaG,{ry:Math.PI/2,cs:false});
  // bucket + ladle, hygrometer, hourglass
  const bx=2.35, bz=-.28; cyl(.13,.105,.2,mats.thermo,bx,FL+.62,bz,saunaG,{seg:28}); [.56,.68].forEach(y=>{ const t=new THREE.Mesh(new THREE.TorusGeometry(.121,.006,6,32),mats.steel); t.rotation.x=Math.PI/2; t.position.set(bx,FL+y,bz); saunaG.add(t); });
  const wd=new THREE.Mesh(new THREE.CircleGeometry(.115,24),mats.plunge); wd.rotation.x=-Math.PI/2; wd.position.set(bx,FL+.69,bz); saunaG.add(wd);
  cyl(.012,.012,.5,mats.thermo,bx+.02,FL+.8,bz-.12,saunaG,{rx:.9}); sph(.045,mats.thermo,bx+.02,FL+.62,bz-.02,saunaG,{s:[1,.6,1]});
  cyl(.14,.14,.03,mats.sauna,1.8,FL+1.95,.6,saunaG,{rx:Math.PI/2}); cyl(.11,.11,.005,mats.ceramic,1.8,FL+1.95,.583,saunaG,{rx:Math.PI/2,cs:false}); rb(.005,.09,.003,0,mats.black,1.8,FL+1.97,.578,saunaG,{rz:.6,cs:false});
  cyl(.04,.0,.06,mats.glass,sx0+.12,FL+1.55,-1.75,saunaG,{cs:false}); cyl(.0,.04,.06,mats.glass,sx0+.12,FL+1.49,-1.75,saunaG,{cs:false}); cyl(.05,.05,.012,mats.thermo,sx0+.12,FL+1.585,-1.75,saunaG); cyl(.05,.05,.012,mats.thermo,sx0+.12,FL+1.455,-1.75,saunaG); cyl(.035,0,.03,M({color:0xe0c486,roughness:1}),sx0+.12,FL+1.47,-1.75,saunaG,{cs:false});
}
/* steam inside the sauna, above the stones only */
const STEAM=60, stG=new THREE.BufferGeometry(), stP=new Float32Array(STEAM*3), stD=[]; for(let i=0;i<STEAM;i++) stD.push({l:rand(),dx:rr(-.15,.15),dz:rr(-.15,.15),sp:rr(.6,1.2)});
stG.setAttribute('position',new THREE.BufferAttribute(stP,3));
const puff=ctex(64,64,(g)=>{ const r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,'rgba(255,255,255,.7)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); });
const stMat=new THREE.PointsMaterial({map:puff,size:.9,transparent:true,opacity:.07,depthWrite:false}); saunaG.add(new THREE.Points(stG,stMat));
/* bar with infused water */
{ rb(1.9,.92,.5,.02,mats.oak,1.8,FL+.46,1.66,cabinG); rb(1.95,.04,.56,.01,mats.marble,1.8,FL+.94,1.65,cabinG);
  cyl(.1,.1,.34,mats.water2,1.25,FL+1.13,1.62,cabinG,{cs:false,seg:32}); cyl(.104,.104,.02,mats.steel,1.25,FL+1.31,1.62,cabinG); for(let i=0;i<4;i++) cyl(.04,.04,.008,mats.lemon,1.25+rr(-.04,.04),FL+1.02+i*.07,1.62+rr(-.04,.04),cabinG,{rx:rr(-.8,.8),cs:false}); cyl(.012,.012,.05,mats.steel,1.25,FL+1.0,1.51,cabinG,{rx:Math.PI/2});
  for(let i=0;i<4;i++) cyl(.034,.03,.1,mats.glass,1.65+i*.1,FL+1.01,1.58,cabinG,{cs:false});
  cyl(.16,.14,.015,mats.ceramic,2.35,FL+.97,1.62,cabinG,{seg:32}); [[0,0,mats.fruitO],[.06,.03,mats.fruitG],[-.05,.04,mats.fruitR],[.02,-.06,mats.lemon]].forEach(([dx,dz,m])=>sph(.04,m,2.35+dx,FL+1.01,1.62+dz,cabinG,{cs:false}));
  [1.45,2.15].forEach(x=>{ cyl(.003,.003,.55,mats.black,x,CL-.28,1.55,cabinG,{cs:false}); sph(.075,M({color:0xfff3e0,emissive:0xffc27a,emissiveIntensity:2,transparent:true,opacity:.95}),x,CL-.6,1.55,cabinG,{cs:false}); }); }

/* roof: slab, solar array (no chimney), awning */
{ rb(10.4,.18,4.7,.04,mats.black,-1.45,CL+.09,0,roofG); rb(10.3,.015,.03,0,mats.led,-1.45,CL-.005,2.33,roofG,{cs:false});
  const cols=6, rows=4, mw=1.7, md=1.02, gx=.03; const tw=cols*(mw+gx), td=rows*(md+gx);
  for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const x=-1.45-tw/2+(mw+gx)*(i+.5), z=-td/2+(md+gx)*(j+.5);
    rb(mw,.04,md,.008,mats.alu,x,CL+.22,z,roofG); const p=new THREE.Mesh(new THREE.PlaneGeometry(md-.04,mw-.04),mats.solar); p.rotation.set(-Math.PI/2,0,Math.PI/2); p.position.set(x,CL+.243,z); p.receiveShadow=true; roofG.add(p); }
  [-1.4,1.4].forEach(z=>rb(10,.04,.06,0,mats.alu,-1.45,CL+.195,z,roofG,{cs:false}));
  const aw=new THREE.PlaneGeometry(2.6,4.3,16,16); aw.rotateX(-Math.PI/2); const p=aw.attributes.position; for(let i=0;i<p.count;i++){ const u=(p.getX(i)+1.3)/2.6, v=(p.getZ(i)+2.15)/4.3; p.setY(i,-.16*u - .06*Math.sin(Math.PI*v)*Math.sin(Math.PI*u)); } aw.computeVertexNormals();
  const awm=new THREE.Mesh(aw,mats.canvasF); awm.position.set(4.35,CL+.1,0); awm.castShadow=true; awm.receiveShadow=true; roofG.add(awm);
  [[5.62,2.12],[5.62,-2.12]].forEach(([x,z])=>cyl(.025,.025,CL-FL-.05,mats.steel,x,FL+(CL-FL)/2-.04,z,deckG));
  sph(.05,mats.red,-6.6,CL+.1,-2.32,roofG,{cs:false}); sph(.05,mats.green,-6.6,CL+.1,2.32,roofG,{cs:false}); }

/* interior lights */
const lights={
  sauna:new THREE.PointLight(0xff9a50,0,0,2), lounge:new THREE.PointLight(0xffc890,0,0,2), shower:new THREE.PointLight(0xfff0e0,0,0,2), bar:new THREE.PointLight(0xffcf96,0,0,2), deck:new THREE.PointLight(0xffc890,0,0,2)
};
lights.sauna.position.set(1.8,CL-.45,-.5); saunaG.add(lights.sauna);
lights.lounge.position.set(-4.1,CL-.3,0); cabinG.add(lights.lounge);
lights.shower.position.set(-.8,CL-.3,-1.1); cabinG.add(lights.shower);
lights.bar.position.set(1.8,CL-.5,1.4); cabinG.add(lights.bar);
lights.deck.position.set(4.6,CL-.3,0); roofG.add(lights.deck);
const LBASE={sauna:5,lounge:4,shower:2,bar:1.6,deck:3};

/* energy flows */
function flow(points,color){ const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)),false,'centripetal');
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{uT:{value:0},uO:{value:0},uC:{value:new THREE.Color(color)}},
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:'varying vec2 vUv; uniform float uT,uO; uniform vec3 uC; void main(){ float d=fract(vUv.x*10.-uT*1.4); float a=smoothstep(0.,.12,d)*smoothstep(.55,.25,d); gl_FragColor=vec4(uC*(1.2+3.*a),(.25+.75*a)*uO); }'});
  const m=new THREE.Mesh(new THREE.TubeGeometry(curve,160,.035,10),mat); m.renderOrder=5; flowG.add(m); return mat; }
const flows=[ flow([[-3.2,CL+.27,.6],[1.2,CL+.27,1.6],[2.95,CL+.1,1.98],[2.98,1.4,1.98],[2.7,.6,1.5],[.4,.45,.5]],0xF6C85F),
  flow([[-.2,.45,-.42],[1.2,.5,-1.0],[2.4,.55,-1.4],[2.62,FL+.2,-1.52]],0x53E0D2),
  flow([[6.12,.45,1.6],[5.0,.42,1.35],[2.2,.42,.9],[.6,.45,.42]],0x8FB4FF) ];

/* workboat */
const work=new THREE.Group(); { const L=6, H=.9, W=2.2; const hg=new THREE.ExtrudeGeometry(hullShape(L,H,.35),{depth:W,bevelEnabled:true,bevelThickness:.1,bevelSize:.1,bevelSegments:3}); hg.translate(0,0,-W/2); const h=new THREE.Mesh(hg,P({color:0xf4f4f2,roughness:.25,clearcoat:1})); h.castShadow=true; work.add(h);
  rb(1.6,1.1,1.5,.08,mats.hull,-.6,H+.4,0,work); rb(.06,.6,1.4,0,mats.tint,.22,H+.6,0,work,{rz:-.3,cs:false}); rb(1.9,.05,1.7,.02,mats.white,-.6,H+1.0,0,work); }
work.position.set(-20,.2,14); work.rotation.y=.6; scene.add(work);

/* ============ palettes + shots ============ */
const PAL={
  day:  {elev:40,az:150,turb:2.2,ray:2.0,mie:.003,g:.8, expo:.5,sunI:3.2,sun:0xfff3e2,water:0x1fb3b6,fog:0xc9d8e2,dens:.00006,bloom:.18,glow:.25,win:0,stars:0,hemi:.15},
  gold: {elev:3.0,az:-104,turb:10,ray:3.2,mie:.005,g:.9,expo:.5,sunI:2.4,sun:0xffae66,water:0x1a4f5c,fog:0xd8a98a,dens:.00007,bloom:.22,glow:.9,win:.35,stars:0,hemi:.12},
  dusk: {elev:-1.4,az:-145,turb:9,ray:3,mie:.005,g:.83,expo:.95,sunI:.35,sun:0xff8a66,water:0x0b2232,fog:0x6f5866,dens:.00008,bloom:.7,glow:1.6,win:1.4,stars:.2,hemi:.12},
  night:{elev:-9,az:-140,turb:2,ray:.6,mie:.003,g:.8, expo:1.05,sunI:.12,sun:0x9fb6ff,water:0x02080f,fog:0x0d1626,dens:.00008,bloom:.95,glow:2.1,win:2.4,stars:1,hemi:.18}
};
const cur={...PAL.gold, sun:new THREE.Color(PAL.gold.sun), water:new THREE.Color(PAL.gold.water), fog:new THREE.Color(PAL.gold.fog), explode:0, xray:0, flow:0};
function toPal(name,dur=1.8,ease='power2.inOut'){ const p=PAL[name], tl=gsap.timeline();
  const nums={}; Object.keys(p).forEach(k=>{ if(typeof p[k]==='number' && !['sun','water','fog'].includes(k)) nums[k]=p[k]; });
  tl.to(cur,{...nums,duration:dur,ease},0); ['sun','water','fog'].forEach(k=>{ const c=new THREE.Color(p[k]); tl.to(cur[k],{r:c.r,g:c.g,b:c.b,duration:dur,ease},0); }); return tl; }

const SHOTS={
  cover:      {p:[13.5,3.6,19], t:[-8,4.4,-8],  pal:'gold', fov:35},
  opportunity:{p:[-30,22,36],  t:[-10.8,-14,-9],    pal:'day',  fov:38},
  experience: {p:[11,3.4,13],  t:[-2.5,2.4,0], pal:'gold', fov:38},
  sauna:      {p:[.82,FL+1.62,.42], t:[2.75,FL+.62,-1.75], pal:'gold', fov:64, via:[[2.0,FL+1.7,-9],[1.6,FL+1.6,-2.6]], drift:.05},
  view:       {p:[1.75,FL+1.5,.38], t:[1.3,FL+1.25,-6], pal:'dusk', fov:62, drift:.05},
  lounge:     {p:[-2.35,FL+1.45,1.35], t:[-5.0,FL+.55,-1.0], pal:'dusk', fov:62, via:[[.2,FL+1.5,.1],[-1.2,FL+1.5,1.2]], drift:.05},
  plunge:     {p:[7.9,FL+1.75,3.7], t:[4.6,FL+.6,-.9], pal:'gold', fov:52, via:[[-1,FL+1.6,4.5],[4,FL+2.2,6]], drift:.2},
  day:        {p:[0,9,46],     t:[0,6,-60],    pal:'day',  fov:38},
  platform:   {p:[13,10.5,22], t:[5,4.8,0],    pal:'day',  fov:38, explode:1},
  hull:       {p:[2.4,3.3,5.4], t:[-3.6,-.2,-.4], pal:'day',  fov:50, xray:1, flow:1, explode:7, drift:.12},
  solar:      {p:[3.2,15.5,10], t:[4.2,2.2,0], pal:'day',  fov:40, flow:1},
  safety:     {p:[-15,3.6,13], t:[0,2.4,0],    pal:'dusk', fov:38},
  market:     {p:[2,4.8,27],   t:[11,3.2,0],   pal:'day',  fov:38},
  model:      {p:[26,28,32],   t:[0,0,0],      pal:'gold', fov:38},
  financials: {p:[-36,14,30],  t:[-8,6,-14],   pal:'day',  fov:38},
  invest:     {p:[19,3.2,17],  t:[0,2,-2],     pal:'dusk', fov:38},
  roadmap:    {p:[2,1.5,30],   t:[0,6,0],      pal:'gold', fov:38},
  risks:      {p:[-11,7,16],   t:[0,1.5,0],    pal:'dusk', fov:38},
  team:       {p:[12,4.2,19],  t:[-9,3.6,0],   pal:'night',fov:38}
};
const LBL={
  platform:[['~5 kW solar roof',roofG,[-1.45,CL+.26,1.2]],['Sauna · shower · lounge',cabinG,[-1.2,FL+1.6,1.95]],['Teak deck · cold plunge',deckG,[5.12,FL+.85,-1.22]],['Aluminium 5083 catamaran · 12 × 4.2 m',hullG,[3.5,.45,2.2]]],
  hull:[['LiFePO4 battery · 100 kWh',hullG,[-.9,.45,.42]],['Inverter / charger',hullG,[1.35,.65,-.95]],['Fresh water · 1,000 L',hullG,[-4.25,.55,-1.0]],['Grey water · 1,000 L',hullG,[-4.25,.55,1.0]],['Black water · 200 L',hullG,[3.95,.45,-1.3]],['Shore power · 63 A',hullG,[6.13,.45,1.6]]],
  solar:[['24 solar modules · ~5 kW',roofG,[-3.6,CL+.26,.5]],['Above the sauna: panels, no chimney',roofG,[1.8,CL+.26,-.6]],['Cables down to the battery',deckG,[2.98,1.6,1.98]]],
  sauna:[['Electric heater · 15 kW',saunaG,[2.62,FL+.95,-1.52]],['Benches for up to 6 guests',saunaG,[1.2,FL+1.05,.3]],['Panoramic window',saunaG,[1.6,FL+1.9,-1.95]]],
  lounge:[['Air-conditioning',cabinG,[-3.1,CL-.3,-1.75]],['Healthy food & drinks',cabinG,[-4.0,FL+.6,-.05]],['Rain shower',cabinG,[0,CL-.15,-1.3]],['Robes & linen',cabinG,[-1.55,FL+1.5,1.5]]],
  plunge:[['Cold plunge',deckG,[5.12,FL+.85,-1.22]],['Shaded loungers',deckG,[4.6,FL+.5,.85]],['Boarding ladder',deckG,[4.32,FL+.2,2.26]]]
};
const lblLayer=$('#labels'); let lblEls=[]; const lblState={a:0,set:null};
function setLabels(name){ lblLayer.innerHTML=''; lblEls=(LBL[name]||[]).map(([t,o,v])=>{ const d=document.createElement('div'); d.className='lbl3d'; d.innerHTML=`<i></i><b></b><span>${t}</span>`; lblLayer.appendChild(d); return {el:d,o,v:V(...v)}; }); }

/* ============ frame loop ============ */
const clock=new THREE.Clock(), tmp=V(0,0,0), sunV=V(0,1,0), lightV=V(0,1,0); let envKey='', envT=0; const drift={a:1};
function frame(){
  const t=clock.getElapsedTime();
  // sky + sun
  sunV.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-cur.elev),THREE.MathUtils.degToRad(cur.az));
  su.sunPosition.value.copy(sunV); su.turbidity.value=cur.turb; su.rayleigh.value=cur.ray; su.mieCoefficient.value=cur.mie; su.mieDirectionalG.value=cur.g;
  const key=cur.elev.toFixed(1)+'|'+cur.turb.toFixed(1)+'|'+cur.ray.toFixed(2)+'|'+cur.az.toFixed(0);
  if(key!==envKey && t-envT>.3){ envKey=key; envT=t; regenEnv(); }
  lightV.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-Math.max(cur.elev,12)),THREE.MathUtils.degToRad(cur.az));
  sunL.position.copy(lightV).multiplyScalar(80); sunL.target.position.set(0,1,0); sunL.intensity=cur.sunI; sunL.color.copy(cur.sun);
  hemi.intensity=cur.hemi;
  wu.time.value=t*.55; wu.sunDirection.value.copy(sunV.y>0?sunV:lightV).normalize(); wu.sunColor.value.copy(cur.sun).multiplyScalar(Math.max(.15,Math.min(1,cur.sunI/2.5))); wu.waterColor.value.copy(cur.water);
  scene.fog.color.copy(cur.fog); scene.fog.density=cur.dens; renderer.toneMappingExposure=cur.expo; bloom.strength=cur.bloom; starMat.opacity=cur.stars;
  // lights and glow
  Object.keys(lights).forEach(k=>lights[k].intensity=LBASE[k]*cur.glow);
  mats.led.emissiveIntensity=1.2+cur.glow*2.2; mats.ledCool.emissiveIntensity=.6+cur.glow*1.6; mats.plunge.emissiveIntensity=.15+cur.glow*.2;
  const blink=Math.sin(t*2.4)>0?1:.25; mats.red.emissiveIntensity=mats.green.emissiveIntensity=(.8+cur.glow)*1.5; mats.navW.emissiveIntensity=.8+cur.glow*1.5;
  cityMats.forEach(m=>m.emissiveIntensity=cur.win); roofLightMat.emissiveIntensity=cur.win*3*blink; downtown.userData.mat.emissiveIntensity=cur.win*.15;
  wheelMat.emissiveIntensity=cur.win*.05; wheelLed.emissive.setHSL((t*.03)%1,.7,.6); wheelLed.emissiveIntensity=cur.win*2.2; wheelRot.rotation.z=t*.004;
  yachts.forEach((y,i)=>{ y.position.y=Math.sin(t*.6+i)*.15; y.rotation.z=Math.sin(t*.5+i)*.02; y.children.forEach(c=>{ if(c.userData.win) c.material.emissiveIntensity=cur.win*1.2; }); });
  // platform state
  const e=cur.explode; boat.position.y=Math.sin(t*.75)*.045; boat.rotation.z=Math.sin(t*.55)*.008; boat.rotation.x=Math.sin(t*.65)*.006;
  deckG.position.y=e*.9; cabinG.position.y=e*1.9; roofG.position.y=e*3.6;
  mats.hull.opacity=1-cur.xray*.86; mats.hull.depthWrite=cur.xray<.5; mats.logo.opacity=1-cur.xray*.8;
  flows.forEach(f=>{ f.uniforms.uT.value=t; f.uniforms.uO.value=cur.flow; });
  work.position.y=.2+Math.sin(t*1.1+1)*.08; work.rotation.z=Math.sin(t*.9)*.025;
  // sauna steam
  for(let i=0;i<STEAM;i++){ const s=stD[i]; s.l+=.0025*s.sp; if(s.l>1) s.l=0; stP[i*3]=2.62+s.dx*(1+s.l*3)+Math.sin(t+i)*.08*s.l; stP[i*3+1]=FL+.85+s.l*1.4; stP[i*3+2]=-1.52+s.dz-s.l*.3; } stG.attributes.position.needsUpdate=true; stMat.opacity=.07*Math.min(1,cur.glow);
  // camera
  const k=drift.a; camera.position.set(camPos.x+Math.sin(t*.13)*.9*k, camPos.y+Math.sin(t*.17)*.3*k, camPos.z+Math.cos(t*.11)*.9*k); camera.lookAt(camTgt);
  // labels
  lblEls.forEach((l,i)=>{ tmp.copy(l.v); l.o.localToWorld(tmp); tmp.project(camera); const vis=tmp.z<1&&Math.abs(tmp.x)<1.05&&Math.abs(tmp.y)<1.05; l.el.style.transform=`translate(${(tmp.x*.5+.5)*innerWidth-6}px,${(-tmp.y*.5+.5)*innerHeight-6}px)`; l.el.style.opacity=vis?Math.max(0,Math.min(1,lblState.a*1.6-i*.12)):0; });
  composer.render();
  requestAnimationFrame(frame);
}

/* ============ slide choreography ============ */
let idx=-1, busy=false, dayTL=null; const prog=$('#prog'), count=$('#count'), secname=$('#secname');
function fmt(el,v){ const d=+(el.dataset.dec||0); let s=v.toFixed(d); if(el.dataset.sep) s=Number(s).toLocaleString('en-US'); return (el.dataset.prefix||'')+s+(el.dataset.suffix||''); }
function animIn(s){ const tl=gsap.timeline(); const ch=$$('.split-ch .ch',s), words=$$('.split .w>span',s), a=$$('.a',s);
  if(ch.length) tl.fromTo(ch,{yPercent:115,rotate:6,opacity:1,y:0,filter:'blur(0px)'},{yPercent:0,rotate:0,duration:1.3,stagger:.055,ease:'expo.out'},0);
  if(words.length) tl.fromTo(words,{yPercent:115,rotate:3,opacity:1,y:0,filter:'blur(0px)'},{yPercent:0,rotate:0,duration:1.1,stagger:.04,ease:'expo.out'},.05);
  tl.fromTo(a,{y:46,opacity:0,filter:'blur(14px)'},{y:0,opacity:1,filter:'blur(0px)',duration:1,stagger:.07,ease:'power3.out',clearProps:'filter'},.25);
  $$('[data-count]',s).forEach(el=>{ const end=parseFloat(el.dataset.count), o={v:0}; tl.to(o,{v:end,duration:1.8,ease:'power3.out',onUpdate:()=>el.textContent=fmt(el,o.v)},.4); });
  const bars=$$('.meter .bar i, .rb .r, .sc .b, .stack i, .road .rail i',s); if(bars.length) tl.fromTo(bars,{scaleX:0},{scaleX:1,duration:1.4,stagger:.08,ease:'expo.out'},.6); return tl; }
function animOut(s){ return gsap.to($$('.split .w>span, .split-ch .ch',s).concat($$('.a',s)),{y:-30,opacity:0,filter:'blur(10px)',duration:.45,stagger:.006,ease:'power2.in'}); }
function dayRun(s){ const steps=$$('.tstep',s), clockEl=$('#clock'), rail=$('#dayRail'); const T0=390, T1=1095, mins={v:T0};
  dayTL=gsap.timeline({delay:.6});
  dayTL.fromTo(rail,{scaleX:0},{scaleX:1,duration:9,ease:'none'},0);
  dayTL.to(mins,{v:T1,duration:9,ease:'none',onUpdate(){ const m=Math.round(mins.v); clockEl.textContent=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }},0);
  dayTL.fromTo(cur,{elev:6,az:95},{elev:62,az:170,duration:3.6,ease:'sine.out'},0).to(cur,{elev:14,az:-100,duration:3,ease:'sine.in'},3.6).add(toPal('gold',1.8),5.4).add(toPal('dusk',1.8),7.2).to(cur,{elev:-1.2,az:-112,duration:2.4,ease:'sine.inOut'},6.6);
  [0,.3,1.2,6.1,7.8].forEach((at,i)=>dayTL.add(()=>{ steps.forEach(x=>x.classList.remove('on')); steps[i].classList.add('on'); },at+.2));
  dayTL.fromTo(work.position,{x:-60,z:30},{x:-11,z:7,duration:3.2,ease:'sine.inOut'},.4).to(work.position,{x:-50,z:34,duration:3.2,ease:'sine.inOut'},4.6); }
function fly(sh,back,dur){ const from=camPos.clone(), to=V(...sh.p), fromT=camTgt.clone(), toT=V(...sh.t);
  let via=sh.via; if(back){ const leaving=SHOTS[slides[back].dataset.shot]; via=leaving.via?[...leaving.via].reverse():null; }
  const pts=[from,...(via||[]).map(v=>V(...v)),to]; const curve=pts.length>2?new THREE.CatmullRomCurve3(pts,false,'centripetal'):null;
  const o={k:0}; return gsap.to(o,{k:1,duration:dur,ease:'power2.inOut',onUpdate(){ if(curve) camPos.copy(curve.getPoint(o.k)); else camPos.lerpVectors(from,to,o.k); const kt=curve?Math.pow(o.k,.6):o.k; camTgt.lerpVectors(fromT,toT,kt); }}); }
function go(n,instant){ n=Math.max(0,Math.min(N-1,n)); if(n===idx||busy) return; busy=true; const prev=idx; idx=n;
  const s=slides[n], name=s.dataset.shot, sh=SHOTS[name]; if(dayTL){ dayTL.kill(); dayTL=null; }
  const out=prev>=0?animOut(slides[prev]):null; const goingBack=prev>n && prev>=0; const dur=instant?.01:(sh.via||goingBack&&SHOTS[slides[prev].dataset.shot].via?3.0:2.3);
  if(!instant&&prev>=0){ canvas.classList.add('whoosh'); setTimeout(()=>canvas.classList.remove('whoosh'),500); }
  lblState.a=0; gsap.killTweensOf(lblState); setLabels(name);
  fly(sh,goingBack?prev:0,dur);
  gsap.to(camera,{fov:sh.fov||38,duration:dur,ease:'power2.inOut',onUpdate:()=>camera.updateProjectionMatrix()});
  gsap.to(drift,{a:sh.drift??1,duration:dur});
  toPal(sh.pal,dur); gsap.to(cur,{explode:sh.explode||0,xray:sh.xray||0,flow:sh.flow||0,duration:dur*.9,ease:'power3.inOut'});
  if(LBL[name]) gsap.to(lblState,{a:1,duration:1,delay:dur*.75});
  if(name!=='day') gsap.to(work.position,{x:-20,z:14,duration:dur,ease:'power2.inOut'});
  const showNew=()=>{ if(prev>=0) slides[prev].classList.remove('active'); s.classList.add('active'); animIn(s); if(name==='day') dayRun(s); setTimeout(()=>busy=false,600); };
  if(out&&!instant) gsap.delayedCall(.7,showNew); else showNew();
  prog.style.transform=`scaleX(${(n+1)/N})`; count.textContent=String(n+1).padStart(2,'0')+' / '+String(N).padStart(2,'0'); secname.textContent=s.dataset.sec||''; }
window.go=go; window.__fps=0; let __f=0,__t0=performance.now(); (function c(){ __f++; const n=performance.now(); if(n-__t0>1000){ window.__fps=__f*1000/(n-__t0); __f=0; __t0=n; } requestAnimationFrame(c); })();

/* input */
const next=()=>go(idx+1), prev=()=>go(idx-1);
$('#next').addEventListener('click',next); $('#prev').addEventListener('click',prev);
$('#fs').addEventListener('click',()=>{ try{ const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} });
addEventListener('keydown',e=>{ if(['ArrowRight','ArrowDown',' ','PageDown','Enter'].includes(e.key)){e.preventDefault();next();} else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();prev();} else if(e.key==='Home') go(0); else if(e.key==='End') go(N-1); else if(e.key==='f'||e.key==='F') $('#fs').click(); });
let wheelLock=0; addEventListener('wheel',e=>{ const now=Date.now(); if(now<wheelLock||Math.abs(e.deltaY)<18) return; wheelLock=now+1500; e.deltaY>0?next():prev(); },{passive:true});
let tx=null; addEventListener('touchstart',e=>{tx=e.touches[0].clientX;},{passive:true}); addEventListener('touchend',e=>{ if(tx===null) return; const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>50) dx<0?next():prev(); tx=null; },{passive:true});
stage.addEventListener('click',e=>{ if(e.target.closest('button,a')) return; if(String(getSelection())) return; (e.clientX>innerWidth*.35)?next():prev(); });

/* start */
regenEnv(); requestAnimationFrame(frame);
const intro=$('#intro');
if(reduce||LITE){ intro.remove(); drift.a=0; camPos.set(...SHOTS.cover.p); camTgt.set(...SHOTS.cover.t); go(0,true); }
else { gsap.timeline()
  .from('#introWord span',{yPercent:100,opacity:0,duration:1,stagger:.06,ease:'expo.out'}).from('#introSub',{opacity:0,duration:.6},'-=.4')
  .to('#introWord span',{opacity:0,y:-20,filter:'blur(10px)',duration:.6,stagger:.03,ease:'power2.in'},'+=.6')
  .to(intro,{opacity:0,duration:1.1,onComplete:()=>intro.remove()},'-=.3')
  .add(()=>{ gsap.to(camPos,{x:SHOTS.cover.p[0],y:SHOTS.cover.p[1],z:SHOTS.cover.p[2],duration:4,ease:'expo.inOut'}); gsap.to(camTgt,{x:SHOTS.cover.t[0],y:SHOTS.cover.t[1],z:SHOTS.cover.t[2],duration:4,ease:'expo.inOut'});
    idx=0; const s=slides[0]; s.classList.add('active'); gsap.set($$('.a',s),{opacity:0}); gsap.set($$('.ch',s),{yPercent:115}); gsap.delayedCall(2.6,()=>animIn(s)); },'-=1'); }
