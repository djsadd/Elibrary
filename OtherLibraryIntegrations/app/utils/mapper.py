def map_books(ext_books):
    return [
        {
            "title": b.get("name"),
            "author": b.get("writer"),
            "isbn": b.get("code")
        }
        for b in ext_books
    ]
