@echo off
title Menjalankan Sistem Akuntansi Kas Keluar
cd /d "%~dp0"
echo Memulai server backend dan frontend...
node app.js
pause