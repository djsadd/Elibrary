import { designCopy } from '@/shared/designCopy';
export default function Footer() { return <footer className="border-t py-4 text-center text-sm text-slate-500">© {new Date().getFullYear()} {designCopy().university}</footer>; }
