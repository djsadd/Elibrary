from typing import Iterable


def clamp_limit(limit: int, min_v: int = 1, max_v: int = 100) -> int:
    return max(min_v, min(max_v, limit))


def clamp_offset(offset: int) -> int:
    return max(0, offset)
