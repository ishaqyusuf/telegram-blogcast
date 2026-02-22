import { Amiri, Dancing_Script, Moon_Dance } from "next/font/google";

const arabic = Amiri({
    weight: "400",
    subsets: ["arabic"],
});
const dancingScript = Dancing_Script({
    subsets: ["latin"],
});
const moonDance = Moon_Dance({
    subsets: ["latin"],
    weight: "400",
});

export { arabic, moonDance, dancingScript };

