import json
import os
import re
from pathlib import Path

import requests


# ---------- File paths ----------
BOOKS_FILE = Path("data/books.json")
CLUB_FILE = Path("data/club.json")


# ---------- Logging ----------
def notice(msg: str) -> str:
    print(f"::notice::{msg}")
    return msg


def warn(msg: str) -> str:
    print(f"::warning::{msg}")
    return msg


# ---------- String helpers ----------
def join_and(xs: list, oxford=True) -> str:
    if len(xs) <= 2:
        return " and ".join(xs)
    sep = ", and " if oxford else " and "
    return ", ".join(xs[:-1]) + sep + xs[-1]


def extract_field(body: str, field: str) -> str:
    """
    Extracts a field value from a GitHub issue body.

    Supports two formats:
    - Backtick inline:  `- field: \`value\``
    - Issue Forms:      `### field\\n\\nvalue`

    GitHub Forms emits "_No response_" for optional fields left blank — normalised to "".
    """
    pattern = rf"- {re.escape(field)}:\s*`([^`]*)`"
    match = re.search(pattern, body, re.IGNORECASE)
    if match:
        value = match.group(1).strip()
        return "" if re.fullmatch(r"_no response_", value, re.IGNORECASE) else value

    pattern = rf"^### {re.escape(field)}\s*\n\n(.*?)(?:\n\n###|\Z)"
    match = re.search(pattern, body, re.IGNORECASE | re.DOTALL | re.MULTILINE)
    if match:
        value = match.group(1).strip()
        return "" if re.fullmatch(r"_no response_", value, re.IGNORECASE) else value
    return ""


# ---------- Data I/O ----------
def load_books(books_file) -> dict:
    if not books_file.exists():
        return {}
    with books_file.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_club(club_file) -> dict:
    if not club_file.exists():
        return {}
    with club_file.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_books(books_file, books: dict) -> None:
    books_file.parent.mkdir(parents=True, exist_ok=True)
    with books_file.open("w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=4)


# ---------- GitHub Actions ----------
def load_issue() -> dict:
    event_path = Path(os.environ.get("GITHUB_EVENT_PATH", ""))
    if not event_path.exists():
        raise RuntimeError(
            "GITHUB_EVENT_PATH not found. Are you running in GitHub Actions?"
        )
    with event_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_issue_fields(body: str, *field_names: str) -> dict[str, str]:
    return {name: extract_field(body, name) for name in field_names}


def post_issue_comment(body: str) -> None:
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    event_path = os.environ.get("GITHUB_EVENT_PATH")

    if not all([token, repo, event_path]):
        print("Missing GitHub context — not posting comment.")
        return

    with open(event_path, "r", encoding="utf-8") as f:
        event = json.load(f)

    issue_number = event.get("issue", {}).get("number")
    if not issue_number:
        print("Could not determine issue number from event — skipping comment.")
        return

    url = f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    resp = requests.post(url, headers=headers, json={"body": body}, timeout=10)
    resp.raise_for_status()
    print("✔ Posted summary comment")


def post_summary(summary: str) -> None:
    post_issue_comment(summary)
    print(f"::notice::{summary}")


# ---------- Validation ----------
def validate_reviewer(
    *,
    book: dict,
    reviewer: str,
    participant_field: str,
) -> bool:
    participants = list(book[participant_field].keys())
    return reviewer in participants
