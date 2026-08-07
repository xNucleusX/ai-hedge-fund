"""Local dev server for api/run.py.

`next dev` serves the frontend but does not run Python, so /api/run would
404 in local development. This runs the very same `handler` class Vercel
invokes in production, on port 5328; next.config.mjs rewrites /api/* to it
when NODE_ENV is development. Production is untouched — there Vercel routes
/api/run straight to the function and this file is never loaded.

    cd web/api && python3 dev_server.py     # terminal 1
    cd web && npm run dev                   # terminal 2

Port 5328 matches Vercel's own Next.js + Python example, so it won't
collide with anything Next uses.
"""

from __future__ import annotations

import os
from http.server import HTTPServer

from run import handler

PORT = int(os.environ.get("DEV_API_PORT", "5328"))

if __name__ == "__main__":
    print(f"api/run.py dev server -> http://127.0.0.1:{PORT}/api/run")
    HTTPServer(("127.0.0.1", PORT), handler).serve_forever()
