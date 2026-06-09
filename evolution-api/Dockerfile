FROM atendai/evolution-api:latest

USER root

# 1. Cria o schema no banco usando db push (não precisa de banco vazio)
# 2. Prepara o diretório de migrations igual ao entrypoint original
# 3. Marca TODAS as migrations como aplicadas para que migrate deploy não tente re-executá-las
# 4. Inicia o servidor
RUN printf '#!/bin/sh\n\
set -e\n\
cd /evolution\n\
\n\
echo "[evolution] Aplicando schema com db push..."\n\
npx prisma db push --schema ./prisma/postgresql-schema.prisma --accept-data-loss\n\
\n\
echo "[evolution] Preparando migrations..."\n\
rm -rf ./prisma/migrations\n\
cp -r ./prisma/postgresql-migrations ./prisma/migrations\n\
\n\
echo "[evolution] Marcando migrations como aplicadas..."\n\
for dir in ./prisma/migrations/*/; do\n\
  name=$(basename "$dir")\n\
  npx prisma migrate resolve --applied "$name" --schema ./prisma/postgresql-schema.prisma 2>/dev/null || true\n\
done\n\
\n\
echo "[evolution] Iniciando servidor..."\n\
exec node ./dist/main.js\n' > /start.sh && chmod +x /start.sh

ENTRYPOINT []
CMD ["/bin/sh", "/start.sh"]
