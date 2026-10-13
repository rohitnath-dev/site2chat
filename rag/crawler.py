
from collections import deque
from ipaddress import ip_address
from urllib.parse import urljoin, urldefrag, urlparse
import socket
import time

import requests
from bs4 import BeautifulSoup


DEFAULT_MAX_PAGES = 1000
DEFAULT_TIMEOUT = 15
DEFAULT_DELAY = 0.5

MAX_RUNTIME_SECONDS = 3600
MAX_TOTAL_CONTENT_CHARS = 10_000_000
MAX_RESPONSE_BYTES = 5_000_000

HEADERS = {
    "User-Agent": "Site2ChatBot/1.0 (website content indexing)"
}

SKIP_EXTENSIONS = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".svg", ".zip", ".mp4", ".mp3", ".css", ".js",
    ".ico", ".woff", ".woff2", ".ttf",
)


def _validate_public_target(hostname: str, port: int) -> None:
    """Reject hostnames that currently resolve to any non-public address.

    This is a defense-in-depth preflight, not a substitute for outbound network
    egress controls: DNS can change between this lookup and the HTTP connection.
    Production deployment should also block private/link-local/metadata ranges
    at the network layer.
    """
    hostname = hostname.rstrip(".").lower()
    if not hostname or hostname == "localhost" or hostname.endswith(
        (".localhost", ".local", ".internal")
    ):
        raise ValueError("Local and internal hostnames are not allowed.")

    try:
        addresses = socket.getaddrinfo(
            hostname, port, type=socket.SOCK_STREAM
        )
    except (socket.gaierror, OSError) as exc:
        raise ValueError("Website hostname could not be resolved.") from exc

    if not addresses:
        raise ValueError("Website hostname did not resolve to an address.")

    for address in addresses:
        try:
            ip = ip_address(address[4][0].split("%", 1)[0])
        except ValueError as exc:
            raise ValueError("Website hostname resolved to an invalid address.") from exc
        if not ip.is_global:
            raise ValueError("Private or non-public IP addresses are not allowed.")


def validate_website_url(url: str) -> str:
    """Validate a public HTTP(S) website URL."""
    if not isinstance(url, str) or not url.strip():
        raise ValueError("Website URL is required.")

    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only HTTP and HTTPS URLs are allowed.")
    if not parsed.hostname:
        raise ValueError("A valid hostname is required.")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed.")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise ValueError("Website URL contains an invalid port.") from exc
    expected_port = 443 if parsed.scheme == "https" else 80
    if port != expected_port:
        raise ValueError("Only the default HTTP or HTTPS port is allowed.")

    _validate_public_target(parsed.hostname, port)
    return urldefrag(url).url


def normalize_url(url: str, allowed_domain: str) -> str | None:
    """Accept supported HTTP(S) URLs from the original hostname."""
    url, _ = urldefrag(url)
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None

    if parsed.hostname.lower() != allowed_domain.lower():
        return None

    if parsed.username or parsed.password:
        return None

    try:
        port = parsed.port
    except ValueError:
        return None
    expected_port = 443 if parsed.scheme == "https" else 80
    if port not in (None, expected_port):
        return None

    if parsed.path.lower().endswith(SKIP_EXTENSIONS):
        return None

    return url


def extract_text(html: str) -> tuple[str, str, BeautifulSoup]:
    """Extract title, readable text, and parsed HTML."""
    soup = BeautifulSoup(html, "html.parser")

    title = (
        soup.title.get_text(" ", strip=True)
        if soup.title
        else "Untitled page"
    )

    for tag in soup([
        "script", "style", "noscript", "svg",
        "iframe", "nav", "footer", "header",
    ]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.body

    text = (
        main.get_text("\n", strip=True)
        if main
        else soup.get_text("\n", strip=True)
    )

    return title, text, soup


def crawl_website(
    website_url: str,
    max_pages: int | None = DEFAULT_MAX_PAGES,
    timeout: int = DEFAULT_TIMEOUT,
    delay: float = DEFAULT_DELAY,
    max_runtime: int = MAX_RUNTIME_SECONDS,
) -> list[dict[str, str]]:
    """
    Crawl a public website.

    max_pages=None means no fixed page-count limit.
    Crawling still stops at the runtime or content safety limit.

    Returns a list of dictionaries containing url, title and content.
    """
    if max_pages is not None and (
        not isinstance(max_pages, int)
        or isinstance(max_pages, bool)
        or max_pages < 1
    ):
        raise ValueError("max_pages must be a positive integer or None.")

    if not 1 <= timeout <= 60:
        raise ValueError("timeout must be between 1 and 60 seconds.")

    if not 0 <= delay <= 10:
        raise ValueError("delay must be between 0 and 10 seconds.")

    if max_runtime < 1:
        raise ValueError("max_runtime must be positive.")

    start_url = validate_website_url(website_url)
    parsed_start = urlparse(start_url)
    domain = parsed_start.hostname

    queue = deque([start_url])
    queued = {start_url}
    visited = set()
    pages = []
    total_chars = 0
    started_at = time.monotonic()

    with requests.Session() as session:
        # Do not allow ambient proxy configuration to bypass the target checks.
        session.trust_env = False
        session.headers.update(HEADERS)

        while queue:
            if max_pages is not None and len(visited) >= max_pages:
                break

            if time.monotonic() - started_at >= max_runtime:
                print("Stopped: maximum runtime reached.")
                break

            if total_chars >= MAX_TOTAL_CONTENT_CHARS:
                print("Stopped: maximum content limit reached.")
                break

            url = queue.popleft()

            if url in visited:
                continue

            visited.add(url)

            try:
                # Repeat the public-IP preflight immediately before every fetch,
                # including same-host links and redirects. Network-level egress
                # filtering is still needed to close DNS-rebinding race windows.
                parsed_target = urlparse(url)
                target_port = parsed_target.port or (
                    443 if parsed_target.scheme == "https" else 80
                )
                _validate_public_target(parsed_target.hostname or "", target_port)
                with session.get(
                    url,
                    timeout=timeout,
                    allow_redirects=False,
                    stream=True,
                ) as response:
                    if response.is_redirect:
                        location = response.headers.get("Location")

                        if location:
                            redirect_url = urljoin(url, location)
                            normalized = normalize_url(
                                redirect_url, domain
                            )

                            if normalized and normalized not in queued:
                                queue.append(normalized)
                                queued.add(normalized)

                        continue

                    response.raise_for_status()

                    content_type = response.headers.get(
                        "Content-Type", ""
                    ).lower()

                    if "text/html" not in content_type:
                        continue

                    content_length = response.headers.get("Content-Length")

                    if content_length:
                        try:
                            if int(content_length) > MAX_RESPONSE_BYTES:
                                print("Skipped oversized page:", url)
                                continue
                        except ValueError:
                            pass

                    body = bytearray()

                    for chunk in response.iter_content(chunk_size=65536):
                        if time.monotonic() - started_at >= max_runtime:
                            print("Stopped: maximum runtime reached.")
                            break

                        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                            print("Skipped oversized page:", url)
                            body.clear()
                            break

                        body.extend(chunk)

                    if not body:
                        continue

                    encoding = response.encoding or "utf-8"
                    html = bytes(body).decode(encoding, errors="replace")
                    final_url = normalize_url(response.url, domain)

                    if not final_url:
                        continue

                    title, content, soup = extract_text(html)

                    if len(content.strip()) >= 50:
                        remaining = (
                            MAX_TOTAL_CONTENT_CHARS - total_chars
                        )
                        content = content[:remaining]

                        pages.append({
                            "url": final_url,
                            "title": title,
                            "content": content,
                        })

                        total_chars += len(content)

                    for link in soup.find_all("a", href=True):
                        candidate = urljoin(final_url, link["href"])
                        normalized = normalize_url(candidate, domain)

                        if normalized and normalized not in queued:
                            queue.append(normalized)
                            queued.add(normalized)

                    print(
                        f"Visited {len(visited)} pages | "
                        f"Extracted {len(pages)} | {final_url}"
                    )

            except requests.RequestException as exc:
                print(f"Could not fetch {url}: {exc}")

            except (ValueError, OSError) as exc:
                print(f"Could not process {url}: {exc}")

            if queue and delay:
                time.sleep(delay)

    print(
        f"Crawl finished. Visited: {len(visited)}, "
        f"extracted: {len(pages)}, characters: {total_chars}"
    )

    return pages