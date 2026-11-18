import mark from "../../assets/kothon-mark.png";

/** Kothon's mascot: the mouth mark on a brand tile. */
const HandyMascot = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`flex aspect-square items-center justify-center rounded-[24%] ${className}`}
    style={{ background: "var(--light-color-logo-stroke)" }}
  >
    <span
      className="block h-[62%] w-[62%] bg-white"
      style={{
        maskImage: `url(${mark})`,
        WebkitMaskImage: `url(${mark})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  </span>
);

export default HandyMascot;
