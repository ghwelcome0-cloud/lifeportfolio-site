import bpy, time, math
t0=time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
def flat(name,rgb):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    e=nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value=(*rgb,1); e.inputs[1].default_value=1.0
    o=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o.inputs[0])
    return m
# colour-coded primitives = the tutorial's rule 1+2
SPEC=[("desk","cube",(0,0,-0.15),(6,4,0.15),(0.10,0.10,0.10)),
      ("docA","cube",(-1.6,-0.6,0.05),(0.55,0.75,0.02),(1,0,1)),
      ("docB","cube",( 0.0,-0.6,0.05),(0.55,0.75,0.02),(0,1,1)),
      ("docC","cube",( 1.6,-0.6,0.05),(0.55,0.75,0.02),(1,1,0)),
      ("board","cube",(0,2.6,1.3),(6,0.12,1.3),(0.35,0.18,0.05)),
      ("cup","cyl",(2.5,0.2,0.25),(0.28,0.28,0.25),(1,0,0))]
for n,k,loc,sc,col in SPEC:
    if k=="cube": bpy.ops.mesh.primitive_cube_add(size=2,location=loc)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=24,location=loc)
    ob=bpy.context.object; ob.scale=sc; ob.name=n
    ob.data.materials.append(flat(n,col))
bpy.ops.object.camera_add(location=(-3.2,-6.5,3.0))
cam=bpy.context.object; S.camera=cam
tgt=bpy.data.objects.new("tgt",None); bpy.context.collection.objects.link(tgt); tgt.location=(0,-0.4,0.2)
c=cam.constraints.new('TRACK_TO'); c.target=tgt; c.track_axis='TRACK_NEGATIVE_Z'; c.up_axis='UP_Y'
# camera arc: left -> right sweeping past the near documents, descending
F=48
S.frame_start=1; S.frame_end=F
for f in range(1,F+1):
    u=(f-1)/(F-1); a=math.radians(-58+116*u)
    r=7.2-2.6*u; h=3.4-1.9*u
    cam.location=(r*math.sin(a), -r*math.cos(a), h)
    cam.keyframe_insert("location", frame=f)
S.render.engine='CYCLES'; S.cycles.device='CPU'
S.cycles.samples=1; S.cycles.max_bounces=0; S.cycles.use_denoising=False
S.render.film_transparent=False
S.render.resolution_x=832; S.render.resolution_y=468
S.render.image_settings.file_format='PNG'
S.render.filepath='/home/user/lf/r3d/_pv/f_'
t=time.time(); bpy.ops.render.render(animation=True)
el=time.time()-t
print("PREVIZ %d frames  %.1fs  (%.3f s/frame)  setup %.1fs"%(F,el,el/F,t-t0),flush=True)
