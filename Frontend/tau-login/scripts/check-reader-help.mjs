import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null};
globalThis.sessionStorage={getItem:()=>null};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try{
  const {getGuideContent,GUIDE_SLUGS}=await server.ssrLoadModule('/src/shared/guideContent.ts');
  const {default:Guide}=await server.ssrLoadModule('/src/components/common/PublicGuide.tsx');
  const {default:Access}=await server.ssrLoadModule('/src/pages/auth/RegisterPage.tsx');
  const {default:Recovery}=await server.ssrLoadModule('/src/pages/auth/ForgotPasswordPage.tsx');
  const render=component=>renderToStaticMarkup(React.createElement(MemoryRouter,null,component));
  for(const lang of ['ru','kk','en']){
    values.set('ui_lang',lang);
    for(const slug of GUIDE_SLUGS){
      const content=getGuideContent(slug,lang);
      assert.ok(content.lead.length>50&&content.sections.length>=3);
      assert.ok(content.sources.length&&content.sources.every(source=>new URL(source.url).protocol==='https:'));
      const audience=['citation-index','gost-publications','acquisition-requests'].includes(slug)?'teachers':'students';
      const html=render(React.createElement(Guide,{audience,slug}));
      assert.equal((html.match(/<h1\b/g)||[]).length,1);
      assert.ok(!html.includes('Инструкция готовится')&&!html.includes('Guide in preparation'));
      assert.ok(html.includes('mailto:z.dubaeva@tau-edu.kz?subject=')&&html.includes('id="guide-sources"'));
      for(let index=0;index<content.sections.length;index++)assert.ok(html.includes(`href="#guide-section-${index}"`)&&html.includes(`id="guide-section-${index}"`));
    }
    const access=render(React.createElement(Access));
    assert.ok(!access.includes('<form')&&!access.includes('type="password"'),'Closed registration must not collect credentials');
    assert.ok(access.includes('https://tau-edu.kz/department/ofis-registrator')&&access.includes('/auth/login?method=email'));
    const recovery=render(React.createElement(Recovery));
    assert.ok(recovery.includes('id="recovery-email"')&&recovery.includes('type="email"'));
    assert.ok(recovery.includes('mailto:z.dubaeva@tau-edu.kz'));
  }
  assert.equal(getGuideContent('unknown','ru'),undefined);
  const {ApiError}=await server.ssrLoadModule('/src/shared/api/client.ts');
  const {requestPasswordReset}=await server.ssrLoadModule('/src/features/auth/api.ts');
  let redirect=false;
  globalThis.window={location:{assign:()=>{redirect=true;}},dispatchEvent:()=>{redirect=true;}};
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'/api/auth/password-reset/request');
    assert.equal(init.method,'POST');
    assert.deepEqual(JSON.parse(init.body),{email:'reader@example.com'});
    return new Response(JSON.stringify({detail:'Too many requests'}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'45'}});
  };
  await assert.rejects(()=>requestPasswordReset('reader@example.com'),error=>error instanceof ApiError&&error.status===429&&error.retryAfter===45);
  assert.equal(redirect,false,'A guest recovery request must not redirect to login');
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:'Email unavailable'}),{status:503});
  await assert.rejects(()=>requestPasswordReset('reader@example.com'),error=>error instanceof ApiError&&error.status===503);
  console.log('Reader help checks passed: 27 guide pages, sourced support contacts, closed-registration guidance and public recovery errors.');
}finally{await server.close();}
