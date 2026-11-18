import wordmark from "../../assets/kothon-wordmark.png";

// Kothon's wordmark (কথন), drawn as a mask so it takes the brand color in
// both themes. Keeps the old component name so call sites stay unchanged.
const ASPECT = 183 / 480;

const HandyTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  const w = width ?? (height ? height / ASPECT : 120);
  return (
    <span
      role="img"
      aria-label="Kothon"
      className={`block bg-logo-primary ${className ?? ""}`}
      style={{
        width: w,
        height: height ?? w * ASPECT,
        maskImage: `url(${wordmark})`,
        WebkitMaskImage: `url(${wordmark})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
};

export default HandyTextLogo;
