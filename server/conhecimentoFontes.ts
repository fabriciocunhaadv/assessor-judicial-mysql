// CONHECIMENTO DO GABINETE sobre as fontes pendentes: leis que são FEDERAIS (não devem ser procuradas no site de Goiás) e endereços oficiais já conferidos.
// Lista informada pelo Super Admin em 18/11/2026. Conferida por número E ano (leis estaduais e federais podem repetir o número).
export const LEIS_FEDERAIS_CONHECIDAS = "4595/1964 5474/1968 6015/1973 6019/1974 6024/1974 6385/1976 6404/1976 6496/1977 6880/1980 7209/1984 7433/1985 7492/1986 7510/1986 7716/1989 7998/1990 8036/1990 8038/1990 8080/1990 8137/1990 8177/1991 8212/1991 8213/1991 8437/1992 8560/1992 8625/1993 8666/1993 8742/1993 8906/1994 8934/1994 8935/1994 8987/1995 9032/1995 9099/1995 9249/1995 9278/1996 9279/1996 9289/1996 9307/1996 9394/1996 9430/1996 9455/1997 9492/1997 9494/1997 9514/1997 9534/1997 9605/1998 9610/1998 9613/1998 9656/1998 9717/1998 9718/1998 9784/1999 9790/1999 9868/1999 9870/1999 9873/1999 9876/1999 10257/2001 10267/2001 10522/2002 10666/2003 10833/2003 10887/2004 11101/2005 11105/2005 11382/2006 11494/2007 11788/2008 11795/2008 11804/2008 11977/2009 12007/2009 12014/2009 12318/2010 12414/2011 12527/2011 12683/2012 12764/2012 12830/2013 12842/2013 12846/2013 12850/2013 12965/2014 13058/2014 13146/2015 13185/2015 13303/2016 13431/2017 13465/2017 13709/2018 13869/2019 13874/2019 13964/2019 13994/2020 14132/2021 14181/2021 14195/2021 14340/2022 14382/2022 14711/2023 14713/2023 14973/2024".split(" ");
export const LCS_FEDERAIS_CONHECIDAS = "35/1979 51/1985 80/1994 87/1996 101/2000 116/2003 123/2006 142/2013 173/2020 187/2021 194/2022 195/2022".split(" ");
/** Leis cujo ano costuma vir errado nas citações dos autos: vale o número (único na esfera federal para esses). */
export const FEDERAIS_ANO_CORRIGIVEL = new Set(["lei|9099", "lei|13709"]);
const num = (n: string) => String(n || "").replace(/\D/g, "").replace(/^0+/, "");
const CONJ = new Map<string, string>([...LEIS_FEDERAIS_CONHECIDAS.map((x) => ["lei|" + x.replace("/", "|"), x] as [string, string]), ...LCS_FEDERAIS_CONHECIDAS.map((x) => ["lei complementar|" + x.replace("/", "|"), x] as [string, string])]);
const anoDe = (k: string) => Number(k.split("|")[2]);
/** Devolve o ano oficial se a lei é uma das federais conhecidas (ou null). */
export function federalConhecida(tipo: string, numero: string, ano: number): { ano: number } | null {
  const t = String(tipo || "").toLowerCase(), n = num(numero);
  if (t !== "lei" && t !== "lei complementar") return null;
  const k = `${t}|${n}|${Number(ano)}`;
  if (CONJ.has(`${t}|${n}|${Number(ano)}`)) return { ano: Number(ano) };
  if (FEDERAIS_ANO_CORRIGIVEL.has(`${t}|${n}`)) { const achou = [...CONJ.keys()].find((x) => x.startsWith(`${t}|${n}|`)); if (achou) return { ano: anoDe(achou) }; }
  void k; return null;
}
/** Endereços oficiais já CONFERIDOS (campo "link" da fonte). Vazio de propósito: os códigos do Legisla Goiás passados à mão estavam errados (o 86608 é a Lei 10.158/1987, não a 11.651/1991); o coletor agora acha o código sozinho pela busca do Legisla. */
export const LINKS_CONHECIDOS: Record<string, string> = {};
export const linkConhecido = (tipo: string, numero: string, ano: number): string | undefined => LINKS_CONHECIDOS[`${String(tipo).toLowerCase()}|${num(numero)}|${Number(ano)}`];
