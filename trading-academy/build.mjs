// Сборка: src/*.jsx → один HTML-файл (React из CDN, весь код приложения внутри)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const res = await build({
  entryPoints: ['src/app.jsx'], bundle: true, write: false, format: 'iife', minify: true,
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019', charset: 'utf8',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/style.css', 'utf8');
const head = `<title>Академия реального трейдинга</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700&display=swap">
<style>${css}</style>`;
const body = `<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', head + '\n' + body + '\n');
writeFileSync('trading-academy.html', `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('ok', (js.length / 1024).toFixed(0) + ' KB js');
