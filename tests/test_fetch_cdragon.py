"""Offline tests: never access CommunityDragon or any other network endpoint."""

import contextlib
import gzip
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock
import urllib.error


SPEC = importlib.util.spec_from_file_location(
    "fetch_cdragon", Path(__file__).resolve().parents[1] / "scripts/fetch-cdragon-14.24.py"
)
fetch = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch)

UTC = "2026-10-07T01:00:00Z"
SAMPLES = {
    "en_us": b'{ "sets": {"13": {"name": "Into the Arcane"}}, "items": [] }\n',
    "zh_cn": '{"sets":{"13":{"name":"双城之战"}},"items":[]}\n'.encode("utf-8"),
}
ENVIRON = {
    "CDRAGON_ARTIFACT_NAME": "cdragon-14.24-12345",
    "GITHUB_RUN_ID": "12345",
    "CDRAGON_RUN_URL": "https://github.com/example/project/actions/runs/12345",
}


def sample_fetch(url):
    for locale, data in SAMPLES.items():
        if url == fetch.URL_TEMPLATE.format(locale=locale):
            return data
    raise AssertionError("Unexpected URL: " + url)


class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        # Fail closed if a test accidentally uses a real downloader.
        self.network_guard = mock.patch.object(fetch.urllib.request, "build_opener", side_effect=AssertionError("Network forbidden"))
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)
        self.sleeper = mock.Mock()
        self.log = io.StringIO()
        self.stderr_guard = contextlib.redirect_stderr(self.log)
        self.stderr_guard.__enter__()
        self.addCleanup(self.stderr_guard.__exit__, None, None, None)

    def acquire(self, downloader=sample_fetch, environ=None):
        return fetch.acquire(self.root, fetcher=downloader, now=lambda: UTC,
                             environ=ENVIRON if environ is None else environ, sleeper=self.sleeper)

    def files(self):
        return {path.relative_to(self.root).as_posix(): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}

    def test_success_preserves_exact_bytes_hashes_urls_and_timestamps(self):
        downloader = mock.Mock(side_effect=sample_fetch)
        manifest = self.acquire(downloader)
        self.assertEqual(downloader.call_args_list, [mock.call(fetch.URL_TEMPLATE.format(locale=locale)) for locale in fetch.LOCALES])
        self.assertEqual(manifest["storage"]["mode"], "git")
        self.assertEqual(manifest["verification"]["scope"], "acquisition-only")
        self.assertFalse(manifest["verification"]["numeric_values_verified"])
        self.assertEqual(len(self.files()), 3)
        for source in manifest["sources"]:
            raw = SAMPLES[source["locale"]]
            archive = (self.root / source["gzip"]["path"]).read_bytes()
            self.assertEqual(gzip.decompress(archive), raw)
            self.assertEqual(archive[4:8], b"\0\0\0\0")
            self.assertEqual(source["raw"], {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
            self.assertEqual(source["gzip"]["bytes"], len(archive))
            self.assertEqual(source["gzip"]["sha256"], hashlib.sha256(archive).hexdigest())
            self.assertEqual(source["url"], fetch.URL_TEMPLATE.format(locale=source["locale"]))
            self.assertEqual(source["downloaded_at_utc"], UTC)
            self.assertEqual(source["download_attempts"], 1)
        self.sleeper.assert_not_called()
        self.assertEqual(json.loads((self.root / fetch.MANIFEST_PATH).read_bytes()), manifest)

    def test_gzip_and_manifest_are_reproducible(self):
        self.acquire()
        before = self.files()
        self.acquire()
        self.assertEqual(self.files(), before)

    def test_invalid_json_or_non_object_publishes_nothing(self):
        for bad in (b"<html>Error</html>", b"{", b"[]", b"null", b"123", b'{"n":NaN}', b'{"n":Infinity}', b'{"x":"\xff"}'):
            with self.subTest(payload=bad):
                downloader = mock.Mock(side_effect=[SAMPLES["en_us"], bad])
                with self.assertRaises(fetch.AcquisitionError):
                    self.acquire(downloader)
                self.assertEqual(downloader.call_count, 2)
                self.sleeper.assert_not_called()
                self.assertEqual(list(self.root.iterdir()), [])

    def test_second_download_failure_publishes_nothing(self):
        downloader = mock.Mock(side_effect=[SAMPLES["en_us"]] + [urllib.error.URLError("offline fixture")] * 5)
        with self.assertRaises(urllib.error.URLError):
            self.acquire(downloader)
        self.assertEqual(downloader.call_count, 6)
        self.assertEqual(self.sleeper.call_args_list, [mock.call(delay) for delay in (15, 30, 60, 120)])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_second_download_failure_preserves_existing_outputs(self):
        for artifact_only in (False, True):
            with self.subTest(artifact_only=artifact_only), mock.patch.object(
                fetch, "MAX_COMPRESSED_TOTAL_BYTES", 1 if artifact_only else 40 * 1024 * 1024
            ):
                self.acquire()
                before = self.files()
                self.sleeper.reset_mock()
                url = fetch.URL_TEMPLATE.format(locale="zh_cn")
                downloader = mock.Mock(side_effect=[b'{"new":true}'] + [
                    urllib.error.HTTPError(url, 522, "Connection timed out", {}, None)
                ] * 5)
                with self.assertRaises(urllib.error.HTTPError):
                    self.acquire(downloader)
                self.assertEqual(downloader.call_args_list, [
                    mock.call(fetch.URL_TEMPLATE.format(locale="en_us")),
                ] + [mock.call(url)] * 5)
                self.assertEqual(self.sleeper.call_args_list, [mock.call(delay) for delay in (15, 30, 60, 120)])
                self.assertEqual(self.files(), before)

    def test_522_then_success_retries_exact_urls_and_records_attempts(self):
        en_url = fetch.URL_TEMPLATE.format(locale="en_us")
        zh_url = fetch.URL_TEMPLATE.format(locale="zh_cn")
        downloader = mock.Mock(side_effect=[
            urllib.error.HTTPError(en_url, 522, "Connection timed out", {}, None), SAMPLES["en_us"],
            urllib.error.HTTPError(zh_url, 522, "Connection timed out", {}, None),
            urllib.error.HTTPError(zh_url, 522, "Connection timed out", {}, None), SAMPLES["zh_cn"],
        ])
        manifest = self.acquire(downloader)
        self.assertEqual(downloader.call_args_list, [mock.call(en_url)] * 2 + [mock.call(zh_url)] * 3)
        self.assertEqual(self.sleeper.call_args_list, [mock.call(15), mock.call(15), mock.call(30)])
        self.assertEqual([source["download_attempts"] for source in manifest["sources"]], [2, 3])
        logs = self.log.getvalue().splitlines()
        self.assertEqual(len(logs), 5)
        self.assertIn("url=" + en_url, logs[0])
        self.assertIn("error=HTTPError: HTTP Error 522", logs[0])
        self.assertIn("next_delay=15s", logs[0])
        self.assertIn("attempt 2/5", logs[1])
        self.assertIn("error=none next_delay=none; success", logs[1])
        self.assertIn("url=" + zh_url, logs[3])
        self.assertIn("next_delay=30s", logs[3])

    def test_retryable_http_exhausts_exactly_five_attempts(self):
        url = fetch.URL_TEMPLATE.format(locale="en_us")
        error = urllib.error.HTTPError(url, 522, "Connection timed out", {}, None)
        downloader = mock.Mock(side_effect=error)
        with self.assertRaises(urllib.error.HTTPError) as raised:
            self.acquire(downloader)
        self.assertIs(raised.exception, error)
        self.assertEqual(downloader.call_args_list, [mock.call(url)] * 5)
        self.assertEqual(self.sleeper.call_args_list, [mock.call(delay) for delay in (15, 30, 60, 120)])
        self.assertEqual(list(self.root.iterdir()), [])
        logs = self.log.getvalue().splitlines()
        self.assertEqual(len(logs), 5)
        for attempt, line in enumerate(logs, start=1):
            self.assertIn("attempt %s/5" % attempt, line)
            self.assertIn("url=" + url, line)
            self.assertIn("error=HTTPError: HTTP Error 522", line)
            self.assertIn("next_delay=%ss" % (15, 30, 60, 120)[attempt - 1] if attempt < 5 else "next_delay=none; final failure", line)

    def test_transient_http_statuses_are_retryable(self):
        url = fetch.URL_TEMPLATE.format(locale="en_us")
        for code in (408, 429, 500, 502, 503, 504, 522, 599):
            for error_type in (urllib.error.HTTPError, fetch.AcquisitionHTTPError):
                with self.subTest(code=code, error_type=error_type):
                    self.sleeper.reset_mock()
                    error = (urllib.error.HTTPError(url, code, "fixture", {}, None)
                             if error_type is urllib.error.HTTPError else error_type(url, code))
                    downloader = mock.Mock(side_effect=[error, SAMPLES["en_us"], SAMPLES["zh_cn"]])
                    manifest = self.acquire(downloader)
                    self.assertEqual(manifest["sources"][0]["download_attempts"], 2)
                    self.sleeper.assert_called_once_with(15)

    def test_403_404_and_other_permanent_http_errors_do_not_retry(self):
        url = fetch.URL_TEMPLATE.format(locale="en_us")
        for code in (301, 400, 401, 403, 404, 410, 451, 600):
            for error_type in (urllib.error.HTTPError, fetch.AcquisitionHTTPError):
                with self.subTest(code=code, error_type=error_type):
                    error = (urllib.error.HTTPError(url, code, "fixture", {}, None)
                             if error_type is urllib.error.HTTPError else error_type(url, code))
                    downloader = mock.Mock(side_effect=error)
                    with self.assertRaises(error_type):
                        self.acquire(downloader)
                    downloader.assert_called_once_with(url)
                    self.sleeper.assert_not_called()
                    self.assertEqual(list(self.root.iterdir()), [])
                    self.assertIn("next_delay=none; final failure", self.log.getvalue())

    def test_timeouts_and_network_failures_retry(self):
        errors = (
            fetch.AcquisitionTimeoutError("Download exceeded total deadline of 240 seconds"),
            TimeoutError("socket timed out"),
            urllib.error.URLError("temporary network error"),
            ConnectionResetError("connection reset"),
            fetch.socket.gaierror("DNS unavailable"),
            OSError(fetch.errno.ENETUNREACH, "network unreachable"),
        )
        for error in errors:
            with self.subTest(error=type(error).__name__):
                self.sleeper.reset_mock()
                downloader = mock.Mock(side_effect=[error, SAMPLES["en_us"], SAMPLES["zh_cn"]])
                manifest = self.acquire(downloader)
                self.assertEqual(manifest["sources"][0]["download_attempts"], 2)
                self.assertEqual(downloader.call_args_list[:2], [
                    mock.call(fetch.URL_TEMPLATE.format(locale="en_us"))
                ] * 2)
                self.sleeper.assert_called_once_with(15)

    def test_source_validation_size_and_non_network_failures_do_not_retry(self):
        errors = (
            fetch.AcquisitionError("Redirect refused for fixed source"),
            fetch.AcquisitionError("Response URL did not match the fixed source"),
            fetch.AcquisitionError("HTTP Content-Length exceeds the download ceiling"),
            fetch.AcquisitionError("Downloaded size does not match HTTP Content-Length"),
            fetch.AcquisitionError("Unexpected HTTP content encoding: gzip"),
            fetch.AcquisitionError("Strict download deadlines require a POSIX main thread"),
            OSError(fetch.errno.EACCES, "permission denied"),
            http.client.IncompleteRead(b"{", 10),
        )
        for error in errors:
            with self.subTest(error=str(error)):
                downloader = mock.Mock(side_effect=error)
                with self.assertRaises(type(error)):
                    self.acquire(downloader)
                self.assertEqual(downloader.call_count, 1)
                self.sleeper.assert_not_called()
                self.assertEqual(list(self.root.iterdir()), [])

    def test_last_attempt_success_has_no_extra_sleep(self):
        url = fetch.URL_TEMPLATE.format(locale="en_us")
        downloader = mock.Mock(side_effect=[
            urllib.error.HTTPError(url, 522, "Connection timed out", {}, None)
        ] * 4 + [SAMPLES["en_us"], SAMPLES["zh_cn"]])
        manifest = self.acquire(downloader)
        self.assertEqual([source["download_attempts"] for source in manifest["sources"]], [5, 1])
        self.assertEqual(self.sleeper.call_args_list, [mock.call(delay) for delay in (15, 30, 60, 120)])

    def test_bad_second_json_preserves_existing_outputs(self):
        self.acquire()
        before = self.files()
        with self.assertRaises(fetch.AcquisitionError):
            self.acquire(mock.Mock(side_effect=[b'{"new":true}', b"not JSON"]))
        self.assertEqual(self.files(), before)

    def assert_artifact(self, manifest):
        self.assertEqual(manifest["storage"]["mode"], "artifact")
        identity = manifest["storage"]["artifact"]
        self.assertEqual(identity["name"], ENVIRON["CDRAGON_ARTIFACT_NAME"])
        self.assertEqual(identity["run_id"], ENVIRON["GITHUB_RUN_ID"])
        self.assertEqual(identity["run_url"], ENVIRON["CDRAGON_RUN_URL"])
        self.assertEqual(identity["retention_days"], 30)
        for source in manifest["sources"]:
            relative = Path(source["gzip"]["path"])
            self.assertFalse((self.root / relative).exists())
            payload = (self.root / fetch.ARTIFACT_PATH / relative).read_bytes()
            self.assertEqual(gzip.decompress(payload), SAMPLES[source["locale"]])
        self.assertEqual((self.root / fetch.MANIFEST_PATH).read_bytes(), (self.root / fetch.ARTIFACT_PATH / fetch.MANIFEST_PATH).read_bytes())
        self.assertEqual(len(self.files()), 4)

    def test_per_file_threshold_uses_artifact_only(self):
        with mock.patch.object(fetch, "MAX_COMPRESSED_FILE_BYTES", 1):
            self.assert_artifact(self.acquire())

    def test_aggregate_threshold_uses_artifact_only(self):
        with mock.patch.object(fetch, "MAX_COMPRESSED_TOTAL_BYTES", 1):
            self.assert_artifact(self.acquire())

    def test_exact_limits_stay_in_repository(self):
        sizes = [len(fetch.deterministic_gzip(raw)) for raw in SAMPLES.values()]
        with mock.patch.object(fetch, "MAX_COMPRESSED_FILE_BYTES", max(sizes)), mock.patch.object(fetch, "MAX_COMPRESSED_TOTAL_BYTES", sum(sizes)):
            self.assertEqual(self.acquire()["storage"]["mode"], "git")

    def test_switching_storage_modes_removes_stale_known_payloads(self):
        self.acquire()
        with mock.patch.object(fetch, "MAX_COMPRESSED_TOTAL_BYTES", 1):
            self.assert_artifact(self.acquire())
        self.acquire()
        self.assertEqual(len(self.files()), 3)
        self.assertFalse(any((self.root / fetch.ARTIFACT_PATH).rglob("*.gz")))

    def test_artifact_missing_identity_fails_before_output(self):
        with mock.patch.object(fetch, "MAX_COMPRESSED_TOTAL_BYTES", 1):
            with self.assertRaises(fetch.AcquisitionError):
                self.acquire(environ={})
        self.assertEqual(list(self.root.iterdir()), [])

    def test_artifact_standard_github_environment_fallback(self):
        environment = dict(ENVIRON)
        del environment["CDRAGON_RUN_URL"]
        environment["GITHUB_REPOSITORY"] = "example/project"
        with mock.patch.object(fetch, "MAX_COMPRESSED_TOTAL_BYTES", 1):
            self.assert_artifact(self.acquire(environ=environment))

    def test_injected_download_cannot_bypass_size_ceiling(self):
        downloader = mock.Mock(side_effect=sample_fetch)
        with mock.patch.object(fetch, "MAX_DOWNLOAD_BYTES", 1):
            with self.assertRaises(fetch.AcquisitionError):
                self.acquire(downloader)
        self.assertEqual(downloader.call_count, 1)
        self.sleeper.assert_not_called()
        self.assertEqual(list(self.root.iterdir()), [])

    def test_publication_failure_rolls_back_existing_files(self):
        self.acquire()
        before = self.files()
        real_replace = os.replace
        calls = 0

        def fail_second(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated disk error")
            return real_replace(source, destination)

        with mock.patch.object(fetch.os, "replace", side_effect=fail_second):
            with self.assertRaises(OSError):
                self.acquire(lambda url: b'{"new":true}')
        self.assertEqual(self.files(), before)

    def test_cli_emits_workflow_outputs(self):
        output_path = self.root / "github-output"
        environment = dict(ENVIRON, GITHUB_OUTPUT=str(output_path))
        with mock.patch.dict(os.environ, environment, clear=True), mock.patch.object(fetch, "download", side_effect=sample_fetch), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(fetch.main(["--root", str(self.root)]), 0)
        self.assertEqual(output_path.read_text().splitlines(), [
            "storage_mode=git",
            "artifact_path=artifacts/cdragon-14.24",
            "manifest_path=src/simulation/content/source/s13-14.24b/provenance/download-manifest.json",
        ])


class DownloadTests(unittest.TestCase):
    def response(self, body=b'{}', status=200, headers=None, url=None):
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.status = status
        response.headers = {} if headers is None else headers
        response.geturl.return_value = fetch.URL_TEMPLATE.format(locale="en_us") if url is None else url
        response.read.side_effect = io.BytesIO(body).read
        return response

    def run_download(self, response):
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(fetch.urllib.request, "build_opener", return_value=opener):
            result = fetch.download(fetch.URL_TEMPLATE.format(locale="en_us"))
        self.assertEqual(opener.open.call_args.kwargs["timeout"], fetch.DOWNLOAD_TIMEOUT_SECONDS)
        return result

    def test_exact_network_bytes(self):
        self.assertEqual(self.run_download(self.response(body=SAMPLES["en_us"])), SAMPLES["en_us"])

    def test_http_failure_rejected(self):
        with self.assertRaises(fetch.AcquisitionError):
            self.run_download(self.response(status=503))

    def test_unexpected_effective_url_rejected(self):
        with self.assertRaises(fetch.AcquisitionError):
            self.run_download(self.response(url="https://example.org/substitute.json"))

    def test_redirect_handler_rejects_substitution(self):
        request = fetch.urllib.request.Request(fetch.URL_TEMPLATE.format(locale="en_us"))
        with self.assertRaises(fetch.AcquisitionError):
            fetch._RejectRedirects().redirect_request(request, None, 302, "Found", {}, "https://example.org")

    def test_declared_oversize_rejected(self):
        with self.assertRaises(fetch.AcquisitionError):
            self.run_download(self.response(headers={"Content-Length": str(fetch.MAX_DOWNLOAD_BYTES + 1)}))

    def test_actual_oversize_rejected_without_content_length(self):
        with mock.patch.object(fetch, "MAX_DOWNLOAD_BYTES", 1):
            with self.assertRaises(fetch.AcquisitionError):
                self.run_download(self.response(body=b"{}"))

    def test_incomplete_response_rejected(self):
        with self.assertRaises(fetch.AcquisitionError):
            self.run_download(self.response(headers={"Content-Length": "100"}))

    def test_unexpected_transfer_compression_rejected(self):
        with self.assertRaises(fetch.AcquisitionError):
            self.run_download(self.response(headers={"Content-Encoding": "gzip"}))

    def test_hard_deadline_arms_and_restores_timer(self):
        with mock.patch.object(fetch.signal, "getitimer", return_value=(0.0, 0.0)), mock.patch.object(fetch.signal, "signal", return_value="previous") as handler, mock.patch.object(fetch.signal, "setitimer") as timer:
            with fetch._hard_deadline(5):
                callback = handler.call_args_list[0].args[1]
                with self.assertRaises(fetch.AcquisitionTimeoutError):
                    callback(None, None)
            self.assertEqual(timer.call_args_list, [mock.call(fetch.signal.ITIMER_REAL, 5), mock.call(fetch.signal.ITIMER_REAL, 0)])
            self.assertEqual(handler.call_args_list[-1], mock.call(fetch.signal.SIGALRM, "previous"))

    def test_total_deadline_interrupts_stalled_download(self):
        opener = mock.Mock()
        opener.open.side_effect = lambda *args, **kwargs: time.sleep(1)
        with mock.patch.object(fetch, "DOWNLOAD_TIMEOUT_SECONDS", 0.01), mock.patch.object(fetch.urllib.request, "build_opener", return_value=opener):
            with self.assertRaisesRegex(fetch.AcquisitionTimeoutError, "total deadline"):
                fetch.download(fetch.URL_TEMPLATE.format(locale="en_us"))


if __name__ == "__main__":
    unittest.main()
