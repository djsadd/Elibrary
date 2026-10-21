import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null };
const server = await createServer({ server:{middlewareMode:true,hmr:false}, appType:'custom', logLevel:'error' });
try {
  const { returnPath } = await server.ssrLoadModule('/src/shared/auth/returnPath.ts');
  const query = '?q=%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0&lang=kk&year=2025';
  assert.equal(returnPath({from:{pathname:'/catalog',search:query,hash:'#results'}}), '/catalog'+query+'#results', 'Sign-in must retain the search, filters and fragment');
  assert.equal(returnPath({from:{pathname:'/catalog/12'}}), '/catalog/12');
  for (const state of [null,{}, {from:{}}, {from:{pathname:'https://example.com'}}, {from:{pathname:'//example.com'}}, {from:{pathname:'/\\example.com'}}, {from:{pathname:'/auth/login'}}, {from:{pathname:'/login'}}, {from:{pathname:'/\nexample.com'}}]) {
    assert.equal(returnPath(state),'/', 'Missing or invalid destinations must fall back to home');
  }
  const { default: BookCard } = await server.ssrLoadModule('/src/components/common/BookCard.tsx');
  const { default: Brand } = await server.ssrLoadModule('/src/components/common/LibraryBrand.tsx');
  for (const lang of ['ru','kk','en']) {
    storage.set('ui_lang',lang);
    const html = renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(BookCard,{book:{id:12,title:'Кітап & book',authors:[{name:'Автор'}],lang:'kk'},favorite:true,onFavorite(){},progress:145})));
    assert.ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/.test(html), 'Favourite must not be nested in a link');
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('value="100"') && html.includes('100%'), 'Reading progress must stay within its range');
    assert.ok(html.includes('Кітап &amp; book') && html.includes('Автор'));
    assert.ok(!html.includes('catalog.addFav') && !html.includes('catalog.removeFav'), 'Favourite labels must be translated');
    const brand = renderToStaticMarkup(React.createElement(Brand));
    assert.match(brand, /<img[^>]*src="[^\"]*Logo[^\"]*\.svg"[^>]*alt="TAU"/);
  }
  console.log('Navigation checks passed: sign-in return query, invalid destinations, card controls, reading progress and TAU brand in three languages.');
} finally { await server.close(); }
