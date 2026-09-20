import layer, subprocess, os
# narrative move: camera drifts left->right across the desk while pushing in,
# so near documents sweep past the far corkboard = wall/slab parallax
el=layer.render("/home/user/lf/land38/S19.png","new_S19.mp4",72,
    path=[(-0.42,0.42),(0.14,-0.11),(0.00,0.20)],focus=(0.42,0.62),
    strength=560.0,crop=0.76,nlayer=7,size=(1280,720))
print("new_S19 %.1fs"%el,flush=True)
