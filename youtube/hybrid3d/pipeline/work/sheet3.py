"""Contact sheet for CEO pre-approval of the ACT3~8 plates (CEO-16 gate).

Grouped by role rather than by number, because the three roles are judged by
different criteria: panels carry Korean text and are judged on letterform
quality, sequential plates are judged on whether the un-revealed rows really are
empty, and scene plates are judged on whether the world stayed real (no SF).
"""
import os, cv2, numpy as np

LAND = "/home/user/lf/land38"
OUT  = "/home/user/lf/work/longform/review/sheet3_act38_plates.png"
GROUPS = [
    ("PANEL (Korean text - judge letterforms)", ["P01","P02","P07","P10","P18"]),
    ("SEQUENTIAL (un-revealed rows must be EMPTY)", ["Q04","Q05","Q06","Q11","Q14","Q17","Q20","Q21"]),
    ("SCENE (real office/paper world - SF must be 0)", ["S03","S08","S09","S12","S13","S15","S16","S19","S22"]),
]
CW, COLS = 430, 5
CH  = int(CW * 1152 / 2048)
PAD, CAP, HDR, TOP = 12, 26, 40, 66

rows_needed = sum(-(-len(ids)//COLS) for _, ids in GROUPS)
H = TOP + sum(HDR + (-(-len(ids)//COLS))*(CH+CAP+PAD) for _, ids in GROUPS)
W = PAD*2 + COLS*(CW+PAD)
sheet = np.full((H, W, 3), 22, np.uint8)
cv2.putText(sheet, "SHEET 3 - ACT3~8 plates  22/22 delivered  ALL 2048x1152 gate PASS",
            (PAD, 44), cv2.FONT_HERSHEY_SIMPLEX, 1.05, (240,240,240), 2, cv2.LINE_AA)

y = TOP
for title, ids in GROUPS:
    cv2.putText(sheet, title, (PAD, y+26), cv2.FONT_HERSHEY_SIMPLEX, 0.68, (120,205,235), 2, cv2.LINE_AA)
    y += HDR
    for i, a in enumerate(ids):
        r, c = divmod(i, COLS)
        x = PAD + c*(CW+PAD); yy = y + r*(CH+CAP+PAD)
        im = cv2.imread(os.path.join(LAND, a+".png"))
        im = cv2.resize(im, (CW, CH), interpolation=cv2.INTER_AREA)
        sheet[yy:yy+CH, x:x+CW] = im
        cv2.putText(sheet, a, (x+3, yy+CH+19), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200,200,200), 1, cv2.LINE_AA)
    y += (-(-len(ids)//COLS))*(CH+CAP+PAD)

cv2.imwrite(OUT, sheet)
print(OUT, sheet.shape[1], "x", sheet.shape[0])
