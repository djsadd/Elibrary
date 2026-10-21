from pydantic import BaseModel, Field

class IntrospectResponse(BaseModel):
    user_id: int | None = Field(None, gt=0)
    active: bool
    roles: list[str] = Field(default_factory=list)
