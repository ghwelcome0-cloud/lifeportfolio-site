import bpy, time
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
def mat(name,col,emit=3.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    e=nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value=col; e.inputs[1].default_value=emit
    o=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o.inputs[0])
    return m
# 3 stacked document planes at different depths  = parallax test
for i,(z,c) in enumerate([(0.0,(0.9,0.9,0.85,1)),(1.2,(0.85,0.88,0.95,1)),(2.4,(0.95,0.85,0.85,1))]):
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0,0,z), rotation=(0,0,0))
    bpy.context.object.data.materials.append(mat("m%d"%i,c,2.0))
bpy.ops.object.camera_add(location=(3,-6,4), rotation=(1.05,0,0.45))
S.camera=bpy.context.object
S.render.engine='CYCLES'; S.cycles.device='CPU'
S.cycles.samples=8
S.cycles.max_bounces=0
S.cycles.use_denoising=True
S.render.resolution_x=1280; S.render.resolution_y=720
S.render.film_transparent=False
S.render.filepath='/home/user/lf/r3d/t3.png'
t=time.time(); bpy.ops.render.render(write_still=True)
print("T3 720p emission 8spp %.1fs"%(time.time()-t), flush=True)
