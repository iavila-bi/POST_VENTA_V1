/*
  Uso:
    node scripts/verify_password.js "admin123" "$2b$10$...."

  Verifica si un password calza con un bcrypt hash (bcryptjs).
*/

const bcrypt = require("bcryptjs");

const password = process.argv[2];
const hash = process.argv[3];

if (!password || !hash) {
    console.error('Uso: node scripts/verify_password.js "password" "hash"');
    process.exit(1);
}

bcrypt.compare(String(password), String(hash))
    .then(ok => {
        console.log(ok ? "MATCH" : "NO_MATCH");
    })
    .catch(err => {
        console.error("ERROR", err.message);
        process.exit(2);
    });

