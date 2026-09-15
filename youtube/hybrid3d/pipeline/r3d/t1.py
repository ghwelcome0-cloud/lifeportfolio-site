import bpy, time, sys
t=time.time()
S=bpy.context.scene
# clear
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
# cube + plane
bpy.ops.mesh.primitive_cube_add(size=2, location=(0,0,1))
bpy.ops.mesh.primitive_plane_add(size=20)
# light
bpy.ops.object.light_add(type='SUN', location=(4,-4,8)); bpy.context.object.data.energy=5
# camera
bpy.ops.object.camera_add(location=(7,-7,5), rotation=(1.1,0,0.785))
S.camera=bpy.context.object
S.render.engine='CYCLES'
S.cycles.device='CPU'
S.cycles.samples=16
S.render.resolution_x=640; S.render.resolution_y=360
S.render.filepath='/home/user/lf/r3d/t1.png'
S.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True)
print("ELAPSED %.1fs"%(time.time()-t), flush=True)
