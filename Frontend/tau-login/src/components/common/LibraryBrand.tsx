import logo from '@/assets/images/Logo.svg';
import { designCopy } from '@/shared/designCopy';
export default function LibraryBrand() {
  const copy=designCopy();
  return <span className="library-brand"><img src={logo} alt="TAU" width="88" height="52"/><span><strong>{copy.brand}</strong><small>{copy.university}</small></span></span>;
}
