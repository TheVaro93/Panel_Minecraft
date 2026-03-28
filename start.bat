@echo off
title Serveur Minecraft + Panel

echo Lancement du panel...

:: Installer les dependances si node_modules est absent
if not exist node_modules (
	echo Installation des dependances...
	call npm install
)

:: Lancer le backend via le script npm
start cmd /k npm run start

:: Attendre  1 peu
timeout /t 3 > nul

echo Ouverture du panel web...

:: lancer localhost!:3000 dans le nav

start http://localhost:3000

echo Serveur pret !

pause
