@echo off
echo 🚀 Démarrage du serveur 3D Dispatch Tool...
echo.

REM Vérifier si node_modules existe
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    call npm install
    echo.
)

echo 🌐 Lancement du serveur de développement...
echo 📍 L'application sera accessible sur http://localhost:3000
echo.

call npm run dev



