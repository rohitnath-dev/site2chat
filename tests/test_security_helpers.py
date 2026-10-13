import pytest
from cryptography.fernet import Fernet

from core import secret_store
from core.config import settings
from rag import crawler


def test_secret_round_trip(monkeypatch):
    secret = "sk-or-v1-example-credential-12345"
    monkeypatch.setattr(settings, "OPENROUTER_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())

    encrypted = secret_store.encrypt_secret(secret)
    assert encrypted != secret
    assert secret_store.decrypt_secret(encrypted) == secret


def test_secret_store_rejects_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_KEY_ENCRYPTION_KEY", "")
    with pytest.raises(secret_store.CredentialEncryptionError):
        secret_store.encrypt_secret("some-valid-looking-key")


def test_secret_store_rejects_whitespace_only(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    with pytest.raises(ValueError):
        secret_store.encrypt_secret("   ")


def _fake_addr(ip, port):
    import socket
    return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (ip, port))]


def test_crawler_rejects_private_ip(monkeypatch):
    monkeypatch.setattr(crawler.socket, "getaddrinfo", lambda host, port, type: _fake_addr("10.0.0.5", port))
    with pytest.raises(ValueError, match="non-public"):
        crawler.validate_website_url("https://example.com")


def test_crawler_accepts_public_ip(monkeypatch):
    monkeypatch.setattr(crawler.socket, "getaddrinfo", lambda host, port, type: _fake_addr("93.184.216.34", port))
    assert crawler.validate_website_url("https://example.com/path#section") == "https://example.com/path"


def test_crawler_rejects_non_default_port(monkeypatch):
    with pytest.raises(ValueError, match="default HTTP or HTTPS port"):
        crawler.validate_website_url("https://example.com:8080")
