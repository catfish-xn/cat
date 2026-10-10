# CI207–209: immutable first-attempt observations

All attempts are1. No monitor rerun, cancel, repository mutation or gate change occurred. Raw API conclusions are preserved: cancelled is not relabelled failure. Jobs reached their existing approximately32-minute deadline before cancellation; no assertion is made that a later push caused cancellation.

## Fixed identities and outcomes

- CI207 run38034845590, SHA1258682c02020edc7b6b665e448678e0c889c2d4: runfailure at08:14:23Z.10success,1failure(test),1cancelled(input-dev),3skipped(compare+2optional). Testjob114163031298:131files passed/1failed;1851passed/1failed/10skipped,787.90s. Only TG all43 timeout5000ms at tests/m8-b5-temporary.test.ts:187. Sniper180s/Herald did not fail. Input-dev114163031321: actual native31case and touch-route passed; M6 evaluate page-close error08:03:54, job cancellation08:14:19.
- CI208 run38035837492, SHA3dc3dd2d634cc64e716630c9a1ff53d65953ff60: runcancelled at08:24:33Z.11success,1cancelled(input-dev),3skipped. Testjob114165945970:132files/1852passed/10skipped,460.04s; subsequent build/headless/performance passed. Input-dev114165945984: native31case/touch passed, M6 evaluate page-close error08:09:09–10; cancelled08:24:28. This remains the fixed review entrypoint, not a green run.
- CI209 run38036259147, SHAe77dd38da5c525b1915698a0663472724ff1fdcb: runfailure at08:30:43Z.10success,1failure(test),1cancelled(input-dev),3skipped. Testjob114167192039:131files passed/1failed;1851passed/1failed/10skipped,784.12s; same TG all43 timeout5000ms. Input-dev114167192016: native31case/touch passed, new browserdiagnostics detailed below; cancelled08:30:38. This is a separate diagnostics revision, not a replacement for208's review identity.

All three six-browser workload sets actually executed and succeeded, as did input-preview/M7/U3/retention. Browser fullApplicationRoutePassed=false, B9 last3battles/final application archive remain explicitly deferred. Existing10unit-test skips and5native-input B8 skips are not passes. All final compare jobs skipped, so no final comparison success claim.

## CI209 decisive browser sequence (UTC)

1.08:16:32.813 pw:browser launched Chrome PID3813.
2.08:16:32.917 seq4 measurements-requested,cleanupStarted=false.
3.08:16:47.793 Chrome stderr: Too large read data is pending: capacity=104857600, max_buffer_size=104857600, read=104857600.
4.Same timestamp Chrome stderr content/browser/devtools/devtools_pipe_handler.cc:324: Connection closed, not enough capacity.
5.08:16:47.797 seq5 page-close,cleanupStarted=false,browserConnected=true.
6.08:16:47.799 seq6 script-catch,pageClosed=true,browserConnected=true.
7.08:16:47.846 seq7 cleanup-start andseq8 browser-close-call in script-finally.
8.08:16:47.849 seq9 context-close,seq10 browser-disconnected,seq11 browser-close-return.
9.08:30:38.632 job operation cancelled, long after the recorded failure.

This is direct evidence of the DevTools pipe's100MiB capacity boundary closing the connection before page-close and before script cleanup. Review the large fixtures sent by page.evaluate. No Chrome exitcode or signal was present in the complete stderr; no OOM or SIGKILL claim is supported. Browser-disconnected in cleanup is not the original trigger. CI207/208 had less detailed events and cannot independently establish the pipe cause, though their failure symptom matches.

## Handoff files

summary.json contains exact SHA/run/job identities, conclusions,timestamps and URLs. log-integrity.json maps all36 original decoded full job logs to deterministicgzip copies, original/gzip sizes and SHA256. Directories207/208/209 include those logs plus unchanged original API wrappers.209/m6-performance contains extracted diagnostics.jsonl and manifest.json; input artifact11665275485 was downloaded and its SHA256 verified against GitHub metadata. Full ZIP remains /workspace/shared/b8-ci209/input-dev.zip. No bulk artifact duplication was done.

The full job log is primary for Chrome stderr/cleanup ordering because manifest writing can precede cleanup. Suggested source links: https://github.com/catfish-xn/cat/actions/runs/38036259147/job/114167192016 and https://github.com/catfish-xn/cat/actions/runs/38035837492/job/114165945984.
