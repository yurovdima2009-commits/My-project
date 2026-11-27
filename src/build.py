import os
D=os.path.dirname(os.path.abspath(__file__))
css=open(D+'/style.css').read(); slides=open(D+'/slides.html').read(); js=open(D+'/scene.js').read()
fallback='''<script>
setTimeout(function(){ if(window.__aq) return; var i=document.getElementById('intro'); if(i) i.remove();
  var s=[].slice.call(document.querySelectorAll('.slide')), k=0, st=document.getElementById('stage');
  function fit(){ var c=Math.min(innerWidth/1920, innerHeight/1080); st.style.transform='translate('+(-960*c)+'px,'+(-540*c)+'px) scale('+c+')'; } fit(); addEventListener('resize',fit);
  document.body.style.background='radial-gradient(ellipse at 70% 30%,#16324a,#04070C 70%)';
  function show(n){ k=Math.max(0,Math.min(s.length-1,n)); s.forEach(function(x,j){ x.classList.toggle('active',j===k); }); document.getElementById('count').textContent=(k+1)+' / '+s.length; }
  show(0); addEventListener('keydown',function(e){ if(['ArrowRight',' ','PageDown'].indexOf(e.key)>-1) show(k+1); if(['ArrowLeft','PageUp'].indexOf(e.key)>-1) show(k-1); });
  document.getElementById('next').onclick=function(){show(k+1)}; document.getElementById('prev').onclick=function(){show(k-1)};
}, 12000);
</script>'''
html=f'''<title>AQUAVAPOR Presentation</title>
<meta name="description" content="AQUAVAPOR investor presentation: a private floating sauna at sea off the Dubai coast, in a live 3D film.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=Marcellus&family=Manrope:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>{css}</style>

<canvas id="gl" aria-hidden="true"></canvas>
<div class="vignette" aria-hidden="true"></div>
<div id="labels" aria-hidden="true"></div>
{slides}
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script type="importmap">{{"imports":{{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}}}</script>
<script type="module">
{js}
</script>
{fallback}
'''
open(os.path.join(D,'..','index.html'),'w').write(html)
print(len(html))
