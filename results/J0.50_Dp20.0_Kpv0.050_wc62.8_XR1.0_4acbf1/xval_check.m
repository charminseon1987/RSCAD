%% xval_check.m — 자동 생성 (2026-10-01 10:15)
%  Python(sympy)에서 유도한 야코비안을 MATLAB에서 독립 검산한다.
%  실행: gfm_model.mat 과 같은 폴더에서 xval_check

clear; clc;
S = load('gfm_model.mat');
names = string(S.state_names);
cases = fieldnames(S.cases);

fprintf('모델: %s   상태 %d개\n', S.model_version, numel(names));
fprintf('%-10s %12s %12s %10s\n', 'case', 'max Re', '느린 모드', '유효임계');

for i = 1:numel(cases)
    c = S.cases.(cases{i});
    e = eig(c.A);
    [~, k] = min(abs(real(e)));          % 원점에 가장 가까운 모드
    fprintf('%-10s %12.4f %12.4f %9.1f%%\n', ...
        cases{i}, max(real(e)), real(e(k)), c.linearization_threshold*100);

    % Python 계산 고유값과 대조
    d = max(abs(sort(e) - sort(c.eig(:))));
    if d > 1e-8
        warning('%s: Python 고유값과 %.2e 차이', cases{i}, d);
    end
end

%% 상태공간 객체 생성 (Simulink 연동용)
c   = S.cases.(cases{1});
sys = ss(c.A, c.B, eye(numel(names)), 0, ...
         'StateName', cellstr(names), 'InputName', cellstr(string(S.input_names)));
% step(sys);  damp(sys);
