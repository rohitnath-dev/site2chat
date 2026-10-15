"""Token verification against a local fake Supabase JWKS endpoint (no network, no real keys)."""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt.algorithms import ECAlgorithm

from core import auth
from core.config import settings

KEY = ec.generate_private_key(ec.SECP256R1())
JWK = json.loads(ECAlgorithm.to_jwk(KEY.public_key()))
JWK.update(kid="k1", alg="ES256", use="sig")
state = {"mode": "ok", "hits": 0}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        state["hits"] += 1
        mode = state["mode"]
        if mode == "flaky" and state["hits"] == 1:
            mode = "404"
        if mode in ("ok", "flaky", "empty"):
            body = json.dumps({"keys": [JWK] if mode != "empty" else []}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture()
def server(monkeypatch):
    srv = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    monkeypatch.setattr(settings, "SUPABASE_URL", base)
    monkeypatch.setattr(auth, "_jwks_client", None)
    monkeypatch.setattr(auth, "JWKS_RETRY_DELAY_SECONDS", 0)
    state.update(mode="ok", hits=0)
    yield base
    srv.shutdown()


def make_token(base, **over):
    claims = {"sub": "user-1", "aud": "authenticated", "iss": base + "/auth/v1", "exp": int(time.time()) + 300}
    claims.update(over)
    return jwt.encode(claims, KEY, algorithm="ES256", headers={"kid": "k1"})


def verify(token):
    return auth.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))


def status_of(token):
    with pytest.raises(HTTPException) as info:
        verify(token)
    return info.value.status_code


def test_valid_token(server):
    assert verify(make_token(server))["sub"] == "user-1"


def test_transient_jwks_failure_is_retried(server):
    state["mode"] = "flaky"
    assert verify(make_token(server))["sub"] == "user-1"
    assert state["hits"] == 2


def test_persistent_jwks_failure_is_503(server):
    state["mode"] = "404"
    assert status_of(make_token(server)) == 503
    assert state["hits"] == auth.JWKS_FETCH_ATTEMPTS


def test_empty_jwks_is_401(server):
    state["mode"] = "empty"
    assert status_of(make_token(server)) == 401


@pytest.mark.parametrize(
    "over",
    [{"aud": "other"}, {"iss": "https://evil.example/auth/v1"}, {"exp": int(time.time()) - 10}],
)
def test_bad_claims_are_401(server, over):
    assert status_of(make_token(server, **over)) == 401


def test_unsigned_and_wrong_algorithm_rejected(server):
    unsigned = jwt.encode({"sub": "x"}, None, algorithm="none")
    assert status_of(unsigned) == 401
    hs = jwt.encode({"sub": "x", "aud": "authenticated"}, "secret" * 8, algorithm="HS256", headers={"kid": "k1"})
    assert status_of(hs) == 401


def test_missing_credentials_and_unset_url(server, monkeypatch):
    with pytest.raises(HTTPException) as info:
        auth.get_current_user(None)
    assert info.value.status_code == 401
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    assert status_of("a.b.c") == 503


def test_dns_failure_reports_host_and_errno(monkeypatch):
    import socket
    import urllib.error

    from core import jwks_check

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://no-such-project.supabase.co")
    exc = urllib.error.URLError(socket.gaierror(-2, "Name or service not known"))
    message = jwks_check.describe_connection_error(exc)
    assert "DNS lookup failed" in message
    assert "'no-such-project.supabase.co'" in message
    assert "errno=-2" in message
    assert "Name or service not known" in message
