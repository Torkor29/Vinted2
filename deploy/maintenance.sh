#!/bin/bash
# =============================================================
# COMMANDES DE MAINTENANCE UTILES
# A lancer depuis /opt/vinted-bot/ sur ton VPS
# =============================================================

case "$1" in
    logs)
        echo "Affichage des logs backend (Ctrl+C pour quitter)..."
        docker compose logs -f backend
        ;;
    logs-all)
        echo "Affichage de tous les logs (Ctrl+C pour quitter)..."
        docker compose logs -f
        ;;
    restart)
        echo "Redemarrage de tous les services..."
        docker compose restart
        echo "OK"
        ;;
    restart-backend)
        echo "Redemarrage du backend..."
        docker compose restart backend
        echo "OK"
        ;;
    status)
        echo "Statut des services :"
        docker compose ps
        echo ""
        echo "Utilisation memoire :"
        docker stats --no-stream
        ;;
    update)
        echo "Mise a jour du projet..."
        git pull
        docker compose up -d --build
        echo "Mise a jour terminee."
        ;;
    backup-db)
        echo "Sauvegarde de la base de donnees..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        docker compose exec db pg_dump -U vinted vintedbot > "backup_${TIMESTAMP}.sql"
        echo "Sauvegarde creee : backup_${TIMESTAMP}.sql"
        ;;
    restore-db)
        if [ -z "$2" ]; then
            echo "Usage : ./maintenance.sh restore-db backup_XXXXXX.sql"
            exit 1
        fi
        echo "Restauration de la base depuis $2..."
        cat "$2" | docker compose exec -T db psql -U vinted vintedbot
        echo "Restauration terminee."
        ;;
    ssl-renew)
        echo "Renouvellement du certificat SSL..."
        docker compose stop nginx
        certbot renew --quiet
        docker compose start nginx
        echo "SSL renouvele."
        ;;
    clean)
        echo "Nettoyage Docker (images/volumes inutilises)..."
        docker system prune -f
        echo "Nettoyage termine."
        ;;
    *)
        echo "Usage : ./maintenance.sh <commande>"
        echo ""
        echo "Commandes disponibles :"
        echo "  logs            - Voir les logs du backend"
        echo "  logs-all        - Voir tous les logs"
        echo "  restart         - Redemarrer tous les services"
        echo "  restart-backend - Redemarrer uniquement le backend"
        echo "  status          - Voir le statut et la memoire"
        echo "  update          - Mettre a jour (git pull + rebuild)"
        echo "  backup-db       - Sauvegarder la base PostgreSQL"
        echo "  restore-db      - Restaurer une sauvegarde"
        echo "  ssl-renew       - Renouveler le certificat SSL"
        echo "  clean           - Nettoyer les images Docker inutilisees"
        ;;
esac
