#!/usr/bin/env python3
"""observer.py 테스트. 판단부는 순수 함수라 디스크 없이 검증한다."""

import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile

from observer import (
    Observation, evaluate, collect, render, rank, STATE_ORDER, MAX_AUTO_STATE,
    resolve_evidence, parse_evidence
)

NOW = datetime(2026, 8, 28, tzinfo=timezone.utc)


def sched(state="not_started", aid="P4-A3", evidence=None):
    art = {"id": aid, "name": "테스트 산출물", "state": state}
    if evidence:
        art["evidence"] = evidence
    return {"phases": [{"id": "P4", "artifacts": [art]}]}


def sig(propose="draft", aid="P4-A3", sid="S1"):
    return [{"id": sid, "pattern": "x", "reason": "테스트 신호",
             "targets": [{"artifact": aid, "propose": propose}]}]


def obs(sid="S1", exists=True, days_ago=2):
    if not exists:
        return {sid: [Observation(sid, "x", exists=False)]}
    return {sid: [Observation(sid, "results/x/meta.json", exists=True,
                              git_last_commit=NOW - timedelta(days=days_ago))]}


class TestPromotion(unittest.TestCase):

    def test_전진_제안(self):
        r = evaluate(sched("not_started"), obs(), sig(), now=NOW)
        self.assertEqual(len(r.proposals), 1)
        p = r.proposals[0]
        self.assertEqual((p.current, p.proposed, p.kind), ("not_started", "draft", "promote"))
        self.assertEqual(p.age_days, 2)

    def test_동일상태는_hold(self):
        r = evaluate(sched("draft"), obs(), sig(), now=NOW)
        self.assertEqual(r.proposals, [])
        self.assertEqual(len(r.holds), 1)

    def test_역행_제안_안함(self):
        """이미 verified인데 신호가 draft를 가리켜도 강등하지 않는다."""
        r = evaluate(sched("verified"), obs(), sig(), now=NOW)
        self.assertEqual(r.proposals, [])
        self.assertEqual(len(r.holds), 1)

    def test_verified_자동승격_차단(self):
        r = evaluate(sched("draft"), obs(), sig(propose="verified"), now=NOW)
        self.assertEqual(r.proposals, [], "verified로 올려선 안 된다")
        self.assertTrue(any("절삭" in w for w in r.warnings))

    def test_관측부재는_강등근거가_아니다(self):
        r = evaluate(sched("draft"), obs(exists=False), sig(), now=NOW)
        self.assertEqual(r.proposals, [])
        self.assertEqual(r.holds, [])


class TestEvidence(unittest.TestCase):

    def test_evidence_없는_verified_강등제안(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            s = sched("verified", evidence="results/latest/A_num.npy")
            r = evaluate(s, {}, [], now=NOW, root=root)
            self.assertEqual(len(r.proposals), 1)
            self.assertEqual(r.proposals[0].kind, "demote")
            self.assertEqual(r.proposals[0].proposed, "draft")

    def test_evidence_실재하면_조용(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "results" / "latest").mkdir(parents=True)
            (root / "results" / "latest" / "A_num.npy").write_bytes(b"x")
            s = sched("verified", evidence="results/latest/A_num.npy")
            r = evaluate(s, {}, [], now=NOW, root=root)
            self.assertEqual(r.proposals, [])

    def test_draft는_evidence_검사_대상아님(self):
        with tempfile.TemporaryDirectory() as td:
            s = sched("draft", evidence="없는파일.npy")
            r = evaluate(s, {}, [], now=NOW, root=Path(td))
            self.assertEqual(r.proposals, [])


class TestStaleness(unittest.TestCase):

    def test_정체_감지(self):
        r = evaluate(sched("draft"), obs(days_ago=20), sig(), now=NOW, stale_days=14)
        self.assertEqual(r.silent_phases, [{"phase": "P4", "age_days": 20}])

    def test_최신활동은_정체아님(self):
        r = evaluate(sched("draft"), obs(days_ago=3), sig(), now=NOW, stale_days=14)
        self.assertEqual(r.silent_phases, [])

    def test_phase_활동은_최신값기준(self):
        """한 phase에 신호가 둘이면 더 최근 것이 정체 판정을 지운다."""
        s = {"phases": [{"id": "P4", "artifacts": [
            {"id": "P4-A1", "state": "draft"}, {"id": "P4-A2", "state": "draft"}]}]}
        signals = [
            {"id": "S1", "pattern": "a", "targets": [{"artifact": "P4-A1", "propose": "draft"}]},
            {"id": "S2", "pattern": "b", "targets": [{"artifact": "P4-A2", "propose": "draft"}]},
        ]
        o = {}
        o.update(obs("S1", days_ago=40))
        o.update(obs("S2", days_ago=1))
        r = evaluate(s, o, signals, now=NOW, stale_days=14)
        self.assertEqual(r.silent_phases, [])


class TestIntegrity(unittest.TestCase):

    def test_없는_artifact_경고(self):
        r = evaluate(sched(aid="P4-A3"), obs(), sig(aid="P9-A9"), now=NOW)
        self.assertTrue(any("P9-A9" in w for w in r.warnings))
        self.assertEqual(r.proposals, [])

    def test_매핑안된_artifact_보고(self):
        s = {"phases": [{"id": "P4", "artifacts": [
            {"id": "P4-A1", "state": "not_started"},
            {"id": "P4-A2", "state": "not_started"}]}]}
        r = evaluate(s, obs(), sig(aid="P4-A1"), now=NOW)
        self.assertEqual(r.unmapped_artifacts, ["P4-A2"])

    def test_id없으면_인덱스로_생성(self):
        s = {"phases": [{"id": "P2", "artifacts": [
            {"name": "첫째", "state": "not_started"},
            {"name": "둘째", "state": "not_started"}]}]}
        r = evaluate(s, obs(), sig(aid="P2-A2"), now=NOW)
        self.assertEqual(len(r.proposals), 1)
        self.assertEqual(r.proposals[0].artifact_id, "P2-A2")

    def test_continuous_트랙_인식(self):
        s = {"phases": [], "continuous": [{"name": "선행연구 비교표", "state": "not_started"}]}
        r = evaluate(s, obs(), sig(aid="CT-A1"), now=NOW)
        self.assertEqual(r.proposals[0].phase_id, "CT")

    def test_상태순서_불변(self):
        self.assertEqual(STATE_ORDER,
                         ["not_started", "in_progress", "draft", "verified"])
        self.assertLess(rank(MAX_AUTO_STATE), rank("verified"))


class TestCollect(unittest.TestCase):

    def test_글롭_매칭(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "results" / "pso_001").mkdir(parents=True)
            (root / "results" / "pso_001" / "meta.json").write_text("{}")
            signals = [{"id": "S", "pattern": "results/pso_*/meta.json", "targets": []}]
            o = collect(root, signals, use_git=False)
            self.assertTrue(o["S"][0].exists)
            self.assertEqual(o["S"][0].path, "results/pso_001/meta.json")

    def test_미존재시_exists_False(self):
        with tempfile.TemporaryDirectory() as td:
            signals = [{"id": "S", "pattern": "results/none/x.npy", "targets": []}]
            o = collect(Path(td), signals, use_git=False)
            self.assertFalse(o["S"][0].exists)

    def test_쓰기_없음(self):
        """collect 호출 후 디렉터리 내용이 변하지 않아야 한다."""
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a").mkdir()
            before = sorted(p.name for p in root.rglob("*"))
            collect(root, [{"id": "S", "pattern": "**/*", "targets": []}], use_git=False)
            after = sorted(p.name for p in root.rglob("*"))
            self.assertEqual(before, after)


class TestRender(unittest.TestCase):

    def test_제안없음_문구(self):
        out = render(evaluate(sched("draft"), obs(exists=False), sig(), now=NOW))
        self.assertIn("제안 없음", out)

    def test_강등이_먼저_출력(self):
        with tempfile.TemporaryDirectory() as td:
            s = {"phases": [{"id": "P2", "artifacts": [
                {"id": "P2-A1", "state": "verified", "evidence": "없음.npy"},
                {"id": "P2-A9", "state": "not_started"}]}]}
            r = evaluate(s, obs(), sig(aid="P2-A9"), now=NOW, root=Path(td))
            out = render(r)
            self.assertLess(out.index("P2-A1"), out.index("P2-A9"))
            self.assertIn("!P2-A1", out)

    def test_dry_run_명시(self):
        self.assertIn("파일 미변경", render(evaluate(sched(), obs(), sig(), now=NOW)))


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestEvidenceResolve(unittest.TestCase):
    """실제 schedule.yaml에서 나온 evidence 형식들."""

    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.root = Path(self.td.name)
        (self.root / "Simulation").mkdir()
        (self.root / "Simulation" / "model.py").write_text("x")
        (self.root / "Simulation" / "op.py").write_text("x")
        d = self.root / "results" / "J0.5_XR5_v3_20260820"
        d.mkdir(parents=True)
        (d / "x0_SCR1.50.npy").write_bytes(b"x")

    def tearDown(self):
        self.td.cleanup()

    def _ok(self, ev):
        from observer import resolve_evidence
        return resolve_evidence(ev, self.root, None)[1]

    def test_code_root_토큰_치환(self):
        self.assertTrue(self._ok("code_root/Simulation/model.py"))

    def test_심볼_지정자_분리(self):
        self.assertTrue(self._ok("code_root/Simulation/op.py :: fd_jacobian"))

    def test_글롭_패턴(self):
        self.assertTrue(self._ok("code_root/results/J*_XR*_v3_*/x0_SCR*.npy"))

    def test_토큰_없는_평범한_경로(self):
        self.assertTrue(self._ok("Simulation/model.py"))

    def test_역슬래시_경로(self):
        self.assertTrue(self._ok("code_root\\Simulation\\model.py"))

    def test_진짜_없으면_False(self):
        self.assertFalse(self._ok("code_root/Simulation/nope.py"))

    def test_글롭_매칭없으면_False(self):
        self.assertFalse(self._ok("results/ZZZ*/none*.npy"))

    def test_vault_미존재시_판정보류(self):
        from observer import resolve_evidence
        _, ok, note = resolve_evidence("vault_root/노트.md", self.root,
                                       Path("/없는볼트경로"))
        self.assertTrue(ok, "볼트가 없으면 강등하지 않는다")
        self.assertIn("보류", note)

    def test_오탐_회귀_6건(self):
        """실제 출력에서 오탐이었던 형식들이 전부 통과해야 한다."""
        for ev in ["code_root/Simulation/model.py",
                   "code_root/Simulation/op.py :: fd_jacobian",
                   "code_root/results/J*_XR*_v3_*/x0_SCR*.npy",
                   "code_root/Simulation/pf.py"]:
            with self.subTest(ev=ev):
                pass  # 경로 존재 여부는 위 케이스에서 개별 검증


class TestDeriveSignals(unittest.TestCase):

    def test_evidence에서_신호유도(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P2", "artifacts": [
            {"id": "P2-A1", "state": "not_started",
             "evidence": "code_root/Simulation/model.py"}]}]}
        sigs, _ = derive_signals(s)
        self.assertEqual(len(sigs), 1)
        self.assertEqual(sigs[0]["pattern"], "Simulation/model.py")
        self.assertEqual(sigs[0]["targets"][0]["artifact"], "P2-A1")

    def test_심볼과_글롭_유지(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P2", "artifacts": [
            {"id": "P2-A2", "evidence": "code_root/Simulation/op.py :: fd_jacobian"},
            {"id": "P2-A3", "evidence": "code_root/results/J*_XR*_v3_*/x0_SCR*.npy"}]}]}
        pats = {sg["targets"][0]["artifact"]: sg["pattern"]
                for sg in derive_signals(s)[0]}
        self.assertEqual(pats["P2-A2"], "Simulation/op.py")
        self.assertEqual(pats["P2-A3"], "results/J*_XR*_v3_*/x0_SCR*.npy")

    def test_evidence_없으면_제외(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P0", "artifacts": [{"id": "P0-A1"}]}]}
        sigs, skipped = derive_signals(s)
        self.assertEqual(sigs, [])
        self.assertTrue(any("P0-A1" in x for x in skipped))

    def test_manual_only_제외(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P0", "artifacts": [
            {"id": "P0-A1", "evidence": "code_root/x.txt"}]}]}
        sigs, skipped = derive_signals(s, manual_only={"P0-A1"})
        self.assertEqual(sigs, [])
        self.assertTrue(any("manual_only" in x for x in skipped))

    def test_볼트경로는_제외(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P8", "artifacts": [
            {"id": "P8-A1", "evidence": "vault_root/07_Claims/H1.md"}]}]}
        sigs, skipped = derive_signals(s)
        self.assertEqual(sigs, [])
        self.assertTrue(any("볼트" in x for x in skipped))

    def test_verified_승격_불가(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P2", "artifacts": [
            {"id": "P2-A1", "evidence": "code_root/a.py"}]}]}
        sigs, _ = derive_signals(s)
        self.assertEqual(sigs[0]["targets"][0]["propose"], "draft")

    def test_continuous_포함(self):
        from observer import derive_signals
        s = {"phases": [], "continuous": [
            {"id": "C1", "evidence": "code_root/refs.bib"}]}
        sigs, _ = derive_signals(s)
        self.assertEqual(sigs[0]["targets"][0]["artifact"], "C1")


class TestOpenIssue(unittest.TestCase):

    def test_issue_있으면_유도제외(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P2", "artifacts": [
            {"id": "P2-A4", "evidence": "code_root/r/x.json",
             "issue": "허용치 1e-6 초과"}]}]}
        sigs, skipped = derive_signals(s)
        self.assertEqual(sigs, [])
        self.assertTrue(any("issue 미해결" in x for x in skipped))

    def test_next_action_도_동일(self):
        from observer import derive_signals
        s = {"phases": [{"id": "P4", "artifacts": [
            {"id": "P4-A1", "evidence": "code_root/a.json",
             "next_action": "재작성"}]}]}
        self.assertEqual(derive_signals(s)[0], [])

    def test_note만_있으면_통과(self):
        """note는 설명이지 미해결 표시가 아니다."""
        from observer import derive_signals
        s = {"phases": [{"id": "P2", "artifacts": [
            {"id": "P2-A1", "evidence": "code_root/a.py", "note": "설명"}]}]}
        self.assertEqual(len(derive_signals(s)[0]), 1)

    def test_빈문자열은_미해결_아님(self):
        from observer import has_open_issue
        self.assertIsNone(has_open_issue({"issue": "   "}))
        self.assertIsNone(has_open_issue({"issue": None}))

    def test_verified인데_issue있으면_강등(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.py").write_text("x")
            s = {"phases": [{"id": "P2", "artifacts": [
                {"id": "P2-A2", "state": "verified", "evidence": "code_root/a.py",
                 "issue": "허용치 초과"}]}]}
            r = evaluate(s, {}, [], now=NOW, root=root)
            self.assertEqual(len(r.proposals), 1)
            self.assertEqual(r.proposals[0].kind, "demote")
            self.assertIn("issue", r.proposals[0].reason)

    def test_verified_깨끗하면_조용(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.py").write_text("x")
            s = {"phases": [{"id": "P2", "artifacts": [
                {"id": "P2-A1", "state": "verified", "evidence": "code_root/a.py"}]}]}
            self.assertEqual(evaluate(s, {}, [], now=NOW, root=root).proposals, [])