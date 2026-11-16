// Mantém viva a conexão de uma rota que demora (chamada de IA): manda um espaço em branco a cada poucos segundos, para a hospedagem/proxy não derrubar com 504,
// e entrega o JSON no fim. O navegador lê o corpo todo e faz JSON.parse(trim): espaços na frente não atrapalham.
// Depois que o pulso começa, o status HTTP já foi enviado (200): erro vai no corpo como { error }, e o navegador precisa olhar esse campo.
export function iniciarPulsoJson(res: any, cadaMs = 4000): void {
  if (res.headersSent) return;
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Transfer-Encoding": "chunked", "X-Accel-Buffering": "no", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive" });
  try { res.flushHeaders?.(); res.write(" "); } catch { /* conexão já caiu */ }
  const t = setInterval(() => { try { if (!res.writableEnded && !res.destroyed) res.write(" "); } catch { /* ignora */ } }, cadaMs);
  res.on("close", () => clearInterval(t));
  res.status = () => res;
  res.json = (corpo: any) => { clearInterval(t); try { if (!res.writableEnded) res.end(JSON.stringify(corpo)); } catch { /* ignora */ } return res; };
}
