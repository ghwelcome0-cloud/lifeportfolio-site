import subprocess, os
SRC="a6_pilot.mp4"; OUT="_a6tx/sheet"
os.makedirs(OUT, exist_ok=True)
# mid window of each seam = frames [P-n, P) where P is the cumulative prev length
SEAMS=[("S01 through_page",71,18),("S02 inset_descent",249,20),
       ("S03 zoom_match",299,18),("S04 zoom_match",353,18),
       ("S05 through_page",411,18),("S06 inset_descent",514,20),
       ("S07 zoom_match",615,20),("S08 zoom_match",671,20),
       ("S09 through_page",865,20),("S10 portal_return",1038,22)]
rows=[]
for i,(lab,P,n) in enumerate(SEAMS,1):
    a,b = P-n, P-1
    picks=[a, a+n//2, b]
    tiles=[]
    for j,f in enumerate(picks):
        p="%s/s%02d_%d.png"%(OUT,i,j)
        subprocess.run(["ffmpeg","-y","-v","error","-i",SRC,
            "-vf","select=eq(n\\,%d),scale=560:-1"%f,"-frames:v","1",p],check=True)
        tiles.append(p)
    r="%s/row%02d.png"%(OUT,i)
    subprocess.run(["convert"]+tiles+["+append","-bordercolor","white","-border","2",r],check=True)
    rows.append(r); print("row %d %s frames %s"%(i,lab,picks),flush=True)
subprocess.run(["convert"]+rows+["-append","_a6tx/sheet_a6.png"],check=True)
print("SHEET done")
