#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length).decode('utf-8')
        sig = self.headers.get('X-RCRT-Signature')
        print(f"Webhook received: sig={sig} body={body}")
        self.send_response(200)
        self.end_headers()

def main():
    import os
    port = int(os.environ.get('PORT', '8081'))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'Webhook receiver listening on 0.0.0.0:{port}')
    server.serve_forever()

if __name__ == '__main__':
    main()


