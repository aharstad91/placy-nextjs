import bpy, os, math
d=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(d,'husB.glb'))
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sc.display.shading.light='FLAT'; sc.display.shading.color_type='TEXTURE'
sc.render.resolution_x=800; sc.render.resolution_y=600
cam=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co; cam.lens=35
tgt=(0,9,0)
for i,az in enumerate([30,120,210,300]):
    r=55; a=math.radians(az); co.location=(r*math.sin(a), 35, r*math.cos(a))
    dx,dy,dz=[t-c for t,c in zip(tgt,co.location)]
    co.rotation_euler=(math.atan2(math.hypot(dx,dz),-dy), 0, math.atan2(-dx,-dz)) if False else (0,0,0)
    import mathutils
    direction=mathutils.Vector((dx,dy,dz)); co.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(d,f'render_{i}.png'); bpy.ops.render.render(write_still=True)
print('RENDERED')
