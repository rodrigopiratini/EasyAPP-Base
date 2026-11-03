// Aplica a identidade do segmento (src/js/segmento.js + src/css/segmento.css) em tudo o que é gerado:
// títulos das páginas, manifests (instalação no celular), página inicial e ícones dos dois apps.
// Uso: node scripts/aplicar-segmento.mjs        (rode de novo sempre que mudar nome, cores ou ícone)
// Os ícones são desenhados com o Chromium do Playwright; sem ele, o resto é gerado e os ícones ficam como estão.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { SEGMENTO as S } from '../src/js/segmento.js';

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const gravar = (p, t) => { writeFileSync(new URL(p, raiz), t); console.log('  ✓', p); };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const css = ler('src/css/segmento.css');
const cor = (v, padrao) => css.match(new RegExp(`--${v}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] || padrao;
const C = { escura: cor('primaria-escura', '#12314D'), primaria: cor('primaria', '#1F4E79'), destaque: cor('destaque', '#F2A541'), fundo: cor('fundo', '#F5F7FA') };
const apps = { gestao: { ...S.gestao, fundo: C.escura, traco: '#FFFFFF' }, usuario: { ...S.usuario, fundo: C.destaque, traco: C.escura } };

console.log(`Aplicando "${S.nome}"`);
for (const [app, a] of Object.entries(apps)) {
  let html = ler(`${app}/index.html`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(a.nome)}</title>`)
    .replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${C.escura}">`)
    .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*">/, `<meta name="apple-mobile-web-app-title" content="${esc(a.curto)}">`)
    .replace(/<meta name="description" content="[^"]*">\n?/, '')
    .replace('<link rel="manifest"', `<meta name="description" content="${esc(a.descricao)}">\n<link rel="manifest"`);
  gravar(`${app}/index.html`, html);
  gravar(`${app}/manifest.webmanifest`, JSON.stringify({
    id: `${S.id}-${app}`, name: a.nome, short_name: a.curto, description: a.descricao, lang: 'pt-BR', start_url: './', scope: './',
    display: 'standalone', orientation: 'any', background_color: C.escura, theme_color: C.escura,
    icons: [
      { src: `../assets/icons/${app}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `../assets/icons/${app}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `../assets/icons/${app}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n');
}

gravar('index.html', `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(S.nome)}</title>
<meta name="description" content="${esc(S.slogan)}">
<meta name="theme-color" content="${C.escura}">
<link rel="icon" href="assets/icons/gestao-192.png">
<link rel="apple-touch-icon" href="assets/icons/gestao-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="src/css/base.css"><link rel="stylesheet" href="src/css/segmento.css">
<style>
  .hub { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; padding: 32px 16px; background: radial-gradient(120% 80% at 50% 0%, var(--primaria), var(--primaria-escura) 70%); }
  .hub h1 { color: #fff; font-size: 34px; text-align: center; }
  .hub .tagline { color: var(--destaque-claro); text-align: center; margin-top: -14px; max-width: 520px; }
  .hub .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 300px)); gap: 16px; width: 100%; justify-content: center; }
  .hub a.card { display: flex; flex-direction: column; gap: 10px; color: var(--ink); transition: transform .15s; }
  .hub a.card:hover { transform: translateY(-3px); }
  .hub a.card img { width: 56px; height: 56px; border-radius: 14px; }
  .hub .foot { color: var(--destaque-claro); font-size: 12px; text-align: center; opacity: .85; }
  .hub .foot a { color: #fff; }
  @media (max-width: 640px) { .hub .cards { grid-template-columns: minmax(0, 1fr); } }
</style>
</head>
<body>
<div class="hub">
  ${S.logo ? `<img src="${esc(S.logo)}" alt="${esc(S.nome)}" style="width:min(300px,70vw)">` : `<h1>${esc(S.nome)}</h1>`}
  <div class="tagline">${esc(S.slogan)}</div>
  <div class="cards">
    <a class="card" href="gestao/"><img src="assets/icons/gestao-192.png" alt=""><h2>${esc(S.gestao.nome)}</h2><div class="small ink2">${esc(S.gestao.descricao)}</div><span class="btn sm" style="align-self:flex-start">Abrir</span></a>
    <a class="card" href="usuario/"><img src="assets/icons/usuario-192.png" alt=""><h2>${esc(S.usuario.nome)}</h2><div class="small ink2">${esc(S.usuario.descricao)}</div><span class="btn sm gold" style="align-self:flex-start">Abrir</span></a>
  </div>
  <div class="foot">No iPhone: abra no Safari › Compartilhar › Adicionar à Tela de Início.<br><br>
    Quer conhecer antes? Demonstração com dados fictícios (fica só neste navegador):<br>
    <a href="gestao/?demo=1">${esc(S.gestao.curto)} demo</a> · <a href="usuario/?demo=1">${esc(S.usuario.curto)} demo</a></div>
</div>
<script>if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body>
</html>
`);

// ---------- Ícones ----------
const ui = ler('src/js/core/ui.js');
const caminho = (nome) => ui.match(new RegExp(`\\n\\s+${nome}: '([^']+)'`))?.[1] || '';
const desenho = (a, tam, margem) => `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${margem ? 0 : 22}" fill="${a.fundo}"/>
  <g transform="translate(${margem ? 30 : 22} ${margem ? 30 : 22}) scale(${margem ? 1.666 : 2.333})" fill="none" stroke="${a.traco}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${caminho(a.icone || S.icone || 'home')}</g></svg>`;
mkdirSync(new URL('assets/icons/', raiz), { recursive: true });
let pw;
try { pw = await import('playwright'); } catch { try { const { createRequire } = await import('node:module'); pw = createRequire(import.meta.url)('playwright'); } catch { pw = null; } }
if (!pw) { console.log('  (Playwright indisponível: ícones não gerados)'); process.exit(0); }
const browser = await pw.chromium.launch(existsSync('/opt/pw-browsers/chromium') ? {} : {});
const page = await browser.newPage();
for (const [app, a] of Object.entries(apps)) {
  for (const [nome, tam, margem] of [[`${app}-192`, 192], [`${app}-512`, 512], [`${app}-180`, 180], [`${app}-maskable-512`, 512, true]]) {
    await page.setViewportSize({ width: tam, height: tam });
    await page.setContent(`<html><body style="margin:0;background:transparent">${desenho(a, tam, margem)}</body></html>`);
    writeFileSync(new URL(`assets/icons/${nome}.png`, raiz), await page.screenshot({ omitBackground: !margem, clip: { x: 0, y: 0, width: tam, height: tam } }));
    console.log('  ✓', `assets/icons/${nome}.png`);
  }
}
await browser.close();
