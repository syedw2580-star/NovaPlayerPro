import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 4173
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for high-performance streaming
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean custom logging
        pass

def main():
    if not os.path.exists(DIRECTORY):
        print(f"[Error] 'dist' directory not found at: {DIRECTORY}")
        print("Please run 'npm run build' first.")
        sys.exit(1)

    # Allow socket address reuse immediately
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            url = f"http://localhost:{PORT}/"
            print("=" * 60)
            print(f"🎬 NOVA PLAYER PRO — LOCALHOST STREAMING SERVER")
            print("=" * 60)
            print(f"➜ Server running at: {url}")
            print(f"➜ Serving bundle:   {DIRECTORY}")
            print(f"➜ YouTube & Live Streams are fully enabled!")
            print("=" * 60)
            print("Press Ctrl + C to stop the server.\n")

            # Open in default web browser automatically
            webbrowser.open(url)

            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Shutting down] Server stopped gracefully.")
        sys.exit(0)
    except OSError as e:
        if "Address already in use" in str(e) or e.errno == 10048:
            print(f"[Notice] Port {PORT} is already in use. Opening existing server at: http://localhost:{PORT}/")
            webbrowser.open(f"http://localhost:{PORT}/")
        else:
            print(f"[Error] Could not start server on port {PORT}: {e}")

if __name__ == '__main__':
    main()
