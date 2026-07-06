"""JWT authentication for admin dashboard."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24

security = HTTPBearer(auto_error=False)


def _hash(pw: str) -> bytes:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt())


# Load users from env at startup, hash their passwords in memory
_USERS = {
    os.environ["ADMIN_USERNAME"]: {
        "username": os.environ["ADMIN_USERNAME"],
        "password_hash": _hash(os.environ["ADMIN_PASSWORD"]),
        "role": "owner",
    },
    os.environ["STAFF_USERNAME"]: {
        "username": os.environ["STAFF_USERNAME"],
        "password_hash": _hash(os.environ["STAFF_PASSWORD"]),
        "role": "staff",
    },
}


def verify_credentials(username: str, password: str) -> Optional[dict]:
    user = _USERS.get(username)
    if not user:
        return None
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return None
    return {"username": user["username"], "role": user["role"]}


def create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    return {"username": payload["sub"], "role": payload["role"]}


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return user


def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
