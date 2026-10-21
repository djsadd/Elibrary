import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import LibraryBrand from '@/components/common/LibraryBrand';
import LibraryIcon from '@/components/common/LibraryIcon';
import { designCopy } from '@/shared/designCopy';
export default function AuthShell({children}:{children:ReactNode}) {
  const copy=designCopy();
  return <main className="auth-shell"><section className="auth-story"><Link to="/public"><LibraryBrand/></Link><div className="auth-story-copy"><h2>{copy.authTitle}</h2><p>{copy.authBody}</p><ul>{copy.authFeatures.map((text,i)=><li key={text}><LibraryIcon name={(['book','bookmark','document'] as const)[i]}/><span>{text}</span></li>)}</ul><Link className="text-action" to="/public/resources">{copy.resources}<LibraryIcon name="arrow" size={18}/></Link></div><span className="auth-story-footer">© {new Date().getFullYear()} {copy.university}</span></section><section className="auth-form-panel"><Link className="auth-back" to="/public"><LibraryIcon name="arrow" size={17} style={{transform:'rotate(180deg)'}}/>{copy.back}</Link><div className="auth-form-card">{children}</div></section></main>;
}
