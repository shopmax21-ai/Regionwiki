import { Roboto } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const fontVars = roboto.variable;
