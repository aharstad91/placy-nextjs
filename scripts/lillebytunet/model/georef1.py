import numpy as np, json, cv2, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.path import Path
from collections import defaultdict
def qvec2rot(q):
    w,x,y,z=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
lines=[l for l in open('sparse/0/images.txt') if not l.startswith('#')]
imgs={}
for i in range(0,len(lines),2):
    a=lines[i].split(); b=lines[i+1].split()
    imgs[a[9]]=(qvec2rot(list(map(float,a[1:5]))),np.array(list(map(float,a[5:8]))),[(float(b[j]),float(b[j+1]),int(b[j+2])) for j in range(0,len(b),3)])
p3d={}
for l in open('sparse/0/points3D.txt'):
    if l.startswith('#'): continue
    a=l.split(); p3d[int(a[0])]=np.array(list(map(float,a[1:4])))
names=sorted(imgs); C=np.array([-imgs[n][0].T@imgs[n][1] for n in names]); D=np.array([imgs[n][0].T@np.array([0,0,1.0]) for n in names])
cen=C.mean(0); u,s,vt=np.linalg.svd(C-cen); up=vt[2]
if np.dot(D.mean(0),up)>0: up=-up
e1=vt[0]; e2=np.cross(up,e1)
print('orbit radius',np.linalg.norm(C-cen,axis=1).mean(),'pitch',np.degrees(np.arcsin(-D@up)).mean(), 'step',np.degrees(np.diff(np.unwrap(np.arctan2((C-cen)@e2,(C-cen)@e1)))).mean())
def to_frame(X): Y=X-cen; return np.stack([Y@e1,Y@e2,Y@up],1)
ids=np.array(sorted(p3d)); P=to_frame(np.array([p3d[i] for i in ids])); idx={pid:k for k,pid in enumerate(ids)}
np.save('frame.npy',np.stack([e1,e2,up,cen])); np.save('pts.npy',P); np.save('ids.npy',ids)
# building polygons
sc=json.load(open('../api/scenes_per_level_root.json')); scenes=sc if isinstance(sc,list) else sc.get('scenes',sc)
bnames={'107ea423-b879-466e-ac74-51c9170f32ea':'B','49e95760-ceb8-4e58-ba03-e32825e8505f':'C','c71e12e7-dcca-4839-87c3-f78b541139e1':'A','c332799a-a325-4996-a116-bfaa1da599e2':'D','16e6066f-9df0-40e1-971c-158b531da0cb':'R'}
polys=defaultdict(dict)
for s in scenes:
    for r in s['references']:
        pts=[(p['x'],p['y']) for p in r['points']]
        if len(pts)>=3: polys[s['direction']].setdefault(bnames.get(r['parent'],'?'),[]).append(Path(pts))
hits=defaultdict(lambda: defaultdict(int)); obs=defaultdict(int)
for n,(R,t,pts) in imgs.items():
    d=int(n[:3]); xy=np.array([(x,y) for x,y,p in pts if p>=0]); pid=[p for x,y,p in pts if p>=0]
    for p in pid: obs[p]+=1
    for bn,pl in polys.get(d,{}).items():
        inside=np.zeros(len(xy),bool)
        for Pth in pl: inside|=Pth.contains_points(xy)
        for k in np.where(inside)[0]: hits[bn][pid[k]]+=1
bpts={}
for bn in 'ABCDR':
    sel=[p for p,h in hits[bn].items() if h>=2 and h/obs[p]>=0.5]; bpts[bn]=P[[idx[p] for p in sel]]; print(bn,'points',len(sel),'z p1/p99',np.percentile(bpts[bn][:,2],[1,99]).round(3))
np.save('bpts.npy',bpts,allow_pickle=True)
# top-down plot, upper points only (roofs/facades), color by z
fig,ax=plt.subplots(figsize=(16,16)); zlo=np.percentile(P[:,2],40)
m=(P[:,2]>zlo)&(np.abs(P[:,0])<6)&(np.abs(P[:,1])<6)
ax.scatter(P[m,0],P[m,1],s=0.3,c=P[m,2],cmap='viridis')
for bn,col in zip('ABCDR',['r','m','c','y','w']): ax.scatter(bpts[bn][:,0],bpts[bn][:,1],s=0.5,c=col,label=bn)
ax.plot(C@e1-cen@e1,C@e2-cen@e2,'k.',ms=2); 
for k in range(0,96,12): ax.annotate(str(k),((C[k]-cen)@e1,(C[k]-cen)@e2),color='k')
ax.set_xticks(np.arange(-6,6.1,0.5)); ax.set_yticks(np.arange(-6,6.1,0.5)); ax.grid(True,lw=0.3); ax.set_aspect('equal'); ax.legend(); ax.set_xlim(-6,6); ax.set_ylim(-6,6)
plt.savefig('topdown.png',dpi=70,bbox_inches='tight')
