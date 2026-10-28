import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {execSync} from 'node:child_process';

// Versão que aparece no rodapé: código do último commit (quando o .git existe no build) e data/hora da construção (horário de Brasília).
function versaoDoSistema() {
  let commit = process.env.GITHUB_SHA || process.env.COMMIT_SHA || '';
  try { if (!commit) commit = execSync('git rev-parse HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim(); } catch { /* build sem .git */ }
  const data = new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date()).replace(',', '');
  return {commit: commit.slice(0, 7), data};
}

export default defineConfig(() => {
  const versao = versaoDoSistema();
  return {
    define: {__APP_VERSAO__: JSON.stringify(versao)},
    plugins: [react(), tailwindcss(), {name: 'versao-json', generateBundle() { this.emitFile({type: 'asset', fileName: 'versao.json', source: JSON.stringify(versao)}); }}],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
