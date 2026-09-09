"""Blender: import Google Z-up GLB, save editable source and optional overview renders.

blender -b --python blender_quality.py -- --input model.glb --output-dir folder [--render]
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
# glTF importer interprets Y-up and rotates +90X. Undo only that conversion:
# the serialized Google model was already Z-up, and should stay Z-up in Blender.
for obj in list(bpy.context.scene.objects):
    if obj.parent is None:
        obj.matrix_world=Matrix.Rotation(-math.pi/2,4,'X')@obj.matrix_world
bpy.context.view_layer.update()
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.render.resolution_x=1200;scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
scene.world=bpy.data.worlds.new('Neutral daylight')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.7,.7,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
sun=bpy.data.lights.new('Sun','SUN');sun.energy=2
sun_object=bpy.data.objects.new('Sun',sun);scene.collection.objects.link(sun_object)
sun_object.rotation_euler=(.6,-.5,-.7)
camera=bpy.data.cameras.new('Inspection');cam=bpy.data.objects.new('Inspection',camera)
scene.collection.objects.link(cam);scene.camera=cam;camera.lens=48
target=Vector((0,0,10))
for index,angle in enumerate([35,125,215,305]):
    radians=math.radians(angle)
    cam.location=(48*math.cos(radians),48*math.sin(radians),35)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    if args.render:
        scene.render.filepath=str((args.output_dir/f'check-{index}.png').resolve())
        bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str((args.output_dir/'husB-v2.blend').resolve()))
print('Editable Z-up source saved:',args.output_dir/'husB-v2.blend')
