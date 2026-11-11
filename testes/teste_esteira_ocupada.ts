import { esteiraDeveIrParaSegundoPlano as f } from '../src/utils/esteiraOcupada';
const ok = (c: boolean, t: string) => { if (!c) { console.error('FALHOU:', t); process.exit(1); } console.log('ok:', t); };
ok(!f({ esteira: false, sinalOcupado: true, temResultadoNaTela: true, telaEhDaEsteira: false }), 'análise manual do usuário nunca vai para o segundo plano por esta regra');
ok(f({ esteira: true, sinalOcupado: true, temResultadoNaTela: true, telaEhDaEsteira: true }), 'esteira + chat/paradigma em uso: segundo plano (mesmo que a tela seja da esteira)');
ok(f({ esteira: true, sinalOcupado: false, temResultadoNaTela: true, telaEhDaEsteira: false }), 'esteira + minuta do usuário na tela (Histórico ou manual): segundo plano, a tela dele não é apagada');
ok(!f({ esteira: true, sinalOcupado: false, temResultadoNaTela: true, telaEhDaEsteira: true }), 'esteira + resultado da própria esteira na tela: segue como sempre (troca pelo próximo)');
ok(!f({ esteira: true, sinalOcupado: false, temResultadoNaTela: false, telaEhDaEsteira: false }), 'esteira + tela vazia: segue normalmente');
console.log('TUDO OK');
