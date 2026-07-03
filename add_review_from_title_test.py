from add_review import get_book_id_from_title


def test_get_book_id_from_title_exact_match():
    books = {
        "OL32433964W": {
            "meta": {
                "title": "Pantopia"
            }
        }
    }

    book_id, found = get_book_id_from_title(books, "Pantopia")

    assert found is True
    assert book_id == "OL32433964W"

def test_get_book_id_from_title_not_found():
    books = {
        "OL32433964W": {
            "meta": {
                "title": "Pantopia"
            }
        }
    }

    book_id, found = get_book_id_from_title(books, "Completely Different Book")

    assert found is False
    assert book_id is None


def test_get_book_id_from_title_fuzzy_match():
    books = {
        "OL32433964W": {
            "meta": {
                "title": "Pantopia"
            }
        }
    }

    book_id, found = get_book_id_from_title(books, "Pantopa")  # missing "i"

    assert found is True
    assert book_id == "OL32433964W"