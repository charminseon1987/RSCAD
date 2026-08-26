import mlx.core as mx  # numpy처럼 사용, Mac GPU 자동 가속

# numpy 코드를 그대로 MLX로 교체
# numpy:  A = np.array(...)   eigs = np.linalg.eigvals(A)
# MLX:    A = mx.array(...)   eigs = mx.linalg.eigvals(A)

# 야코비안 계산 — Mac GPU 가속
A = mx.array(build_jacobian_numpy(SCR, XR, J, Dp))
eigs = mx.linalg.eigvals(A)
mx.eval(eigs)  # lazy evaluation 실행
print(eigs)