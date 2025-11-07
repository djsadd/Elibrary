# app/utils/security.py
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str: return pwd.hash(p)
def verify_password(p: str, hp: str) -> bool: return pwd.verify(p, hp)
