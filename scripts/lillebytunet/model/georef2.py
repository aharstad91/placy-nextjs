import numpy as np, json, cv2, math
P=np.load('pts.npy'); bpts=np.load('bpts.npy',allow_pickle=True).item()
def rect_fit(Q2, lo_p=3, hi_p=97):
    best=None
    for th in np.arange(0,180,0.5):
        t=np.radians(th); R=np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]]); Qr=Q2@R.T
        lo=np.percentile(Qr,lo_p,axis=0); hi=np.percentile(Qr,hi_p,axis=0); area=np.prod(hi-lo)
        if best is None or area<best[0]: best=(area,th,lo,hi,R)
    area,th,lo,hi,R=best; c=R.T@((lo+hi)/2); size=hi-lo
    # long axis direction (unit vector in frame coords)
    ax=0 if size[0]>=size[1] else 1; dirv=R.T@np.eye(2)[ax]
    return c,size,dirv,th
# neighbours: roof-band points in bounding boxes (read from topdown.png)
def sel(box,zmin):
    m=(P[:,0]>box[0])&(P[:,0]<box[1])&(P[:,1]>box[2])&(P[:,1]<box[3])&(P[:,2]>zmin); return P[m,:2]
ground=np.percentile(P[:,2],5)  # grov bakke
print('ground z ~',ground)
S1=sel((-0.6,0.6,1.1,1.9),ground+0.15); S2=sel((0.7,2.1,0.5,1.65),ground+0.15)
c1,s1,d1,_=rect_fit(S1); c2,s2,d2,_=rect_fit(S2)
print('S1 n',len(S1),'center',c1.round(3),'size',s1.round(3)); print('S2 n',len(S2),'center',c2.round(3),'size',s2.round(3))
# OSM footprints -> local metric (east,north) relative to site point
lat0,lon0=63.4412384,10.4406095; R=6371000
def ll2en(lat,lon): return np.array([(lon-lon0)*math.cos(math.radians(lat0))*math.pi/180*R,(lat-lat0)*math.pi/180*R])
def en2ll(e,n): return lat0+n/(math.pi/180*R), lon0+e/(math.cos(math.radians(lat0))*math.pi/180*R)
osm=json.load(open('../api/osm_buildings.json'))['elements']
def osm_rect(wid):
    w=[x for x in osm if x['id']==wid][0]; g=np.array([ll2en(p['lat'],p['lon']) for p in w['geometry']][:-1])
    c,size,d,_=rect_fit(g,0,100); return c,size,d,g
o1,os1,od1,g1=osm_rect(1206556797); o2,os2,od2,g2=osm_rect(1206556798)
print('OSM S1 center',o1.round(1),'size',os1.round(1),'long-axis bearing %.1f'%(math.degrees(math.atan2(od1[0],od1[1]))%180))
print('OSM S2 center',o2.round(1),'size',os2.round(1),'long-axis bearing %.1f'%(math.degrees(math.atan2(od2[0],od2[1]))%180))
# similarity from two centers: frame (x,y) -> (east,north)
v=c2-c1; w=o2-o1; scale=np.linalg.norm(w)/np.linalg.norm(v); rot=math.atan2(w[1],w[0])-math.atan2(v[1],v[0])
Rm=np.array([[math.cos(rot),-math.sin(rot)],[math.sin(rot),math.cos(rot)]])
def f2en(q): return o1+scale*(Rm@(q-c1))
print('scale m/unit %.2f  frame +y bearing %.1f deg'%(scale, math.degrees(math.atan2(*(Rm@np.array([0,1]))[::-1]))%360))
# verify with sizes and axes
for nm,s,d,os_,od in (('S1',s1,d1,os1,od1),('S2',s2,d2,os2,od2)):
    de=Rm@d; print(nm,'size render*scale',(np.sort(s)*scale).round(1),'osm',np.sort(os_).round(1),'axis bearing render %.1f osm %.1f'%(math.degrees(math.atan2(de[0],de[1]))%180, math.degrees(math.atan2(od[0],od[1]))%180))
# Hus B
B=bpts['B']; zb=np.percentile(B[:,2],[1,99]); mid=(B[:,2]>zb[0]+0.15*(zb[1]-zb[0]))&(B[:,2]<zb[0]+0.75*(zb[1]-zb[0]))
cB,sB,dB,_=rect_fit(B[mid,:2]); top=B[:,2]>zb[0]+0.85*(zb[1]-zb[0]); cT=B[top,:2].mean(0)
# which end is the top floor shifted towards: along long axis
shift=np.dot(cT-cB,dB); print('top-floor centroid shift along long axis (units):',round(shift,3),'-> B+ end is',('+' if shift>0 else '-'),'dB')
bplus_dir=dB if shift>0 else -dB   # retning mot B+ (toppetasje flush-enden), dvs. modellens +Y
be=Rm@bplus_dir; heading=math.degrees(math.atan2(be[0],be[1]))%360
enB=f2en(cB); latB,lonB=en2ll(*enB)
print('Hus B: center lat %.6f lon %.6f  size m %s  height m %.1f  heading(+Y=B+) %.1f'%(latB,lonB,(np.sort(sB)*scale).round(1),(zb[1]-zb[0])*scale,heading))
# balcony side: A+ is +X in model = +90deg from +Y heading -> bearing
print('balkongside (A+) vender mot bearing %.0f'%((heading+90)%360))
for bn in 'ACD':
    Q=bpts[bn]; z=np.percentile(Q[:,2],[1,99]); m=(Q[:,2]>z[0]+0.15*(z[1]-z[0]))&(Q[:,2]<z[0]+0.75*(z[1]-z[0])); c,s,d,_=rect_fit(Q[m,:2]); la,lo=en2ll(*f2en(c)); de=Rm@d
    print('Hus',bn,'center %.6f %.6f size %s h %.1f axis %.0f'%(la,lo,(np.sort(s)*scale).round(1),(z[1]-z[0])*scale,math.degrees(math.atan2(de[0],de[1]))%180))
json.dump({'husB':{'lat':latB,'lng':lonB,'heading_plusY':heading,'size_m':(np.sort(sB)*scale).tolist(),'height_m':float((zb[1]-zb[0])*scale)},'scale_m_per_unit_oversikt':scale,'frame_plus_y_bearing':math.degrees(math.atan2(*(Rm@np.array([0,1]))[::-1]))%360},open('georef.json','w'),indent=1)
