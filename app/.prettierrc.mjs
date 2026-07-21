/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro"],
  singleAttributePerLine: true,
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
