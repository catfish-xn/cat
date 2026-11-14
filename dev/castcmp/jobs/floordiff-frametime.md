# REC ONLY. Floor-depth PR frame time (11-14), Windows GPU

Effective limits in both trees (code, not flags): MAX_LTK_SYSTEMS = 20 (runtime.ts), MAX_LIVE_PARTICLES = 2250
(effect-library.ts). The PR changes neither; it adds one depth-only redraw of the floor (arena + board) per frame.

Busiest 8 v 8 used so far (3 stars, ground-heavy casters on one side, tanks on the other):

    git checkout -f 44abbd7f   # before (integration)
    node dev/castcmp/board-load.cjs fnd-ft-before.json --board viktor,jinx,mel,sevika,gangplank,vi,caitlyn,jayce --foes drmundo,mordekaiser,illaoi,garen,leona,ekko,nami,heimerdinger --star 3 --warm 1 --gl gpu
    git checkout -f ebf69700   # after (the PR head)
    node dev/castcmp/board-load.cjs fnd-ft-after.json --board viktor,jinx,mel,sevika,gangplank,vi,caitlyn,jayce --foes drmundo,mordekaiser,illaoi,garen,leona,ekko,nami,heimerdinger --star 3 --warm 1 --gl gpu

Run each twice, alternating before/after, same machine, nothing else on the GPU; compare the per-second wall times
(mean, p95, worst second) and the LTK peak counters the json carries.
