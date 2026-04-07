import hashlib
import os


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Return (hashed, salt). Generates a random salt if none provided."""
    if salt is None:
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return hashed, salt


def verify_password(password: str, stored: str) -> bool:
    """Verify a plaintext password against a stored 'salt:hash' string."""
    try:
        salt, expected_hash = stored.split(":", 1)
    except ValueError:
        return False
    actual_hash, _ = hash_password(password, salt)
    return actual_hash == expected_hash