"""archify 아키텍처 다이어그램 → React 렌더용 JSON 추출.

archify 가 만든 spec(*.architecture.json)에는 컴포넌트 좌표와 연결의 논리 정보만
있고, 간선이 실제로 어떤 폴리라인을 타는지와 경계(region) 사각형 좌표는 렌더된
HTML 안에 들어 있다. 그 기하 정보를 뽑아 spec 과 합쳐 하나의 JSON 으로 만든다.

이렇게 하는 이유: archify 의 라우팅·레인 오프셋 규칙을 역설계해 TS 로 다시 쓰면
원본 렌더와 몇 px 씩 어긋난다. 렌더 결과를 기하 정보의 출처로 삼으면 어긋날 수 없다.

사용:
    python tools/extract_arch_geometry.py

다이어그램을 새로 만들거나 spec 을 고쳐 archify 를 다시 돌렸으면 이 스크립트도
다시 돌려야 한다 (HTML 이 바뀌면 기하 정보도 바뀐다).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'Web' / 'src' / 'data' / 'arch'

# (spec 경로, 렌더된 HTML 경로, 출력 이름)
TARGETS = [
    ('docs/diagrams/gmf-web-ia.architecture.json',
     'docs/diagrams/gmf-web-ia-architecture.html', 'gmf-web-ia'),
    ('docs/rscad-runtime.architecture.json',
     'docs/rscad-runtime-architecture.html', 'rscad-runtime'),
]

EDGE_RE = re.compile(
    r'data-edge-id="(?P<id>[^"]*)"[^>]*?data-composition-points="(?P<pts>[^"]*)"')
FRAME_RE = re.compile(
    r'data-composition-frame-kind="(?P<kind>[^"]*)"\s+'
    r'data-composition-frame-id="(?P<fid>\d+)"\s+'
    r'data-composition-frame-label="(?P<label>[^"]*)"\s+'
    r'x="(?P<x>-?[\d.]+)"\s+y="(?P<y>-?[\d.]+)"\s+'
    r'width="(?P<w>[\d.]+)"\s+height="(?P<h>[\d.]+)"')


def parse_points(s: str) -> list[list[float]]:
    out = []
    for pair in s.split(';'):
        pair = pair.strip()
        if not pair:
            continue
        x, _, y = pair.partition(',')
        out.append([float(x), float(y)])
    return out


def extract(spec_path: Path, html_path: Path) -> dict:
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    html = html_path.read_text(encoding='utf-8', errors='replace')

    # 간선 폴리라인 — data-edge-id 로 spec 의 connection 에 붙인다
    routes: dict[str, list[list[float]]] = {}
    for m in EDGE_RE.finditer(html):
        routes.setdefault(m.group('id'), parse_points(m.group('pts')))

    conns = []
    missing = []
    for c in spec['connections']:
        pts = routes.get(c['id'])
        if pts is None:
            missing.append(c['id'])
        conns.append({
            'id': c['id'], 'from': c['from'], 'to': c['to'],
            'label': c.get('label', ''),
            'variant': c.get('variant', 'default'),
            'labelDy': c.get('labelDy'),
            'labelSegment': c.get('labelSegment'),
            'points': pts or [],
        })

    # 경계 사각형 — 선언 순서(frame-id)가 spec 의 boundaries 순서와 같다
    frames = {}
    for m in FRAME_RE.finditer(html):
        frames[int(m.group('fid'))] = {
            'kind': m.group('kind'), 'label': m.group('label'),
            'x': float(m.group('x')), 'y': float(m.group('y')),
            'w': float(m.group('w')), 'h': float(m.group('h')),
        }

    bounds = []
    for i, b in enumerate(spec['boundaries']):
        fr = frames.get(i)
        if fr is None:
            missing.append(f'boundary[{i}]')
            continue
        if fr['label'] != b['label']:
            print(f'  ! boundary[{i}] 라벨 불일치: spec={b["label"]!r} html={fr["label"]!r}',
                  file=sys.stderr)
        bounds.append({
            'kind': b['kind'], 'label': b['label'], 'wraps': b['wraps'],
            'x': fr['x'], 'y': fr['y'], 'w': fr['w'], 'h': fr['h'],
        })

    if missing:
        print(f'  ! 기하 정보 누락: {", ".join(missing)}', file=sys.stderr)

    return {
        'title': spec['meta']['title'],
        'viewBox': spec['meta']['viewBox'],
        'views': spec['meta'].get('views', []),
        'components': spec['components'],
        'boundaries': bounds,
        'connections': conns,
        'cards': spec.get('cards', []),
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rc = 0
    for spec_rel, html_rel, name in TARGETS:
        spec_p, html_p = ROOT / spec_rel, ROOT / html_rel
        if not spec_p.exists() or not html_p.exists():
            print(f'건너뜀 {name}: 파일 없음', file=sys.stderr)
            rc = 1
            continue
        data = extract(spec_p, html_p)
        out = OUT_DIR / f'{name}.json'
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
        routed = sum(1 for c in data['connections'] if c['points'])
        print(f'{out.relative_to(ROOT)}  '
              f'노드 {len(data["components"])} · 경계 {len(data["boundaries"])} · '
              f'간선 {routed}/{len(data["connections"])} · 뷰 {len(data["views"])} · '
              f'카드 {len(data["cards"])}')
    return rc


if __name__ == '__main__':
    sys.exit(main())
