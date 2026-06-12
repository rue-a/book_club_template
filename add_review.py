from issue_ingestion import (
    BOOKS_FILE,
    extract_issue_fields,
    load_books,
    load_issue,
    post_summary,
    save_books,
    validate_book,
    validate_reviewer,
)


def build_summary(
    *,
    book_id: str,
    reviewer: str,
    review: str,
    warnings: list[str],
    notices: list[str],
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

    if notices:
        lines.append("### Notes")
        lines.append("\n> [!NOTE]\n>")

        for notice in notices:
            lines.append(f"> - {notice}")

    return "\n".join(lines)


def parse_issue():
    """
    Parse GitHub issue payload and add a review.
    Extracts book_id, reviewer, and review text from issue.
    """
    warnings = []
    notices = []

    event = load_issue()
    body = event.get("issue", {}).get("body", "")

    fields = extract_issue_fields(body, "book id", "reviewer", "review")
    book_id = fields["book id"]
    reviewer = fields["reviewer"]
    review = fields["review"]

    books = load_books(BOOKS_FILE)
    book, failed = validate_book(
        books=books,
        book_id=book_id,
        warnings=warnings,
    )

    if book:
        failed = (
            validate_reviewer(
                book=book,
                reviewer=reviewer,
                participant_field="reviews",
                warnings=warnings,
            )
            or failed
        )

    success = not failed

    summary = build_summary(
        book_id=book_id,
        reviewer=reviewer,
        review=review,
        warnings=warnings,
        notices=notices,
        success=success,
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
