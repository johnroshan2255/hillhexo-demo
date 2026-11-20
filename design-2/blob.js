/* Liquid-chrome morphing blob (WebGL raymarcher). Usage: <div class="lqb"><img ...fallback><canvas></canvas></div> */
(() => {
  const hosts = document.querySelectorAll('.lqb');
  if (!hosts.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform vec2 R;uniform float T,E;uniform vec2 M;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float map(vec3 p){
  p.yz*=rot(M.y*.6);p.xz*=rot(T*.32+M.x*.8);p.xy*=rot(T*.21);
  p.xz*=rot(p.y*(.55*sin(T*.47)+E*.5));
  float a=.19+E*.13;
  float d=length(p*vec3(1.,.92,1.))-1.;
  d+=a*sin(2.7*p.x+T*1.05)*sin(2.4*p.y+T*.83+E*2.)*sin(3.*p.z+T*1.21);
  vec3 q=p;q.xy*=rot(.7);
  d+=(.085+E*.05)*sin(5.2*q.y+2.1*q.x+T*1.6)*sin(4.6*q.z-T*1.1);
  d+=.05*sin(8.5*p.x+4.*p.z+T*2.3)*sin(7.*p.y-T*1.4);
  return d*.42;
}
vec3 nrm(vec3 p){vec2 e=vec2(.0012,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
vec3 env(vec3 r){
  vec3 c=vec3(.006,.007,.012);
  c+=vec3(1.)*smoothstep(.62,.9,r.y)*1.6;
  c+=vec3(1.)*pow(max(0.,dot(r,normalize(vec3(.85,.35,.35)))),26.)*2.2;
  c+=vec3(.9)*pow(max(0.,dot(r,normalize(vec3(-.8,.45,.4)))),40.)*1.6;
  c+=vec3(.85)*pow(abs(sin(r.y*5.5+r.x*1.7)),60.)*.9;
  c+=vec3(.2,.3,.9)*smoothstep(.3,1.,-r.y)*.28;
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-R)/R.y;
  vec3 ro=vec3(0.,0.,3.7),rd=normalize(vec3(uv,-1.85));
  float t=0.,md=9.,tm=0.;
  for(int i=0;i<110;i++){float d=map(ro+rd*t);if(d<md){md=d;tm=t;}if(d<.0008)break;t+=d;if(t>6.5)break;}
  float px=2.4/R.y;
  float al=1.-smoothstep(0.,px*1.2,md);
  if(al<=0.){gl_FragColor=vec4(0.);return;}
  vec3 p=ro+rd*tm,n=nrm(p),r=reflect(rd,n);
  float fr=pow(1.-max(dot(n,-rd),0.),2.6);
  vec3 col=env(r)*(.45+.75*fr)+fr*vec3(.55,.62,.85)*.5;
  col=col/(1.+col*.45);
  gl_FragColor=vec4(col*al,al);
}`;

  hosts.forEach(host => {
    const cv = host.querySelector('canvas');
    if (!cv) return;
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'low-power' });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uE = gl.getUniformLocation(pr, 'E'), uM = gl.getUniformLocation(pr, 'M');
    host.classList.add('gl');

    let w = 0, h = 0, vis = false, raf = 0, last = performance.now(), time = 7, energy = 0, mx = 0, my = 0, tx = 0, ty = 0;
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      const nw = Math.max(1, Math.round(r.width * d)), nh = Math.max(1, Math.round(r.height * d));
      if (nw !== w || nh !== h) { w = cv.width = nw; h = cv.height = nh; gl.viewport(0, 0, w, h); }
    };
    const draw = () => { gl.uniform2f(uR, w, h); gl.uniform1f(uT, time); gl.uniform1f(uE, energy); gl.uniform2f(uM, mx, my); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const loop = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      energy *= Math.pow(.25, dt); mx += (tx - mx) * Math.min(1, dt * 3); my += (ty - my) * Math.min(1, dt * 3);
      time += dt * (1 + energy * 2.2);
      size(); draw();
      raf = vis ? requestAnimationFrame(loop) : 0;
    };
    const start = () => { if (!raf && vis && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (reduce && vis) { size(); draw(); } else start(); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); });
    addEventListener('resize', () => { if (reduce && vis) { size(); draw(); } });
    // movement → the shape reacts: scrolling and pointer motion add energy (faster, stronger morph + twist)
    let sy = scrollY;
    addEventListener('scroll', () => { if (!vis) { sy = scrollY; return; } energy = Math.min(1.6, energy + Math.abs(scrollY - sy) / 260); sy = scrollY; }, { passive: true });
    host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2; energy = Math.min(1.6, energy + .04); });
    host.addEventListener('pointerleave', () => { tx = ty = 0; });
    host.addEventListener('pointerdown', () => { energy = Math.min(1.6, energy + .8); });
  });
})();
