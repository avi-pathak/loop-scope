/** Four L-shaped registration ticks, one at each corner of a drafted frame. */
export default function RegistrationTicks() {
  return (
    <>
      <span className="reg-tick left-[3px] top-[3px] border-l border-t" />
      <span className="reg-tick right-[3px] top-[3px] border-r border-t" />
      <span className="reg-tick bottom-[3px] left-[3px] border-b border-l" />
      <span className="reg-tick bottom-[3px] right-[3px] border-b border-r" />
    </>
  );
}
