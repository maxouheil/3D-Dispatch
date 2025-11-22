#!/bin/bash

echo "🚀 Démarrage du serveur 3D Dispatch Tool..."
echo ""

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

echo "🌐 Lancement du serveur de développement..."
echo "📍 L'application sera accessible sur http://localhost:3000"
echo ""

npm run dev



