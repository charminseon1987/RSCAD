---
type: literature
cite_key: liu2025datadriven
ref_num: 미정
year: 2025
venue: Cyber-Physical Energy Systems (Elsevier), Vol.1, pp.28-48
doi: 미확인
paper_type: review
model_order: 미명시
scr_range: 미명시
validation_level: 미명시
tuning_method: 미명시
dc_ac_coupling: 미명시
extraction_depth: full
tags: [literature, Liu2025, data-driven, RL, GFM, DRL, CPES, survey]
---

# 📚 Liu, Zhang, Xu, Xie 2025 — 데이터기반 제어 서베이

> **저자:** Wenjie Liu (NTU), Mengfan Zhang (KTH), Qianwen Xu (KTH), Lihua Xie (NTU)  
> **저널:** Cyber-Physical Energy Systems 1 (2025) 28–48  
> **역할:** 데이터기반 제어 방법론 참조 — GFM DRL 적용 가능성

---

## 📌 Brief Summary

▸ 데이터기반 제어의 두 축 — (1) Willems 기본 보조정리 기반 비모수적 궤적 방법과 (2) 강화학습(RL) 기반 방법 — 을 통합 서베이한 논문. CPES(사이버-물리 에너지 시스템)에서 GFM/GFL 제어, 사이버보안(DoS/FDI 공격) 방어까지 다룸.

---

## 📖 Core Content

### ▸ 논문 구조 (21페이지)

| 섹션 | 내용 |
|---|---|
| 1 | 서론 — CPES 개요, RL 기반·Willems 기반 구분 |
| 2 | LTI 시스템 데이터기반 피드백 제어 |
| 3 | 비선형 시스템 확장 |
| 4 | 데이터기반 MPC |
| 5 | 데이터기반 상태 추정 |
| **6** | **DRL in CPES — GFM/GFL 제어** ← 본 연구 관련 |
| 7 | 사이버보안 (DoS, FDI 공격 방어) |
| 8 | 결론 |

### ▸ 핵심 기여

```
1. Willems 기본 보조정리 기반 방법:
   - 시스템 구조(LTI 또는 적절히 리프팅된 비선형) 가정 필요
   - 명시적 모델 식별 대신 입출력 궤적 표현 사용
   - 엄밀한 안정성 보장 제공

2. RL 기반 방법:
   - 구조적 제약 완전 해제
   - 복잡·불확실한 환경에서 상호작용으로 학습
   - 형식적 안정성 증명 없음 → 광범위한 적용 가능성
```

### ▸ GFM/GFL 제어 관련 (§6.2)

```
▸ DRL이 GFM/GFL 제어에서:
  - 빠른 응답 보조 서비스 제공
  - 가상 관성 에뮬레이션
  - 계통 주파수 안정화

▸ 요구사항:
  - 안전성 (Safety)
  - 해석 가능성 (Interpretability)
  - 신뢰성 (Reliability)

▸ 접근법:
  - Safe DRL 기법
  - 하이브리드 학습-제어 프레임워크
```

### ▸ 저자 결론

```
▸ Willems 기반: LTI/비선형 구조 가정 하에 엄밀한 보장
▸ DRL 기반: 구조 가정 없음, 고차원 비선형 CPES에 강력
▸ 한계: DRL은 온라인 측정 가정 → 오프라인 시나리오 제한
```

---

## 🔗 본 연구(GFM PSO 소신호 모델)와의 관련성

| 항목 | Liu 2025 | 본 연구 |
|---|---|---|
| 제어 방법 | 데이터기반 (RL, Willems) | **모델기반 (소신호 + PSO)** |
| GFM 관련 | §6.2 DRL 적용 | PSO 파라미터 최적화 |
| 안정성 | RL → 형식 보장 어려움 | **고유값 분석 → 보장** |
| 계산 부담 | 실시간 학습 필요 | **오프라인 최적화** |

※ 직접적 연결은 낮음  
※ 활용 가능: Phase 3 이후 PSO 대안으로 DRL 비교 논의  
※ §6.2의 "Safe DRL for GFM" 흐름은 본 연구 후속 방향으로 언급 가능

---

## ✍️ My Take

```
※ 본 연구 방법론(소신호 모델 + PSO)과 대비되는 접근법 서베이
※ 논문 §I 서론에서 "모델기반 vs 데이터기반" 비교 시 인용 가능
※ DRL GFM 제어(§6.2)는 향후 연구 방향으로 언급 가능
※ 직접적인 소신호 모델·PSO 방법론 내용 없음 → 인용 우선순위 낮음
※ 미결: DOI 확인 필요 (현재 미확인)
```

---

## 🔗 연결 노트
- [[qu2025industrial]]

- [[PSO 이중수렴기준]] — 데이터기반 vs 모델기반 비교
- [[고유값_안정도판단]] — 모델기반 안정성 보장 근거
- [[Phase03_진행중]] — PSO vs DRL 비교 논의 가능

---

## 📋 인용 가능 문장 후보

```
▸ "DRL offers a distinct advantage over traditional optimization 
   and control techniques by enabling systems to learn optimal 
   policies through continuous interaction"
   → 모델기반 PSO의 장점(해석 가능성, 보장) 대비 시 인용

▸ "These applications demand stringent safety, interpretability, 
   and reliability guarantees"
   → 본 연구가 고유값 기반 안정성 보장을 선택한 이유로 인용
```

> ⚠️ 저작권 주의: 인용 시 15단어 이내로 제한
