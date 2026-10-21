import json
import time
from redis.exceptions import WatchError
from app.core.redis import r

def update_challenge(key, transform):
    """Apply a challenge transition with optimistic locking and preserve its expiry."""
    for _ in range(8):
        with r.pipeline() as pipe:
            try:
                pipe.watch(key)
                raw = pipe.get(key)
                if not raw:
                    raise ValueError("Challenge not found")
                state = json.loads(raw)
                remaining = int(state.get("exp", 0)) - int(time.time())
                if remaining <= 0:
                    raise ValueError("Challenge expired")
                result, error, consume = transform(state)
                pipe.multi()
                if consume:
                    pipe.delete(key)
                else:
                    pipe.setex(key, remaining, json.dumps(state, ensure_ascii=False))
                pipe.execute()
                if error:
                    raise error
                return result
            except WatchError:
                continue
    raise ValueError("Challenge changed; retry the request")
