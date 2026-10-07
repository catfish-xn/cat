#!/usr/bin/env python3
"""Acquire exact CommunityDragon 14.24 bytes; do not verify gameplay numbers.

Python 3 standard library only. Run on a POSIX GitHub Actions runner:
    python3 scripts/fetch-cdragon-14.24.py --root .

Both locales must download and validate before this program changes any output.
Transient failures retry the same fixed URL at most five times total. No mirrors,
newer patches, locale substitutions, or git operations are performed. HTTP
redirects are deliberately rejected. Gzip has a zero timestamp
and no filename, so the same input produces the same output in a given zlib
implementation.

Artifact overflow requires CDRAGON_ARTIFACT_NAME, GITHUB_RUN_ID, and
CDRAGON_RUN_URL (or standard GITHUB_SERVER_URL/GITHUB_REPOSITORY variables).
The workflow must upload artifacts/cdragon-14.24 with retention-days: 30 and
commit the repository manifest only after that upload succeeds.
"""

import argparse
import contextlib
import datetime
import errno
import gzip
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request


LOCALES = ("en_us", "zh_cn")
URL_TEMPLATE = "https://raw.communitydragon.org/14.24/cdragon/tft/{locale}.json"
BASE_PATH = Path("src/simulation/content/source/s13-14.24b")
MANIFEST_PATH = BASE_PATH / "provenance/download-manifest.json"
ARTIFACT_PATH = Path("artifacts/cdragon-14.24")
MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 240
MAX_DOWNLOAD_ATTEMPTS = 5
RETRY_DELAYS_SECONDS = (15, 30, 60, 120)
MAX_COMPRESSED_FILE_BYTES = 20 * 1024 * 1024
MAX_COMPRESSED_TOTAL_BYTES = 40 * 1024 * 1024
ARTIFACT_RETENTION_DAYS = 30
CHUNK_BYTES = 64 * 1024


class AcquisitionError(RuntimeError):
    """An acquisition failed; no substitute source may be used."""


class AcquisitionTimeoutError(AcquisitionError):
    """A total download deadline expired; the same source may be retried."""


class AcquisitionHTTPError(AcquisitionError):
    """An HTTP response status, retained for the retry policy."""

    def __init__(self, url, code):
        self.code = code
        super().__init__("Expected HTTP 200 for %s, got %s" % (url, code))


class _RejectRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AcquisitionError("Redirect refused for fixed source: " + req.full_url)


@contextlib.contextmanager
def _hard_deadline(seconds):
    """Interrupt even a slow-drip response after a total wall-clock deadline."""
    if not hasattr(signal, "setitimer") or threading.current_thread() is not threading.main_thread():
        raise AcquisitionError("Strict download deadlines require a POSIX main thread")
    if signal.getitimer(signal.ITIMER_REAL) != (0.0, 0.0):
        raise AcquisitionError("An existing process alarm prevents a strict download deadline")

    def timed_out(signum, frame):
        raise AcquisitionTimeoutError("Download exceeded total deadline of %s seconds" % seconds)

    previous = signal.signal(signal.SIGALRM, timed_out)
    try:
        signal.setitimer(signal.ITIMER_REAL, seconds)
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def download(url):
    """Read exact response bytes, bounded by time and uncompressed byte count."""
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "cdragon-14.24-acquisition/1.0",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        },
    )
    opener = urllib.request.build_opener(_RejectRedirects())
    with _hard_deadline(DOWNLOAD_TIMEOUT_SECONDS):
        with opener.open(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise AcquisitionHTTPError(url, response.status)
            if response.geturl() != url:
                raise AcquisitionError("Response URL did not match the fixed source: " + url)
            encoding = response.headers.get("Content-Encoding", "identity").lower().strip()
            if encoding not in ("", "identity"):
                raise AcquisitionError("Unexpected HTTP content encoding: " + encoding)
            content_length = response.headers.get("Content-Length")
            if content_length is not None:
                try:
                    declared_size = int(content_length)
                except ValueError as exc:
                    raise AcquisitionError("Invalid HTTP Content-Length") from exc
                if declared_size < 0 or declared_size > MAX_DOWNLOAD_BYTES:
                    raise AcquisitionError("HTTP Content-Length exceeds the download ceiling")
            chunks = []
            size = 0
            while True:
                chunk = response.read(min(CHUNK_BYTES, MAX_DOWNLOAD_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_DOWNLOAD_BYTES:
                    raise AcquisitionError("Download exceeds the %s-byte ceiling" % MAX_DOWNLOAD_BYTES)
                chunks.append(chunk)
            if content_length is not None and size != declared_size:
                raise AcquisitionError("Downloaded size does not match HTTP Content-Length")
            return b"".join(chunks)


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _reject_json_constant(value):
    raise ValueError("Non-JSON numeric constant: " + value)


def validate_json(raw, locale):
    if not isinstance(raw, bytes):
        raise AcquisitionError("Downloader did not return exact bytes for " + locale)
    if len(raw) > MAX_DOWNLOAD_BYTES:
        raise AcquisitionError("Download exceeds the size ceiling for " + locale)
    try:
        parsed = json.loads(raw.decode("utf-8"), parse_constant=_reject_json_constant)
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise AcquisitionError("Invalid UTF-8 JSON for %s: %s" % (locale, exc)) from exc
    if not isinstance(parsed, dict):
        raise AcquisitionError("Expected a JSON object for " + locale)


def _retryable(exc):
    # HTTPError is also a URLError/OSError: classify its status first.
    if isinstance(exc, (urllib.error.HTTPError, AcquisitionHTTPError)):
        return exc.code in (408, 429) or 500 <= exc.code <= 599
    if isinstance(exc, AcquisitionTimeoutError):
        return True
    # Redirects, source mismatch, invalid JSON, and size failures are final.
    if isinstance(exc, AcquisitionError):
        return False
    if isinstance(exc, (urllib.error.URLError, TimeoutError, ConnectionError, socket.gaierror, socket.herror)):
        return True
    return isinstance(exc, OSError) and exc.errno in (
        errno.ECONNABORTED, errno.ECONNREFUSED, errno.ECONNRESET,
        errno.EHOSTUNREACH, errno.ENETDOWN, errno.ENETRESET,
        errno.ENETUNREACH, errno.EPIPE, errno.ETIMEDOUT,
    )


def _fetch_validated(url, locale, fetcher, sleeper):
    """Retry only transient failures, always requesting the identical URL."""
    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        try:
            raw = fetcher(url)
            validate_json(raw, locale)
        except (AcquisitionError, OSError, http.client.HTTPException) as exc:
            retry = attempt < MAX_DOWNLOAD_ATTEMPTS and _retryable(exc)
            delay = RETRY_DELAYS_SECONDS[attempt - 1] if retry else None
            print(
                "CommunityDragon attempt %s/%s url=%s error=%s: %s next_delay=%s; %s" % (
                    attempt, MAX_DOWNLOAD_ATTEMPTS, url, type(exc).__name__, exc,
                    "%ss" % delay if retry else "none",
                    "retrying identical URL" if retry else "final failure",
                ),
                file=sys.stderr, flush=True,
            )
            if not retry:
                raise
            sleeper(delay)
        else:
            print(
                "CommunityDragon attempt %s/%s url=%s error=none next_delay=none; success" % (
                    attempt, MAX_DOWNLOAD_ATTEMPTS, url,
                ),
                file=sys.stderr, flush=True,
            )
            return raw, attempt


def deterministic_gzip(raw):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", filename="", compresslevel=9, mtime=0) as archive:
        archive.write(raw)
    return buffer.getvalue()


def _fingerprint(data):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def _artifact_metadata(environ):
    name = environ.get("CDRAGON_ARTIFACT_NAME", "").strip()
    run_id = environ.get("GITHUB_RUN_ID", "").strip()
    run_url = environ.get("CDRAGON_RUN_URL", "").strip()
    if not run_url and run_id and environ.get("GITHUB_REPOSITORY"):
        run_url = "%s/%s/actions/runs/%s" % (
            environ.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/"),
            environ["GITHUB_REPOSITORY"],
            run_id,
        )
    if not name or not run_id or not run_url:
        raise AcquisitionError("Artifact-only mode requires artifact name, run ID, and run URL")
    if not run_url.startswith("https://") or any("\n" in value or "\r" in value for value in (name, run_id, run_url)):
        raise AcquisitionError("Invalid artifact identity or HTTPS run URL")
    return {
        "name": name,
        "run_id": run_id,
        "run_url": run_url,
        "retention_days": ARTIFACT_RETENTION_DAYS,
        "payload_root": ARTIFACT_PATH.as_posix(),
        "availability": "Upload and retention are managed by the workflow; the run URL is not a permanent archive.",
    }


def _publish(root, writes, removals):
    """Stage all files, then replace outputs; roll back ordinary I/O failures.

    The manifest is last and acts as a completion marker. This is not a
    multi-file filesystem transaction under power loss or SIGKILL.
    """
    root = root.resolve()
    # Refuse paths escaping the requested root through existing symlinks.
    for relative in set(writes).union(removals):
        destination = root / relative
        if root not in destination.resolve().parents:
            raise AcquisitionError("Output path escapes --root: " + str(relative))
        if destination.is_symlink() or (destination.exists() and not destination.is_file()):
            raise AcquisitionError("Output is not a regular file: " + str(relative))
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".cdragon-stage-", dir=root) as temporary:
        stage = Path(temporary)
        for index, (relative, content) in enumerate(writes.items()):
            (stage / ("new-%s" % index)).write_bytes(content)
        touched = []
        try:
            for index, relative in enumerate(list(removals) + list(writes)):
                destination = root / relative
                backup = stage / ("old-%s" % index)
                existed = destination.exists()
                if existed:
                    shutil.copyfile(destination, backup)
                touched.append((destination, backup if existed else None))
                if relative in writes:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    write_index = list(writes).index(relative)
                    os.replace(stage / ("new-%s" % write_index), destination)
                elif existed:
                    destination.unlink()
        except BaseException:
            for destination, backup in reversed(touched):
                if backup is None:
                    destination.unlink(missing_ok=True)
                else:
                    os.replace(backup, destination)
            raise


def acquire(root, fetcher=None, now=None, environ=None, sleeper=None):
    """Fetch/validate both sources and publish a complete set of acquisition files."""
    fetcher = download if fetcher is None else fetcher
    now = utc_now if now is None else now
    environ = os.environ if environ is None else environ
    sleeper = time.sleep if sleeper is None else sleeper
    sources = []
    archives = {}
    # All network reads and JSON validation happen before any filesystem writes.
    for locale in LOCALES:
        url = URL_TEMPLATE.format(locale=locale)
        raw, attempts = _fetch_validated(url, locale, fetcher, sleeper)
        downloaded_at = now()
        compressed = deterministic_gzip(raw)
        relative = BASE_PATH / "raw" / (locale + ".json.gz")
        archives[relative] = compressed
        sources.append({
            "locale": locale,
            "url": url,
            "download_attempts": attempts,
            "downloaded_at_utc": downloaded_at,
            "raw": _fingerprint(raw),
            "gzip": dict(_fingerprint(compressed), path=relative.as_posix()),
        })

    total_bytes = sum(len(content) for content in archives.values())
    artifact_only = (
        total_bytes > MAX_COMPRESSED_TOTAL_BYTES
        or any(len(content) > MAX_COMPRESSED_FILE_BYTES for content in archives.values())
    )
    mode = "artifact" if artifact_only else "git"
    manifest = {
        "schema_version": 1,
        "communitydragon_patch": "14.24",
        "content_version": "s13-14.24b",
        "verification": {
            "scope": "acquisition-only",
            "numeric_values_verified": False,
            "note": "HTTP success, JSON object syntax, byte counts, and hashes only; not gameplay or patch-number verification.",
        },
        "sources": sources,
        "storage": {
            "mode": mode,
            "compressed_total_bytes": total_bytes,
            "repository_limits": {
                "per_file_bytes": MAX_COMPRESSED_FILE_BYTES,
                "aggregate_bytes": MAX_COMPRESSED_TOTAL_BYTES,
            },
            "artifact": _artifact_metadata(environ) if artifact_only else None,
        },
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    writes = {}
    removals = []
    if artifact_only:
        writes.update({ARTIFACT_PATH / relative: data for relative, data in archives.items()})
        writes[ARTIFACT_PATH / MANIFEST_PATH] = manifest_bytes
        removals.extend(archives)
    else:
        writes.update(archives)
        # Remove only this tool's outputs from a previous artifact-only run.
        removals.extend(ARTIFACT_PATH / relative for relative in archives)
        removals.append(ARTIFACT_PATH / MANIFEST_PATH)
    writes[MANIFEST_PATH] = manifest_bytes
    _publish(Path(root), writes, removals)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="repository root (default: current directory)")
    args = parser.parse_args(argv)
    try:
        manifest = acquire(args.root)
        mode = manifest["storage"]["mode"]
        output = os.environ.get("GITHUB_OUTPUT")
        if output:
            with open(output, "a", encoding="utf-8") as handle:
                handle.write("storage_mode=%s\n" % mode)
                handle.write("artifact_path=%s\n" % ARTIFACT_PATH.as_posix())
                handle.write("manifest_path=%s\n" % MANIFEST_PATH.as_posix())
        print("Acquired en_us and zh_cn: %s; acquisition-only, numeric values unverified" % mode)
        return 0
    except (AcquisitionError, OSError, http.client.HTTPException) as exc:
        print("CommunityDragon acquisition failed: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
