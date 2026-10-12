from rag.crawler import crawl_website


def ingest_website(
    web_url: str,
    max_pages: int = 1000,
) -> list[dict[str, str]]:

    if not isinstance(web_url, str) or not web_url.strip():
        raise ValueError("A valid website URL is required.")

    if not isinstance(max_pages, int) or isinstance(max_pages, bool):
        raise ValueError("max_pages must be an integer.")

    if max_pages < 1:
        raise ValueError("max_pages must be at least 1.")

    pages = crawl_website(
        website_url=web_url.strip(),
        max_pages=max_pages,
    )

    documents: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for page in pages:
        url = page.get("url", "").strip()
        title = page.get("title", "").strip()
        content = page.get("content", "").strip()

        if not url or not content:
            continue

        if url in seen_urls:
            continue

        seen_urls.add(url)

        documents.append({
            "url": url,
            "title": title or "Untitled page",
            "content": content,
        })

    if not documents:
        raise ValueError(
            "No usable content was extracted from the website."
        )

    return documents