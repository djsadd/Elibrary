from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
import bcrypt

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        if hashed.startswith(("$2a$", "$2b$", "$2y$")):
            encoded = password.encode("utf-8")
            return len(encoded) <= 72 and bcrypt.checkpw(encoded, hashed.encode("ascii"))
        return _hasher.verify(hashed, password)
    except (InvalidHashError, VerificationError, ValueError, TypeError):
        return False
