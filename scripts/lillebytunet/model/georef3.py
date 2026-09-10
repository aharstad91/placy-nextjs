import numpy as np, json, math, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
exec(open('georef2.py').read().split('# similarity')[0])   # gjenbruk: P,bpts,rect_fit,sel,ground,S1,S2,osm helpers, o1,o2,g1,g2
# renere utvalg: ekskluder punkter som tilhører nybyggene, og bruk 4-etasjers høydebånd
allb=np.vstack([bpts[k] for k in 'ABCD'])
from scipy.spatial import cKDTree
tree=cKDTree(allb[:,:2])
def sel2(box,zlo,zhi):
    m=(P[:,0]>box[0])&(P[:,0]<box[1])&(P[:,1]>box[2])&(P[:,1]<box[3])&(P[:,2]>zlo)&(P[:,2]<zhi); Q=P[m]
    d,_=tree.query(Q[:,:2]); return Q[d>0.04,:2]
zlo=ground+0.12; zhi=ground+0.55
S1=sel2((-0.7,0.7,1.05,1.95),zlo,zhi); S2=sel2((0.7,2.2,0.55,1.7),zlo,zhi)
c1,s1,d1,_=rect_fit(S1); c2,s2,d2,_=rect_fit(S2)
print('S1 n',len(S1),'c',c1.round(3),'size',s1.round(3),'| S2 n',len(S2),'c',c2.round(3),'size',s2.round(3))
# rotasjon fra begge langakser (gjennomsnitt), skala fra senteravstand, translasjon fra S1
def bearing(v): return math.degrees(math.atan2(v[0],v[1]))%180
rot_axes=[]
for d,od in ((d1,od1),(d2,od2)):
    diff=(bearing(od)-bearing(d)+90)%180-90; rot_axes.append(diff)
print('rotasjon fra akser (deg, +=med klokka):',np.round(rot_axes,1))
v=c2-c1; w=o2-o1; rot_c=(math.degrees(math.atan2(w[0],w[1]))-math.degrees(math.atan2(v[0],v[1]))); print('rotasjon fra sentre:',round(rot_c,1))
scale=np.linalg.norm(w)/np.linalg.norm(v); print('skala m/enhet %.2f'%scale)
rot=math.radians(np.mean(rot_axes+[rot_c]))
Rm=np.array([[math.cos(rot),math.sin(rot)],[-math.sin(rot),math.cos(rot)]])  # roterer med klokka i (east,north)... verifiser under
# Bygg transform: frame(x,y) -> (east,north). Test begge fortegn og velg den som minimerer feil i S2-senter
best=None
for sgn in (1,-1):
    r=sgn*rot; Rt=np.array([[math.cos(r),-math.sin(r)],[math.sin(r),math.cos(r)]])
    f=lambda q: o1+scale*(Rt@(q-c1)); err=np.linalg.norm(f(c2)-o2); 
    if best is None or err<best[0]: best=(err,Rt)
err,Rt=best; f2en=lambda q: o1+scale*(Rt@(q-c1)); print('S2-senterfeil etter transform: %.1f m'%err, '| +y bearing %.1f'%(math.degrees(math.atan2(*(Rt@np.array([0,1]))))%360))
# plott
fig,ax=plt.subplots(figsize=(12,10)); m=(P[:,2]>zlo)&(np.abs(P[:,0])<3)&(P[:,1]>-1)&(P[:,1]<2.5)
E=np.array([f2en(q) for q in P[m,:2]]); ax.scatter(E[:,0],E[:,1],s=0.4,c='0.6')
for bn,col in zip('ABCD',['r','m','c','y']): E=np.array([f2en(q) for q in bpts[bn][:,:2]]); ax.scatter(E[:,0],E[:,1],s=0.6,c=col)
for S,col in ((S1,'b'),(S2,'g')): E=np.array([f2en(q) for q in S]); ax.scatter(E[:,0],E[:,1],s=0.6,c=col)
for wid in (1206556797,1206556798,1422910836,901274828,958926999):
    w=[x for x in osm if x['id']==wid][0]; g=np.array([ll2en(p['lat'],p['lon']) for p in w['geometry']]); ax.plot(g[:,0],g[:,1],'k-',lw=1.5)
ax.plot(0,0,'r+',ms=15); ax.set_aspect('equal'); ax.grid(True); ax.set_xlabel('east m'); ax.set_ylabel('north m'); plt.savefig('georef_check.png',dpi=80,bbox_inches='tight')
# Hus B
B=bpts['B']; zb=np.percentile(B[:,2],[1,99]); mid=(B[:,2]>zb[0]+0.15*(zb[1]-zb[0]))&(B[:,2]<zb[0]+0.75*(zb[1]-zb[0]))
cB,sB,dB,_=rect_fit(B[mid,:2]); top=B[:,2]>zb[0]+0.85*(zb[1]-zb[0]); shift=np.dot(B[top,:2].mean(0)-cB,dB)
bplus=dB if shift>0 else -dB; be=Rt@bplus; heading=math.degrees(math.atan2(be[0],be[1]))%360
latB,lonB=en2ll(*f2en(cB)); H=(zb[1]-zb[0])*scale
print('HUS B: lat %.6f lng %.6f heading(+Y) %.1f  size %s m  height %.1f m  balkong mot %.0f'%(latB,lonB,heading,(np.sort(sB)*scale).round(1),H,(heading+90)%360))
json.dump({'husB':{'lat':latB,'lng':lonB,'heading_plusY':heading,'size_m':(np.sort(sB)*scale).tolist(),'height_m':H,'balcony_bearing':(heading+90)%360},
 'scale_m_per_unit_oversikt':scale,'plus_y_bearing':math.degrees(math.atan2(*(Rt@np.array([0,1]))))%360,'s2_center_error_m':err,'rot_from_axes_deg':rot_axes,'rot_from_centers_deg':rot_c},open('georef.json','w'),indent=1)
