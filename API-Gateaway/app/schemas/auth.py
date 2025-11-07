from pydantic import BaseModel
from typing import List, Optional


class IntrospectResponse(BaseModel):
    active: bool
    user_id: Optional[str] = None
    roles: List[str] = []
    exp: Optional[int] = None
