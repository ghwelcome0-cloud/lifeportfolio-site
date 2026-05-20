/* ============================================================
   인생포트폴리오 맞춤형 다이어리 — 디지털 목업 v1.3
   page-nav.js — 키보드 ←→ + 버튼 + 썸네일 인덱스 네비게이션
   v1.3 변경: 보안 게이트, L로고 제거, 4SE 재분류, 잘림 해결,
             자유메모 8p→16p, 판권→Owner Profile
   ============================================================ */

(function () {
  'use strict';

  // 페이지 데이터 — v1.3: 24 unique pages (보안 게이트로 보호)
  const PAGES = [
    { id: 'cover',           num: '00',   name: '표지 (Only One)',         desc: 'COVER · 브랜드 3요소만' },
    { id: 'titlepage',       num: '00',   name: '속표지',                   desc: 'TITLE PAGE · 맞춤형 다이어리' },
    { id: 'part0-intro',     num: 'Pt 0', name: '검사 리포트 옮겨 적기',     desc: 'PART 0 인트로' },
    { id: 'part0-mission',   num: '0-1',  name: '01. 사명',                desc: '핵심·보조 1줄씩' },
    { id: 'part0-vision',    num: '0-2',  name: '02. 비전',                desc: '핵심·보조 1줄씩' },
    { id: 'part0-4se-a',     num: '0-3A', name: '03A. 4SE 1/2',            desc: '자기이해 + 자기표현 (v1.3 재분류)' },
    { id: 'part0-4se-b',     num: '0-3B', name: '03B. 4SE 2/2',            desc: '자기설계 + 자기실행 (v1.3 재분류)' },
    { id: 'part0-top3',      num: '0-4',  name: '04. TOP3 강점',           desc: '3카드' },
    { id: 'part0-top2',      num: '0-5',  name: '05. TOP2 성장 포인트',    desc: '2카드' },
    { id: 'part0-profile',   num: '0-6',  name: '06. 실행 프로파일 6필드', desc: '유형/스타일/추진력/몰입/활동/도구' },
    { id: 'part0-career',    num: '0-7',  name: '07. 추천 진로 3카드',     desc: '진로·교육·확장' },
    { id: 'part1',           num: 'Pt 1', name: '13영역 인생 지도',         desc: '13영역 점수·메모' },
    { id: 'yearly',          num: '★',   name: '연간 캘린더 (v1.2 신규)',  desc: '12개월 한눈에 — 시장 표준' },
    { id: 'part2',           num: 'Pt 2', name: '연간 비전 · 90일 마일스톤', desc: 'VISION + Q1·Q2·Q3' },
    { id: 'monthly',         num: '★',   name: '월간 캘린더 (v1.2 신규)',  desc: '31칸 + ABC 우선순위' },
    { id: 'part3',           num: 'Pt 3', name: '주간 펼침면',              desc: '좌: 계획 / 우: 도트 메모' },
    { id: 'part4',           num: 'Pt 4', name: '영역별 분기 회고',         desc: 'Pennebaker 4문항' },
    { id: 'part5',           num: 'Pt 5', name: '감사 일기 (월별)',         desc: '이번 달 감사 3가지' },
    { id: 'part6',           num: 'Pt 6', name: '1:1 코칭 진척 기록',       desc: '4컬럼 성과 추적 보드' },
    { id: 'part7-quotes',    num: '7-①', name: '부록 ① 성경구절·명언',    desc: 'APPENDIX 1 · 매주 1구절' },
    { id: 'part7-domains',   num: '7-②', name: '부록 ② 13영역 가이드',    desc: 'APPENDIX 2 · 핵심 질문 13개' },
    { id: 'part7-guide',     num: '7-③', name: '부록 ③ 사용 가이드',      desc: 'APPENDIX 3 · 시작/매주/분기/연말' },
    { id: 'part7-memo',      num: '7-④', name: '부록 ④ 자유 메모장',      desc: 'APPENDIX 4 · 7mm 도트 (v1.2 신규)' },
    { id: 'part7-license',   num: '7-⑤', name: '소유자 정보 (분실 반환)',  desc: 'OWNER · IF FOUND · END p.256' },
  ];

  let currentIndex = 0;

  function render() {
    // 모든 page-wrapper 숨김
    document.querySelectorAll('.page-wrapper').forEach(el => {
      el.classList.remove('active');
    });

    // 현재 페이지 표시
    const cur = PAGES[currentIndex];
    const wrapper = document.getElementById('pg-' + cur.id);
    if (wrapper) {
      wrapper.classList.add('active');
    }

    // 네비게이션 정보 업데이트
    const navInfo = document.getElementById('nav-info');
    if (navInfo) {
      navInfo.innerHTML =
        `<span class="current">${cur.num}. ${cur.name}</span><br>` +
        `<span class="total">${currentIndex + 1} / ${PAGES.length} · ${cur.desc}</span>`;
    }

    // 이전/다음 버튼 활성화
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.disabled = (currentIndex === 0);
    if (nextBtn) nextBtn.disabled = (currentIndex === PAGES.length - 1);

    // 인덱스 active 상태
    document.querySelectorAll('.index-item').forEach((el, i) => {
      el.classList.toggle('active', i === currentIndex);
    });

    // URL 해시 업데이트 (공유용)
    history.replaceState(null, '', '#' + cur.id);

    // 페이지 상단으로 스크롤 (목업 영역까지)
    const book = document.querySelector('.book-stage');
    if (book && window.scrollY > book.offsetTop) {
      book.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function go(delta) {
    const next = currentIndex + delta;
    if (next < 0 || next >= PAGES.length) return;
    currentIndex = next;
    render();
  }

  function goTo(idx) {
    if (idx < 0 || idx >= PAGES.length) return;
    currentIndex = idx;
    render();
  }

  function buildIndex() {
    const indexGrid = document.getElementById('index-grid');
    if (!indexGrid) return;
    indexGrid.innerHTML = '';
    PAGES.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'index-item';
      el.innerHTML = `
        <div class="index-num">${p.num}</div>
        <div class="index-name">${p.name}</div>
        <div class="index-desc">${p.desc}</div>
      `;
      el.addEventListener('click', () => goTo(i));
      indexGrid.appendChild(el);
    });
  }

  function attachEvents() {
    // 키보드 네비게이션
    document.addEventListener('keydown', (e) => {
      // 입력 필드에서는 무시
      if (e.target.matches('input, textarea, select')) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(PAGES.length - 1);
      }
    });

    // 버튼 이벤트
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => go(1));
  }

  function initFromHash() {
    const hash = (window.location.hash || '').replace('#', '');
    if (!hash) return;
    const idx = PAGES.findIndex(p => p.id === hash);
    if (idx >= 0) currentIndex = idx;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildIndex();
    attachEvents();
    initFromHash();
    render();
  });
})();
