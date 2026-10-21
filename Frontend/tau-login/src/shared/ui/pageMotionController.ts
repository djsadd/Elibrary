type MotionElement = Pick<HTMLElement, 'animate' | 'style'>;
const easing = 'cubic-bezier(.76,0,.24,1)';
const resetLayer = (element?:MotionElement|null) => {
  if (!element) return;
  element.style.transform='translateY(110%)';
  element.style.visibility='hidden';
  element.style.pointerEvents='none';
};

/** Commit the route under a solid cover, then reveal the next page. */
export function createPageMotionController() {
  const animations = new Set<Animation>();
  let generation = 0;
  const stop = () => { generation++; animations.forEach(a => a.cancel()); animations.clear(); };
  const run = async (element:MotionElement, frames:Keyframe[], options:KeyframeAnimationOptions) => {
    const animation=element.animate(frames,{...options,fill:'forwards'});animations.add(animation);
    try { await animation.finished; return true; } catch { return false; }
  };
  return {
    stop,
    async cover(veil:MotionElement, label:MotionElement, from='translateY(110%)', duration=480, paper?:MotionElement|null, paperFrom='translateY(110%)') {
      stop();const version=generation;
      veil.style.visibility='visible';veil.style.pointerEvents='auto';veil.style.transform=from;label.style.opacity='0';
      if(paper){
        paper.style.visibility='visible';paper.style.transform=paperFrom;
        void run(paper,[{transform:paperFrom},{transform:'translateY(0%)'}],{duration:duration*.78,easing});
      }
      const covering=run(veil,[{transform:from},{transform:'translateY(0%)'}],{duration,easing});
      void run(label,[{opacity:0,transform:'translateY(110%) rotate(3deg)'},{opacity:1,transform:'translateY(0) rotate(0deg)'}],{duration:240,delay:Math.max(0,duration-260),easing:'cubic-bezier(.22,1,.36,1)'});
      const finished=await covering;
      if(!finished||version!==generation)return false;
      veil.style.transform='translateY(0%)';
      if(paper)paper.style.transform='translateY(0%)';
      return true;
    },
    async reveal(veil:MotionElement, label:MotionElement, heading?:MotionElement|null, paper?:MotionElement|null) {
      const version=generation;
      void run(label,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-80%) rotate(-2deg)'}],{duration:200,delay:90,easing:'ease-in'});
      if(heading)void run(heading,[{opacity:.4,transform:'translateY(28px)'},{opacity:1,transform:'translateY(0)'}],{duration:540,delay:180,easing:'cubic-bezier(.22,1,.36,1)'});
      const uncovering=run(veil,[{transform:'translateY(0%)'},{transform:'translateY(-110%)'}],{duration:560,delay:100,easing});
      const finished=paper
        ? (await Promise.all([uncovering,run(paper,[{transform:'translateY(0%)'},{transform:'translateY(-110%)'}],{duration:580,delay:160,easing})])).every(Boolean)
        : await uncovering;
      if(!finished||version!==generation)return false;
      stop();resetLayer(veil);resetLayer(paper);label.style.opacity='0';return true;
    },
    reset(veil?:MotionElement|null, paper?:MotionElement|null) {
      stop();resetLayer(veil);resetLayer(paper);
    },
  };
}
