import bpy, time
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
print("engines:", [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items], flush=True)
for i,z in enumerate([0.0,1.2,2.4]):
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0,0,z))
bpy.ops.object.camera_add(location=(3,-6,4), rotation=(1.05,0,0.45))
S.camera=bpy.context.object
try:
    S.render.engine='BLENDER_EEVEE_NEXT'
except Exception as e:
    S.render.engine='BLENDER_EEVEE'
print("engine =", S.render.engine, flush=True)
S.render.resolution_x=1280; S.render.resolution_y=720
S.render.filepath='/home/user/lf/r3d/t4.png'
t=time.time()
bpy.ops.render.render(write_still=True)
print("T4 EEVEE 720p %.2fs"%(time.time()-t), flush=True)
