from issue_ingestion import (
    BOOKS_FILE,
    extract_issue_fields,
    load_books,
    load_issue,
    post_summary,
    save_books,
    validate_reviewer,
    warn,
)


def build_review_summary(
    *,
    book_id: str,
    reviewer: str,
    review: str,
    warnings: list[str],
    success: bool,
) -> str:
    lines = ["# SUMMARY"]
    lines.append("✅ **Review saved**" if success else "❌ **Review not saved**")
    lines.append(f"book id: {book_id}")
    lines.append(f"reviewer: {reviewer}")
    lines.append(f"review: {review}")

    if warnings:
        lines.append("### Warnings")
        lines.append("\n> [!WARNING]\n>")

        for warning in warnings:
            lines.append(f"> - {warning}")

    return "\n".join(lines)

def get_book_id_from_title(books, title: str) -> str:
    from rapidfuzz import process, fuzz
    # Map titles to book IDs
    title_to_id = {
        data.get("meta", {}).get("title", ""): book_id
        for book_id, data in books.items()
    }

    if not title_to_id:
        return None

    match = process.extractOne(
        title,
        title_to_id.keys(),
        scorer=fuzz.WRatio
    )

    if match is None:
        return None

    matched_title, score, _ = match

    if score < 85: # 85 is a somewhat arbitrary threshold
        return None

    return title_to_id[matched_title]

def parse_issue():
    """
    Parse GitHub issue payload and add a review.
    Extracts book_id, reviewer, and review text from issue.
    """
    warnings = []
    success = True

    event = load_issue()
    body = event.get("issue", {}).get("body", "")

    books = load_books(BOOKS_FILE)

    fields = extract_issue_fields(body, "book title", "reviewer", "review")
    title = fields["book title"]
    reviewer = fields["reviewer"]
    review = fields["review"]


    book_id = get_book_id_from_title(books, title)
    if not book_id:
        warnings.append(warn(f"Book not found for title: {title}. Aborted."))
        success = False
    

    book = books.get(book_id)
    if not book:
        warnings.append(warn(f"Book id '{book_id}' not found! Aborted."))
        success = False
    
    if book:
        if not validate_reviewer(
                book=book,
                reviewer=reviewer,
                participant_field="reviews",
            ):
                warnings.append(warn(f"Reviewer '{reviewer}' was no participant. Aborted."))
                success = False


    summary = build_review_summary(
        book_id=book_id,
        reviewer=reviewer,
        review=review,
        warnings=warnings,
        success=True,
    )
    post_summary(summary)

    if not success:
        return False
    
    book["reviews"][reviewer] = review
    save_books(BOOKS_FILE, books)

    return True


if __name__ == "__main__":
    title_added = parse_issue()
    # Exit code 1 if nothing was added (optional)
    exit(0 if title_added else 1)
