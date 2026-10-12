import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urldefrag
from pathlib import Path
from collections import deque
import time

BASE_URL = "https://www.lakshacare.com/"
OUTPUT_FILE = Path("data.txt")

MAX_PAGES = 40
REQUEST_TIMEOUT = 20
DELAY = 0.5

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 10; Mobile) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,"
        "application/xml;q=0.9,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

DOMAIN = urlparse(BASE_URL).netloc

visited = set()
pages = []
queue = deque([BASE_URL])


def normalize_url(url):
    url, _ = urldefrag(url)
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        return None

    if parsed.netloc.lower() != DOMAIN.lower():
        return None

    if parsed.path.lower().endswith(
        (".pdf", ".jpg", ".jpeg", ".png", ".gif",
         ".webp", ".svg", ".zip", ".mp4", ".mp3")
    ):
        return None

    return url


def extract_text(soup):
    for tag in soup([
        "script", "style", "noscript", "svg",
        "iframe", "nav", "footer"
    ]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.body

    if main:
        return main.get_text("\n", strip=True)

    return soup.get_text("\n", strip=True)


def crawl_page(url, session):
    try:
        response = session.get(
            url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True
        )

        print("Status:", response.status_code, "|", url)

        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")

        if "text/html" not in content_type.lower():
            print("Skipped non-HTML page:", url)
            return

        final_url = normalize_url(response.url)

        if not final_url:
            return

        soup = BeautifulSoup(response.text, "html.parser")

        title = (
            soup.title.get_text(" ", strip=True)
            if soup.title else url
        )

        text = extract_text(soup)

        if len(text.strip()) >= 50:
            pages.append(
                f"SOURCE: {final_url}\n"
                f"TITLE: {title}\n\n"
                f"{text}"
            )
            print("Extracted:", title)

        for link in soup.find_all("a", href=True):
            next_url = normalize_url(
                urljoin(final_url, link["href"])
            )

            if next_url and next_url not in visited:
                queue.append(next_url)

    except requests.RequestException as error:
        print("Request failed:", url)
        print(error)

    except Exception as error:
        print("Extraction failed:", url)
        print(error)


def main():
    session = requests.Session()
    session.headers.update(HEADERS)

    while queue and len(visited) < MAX_PAGES:
        url = queue.popleft()

        if url in visited:
            continue

        visited.add(url)

        print(f"\n[{len(visited)}/{MAX_PAGES}] Fetching page")

        crawl_page(url, session)

        time.sleep(DELAY)

    if not pages:
        print("\nNo pages were extracted.")
        print("The existing data.txt has not been modified.")
        print("Check the website response or use browser-based extraction.")
        return

    output = "\n\n" + ("=" * 60) + "\n\n"
    output = output.join(pages)

    OUTPUT_FILE.write_text(output, encoding="utf-8")

    print("\nExtraction completed.")
    print("Pages visited:", len(visited))
    print("Pages extracted:", len(pages))
    print("Output:", OUTPUT_FILE.resolve())
    print("Characters:", len(output))


if __name__ == "__main__":
    main()