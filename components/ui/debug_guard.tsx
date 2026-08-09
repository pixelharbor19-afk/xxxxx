"use client";

import { useEffect } from "react";

export default function DevToolGuard() {
  useEffect(() => {
    import("disable-devtool").then((m) =>
      m.default({
        disableMenu: true,
        tkName: "zxc", // your custom param name
        md5: "68934a3e9455fa72420237eb05902327", // md5 of the bypass value
        url: "https://zxcstream.icu",
      }),
    );
  }, []);

  return null;
}
