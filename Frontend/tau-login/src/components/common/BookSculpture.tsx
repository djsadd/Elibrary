import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Edition = { id:number; title:string; cover:string; year:string; lang:string; summary?:string };
type Labels = { pause:string; play:string; description:string };

function pageGeometry(side:number, elevation:number) {
  const vertices:number[] = [], uv:number[] = [], indices:number[] = [];
  const columns=64, rows=12;
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const u=column/columns, v=row/rows;
    const curl=Math.pow(u,5)*(.025*Math.cos(v*Math.PI*2)+.018);
    vertices.push(side*(.025+u*2.05),elevation+.11*(1-u)+Math.sin(u*Math.PI)*.16+curl,(v-.5)*3.05);
    uv.push(side<0?1-u:u,1-v);
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const a=row*(columns+1)+column,b=a+columns+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function pageTexture(book:Edition, side:'left'|'right') {
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1300;
  const context=canvas.getContext('2d')!;
  context.fillStyle='#fffaf0';context.fillRect(0,0,900,1300);
  // Paper fibres and a printed gutter remain attached to the curved page mesh.
  for(let i=0;i<14000;i++){
    context.fillStyle=i%2?'rgba(110,88,60,.035)':'rgba(255,255,255,.3)';
    context.fillRect((i*137.57)%900,(i*61.73)%1300,1,2);
  }
  const crease=context.createLinearGradient(side==='left'?900:0,0,side==='left'?810:90,0);
  crease.addColorStop(0,'rgba(75,48,30,.24)');crease.addColorStop(1,'rgba(75,48,30,0)');
  context.fillStyle=crease;context.fillRect(side==='left'?810:0,0,90,1300);
  context.fillStyle='#35111f';
  context.font='600 26px "Inter Variable",sans-serif';
  context.fillText('TURAN–ASTANA UNIVERSITY',86,116);
  if(side==='left'){
    context.font='650 144px "Montserrat Variable",sans-serif';
    context.fillText('TAU',80,365);
    context.font='550 106px "Montserrat Variable",sans-serif';context.fillText('Library',80,490);
    context.font='500 39px "Inter Variable",sans-serif';
    context.fillText('Знания',86,680);context.fillText('Білім',86,742);context.fillText('Knowledge',86,804);
    context.font='500 27px "Inter Variable",sans-serif';
    context.fillText('Демонстрационная коллекция',86,1000);
    context.font='500 28px "Inter Variable",sans-serif';
    context.fillText('tau-edu.kz',86,1176);
  }else{
    let titleSize=76;
    const titleWords=book.title.split(' ');
    context.font=`650 ${titleSize}px "Montserrat Variable",sans-serif`;
    while(titleSize>52&&titleWords.some(word=>context.measureText(word).width>710)){
      titleSize-=2;context.font=`650 ${titleSize}px "Montserrat Variable",sans-serif`;
    }
    let line='',y=320;
    for(const word of titleWords){
      const next=line?line+' '+word:word;
      if(context.measureText(next).width>710&&line){context.fillText(line,86,y);line=word;y+=96;}else line=next;
    }
    context.fillText(line,86,y);
    context.fillStyle='#3d292d';context.font='550 30px "Inter Variable",sans-serif';
    context.fillText(`${book.lang==='ru'?'Русский':book.lang==='kk'?'Қазақша':'English'}  ·  ${book.year}`,86,y+90);
    context.font='400 31px "Inter Variable",sans-serif';
    y+=210;line='';
    for(const word of (book.summary||'').replace(/^\[[^\]]*\]\s*/,'').split(' ')){
      const next=line?line+' '+word:word;
      if(context.measureText(next).width>710&&line){context.fillText(line,86,y);line=word;y+=49;}else line=next;
    }
    context.fillText(line,86,y);
    context.fillStyle='#35111f';context.font='600 28px "Inter Variable",sans-serif';
    context.fillText('TAU / LIBRARY',86,1176);context.textAlign='right';context.fillText(String(book.id).padStart(2,'0'),810,1176);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function clothTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d')!;
  const pixels=context.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const at=(y*128+x)*4,value=100+(x%3===0?35:0)+(y%3===0?35:0)+((x*17+y*13)%19);
    pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=value;pixels.data[at+3]=255;
  }
  context.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(9,12);
  return texture;
}

function ribbonGeometry() {
  const points:number[]=[],indices:number[]=[],uv:number[]=[];
  for(let i=0;i<=20;i++){
    const t=i/20;
    for(const side of [-1,1]){
      points.push(.18+side*.078+Math.sin(t*Math.PI)*.025,.14-.16*t*t+Math.sin(t*Math.PI)*.025,1.22+t*.96);
      uv.push((side+1)/2,t);
    }
    if(i<20){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function coverTexture() {
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=980;
  const context=canvas.getContext('2d')!;
  context.fillStyle='#421426';context.fillRect(0,0,700,980);
  context.fillStyle='#e7d7c0';
  context.font='500 100px "Montserrat Variable",sans-serif';
  context.fillText('TAU',70,310);
  context.font='400 76px "Montserrat Variable",sans-serif';context.fillText('Library',70,405);
  context.font='400 20px "Inter Variable",sans-serif';context.fillText('TURAN–ASTANA UNIVERSITY',70,860);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.center.set(.5,.5);texture.rotation=Math.PI;
  return texture;
}

/** An actual page mesh. No canvas gesture capture: scrolling remains native. */
export default function BookSculpture({book,labels}:{book:Edition;labels:Labels}) {
  const host=useRef<HTMLDivElement>(null);
  const currentBook=useRef(book);
  const update=useRef<((value:Edition)=>void)|null>(null);
  const setMotion=useRef<((value:boolean)=>void)|null>(null);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{currentBook.current=book;update.current?.(book);},[book]);
  useEffect(()=>{setMotion.current?.(paused);},[paused]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{setFailed(true);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(32,1,.1,40);camera.position.set(0,6.5,8);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x6b273b,1.4));
    const key=new THREE.DirectionalLight(0xfff6e8,2);key.position.set(-3,8,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0xf4d4e3,.6);rim.position.set(5,2,-4);scene.add(rim);
    const model=new THREE.Group();model.rotation.set(.03,-.25,-.09);scene.add(model);
    const cloth=clothTexture();
    const coverMaterial=new THREE.MeshStandardMaterial({color:0x421c2a,roughness:.82,bumpMap:cloth,bumpScale:.012});
    // Each left leaf pivots at the spine, rather than scaling a flat picture.
    const folds:{pivot:THREE.Group;delay:number;duration:number}[]=[];
    const hinge=(delay:number,duration:number)=>{
      const pivot=new THREE.Group();pivot.position.y=.26;model.add(pivot);
      const content=new THREE.Group();content.position.y=-.26;pivot.add(content);
      folds.push({pivot,delay,duration});return content;
    };
    const frontCover=hinge(0,1100);
    const exterior=new THREE.MeshStandardMaterial({map:coverTexture(),roughness:.78,bumpMap:cloth,bumpScale:.012});
    for(const side of [-1,1]){
      const cover=new THREE.Mesh(new RoundedBoxGeometry(2.175,.075,3.27,3,.03),side<0?[coverMaterial,coverMaterial,coverMaterial,exterior,coverMaterial,coverMaterial]:coverMaterial);
      cover.position.set(side*1.0875,-.105,0);(side<0?frontCover:model).add(cover);
    }
    const spine=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3.27,24),coverMaterial);spine.rotation.x=Math.PI/2;spine.position.y=-.02;model.add(spine);
    const edgeMaterials=[0xe3ddd3,0xf4eee4,0xece6dc].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
    for(let layer=0;layer<24;layer++)for(const side of [-1,1]){
      const sheet=new THREE.Mesh(pageGeometry(side,-.055+layer*.0076),edgeMaterials[layer%3]);
      (side<0?hinge(100+layer*2.5,1180):model).add(sheet);
    }
    const surfaces=['left','right'].map((side,index)=>{
      const material=new THREE.MeshStandardMaterial({map:pageTexture(currentBook.current,side as 'left'|'right'),roughness:.93,side:THREE.DoubleSide});
      const sheet=new THREE.Mesh(pageGeometry(index===0?-1:1,.135),material);
      (index===0?hinge(170,1220):model).add(sheet);return material;
    });
    const ribbon=new THREE.Mesh(ribbonGeometry(),new THREE.MeshStandardMaterial({color:0xa96268,roughness:.48,metalness:.15,side:THREE.DoubleSide,bumpMap:cloth,bumpScale:.003}));
    model.add(ribbon);
    const threads=[new THREE.MeshStandardMaterial({color:0xb5a57f,roughness:.9}),coverMaterial];
    const threadGeometry=new THREE.CylinderGeometry(.022,.022,.015,8);
    for(const end of [-1,1])for(let i=0;i<12;i++){
      const thread=new THREE.Mesh(threadGeometry,threads[i%2]);thread.rotation.z=Math.PI/2;thread.position.set((i-5.5)*.015,.12,end*1.55);model.add(thread);
    }
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,visible=false,manualPause=false,disposed=false,active=true,hasPainted=false;
    let pointerX=0,pointerY=0,turn=0;
    let openingTime=0,lastPaint=0;
    const ease=(value:number)=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*t*(t*(t*6-15)+10);};
    const start=performance.now();
    const paint=()=>{
      frame=0;if(disposed||!visible||document.hidden)return;
      const moving=!reduced.matches&&!manualPause&&!document.documentElement.dataset.routeTransition;
      const now=performance.now();
      if(reduced.matches)openingTime=1480;
      else if(moving)openingTime=Math.min(1480,openingTime+(lastPaint?Math.min(50,now-lastPaint):0));
      lastPaint=now;
      const opened=ease(openingTime/1480);
      folds.forEach(({pivot,delay,duration})=>{pivot.rotation.z=-Math.PI*(1-ease((openingTime-delay)/duration));});
      model.position.x=-(1-opened)*.95;
      model.scale.setScalar(.88+.12*opened-.23*Math.sin(opened*Math.PI));
      const t=(now-start)/1000;
      const targetY=-.25+(moving?pointerX*.18+Math.sin(t*.35)*.055:0);
      const targetX=.03+(moving?pointerY*.09:0);
      model.rotation.y+=(targetY-model.rotation.y)*.07;
      model.rotation.x+=(targetX-model.rotation.x)*.07;
      model.position.y=(moving?Math.sin(t*.7)*.045:0)-(1-opened)*.08;
      if(turn>0){model.rotation.z=-.09+Math.sin(turn)*.055;turn=Math.max(0,turn-.065);}else model.rotation.z=-.09;
      renderer.render(scene,camera);
      if(!hasPainted){hasPainted=true;setReady(true);}
      if(moving)frame=requestAnimationFrame(paint);
    };
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(paint);};
    setMotion.current=value=>{manualPause=value;lastPaint=0;if(frame)cancelAnimationFrame(frame);frame=0;schedule();};
    update.current=value=>{
      surfaces.forEach((material,index)=>{material.map?.dispose();material.map=pageTexture(value,index===0?'left':'right');material.needsUpdate=true;});
      turn=reduced.matches||manualPause?0:Math.PI;schedule();
    };
    const resize=()=>{const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.zoom=Math.min(camera.aspect*5.9/5.6,1.55);camera.updateProjectionMatrix();schedule();};
    const pointer=(event:PointerEvent)=>{if(event.pointerType!=='mouse')return;const rect=element.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width-.5;pointerY=(event.clientY-rect.top)/rect.height-.5;};
    const leave=()=>{pointerX=0;pointerY=0;};
    const visibility=()=>{lastPaint=0;if(frame)cancelAnimationFrame(frame);frame=0;schedule();};
    const contextLost=(event:Event)=>{event.preventDefault();hasPainted=false;setReady(false);setFailed(true);visible=false;visibility();};
    const contextRestored=()=>{visible=true;setFailed(false);schedule();};
    const observer=new ResizeObserver(resize);observer.observe(element);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();});intersection.observe(element);
    element.addEventListener('pointermove',pointer);element.addEventListener('pointerleave',leave);
    renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
    document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
    window.addEventListener('tau:route-ready',visibility);
    resize();
    void document.fonts.ready.then(()=>{if(active)update.current?.(currentBook.current);});
    return ()=>{
      active=false;disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();
      element.removeEventListener('pointermove',pointer);element.removeEventListener('pointerleave',leave);
      document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);
      window.removeEventListener('tau:route-ready',visibility);
      renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);
      update.current=null;setMotion.current=null;
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));}});
      materials.forEach(material=>{for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();});
      geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());
      renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  return <div className="book-sculpture">
    <div className="book-sculpture-canvas" ref={host} role="img" aria-label={`${labels.description}: ${book.title}`}/>
    {failed&&<div className="book-sculpture-fallback"><img src={book.cover} alt="" width="700" height="980"/></div>}
    {ready&&<button className="book-sculpture-pause" type="button" aria-label={paused?labels.play:labels.pause} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m7 4 9 6-9 6z"/></svg>:<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 4h3v12H6zm5 0h3v12h-3z"/></svg>}</button>}
  </div>;
}
