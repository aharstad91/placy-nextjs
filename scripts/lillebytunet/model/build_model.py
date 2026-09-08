"""Bygger Hus B som OBJ + teksturer fra COLMAP-ramme og valgte kameraer.
Modellramme: meter, origo = fotavtrykk-senter på bakkenivå, +X = a-akse, +Y = opp, -Z = b-akse (glTF-konvensjon).
"""
import numpy as np, cv2, os, json
OUT='../model'; os.makedirs(OUT,exist_ok=True)
SCALE=12.4   # m per COLMAP-enhet: 0.25 enheter/etasje * 3.1 m (ANSLAG)
FLOOR=0.25
F=np.load('frame.npy'); e1,e2,up,cen=F
th,a0,b0,a1,b1=np.load('rect.npy'); t=np.radians(th); R2=np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]])
Z0=-1.99; Z5=Z0+5*FLOOR; Z6=-0.49
ca,cb=(a0+a1)/2,(b0+b1)/2
# toppetasje (målt fra punktsky): inntrukket på b- (~0.5) og a+ (~0.12)
T_a0,T_a1,T_b0,T_b1=a0,0.513,-0.794,b1
K=np.array([[1213.246,0,960],[0,1221.107,540],[0,0,1]])
def qvec2rot(q):
    w_,x,y,z=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w_),2*(x*z+y*w_)],[2*(x*y+z*w_),1-2*(x*x+z*z),2*(y*z-x*w_)],[2*(x*z-y*w_),2*(y*z+x*w_),1-2*(x*x+y*y)]])
lines=[l for l in open('sparse/0/images.txt') if not l.startswith('#')]
cams={}
for i in range(0,len(lines),2):
    a=lines[i].split(); cams[int(a[9][:3])]=(a[9],qvec2rot(list(map(float,a[1:5]))),np.array(list(map(float,a[5:8]))))
def world(a,b,z):
    xy=R2.T@np.array([a,b]); return cen+xy[0]*e1+xy[1]*e2+z*up
def model(a,b,z):  # -> glTF meter coords
    return np.array([(a-ca)*SCALE,(z-Z0)*SCALE,-(b-cb)*SCALE])
PPM=60  # px per meter
def tex_from_cam(quad_abz,cam,name,size_wh):
    nm,Rm,tv=cams[cam]; img=cv2.imread('images/'+nm)
    C3=np.array([world(*q) for q in quad_abz]); X=(Rm@C3.T).T+tv; uv=(K@X.T).T; uv=(uv[:,:2]/uv[:,2:]).astype(np.float32)
    W,H=size_wh; dst=np.array([[0,H],[W,H],[W,0],[0,0]],np.float32)
    Hm=cv2.getPerspectiveTransform(uv,dst); tex=cv2.warpPerspective(img,Hm,(W,H),flags=cv2.INTER_LINEAR)
    cv2.imwrite(f'{OUT}/{name}.jpg',tex,[cv2.IMWRITE_JPEG_QUALITY,88]); return f'{name}.jpg'
V=[];VT=[];Fc=[];mats={}
def quad(corners_abz,texname,cam,ref_uv_dst=None):
    """corners: BL,BR,TR,TL sett fra utsiden. Lager tekstur + 2 trekanter."""
    p=[np.array(c) for c in corners_abz]
    w=np.linalg.norm(model(*p[1])-model(*p[0])); h=np.linalg.norm(model(*p[3])-model(*p[0]))
    W,H=max(8,int(w*PPM)),max(8,int(h*PPM))
    tf=tex_from_cam(corners_abz,cam,texname,(W,H)); mats[texname]=tf
    base=len(V)
    P=[model(*c) for c in p]
    # Sikre at normalen peker UT fra bygget (Google lyssetter etter normal; innovervendt = svart flate)
    n=np.cross(P[1]-P[0],P[3]-P[0]); ctr=np.array([0.0,(Z6-Z0)*SCALE/2,0.0]); fc=sum(P)/4; outward=fc-ctr
    if abs(n[1])>0.9*np.linalg.norm(n): outward=np.array([0,1.0,0])   # horisontale flater: opp
    order=[0,1,2,3] if np.dot(n,outward)>0 else [0,3,2,1]
    uvs=[(0,0),(1,0),(1,1),(0,1)]
    for i in order: V.append(P[i]); VT.append(uvs[i])
    Fc.append((texname,[base,base+1,base+2],[base,base+1,base+2])); Fc.append((texname,[base,base+2,base+3],[base,base+2,base+3]))
# --- hovedkropp etasje 1-5 (4 fasader). Kamera: head-on per fasade.
quad([(a0,b1,Z0),(a0,b0,Z0),(a0,b0,Z5),(a0,b1,Z5)],'body_Aminus',54)
quad([(a1,b0,Z0),(a1,b1,Z0),(a1,b1,Z5),(a1,b0,Z5)],'body_Aplus',5)
quad([(a0,b0,Z0),(a1,b0,Z0),(a1,b0,Z5),(a0,b0,Z5)],'body_Bminus',78)
quad([(a1,b1,Z0),(a0,b1,Z0),(a0,b1,Z5),(a1,b1,Z5)],'body_Bplus',30)
# --- toppetasje (inntrukket)
quad([(T_a0,T_b1,Z5),(T_a0,T_b0,Z5),(T_a0,T_b0,Z6),(T_a0,T_b1,Z6)],'top_Aminus',54)
quad([(T_a1,T_b0,Z5),(T_a1,T_b1,Z5),(T_a1,T_b1,Z6),(T_a1,T_b0,Z6)],'top_Aplus',5)
quad([(T_a0,T_b0,Z5),(T_a1,T_b0,Z5),(T_a1,T_b0,Z6),(T_a0,T_b0,Z6)],'top_Bminus',78)
quad([(T_a1,T_b1,Z5),(T_a0,T_b1,Z5),(T_a0,T_b1,Z6),(T_a1,T_b1,Z6)],'top_Bplus',30)
# --- horisontale flater: terrasse på etasje-5-tak (hele rektangelet minus toppboks -> to L-deler forenklet til 2 rektangler), og hovedtak
# terrasse b- ende (full bredde a0..a1, b0..T_b0)
quad([(a0,b0,Z5),(a1,b0,Z5),(a1,T_b0,Z5),(a0,T_b0,Z5)],'terrace_Bminus',78)
# terrasse a+ side (T_a1..a1, T_b0..b1)
quad([(T_a1,T_b0,Z5),(a1,T_b0,Z5),(a1,b1,Z5),(T_a1,b1,Z5)],'terrace_Aplus',5)
# hovedtak
quad([(T_a0,T_b0,Z6),(T_a1,T_b0,Z6),(T_a1,T_b1,Z6),(T_a0,T_b1,Z6)],'roof',5)
# --- skriv OBJ/MTL
with open(f'{OUT}/husB.mtl','w') as m:
    for name,tf in mats.items(): m.write(f'newmtl {name}\nKd 1 1 1\nmap_Kd {tf}\n\n')
with open(f'{OUT}/husB.obj','w') as o:
    o.write('mtllib husB.mtl\n')
    for v in V: o.write('v %.4f %.4f %.4f\n'%tuple(v))
    for vt in VT: o.write('vt %.4f %.4f\n'%vt)
    cur=None
    for mat,vi,ti in Fc:
        if mat!=cur: o.write(f'usemtl {mat}\n'); cur=mat
        o.write('f '+' '.join(f'{a+1}/{b+1}' for a,b in zip(vi,ti))+'\n')
dims={'scale_m_per_unit':SCALE,'footprint_m':[(a1-a0)*SCALE,(b1-b0)*SCALE],'height_m':(Z6-Z0)*SCALE,'body_height_m':(Z5-Z0)*SCALE,
      'top_setback_m':{'b_minus':(T_b0-b0)*SCALE,'a_plus':(a1-T_a1)*SCALE},'cams':{'A-':54,'A+':5,'B-':78,'B+':30},
      'note':'A+ = balkongside (fasadeplan = balkongfront). Skala anslått fra etasjehøyde 3.1 m.'}
json.dump(dims,open(f'{OUT}/husB_dims.json','w'),indent=1); print(json.dumps(dims,indent=1)); print('verts',len(V),'tris',len(Fc))
