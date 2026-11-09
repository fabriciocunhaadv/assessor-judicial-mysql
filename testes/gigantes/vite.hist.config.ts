// Igual ao vite.config.ts dos testes, mas com o AuthContext falso (para testar o Histórico isolado).
import base from './vite.config';
import path from 'path';
export default { ...base, resolve: { alias: [{ find: /^(\.\.?\/)+(lib\/)?firebase(\.ts)?$/, replacement: path.resolve(__dirname, '_stubs/firebase_falso.ts') }, { find: /^(\.\.?\/)+lib\/AuthContext(\.tsx)?$/, replacement: path.resolve(__dirname, '_stubs/authcontext.tsx') }, ...(base as any).resolve.alias] } };
