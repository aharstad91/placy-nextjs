import numpy as np, cv2
B=np.load('husB_pts.npy'); F=np.load('frame.npy'); e1,e2,up,cen=F
th,a0,b0,a1,b1=np.load('rect.npy'); t=np.radians(th); R2=np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]])
def w(a,b,z): xy=R2.T@np.array([a,b]); return cen+xy[0]*e1+xy[1]*e2+z*up
Z0,Z5,Z6=-1.99,-1.99+5*0.25,-0.49
# faces: name, corner list (bottom-left, bottom-right, top-right, top-left) seen from outside, outward normal in (a,b)
faces={'A-': [(a0,b1),(a0,b0)], 'A+': [(a1,b0),(a1,b1)], 'B-': [(a0,b0),(a1,b0)], 'B+': [(a1,b1),(a0,b1)]}
normals={'A-':(-1,0),'A+':(1,0),'B-':(0,-1),'B+':(0,1)}
cams=np.load('cams.npy')  # idx, x,y,z, dx,dy,dz (in e-frame)
# camera azimuth in rotated (a,b) frame
camab=(R2@cams[:,1:3].T).T
K=np.array([[1213.246,0,960],[0,1221.107,540],[0,0,1]])
def qvec2rot(q):
    w_,x,y,z=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w_),2*(x*z+y*w_)],[2*(x*y+z*w_),1-2*(x*x+z*z),2*(y*z-x*w_)],[2*(x*z-y*w_),2*(y*z+x*w_),1-2*(x*x+y*y)]])
lines=[l for l in open('sparse/0/images.txt') if not l.startswith('#')]
imgs={}
for i in range(0,len(lines),2):
    a=lines[i].split(); imgs[int(a[9][:3])]=(a[9],qvec2rot(list(map(float,a[1:5]))),np.array(list(map(float,a[5:8]))))
PPU=800  # px per unit (~65 px/m)
top=[]
for name,(p,q) in faces.items():
    n=np.array(normals[name])
    # head-on score: camera direction from face center to camera aligned with normal
    fc=np.array([(p[0]+q[0])/2,(p[1]+q[1])/2]); v=camab-fc; v/=np.linalg.norm(v,axis=1)[:,None]
    score=v@n; order=np.argsort(-score)
    best=[int(cams[i,0]) for i in order[:1]]
    # also two offset candidates ±16 steps
    cands=[best[0],(best[0]-6)%96,(best[0]+6)%96]
    print(name,'head-on cam',best[0],'score %.3f'%score[order[0]],'cands',cands)
    L=np.hypot(q[0]-p[0],q[1]-p[1]); W=int(L*PPU); H=int((Z6-Z0)*PPU)
    row=[]
    for c in cands:
        nm,Rm,tv=imgs[c]; img=cv2.imread('images/'+nm)
        C3=np.array([w(*p,Z0),w(*q,Z0),w(*q,Z6),w(*p,Z6)])
        X=(Rm@C3.T).T+tv; uv=(K@X.T).T; uv=(uv[:,:2]/uv[:,2:]).astype(np.float32)
        dst=np.array([[0,H],[W,H],[W,0],[0,0]],np.float32)
        Hm=cv2.getPerspectiveTransform(uv,dst); tex=cv2.warpPerspective(img,Hm,(W,H))
        cv2.imwrite('tex_%s_%03d.png'%(name,c),tex); row.append(cv2.resize(tex,(W//3,H//3)))
    top.append(np.hstack(row))
mw=max(r.shape[1] for r in top); top=[np.pad(r,((0,0),(0,mw-r.shape[1]),(0,0))) for r in top]
cv2.imwrite('facade_candidates.jpg',np.vstack(top))
print('W/H units:',[(n,np.hypot(q[0]-p[0],q[1]-p[1])) for n,(p,q) in faces.items()],'height',Z6-Z0)
# which cam is 0 relative: 
print('cam0 ab pos',camab[cams[:,0]==0])
