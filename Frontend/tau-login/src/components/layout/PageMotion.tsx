import { useCallback, useLayoutEffect, useRef } from 'react';
import { Outlet, useBlocker, useLocation, useNavigation, useNavigationType, type BlockerFunction } from 'react-router-dom';
import { createPageMotionController } from '@/shared/ui/pageMotionController';
import { designCopy } from '@/shared/designCopy';
import { t } from '@/shared/i18n';
import { readerGuides } from '@/shared/readerGuides';

function routeLabel(path:string) {
  const guide=[...readerGuides('students'),...readerGuides('teachers')].find(item=>item.to===path);
  if(guide)return guide.title;
  const copy=designCopy();
  if(path==='/public')return copy.library;
  if(path.includes('login'))return copy.loginHeading;
  if(path.startsWith('/catalog'))return t('catalog.title');
  if(path.startsWith('/public/about')||path==='/about')return t('publicHome.nav.about');
  if(path.startsWith('/public/students'))return t('publicHome.nav.students');
  if(path.startsWith('/public/teachers'))return t('publicHome.nav.teachers');
  if(path.startsWith('/public/resources')||path.includes('/links'))return copy.resources;
  if(path.startsWith('/admin')||path.startsWith('/content')||path.startsWith('/analytics'))return copy.admin;
  if(path==='/profile')return copy.profile;
  return copy.brand;
}

/** One leave, commit, enter sequence for links, forms and browser history. */
export default function PageMotion() {
  const location=useLocation(),navigation=useNavigation(),navigationType=useNavigationType();
  const root=useRef<HTMLDivElement>(null),veil=useRef<HTMLDivElement>(null),label=useRef<HTMLSpanElement>(null);
  const paper=useRef<HTMLDivElement>(null);
  const controller=useRef(createPageMotionController());
  const phase=useRef<'idle'|'covering'|'covered'|'revealing'>('idle');
  const mounted=useRef(true),previousPath=useRef(location.pathname);
  const shouldBlock=useCallback<BlockerFunction>(({currentLocation,nextLocation})=>
    currentLocation.pathname!==nextLocation.pathname && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof document.documentElement.animate==='function',[]);
  const blocker=useBlocker(shouldBlock);
  const latestBlocker=useRef(blocker);latestBlocker.current=blocker;

  useLayoutEffect(()=>{
    mounted.current=true;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish=()=>{
      if(!media.matches)return;
      controller.current.reset(veil.current,paper.current);phase.current='idle';delete document.documentElement.dataset.routeTransition;
      if(latestBlocker.current.state==='blocked')latestBlocker.current.proceed();
      window.dispatchEvent(new Event('tau:route-ready'));
    };
    media.addEventListener('change',finish);
    const motion=controller.current;
    return ()=>{mounted.current=false;motion.reset();delete document.documentElement.dataset.routeTransition;media.removeEventListener('change',finish);};
  },[]);

  useLayoutEffect(()=>{
    if(blocker.state!=='blocked'||!veil.current||!label.current)return;
    label.current.textContent=routeLabel(blocker.location.pathname);
    if(phase.current==='covering')return;
    if(phase.current==='covered'){blocker.proceed();return;}
    const reversing=phase.current==='revealing';
    const from=reversing?getComputedStyle(veil.current).transform:'translateY(110%)';
    const paperFrom=reversing&&paper.current?getComputedStyle(paper.current).transform:'translateY(110%)';
    phase.current='covering';document.documentElement.dataset.routeTransition='covering';
    void controller.current.cover(veil.current,label.current,from,reversing?260:480,paper.current,paperFrom).then(covered=>{
      if(!mounted.current||!covered)return;
      phase.current='covered';document.documentElement.dataset.routeTransition='covered';
      if(latestBlocker.current.state==='blocked')latestBlocker.current.proceed();
      else{controller.current.reset(veil.current,paper.current);phase.current='idle';delete document.documentElement.dataset.routeTransition;window.dispatchEvent(new Event('tau:route-ready'));}
    });
  },[blocker]);

  useLayoutEffect(()=>{
    const changed=previousPath.current!==location.pathname;previousPath.current=location.pathname;
    if(changed&&navigationType!=='POP'&&!location.hash)window.scrollTo({top:0,behavior:'instant'});
    if(location.hash){
      try{document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({block:'start',behavior:'instant'});}catch{/* A malformed fragment must not prevent navigation. */}
    }
    if(phase.current!=='covered'||navigation.state!=='idle')return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      if(!mounted.current||phase.current!=='covered'||!veil.current||!label.current||latestBlocker.current.state==='blocked')return;
      phase.current='revealing';document.documentElement.dataset.routeTransition='revealing';
      window.dispatchEvent(new Event('tau:route-reveal'));
      const heading=root.current?.querySelector<HTMLElement>('h1');
      void controller.current.reveal(veil.current,label.current,heading,paper.current).then(finished=>{
        if(!mounted.current||!finished)return;
        phase.current='idle';delete document.documentElement.dataset.routeTransition;
        window.dispatchEvent(new Event('tau:route-ready'));
      });
    });});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[location.key,location.pathname,location.hash,navigation.state,navigationType]);

  return <div ref={root} className="page-motion-root"><Outlet/>
    {navigation.state!=='idle'&&<div className="route-loading" role="status"><span className="sr-only">{designCopy().loading}</span><span className="route-loading-track" aria-hidden="true"/></div>}
    <div ref={paper} className="route-veil-paper" aria-hidden="true"/>
    <div ref={veil} className="route-veil" aria-hidden="true">
      <span className="route-veil-imprint">TAU / LIBRARY</span>
      <div className="route-veil-title"><span ref={label}/></div>
      <div className="route-veil-footer"><span>Тұран–Астана</span><span>TAU Library <span className="route-veil-mark">↗</span></span></div>
    </div>
  </div>;
}
