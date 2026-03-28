@echo off
title Serveur Minecraft + Panel

echo Lancement du panel...

:: Lancer le node qui lui va lancer le serveur
start cmd /k node server.js

:: Attendre  1 peu
timeout /t 3 > nul

echo Ouverture du panel web...

:: lancer localhost!:3000 dans le nav

start http://localhost:3000

echo Serveur pret !

pause
