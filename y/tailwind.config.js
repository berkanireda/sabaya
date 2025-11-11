// /** @type {import('tailwindcss').Config} */
// export default {
//   content: ["./p.html"], // <-- on ne scanne que p.html
//   theme: { extend: {} },
//   plugins: [],
// };


/** @type {import('tailwindcss').Config} */
export default {
  content: ["./**/*.{html,js}"],
  safelist: [
    "bg-red-600",            // add any dynamic classes here
    // "text-red-600", etc.
  ],
  theme: { extend: {} },
  plugins: [],
};