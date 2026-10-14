"""Lanceur de Béhourd pour les testeurs (compilé en Behourd.exe avec PyInstaller).

Il sert les fichiers du jeu (inclus dans l'exécutable) sur http://127.0.0.1:<port>/
— accessible depuis cet ordinateur uniquement — puis ouvre le navigateur par défaut.
Fermer la fenêtre arrête le jeu.

Le port est fixe (8642) : les sauvegardes du jeu sont liées à l'adresse
(stockage du navigateur), elles sont donc retrouvées à chaque lancement.
Variable d'environnement BEHOURD_PORT : autre port (tests).
"""

import functools
import http.server
import os
import sys
import threading
import urllib.request
import webbrowser

DEFAULT_PORT = 8642
GAME_MARKER = "Béhourd"


def game_root():
    """Dossier des fichiers du jeu : décompressés par PyInstaller, sinon la racine du dépôt."""
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "game")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class GameHandler(http.server.SimpleHTTPRequestHandler):
    # Types explicites : sous Windows, le registre peut annoncer .js en text/plain,
    # ce que les navigateurs refusent pour les modules JavaScript.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
        ".png": "image/png",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        # Toujours la version de l'exécutable, jamais une ancienne copie en cache.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        pass


def already_running(url):
    """Vrai si Béhourd tourne déjà à cette adresse (second double-clic)."""
    try:
        with urllib.request.urlopen(url + "index.html", timeout=1) as response:
            return GAME_MARKER in response.read().decode("utf-8", "replace")
    except Exception:
        return False


def main():
    port = int(os.environ.get("BEHOURD_PORT", DEFAULT_PORT))
    url = f"http://127.0.0.1:{port}/"
    handler = functools.partial(GameHandler, directory=game_root())
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        if already_running(url):
            print("Béhourd est déjà lancé : ouverture du navigateur.")
            webbrowser.open(url)
            return
        print(f"Le port {port} est déjà utilisé par un autre programme.")
        input("Fermez ce programme puis relancez Béhourd. (Entrée pour quitter) ")
        return

    print("=" * 60)
    print("  Béhourd — version de test")
    print(f"  Le jeu s'ouvre dans votre navigateur : {url}")
    print("  Gardez cette fenêtre ouverte pendant la partie ;")
    print("  fermez-la pour quitter le jeu.")
    print("=" * 60)
    if not os.environ.get("BEHOURD_NO_BROWSER"):
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
