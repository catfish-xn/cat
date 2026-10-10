"""Verify author-published 4d9 object/list against accessible eecca, without 4d9 Git objects."""
from pathlib import Path
import gzip, hashlib, json, subprocess, sys
base=Path(__file__).resolve().parent
repo=Path(sys.argv[1] if len(sys.argv)>1 else '.')
info=json.loads((base/'comparison.json').read_text());entries=json.loads(gzip.decompress((base/'local-complete-tree.json.gz').read_bytes()))
raw=(base/'local-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==info['localCommit']
assert raw.startswith(('tree '+info['tree']+'\n').encode())
remote=json.loads(gzip.decompress((base/'remote-tree.json.gz').read_bytes()))
assert remote['sha']==info['tree'] and not remote.get('truncated')
project=lambda es:sorted([(e['path'],e['mode'],e['type'],e['sha']) for e in es])
assert project(entries)==project(remote['tree'])
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args])
# Only the public remote commit is required. No author-local refs are created.
assert git('rev-parse',info['remoteCommit']+'^{tree}').decode().strip()==info['tree']
actual=[]
for record in git('ls-tree','-r','-t','-z',info['remoteCommit']).split(b'\0'):
 if record:
  head,name=record.split(b'\t',1);mode,typ,sha=head.decode().split();actual.append({'path':name.decode(),'mode':mode,'type':typ,'sha':sha})
assert project(actual)==project(entries)
for e in entries:
 if e['type']=='blob':
  content=git('cat-file','blob',e['sha']);assert len(content)==e['bytes'];assert hashlib.sha256(content).hexdigest()==e['sha256']
print(json.dumps({'verifiedRemote':info['remoteCommit'],'tree':info['tree'],'entries':len(entries),'blobs':sum(e['type']=='blob' for e in entries),'localCommitRawSha1Verified':True,'historicalDirtyWorkingTreeAttested':False}))
