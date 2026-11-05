"""Northline Billing: a loopback-only, deliberately vulnerable training app.

Python 3.12+, standard library and bundled assets only. Never deploy or tunnel.
The intentional defect is authenticated cross-account invoice-detail access;
--secure applies the owner-only policy to both HTML and JSON detail routes.
"""
import argparse
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import sys
import time
from html import escape
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import RLock
from urllib.parse import parse_qs, urlencode, urlsplit

if sys.version_info < (3, 12):
    raise SystemExit("Northline Billing requires Python 3.12 or newer.")

ASSETS = Path(__file__).resolve().parent / "assets"
PASSWORD_ITERATIONS = 310000
SESSION_LIFETIME = 8 * 60 * 60
# Authentication uses salted PBKDF2 digests, not the guide's plaintext demo values.
USERS = {
    "alice": {"id":"alice", "name":"Alice", "email":"alice@northline.test",
              "salt":"951f66a3dcb5722e7e795076292511aa",
              "password_hash":"799f5b3f2fb149ef4f04ff64aa33c970acb79d97e9c5da37dd8427bb1dc2dd4d"},
    "bob": {"id":"bob", "name":"Bob", "email":"bob@northline.test",
            "salt":"c7e72533a8a2f46ddb310a2b4c224480",
            "password_hash":"2577fd77783ccc4ed9dfad5c374f0e25c83fe55dbbbd88b1bc187f0ac55a7b3b"},
}


def billing_fixture(invoice_id, email, address, items):
    line_items = [dict(description=description, quantity=quantity,
                       unit_price_cents=unit, amount_cents=quantity * unit)
                  for description, quantity, unit in items]
    return {
        "invoice_number": f"INV-{invoice_id}", "issue_date":"2026-11-01",
        "due_date":"2026-11-15", "payment_status":"Unpaid",
        "from":{"name":"Northline Demo Services", "description":"Design & advisory",
                "address":["18 Example Lane", "Demo City, DC 10001"],
                "email":"billing@northline.test"},
        "bill_to":{"address":[address, "Demo City, DC 10011"], "email":email},
        "line_items":line_items,
        "subtotal_cents":sum(item["amount_cents"] for item in line_items),
        "payment_terms":"Net 14 days from the issue date. Please quote the invoice number in any correspondence.",
    }


INVOICE_DETAILS = {
    101:billing_fixture(101, "alice@northline.test", "101 Sample Street",
                        [("Design consultation", 1, 7500), ("Project preparation", 1, 5000)]),
    102:billing_fixture(102, "bob@northline.test", "102 Sample Street",
                        [("Brand workshop", 2, 15000), ("Research & planning", 3, 6000)]),
}


def e(value):
    return escape(str(value), quote=True)


def money(cents):
    return f"USD {cents // 100:,}.{cents % 100:02d}"


def safe_next(value):
    return value if re.fullmatch(r"/(?:dashboard|invoices(?:/[0-9]{1,9})?|guide)", value or "") else "/dashboard"


def verify_password(email, password):
    user = next((user for user in USERS.values() if user["email"] == email), None)
    fixture = user or USERS["alice"]  # Unknown emails take the same hash work.
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(fixture["salt"]), PASSWORD_ITERATIONS).hex()
    matches = hmac.compare_digest(digest, fixture["password_hash"])
    return user if matches and user is not None else None


def brand():
    return '<a class="brand" href="/"><img src="/assets/northline-mark.svg" width="36" height="36" alt=""><span><strong>Northline Billing</strong><small>Client Billing Portal</small></span></a>'


def document(title, body, body_class=""):
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>'+e(title)+' · Northline Billing</title>'
            '<link rel="icon" type="image/svg+xml" href="/assets/northline-mark.svg">'
            '<link rel="stylesheet" href="/assets/app.css">'
            '<script src="/assets/app.js" defer></script></head><body class="'+e(body_class)+'">'+body+'</body></html>')


def shell(title, content, user, csrf, active="", description="", *, secure=False):
    navigation = ''.join('<a href="'+path+'"'+(' aria-current="page"' if key == active else '')+'>'+label+'</a>'
                         for path, key, label in (("/dashboard","dashboard","Dashboard"),("/invoices","invoices","Invoices"),("/guide","guide","Lab Guide")))
    identity = ('<div class="identity"><span class="avatar" aria-hidden="true">'+e(user["name"][0])+'</span>'
                '<div><p class="account">Signed in as '+e(user["name"])+'</p><small>'+e(user["email"])+'</small></div></div>'
                '<form action="/logout" method="post"><input type="hidden" name="csrf" value="'+e(csrf)+'">'
                '<button class="button button-quiet" type="submit">Sign out</button></form>') if user else '<a class="button button-quiet" href="/login">Sign in</a>'
    mode = "Corrected" if secure else "Vulnerable"
    body = ('<div class="app-layout"><aside class="app-sidebar"><div class="sidebar-identity">'
            '<img src="/assets/northline-mark.svg" width="34" height="34" alt=""><span>Client workspace</span></div><p class="sidebar-label">Workspace</p>'
            '<nav id="app-navigation" aria-label="Main navigation">'+navigation+'</nav><p class="sidebar-note">Local training application<br>Fictional billing data</p></aside>'
            '<div class="app-main"><header class="application-header">'+brand()+'<button class="button button-quiet mobile-menu-toggle" type="button" aria-controls="app-navigation" aria-expanded="false" hidden>Menu<span aria-hidden="true">☰</span></button><div class="session-controls">'+identity+'</div></header>'
            '<main class="workspace"><div class="workspace-content"><header class="workspace-header"><div>'
            '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/dashboard">Workspace</a><span aria-hidden="true">/</span>'
            +('<a href="/invoices">Invoices</a><span aria-hidden="true">/</span>' if title == "Invoice details" else '')+'<span>'+e(title)+'</span></nav>'
            '<h1 class="page-title">'+e(title)+'</h1>'
            +('<p class="page-description">'+e(description)+'</p>' if description else '')+'</div>'
            '<span class="training-mode" data-mode="'+mode.lower()+'">Training · '+mode+'</span></header>'
            +content+'<footer class="app-footer">Training application by m1000z · Fictional data</footer></div></main></div></div>')
    return document(title, body, "billing-app")


def login_page(csrf, next_path="/dashboard", error="", email=""):
    body = ('<main class="auth-layout"><section class="auth-intro">'+brand()+'<div class="auth-message">'
            '<p class="auth-eyebrow">Client Billing Portal</p><h1>Your billing,<br>in one place.</h1>'
            '<p>A straightforward workspace for invoices, balances and account activity.</p></div>'
            '<p class="auth-credit">Training application by m1000z · Fictional data</p></section>'
            '<section class="auth-form-panel"><div class="auth-form-inner"><p class="overline">Northline Billing</p>'
            '<h2>Welcome back</h2><p class="form-intro">Sign in to view your invoices.</p>'
            +('<div class="form-error" id="login-error" role="alert">'+e(error)+'</div>' if error else '')+
            '<form action="/login" method="post" class="login-form"><input type="hidden" name="csrf" value="'+e(csrf)+'">'
            '<input type="hidden" name="next" value="'+e(safe_next(next_path))+'">'
            '<label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254" value="'+e(email)+'"'+(' aria-invalid="true" aria-describedby="login-error"' if error else '')+' placeholder="you@example.test">'
            '<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"'+(' aria-invalid="true" aria-describedby="login-error"' if error else '')+'>'
            '<button class="button button-primary" type="submit">Sign in</button></form>'
            '<p class="login-help">Using the local demo? <a href="/guide">Lab Guide &amp; demo accounts</a></p>'
            '<p class="login-local">Runs on this computer. All customer and billing data is fictional.</p>'
            '</div></section></main>')
    return document("Sign in", body, "login-page")


def invoice_table(rows):
    if not rows:
        return '<div class="empty-state"><h2>No invoices yet</h2><p>Invoices issued to your account will appear here.</p><a href="/dashboard">Back to dashboard</a></div>'
    body = ''.join('<tr><td><a class="invoice-link" href="/invoices/'+str(row["id"])+'">'+e(row["invoice_number"])+'</a></td>'
                   '<td>'+e(row["issue_date"])+'</td><td>'+e(row["due_date"])+'</td><td><span class="status-pill">'+e(row["payment_status"])+'</span></td>'
                   '<td class="numeric">'+money(row["total_cents"])+'</td><td class="numeric"><a class="table-action" href="/invoices/'+str(row["id"])+'">View invoice<span class="sr-only"> '+e(row["invoice_number"])+'</span></a></td></tr>' for row in rows)
    return '<div class="list-scroll" tabindex="0" role="region" aria-label="Your invoices"><table class="billing-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Due date</th><th>Status</th><th class="numeric">Amount</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>'+body+'</tbody></table></div>'


def dashboard(rows, user):
    unpaid = [row for row in rows if row["payment_status"] != "Paid"]
    outstanding = sum(row["total_cents"] for row in unpaid)
    stats = (("Invoices",str(len(rows)),"invoice-count",len(rows)),("Outstanding balance",money(outstanding),"outstanding",outstanding),("Paid invoices",str(len(rows)-len(unpaid)),"paid-count",len(rows)-len(unpaid)))
    cards = ''.join('<div class="stat-card"><p>'+label+'</p><strong data-stat="'+key+'" data-value="'+str(value)+'">'+text+'</strong></div>' for label, text, key, value in stats)
    return '<section class="welcome-strip"><h2>Welcome back, '+e(user["name"])+'.</h2><p>Here is the latest activity for your account.</p></section><section class="stats-grid" aria-label="Account summary">'+cards+'</section><section class="panel"><div class="panel-heading"><div><h2>Recent invoices</h2><p>Your latest billing documents.</p></div><a href="/invoices">View all invoices</a></div>'+invoice_table(rows[:5])+'</section>'


def guide_content(secure):
    mode = "Corrected" if secure else "Vulnerable"
    return '''<div class="guide-content"><section class="guide-intro"><span class="guide-badge">Local training</span><h2>Explore Northline Billing</h2><p>Act as two fictional customers and investigate whether invoice access follows the declared owner-only policy. Test only this local application.</p><p class="guide-mode">Current mode: <strong>'''+mode+'''</strong></p></section>
<section class="guide-section"><h2>1. Demo accounts and scenario</h2><p>Alice owns invoice 101 for USD 125.00. Bob owns invoice 102 for USD 480.00. A customer may read only invoices whose owner matches their authenticated server-side identity.</p>
<div class="list-scroll"><table class="billing-table"><thead><tr><th>Customer</th><th>Email</th><th>Demo password</th></tr></thead><tbody><tr><td>Alice</td><td>alice@northline.test</td><td><code>AliceDemo!2026</code></td></tr><tr><td>Bob</td><td>bob@northline.test</td><td><code>BobDemo!2026</code></td></tr></tbody></table></div><p>These public training credentials are for this local fixture only. Authentication checks salted PBKDF2 password hashes and creates random server-managed sessions.</p></section>
<section class="guide-section"><h2>2. Explore legitimate workflows</h2><ol><li>Sign in as Alice. Check the dashboard, the invoice list and invoice 101.</li><li>Sign out, then sign in as Bob in a separate browser session. Confirm Bob's list contains only invoice 102.</li><li>Record which account owns each invoice. Dashboards, lists and balances must stay account-scoped in both modes.</li></ol></section>
<section class="guide-section"><h2>3. Inspect requests with Burp</h2><p>Use Burp's browser for the local app. Sign in as Alice, open invoice 101, and locate <code>GET /api/invoices/101</code> in Proxy → HTTP history. Send the request to Repeater, then send it unchanged to establish the baseline.</p><p><a href="https://portswigger.net/burp/documentation/desktop/tools/repeater/http-messages" target="_blank" rel="noopener noreferrer">Official Burp Repeater instructions</a>. Use <code>127.0.0.1</code> consistently; do not switch hostnames between login and testing. Redact cookies and credentials from any shared captures.</p></section>
<section class="guide-section"><h2>4. Investigation objective</h2><p>Determine whether one signed-in customer can retrieve another customer's invoice by changing an object reference. Keep the caller's session constant and compare the returned customer, invoice number and amount against known ownership. A successful status alone is not proof.</p>
<details><summary>Hint 1: where to start</summary><p>Begin with the invoice-detail request the application already makes, not a guessed external target.</p></details><details><summary>Hint 2: use both accounts</summary><p>Use Bob's legitimate workflow to learn a valid second invoice reference, then return to Alice's saved session.</p></details><details><summary>Hint 3: check the whole boundary</summary><p>Compare the HTML detail URL and the JSON API. The signed-in account indicator must remain independent of the invoice customer.</p></details></section>
<section class="guide-section"><h2>5. Solution and explanation</h2><details class="solution"><summary>Reveal the solution</summary><p>In vulnerable mode, Alice can change <code>/api/invoices/101</code> to <code>/api/invoices/102</code> while retaining Alice's session. The API returns Bob's private fixture. The invoice page at <code>/invoices/102</code> displays the same disclosure.</p><p>The vulnerable lookup searches by invoice ID alone. Corrected mode scopes the lookup by both invoice ID and the user resolved from the server-side session:</p><pre><code>SELECT * FROM invoices WHERE id = ? AND owner_id = ?</code></pre><p>Both the HTML and JSON detail routes use that access decision. Billing metadata is added only after the lookup succeeds. Dashboards and lists always use an owner-scoped query. Restart in corrected mode and confirm legitimate reads still work while both cross-account detail paths deny access.</p></details></section>
<section class="guide-section"><h2>6. Stop, reset and verify</h2><p>Stop the running server with Ctrl+C. Restarting resets the in-memory database and invalidates all sessions. Stop the first server before starting corrected mode on the same port, then sign in again.</p><h3>Windows PowerShell</h3><pre><code>py -3 lab/app.py --secure --port 8000</code></pre><h3>Linux terminal</h3><pre><code>python3 lab/app.py --secure --port 8000</code></pre><p>After stopping the server, or in a separate terminal, run verification:</p><h3>Windows PowerShell</h3><pre><code>py -3 lab/verify.py</code></pre><h3>Linux terminal</h3><pre><code>python3 lab/verify.py</code></pre><p>Run commands from the extracted folder containing README.md and lab/. The verifier starts its own loopback processes on temporary ports and checks login, logout, account scoping, the disclosure, corrected denial and empty states. It writes redacted evidence under evidence/.</p></section></div>'''


def create_server(port=8000, secure=False, *, seed_invoices=True):
    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.row_factory = sqlite3.Row
    db_lock, session_lock = RLock(), RLock()
    db.executescript("CREATE TABLE invoices (id INTEGER PRIMARY KEY, owner_id TEXT NOT NULL, customer TEXT NOT NULL, total_cents INTEGER NOT NULL, currency TEXT NOT NULL);")
    if seed_invoices:
        db.executemany("INSERT INTO invoices VALUES (?, ?, ?, ?, ?)", [(101,"alice","Alice Demo",12500,"USD"),(102,"bob","Bob Demo",48000,"USD")])
        for invoice_id, details in INVOICE_DETAILS.items():
            assert details["subtotal_cents"] == db.execute("SELECT total_cents FROM invoices WHERE id = ?",(invoice_id,)).fetchone()[0]
    sessions = {}

    def session_create(user_id=None):
        sid = secrets.token_urlsafe(32)
        session = {"user_id":user_id,"csrf":secrets.token_urlsafe(24),"created":time.monotonic()}
        with session_lock:
            sessions[sid] = session
        return sid, session

    def lookup(invoice_id, owner_id):
        with db_lock:
            if secure:
                return db.execute("SELECT * FROM invoices WHERE id = ? AND owner_id = ?", (invoice_id,owner_id)).fetchone()
            return db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()

    def owned_invoices(owner_id):
        with db_lock:
            rows = db.execute("SELECT * FROM invoices WHERE owner_id = ? ORDER BY id DESC", (owner_id,)).fetchall()
        return [{**dict(row),"invoice_number":INVOICE_DETAILS[row["id"]]["invoice_number"],"issue_date":INVOICE_DETAILS[row["id"]]["issue_date"],"due_date":INVOICE_DETAILS[row["id"]]["due_date"],"payment_status":INVOICE_DETAILS[row["id"]]["payment_status"]} for row in rows]

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            pass

        def respond(self, status, body, content_type="application/json", extra=()):
            if content_type == "application/json":
                body = json.dumps(body, separators=(",", ":"))
            payload = body if isinstance(body, bytes) else body.encode("utf-8")
            self.send_response(status)
            for key, value in (("Content-Type",content_type),("Content-Length",str(len(payload))),("Cache-Control","no-store"),("X-Content-Type-Options","nosniff"),("Referrer-Policy","same-origin"),("X-Frame-Options","DENY"),("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"),*extra):
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(payload)

        def html(self, status, body, extra=()):
            self.respond(status, body, "text/html; charset=utf-8", extra)

        def redirect(self, path, extra=()):
            self.respond(303, "", "text/plain; charset=utf-8", (("Location",path),*extra))

        def valid_host(self):
            host = self.headers.get("Host", "").lower()
            if host not in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"):
                self.close_connection = True
                self.respond(400, {"error":"invalid_host"})
                return False
            return True

        def current_session(self):
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
            except Exception:
                return None, None
            sid = cookie.get("sid")
            sid = sid.value if sid else None
            with session_lock:
                now = time.monotonic()
                for expired in [key for key, value in sessions.items() if now-value["created"] > SESSION_LIFETIME]:
                    sessions.pop(expired, None)
                return sid, sessions.get(sid)

        def cookie(self, sid):
            return ("Set-Cookie", f"sid={sid}; HttpOnly; SameSite=Strict; Path=/")

        def require_user(self, api=False):
            sid, session = self.current_session()
            if session and session["user_id"] in USERS:
                return USERS[session["user_id"]], session
            if api:
                self.respond(401, {"error":"authentication_required"})
            else:
                self.redirect("/login?"+urlencode({"next":safe_next(urlsplit(self.path).path.rstrip("/"))}))
            return None, None

        def do_GET(self):
            if not self.valid_host():
                return
            url = urlsplit(self.path)
            path = url.path.rstrip("/") or "/"
            if path.startswith("/assets/"):
                assets = {"/assets/app.css":("app.css","text/css; charset=utf-8"),"/assets/app.js":("app.js","text/javascript; charset=utf-8"),"/assets/northline-mark.svg":("northline-mark.svg","image/svg+xml")}
                if path not in assets:
                    self.respond(404, {"error":"not_found"}); return
                name, kind = assets[path]
                self.respond(200, (ASSETS/name).read_bytes(), kind); return
            sid, session = self.current_session()
            user = USERS.get(session["user_id"]) if session else None
            if path == "/":
                self.redirect("/dashboard" if user else "/login"); return
            if path == "/login":
                if user:
                    self.redirect("/dashboard"); return
                extra = ()
                if not session:
                    sid, session = session_create(); extra = (self.cookie(sid),)
                next_path = safe_next(parse_qs(url.query).get("next",["/dashboard"])[0])
                self.html(200, login_page(session["csrf"], next_path), extra); return
            if path == "/guide":
                self.html(200, shell("Lab Guide",guide_content(secure),user,session["csrf"] if session else "","guide","A guided exercise in object-level access control.",secure=secure)); return
            if path == "/logout":
                self.respond(405, {"error":"post_required"}, extra=(("Allow","POST"),)); return
            if path.startswith("/api/invoices/") and not re.fullmatch(r"/api/invoices/[0-9]{1,9}",path):
                user, _ = self.require_user(api=True)
                if user:
                    self.respond(400,{"error":"invalid_id"})
                return
            if path in ("/dashboard", "/invoices", "/api/invoices") or re.fullmatch(r"/(?:api/)?invoices/[0-9]{1,9}", path):
                user, session = self.require_user(api=path.startswith("/api/"))
                if not user:
                    return
                if path == "/dashboard":
                    self.html(200,shell("Dashboard",dashboard(owned_invoices(user["id"]),user),user,session["csrf"],"dashboard","Your account, at a glance.",secure=secure)); return
                if path == "/invoices":
                    self.html(200,shell("Invoices",'<section class="panel">'+invoice_table(owned_invoices(user["id"]))+'</section>',user,session["csrf"],"invoices","View the billing documents issued to your account.",secure=secure)); return
                if path == "/api/invoices":
                    self.respond(200,{"invoices":owned_invoices(user["id"])}); return
                invoice_id = int(path.rsplit("/",1)[1])
                invoice = lookup(invoice_id, user["id"])
                if path.startswith("/api/"):
                    if invoice is None:
                        self.respond(404,{"error":"not_found"}); return
                    payload = dict(invoice)
                    payload.update(INVOICE_DETAILS[invoice_id])
                    self.respond(200,payload); return
                initial = '<div class="empty-document"><h2>Invoice unavailable</h2><p>Not found or access denied.</p><a href="/invoices">Back to invoices</a></div>' if invoice is None else '<div class="empty-document"><h2>Loading invoice…</h2><p>Please wait while your billing document is retrieved.</p></div>'
                content = ('<section id="invoice-state" data-invoice-detail data-invoice-id="'+str(invoice_id)+'" aria-live="polite" aria-label="Invoice document">'+initial+'</section>'
                           '<details class="technical-details"><summary>Technical details</summary><dl><div><dt>Request</dt><dd><code>GET /api/invoices/'+str(invoice_id)+'</code></dd></div>'
                           '<div><dt>API result</dt><dd id="api-status" role="status">Retrieving invoice</dd></div></dl><p>Session cookies and credentials are not shown.</p></details>')
                self.html(404 if invoice is None else 200,shell("Invoice details",content,user,session["csrf"],"invoices",secure=secure)); return
            if path.startswith("/api/"):
                self.respond(404,{"error":"not_found"}); return
            content = '<div class="empty-state"><h2>Page not found</h2><p>The page you requested is not available.</p><a href="/dashboard">Go to dashboard</a></div>'
            self.html(404,shell("Page not found",content,user,session["csrf"] if session else "",secure=secure))

        def do_POST(self):
            if not self.valid_host():
                return
            try:
                length = int(self.headers.get("Content-Length","0"))
                if not 0 < length <= 4096:
                    raise ValueError()
                raw = self.rfile.read(length).decode("utf-8")
                if self.headers.get("Content-Type", "").split(";",1)[0] != "application/x-www-form-urlencoded":
                    raise ValueError()
                form = {key:values[0] for key, values in parse_qs(raw,keep_blank_values=True,max_num_fields=12).items()}
            except (ValueError, UnicodeError):
                self.close_connection = True
                self.respond(400,{"error":"invalid_form"}); return
            origin = self.headers.get("Origin")
            allowed = {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}
            sid, session = self.current_session()
            if (origin is not None and origin not in allowed) or not session or not hmac.compare_digest(form.get("csrf","").encode(),session["csrf"].encode()):
                self.html(403,document("Request not verified",'<main class="standalone-message">'+brand()+'<h1>Request not verified</h1><p>Reload the page and try again.</p><a href="/login">Return to sign in</a></main>')); return
            path = urlsplit(self.path).path.rstrip("/")
            if path == "/login":
                email, password = form.get("email","").strip().casefold(), form.get("password","")
                next_path = safe_next(form.get("next","/dashboard"))
                if len(email)>254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email) or not 1 <= len(password) <=128:
                    self.html(400,login_page(session["csrf"],next_path,"Enter a valid email address and password.",email)); return
                user = verify_password(email,password)
                if not user:
                    self.html(401,login_page(session["csrf"],next_path,"Email or password is incorrect.",email)); return
                with session_lock:
                    sessions.pop(sid,None)
                new_sid, _ = session_create(user["id"])
                self.redirect(next_path,(self.cookie(new_sid),)); return
            if path == "/logout":
                with session_lock:
                    sessions.pop(sid,None)
                self.redirect("/login",(("Set-Cookie","sid=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/"),)); return
            self.respond(404,{"error":"not_found"})

    server = ThreadingHTTPServer(("127.0.0.1",port),Handler)
    server.timeout = 1
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port",type=int,default=8000)
    parser.add_argument("--secure",action="store_true")
    args = parser.parse_args()
    server = create_server(args.port,args.secure)
    print(f"Northline Billing: http://127.0.0.1:{server.server_port} secure={args.secure}",flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
