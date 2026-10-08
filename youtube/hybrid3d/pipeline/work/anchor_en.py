# -*- coding: utf-8 -*-
"""anchor 별 plate 실물의 영문 서술 + 이동 목적어 + 해부 가능성.

왜 사전을 손으로 쓰는가
---------------------
설계표의 objects/note 는 한국어 307 고유명사로 되어 있고, 기계 번역하면
"the subject already visible in frame" 같은 무의미한 목적어가 된다.
그것은 CEO-33 "움직임에도 의미가 있어야 하지 않을까요?" 가 지적한 바로 그
결함이다. 그래서 anchor 20종의 plate 를 실제로 눈으로 확인하고(sheet_A /
sheet_B), 화면에 정말 있는 물체만 영문 명사구로 적는다. 이 사전은
"모델에게 없는 것을 만들라고 하지 않는다"는 보증이기도 하다.

필드
----
scene   : 장면 전체 (첫 프레임 유지 서술에 쓴다)
targets : 카메라가 향할 수 있는 실제 물체 (제3조의 목적어)
cutaway : 이동의 끝에서 드러낼 단면/층. None 이면 해부를 요구하지 않는다.
          (없는 곳에 요구하면 모델이 새 물체를 발명 = 금지요소 위반)
baked_text : plate 에 한글이 구워져 있는가. True 면 생성 금지(글자 녹음).
hands   : plate 원본에 사람 손이 이미 있는가 (CEO-32 승인 요소).
          True 면 프롬프트에서 "no hands" 를 빼야 한다 — 안 그러면
          모델이 승인된 손을 지우려 하며 화면이 뭉개진다.
"""

A = {
 "P01": dict(
   scene="a sunlit open-plan office desk seen across its length, printed sheets, a "
         "notebook, business cards and a grey document board laid out on pale wood",
   targets=["the printed sheets laid across the desk",
            "the grey document board at the centre of the desk",
            "the row of desks receding toward the window"],
   cutaway="the cut-away section of the office itself, its interior depth staying visible",
   baked_text=True, hands=False),

 "P02": dict(
   scene="a quiet office corner at golden hour, a small desk with a chair, a pinboard "
         "of papers on the left, a long meeting table receding into the room",
   targets=["the papers pinned to the board",
            "the empty chair at the small desk",
            "the long meeting table further into the room"],
   cutaway=None, baked_text=True, hands=False),

 "P07": dict(
   scene="a warm wooden desk carrying a tall stack of bound documents on the left, an "
         "open notebook at the centre and a pencil resting beside it",
   targets=["the tall stack of bound documents",
            "the open notebook at the centre of the desk",
            "the pencil lying beside the notebook"],
   cutaway="the exposed edges of the tall document stack, read as a cross-section of layers",
   baked_text=True, hands=False),

 "P10": dict(
   scene="a bookshelf wall behind a wooden desk, stacked paper bundles at the left, a "
         "pinboard above, plants and a lamp lit by side light",
   targets=["the stacked paper bundles on the desk",
            "the shelved rows of files on the wall",
            "the pinboard above the desk"],
   cutaway="the shelf compartments, whose interior divisions stand exposed like a sectioned elevation",
   baked_text=True, hands=False),

 "P18": dict(
   scene="a large cork pinboard filling the wall above a wooden desk, three pale sticky "
         "notes along the top, layered paper stacks and three loose sheets on the desk",
   targets=["the three loose sheets laid on the desk",
            "the layered paper stacks at the left",
            "the sticky notes along the top of the board"],
   cutaway=None, baked_text=True, hands=False),

 "Q04": dict(
   scene="a wooden desk in side light with a standing board holding two small printed "
         "cards, a glass of water, an open notebook and a paper stack at the left",
   targets=["the two printed cards on the standing board",
            "the open notebook on the desk",
            "the paper stack at the left edge"],
   cutaway=None, baked_text=False, hands=False),

 "Q05": dict(
   scene="a large cork board standing on a wooden desk, printed sheets and two small "
         "photographs pinned across it, a mug and a potted plant beside it",
   targets=["the printed sheets pinned across the cork board",
            "the two small photographs at the top of the board",
            "the mug standing on the desk"],
   cutaway=None, baked_text=False, hands=False),

 "Q06": dict(
   scene="a cork board mounted on the wall with several printed sheets and a clipboard "
         "pinned to it, a mug on the desk below",
   targets=["the printed sheets pinned to the cork board",
            "the clipboard at the centre of the board",
            "the pale sticky note at the upper left"],
   cutaway=None, baked_text=False, hands=True),

 "Q11": dict(
   scene="a wooden desk with a clipboard standing upright, thick bound volumes at the "
         "left, loose printed sheets in front and a mug at the right",
   targets=["the clipboard standing upright on the desk",
            "the thick bound volumes at the left",
            "the loose printed sheets spread in front"],
   cutaway="the exposed edges of the bound volumes, their pages read as stacked strata",
   baked_text=False, hands=False),

 "Q17": dict(
   scene="a tall arrangement of upright printed cards standing in a row against a cork "
         "board, an open notebook and a mug on the desk in front",
   targets=["the row of upright printed cards",
            "the open notebook on the desk",
            "the pale sticky notes above the cards"],
   cutaway="the row of upright cards seen edge-on, their stacked depth exposed like a sectioned rank",
   baked_text=False, hands=False),

 "Q20": dict(
   scene="a cork board above a wooden desk with printed sheets pinned to it, an open "
         "sketchbook, a mug and a thick stack of paper at the right",
   targets=["the printed sheets pinned to the board",
            "the open sketchbook on the desk",
            "the thick paper stack at the right"],
   cutaway=None, baked_text=False, hands=False),

 "Q21": dict(
   scene="a wooden desk carrying three upright printed cards, an open ring-bound "
         "notebook, a spread document and a mug, warm side light",
   targets=["the three upright printed cards",
            "the open ring-bound notebook",
            "the spread document lying flat on the desk"],
   cutaway=None, baked_text=False, hands=True),

 "S03": dict(
   scene="an office interior in low warm light, a standing clipboard at the centre of a "
         "long wooden desk, tall paper stacks on both sides, a chair behind",
   targets=["the standing clipboard at the centre of the desk",
            "the tall paper stacks flanking it",
            "the empty chair behind the desk"],
   cutaway="the exposed edges of the flanking paper stacks, read as a cross-section of layers",
   baked_text=False, hands=False),

 "S08": dict(
   scene="a wooden desk with a very tall stack of paper at the left, a single sheet laid "
         "flat at the centre, an open notebook and a mug at the right",
   targets=["the very tall stack of paper at the left",
            "the single sheet laid flat at the centre",
            "the open notebook beside the mug"],
   cutaway="the exposed edges of the tall paper stack, its layers read as strata",
   baked_text=False, hands=True),

 "S09": dict(
   scene="a wooden desk seen from above holding a clipboard, several open folders with "
         "printed inserts, a potted plant and a mug, cork board behind",
   targets=["the clipboard at the left of the desk",
            "the open folders with their printed inserts",
            "the cork board on the wall behind"],
   cutaway="the opened folders seen edge-on, their layered inserts exposed as a cross-section",
   baked_text=False, hands=False),

 "S12": dict(
   scene="a long office desk in warm light where two people are looking at an open black "
         "ring binder together, one hand resting on its cover and another hand pointing at "
         "a numbered divider tab, tall paper stacks behind, a cork board of pinned sheets "
         "on the left wall and further desks receding to a bright window",
   targets=["the open ring binder at the centre of the desk",
            "the numbered divider tabs at the binder's edge",
            "the tall paper stacks standing behind the binder"],
   cutaway="the numbered divider tabs seen edge-on, the binder's stacked pages exposed as "
           "layered strata",
   baked_text=False, hands=True),

 "S13": dict(
   scene="a cork board with two pale sticky notes and a large blank framed card standing "
         "on a wooden desk, a mug and a ring-bound notebook beside it",
   targets=["the large blank framed card on the desk",
            "the two pale sticky notes on the board",
            "the ring-bound notebook at the right"],
   cutaway=None, baked_text=False, hands=False),

 "S16": dict(
   scene="a wooden desk against a soft grey wall, a standing board with printed cards, a "
         "stack of notebooks, a glass of water and a pen cup",
   targets=["the printed cards on the standing board",
            "the stack of notebooks at the left",
            "the pen cup at the right of the desk"],
   cutaway=None, baked_text=False, hands=False),

 "S19": dict(
   scene="a long wooden desk viewed from above with three printed sheets laid in a row, "
         "two documents at the right, a paper stack at the left and a mug",
   targets=["the three printed sheets laid in a row",
            "the two documents at the right of the desk",
            "the paper stack at the left edge"],
   cutaway="the cut-open interior of the cabinet behind, its shelves reading as a sectioned elevation",
   baked_text=False, hands=False),

 "S22": dict(
   scene="a wooden desk with a standing board of printed cards, three sheets laid in a "
         "row in front, a potted plant, a pen cup and a small mug",
   targets=["the three sheets laid in a row on the desk",
            "the standing board of printed cards",
            "the pen cup and plant at the right"],
   cutaway="the open drawer beneath the desk, revealing the layered edges of the paper stack inside",
   baked_text=False, hands=False),

 "S23": dict(
   scene="a wooden desk lit from a window, one large sheet bearing a row of three empty "
         "grey boxes, a second printed sheet at the right, a pencil with graphite dust, a "
         "small photograph at the left, and an open drawer below showing stacked paper",
   targets=["the row of three empty grey boxes on the large sheet",
            "the pencil and the graphite dust beside it",
            "the open drawer below the desk edge"],
   cutaway="the open drawer beneath the desk, whose stacked cross-section of layered paper "
           "sheets fills the frame as visible strata",
   baked_text=False, hands=False),
}


def get(anchor):
    return A.get(anchor)


if __name__ == "__main__":
    print("anchor 사전 %d 종" % len(A))
    nb = [k for k, v in A.items() if v["baked_text"]]
    nh = [k for k, v in A.items() if v["hands"]]
    nc = [k for k, v in A.items() if v["cutaway"]]
    print("한글 구워짐 (생성 금지): %d %s" % (len(nb), nb))
    print("원본에 손 있음  : %d %s" % (len(nh), nh))
    print("해부 가능       : %d %s" % (len(nc), nc))
    miss = [k for k, v in A.items() if not v["targets"]]
    print("목적어 없음     : %d %s" % (len(miss), miss))
