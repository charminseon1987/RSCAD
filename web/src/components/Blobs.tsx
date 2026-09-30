/* 정적 블롭 배경 — docs/DESIGN_PROMPT.md 부록

   "유체 배경은 랜딩/로그인에만 쓰고, 작업 화면에서는 유체 대신 정적 블롭 3개
   (인디고·틸·앰버, blur 80px, 40초 drift)로 바꿔 집중을 해치지 않게 한다."

   색·블러·주기는 CSS(.ls-blobs)에 있다. prefers-reduced-motion 에서는 drift 가
   멈추고, prefers-reduced-transparency 에서는 통째로 숨는다. */

export default function Blobs() {
  return (
    <div className="ls-blobs" aria-hidden="true">
      <i /><i /><i />
    </div>
  );
}
