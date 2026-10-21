import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** All content is readable without animation; effects never retain transforms after finishing. */
export function useFolioMotion<T extends HTMLElement>() {
  const ref=useRef<T>(null);
  const {pathname}=useLocation();
  useEffect(()=>{
    const root=ref.current;
    if(!root || typeof IntersectionObserver==='undefined')return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    root.querySelectorAll<HTMLElement>('.public-page-intro h1,.public-page-intro p,.reader-service-card,.reader-tab-list > button,.reader-panel li,.sheet-all,.footer-columns > div,.footer-wordmark').forEach(element=>{
      if(!element.dataset.motion)element.dataset.motion=element.matches('h1')?'title':element.matches('p')?'copy':'row';
    });
    const targets=Array.from(root.querySelectorAll<HTMLElement>('[data-motion]'));
    let observer:IntersectionObserver|null=null;
    let frame=0;
    const reset=()=>{
      targets.forEach(element=>{delete element.dataset.folioEntered;element.style.removeProperty('--folio-delay');});
      root.querySelectorAll<HTMLElement>('.edition-main img').forEach(element=>element.style.removeProperty('transform'));
      root.querySelector<HTMLElement>('.atlas-book-stage')?.style.removeProperty('--atlas-drift');
    };
    const observe=()=>{
      observer?.disconnect();reset();
      if(reduced.matches)return;
      observer=new IntersectionObserver(entries=>{
        entries.filter(entry=>entry.isIntersecting).forEach((entry,i)=>{
          const element=entry.target as HTMLElement;
          element.style.setProperty('--folio-delay',`${Math.min(i,5)*65}ms`);
          element.dataset.folioEntered='true';
          observer?.unobserve(element);
        });
      },{threshold:.08,rootMargin:'0px 0px -20px 0px'});
      targets.forEach(element=>observer?.observe(element));
    };
    const drift=()=>{
      frame=0;
      const stage=root.querySelector<HTMLElement>('.atlas-book-stage');
      if(stage&&!reduced.matches){
        const bounds=stage.getBoundingClientRect();
        if(bounds.bottom>0&&bounds.top<window.innerHeight)stage.style.setProperty('--atlas-drift',`${Math.max(-28,Math.min(28,-window.scrollY*.055))}px`);
      }
      const plate=root.querySelector<HTMLElement>('.edition-plate');
      const picture=plate?.querySelector<HTMLImageElement>('.edition-main img');
      if(!plate||!picture||reduced.matches)return;
      const rect=plate.getBoundingClientRect();
      if(rect.bottom<0||rect.top>window.innerHeight)return;
      const progress=Math.max(0,Math.min(1,(window.innerHeight-rect.top)/(window.innerHeight+rect.height)));
      picture.style.transform=`translateY(${-10*progress}px) scale(${1+progress*.025})`;
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(drift);};
    const reveal=()=>observe();
    if(!document.documentElement.dataset.routeTransition)observe();
    window.addEventListener('tau:route-reveal',reveal);
    window.addEventListener('scroll',scroll,{passive:true});
    reduced.addEventListener('change',observe);
    return ()=>{
      observer?.disconnect();cancelAnimationFrame(frame);reset();
      window.removeEventListener('scroll',scroll);reduced.removeEventListener('change',observe);
      window.removeEventListener('tau:route-reveal',reveal);
      root.querySelectorAll<HTMLElement>('.edition-main img').forEach(element=>element.style.removeProperty('transform'));
    };
  },[pathname]);
  return ref;
}
