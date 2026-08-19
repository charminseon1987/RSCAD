Python으로 대체 가능한 기능 목록
MATLAB/RSCAD 기능	      Python 대체	난이도
행렬 연산	                numpy	     ⭐
야코비안 선형화	             sympy	     ⭐⭐
고유값 분석	                scipy.linalg	⭐
Simulink EMT	          scipy.integrate	⭐⭐⭐
parfor 병렬처리	           multiprocessing	⭐⭐
MATLAB gpuArray	          cupy (CUDA) / mlx (Mac)	⭐⭐⭐
RSCAD 실시간 시뮬	        asyncio + 고정 타임스텝	⭐⭐⭐⭐
PSO 최적화	                 pyswarms	⭐⭐            설치 명령어  pip install mlx numpy scipy sympy pyswarms
Prony 분석	               prony 라이브러리	⭐⭐



기능	               / 도구	
야코비안 심볼릭 유도	 / SymPy	
고유값·감쇠비 계산	     / scipy + MLX	
EMT 비선형 시뮬	        / scipy.integrate	
PSO 병렬 최적화	        / pyswarms + multiprocessing	
88포인트 2D 스윕	    / Pool 병렬	
Gemma 4 멀티에이전트	 / MLX + Ollama	
실시간 DSP 연결	         / RTDS 필수	(학교PC 필요✅)
IEEE Std. 검증	        / RTDS 필수	   (학교PC 필요✅)




# Visual C++ Build Tools 설치

powerShell ( 권한관리자)

winget install Microsoft.VisualStudio.2022.BuildTools

#### CUDA 12.8 설치

RTX 5070은 sm_120 아키텍처로 CUDA 12.8 이상이 필수입니다. NVIDIA Developer

```
1. https://developer.nvidia.com/cuda-downloads 접속
2. Windows → x86_64 → Windows 11 → exe(local) 선택
3. 다운로드 후 설치 (약 3.5GB)
4. 재부팅
```

설치 후 확인:

powershell

```powershell
nvcc --version
# nvcc: NVIDIA (R) Cuda compiler driver
# Cuda compilation tools, release 12.8
```

---

#### 3단계 — cupy 올바른 방법으로 설치

소스 빌드가 아닌 **RTX 5070 전용 바이너리**로 설치합니다.

RTX 5070은 sm_120 compute capability로 CUDA 12.8이 필요합니다. NVIDIA Developer Forums

powershell

```powershell
# 소스 빌드(pip install cupy) 대신
# CUDA 12.8 전용 바이너리로 설치
pip install cupy-cuda12x

# 설치 확인
python -c "import cupy as cp; print(cp.cuda.runtime.runtimeGetVersion())"
```


### 전체 한 번에 실행

powershell
# 1. CUDA 설치 후 재부팅한 다음:

# 2. cupy 바이너리 설치
pip install cupy-cuda12x

# 3. GFM 연구 GPU 가속 테스트
python -c "
import cupy as cp
import numpy as np

# CPU (numpy)
A_cpu = np.random.rand(21, 21)

# GPU (cupy) — RTX 5070 사용
A_gpu = cp.array(A_cpu)
eigs  = cp.linalg.eigvals(A_gpu)
print('RTX 5070 GPU 가속 성공:', eigs.shape)
print('GPU:', cp.cuda.Device().name)
"

# 설치순서 요약 
1. Build Tools 설치  → https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. CUDA 12.8 설치   → https://developer.nvidia.com/cuda-downloads
3. 재부팅
4. pip install cupy-cuda12x