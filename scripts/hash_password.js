/*
  Uso:
    node scripts/hash_password.js "admin123"

  Imprime un hash bcrypt compatible (bcryptjs) para guardar en usuarios.password_hash.
*/

const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
    console.error('Uso: node scripts/hash_password.js "password"');
    process.exit(1);
}

const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
const hash = bcrypt.hashSync(String(password), rounds);
console.log(hash);

