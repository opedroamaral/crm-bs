FROM atendai/evolution-api:latest

USER root

# Substitui o entrypoint padrão (que usa prisma migrate deploy) por um que usa
# prisma db push — funciona mesmo quando o banco já tem schema existente
RUN printf '#!/bin/sh\n\
set -e\n\
cd /evolution\n\
echo "[evolution] Sincronizando schema com prisma db push..."\n\
npx prisma db push --schema ./prisma/postgresql-schema.prisma --accept-data-loss\n\
echo "[evolution] Iniciando Evolution API..."\n\
exec node ./dist/main.js\n' > /start.sh && chmod +x /start.sh

ENTRYPOINT []
CMD ["/bin/sh", "/start.sh"]
