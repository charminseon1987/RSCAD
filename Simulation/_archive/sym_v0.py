from sympy import symbols, Matrix, jacobian, lambdify

# 21개 상태변수 심볼릭 선언
xPI1,xPI2,xPI3 = symbols('xPI1 xPI2 xPI3')
upv,ubat,udc   = symbols('upv ubat udc')
iLpv,iLbat     = symbols('iLpv iLbat')
dw,Pfilt,Qfilt = symbols('dw Pfilt Qfilt')
# ... (나머지 AC 13개)

x = Matrix([xPI1,xPI2,xPI3,upv,ubat,udc,iLpv,iLbat,
            dw,Pfilt,Qfilt,...])  # 21차

# 비선형 f(x) 정의
f = Matrix([
    iLpv_ref - iLpv,           # xPI1
    iLbat_ref - iLbat,         # xPI2
    Vdc0 - udc,                # xPI3
    (ipv - iLpv)/Cpv,          # upv
    # ... 21개
])

# 야코비안 자동 유도 (MATLAB symbolic과 동일)
A_sym = f.jacobian(x)
print("심볼릭 야코비안 유도 완료")

# 수치 함수로 변환
A_func = lambdify(x, A_sym, 'numpy')