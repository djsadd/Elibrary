import { useEffect, useRef } from 'react';

/** Reveal each marked section once; content stays visible without observer support. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.reveal = 'visible';
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    root.querySelectorAll<HTMLElement>('.reveal').forEach(element => {
      // Never hide content that is already visible when a route mounts.
      if (element.getBoundingClientRect().top < window.innerHeight - 24) {
        element.dataset.reveal = 'static';
      } else {
        element.dataset.reveal = 'waiting';
        observer.observe(element);
      }
    });
    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>('.reveal').forEach(element => { delete element.dataset.reveal; });
    };
  }, []);
  return ref;
}
