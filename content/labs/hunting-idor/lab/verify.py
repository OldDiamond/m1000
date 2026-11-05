"""Verify Northline Billing over real loopback HTTP; never contact external hosts.

Evidence omits passwords, CSRF tokens and session values. Public demo
credentials below are used only to authenticate against the local fixture.
"""
from contextlib import contextmanager
from datetime import date, datetime, timezone
import hashlib
import http.client
import importlib.util
import json
from pathlib import Path
import platform
import re
import subprocess
import sys
from threading import Thread
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parent.parent
DEMO = {"alice":("alice@northline.test","AliceDemo!2026"),"bob":("bob@northline.test","BobDemo!2026")}
checks, page_checks, auth_checks, scope_checks, asset_checks, empty_checks, records = [], [], [], [], [], [], []


def request(port, method, path, cookie=None, form=None, extra=None):
    headers = dict(extra or {})
    if cookie:
        headers["Cookie"] = cookie
    payload = urlencode(form) if isinstance(form, dict) else form
    if payload is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    conn = http.client.HTTPConnection("127.0.0.1",port,timeout=8)
    try:
        conn.request(method,path,body=payload,headers=headers)
        response = conn.getresponse()
        body = response.read().decode("utf-8")
        return response.status,dict(response.getheaders()),body
    finally:
        conn.close()


def cookie_from(headers):
    return headers["Set-Cookie"].split(";",1)[0]


def csrf_from(body):
    match = re.search(r'name="csrf" value="([^\"]+)"',body)
    assert match, "Missing working form token"
    return match.group(1)


def public_login(port):
    status, headers, body = request(port,"GET","/login")
    assert status == 200 and '<form action="/login" method="post"' in body
    assert 'name="password" type="password"' in body
    assert "HttpOnly" in headers["Set-Cookie"] and "SameSite=Strict" in headers["Set-Cookie"]
    return cookie_from(headers),csrf_from(body)


def login(port, account):
    anonymous, csrf = public_login(port)
    email, password = DEMO[account]
    status, headers, _ = request(port,"POST","/login",anonymous,{"email":email,"password":password,"csrf":csrf}, {"Origin":f"http://127.0.0.1:{port}"})
    assert status == 303 and headers["Location"] == "/dashboard"
    cookie = cookie_from(headers)
    assert cookie != anonymous, "Session must rotate on authentication"
    assert request(port,"GET","/api/invoices",anonymous)[0] == 401
    return cookie


def passed(bucket, name, mode, **values):
    bucket.append({"mode":mode,"name":name,**values,"passed":True})


@contextmanager
def running(secure):
    proc = subprocess.Popen([sys.executable,str(ROOT/"lab/app.py"),"--port","0",*(["--secure"] if secure else [])],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        startup = proc.stdout.readline()
        match = re.search(r"127\.0\.0\.1:(\d+) secure=",startup)
        assert match, "Local server did not start"
        yield int(match.group(1))
    finally:
        if proc.poll() is None:
            proc.terminate()
        proc.communicate(timeout=8)


for secure in (False,True):
    mode = "fixed" if secure else "vulnerable"
    with running(secure) as port:
        assert request(port,"GET","/")[1]["Location"] == "/login"
        for path in ("/dashboard","/invoices","/invoices/101"):
            status, headers, _ = request(port,"GET",path)
            assert status == 303 and headers["Location"].startswith("/login?")
        passed(auth_checks,"protected pages require authentication",mode)
        assert request(port,"GET","/api/invoices")[0] == 401
        assert request(port,"GET","/guide")[0] == 200
        passed(auth_checks,"guide public, invoice data protected",mode)

        for asset, kind in (("app.css","text/css"),("app.js","text/javascript"),("northline-mark.svg","image/svg+xml")):
            status, headers, body = request(port,"GET","/assets/"+asset)
            assert status == 200 and headers["Content-Type"].startswith(kind) and body
            passed(asset_checks,asset,mode)
        assert request(port,"GET","/assets/../app.py")[0] == 404
        assert request(port,"GET","/",extra={"Host":"untrusted.example"})[0] == 400
        passed(auth_checks,"asset allowlist and host validation",mode)

        anonymous, csrf = public_login(port)
        for name, form, expected in (
            ("empty form rejected",{"email":"","password":"","csrf":csrf},400),
            ("wrong password rejected",{"email":DEMO["alice"][0],"password":"not-the-demo-password","csrf":csrf},401),
            ("unknown email rejected",{"email":"unknown@northline.test","password":"not-the-demo-password","csrf":csrf},401),
            ("old account selector rejected",{"account":"alice","csrf":csrf},400),
            ("missing CSRF rejected",{"email":DEMO["alice"][0],"password":DEMO["alice"][1]},403),
            ("malformed CSRF rejected",{"email":DEMO["alice"][0],"password":DEMO["alice"][1],"csrf":"invalid-\u00e9"},403),
        ):
            status, _, body = request(port,"POST","/login",anonymous,form)
            assert status == expected
            assert DEMO["alice"][1] not in body
            assert request(port,"GET","/api/invoices",anonymous)[0] == 401
            passed(auth_checks,name,mode)
        assert request(port,"POST","/login",anonymous,{"email":DEMO["alice"][0],"password":DEMO["alice"][1],"csrf":csrf},{"Origin":"http://untrusted.example"})[0] == 403
        passed(auth_checks,"cross-origin login rejected",mode)

        cookies = {account:login(port,account) for account in DEMO}
        passed(auth_checks,"hashed fixture credentials and session rotation",mode)
        for account, cookie in cookies.items():
            own, other, amount = (101,102,12500) if account == "alice" else (102,101,48000)
            for path in ("/dashboard","/invoices"):
                status, _, body = request(port,"GET",path,cookie)
                assert status == 200 and f'INV-{own}' in body and f'/invoices/{other}' not in body and f'INV-{other}' not in body
                assert f'Signed in as {account.title()}' in body
                if path == "/dashboard":
                    assert 'data-stat="invoice-count" data-value="1"' in body
                    assert f'data-stat="outstanding" data-value="{amount}"' in body
                passed(scope_checks,path,mode,principal=account,invoice=own)
            for path in ("/api/invoices","/api/invoices?owner_id="+("bob" if account=="alice" else "alice")):
                status, _, body = request(port,"GET",path,cookie)
                assert status == 200
                rows = json.loads(body)["invoices"]
                assert [row["id"] for row in rows] == [own]
                assert all(row["owner_id"]==account for row in rows)
                passed(scope_checks,path,mode,principal=account,invoice=own)

        cases = [("alice","101",200),("alice","102",404 if secure else 200),("bob","102",200),("bob","101",404 if secure else 200),(None,"102",401),("alice","999",404),("alice","abc",400),("invalid","102",401)]
        for account, invoice, expected in cases:
            cookie = "sid=invalid" if account=="invalid" else cookies.get(account)
            path = f"/api/invoices/{invoice}"
            status, headers, body = request(port,"GET",path,cookie)
            assert status == expected, "Unexpected invoice authorization result"
            parsed = json.loads(body)
            if status == 200:
                assert str(parsed["id"]) == invoice
                assert parsed["owner_id"] == ("alice" if invoice=="101" else "bob")
                assert parsed["total_cents"] == {"101":12500,"102":48000}[invoice]
                assert parsed["invoice_number"] == "INV-"+invoice
                assert parsed["from"]["name"] == "Northline Demo Services"
                assert parsed["bill_to"]["email"] == parsed["owner_id"]+"@northline.test"
                assert (date.fromisoformat(parsed["due_date"])-date.fromisoformat(parsed["issue_date"])).days==14
                assert parsed["payment_status"] == "Unpaid"
                for item in parsed["line_items"]:
                    assert isinstance(item["quantity"],int) and item["quantity"]>0
                    assert item["quantity"]*item["unit_price_cents"]==item["amount_cents"]
                assert sum(item["amount_cents"] for item in parsed["line_items"])==parsed["subtotal_cents"]==parsed["total_cents"]
            else:
                assert set(parsed)=={"error"}
            assert headers["Cache-Control"]=="no-store" and int(headers["Content-Length"])==len(body.encode())
            safe_headers={key:value for key,value in headers.items() if key not in ("Date","Server")}
            records.append({"mode":mode,"principal":account,"request":f"GET {path} HTTP/1.1\nHost: 127.0.0.1:{port}"+(f"\nCookie: sid=<{'invalid' if account=='invalid' else str(account)+'-session'}>" if cookie else ""),"status":status,"response_headers":safe_headers,"body":body})
            checks.append({"mode":mode,"principal":account,"invoice":invoice,"status":status,"passed":True})

        if secure:
            assert request(port,"GET","/api/invoices/102",cookies["alice"])[2]==request(port,"GET","/api/invoices/999",cookies["alice"])[2]
        for account, invoice in (("alice","101"),("alice","102"),("bob","102"),(None,"101")):
            for trailing in (False,True):
                path=f"/invoices/{invoice}"+("/" if trailing else "")
                status, _, body=request(port,"GET",path,cookies.get(account))
                expected=303 if account is None else 404 if secure and account=="alice" and invoice=="102" else 200
                assert status==expected
                if account:
                    assert f'data-invoice-id="{invoice}"' in body and f'Signed in as {account.title()}' in body
                    assert '<header class="application-header">' in body and 'Northline Billing' in body
                    assert 'aria-label="Main navigation"' in body and 'aria-label="Breadcrumb"' in body
                    assert 'data-mode="'+('corrected' if secure else 'vulnerable')+'"' in body
                    assert '<details class="technical-details">' in body
                    assert '<summary>Technical details</summary>' in body
                    assert f'GET /api/invoices/{invoice}' in body
                    assert "Alice Demo" not in body and "Bob Demo" not in body
                    assert "alice@northline.test" not in body or account=="alice"
                    assert "bob@northline.test" not in body or account=="bob"
                page_checks.append({"mode":mode,"principal":account,"invoice":invoice,"path":path,"status":status,"passed":True})

        for account, cookie in cookies.items():
            assert request(port,"GET","/logout",cookie)[0]==405
            assert request(port,"POST","/logout",cookie,{"csrf":"invalid"})[0]==403
            assert request(port,"GET","/api/invoices",cookie)[0]==200
            body=request(port,"GET","/dashboard",cookie)[2]
            status, headers, _=request(port,"POST","/logout",cookie,{"csrf":csrf_from(body)})
            assert status==303 and headers["Location"]=="/login" and "Max-Age=0" in headers["Set-Cookie"]
            assert request(port,"GET","/api/invoices",cookie)[0]==401
            assert request(port,"GET","/dashboard",cookie)[0]==303
            passed(auth_checks,"logout invalidates session; GET and CSRF bypasses rejected",mode,principal=account)

# Exercise real empty states without adding a reset/seed HTTP endpoint or CLI bypass.
spec=importlib.util.spec_from_file_location("northline_empty_fixture",ROOT/"lab/app.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for secure in (False,True):
    mode="fixed" if secure else "vulnerable"
    server=module.create_server(0,secure,seed_invoices=False)
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        port=server.server_port;cookie=login(port,"alice")
        assert json.loads(request(port,"GET","/api/invoices",cookie)[2])["invoices"]==[]
        for path in ("/dashboard","/invoices"):
            status, _, body=request(port,"GET",path,cookie)
            assert status==200 and "No invoices yet" in body
            if path=="/dashboard":
                assert 'data-stat="invoice-count" data-value="0"' in body and 'data-stat="outstanding" data-value="0"' in body
            passed(empty_checks,path,mode)
        assert request(port,"GET","/api/invoices/101",cookie)[0]==404
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)

evidence=ROOT/"evidence";evidence.mkdir(exist_ok=True)
sources=["lab/app.py","lab/assets/app.css","lab/assets/app.js","lab/assets/northline-mark.svg"]
source_hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources}
report={"tested_at_utc":datetime.now(timezone.utc).isoformat(),"python":sys.version,"operating_system":platform.platform(),"transport":"Python http.client over loopback TCP; Burp Suite was not used","normalization":"Credentials, CSRF tokens and session values omitted or redacted; dynamic Date/Server response headers omitted.","app_sha256":source_hashes["lab/app.py"],"source_hashes":source_hashes,"checks":checks,"page_checks":page_checks,"auth_checks":auth_checks,"scope_checks":scope_checks,"asset_checks":asset_checks,"empty_checks":empty_checks,"exchanges":records}
(evidence/"http-evidence.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(f"PASS: {len(checks)} invoice API cases, {len(page_checks)} detail-page checks, {len(auth_checks)} authentication checks, {len(scope_checks)} scope checks, {len(asset_checks)} asset checks, {len(empty_checks)} empty-state checks; sessions and credentials redacted.")
