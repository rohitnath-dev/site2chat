from cryptography.fernet import Fernet, InvalidToken

from core.config import settings


class CredentialEncryptionError(RuntimeError):
    """Raised when credential encryption/decryption cannot be performed safely."""


def _fernet() -> Fernet:
    key = settings.OPENROUTER_KEY_ENCRYPTION_KEY
    if not key:
        raise CredentialEncryptionError(
            "Credential encryption is not configured."
        )
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise CredentialEncryptionError(
            "Credential encryption configuration is invalid."
        ) from exc


def encrypt_secret(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Credential must be a non-empty string.")
    try:
        return _fernet().encrypt(value.encode("utf-8")).decode("ascii")
    except CredentialEncryptionError:
        raise
    except (ValueError, UnicodeEncodeError) as exc:
        raise CredentialEncryptionError(
            "Credential could not be encrypted."
        ) from exc


def decrypt_secret(value: str) -> str:
    if not isinstance(value, str) or not value:
        raise CredentialEncryptionError("Stored credential is invalid.")
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except CredentialEncryptionError:
        raise
    except (InvalidToken, ValueError, UnicodeEncodeError) as exc:
        raise CredentialEncryptionError(
            "Stored credential could not be decrypted."
        ) from exc
