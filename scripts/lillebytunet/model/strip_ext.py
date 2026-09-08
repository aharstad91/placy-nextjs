"""Post-prosess GLB for Google Maps 3D Model3DElement:
1) fjern alle glTF-utvidelser (Google støtter ingen),
2) gjør materialene selvlysende (emissiveTexture = baseColor, baseColorFactor svart) slik at
   renderens innbakte lys vises flatt uansett Googles solretning (ellers blir skyggesider helt svarte).
Bruk: strip_ext.py fil.glb [--lit]  (--lit beholder vanlig PBR-lyssetting)"""
import struct,json,sys
p=sys.argv[1]; lit='--lit' in sys.argv; b=bytearray(open(p,'rb').read())
L=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+L])
for m in j.get('materials',[]):
    m.pop('extensions',None)
    pbr=m.get('pbrMetallicRoughness',{})
    if not lit and 'baseColorTexture' in pbr:
        m['emissiveTexture']=dict(pbr['baseColorTexture']); m['emissiveFactor']=[1,1,1]
        pbr['baseColorFactor']=[0,0,0,1]; pbr['metallicFactor']=0; pbr['roughnessFactor']=1
j.pop('extensionsUsed',None); j.pop('extensionsRequired',None)
s=json.dumps(j,separators=(',',':')).encode(); s+=b' '*((4-len(s)%4)%4)
rest=b[20+L:]; out=b[:12]+struct.pack('<I',len(s))+b'JSON'+s+rest
out[8:12]=struct.pack('<I',len(out)); open(p,'wb').write(out)
print('ok: extensions',json.loads(out[20:20+len(s)]).get('extensionsUsed'),'emissive' if not lit else 'lit')
