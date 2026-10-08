"""PREVIZ v2 -- colour-coded 3D primitive previz for Video-to-Video.
Implements CEO-51 verbatim: "three project documents, the same role word glowing red,
rising and converging to one place" -- and it must HAPPEN ON SCREEN.
Rules from the CEO-53 tutorial: (1) primitives only (2) colour-coded (3) roles explicit.
"""
import bpy, time, math
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene


def flat(name, rgb):
    """emission-only flat colour -> no light transport, samples=1 is enough"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*rgb, 1); e.inputs[1].default_value = 1.0
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def texflat(name, path):
    """emission material driven by an image texture -> the GLYPH becomes structure.
    Lesson 162: what is not delivered as structure is not controlled."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(path)
    tx.interpolation = 'Closest'
    tx.extension = 'EXTEND'
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[1].default_value = 1.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], tx.inputs['Vector'])
    nt.links.new(tx.outputs['Color'], e.inputs[0])
    nt.links.new(tx.outputs['Alpha'], mx.inputs[0])   # alpha drives the mix
    nt.links.new(tr.outputs[0], mx.inputs[1])         # 0 -> transparent
    nt.links.new(e.outputs[0], mx.inputs[2])          # 1 -> glowing glyph
    nt.links.new(mx.outputs[0], o.inputs[0])
    m.blend_method = 'BLEND'
    return m


def add_tex(name, loc, sc, path):
    """flat plane carrying the Korean word, UV-unwrapped so the glyph reads correctly"""
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc)
    ob = bpy.context.object; ob.scale = sc; ob.name = name
    ob.data.materials.append(texflat(name, path))
    return ob


def add(name, kind, loc, sc, col):
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, location=loc)
    ob = bpy.context.object; ob.scale = sc; ob.name = name
    ob.data.materials.append(flat(name, col))
    return ob


# ---- set: oversized so the camera NEVER sees past the backdrop (fix v1 black gaps)
add("desk",  "cube", (0, 0, -0.15), (16, 12, 0.15), (0.10, 0.10, 0.10))
add("wall",  "cube", (0, 5.2, 3.2),  (16, 0.12, 4.4), (0.34, 0.17, 0.05))
add("wallL", "cube", (-7.0, 0, 3.2), (0.12, 12, 4.4), (0.30, 0.15, 0.05))
add("wallR", "cube", (7.0, 0, 3.2),  (0.12, 12, 4.4), (0.30, 0.15, 0.05))

# ---- the three project documents  (role = the THREE portfolio projects)
DOC = [("docA", (-1.75, -0.6, 0.05), (1, 0, 1)),   # MAGENTA -> project 1 document
       ("docB", (0.00, -0.6, 0.05),  (0, 1, 1)),   # CYAN    -> project 2 document
       ("docC", (1.75, -0.6, 0.05),  (1, 1, 0))]   # YELLOW  -> project 3 document
for n, loc, col in DOC:
    add(n, "cube", loc, (0.62, 0.82, 0.02), col)

add("cup", "cyl", (3.1, 0.5, 0.25), (0.28, 0.28, 0.25), (1, 0, 0))

F = 72
S.frame_start = 1; S.frame_end = F


def ease(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


# ---- CEO-51: the repeated ROLE WORD lifts off each document and converges
#      -> three RED markers rise and travel to ONE point. Pure geometry, no text.
CONV = (0.0, -0.30, 0.92)
mk = []
WORD_TEX = "/home/user/lf/r3d/mk_word_a.png"
for i, (n, loc, col) in enumerate(DOC):
    # the marker is now a TEXTURED plane: the Korean glyph itself is structure
    m = add_tex("mark%d" % i, (loc[0], loc[1] - 0.10, loc[2] + 0.032),
                (0.30, 0.15, 1.0), WORD_TEX)
    mk.append((m, (loc[0], loc[1] - 0.10, loc[2] + 0.032)))
for f in range(1, F + 1):
    u = (f - 1) / (F - 1)
    # markers stay flat on the documents for the first 40% -> a real HOLD, then converge
    v = ease(max(0.0, (u - 0.40) / 0.60))
    for m, loc in mk:
        m.location = (loc[0] + (CONV[0] - loc[0]) * v,
                      loc[1] + (CONV[1] - loc[1]) * v,
                      loc[2] + (CONV[2] - loc[2]) * v)
        m.scale = (0.30 * (1 + 0.9 * v), 0.15 * (1 + 0.9 * v), 1.0)
        # keep the glyph facing the camera as it lifts off the page
        m.rotation_euler = (v * 1.15, 0.0, 0.0)
        m.keyframe_insert("rotation_euler", frame=f)
        m.keyframe_insert("location", frame=f)
        m.keyframe_insert("scale", frame=f)

# ---- camera: descend + sweep left->right, tightening on the convergence point
bpy.ops.object.camera_add(location=(-3.2, -6.5, 3.0))
cam = bpy.context.object; S.camera = cam
cam.data.lens = 34.0
tgt = bpy.data.objects.new("tgt", None)
bpy.context.collection.objects.link(tgt)
for f in range(1, F + 1):
    u = (f - 1) / (F - 1); e = ease(u)
    a = math.radians(-52 + 104 * e)
    r = 8.4 - 3.4 * e
    h = 4.2 - 2.5 * e
    cam.location = (r * math.sin(a), -r * math.cos(a), h)
    cam.keyframe_insert("location", frame=f)
    # aim drifts from the documents up to the convergence point
    tgt.location = (0.0, -0.55 + 0.20 * e, 0.15 + 0.62 * ease(max(0.0, (u - 0.40) / 0.60)))
    tgt.keyframe_insert("location", frame=f)
c = cam.constraints.new('TRACK_TO')
c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'
S.cycles.samples = 1; S.cycles.max_bounces = 0; S.cycles.use_denoising = False
S.render.resolution_x = 832; S.render.resolution_y = 468
S.render.image_settings.file_format = 'PNG'
S.render.filepath = '/home/user/lf/r3d/_pv5/m_'
t = time.time(); bpy.ops.render.render(animation=True); el = time.time() - t
print("PREVIZ5 %d frames  %.1fs  (%.3f s/frame)  setup %.1fs"
      % (F, el, el / F, t - t0), flush=True)
