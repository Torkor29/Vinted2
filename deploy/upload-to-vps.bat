@echo off
REM =============================================
REM  Envoyer le projet sur ton VPS depuis Windows
REM =============================================
REM  Usage : Double-clique ce fichier ou lance-le dans un terminal
REM  Prerequis : avoir OpenSSH (inclus dans Windows 10/11)

set /p VPS_IP="Adresse IP de ton VPS : "
set /p VPS_USER="Utilisateur SSH (defaut: root) : "
if "%VPS_USER%"=="" set VPS_USER=root

echo.
echo Envoi des fichiers vers %VPS_USER%@%VPS_IP%:/opt/vinted-bot/ ...
echo.

REM Creer le dossier sur le VPS
ssh %VPS_USER%@%VPS_IP% "mkdir -p /opt/vinted-bot"

REM Envoyer tout le projet (sauf node_modules et dist)
scp -r "%~dp0..\backend" %VPS_USER%@%VPS_IP%:/opt/vinted-bot/
scp -r "%~dp0..\webapp" %VPS_USER%@%VPS_IP%:/opt/vinted-bot/
scp -r "%~dp0..\nginx" %VPS_USER%@%VPS_IP%:/opt/vinted-bot/
scp "%~dp0..\docker-compose.yml" %VPS_USER%@%VPS_IP%:/opt/vinted-bot/
scp "%~dp0..\.env.example" %VPS_USER%@%VPS_IP%:/opt/vinted-bot/

echo.
echo =============================================
echo  Fichiers envoyes !
echo.
echo  Maintenant connecte-toi au VPS :
echo    ssh %VPS_USER%@%VPS_IP%
echo.
echo  Puis lance le script d'installation :
echo    cd /opt/vinted-bot
echo    bash deploy/setup-vps.sh
echo =============================================
pause
