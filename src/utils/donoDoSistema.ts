// Informações sobre o banco de dados (nome do banco, servidor, tabelas, selo "MySQL · Hostinger") só aparecem para o super administrador dono do sistema.
export const EMAIL_DONO = "fabriciocunha.adv@gmail.com";
export const ehDonoDoSistema = (perfil: any): boolean => !!perfil?.superAdmin && String(perfil?.email || "").toLowerCase().trim() === EMAIL_DONO;
