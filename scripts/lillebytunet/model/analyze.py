import numpy as np, json, re, sys
from collections import defaultdict
# --- read COLMAP text model
def qvec2rot(q):
    w,x,y,z=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
imgs={}  # image_id -> (name, R, t, pts2d[(x,y,p3d)])
lines=[l for l in open('sparse/0/images.txt') if not l.startswith('#')]
for i in range(0,len(lines),2):
    a=lines[i].split(); iid=int(a[0]); q=list(map(float,a[1:5])); t=np.array(list(map(float,a[5:8]))); name=a[9]
    b=lines[i+1].split(); pts=[(float(b[j]),float(b[j+1]),int(b[j+2])) for j in range(0,len(b),3)]
    imgs[iid]=(name,qvec2rot(q),t,pts)
p3d={}
for l in open('sparse/0/points3D.txt'):
    if l.startswith('#'): continue
    a=l.split(); p3d[int(a[0])]=np.array(list(map(float,a[1:4])))
# camera centers and view dirs
C=[];D=[];idx=[]
for iid,(name,R,t,_) in sorted(imgs.items(), key=lambda kv: kv[1][0]):
    c=-R.T@t; d=R.T@np.array([0,0,1.0]); C.append(c); D.append(d); idx.append(int(name[:3]))
C=np.array(C);D=np.array(D);idx=np.array(idx)
# plane through camera centers -> up vector
cen=C.mean(0); u,s,vt=np.linalg.svd(C-cen); n=vt[2]
if np.dot(D.mean(0),n)>0: n=-n   # cameras look downward => up is opposite of mean view dir component
up=n
print('plane residual (units):',s[2]/np.sqrt(len(C)), 'orbit radius mean', np.linalg.norm(C-cen,axis=1).mean(), 'std', np.linalg.norm(C-cen,axis=1).std())
# elevation of view dir
elev=np.degrees(np.arcsin(-D@up)); print('view pitch down deg: mean %.1f min %.1f max %.1f'%(elev.mean(),elev.min(),elev.max()))
# angular order: project onto plane, angle vs index
e1=vt[0]; e2=np.cross(up,e1)
ang=np.degrees(np.arctan2((C-cen)@e2,(C-cen)@e1))
dang=np.diff(np.unwrap(np.radians(ang[np.argsort(idx)])))
print('mean angular step deg (positive = CCW about up):', np.degrees(dang).mean(), 'std', np.degrees(dang).std())
# --- Hus B points via unit polygons
sc=json.load(open('../api/scenes_per_level_bygg-b.json'))
scenes=sc if isinstance(sc,list) else sc.get('scenes',sc)
poly_by_dir={}
from matplotlib.path import Path
for s in scenes:
    polys=[]
    for r in s.get('references',[]):
        pts=[(p['x'],p['y']) for p in r.get('points',[])]
        if len(pts)>=3: polys.append(Path(pts))
    poly_by_dir[s['direction']]=polys
hits=defaultdict(int); obs=defaultdict(int)
for iid,(name,R,t,pts) in imgs.items():
    d=int(name[:3]); polys=poly_by_dir.get(d,[])
    if not polys: continue
    xy=np.array([(x,y) for x,y,p in pts if p>=0]); pid=[p for x,y,p in pts if p>=0]
    inside=np.zeros(len(xy),bool)
    for P in polys: inside|=P.contains_points(xy)
    for k,p in enumerate(pid):
        obs[p]+=1
        if inside[k]: hits[p]+=1
sel=[p for p in hits if hits[p]>=2 and hits[p]/obs[p]>=0.5]
print('Hus B points:',len(sel),'of',len(p3d))
B=np.array([p3d[p] for p in sel])
# coordinates in up-frame
def to_frame(X): 
    Y=X-cen; return np.stack([Y@e1,Y@e2,Y@up],1)
Bf=to_frame(B); Cf=to_frame(C)
print('cam height above centroid-of-B (units): %.2f'%(Cf[:,2].mean()-Bf[:,2].mean()))
lo,hi=np.percentile(Bf,[2,98],axis=0); print('B extent p2-p98 x,y,z:',hi-lo)
print('B z p1 p50 p99:',np.percentile(Bf[:,2],[1,50,99]))
np.save('husB_pts.npy',Bf); np.save('cams.npy',np.c_[idx,Cf,(D@e1),(D@e2),(D@up)])
np.save('frame.npy',np.stack([e1,e2,up,cen]))
