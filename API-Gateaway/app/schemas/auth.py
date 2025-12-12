from pydantic import BaseModel, field_validator


class IntrospectResponse(BaseModel):
    user_id: str
    active: bool
    roles: list[str] = []

    # Валидатор, который преобразует int в str
    @field_validator("user_id", mode="before")
    @classmethod
    def str_user_id(cls, v):
        return str(v)
