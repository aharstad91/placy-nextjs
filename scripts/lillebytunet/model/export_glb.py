import bpy, sys, os
d=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=os.path.join(d,'husB.obj'), forward_axis='NEGATIVE_Z', up_axis='Y')
for o in bpy.data.objects:
    if o.type=='MESH':
        o.name='HusB'; o.select_set(True); bpy.context.view_layer.objects.active=o
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # bak Z-opp inn i vertices (Google leser GLB som Z-opp)
# ZUP_FIX: Google Maps 3D leser GLB som Z-opp (+X øst, +Y nord). Roter så modellens opp (Blender Z) havner i GLB Z ved export_yup=False.
# glTF export: ren GLB, ingen Draco, JPEG-teksturer
bpy.ops.export_scene.gltf(filepath=os.path.join(d,'husB.glb'), export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
    export_draco_mesh_compression_enable=False, export_yup=False, export_apply=True, export_materials='EXPORT', export_normals=True, export_texcoords=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(d,'husB.blend'))
print('EXPORTED')
