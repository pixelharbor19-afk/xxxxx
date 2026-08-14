// "use client";

// import { useEffect, useState } from "react";

// const QUERY = "(max-width: 767px)";

// export function useIsMobile() {
//   const [isMobile, setIsMobile] = useState(false);

//   useEffect(() => {
//     const media = window.matchMedia(QUERY);

//     const update = () => setIsMobile(media.matches);

//     update();
//     media.addEventListener("change", update);

//     return () => media.removeEventListener("change", update);
//   }, []);

//   return isMobile;
// }
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
