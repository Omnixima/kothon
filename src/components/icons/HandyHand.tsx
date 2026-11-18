import mark from "../../assets/kothon-mark.png";

// Kothon's mouth mark in the current text color (sidebar icon, file drop).
// Keeps the old component name so call sites stay unchanged.
const HandyHand = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={`inline-block bg-current ${className ?? ""}`}
    style={{
      width: width || 24,
      height: height || 24,
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
);

export default HandyHand;
