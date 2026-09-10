import numpy as np, cv2, json
B=np.load('husB_pts.npy'); F=np.load('frame.npy'); e1,e2,up,cen=F
zm=(B[:,2]>-1.9)&(B[:,2]<-0.95); P=B[zm][:,:2]
best=None
for th in np.arange(0,90,0.5):
    t=np.radians(th); R=np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]]); Q=P@R.T
    lo=np.percentile(Q,3,axis=0); hi=np.percentile(Q,97,axis=0); area=np.prod(hi-lo)
    if best is None or area<best[0]: best=(area,th,lo,hi,R)
area,th,lo,hi,R=best
print('best angle %.1f deg, size %.3f x %.3f (units), area %.3f'%(th,*(hi-lo),area))
# density-based edges: histogram along each rotated axis, find steep rises
Q=P@R.T
for ax in (0,1):
    h,e=np.histogram(Q[:,ax],bins=120); c=(e[:-1]+e[1:])/2
    cum=np.cumsum(h)/h.sum(); print('axis',ax,'p1 %.3f p3 %.3f p97 %.3f p99 %.3f'%tuple(np.interp([0.01,0.03,0.97,0.99],cum,c)))
np.save('rect.npy',np.array([th,*lo,*hi]))
# reproject box corners onto a few images for visual check
def qvec2rot(q):
    w,x,y,z=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
K=np.array([[1213.246,0,960],[0,1221.107,540],[0,0,1]])
lines=[l for l in open('sparse/0/images.txt') if not l.startswith('#')]
imgs={}
for i in range(0,len(lines),2):
    a=lines[i].split(); imgs[a[9]]=(qvec2rot(list(map(float,a[1:5]))),np.array(list(map(float,a[5:8]))))
z0,z1=-1.99,-0.49
corners=[]
for zz in (z0,z1):
    for (qa,qb) in [(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]:
        xy=R.T@np.array([qa,qb]); corners.append(cen+xy[0]*e1+xy[1]*e2+zz*up)
corners=np.array(corners)
edges=[(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
import glob,os
for name,(Rm,t) in imgs.items():
    d=int(name[:3])
    if d not in (0,24,48,72): continue
    img=cv2.imread('images/'+name)
    X=(Rm@corners.T).T+t; uv=(K@X.T).T; uv=uv[:,:2]/uv[:,2:]
    for a,b in edges: cv2.line(img,tuple(uv[a].astype(int)),tuple(uv[b].astype(int)),(0,0,255),3)
    cv2.imwrite('check_%03d.jpg'%d,cv2.resize(img,(960,540)))
print('wrote checks')
